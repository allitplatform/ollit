-- Migration 113 — update_principal_account v2 (add phone arg + admin role)
-- Adds:
--   1) p_phone text arg (4th account field).
--   2) owner/admin role bypass — operator (admin screen) can edit any principal.
--      partner role keeps existing principal_id ownership check.
-- DROP existing signature first to avoid overload conflict (42725).
-- English-only (paste-safe).

BEGIN;

-- [1] Drop old signature (5 args). Required before CREATE to avoid overload.
DROP FUNCTION IF EXISTS update_principal_account(uuid, text, text, text, uuid);

-- [2] Create v2 (6 args — phone added between holder and actor).
CREATE OR REPLACE FUNCTION update_principal_account(
  p_principal_id   uuid,
  p_bank_name      text,
  p_account_number text,
  p_account_holder text,
  p_phone          text,
  p_actor          uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_operator  boolean := false;
  v_is_owner     boolean := false;
  v_row          principals%ROWTYPE;
BEGIN
  -- [a] Actor required.
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;

  -- [b] Principal id required.
  IF p_principal_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'principal_id missing');
  END IF;

  -- [c] Non-empty required: bank / account / holder. phone is optional.
  IF COALESCE(TRIM(p_bank_name), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bank_name required');
  END IF;
  IF COALESCE(TRIM(p_account_number), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_number required');
  END IF;
  IF COALESCE(TRIM(p_account_holder), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_holder required');
  END IF;

  -- [d] Role check.
  --     Operator path: any user_roles row with role IN ('owner','admin','operator') passes.
  --     Partner path : user_roles row with role='partner' AND principal_id = p_principal_id.
  --     Either path grants access.
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner', 'admin', 'operator')
  ) INTO v_is_operator;

  IF NOT v_is_operator THEN
    SELECT EXISTS(
      SELECT 1 FROM user_roles
      WHERE user_id = p_actor
        AND role = 'partner'
        AND principal_id = p_principal_id
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
      RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
    END IF;
  END IF;

  -- [e] UPDATE. phone: TRIM + empty -> NULL (selective).
  UPDATE principals
  SET
    bank_name      = TRIM(p_bank_name),
    account_number = TRIM(p_account_number),
    account_holder = TRIM(p_account_holder),
    phone          = NULLIF(TRIM(COALESCE(p_phone, '')), '')
  WHERE id = p_principal_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'principal not found');
  END IF;

  RETURN jsonb_build_object(
    'ok',        true,
    'principal', jsonb_build_object(
      'id',             v_row.id,
      'code',           v_row.code,
      'name',           v_row.name,
      'bank_name',      v_row.bank_name,
      'account_number', v_row.account_number,
      'account_holder', v_row.account_holder,
      'phone',          v_row.phone
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_principal_account(uuid, text, text, text, text, uuid) TO anon, authenticated;

COMMENT ON FUNCTION update_principal_account(uuid, text, text, text, text, uuid) IS
  'v2 (Migration 113, 2026-06-13) — adds phone arg + owner/admin/operator role bypass. '
  'partner role keeps principal_id ownership check (v1 path). '
  'Updates principals.bank_name/account_number/account_holder/phone.';

COMMIT;

-- ============================================
-- Verify
-- ============================================
--
-- A. Function registered with new signature:
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args
-- FROM pg_proc WHERE proname = 'update_principal_account';
-- Expect: 1 row / args = "uuid, text, text, text, text, uuid"
-- (Should NOT see 5-arg old signature anymore.)
--
-- B. Missing actor:
-- SELECT update_principal_account(
--   (SELECT id FROM principals WHERE code='usol_n'),
--   'kakao', '3333-99-9999999', 'test', '010-0000-0000', NULL
-- );
-- Expect: { ok: false, error: 'login required' }
--
-- C. Operator (admin) path — should pass (test in transaction, rollback):
-- BEGIN;
--   SELECT update_principal_account(
--     (SELECT id FROM principals WHERE code='crikrin'),
--     'shinhan', '110-000-000000', 'crikrin_holder', '010-1234-5678',
--     (SELECT user_id FROM user_roles WHERE role='owner' LIMIT 1)
--   );
--   SELECT code, bank_name, account_number, account_holder, phone
--   FROM principals WHERE code='crikrin';
-- ROLLBACK;
-- Expect: ok=true, phone set. ROLLBACK reverts.
--
-- D. Partner path (existing flow preserved) — test in transaction:
-- BEGIN;
--   SELECT update_principal_account(
--     (SELECT id FROM principals WHERE code='usol_n'),
--     'kakao', '3333-99-9999999', 'test', '010-0000-0000',
--     '77777777-7777-7777-7777-cccccccc0003'::uuid  -- P003 = usol_h+usol_n partner
--   );
-- ROLLBACK;
-- Expect: ok=true.
--
-- E. Phone empty -> NULL:
-- BEGIN;
--   SELECT update_principal_account(
--     (SELECT id FROM principals WHERE code='allday'),
--     'woori', '1005-104865024', 'allday_holder', '   ',
--     (SELECT user_id FROM user_roles WHERE role='owner' LIMIT 1)
--   );
--   SELECT phone FROM principals WHERE code='allday';
-- ROLLBACK;
-- Expect: phone IS NULL (empty/whitespace -> NULL).
