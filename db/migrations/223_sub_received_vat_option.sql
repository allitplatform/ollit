-- ============================================================================
-- Migration 223 - 협력사 완료 금액: "받은 금액" 1번 입력 + 부가세 포함 여부 선택
-- 작성 2026-10-06 · 선행: 211a, 212~217
--
-- 사장님 결정 (2026-10-06)
--   · 금액은 한 번만 입력합니다 = 기존 "받은 돈" 단계. 별도 공급가액 화면은 없앱니다.
--   · "부가세 포함해서 받음" 체크 (기본 꺼짐)
--       꺼짐: 공급가 = 받은 금액
--       켜짐: 공급가 = 받은 금액 / 1.1 (원 단위 반올림)
--   · 수수료 = 공급가 x 35% (규칙표 그대로). 견적(부가세 제외) 비교·사유도 공급가 기준 그대로.
--   · DB 에는 받은 금액 / 부가세 포함 여부 / 공급가를 모두 저장합니다.
--
-- 내용
--   [1] tasks.vat_included          부가세 포함 여부 (기본 false)
--   [2] sub_staff_set_received      받은 금액 + 부가세 포함 여부 (+ 사유) 저장
--   [3] sub_staff_set_supply (교체) 옛 앱 버전 호환용 - 보낸 값을 "받은 금액, 부가세 미포함" 으로 처리
--
-- 정산 함수(216c)는 바꾸지 않습니다. 216c 는 이미
--   합계 = tasks.received_total(받은 금액), 수수료 기준 = tasks.supply_amount(공급가)
-- 로 계산하므로 이 파일의 저장 방식과 그대로 맞습니다.
--
-- 기존 데이터 영향: 새 칸은 false 로 시작. 직영·원청 작업은 대상이 아닙니다.
-- ============================================================================

BEGIN;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS vat_included boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN tasks.vat_included IS
  '협력사 작업: 받은 금액(received_total)에 부가세가 포함돼 있는지. true 면 공급가 = 받은 금액 / 1.1.';

-- ============================================================
-- [2] 받은 금액 저장 (협력사 직원 - 완료 직전 "받은 돈" 단계)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_staff_set_received(
  p_actor        uuid,
  p_token        text,
  p_task_id      uuid,
  p_received     int,
  p_vat_included boolean DEFAULT false,
  p_reason       text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task   tasks%ROWTYPE;
  v_supply int;
  v_vat    int;
  v_short  int;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF p_received IS NULL OR p_received <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '받은 금액을 1원 이상으로 입력해 주세요.');
  END IF;
  IF p_received > 100000000 THEN
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
  IF v_task.status = '완료' AND NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '완료된 작업의 금액은 올데이케어에 수정 요청해 주세요.');
  END IF;

  -- 공급가: 부가세 포함이면 받은 금액 / 1.1 (원 단위 반올림), 아니면 받은 금액 그대로
  v_supply := CASE WHEN COALESCE(p_vat_included, false) THEN ROUND(p_received / 1.1)::int ELSE p_received END;
  v_vat    := p_received - v_supply;
  -- 견적은 부가세 제외 금액 -> 공급가와 비교
  v_short  := GREATEST(COALESCE(v_task.product_price, 0) - v_supply, 0);

  IF v_short > 0 AND COALESCE(TRIM(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '공급가가 견적(부가세 제외)보다 적습니다. 사유를 입력해 주세요.',
                              'need_reason', true, 'quote', v_task.product_price, 'supply', v_supply, 'shortfall', v_short);
  END IF;

  UPDATE tasks SET
    received_total          = p_received,
    vat_included            = COALESCE(p_vat_included, false),
    supply_amount           = v_supply,
    supply_shortfall_reason = CASE WHEN v_short > 0 THEN LEFT(TRIM(p_reason), 500) ELSE NULL END,
    extra_fee_at            = now(),
    updated_at              = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('ok', true, 'received', p_received, 'vat_included', COALESCE(p_vat_included, false),
                            'supply', v_supply, 'vat', v_vat, 'shortfall', v_short);
END;
$$;

GRANT EXECUTE ON FUNCTION sub_staff_set_received(uuid, text, uuid, int, boolean, text) TO anon, authenticated;

-- ============================================================
-- [3] 옛 앱 버전 호환 - sub_staff_set_supply 는 "받은 금액, 부가세 미포함" 으로 넘긴다
--     (옛 화면은 공급가에 부가세를 더해 합계로 저장했지만, 새 결정에 맞춰 통일)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_staff_set_supply(
  p_actor   uuid,
  p_token   text,
  p_task_id uuid,
  p_supply  int,
  p_reason  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sub_staff_set_received(p_actor, p_token, p_task_id, p_supply, false, p_reason);
$$;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT sub_staff_set_received('00000000-0000-0000-0000-000000000000'::uuid, NULL,
                              '00000000-0000-0000-0000-000000000000'::uuid, 220000, true, NULL);

-- 2) 칸 확인 - 기대: 1행 (boolean, 기본 false)
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name = 'tasks' AND column_name = 'vat_included';
