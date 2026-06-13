-- Migration 118 — bookkeeping_get_usoln_track_b_margin v2 (timezone fix)
-- Root cause of Mig 117 v1 discrepancy:
--   `date AT TIME ZONE 'Asia/Seoul'` returned `timestamp WITHOUT time zone`
--   interpreted in session timezone (e.g. '2026-05-01 09:00:00' no-tz)
--   instead of the intended KST midnight as timestamptz (UTC 2026-04-30 15:00:00+00).
--   Result: v_start landed 9 hours late → tasks completed on 5/1 00:00~09:00 KST
--   were excluded → diff ₩677,369 missing vs panel.
--   v_end (date + interval = timestamp WITHOUT tz, then AT TIME ZONE → timestamptz) worked.
--
-- Fix:
--   Build v_start as timestamptz directly with explicit '+09' offset, then
--   v_end := v_start + INTERVAL '1 month'.
--   Both v_start and v_end are timestamptz, semantics symmetric.
--
-- Verify (2026-05): expected ₩18,946,363 (matches dashboard UsolN panel + raw query).
--
-- CREATE OR REPLACE — idempotent re-run. Same signature as Mig 117.

BEGIN;

CREATE OR REPLACE FUNCTION bookkeeping_get_usoln_track_b_margin(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  -- v2 fix: build timestamptz directly with explicit KST offset.
  --   v_start = work_month 1st day 00:00 KST  (e.g. '2026-05-01 00:00:00+09')
  --   v_end   = v_start + 1 month             (next month 1st day 00:00 KST)
  -- Both are timestamptz — no date->timestamp implicit cast asymmetry.
  v_start := (p_work_month || '-01 00:00:00+09')::timestamptz;
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
  'v2 (Mig 118, 2026-06-13) — TZ fix. v_start built as timestamptz with explicit +09 offset, '
  'v_end = v_start + 1 month. Both timestamptz — symmetric semantics. '
  'v1 (Mig 117) had date AT TIME ZONE asymmetry losing 5/1 00:00~09:00 KST tasks.';

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. Range correctness (no-tz session safe):
-- SELECT
--   ('2026-05-01 00:00:00+09')::timestamptz                              AS v_start,
--   ('2026-05-01 00:00:00+09')::timestamptz + INTERVAL '1 month'         AS v_end;
-- Expect: v_start = 2026-04-30 15:00:00+00, v_end = 2026-05-31 15:00:00+00 (UTC).
--
-- B. ★ 핵심 — 2026-05 expected ₩18,946,363:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": 18946363 }
--
-- C. Permission denied for non-operator:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }
--
-- D. Empty month:
-- SELECT bookkeeping_get_usoln_track_b_margin('2025-01',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { ok: true, amount: 0 }
