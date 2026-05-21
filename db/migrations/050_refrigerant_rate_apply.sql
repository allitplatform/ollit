-- 050_refrigerant_rate_apply.sql
-- 2026-05-21 — compute_payment v14: 기사별 냉매 비율 (refrigerant_rate) 적용
--
-- 사장님 spec 확정:
--   냉매충전 작업, 기사별 비율 (users.refrigerant_rate):
--     · 일반 11명 = rate 50 → 기사 = total × 50% (= 잔여 50% 측 결과 측 동일)
--     · A그룹 15명 = rate 60 → 기사 = total × 60%
--     · B그룹 (구현서 / 조동욱) = rate 100 → 기사 = total - principal (= 잔여 전액 / 회사 0)
--
--   적용 대상: service_code='refrigerant' 측 task (usol_n_냉매점검 포함)
--   제외 조건: usol_n_추가선택 (= 측 측 v_service_code='addon' 측 변환 측 측 / 안전망 측 측)
--   원청 측 = 정책대로 (= calculate_commission 결과 측 측 측)
--
-- 옛 spec (v13 / Migration 049 / 측 측):
--   refrigerant 측 측 = engineer = v_total / 2 (= 50:50 고정)
--   → users.refrigerant_rate 측 측 측 측 X
--   → A그룹 60% / B그룹 100% 측 측 측 X
--
-- 새 spec (v14 / 이 Migration):
--   IF service_code='refrigerant' AND assigned_engineer_id IS NOT NULL THEN
--     SELECT refrigerant_rate → v_engineer_rate
--     IF rate >= 100: v_eng = v_total_calc - v_prin
--     ELSE:           v_eng = v_total_calc × rate / 100
--   END IF;
--
-- 검증 (우장산 A-260521-002 / total=230,000 / principal=35,000):
--   rate 50  → engineer 115,000 / company 80,000   (= Migration 049 측 결과 측 동일)
--   rate 60  → engineer 138,000 / company 57,000   (= 측 측)
--   rate 100 → engineer 195,000 / company 0        (= 측 측 / 전액)
--
-- 변경 범위 — v13 측 측 측 측 측측 측만 추가:
--   1) DECLARE 2줄 추가: v_engineer_rate int; v_total_calc int;
--   2) IF 블록 측 12줄 추가 (v_eng/v_prin/v_mult 산출 측측)
--
-- 회귀 방지:
--   - 세척 (cleaning) → IF 측 측 X / 측 그대로
--   - 추가선택 (addon) → IF 측 측 X / 측 그대로
--   - 출장비 (visit_fee) → IF 측 측 X / 측 그대로
--   - rate=50 + 측 6 원청 / usol_n_냉매점검 = 측 v13 결과 측 동일 (= total/2)
--   - rate=60/100 + 냉매 = 측 측 (= 측 의도)
--   - assigned_engineer_id NULL task = IF 측 측 X / 측 그대로
--   - travel_fee 측 측 (v12) = 측 그대로
--   - '비율_견적금액' + refrigerant extra 측 측 (v13) = 측 그대로 (= v_is_ratio 측 측 측 변경 X)
--
-- 의존:
--   - Migration 046 (compute_payment v11 / usol_n)
--   - Migration 047 (calculate_commission v7 / usol_n_냉매점검 50/50)
--   - Migration 048 (compute_payment v12 / travel_fee)
--   - Migration 049 (compute_payment v13 / '비율_견적금액' refrigerant extra)
--
-- 실행:
--   - Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   - CREATE OR REPLACE FUNCTION 측 재실행 안전 (idempotent)
--
-- 측 재계산 (Migration 050 측 측):
--   SELECT compute_payment(t.id) FROM tasks t
--   WHERE EXISTS (
--     SELECT 1 FROM task_items ti
--     JOIN work_types wt ON wt.id = ti.work_type_id
--     JOIN service_types st ON st.id = wt.service_type_id
--     WHERE ti.task_id = t.id AND st.code = 'refrigerant'
--   );

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
  -- v14 (Migration 050): 기사별 냉매 비율 적용용
  v_engineer_rate int;
  v_total_calc    int;
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

    -- v13 (Migration 049): '비율_견적금액' + refrigerant 측 측 = 비율형 처리 (extra 50/50)
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

    -- 2026-05-21 Migration 050 (v14 / 사장님 spec 확정):
    --   refrigerant 측 측 = 기사별 비율 (refrigerant_rate) 적용 — usol_n_냉매점검 포함
    --     rate >= 100: 기사 = total - principal (잔여 전액 / 회사 0)
    --     rate <  100: 기사 = total × rate / 100 (전체 기준)
    --   적용 측 측: service_code='refrigerant' AND calc_method != 'usol_n_추가선택' AND assigned 측
    --   ⭐ usol_n_추가선택 측 = 라인 130-134 측 측 v_service_code='addon' 측 변환 → IF 측 측 측 X
    --      `calc_method != 'usol_n_추가선택'` 측 측 측 측 측 안전망 (= 변환 측 측 측 측)
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
  'v14 (Migration 050) — refrigerant 측 측 = rate>=100 측 total-principal / 측 측 total×rate/100. usol_n_냉매점검 포함 / usol_n_추가선택 제외. 측 v13 측 spec 측 spec.';

-- ============================================
-- 검증 SQL (별도 실행 spec / Migration 050 적용 후)
-- ============================================

-- 1) v14 적용 확인
-- SELECT obj_description(p.oid, 'pg_proc') AS comment
-- FROM pg_proc p WHERE p.proname = 'compute_payment';
-- 기대: 'v14 (Migration 050) — refrigerant 측 측 = rate>=100 측 ...'

-- 2) 우장산 (A-260521-002 / KA 투인원 냉매 / total=230,000 / principal=35,000) 재계산
-- SELECT compute_payment(t.id) FROM tasks t WHERE t.task_no = 'A-260521-002';
-- SELECT t.task_no,
--        u.code AS engineer_code, u.refrigerant_rate,
--        t.product_price, t.extra_fee, t.total_amount,
--        p.engineer_amount, p.principal_amount, p.owner_amount, p.is_balanced
-- FROM tasks t
-- JOIN payments p ON p.task_id = t.id
-- LEFT JOIN users u ON u.id = t.assigned_engineer_id
-- WHERE t.task_no = 'A-260521-002';
-- 기대 (rate별):
--   rate 50  → engineer 115,000 / principal 35,000 / owner 80,000
--   rate 60  → engineer 138,000 / principal 35,000 / owner 57,000
--   rate 100 → engineer 195,000 / principal 35,000 / owner 0

-- 3) rate별 측 측 측 측 task 측
-- SELECT u.code, u.name, u.refrigerant_rate, COUNT(t.id) AS refrigerant_tasks
-- FROM users u
-- LEFT JOIN tasks t ON t.assigned_engineer_id = u.id
--   AND EXISTS (
--     SELECT 1 FROM task_items ti
--     JOIN work_types wt ON wt.id = ti.work_type_id
--     JOIN service_types st ON st.id = wt.service_type_id
--     WHERE ti.task_id = t.id AND st.code = 'refrigerant'
--   )
-- WHERE u.is_active = true
-- GROUP BY u.id, u.code, u.name, u.refrigerant_rate
-- ORDER BY u.refrigerant_rate DESC, u.code;

-- 4) 측 측 냉매 task 재계산
-- SELECT compute_payment(t.id) FROM tasks t
-- WHERE EXISTS (
--   SELECT 1 FROM task_items ti
--   JOIN work_types wt ON wt.id = ti.work_type_id
--   JOIN service_types st ON st.id = wt.service_type_id
--   WHERE ti.task_id = t.id AND st.code = 'refrigerant'
-- );

-- 5) 회귀 측 — 세척 task 측 그대로
-- SELECT t.task_no, p.calc_method, p.engineer_amount, p.principal_amount, p.owner_amount
-- FROM tasks t JOIN payments p ON p.task_id = t.id
-- WHERE EXISTS (
--   SELECT 1 FROM task_items ti
--   JOIN work_types wt ON wt.id = ti.work_type_id
--   JOIN service_types st ON st.id = wt.service_type_id
--   WHERE ti.task_id = t.id AND st.code = 'cleaning'
-- )
-- LIMIT 10;
