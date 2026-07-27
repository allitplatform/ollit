-- Migration 194 - engineer address edit (2026-07-27)
--
-- WHY: homepage customers often type inaccurate addresses. The engineer
--   learns the real address on the phone but could not fix it in the app
--   (tasks direct UPDATE is blocked by RLS for engineers - RPC required).
--
-- GATE: only the assigned engineer of the task (or admin/operator).
-- ALSO: updates district (client passes it, parsed from the new address)
--   and writes a task_changes audit row.
--
-- DEPLOY ORDER: run this SQL FIRST, then push the app (app calls this RPC).

CREATE OR REPLACE FUNCTION engineer_update_address(
  p_task_id  uuid,
  p_address  text,
  p_district text,
  p_actor    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_old  text;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인 필요');
  END IF;
  IF p_task_id IS NULL OR p_address IS NULL OR btrim(p_address) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '주소 없음');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  IF v_task.assigned_engineer_id IS DISTINCT FROM p_actor
     AND NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '본인 배정 작업만 수정 가능');
  END IF;

  v_old := COALESCE(v_task.address, '');

  UPDATE tasks
     SET address    = btrim(p_address),
         district   = COALESCE(NULLIF(btrim(p_district), ''), district),
         updated_at = now()
   WHERE id = p_task_id;

  INSERT INTO task_changes (
    task_id, tenant_id, change_type, before_data, after_data, note, changed_by
  ) VALUES (
    p_task_id, v_task.tenant_id, 'status',
    jsonb_build_object('address', v_old),
    jsonb_build_object('address', btrim(p_address), 'district', btrim(p_district)),
    '주소 수정: ' || v_old || ' → ' || btrim(p_address),
    p_actor
  );

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id);
END;
$$;

GRANT EXECUTE ON FUNCTION engineer_update_address(uuid, text, text, uuid) TO anon, authenticated;

-- VERIFY - expect 1
SELECT COUNT(*) AS 함수 FROM pg_proc WHERE proname = 'engineer_update_address';
