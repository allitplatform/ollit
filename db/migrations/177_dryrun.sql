-- ============================================================================
-- Mig 177 드라이런 — 읽기 전용, DB 아무것도 안 바꿈. 통째로 붙여넣고 Run.
-- 결과 표 읽는 법:
--   구분='과거건(규칙그대로)' → same_as_now 가 전부 true 여야 함 (소급 없음 증명)
--   구분='새규칙 미리보기'   → eng_60 / own_40 이 출장비의 60%/40% 인지 확인
-- 확인 끝나면 임시 함수 제거: 맨 아래 DROP 한 줄만 따로 실행.
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_payment_v26_dryrun(
  p_task_id uuid,
  p_force_new_rule boolean DEFAULT NULL   -- true 로 주면 과거건에도 새 규칙 강제 (검증용)
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
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
  v_new_travel_rule := COALESCE(
    p_force_new_rule,
    COALESCE(v_task.completed_at, now()) >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz
  );
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

  -- ★ 드라이런 — payments 에 쓰지 않고 계산 결과만 반환.
  RETURN jsonb_build_object(
    'engineer',  v_total_engineer,
    'principal', v_total_principal,
    'owner',     v_total_owner,
    'travel',    COALESCE(v_task.travel_fee, 0),
    'track',     v_track,
    'new_rule',  v_new_travel_rule
  );

END;
$$;

WITH sample AS (
  SELECT t.id, t.task_no, t.travel_fee,
         p.engineer_amount AS now_eng, p.owner_amount AS now_own, p.principal_amount AS now_prin
  FROM tasks t JOIN payments p ON p.task_id = t.id
  WHERE t.status = '완료' AND COALESCE(t.travel_fee, 0) > 0
  ORDER BY t.completed_at DESC
  LIMIT 5
)
SELECT '과거건(규칙그대로)' AS 구분, s.task_no, s.travel_fee AS 출장비,
       (d->>'engineer')::int AS eng, (d->>'owner')::int AS own,
       ((d->>'engineer')::int = s.now_eng AND (d->>'owner')::int = s.now_own
        AND (d->>'principal')::int = s.now_prin) AS same_as_now,
       NULL::int AS eng_60, NULL::int AS own_40
FROM sample s, LATERAL compute_payment_v26_dryrun(s.id, false) d
UNION ALL
SELECT '새규칙 미리보기', s.task_no, s.travel_fee,
       (d->>'engineer')::int, (d->>'owner')::int,
       NULL,
       (d->>'engineer')::int - (s.now_eng - s.travel_fee) AS eng_60,  -- 출장비 중 기사 몫
       (d->>'owner')::int - s.now_own                     AS own_40   -- 회사가 새로 갖는 몫
FROM sample s, LATERAL compute_payment_v26_dryrun(s.id, true) d
ORDER BY 구분, task_no;

-- 확인 후 정리 (별도 실행):
-- DROP FUNCTION compute_payment_v26_dryrun(uuid, boolean);
