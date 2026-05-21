-- 049_billing_ratio_refrigerant_extra.sql
-- 2026-05-21 — compute_payment v13: '비율_견적금액' + refrigerant extra 50:50 정정
--
-- 사장님 spec 확정:
--   KA / crikrin 냉매 task + 현장 추가금 = 50/50 분배 (기사 50% / 회사 50%)
--
-- 옛 spec (v12 / Migration 048 / 잘못됨):
--   v_is_ratio = ('직영_50_50', '차감후비율_50', '비율_총금액')만 포함
--   → '비율_견적금액' (KA / crikrin 냉매) 측 v_is_ratio=false
--   → v_item_extra = 0 측 calculate_commission 호출
--   → extra_fee 측 calc 측 측 X / 측 측 측 owner 측 측 spec (= 회사 100%)
--
-- 새 spec (v13 / 이 Migration):
--   '비율_견적금액' + service_code='refrigerant' 측 측 v_is_ratio=true 측 변경
--   → v_item_extra = extra_fee 측 calculate_commission 호출 (= '비율_견적금액' refrigerant 분기)
--   → v_engineer = v_total/2 = (quoted + extra) / 2 → 50/50 분배 ✅
--
-- 변경 범위 — v12 측 측 측 측 측 IF 측 측만 추가 (라인 156 측):
--   IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
--     v_is_ratio := true;
--   END IF;
--
-- 회귀 방지:
--   - cleaning 측 측 측 X — '비율_견적금액' + cleaning (crikrin 세척) 측 측 그대로
--     · cleaning 측 = v_item_extra = 0 측 측 (cleaning_extra 측 별도 처리)
--     · v_mult = qty 측 측 (= '비율_견적금액' + cleaning 측 = v_is_ratio=false 측 유지)
--   - 측 6 원청 측 측 = 측 그대로 ('직영_50_50' / '차감후비율_50' / '비율_총금액')
--   - usol_n 측 측 = 측 그대로 (usol_n_본작업 / usol_n_추가선택 / usol_n_냉매점검)
--   - KA refrigerant + extra=0 + qty>1 task = 측 측 측 측 측 측 (수식 동일)
--   - travel_fee 측 측 (v12) = 측 그대로
--
-- 의존:
--   - Migration 046 (compute_payment v11 / usol_n 측 측)
--   - Migration 047 (calculate_commission v7 / usol_n_냉매점검 50/50)
--   - Migration 048 (compute_payment v12 / travel_fee 기사 100%)
--
-- 실행:
--   - Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   - CREATE OR REPLACE FUNCTION 측 재실행 안전 (idempotent)
--
-- 검증 (이 Migration 적용 후):
--   - A-260521-002 (우장산 KA 투인원 냉매 / product 100,000 + extra 130,000)
--     → engineer 115,000 / principal 35,000 / owner 80,000 ✅
--   - KA / crikrin 냉매 + extra > 0 측 측 task 측 재계산 spec
--   - 측 cleaning task / 측 6 원청 task = 변동 0건 spec

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
  -- v10 (Fix #29): 자금 흐름 트랙
  v_track                CHAR(1) := 'A';
  v_has_non_refrigerant  boolean := false;
  -- v11 (Stage 0.F-15): usol_n owner 계산용
  v_total_settle         int := 0;
BEGIN
  -- 1) task 조회
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 측 측 측 없음: %', p_task_id;
  END IF;

  -- 2) principal_code 조회
  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 측 측 측 없음: principal_id=%', v_task.principal_id;
  END IF;

  -- 3) task_items 총수량
  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items WHERE task_id = p_task_id;

  IF v_total_qty = 0 THEN
    RAISE EXCEPTION 'task_items 측 측 측 없음: task_id=%', p_task_id;
  END IF;

  -- 4) fallback unit price
  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  -- 5) task_items 순회 — 각 항목별 calculate_commission 호출 + 합산
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
  LOOP
    v_qty := COALESCE(v_item.qty, 1)::int;
    v_unit_price := CASE
      WHEN COALESCE(v_item.unit_price, 0) > 0 AND v_item.unit_price <> COALESCE(v_task.product_price, 0)
      THEN v_item.unit_price
      ELSE v_fallback_unit
    END;
    v_service_code := v_item.service_code;
    v_appliance_code := v_item.appliance_code;

    -- v11 (Stage 0.F-15): usol_n + order_type='추가선택' + service='refrigerant' → addon 변환
    IF v_principal_code = 'usol_n'
       AND v_item.order_type = '추가선택'
       AND COALESCE(v_service_code, '') = 'refrigerant' THEN
      v_service_code := 'addon';
      v_appliance_code := '냉매점검';
    END IF;

    -- v10 (Fix #29): refrigerant 외 service_code 감지 (트랙 분류용)
    IF COALESCE(v_service_code, '') != 'refrigerant' THEN
      v_has_non_refrigerant := true;
    END IF;

    -- probe — 1대분 (extra = 0) → calc_method 결정
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
      RAISE EXCEPTION 'calculate_commission 실패: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
    v_is_fixed := v_calc_method = '정액';

    -- 2026-05-21 Migration 049 (v13 / 사장님 spec 확정):
    --   '비율_견적금액' + refrigerant 측 측 = 비율형 처리 (extra 50/50)
    --   cleaning 측 측 = 측 그대로 유지 (v_is_ratio=false / v_mult=qty / cleaning_extra 측)
    --   → calculate_commission 측 '비율_견적금액' refrigerant 분기 (v_total/2) 측 사용
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

    -- 비율형 재호출: (unit_price * qty + extra) 적용
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
        RAISE EXCEPTION 'calculate_commission 재호출 실패: %', v_calc_result;
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

  -- v9: 세척 추가금 (루프 종료 후 1회 합산)
  v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
  v_total_principal := v_total_principal + v_cleaning_principal_bonus;

  -- v12 (Migration 048): travel_fee 측 기사 100%
  v_total_engineer := v_total_engineer + COALESCE(v_task.travel_fee, 0);

  -- 6) owner 계산
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

  -- v10 (Fix #29): 자금 흐름 트랙 분기
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
  'v13 (Migration 049) — 비율_견적금액 + refrigerant 측 extra 50/50 정정. cleaning 측 측 그대로. 측 v12 측 spec 측 spec.';

-- ============================================
-- 검증 SQL (별도 실행 spec / Migration 049 적용 후)
-- ============================================

-- 1) 우장산 (A-260521-002 / KA 투인원 냉매 / 100,000 + 130,000) 재계산
-- SELECT compute_payment(t.id) FROM tasks t WHERE t.task_no = 'A-260521-002';
-- SELECT t.task_no, t.product_price, t.extra_fee, t.total_amount,
--        p.engineer_amount, p.principal_amount, p.owner_amount, p.is_balanced
-- FROM tasks t JOIN payments p ON p.task_id = t.id
-- WHERE t.task_no = 'A-260521-002';
-- 기대: engineer=115,000 / principal=35,000 / owner=80,000 / is_balanced=true

-- 2) 비율_견적금액 + refrigerant + extra>0 측 task 측 재계산
-- SELECT compute_payment(t.id) FROM tasks t
-- WHERE t.id IN (
--   SELECT DISTINCT t2.id FROM tasks t2
--   JOIN payments p2 ON p2.task_id = t2.id
--   WHERE p2.calc_method = '비율_견적금액'
--     AND t2.extra_fee > 0
--     AND EXISTS (
--       SELECT 1 FROM task_items ti
--       JOIN work_types wt ON wt.id = ti.work_type_id
--       JOIN service_types st ON st.id = wt.service_type_id
--       WHERE ti.task_id = t2.id AND st.code = 'refrigerant'
--     )
-- );

-- 3) 회귀 측 — crikrin 세척 task = 측 그대로
-- SELECT t.task_no, p.calc_method, p.engineer_amount, p.principal_amount, p.owner_amount
-- FROM tasks t JOIN payments p ON p.task_id = t.id
-- JOIN principals pr ON pr.id = t.principal_id
-- WHERE pr.code = 'crikrin' AND p.calc_method = '비율_견적금액'
--   AND EXISTS (
--     SELECT 1 FROM task_items ti
--     JOIN work_types wt ON wt.id = ti.work_type_id
--     JOIN service_types st ON st.id = wt.service_type_id
--     WHERE ti.task_id = t.id AND st.code = 'cleaning'
--   );

-- 4) v13 적용 확인
-- SELECT obj_description(p.oid, 'pg_proc') AS comment
-- FROM pg_proc p WHERE p.proname = 'compute_payment';
-- 기대: comment = 'v13 (Migration 049) — 비율_견적금액 + refrigerant ...'
