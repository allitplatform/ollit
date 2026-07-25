-- Migration 192 - clear reassign request flag (2026-07-25)
--
-- PROBLEM
--   tasks.category_data->'reassignRequest' is the flag that keeps a task
--   inside the admin "재배정 요청" list. Mig 145 admin_reassign_task updates
--   assigned_engineer_id / scheduled_at only, so the flag survives every
--   timeline reassignment. The client-side clear was a read-modify-write
--   (read category_data, spread, write back) which could overwrite a
--   concurrent quote/consent edit and failed silently.
--
-- FIX
--   One server-side UPDATE using the jsonb minus operator, so every other
--   key inside category_data is preserved and no read-modify-write race
--   exists. Admin gated, same as the other admin RPCs.
--
-- CALLED FROM
--   src/lib/adminTaskRpc.js      clearReassignRequest(taskId)
--   src/data/tasksDb.js          _clearReassignRequest (engineer assign path)
--   src/pages/AdminPcTimelineScreen.jsx  after a successful adminReassignTask
--
-- RETURNS
--   { ok: true,  task_id, cleared: true|false }
--   { ok: false, error: '...' }

CREATE OR REPLACE FUNCTION clear_reassign_request(
  p_task_id uuid,
  p_actor   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_had boolean;
BEGIN
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '권한 없음');
  END IF;

  IF p_task_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_id 없음');
  END IF;

  SELECT (category_data ? 'reassignRequest')
    INTO v_had
    FROM tasks
   WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  IF COALESCE(v_had, false) THEN
    UPDATE tasks
       SET category_data = COALESCE(category_data, '{}'::jsonb) - 'reassignRequest',
           updated_at    = now()
     WHERE id = p_task_id;
  END IF;

  RETURN jsonb_build_object(
    'ok',      true,
    'task_id', p_task_id,
    'cleared', COALESCE(v_had, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION clear_reassign_request(uuid, uuid) TO anon, authenticated;

-- VERIFY - expect: 함수있음 1 / 남은요청 = current pending reassign count
SELECT
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'clear_reassign_request') AS 함수있음,
  (SELECT COUNT(*) FROM tasks
    WHERE category_data ? 'reassignRequest'
      AND status <> '취소')                                               AS 남은요청;
