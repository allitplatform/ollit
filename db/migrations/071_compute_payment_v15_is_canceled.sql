-- ============================================================================
-- Migration 071 — compute_payment v15 + compute_engineer_amount_per_item v2
--                 (task_items.is_canceled = true 제외 — 미취소만 정산)
-- 작성: 2026-05-25
-- 상태: 초안 (사장님 검토 대기 — 적용 X)
-- ============================================================================
-- 배경:
--   070 적용 후 task_items.qty 는 원본 의뢰 수량 보존(사장님 spec).
--   compute_payment(v14, Migration 050) 본체는 ti.qty × ti.unit_price 를 직접 사용
--   → 취소 품목(is_canceled=true)도 합산돼 spec 위배.
--
--   subtotal SUM(usol_n owner 계산) 한 곳은 070 의 subtotal CASE 재정의 효과로
--   자동 0 기여 — 별도 수정 X.
--
-- 수정 (FOR LOOP WHERE 절에 is_canceled=false 필터만 추가):
--   [1] compute_payment(p_task_id uuid)
--       · v_total_qty 산출 — WHERE NOT COALESCE(is_canceled, false)
--       · FOR LOOP SELECT — WHERE ti.task_id=p_task_id AND NOT COALESCE(ti.is_canceled, false)
--   [2] compute_engineer_amount_per_item(p_task_id uuid)
--       · 동일 패턴
--
-- 의존:
--   - 070 적용 완료 (task_items.is_canceled 컬럼 존재)
--   - 050 (v14) / 065 (v1) — 본 071 측 v15 / v2 측 교체
--
-- 회귀 방지:
--   - 기존 task (is_canceled 행 0건) — WHERE NOT FALSE = TRUE 효과 → 결과 동일
--   - usol_n + 측 6 원청 — 측 동일 로직 (필터만 추가)
--   - CREATE OR REPLACE FUNCTION = 재실행 안전 (idempotent)
--
-- 실행: 070 적용 + 검증 통과 후 본 071 실행.
-- ============================================================================

BEGIN;

-- ============================================
-- [1] compute_payment v15 (Migration 050 v14 본문 + 패치 2지점)
-- ============================================
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
  v_extra_applied     boolean := false;
  v_total_engineer    int := 0;
  v_total_principal   int := 0;
  v_total_owner       int := 0;
  v_principal_applied boolean := false;
  v_last_calc_method  text;
  v_last_policy_key   text;
  v_payment_id        uuid;
  v_cleaning_extra_applied   boolean := false;
  v_cleaning_engineer_bonus  int := 0;
  v_cleaning_principal_bonus int := 0;
  v_track                CHAR(1) := 'A';
  v_has_non_refrigerant  boolean := false;
  v_total_settle         int := 0;
  v_engineer_rate int;
  v_total_calc    int;
BEGIN
  -- 1) task 조회
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 조회 실패 — 작업 없음: %', p_task_id;
  END IF;

  -- 2) principal_code 조회
  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 조회 실패 — principal_id=%', v_task.principal_id;
  END IF;

  -- 3) task_items 총수량 — ★ v15: is_canceled=true 제외
  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  IF v_total_qty = 0 THEN
    RAISE EXCEPTION 'task_items 없음 (전 품목 취소 또는 미생성): task_id=%', p_task_id;
  END IF;

  -- 4) fallback unit price
  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  -- 5) task_items 순회 — ★ v15: is_canceled=true 제외
  FOR v_item IN
    SELECT
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
      AND NOT COALESCE(ti.is_canceled, false)
  LOOP
    v_qty := COALESCE(v_item.qty, 1)::int;
    v_unit_price := CASE
      WHEN COALESCE(v_item.unit_price, 0) > 0 AND v_item.unit_price <> COALESCE(v_task.product_price, 0)
      THEN v_item.unit_price
      ELSE v_fallback_unit
    END;
    v_service_code := v_item.service_code;
    v_appliance_code := v_item.appliance_code;

    -- v11: usol_n + order_type='추가선택' + refrigerant → addon 변환
    IF v_principal_code = 'usol_n'
       AND v_item.order_type = '추가선택'
       AND COALESCE(v_service_code, '') = 'refrigerant' THEN
      v_service_code := 'addon';
      v_appliance_code := '냉매점검';
    END IF;

    -- v10: refrigerant 외 service_code 감지 (트랙 분류용)
    IF COALESCE(v_service_code, '') != 'refrigerant' THEN
      v_has_non_refrigerant := true;
    END IF;

    -- probe — 1대분 (extra=0) → calc_method 결정
    v_calc_result := calculate_commission(
      v_principal_code, v_service_code, v_appliance_code,
      v_unit_price, 0, 0, NULL
    );

    IF NOT (v_calc_result ->> 'ok')::boolean THEN
      RAISE EXCEPTION 'calculate_commission 실패: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
    v_is_fixed := v_calc_method = '정액';

    -- v13: 비율_견적금액 + refrigerant → 비율형
    IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
      v_is_ratio := true;
    END IF;

    -- v9: 세척 추가금 spec
    IF v_service_code = 'cleaning' THEN
      v_item_extra := 0;

      IF NOT v_cleaning_extra_applied THEN
        IF v_principal_code = 'usol_n' THEN
          v_cleaning_principal_bonus := FLOOR(COALESCE(v_task.extra_fee, 0) * 0.15)::int;
          v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0) - v_cleaning_principal_bonus;
        ELSE
          v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0);
          v_cleaning_principal_bonus := 0;
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

    -- v14 (Migration 050): refrigerant + assigned 기사 기준 engineer_rate 적용
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

    -- engineer 합산
    v_total_engineer := v_total_engineer + (v_eng * v_mult);

    -- principal 합산 — 정액형은 1작업당 1번
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

  -- v9: 세척 추가금 (루프 종료 후 1회 합산)
  v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
  v_total_principal := v_total_principal + v_cleaning_principal_bonus;

  -- v12 (Migration 048): travel_fee 측 기사 100%
  v_total_engineer := v_total_engineer + COALESCE(v_task.travel_fee, 0);

  -- 6) owner 계산
  --   usol_n: SUM(ti.subtotal) — 070 subtotal CASE 효과로 자동 미취소만 합산.
  --   별도 WHERE is_canceled=false 필터 불필요(중복 안전).
  IF v_principal_code = 'usol_n' THEN
    SELECT COALESCE(SUM(ti.subtotal), 0)::int INTO v_total_settle
    FROM task_items ti WHERE ti.task_id = p_task_id;

    v_total_owner := v_total_settle
                   + COALESCE(v_task.extra_fee, 0)
                   + COALESCE(v_task.travel_fee, 0)
                   - v_total_engineer
                   - v_total_principal;
  ELSE
    v_total_owner := COALESCE(v_task.product_price, 0)
                   + COALESCE(v_task.extra_fee, 0)
                   + COALESCE(v_task.travel_fee, 0)
                   - v_total_engineer
                   - v_total_principal;
  END IF;

  -- v10: 자금 흐름 트랙 분기
  IF v_principal_code = 'usol_n' AND v_has_non_refrigerant THEN
    v_track := 'B';
  ELSE
    v_track := 'A';
  END IF;

  -- 7) payments UPSERT (DELETE + INSERT — idempotent)
  DELETE FROM payments WHERE task_id = p_task_id;
  INSERT INTO payments (
    task_id, computed_by,
    policy_key, calc_method,
    product_price, extra_fee, travel_fee, naver_fee,
    engineer_amount, principal_amount, owner_amount,
    status,
    track
  ) VALUES (
    p_task_id, auth.uid(),
    v_last_policy_key, v_last_calc_method,
    CASE
      WHEN v_principal_code = 'usol_n' THEN v_total_settle
      ELSE COALESCE(v_task.product_price, 0)
    END,
    COALESCE(v_task.extra_fee, 0),
    COALESCE(v_task.travel_fee, 0),
    0,
    v_total_engineer, v_total_principal, v_total_owner,
    '미정산',
    v_track
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION compute_payment(uuid) IS
  'v15 (Migration 071) — task_items.is_canceled=true 제외 (070 도입). 측 v14(050) 본체 spec 측 유지 / FOR LOOP WHERE 절 측 필터만 추가.';

-- ============================================
-- [2] compute_engineer_amount_per_item v2 (Migration 065 본문 + 패치 1지점)
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
BEGIN
  -- 1) task 조회
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 조회 실패 — 작업 없음: %', p_task_id;
  END IF;

  -- 2) principal_code 조회
  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 조회 실패 — principal_id=%', v_task.principal_id;
  END IF;

  -- 3) task_items 총수량 — ★ v2: is_canceled=true 제외
  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  IF v_total_qty = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 4) fallback unit price
  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  -- 5) task_items 순회 — ★ v2: is_canceled=true 제외
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

    -- v11: usol_n + 추가선택 + refrigerant → addon
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

    -- v13: 비율_견적금액 + refrigerant → is_ratio
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

    -- v14: refrigerant + assigned 기사 기준 engineer_rate 적용
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

    -- 첫 cleaning item에 cleaning_bonus 합산
    IF v_service_code = 'cleaning' AND v_first_cleaning_item THEN
      v_eng_for_item := v_eng_for_item + v_cleaning_engineer_bonus;
      v_first_cleaning_item := false;
    END IF;

    -- v12: travel_fee 측 기사 100% — 첫 item 측 귀속
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
  'v2 (Migration 071) — task_items.is_canceled=true 제외. 측 v1(065) 측 compute_payment v14 FOR LOOP 재사용 spec 측 유지.';

COMMIT;

-- ============================================================================
-- 검증 SQL (적용 후 별도 실행)
-- ============================================================================
-- A. 함수 코멘트 측 v15 / v2 표기 확인:
-- SELECT proname, obj_description(oid, 'pg_proc')
-- FROM pg_proc WHERE proname IN ('compute_payment', 'compute_engineer_amount_per_item');
--
-- B. 측 6 원청 회귀 확인 — is_canceled 행 0건 task 다수 측 v14→v15 차이 0:
-- WITH sample AS (
--   SELECT t.id FROM tasks t
--   JOIN payments p ON p.task_id = t.id
--   WHERE NOT EXISTS (SELECT 1 FROM task_items ti WHERE ti.task_id = t.id AND ti.is_canceled)
--   ORDER BY random() LIMIT 20
-- ),
-- before AS (
--   SELECT task_id, engineer_amount AS eng_b, principal_amount AS prin_b, owner_amount AS own_b
--   FROM payments WHERE task_id IN (SELECT id FROM sample)
-- )
-- SELECT s.id,
--   b.eng_b, b.prin_b, b.own_b,
--   (SELECT engineer_amount FROM payments WHERE task_id = s.id) AS eng_a,
--   (SELECT principal_amount FROM payments WHERE task_id = s.id) AS prin_a,
--   (SELECT owner_amount    FROM payments WHERE task_id = s.id) AS own_a
-- FROM sample s LEFT JOIN before b ON b.task_id = s.id;
-- 기대: eng_b=eng_a / prin_b=prin_a / own_b=own_a 전 행 (재계산 결과 동일).
--
-- ※ 사장님 정정: 본 검증은 071 적용 직후 compute_payment 명시 호출 없이는 payments
--   변화 없음. 명시 호출 후 비교 (스냅샷 → 재계산 → 비교).
--
-- C. 안효정 task (070 + 072 백필 후) — payments.product_price=69412 / engineer_amount=44000.
