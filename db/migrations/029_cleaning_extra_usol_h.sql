-- 029_cleaning_extra_usol_h.sql
-- 2026-05-17 — usol_h 세척 추가금 박음 (v10)
-- 박힌 spec (v9 Migration 024):
--   usol_n 박은 spec 측만 — 원청 15% / 기사 85%
--   usol_h 박은 spec 측 — 기사 100% 박힘 (사장님 spec 박지 X)
-- 박을 spec (사장님 박은 spec — v10):
--   usol_h cleaning 추가금: 원청 15% / 기사 85%
--   usol_n cleaning 추가금: 원청 15% / 기사 85% (그대로)
--   나머지 5개 (allday/KA/KB/yongin/crikrin): 기사 100% (그대로)

CREATE OR REPLACE FUNCTION public.compute_payment(p_task_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_is_fixed          boolean;
  v_eng               int;
  v_prin              int;
  v_mult              int;
  v_item_extra        int;
  v_extra_applied     boolean := false;
  v_total_engineer    int := 0;
  v_total_principal   int := 0;
  v_total_owner       int := 0;
  v_principal_applied boolean := false;
  v_last_calc_method  text;
  v_last_policy_key   text;
  v_payment_id        uuid;
  -- v9: 세척 추가금 별도 누적
  v_cleaning_extra_applied   boolean := false;
  v_cleaning_engineer_bonus  int := 0;
  v_cleaning_principal_bonus int := 0;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 박지 X: %', p_task_id;
  END IF;

  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 박지 X: principal_id=%', v_task.principal_id;
  END IF;

  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items WHERE task_id = p_task_id;

  IF v_total_qty = 0 THEN
    RAISE EXCEPTION 'task_items 박지 X: task_id=%', p_task_id;
  END IF;

  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  FOR v_item IN
    SELECT
      ti.qty, ti.unit_price,
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

    v_calc_result := calculate_commission(
      v_principal_code, v_service_code, v_appliance_code,
      v_unit_price, 0, 0, NULL
    );

    IF NOT (v_calc_result ->> 'ok')::boolean THEN
      RAISE EXCEPTION 'calculate_commission 박지 X: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
    v_is_fixed := v_calc_method = '정액';

    -- v10 박을 spec: 세척 추가금 박음 — usol_h 추가 (사장님 spec)
    IF v_service_code = 'cleaning' THEN
      v_item_extra := 0;

      IF NOT v_cleaning_extra_applied THEN
        -- usol_n + usol_h: 원청 15% / 기사 85%
        IF v_principal_code IN ('usol_n', 'usol_h') THEN
          v_cleaning_principal_bonus := FLOOR(COALESCE(v_task.extra_fee, 0) * 0.15)::int;
          v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0) - v_cleaning_principal_bonus;
        ELSE
          -- 나머지 5개 (allday/KA/KB/yongin/crikrin): 기사 100%
          v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0);
          v_cleaning_principal_bonus := 0;
        END IF;
        v_cleaning_extra_applied := true;
        v_extra_applied := true;
      END IF;
    ELSE
      -- v8 spec 그대로 박음 (refrigerant 측)
      v_item_extra := CASE
        WHEN v_is_ratio AND NOT v_extra_applied THEN COALESCE(v_task.extra_fee, 0)
        ELSE 0
      END;
    END IF;

    IF v_is_ratio AND (v_qty > 1 OR v_item_extra > 0) THEN
      v_calc_result := calculate_commission(
        v_principal_code, v_service_code, v_appliance_code,
        v_unit_price * v_qty, v_item_extra, 0, NULL
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

    v_total_engineer := v_total_engineer + (v_eng * v_mult);

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

  -- owner 계산
  v_total_owner := COALESCE(v_task.product_price, 0)
                 + COALESCE(v_task.extra_fee, 0)
                 + COALESCE(v_task.travel_fee, 0)
                 - v_total_engineer
                 - v_total_principal;

  -- payments UPSERT
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
$function$;

COMMENT ON FUNCTION public.compute_payment(uuid) IS
  'v10 — 세척 추가금 정책 박음 (usol_n + usol_h 원청 15% / 기사 85%, 나머지 기사 100%)';

-- ============================================
-- backfill — usol_h cleaning + extra_fee > 0 박은 task 측 재계산
-- ============================================
SELECT compute_payment(t.id) AS payment_id, t.task_no, t.customer_name
FROM tasks t
LEFT JOIN principals pr ON pr.id = t.principal_id
WHERE pr.code = 'usol_h'
  AND COALESCE(t.extra_fee, 0) > 0
  AND t.status IN ('진행중', '완료');

-- ============================================
-- 검증 SQL — 유로라 측 박힘 catch
-- ============================================
-- SELECT
--   t.task_no, t.customer_name, pr.code,
--   t.product_price, t.extra_fee, t.total_amount,
--   p.engineer_amount, p.principal_amount, p.owner_amount,
--   p.is_balanced
-- FROM tasks t
-- JOIN payments p ON p.task_id = t.id
-- JOIN principals pr ON pr.id = t.principal_id
-- WHERE t.customer_name LIKE '%유로라%';
--
-- 기대: usol_h cleaning (100K + 50K extra):
--   engineer: 40,000 + 50,000 - FLOOR(50000*0.15) = 40,000 + 42,500 = 82,500
--   principal: 15,000 + FLOOR(50000*0.15) = 15,000 + 7,500 = 22,500
--   owner: 150,000 - 82,500 - 22,500 = 45,000
