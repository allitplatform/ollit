-- 019_compute_payment_v7.sql
-- 2026-05-16 — compute_payment v7 (11개 calc_method + multi task_items)
-- 003 측 옛 compute_payment REPLACE 박음 (8개 옛 calc_method → 11개 v7)
-- calculate_commission (009) 박은 spec 사용 — 단일 항목 calc + multi 합산
-- RATIO_METHODS + FIXED_PRINCIPAL_METHODS 분기 박음 (frontend calculateCommissionMultiRpc 박은 spec 일치)
-- Math.floor — fallback unit price (소수점 박지 X)

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
  --    item.unit_price 박지 X 박힘 박은 spec 측 견적 / 총수량 균등 분배
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
    -- task_items.unit_price 박혀있으면 사용, 박지 X 박힘 fallback
    v_unit_price := CASE
      WHEN COALESCE(v_item.unit_price, 0) > 0 AND v_item.unit_price <> COALESCE(v_task.product_price, 0)
      THEN v_item.unit_price
      ELSE v_fallback_unit
    END;
    v_service_code := v_item.service_code;
    v_appliance_code := v_item.appliance_code;

    -- 단일 항목 calc (probe = 1대분)
    v_calc_result := calculate_commission(
      v_principal_code,
      v_service_code,
      v_appliance_code,
      v_unit_price,
      0,
      0,
      NULL
    );

    IF (v_calc_result ->> 'ok')::boolean = false THEN
      RAISE EXCEPTION 'calculate_commission 박지 X: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';

    -- 분기: 비율형 / 정액형 / 단가형 (frontend calculateCommissionMultiRpc 박은 spec 일치)
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
    v_is_fixed := v_calc_method = '정액';

    -- 비율형 + qty > 1: 전체 estimate 박은 재호출 (1대분 박은 spec 부족)
    IF v_is_ratio AND v_qty > 1 THEN
      v_calc_result := calculate_commission(
        v_principal_code,
        v_service_code,
        v_appliance_code,
        v_unit_price * v_qty,
        0,
        0,
        NULL
      );
      IF (v_calc_result ->> 'ok')::boolean = false THEN
        RAISE EXCEPTION 'calculate_commission 재호출 박지 X: %', v_calc_result;
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
  'v7 — multi task_items + calculate_commission 박은 spec + 정액 1작업당 + Math.floor';

-- ============================================
-- 검증 (선택) — 기존 작업 1건 박은 spec 테스트
-- ============================================
-- SELECT compute_payment(id) FROM tasks WHERE status='완료' LIMIT 1;
-- SELECT * FROM payments ORDER BY computed_at DESC LIMIT 1;

-- ============================================
-- 기존 완료 작업 재계산 SQL (사장님 운영 측 박을 spec)
-- ============================================
-- SELECT compute_payment(id)
-- FROM tasks
-- WHERE status = '완료'
--   AND tenant_id = '11111111-1111-1111-1111-111111111111';
