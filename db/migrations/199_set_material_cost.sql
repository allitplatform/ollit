-- ============================================================================
-- Migration 199 - set_material_cost RPC (2026-07-28)
--
-- WHY: tasks direct UPDATE is blocked by RLS for engineers (same reason
--   Mig 194 needed engineer_update_address). The engineer types the parts
--   cost on the completion screen, so it needs an RPC.
--
-- GATE: the assigned engineer of the task, or admin/operator.
-- SIDE EFFECTS: recomputes payments immediately (so the engineer sees the
--   corrected 내 수익 on screen) and clears a stale compute_error.
-- RETURNS: { ok, material_cost, engineer_amount, owner_amount }
--
-- DEPLOY ORDER: run AFTER Mig 198 (needs tasks.material_cost), BEFORE the app push.
-- ============================================================================

CREATE OR REPLACE FUNCTION set_material_cost(
  p_task_id uuid,
  p_amount  int,
  p_actor   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_old  int;
  v_new  int;
  v_eng  int;
  v_own  int;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인 필요');
  END IF;
  IF p_task_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  IF v_task.assigned_engineer_id IS DISTINCT FROM p_actor
     AND NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '본인 배정 작업만 수정 가능');
  END IF;

  IF v_task.status = '정산완료' AND NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '정산 완료 건은 수정 불가');
  END IF;

  v_old := COALESCE(v_task.material_cost, 0);
  v_new := GREATEST(COALESCE(p_amount, 0), 0);

  UPDATE tasks
     SET material_cost = v_new,
         updated_at    = now()
   WHERE id = p_task_id;

  BEGIN
    PERFORM compute_payment(p_task_id);
    UPDATE payments SET compute_error = NULL
     WHERE task_id = p_task_id AND compute_error IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    -- keep the material cost saved even if the split cannot be computed yet
    NULL;
  END;

  SELECT engineer_amount, owner_amount INTO v_eng, v_own
  FROM payments WHERE task_id = p_task_id LIMIT 1;

  IF v_old IS DISTINCT FROM v_new THEN
    INSERT INTO task_changes (
      task_id, tenant_id, change_type, before_data, after_data, note, changed_by
    ) VALUES (
      p_task_id, v_task.tenant_id, 'status',
      jsonb_build_object('material_cost', v_old),
      jsonb_build_object('material_cost', v_new),
      '자재비 수정: ' || v_old::text || ' → ' || v_new::text,
      p_actor
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'material_cost', v_new,
    'engineer_amount', COALESCE(v_eng, 0),
    'owner_amount', COALESCE(v_own, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION set_material_cost(uuid, int, uuid) TO anon, authenticated;

-- VERIFY - expect 1
SELECT COUNT(*) AS 함수 FROM pg_proc WHERE proname = 'set_material_cost';
