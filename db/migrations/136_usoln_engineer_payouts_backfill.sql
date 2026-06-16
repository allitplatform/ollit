-- ============================================
-- Migration 136 — 유솔N 기사 지급 이력 백필 (일회성)
-- 작성일 : 2026-06-16
-- 의존   : Mig 135 (usoln_engineer_payouts 테이블 + RPC 4개)
--
-- 사장님 spec:
--   기존 task_items.engineer_settled_at 가 NOT NULL 인 row 측 payouts row 가 없으면
--   1회 INSERT 백필.
--   회차는 engineer_settled_at 의 KST 일자로 추정:
--     · day(KST) <= 17 → '1차'
--     · day(KST) >= 25 → '2차'
--     · else            → '추가'  (이상값 — 운영 실수 정정 가능성)
--   금액: task 의 engineer_excl_extra × item.subtotal / SUM(subtotals) (Mig 135 RPC ① 동일 산식)
--   actor: NULL (시스템 백필)
--   memo: '백필 (Mig 136)'
--
-- 안전:
--   · INSERT ... SELECT ... WHERE NOT EXISTS 가드 — 재실행 안전 (이미 백필된 row 측 skip).
--   · is_canceled row 측 제외.
--   · assigned_engineer_id NULL row 측 제외 (NOT NULL 제약 안전망).
--   · principal usol_n 만 대상.
--
-- 실행 순서:
--   [STEP 1] 사전 진단 SELECT — 백필 대상 row 수 확인
--   [STEP 2] BEGIN; INSERT; ROLLBACK 으로 시뮬 (count 검증)
--   [STEP 3] 실제 백필 (BEGIN; INSERT; COMMIT;)
--   [STEP 4] 사후 확인 — payouts row vs settled item 카운트 일치
-- ============================================

-- ============================================
-- [STEP 1] 사전 진단 — 백필 대상 row 수
-- ============================================
-- SELECT
--   COUNT(*) FILTER (WHERE ti.engineer_settled_at IS NOT NULL
--                      AND NOT EXISTS (SELECT 1 FROM usoln_engineer_payouts pp WHERE pp.task_item_id = ti.id)
--                   ) AS backfill_target,
--   COUNT(*) FILTER (WHERE ti.engineer_settled_at IS NOT NULL) AS already_settled,
--   COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM usoln_engineer_payouts pp WHERE pp.task_item_id = ti.id))
--     AS already_has_payout
-- FROM task_items ti
-- JOIN tasks t ON t.id = ti.task_id
-- JOIN principals pr ON pr.id = t.principal_id AND pr.code = 'usol_n'
-- WHERE t.tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
--   AND NOT COALESCE(ti.is_canceled, false)
--   AND t.assigned_engineer_id IS NOT NULL;

-- ============================================
-- [STEP 2 & 3] 백필 INSERT (가드 포함)
-- ============================================
BEGIN;

WITH target_tasks AS (
  SELECT
    t.id                          AS task_id,
    t.assigned_engineer_id,
    t.completed_at,
    to_char(t.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') AS work_month,
    p.engineer_amount,
    p.extra_fee,
    (p.engineer_amount
      - (COALESCE(p.extra_fee, 0) - FLOOR(COALESCE(p.extra_fee, 0) * 0.15))
    )::int AS eng_excl_extra
  FROM tasks t
  JOIN payments p ON p.task_id = t.id
  JOIN principals pr ON pr.id = t.principal_id AND pr.code = 'usol_n'
  WHERE t.tenant_id    = '11111111-1111-1111-1111-111111111111'::uuid
    AND t.assigned_engineer_id IS NOT NULL
),
task_sums AS (
  SELECT
    task_id,
    SUM(subtotal) FILTER (WHERE NOT COALESCE(is_canceled, false))::numeric AS sum_subtotal
  FROM task_items
  WHERE task_id IN (SELECT task_id FROM target_tasks)
  GROUP BY task_id
)
INSERT INTO usoln_engineer_payouts (
  tenant_id, task_item_id, engineer_id, work_month,
  payout_round, amount, paid_at, actor, memo, is_refund
)
SELECT
  '11111111-1111-1111-1111-111111111111'::uuid,
  ti.id,
  tt.assigned_engineer_id,
  tt.work_month,
  -- 회차 추정 — engineer_settled_at KST 일자 기준
  CASE
    WHEN EXTRACT(DAY FROM ti.engineer_settled_at AT TIME ZONE 'Asia/Seoul') <= 17 THEN '1차'
    WHEN EXTRACT(DAY FROM ti.engineer_settled_at AT TIME ZONE 'Asia/Seoul') >= 25 THEN '2차'
    ELSE '추가'
  END,
  -- 금액 — Mig 135 RPC ① 동일 산식
  CASE
    WHEN ts.sum_subtotal > 0
      THEN ROUND(tt.eng_excl_extra::numeric * ti.subtotal::numeric / ts.sum_subtotal)::int
    ELSE tt.eng_excl_extra
  END,
  ti.engineer_settled_at,  -- 원본 stamp 시각 보존
  NULL,                    -- actor: 시스템 백필
  '백필 (Mig 136)',
  false
FROM task_items ti
JOIN target_tasks tt ON tt.task_id = ti.task_id
JOIN task_sums    ts ON ts.task_id = ti.task_id
WHERE NOT COALESCE(ti.is_canceled, false)
  AND ti.engineer_settled_at IS NOT NULL
  -- 재실행 안전 — 이미 백필된 row skip
  AND NOT EXISTS (
    SELECT 1 FROM usoln_engineer_payouts pp WHERE pp.task_item_id = ti.id
  );

-- COMMIT 직전 확인용 SELECT (옵션 — psql 에서 \echo 와 함께)
-- SELECT COUNT(*) AS inserted FROM usoln_engineer_payouts WHERE memo = '백필 (Mig 136)';

COMMIT;

-- ============================================
-- [STEP 4] 사후 확인
-- ============================================
-- 1) 백필 row 수:
-- SELECT COUNT(*) AS backfilled
-- FROM usoln_engineer_payouts WHERE memo = '백필 (Mig 136)';
--
-- 2) 회차별 분포:
-- SELECT payout_round, COUNT(*), SUM(amount)
-- FROM usoln_engineer_payouts WHERE memo = '백필 (Mig 136)'
-- GROUP BY payout_round ORDER BY payout_round;
--
-- 3) 정합성 — settled item vs payouts row 1:1 매칭:
-- WITH settled AS (
--   SELECT ti.id FROM task_items ti
--   JOIN tasks t ON t.id = ti.task_id
--   JOIN principals pr ON pr.id = t.principal_id AND pr.code = 'usol_n'
--   WHERE t.tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
--     AND NOT COALESCE(ti.is_canceled, false)
--     AND ti.engineer_settled_at IS NOT NULL
--     AND t.assigned_engineer_id IS NOT NULL
-- ),
-- with_payout AS (
--   SELECT DISTINCT task_item_id FROM usoln_engineer_payouts
-- )
-- SELECT
--   (SELECT COUNT(*) FROM settled)             AS settled_items,
--   (SELECT COUNT(*) FROM with_payout)         AS items_with_payout,
--   (SELECT COUNT(*) FROM settled s
--     WHERE NOT EXISTS (SELECT 1 FROM with_payout wp WHERE wp.task_item_id = s.id))
--                                              AS settled_without_payout;
-- 기대: settled_items = items_with_payout, settled_without_payout = 0.
--
-- 4) 회차별 작업월 분포 (이상값 — '추가' 백필 수 확인):
-- SELECT work_month, payout_round, COUNT(*), SUM(amount)
-- FROM usoln_engineer_payouts WHERE memo = '백필 (Mig 136)'
-- GROUP BY work_month, payout_round ORDER BY work_month, payout_round;
-- 기대: '추가' 백필이 많으면 stamp 시점이 비정상적 (운영 실수 / 일자 18~24 stamp).
--       소수면 정상. 다수면 운영자 검토 권장.

-- ============================================
-- 롤백 (위급 시):
-- BEGIN;
-- DELETE FROM usoln_engineer_payouts WHERE memo = '백필 (Mig 136)';
-- COMMIT;
-- ============================================
