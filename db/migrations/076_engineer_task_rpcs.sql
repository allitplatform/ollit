-- ============================================================================
-- Migration 076 — 기사 PWA 전용 RPC (일정 변경 / 취소 요청)
-- 작성: 2026-05-25
-- 상태: 초안 (사장님 검토 + SQL Editor 적용 대기)
-- ============================================================================
-- 배경:
--   기사 PWA(EngineerApp) 가 anon 키로 호출 → JWT 측 auth.uid()=NULL →
--   tasks RLS (tasks_engineer_update USING current_user_has_role('engineer')
--   AND assigned_engineer_id = auth.uid()) 측 모두 통과 X → 0 행 매칭.
--   updateTaskDb 측 .maybeSingle() 측 data=null/error=null → 어댑터 ok=true
--   반환 → 핸들러 성공 인식. 실제 DB 무변경 → 다음 fetch 시 화면 되돌아감.
--
-- 사장님 보고: '일정 변경' / '작업 취소 요청' 둘 다 저장 안 되고 화면 되돌아감.
-- 진단: RLS 통과 X + maybeSingle 0행 가드 없음. 074 취소 RPC 와 동일 패턴
--   (anon 키 + p_actor 명시 전달 + SECURITY DEFINER) 으로 해결.
--
-- 내용:
--   [1] reschedule_engineer_task(p_task_id uuid, p_scheduled_at timestamptz, p_actor uuid)
--       · 기사가 자기 배정 task 의 scheduled_at 변경.
--       · 종착 상태(완료/취소/visit_only) 거부.
--   [2] request_engineer_cancel(p_task_id uuid, p_reason text, p_actor uuid)
--       · 기사가 자기 배정 task 측 status='취소요청' 마킹 + category_data 측 사유 저장.
--       · category_data 필드명 측 옛 requestCancelAdapter 본문 측 동일
--         (cancelReason / previousStatus / cancelRequestedAt) — AdminApp 의
--         V14AdminModal 승인 화면이 그대로 읽도록 호환 유지.
--
-- 공통:
--   · SECURITY DEFINER + SET search_path = public.
--   · p_actor 측 user_roles role='engineer' 또는 tasks.assigned_engineer_id 일치 검사.
--   · 본 라운드 spec — 권한 가드 = p_actor = task.assigned_engineer_id 직접 비교
--     (기사 본인 외 호출 거부). engineer 역할 별도 검사 X — 운영 단순화.
--   · GRANT EXECUTE TO anon, authenticated — PWA anon 키 호출 필수.
--
-- 회귀 방지:
--   · 옛 어댑터 (updateTaskAdapter / requestCancelAdapter) 그대로 유지 — 본 RPC 가
--     호출되지 않은 화면은 옛 흐름 그대로.
--   · category_data 필드명 옛 spec 그대로 — V14AdminModal handleApproveCancel /
--     handleRejectCancel 이 cancelReason / previousStatus 그대로 사용 가능.
--   · scheduled_at 만 변경 — endTime / rescheduleReason / rescheduledAt 등 옛
--     handleReschedule payload 의 다른 필드는 본 RPC 미사용 (DB 컬럼 X — 옛에도 무시됐음).
--
-- 실행: 사장님 OK 후 Supabase SQL Editor → 통째 붙여넣기 → Run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- [1] reschedule_engineer_task — 기사 자기 배정 task 일정 변경
-- ============================================================================
CREATE OR REPLACE FUNCTION reschedule_engineer_task(
  p_task_id      uuid,
  p_scheduled_at timestamptz,
  p_actor        uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
BEGIN
  IF p_actor        IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요'); END IF;
  IF p_task_id      IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락'); END IF;
  IF p_scheduled_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '일정 시각 누락'); END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;

  -- 권한 — 자기 배정 task 만
  IF v_task.assigned_engineer_id IS NULL OR v_task.assigned_engineer_id <> p_actor THEN
    RAISE EXCEPTION '권한 없음 — 자기 배정 task 만 일정 변경 가능';
  END IF;

  -- 종착 상태 거부
  IF v_task.status IN ('완료', '취소', 'visit_only') THEN
    RETURN jsonb_build_object('ok', false, 'error', '종착 상태(완료/취소/visit_only) 작업은 일정 변경 불가');
  END IF;

  UPDATE tasks SET
    scheduled_at = p_scheduled_at,
    updated_at   = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'scheduled_at', p_scheduled_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reschedule_engineer_task(uuid, timestamptz, uuid) TO anon, authenticated;

-- ============================================================================
-- [2] request_engineer_cancel — 기사 측 취소 요청 (status='취소요청')
-- ============================================================================
-- ⚠️ category_data 필드명 옛 requestCancelAdapter(src/data/tasksDb.js:856) 와 동일:
--    · cancelReason
--    · previousStatus
--    · cancelRequestedAt
-- AdminApp V14AdminModal handleApproveCancel/handleRejectCancel 이 위 키 그대로 읽으므로
-- 다른 이름 쓰지 말 것.
CREATE OR REPLACE FUNCTION request_engineer_cancel(
  p_task_id uuid,
  p_reason  text,
  p_actor   uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_reason_clean text;
BEGIN
  IF p_actor   IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요'); END IF;
  IF p_task_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락'); END IF;

  v_reason_clean := COALESCE(TRIM(p_reason), '');
  IF v_reason_clean = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;

  -- 권한 — 자기 배정 task 만
  IF v_task.assigned_engineer_id IS NULL OR v_task.assigned_engineer_id <> p_actor THEN
    RAISE EXCEPTION '권한 없음 — 자기 배정 task 만 취소 요청 가능';
  END IF;

  -- 상태 분기
  IF v_task.status = '취소' THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 취소된 작업입니다');
  END IF;
  IF v_task.status IN ('완료', 'visit_only') THEN
    RETURN jsonb_build_object('ok', false, 'error', '종착 상태(완료/visit_only) 작업은 취소 요청 불가');
  END IF;
  IF v_task.status = '취소요청' THEN
    RETURN jsonb_build_object('ok', true, 'note', '이미 취소요청 상태입니다', 'task_id', p_task_id);
  END IF;

  -- category_data 머지 (옛 requestCancelAdapter 와 동일 키)
  UPDATE tasks SET
    status = '취소요청',
    category_data = COALESCE(category_data, '{}'::jsonb) || jsonb_build_object(
      'cancelReason',      v_reason_clean,
      'previousStatus',    v_task.status,
      'cancelRequestedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    updated_at = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'previous_status', v_task.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION request_engineer_cancel(uuid, text, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 SQL (적용 후 별도 실행)
-- ============================================================================
--
-- A. RPC 2개 등록 + GRANT 확인
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args,
--        prosecdef AS sec_def,
--        has_function_privilege('anon', oid, 'EXECUTE')         AS anon_exec,
--        has_function_privilege('authenticated', oid, 'EXECUTE') AS auth_exec
-- FROM pg_proc
-- WHERE proname IN ('reschedule_engineer_task', 'request_engineer_cancel')
-- ORDER BY proname;
-- 기대: 2 row / sec_def=true / anon_exec=true / auth_exec=true.
--
-- B. 시뮬 — 김동효(E005, id=77777777-7777-7777-7777-7777777e0005) 자기 배정 task
--   김복주 YS-260520-016 (id=7aa8001c-...) 측 일정 변경 시뮬.
--
-- BEGIN;
--
-- -- 사전
-- SELECT 'BEFORE' AS phase, status, scheduled_at, category_data
-- FROM tasks WHERE id='7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid;
--
-- -- 일정 변경
-- SELECT reschedule_engineer_task(
--   '7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid,
--   '2026-05-30T05:00:00+00:00'::timestamptz,    -- KST 14:00
--   '77777777-7777-7777-7777-7777777e0005'::uuid -- E005 김동효
-- ) AS result;
-- 기대: { ok: true, scheduled_at: ... }
--
-- SELECT '(가) after reschedule' AS phase, scheduled_at FROM tasks
-- WHERE id='7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid;
-- 기대: 새 시각 반영.
--
-- ROLLBACK;
--
-- C. 시뮬 — 취소 요청
-- BEGIN;
--
-- SELECT request_engineer_cancel(
--   '7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid,
--   '시뮬 — 기사 측 일정 충돌',
--   '77777777-7777-7777-7777-7777777e0005'::uuid
-- ) AS result;
-- 기대: { ok: true, previous_status: '완료' 또는 직전 status }
--
-- SELECT '(나) after request_cancel' AS phase, status,
--        category_data->>'cancelReason'      AS reason,
--        category_data->>'previousStatus'    AS prev_status,
--        category_data->>'cancelRequestedAt' AS req_at
-- FROM tasks WHERE id='7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid;
-- 기대: status='취소요청' / category_data 측 3개 키 모두 채워짐.
--
-- ROLLBACK;
--
-- D. 권한 거부 시뮬 — 다른 기사가 호출
-- SELECT reschedule_engineer_task(
--   '7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid,
--   '2026-05-30T05:00:00+00:00'::timestamptz,
--   '00000000-0000-0000-0000-000000000000'::uuid  -- 다른 user
-- );
-- 기대: RAISE EXCEPTION '권한 없음 — 자기 배정 task 만 일정 변경 가능'.
--
-- E. p_actor=NULL 가드
-- SELECT reschedule_engineer_task('7aa8001c-...'::uuid, now(), NULL);
-- 기대: { ok: false, error: '미로그인 — actor 필요' }.
--
-- ============================================================================
-- 롤백
-- ============================================================================
-- BEGIN;
--   DROP FUNCTION IF EXISTS request_engineer_cancel(uuid, text, uuid);
--   DROP FUNCTION IF EXISTS reschedule_engineer_task(uuid, timestamptz, uuid);
-- COMMIT;
