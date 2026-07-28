-- Migration 196 - compute_payment v27: water_leak joins refrigerant/leak path (2026-07-28)
-- Base: Mig 177 (v26) verbatim. Only change: the service_code IN-lists
-- ('refrigerant','leak') now include 'water_leak' so 누수 splits exactly like
-- 냉매/누설 (rate based, policies cloned in Mig 195).
-- DEPLOY ORDER: run AFTER Mig 195.

-- ============================================================================
-- Migration 177 — compute_payment v26: 출장비 60(기사)/40(회사)
-- 작성 : 2026-07-14 (사장님 spec)
--
-- 규칙 변경:
--   · 출장비(travel_fee) 분배: 기사 100% → 기사 60% / 회사 40%
--   · 전 원청 동일 (KB 포함 — 예외 없음)
--   · 방문출장(visit_only, 출장비만 받은 건) 도 60/40
--   · 적용: 완료 시각(completed_at) KST 2026-07-15 00:00 이후 건부터
--   · 소급 없음 — 과거 완료건은 재계산(정정 등)해도 기존 기사 100% 그대로
--
-- 구현 (v25 대비 변경 6곳):
--   1) DECLARE: v_new_travel_rule / v_travel_eng
--   2) task 로드 직후 플래그·기사몫 계산 (FLOOR(travel×0.6))
--   3) 일반 작업 engineer 가산: travel_fee → v_travel_eng
--   4) 순수냉매 재계산 분기 2곳: 동일 치환
--   5) visit_only + 새 규칙: engineer 합계 ×0.6
--   6) 일반 owner 식: 새 규칙 visit_only 는 travel 항 포함 (회사 40% 귀속)
--      · usol_n owner 식은 무변경 (subtotal 이 방문비 포함 — 기사 60% 로 줄면
--        owner 가 자동으로 40% 흡수)
--
-- 예시 (출장비 40,000):
--   일반 작업: 기사 +24,000 / 회사 +16,000 (작업비 분배는 기존 정책 그대로)
--   방문출장:  기사 24,000 / 회사 16,000 / 원청 0
--
-- ⚠️ 실행 전 드라이런 필수 — 파일 하단 [드라이런] 블록을 먼저 실행해서
--    ① 과거건 재계산 = 기존값 동일 (소급 없음 증명)
--    ② 내일 날짜 가상 완료건 = 60/40 분배 확인
--    둘 다 통과 후에만 본 CREATE 실행.
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
  -- v26 (Mig 177) 신규 — 출장비 60(기사)/40(회사) 규칙. 2026-07-15 KST 완료건부터.
  --   과거 완료건 재계산 시엔 false → 기존 기사 100% 유지 (소급 없음).
  v_new_travel_rule      boolean := false;
  v_travel_eng           int := 0;
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
  'v26 (Migration 177, 2026-07-14) - 출장비 60(기사)/40(회사) — 2026-07-15 KST 완료건부터, 전 원청 동일 (방문출장 포함). '
  '과거 완료건 재계산 시 기존 기사 100% 유지 (v_new_travel_rule=false). '
  'v25 visit_only owner fix / v24 travel guard / v23 취소 guard / v22 leak / 냉매 rate / usol_n track 완전 유지.';

COMMIT;

-- ============================================================================
-- [드라이런] 본 CREATE 실행 "전에" 아래 블록으로 검증 (전부 ROLLBACK — DB 무변경)
-- ============================================================================
-- BEGIN;
--   -- (1) 위 CREATE OR REPLACE FUNCTION ... 블록을 여기 안에서 실행
--
--   -- (2) 과거 완료건 3건 재계산 → 기존 payments 와 비교 (모두 true 여야 함)
--   WITH sample AS (
--     SELECT t.id, p.engineer_amount AS old_eng, p.owner_amount AS old_own,
--            p.principal_amount AS old_prin
--     FROM tasks t JOIN payments p ON p.task_id = t.id
--     WHERE t.status = '완료' AND t.travel_fee > 0
--     ORDER BY t.completed_at DESC LIMIT 3
--   ), recompute AS (
--     SELECT s.id, compute_payment(s.id) FROM sample s
--   )
--   SELECT s.id,
--          p.engineer_amount = s.old_eng  AS eng_same,
--          p.owner_amount    = s.old_own  AS own_same,
--          p.principal_amount= s.old_prin AS prin_same
--   FROM sample s JOIN payments p ON p.task_id = s.id;
--
--   -- (3) 가상 미래건: 최근 완료건 1건의 completed_at 을 내일로 바꿔 재계산
--   --     → engineer 가 (기존 - travel×0.4) 인지 확인
--   UPDATE tasks SET completed_at = '2026-07-15 10:00:00 Asia/Seoul'::timestamptz
--   WHERE id = (SELECT t.id FROM tasks t WHERE t.status='완료' AND t.travel_fee > 0
--               ORDER BY t.completed_at DESC LIMIT 1);
--   SELECT compute_payment(t.id), t.travel_fee,
--          p.engineer_amount, p.owner_amount
--   FROM tasks t JOIN payments p ON p.task_id = t.id
--   WHERE t.completed_at = '2026-07-15 10:00:00 Asia/Seoul'::timestamptz;
--
-- ROLLBACK;  -- ★ 반드시 ROLLBACK — 위 전부 취소됨
