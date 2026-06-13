-- Migration 119 — bookkeeping_get_usoln_track_b_margin v3 (make_timestamptz)
-- Root cause history:
--   v1 (Mig 117): date AT TIME ZONE 'Asia/Seoul' asymmetry → v_start landed at
--                 KST 09:00, missing 5/1 00:00~09:00 KST. -677,369.
--   v2 (Mig 118): '+09' offset in string literal parsed by PostgreSQL with
--                 ambiguous semantics → v_start landed near 5/2 00:00 KST,
--                 missing all of 5/1 KST. -784,551.
--
-- v3 fix:
--   make_timestamptz(year, month, day, hour, min, sec, timezone) — PostgreSQL
--   standard function. Explicit components + named zone 'Asia/Seoul'.
--   Zero string-parsing ambiguity.
--
-- CREATE OR REPLACE — same signature (idempotent).
-- Verify (2026-05): expected ₩18,946,363 (matches dashboard + raw query).

BEGIN;

CREATE OR REPLACE FUNCTION bookkeeping_get_usoln_track_b_margin(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year    int;
  v_month   int;
  v_start   timestamptz;
  v_end     timestamptz;
  v_amount  bigint;
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

  -- v3: PostgreSQL standard make_timestamptz with explicit components + named zone.
  v_year  := SUBSTRING(p_work_month FROM 1 FOR 4)::int;
  v_month := SUBSTRING(p_work_month FROM 6 FOR 2)::int;
  v_start := make_timestamptz(v_year, v_month, 1, 0, 0, 0, 'Asia/Seoul');
  v_end   := v_start + INTERVAL '1 month';

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
  'v3 (Mig 119, 2026-06-13) — make_timestamptz with explicit components + Asia/Seoul. '
  'v1 (Mig 117) had date AT TIME ZONE asymmetry. v2 (Mig 118) had ''+09'' string parse ambiguity. '
  'v3 uses PostgreSQL standard function — zero string parsing.';

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. v_start / v_end correctness:
-- SELECT
--   make_timestamptz(2026, 5, 1, 0, 0, 0, 'Asia/Seoul')                            AS v_start,
--   make_timestamptz(2026, 5, 1, 0, 0, 0, 'Asia/Seoul') + INTERVAL '1 month'       AS v_end;
-- Expect: v_start = 2026-04-30 15:00:00+00, v_end = 2026-05-31 15:00:00+00 (UTC).
--
-- B. ★ 핵심 — 2026-05 = ₩18,946,363:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": 18946363 }
--
-- C. Permission denied:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }
--
-- D. Empty month:
-- SELECT bookkeeping_get_usoln_track_b_margin('2025-01',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { ok: true, amount: 0 }
