-- 061_principal_remit_rpcs_user_id.sql
-- 2026-05-23 — Migration 060 RPC 3개 재정의: p_user_id 인자 추가
-- 배경:
--   PWA는 자체 users 인증(anon key only) — supabase.auth 미사용 →
--   RPC 내부에서 auth.uid() = NULL → current_user_has_role/current_user_principal_ids
--   둘 다 빈 결과 → mark_principal_remitted 첫 권한 검사에서 "forbidden" RAISE.
-- 해결:
--   기존 anon-friendly 패턴(sign_in_with_phone)과 동일 — 클라이언트가
--   p_user_id를 명시적으로 넘기고, RPC 내부에서 user_roles로 직접 검증.
--   클라이언트가 user_id를 위변조해도 user_roles에 매칭 row가 없으면 차단.
-- 변경:
--   · mark_principal_remitted    (uuid, uuid, date, date, int, text)
--   · confirm_principal_remittance (uuid, uuid)
--   · undo_principal_remit         (uuid, uuid)

-- ============================================
-- 옛 시그니처 DROP (Mig 060)
-- ============================================
DROP FUNCTION IF EXISTS mark_principal_remitted(uuid, date, date, int, text);
DROP FUNCTION IF EXISTS confirm_principal_remittance(uuid);
DROP FUNCTION IF EXISTS undo_principal_remit(uuid);

-- ============================================
-- [1] mark_principal_remitted — 원청 "입금했습니다"
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

  -- 권한 검사 — p_user_id 기반 user_roles 직접 조회 (auth.uid() 대체)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = 'partner'
  ) INTO v_is_partner;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role IN ('owner', 'operator')
  ) INTO v_is_admin;

  IF NOT (v_is_partner OR v_is_admin) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- partner는 자기 principal_id만 (admin은 전체 허용)
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

  -- 입력 검증
  IF p_week_end < p_week_start THEN
    RETURN jsonb_build_object('ok', false, 'error', 'week_range_invalid');
  END IF;
  IF p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_negative');
  END IF;

  -- tenant_id (principal 측 측)
  SELECT tenant_id INTO v_tenant FROM principals WHERE id = p_principal_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'principal_not_found');
  END IF;

  -- UPSERT — confirmed_at NULL일 때만 갱신, 이미 확인된 row는 차단
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

GRANT EXECUTE ON FUNCTION mark_principal_remitted(uuid, uuid, date, date, int, text)
  TO anon, authenticated;

-- ============================================
-- [2] confirm_principal_remittance — 회사 "입금 확인"
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
    WHERE user_id = p_user_id AND role IN ('owner', 'operator')
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

GRANT EXECUTE ON FUNCTION confirm_principal_remittance(uuid, uuid)
  TO anon, authenticated;

-- ============================================
-- [3] undo_principal_remit — 원청 "보고 취소"
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
    WHERE user_id = p_user_id AND role IN ('owner', 'operator')
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

GRANT EXECUTE ON FUNCTION undo_principal_remit(uuid, uuid)
  TO anon, authenticated;

-- ============================================
-- 검증 SQL — 실행 후
-- ============================================
-- SELECT proname, pg_get_function_identity_arguments(oid)
-- FROM pg_proc
-- WHERE proname IN ('mark_principal_remitted','confirm_principal_remittance','undo_principal_remit')
-- ORDER BY proname;
--
-- 기대: 3 row, 각각 첫 인자 = p_user_id uuid
