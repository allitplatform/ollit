-- ============================================================================
-- Migration 065 — compute_engineer_amount_per_item RPC 신설
-- 작성: 2026-05-24
-- 범위: 신규 RPC 1개 — task_items별 engineer_amount를 jsonb로 반환 (read-only)
-- ============================================================================
-- 배경:
--   기사 PWA EngineerTaskDetailScreen이 item 박스 금액을 잘못 계산 (engRatio 분모 오류).
--   직전 spec — `subtotal × (engineer_amount / task.totalAmount)` 사용.
--   usol_n은 task.totalAmount(customer_paid 합) ≠ SUM(subtotal)이라 합계가 어긋남.
--
-- 신규 spec:
--   item별 기사 몫 = compute_payment의 FOR LOOP과 동일한 로직으로 산출.
--   본 RPC는 read-only — payments / task_items 변경 없음.
--   계산 핵심은 Migration 050 (현 활성 compute_payment)의 FOR LOOP를 재사용.
--
-- 의존:
--   - Migration 050 (compute_payment v14, calculate_commission, commission_policies)
--   - Migration 028 (task_items_compute_trg) — payments 자동 재계산
--
-- 안전:
--   - LANGUAGE plpgsql STABLE — read-only (DML 없음)
--   - SECURITY DEFINER — anon/authenticated 측 RPC 호출 허용
--   - compute_payment 본체 무손상 — 신규 함수만 추가
--   - 측 6 원청 동일 동작 (calc_method 분기 동일)
--
-- 재실행:
--   - CREATE OR REPLACE FUNCTION — idempotent
-- ============================================================================

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
  v_eng               int;
  v_prin              int;
  v_mult              int;
  v_item_extra        int;
  v_extra_applied     boolean := false;
  v_cleaning_extra_applied   boolean := false;
  v_cleaning_engineer_bonus  int := 0;
  -- 첫 cleaning item에 cleaning_bonus 합산 + 첫 item에 travel_fee 합산
  v_first_item_applied       boolean := false;
  v_first_cleaning_item      boolean := true;
  v_engineer_rate            int;
  v_total_calc               int;
  v_eng_for_item             int;
  v_result                   jsonb := '[]'::jsonb;
BEGIN
  -- 1) task 조회
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 없음: %', p_task_id;
  END IF;

  -- 2) principal_code 조회
  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 없음: principal_id=%', v_task.principal_id;
  END IF;

  -- 3) task_items 총수량
  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items WHERE task_id = p_task_id;

  IF v_total_qty = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 4) fallback unit price
  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  -- 5) task_items 순회 — compute_payment v14(Migration 050)과 동일한 흐름
  FOR v_item IN
    SELECT
      ti.id AS task_item_id,
      ti.qty,
      ti.unit_price,
      ti.order_type,
      st.code AS service_code,
      at.code AS appliance_code
    FROM task_items ti
    LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
    LEFT JOIN service_types st   ON st.id = wt.service_type_id
    LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
    WHERE ti.task_id = p_task_id
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

    -- v11: usol_n + 추가선택 + refrigerant → addon 변환
    IF v_principal_code = 'usol_n'
       AND v_item.order_type = '추가선택'
       AND COALESCE(v_service_code, '') = 'refrigerant' THEN
      v_service_code := 'addon';
      v_appliance_code := '냉매점검';
    END IF;

    -- probe — 1대분
    v_calc_result := calculate_commission(
      v_principal_code, v_service_code, v_appliance_code,
      v_unit_price, 0, 0, NULL
    );

    IF NOT (v_calc_result ->> 'ok')::boolean THEN
      RAISE EXCEPTION 'calculate_commission 실패: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');

    -- v13 (049): 비율_견적금액 + refrigerant → is_ratio
    IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
      v_is_ratio := true;
    END IF;

    -- v9: 세척 추가금
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

    -- 비율형 재호출
    IF v_is_ratio AND (v_qty > 1 OR v_item_extra > 0) THEN
      v_calc_result := calculate_commission(
        v_principal_code, v_service_code, v_appliance_code,
        v_unit_price * v_qty, v_item_extra, 0, NULL
      );
      IF NOT (v_calc_result ->> 'ok')::boolean THEN
        RAISE EXCEPTION 'calculate_commission 재호출 실패: %', v_calc_result;
      END IF;
      IF v_item_extra > 0 THEN
        v_extra_applied := true;
      END IF;
    END IF;

    v_eng := (v_calc_result ->> 'engineer')::int;
    v_prin := (v_calc_result ->> 'principal')::int;
    v_mult := CASE WHEN v_is_ratio THEN 1 ELSE v_qty END;

    -- v14 (050): refrigerant + assigned 기사 기준 engineer_rate 적용
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

    -- item 단위 engineer (× v_mult)
    v_eng_for_item := v_eng * v_mult;

    -- 첫 cleaning item에 cleaning_bonus 합산 (compute_payment는 task 단위 합산 — 본 RPC는 첫 cleaning item으로 귀속)
    IF v_service_code = 'cleaning' AND v_first_cleaning_item THEN
      v_eng_for_item := v_eng_for_item + v_cleaning_engineer_bonus;
      v_first_cleaning_item := false;
    END IF;

    -- v12 (048): travel_fee 기사 100% — 첫 item에 귀속
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
$$;

GRANT EXECUTE ON FUNCTION compute_engineer_amount_per_item(uuid) TO anon, authenticated;

COMMENT ON FUNCTION compute_engineer_amount_per_item(uuid) IS
  '기사 PWA item 박스 표시용 — task_items별 engineer_amount를 jsonb array로 반환. read-only. compute_payment v14(Migration 050) FOR LOOP 재사용.';

-- ============================================================================
-- 검증 SQL (별도 실행)
-- ============================================================================
-- 1) RPC 등록 확인:
-- SELECT proname, obj_description(oid, 'pg_proc') AS comment
-- FROM pg_proc WHERE proname = 'compute_engineer_amount_per_item';
--
-- 2) 정승민 YS-260420-168 검증 (예상: 스탠드 66,000 / 벽걸이 44,000 = 110,000):
-- WITH t AS (SELECT id FROM tasks WHERE task_no = 'YS-260420-168')
-- SELECT compute_engineer_amount_per_item((SELECT id FROM t));
-- → SUM(engineer_amount) = payments.engineer_amount (110,000)
--
-- 3) 황예원 YS-260504-037 검증 (예상: 본작업 55,000 + 추가선택 24,082 ≈ 79,084):
-- WITH t AS (SELECT id FROM tasks WHERE task_no = 'YS-260504-037')
-- SELECT compute_engineer_amount_per_item((SELECT id FROM t));
--
-- 4) 측 6 원청 임의 표본 — SUM(item) = payments.engineer_amount 일치 확인:
-- SELECT t.task_no, t.customer_name,
--        (SELECT SUM((x->>'engineer_amount')::int)
--         FROM jsonb_array_elements(compute_engineer_amount_per_item(t.id)) x) AS sum_item_eng,
--        p.engineer_amount AS payments_eng
-- FROM tasks t
-- LEFT JOIN payments p ON p.task_id = t.id
-- WHERE t.principal_id IN (SELECT id FROM principals WHERE code IN ('allday','KA','KB','yongin','usol_h','crikrin','usol_n'))
--   AND p.engineer_amount IS NOT NULL
-- ORDER BY random()
-- LIMIT 20;
