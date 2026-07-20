-- ad-hoc_2026-07-20_dryrun_confirm_7_13.sql
-- 2026-07-20 — Mig 185 confirm 로직 시뮬 (SELECT-only, INSERT/UPDATE X)
--
-- 목적:
--   Mig 185 실행 전 사장님이 콘솔에서 실행해 7/13 확정 시나리오 검증.
--   기대치 (엑셀 유솔N_주정산_7월 2주차 (1).xlsx 요약):
--     · 총 건수:        53 (당주 14 + 이월 39)
--     · 총 실입금(85%): 2,865,597 = 통장 실입금 정확 일치
--     · 총 정산원금:    3,371,291
--     · 당주 정산원금:  1,196,361  (엑셀 값)
--     · 이월 정산원금:  2,174,930  (엑셀 값)
--     · 당주 실입금:    1,016,906
--     · 이월 실입금:    1,848,691  (총 2,865,597 − 당주 1,016,906)
--   [주의] 엑셀 요약의 당주 정산원금 1,016,906 / 이월 2,354,385 는 요약 시트 값.
--          위 값은 dryrun 산출값과 대조. 필요 시 사장님이 소스 대조.
--
-- 실행 조건:
--   · Mig 185 미적용 상태에서도 실행 가능 (SELECT-only, ROUND · date_trunc 표준)
--   · 7/13 확정용 파라미터: principal=usol_n, week_start=2026-07-06, week_end=2026-07-12
--
-- 검증 포인트:
--   [P1] 총 건수·총 실입금이 엑셀·통장과 정확 일치 → OK 후 Mig 185 적용
--   [P2] 불일치 → 필터·산식 · 데이터 상태 재조사

-- ============================================================================
-- 파라미터 (WITH 로 캡슐화)
-- ============================================================================
WITH params AS (
  SELECT
    (SELECT id FROM principals WHERE code = 'usol_n')  AS pid,
    DATE '2026-07-06'                                  AS week_start,
    DATE '2026-07-12'                                  AS week_end
),
candidates AS (
  SELECT
    ti.id                                                              AS task_item_id,
    ti.task_id,
    ti.subtotal,
    ti.net_amount,
    ti.naver_settled_at,
    ti.company_received_at,
    ti.product_order_id,
    t.customer_name,
    t.task_no,
    (ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date              AS settled_kst_date,
    date_trunc(
      'week',
      ((ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date)::timestamp
    )::date                                                            AS settled_monday
  FROM task_items ti
  JOIN tasks t ON ti.task_id = t.id
  CROSS JOIN params
  WHERE t.principal_id = params.pid
    AND t.status = '완료'
    AND ti.naver_settled_at IS NOT NULL
    AND COALESCE(ti.is_canceled, false) = false
    AND ti.subtotal > 0
    AND EXISTS (SELECT 1 FROM payments p
                 WHERE p.task_id = t.id AND p.track = 'B')
),
in_scope AS (
  SELECT
    c.*,
    CASE
      WHEN c.settled_monday = params.week_start THEN false               -- 당주
      WHEN c.settled_monday < params.week_start THEN true                -- 이월
    END AS is_carryover_flag,
    ROUND(c.subtotal::numeric * 0.85)::int                              AS company_receive_amount
  FROM candidates c
  CROSS JOIN params
  WHERE
    c.settled_monday = params.week_start
    OR (c.settled_monday < params.week_start AND c.company_received_at IS NULL)
)
-- ============================================================================
-- [1] 요약 — 예상 스냅샷 대상 (엑셀·통장 대조)
-- ============================================================================
SELECT
  '전체 (당주 ∪ 이월)'                       AS bucket,
  count(*)                                     AS cnt,
  sum(subtotal)                                AS sum_subtotal,
  sum(company_receive_amount)                  AS sum_company_receive
FROM in_scope

UNION ALL

SELECT
  '당주 (settled_monday = 2026-07-06)'         AS bucket,
  count(*)                                     AS cnt,
  sum(subtotal)                                AS sum_subtotal,
  sum(company_receive_amount)                  AS sum_company_receive
FROM in_scope WHERE is_carryover_flag = false

UNION ALL

SELECT
  '이월 (settled_monday < 2026-07-06)'         AS bucket,
  count(*)                                     AS cnt,
  sum(subtotal)                                AS sum_subtotal,
  sum(company_receive_amount)                  AS sum_company_receive
FROM in_scope WHERE is_carryover_flag = true;

-- 기대:
--   전체: 53건 / sum_subtotal 3,371,291 / sum_company_receive 2,865,597
--   당주: 14건 / ...                     / 1,016,906
--   이월: 39건 / ...                     / 1,848,691

-- ============================================================================
-- [2] 이월 세부 — 원 정산주별 분포 (엑셀 "구분" 컬럼 대조)
-- ============================================================================
-- 아래 CTE 재선언 필요 (같은 세션 재사용 안 됨).
--
-- WITH params AS (SELECT DATE '2026-07-06' AS week_start),
--      ...(위 CTE 그대로)...
-- SELECT settled_monday, count(*), sum(subtotal), sum(company_receive_amount)
--   FROM in_scope WHERE is_carryover_flag = true
--  GROUP BY settled_monday ORDER BY settled_monday;
--
-- 기대 분포 (엑셀 7/13 이월 39건):
--   2026-06-08: 10건
--   2026-06-15: 22건
--   2026-06-22: 4건
--   2026-06-01:  3건
--   (엑셀 요약과 대조. 원 정산주가 6/1~6/7 3건 = 2026-06-01)

-- ============================================================================
-- [3] 결과 해석
-- ============================================================================
--   [P1 OK] 전체 53건 / 2,865,597 정확 일치 → Mig 185 적용 진행
--   [P1 X ] 카운트/총액 다름 → 다음 재조사:
--     · 이월 39건 중 이미 company_received_at 스탬프된 items 있나?
--       (다른 경로 - CSV 매칭 등 - 로 스탬프됐을 가능성)
--     · payments.track = 'B' 조건에 걸리지 않는 items 있나?
--     · tasks.status != '완료' 로 바뀐 items 있나?
--     · 원본 subtotal · 산식 ROUND(× 0.85) 대조
