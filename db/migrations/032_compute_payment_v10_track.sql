-- 032_compute_payment_v10_track.sql
-- 2026-05-18 Fix #29 — compute_payment에 자금 흐름 트랙 자동 결정 추가
-- 사장님 spec (2026-05-18 확정):
--
--   트랙 🅐 (일일정산, 기사 → 회사, 23:00 KST 마감):
--     · 6개 원청: allday / KA / KB / yongin / usol_h / crikrin
--     · usol_n 냉매 (네이버 1만원 100% 유솔, 현장 추가금만 기사→회사 50:50)
--
--   트랙 🅑 (월정산, 회사 → 기사, 매월 15일):
--     · usol_n 세척 (cleaning)
--     · usol_n 추가선택 (송풍팬분해/층고, 피톤치드, 실외기 등 — 별도 SKU)
--
-- 분류 로직:
--   IF principal_code = 'usol_n' AND task에 refrigerant 외 service_code 존재 → 🅑
--   ELSE → 🅐
--
-- v9 → v10 변경 (3군데만 추가, 기존 v9 본체 무손상):
--   1) DECLARE — v_track / v_has_non_refrigerant 변수 추가
--   2) FOR LOOP 안 (v_service_code 결정 직후) — refrigerant 외 service_code 감지
--   3) LOOP 종료 후 INSERT 전 — 트랙 분기
--   4) INSERT INTO payments — track 컬럼 + v_track 값 추가
--
-- 의존:
--   - Migration 031 (payments.track 컬럼 + CHECK + idx) 선행 실행 필수
--
-- 회귀 방지:
--   - v9 정산 로직 (engineer/principal/owner 합산, cleaning 추가금, extra_fee 분배) 완전 무손상
--   - track 자동 'A' default + CHECK 제약 → 잘못된 값 차단
--   - usol_n 작업 0건이라 기존 12 payments 백필 재계산해도 전부 'A' 그대로
--
-- 실행:
--   - Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   - CREATE OR REPLACE FUNCTION이라 재실행 안전 (idempotent)
--   - 백필 SELECT는 선택 (12건 재계산 — 함수 변경 검증 + track 자동 적용 확인)

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
  v_extra_applied     boolean := false;  -- v8: 비-cleaning 비율형 첫 item만 extra_fee 적용
  v_total_engineer    int := 0;
  v_total_principal   int := 0;
  v_total_owner       int := 0;
  v_principal_applied boolean := false;
  v_last_calc_method  text;
  v_last_policy_key   text;
  v_payment_id        uuid;
  -- v9 신규: 세척 추가금 별도 누적
  v_cleaning_extra_applied   boolean := false;
  v_cleaning_engineer_bonus  int := 0;
  v_cleaning_principal_bonus int := 0;
  -- v10 신규: 자금 흐름 트랙 분류 (Fix #29)
  v_track                CHAR(1) := 'A';
  v_has_non_refrigerant  boolean := false;
BEGIN
  -- 1) task 조회
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 찾을 수 없음: %', p_task_id;
  END IF;

  -- 2) principal_code 조회
  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 찾을 수 없음: principal_id=%', v_task.principal_id;
  END IF;

  -- 3) task_items 총수량 (017 trigger 자동 적용)
  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items WHERE task_id = p_task_id;

  IF v_total_qty = 0 THEN
    RAISE EXCEPTION 'task_items 찾을 수 없음: task_id=%', p_task_id;
  END IF;

  -- 4) fallback unit price (Math.floor — 정수형 변환)
  v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

  -- 5) task_items 순회 — 각 항목별 calculate_commission 호출 + 합산
  FOR v_item IN
    SELECT
      ti.qty,
      ti.unit_price,
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

    -- v10 신규 (Fix #29): refrigerant 외 service_code 감지 (트랙 분류용)
    -- 한 task = 한 service_code가 일반적이지만 보수적으로 누적 플래그 사용.
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

    -- v9 신규: 세척 추가금 적용 spec
    IF v_service_code = 'cleaning' THEN
      -- 정책에 extra 미적용 (정책 비율 미적용 — 견적만 정책 적용)
      v_item_extra := 0;

      -- 첫 cleaning item — 추가금 1회만 적용
      IF NOT v_cleaning_extra_applied THEN
        IF v_principal_code = 'usol_n' THEN
          -- usol_n: 원청 15% 정수 먼저, 나머지 기사 (회사 0%)
          v_cleaning_principal_bonus := FLOOR(COALESCE(v_task.extra_fee, 0) * 0.15)::int;
          v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0) - v_cleaning_principal_bonus;
        ELSE
          -- 그 외 원청: 기사 100%
          v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0);
          v_cleaning_principal_bonus := 0;
        END IF;
        v_cleaning_extra_applied := true;
        v_extra_applied := true;  -- 비-cleaning 비율형 중복 적용 방지
      END IF;
    ELSE
      -- v8 spec 그대로 적용 (refrigerant 측 — 비율형 첫 item에 extra_fee 적용)
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

  -- v9 신규: 세척 추가금 적용 (루프 종료 후 1회 합산)
  v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
  v_total_principal := v_total_principal + v_cleaning_principal_bonus;

  -- 6) owner 계산 — is_balanced GENERATED 적용되어 (eng + prin + owner) = (product + extra + travel) 일치 spec
  v_total_owner := COALESCE(v_task.product_price, 0)
                 + COALESCE(v_task.extra_fee, 0)
                 + COALESCE(v_task.travel_fee, 0)
                 - v_total_engineer
                 - v_total_principal;

  -- v10 신규 (Fix #29): 자금 흐름 트랙 분기
  --   usol_n + refrigerant 외 service_code 존재 → 트랙 🅑 (월정산, 회사→기사)
  --   그 외                                      → 트랙 🅐 (일일정산, 기사→회사)
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
    COALESCE(v_task.product_price, 0),
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
  'v10 — 자금 흐름 트랙 자동 결정 적용 (Fix #29). usol_n + non-refrigerant → B, 그 외 → A.';

-- ============================================
-- (선택) 백필 — 기존 12 payments 재계산 → track 자동 적용 검증
-- 사장님 측 Supabase SQL Editor에서 실행:
-- ============================================
-- SELECT compute_payment(t.id) AS payment_id, t.task_no, t.customer_name
-- FROM tasks t
-- WHERE EXISTS (SELECT 1 FROM payments WHERE task_id = t.id)
-- ORDER BY t.created_at DESC;
--
-- 기대: 12건 재계산 + 모두 track='A' 그대로 (usol_n 0건)
--   · engineer_amount / principal_amount / owner_amount 변동 0건 (v9 로직 무손상)

-- ============================================
-- 검증 SQL — 함수 v10 적용 확인
-- ============================================
-- SELECT
--   p.proname,
--   obj_description(p.oid, 'pg_proc') AS comment
-- FROM pg_proc p
-- WHERE p.proname = 'compute_payment';
--
-- 기대: comment = 'v10 — 자금 흐름 트랙 자동 결정 적용 (Fix #29). ...'

-- ============================================
-- 검증 SQL — 백필 후 track 분포
-- ============================================
-- SELECT track, COUNT(*) AS cnt
-- FROM payments
-- GROUP BY track
-- ORDER BY track;
--
-- 기대: A=12 (usol_n 0건이라 B 없음)
