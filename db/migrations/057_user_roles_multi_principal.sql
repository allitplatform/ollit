-- 057_user_roles_multi_principal.sql
-- 2026-05-23 — user_roles 다중 principal + sign_in_with_phone principals 측
--
-- 사장님 spec:
--   유솔홈케어 통합계정 (P003) 측 usol_h + usol_n 측 측 측 측 catch.
--   측 — user_roles 측 PK measurement (user_id, role) → 측 user 측 같은 role 측 측 행 측 X.
--   → PK 측 (user_id, role, principal_id) 측 측 측 측 (partial index 측 NULL 측 안전).
--
-- 측 변경:
--   [1] user_roles 측 PK 제거 + partial unique index 2개 측 측
--   [2] P003 측 (partner, usol_n) row 측 측 (이미 partner+usol_h 있음 → 측 다중)
--   [3] sign_in_with_phone RPC — 응답 측 principals[] 측 (code/id/name) 측
--
-- 회귀 방지:
--   · 측 user_roles row 측 측 변경 X (P003 측만 INSERT)
--   · partial unique index — principal_id NULL 측 측 측 같은 user 같은 role 측 측 측 (admin/engineer 등)
--   · partial unique index — principal_id NOT NULL 측 같은 user 같은 role 측 측 측 principal 측 측 (partner)
--   · sign_in_with_phone — 측 응답 측 측 측, principals[] 측 catch (옛 클라이언트 측 측 측 X)
--
-- 실행 spec: Supabase 콘솔 SQL Editor 측 통째 측 → Run. 측 검증 측 측.

BEGIN;

-- ============================================
-- [1] user_roles PK 측 측 — (user_id, role, principal_id) 측 unique
-- ============================================
-- 측 PK: (user_id, role) — 같은 user 측 같은 role 측 측 행 측 X
-- 새 측: partial unique index 2개
--   · principal_id IS NULL: (user_id, role) UNIQUE — admin/engineer/operator/owner
--   · principal_id IS NOT NULL: (user_id, role, principal_id) UNIQUE — partner (다중 principal 측)

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_uk_no_principal
  ON user_roles (user_id, role)
  WHERE principal_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_uk_with_principal
  ON user_roles (user_id, role, principal_id)
  WHERE principal_id IS NOT NULL;

-- ============================================
-- [2] P003 측 usol_n 측 측 (이미 partner+usol_h 있음)
-- ============================================
INSERT INTO user_roles (user_id, role, principal_id, is_primary)
SELECT
  '77777777-7777-7777-7777-cccccccc0003'::uuid,
  'partner',
  '22222222-2222-2222-2222-222222222006'::uuid,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = '77777777-7777-7777-7777-cccccccc0003'::uuid
    AND role = 'partner'
    AND principal_id = '22222222-2222-2222-2222-222222222006'::uuid
);

-- ============================================
-- [3] sign_in_with_phone — 응답 측 principals[] 측
-- ============================================
-- 측 측 반환 측 측 변경 (principals 측) → CREATE OR REPLACE 측 측 X (PG 42P13 에러)
-- → DROP FUNCTION 측 측 측 측 CREATE.
-- 측 측 측 측: (text, text) — Migration 007 측 측 측.
-- 측 측: validation 측 SELECT 호출 측 X (다른 함수/trigger/view 측 측 X).
DROP FUNCTION IF EXISTS sign_in_with_phone(text, text);

CREATE OR REPLACE FUNCTION sign_in_with_phone(p_phone text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user       users;
  v_ok         boolean;
  v_roles      text[];
  v_principals jsonb;
BEGIN
  IF COALESCE(p_phone,'') = '' OR COALESCE(p_password,'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone_or_password_required');
  END IF;

  SELECT * INTO v_user FROM users WHERE phone = p_phone AND is_active = true LIMIT 1;

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

  -- principals[] 측 (partner 측 측 measurement) — code/id/name
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
-- 검증 SQL (사장님 측 측 측 실행)
-- ============================================
-- 측 측 index 측:
--   SELECT indexname, indexdef FROM pg_indexes WHERE tablename='user_roles';
--
-- P003 측:
--   SELECT ur.user_id, ur.role, p.code AS principal
--   FROM user_roles ur LEFT JOIN principals p ON p.id = ur.principal_id
--   WHERE ur.user_id = '77777777-7777-7777-7777-cccccccc0003';
--   -- 기대: 2행 (usol_h, usol_n)
--
-- RPC 측 측:
--   SELECT sign_in_with_phone('01098921980', '<password>');
--   -- 기대: principals[] 측 [{code:'usol_h',...}, {code:'usol_n',...}] 측
