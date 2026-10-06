-- ============================================================================
-- Migration 226 - 협력사 관련 처리 이력 기록 (누가·언제)
-- 작성 2026-10-06 · 선행: 214, 220
--
-- 배경
--   운영자 작업 상세의 "변경 이력" 은 task_changes 표를 읽습니다. 협력사용 함수
--   (넘기기 / 담당 기사 배정 / 일정 확정)는 지금까지 이 표에 기록을 남기지 않아,
--   시각은 보여도 "누가 했는지" 가 남지 않았습니다.
--
-- 방법 (기존 함수 본문은 다시 쓰지 않습니다 - 211c 와 같은 방식)
--   기존 3개 함수를 _impl_* 로 이름만 바꿔 보존하고, 같은 이름의 새 함수가
--   _impl_* 를 부른 뒤 성공했을 때만 task_changes 에 1줄 기록합니다.
--     admin_assign_task_to_subcontractor -> "협력사로 넘김: 화이트코어" / "직영으로 회수"
--     sub_assign_task                    -> "담당 기사 배정: 홍길동" / "배정 해제"
--     sub_set_schedule                   -> "일정 확정: 10/08 10:00"
--   기록 실패는 원래 처리를 되돌리지 않습니다.
--
-- 기존 데이터 영향: 없음. 과거 처리분의 처리자는 소급해서 채울 수 없습니다.
-- 재실행 안전: _impl_* 가 이미 있으면 이름 변경을 건너뜁니다.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('_impl_admin_assign_task_to_subcontractor(uuid, text, uuid, uuid)') IS NULL THEN
    ALTER FUNCTION admin_assign_task_to_subcontractor(uuid, text, uuid, uuid) RENAME TO _impl_admin_assign_task_to_subcontractor;
  END IF;
  IF to_regprocedure('_impl_sub_assign_task(uuid, text, uuid, uuid)') IS NULL THEN
    ALTER FUNCTION sub_assign_task(uuid, text, uuid, uuid) RENAME TO _impl_sub_assign_task;
  END IF;
  IF to_regprocedure('_impl_sub_set_schedule(uuid, text, uuid, timestamptz)') IS NULL THEN
    ALTER FUNCTION sub_set_schedule(uuid, text, uuid, timestamptz) RENAME TO _impl_sub_set_schedule;
  END IF;
END $$;

REVOKE ALL ON FUNCTION _impl_admin_assign_task_to_subcontractor(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _impl_sub_assign_task(uuid, text, uuid, uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _impl_sub_set_schedule(uuid, text, uuid, timestamptz)            FROM PUBLIC, anon, authenticated;

-- 공용: 이력 1줄 기록 (실패해도 호출한 쪽 처리는 계속)
CREATE OR REPLACE FUNCTION _sub_log_change(
  p_task_id uuid, p_type text, p_actor uuid, p_role text, p_note text, p_before jsonb, p_after jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO task_changes (task_id, tenant_id, change_type, before_data, after_data, note,
                            changed_by, changed_by_name, changed_by_role)
  SELECT t.id, t.tenant_id, p_type::change_type_enum, p_before, p_after, p_note,
         p_actor, (SELECT name FROM users WHERE id = p_actor), p_role
    FROM tasks t WHERE t.id = p_task_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[sub log] 이력 기록 실패 - 처리는 계속: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION _sub_log_change(uuid, text, uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 운영자: 협력사로 넘기기 / 직영으로 회수
-- ============================================================
CREATE OR REPLACE FUNCTION admin_assign_task_to_subcontractor(
  p_actor uuid, p_token text, p_task_id uuid, p_subcontractor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_before uuid;
  v_res    jsonb;
  v_name   text;
BEGIN
  SELECT subcontractor_id INTO v_before FROM tasks WHERE id = p_task_id;
  v_res := _impl_admin_assign_task_to_subcontractor(p_actor, p_token, p_task_id, p_subcontractor_id);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    SELECT name INTO v_name FROM subcontractors WHERE id = COALESCE(p_subcontractor_id, v_before);
    PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'admin',
      CASE WHEN p_subcontractor_id IS NULL THEN '직영으로 회수' || COALESCE(' (' || v_name || ')', '')
           ELSE '협력사로 넘김: ' || COALESCE(v_name, '') END,
      jsonb_build_object('subcontractor_id', v_before),
      jsonb_build_object('subcontractor_id', p_subcontractor_id));
  END IF;
  RETURN v_res;
END;
$$;

-- ============================================================
-- 협력사 관리자: 담당 기사 배정 / 해제
-- ============================================================
CREATE OR REPLACE FUNCTION sub_assign_task(
  p_actor uuid, p_token text, p_task_id uuid, p_engineer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_before_id   uuid;
  v_before_name text;
  v_after_name  text;
  v_res         jsonb;
BEGIN
  SELECT t.assigned_engineer_id, u.name INTO v_before_id, v_before_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_engineer_id
   WHERE t.id = p_task_id;
  v_res := _impl_sub_assign_task(p_actor, p_token, p_task_id, p_engineer_id);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    SELECT name INTO v_after_name FROM users WHERE id = p_engineer_id;
    PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'sub_manager',
      CASE WHEN p_engineer_id IS NULL THEN '배정 해제' || COALESCE(' (' || v_before_name || ')', '')
           ELSE '담당 기사 배정: ' || COALESCE(v_after_name, '') END,
      jsonb_build_object('engineer', v_before_name),
      jsonb_build_object('engineer', v_after_name));
  END IF;
  RETURN v_res;
END;
$$;

-- ============================================================
-- 협력사 관리자: 일정 확정·변경
-- ============================================================
CREATE OR REPLACE FUNCTION sub_set_schedule(
  p_actor uuid, p_token text, p_task_id uuid, p_scheduled_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_before timestamptz;
  v_res    jsonb;
BEGIN
  SELECT scheduled_at INTO v_before FROM tasks WHERE id = p_task_id;
  v_res := _impl_sub_set_schedule(p_actor, p_token, p_task_id, p_scheduled_at);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    PERFORM _sub_log_change(p_task_id, 'schedule', p_actor, 'sub_manager',
      CASE WHEN v_before IS NULL THEN '일정 확정: ' ELSE '일정 변경: ' END
        || to_char(p_scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'),
      jsonb_build_object('scheduledAt', v_before),
      jsonb_build_object('scheduledAt', p_scheduled_at));
  END IF;
  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_assign_task_to_subcontractor(uuid, text, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sub_assign_task(uuid, text, uuid, uuid)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sub_set_schedule(uuid, text, uuid, timestamptz)            TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 - 기대: 6행 (이름마다 본체 _impl_ 1 + 새 함수 1)
-- ============================================================================
SELECT proname FROM pg_proc
 WHERE proname IN ('admin_assign_task_to_subcontractor', 'sub_assign_task', 'sub_set_schedule',
                   '_impl_admin_assign_task_to_subcontractor', '_impl_sub_assign_task', '_impl_sub_set_schedule')
 ORDER BY proname;
