-- ============================================================================
-- Migration 263 - 협력사 완료 금액을 항목 줄에도 저장 + 합계만 저장된 작업의 합계 보호
-- 작성 2026-10-08 · 선행: 084, 223
--
-- 사장님 제보 (블록 76): 협력사 완료 작업의 운영자 상세에서 합계는 500,000 인데
--   항목 줄 "실제 받은 돈" 칸이 비어 있음.
--
-- 원인
--   협력사 기사의 "받은 금액" 저장(sub_staff_set_received, mig 223)이 tasks.received_total 만 쓰고
--   task_items.received_amount 는 비워 둔다. 운영자 상세의 항목 줄은 항목 값만 본다.
--
-- 바꾼 것
--   [1] sub_staff_set_received = mig 223 본문 + 조각 1곳 (항목 줄에도 받은 돈 저장).
--       취소되지 않은 항목이 1개면 받은 금액 전체를 그 줄에.
--       여러 개면 견적(수량 x 단가) 비율로 나누고(원 미만 버림) 견적이 가장 큰 줄에 나머지 -> 항목 합 = 받은 금액.
--       협력사 기사 화면은 금액을 1칸만 입력하므로(mig 223 결정) 항목별 입력이 없어 비율로 나눈다.
--       방문출장 전환(visit_only) 작업의 항목은 건드리지 않는다.
--   [2] trg_task_items_sync_received_total = mig 084 본문 + 조각 1곳 (합계 보호).
--       협력사 작업이고, 사람이 받은 금액을 이미 입력했고(공급가 > 0), 취소되지 않은 항목 중 받은 돈이 적힌 줄이 하나도 없으면
--       항목 변경(수량 · 단가 · 취소)이 있어도 합계를 견적 합으로 덮어쓰지 않는다.
--       (전에는 이런 작업의 항목을 고치면 합계가 500,000 -> 289,000 처럼 견적 합으로 바뀔 수 있었다)
--       항목 줄에 받은 돈이 하나라도 적혀 있으면 전처럼 항목 합을 따라간다.
--
-- 정산 함수(compute_payment)는 바꾸지 않습니다. 협력사 분기는 합계(received_total)와 공급가(supply_amount)만 읽습니다.
--
-- 기존 데이터 영향 없음 (이미 완료된 작업의 빈 줄은 db/ops/backfill_item_received.sql 로 따로 채움).
-- 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 받은 금액 저장 (협력사 직원 - 완료 직전 "받은 돈" 단계)
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

  -- Mig 263: 항목 줄에도 받은 돈을 적는다 (취소되지 않은 항목 전부, 합 = 받은 금액).
  --   1개면 전액. 여러 개면 견적 비율(원 미만 버림), 견적이 가장 큰 줄이 나머지를 받는다.
  IF v_task.status IS DISTINCT FROM 'visit_only' THEN
    WITH live AS (
      SELECT ti.id,
             COALESCE(ti.subtotal, 0)                                    AS sub,
             row_number() OVER (ORDER BY COALESCE(ti.subtotal, 0), ti.id) AS rn,
             count(*)     OVER ()                                         AS n,
             SUM(COALESCE(ti.subtotal, 0)) OVER ()                        AS tot
        FROM task_items ti
       WHERE ti.task_id = p_task_id
         AND NOT COALESCE(ti.is_canceled, false)
    ), share AS (
      SELECT id, rn, n,
             CASE WHEN tot > 0 THEN FLOOR(p_received::numeric * sub / tot)::int ELSE 0 END AS amt
        FROM live
    ), fin AS (
      SELECT id,
             CASE WHEN rn = n
                  THEN p_received - COALESCE(SUM(amt) OVER (ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)::int
                  ELSE amt END AS amt
        FROM share
    )
    UPDATE task_items ti
       SET received_amount = fin.amt
      FROM fin
     WHERE ti.id = fin.id
       AND ti.received_amount IS DISTINCT FROM fin.amt;
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
-- [2] 항목 -> 합계 따라가기: 합계만 저장된 협력사 작업은 덮어쓰지 않는다
-- ============================================================
CREATE OR REPLACE FUNCTION trg_task_items_sync_received_total()
RETURNS TRIGGER AS $$
DECLARE
  v_task_id        uuid;
  v_principal_code text;
  v_payment_method text;
  v_product_price  integer;
  v_new_received   integer;
  v_sub_id         uuid;
  v_supply         integer;
BEGIN
  -- INSERT/UPDATE → NEW.task_id, DELETE → OLD.task_id
  v_task_id := COALESCE(NEW.task_id, OLD.task_id);
  IF v_task_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 가드 + product_price 동시 조회 (1 query)
  SELECT p.code, t.payment_method, t.product_price, t.subcontractor_id, t.supply_amount
    INTO v_principal_code, v_payment_method, v_product_price, v_sub_id, v_supply
    FROM public.tasks t
    LEFT JOIN public.principals p ON p.id = t.principal_id
   WHERE t.id = v_task_id;

  -- 가드: usol_n 또는 선결제 → sync 안 함 (옛 흐름 유지)
  IF v_principal_code = 'usol_n' OR v_payment_method = 'prepaid' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Mig 263: 협력사 작업 · 받은 금액을 이미 입력함(공급가 > 0) · 항목 줄에는 받은 돈이 하나도 없음
  --   → 사람이 입력한 합계를 견적 합으로 덮어쓰지 않는다.
  IF v_sub_id IS NOT NULL AND COALESCE(v_supply, 0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.task_items
        WHERE task_id = v_task_id
          AND NOT COALESCE(is_canceled, false)
          AND received_amount IS NOT NULL) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 새 received_total = SUM(COALESCE(received_amount, subtotal, 0)) WHERE NOT is_canceled
  --   NULL fallback 측 subtotal 사용 (옛 흐름 호환).
  SELECT COALESCE(SUM(COALESCE(received_amount, subtotal, 0)), 0)
    INTO v_new_received
    FROM public.task_items
   WHERE task_id = v_task_id
     AND NOT COALESCE(is_canceled, false);

  -- tasks.received_total + extra_fee 자동 sync.
  --   extra_fee 공식 Phase B 083 BEFORE 트리거 (trg_tasks_sync_extra_fee) 와 동일 →
  --   BEFORE 트리거가 한 번 더 발화해도 idempotent (안전망).
  UPDATE public.tasks
     SET received_total = v_new_received,
         extra_fee      = GREATEST(v_new_received - COALESCE(v_product_price, 0), 0)
   WHERE id = v_task_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT sub_staff_set_received('00000000-0000-0000-0000-000000000000'::uuid, NULL,
                              '00000000-0000-0000-0000-000000000000'::uuid, 220000, true, NULL);

-- 2) 두 함수에 이번 조각이 들어갔는지 - 기대: 두 줄 모두 true
SELECT p.proname AS "함수", (pg_get_functiondef(p.oid) LIKE '%Mig 263%') AS "263 적용"
  FROM pg_proc p
 WHERE p.proname IN ('sub_staff_set_received', 'trg_task_items_sync_received_total')
 ORDER BY 1;
