-- ============================================
-- Migration 007 — Auth Setup (Custom RPC + pgcrypto)
-- 작성일  : 2026-05-12 (Day 5)
-- 범위    :
--   [1] users 박은 영역 박은 영역 추가 (email / password_hash / must_change_password / last_login_at)
--   [2] pgcrypto extension 박음
--   [3] 시드 박은 영역 박은 영역 박을 영역 (phone → email + bcrypt(phone 끝 4자리))
--   [4] Custom RPC: sign_in_with_phone(p_phone, p_password)
--   [5] Custom RPC: change_password(p_user_id, p_old_password, p_new_password)
-- 전제    : 001 + 003 + 004 + 002a 적용 박힘
-- 실행    : Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 안전장치:
--   - BEGIN/COMMIT — 부분 실패 시 ROLLBACK
--   - ADD COLUMN IF NOT EXISTS — 재실행 안전 (idempotent)
--   - WHERE password_hash IS NULL — 비밀번호 박은 영역 박힌 영역 박지 X (덮어쓰기 X)
-- ============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- [1] users 박은 영역 박은 영역 추가
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email                text,
  ADD COLUMN IF NOT EXISTS password_hash        text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at        timestamptz;

-- email 중복 박은 영역 박은 영역 (tenant 박은 영역 박을 영역 / NULL 박은 영역 박은 영역 박지 X)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email
  ON users (tenant_id, email)
  WHERE email IS NOT NULL;

-- ============================================
-- [2] 시드 박은 영역 박음 — 33명 모두 phone → email + password_hash
-- phone 박은 영역 박은 영역 박은 영역 (예: '010-9447-1547' → '01094471547')
-- email = <phone_clean>@allit.internal
-- password_hash = bcrypt(phone 끝 4자리)
-- must_change_password = true
-- ============================================
UPDATE users
SET
  email                = REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', '') || '@allit.internal',
  password_hash        = crypt(
    RIGHT(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', ''), 4),
    gen_salt('bf')
  ),
  must_change_password = true
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND password_hash IS NULL;

-- ============================================
-- [3] Custom RPC — phone + password 박은 영역 로그인
-- 정규화: '-' / 공백 / '+' 박은 영역 제거 후 매칭
-- ============================================
CREATE OR REPLACE FUNCTION sign_in_with_phone(p_phone text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  users;
  v_clean text;
  v_ok    boolean;
  v_roles text[];
BEGIN
  v_clean := REPLACE(REPLACE(REPLACE(COALESCE(p_phone,''), '-', ''), ' ', ''), '+', '');

  IF v_clean = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_required');
  END IF;
  IF COALESCE(p_password,'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'password_required');
  END IF;

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

  v_ok := (v_user.password_hash = crypt(p_password, v_user.password_hash));
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_password');
  END IF;

  SELECT array_agg(role) INTO v_roles
  FROM user_roles
  WHERE user_id = v_user.id;

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
    'must_change_password', v_user.must_change_password
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sign_in_with_phone(text, text) TO anon, authenticated;

-- ============================================
-- [4] Custom RPC — 비밀번호 변경 (must_change_password = false 박음)
-- ============================================
CREATE OR REPLACE FUNCTION change_password(p_user_id uuid, p_old_password text, p_new_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users;
  v_ok   boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_id_required');
  END IF;
  IF COALESCE(p_new_password,'') = '' OR length(p_new_password) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'password_too_short');
  END IF;

  SELECT * INTO v_user FROM users WHERE id = p_user_id LIMIT 1;
  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  v_ok := (v_user.password_hash = crypt(p_old_password, v_user.password_hash));
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_old_password');
  END IF;

  UPDATE users
  SET
    password_hash        = crypt(p_new_password, gen_salt('bf')),
    must_change_password = false
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION change_password(uuid, text, text) TO anon, authenticated;

COMMIT;

-- ============================================
-- 끝 — Auth 박힌 영역 박힘. 다음: 007_validation.sql / src/lib/auth.js
-- ============================================
