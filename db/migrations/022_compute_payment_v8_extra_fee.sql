-- 022_compute_payment_v8_extra_fee.sql
-- 2026-05-17 — calculate_commission 측 extra_fee 박지 X 박힌 spec fix
-- catch: 019 (v7) 측 p_extra_amount = 0 박음 → 비율형 측 extra_fee 박지 X
-- 박을 spec: 비율형 첫 item 측 extra_fee 박음 (중복 박지 X)
-- 예: 직영_50_50 (견적 150K + 추가금 100K) → engineer 125K, owner 125K

CREATE OR REPLACE FUNCTION compute_payment(p_task_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
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
  v_extra_applied     boolean := false;  -- v8: 첫 비율형 item만 extra_fee 박음 (중복 박지 X)
  v_total_engineer    int := 0;
  v_total_principal   int := 0;
  v_total_owner       int := 0;
  v_principal_applied boolean := false;
  v_last_calc_method  text;
  v_last_policy_key   text;
  v_payment_id        uuid;
BEGIN
  -- 1) task 박음
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 박지 X: %', p_task_id;
  END IF;

  -- 2) principal_code 박음
  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 박지 X: principal_id=%', v_task.principal_id;
  END IF;

  -- 3) task_items 총수량 (017 trigger 측 자동 박힘)
  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items WHERE task_id = p_task_id;

  IF v_total_qty = 0 THEN
    RAISE EXCEPTION 'task_items 박지 X: task_id=%', p_task_id;
  END IF;

  -- 4) fallback unit price (Math.floor — 정수 박힐 spec)
  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  -- 5) task_items 순회 — 각 항목별 calculate_commission 박음 + 합산
  FOR v_item IN
    SELECT
      ti.qty,
      ti.unit_price,
      st.code AS service_code,
      at.code AS appliance_code
    FROM task_items ti
    LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
    LEFT JOIN service_types st   ON st.id = wt.service_type_id
    LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
    WHERE ti.task_id = p_task_id
  LOOP
    v_qty := COALESCE(v_item.qty, 1)::int;
    v_unit_price := CASE
      WHEN COALESCE(v_item.unit_price, 0) > 0 AND v_item.unit_price <> COALESCE(v_task.product_price, 0)
      THEN v_item.unit_price
      ELSE v_fallback_unit
    END;
    v_service_code := v_item.service_code;
    v_appliance_code := v_item.appliance_code;

    -- probe — 1대분 (extra = 0) → calc_method 박음
    v_calc_result := calculate_commission(
      v_principal_code,
      v_service_code,
      v_appliance_code,
      v_unit_price,
      0,
      0,
      NULL
    );

    IF NOT (v_calc_result ->> 'ok')::boolean THEN
      RAISE EXCEPTION 'calculate_commission 박지 X: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
    v_is_fixed := v_calc_method = '정액';

    -- v8: 비율형 첫 item 측 — extra_fee 박음 (중복 박지 X)
    -- 단가형 / 정액 박은 spec 측 — extra_fee 박지 X (owner 측 박힘)
    v_item_extra := CASE
      WHEN v_is_ratio AND NOT v_extra_applied THEN COALESCE(v_task.extra_fee, 0)
      ELSE 0
    END;

    -- 비율형 재호출: (unit_price * qty + extra) 박음
    IF v_is_ratio AND (v_qty > 1 OR v_item_extra > 0) THEN
      v_calc_result := calculate_commission(
        v_principal_code,
        v_service_code,
        v_appliance_code,
        v_unit_price * v_qty,
        v_item_extra,
        0,
        NULL
      );
      IF NOT (v_calc_result ->> 'ok')::boolean THEN
        RAISE EXCEPTION 'calculate_commission 재호출 박지 X: %', v_calc_result;
      END IF;
      IF v_item_extra > 0 THEN
        v_extra_applied := true;
      END IF;
    END IF;

    v_eng := (v_calc_result ->> 'engineer')::int;
    v_prin := (v_calc_result ->> 'principal')::int;
    v_mult := CASE WHEN v_is_ratio THEN 1 ELSE v_qty END;

    -- engineer 합산
    v_total_engineer := v_total_engineer + (v_eng * v_mult);

    -- principal 합산 — 정액형은 1작업당 1번만
    IF v_is_fixed THEN
      IF NOT v_principal_applied THEN
        v_total_principal := v_total_principal + v_prin;
        v_principal_applied := true;
      END IF;
    ELSE
      v_total_principal := v_total_principal + (v_prin * v_mult);
    END IF;

    v_last_calc_method := v_calc_method;
    v_last_policy_key  := v_calc_result ->> 'policy_key';
  END LOOP;

  -- 6) owner 계산 — is_balanced GENERATED 박혀있어 (eng + prin + owner) = (product + extra + travel) 박을 spec
  v_total_owner := COALESCE(v_task.product_price, 0)
                 + COALESCE(v_task.extra_fee, 0)
                 + COALESCE(v_task.travel_fee, 0)
                 - v_total_engineer
                 - v_total_principal;

  -- 7) payments UPSERT (DELETE + INSERT — idempotent)
  DELETE FROM payments WHERE task_id = p_task_id;
  INSERT INTO payments (
    task_id, computed_by,
    policy_key, calc_method,
    product_price, extra_fee, travel_fee, naver_fee,
    engineer_amount, principal_amount, owner_amount,
    status
  ) VALUES (
    p_task_id, auth.uid(),
    v_last_policy_key, v_last_calc_method,
    COALESCE(v_task.product_price, 0),
    COALESCE(v_task.extra_fee, 0),
    COALESCE(v_task.travel_fee, 0),
    0,
    v_total_engineer, v_total_principal, v_total_owner,
    '미정산'
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION compute_payment(uuid) IS
  'v8 — extra_fee 박은 spec 측 비율형 첫 item 박은 spec 측 박음 (단가형/정액 측 owner 박힘)';

-- ============================================
-- backfill 박을 spec — extra_fee > 0 박은 spec 측 재계산
-- ============================================
-- SELECT compute_payment(t.id)
-- FROM tasks t
-- WHERE t.status = '완료'
--   AND COALESCE(t.extra_fee, 0) > 0
--   AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
