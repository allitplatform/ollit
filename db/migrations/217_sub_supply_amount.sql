-- ============================================================================
-- Migration 217 - 묶음 3 최소분: 협력사 직원의 공급가액 입력 + 완료 차단
-- 작성 2026-10-06 · 선행: 211a, 212~215
--
-- 내용
--   [1] sub_staff_set_supply   협력사 직원이 완료 직전에 공급가액(부가세 제외)을 저장
--        · 본인에게 배정된 협력사 작업만 (운영자는 대리 입력 가능)
--        · 부가세 = 공급가 x 10% (원 단위 반올림), 합계 = 공급가 + 부가세
--        · tasks.supply_amount = 공급가, tasks.received_total = 합계
--          -> 기존 트리거(mig 083)가 추가금을 맞추고, 완료 문자·정산이 이 값을 씁니다.
--        · 접수 견적(tasks.product_price)은 건드리지 않습니다 (2026-10-06 사장님 결정).
--          실제 받은 금액은 supply_amount / received_total 에 따로 저장하고,
--          정산은 실제 금액 기준으로 합니다 (216c).
--        · 접수 견적은 부가세 제외 금액으로 입력합니다. 그래서 비교는
--          "공급가액 vs 견적" 입니다 (합계 아님). 공급가액이 견적보다 적으면
--          사유 입력 필수 -> tasks.supply_shortfall_reason
--   [2] 완료 차단 트리거        협력사 작업은 공급가액 없이 '완료' 가 될 수 없습니다.
--
-- 기존 데이터 영향: 없음. 직영·원청 작업은 두 기능 모두 대상이 아닙니다
--   (트리거는 subcontractor_id 가 있는 작업에만 작동).
-- ============================================================================

BEGIN;

-- 견적보다 적게 받은 사유 (협력사 직원 입력)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS supply_shortfall_reason text;
COMMENT ON COLUMN tasks.supply_shortfall_reason IS
  '협력사 작업: 실제 공급가액이 접수 견적(부가세 제외)보다 적을 때 직원이 입력한 사유.';

-- ============================================================
-- [1] 공급가액 저장
-- ============================================================
CREATE OR REPLACE FUNCTION sub_staff_set_supply(
  p_actor   uuid,
  p_token   text,
  p_task_id uuid,
  p_supply  int,
  p_reason  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task  tasks%ROWTYPE;
  v_vat   int;
  v_total int;
  v_short int;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF p_supply IS NULL OR p_supply <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '공급가액을 1원 이상으로 입력해 주세요.');
  END IF;
  IF p_supply > 100000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', '금액이 너무 큽니다. 다시 확인해 주세요.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.subcontractor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 작업을 찾지 못했습니다.');
  END IF;
  IF NOT (_caller_is_admin(p_actor) OR v_task.assigned_engineer_id = p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '본인에게 배정된 작업만 입력할 수 있습니다.');
  END IF;
  IF v_task.status IN ('취소', '취소요청') THEN
    RETURN jsonb_build_object('ok', false, 'error', '취소된 작업입니다.');
  END IF;
  -- 완료 후 수정은 운영자만 (수수료가 이미 계산된 뒤이므로)
  IF v_task.status = '완료' AND NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '완료된 작업의 금액은 올데이케어에 수정 요청해 주세요.');
  END IF;

  v_vat   := ROUND(p_supply * 0.1)::int;
  v_total := p_supply + v_vat;
  -- 견적은 부가세 제외 금액 -> 공급가액과 비교 (합계와 비교하지 않는다)
  v_short := GREATEST(COALESCE(v_task.product_price, 0) - p_supply, 0);

  -- 견적보다 적게 받았으면 사유 필수 (견적 금액 자체는 고치지 않는다)
  IF v_short > 0 AND COALESCE(TRIM(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '공급가액이 견적(부가세 제외)보다 적습니다. 사유를 입력해 주세요.',
                              'need_reason', true, 'quote', v_task.product_price, 'supply', p_supply, 'shortfall', v_short);
  END IF;

  UPDATE tasks SET
    supply_amount           = p_supply,
    received_total          = v_total,
    supply_shortfall_reason = CASE WHEN v_short > 0 THEN LEFT(TRIM(p_reason), 500) ELSE NULL END,
    extra_fee_at            = now(),
    updated_at              = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('ok', true, 'supply', p_supply, 'vat', v_vat, 'total', v_total, 'shortfall', v_short);
END;
$$;

GRANT EXECUTE ON FUNCTION sub_staff_set_supply(uuid, text, uuid, int, text) TO anon, authenticated;

-- ============================================================
-- [2] 협력사 작업은 공급가액 없이 완료 불가
-- ============================================================
CREATE OR REPLACE FUNCTION trg_tasks_sub_require_supply()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subcontractor_id IS NOT NULL
     AND NEW.status = '완료'
     AND OLD.status IS DISTINCT FROM '완료'
     AND COALESCE(NEW.supply_amount, 0) <= 0 THEN
    RAISE EXCEPTION '공급가액(부가세 제외)을 입력해야 완료할 수 있습니다.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_sub_require_supply ON tasks;
CREATE TRIGGER tasks_sub_require_supply
  BEFORE UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION trg_tasks_sub_require_supply();

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 세션 값 없이 호출 - 기대: {"ok": false, "error": "다시 로그인해 주세요."}
SELECT sub_staff_set_supply('00000000-0000-0000-0000-000000000000'::uuid, NULL,
                            '00000000-0000-0000-0000-000000000000'::uuid, 100000);

-- 2) 트리거 - 기대: 1행
SELECT tgname FROM pg_trigger WHERE tgname = 'tasks_sub_require_supply' AND NOT tgisinternal;
