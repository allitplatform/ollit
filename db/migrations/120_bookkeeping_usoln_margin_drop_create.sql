-- Migration 120 — bookkeeping_get_usoln_track_b_margin v4 (DROP + CREATE)
-- Root cause: plpgsql function plan cache held the v2 (Mig 118) body even after
-- v3 (Mig 119) deployed via CREATE OR REPLACE. Diagnostics confirmed:
--   - pg_get_functiondef showed v3 body (make_timestamptz).
--   - Raw SQL with make_timestamptz range returned 18,946,363.
--   - RPC call returned 18,161,812 (matching v2 body output).
--   → plan cache mismatch. Forced invalidation needed.
--
-- Fix:
--   1) DROP FUNCTION (explicit, with signature).
--   2) CREATE fresh (identical v3 body).
--   Together they guarantee plan cache reset.
--
-- Verify (2026-05): expected ₩18,946,363.

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
  'v4 (Mig 120, 2026-06-13) — DROP+CREATE to force plan-cache reset. '
  'Body identical to v3 (Mig 119, make_timestamptz). '
  'v1 (Mig 117) date AT TIME ZONE asymmetry. v2 (Mig 118) ''+09'' string ambiguity. '
  'v3 (Mig 119) correct body but plan cache held v2. v4 forces full cache invalidation.';

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. Signature confirmed unique:
-- SELECT proname, pg_get_function_identity_arguments(oid)
-- FROM pg_proc WHERE proname = 'bookkeeping_get_usoln_track_b_margin';
-- Expect: 1 row, args = "text, uuid".
--
-- B. ★ 핵심 — 2026-05 = ₩18,946,363:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": 18946363 }
--
-- C. Other months (should match raw SQL):
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-06',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { "ok": true, "amount": 10299350 }
--
-- D. Permission denied:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }
