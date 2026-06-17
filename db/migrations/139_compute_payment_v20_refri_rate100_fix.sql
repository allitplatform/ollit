-- ============================================
-- Migration 139 — compute_payment v20
--                 정액 + refrigerant + rate >= 100 + extra > 0 사고 정정
-- 작성 : 2026-06-17
-- 실행 : Supabase 콘솔 → SQL Editor → 통째 → Run (CREATE OR REPLACE = idempotent)
-- ============================================
--
-- 변경 (v19 → v20):
--   task-level override 분기에 rate >= 100 케이스 추가. v19 본문 외 0 변경.
--   commission_policies 무변경.
--
--   옛 (v19, line 320~332):
--     IF v_pure_refrigerant AND rate < 100 THEN
--       v_total_engineer := FLOOR((product + extra) * rate / 100) + travel;
--     END IF;
--
--   새 (v20):
--     IF v_pure_refrigerant THEN
--       IF rate >= 100 THEN
--         v_total_engineer := product + extra - v_total_principal + travel;
--       ELSE
--         v_total_engineer := FLOOR((product + extra) * rate / 100) + travel;
--       END IF;
--     END IF;
--
-- 사고 케이스 (정액 + product=70000 + extra=110000 + rate=100):
--   v19: eng=60000 / prin=10000 / own=110000   (회사로 extra 110000 샘)
--   v20: eng=170000 / prin=10000 / own=0       (정정)
--
-- 회귀 보호 (수학적 검증):
--   · 정액 + rate < 100  → 옛 task-level override 그대로 (변화 0)
--   · 정액 + rate >= 100 + extra = 0 → v_total_principal = 정액 fee → engineer = product - prin
--     = 옛 in-loop 결과 동일 (변화 0)
--   · 비율형 (비율_총금액 / 비율_견적금액 / 직영_50_50) + rate >= 100 →
--     in-loop 결과 = engineer = total - prin = task-level override 새 산식과 동일 (변화 0)
--   · Mixed task (refri + 비-refri) → v_pure_refrigerant = false → override 미진입 → v18 그대로
--   · usol_n_추가선택 → v_pure_refrigerant = false (계산 method check) → 영향 0
--
-- 의존:
--   · 096 (v19 / v5)
--   · 050 (refrigerant_rate apply / users.refrigerant_rate)
--
-- 백필:
--   사장님 별도 SELECT 측 영향 작업 식별 후 compute_payment(uuid) 일괄 호출.
-- ============================================

BEGIN;

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
  v_canceled_active boolean := false;
  v_use_phase_c   boolean := false;
  v_row_subtotal  int;
  v_row_received  int;
  v_row_extra     int;
  v_phase_c_eng_extra  int;
  v_phase_c_prin_extra int;
  v_qty_cond      text;
  v_pure_refrigerant     boolean := true;
  v_any_active_item      boolean := false;
  v_engineer_rate_task   int;
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

  v_canceled_active := (v_task.status = '취소' AND v_task.cancel_engineer_comp_kind IS NOT NULL);

  IF v_total_qty = 0 AND NOT v_canceled_active THEN
    RAISE EXCEPTION 'no active task_items: %', p_task_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM task_items
    WHERE task_id = p_task_id
      AND NOT COALESCE(is_canceled, false)
      AND received_amount IS NOT NULL
  ) INTO v_use_phase_c;

  IF v_total_qty > 0 THEN
    v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

    FOR v_item IN
      SELECT
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
    LOOP
      v_any_active_item := true;
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

      IF COALESCE(v_service_code, '') != 'refrigerant' THEN
        v_has_non_refrigerant := true;
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

      v_total_engineer := v_total_engineer + (v_eng * v_mult);

      IF v_use_phase_c
         AND v_service_code = 'cleaning'
         AND v_item_extra > 0
         AND v_calc_method IN ('직영_0', '비율_견적금액', '정액') THEN
        IF v_principal_code = 'usol_n' THEN
          v_phase_c_prin_extra := FLOOR(v_item_extra * 0.15)::int;
          v_phase_c_eng_extra  := v_item_extra - v_phase_c_prin_extra;
          v_total_engineer  := v_total_engineer  + v_phase_c_eng_extra;
          v_total_principal := v_total_principal + v_phase_c_prin_extra;
        ELSE
          v_total_engineer := v_total_engineer + v_item_extra;
        END IF;
      END IF;

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

    IF NOT v_use_phase_c THEN
      v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
      v_total_principal := v_total_principal + v_cleaning_principal_bonus;
    END IF;

    v_total_engineer := v_total_engineer + COALESCE(v_task.travel_fee, 0);

    -- ============================================
    -- v20 (Migration 139): task-level override
    --   pure_refrigerant + rate >= 100 → 정정 분기 추가
    --   pure_refrigerant + rate <  100 → 기존 v19 산식 유지
    -- ============================================
    IF v_any_active_item AND v_pure_refrigerant
       AND v_task.assigned_engineer_id IS NOT NULL THEN
      SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate_task
      FROM users WHERE id = v_task.assigned_engineer_id;

      IF v_engineer_rate_task >= 100 THEN
        v_total_engineer := COALESCE(v_task.product_price, 0)
                          + COALESCE(v_task.extra_fee, 0)
                          - v_total_principal
                          + COALESCE(v_task.travel_fee, 0);
      ELSE
        v_total_engineer := FLOOR(
          (COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0))::numeric
          * v_engineer_rate_task / 100
        )::int + COALESCE(v_task.travel_fee, 0);
      END IF;
    END IF;

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

    v_total_owner := GREATEST(v_total_owner, 0);

    IF v_principal_code = 'usol_n' AND v_has_non_refrigerant THEN
      v_track := 'B';
    ELSE
      v_track := 'A';
    END IF;
  END IF;

  IF v_canceled_active THEN
    v_total_engineer  := COALESCE(v_task.cancel_engineer_comp_amount, 0);
    v_total_principal := 0;
    v_total_owner     := 0 - v_total_engineer;
    v_last_calc_method := COALESCE(v_last_calc_method, '취소_수고비');
    v_last_policy_key  := COALESCE(v_last_policy_key, 'cancel_compensation');
    IF v_track IS NULL THEN v_track := 'A'; END IF;
  END IF;

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
  'v20 (Migration 139, 2026-06-17) — task-level override 가 rate >= 100 케이스도 처리. '
  '정액 + refrigerant + rate >= 100 + extra > 0 사고 정정 (engineer = product + extra - principal + travel, owner = 0). '
  'commission_policies 무변경. v19 본문 외 0 변경.';

COMMIT;

-- ============================================
-- Verify (별도 실행)
-- ============================================
--
-- A. 함수 코멘트 확인 — v20 표기:
-- SELECT proname, obj_description(oid, 'pg_proc') AS note
-- FROM pg_proc WHERE proname = 'compute_payment';
-- 기대: 'v20 (Migration 139, 2026-06-17) ...'
--
-- B. 핵심 사고 케이스 시뮬 (ROLLBACK 안전):
--    영향받는 task 1건 골라 재호출 → engineer 증가, owner 0 확인.
-- BEGIN;
--   SELECT compute_payment('<task_uuid>'::uuid);
--   SELECT engineer_amount, principal_amount, owner_amount, calc_method
--   FROM payments WHERE task_id = '<task_uuid>'::uuid;
-- ROLLBACK;
-- 기대 (product=70000 / extra=110000 / rate=100):
--   engineer_amount = 170000 (옛 60000)
--   principal_amount = 10000 (불변)
--   owner_amount = 0 (옛 110000)
--
-- C. 회귀 검증 — 기존 정상 작업 5건 sample:
-- WITH s AS (
--   SELECT t.id, p.engineer_amount AS e_old, p.principal_amount AS p_old, p.owner_amount AS o_old
--   FROM tasks t JOIN payments p ON p.task_id = t.id
--   WHERE t.status IN ('완료', '확정')
--     AND p.calc_method NOT IN ('정액', 'usol_n_추가선택')
--   ORDER BY random() LIMIT 5
-- )
-- SELECT s.id, s.e_old, s.p_old, s.o_old, compute_payment(s.id) AS new_pid FROM s;
-- 적용 후 SELECT 측 diff 0 기대.
--
-- D. 정액 + rate < 100 회귀 검증:
-- WITH s AS (
--   SELECT t.id FROM tasks t JOIN payments p ON p.task_id = t.id
--   JOIN users u ON u.id = t.assigned_engineer_id
--   WHERE p.calc_method = '정액' AND COALESCE(u.refrigerant_rate, 50) < 100
--     AND EXISTS (SELECT 1 FROM task_items ti
--                 JOIN work_types wt ON wt.id = ti.work_type_id
--                 JOIN service_types st ON st.id = wt.service_type_id
--                 WHERE ti.task_id = t.id AND st.code = 'refrigerant')
--   ORDER BY random() LIMIT 3
-- )
-- SELECT compute_payment(s.id), * FROM s;
-- 적용 전후 비교 시 동일 결과 기대.
--
-- ============================================
-- 롤백 (위급 시):
--   db/migrations/096_compute_payment_v19_refrigerant_simple.sql 본문 재실행.
--   CREATE OR REPLACE = idempotent.
-- ============================================
