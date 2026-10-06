-- ============================================================================
-- Migration 222 - 협력사 모드: 메모 목록·추가, 사진 목록을 RPC 로 (소속 확인)
-- 작성 2026-10-06 · 선행: 211a, 212~214
--
-- 내용
--   _sub_task_access        호출자가 그 작업에 접근할 수 있는지 판정 (공용)
--                            · 그 작업 수행 협력사의 관리자            -> 'manager'
--                            · 그 작업에 배정된, 같은 협력사 소속 기사 -> 'staff'
--                            · 그 외                                   -> NULL
--   sub_list_task_memos     메모 목록
--   sub_add_task_memo       메모 추가 (작성자 이름·역할은 서버가 기록 - 브라우저 값 안 믿음)
--   sub_list_task_photos    사진 목록 (저장 경로만. 사진 파일 자체는 기존 공개 저장소 주소 사용)
--
-- 기존 데이터 영향: 없음 (함수 추가만). 운영자·직영 기사의 메모·사진 경로는 그대로입니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION _sub_task_access(p_actor uuid, p_task_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_sub      uuid;
  v_role     text;
  v_task_sub uuid;
  v_task_eng uuid;
BEGIN
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT subcontractor_id, assigned_engineer_id INTO v_task_sub, v_task_eng
    FROM tasks WHERE id = p_task_id;
  IF v_task_sub IS NULL OR v_task_sub IS DISTINCT FROM v_sub THEN
    RETURN NULL;
  END IF;
  IF v_role = 'manager' THEN
    RETURN 'manager';
  END IF;
  IF v_task_eng = p_actor THEN
    RETURN 'staff';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION _sub_task_access(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 메모 목록
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_task_memos(p_actor uuid, p_token text, p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF _sub_task_access(p_actor, p_task_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'memos', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', m.id, 'task_id', m.task_id, 'memo_type', m.memo_type, 'body', m.body,
             'author_id', m.author_id, 'author_name', m.author_name, 'author_role', m.author_role,
             'created_at', m.created_at) ORDER BY m.created_at DESC)
      FROM task_memos m
     WHERE m.task_id = p_task_id
  ), '[]'::jsonb));
END;
$$;

-- ============================================================
-- 메모 추가
-- ============================================================
CREATE OR REPLACE FUNCTION sub_add_task_memo(
  p_actor   uuid,
  p_token   text,
  p_task_id uuid,
  p_body    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access text;
  v_name   text;
  v_tenant uuid;
  v_id     uuid;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_access := _sub_task_access(p_actor, p_task_id);
  IF v_access IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF COALESCE(TRIM(p_body), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '메모 내용을 입력해 주세요.');
  END IF;

  SELECT name INTO v_name FROM users WHERE id = p_actor;
  SELECT tenant_id INTO v_tenant FROM tasks WHERE id = p_task_id;

  INSERT INTO task_memos (task_id, tenant_id, memo_type, body, author_id, author_name, author_role)
  VALUES (p_task_id, v_tenant, 'general', LEFT(TRIM(p_body), 2000), p_actor, COALESCE(v_name, ''),
          CASE WHEN v_access = 'manager' THEN 'sub_manager' ELSE 'engineer' END)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ============================================================
-- 사진 목록
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_task_photos(p_actor uuid, p_token text, p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF _sub_task_access(p_actor, p_task_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'photos', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', ph.id, 'task_id', ph.task_id, 'step', ph.step, 'storage_path', ph.storage_path,
             'uploaded_by', ph.uploaded_by, 'uploaded_at', ph.uploaded_at) ORDER BY ph.uploaded_at)
      FROM photos ph
     WHERE ph.task_id = p_task_id
  ), '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION sub_list_task_memos(uuid, text, uuid)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sub_add_task_memo(uuid, text, uuid, text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sub_list_task_photos(uuid, text, uuid)      TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT sub_list_task_memos('00000000-0000-0000-0000-000000000000'::uuid, NULL,
                           '00000000-0000-0000-0000-000000000000'::uuid);

-- 2) task_memos 의 칸 이름 확인 (메모 추가가 이 칸들에 씁니다) - 기대: 아래 7개가 모두 보임
--    task_id, tenant_id, memo_type, body, author_id, author_name, author_role
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'task_memos'
 ORDER BY ordinal_position;
