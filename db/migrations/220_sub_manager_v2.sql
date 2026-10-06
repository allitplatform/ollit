-- ============================================================================
-- Migration 220 - 협력사 화면 v2: 일정 확정·변경, 기사별 현황, 새 작업 푸시
-- 작성 2026-10-06 · 선행: 211a, 212~214, 188(_msg_push)
--
-- 내용
--   [1] sub_set_schedule      협력사 관리자가 자기 협력사 작업의 일정을 확정·변경
--                              (배정 상태면 '확정' 으로, 이미 확정이면 날짜·시간만 변경)
--   [2] sub_list_staff (교체) 기사별 "오늘 일정 n건 · 진행 n건 · 담당 지역" 추가
--   [3] 새 작업 푸시          작업이 협력사로 넘어오면 그 협력사 관리자들에게 푸시
--                              (tasks 트리거 - 운영자가 넘기기 버튼을 쓰든, 협력사 직원을
--                               직접 배정하든 같은 지점에서 발송)
--
-- 상태 흐름 (협력사 화면): 미배정 -> 배정 -> 확정(일정 확정) -> 진행중 -> 완료
--   · 미배정 -> 배정   : sub_assign_task (기사 지정, mig 214)
--   · 배정 -> 확정     : sub_set_schedule (이 파일)
--   · 확정 -> 진행중 -> 완료 : 기사 앱 (기존 흐름)
--
-- 기존 데이터 영향: 없음. 트리거는 작업의 수행 협력사가 "새로 들어오거나 바뀔 때" 만 푸시합니다
--   (배정 기사 변경으로 수행처가 바뀌는 경우도 포함하려고 assigned_engineer_id 변경에도 걸어 둠 -
--    수행처가 그대로면 아무것도 하지 않습니다).
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 일정 확정·변경
-- ============================================================
CREATE OR REPLACE FUNCTION sub_set_schedule(
  p_actor        uuid,
  p_token        text,
  p_task_id      uuid,
  p_scheduled_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_task tasks%ROWTYPE;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  IF p_scheduled_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '날짜와 시간을 정해 주세요.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.subcontractor_id IS DISTINCT FROM v_sub THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.status IN ('완료', '취소', 'visit_only', '정산완료', '취소요청', '진행중') THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 상태의 작업은 일정을 바꿀 수 없습니다.');
  END IF;
  IF v_task.assigned_engineer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '먼저 담당 기사를 배정해 주세요.');
  END IF;

  UPDATE tasks SET
    scheduled_at = p_scheduled_at,
    status       = CASE WHEN status IN ('배정', '미배정', '약속대기') THEN '확정' ELSE status END,
    updated_at   = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'scheduled_at', p_scheduled_at);
END;
$$;

GRANT EXECUTE ON FUNCTION sub_set_schedule(uuid, text, uuid, timestamptz) TO anon, authenticated;

-- ============================================================
-- [2] 기사 목록 - 오늘 일정·진행·담당 지역 추가 (mig 214 의 sub_list_staff 교체)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_staff(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub   uuid;
  v_role  text;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'staff', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', u.id, 'code', u.code, 'name', u.name, 'phone', u.phone, 'sub_role', u.sub_role,
             'region', u.region,
             'zones', COALESCE((SELECT jsonb_agg(z.district ORDER BY z.district)
                                  FROM engineer_zones z
                                 WHERE z.user_id = u.id AND COALESCE(z.active, true)), '[]'::jsonb),
             'open_tasks', (SELECT COUNT(*) FROM tasks t
                             WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                               AND t.status NOT IN ('완료', '취소', 'visit_only', '정산완료')),
             'today_tasks', (SELECT COUNT(*) FROM tasks t
                              WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                                AND t.status <> '취소'
                                AND COALESCE((t.scheduled_at AT TIME ZONE 'Asia/Seoul')::date, t.requested_date) = v_today),
             'in_progress', (SELECT COUNT(*) FROM tasks t
                              WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                                AND t.status = '진행중')
           ) ORDER BY u.name)
      FROM users u
     WHERE u.subcontractor_id = v_sub
       AND u.is_active = true
  ), '[]'::jsonb));
END;
$$;

-- ============================================================
-- [3] 새 작업이 협력사로 넘어오면 관리자에게 푸시
--   AFTER 트리거 - 저장이 끝난 뒤 발송. 푸시 실패는 저장을 막지 않습니다.
--   대상: 그 협력사의 활성 관리자(sub_role = manager) 전원.
-- ============================================================
CREATE OR REPLACE FUNCTION trg_tasks_notify_sub_managers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.subcontractor_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.subcontractor_id IS NOT DISTINCT FROM OLD.subcontractor_id THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('완료', '취소', 'visit_only') THEN
    RETURN NEW;
  END IF;

  BEGIN
    FOR r IN
      SELECT u.id FROM users u
       WHERE u.subcontractor_id = NEW.subcontractor_id
         AND u.sub_role = 'manager'
         AND u.is_active = true
    LOOP
      PERFORM _msg_push(jsonb_build_object(
        'targetType', 'user',
        'targetId',   r.id::text,
        'title',      '🆕 새 작업이 들어왔습니다',
        'body',       COALESCE(NEW.customer_name, '') || ' · ' || COALESCE(NEW.district, NEW.address, '')
                      || CASE WHEN NEW.assigned_engineer_id IS NULL THEN ' · 기사 배정 필요' ELSE '' END,
        'url',        '/',
        'tag',        'sub-new-task-' || NEW.id::text,
        'taskId',     NEW.id::text
      ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[sub push] 발송 실패 - 저장은 계속: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_notify_sub_managers ON tasks;
CREATE TRIGGER tasks_notify_sub_managers
  AFTER INSERT OR UPDATE OF subcontractor_id, assigned_engineer_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION trg_tasks_notify_sub_managers();

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수·트리거 - 기대: 함수 3행, 트리거 1행
SELECT proname FROM pg_proc
 WHERE proname IN ('sub_set_schedule', 'sub_list_staff', 'trg_tasks_notify_sub_managers') ORDER BY 1;
SELECT tgname FROM pg_trigger WHERE tgname = 'tasks_notify_sub_managers' AND NOT tgisinternal;

-- 2) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
-- SELECT sub_set_schedule('00000000-0000-0000-0000-000000000000'::uuid, NULL,
--                         '00000000-0000-0000-0000-000000000000'::uuid, now());
