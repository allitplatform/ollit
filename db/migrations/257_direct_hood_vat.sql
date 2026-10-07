-- ============================================================================
-- Migration 257 - 직영 주방후드: 부가세 포함 받음 선택
-- 작성 2026-10-07 · 선행: 223(tasks.vat_included), 256
--
-- 사장님 결정 (2026-10-07, 블록 53)
--   직영 기사 완료 화면에서 주방후드 작업일 때만 "부가세 포함해서 받음" 을 고를 수 있다 (기본: 미포함).
--   포함이면 공급가 = 받은 금액 / 1.1. 기사 65% · 수수료 35% 모두 공급가 기준. 부가세만큼은 회사 쪽(owner_amount)에 남는다.
--   다른 종목은 그대로.
--
-- 내용
--   [1] compute_payment (mig 256 본문 + 공급가 계산 1곳. 조각을 빼면 256 본문과 같음을 검사했습니다)
--   [2] engineer_set_hood_vat  기사(본인 배정 작업) 또는 운영자가 부가세 포함 여부를 저장 -> 다시 계산
--
-- 기존 데이터 영향 없음 (vat_included 는 직영 작업에서 지금까지 쓰지 않아 모두 false). 다시 실행해도 안전합니다.
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
  -- Mig 244 (v30.2) - 원청 몫 (협력사 수수료 가운데 원청에 줄 금액). owner_amount 에는 넣지 않는다.
  v_sub_share            int := 0;
  v_sub_share_note       text;
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

    -- Mig 244 (v30.2) - 원청 몫. 규칙에 principal_rate 가 있을 때만 (지금은 쿨가이 KB).
    --   원청 몫 = LEAST(견적 공급가 x 율, 수수료). 견적이 없으면 수수료 전액 + 표시(no_quote).
    --   owner_amount(= 협력사가 올데이케어에 보낼 수수료 전액)는 그대로 둔다 - 올데이케어 실제 몫은 owner - 원청 몫.
    IF v_task.status <> '취소' AND v_sub_rule.principal_rate IS NOT NULL THEN
      v_sub_share := _sub_principal_share(v_task.sub_quote_supply, v_sub_fee, v_sub_rule.principal_rate);
      IF COALESCE(v_task.sub_quote_supply, 0) <= 0 THEN
        v_sub_share_note := 'no_quote';
      END IF;
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
      sub_principal_share = v_sub_share,
      sub_principal_note  = v_sub_share_note,
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
        sub_principal_share, sub_principal_note,
        status, track
      ) VALUES (
        p_task_id, auth.uid(), 'fee_rule:' || v_sub_rule.id::text, '협력사_수수료',
        v_sub_total, 0, 0, 0,
        v_sub_eng, 0, v_sub_fee,
        v_sub_share, v_sub_share_note,
        '미정산', 'S'
      )
      RETURNING id INTO v_payment_id;
    END IF;

    RETURN v_payment_id;
  END IF;
  -- ===================== v30 분기 끝 - 이하 v29 본문 그대로 =====================

  -- ==========================================================================
  -- Mig 256 - 직영 주방후드 분기. 협력사 작업이 아니고(위에서 걸러짐), 종목이 주방후드이고, 취소가 아닐 때만.
  --   구조는 위 협력사 분기와 같다: 수수료 = 규칙(직영 x hood) / 기사 몫 = 공급가 - 수수료 / 원청 몫은 따로.
  --   공급가: tasks.supply_amount 가 있으면 그 값, 없으면 받은 금액(= 견적 + 추가금 + 출장비) 그대로.
  --   저장: owner_amount = 수수료 전액(+ 부가세가 따로 적혀 있으면 그만큼), sub_principal_share = 원청 몫, track = 'A'
  --   규칙이 없으면 아래 v29 본문으로 내려간다 (전과 같은 동작).
  -- ==========================================================================
  IF v_task.status <> '취소'
     AND v_task.category_id IS NOT DISTINCT FROM (SELECT id FROM categories WHERE code = 'hood' LIMIT 1) THEN
    SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;

    SELECT * INTO v_sub_rule
      FROM fee_rules f
     WHERE f.tenant_id = v_task.tenant_id
       AND f.subcontractor_id IS NULL
       AND f.service_code = 'hood'
       AND f.active
       AND f.effective_from <= (COALESCE(v_task.completed_at, now()) AT TIME ZONE 'Asia/Seoul')::date
       AND (f.principal_code IS NULL OR f.principal_code = v_principal_code)
     ORDER BY (f.principal_code IS NOT NULL)::int DESC, f.effective_from DESC
     LIMIT 1;

    IF v_sub_rule.id IS NOT NULL THEN
      v_sub_total  := COALESCE(NULLIF(v_task.received_total, 0),
                               COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0) + COALESCE(v_task.travel_fee, 0));
      -- Mig 257: 부가세 포함해서 받았으면 공급가 = 받은 금액 / 1.1 (협력사 쪽과 같은 식)
      v_sub_supply := CASE WHEN COALESCE(v_task.vat_included, false) THEN ROUND(v_sub_total / 1.1)::int
                           ELSE COALESCE(NULLIF(v_task.supply_amount, 0), v_sub_total) END;
      v_sub_base   := CASE WHEN v_sub_rule.fee_base = 'gross' THEN v_sub_total ELSE v_sub_supply END;
      v_sub_fee := CASE
        WHEN v_sub_rule.fee_type = 'rate' THEN ROUND(v_sub_base * v_sub_rule.fee_rate)::int
        ELSE COALESCE(v_sub_rule.fee_amount, 0)
      END;
      v_sub_fee := LEAST(GREATEST(v_sub_fee, 0), GREATEST(v_sub_supply, 0));
      v_sub_eng := GREATEST(v_sub_supply - v_sub_fee, 0);

      IF v_sub_rule.principal_rate IS NOT NULL THEN
        -- 견적: 보관 견적, 없으면 접수 견적
        v_sub_share := _sub_principal_share(
          COALESCE(v_task.sub_quote_supply, NULLIF(v_task.product_price, 0)), v_sub_fee, v_sub_rule.principal_rate);
        IF COALESCE(v_task.sub_quote_supply, NULLIF(v_task.product_price, 0), 0) <= 0 THEN
          v_sub_share_note := 'no_quote';
        END IF;
      END IF;

      UPDATE payments SET
        computed_at      = now(),
        computed_by      = auth.uid(),
        policy_key       = 'fee_rule:' || v_sub_rule.id::text,
        calc_method      = '직영_주방후드',
        product_price    = COALESCE(v_task.product_price, 0),
        extra_fee        = COALESCE(v_task.extra_fee, 0),
        travel_fee       = COALESCE(v_task.travel_fee, 0),
        naver_fee        = 0,
        engineer_amount  = v_sub_eng,
        principal_amount = 0,
        owner_amount     = GREATEST(v_sub_total - v_sub_eng, 0),
        sub_principal_share = v_sub_share,
        sub_principal_note  = v_sub_share_note,
        track            = 'A'
      WHERE task_id = p_task_id
        AND track   = 'A'
      RETURNING id INTO v_payment_id;

      IF v_payment_id IS NULL THEN
        DELETE FROM payments WHERE task_id = p_task_id;
        INSERT INTO payments (
          task_id, computed_by, policy_key, calc_method,
          product_price, extra_fee, travel_fee, naver_fee,
          engineer_amount, principal_amount, owner_amount,
          sub_principal_share, sub_principal_note,
          status, track
        ) VALUES (
          p_task_id, auth.uid(), 'fee_rule:' || v_sub_rule.id::text, '직영_주방후드',
          COALESCE(v_task.product_price, 0), COALESCE(v_task.extra_fee, 0), COALESCE(v_task.travel_fee, 0), 0,
          v_sub_eng, 0, GREATEST(v_sub_total - v_sub_eng, 0),
          v_sub_share, v_sub_share_note,
          '미정산', 'A'
        )
        RETURNING id INTO v_payment_id;
      END IF;

      RETURN v_payment_id;
    END IF;
  END IF;
  -- ===================== Mig 256 분기 끝 =====================

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

CREATE OR REPLACE FUNCTION engineer_set_hood_vat(p_actor uuid, p_token text, p_task_id uuid, p_vat_included boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task  tasks%ROWTYPE;
  v_admin boolean;
  v_warn  text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_admin := _caller_is_admin(p_actor);

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.subcontractor_id IS NOT NULL
     OR v_task.category_id IS DISTINCT FROM (SELECT id FROM categories WHERE code = 'hood' LIMIT 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', '직영 주방후드 작업에서만 쓸 수 있습니다.');
  END IF;
  IF NOT (v_admin OR v_task.assigned_engineer_id = p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '본인에게 배정된 작업만 바꿀 수 있습니다.');
  END IF;
  IF v_task.status = '취소' THEN
    RETURN jsonb_build_object('ok', false, 'error', '취소된 작업입니다.');
  END IF;
  IF v_task.status = '완료' AND NOT v_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', '완료된 작업은 올데이케어에 수정을 요청해 주세요.');
  END IF;

  UPDATE tasks SET vat_included = COALESCE(p_vat_included, false), updated_at = now() WHERE id = p_task_id;

  -- 이미 계산된 정산이 있으면 다시 계산 (실패해도 저장은 유지하고 결과에 알린다)
  IF EXISTS (SELECT 1 FROM payments p WHERE p.task_id = p_task_id) THEN
    BEGIN
      PERFORM compute_payment(p_task_id);
    EXCEPTION WHEN OTHERS THEN
      v_warn := SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'vat_included', COALESCE(p_vat_included, false))
         || CASE WHEN v_warn IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('warning', v_warn) END;
END;
$$;
GRANT EXECUTE ON FUNCTION engineer_set_hood_vat(uuid, text, uuid, boolean) TO anon, authenticated;

COMMIT;

-- 검증
-- 1) 기대: 2행 (compute_payment 의 has_257 = true)
SELECT proname, prosrc LIKE '%Mig 257%' AS has_257
  FROM pg_proc WHERE proname IN ('compute_payment', 'engineer_set_hood_vat') ORDER BY 1;

-- 2) 계산식 - 부가세 포함으로 165,000 받음 (견적 100,000)
--    기대: 공급가 150000 · 기사 97500 · 쿨가이 35000 · 올데이케어 17500 · 부가세 15000
SELECT x.supply                                                                       AS "공급가",
       x.supply - ROUND(x.supply * f.fee_rate)::int                                   AS "기사",
       _sub_principal_share(100000, ROUND(x.supply * f.fee_rate)::int, f.principal_rate) AS "쿨가이",
       ROUND(x.supply * f.fee_rate)::int
         - _sub_principal_share(100000, ROUND(x.supply * f.fee_rate)::int, f.principal_rate) AS "올데이케어",
       165000 - x.supply                                                              AS "부가세"
  FROM (SELECT ROUND(165000 / 1.1)::int AS supply) x
  JOIN fee_rules f ON f.subcontractor_id IS NULL AND f.service_code = 'hood' AND f.principal_code = 'KB';

-- 3) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT engineer_set_hood_vat('00000000-0000-0000-0000-000000000000'::uuid, NULL, '00000000-0000-0000-0000-000000000000'::uuid, true);
