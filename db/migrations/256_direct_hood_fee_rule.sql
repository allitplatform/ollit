-- ============================================================================
-- Migration 256 - 직영 주방후드 수수료(협력사와 같은 구조) + 원청 송금 줄 + 알림 2종
-- 작성 2026-10-07 · 선행: 203, 215, 244, 245, 247, 248, 252, 254, 255
--
-- 사장님 결정 (2026-10-07, 블록 52)
--   1. 직영으로 한 주방후드 = 협력사와 같은 구조.
--        기사 몫 = 받은 공급가 x 65% / 수수료 = 받은 공급가 x 35%
--        수수료 안에서: 원청 KB 면 쿨가이 몫 = LEAST(견적 공급가 x 35%, 수수료), 올데이케어 = 나머지.
--        다른 원청이면 수수료 전부 올데이케어.
--      견적 = 보관 견적과 같은 방식(접수 견적, 작업 시작 전까지 따라감, [견적 수정] 가능).
--      원청 송금 줄 = 작업 완료 당일 줄. 같은 날 협력사 줄이 있으면 합치고, 이미 송금 완료면 다음 날짜 줄.
--   2. 원청 앱으로 들어온 새 작업 -> 운영자에게 푸시 (원청 전체 공통).
--   3. [원청 송금 완료] -> 쿨가이 계정에 푸시 (원청 KB 만).
--   4. 견적은 전부 공급가(부가세 별도).
--
-- 저장 방식 (협력사 작업과 같게 - "나안")
--   payments.owner_amount        = 수수료 전액 (35%)
--   payments.sub_principal_share = 그 가운데 쿨가이 몫
--   payments.engineer_amount     = 기사 몫 (65%)
--   payments.principal_amount    = 0   (기존 원청 일일 정산 화면과 겹치지 않게)
--   track = 'A'
--   가계부(mig 246)는 이미 "owner_amount - sub_principal_share" 로 집계하므로 그대로 맞는다.
--
-- 내용
--   [1] fee_rules: 직영 줄을 둘 수 있게 subcontractor_id 를 비울 수 있게 함 + 직영 x 주방후드 규칙 2줄
--   [2] compute_payment (원문 mig 244 + 직영 주방후드 분기 1곳. 조각을 빼면 원문과 같음을 검사)
--   [3] trg_tasks_sub_quote_snapshot (원문 mig 248 + 조건 1곳): 주방후드는 직영이어도 견적을 보관
--   [4] admin_set_sub_quote / admin_get_sub_splits (원문 mig 244 + 조건): 직영 주방후드도 [견적 수정] · 분배 보기
--   [5] _principal_remit_build (원문 mig 252 + 2곳): 직영 주방후드 작업을 대상에 더함
--       _principal_remit_sync_direct + 트리거 2개: 완료 · 금액 변경 때 그날 줄에 반영
--   [6] 알림: 원청 앱 새 접수 -> 운영자 / 원청 송금 완료 -> 쿨가이 (admin_mark_principal_remit_paid 이름 변경 + 감싸기)
--   [7] 쿨가이 화면 함수 2개 (mig 255 본문 + 직영 작업의 수수료도 읽게)
--
-- 기존 데이터 영향: 없음 (이미 계산된 payments · 송금 줄은 건드리지 않습니다). 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 규칙표
-- ============================================================
ALTER TABLE fee_rules ALTER COLUMN subcontractor_id DROP NOT NULL;
COMMENT ON COLUMN fee_rules.subcontractor_id IS
  '협력사. NULL = 직영 작업용 규칙 (mig 256: service_code = hood 는 종목 주방후드 전체를 뜻한다).';

-- 직영 x 주방후드 x 쿨가이(KB): 수수료 35%(공급가) + 원청 몫 35%(견적)
INSERT INTO fee_rules (tenant_id, subcontractor_id, principal_code, service_code, fee_type, fee_rate, fee_base,
                       principal_rate, principal_base, effective_from, memo)
SELECT '11111111-1111-1111-1111-111111111111', NULL, 'KB', 'hood', 'rate', 0.35, 'supply', 0.35, 'quote', DATE '2026-10-01',
       '직영 x 주방후드 x 쿨가이(KB): 기사 65% / 수수료 35%(공급가). 그 가운데 쿨가이 몫 = 견적 공급가의 35% (수수료를 넘지 않음). 2026-10-07 사장님 확정.'
 WHERE NOT EXISTS (SELECT 1 FROM fee_rules f
                    WHERE f.subcontractor_id IS NULL AND f.service_code = 'hood' AND f.principal_code = 'KB');

-- 직영 x 주방후드 x 그 밖의 원청: 수수료 35% 전부 올데이케어
INSERT INTO fee_rules (tenant_id, subcontractor_id, principal_code, service_code, fee_type, fee_rate, fee_base,
                       effective_from, memo)
SELECT '11111111-1111-1111-1111-111111111111', NULL, NULL, 'hood', 'rate', 0.35, 'supply', DATE '2026-10-01',
       '직영 x 주방후드: 기사 65% / 수수료 35%(공급가). 2026-10-07 사장님 확정.'
 WHERE NOT EXISTS (SELECT 1 FROM fee_rules f
                    WHERE f.subcontractor_id IS NULL AND f.service_code = 'hood' AND f.principal_code IS NULL);

-- ============================================================
-- [2] 계산
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
      v_sub_supply := COALESCE(NULLIF(v_task.supply_amount, 0), v_sub_total);
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

-- ============================================================
-- [3] 견적 보관
-- ============================================================
CREATE OR REPLACE FUNCTION trg_tasks_sub_quote_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mig 256: 주방후드는 직영이어도 견적을 보관한다 (원청 몫 계산에 쓴다)
  IF (NEW.subcontractor_id IS NULL
      AND NEW.category_id IS DISTINCT FROM (SELECT id FROM categories WHERE code = 'hood' LIMIT 1))
     OR NEW.sub_quote_edited_at IS NOT NULL THEN
    RETURN NEW;                       -- 협력사 작업이 아니거나, 운영자가 직접 고친 값이 있으면 그대로 둔다
  END IF;
  -- 협력사로 넘기는 순간
  IF TG_OP = 'INSERT' OR OLD.subcontractor_id IS DISTINCT FROM NEW.subcontractor_id THEN
    NEW.sub_quote_supply := COALESCE(NEW.product_price, 0);
    RETURN NEW;
  END IF;
  -- 넘긴 뒤 접수 견적이 바뀜 -> 작업을 시작하기 전까지만 따라간다.
  --   시작한 뒤(진행 중 · 완료 등)에 바뀐 금액은 현장 추가분이므로 보관 견적은 그대로 둔다.
  IF NEW.product_price IS DISTINCT FROM OLD.product_price
     AND OLD.started_at IS NULL AND NEW.started_at IS NULL
     AND COALESCE(OLD.status, '') NOT IN ('진행중', '완료', '정산완료', 'visit_only', '취소')
     AND COALESCE(NEW.status, '') NOT IN ('진행중', '완료', '정산완료', 'visit_only', '취소') THEN
    NEW.sub_quote_supply := COALESCE(NEW.product_price, 0);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- [4] 운영자: 견적 수정 / 분배 보기
-- ============================================================
CREATE OR REPLACE FUNCTION admin_set_sub_quote(
  p_actor uuid, p_token text, p_task_id uuid, p_amount int, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task   tasks%ROWTYPE;
  v_reason text := LEFT(btrim(COALESCE(p_reason, '')), 300);
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '견적 금액을 0 이상으로 입력해 주세요.');
  END IF;
  IF v_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '고치는 사유를 입력해 주세요.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  -- Mig 256: 직영 주방후드도 견적을 고칠 수 있다
  IF v_task.subcontractor_id IS NULL
     AND v_task.category_id IS DISTINCT FROM (SELECT id FROM categories WHERE code = 'hood' LIMIT 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사로 넘긴 작업이 아닙니다.');
  END IF;

  UPDATE tasks SET sub_quote_supply = p_amount, sub_quote_edited_at = now(), sub_quote_edited_by = p_actor, updated_at = now()
   WHERE id = p_task_id;

  PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'admin',
    '협력사 견적 수정: ' || COALESCE(v_task.sub_quote_supply, 0) || ' -> ' || p_amount || ' (' || v_reason || ')',
    jsonb_build_object('subQuoteSupply', v_task.sub_quote_supply),
    jsonb_build_object('subQuoteSupply', p_amount));

  -- 이미 분배가 계산된 작업이면 다시 계산 (수수료는 그대로, 원청 몫만 달라진다)
  IF EXISTS (SELECT 1 FROM payments p WHERE p.task_id = p_task_id
              AND (p.track = 'S' OR v_task.subcontractor_id IS NULL)) THEN
    PERFORM compute_payment(p_task_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'sub_quote_supply', p_amount);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_set_sub_quote(uuid, text, uuid, int, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_get_sub_splits(p_actor uuid, p_token text, p_task_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'rows', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'task_id', t.id,
             'principal_code', pr.code,
             'principal_name', pr.name,
             'quote', t.sub_quote_supply,
             'quote_edited_at', t.sub_quote_edited_at,
             'quote_edited_by', (SELECT u.name FROM users u WHERE u.id = t.sub_quote_edited_by),
             'product_price', t.product_price,
             'supply', t.supply_amount,
             'fee', p.owner_amount,
             'share', COALESCE(p.sub_principal_share, 0),
             'note', p.sub_principal_note,
             -- 이 작업에 원청 몫 규칙이 걸리는지 (분배가 아직 없어도 화면에서 안내할 수 있게)
             'has_rule', EXISTS (SELECT 1 FROM fee_rules f
                                  WHERE (f.subcontractor_id = t.subcontractor_id
                                         OR (t.subcontractor_id IS NULL AND f.subcontractor_id IS NULL AND f.service_code = 'hood'))   -- Mig 256
                                    AND f.active
                                    AND f.principal_code = pr.code AND f.principal_rate IS NOT NULL)))
      FROM tasks t
      LEFT JOIN principals pr ON pr.id = t.principal_id
      LEFT JOIN payments p    ON p.task_id = t.id AND (p.track = 'S' OR t.subcontractor_id IS NULL)
     WHERE t.id = ANY (p_task_ids)
       AND (t.subcontractor_id IS NOT NULL
            OR t.category_id = (SELECT id FROM categories WHERE code = 'hood' LIMIT 1))), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_sub_splits(uuid, text, uuid[]) TO anon, authenticated;

-- ============================================================
-- [5] 원청 송금 줄
-- ============================================================
CREATE OR REPLACE FUNCTION _principal_remit_build(p_sub uuid, p_date date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_remit  uuid;
  v_carry  int;
  r        record;
BEGIN
  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = p_sub;

  -- 원청별로: 입금 확인된 날짜에 속한 작업들의 (지금 몫 - 이미 줄로 만든 몫)
  FOR r IN
    SELECT x.principal_id,
           jsonb_agg(jsonb_build_object('task_id', x.task_id, 'delta', x.delta, 'share', x.share)) AS items,
           SUM(x.delta)::int AS total
      FROM (
        SELECT t.principal_id, t.id AS task_id,
               COALESCE((SELECT CASE WHEN t.subcontractor_id IS NULL AND t.status IS DISTINCT FROM '완료' THEN 0 ELSE p.sub_principal_share END FROM payments p WHERE p.task_id = t.id AND (p.track = 'S' OR t.subcontractor_id IS NULL) LIMIT 1), 0) AS share,
               COALESCE((SELECT CASE WHEN t.subcontractor_id IS NULL AND t.status IS DISTINCT FROM '완료' THEN 0 ELSE p.sub_principal_share END FROM payments p WHERE p.task_id = t.id AND (p.track = 'S' OR t.subcontractor_id IS NULL) LIMIT 1), 0)
                 - COALESCE((SELECT SUM(pl.delta) FROM principal_remit_lines pl WHERE pl.task_id = t.id), 0)::int AS delta
          FROM tasks t
         WHERE t.principal_id IS NOT NULL
           AND t.id IN (
             SELECT l.task_id
               FROM subcontractor_settlement_lines l
               JOIN subcontractor_daily_settlements d
                 ON d.subcontractor_id = l.subcontractor_id AND d.settle_date = l.settle_date
              WHERE l.subcontractor_id = p_sub AND d.confirmed_at IS NOT NULL
             UNION
             -- Mig 252: [받음 확인] 한 추가분의 작업
             SELECT el.task_id
               FROM subcontractor_fee_extra_lines el
               JOIN subcontractor_fee_extras e ON e.id = el.extra_id
              WHERE e.subcontractor_id = p_sub AND e.received_at IS NOT NULL
             UNION
             -- Mig 256: 직영 주방후드 (이 협력사에 원청 몫 규칙이 있는 원청의 작업). 완료된 것 + 이미 줄이 있는 것
             SELECT dt.id
               FROM tasks dt
              WHERE dt.subcontractor_id IS NULL
                AND dt.category_id = (SELECT id FROM categories WHERE code = 'hood' LIMIT 1)
                AND (dt.status = '완료' OR EXISTS (SELECT 1 FROM principal_remit_lines dl WHERE dl.task_id = dt.id))
                AND EXISTS (SELECT 1 FROM principals dp JOIN fee_rules df ON df.principal_code = dp.code
                             WHERE dp.id = dt.principal_id AND df.subcontractor_id = p_sub
                               AND df.active AND df.principal_rate IS NOT NULL))
      ) x
     WHERE x.delta <> 0
     GROUP BY x.principal_id
  LOOP
    INSERT INTO principal_remits (tenant_id, principal_id, subcontractor_id, settle_date, amount)
    VALUES (v_tenant, r.principal_id, p_sub, p_date, 0)
    ON CONFLICT (principal_id, subcontractor_id, settle_date) DO NOTHING;
    SELECT id INTO v_remit FROM principal_remits
     WHERE principal_id = r.principal_id AND subcontractor_id = p_sub AND settle_date = p_date;
    -- 이미 [송금 완료] 한 줄에는 더하지 않는다 (다음 입금 확인 때 차이로 다시 잡힌다)
    CONTINUE WHEN (SELECT paid_at IS NOT NULL FROM principal_remits WHERE id = v_remit);

    INSERT INTO principal_remit_lines (remit_id, task_id, delta, share_after)
    SELECT v_remit, (i ->> 'task_id')::uuid, (i ->> 'delta')::int, (i ->> 'share')::int
      FROM jsonb_array_elements(r.items) i;

    -- 앞에 남아 있는 "보낼 것 없는 줄"(0 이하, 아직 넘기지 않은 것)을 이 줄로 넘겨받는다
    SELECT COALESCE(SUM(pr.amount), 0)::int INTO v_carry
      FROM principal_remits pr
     WHERE pr.principal_id = r.principal_id AND pr.subcontractor_id = p_sub
       AND pr.id <> v_remit AND pr.amount <= 0 AND pr.paid_at IS NULL AND pr.absorbed_into IS NULL
       AND pr.settle_date < p_date;
    UPDATE principal_remits pr SET absorbed_into = v_remit
     WHERE pr.principal_id = r.principal_id AND pr.subcontractor_id = p_sub
       AND pr.id <> v_remit AND pr.amount <= 0 AND pr.paid_at IS NULL AND pr.absorbed_into IS NULL
       AND pr.settle_date < p_date;

    UPDATE principal_remits pr
       SET carried_in = pr.carried_in + v_carry,
           amount = (SELECT COALESCE(SUM(pl.delta), 0)::int FROM principal_remit_lines pl WHERE pl.remit_id = pr.id)
                    + pr.carried_in + v_carry
     WHERE pr.id = v_remit;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION _principal_remit_build(uuid, date) FROM PUBLIC, anon, authenticated;

-- 직영 주방후드 작업 1건의 원청 몫 변동을 그날 줄에 반영한다.
--   줄은 "그 원청의 원청 몫 규칙을 가진 협력사" 의 날짜 줄에 합친다 (같은 날 협력사 줄과 한 줄).
--   그날 줄이 이미 [원청 송금 완료] 면 다음 날짜 줄로 넘어간다.
CREATE OR REPLACE FUNCTION _principal_remit_sync_direct(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task  tasks%ROWTYPE;
  v_sub   uuid;
  v_date  date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  i       int := 0;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND OR v_task.subcontractor_id IS NOT NULL OR v_task.principal_id IS NULL THEN RETURN; END IF;
  IF v_task.category_id IS DISTINCT FROM (SELECT id FROM categories WHERE code = 'hood' LIMIT 1) THEN RETURN; END IF;

  SELECT f.subcontractor_id INTO v_sub
    FROM fee_rules f
    JOIN principals p ON p.code = f.principal_code
   WHERE p.id = v_task.principal_id AND f.subcontractor_id IS NOT NULL AND f.active AND f.principal_rate IS NOT NULL
   ORDER BY f.effective_from DESC
   LIMIT 1;
  IF v_sub IS NULL THEN RETURN; END IF;          -- 원청 몫 규칙이 없는 원청

  WHILE i < 14 AND EXISTS (SELECT 1 FROM principal_remits pr
                            WHERE pr.principal_id = v_task.principal_id AND pr.subcontractor_id = v_sub
                              AND pr.settle_date = v_date AND pr.paid_at IS NOT NULL) LOOP
    v_date := v_date + 1; i := i + 1;
  END LOOP;

  PERFORM _principal_remit_build(v_sub, v_date);
END;
$$;
REVOKE ALL ON FUNCTION _principal_remit_sync_direct(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION trg_direct_hood_principal_remit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task uuid;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    v_task := COALESCE(NEW.task_id, OLD.task_id);
  ELSE
    v_task := NEW.id;
  END IF;
  BEGIN
    PERFORM _principal_remit_sync_direct(v_task);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[direct hood remit] task % 실패 - 처리는 계속: %', v_task, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS payments_direct_hood_principal_remit ON payments;
CREATE TRIGGER payments_direct_hood_principal_remit
  AFTER INSERT OR UPDATE OF sub_principal_share OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_direct_hood_principal_remit();

DROP TRIGGER IF EXISTS tasks_direct_hood_principal_remit ON tasks;
CREATE TRIGGER tasks_direct_hood_principal_remit
  AFTER UPDATE OF status ON tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.subcontractor_id IS NULL
        AND (OLD.status = '완료' OR NEW.status = '완료'))
  EXECUTE FUNCTION trg_direct_hood_principal_remit();

-- ============================================================
-- [6] 알림
-- ============================================================
-- 6-1. 원청 앱으로 들어온 새 작업 -> 운영자
CREATE OR REPLACE FUNCTION trg_tasks_partner_reception_push()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pname text;
  v_work  text := COALESCE(NEW.category_data ->> 'workType', '작업');
BEGIN
  BEGIN
    SELECT name INTO v_pname FROM principals WHERE id = NEW.principal_id;
    PERFORM _msg_push(jsonb_build_object(
      'targetType', 'role', 'targetId', 'admin',
      'title', '📥 원청 새 접수',
      'body', COALESCE(v_pname, '원청') || ' · ' || COALESCE(NEW.customer_name, '고객') || ' · ' || v_work,
      'url', '/', 'tag', 'partner-new-' || NEW.id::text, 'taskId', NEW.id::text));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[partner reception push] 실패 - 접수는 계속: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tasks_partner_reception_push ON tasks;
CREATE TRIGGER tasks_partner_reception_push
  AFTER INSERT ON tasks
  FOR EACH ROW
  WHEN (NEW.channel = '원청앱')
  EXECUTE FUNCTION trg_tasks_partner_reception_push();

-- 6-2. [원청 송금 완료] -> 쿨가이 (이름 변경 + 감싸기. 안쪽 원본 = mig 247 본문)
DO $$
BEGIN
  IF to_regprocedure('_impl_admin_mark_principal_remit_paid(uuid, text, uuid, boolean)') IS NULL THEN
    ALTER FUNCTION admin_mark_principal_remit_paid(uuid, text, uuid, boolean) RENAME TO _impl_admin_mark_principal_remit_paid;
  END IF;
END $$;
REVOKE ALL ON FUNCTION _impl_admin_mark_principal_remit_paid(uuid, text, uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION admin_mark_principal_remit_paid(p_actor uuid, p_token text, p_remit_id uuid, p_paid boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_res jsonb;
  v_r   principal_remits%ROWTYPE;
  v_cnt int;
  u     record;
BEGIN
  v_res := _impl_admin_mark_principal_remit_paid(p_actor, p_token, p_remit_id, p_paid);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) OR NOT COALESCE(p_paid, true)
     OR COALESCE((v_res ->> 'already')::boolean, false) THEN
    RETURN v_res;
  END IF;

  BEGIN
    SELECT * INTO v_r FROM principal_remits WHERE id = p_remit_id;
    IF FOUND AND EXISTS (SELECT 1 FROM principals p WHERE p.id = v_r.principal_id AND p.code = 'KB') THEN
      SELECT COUNT(DISTINCT pl.task_id)::int INTO v_cnt FROM principal_remit_lines pl WHERE pl.remit_id = v_r.id;
      FOR u IN SELECT DISTINCT r.user_id FROM user_roles r
                WHERE r.role = 'partner' AND r.principal_id = v_r.principal_id AND r.user_id IS NOT NULL LOOP
        PERFORM _msg_push(jsonb_build_object(
          'targetType', 'user', 'targetId', u.user_id::text,
          'title', '💰 쿨가이 수수료 송금 완료',
          'body', to_char(v_r.settle_date, 'FMMM/FMDD') || ' · ' || COALESCE(v_cnt, 0) || '건 · ₩' || to_char(v_r.amount, 'FM999,999,999,999'),
          'url', '/', 'tag', 'kb-remit-paid-' || v_r.id::text, 'kind', 'partnerSettle'));
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[principal remit push] 실패 - 송금 완료는 계속: %', SQLERRM;
  END;

  RETURN v_res;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_mark_principal_remit_paid(uuid, text, uuid, boolean) TO anon, authenticated;

-- ============================================================
-- [7] 쿨가이 화면 함수 (mig 255 본문 + 직영 작업의 수수료 · 보관 견적도 읽게)
-- ============================================================
CREATE OR REPLACE FUNCTION _partner_kb_task_json(p_task_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'id', t.id,
           'task_no', t.task_no,
           'customer', COALESCE(NULLIF(btrim(t.customer_name), ''), '고객'),
           'phone', t.phone,
           'address', t.address,
           'scheduled_at', t.scheduled_at,
           'received_at', t.received_at,
           'completed_at', CASE WHEN t.status = '완료' THEN t.completed_at ELSE NULL END,
           'status', t.status,
           'performer', '올데이케어',
           -- 견적: 협력사로 넘긴 작업은 보관 견적(공급가), 그 밖에는 접수 견적. 0 이면 "견적 미정"
           'quote', CASE WHEN t.subcontractor_id IS NOT NULL THEN t.sub_quote_supply
                         ELSE COALESCE(t.sub_quote_supply, NULLIF(COALESCE(t.product_price, 0), 0)) END,   -- Mig 256
           -- 수수료: 완료 전 = pending / 완료 + 원청 몫 있음 = done / 완료인데 없음 = checking / 취소·출장만 = none
           'fee_state', CASE
                          WHEN t.status IN ('취소', 'visit_only') THEN 'none'
                          WHEN t.status <> '완료' THEN 'pending'
                          WHEN COALESCE(sh.share, 0) > 0 THEN 'done'
                          ELSE 'checking'
                        END,
           'fee', CASE WHEN t.status = '완료' AND COALESCE(sh.share, 0) > 0 THEN sh.share ELSE NULL END,
           -- 쿨가이가 직접 취소할 수 있는가: 아직 아무에게도 배정되지 않은 접수만
           'can_cancel', (t.status = '미배정' AND t.assigned_engineer_id IS NULL AND t.subcontractor_id IS NULL),
           'workItems', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                       'serviceCode', COALESCE(st.code, ''),
                       'workType', COALESCE(wt.name, ''),
                       'appliance', COALESCE(ap.name, ''),
                       'qty', COALESCE(ti.qty, 1),
                       'isCanceled', COALESCE(ti.is_canceled, false)))
                FROM task_items ti
                LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
                LEFT JOIN service_types st   ON st.id = wt.service_type_id
                LEFT JOIN appliance_types ap ON ap.id = ti.appliance_type_id
               WHERE ti.task_id = t.id), '[]'::jsonb))
    FROM tasks t
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(p.sub_principal_share), 0)::int AS share
        FROM payments p WHERE p.task_id = t.id AND (p.track = 'S' OR t.subcontractor_id IS NULL)   -- Mig 256
    ) sh ON true
   WHERE t.id = p_task_id;
$$;
REVOKE ALL ON FUNCTION _partner_kb_task_json(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION partner_kb_list_remits(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_pid   uuid;
  v_hood  uuid := _partner_kb_hood_category();
  v_from  timestamptz := date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
  v_to    timestamptz := (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') + interval '1 month') AT TIME ZONE 'Asia/Seoul';
  v_total int;
  v_recv  int;
  v_wait  int;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_pid := _caller_kb_principal(p_actor);
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 화면을 볼 수 있는 계정이 아닙니다.');
  END IF;

  SELECT COALESCE(SUM(p.sub_principal_share), 0)::int INTO v_total
    FROM tasks t JOIN payments p ON p.task_id = t.id AND (p.track = 'S' OR t.subcontractor_id IS NULL)   -- Mig 256
   WHERE t.principal_id = v_pid AND t.category_id = v_hood
     AND t.status = '완료' AND t.completed_at >= v_from AND t.completed_at < v_to;

  SELECT COALESCE(SUM(pr.amount), 0)::int INTO v_recv
    FROM principal_remits pr
   WHERE pr.principal_id = v_pid AND pr.paid_at >= v_from AND pr.paid_at < v_to;

  -- 송금 예정 = 줄은 생겼고 아직 송금 완료가 아닌 금액 (달과 무관)
  SELECT COALESCE(SUM(pr.amount), 0)::int INTO v_wait
    FROM principal_remits pr
   WHERE pr.principal_id = v_pid AND pr.paid_at IS NULL AND pr.absorbed_into IS NULL AND pr.amount > 0;

  RETURN jsonb_build_object('ok', true,
    'month', jsonb_build_object(
      'label', to_char(now() AT TIME ZONE 'Asia/Seoul', 'FMMM') || '월',
      'total', v_total, 'received', v_recv, 'waiting', v_wait),
    'rows', COALESCE((
      SELECT jsonb_agg(q.j ORDER BY q.settle_date DESC)
        FROM (
          SELECT pr.settle_date,
                 jsonb_build_object(
                   'id', pr.id, 'date', pr.settle_date, 'amount', pr.amount, 'carried_in', pr.carried_in,
                   'paid_at', pr.paid_at,
                   'task_count', (SELECT COUNT(DISTINCT pl.task_id)::int FROM principal_remit_lines pl WHERE pl.remit_id = pr.id),
                   'lines', COALESCE((
                      SELECT jsonb_agg(jsonb_build_object('task_id', t.id, 'task_no', t.task_no, 'amount', pl.delta)
                                       ORDER BY t.task_no)
                        FROM principal_remit_lines pl JOIN tasks t ON t.id = pl.task_id
                       WHERE pl.remit_id = pr.id), '[]'::jsonb)) AS j
            FROM principal_remits pr
           WHERE pr.principal_id = v_pid
             AND pr.absorbed_into IS NULL
             AND (pr.paid_at IS NOT NULL OR pr.amount > 0)
             AND (pr.settle_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 180 OR pr.paid_at IS NULL)
        ) q), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION partner_kb_list_remits(uuid, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 규칙 - 기대: 2행 (KB: 0.35 / 0.35, 그 밖: 0.35 / 비어 있음)
SELECT principal_code, service_code, fee_rate, fee_base, principal_rate, principal_base
  FROM fee_rules WHERE subcontractor_id IS NULL AND service_code = 'hood' ORDER BY principal_code NULLS LAST;

-- 2) 계산식 (규칙표 값 + 원청 몫 함수로 직접 계산. compute_payment 안의 식과 같은 식입니다)
--    기대:  견적 100000 / 받은 150000 -> 기사 97500 · 쿨가이 35000 · 올데이케어 17500
--           견적 100000 / 받은 100000 -> 기사 65000 · 쿨가이 35000 · 올데이케어 0
SELECT v.quote AS "견적", v.supply AS "받은 공급가",
       v.supply - ROUND(v.supply * f.fee_rate)::int                                            AS "기사",
       _sub_principal_share(v.quote, ROUND(v.supply * f.fee_rate)::int, f.principal_rate)      AS "쿨가이",
       ROUND(v.supply * f.fee_rate)::int
         - _sub_principal_share(v.quote, ROUND(v.supply * f.fee_rate)::int, f.principal_rate)  AS "올데이케어"
  FROM (VALUES (100000, 150000), (100000, 100000)) AS v(quote, supply)
  JOIN fee_rules f ON f.subcontractor_id IS NULL AND f.service_code = 'hood' AND f.principal_code = 'KB';

-- 3) 함수에 조각이 들어갔는가 - 기대: 5행 모두 true
SELECT proname, prosrc LIKE '%Mig 256%' AS has_256
  FROM pg_proc
 WHERE proname IN ('compute_payment', 'trg_tasks_sub_quote_snapshot', 'admin_set_sub_quote',
                   'admin_get_sub_splits', '_principal_remit_build')
 ORDER BY 1;

-- 4) 트리거 - 기대: 3행
SELECT tgname FROM pg_trigger
 WHERE tgname IN ('payments_direct_hood_principal_remit', 'tasks_direct_hood_principal_remit', 'tasks_partner_reception_push')
   AND NOT tgisinternal ORDER BY 1;
