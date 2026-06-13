-- Migration 123 — bookkeeping_get_usoln_track_b_margin v6 (settle-month basis)
-- Behavioral change (사장님 spec):
--   usol_n 월정산 = work_month 의 "전 달" completed_at 분.
--   (15일 정산이라 작업 다음 달에 가계부 income으로 잡힘.)
--
--   work_month='2026-06' → 2026-05 KST completed_at 합산 → 5월 작업분 (= ₩18,946,363)
--   work_month='2026-05' → 2026-04 KST completed_at 합산 → 4월 작업분
--   work_month='2026-01' → 2025-12 KST completed_at 합산 (1월 → 작년 12월 rollback)
--
-- Track A (일정산) is unchanged — still uses caller's own month
-- (computeRevenueByYmRange in client). Only track B (this RPC) shifts.
--
-- DROP+CREATE (Mig 121 plan cache lesson).
-- Verify: '2026-06' → 18,946,363 (5월 작업분).

BEGIN;

DROP FUNCTION IF EXISTS bookkeeping_get_usoln_track_b_margin(text, uuid);

CREATE FUNCTION bookkeeping_get_usoln_track_b_margin(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year       int;
  v_month      int;
  v_prev_year  int;
  v_prev_month int;
  v_start      timestamptz;
  v_end        timestamptz;
  v_amount     bigint;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  v_year  := SUBSTRING(p_work_month FROM 1 FOR 4)::int;
  v_month := SUBSTRING(p_work_month FROM 6 FOR 2)::int;

  -- v6 fix: shift to PREVIOUS month for usol_n (settle-month basis).
  --   January (month=1) → previous month = previous year December.
  IF v_month = 1 THEN
    v_prev_year  := v_year - 1;
    v_prev_month := 12;
  ELSE
    v_prev_year  := v_year;
    v_prev_month := v_month - 1;
  END IF;

  -- Range:
  --   v_start = prev_month 1st KST 00:00
  --   v_end   = input_month 1st KST 00:00 (next month after prev_month)
  v_start := make_timestamptz(v_prev_year, v_prev_month, 1, 0, 0, 0, 'Asia/Seoul');
  v_end   := make_timestamptz(v_year,      v_month,      1, 0, 0, 0, 'Asia/Seoul');

  SELECT COALESCE(SUM(p.owner_amount), 0)::bigint
    INTO v_amount
  FROM payments p
  JOIN tasks t       ON t.id = p.task_id
  JOIN principals pr ON pr.id = t.principal_id
  WHERE pr.code = 'usol_n'
    AND t.status = '완료'
    AND p.track  = 'B'
    AND t.completed_at >= v_start
    AND t.completed_at <  v_end
    AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

  RETURN jsonb_build_object('ok', true, 'amount', v_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_get_usoln_track_b_margin(text, uuid) TO anon, authenticated;

COMMENT ON FUNCTION bookkeeping_get_usoln_track_b_margin(text, uuid) IS
  'v6 (Mig 123, 2026-06-14) — settle-month basis. p_work_month means the month '
  'when usol_n track B is recorded in the ledger; the SUM range is the PREVIOUS '
  'month''s completed_at (15-day-later settlement). '
  'January rolls back to previous year December. v5 (Mig 121) used same month.';

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. ★ 2026-06 = 5월 작업분 = ₩18,946,363
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-06',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": 18946363 }
--
-- B. 2026-05 = 4월 작업분 (4월에 usol_n track B 없으면 0)
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": <4월 작업 sum> }
--
-- C. 2026-07 = 6월 작업분
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-07',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": 10299350 } (6월 작업분 — Mig 121 시 '2026-06' 결과)
--
-- D. 2026-01 rollback to 2025-12 (no rollover error)
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-01',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": <2025-12 작업분> } (no error).
--
-- E. Permission denied
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-06',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }
