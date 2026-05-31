-- ============================================
-- Migration 085 v2 — compute_payment v17 + compute_engineer_amount_per_item v3
--                    (Phase C Step 2 — task_items.received_amount per-row 정산)
-- 작성    : 2026-05-30 (v1)
-- v2 정정 : 2026-05-31 — v1 측 v_canceled_active 분기 (Migration 073) 누락 → v2 측 복원
-- 실행    : 2026-05-31 (운영 DB 적용, 회귀 5건 sample diff=0 확인)
-- ============================================
--
-- v1 → v2 변경 사유:
--   v1 측 v16 작성 시 071 v15 본문 측 base 측 잡았으나 073 의 v16 (v_canceled_active 분기) 측 누락.
--   영향: status='취소' + cancel_engineer_comp_kind 측 set 측 task 측 compute_payment 호출 시
--         RAISE EXCEPTION 'task_items 없음 (전 품목 취소 또는 미생성)' 측 발생 (전 품목 취소 케이스).
--   v2 측 함수명 v17 측 변경 — 073 v16 + 085 v17 측 연속성 측.
--
-- 사장님 spec (2026-05-30, Phase C):
--   각 task_item 측 received_amount 사용 → row 측 정책 독립 적용:
--     v_row_subtotal := v_qty * v_unit_price
--     v_row_received := COALESCE(received_amount, v_row_subtotal)
--     v_row_extra    := GREATEST(v_row_received - v_row_subtotal, 0)
--   · cleaning row 측 row_extra → 100% 기사 (non-usol_n) 또는 85/15 (usol_n)
--   · refrigerant row 측 row_extra → calculate_commission v_total 통해 정책 + refrigerant_rate
--   · 옛 cleaning_extra_applied 측 task-level 분배 제거 — 이제 row 단위
--
-- 회귀 안전 설계 (legacy 완료 작업 보호):
--   compute_payment 진입 시 v_use_phase_c detect:
--     · 어떤 row 측 received_amount IS NOT NULL → Phase C path
--     · 전부 NULL (Mig 084 백필 측 status='완료' 측 제외 → NULL 유지) → LEGACY v15 path verbatim
--   → 옛 완료 task 측 다시 compute_payment 호출되어도 v15 결과 그대로.
--   운영 검증 (2026-05-31): legacy 완료 작업 5건 sample diff = 0 ✓
--
-- v_canceled_active 분기 (Migration 073, v2 복원):
--   status='취소' + cancel_engineer_comp_kind IS NOT NULL 측 task 측:
--     · FOR LOOP / owner / track 측 skip (v_total_qty = 0 측 → IF v_total_qty > 0 측 wrap)
--     · 최종 engineer/principal/owner 측 수고비 amount 측 덮어쓰기
--   → 071 (v15) → 073 (v16) → 085 (v17) 측 연속성 보존.
--
-- v17 = v16 (073) + Phase C row-level. compute_engineer_amount_per_item 측 v3 — v_canceled_active 측
-- 단일 task-level override 측이라 per-item 측 영향 X → 본 v3 측 cancel 분기 별도 추가 안 함.
--
-- 의존:
--   · 071 v15 / 073 v16 — 본 085 v17 측 교체
--   · 083 (received_total + trigger) + 084 (task_items.received_amount + trigger) 적용 완료
--
-- 재실행:
--   Supabase 콘솔 → SQL Editor → 통째 → Run.
-- ============================================

BEGIN;

-- ============================================
-- [1] compute_payment v17 (v16(073) 본문 + Phase C 분기 + v_use_phase_c detect)
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
  -- v16 (Migration 073): 취소-완료 건 수고비 분기용
  v_canceled_active boolean := false;
  -- v17 (Phase C) 신규
  v_use_phase_c   boolean := false;
  v_row_subtotal  int;
  v_row_received  int;
  v_row_extra     int;
  v_phase_c_eng_extra  int;
  v_phase_c_prin_extra int;
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

  -- v16 (Migration 073): 전 품목 취소(취소-완료 건) → FOR LOOP 측 합산 X. 수고비 분기 측 진행.
  v_canceled_active := (v_task.status = '취소' AND v_task.cancel_engineer_comp_kind IS NOT NULL);

  IF v_total_qty = 0 AND NOT v_canceled_active THEN
    RAISE EXCEPTION 'task_items 없음 (전 품목 취소 또는 미생성): task_id=%', p_task_id;
  END IF;

  -- v17 (Phase C): 모드 detect — 어느 row 측 received_amount IS NOT NULL 측 신규 path.
  --   전부 NULL (legacy 완료 작업 측 백필 skip) 측 v15 path verbatim → 회귀 0.
  SELECT EXISTS(
    SELECT 1 FROM task_items
    WHERE task_id = p_task_id
      AND NOT COALESCE(is_canceled, false)
      AND received_amount IS NOT NULL
  ) INTO v_use_phase_c;

  -- v16 (073) 측 wrap: v_total_qty > 0 측만 본 계산 진입 (취소-완료 측 skip 후 override).
  IF v_total_qty > 0 THEN
    -- 4) fallback unit price
    v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

    -- 5) task_items 순회 (v15: is_canceled 제외 + v17: received_amount/subtotal fetch)
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

      -- v17 (Phase C): extra 분기 — Phase C (row_extra) vs LEGACY v15 (cleaning_extra_applied + first ratio)
      IF v_use_phase_c THEN
        v_row_subtotal := v_qty * v_unit_price;
        v_row_received := COALESCE(v_item.received_amount, v_row_subtotal);
        v_row_extra    := GREATEST(v_row_received - v_row_subtotal, 0);
        v_item_extra   := v_row_extra;
      ELSE
        -- LEGACY v15: cleaning_extra_applied + 비율 first item 측 task.extra_fee 분배
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

      -- 비율형 재호출 — extra 측 v_item_extra 사용 (Phase C: row_extra / LEGACY: task.extra_fee)
      IF v_is_ratio AND (v_qty > 1 OR v_item_extra > 0) THEN
        v_calc_result := calculate_commission(
          v_principal_code, v_service_code, v_appliance_code,
          v_unit_price * v_qty, v_item_extra, 0, NULL
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

      -- v17 (Phase C): cleaning row 측 row_extra 측 calculate_commission 무시 정책 측 수동 가산.
      --   대상 calc_method (cleaning + extra 무시): 직영_0, 비율_견적금액, 정액.
      --   행당 1회 가산 — engineer_base 측 per-unit / row_extra 측 per-row.
      --   usol_n cleaning 측 85/15 (v15 cleaning_extra_applied usol_n 공식 동일).
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

    -- v9 LEGACY: 세척 추가금 (루프 종료 후 1회 합산) — Phase C 측 제외.
    IF NOT v_use_phase_c THEN
      v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
      v_total_principal := v_total_principal + v_cleaning_principal_bonus;
    END IF;

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

    -- v10: 자금 흐름 트랙 분기
    IF v_principal_code = 'usol_n' AND v_has_non_refrigerant THEN
      v_track := 'B';
    ELSE
      v_track := 'A';
    END IF;
  END IF;
  -- ↑ IF v_total_qty > 0 측 wrap 끝

  -- v16 (Migration 073): 취소-완료 + 수고비 지정 시 — engineer/principal/owner 덮어쓰기.
  --   trigger 측 어디서 발화돼도 동일 결과. payments.is_balanced 측 0=0 유지.
  IF v_canceled_active THEN
    v_total_engineer  := COALESCE(v_task.cancel_engineer_comp_amount, 0);
    v_total_principal := 0;
    v_total_owner     := 0 - v_total_engineer;
    v_last_calc_method := COALESCE(v_last_calc_method, '취소_수고비');
    v_last_policy_key  := COALESCE(v_last_policy_key, 'cancel_compensation');
    IF v_track IS NULL THEN v_track := 'A'; END IF;
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
  'v17 (Migration 085 v2, Phase C Step 2) — task_items.received_amount per-row 정산 + v_canceled_active 분기 복원. '
  'v_use_phase_c detect — 어떤 row 측 received_amount NOT NULL 측 신규 path / 전부 NULL 측 v15 (071) verbatim. '
  'v_canceled_active (073 v16) — status=취소 + cancel_engineer_comp_kind 측 set 시 수고비 amount 덮어쓰기. '
  '회귀 0 확인 (2026-05-31): legacy 완료 작업 5건 sample diff = 0.';

-- ============================================
-- [2] compute_engineer_amount_per_item v3 (per-row Phase C 분기 — v1 그대로)
-- ============================================
-- v_canceled_active 측 단일 task-level engineer_amount override 측이라
-- per-item 측 영향 X → 본 v3 측 cancel 분기 별도 추가 안 함.
-- (per-item 측 status='취소' task 측 호출되지 않음 — 클라이언트 측 가드)
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
  -- v3 (Phase C) 신규
  v_use_phase_c       boolean := false;
  v_row_subtotal      int;
  v_row_received      int;
  v_row_extra         int;
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

  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  -- v3: Phase C detect
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

    v_calc_result := calculate_commission(
      v_principal_code, v_service_code, v_appliance_code,
      v_unit_price, 0, 0, NULL
    );

    IF NOT (v_calc_result ->> 'ok')::boolean THEN
      RAISE EXCEPTION 'calculate_commission 실패: %', v_calc_result;
    END IF;

    v_calc_method := v_calc_result ->> 'calc_method';
    v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');

    IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
      v_is_ratio := true;
    END IF;

    -- v3: extra 측 분기 — Phase C (row_extra) vs LEGACY v2 (cleaning_extra_applied + first ratio)
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
        v_unit_price * v_qty, v_item_extra, 0, NULL
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

    v_eng_for_item := v_eng * v_mult;

    -- v3 (Phase C): cleaning row 측 row_extra 측 calc 무시 정책 측 수동 가산 (item 단위)
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

    -- LEGACY v2: 첫 cleaning item 측 cleaning_engineer_bonus 합산 (Phase C 측 제외)
    IF NOT v_use_phase_c AND v_service_code = 'cleaning' AND v_first_cleaning_item THEN
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
  'v3 (Migration 085 v2, Phase C Step 2) — task_items.received_amount per-row 측. '
  'v_use_phase_c 분기 — NULL fallback 측 v2(071) verbatim. 회귀 0. '
  'cancel 분기 측 단일 task-level override 측이라 per-item 측 별도 처리 없음.';

COMMIT;

-- ============================================
-- 검증 SQL (적용 후 별도 실행 — 운영 측 2026-05-31 통과 확인됨)
-- ============================================
--
-- A. 함수 코멘트 확인:
-- SELECT proname, obj_description(oid, 'pg_proc')
-- FROM pg_proc WHERE proname IN ('compute_payment', 'compute_engineer_amount_per_item');
-- 기대: v17 / v3 표기.
--
-- B. 회귀 — legacy 완료 작업 (status='완료', task_items.received_amount NULL):
-- WITH sample AS (
--   SELECT t.id FROM tasks t
--   WHERE t.status = '완료'
--     AND NOT EXISTS (SELECT 1 FROM task_items ti
--                      WHERE ti.task_id = t.id
--                        AND ti.received_amount IS NOT NULL
--                        AND NOT COALESCE(ti.is_canceled, false))
--   ORDER BY random() LIMIT 5
-- )
-- SELECT compute_payment(s.id) FROM sample s;
-- 운영 결과 (2026-05-31): 5건 sample diff=0 ✓
--
-- C. v_canceled_active 회귀 — status='취소' + cancel_engineer_comp_kind 측 set 측 task:
-- SELECT t.id, t.status, t.cancel_engineer_comp_kind, t.cancel_engineer_comp_amount
--   FROM tasks t
--  WHERE t.status='취소' AND t.cancel_engineer_comp_kind IS NOT NULL
--  LIMIT 5;
-- -- compute_payment 호출 → engineer_amount = cancel_engineer_comp_amount, 그 외 0/negative.
--
-- D. A-260529-008 Phase C verification (in-flight, received_amount 백필됨):
-- SELECT t.id, t.product_price, t.received_total, t.extra_fee,
--        p.engineer_amount, p.principal_amount, p.owner_amount
--   FROM tasks t LEFT JOIN payments p ON p.task_id = t.id
--  WHERE t.task_no = 'A-260529-008';
--
-- E. Phase C 시나리오 — refrig row received=180k update (ROLLBACK):
-- BEGIN;
--   UPDATE public.task_items SET received_amount = 180000
--    WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'A-260529-008')
--      AND id IN (
--        SELECT ti.id FROM task_items ti
--          JOIN work_types wt ON wt.id = ti.work_type_id
--          JOIN service_types st ON st.id = wt.service_type_id
--         WHERE ti.task_id = (SELECT id FROM tasks WHERE task_no = 'A-260529-008')
--           AND st.code = 'refrigerant'
--      );
--   SELECT p.engineer_amount FROM payments p JOIN tasks t ON t.id = p.task_id
--    WHERE t.task_no = 'A-260529-008';
-- ROLLBACK;
-- -- 기대 (메인 2개, 세척 70k + refrig 180k): engineer = 40k + 108k = 148k (refrig_rate=60%)
--
-- F. Phase C 시나리오 — 세척 취소 + 냉매 180k:
-- BEGIN;
--   UPDATE public.task_items SET is_canceled = true, canceled_at = now()
--    WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'A-260529-008')
--      AND id IN (...cleaning row...);
--   UPDATE public.task_items SET received_amount = 180000
--    WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'A-260529-008')
--      AND id IN (...refrigerant row...);
-- ROLLBACK;
-- 기대: engineer = 108k ✓ 사장님 spec 일치.
