-- ============================================================================
-- Migration 221 - 협력사 모드 작업 상세 조회를 RPC 로 이전 (sub_get_task_detail)
-- 작성 2026-10-06 · 선행: 211a, 212~214
--
-- 배경
--   협력사 관리자 화면의 작업 상세는 운영자 상세 화면을 재사용합니다. 지금까지는 그 화면이
--   작업 한 건을 브라우저에서 직접 읽었고, "자기 협력사 작업인지"는 앱이 확인했습니다.
--   이 함수로 옮기면 서버가 확인합니다: 호출자가 그 작업의 수행 협력사 관리자가 아니면
--   내용을 돌려주지 않습니다.
--
-- 반환 형태
--   앱의 작업 조회(tasks + 배정 기사 + 원청 + 정산 + 작업 항목)와 같은 모양의 한 건.
--   -> 앱은 기존 변환 코드(rowToTask)를 그대로 씁니다.
--
-- 이번에 옮기지 않은 것 (다음 단계)
--   상세 화면 안의 메모·사진 목록은 아직 브라우저에서 직접 읽습니다.
--
-- 기존 데이터 영향: 없음 (조회 함수 추가만).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION sub_get_task_detail(
  p_actor   uuid,
  p_token   text,
  p_task_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_task tasks%ROWTYPE;
  v_row  jsonb;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND OR v_task.subcontractor_id IS DISTINCT FROM v_sub THEN
    -- 다른 곳의 작업은 "있는지 없는지"도 알려 주지 않음
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;

  v_row := to_jsonb(v_task)
    || jsonb_build_object(
      'assigned_engineer', (
        SELECT jsonb_build_object('name', u.name, 'code', u.code, 'phone', u.phone)
          FROM users u WHERE u.id = v_task.assigned_engineer_id),
      'principal_rel', (
        SELECT jsonb_build_object('code', p.code, 'name', p.name)
          FROM principals p WHERE p.id = v_task.principal_id),
      'payment', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'calc_method', p.calc_method, 'policy_key', p.policy_key,
                 'engineer_amount', p.engineer_amount, 'principal_amount', p.principal_amount,
                 'owner_amount', p.owner_amount, 'is_balanced', p.is_balanced,
                 'status', p.status, 'computed_at', p.computed_at, 'track', p.track,
                 'compute_error', p.compute_error,
                 'engineer_remitted_at', p.engineer_remitted_at,
                 'engineer_remit_confirmed_at', p.engineer_remit_confirmed_at,
                 'engineer_remit_confirmed_by', p.engineer_remit_confirmed_by,
                 'usol_remitted_at', NULL) ORDER BY p.computed_at DESC)
          FROM payments p WHERE p.task_id = v_task.id), '[]'::jsonb),
      'task_items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', ti.id, 'qty', ti.qty, 'unit_price', ti.unit_price, 'subtotal', ti.subtotal,
                 'order_type', ti.order_type, 'product_order_id', ti.product_order_id,
                 'is_canceled', ti.is_canceled, 'canceled_reason', ti.canceled_reason, 'canceled_at', ti.canceled_at,
                 'received_amount', ti.received_amount,
                 'work_types', CASE WHEN wt.id IS NULL THEN NULL ELSE jsonb_build_object(
                     'id', wt.id, 'name', wt.name,
                     'service_types', CASE WHEN st.id IS NULL THEN NULL
                                           ELSE jsonb_build_object('id', st.id, 'code', st.code) END) END,
                 'appliance_types', CASE WHEN at.id IS NULL THEN NULL
                                         ELSE jsonb_build_object('id', at.id, 'name', at.name) END))
          FROM task_items ti
          LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
          LEFT JOIN service_types st   ON st.id = wt.service_type_id
          LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
         WHERE ti.task_id = v_task.id), '[]'::jsonb)
    );

  RETURN jsonb_build_object('ok', true, 'task', v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION sub_get_task_detail(uuid, text, uuid) TO anon, authenticated;

COMMIT;

-- 검증: 세션 없이 호출 - 기대: {"ok": false, "error": "다시 로그인해 주세요."}
SELECT sub_get_task_detail('00000000-0000-0000-0000-000000000000'::uuid, NULL,
                           '00000000-0000-0000-0000-000000000000'::uuid);
