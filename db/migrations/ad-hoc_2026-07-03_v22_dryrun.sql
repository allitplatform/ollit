-- ============================================================================
-- ad-hoc 2026-07-03 - dryrun harness for Migration 161 (compute_payment v22)
--
-- Purpose:
--   Apply Mig 161 body inside a single transaction, stamp preservation-test
--   markers on the 7 tracked tasks, recompute all 7, produce FULL-ROW diff
--   (pre vs post + differing-keys jsonb + preservation-only violation jsonb),
--   then ROLLBACK.
--
--   Nothing persists. Live compute_payment stays at v20 body applied 2026-07-02.
--
-- Preservation stamp:
--   Before snapshot capture, we set six operational columns on ALL 7 tasks to
--   sentinel values. If v22 preservation works, these values must survive the
--   compute_payment call. If preservation is broken, they revert to NULL/default
--   and appear in preserve_violations - dryrun then fails and Mig 161 must NOT
--   be applied.
--
-- Pass criteria (2 checks, verified via output columns below):
--   [Correctness] A-260701-017 diff must contain:
--     engineer_amount: 125000 -> 180000
--     owner_amount   : 87500  -> 32500
--     principal_amount stays 87500.
--   [Correctness] 6 regression tasks diff must NOT include changes to
--     engineer_amount, principal_amount, or owner_amount.
--   [Preservation] preserve_violations must be NULL for all 7 tasks.
--     Any non-null preserve_violations => wipe path still exists, do NOT apply.
--
-- Diff columns explained (per output row):
--   pre_full            : full payments row before recompute (jsonb).
--   post_full           : full payments row after recompute (jsonb).
--   full_diff           : keys that differ between pre and post + values.
--                         Expected: computed_at, computed_by, and (for target)
--                         engineer_amount + owner_amount.
--   preserve_violations : subset of full_diff limited to the preservation list.
--                         MUST be NULL / empty jsonb for pass.
--
-- Safety:
--   compute_payment does write to payments during the txn (UPDATE branch),
--   but outer BEGIN/ROLLBACK reverts every mutation including the sentinel
--   stamps. task_items untouched. Function definition swap also rolls back
--   at ROLLBACK, so post-dryrun the live compute_payment is exactly v20 body
--   as before.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 0: sentinel preservation stamps on the 7 tracked tasks.
--   Sets status + operational timestamps to fixed markers so we can prove
--   post-recompute values are preserved (or exposed if wiped).
--   Reverted by outer ROLLBACK.
-- ----------------------------------------------------------------------------
UPDATE payments SET
  status                      = '정산완료',
  paid_at                     = '2026-07-01 00:00:00+09'::timestamptz,
  confirmed_at                = '2026-07-01 06:00:00+09'::timestamptz,
  settled_at                  = '2026-07-02 10:00:00+09'::timestamptz,
  principal_paid_at           = '2026-07-01 09:00:00+09'::timestamptz,
  engineer_remitted_at        = '2026-07-01 20:00:00+09'::timestamptz,
  engineer_remit_confirmed_at = '2026-07-02 10:30:00+09'::timestamptz,
  engineer_remit_confirmed_by = '77777777-7777-7777-7777-aaaaaaaa0004'::uuid,
  actual_settlement_date      = '2026-07-02'::date,
  expected_settlement_date    = '2026-07-02'::date,
  notes                       = 'PRESERVATION_SENTINEL_v22',
  outstanding                 = 9999
WHERE task_id IN (
  SELECT id FROM tasks WHERE task_no IN (
    'A-260702-004', 'A-260701-023', 'A-260628-011',
    'A-260701-016', 'A-260628-016', 'A-260629-026',
    'A-260701-017'
  )
);

-- ----------------------------------------------------------------------------
-- Step 1: snapshot full BEFORE row (post-stamp)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _pre AS
SELECT t.id AS task_id, t.task_no, row_to_json(p)::jsonb AS row_json
FROM tasks t
JOIN payments p ON p.task_id = t.id
WHERE t.task_no IN (
  'A-260702-004', 'A-260701-023', 'A-260628-011',
  'A-260701-016', 'A-260628-016', 'A-260629-026',
  'A-260701-017'
);

-- ----------------------------------------------------------------------------
-- Step 2: apply Mig 161 v22 body inside the txn (mirror the migration exactly)
-- ----------------------------------------------------------------------------
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

    v_total_engineer := v_total_engineer + COALESCE(v_task.travel_fee, 0);

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

-- ----------------------------------------------------------------------------
-- Step 3: recompute all 7 tasks under v22
-- ----------------------------------------------------------------------------
SELECT task_no, compute_payment(task_id) AS new_pid
FROM _pre
ORDER BY task_no;

-- ----------------------------------------------------------------------------
-- Step 4: full-row diff table
--   Columns:
--     pre_full            : payments row before recompute (with sentinels)
--     post_full           : payments row after recompute
--     full_diff           : jsonb of all keys where pre <> post (incl. expected changes)
--     preserve_violations : jsonb of preservation-list keys where pre <> post
--                           MUST be NULL / empty for pass.
--
-- Preservation list (mirror of Mig 161 preserve set):
--   id, status, paid_at, confirmed_at, settled_at,
--   expected_settlement_date, actual_settlement_date, notes, outstanding,
--   principal_paid_at,
--   engineer_remitted_at, engineer_remit_confirmed_at, engineer_remit_confirmed_by
-- ----------------------------------------------------------------------------
WITH post AS (
  SELECT p.task_id, row_to_json(p)::jsonb AS row_json
  FROM payments p
  WHERE p.task_id IN (SELECT task_id FROM _pre)
),
pairs AS (
  SELECT
    pre.task_no,
    pre.row_json  AS pre_full,
    post.row_json AS post_full
  FROM _pre pre
  LEFT JOIN post ON post.task_id = pre.task_id
)
SELECT
  task_no,
  pre_full,
  post_full,
  (SELECT jsonb_object_agg(k, jsonb_build_object('pre', pairs.pre_full->k, 'post', pairs.post_full->k))
   FROM jsonb_object_keys(pairs.pre_full) AS jok(k)
   WHERE (pairs.pre_full->k) IS DISTINCT FROM (pairs.post_full->k)
  ) AS full_diff,
  (SELECT jsonb_object_agg(k, jsonb_build_object('pre', pairs.pre_full->k, 'post', pairs.post_full->k))
   FROM (VALUES
     ('id'),('status'),('paid_at'),('confirmed_at'),('settled_at'),
     ('expected_settlement_date'),('actual_settlement_date'),('notes'),
     ('outstanding'),('principal_paid_at'),
     ('engineer_remitted_at'),('engineer_remit_confirmed_at'),('engineer_remit_confirmed_by')
   ) AS pv(k)
   WHERE (pairs.pre_full->k) IS DISTINCT FROM (pairs.post_full->k)
  ) AS preserve_violations
FROM pairs
ORDER BY task_no;

-- ----------------------------------------------------------------------------
-- Step 5: targeted compute-column diff (readable summary for the 3 numbers).
--   Regression gate: 6 rows must show all_amounts_unchanged = true.
--   Target check   : A-260701-017 must show eng 125000 -> 180000, own 87500 -> 32500.
-- ----------------------------------------------------------------------------
SELECT
  pre.task_no,
  (pre.row_json->>'engineer_amount')::int  AS eng_pre,
  (post.row_json->>'engineer_amount')::int AS eng_post,
  (pre.row_json->>'principal_amount')::int  AS prin_pre,
  (post.row_json->>'principal_amount')::int AS prin_post,
  (pre.row_json->>'owner_amount')::int  AS own_pre,
  (post.row_json->>'owner_amount')::int AS own_post,
  (
    (pre.row_json->>'engineer_amount') = (post.row_json->>'engineer_amount')
    AND (pre.row_json->>'principal_amount') = (post.row_json->>'principal_amount')
    AND (pre.row_json->>'owner_amount') = (post.row_json->>'owner_amount')
  ) AS all_amounts_unchanged
FROM _pre pre
LEFT JOIN (
  SELECT p.task_id, row_to_json(p)::jsonb AS row_json
  FROM payments p
  WHERE p.task_id IN (SELECT task_id FROM _pre)
) post ON post.task_id = pre.task_id
ORDER BY pre.task_no;

-- ----------------------------------------------------------------------------
-- Step 6: rollback everything - function definition + sentinel stamps + recompute
-- ----------------------------------------------------------------------------
ROLLBACK;
