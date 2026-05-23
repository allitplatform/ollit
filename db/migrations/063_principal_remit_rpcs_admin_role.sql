-- 063_principal_remit_rpcs_admin_role.sql
-- 2026-05-23 — Migration 061 RPC 3개 권한 검사에 'admin' role 추가
-- 배경:
--   Mig 061 측 catch role IN ('owner','operator')만 검사 → 'admin' role 측 catch X.
--   실 DB user_roles 측 distinct: engineer / admin / partner / operator
--   ('owner' 측 0건 — 사실상 미사용)
--   회사 계정(A003 조동석, A004 최수연 측) role = 'admin' →
--   confirm_principal_remittance 호출 시 forbidden RAISE.
-- 해결:
--   role IN ('owner','operator') → role IN ('owner','operator','admin')
--   3 RPC 모두 동일 변경. 시그니처는 Mig 061과 동일.

-- ============================================
-- [1] mark_principal_remitted
-- ============================================
CREATE OR REPLACE FUNCTION mark_principal_remitted(
  p_user_id      uuid,
  p_principal_id uuid,
  p_week_start   date,
  p_week_end     date,
  p_amount       int,
  p_note         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant     uuid;
  v_id         uuid;
  v_is_partner boolean;
  v_is_admin   boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = 'partner'
  ) INTO v_is_partner;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role IN ('owner', 'operator', 'admin')
  ) INTO v_is_admin;

  IF NOT (v_is_partner OR v_is_admin) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_is_partner AND NOT v_is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = p_user_id
        AND role = 'partner'
        AND principal_id = p_principal_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'principal_not_authorized');
    END IF;
  END IF;

  IF p_week_end < p_week_start THEN
    RETURN jsonb_build_object('ok', false, 'error', 'week_range_invalid');
  END IF;
  IF p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_negative');
  END IF;

  SELECT tenant_id INTO v_tenant FROM principals WHERE id = p_principal_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'principal_not_found');
  END IF;

  INSERT INTO principal_weekly_remittances
    (tenant_id, principal_id, week_start, week_end,
     remitted_amount, remitted_at, remitted_by, note)
  VALUES
    (v_tenant, p_principal_id, p_week_start, p_week_end,
     p_amount, now(), p_user_id, p_note)
  ON CONFLICT (principal_id, week_start) DO UPDATE
    SET week_end        = EXCLUDED.week_end,
        remitted_amount = EXCLUDED.remitted_amount,
        remitted_at     = EXCLUDED.remitted_at,
        remitted_by     = EXCLUDED.remitted_by,
        note            = EXCLUDED.note,
        updated_at      = now()
    WHERE principal_weekly_remittances.confirmed_at IS NULL
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_confirmed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ============================================
-- [2] confirm_principal_remittance
-- ============================================
CREATE OR REPLACE FUNCTION confirm_principal_remittance(
  p_user_id uuid,
  p_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row      principal_weekly_remittances;
  v_is_admin boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role IN ('owner', 'operator', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_row FROM principal_weekly_remittances WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_row.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_confirmed');
  END IF;

  UPDATE principal_weekly_remittances
     SET confirmed_at = now(),
         confirmed_by = p_user_id,
         updated_at   = now()
   WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;

-- ============================================
-- [3] undo_principal_remit
-- ============================================
CREATE OR REPLACE FUNCTION undo_principal_remit(
  p_user_id uuid,
  p_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row        principal_weekly_remittances;
  v_is_partner boolean;
  v_is_admin   boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  SELECT * INTO v_row FROM principal_weekly_remittances WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_row.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_confirmed');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role IN ('owner', 'operator', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = p_user_id
        AND role = 'partner'
        AND principal_id = v_row.principal_id
    ) INTO v_is_partner;
    IF NOT v_is_partner THEN
      RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
  END IF;

  DELETE FROM principal_weekly_remittances WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================
-- 검증 SQL
-- ============================================
-- 시그니처 변동 없음 (Mig 061과 동일) — GRANT 측 측 X.
--
-- 권한 검사 측 확인:
-- SELECT confirm_principal_remittance(
--   (SELECT id FROM users WHERE code='A004'),
--   '00000000-0000-0000-0000-000000000000'::uuid
-- );
-- → error: 'not_found' 기대 (admin 권한은 통과 → row id 측 측 X 측 측 catch)
