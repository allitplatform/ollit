-- ============================================================================
-- Migration 164 - principal payout cashflow mirror (RPC extensions)
-- Date    : 2026-07-07
-- Purpose : Mirror of Mig 156 (engineer -> company cashflow IN) for the
--           opposite direction: company -> principal cashflow OUT, driven by
--           the existing daily payout screen (AdminPcPrincipalPayout).
--
-- Two RPCs are extended (DROP + CREATE, not incremental patch):
--   mark_principal_daily_remit  - UPSERT principal_daily_remittances +
--                                  UPSERT bookkeeping_cashflow row (source =
--                                  'auto_principal_payout', direction 'out').
--                                  p_amount = 0 -> DELETE the mirrored cashflow row.
--   undo_principal_daily_remit  - Capture pdr.id, DELETE cashflow first,
--                                  then DELETE the principal_daily_remittances row.
--
-- CRITICAL WARNING - source verification required BEFORE apply:
--   The current live implementations of mark_principal_daily_remit and
--   undo_principal_daily_remit are NOT in this repository. Comments in
--   src/lib/partnerDailySettleDb.js reference "Mig 100" but that filename
--   holds a different migration; the RPCs were applied by the owner directly
--   in the Supabase SQL Editor at some earlier point.
--
--   This migration reconstructs the RPCs based on:
--     - Wrapper signatures observed in src/lib/partnerDailySettleDb.js:
--         mark : (p_principal_id uuid, p_settle_date date, p_amount int, p_actor uuid) -> jsonb
--         undo : (p_principal_id uuid, p_settle_date date, p_actor uuid)               -> jsonb
--     - Error codes referenced in describeDailyRemitError():
--         role_not_allowed / principal_not_found / amount_invalid /
--         settle_date_required / rpc_error
--     - Mig 115 (bookkeeping) pattern (SECURITY DEFINER + p_actor + role check + jsonb)
--     - Mig 156 (engineer remit cashflow) idempotency pattern
--   If the LIVE RPCs have additional response fields, extra guards, or
--   different arg types, this replacement will drift. VERIFY BEFORE APPLY:
--
--     SELECT proname, pg_get_function_identity_arguments(oid) AS args,
--            obj_description(oid, 'pg_proc') AS note,
--            pg_get_functiondef(oid) AS body
--     FROM pg_proc
--     WHERE proname IN ('mark_principal_daily_remit','undo_principal_daily_remit');
--
--   If the actual signature or body differs, adjust this file before running.
--
-- Table assumptions (verify before apply):
--   principal_daily_remittances (
--     id uuid PK,
--     principal_id uuid,
--     settle_date  date,
--     remitted_amount int,
--     remitted_at timestamptz,
--     remitted_by uuid,
--     UNIQUE (principal_id, settle_date)  -- required for ON CONFLICT
--   )
--   tenant_id column existence unknown -> NOT included in INSERT below.
--   If the table has tenant_id NOT NULL, add it to the INSERT (v_tenant := c_tenant).
--
--   bookkeeping_cashflow schema (confirmed via Mig 122 + 156):
--     tenant_id / direction / amount(bigint) / flow_date(date) / memo /
--     created_by / created_at / updated_at / source / source_ref
--     partial UNIQUE INDEX uniq_bk_cf_source_ref ON (source, source_ref) WHERE source IS NOT NULL
--
-- Regression + safety:
--   - Push trigger notify_partner_daily_settle_trg (Mig 107) still fires on
--     INSERT of principal_daily_remittances -> unchanged.
--   - fetchPartnerDailySettle wrapper unchanged (columns queried are the same).
--   - Cashflow row is uniquely keyed on (source, source_ref) so re-mark of the
--     same (principal_id, settle_date) after amount change updates in place.
--   - Undo removes cashflow FIRST, then pdr - if the flow errors halfway, the
--     transaction rolls back (no orphan cashflow row).
-- ============================================================================

BEGIN;

-- ============================================================================
-- [1] mark_principal_daily_remit
--   Upsert principal_daily_remittances + mirror to bookkeeping_cashflow (OUT).
-- ============================================================================
DROP FUNCTION IF EXISTS mark_principal_daily_remit(uuid, date, int, uuid);

CREATE FUNCTION mark_principal_daily_remit(
  p_principal_id uuid,
  p_settle_date  date,
  p_amount       int,
  p_actor        uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tenant         CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  c_source         CONSTANT text := 'auto_principal_payout';
  v_principal_name text;
  v_pdr_id         uuid;
BEGIN
  -- Argument validation (aligned with describeDailyRemitError codes).
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_not_allowed');
  END IF;
  IF p_principal_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'principal_not_found');
  END IF;
  IF p_settle_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'settle_date_required');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_invalid');
  END IF;

  -- Role gate (owner/admin/operator only).
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_not_allowed');
  END IF;

  -- Principal existence + name (used in memo).
  SELECT name INTO v_principal_name
  FROM principals
  WHERE id = p_principal_id;
  IF v_principal_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'principal_not_found');
  END IF;

  -- Upsert principal_daily_remittances. Existing invariant assumed:
  --   UNIQUE(principal_id, settle_date). Amount can be updated in place
  --   (re-mark on same day/principal with corrected amount).
  INSERT INTO principal_daily_remittances (
    principal_id, settle_date, remitted_amount, remitted_at, remitted_by
  ) VALUES (
    p_principal_id, p_settle_date, p_amount, now(), p_actor
  )
  ON CONFLICT (principal_id, settle_date) DO UPDATE SET
    remitted_amount = EXCLUDED.remitted_amount,
    remitted_at     = EXCLUDED.remitted_at,
    remitted_by     = EXCLUDED.remitted_by
  RETURNING id INTO v_pdr_id;

  -- Cashflow mirror.
  --   p_amount > 0  -> UPSERT OUT row keyed by (source, source_ref=pdr.id).
  --   p_amount = 0  -> DELETE the mirrored OUT row (correction to 0).
  IF p_amount > 0 THEN
    INSERT INTO bookkeeping_cashflow (
      tenant_id, direction, amount, flow_date, memo,
      created_by, source, source_ref
    ) VALUES (
      c_tenant, 'out', p_amount::bigint, p_settle_date,
      '원청 지급 · ' || v_principal_name || ' · ' || p_settle_date::text,
      p_actor, c_source, v_pdr_id
    )
    ON CONFLICT (source, source_ref) WHERE source IS NOT NULL DO UPDATE SET
      amount     = EXCLUDED.amount,
      flow_date  = EXCLUDED.flow_date,
      memo       = EXCLUDED.memo,
      updated_at = now();
  ELSE
    DELETE FROM bookkeeping_cashflow
    WHERE source = c_source
      AND source_ref = v_pdr_id;
  END IF;

  -- Response shape preserved as { ok: true }. Wrapper + UI only read `ok`
  -- (partnerDailySettleDb.js:148-163 + AdminPcPrincipalPayout.jsx:487-490).
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_principal_daily_remit(uuid, date, int, uuid) TO anon, authenticated;

COMMENT ON FUNCTION mark_principal_daily_remit(uuid, date, int, uuid) IS
  'v2 (Migration 164, 2026-07-07) - UPSERT principal_daily_remittances + mirror '
  'bookkeeping_cashflow OUT (source=auto_principal_payout, source_ref=pdr.id). '
  'p_amount = 0 deletes the mirrored OUT row (correction path). '
  'Response shape {ok:true} preserved from original RPC. '
  'Signature reconstructed from partnerDailySettleDb.js wrapper - verify before apply.';


-- ============================================================================
-- [2] undo_principal_daily_remit
--   Capture pdr.id, DELETE cashflow first, then DELETE principal_daily_remittances.
-- ============================================================================
DROP FUNCTION IF EXISTS undo_principal_daily_remit(uuid, date, uuid);

CREATE FUNCTION undo_principal_daily_remit(
  p_principal_id uuid,
  p_settle_date  date,
  p_actor        uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_source CONSTANT text := 'auto_principal_payout';
  v_pdr_id  uuid;
  v_deleted int;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_not_allowed');
  END IF;
  IF p_principal_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'principal_not_found');
  END IF;
  IF p_settle_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'settle_date_required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_not_allowed');
  END IF;

  -- Capture the pdr row id (may be NULL if no matching row).
  SELECT id INTO v_pdr_id
  FROM principal_daily_remittances
  WHERE principal_id = p_principal_id
    AND settle_date  = p_settle_date;

  -- Cashflow OUT row cleanup - only when we have a source_ref to match on.
  -- Guards against DELETE ... WHERE source_ref = NULL (never matches but is
  -- a wasted statement; guard is explicit for readability).
  IF v_pdr_id IS NOT NULL THEN
    DELETE FROM bookkeeping_cashflow
    WHERE source     = c_source
      AND source_ref = v_pdr_id;
  END IF;

  -- Delete the pdr row. Runs unconditionally per original response contract.
  -- If v_pdr_id IS NULL, WHERE id = NULL matches 0 rows -> v_deleted = 0
  -- (idempotent no-op path preserved).
  DELETE FROM principal_daily_remittances
  WHERE id = v_pdr_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Response shape preserved as { ok: true, deleted: <int> } per original RPC.
  -- Wrapper + UI only read `ok` (partnerDailySettleDb.js:165-179 +
  -- AdminPcPrincipalPayout.jsx:517-521); `deleted` is harmless pass-through.
  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION undo_principal_daily_remit(uuid, date, uuid) TO anon, authenticated;

COMMENT ON FUNCTION undo_principal_daily_remit(uuid, date, uuid) IS
  'v2 (Migration 164, 2026-07-07) - Capture pdr.id, conditionally DELETE the '
  'mirrored bookkeeping_cashflow OUT row (source=auto_principal_payout, '
  'source_ref=pdr.id), then DELETE the principal_daily_remittances row. '
  'Response shape {ok:true, deleted:<int>} preserved from original RPC. '
  'Idempotent - no-op when v_pdr_id NULL yields deleted=0.';

COMMIT;


-- ============================================================================
-- Verify (run separately AFTER apply)
-- ============================================================================
--
-- A. Function comments show v2:
-- SELECT proname, obj_description(oid, 'pg_proc') AS note
-- FROM pg_proc
-- WHERE proname IN ('mark_principal_daily_remit','undo_principal_daily_remit')
-- ORDER BY proname;
--
-- B. Signature preserved (wrapper compatibility):
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args
-- FROM pg_proc
-- WHERE proname IN ('mark_principal_daily_remit','undo_principal_daily_remit')
-- ORDER BY proname;
-- Expect:
--   mark_principal_daily_remit(uuid, date, integer, uuid)
--   undo_principal_daily_remit(uuid, date, uuid)
--
-- C. End-to-end dryrun (BEGIN + ROLLBACK safe):
-- BEGIN;
--   -- (a) mark with amount 28000
--   SELECT mark_principal_daily_remit(
--     (SELECT id FROM principals WHERE code='KA'),
--     '2026-07-07'::date,
--     28000,
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   ) AS result;
--   -- Expect: { ok:true } (original response shape preserved).
--
--   SELECT * FROM principal_daily_remittances
--     WHERE principal_id = (SELECT id FROM principals WHERE code='KA')
--       AND settle_date = '2026-07-07'::date;
--   -- Expect: 1 row, remitted_amount=28000.
--
--   SELECT id, direction, amount, flow_date, memo, source, source_ref
--   FROM bookkeeping_cashflow
--   WHERE source='auto_principal_payout';
--   -- Expect: 1 row, direction='out', amount=28000, memo starts with '원청 지급 · '.
--
--   -- (b) Re-mark with amount 30000 (correction path).
--   SELECT mark_principal_daily_remit(
--     (SELECT id FROM principals WHERE code='KA'),
--     '2026-07-07'::date,
--     30000,
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
--   SELECT amount FROM bookkeeping_cashflow WHERE source='auto_principal_payout';
--   -- Expect: 30000 (updated in place, no new row).
--
--   -- (c) Re-mark with amount 0 -> cashflow OUT should disappear.
--   SELECT mark_principal_daily_remit(
--     (SELECT id FROM principals WHERE code='KA'),
--     '2026-07-07'::date,
--     0,
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
--   SELECT COUNT(*) FROM bookkeeping_cashflow WHERE source='auto_principal_payout';
--   -- Expect: 0.
--   SELECT remitted_amount FROM principal_daily_remittances
--     WHERE principal_id=(SELECT id FROM principals WHERE code='KA')
--       AND settle_date='2026-07-07'::date;
--   -- Expect: 0 (pdr row preserved, only cashflow cleared).
--
--   -- (d) Undo - expect { ok:true, deleted:1 } (row existed and was removed).
--   SELECT undo_principal_daily_remit(
--     (SELECT id FROM principals WHERE code='KA'),
--     '2026-07-07'::date,
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
--   SELECT COUNT(*) FROM principal_daily_remittances
--     WHERE principal_id=(SELECT id FROM principals WHERE code='KA')
--       AND settle_date='2026-07-07'::date;
--   -- Expect: 0.
--
--   -- (e) Undo again (idempotent - no row to delete).
--   SELECT undo_principal_daily_remit(
--     (SELECT id FROM principals WHERE code='KA'),
--     '2026-07-07'::date,
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
--   -- Expect: { ok:true, deleted:0 } (v_pdr_id NULL -> DELETE 0 rows).
-- ROLLBACK;
--
-- D. Permission denied (non-operator actor).
-- SELECT mark_principal_daily_remit(
--   (SELECT id FROM principals WHERE code='KA'),
--   CURRENT_DATE,
--   1000,
--   '00000000-0000-0000-0000-000000000000'::uuid
-- );
-- Expect: { ok:false, error:'role_not_allowed' }.
--
-- E. Sanity - Mig 107 push trigger still fires on mark:
-- (Watch net._http_response for tag='settle-daily-*' after (a).)
--
-- ============================================================================
-- Rollback (emergency)
-- ============================================================================
-- Impossible to restore the exact pre-Mig-164 body because the original RPC
-- source is not in this repository. If rollback is required:
--   1. Delete all rows: DELETE FROM bookkeeping_cashflow WHERE source='auto_principal_payout';
--   2. Recreate the RPCs to their pre-Mig-164 shape from a Supabase backup
--      OR from pg_get_functiondef output captured before this migration was run.
--   For safety, capture pg_get_functiondef of both RPCs and store it before applying.
