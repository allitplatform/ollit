-- ============================================================================
-- Migration 212 - 묶음 1 (1/3): 협력사(subcontractors) 뼈대
-- 작성 2026-10-06 · 선행: 211a
--
-- 용어
--   원청(principals)        = 올데이케어에 일을 주는 회사  (기존, 변경 없음)
--   협력사(subcontractors)  = 올데이케어가 일을 주는 회사  (신규)
--   코드의 'partner' 는 이미 원청 담당자를 뜻하므로 협력사에는 쓰지 않습니다.
--
-- 내용
--   [1] subcontractors            협력사 표 (사업자 정보·입금 계좌 포함)
--   [2] users.subcontractor_id    기사 소속 (NULL = 올데이케어 직영)
--       users.sub_role            'manager' = 협력사 관리자 / 'staff' = 직원
--   [3] tasks.subcontractor_id    작업 수행처 (NULL = 직영)
--   [4] sign_in_with_phone        211a 본문 + 응답에 subcontractor / roles 에 'sub_manager'
--   [5] 화이트코어 1행 등록
--
-- 협력사 관리자를 user_roles 가 아니라 users.sub_role 로 두는 이유
--   admin_set_user_roles (mig 103) 는 저장할 때 "principal_id 가 NULL 인 role 행을
--   전부 지우고 다시 넣습니다". user_roles 에 sub_manager 행을 두면 운영자가 그
--   사용자의 권한을 편집하는 순간 지워집니다. users 쪽에 두면 기존 권한 함수와
--   user_roles 제약을 하나도 건드리지 않습니다. 앱에는 로그인 응답 roles 에
--   'sub_manager' 가 들어가므로 화면 분기는 role 이름 그대로 씁니다.
--
-- 기존 데이터 영향
--   새 칸은 전부 NULL 로 시작합니다. 기존 행 UPDATE 없음.
--   로그인 응답: 기존 칸 그대로 + subcontractor 칸 1개 (소속 없으면 null).
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 협력사 표
-- ============================================================
CREATE TABLE IF NOT EXISTS subcontractors (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  code                 text NOT NULL,
  name                 text NOT NULL,
  phone                text,
  -- 발급 사업자 정보 (D8 - 소속 협력사 사업자로 영수증 발급할 때 사용)
  business_name        text,
  representative_name  text,
  business_no          text,
  business_address     text,
  tax_type             text,
  memo                 text,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

COMMENT ON TABLE subcontractors IS
  '협력사 = 올데이케어가 일을 주는 회사. 원청(principals)과 별개. 접근은 SECURITY DEFINER 함수로만.';

-- 표 직접 접근 차단 (사업자 정보 포함) - 조회·수정은 214 의 함수로만.
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractors FROM anon, authenticated;

-- ============================================================
-- [2] 기사 소속
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subcontractor_id uuid REFERENCES subcontractors(id),
  ADD COLUMN IF NOT EXISTS sub_role         text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_sub_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_sub_role_check
      CHECK (
        (subcontractor_id IS NULL AND sub_role IS NULL)
        OR (subcontractor_id IS NOT NULL AND sub_role IN ('manager', 'staff'))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_by_subcontractor
  ON users (subcontractor_id) WHERE subcontractor_id IS NOT NULL;

COMMENT ON COLUMN users.subcontractor_id IS '소속 협력사. NULL = 올데이케어 직영.';
COMMENT ON COLUMN users.sub_role IS '협력사 안에서의 구분: manager(관리자) / staff(직원). 소속이 없으면 NULL.';

-- ============================================================
-- [3] 작업 수행처
-- ============================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS subcontractor_id uuid REFERENCES subcontractors(id);

CREATE INDEX IF NOT EXISTS tasks_by_subcontractor
  ON tasks (subcontractor_id, status) WHERE subcontractor_id IS NOT NULL;

COMMENT ON COLUMN tasks.subcontractor_id IS
  '이 작업을 맡은 협력사. NULL = 직영. 배정 기사가 바뀌면 213 트리거가 기사 소속에 맞춥니다.';

-- ============================================================
-- [4] sign_in_with_phone - 211a 본문 그대로 + 협력사 정보
-- ============================================================
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
  v_token      text;
  v_sub        jsonb;
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

  v_ok := (v_user.password_hash = extensions.crypt(p_password, v_user.password_hash));
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_password');
  END IF;

  SELECT array_agg(DISTINCT role) INTO v_roles
  FROM user_roles
  WHERE user_id = v_user.id;

  SELECT jsonb_agg(jsonb_build_object('code', p.code, 'id', p.id, 'name', p.name) ORDER BY ur.is_primary DESC NULLS LAST, p.code)
    INTO v_principals
  FROM user_roles ur
  JOIN principals  p ON p.id = ur.principal_id
  WHERE ur.user_id = v_user.id
    AND ur.principal_id IS NOT NULL;

  -- Mig 212 - 협력사 소속 (비활성 협력사는 소속 없음으로 취급)
  SELECT jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, 'role', v_user.sub_role)
    INTO v_sub
  FROM subcontractors s
  WHERE s.id = v_user.subcontractor_id
    AND s.active = true;

  IF v_sub IS NOT NULL AND v_user.sub_role = 'manager' THEN
    v_roles := array_append(COALESCE(v_roles, ARRAY[]::text[]), 'sub_manager');
  END IF;

  UPDATE users SET last_login_at = now() WHERE id = v_user.id;

  v_token := _issue_session(v_user.id);

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
    'must_change_password', v_user.must_change_password,
    'session_token',        v_token,
    'subcontractor',        v_sub
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sign_in_with_phone(text, text) TO anon, authenticated;

-- ============================================================
-- [5] 첫 협력사 - 화이트코어 (id 는 고정하지 않고 code 로 참조)
-- ============================================================
INSERT INTO subcontractors (tenant_id, code, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'whitecore', '화이트코어')
ON CONFLICT (tenant_id, code) DO NOTHING;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 협력사 1행 - 기대: whitecore / 화이트코어 / true
SELECT code, name, active FROM subcontractors;

-- 2) 기존 데이터 무변경 - 기대: 둘 다 0
SELECT
  (SELECT COUNT(*) FROM users WHERE subcontractor_id IS NOT NULL) AS 소속있는_사용자,
  (SELECT COUNT(*) FROM tasks WHERE subcontractor_id IS NOT NULL) AS 협력사_작업;

-- 3) 기존 계정 로그인 응답 (본인 계정, 비밀번호 직접 입력)
--    SELECT sign_in_with_phone('01000000000', '비밀번호') -> 'subcontractor';   -- 기대: null
