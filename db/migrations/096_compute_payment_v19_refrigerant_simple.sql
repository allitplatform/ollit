-- ============================================
-- Migration 096 — compute_payment v19 + compute_engineer_amount_per_item v5
--                 (refrigerant 정산 규칙 단순화)
-- 작성 : 2026-06-08
-- 실행 : Supabase 콘솔 → SQL Editor → 통째 → Run (CREATE OR REPLACE = idempotent)
-- ============================================
--
-- 사장님 확정 규칙 (2026-06-08):
--   pure refrigerant task (active items 전건 refrigerant) 일 때:
--     · refrigerant_rate < 100 → engineer = (product_price + extra_fee) × rate / 100 + travel_fee
--                                 정책 종류 (정액/비율/직영) 무관. extra_fee 흡수.
--     · refrigerant_rate >= 100 → v18 그대로 (engineer = total − principal, 회사 0)
--   principal = 정책대로 (정액 고정 / 비율 fee_rate / 직영 0) — loop 합산값 그대로.
--   owner = GREATEST(total − engineer − principal, 0) — 음수 방지 가드.
--
-- 본 v19 / v5 변경 (v18/v4 본문 그대로 보존, 추가 분기만 삽입):
--   (1) declaration: v_pure_refrigerant boolean := true;  -- 측정용 플래그
--                    v_any_active_item   boolean := false; -- 활성 item 존재 측정
--                    v_engineer_rate_task int;
--   (2) loop 안 — 활성 item 측정 + refrigerant 외 또는 usol_n_추가선택 발견 시 false 처리
--   (3) loop 후 — pure_refrigerant + rate<100 시 v_total_engineer 단일 override
--   (4) owner 계산 직후 GREATEST 가드 적용
--
-- 회귀 보호:
--   · usol_n_추가선택 / cleaning / 비-refrigerant / mixed task 등 모든 경로는 v18 본문 그대로.
--   · v_canceled_active (취소-완료 + 수고비 지정) 분기는 본 override 분기보다 뒤에서 다시 덮어쓰므로 영향 없음.
--   · usol_n refrigerant 점검 (calc_method='usol_n_추가선택') → v_pure_refrigerant=false → override 미진입.
--   · pure refrigerant + rate>=100 (= 직영 기사) → loop 안 v18 분기 그대로 (eng = total − prin).
--   · refrigerant + 비-refrigerant 혼합 task → v_pure_refrigerant=false → override 미진입 → v18 동작.
--   · owner GREATEST(0) 가드는 음수일 때만 0으로 클램프. 양수는 변동 0.
--
-- 의존:
--   · 094 (v18 / v4) — 본 v19 / v5 base
--   · 009 (calculate_commission + 시드)
--   · 028 (task_items_compute_trg)
--
-- 검증 (사장님 확정 기대값):
--   · 용산구4527 (usol_h, total=180,000, rate=60) → eng=108,000 (변동 0, v18과 동일)
--   · 강북구9810 (yongin, total=320,000, rate=60) → eng=192,000 / prin=10,000 / own=118,000
--   · 강남구6429 (crikrin, total=110,000, rate=60) → eng=66,000 / prin=22,000 / own=22,000
--     (단, 강남구는 task_items.appliance_type_id NULL → 별도 사전 정리 SQL 측 set 후 compute 호출)
-- ============================================

BEGIN;

-- ============================================
-- [1] compute_payment v19
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
  v_canceled_active boolean := false;
  v_use_phase_c   boolean := false;
  v_row_subtotal  int;
  v_row_received  int;
  v_row_extra     int;
  v_phase_c_eng_extra  int;
  v_phase_c_prin_extra int;
  v_qty_cond      text;
  -- v19 신규
  v_pure_refrigerant     boolean := true;   -- 측 active item 측 refrigerant + usol_n_추가선택 외 → 유지 true
  v_any_active_item      boolean := false;  -- 활성 item 존재 확인 (전 취소 케이스 측 override 미진입)
  v_engineer_rate_task   int;               -- refrigerant_rate fetch 값
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

  -- 3) task_items 총수량 (v15: is_canceled 제외)
  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  v_canceled_active := (v_task.status = '취소' AND v_task.cancel_engineer_comp_kind IS NOT NULL);

  IF v_total_qty = 0 AND NOT v_canceled_active THEN
    RAISE EXCEPTION 'task_items 없음 (전 품목 취소 또는 미생성): task_id=%', p_task_id;
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

      -- v18 qty_condition 결정
      v_qty_cond := CASE
        WHEN v_item.order_type IN ('첫대', '추가') THEN v_item.order_type
        ELSE NULL
      END;

      -- probe — 1대분 (extra=0)
      v_calc_result := calculate_commission(
        v_principal_code, v_service_code, v_appliance_code,
        v_unit_price, 0, 0, v_qty_cond
      );

      IF NOT (v_calc_result ->> 'ok')::boolean THEN
        RAISE EXCEPTION 'calculate_commission 실패: %', v_calc_result;
      END IF;

      v_calc_method := v_calc_result ->> 'calc_method';
      v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
      v_is_fixed := v_calc_method = '정액';

      IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
        v_is_ratio := true;
      END IF;

      -- v19: pure refrigerant 측정 — refrigerant 외 service 또는 usol_n_추가선택 발견 시 false
      IF v_service_code <> 'refrigerant' OR v_calc_method = 'usol_n_추가선택' THEN
        v_pure_refrigerant := false;
      END IF;

      -- v17 (Phase C) extra 분기
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

      -- 비율형 재호출
      IF v_is_ratio AND (v_qty > 1 OR v_item_extra > 0) THEN
        v_calc_result := calculate_commission(
          v_principal_code, v_service_code, v_appliance_code,
          v_unit_price * v_qty, v_item_extra, 0, v_qty_cond
        );
        IF NOT (v_calc_result ->> 'ok')::boolean THEN
          RAISE EXCEPTION 'calculate_commission 재호출 실패: %', v_calc_result;
        END IF;
        IF NOT v_use_phase_c AND v_item_extra > 0 THEN
          v_extra_applied := true;
        END IF;
      END IF;

      v_eng := (v_calc_result ->> 'engineer')::int;
      v_prin := (v_calc_result ->> 'principal')::int;
      v_mult := CASE WHEN v_is_ratio THEN 1 ELSE v_qty END;

      -- v14 (Migration 050): refrigerant + 기사별 refrigerant_rate
      -- v19: rate >= 100 분기만 loop 안에서 유지. rate < 100 분기는 loop 후 task-level override 로 대체.
      IF v_service_code = 'refrigerant'
         AND v_calc_method != 'usol_n_추가선택'
         AND v_task.assigned_engineer_id IS NOT NULL THEN
        SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate
        FROM users WHERE id = v_task.assigned_engineer_id;

        v_total_calc := (v_calc_result ->> 'total')::int;

        IF v_engineer_rate >= 100 THEN
          v_eng := v_total_calc - v_prin;
        END IF;
        -- v19: rate < 100 → loop 안 v_eng 무수정 (loop 후 v_total_engineer override 가 정정함)
      END IF;

      v_total_engineer := v_total_engineer + (v_eng * v_mult);

      -- v17 (Phase C) cleaning extra per-row
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

    -- v9 LEGACY: 세척 추가금 (Phase C 외 적용)
    IF NOT v_use_phase_c THEN
      v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
      v_total_principal := v_total_principal + v_cleaning_principal_bonus;
    END IF;

    -- v12 (Migration 048): travel_fee 기사 100%
    v_total_engineer := v_total_engineer + COALESCE(v_task.travel_fee, 0);

    -- ============================================
    -- v19 신규: pure refrigerant + rate < 100 → v_total_engineer task-level override
    -- ============================================
    -- 사유: 정액 정책(yongin)이 v_is_ratio=false 라 extra_fee 흡수 못 함.
    --       비율_총금액(KB) / 비율_견적금액(crikrin/KA) / 직영_50_50(allday/usol_h) 는
    --       loop 내 정상 흡수되지만, 단일 규칙 단순화 차원에서 동일 산식 적용.
    -- 산식: v_total_engineer = FLOOR((product_price + extra_fee) × rate / 100) + travel_fee
    -- 적용 조건:
    --   · 활성 item 1건 이상 (v_any_active_item) — 전 취소 케이스는 override 미진입
    --   · 측 active item 전건 refrigerant + usol_n_추가선택 외 (v_pure_refrigerant)
    --   · assigned_engineer_id NOT NULL + refrigerant_rate < 100
    -- 미적용 (= v18 동작 그대로):
    --   · rate >= 100 (= 직영 기사, loop 내 v_eng = total − prin 분기)
    --   · refrigerant + 비-refrigerant 혼합 task
    --   · usol_n refrigerant 점검 (calc_method = 'usol_n_추가선택')
    --   · 활성 item 0건 (= 전 취소 또는 v_canceled_active)
    IF v_any_active_item AND v_pure_refrigerant
       AND v_task.assigned_engineer_id IS NOT NULL THEN
      SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate_task
      FROM users WHERE id = v_task.assigned_engineer_id;

      IF v_engineer_rate_task < 100 THEN
        v_total_engineer := FLOOR(
          (COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0))::numeric
          * v_engineer_rate_task / 100
        )::int + COALESCE(v_task.travel_fee, 0);
        -- principal 은 loop 합산값 그대로 유지 (정책대로).
      END IF;
    END IF;

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

    -- v19: owner 음수 방지 가드
    v_total_owner := GREATEST(v_total_owner, 0);

    IF v_principal_code = 'usol_n' AND v_has_non_refrigerant THEN
      v_track := 'B';
    ELSE
      v_track := 'A';
    END IF;
  END IF;

  -- v16 (Migration 073): 취소-완료 + 수고비 지정 시 override
  IF v_canceled_active THEN
    v_total_engineer  := COALESCE(v_task.cancel_engineer_comp_amount, 0);
    v_total_principal := 0;
    v_total_owner     := 0 - v_total_engineer;
    v_last_calc_method := COALESCE(v_last_calc_method, '취소_수고비');
    v_last_policy_key  := COALESCE(v_last_policy_key, 'cancel_compensation');
    IF v_track IS NULL THEN v_track := 'A'; END IF;
  END IF;

  -- 7) payments UPSERT
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
  'v19 (Migration 096, 2026-06-08) — refrigerant 정산 규칙 단순화. '
  'pure refrigerant + rate<100 → engineer = (product + extra) × rate / 100 + travel (정책 무관). '
  'rate>=100 (직영 기사) 분기는 v18 그대로 (eng = total − prin). '
  'owner = GREATEST(total − eng − prin, 0) 음수 방지 가드. '
  '094 v18 본문 그대로 보존 (mixed task / usol_n_추가선택 / cleaning_extra / canceled_active / Phase C).';

-- ============================================
-- [2] compute_engineer_amount_per_item v5
-- ============================================
-- 단일 active item refrigerant + rate<100 일 때만 task-level engineer 그대로 표시.
-- multi-item refrigerant pure 케이스는 v4 본문 그대로 (운영 0건 — 별도 단계 검토 대상).
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
  v_use_phase_c       boolean := false;
  v_row_subtotal      int;
  v_row_received      int;
  v_row_extra         int;
  v_qty_cond          text;
  -- v5 신규
  v_pure_refrigerant     boolean := true;
  v_active_count         int := 0;
  v_engineer_rate_task   int;
  v_task_total_engineer  int;
  v_first_active_id      uuid;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 조회 실패 — 작업 없음: %', p_task_id;
  END IF;

  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 조회 실패 — principal_id=%', v_task.principal_id;
  END IF;

  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  IF v_total_qty = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- v5: 활성 item 개수 + 첫 활성 item id 사전 측정
  SELECT COUNT(*), MIN(id) INTO v_active_count, v_first_active_id
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  SELECT EXISTS(
    SELECT 1 FROM task_items
    WHERE task_id = p_task_id
      AND NOT COALESCE(is_canceled, false)
      AND received_amount IS NOT NULL
  ) INTO v_use_phase_c;

  FOR v_item IN
    SELECT
      ti.id AS task_item_id,
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

    IF v_principal_code = 'usol_n'
       AND v_item.order_type = '추가선택'
       AND COALESCE(v_service_code, '') = 'refrigerant' THEN
      v_service_code := 'addon';
      v_appliance_code := '냉매점검';
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
      RAISE EXCEPTION 'calculate_commission 실패: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');

    IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
      v_is_ratio := true;
    END IF;

    -- v5: pure refrigerant 측정
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
    END IF;

    IF v_is_ratio AND (v_qty > 1 OR v_item_extra > 0) THEN
      v_calc_result := calculate_commission(
        v_principal_code, v_service_code, v_appliance_code,
        v_unit_price * v_qty, v_item_extra, 0, v_qty_cond
      );
      IF NOT (v_calc_result ->> 'ok')::boolean THEN
        RAISE EXCEPTION 'calculate_commission 재호출 실패: %', v_calc_result;
      END IF;
      IF NOT v_use_phase_c AND v_item_extra > 0 THEN
        v_extra_applied := true;
      END IF;
    END IF;

    v_eng := (v_calc_result ->> 'engineer')::int;
    v_prin := (v_calc_result ->> 'principal')::int;
    v_mult := CASE WHEN v_is_ratio THEN 1 ELSE v_qty END;

    -- v5: rate >= 100 분기만 loop 안에서 유지. rate < 100 분기는 loop 후 단일 active 측정.
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

    v_eng_for_item := v_eng * v_mult;

    IF v_use_phase_c
       AND v_service_code = 'cleaning'
       AND v_item_extra > 0
       AND v_calc_method IN ('직영_0', '비율_견적금액', '정액') THEN
      IF v_principal_code = 'usol_n' THEN
        v_eng_for_item := v_eng_for_item + (v_item_extra - FLOOR(v_item_extra * 0.15)::int);
      ELSE
        v_eng_for_item := v_eng_for_item + v_item_extra;
      END IF;
    END IF;

    IF NOT v_use_phase_c AND v_service_code = 'cleaning' AND v_first_cleaning_item THEN
      v_eng_for_item := v_eng_for_item + v_cleaning_engineer_bonus;
      v_first_cleaning_item := false;
    END IF;

    IF NOT v_first_item_applied THEN
      v_eng_for_item := v_eng_for_item + COALESCE(v_task.travel_fee, 0);
      v_first_item_applied := true;
    END IF;

    v_result := v_result || jsonb_build_object(
      'task_item_id', v_item.task_item_id,
      'engineer_amount', v_eng_for_item
    );
  END LOOP;

  -- v5 신규: 단일 active refrigerant pure + rate<100 → 첫 active item engineer 를 task-total 로 override
  IF v_active_count = 1 AND v_pure_refrigerant
     AND v_task.assigned_engineer_id IS NOT NULL THEN
    SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate_task
    FROM users WHERE id = v_task.assigned_engineer_id;

    IF v_engineer_rate_task < 100 THEN
      v_task_total_engineer := FLOOR(
        (COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0))::numeric
        * v_engineer_rate_task / 100
      )::int + COALESCE(v_task.travel_fee, 0);

      -- v_result 첫 (=유일) row engineer_amount 측 v_task_total_engineer 측 교체
      v_result := jsonb_build_array(
        jsonb_build_object(
          'task_item_id', v_first_active_id,
          'engineer_amount', v_task_total_engineer
        )
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_engineer_amount_per_item(uuid) TO anon, authenticated;

COMMENT ON FUNCTION compute_engineer_amount_per_item(uuid) IS
  'v5 (Migration 096, 2026-06-08) — refrigerant 정산 규칙 단순화 (compute_payment v19 정합). '
  '단일 active refrigerant + rate<100 → 측 item engineer = (product + extra) × rate / 100 + travel. '
  'multi-item refrigerant pure / mixed / rate>=100 / usol_n_추가선택 → v4 그대로 (운영 0건). '
  '094 v4 본문 그대로 보존.';

COMMIT;

-- ============================================
-- 검증 SQL (별도 실행 — 본 마이그 적용 후)
-- ============================================
--
-- A. 함수 코멘트 확인:
-- SELECT proname, obj_description(oid, 'pg_proc')
-- FROM pg_proc WHERE proname IN ('compute_payment', 'compute_engineer_amount_per_item');
-- 기대: v19 / v5 표기.
--
-- B. 검증 — 3건 (compute_payment 호출 후 payments 확인):
--   B-1. 용산구4527 (변동 0 — usol_h 직영, total 180,000):
--     SELECT compute_payment('a4dc2dca-d42a-41b7-b976-946b04e31511'::uuid);
--     SELECT engineer_amount, principal_amount, owner_amount
--     FROM payments WHERE task_id = 'a4dc2dca-d42a-41b7-b976-946b04e31511';
--     기대: eng=108,000 / prin=0 / own=72,000 (= v18 동일).
--
--   B-2. 강북구9810 (정정 — yongin 정액, total 320,000):
--     SELECT compute_payment('7e03a275-f638-4199-9a40-7ef810e79b76'::uuid);
--     SELECT engineer_amount, principal_amount, owner_amount
--     FROM payments WHERE task_id = '7e03a275-f638-4199-9a40-7ef810e79b76';
--     기대: eng=192,000 / prin=10,000 / own=118,000.
--
--   B-3. 강남구6429 — appliance_type_id NULL 상태라 compute_payment 직호출 시
--        'policy_not_found' RAISE. 별도 097 사전 정리 SQL 측 appliance set 후 호출.
--        예상: eng=66,000 / prin=22,000 / own=22,000 (벽걸이 set 시).
--
-- C. 회귀 확인 — 운영 중 활성 task 5건 sample (refrigerant 외):
--   WITH s AS (
--     SELECT t.id, p.engineer_amount AS e_old, p.principal_amount AS p_old, p.owner_amount AS o_old
--     FROM tasks t JOIN payments p ON p.task_id = t.id
--     WHERE t.status IN ('완료', '확정')
--       AND p.calc_method NOT IN ('정액', '비율_견적금액', '비율_총금액', '직영_50_50', 'usol_n_추가선택')
--     ORDER BY random() LIMIT 5
--   )
--   SELECT s.id, s.e_old, s.p_old, s.o_old, compute_payment(s.id) AS new_pid FROM s;
--   적용 후 SELECT 측 비교: diff 0 기대.
--
-- D. owner 음수 가드 확인 — rate>=100 + 정책 principal 있는 케이스:
--   SELECT t.task_no, p.engineer_amount, p.principal_amount, p.owner_amount
--   FROM tasks t JOIN payments p ON p.task_id = t.id
--   WHERE p.owner_amount = 0;
--   기대: 음수 0건. (사장님 OK = 음수 → 0 클램프)
--
-- ============================================
-- 롤백 (위급 시):
--   db/migrations/094_compute_payment_v18_qty_condition.sql 측 본문 그대로 다시 실행.
--   CREATE OR REPLACE = idempotent.
-- ============================================
