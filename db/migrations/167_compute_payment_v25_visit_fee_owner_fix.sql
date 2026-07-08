-- ============================================================================
-- Migration 167 - compute_payment v25 - usol_n visit_only owner 이중가산 제거
-- Date    : 2026-07-08
-- Base    : Mig 166 v24 body (오늘 배포됨, engineer travel_fee guard 포함).
--
-- Problem case:
--   usol_n 출장비 (visit_only) 작업 재계산 시 owner 30,000 (0 이어야 함).
--   Mig 166 v24 는 engineer 계산에서만 travel_fee 를 skip 하고 owner 식은 안 건드림.
--   usol_n owner 식:
--     owner = total_settle + extra + travel_fee - engineer - principal
--   에서 total_settle 은 task_items.subtotal 합 (visit_fee item subtotal 30,000).
--   travel_fee 30,000 도 남아 owner 부풀음:
--     owner = 30,000 + 0 + 30,000 - 30,000 - 0 = 30,000 ★ 사고
--
--   일반 원청 (KA/allday) visit_only 는 product_price=0 우연히 owner=0 유지:
--     owner = 0 + 0 + 30,000 - 30,000 - 0 = 0 ✓
--
-- Fix (최소 침습, 사장님 지시 그대로):
--   v24 (Mig 166) 의 v_is_visit_only 플래그 재사용 — 신규 변수 X.
--   owner 식 2군데 (usol_n / 일반) travel_fee 항만 조건부:
--     CASE WHEN v_is_visit_only THEN 0 ELSE COALESCE(v_task.travel_fee, 0) END
--   다른 항 (v_total_settle / product_price / extra_fee / engineer / principal) 무손.
--   일반식도 대칭 처리 — 결과는 안 바뀌나 semantic 대칭 유지.
--
-- 미변경 (v22/v23/v24 완전 유지):
--   · v24 engineer travel_fee guard (loop 밖 IF NOT v_is_visit_only THEN)
--   · v23 취소 guard (v_canceled_active = status='취소')
--   · v22 leak IN ('refrigerant','leak') 분기
--   · v22 UPDATE-else-INSERT preservation
--   · 냉매 rate override (task-level + in-loop)
--   · usol_n track A/B 결정
--   · cleaning bonus (usol_n 15% split)
--   · phase_c received_amount 경로
--   · task-level pure_refrigerant override
--
-- ⚠️ Deployment 전 필수 (사장님 지시 1):
--   1) 라이브 v24 prosrc 캡처:
--        SELECT prosrc FROM pg_proc WHERE proname = 'compute_payment' AND pronargs = 1;
--      이 파일 본문과 라인별 대조. 오늘 v22/v23/v24 여러 번 CREATE OR REPLACE.
--      대조 후 owner 식 2줄 만 변경했는지 재확인.
--   2) SECURITY DEFINER + search_path=public 유지.
--   3) 검증 (사장님 지시 4):
--      · usol_n visit_only 4건 재계산 → owner 0
--        (YS-260518-120, YS-260519-040, YS-N-260603-041, YS-N-260630-001)
--      · 일반 원청 (KA/allday) visit_only 재계산 → owner 0 유지 (안 바뀜)
--      · usol_n 세척 (track B, travel_fee 있는 것) 재계산 → 값 안 바뀜
--        (visit_only 아니니 travel_fee 유지)
--
-- Regression 안전:
--   · v_is_visit_only 는 loop 안에서만 세팅 (v24 유지). visit_fee item 없는 task 는
--     항상 false → CASE 는 else 분기 → COALESCE(travel_fee, 0) 그대로 → v24 완전 동일.
--   · 일반식 대칭 처리: visit_only 인 일반 원청은 product_price=0 이 관례
--     → travel_fee 를 owner 식에서 빼도 GREATEST clamp 로 0 유지 → 결과 동일.
--
-- Deployment:
--   CREATE OR REPLACE FUNCTION. 시그니처 compute_payment(uuid) RETURNS uuid 무변경.
--   트리거 재바인딩 자동.
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
  -- v24 (Mig 166) 신규 — visit_fee 감지 플래그 (travel_fee 이중가산 방지).
  -- v25 (Mig 167) — owner 식 travel_fee 조건부에도 재사용 (신규 변수 없음).
  v_is_visit_only        boolean := false;
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

      IF v_calc_method = '비율_견적금액' AND v_service_code IN ('refrigerant', 'leak') THEN
        v_is_ratio := true;
      END IF;

      IF v_service_code NOT IN ('refrigerant', 'leak') OR v_calc_method = 'usol_n_추가선택' THEN
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

    -- v24 (Mig 166) 변경 — visit_fee 는 policy 산식이 travel_fee (30,000) 를 이미
    --   engineer 에 반영. task.travel_fee 를 여기서 다시 더하면 이중가산 사고
    --   (engineer 60,000). v_is_visit_only 감지 시 스킵.
    --   그 외 서비스는 task.travel_fee 가 0 이라 (사장님 확인 — 일반 작업 0건)
    --   무해하지만 조건부로 감쌈으로써 semantic 명시.
    IF NOT v_is_visit_only THEN
      v_total_engineer := v_total_engineer + COALESCE(v_task.travel_fee, 0);
    END IF;

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
      v_total_owner := COALESCE(v_task.product_price, 0)
                     + COALESCE(v_task.extra_fee, 0)
                     + (CASE WHEN v_is_visit_only THEN 0 ELSE COALESCE(v_task.travel_fee, 0) END)
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
  'v25 (Migration 167, 2026-07-08) - usol_n visit_only owner 이중가산 제거. '
  'owner 식 2군데 (usol_n / 일반) 의 travel_fee 항을 CASE WHEN v_is_visit_only THEN 0 로 감쌈. '
  'v24 engineer travel_fee guard / v23 취소 guard / v22 leak+preservation / 냉매 rate / '
  'usol_n track / cleaning bonus / phase_c / task-level override 완전 유지.';

COMMIT;

-- ============================================================================
-- 필수 사전 캡처 (사장님 지시 1) — 이 파일 실행 BEFORE 반드시 실행
-- ============================================================================
-- SELECT prosrc FROM pg_proc WHERE proname = 'compute_payment' AND pronargs = 1;
--
-- 라이브 v24 (Mig 166) 와 대조. 대조 후:
--   · DECLARE 의 v_is_visit_only 는 v24 그대로 (신규 변수 X).
--   · loop 안 v_is_visit_only 세팅 로직 v24 그대로.
--   · loop 밖 engineer travel_fee guard (IF NOT v_is_visit_only THEN) v24 그대로.
--   · owner 식 2줄 (usol_n / 일반) travel_fee 항만 CASE 로 감쌈 — 신규 변경.
--   · 그 외 어떤 줄도 안 건드림 확인.

-- ============================================================================
-- Post-apply verification (사장님 지시 3)
-- ============================================================================
--
-- A. 함수 코멘트 확인 - v25 표기:
-- SELECT proname, obj_description(oid, 'pg_proc') AS note
-- FROM pg_proc WHERE proname = 'compute_payment' AND pronargs = 1;
-- 기대: 'v25 (Migration 167, 2026-07-08) - usol_n visit_only owner 이중가산 제거. ...'
--
-- B. 트리거 rebind 확인:
-- SELECT tgname, tgrelid::regclass AS table_name, tgenabled
-- FROM pg_trigger
-- WHERE tgname IN ('compute_payment_trg', 'task_items_compute_trg')
-- ORDER BY tgname;
--
-- C. usol_n visit_only 4건 재계산 (BEGIN/ROLLBACK):
-- BEGIN;
--   -- 재계산 전 snapshot
--   SELECT t.task_no, p.engineer_amount, p.principal_amount, p.owner_amount,
--          p.travel_fee, p.product_price, p.extra_fee
--   FROM tasks t JOIN payments p ON p.task_id = t.id
--   WHERE t.task_no IN ('YS-260518-120', 'YS-260519-040',
--                       'YS-N-260603-041', 'YS-N-260630-001')
--   ORDER BY t.task_no;
--
--   -- 재계산
--   SELECT t.task_no, compute_payment(t.id) AS new_pid
--   FROM tasks t
--   WHERE t.task_no IN ('YS-260518-120', 'YS-260519-040',
--                       'YS-N-260603-041', 'YS-N-260630-001')
--   ORDER BY t.task_no;
--
--   -- 재계산 후 결과
--   SELECT t.task_no, p.engineer_amount, p.principal_amount, p.owner_amount,
--          p.travel_fee, p.product_price, p.extra_fee
--   FROM tasks t JOIN payments p ON p.task_id = t.id
--   WHERE t.task_no IN ('YS-260518-120', 'YS-260519-040',
--                       'YS-N-260603-041', 'YS-N-260630-001')
--   ORDER BY t.task_no;
-- ROLLBACK;
-- 기대: engineer_amount = 30,000 (v24 유지), owner_amount = 0 (v25 fix), principal = 0.
--
-- D. 일반 원청 (KA/allday) visit_only 회귀 - owner 0 유지 확인:
-- BEGIN;
--   -- 재계산 대상 selection (visit_only 이면서 usol_n 아닌 것)
--   WITH sample AS (
--     SELECT t.id, t.task_no, p.engineer_amount AS eng_pre, p.owner_amount AS own_pre
--     FROM tasks t
--     JOIN task_items ti       ON ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)
--     JOIN work_types wt       ON wt.id = ti.work_type_id
--     JOIN service_types st    ON st.id = wt.service_type_id
--     JOIN principals pr       ON pr.id = t.principal_id
--     JOIN payments p          ON p.task_id = t.id
--     WHERE st.code = 'visit_fee'
--       AND pr.code != 'usol_n'
--       AND t.status = '완료'
--     ORDER BY t.completed_at DESC
--     LIMIT 3
--   )
--   SELECT s.task_no, s.eng_pre, s.own_pre, compute_payment(s.id),
--          (SELECT engineer_amount FROM payments WHERE task_id = s.id) AS eng_post,
--          (SELECT owner_amount FROM payments WHERE task_id = s.id) AS own_post
--   FROM sample s;
-- ROLLBACK;
-- 기대: eng_pre = eng_post (v24 유지), own_pre = own_post = 0 (product_price=0 관례).
--
-- E. usol_n 세척 (track B, travel_fee=0) 회귀 - 값 안 바뀜:
-- BEGIN;
--   WITH sample AS (
--     SELECT t.id, t.task_no,
--            p.engineer_amount AS eng_pre,
--            p.principal_amount AS prin_pre,
--            p.owner_amount AS own_pre
--     FROM tasks t
--     JOIN task_items ti       ON ti.task_id = t.id AND ti.order_type = '본작업'
--                              AND NOT COALESCE(ti.is_canceled, false)
--     JOIN work_types wt       ON wt.id = ti.work_type_id
--     JOIN service_types st    ON st.id = wt.service_type_id
--     JOIN principals pr       ON pr.id = t.principal_id
--     JOIN payments p          ON p.task_id = t.id
--     WHERE pr.code = 'usol_n'
--       AND st.code = 'cleaning'
--       AND p.track = 'B'
--       AND t.status = '완료'
--     ORDER BY t.completed_at DESC
--     LIMIT 3
--   )
--   SELECT s.task_no, s.eng_pre, s.prin_pre, s.own_pre,
--          compute_payment(s.id),
--          (SELECT engineer_amount FROM payments WHERE task_id = s.id) AS eng_post,
--          (SELECT principal_amount FROM payments WHERE task_id = s.id) AS prin_post,
--          (SELECT owner_amount FROM payments WHERE task_id = s.id) AS own_post
--   FROM sample s;
-- ROLLBACK;
-- 기대: pre = post 모든 amount (v_is_visit_only=false → CASE else 분기 → v24 완전 동일).
--
-- ============================================================================
-- Backfill 정책 (v24 와 동일)
-- ============================================================================
-- 검증 C 로 4건 owner=0 확인 후에도 신중히 몇 건씩만 실적용 재계산.
-- 사장님 명시적 지시 없이 SELECT compute_payment(id) 대량 호출 금지.
--
-- ============================================================================
-- Rollback (위급 시)
-- ============================================================================
-- 캡처한 v24 prosrc 로 CREATE OR REPLACE 재적용.
-- Mig 167 v25 는 owner 식 2줄만 변경 (usol_n / 일반) → diff 명확 → 롤백 리스크 낮음.
