-- ============================================
-- Migration 140 — compute_engineer_amount_per_item v6
--                 (uuid) + (uuid, jsonb) 양 오버로드 — rate >= 100 정정
-- 작성 : 2026-06-17
-- 실행 : Supabase 콘솔 → SQL Editor → 통째 → Run (CREATE OR REPLACE = idempotent)
-- ============================================
--
-- 변경 (v5 / Mig 087 → v6):
--   single-active refrigerant pure override 에 rate >= 100 분기 추가.
--   compute_payment v20 (Mig 139) task-level override 산식과 정합.
--
--   기사 = product_price + extra_fee - principal + travel_fee
--
-- 사고 케이스 (정액 + product=70000 + extra=110000 + rate=100):
--   v5: per-item engineer = 60000 (loop 내 v_total_calc - v_prin)
--   v6: per-item engineer = 170000 (override 산식)
--
-- 회귀 보호:
--   · 정액 + rate < 100 (single-active) → 기존 v5 산식 그대로
--   · 비율형 + single-active refrigerant → in-loop v_total_calc 에 extra 흡수 = 새 산식 결과
--   · Mixed (refri + 비-refri) → v_pure_refrigerant = false (override 미진입)
--   · usol_n_추가선택 → calc_method check 측 v_pure_refrigerant = false
--   · multi-item refrigerant pure → v_active_count != 1 → override 미진입 (운영 0건)
--   · 활성 item 0건 → loop 진입 전 RETURN '[]'
--
-- 2026-06-17 fix: PostgreSQL 일부 버전 (uuid) min/max aggregate 미지원 측 회피.
--   MIN(id) (uuid) → 'SELECT id ORDER BY id LIMIT 1' 분리. COUNT/first 동일 필터 보장.
--
-- 의존:
--   · 096 v5 ((uuid) base body)
--   · 087    ((uuid, jsonb) base body)
--   · 139 v20 (compute_payment 정합 산식)
--
-- 본 마이그는 양 오버로드 동시 CREATE OR REPLACE.
-- 시그니처 유지 → 클라이언트 호출 (uuid) / (uuid, jsonb) 모두 영향 0.
-- ============================================

BEGIN;

-- ============================================
-- [1] compute_engineer_amount_per_item(uuid) v6
-- ============================================
CREATE OR REPLACE FUNCTION compute_engineer_amount_per_item(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_is_fixed          boolean;
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
  v_qty_cond          text;
  v_pure_refrigerant     boolean := true;
  v_active_count         int := 0;
  v_engineer_rate_task   int;
  v_task_total_engineer  int;
  v_first_active_id      uuid;
  v_total_principal_local int := 0;
  v_principal_applied    boolean := false;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found: %', p_task_id;
  END IF;

  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code not found: %', v_task.principal_id;
  END IF;

  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  IF v_total_qty = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- active_count + first_active_id — split (no MIN on uuid). same filter.
  SELECT COUNT(*) INTO v_active_count
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  SELECT id INTO v_first_active_id
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false)
  ORDER BY id
  LIMIT 1;

  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  SELECT EXISTS(
    SELECT 1 FROM task_items
    WHERE task_id = p_task_id
      AND NOT COALESCE(is_canceled, false)
      AND received_amount IS NOT NULL
  ) INTO v_use_phase_c;

  FOR v_item IN
    SELECT
      ti.id AS task_item_id,
      ti.qty,
      ti.unit_price,
      ti.order_type,
      ti.received_amount,
      ti.subtotal,
      st.code AS service_code,
      at.code AS appliance_code
    FROM task_items ti
    LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
    LEFT JOIN service_types st   ON st.id = wt.service_type_id
    LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
    WHERE ti.task_id = p_task_id
      AND NOT COALESCE(ti.is_canceled, false)
    ORDER BY ti.id
  LOOP
    v_qty := COALESCE(v_item.qty, 1)::int;
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

    v_qty_cond := CASE
      WHEN v_item.order_type IN ('첫대', '추가') THEN v_item.order_type
      ELSE NULL
    END;

    v_calc_result := calculate_commission(
      v_principal_code, v_service_code, v_appliance_code,
      v_unit_price, 0, 0, v_qty_cond
    );

    IF NOT (v_calc_result ->> 'ok')::boolean THEN
      RAISE EXCEPTION 'calculate_commission failed: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
    v_is_fixed := v_calc_method = '정액';

    IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
      v_is_ratio := true;
    END IF;

    IF v_service_code <> 'refrigerant' OR v_calc_method = 'usol_n_추가선택' THEN
      v_pure_refrigerant := false;
    END IF;

    IF v_use_phase_c THEN
      v_row_subtotal := v_qty * v_unit_price;
      v_row_received := COALESCE(v_item.received_amount, v_row_subtotal);
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
        v_unit_price * v_qty, v_item_extra, 0, v_qty_cond
      );
      IF NOT (v_calc_result ->> 'ok')::boolean THEN
        RAISE EXCEPTION 'calculate_commission recall failed: %', v_calc_result;
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
      END IF;
    END IF;

    IF v_is_fixed THEN
      IF NOT v_principal_applied THEN
        v_total_principal_local := v_total_principal_local + v_prin;
        v_principal_applied := true;
      END IF;
    ELSE
      v_total_principal_local := v_total_principal_local + (v_prin * v_mult);
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

  -- v6: single-active refrigerant pure override (rate>=100 added, rate<100 preserved from v5)
  IF v_active_count = 1 AND v_pure_refrigerant
     AND v_task.assigned_engineer_id IS NOT NULL THEN
    SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate_task
    FROM users WHERE id = v_task.assigned_engineer_id;

    IF v_engineer_rate_task >= 100 THEN
      v_task_total_engineer := COALESCE(v_task.product_price, 0)
                             + COALESCE(v_task.extra_fee, 0)
                             - v_total_principal_local
                             + COALESCE(v_task.travel_fee, 0);
    ELSE
      v_task_total_engineer := FLOOR(
        (COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0))::numeric
        * v_engineer_rate_task / 100
      )::int + COALESCE(v_task.travel_fee, 0);
    END IF;

    v_result := jsonb_build_array(
      jsonb_build_object(
        'task_item_id', v_first_active_id,
        'engineer_amount', v_task_total_engineer
      )
    );
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_engineer_amount_per_item(uuid) TO anon, authenticated;

COMMENT ON FUNCTION compute_engineer_amount_per_item(uuid) IS
  'v6 (Migration 140, 2026-06-17) - single-active refrigerant pure + rate>=100 override added. '
  'engineer = product_price + extra_fee - principal + travel_fee (matches compute_payment v20). '
  'rate<100 / multi-item / mixed / usol_n addon-type / no-active behavior unchanged from v5.';

-- ============================================
-- [2] compute_engineer_amount_per_item(uuid, jsonb) v6
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_engineer_amount_per_item(
  p_task_id   uuid,
  p_overrides jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
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
  v_is_fixed          boolean;
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
  v_pure_refrigerant     boolean := true;
  v_active_count         int := 0;
  v_engineer_rate_task   int;
  v_task_total_engineer  int;
  v_first_active_id      uuid;
  v_total_principal_local int := 0;
  v_principal_applied    boolean := false;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found: %', p_task_id;
  END IF;

  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code not found: %', v_task.principal_id;
  END IF;

  -- total_qty (override-aware)
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

  -- active_count + first_active_id (override-aware) — split (no MIN on uuid). same filter.
  SELECT COUNT(*) INTO v_active_count
  FROM task_items ti
  LEFT JOIN LATERAL (
    SELECT o AS obj FROM jsonb_array_elements(p_overrides) o
    WHERE o ->> 'task_item_id' = ti.id::text LIMIT 1
  ) ov ON true
  WHERE ti.task_id = p_task_id
    AND NOT (COALESCE(ti.is_canceled, false)
             OR COALESCE((ov.obj ->> 'is_canceled')::boolean, false));

  SELECT ti.id INTO v_first_active_id
  FROM task_items ti
  LEFT JOIN LATERAL (
    SELECT o AS obj FROM jsonb_array_elements(p_overrides) o
    WHERE o ->> 'task_item_id' = ti.id::text LIMIT 1
  ) ov ON true
  WHERE ti.task_id = p_task_id
    AND NOT (COALESCE(ti.is_canceled, false)
             OR COALESCE((ov.obj ->> 'is_canceled')::boolean, false))
  ORDER BY ti.id
  LIMIT 1;

  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  -- phase_c detect (override-aware)
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
      RAISE EXCEPTION 'calculate_commission failed: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
    v_is_fixed := v_calc_method = '정액';

    IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
      v_is_ratio := true;
    END IF;

    IF v_service_code <> 'refrigerant' OR v_calc_method = 'usol_n_추가선택' THEN
      v_pure_refrigerant := false;
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
        RAISE EXCEPTION 'calculate_commission recall failed: %', v_calc_result;
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

    IF v_is_fixed THEN
      IF NOT v_principal_applied THEN
        v_total_principal_local := v_total_principal_local + v_prin;
        v_principal_applied := true;
      END IF;
    ELSE
      v_total_principal_local := v_total_principal_local + (v_prin * v_mult);
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

  -- v6: single-active refrigerant pure override (rate>=100 added)
  IF v_active_count = 1 AND v_pure_refrigerant
     AND v_task.assigned_engineer_id IS NOT NULL THEN
    SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate_task
    FROM users WHERE id = v_task.assigned_engineer_id;

    IF v_engineer_rate_task >= 100 THEN
      v_task_total_engineer := COALESCE(v_task.product_price, 0)
                             + COALESCE(v_task.extra_fee, 0)
                             - v_total_principal_local
                             + COALESCE(v_task.travel_fee, 0);
    ELSE
      v_task_total_engineer := FLOOR(
        (COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0))::numeric
        * v_engineer_rate_task / 100
      )::int + COALESCE(v_task.travel_fee, 0);
    END IF;

    v_result := jsonb_build_array(
      jsonb_build_object(
        'task_item_id', v_first_active_id,
        'engineer_amount', v_task_total_engineer
      )
    );
  END IF;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION compute_engineer_amount_per_item(uuid, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION compute_engineer_amount_per_item(uuid, jsonb) IS
  'v6 (Migration 140, 2026-06-17) - single-active refrigerant pure + rate>=100 override added. '
  'Mirrors single-arg (uuid) v6 logic + p_overrides preview support. '
  'compute_payment v20 (Migration 139) formula parity.';

COMMIT;

-- ============================================
-- Verify (별도 실행)
-- ============================================
--
-- A. 양 시그니처 코멘트 확인:
-- SELECT
--   p.proname,
--   pg_get_function_identity_arguments(p.oid) AS args,
--   obj_description(p.oid, 'pg_proc') AS note
-- FROM pg_proc p
-- WHERE p.proname = 'compute_engineer_amount_per_item'
-- ORDER BY args;
-- 기대: 양 row 모두 'v6 (Migration 140, 2026-06-17) ...'
--
-- B. 사고 케이스 (단일 active refrigerant + 정액 + rate=100 + extra > 0):
--    영향 task 1건 — engineer = product + extra - principal + travel 확인.
-- SELECT * FROM jsonb_array_elements(
--   compute_engineer_amount_per_item('<task_uuid>'::uuid)
-- );
-- 기대 (product=70000, extra=110000, principal=10000, travel=0):
--   engineer_amount = 170000
--
-- C. 회귀 — 정액 + rate<100 단일 active refrigerant:
-- SELECT * FROM jsonb_array_elements(
--   compute_engineer_amount_per_item('<rate50_task_uuid>'::uuid)
-- );
-- 기대 산식: FLOOR((product+extra) * rate / 100) + travel
--
-- D. 회귀 — 비-refrigerant / mixed / usol_n:
--    랜덤 5건 sample → 적용 전후 결과 동일 (변화 0).
--
-- E. 오버로드 (uuid, jsonb) override 회귀:
-- SELECT * FROM jsonb_array_elements(
--   compute_engineer_amount_per_item('<task_uuid>'::uuid, '[]'::jsonb)
-- );
-- 기대: (uuid) 결과와 동일.
--
-- ============================================
-- 롤백 (위급 시):
--   db/migrations/096_compute_payment_v19_refrigerant_simple.sql 후반 (uuid) 본문 재실행 +
--   db/migrations/087_per_item_override.sql 본문 재실행.
-- ============================================
