-- Migration 121 — bookkeeping_get_usoln_track_b_margin v5 (v_end fix)
-- Root cause (confirmed by debug RPC):
--   v_end := v_start + INTERVAL '1 month' was wrong.
--   v_start is timestamptz (e.g. UTC 2026-04-30 15:00:00 = KST 2026-05-01 00:00).
--   timestamptz + INTERVAL '1 month' uses calendar arithmetic on the UTC date:
--     UTC 2026-04-30 + 1 month = UTC 2026-05-30 (date preserved) = KST 2026-05-31 00:00.
--   → v_end landed one day short of KST 6/1, missing all of KST 5/31 (~35 tasks, ₩784,551).
--
--   Debug RPC confirmed:
--     v_start = 2026-04-30T15:00:00+00 (KST 5/1 00:00) ✓
--     v_end   = 2026-05-30T15:00:00+00 (KST 5/31 00:00) ✗  expected KST 6/1 00:00
--     task_count_in_range = 805 (840 - 35 missing on 5/31)
--     sum_in_func = 18,161,812 (vs raw SQL 18,946,363)
--
-- v5 fix:
--   Build v_end directly with make_timestamptz for the FIRST DAY OF THE NEXT MONTH
--   in Asia/Seoul. Handle December → next year January rollover explicitly.
--
-- CREATE OR REPLACE alone may keep plan cache stale on Supabase — use DROP+CREATE.

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
  v_next_year  int;
  v_next_month int;
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

  -- v5 fix: build v_end directly as KST first-day-of-next-month.
  --   December rollover: month=12 → next year January.
  IF v_month = 12 THEN
    v_next_year  := v_year + 1;
    v_next_month := 1;
  ELSE
    v_next_year  := v_year;
    v_next_month := v_month + 1;
  END IF;

  v_start := make_timestamptz(v_year,      v_month,      1, 0, 0, 0, 'Asia/Seoul');
  v_end   := make_timestamptz(v_next_year, v_next_month, 1, 0, 0, 0, 'Asia/Seoul');

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
  'v5 (Mig 121, 2026-06-13) — v_end built directly with make_timestamptz (next-month 1st KST). '
  'v1-v4 bugs all resolved. December rollover handled (v_next_year = v_year+1).';

-- Cleanup debug RPC
DROP FUNCTION IF EXISTS _debug_bookkeeping_usoln(text);

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. ★ 핵심 — 2026-05 = ₩18,946,363:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": 18946363 }
--
-- B. December rollover — 2026-12 (range = 2026-12-01 KST ~ 2027-01-01 KST):
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-12',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": <value> } (no rollover error).
--
-- C. June (was already correct in v4):
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-06',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": 10299350 }
--
-- D. Permission denied:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }
