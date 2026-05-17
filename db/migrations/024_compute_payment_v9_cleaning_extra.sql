-- 024_compute_payment_v9_cleaning_extra.sql
-- 2026-05-17 — 세척 추가금 정책 fix
-- 박을 spec:
--   1) service_code='cleaning' 박은 spec 측 — 추가금 기사 100% (기본)
--   2) principal_code='usol_n' AND service_code='cleaning' 박은 spec 측:
--        · 원청 = FLOOR(extra_fee * 0.15)
--        · 기사 = extra_fee - 원청 (나머지)
--   3) service_code != 'cleaning' (refrigerant 측) → v8 spec 그대로 박음
--   4) 혼합 task 박지 X 박은 spec (세척만 / 냉매만)

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
  v_extra_applied     boolean := false;  -- v8: 비-cleaning 비율형 첫 item만 extra_fee 박음
  v_total_engineer    int := 0;
  v_total_principal   int := 0;
  v_total_owner       int := 0;
  v_principal_applied boolean := false;
  v_last_calc_method  text;
  v_last_policy_key   text;
  v_payment_id        uuid;
  -- v9 신규: 세척 추가금 별도 누적
  v_cleaning_extra_applied   boolean := false;
  v_cleaning_engineer_bonus  int := 0;
  v_cleaning_principal_bonus int := 0;
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

    -- v9 신규: 세척 추가금 박을 spec
    IF v_service_code = 'cleaning' THEN
      -- 정책 측에 extra 박지 X (정책 비율 측 박지 X — 견적만 정책 측 박음)
      v_item_extra := 0;

      -- 첫 cleaning item 박은 spec 측 — 추가금 1회만 박음
      IF NOT v_cleaning_extra_applied THEN
        IF v_principal_code = 'usol_n' THEN
          -- usol_n: 원청 15% 정수 먼저, 나머지 기사 (회사 0%)
          v_cleaning_principal_bonus := FLOOR(COALESCE(v_task.extra_fee, 0) * 0.15)::int;
          v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0) - v_cleaning_principal_bonus;
        ELSE
          -- 그 외 원청: 기사 100%
          v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0);
          v_cleaning_principal_bonus := 0;
        END IF;
        v_cleaning_extra_applied := true;
        v_extra_applied := true;  -- 비-cleaning 비율형 측 중복 박지 X
      END IF;
    ELSE
      -- v8 spec 그대로 박음 (refrigerant 측 — 비율형 첫 item에 extra_fee 박음)
      v_item_extra := CASE
        WHEN v_is_ratio AND NOT v_extra_applied THEN COALESCE(v_task.extra_fee, 0)
        ELSE 0
      END;
    END IF;

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

  -- v9 신규: 세척 추가금 박음 (루프 종료 후 1회 합산)
  v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
  v_total_principal := v_total_principal + v_cleaning_principal_bonus;

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
  'v9 — 세척 추가금 정책 박음 (기본 기사 100%, usol_n 원청 15% / 기사 나머지)';

-- ============================================
-- backfill 박을 spec — extra_fee > 0 박은 완료 작업 재계산
-- 사장님 측 Supabase SQL Editor 측 박을 spec:
-- ============================================
-- SELECT compute_payment(t.id) AS payment_id, t.task_no
-- FROM tasks t
-- WHERE t.status = '완료'
--   AND COALESCE(t.extra_fee, 0) > 0
--   AND t.tenant_id = '11111111-1111-1111-1111-111111111111'
-- ORDER BY t.created_at DESC;

-- ============================================
-- 검증 SQL — 박은 spec 박음 catch
-- ============================================
-- SELECT
--   t.task_no, t.customer_name,
--   pr.code AS principal,
--   t.product_price, t.extra_fee,
--   p.engineer_amount, p.principal_amount, p.owner_amount,
--   p.calc_method
-- FROM tasks t
-- JOIN payments p ON p.task_id = t.id
-- JOIN principals pr ON pr.id = t.principal_id
-- WHERE t.status = '완료'
--   AND COALESCE(t.extra_fee, 0) > 0
-- ORDER BY t.created_at DESC LIMIT 10;
