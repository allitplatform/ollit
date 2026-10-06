-- ============================================================================
-- Migration 230 - 협력사 배정 시트 (기사 50명 대응)
-- 작성 2026-10-06 · 선행: 214, 220, 226
--
-- 내용
--   [1] sub_list_staff_for_task (신규)
--       작업 한 건을 기준으로 그 협력사 기사 목록을 돌려줍니다.
--       · 호출 가능: 그 작업의 협력사 관리자, 또는 운영자
--       · 기사별: 담당 지역 / 지역 일치 여부 / 오늘 일정 n건 / 작업일 일정 n건 /
--                 진행 n건 / 다음 일정 시각 / 작업일 휴무 여부
--       추천·검색·지역 필터는 앱이 이 목록으로 계산합니다.
--   [2] admin_assign_sub_task (신규)
--       운영자가 협력사 작업에 그 협력사 소속 기사를 지정·해제.
--       (협력사 관리자용 sub_assign_task 와 같은 규칙. 처리 이력에 남습니다.)
--
-- 기존 함수는 바꾸지 않습니다 (sub_list_staff, sub_assign_task 그대로).
-- 기존 데이터 영향 없음 (함수 2개 추가).
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 작업 기준 기사 목록
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_staff_for_task(p_actor uuid, p_token text, p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub      uuid;
  v_role     text;
  v_admin    boolean;
  v_task     tasks%ROWTYPE;
  v_today    date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_day      date;
  v_district text;
  v_addr     text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_admin := _caller_is_admin(p_actor);
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND OR v_task.subcontractor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF NOT v_admin THEN
    IF v_sub IS NULL OR v_role <> 'manager' OR v_task.subcontractor_id IS DISTINCT FROM v_sub THEN
      -- 다른 곳의 작업은 "있는지 없는지"도 알려 주지 않음
      RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
    END IF;
  END IF;
  v_sub := v_task.subcontractor_id;

  v_day      := COALESCE((v_task.scheduled_at AT TIME ZONE 'Asia/Seoul')::date, v_task.requested_date, v_today);
  v_district := NULLIF(btrim(COALESCE(v_task.district, '')), '');
  v_addr     := COALESCE(v_task.address, '');

  RETURN jsonb_build_object(
    'ok', true,
    'task', jsonb_build_object('id', v_task.id, 'district', v_district, 'day', v_day, 'today', v_today,
                               'assigned_engineer_id', v_task.assigned_engineer_id),
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', u.id, 'code', u.code, 'name', u.name, 'phone', u.phone, 'sub_role', u.sub_role,
               'region', u.region,
               'zones', COALESCE((SELECT jsonb_agg(z.district ORDER BY z.district)
                                    FROM engineer_zones z
                                   WHERE z.user_id = u.id AND COALESCE(z.active, true)), '[]'::jsonb),
               -- 작업 지역이 담당 지역에 들어가는지 (구 이름 끝 일치 또는 주소에 포함)
               'zone_match', EXISTS (
                   SELECT 1 FROM engineer_zones z
                    WHERE z.user_id = u.id AND COALESCE(z.active, true)
                      AND btrim(z.district) <> ''
                      AND (   (v_district IS NOT NULL AND v_district LIKE '%' || btrim(z.district))
                           OR position(btrim(z.district) IN v_addr) > 0)),
               'today_tasks', (SELECT COUNT(*) FROM tasks t
                                WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                                  AND t.status <> '취소'
                                  AND COALESCE((t.scheduled_at AT TIME ZONE 'Asia/Seoul')::date, t.requested_date) = v_today),
               'day_tasks', (SELECT COUNT(*) FROM tasks t
                              WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                                AND t.status <> '취소' AND t.id <> v_task.id
                                AND COALESCE((t.scheduled_at AT TIME ZONE 'Asia/Seoul')::date, t.requested_date) = v_day),
               'in_progress', (SELECT COUNT(*) FROM tasks t
                                WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                                  AND t.status = '진행중'),
               'next_at', (SELECT MIN(t.scheduled_at) FROM tasks t
                            WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                              AND t.status NOT IN ('완료', '취소', 'visit_only', '정산완료')
                              AND t.scheduled_at >= now()),
               -- 작업일 휴무: 종일(시작 시각 없음)이면 off = true, 시간 휴무는 글자로만 표시
               'off', EXISTS (SELECT 1 FROM user_off_days o
                               WHERE o.user_id = u.id AND o.off_date = v_day AND o.start_time IS NULL),
               'off_part', (SELECT string_agg(to_char(o.start_time, 'HH24:MI') || '~' || COALESCE(to_char(o.end_time, 'HH24:MI'), ''), ', '
                                              ORDER BY o.start_time)
                              FROM user_off_days o
                             WHERE o.user_id = u.id AND o.off_date = v_day AND o.start_time IS NOT NULL)
             ) ORDER BY u.name)
        FROM users u
       WHERE u.subcontractor_id = v_sub
         AND u.is_active = true
    ), '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION sub_list_staff_for_task(uuid, text, uuid) TO anon, authenticated;

-- ============================================================
-- [2] 운영자: 협력사 작업에 그 협력사 기사 지정·해제
-- ============================================================
CREATE OR REPLACE FUNCTION admin_assign_sub_task(
  p_actor uuid, p_token text, p_task_id uuid, p_engineer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task        tasks%ROWTYPE;
  v_before_name text;
  v_after_name  text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.subcontractor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 작업이 아닙니다.');
  END IF;
  IF v_task.status IN ('완료', '취소', 'visit_only', '정산완료', '취소요청') THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 상태의 작업은 배정을 바꿀 수 없습니다.');
  END IF;
  IF v_task.status = '진행중' THEN
    RETURN jsonb_build_object('ok', false, 'error', '진행 중인 작업은 배정을 바꿀 수 없습니다.');
  END IF;

  SELECT name INTO v_before_name FROM users WHERE id = v_task.assigned_engineer_id;

  IF p_engineer_id IS NULL THEN
    UPDATE tasks SET assigned_engineer_id = NULL, status = '미배정', updated_at = now()
     WHERE id = p_task_id;
  ELSE
    SELECT name INTO v_after_name FROM users
     WHERE id = p_engineer_id AND subcontractor_id = v_task.subcontractor_id AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', '그 협력사 소속 직원에게만 배정할 수 있습니다.');
    END IF;
    UPDATE tasks SET
      assigned_engineer_id = p_engineer_id,
      status               = CASE WHEN status = '미배정' THEN '배정' ELSE status END,
      updated_at           = now()
    WHERE id = p_task_id;
  END IF;

  PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'admin',
    CASE WHEN p_engineer_id IS NULL THEN '배정 해제' || COALESCE(' (' || v_before_name || ')', '')
         ELSE '담당 기사 배정: ' || COALESCE(v_after_name, '') END,
    jsonb_build_object('engineer', v_before_name),
    jsonb_build_object('engineer', v_after_name));

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'engineer_id', p_engineer_id);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_assign_sub_task(uuid, text, uuid, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 2개 - 기대: 2행
SELECT proname FROM pg_proc
 WHERE proname IN ('sub_list_staff_for_task', 'admin_assign_sub_task') ORDER BY 1;

-- 2) 세션 없이 호출하면 거부 - 기대: {"ok": false, "error": "다시 로그인해 주세요."}
SELECT sub_list_staff_for_task(NULL, NULL, NULL);
