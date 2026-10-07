-- ============================================================================
-- Migration 242 - 협력사 작업 예외 처리: 운영자의 "변경 요청" · "올데이케어로 회수"
-- 작성 2026-10-07 · 선행: 212, 214, 220, 226, 232, 239, 240, 241
--
-- 사장님 결정 (2026-10-07, 운영자 PC 타임라인 개편 - 화이트코어 예외 처리 B)
--   협력사 묶음은 운영자에게 "보기 전용" 이다 (배정은 협력사 관리자). 급할 때만 아래 두 가지를 쓴다.
--   a. 관리자에게 변경 요청  - 요청 종류(기사 변경 / 일정 변경 / 기타) + 내용
--      -> 그 협력사 관리자에게 푸시, 작업 메모 · 처리 이력에 기록, 작업에 "변경 요청 중" 표시
--      -> 협력사 관리자가 [처리 완료] 를 누르면 표시 해제 + 운영자에게 푸시
--   b. 올데이케어로 회수     - 사유 필수. 협력사 지정 해제 + 담당 기사 해제 + 미배정
--      -> 협력사 관리자 + 담당 기사에게 푸시, 이력 기록
--      -> 진행 중 · 완료 · 취소 · 정산에 올라간 작업은 회수 불가
--
-- 내용
--   [1] tasks.sub_change_request (jsonb)  열려 있는 변경 요청 1건. 없으면 NULL.
--         { kind: engineer|schedule|etc, body, by, by_name, at }
--   [2] admin_request_sub_change      운영자 전용 (세션 확인 + _caller_is_admin)
--   [3] sub_resolve_change_request    협력사 관리자 전용 (자기 협력사 작업만)
--   [4] sub_list_change_requests      협력사 관리자 전용 - 자기 협력사의 열린 요청 목록 (목록 카드 표시용)
--   [5] admin_recall_sub_task         운영자 전용. 결과 상태는 협력사 "반려"(mig 232)와 같다:
--         subcontractor_id = NULL, assigned_engineer_id = NULL, status = '미배정', push_candidates = []
--
-- 건드리지 않는 것: 반려 함수(sub_reject_task), 정산 규칙 · 정산 함수, 기존 넘기기 함수.
-- 기존 데이터 영향 없음 (칸 1개 추가, 함수 4개 추가). 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_change_request jsonb;

-- 내부: 그 협력사 관리자에게 푸시 (취소 · 일정 변경 알림 설정과 전체 스위치를 따른다)
CREATE OR REPLACE FUNCTION _sub_push_managers(p_sub uuid, p_title text, p_body text, p_tag text, p_task uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT u.id FROM users u
     WHERE u.subcontractor_id = p_sub AND u.sub_role = 'manager' AND u.is_active = true
       AND _sub_notify_on(u.id, 'cancel_change')
  LOOP
    PERFORM _msg_push(jsonb_build_object(
      'targetType', 'user', 'targetId', r.id::text,
      'title', p_title, 'body', p_body, 'url', '/', 'tag', p_tag, 'taskId', p_task::text));
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[sub push] 관리자 알림 실패 - 처리는 계속: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION _sub_push_managers(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- [2] 운영자: 관리자에게 변경 요청
-- ============================================================
CREATE OR REPLACE FUNCTION admin_request_sub_change(
  p_actor uuid, p_token text, p_task_id uuid, p_kind text, p_body text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task  tasks%ROWTYPE;
  v_kind  text := lower(btrim(COALESCE(p_kind, '')));
  v_body  text := LEFT(btrim(COALESCE(p_body, '')), 500);
  v_name  text;
  v_label text;
  v_req   jsonb;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF v_kind NOT IN ('engineer', 'schedule', 'etc') THEN
    RETURN jsonb_build_object('ok', false, 'error', '요청 종류를 골라 주세요.');
  END IF;
  IF v_body = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '요청 내용을 입력해 주세요.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.subcontractor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사로 넘긴 작업이 아닙니다.');
  END IF;
  IF v_task.status IN ('완료', '취소', 'visit_only', '정산완료') THEN
    RETURN jsonb_build_object('ok', false, 'error', '끝난 작업에는 변경을 요청할 수 없습니다.');
  END IF;

  SELECT name INTO v_name FROM users WHERE id = p_actor;
  v_label := CASE v_kind WHEN 'engineer' THEN '기사 변경' WHEN 'schedule' THEN '일정 변경' ELSE '기타' END;
  v_req := jsonb_build_object('kind', v_kind, 'body', v_body, 'by', p_actor, 'by_name', COALESCE(v_name, ''), 'at', now());

  UPDATE tasks SET sub_change_request = v_req, updated_at = now() WHERE id = p_task_id;

  BEGIN
    INSERT INTO task_memos (task_id, tenant_id, memo_type, body, author_id, author_name, author_role)
    VALUES (p_task_id, v_task.tenant_id, 'general',
            '[올데이케어 변경 요청 · ' || v_label || '] ' || v_body,
            p_actor, COALESCE(v_name, ''), 'admin');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[sub change] 메모 기록 실패 - 처리는 계속: %', SQLERRM;
  END;

  PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'admin',
    '협력사에 변경 요청 (' || v_label || '): ' || v_body, NULL, v_req);

  PERFORM _sub_push_managers(v_task.subcontractor_id, '올데이케어 변경 요청',
    btrim('올데이케어 변경 요청 · ' || COALESCE(v_task.customer_name, '') || ' · ' || v_body),
    'sub-change-' || p_task_id::text, p_task_id);

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'request', v_req);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_request_sub_change(uuid, text, uuid, text, text) TO anon, authenticated;

-- ============================================================
-- [3] 협력사 관리자: 변경 요청 처리 완료
-- ============================================================
CREATE OR REPLACE FUNCTION sub_resolve_change_request(p_actor uuid, p_token text, p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub      uuid;
  v_role     text;
  v_task     tasks%ROWTYPE;
  v_name     text;
  v_sub_name text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.subcontractor_id IS DISTINCT FROM v_sub THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.sub_change_request IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'already', true);
  END IF;

  SELECT name INTO v_name     FROM users          WHERE id = p_actor;
  SELECT name INTO v_sub_name FROM subcontractors WHERE id = v_sub;

  UPDATE tasks SET sub_change_request = NULL, updated_at = now() WHERE id = p_task_id;

  PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'sub_manager',
    COALESCE(v_sub_name, '협력사') || ' 변경 요청 처리 완료', v_task.sub_change_request, NULL);

  -- 운영자에게 알림
  BEGIN
    PERFORM _msg_push(jsonb_build_object(
      'targetType', 'role', 'targetId', 'admin',
      'title', '변경 요청 처리 완료',
      'body',  btrim('처리 완료 · ' || COALESCE(v_sub_name, '협력사') || ' · ' || COALESCE(v_task.customer_name, '')
                     || COALESCE(' · ' || NULLIF(v_name, ''), '')),
      'url', '/', 'tag', 'sub-change-done-' || p_task_id::text, 'taskId', p_task_id::text));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[sub change] 운영자 알림 실패 - 처리는 계속: %', SQLERRM;
  END;

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_resolve_change_request(uuid, text, uuid) TO anon, authenticated;

-- ============================================================
-- [4] 협력사 관리자: 열린 변경 요청 목록 (목록 카드 표시용)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_change_requests(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'rows', COALESCE((
    SELECT jsonb_agg(t.sub_change_request || jsonb_build_object('task_id', t.id) ORDER BY t.sub_change_request ->> 'at' DESC)
      FROM tasks t
     WHERE t.subcontractor_id = v_sub AND t.sub_change_request IS NOT NULL), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_list_change_requests(uuid, text) TO anon, authenticated;

-- ============================================================
-- [5] 운영자: 올데이케어로 회수 (결과 상태는 협력사 반려와 같다)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_recall_sub_task(p_actor uuid, p_token text, p_task_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task     tasks%ROWTYPE;
  v_reason   text := LEFT(btrim(COALESCE(p_reason, '')), 500);
  v_name     text;
  v_sub_name text;
  v_eng      text;
  v_body     text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF v_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '회수 사유를 입력해 주세요.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.subcontractor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사로 넘긴 작업이 아닙니다.');
  END IF;
  IF v_task.status = '진행중' THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 시작한 뒤에는 회수할 수 없습니다.');
  END IF;
  IF v_task.status IN ('완료', '취소', 'visit_only', '정산완료', '취소요청') THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 상태의 작업은 회수할 수 없습니다.');
  END IF;
  IF EXISTS (SELECT 1 FROM subcontractor_settlement_lines l WHERE l.task_id = p_task_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', '정산에 올라간 작업은 회수할 수 없습니다.');
  END IF;

  SELECT name INTO v_name     FROM users          WHERE id = p_actor;
  SELECT name INTO v_sub_name FROM subcontractors WHERE id = v_task.subcontractor_id;
  SELECT name INTO v_eng      FROM users          WHERE id = v_task.assigned_engineer_id;

  -- 반려(mig 232)와 같은 결과 상태
  UPDATE tasks SET
    subcontractor_id     = NULL,
    assigned_engineer_id = NULL,
    status               = '미배정',
    push_candidates      = '[]'::jsonb,
    sub_change_request   = NULL,
    updated_at           = now()
  WHERE id = p_task_id;

  BEGIN
    INSERT INTO task_memos (task_id, tenant_id, memo_type, body, author_id, author_name, author_role)
    VALUES (p_task_id, v_task.tenant_id, 'general',
            '[올데이케어 회수 · ' || COALESCE(v_sub_name, '협력사') || '] ' || v_reason,
            p_actor, COALESCE(v_name, ''), 'admin');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[sub recall] 메모 기록 실패 - 처리는 계속: %', SQLERRM;
  END;

  PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'admin',
    COALESCE(v_sub_name, '협력사') || ' 에서 올데이케어로 회수: ' || v_reason,
    jsonb_build_object('subcontractor', v_sub_name, 'engineer', v_eng),
    jsonb_build_object('subcontractor', NULL, 'engineer', NULL));

  v_body := btrim('회수됨 · ' || COALESCE(v_task.customer_name, '') || ' · ' || v_reason);
  PERFORM _sub_push_managers(v_task.subcontractor_id, '올데이케어로 회수', v_body, 'sub-recall-' || p_task_id::text, p_task_id);
  -- 담당 기사에게도 (관리자 본인이 담당이면 위에서 이미 받았으므로 건너뛴다)
  IF v_task.assigned_engineer_id IS NOT NULL THEN
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = v_task.assigned_engineer_id
                        AND u.subcontractor_id = v_task.subcontractor_id AND u.sub_role = 'manager') THEN
        PERFORM _msg_push(jsonb_build_object(
          'targetType', 'user', 'targetId', v_task.assigned_engineer_id::text,
          'title', '올데이케어로 회수', 'body', v_body,
          'url', '/', 'tag', 'sub-recall-' || p_task_id::text));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[sub recall] 기사 알림 실패 - 처리는 계속: %', SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_recall_sub_task(uuid, text, uuid, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 - 기대: 6행 (칸 1 + 함수 5)
-- ============================================================================
SELECT '칸' AS 종류, column_name AS 이름 FROM information_schema.columns
 WHERE table_name = 'tasks' AND column_name = 'sub_change_request'
UNION ALL
SELECT '함수', proname FROM pg_proc
 WHERE proname IN ('admin_request_sub_change', 'sub_resolve_change_request', 'sub_list_change_requests',
                   'admin_recall_sub_task', '_sub_push_managers')
 ORDER BY 1, 2;
