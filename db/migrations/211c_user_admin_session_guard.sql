-- ============================================================================
-- Migration 211c - 사용자 권한 함수 3개에 세션 확인 필수 적용
-- 작성 2026-10-06 · 선행: 211a (반드시 211a 를 먼저 실행)
--
-- 닫는 문제
--   admin_upsert_user / admin_set_user_roles / admin_reset_user_password (mig 103) 는
--   호출자 확인이 "브라우저가 보낸 p_actor 가 운영자인가" 하나뿐이었습니다.
--   운영자의 user_id 를 넣어 호출하면 누구나 계정 생성·권한 변경·운영자 비밀번호
--   재설정이 가능했습니다.
--
-- 방법 (기존 함수 본문은 한 글자도 다시 쓰지 않습니다)
--   [1] 기존 3개 함수의 이름을 _impl_* 로 바꾸고 외부 실행 권한을 회수
--       -> 운영 DB 에 있는 본문 그대로 보존 (저장소 파일과 달라도 안전)
--   [2] 같은 이름 + p_token 인자가 추가된 새 함수: 세션 확인(유예 없음) 후 _impl_* 호출
--   [3] 옛 인자 구성(p_token 없음)으로 호출하면 안내 문구만 돌려주는 함수
--       -> 옛 버전 앱에서 "새로고침 후 다시 로그인" 안내가 보입니다.
--
-- 실행 직후 달라지는 것
--   · 코드 push 전까지: 운영자 화면의 "사용자 추가·수정 / 역할 변경 / 비밀번호 초기화"
--     저장이 안내 문구와 함께 실패합니다 (그 외 기능은 영향 없음).
--   · 코드 push 후: 운영자는 로그아웃 -> 다시 로그인 1회 필요 (세션 값 발급).
--     그 뒤로는 평소대로 동작합니다.
--   · 기사·원청 계정: 영향 없음 (이 3개 함수를 쓰지 않음).
--
-- 재실행 안전: [1] 은 _impl_* 가 이미 있으면 건너뜁니다.
-- ============================================================================

BEGIN;

-- 선행 확인: 211a 의 공용 함수가 없으면 중단
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = '_session_check_strict') THEN
    RAISE EXCEPTION '211a 가 아직 실행되지 않았습니다. 211a 를 먼저 실행해 주세요.';
  END IF;
END $$;

-- ============================================================
-- [1] 기존 함수 -> _impl_* 로 이름 변경 + 외부 실행 권한 회수
-- ============================================================
DO $$
BEGIN
  IF to_regprocedure('_impl_admin_upsert_user(text, jsonb, uuid)') IS NULL THEN
    IF to_regprocedure('admin_upsert_user(text, jsonb, uuid)') IS NULL THEN
      RAISE EXCEPTION 'admin_upsert_user(text, jsonb, uuid) 를 찾지 못했습니다. 중단합니다.';
    END IF;
    ALTER FUNCTION admin_upsert_user(text, jsonb, uuid) RENAME TO _impl_admin_upsert_user;
  END IF;

  IF to_regprocedure('_impl_admin_set_user_roles(uuid, jsonb, uuid)') IS NULL THEN
    IF to_regprocedure('admin_set_user_roles(uuid, jsonb, uuid)') IS NULL THEN
      RAISE EXCEPTION 'admin_set_user_roles(uuid, jsonb, uuid) 를 찾지 못했습니다. 중단합니다.';
    END IF;
    ALTER FUNCTION admin_set_user_roles(uuid, jsonb, uuid) RENAME TO _impl_admin_set_user_roles;
  END IF;

  IF to_regprocedure('_impl_admin_reset_user_password(uuid, text, uuid)') IS NULL THEN
    IF to_regprocedure('admin_reset_user_password(uuid, text, uuid)') IS NULL THEN
      RAISE EXCEPTION 'admin_reset_user_password(uuid, text, uuid) 를 찾지 못했습니다. 중단합니다.';
    END IF;
    ALTER FUNCTION admin_reset_user_password(uuid, text, uuid) RENAME TO _impl_admin_reset_user_password;
  END IF;
END $$;

REVOKE ALL ON FUNCTION _impl_admin_upsert_user(text, jsonb, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _impl_admin_set_user_roles(uuid, jsonb, uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _impl_admin_reset_user_password(uuid, text, uuid)  FROM PUBLIC, anon, authenticated;

-- ============================================================
-- [2] 새 함수 - 세션 확인 후 기존 본문 호출
--     p_token 에 기본값을 두지 않습니다 (옛 인자 구성과 구분되도록).
-- ============================================================
CREATE OR REPLACE FUNCTION admin_upsert_user(
  p_code  text,
  p_patch jsonb,
  p_actor uuid,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '보안 확인이 필요합니다. 로그아웃 후 다시 로그인해 주세요.');
  END IF;
  RETURN _impl_admin_upsert_user(p_code, p_patch, p_actor);
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_user_roles(
  p_user_id uuid,
  p_roles   jsonb,
  p_actor   uuid,
  p_token   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '보안 확인이 필요합니다. 로그아웃 후 다시 로그인해 주세요.');
  END IF;
  RETURN _impl_admin_set_user_roles(p_user_id, p_roles, p_actor);
END;
$$;

CREATE OR REPLACE FUNCTION admin_reset_user_password(
  p_user_id      uuid,
  p_new_password text,
  p_actor        uuid,
  p_token        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '보안 확인이 필요합니다. 로그아웃 후 다시 로그인해 주세요.');
  END IF;

  v_res := _impl_admin_reset_user_password(p_user_id, p_new_password, p_actor);

  -- 비밀번호가 초기화된 계정의 기존 세션은 전부 폐기 (다른 기기에 남은 로그인 무효화).
  -- 운영자가 본인 비밀번호를 초기화한 경우는 지금 쓰는 세션을 유지합니다.
  IF COALESCE((v_res ->> 'ok')::boolean, false) AND p_user_id IS DISTINCT FROM p_actor THEN
    UPDATE user_sessions SET revoked_at = now()
     WHERE user_id = p_user_id AND revoked_at IS NULL;
  END IF;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_user(text, jsonb, uuid, text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_roles(uuid, jsonb, uuid, text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_user_password(uuid, text, uuid, text)  TO anon, authenticated;

-- ============================================================
-- [3] 옛 인자 구성 - 안내만 (실제 동작 없음)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_upsert_user(p_code text, p_patch jsonb, p_actor uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('ok', false, 'error', '앱이 옛 버전입니다. 앱을 닫았다 다시 연 뒤 로그아웃 후 다시 로그인해 주세요.');
$$;

CREATE OR REPLACE FUNCTION admin_set_user_roles(p_user_id uuid, p_roles jsonb, p_actor uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('ok', false, 'error', '앱이 옛 버전입니다. 앱을 닫았다 다시 연 뒤 로그아웃 후 다시 로그인해 주세요.');
$$;

CREATE OR REPLACE FUNCTION admin_reset_user_password(p_user_id uuid, p_new_password text, p_actor uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('ok', false, 'error', '앱이 옛 버전입니다. 앱을 닫았다 다시 연 뒤 로그아웃 후 다시 로그인해 주세요.');
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_user(text, jsonb, uuid)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_roles(uuid, jsonb, uuid)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_user_password(uuid, text, uuid)  TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 구성 - 기대: 9행 (이름마다 인자 3개짜리 1 + 4개짜리 1, _impl_ 3)
SELECT proname, pronargs
  FROM pg_proc
 WHERE proname IN ('admin_upsert_user', 'admin_set_user_roles', 'admin_reset_user_password',
                   '_impl_admin_upsert_user', '_impl_admin_set_user_roles', '_impl_admin_reset_user_password')
 ORDER BY proname, pronargs;

-- 2) 옛 방식 호출이 막혔는지 - 기대: ok=false + "앱이 옛 버전입니다..."
SELECT admin_reset_user_password(
  '00000000-0000-0000-0000-000000000000'::uuid, 'x',
  '00000000-0000-0000-0000-000000000000'::uuid);

-- 3) 세션 값 없이 새 방식 호출이 막혔는지 - 기대: ok=false + "보안 확인이 필요합니다..."
SELECT admin_reset_user_password(
  '00000000-0000-0000-0000-000000000000'::uuid, 'x',
  '00000000-0000-0000-0000-000000000000'::uuid, NULL);

-- ============================================================================
-- [되돌리기] 문제가 생기면 아래 주석을 풀어 실행 (원래 상태로 복구)
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION admin_upsert_user(text, jsonb, uuid, text);
-- DROP FUNCTION admin_set_user_roles(uuid, jsonb, uuid, text);
-- DROP FUNCTION admin_reset_user_password(uuid, text, uuid, text);
-- DROP FUNCTION admin_upsert_user(text, jsonb, uuid);
-- DROP FUNCTION admin_set_user_roles(uuid, jsonb, uuid);
-- DROP FUNCTION admin_reset_user_password(uuid, text, uuid);
-- ALTER FUNCTION _impl_admin_upsert_user(text, jsonb, uuid)        RENAME TO admin_upsert_user;
-- ALTER FUNCTION _impl_admin_set_user_roles(uuid, jsonb, uuid)     RENAME TO admin_set_user_roles;
-- ALTER FUNCTION _impl_admin_reset_user_password(uuid, text, uuid) RENAME TO admin_reset_user_password;
-- GRANT EXECUTE ON FUNCTION admin_upsert_user(text, jsonb, uuid)        TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION admin_set_user_roles(uuid, jsonb, uuid)     TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION admin_reset_user_password(uuid, text, uuid) TO anon, authenticated;
-- COMMIT;
