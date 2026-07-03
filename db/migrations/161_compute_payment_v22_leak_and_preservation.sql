-- ============================================================================
-- Migration 161 - compute_payment v22 - leak rate fix + post-column preservation
-- Date    : 2026-07-03
-- Base    : Mig 139 v20 body (live since 2026-07-02 reapply). Supersedes Mig 160 v21.
--
-- Supersedes:
--   Mig 160 v21 leak-only fix was NOT applied. v22 folds the leak fix in
--   plus adds preservation. Skip Mig 160; apply Mig 161 as the single step.
--
-- Two independent bugs fixed in one atomic function replacement.
--
-- Bug A: leak service rate override missing (same as v21 fix)
--   A-260701-017 (KA leak, engineer 김병철 rate 60, product 250k, extra 50k)
--     observed engineer = 125,000 (= product * 0.5, extra dropped)
--     expected engineer = 180,000 (= (product + extra) * rate/100)
--   Root cause in v20:
--     (1) v_is_ratio '비율_견적금액' branch checked v_service_code = 'refrigerant'
--         so leak stayed non-ratio -> extra dropped -> recall skipped
--     (2) v_pure_refrigerant guard flipped false when v_service_code <> 'refrigerant'
--         so leak-only task skipped the end-of-loop rate override.
--   Fix (2 line changes, minimal surgical patch):
--     (a) 'refrigerant' -> IN ('refrigerant','leak')  in v_is_ratio branch
--     (b) 'refrigerant' -> IN ('refrigerant','leak')  in v_pure_refrigerant guard
--   Variable name v_pure_refrigerant preserved (semantic now covers leak too).
--
-- Bug B: post-computation columns wiped on every recompute
--   v20 did DELETE FROM payments WHERE task_id=X, then INSERT.
--   The INSERT specified only compute columns; every other column reset to
--   its DEFAULT (mostly NULL). Human-stamped operational columns lost:
--     - status                           (reset to '미정산')
--     - paid_at, confirmed_at, settled_at
--     - engineer_remitted_at
--     - engineer_remit_confirmed_at, engineer_remit_confirmed_by
--     - principal_paid_at
--     - expected_settlement_date, actual_settlement_date
--     - notes, outstanding
--   Impact: recomputing a 정산완료 task erases the '입금 확인' stamp,
--     re-showing it in the operator's remit-inbox -> double-remit risk.
--   Fix strategy (option b in the CC brief):
--     Replace DELETE + INSERT with UPDATE ... WHERE task_id AND track,
--     then INSERT only when UPDATE affects zero rows (brand new payment
--     or track flip). This updates compute columns in place and leaves
--     every preserved column untouched.
--   Track flip handling:
--     If UPDATE hits zero rows on this (task_id, track) pair but an old
--     row for a different track exists, we DELETE the stale-track row
--     before INSERTing the new-track row. Old preserved stamps for the
--     old track are lost by design (they belonged to a different flow).
--     Rare path; affects at most usol_n items-change edge cases.
--
-- Regression safety - bug A:
--   Membership extension only; refrigerant path arithmetic unchanged.
--   Every pure-refri task produces identical engineer/principal/owner.
--
-- Regression safety - bug B:
--   Compute columns are set to exactly the same values v20 would have
--   INSERTed. Preserved columns are simply skipped in the UPDATE list.
--   On brand-new payment (no prior row) the INSERT branch runs and mirrors
--   the v20 INSERT column list, so first-compute behavior is identical.
--
-- Regression tests to run in dryrun (see ad-hoc_2026-07-03_v22_dryrun.sql):
--   Pure refri unchanged:
--     A-260702-004 rate 60  engineer 60,000
--     A-260701-023 rate 60  engineer 78,000
--     A-260628-011 rate 60  engineer 108,000
--     A-260701-016 rate 60  engineer 240,000
--     A-260628-016 rate 100 engineer 305,000
--     A-260629-026 rate 50  engineer 50,000
--   Target leak fix:
--     A-260701-017 engineer 125,000 -> 180,000, owner 87,500 -> 32,500,
--                  principal 87,500 unchanged, is_balanced true.
--   Preservation check for all 7 tasks:
--     status / paid_at / confirmed_at / settled_at / engineer_remitted_at /
--     engineer_remit_confirmed_at / engineer_remit_confirmed_by /
--     principal_paid_at / expected_settlement_date / actual_settlement_date /
--     notes / outstanding / id  MUST be unchanged after recompute.
--
-- Payments columns catalog (as of Mig 161):
--   Recompute:  computed_at, computed_by, policy_key, calc_method,
--               product_price, extra_fee, travel_fee, naver_fee,
--               engineer_amount, principal_amount, owner_amount, track
--   Auto:       is_balanced (GENERATED)
--   Preserve:   id, status, paid_at, confirmed_at, settled_at,
--               expected_settlement_date, actual_settlement_date, notes,
--               outstanding, principal_paid_at,
--               engineer_remitted_at, engineer_remit_confirmed_at,
--               engineer_remit_confirmed_by
--   (usol_remitted_at is NOT a real column in this schema; user list included
--    it, but no migration ever added it. Skipped safely.)
--
-- Dependencies:
--   * Mig 139 v20 body (base logic reapplied 2026-07-02).
--   * Mig 025 engineer_remittance columns.
--   * Mig 031 payments.track column (checked).
--   * Mig 002a payments.outstanding + principal_paid_at.
--   * calculate_commission (unchanged).
--   * compute_payment_trg / task_items_compute_trg (auto rebind after DROP+CREATE).
--
-- Deployment:
--   DROP FUNCTION + CREATE FUNCTION (NOT CREATE OR REPLACE). Plan cache safe.
--   GRANT EXECUTE anon, authenticated re-applied after DROP.
--   Signature compute_payment(uuid) RETURNS uuid unchanged; triggers rebind
--   by function name.
--
-- Backfill (after apply):
--   Single task A-260701-017:
--     SELECT compute_payment('dd7b0554-fdcb-435c-8154-3a89e27e2254'::uuid);
--   Verify payments row for that task_id:
--     engineer_amount  = 180000
--     principal_amount = 87500
--     owner_amount     = 32500
--     is_balanced      = true
--     status / engineer_remit_* / paid_at unchanged from pre-call.
--
-- Rollback (emergency):
--   Reapply Mig 139 v20 via db/migrations/ad-hoc_2026-07-02_reapply_compute_payment_v20.sql.
--   Note: rolling back removes preservation too - recomputing a 정산완료
--   task will again wipe engineer_remit_* stamps.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS compute_payment(uuid);

CREATE FUNCTION compute_payment(p_task_id uuid)
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
  -- v22 (Mig 161): v_pure_refrigerant semantic now includes 'leak' (see NOT IN check below).
  --                Variable name kept to minimize diff vs v20.
  v_pure_refrigerant     boolean := true;
  v_any_active_item      boolean := false;
  v_engineer_rate_task   int;
  v_row_product_price    int;
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

  v_canceled_active := (v_task.status = '취소' AND v_task.cancel_engineer_comp_kind IS NOT NULL);

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

      -- v22 change #1 (was v21): elevate v_is_ratio for both refrigerant AND leak on 비율_견적금액.
      -- For leak this ensures extra_fee is folded into the engineer share via calc_commission recall.
      IF v_calc_method = '비율_견적금액' AND v_service_code IN ('refrigerant', 'leak') THEN
        v_is_ratio := true;
      END IF;

      -- v22 change #2 (was v21): pure-service guard extended so leak-only task enters the
      -- end-of-loop task-level rate override alongside refrigerant.
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

      -- In-loop rate override kept refrigerant-only (deliberately not extended to leak).
      -- For pure_leak tasks the end-of-loop task-level override produces the correct result.
      -- Touching this branch would risk mixed-task regressions out of scope for this migration.
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

    v_total_engineer := v_total_engineer + COALESCE(v_task.travel_fee, 0);

    -- ============================================
    -- v22 (Mig 161): task-level rate override
    --   Fires when v_pure_refrigerant stayed true, meaning every active item was in
    --   ('refrigerant','leak') AND calc_method != 'usol_n_추가선택'.
    --   rate >= 100 : engineer = product + extra - principal + travel
    --   rate <  100 : engineer = FLOOR((product + extra) * rate / 100) + travel
    --   Semantic identical to v20 for pure_refrigerant tasks; new coverage: pure_leak tasks.
    -- ============================================
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

  -- Resolve product_price value used in payments row.
  v_row_product_price := CASE
    WHEN v_principal_code = 'usol_n' THEN v_total_settle
    ELSE COALESCE(v_task.product_price, 0)
  END;

  -- ============================================
  -- v22 (Mig 161): UPDATE-then-INSERT preservation.
  --   Instead of DELETE + INSERT (which wiped human-stamped columns), we UPDATE
  --   only the compute columns on the existing (task_id, track) row. If no such
  --   row exists, we clear any stale row for this task_id (handles track flips)
  --   and INSERT a fresh row with status default '미정산'.
  -- Preserved columns (never touched by UPDATE):
  --   status, paid_at, confirmed_at, settled_at, expected_settlement_date,
  --   actual_settlement_date, notes, outstanding, principal_paid_at,
  --   engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by, id.
  -- ============================================
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
    -- No existing (task_id, track) row. Cleanup any stale-track row for this task,
    -- then INSERT fresh with default status. First-compute or track-flip path.
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
  'v22 (Migration 161, 2026-07-03) - leak service extended into rate override + post-column preservation. '
  'v_is_ratio and v_pure_refrigerant now check IN (refrigerant, leak). '
  'UPDATE-then-INSERT pattern preserves status, paid_at, confirmed_at, settled_at, '
  'engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by, '
  'principal_paid_at, expected_settlement_date, actual_settlement_date, notes, outstanding, id. '
  'Recomputing a 정산완료 task no longer wipes the operator-confirmed stamp.';

COMMIT;

-- ============================================================================
-- Post-apply verification (run separately)
-- ============================================================================
--
-- A. Function comment shows v22:
-- SELECT proname, obj_description(oid, 'pg_proc') AS note
-- FROM pg_proc
-- WHERE proname = 'compute_payment' AND pronargs = 1;
--
-- B. Triggers still bound (auto rebind after DROP + CREATE):
-- SELECT tgname, tgrelid::regclass AS table_name, tgenabled
-- FROM pg_trigger
-- WHERE tgname IN ('compute_payment_trg', 'task_items_compute_trg')
-- ORDER BY tgname;
--
-- C. Backfill A-260701-017:
-- SELECT compute_payment('dd7b0554-fdcb-435c-8154-3a89e27e2254'::uuid);
-- SELECT engineer_amount, principal_amount, owner_amount, is_balanced,
--        (product_price + extra_fee + travel_fee) AS total_sum,
--        (engineer_amount + principal_amount + owner_amount) AS split_sum,
--        status, engineer_remitted_at, engineer_remit_confirmed_at
-- FROM payments
-- WHERE task_id = 'dd7b0554-fdcb-435c-8154-3a89e27e2254'::uuid;
-- Expect: 180000 / 87500 / 32500 / true, split_sum = total_sum = 300000.
-- If task was pre-confirmed, engineer_remit_* should stay populated (preservation).
--
-- D. Sweep for other leak-tasks-with-rate<100 still on the buggy split:
-- SELECT t.task_no, u.name AS engineer, u.refrigerant_rate AS rate,
--        t.product_price, t.extra_fee,
--        p.engineer_amount, p.principal_amount, p.owner_amount, p.is_balanced,
--        p.status
-- FROM tasks t
-- JOIN payments p ON p.task_id = t.id
-- LEFT JOIN users u ON u.id = t.assigned_engineer_id
-- WHERE p.policy_key ILIKE '%leak%'
--   AND t.status = '완료'
--   AND COALESCE(u.refrigerant_rate, 50) < 100
-- ORDER BY t.completed_at DESC;
-- Backfill any row where engineer_amount = FLOOR(product_price * 0.5) via
--   SELECT compute_payment(t.id) FROM tasks t WHERE t.task_no IN (...);
