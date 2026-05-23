-- 058_sign_in_with_phone_normalize_restore.sql
-- 2026-05-23 — sign_in_with_phone 측 측 정규화 + tenant_id 측 측 + principals[] 측
--
-- 사장님 spec:
--   Migration 057 측 sign_in_with_phone 측 측 측 정규화 + tenant_id 측 측 측 X →
--   클라이언트 측 정규화 측 측 ("01098921980") + DB 측 하이픈 측 측 ("010-9892-1980") → 매칭 X.
--
-- 측 spec:
--   1. p_phone + users.phone 측 측 측 정규화 측 측 (Migration 007 패턴)
--   2. tenant_id 측 측 (Migration 007 패턴)
--   3. principals[] 측 측 (Migration 057 spec 측)
--
-- 회귀 방지:
--   · 측 user 측 변경 X
--   · 클라이언트 측 변경 X (LoginScreen / auth.js measurement normalizePhone 측 측 측)
--   · 사용자 측 측 측 측: "01098921980" / "010-9892-1980" 측 측 매칭

BEGIN;

DROP FUNCTION IF EXISTS sign_in_with_phone(text, text);

CREATE OR REPLACE FUNCTION sign_in_with_phone(p_phone text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user       users;
  v_clean      text;
  v_ok         boolean;
  v_roles      text[];
  v_principals jsonb;
BEGIN
  -- 정규화: 하이픈 / 공백 / + 제거 (Migration 007 패턴)
  v_clean := REPLACE(REPLACE(REPLACE(COALESCE(p_phone,''), '-', ''), ' ', ''), '+', '');

  IF v_clean = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_required');
  END IF;
  IF COALESCE(p_password,'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'password_required');
  END IF;

  -- users.phone 측도 같은 정규화로 매칭 + tenant_id 측 측
  SELECT * INTO v_user
  FROM users
  WHERE REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', '') = v_clean
    AND tenant_id = '11111111-1111-1111-1111-111111111111'
    AND is_active = true
  LIMIT 1;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;
  IF v_user.password_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'password_not_set');
  END IF;

  v_ok := (v_user.password_hash = extensions.crypt(p_password, v_user.password_hash));
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_password');
  END IF;

  -- roles[] — 측 측 측 (DISTINCT, 같은 role 측 측 principal 측 measurement 1개만)
  SELECT array_agg(DISTINCT role) INTO v_roles
  FROM user_roles
  WHERE user_id = v_user.id;

  -- principals[] 측 (Migration 057 spec) — partner 측 측 measurement / code/id/name
  SELECT jsonb_agg(jsonb_build_object('code', p.code, 'id', p.id, 'name', p.name) ORDER BY ur.is_primary DESC NULLS LAST, p.code)
    INTO v_principals
  FROM user_roles ur
  JOIN principals  p ON p.id = ur.principal_id
  WHERE ur.user_id = v_user.id
    AND ur.principal_id IS NOT NULL;

  UPDATE users SET last_login_at = now() WHERE id = v_user.id;

  RETURN jsonb_build_object(
    'ok',                   true,
    'user_id',              v_user.id,
    'tenant_id',            v_user.tenant_id,
    'code',                 v_user.code,
    'name',                 v_user.name,
    'phone',                v_user.phone,
    'email',                v_user.email,
    'roles',                COALESCE(v_roles, ARRAY[]::text[]),
    'principals',           COALESCE(v_principals, '[]'::jsonb),
    'must_change_password', v_user.must_change_password
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sign_in_with_phone(text, text) TO anon, authenticated;

COMMIT;

-- ============================================
-- 검증 SQL (사장님 측 측 측)
-- ============================================
-- 측 측 매칭 (정규화 측):
--   SELECT sign_in_with_phone('01098921980', '1980') AS no_hyphen;
--   SELECT sign_in_with_phone('010-9892-1980', '1980') AS with_hyphen;
--   -- 측 다 ok:true / principals[] 측 usol_h + usol_n 측
--
-- 잘못된 측:
--   SELECT sign_in_with_phone('01098921980', '0000') AS wrong_pw;
--   -- 기대: { ok:false, error:'invalid_password' }
--
--   SELECT sign_in_with_phone('01000000000', '1980') AS no_user;
--   -- 기대: { ok:false, error:'user_not_found' }
