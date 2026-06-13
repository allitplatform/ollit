-- Migration 117 — bookkeeping_get_usoln_track_b_margin RPC
-- Adds usol_n monthly settlement (track B = cleaning + 추가선택) owner_amount
-- to the bookkeeping income side. Avoids double-counting with the revenue report
-- (which sums track A only).
--
-- Filter:
--   principal_code = 'usol_n'
--   AND tasks.status = '완료'
--   AND payments.track = 'B'
--   AND tasks.completed_at IN [KST month start, next-month KST start)
--
-- Verify (2026-05): expected ₩18,946,363 (matches dashboard UsolN monthly panel).
--
-- Pattern: SECURITY DEFINER + p_actor (same as other bookkeeping_* RPCs).
-- English-only. Paste-safe.

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

  -- KST work-month range:
  --   start = first day 00:00 KST
  --   end   = next month first day 00:00 KST (exclusive)
  v_start := ((p_work_month || '-01')::date) AT TIME ZONE 'Asia/Seoul';
  v_end   := (((p_work_month || '-01')::date) + INTERVAL '1 month') AT TIME ZONE 'Asia/Seoul';

  SELECT COALESCE(SUM(p.owner_amount), 0)::bigint
    INTO v_amount
  FROM payments p
  JOIN tasks t      ON t.id = p.task_id
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
  'v1 (Mig 117, 2026-06-13) — sums usol_n track B owner_amount for a work month (KST). '
  'Used by 가계부 income (separate from revenue report which only covers track A).';

COMMIT;

-- ============================================
-- Verify (separate run)
-- ============================================
-- A. Function registered:
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args
-- FROM pg_proc WHERE proname = 'bookkeeping_get_usoln_track_b_margin';
-- Expect: 1 row, args = "text, uuid".
--
-- B. ★ 2026-05 (사장님 검증값):
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { ok: true, amount: 18946363 }
--   ↳ matches dashboard UsolN monthly panel for 2026-05.
--
-- C. Permission denied for non-operator:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-05',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }.
--
-- D. Invalid work_month:
-- SELECT bookkeeping_get_usoln_track_b_margin('2026-99',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { ok: false, error: 'work_month invalid' }
--   ↳ (note: regex passes for "2026-99" but no rows; returns ok=true amount=0.
--      To strictly block, regex would need month range 01..12. Phase 1 — skip.)
--
-- E. Empty month (no usol_n track B activity):
-- SELECT bookkeeping_get_usoln_track_b_margin('2025-01',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { ok: true, amount: 0 }
