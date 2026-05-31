-- ============================================================
-- Migration 087 — compute_engineer_amount_per_item override 파라미터
-- 2026-05-31
--
-- 목적: 부분 완료 미리보기가 "저장 전" 상태(취소/받은 돈 미반영)에서도
--   정확한 기사 수익을 표시하도록, 함수에 override jsonb 파라미터 추가.
--
-- override 형태:
--   [{"task_item_id":"uuid","is_canceled":true,"qty":0},
--    {"task_item_id":"uuid","received_amount":180000}]
--
-- ⚠️ override는 4곳 모두 반영: ①Phase C detect ②total_qty ③LOOP 필터 ④LOOP 내부
-- DEFAULT '[]' 이므로 기존 1-파라미터 호출 동작 동일 (회귀 0).
-- ⚠️ 옛 1-파라미터 함수 DROP 필수 (안 하면 ambiguous).
-- ============================================================

DROP FUNCTION IF EXISTS public.compute_engineer_amount_per_item(uuid);

CREATE OR REPLACE FUNCTION public.compute_engineer_amount_per_item(
  p_task_id   uuid,
  p_overrides jsonb DEFAULT '[]'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task              tasks%ROWTYPE;
  v_principal_code    text;
  v_total_qty         int;
  v_fallback_unit     int;
  v_item              RECORD;
  v_qty               int;
  v_unit_price        int;
  v_service_code      text;
  v_appliance_code    text;
  v_calc_result       jsonb;
  v_calc_method       text;
  v_is_ratio          boolean;
  v_eng               int;
  v_prin              int;
  v_mult              int;
  v_item_extra        int;
  v_extra_applied     boolean := false;
  v_cleaning_extra_applied   boolean := false;
  v_cleaning_engineer_bonus  int := 0;
  v_first_item_applied       boolean := false;
  v_first_cleaning_item      boolean := true;
  v_engineer_rate            int;
  v_total_calc               int;
  v_eng_for_item             int;
  v_result                   jsonb := '[]'::jsonb;
  v_use_phase_c       boolean := false;
  v_row_subtotal      int;
  v_row_received      int;
  v_row_extra         int;
  v_ov                jsonb;
  v_ov_qty            int;
  v_ov_received       int;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 조회 실패 — 작업 없음: %', p_task_id;
  END IF;

  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 조회 실패 — principal_id=%', v_task.principal_id;
  END IF;

  -- ② total_qty — override is_canceled / qty 반영
  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE((ov.obj ->> 'is_canceled')::boolean, false) THEN 0
      WHEN ov.obj ? 'qty' THEN GREATEST((ov.obj ->> 'qty')::int, 0)
      ELSE ti.qty
    END
  ), 0)::int INTO v_total_qty
  FROM task_items ti
  LEFT JOIN LATERAL (
    SELECT o AS obj FROM jsonb_array_elements(p_overrides) o
    WHERE o ->> 'task_item_id' = ti.id::text LIMIT 1
  ) ov ON true
  WHERE ti.task_id = p_task_id
    AND NOT (COALESCE(ti.is_canceled, false)
             OR COALESCE((ov.obj ->> 'is_canceled')::boolean, false));

  IF v_total_qty = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  -- ① Phase C detect — override received 반영
  SELECT EXISTS(
    SELECT 1
    FROM task_items ti
    LEFT JOIN LATERAL (
      SELECT o AS obj FROM jsonb_array_elements(p_overrides) o
      WHERE o ->> 'task_item_id' = ti.id::text LIMIT 1
    ) ov ON true
    WHERE ti.task_id = p_task_id
      AND NOT (COALESCE(ti.is_canceled, false)
               OR COALESCE((ov.obj ->> 'is_canceled')::boolean, false))
      AND (ti.received_amount IS NOT NULL OR ov.obj ? 'received_amount')
  ) INTO v_use_phase_c;

  -- ③ LOOP — override 취소 row 제외, ④ 내부 qty/received 덮어쓰기
  FOR v_item IN
    SELECT
      ti.id AS task_item_id,
      ti.qty, ti.unit_price, ti.order_type,
      ti.received_amount, ti.subtotal,
      st.code AS service_code,
      at.code AS appliance_code,
      ov.obj  AS override_obj
    FROM task_items ti
    LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
    LEFT JOIN service_types st   ON st.id = wt.service_type_id
    LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
    LEFT JOIN LATERAL (
      SELECT o AS obj FROM jsonb_array_elements(p_overrides) o
      WHERE o ->> 'task_item_id' = ti.id::text LIMIT 1
    ) ov ON true
    WHERE ti.task_id = p_task_id
      AND NOT (COALESCE(ti.is_canceled, false)
               OR COALESCE((ov.obj ->> 'is_canceled')::boolean, false))
    ORDER BY ti.id
  LOOP
    v_ov          := v_item.override_obj;
    v_ov_qty      := CASE WHEN v_ov ? 'qty'             THEN (v_ov ->> 'qty')::int             ELSE NULL END;
    v_ov_received := CASE WHEN v_ov ? 'received_amount' THEN (v_ov ->> 'received_amount')::int ELSE NULL END;

    v_qty := COALESCE(v_ov_qty, v_item.qty, 1)::int;

    v_unit_price := CASE
      WHEN COALESCE(v_item.unit_price, 0) > 0 AND v_item.unit_price <> COALESCE(v_task.product_price, 0)
      THEN v_item.unit_price
      ELSE v_fallback_unit
    END;
    v_service_code := v_item.service_code;
    v_appliance_code := v_item.appliance_code;

    IF v_principal_code = 'usol_n'
       AND v_item.order_type = '추가선택'
       AND COALESCE(v_service_code, '') = 'refrigerant' THEN
      v_service_code := 'addon';
      v_appliance_code := '냉매점검';
    END IF;

    v_calc_result := calculate_commission(
      v_principal_code, v_service_code, v_appliance_code,
      v_unit_price, 0, 0, NULL
    );
    IF NOT (v_calc_result ->> 'ok')::boolean THEN
      RAISE EXCEPTION 'calculate_commission 실패: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');

    IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
      v_is_ratio := true;
    END IF;

    IF v_use_phase_c THEN
      v_row_subtotal := v_qty * v_unit_price;
      v_row_received := COALESCE(v_ov_received, v_item.received_amount, v_row_subtotal);
      v_row_extra    := GREATEST(v_row_received - v_row_subtotal, 0);
      v_item_extra   := v_row_extra;
    ELSE
      IF v_service_code = 'cleaning' THEN
        v_item_extra := 0;
        IF NOT v_cleaning_extra_applied THEN
          IF v_principal_code = 'usol_n' THEN
            v_cleaning_engineer_bonus := COALESCE(v_task.extra_fee, 0)
                                       - FLOOR(COALESCE(v_task.extra_fee, 0) * 0.15)::int;
          ELSE
            v_cleaning_engineer_bonus := COALESCE(v_task.extra_fee, 0);
          END IF;
          v_cleaning_extra_applied := true;
          v_extra_applied := true;
        END IF;
      ELSE
        v_item_extra := CASE
          WHEN v_is_ratio AND NOT v_extra_applied THEN COALESCE(v_task.extra_fee, 0)
          ELSE 0
        END;
      END IF;
    END IF;

    IF v_is_ratio AND (v_qty > 1 OR v_item_extra > 0) THEN
      v_calc_result := calculate_commission(
        v_principal_code, v_service_code, v_appliance_code,
        v_unit_price * v_qty, v_item_extra, 0, NULL
      );
      IF NOT (v_calc_result ->> 'ok')::boolean THEN
        RAISE EXCEPTION 'calculate_commission 재호출 실패: %', v_calc_result;
      END IF;
      IF NOT v_use_phase_c AND v_item_extra > 0 THEN
        v_extra_applied := true;
      END IF;
    END IF;

    v_eng := (v_calc_result ->> 'engineer')::int;
    v_prin := (v_calc_result ->> 'principal')::int;
    v_mult := CASE WHEN v_is_ratio THEN 1 ELSE v_qty END;

    IF v_service_code = 'refrigerant'
       AND v_calc_method != 'usol_n_추가선택'
       AND v_task.assigned_engineer_id IS NOT NULL THEN
      SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate
      FROM users WHERE id = v_task.assigned_engineer_id;
      v_total_calc := (v_calc_result ->> 'total')::int;
      IF v_engineer_rate >= 100 THEN
        v_eng := v_total_calc - v_prin;
      ELSE
        v_eng := (v_total_calc * v_engineer_rate / 100)::int;
      END IF;
    END IF;

    v_eng_for_item := v_eng * v_mult;

    IF v_use_phase_c
       AND v_service_code = 'cleaning'
       AND v_item_extra > 0
       AND v_calc_method IN ('직영_0', '비율_견적금액', '정액') THEN
      IF v_principal_code = 'usol_n' THEN
        v_eng_for_item := v_eng_for_item + (v_item_extra - FLOOR(v_item_extra * 0.15)::int);
      ELSE
        v_eng_for_item := v_eng_for_item + v_item_extra;
      END IF;
    END IF;

    IF NOT v_use_phase_c AND v_service_code = 'cleaning' AND v_first_cleaning_item THEN
      v_eng_for_item := v_eng_for_item + v_cleaning_engineer_bonus;
      v_first_cleaning_item := false;
    END IF;

    IF NOT v_first_item_applied THEN
      v_eng_for_item := v_eng_for_item + COALESCE(v_task.travel_fee, 0);
      v_first_item_applied := true;
    END IF;

    v_result := v_result || jsonb_build_object(
      'task_item_id', v_item.task_item_id,
      'engineer_amount', v_eng_for_item
    );
  END LOOP;

  RETURN v_result;
END;
$function$;
