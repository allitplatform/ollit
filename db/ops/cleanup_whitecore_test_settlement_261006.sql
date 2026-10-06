-- ============================================================================
-- 화이트코어 시험 정산 데이터 정리 (10/6 ~ 10/7)
-- 작성 2026-10-06 · 실행은 사장님 · 10/8 첫 실작업 전에 실행
--
-- 왜 필요한가
--   10/6 시험 작업(A-261006-013)으로 만든 "10/6 보고·입금 확인 70,000" 과
--   "10/7 차감분 이월 -70,000" 이 실제 정산 표에 남아 있습니다.
--   그대로 두면 10/8 첫 실작업 날 화이트코어가 보낼 수수료에서 70,000 이 빠집니다
--   (실제로는 송금된 적 없는 시험 금액).
--
-- 지우는 것 (화이트코어 것만)
--   · 정산 줄        : 시험 작업 4건(A-261006-005 / 007 / 009 / 013)의 줄 + 10/6 ~ 10/7 날짜의 줄
--   · 정산 일자      : 10/6, 10/7
--   · 정산 처리 기록 : 10/6, 10/7
--   · 가계부 현금    : 위 정산 일자에 연결된 협력사 수수료 입금 / 환급 지출 줄
--
-- 건드리지 않는 것
--   · 작업 4건 자체 (취소 상태 그대로), 그 작업의 payments (이미 0원)
--   · 화이트코어 회사 몫 0% 와 이력 1줄
--   · 다른 날짜, 다른 협력사, 직영·원청 데이터
--
-- 안전장치 - 아래 중 하나라도 해당하면 아무것도 지우지 않고 멈춥니다
--   (a) 시험 작업 4건 중 취소 상태가 아닌 것이 있음
--   (b) 10/6 ~ 10/7 정산 줄에 시험 작업 4건이 아닌 작업이 섞여 있음
--   (c) 시험 작업의 정산 줄이 10/6 ~ 10/7 이 아닌 날짜에 있음
--   (d) 화이트코어 작업 중 10/6 ~ 10/7 에 "완료" 상태로 남아 있는 것이 있음 (실작업일 수 있음)
--
-- 실행 방법: [1] 을 먼저 따로 실행해 목록을 확인 -> [2] 실행 (마지막에 [3] 확인 표가 나옵니다)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- [1] 미리 보기 (읽기 전용) - 지워질 행 전부
-- ----------------------------------------------------------------------------
WITH wc AS (
  SELECT id FROM subcontractors WHERE code = 'whitecore'
),
tt AS (
  SELECT t.id, t.task_no, t.status FROM tasks t
   WHERE t.task_no IN ('A-261006-005', 'A-261006-007', 'A-261006-009', 'A-261006-013')
),
ds AS (
  SELECT s.* FROM subcontractor_daily_settlements s JOIN wc ON wc.id = s.subcontractor_id
   WHERE s.settle_date BETWEEN DATE '2026-10-06' AND DATE '2026-10-07'
)
SELECT '0 시험 작업' AS 구분, tt.task_no AS 대상, NULL::date AS 날짜, NULL::int AS 금액, tt.status AS 내용
  FROM tt
UNION ALL
SELECT '1 정산 줄', COALESCE(t.task_no, l.task_id::text), l.settle_date, l.fee,
       l.kind || COALESCE(' · 원래 ' || l.origin_date::text, '') || COALESCE(' · ' || l.memo, '')
  FROM subcontractor_settlement_lines l
  JOIN wc ON wc.id = l.subcontractor_id
  LEFT JOIN tasks t ON t.id = l.task_id
 WHERE l.task_id IN (SELECT id FROM tt)
    OR l.settle_date BETWEEN DATE '2026-10-06' AND DATE '2026-10-07'
UNION ALL
SELECT '2 정산 일자', '계산 ' || ds.calc_fee || ' / 보고 ' || COALESCE(ds.reported_amount::text, '-'), ds.settle_date, ds.calc_fee,
       CASE WHEN ds.confirmed_at IS NOT NULL THEN '확인 완료' WHEN ds.reported_at IS NOT NULL THEN '보고됨' ELSE '열림' END
  FROM ds
UNION ALL
SELECT '3 처리 기록', e.event, e.settle_date, e.amount, COALESCE(e.actor_name, '') || ' · ' || COALESCE(e.reason, '')
  FROM subcontractor_settlement_events e JOIN wc ON wc.id = e.subcontractor_id
 WHERE e.settle_date BETWEEN DATE '2026-10-06' AND DATE '2026-10-07'
UNION ALL
SELECT '4 가계부', c.source || ' · ' || c.direction, c.flow_date, c.amount::int, c.memo
  FROM bookkeeping_cashflow c
 WHERE c.source IN ('sub_fee', 'sub_refund') AND c.source_ref IN (SELECT id FROM ds)
ORDER BY 1, 3, 2;

-- ----------------------------------------------------------------------------
-- [2] 정리 (한 묶음. 안전장치에 걸리면 아무것도 지우지 않고 멈춤)
-- ----------------------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  v_wc     uuid;
  v_tests  uuid[];
  v_days   uuid[];
  v_bad    text;
  n_cash   int;
  n_event  int;
  n_line   int;
  n_day    int;
BEGIN
  SELECT id INTO v_wc FROM subcontractors WHERE code = 'whitecore';
  IF v_wc IS NULL THEN
    RAISE EXCEPTION '화이트코어 협력사 행이 없습니다. 중단합니다.';
  END IF;

  SELECT array_agg(id) INTO v_tests FROM tasks
   WHERE task_no IN ('A-261006-005', 'A-261006-007', 'A-261006-009', 'A-261006-013');
  IF COALESCE(array_length(v_tests, 1), 0) <> 4 THEN
    RAISE EXCEPTION '시험 작업 4건을 모두 찾지 못했습니다 (찾은 수: %). 중단합니다.', COALESCE(array_length(v_tests, 1), 0);
  END IF;

  -- (a) 시험 작업은 전부 취소 상태여야 한다
  SELECT string_agg(task_no || ' (' || status || ')', ', ') INTO v_bad
    FROM tasks WHERE id = ANY (v_tests) AND status <> '취소';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '취소 상태가 아닌 시험 작업이 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;

  -- (b) 10/6 ~ 10/7 정산 줄에 시험 작업이 아닌 작업이 있으면 중단
  SELECT string_agg(DISTINCT COALESCE(t.task_no, l.task_id::text), ', ') INTO v_bad
    FROM subcontractor_settlement_lines l LEFT JOIN tasks t ON t.id = l.task_id
   WHERE l.subcontractor_id = v_wc
     AND l.settle_date BETWEEN DATE '2026-10-06' AND DATE '2026-10-07'
     AND NOT (l.task_id = ANY (v_tests));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '10/6~10/7 정산 줄에 시험 작업이 아닌 작업이 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;

  -- (c) 시험 작업의 정산 줄이 다른 날짜에 있으면 중단
  SELECT string_agg(DISTINCT l.settle_date::text, ', ') INTO v_bad
    FROM subcontractor_settlement_lines l
   WHERE l.task_id = ANY (v_tests)
     AND (l.subcontractor_id IS DISTINCT FROM v_wc
          OR l.settle_date NOT BETWEEN DATE '2026-10-06' AND DATE '2026-10-07');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '시험 작업의 정산 줄이 10/6~10/7 밖에 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;

  -- (d) 그 기간에 완료 상태로 남은 화이트코어 작업이 있으면 중단 (실작업일 수 있음)
  SELECT string_agg(t.task_no, ', ') INTO v_bad
    FROM tasks t
   WHERE t.subcontractor_id = v_wc AND t.status = '완료' AND t.completed_at IS NOT NULL
     AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN DATE '2026-10-06' AND DATE '2026-10-07';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '10/6~10/7 에 완료 상태인 화이트코어 작업이 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_days
    FROM subcontractor_daily_settlements
   WHERE subcontractor_id = v_wc AND settle_date BETWEEN DATE '2026-10-06' AND DATE '2026-10-07';

  DELETE FROM bookkeeping_cashflow
   WHERE source IN ('sub_fee', 'sub_refund') AND source_ref = ANY (v_days);
  GET DIAGNOSTICS n_cash = ROW_COUNT;

  DELETE FROM subcontractor_settlement_events
   WHERE subcontractor_id = v_wc AND settle_date BETWEEN DATE '2026-10-06' AND DATE '2026-10-07';
  GET DIAGNOSTICS n_event = ROW_COUNT;

  DELETE FROM subcontractor_settlement_lines
   WHERE subcontractor_id = v_wc
     AND (task_id = ANY (v_tests) OR settle_date BETWEEN DATE '2026-10-06' AND DATE '2026-10-07');
  GET DIAGNOSTICS n_line = ROW_COUNT;

  DELETE FROM subcontractor_daily_settlements WHERE id = ANY (v_days);
  GET DIAGNOSTICS n_day = ROW_COUNT;

  RAISE NOTICE '정리 완료 - 가계부 %줄, 처리 기록 %줄, 정산 줄 %줄, 정산 일자 %줄', n_cash, n_event, n_line, n_day;
END $$;

COMMIT;

-- ----------------------------------------------------------------------------
-- [3] 확인 - 기대: 회사 몫 0 / 이력 1, 나머지 칸은 전부 0
-- ----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM subcontractor_settlement_lines l  WHERE l.subcontractor_id = s.id)  AS 남은_정산_줄,
  (SELECT COUNT(*) FROM subcontractor_daily_settlements d WHERE d.subcontractor_id = s.id)  AS 남은_정산_일자,
  (SELECT COUNT(*) FROM _sub_open_plan(s.id))                                               AS 열린_날짜,
  (SELECT COUNT(*) FROM _sub_open_plan(s.id) pl WHERE pl.total < 0)                         AS 이월,
  (SELECT COUNT(*) FROM bookkeeping_cashflow c WHERE c.source IN ('sub_fee', 'sub_refund')) AS 가계부_협력사_줄,
  _sub_cut_pct_on(s.id, (now() AT TIME ZONE 'Asia/Seoul')::date)                            AS 회사몫_퍼센트,
  (SELECT COUNT(*) FROM subcontractor_cut_rates r WHERE r.subcontractor_id = s.id)          AS 회사몫_이력_줄수
FROM subcontractors s
WHERE s.code = 'whitecore';
