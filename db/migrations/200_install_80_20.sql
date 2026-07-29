-- ============================================================================
-- Migration 200 - install split 75/25 -> 80/20 (2026-07-29)
--
-- OWNER SPEC (2026-07-29): "설치 수수료 변경 25프로에서 > 20프로로"
--   engineer 75% -> 80%, company 25% -> 20%. Principal stays 0.
--   The material-cost rule from Mig 198 is UNCHANGED:
--     base     = product_price + extra_fee - material_cost
--     engineer = material_cost + FLOOR(base * rate)
--     company  = remainder
--   Only `rate` changes: 0.75 -> 0.80.
--
--   Example (Mig 198's own example, total 1,800,000 / material 300,000):
--     base 1,500,000
--       old: engineer 300,000 + 1,125,000 = 1,425,000 / company 375,000
--       new: engineer 300,000 + 1,200,000 = 1,500,000 / company 300,000
--
-- NOT RETROACTIVE (same stance as Mig 198):
--   The new rate applies only to tasks completed on/after 2026-07-29 00:00 KST.
--   Recomputing an older install task (e.g. after an amount edit) keeps 75/25,
--   so already-settled payouts do not silently move.
--   Implemented the same way Mig 177 handled the travel-fee 60/40 switch:
--     gate on COALESCE(tasks.completed_at, now()).
--   -> If the owner later wants it retroactive, run section [3] at the bottom
--      (commented out) to recompute past install tasks.
--
-- calc_method NAME IS NOT CHANGED.
--   It stays '직영_75_25' because commission_policies rows store that string.
--   Renaming it would require updating those rows in lockstep and would break
--   any recompute that runs in between. The name is now historical - the rate
--   lives in compute_payment.
--
-- CHANGES:
--   [1] calculate_commission v11 = v10 verbatim + 직영_75_25 branch at 80/20.
--       (This branch only matters for MIXED tasks; install-only tasks are
--        overridden by compute_payment's install block below. Kept in sync so
--        the two paths can't disagree.)
--   [2] compute_payment v29 = v28 verbatim + date-gated install rate.
--
-- DEPLOY: SQL only. No app change needed.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] calculate_commission v11 - only the 직영_75_25 branch differs from v10
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_commission(
  p_principal_code text,
  p_service_code   text,
  p_appliance_code text,
  p_quoted_amount  int,
  p_extra_amount   int DEFAULT 0,
  p_naver_fee      int DEFAULT 0,
  p_qty_condition  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy    commission_policies%ROWTYPE;
  v_total     int;
  v_engineer  int := 0;
  v_principal int := 0;
  v_company   int := 0;
  v_fake_base int;
  v_principal_fee int;
BEGIN
  SELECT * INTO v_policy FROM commission_policies
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
    AND principal_code = p_principal_code
    AND service_code   = p_service_code
    AND (appliance_code = p_appliance_code OR (appliance_code IS NULL AND p_appliance_code IS NULL))
    AND (qty_condition IS NULL OR qty_condition = p_qty_condition)
  ORDER BY (qty_condition IS NOT NULL) DESC
  LIMIT 1;

  IF v_policy.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'policy_not_found',
      'principal', p_principal_code, 'service', p_service_code, 'appliance', p_appliance_code);
  END IF;

  v_total := COALESCE(p_quoted_amount, 0) + COALESCE(p_extra_amount, 0);

  CASE v_policy.calc_method
    WHEN '직영_0' THEN
      v_principal := 0;
      v_engineer  := v_policy.engineer_base;
      v_company   := p_quoted_amount - v_engineer;

    WHEN '직영_50_50' THEN
      v_principal := 0;
      v_engineer  := (v_total / 2)::int;
      v_company   := v_total - v_engineer;

    WHEN '차감후비율_50' THEN
      v_fake_base := (v_policy.notes::jsonb -> 'fake_base' ->> p_appliance_code)::int;
      v_principal := ((p_quoted_amount - v_fake_base) * 0.5)::int;
      v_engineer  := v_policy.engineer_base;
      v_company   := p_quoted_amount - v_principal - v_engineer;

    WHEN '비율_견적금액' THEN
      v_principal := (p_quoted_amount * v_policy.fee_rate)::int;
      IF p_service_code = 'cleaning' THEN
        v_engineer := v_policy.engineer_base;
        v_company  := p_quoted_amount - v_principal - v_engineer;
      ELSE
        v_engineer := (v_total / 2)::int;
        v_company  := v_total - v_principal - v_engineer;
      END IF;

    WHEN '비율_총금액' THEN
      v_principal := (v_total * v_policy.fee_rate)::int;
      v_engineer  := (v_total / 2)::int;
      v_company   := v_total - v_principal - v_engineer;

    WHEN '비율_판매가' THEN
      v_principal := (p_quoted_amount * v_policy.fee_rate)::int;
      v_engineer  := v_policy.engineer_base;
      v_company   := p_quoted_amount - v_principal - v_engineer;

    WHEN '정액' THEN
      v_principal_fee := COALESCE(v_policy.principal_fee::int, 10000);
      v_principal := v_principal_fee;
      IF p_service_code = 'cleaning' THEN
        v_engineer := v_policy.engineer_base;
        v_company  := p_quoted_amount - v_principal - v_engineer;
      ELSE
        v_engineer := (v_total / 2)::int;
        v_company  := v_total - v_principal - v_engineer;
      END IF;

    WHEN 'usol_n_본작업' THEN
      v_engineer  := (v_policy.engineer_base * 1.10)::int;
      v_principal := ((p_quoted_amount - COALESCE(p_naver_fee, 0)) * v_policy.fee_rate)::int;
      v_company   := (p_quoted_amount - COALESCE(p_naver_fee, 0)) - v_principal - v_engineer;

    WHEN 'usol_n_추가선택' THEN
      v_engineer  := (p_quoted_amount * (1 - v_policy.fee_rate))::int;  -- 85%
      v_principal := (p_quoted_amount * v_policy.fee_rate)::int;        -- 15%
      v_company   := 0;

    WHEN 'usol_n_추가선택_냉매' THEN
      v_engineer  := (p_quoted_amount * 0.35)::int;
      v_principal := (p_quoted_amount * 0.15)::int;
      v_company   := p_quoted_amount - v_engineer - v_principal;

    WHEN 'usol_n_냉매점검' THEN
      v_principal := 0;
      v_engineer  := (v_total / 2)::int;
      v_company   := v_total - v_engineer;

    WHEN '출장비_30K' THEN
      v_engineer  := v_policy.engineer_base;
      v_principal := 0;
      v_company   := 0;

    WHEN '직영_75_25' THEN
      -- Migration 200 (2026-07-29) - owner spec: company 25% -> 20%.
      --   Name kept for policy-row compatibility; the actual rate is 80/20.
      --   Install-only tasks are recomputed in compute_payment (date-gated);
      --   this branch covers mixed tasks so the two paths agree.
      v_principal := 0;
      v_engineer  := FLOOR(v_total * 0.80)::int;
      v_company   := v_total - v_engineer;

  END CASE;

  RETURN jsonb_build_object(
    'ok',          true,
    'total',       v_total,
    'principal',   v_principal,
    'engineer',    v_engineer,
    'company',     v_company,
    'calc_method', v_policy.calc_method,
    'policy_key',  v_policy.policy_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_commission(text, text, text, int, int, int, text) TO authenticated;

COMMENT ON FUNCTION calculate_commission(text, text, text, int, int, int, text) IS
  'v11 (Migration 200, 2026-07-29) - 직영_75_25 branch now splits 80 (engineer) / 20 (company). Name kept for policy-row compatibility. All other branches identical to v10.';

-- ============================================================
-- [2] compute_payment v29 - date-gated install rate (0.75 -> 0.80)
-- ============================================================
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
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found: %', p_task_id;
  END IF;

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
  'v29 (Migration 200, 2026-07-29) - install engineer share 75% -> 80% for completions on/after 2026-07-29 KST (older completions keep 75%). Mig 198 material-cost rule and all v22-v28 logic preserved.';

COMMIT;

-- ============================================================================
-- 확인용 (실행 후 따로 돌려보세요) - 오늘 이후 완료된 설치 건 분배 확인.
--   Supabase SQL Editor 는 마지막 SELECT 만 보여주므로 이 한 줄만 실행.
-- ============================================================================
-- SELECT t.task_no, t.product_price, t.extra_fee, t.material_cost,
--        p.engineer_amount, p.owner_amount, p.principal_amount,
--        (p.engineer_amount + p.owner_amount + p.principal_amount) AS sum_check
-- FROM tasks t JOIN payments p ON p.task_id = t.id
-- WHERE p.calc_method = '직영_75_25'
-- ORDER BY t.completed_at DESC NULLS LAST
-- LIMIT 20;

-- ============================================================================
-- [3] 소급 적용을 원할 때만 (기본은 실행하지 마세요).
--   이미 정산 끝난 설치 건의 기사 몫이 올라가고 회사 몫이 내려갑니다.
--   먼저 위 확인 SELECT 로 대상 건수를 확인하세요.
-- ============================================================================
-- DO $$
-- DECLARE r RECORD;
-- BEGIN
--   FOR r IN SELECT t.id FROM tasks t JOIN payments p ON p.task_id = t.id
--            WHERE p.calc_method = '직영_75_25' AND p.status = '미정산'
--   LOOP
--     PERFORM compute_payment(r.id);
--   END LOOP;
-- END $$;
