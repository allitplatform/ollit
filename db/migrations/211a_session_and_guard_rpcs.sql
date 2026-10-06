-- ============================================================================
-- Migration 211a - 묶음 0 (1/2): 세션 확인 공용 함수 + 직접 쓰기 대체 RPC
-- 작성 2026-10-06
--
-- 목적
--   외부(협력사) 계정 발급 전에 payments / engineer_rates 의 전체 수정 허용
--   정책(mig 026, mig 012)을 닫기 위한 준비 단계.
--   이 파일은 "추가"만 합니다. 정책은 건드리지 않습니다 -> 실행해도 기존 앱은
--   지금과 똑같이 동작합니다. 정책 닫기는 211b 에서 합니다.
--
-- 내용
--   [1] user_sessions            로그인 세션 표 (값은 해시로만 저장)
--   [2] _issue_session           세션 발급 (내부용)
--   [3] _session_required        강제 여부 스위치 (tenants.settings.session_required)
--   [4] _session_check           공용 확인 함수 (유예 모드 지원)  <- 재사용 대상
--       _session_check_strict    공용 확인 함수 (항상 필수)       <- 협력사 RPC 용
--   [5] sign_in_with_phone       mig 058 본문 그대로 + 응답에 session_token 추가
--   [6] sign_out_session         로그아웃 시 세션 폐기
--   [7] engineer_report_remit / engineer_report_usol_remit
--                                기사 입금 보고 (payments 직접 UPDATE 대체)
--   [8] admin_upsert_engineer_rate / admin_delete_engineer_rate
--                                기사 단가표 저장·삭제 (engineer_rates 직접 쓰기 대체)
--   [9] user_app_versions + report_app_version
--                                기기별 앱 버전 기록 (211b 실행 조건 확인용)
--
-- 기존 데이터 영향
--   없음. 새 표 1개, 새 함수, sign_in_with_phone 응답에 칸 1개 추가.
--   sign_in_with_phone 의 기존 응답 칸과 판정 로직은 mig 058 과 동일합니다.
--
-- 유예 모드
--   _session_check 는 세션 값이 "없으면 통과, 있으면 반드시 유효" 로 동작합니다.
--   (지금 로그인돼 있는 기사·운영자는 세션 값이 없으므로 재로그인 전까지 통과)
--   전원 재로그인 후 아래 한 줄로 강제 모드 전환:
--     UPDATE tenants SET settings = settings || '{"session_required": true}'::jsonb
--      WHERE id = '11111111-1111-1111-1111-111111111111';
--
-- 실행 순서
--   211a -> 211c -> 코드 push -> PWA 확인 -> (기사 전원 새 버전 확인 후) 211b
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 세션 표
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '180 days'),
  revoked_at  timestamptz
);
CREATE INDEX IF NOT EXISTS user_sessions_by_user ON user_sessions (user_id);

COMMENT ON TABLE user_sessions IS
  '자체 로그인 세션. 세션 값 원문은 저장하지 않고 sha256 해시만 저장. 접근은 SECURITY DEFINER 함수로만.';

-- 표 직접 접근 차단: RLS 켜고 정책을 만들지 않음 + 권한 회수.
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_sessions FROM anon, authenticated;

-- ============================================================
-- [2] 세션 발급 (내부용 - 로그인 함수만 호출)
-- ============================================================
CREATE OR REPLACE FUNCTION _issue_session(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO user_sessions (user_id, token_hash)
  VALUES (p_user_id, encode(extensions.digest(v_token, 'sha256'), 'hex'));
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION _issue_session(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- [3] 강제 여부 스위치
-- ============================================================
CREATE OR REPLACE FUNCTION _session_required()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (settings ->> 'session_required')::boolean
       FROM tenants
      WHERE id = '11111111-1111-1111-1111-111111111111'),
    false
  );
$$;

-- ============================================================
-- [4] 공용 확인 함수
--   p_actor 와 세션 값이 같은 사용자의 것인지 확인.
--   · 세션 값 있음  -> 유효(해시 일치 + 같은 사용자 + 폐기 안 됨 + 기한 내)해야 true
--   · 세션 값 없음  -> 강제 모드가 아니면 true (유예), 강제 모드면 false
-- ============================================================
CREATE OR REPLACE FUNCTION _session_check(p_actor uuid, p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  IF p_actor IS NULL THEN
    RETURN false;
  END IF;

  IF p_token IS NULL OR p_token = '' THEN
    RETURN NOT _session_required();
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM user_sessions s
     WHERE s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
       AND s.user_id    = p_actor
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
  );
END;
$$;

-- 항상 필수 (유예 없음) - 새로 만드는 협력사 RPC 가 사용.
CREATE OR REPLACE FUNCTION _session_check_strict(p_actor uuid, p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  IF p_actor IS NULL OR p_token IS NULL OR p_token = '' THEN
    RETURN false;
  END IF;
  RETURN _session_check(p_actor, p_token);
END;
$$;

COMMENT ON FUNCTION _session_check(uuid, text) IS
  '공용 세션 확인 (유예 모드 지원). 기존 RPC 에 순차 적용할 때 사용.';
COMMENT ON FUNCTION _session_check_strict(uuid, text) IS
  '공용 세션 확인 (항상 필수). 협력사 관리자·직원 RPC 용.';

-- ============================================================
-- [5] sign_in_with_phone - mig 058 본문 그대로 + session_token
--     (반환형 jsonb 동일 -> CREATE OR REPLACE 가능)
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

  UPDATE users SET last_login_at = now() WHERE id = v_user.id;

  -- Mig 211a - 세션 발급
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
    'session_token',        v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sign_in_with_phone(text, text) TO anon, authenticated;

-- ============================================================
-- [6] 로그아웃 시 세션 폐기
-- ============================================================
CREATE OR REPLACE FUNCTION sign_out_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN jsonb_build_object('ok', true, 'revoked', 0);
  END IF;
  UPDATE user_sessions
     SET revoked_at = now()
   WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     AND revoked_at IS NULL;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION sign_out_session(text) TO anon, authenticated;

-- ============================================================
-- [7] 기사 입금 보고 - payments 직접 UPDATE 대체
--   대상: 본인에게 배정된 작업(또는 호출자가 운영자)이고, 아직 운영자 확인 전인 건.
--   그 외 작업 id 는 건너뜁니다 (오류 아님, skipped 로 돌려줌).
-- ============================================================
CREATE OR REPLACE FUNCTION engineer_report_remit(
  p_actor    uuid,
  p_task_ids uuid[],
  p_token    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_count    int := 0;
  v_total    int := COALESCE(array_length(p_task_ids, 1), 0);
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인 정보가 없습니다. 다시 로그인해 주세요.');
  END IF;
  IF NOT _session_check(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 만료됐습니다. 다시 로그인해 주세요.');
  END IF;
  IF v_total = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고할 작업이 없습니다.');
  END IF;

  v_is_admin := _caller_is_admin(p_actor);

  UPDATE payments p
     SET engineer_remitted_at = now()
    FROM tasks t
   WHERE t.id = p.task_id
     AND p.task_id = ANY (p_task_ids)
     AND p.engineer_remit_confirmed_at IS NULL
     AND (v_is_admin OR t.assigned_engineer_id = p_actor);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'count', v_count, 'skipped', GREATEST(v_total - v_count, 0));
END;
$$;

CREATE OR REPLACE FUNCTION engineer_report_usol_remit(
  p_actor    uuid,
  p_task_ids uuid[],
  p_token    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_count    int := 0;
  v_total    int := COALESCE(array_length(p_task_ids, 1), 0);
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인 정보가 없습니다. 다시 로그인해 주세요.');
  END IF;
  IF NOT _session_check(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 만료됐습니다. 다시 로그인해 주세요.');
  END IF;
  IF v_total = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고할 작업이 없습니다.');
  END IF;

  v_is_admin := _caller_is_admin(p_actor);

  UPDATE payments p
     SET usol_remitted_at = now()
    FROM tasks t
   WHERE t.id = p.task_id
     AND p.task_id = ANY (p_task_ids)
     AND (v_is_admin OR t.assigned_engineer_id = p_actor);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'count', v_count, 'skipped', GREATEST(v_total - v_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION engineer_report_remit(uuid, uuid[], text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION engineer_report_usol_remit(uuid, uuid[], text) TO anon, authenticated;

-- ============================================================
-- [8] 기사 단가표 저장·삭제 - engineer_rates 직접 쓰기 대체 (운영자 전용)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_upsert_engineer_rate(
  p_actor          uuid,
  p_engineer_code  text,
  p_work_type      text,
  p_appliance_code text,
  p_rate           int,
  p_note           text DEFAULT NULL,
  p_token          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant  uuid := '11111111-1111-1111-1111-111111111111';
  v_user_id uuid;
  v_exists  boolean;
BEGIN
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 단가표를 수정할 수 있습니다.');
  END IF;
  IF NOT _session_check(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 만료됐습니다. 다시 로그인해 주세요.');
  END IF;
  IF COALESCE(TRIM(p_work_type), '') = '' OR COALESCE(TRIM(p_appliance_code), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 종류와 기종은 필수입니다.');
  END IF;
  IF p_rate IS NULL OR p_rate < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '단가는 0 이상의 정수여야 합니다.');
  END IF;

  SELECT id INTO v_user_id
    FROM users
   WHERE tenant_id = v_tenant AND code = TRIM(p_engineer_code);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '기사를 찾지 못했습니다: ' || COALESCE(p_engineer_code, ''));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM engineer_rates
     WHERE tenant_id = v_tenant AND user_id = v_user_id
       AND work_type = TRIM(p_work_type) AND appliance_code = TRIM(p_appliance_code)
  ) INTO v_exists;

  INSERT INTO engineer_rates (tenant_id, user_id, work_type, appliance_code, rate, note)
  VALUES (v_tenant, v_user_id, TRIM(p_work_type), TRIM(p_appliance_code), p_rate, NULLIF(TRIM(COALESCE(p_note, '')), ''))
  ON CONFLICT (tenant_id, user_id, work_type, appliance_code)
  DO UPDATE SET rate = EXCLUDED.rate, note = EXCLUDED.note, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'action', CASE WHEN v_exists THEN 'update' ELSE 'create' END);
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_engineer_rate(
  p_actor          uuid,
  p_engineer_code  text,
  p_work_type      text,
  p_appliance_code text,
  p_token          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant  uuid := '11111111-1111-1111-1111-111111111111';
  v_user_id uuid;
  v_count   int := 0;
BEGIN
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 단가표를 수정할 수 있습니다.');
  END IF;
  IF NOT _session_check(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 만료됐습니다. 다시 로그인해 주세요.');
  END IF;

  SELECT id INTO v_user_id
    FROM users
   WHERE tenant_id = v_tenant AND code = TRIM(p_engineer_code);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '기사를 찾지 못했습니다: ' || COALESCE(p_engineer_code, ''));
  END IF;

  DELETE FROM engineer_rates
   WHERE tenant_id = v_tenant AND user_id = v_user_id
     AND work_type = TRIM(p_work_type) AND appliance_code = TRIM(p_appliance_code);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_engineer_rate(uuid, text, text, text, int, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_engineer_rate(uuid, text, text, text, text)           TO anon, authenticated;

-- ============================================================
-- [9] 앱 버전 기록 - "기사 전원이 새 버전인가" 확인용 (211b 실행 조건)
--   새 버전 앱은 열릴 때마다 report_app_version 을 한 번 호출합니다.
--   옛 버전 앱은 이 함수를 모르므로 기록이 남지 않습니다.
--   조회: db/ops/check_engineer_app_versions.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS user_app_versions (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  app_version   text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_app_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_app_versions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION report_app_version(
  p_actor   uuid,
  p_version text,
  p_token   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL OR COALESCE(TRIM(p_version), '') = '' THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_actor) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  IF NOT _session_check(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session');
  END IF;

  INSERT INTO user_app_versions (user_id, app_version)
  VALUES (p_actor, LEFT(TRIM(p_version), 40))
  ON CONFLICT (user_id) DO UPDATE
    SET app_version   = EXCLUDED.app_version,
        first_seen_at = CASE WHEN user_app_versions.app_version = EXCLUDED.app_version
                             THEN user_app_versions.first_seen_at ELSE now() END,
        last_seen_at  = now();

  RETURN jsonb_build_object('ok', true, 'has_session', (p_token IS NOT NULL AND p_token <> ''));
END;
$$;

GRANT EXECUTE ON FUNCTION report_app_version(uuid, text, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 (실행 후 결과 확인)
-- ============================================================================
-- 1) 새 함수가 전부 생겼는지 - 기대: 10행
SELECT proname
  FROM pg_proc
 WHERE proname IN ('_issue_session','_session_required','_session_check','_session_check_strict',
                   'sign_out_session','engineer_report_remit','engineer_report_usol_remit',
                   'admin_upsert_engineer_rate','admin_delete_engineer_rate','report_app_version')
 ORDER BY proname;

-- 2) 강제 모드가 꺼져 있는지 - 기대: false
SELECT _session_required() AS 강제모드;

-- 3) 로그인 응답에 session_token 이 들어오는지 (본인 계정으로, 비밀번호는 직접 입력)
--    SELECT sign_in_with_phone('01000000000', '비밀번호') ? 'session_token';   -- 기대: true
