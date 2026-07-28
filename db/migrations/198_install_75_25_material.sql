-- ============================================================================
-- Migration 198 - install split 75/25 with material cost (2026-07-28)
--
-- SYMPTOM: A-260726-019 (allday, install, 1,800,000) showed
--   engineer / company / principal = 0 / 0 / 0, compute_error = 'case not found'.
--
-- ROOT CAUSE:
--   The commission policy DOES exist
--     (principal 'allday', service 'install', appliance NULL,
--      calc_method '직영_75_25')
--   but calculate_commission v9 (Mig 168) has no WHEN branch for that
--   calc_method. A PL/pgSQL 'END CASE' with no ELSE raises CASE_NOT_FOUND
--   ('case not found'), so compute_payment aborted and the amounts stayed 0.
--
-- OWNER SPEC (2026-07-28):
--   Install jobs include parts the ENGINEER buys. The customer-facing total
--   never changes (SMS / invoice identical). Only the internal split changes:
--     base     = product_price + extra_fee - material_cost
--     engineer = material_cost + FLOOR(base * 0.75)
--     company  = remainder      (owner formula)
--     principal= 0
--   Example: total 1,800,000 with material 300,000
--     base 1,500,000 -> engineer 300,000 + 1,125,000 = 1,425,000
--                       company 375,000, principal 0. Sum = 1,800,000 OK.
--   Not retroactive: only tasks recomputed from now on.
--
-- CHANGES:
--   [1] tasks.material_cost int NOT NULL DEFAULT 0   (new column)
--   [2] calculate_commission v10 = v9 verbatim + WHEN '직영_75_25'
--       (plain 75/25 - material handling lives in compute_payment so the
--        function signature stays untouched)
--   [3] compute_payment v28 = v27 verbatim + install override block
--       (applies only when every active item on the task is an install item)
--
-- REGRESSION: no other calc_method touched. Existing payments rows are NOT
--   recalculated by this migration - only future completions and explicit
--   compute_payment() calls.
--
-- DEPLOY ORDER: run this SQL first, then push the app (forms send material_cost).
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] new column
-- ============================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS material_cost int NOT NULL DEFAULT 0;

COMMENT ON COLUMN tasks.material_cost IS
  'Mig 198 - install only. Parts the engineer paid for. Deducted from the split base and returned to the engineer. Does not change the customer total.';

-- ============================================================
-- [2] calculate_commission v10
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
      -- 2026-05-24 Migration 066 — usol_n 추가선택 냉매점검 = 35/15/50
      v_engineer  := (p_quoted_amount * 0.35)::int;
      v_principal := (p_quoted_amount * 0.15)::int;
      v_company   := p_quoted_amount - v_engineer - v_principal;  -- 50% (round 차이는 company 흡수)

    WHEN 'usol_n_냉매점검' THEN
      -- Migration 047 (사장님 spec 확정):
      --   전체 금액(v_total) = 기사 50% / 회사 50% / 원청 0
      v_principal := 0;
      v_engineer  := (v_total / 2)::int;
      v_company   := v_total - v_engineer;

    WHEN '출장비_30K' THEN
      -- 2026-07-08 Migration 168 v9 — engineer_base 참조.
      --   이전 (v8): v_engineer := 30000 하드코딩 → commission_policies.engineer_base
      --     값 무시. KB visit_fee 정책 (base=40000) 넣어도 30000 반환.
      --   신 (v9): v_policy.engineer_base 참조 → seed 값 그대로.
      --     6 원청 + common (base=30000) 결과 무변화. KB (base=40000) 신규 지원.
      v_engineer  := v_policy.engineer_base;
      v_principal := 0;
      v_company   := 0;
    WHEN '직영_75_25' THEN
      -- Migration 198 (2026-07-28) - install split, owner spec:
      --   engineer 75% / company 25% of final amount, principal 0.
      v_principal := 0;
      v_engineer  := FLOOR(v_total * 0.75)::int;
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
  'v10 (Migration 198, 2026-07-28) - adds 직영_75_25 (install: engineer 75% / company 25% / principal 0). All v9 branches untouched.';

-- ============================================================
-- [3] compute_payment v28
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
  -- v24 (Mig 166) 신규 — visit_fee 감지 플래그 (travel_fee 이중가산 방지).
  -- v25 (Mig 167) — owner 식 travel_fee 조건부에도 재사용 (신규 변수 없음).
  v_is_visit_only        boolean := false;
  -- v26 (Mig 177) 신규 — 출장비 60(기사)/40(회사) 규칙. 2026-07-15 KST 완료건부터.
  --   과거 완료건 재계산 시엔 false → 기존 기사 100% 유지 (소급 없음).
  v_new_travel_rule      boolean := false;
  v_travel_eng           int := 0;
  -- Mig 198 (install 75/25 with material cost)
  v_install_only         boolean := true;
  v_material             int := 0;
  v_install_base         int := 0;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found: %', p_task_id;
  END IF;

  -- v26 — 새 출장비 규칙 적용 여부 (완료 시각 KST 2026-07-15 00:00 이후).
  --   completed_at NULL (미완료 상태 재계산) 이면 now() 기준 — 트리거는 완료 시점에 돌므로 실질 동일.
  v_new_travel_rule := COALESCE(v_task.completed_at, now())
                       >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz;
  v_travel_eng := CASE WHEN v_new_travel_rule
                       THEN FLOOR(COALESCE(v_task.travel_fee, 0) * 0.6)::int
                       ELSE COALESCE(v_task.travel_fee, 0) END;

  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code not found: %', v_task.principal_id;
  END IF;

  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  -- v23 (Mig 162): cancel guard hardened.
  -- Was: (status = '취소' AND cancel_engineer_comp_kind IS NOT NULL).
  -- Now: any task with status = '취소' enters the cancel branch, so phantom
  -- rows with NULL comp_kind are forced to zero amounts.
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

      -- v24 (Mig 166) 신규 — visit_fee 감지.
      --   category_data / work_type 아닌 loop 안 실제 v_service_code 기준.
      --   category_data 냉매인데 현장 wrong_type→출장 전환된 케이스 (001) 도 정확.
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
    -- Mig 198 (2026-07-28) - install split with material cost (owner spec).
    --   Rule: the engineer buys the parts, so the material cost is returned to
    --   the engineer first; only the remainder is split 75 (engineer) / 25
    --   (company). Principal share is 0. The customer-facing total does not
    --   change - only the internal split does.
    --     base     = product_price + extra_fee - material_cost
    --     engineer = material_cost + FLOOR(base * 0.75)
    --     company  = the rest (computed by the owner formula below)
    --   Applied only when EVERY active item on the task is an install item
    --   (calc_method '직영_75_25'), so mixed tasks keep the old path.
    --   travel_fee is added right after this block, unchanged.
    -- ========================================================================
    IF v_any_active_item AND v_install_only AND v_last_calc_method = '직영_75_25' THEN
      v_material := LEAST(
        GREATEST(COALESCE(v_task.material_cost, 0), 0),
        GREATEST(COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0), 0)
      );
      v_install_base := GREATEST(
        COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0) - v_material, 0
      );
      v_total_engineer  := v_material + FLOOR(v_install_base * 0.75)::int;
      v_total_principal := 0;
    END IF;

    -- v24 (Mig 166) 변경 — visit_fee 는 policy 산식이 travel_fee (30,000) 를 이미
    --   engineer 에 반영. task.travel_fee 를 여기서 다시 더하면 이중가산 사고
    --   (engineer 60,000). v_is_visit_only 감지 시 스킵.
    --   그 외 서비스는 task.travel_fee 가 0 이라 (사장님 확인 — 일반 작업 0건)
    --   무해하지만 조건부로 감쌈으로써 semantic 명시.
    IF NOT v_is_visit_only THEN
      -- v26 — 새 규칙이면 기사 60% 만 (나머지 40% 는 owner 식에서 자동 귀속).
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
                          + v_travel_eng;  -- v26
      ELSE
        v_total_engineer := FLOOR(
          (COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0))::numeric
          * v_engineer_rate_task / 100
        )::int + v_travel_eng;  -- v26
      END IF;
    END IF;

    -- v26 (Mig 177) — 방문출장(visit_only) 도 새 규칙이면 기사 60%.
    --   visit_only 의 engineer 합계 = 방문비 그 자체 (policy 산식) 이므로 0.6 배.
    IF v_is_visit_only AND v_new_travel_rule THEN
      v_total_engineer := FLOOR(v_total_engineer * 0.6)::int;
    END IF;

    -- v25 (Mig 167) 변경 — usol_n owner 식 travel_fee 조건부.
    --   usol_n visit_only 는 total_settle (task_items.subtotal 합) 이 이미 30,000 을
    --   반영. travel_fee 를 owner 에 추가하면 부풀음:
    --     owner = 30,000 + 0 + 30,000 - 30,000 - 0 = 30,000 ★ 사고
    --   fix: v_is_visit_only 감지 시 travel_fee 항 0.
    --     owner = 30,000 + 0 + 0 - 30,000 - 0 = 0 ✓
    IF v_principal_code = 'usol_n' THEN
      SELECT COALESCE(SUM(ti.subtotal), 0)::int INTO v_total_settle
      FROM task_items ti WHERE ti.task_id = p_task_id;

      v_total_owner := v_total_settle
                     + COALESCE(v_task.extra_fee, 0)
                     + (CASE WHEN v_is_visit_only THEN 0 ELSE COALESCE(v_task.travel_fee, 0) END)
                     - v_total_engineer
                     - v_total_principal;
    ELSE
      -- v25 (Mig 167) 변경 — 일반식도 대칭 처리. visit_only 인 일반 원청은
      --   product_price=0 관례라 travel_fee 를 빼도 GREATEST clamp 로 owner=0 유지.
      --   결과는 안 바뀌나 semantic 대칭 유지.
      -- v26 — 새 규칙의 visit_only 는 travel 항 포함해야 회사 40% 가 owner 로 잡힘.
      --   (옛 규칙 visit_only 는 v25 그대로 0 — 기사 100% 시절 owner 0 유지.)
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
  'v28 (Migration 198, 2026-07-28) - install (직영_75_25): material_cost returned to engineer first, remainder split 75/25, principal 0. v27 water_leak / v26 travel 60-40 / v25-v22 logic all preserved.';

COMMIT;
