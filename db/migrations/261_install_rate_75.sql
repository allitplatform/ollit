-- ============================================================================
-- Migration 261 - 설치 기사 몫 80% -> 75% (회사 25%), 2026-10-08 00:00 KST 이후 완료분부터
-- 작성 2026-10-08 · 선행: 200, 258
--
-- 사장님 지시 (블록 72): 설치 수수료 = 회사 25% · 기사 75%.
--
-- 규칙 (날짜 3단계, 기준 = 완료 시각. 완료 전이면 지금 시각)
--   ~ 2026-07-28           기사 75%
--   2026-07-29 ~ 10-07     기사 80%   (mig 200)
--   2026-10-08 ~           기사 75%   (이번)
--   식은 그대로: 기사 = 자재비 + FLOOR((견적 + 추가금 - 자재비) x 비율), 회사 = 나머지.
--
-- 바꾼 것
--   [1] 새 표 install_rate_periods (적용 시작 시각, 기사 비율) + 함수 install_engineer_rate(시각).
--       다음에 비율이 또 바뀌면 이 표에 한 줄만 넣으면 된다 (맨 아래 예시).
--   [2] compute_payment = mig 258 본문 + 1곳 (날짜 분기 -> 표에서 읽기). 조각을 되돌리면 258 본문과 같음을 검사했습니다.
--       설치 비율이 정해지는 곳은 이 한 곳뿐이다 (v_install_rate). 직영 주방후드 · 협력사 분기는 이 값을 쓰지 않는다.
--   [3] calculate_commission = mig 200 본문 + 1곳 (0.80 -> 지금 시각의 표 비율). 조각을 되돌리면 200 본문과 같음을 검사했습니다.
--       이 함수는 접수 · 견적 화면의 미리보기와, 설치 + 다른 종목이 섞인 작업에 쓰인다. 날짜를 받지 않아 "지금" 기준이다.
--
-- 기존 데이터 영향
--   이 파일은 과거 작업을 다시 계산하지 않는다. 10/7 까지 완료된 설치 작업은 나중에 다른 이유로 다시 계산되어도 80% 그대로다.
--   아직 완료되지 않은 설치 작업은 다음에 계산될 때(금액 수정 · 완료 등) 75% 로 바뀐다.
--   주의: 설치 + 다른 종목이 섞인 작업은 [3] 경로라 완료 날짜와 상관없이 다시 계산되는 시점의 비율이 적용된다 (mig 200 때도 같았음).
--
-- 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- [1] 날짜별 비율 표
CREATE TABLE IF NOT EXISTS install_rate_periods (
  effective_from timestamptz PRIMARY KEY,
  engineer_rate  numeric NOT NULL CHECK (engineer_rate > 0 AND engineer_rate <= 1),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE install_rate_periods ENABLE ROW LEVEL SECURITY;   -- 직접 조회 · 수정은 막고, 아래 함수로만 읽는다

INSERT INTO install_rate_periods (effective_from, engineer_rate, note) VALUES
  ('-infinity',                                    0.75, '처음 (mig 198)'),
  ('2026-07-29 00:00:00 Asia/Seoul'::timestamptz,  0.80, 'mig 200 - 회사 20%'),
  ('2026-10-08 00:00:00 Asia/Seoul'::timestamptz,  0.75, 'mig 261 - 회사 25%')
ON CONFLICT (effective_from) DO UPDATE SET engineer_rate = EXCLUDED.engineer_rate, note = EXCLUDED.note;

CREATE OR REPLACE FUNCTION install_engineer_rate(p_at timestamptz DEFAULT now())
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT engineer_rate FROM install_rate_periods
      WHERE effective_from <= COALESCE(p_at, now())
      ORDER BY effective_from DESC LIMIT 1),
    0.75);
$$;
GRANT EXECUTE ON FUNCTION install_engineer_rate(timestamptz) TO anon, authenticated;

-- [2] compute_payment (mig 258 본문 + 설치 비율 1곳)
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
        owner_amount     = v_sub_fee,          -- Mig 258: 수수료만 (부가세는 어느 몫에도 넣지 않는다)
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
          v_sub_eng, 0, v_sub_fee,          -- Mig 258
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
  -- Mig 261 - 비율은 날짜별 비율 표(install_rate_periods)에서 읽는다. 기준 시각은 전과 같다: 완료 시각, 없으면 지금.
  v_install_rate := install_engineer_rate(COALESCE(v_task.completed_at, now()));

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

-- [3] calculate_commission (mig 200 본문 + 직영_75_25 1곳)
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
      -- Mig 261 - 지금 시각의 설치 비율 (날짜별 비율 표). 이 함수는 날짜를 받지 않으므로 '지금' 기준이다.
      v_engineer  := FLOOR(v_total * install_engineer_rate(now()))::int;
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

COMMIT;

-- 검증 - 기대: 두 줄 모두 uses_table = true / 비율 3줄 (0.75, 0.80, 0.75)
SELECT proname, prosrc LIKE '%install_engineer_rate%' AS uses_table
  FROM pg_proc WHERE proname IN ('compute_payment', 'calculate_commission') ORDER BY proname;
SELECT effective_from AT TIME ZONE 'Asia/Seoul' AS from_kst, engineer_rate, note FROM install_rate_periods ORDER BY effective_from;

-- 다음에 비율이 또 바뀌면 (예: 2027-01-01 부터 기사 78%):
-- INSERT INTO install_rate_periods (effective_from, engineer_rate, note)
-- VALUES ('2027-01-01 00:00:00 Asia/Seoul'::timestamptz, 0.78, '사유');
