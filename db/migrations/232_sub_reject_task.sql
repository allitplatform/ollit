-- ============================================================================
-- Migration 232 - 협력사 관리자: 작업 반려 (사유 입력 -> 올데이케어로 회수)
-- 작성 2026-10-06 · 선행: 214, 222, 226
--
-- 내용
--   sub_reject_task (신규)
--     · 협력사 관리자가 자기 협력사로 넘어온 작업을 사유와 함께 되돌립니다.
--     · 결과: 수행처 = 올데이케어 직영, 담당 기사 해제, 상태 = 미배정
--       (운영자의 [직영으로 회수] 와 같은 결과)
--     · 사유는 작업 메모와 처리 이력에 남아 운영자 상세 화면에서 보입니다.
--     · 진행 중이거나 끝난 작업은 반려할 수 없습니다.
--
-- 기존 함수·데이터 영향 없음 (함수 1개 추가).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION sub_reject_task(p_actor uuid, p_token text, p_task_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub      uuid;
  v_role     text;
  v_task     tasks%ROWTYPE;
  v_reason   text := LEFT(btrim(COALESCE(p_reason, '')), 500);
  v_name     text;
  v_sub_name text;
  v_eng      text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  IF v_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '반려 사유를 입력해 주세요.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.subcontractor_id IS DISTINCT FROM v_sub THEN
    -- 다른 곳의 작업은 "있는지 없는지"도 알려 주지 않음
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.status IN ('완료', '취소', 'visit_only', '정산완료', '취소요청') THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 상태의 작업은 반려할 수 없습니다.');
  END IF;
  IF v_task.status = '진행중' THEN
    RETURN jsonb_build_object('ok', false, 'error', '진행 중인 작업은 반려할 수 없습니다.');
  END IF;

  SELECT name INTO v_name     FROM users          WHERE id = p_actor;
  SELECT name INTO v_sub_name FROM subcontractors WHERE id = v_sub;
  SELECT name INTO v_eng      FROM users          WHERE id = v_task.assigned_engineer_id;

  UPDATE tasks SET
    subcontractor_id     = NULL,
    assigned_engineer_id = NULL,
    status               = '미배정',
    push_candidates      = '[]'::jsonb,
    updated_at           = now()
  WHERE id = p_task_id;

  -- 운영자가 상세 화면에서 바로 보도록 메모로 남긴다 (메모 실패가 반려를 되돌리지 않게)
  BEGIN
    INSERT INTO task_memos (task_id, tenant_id, memo_type, body, author_id, author_name, author_role)
    VALUES (p_task_id, v_task.tenant_id, 'general',
            '[' || COALESCE(v_sub_name, '협력사') || ' 반려] ' || v_reason,
            p_actor, COALESCE(v_name, ''), 'sub_manager');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[sub reject] 메모 기록 실패 - 처리는 계속: %', SQLERRM;
  END;

  PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'sub_manager',
    COALESCE(v_sub_name, '협력사') || ' 반려 -> 올데이케어로 회수: ' || v_reason,
    jsonb_build_object('subcontractor', v_sub_name, 'engineer', v_eng),
    jsonb_build_object('subcontractor', NULL, 'engineer', NULL));

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id);
END;
$$;

GRANT EXECUTE ON FUNCTION sub_reject_task(uuid, text, uuid, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 - 기대: 1행
SELECT proname FROM pg_proc WHERE proname = 'sub_reject_task';

-- 2) 세션 없이 호출하면 거부 - 기대: {"ok": false, "error": "다시 로그인해 주세요."}
SELECT sub_reject_task(NULL, NULL, NULL, '시험');
