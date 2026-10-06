-- ============================================================================
-- Migration 216c - compute_payment v30.1: 협력사 정산은 실제 받은 금액 기준 (견적 보존)
-- 작성 2026-10-06 · 선행: 215, 216b
--
-- 216b 대비 바뀐 곳: 협력사 분기 "안쪽" 두 군데뿐입니다.
--   (1) 합계 = 실제 금액(tasks.received_total). 없을 때만 견적 + 추가금 + 출장비.
--       -> 견적보다 적게 받아도 견적 금액을 고치지 않고 실제 금액으로 정산합니다.
--   (2) payments 의 금액 칸: 실제 합계를 product_price 칸에 쓰고 추가금·출장비 칸은 0.
--       (세 칸의 합 = 협력사 몫 + 수수료 가 유지됩니다. tasks 의 견적은 그대로 남습니다)
--   수수료 계산식(공급가액 x 율, 원 단위 반올림)은 216b 와 같습니다.
--
-- 분기 밖(직영·원청 경로)은 v29 본문 그대로입니다 - 이 파일도 mig 200 본문에서 자동으로
-- 만들었고 "분기 블록과 변수 선언을 빼면 v29 와 완전히 같다" 를 만들 때 검사했습니다.
-- 따라서 드라이런 [1] (v29 = v30, 0행) 결론은 그대로 유효합니다.
--
-- 기존 데이터 영향: 없음 (함수 교체만, 기존 payments 재계산 없음).
-- ============================================================================

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
  v_row_product_price    int;
  v_is_visit_only        boolean := false;
  v_new_travel_rule      boolean := false;
  v_travel_eng           int := 0;
  v_install_only         boolean := true;
  v_material             int := 0;
  v_install_base         int := 0;
  -- Mig 200 (2026-07-29) - install engineer share, date-gated.
  v_install_rate         numeric := 0.75;
  -- Mig 216 (v30) - 협력사 분기용 변수. 아래 v29 본문에서는 쓰지 않는다.
  v_sub_rule             fee_rules%ROWTYPE;
  v_sub_service          text;
  v_sub_total            int := 0;
  v_sub_supply           int := 0;
  v_sub_base             int := 0;
  v_sub_fee              int := 0;
  v_sub_eng              int := 0;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found: %', p_task_id;
  END IF;

  -- ==========================================================================
  -- Mig 216c (v30.1) - 협력사 작업 분기. tasks.subcontractor_id 가 있을 때만 들어온다.
  --   이 블록 밖(아래)은 v29 본문 그대로다. 직영·원청 작업은 이 블록을 건너뛴다.
  --   수수료 = fee_rules 의 규칙 (율이면 기준금액 x 율, 원 단위 반올림 / 정액이면 그 금액)
  --   기준금액: fee_base = supply -> 공급가액(tasks.supply_amount), gross -> 고객 결제 합계
  --   저장: owner_amount = 수수료, engineer_amount = 합계 - 수수료(협력사 보유분), track = 'S'
  -- ==========================================================================
  IF v_task.subcontractor_id IS NOT NULL THEN
    SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;

    SELECT st.code INTO v_sub_service
      FROM task_items ti
      LEFT JOIN work_types wt    ON wt.id = ti.work_type_id
      LEFT JOIN service_types st ON st.id = wt.service_type_id
     WHERE ti.task_id = p_task_id
       AND NOT COALESCE(ti.is_canceled, false)
     ORDER BY (ti.order_type = '본작업') DESC NULLS LAST, ti.unit_price DESC NULLS LAST
     LIMIT 1;

    SELECT * INTO v_sub_rule
      FROM fee_rules f
     WHERE f.tenant_id        = v_task.tenant_id
       AND f.subcontractor_id = v_task.subcontractor_id
       AND f.active
       AND f.effective_from <= (COALESCE(v_task.completed_at, now()) AT TIME ZONE 'Asia/Seoul')::date
       AND (f.principal_code IS NULL OR f.principal_code = v_principal_code)
       AND (f.service_code   IS NULL OR f.service_code   = v_sub_service)
     ORDER BY (f.principal_code IS NOT NULL)::int + (f.service_code IS NOT NULL)::int DESC,
              f.effective_from DESC
     LIMIT 1;

    IF v_sub_rule.id IS NULL THEN
      RAISE EXCEPTION '협력사 수수료 규칙이 없습니다 (task %, 협력사 %)', p_task_id, v_task.subcontractor_id;
    END IF;

    -- 고객 결제 합계 = 직원이 입력한 실제 금액(received_total = 공급가 + 부가세).
    --   접수 견적(product_price)은 보존만 하고 정산에는 쓰지 않는다 (2026-10-06 사장님 결정).
    --   실제 금액이 아직 없을 때만 견적 + 추가금 + 출장비로 대신한다.
    v_sub_total := COALESCE(NULLIF(v_task.received_total, 0),
                            COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0) + COALESCE(v_task.travel_fee, 0));
    -- 공급가액: 직원 입력값. 없으면 합계에서 부가세 10% 를 뺀 값으로 추정.
    v_sub_supply := COALESCE(NULLIF(v_task.supply_amount, 0), ROUND(v_sub_total / 1.1)::int);
    v_sub_base   := CASE WHEN v_sub_rule.fee_base = 'gross' THEN v_sub_total ELSE v_sub_supply END;

    IF v_task.status = '취소' THEN
      v_sub_fee := 0;
      v_sub_eng := 0;
    ELSE
      v_sub_fee := CASE
        WHEN v_sub_rule.fee_type = 'rate' THEN ROUND(v_sub_base * v_sub_rule.fee_rate)::int
        ELSE COALESCE(v_sub_rule.fee_amount, 0)
      END;
      v_sub_fee := LEAST(GREATEST(v_sub_fee, 0), GREATEST(v_sub_total, 0));
      v_sub_eng := GREATEST(v_sub_total - v_sub_fee, 0);
    END IF;

    UPDATE payments SET
      computed_at      = now(),
      computed_by      = auth.uid(),
      policy_key       = 'fee_rule:' || v_sub_rule.id::text,
      calc_method      = '협력사_수수료',
      product_price    = v_sub_total,
      extra_fee        = 0,
      travel_fee       = 0,
      naver_fee        = 0,
      engineer_amount  = v_sub_eng,
      principal_amount = 0,
      owner_amount     = v_sub_fee,
      track            = 'S'
    WHERE task_id = p_task_id
      AND track   = 'S'
    RETURNING id INTO v_payment_id;

    IF v_payment_id IS NULL THEN
      DELETE FROM payments WHERE task_id = p_task_id;
      INSERT INTO payments (
        task_id, computed_by, policy_key, calc_method,
        product_price, extra_fee, travel_fee, naver_fee,
        engineer_amount, principal_amount, owner_amount,
        status, track
      ) VALUES (
        p_task_id, auth.uid(), 'fee_rule:' || v_sub_rule.id::text, '협력사_수수료',
        v_sub_total, 0, 0, 0,
        v_sub_eng, 0, v_sub_fee,
        '미정산', 'S'
      )
      RETURNING id INTO v_payment_id;
    END IF;

    RETURN v_payment_id;
  END IF;
  -- ===================== v30 분기 끝 - 이하 v29 본문 그대로 =====================

  v_new_travel_rule := COALESCE(v_task.completed_at, now())
                       >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz;
  v_travel_eng := CASE WHEN v_new_travel_rule
                       THEN FLOOR(COALESCE(v_task.travel_fee, 0) * 0.6)::int
                       ELSE COALESCE(v_task.travel_fee, 0) END;

  -- Mig 200 - 2026-07-29 00:00 KST onward: engineer 80% (was 75%).
  --   Older completions keep 75% so past settlements do not move when a task
  --   is recomputed for an unrelated reason (same policy as Mig 177 / Mig 198).
  v_install_rate := CASE
    WHEN COALESCE(v_task.completed_at, now())
         >= '2026-07-29 00:00:00 Asia/Seoul'::timestamptz THEN 0.80
    ELSE 0.75
  END;

  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code not found: %', v_task.principal_id;
  END IF;

  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  v_canceled_active := (v_task.status = '취소');

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

      IF v_service_code = 'visit_fee' THEN
        v_is_visit_only := true;
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

      IF v_calc_method = '비율_견적금액' AND v_service_code IN ('refrigerant', 'leak', 'water_leak') THEN
        v_is_ratio := true;
      END IF;

      IF v_service_code NOT IN ('refrigerant', 'leak', 'water_leak') OR v_calc_method = 'usol_n_추가선택' THEN
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

      IF v_calc_method IS DISTINCT FROM '직영_75_25' THEN
        v_install_only := false;
      END IF;

      v_last_calc_method := v_calc_method;
      v_last_policy_key  := v_calc_result ->> 'policy_key';
    END LOOP;

    IF NOT v_use_phase_c THEN
      v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
      v_total_principal := v_total_principal + v_cleaning_principal_bonus;
    END IF;

    -- ========================================================================
    -- Mig 198 (material cost) + Mig 200 (rate 0.75 -> 0.80, date-gated).
    --   base     = product_price + extra_fee - material_cost
    --   engineer = material_cost + FLOOR(base * v_install_rate)
    --   company  = the rest (owner formula below). principal = 0.
    -- ========================================================================
    IF v_any_active_item AND v_install_only AND v_last_calc_method = '직영_75_25' THEN
      v_material := LEAST(
        GREATEST(COALESCE(v_task.material_cost, 0), 0),
        GREATEST(COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0), 0)
      );
      v_install_base := GREATEST(
        COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0) - v_material, 0
      );
      v_total_engineer  := v_material + FLOOR(v_install_base * v_install_rate)::int;
      v_total_principal := 0;
    END IF;

    IF NOT v_is_visit_only THEN
      v_total_engineer := v_total_engineer + v_travel_eng;
    END IF;

    IF v_any_active_item AND v_pure_refrigerant
       AND v_task.assigned_engineer_id IS NOT NULL THEN
      SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate_task
      FROM users WHERE id = v_task.assigned_engineer_id;

      IF v_engineer_rate_task >= 100 THEN
        v_total_engineer := COALESCE(v_task.product_price, 0)
                          + COALESCE(v_task.extra_fee, 0)
                          - v_total_principal
                          + v_travel_eng;
      ELSE
        v_total_engineer := FLOOR(
          (COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0))::numeric
          * v_engineer_rate_task / 100
        )::int + v_travel_eng;
      END IF;
    END IF;

    IF v_is_visit_only AND v_new_travel_rule THEN
      v_total_engineer := FLOOR(v_total_engineer * 0.6)::int;
    END IF;

    IF v_principal_code = 'usol_n' THEN
      SELECT COALESCE(SUM(ti.subtotal), 0)::int INTO v_total_settle
      FROM task_items ti WHERE ti.task_id = p_task_id;

      v_total_owner := v_total_settle
                     + COALESCE(v_task.extra_fee, 0)
                     + (CASE WHEN v_is_visit_only THEN 0 ELSE COALESCE(v_task.travel_fee, 0) END)
                     - v_total_engineer
                     - v_total_principal;
    ELSE
      v_total_owner := COALESCE(v_task.product_price, 0)
                     + COALESCE(v_task.extra_fee, 0)
                     + (CASE WHEN v_is_visit_only AND NOT v_new_travel_rule THEN 0
                             ELSE COALESCE(v_task.travel_fee, 0) END)
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

  v_row_product_price := CASE
    WHEN v_principal_code = 'usol_n' THEN v_total_settle
    ELSE COALESCE(v_task.product_price, 0)
  END;

  v_payment_id := NULL;

  UPDATE payments SET
    computed_at      = now(),
    computed_by      = auth.uid(),
    policy_key       = v_last_policy_key,
    calc_method      = v_last_calc_method,
    product_price    = v_row_product_price,
    extra_fee        = COALESCE(v_task.extra_fee, 0),
    travel_fee       = COALESCE(v_task.travel_fee, 0),
    naver_fee        = 0,
    engineer_amount  = v_total_engineer,
    principal_amount = v_total_principal,
    owner_amount     = v_total_owner,
    track            = v_track
  WHERE task_id = p_task_id
    AND track   = v_track
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
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
      v_row_product_price,
      COALESCE(v_task.extra_fee, 0),
      COALESCE(v_task.travel_fee, 0),
      0,
      v_total_engineer, v_total_principal, v_total_owner,
      '미정산',
      v_track
    )
    RETURNING id INTO v_payment_id;
  END IF;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_payment(uuid) TO anon, authenticated;

COMMENT ON FUNCTION compute_payment(uuid) IS
  'v30.1 (Migration 216c, 2026-10-06) - v29 + 협력사 분기 (fee_rules, track S, 실제 받은 금액 기준 · 견적 보존). 직영·원청 경로는 v29 그대로.';

COMMIT;

-- 검증: 기대 'v30.1 (Migration 216c ...'
SELECT obj_description('compute_payment(uuid)'::regprocedure);
