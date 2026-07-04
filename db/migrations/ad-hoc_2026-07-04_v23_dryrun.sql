-- ============================================================================
-- ad-hoc 2026-07-04 - dryrun harness for Migration 162 (compute_payment v23)
--
-- Purpose:
--   Apply Mig 162 body inside a single transaction, execute the 85-cancel
--   backfill (item UPDATE + trigger recompute + explicit compute_payment for
--   stale-item tasks), then verify:
--     (a) 85 cancel-phantom tasks -> engineer/principal/owner all zero.
--     (b) v22 leak + refri regressions unchanged (6 rows).
--     (c) 3 restore stamp tasks preserved (status + engineer_remit_* + notes).
--     (d) 3 normal completed non-cancel tasks unchanged.
--   Then ROLLBACK. Nothing persists. Live compute_payment stays at v22.
--
-- Sentinel stamps:
--   Nine non-cancel test tasks (7 regression + 2 restore, all inside txn) get
--   a fixed marker set before snapshot capture, so preservation can be proven
--   even if their real state does not currently have engineer_remit_* set.
--   Sentinels roll back with everything else.
--
-- Pass gate (must ALL be true to apply Mig 162):
--   [Cancel]        Section A produces 85 rows, all with verdict IN ('ZERO_OK','COMP_OK').
--   [Regression]    Section C preserve_violations IS NULL for every row.
--   [Regression]    Section C shows engineer/principal/owner unchanged for regression rows
--                   (A-260701-017 shows the v22 target 180000/87500/32500 which is the
--                   already-applied v22 result - unchanged under v23).
--   [Restore]       Section C rows for A-260701-008 / A-260701-020 show preserved status
--                   and engineer_remit_* fields (sentinel or real).
--   [Normal]        Section D shows amounts_unchanged = true for every row.
--   [Track flip]    Section B shows the expected count (all 85 end at track = 'A').
--
-- Safety:
--   The item UPDATE mutates task_items and the trigger cascades write payments.
--   Outer BEGIN/ROLLBACK reverts all of it. Function definition swap also
--   rolls back so live compute_payment reverts to v22 body applied 2026-07-03.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 0: sentinel stamps on 9 non-cancel test tasks
--   Forces preservation test even if real payments row has no operator stamps.
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
  notes                       = 'PRESERVATION_SENTINEL_v23',
  outstanding                 = 9999
WHERE task_id IN (
  SELECT id FROM tasks WHERE task_no IN (
    'A-260702-004', 'A-260701-023', 'A-260628-011',
    'A-260701-016', 'A-260628-016', 'A-260629-026',
    'A-260701-017',
    'A-260701-008', 'A-260701-020'
  )
);

-- ----------------------------------------------------------------------------
-- Step 1: cancel-target set (usol_n status='취소' with phantom amounts)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _cancel_targets AS
SELECT DISTINCT t.id AS task_id, t.task_no,
       t.cancel_engineer_comp_kind             AS comp_kind,
       COALESCE(t.cancel_engineer_comp_amount, 0) AS comp_amount,
       p.track                                  AS track_pre,
       COALESCE(p.engineer_amount, 0)           AS eng_pre,
       COALESCE(p.principal_amount, 0)          AS prin_pre,
       COALESCE(p.owner_amount, 0)              AS own_pre,
       (SELECT COUNT(*) FROM task_items ti
         WHERE ti.task_id = t.id
           AND NOT COALESCE(ti.is_canceled, false)) AS active_items_pre
FROM tasks t
JOIN principals pr ON pr.id = t.principal_id
JOIN payments p    ON p.task_id = t.id
WHERE pr.code = 'usol_n'
  AND t.status = '취소'
  AND (COALESCE(p.engineer_amount, 0)  != 0
    OR COALESCE(p.principal_amount, 0) != 0
    OR COALESCE(p.owner_amount, 0)     != 0);

-- Cancel-target count sanity (user reported 85; actual may differ - report either way)
SELECT COUNT(*)                                            AS cancel_target_count,
       COUNT(*) FILTER (WHERE active_items_pre = 0)        AS stale_no_items,
       COUNT(*) FILTER (WHERE active_items_pre > 0)        AS with_items,
       SUM(eng_pre)                                        AS phantom_engineer_sum,
       SUM(prin_pre)                                       AS phantom_principal_sum,
       SUM(own_pre)                                        AS phantom_owner_sum
FROM _cancel_targets;

-- ----------------------------------------------------------------------------
-- Step 2: normal-sample set (3 completed non-cancel non-usol_n tasks)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _normal_sample AS
SELECT t.id AS task_id, t.task_no,
       COALESCE(p.engineer_amount, 0)  AS eng_pre,
       COALESCE(p.principal_amount, 0) AS prin_pre,
       COALESCE(p.owner_amount, 0)     AS own_pre
FROM tasks t
JOIN payments p    ON p.task_id = t.id
JOIN principals pr ON pr.id = t.principal_id
WHERE t.status = '완료'
  AND t.completed_at IS NOT NULL
  AND pr.code != 'usol_n'
  AND COALESCE(p.engineer_amount, 0) > 0
  AND t.task_no NOT IN (
    'A-260702-004','A-260701-023','A-260628-011','A-260701-016',
    'A-260628-016','A-260629-026','A-260701-017',
    'A-260701-008','A-260701-020'
  )
  AND NOT EXISTS (SELECT 1 FROM _cancel_targets ct WHERE ct.task_id = t.id)
ORDER BY t.completed_at DESC
LIMIT 3;

-- ----------------------------------------------------------------------------
-- Step 3: snapshot full BEFORE row for all test tasks
--   kind = CANCEL_TARGET | REGRESSION | RESTORE | NORMAL
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _pre AS
SELECT p.task_id, t.task_no, row_to_json(p)::jsonb AS row_json,
  CASE
    WHEN EXISTS (SELECT 1 FROM _cancel_targets ct WHERE ct.task_id = p.task_id)
      THEN 'CANCEL_TARGET'
    WHEN t.task_no IN (
      'A-260702-004','A-260701-023','A-260628-011','A-260701-016',
      'A-260628-016','A-260629-026','A-260701-017'
    ) THEN 'REGRESSION'
    WHEN t.task_no IN ('A-260701-008','A-260701-020')
      THEN 'RESTORE'
    WHEN EXISTS (SELECT 1 FROM _normal_sample ns WHERE ns.task_id = p.task_id)
      THEN 'NORMAL'
    ELSE 'OTHER'
  END AS kind
FROM payments p
JOIN tasks t ON t.id = p.task_id
WHERE p.task_id IN (SELECT task_id FROM _cancel_targets)
   OR t.task_no IN (
     'A-260702-004','A-260701-023','A-260628-011','A-260701-016',
     'A-260628-016','A-260629-026','A-260701-017',
     'A-260701-008','A-260701-020'
   )
   OR p.task_id IN (SELECT task_id FROM _normal_sample);

-- ----------------------------------------------------------------------------
-- Step 4: apply v23 body (mirror of Mig 162)
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

  -- v23 cancel guard
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
-- Step 5: cancel-item UPDATE for 85 targets (trigger fires per row)
-- ----------------------------------------------------------------------------
UPDATE task_items ti SET
  is_canceled = true,
  canceled_at = now()
WHERE ti.task_id IN (SELECT task_id FROM _cancel_targets)
  AND NOT COALESCE(ti.is_canceled, false);

-- ----------------------------------------------------------------------------
-- Step 6: explicit compute_payment for stale-item targets (0 active items to begin with)
--   and for regression + restore + normal test tasks
-- ----------------------------------------------------------------------------
SELECT ct.task_no, compute_payment(ct.task_id) AS new_pid
FROM _cancel_targets ct
WHERE ct.active_items_pre = 0
ORDER BY ct.task_no;

SELECT t.task_no, compute_payment(t.id) AS new_pid
FROM tasks t
WHERE t.task_no IN (
  'A-260702-004','A-260701-023','A-260628-011','A-260701-016',
  'A-260628-016','A-260629-026','A-260701-017',
  'A-260701-008','A-260701-020'
)
ORDER BY t.task_no;

SELECT ns.task_no, compute_payment(ns.task_id) AS new_pid
FROM _normal_sample ns
ORDER BY ns.task_no;


-- ============================================================================
-- [A] Cancel-target verdict (85 rows expected)
--   ZERO_OK   : engineer/principal/owner all 0 (phantom -> zero)
--   COMP_OK   : engineer = comp_amount, principal = 0, owner = -comp_amount
--   FAIL      : otherwise
-- ============================================================================
SELECT
  ct.task_no,
  ct.comp_kind,
  ct.comp_amount,
  ct.track_pre,
  post.track                       AS track_post,
  ct.eng_pre,   post.engineer_amount   AS eng_post,
  ct.prin_pre,  post.principal_amount  AS prin_post,
  ct.own_pre,   post.owner_amount      AS own_post,
  CASE
    WHEN post.engineer_amount = 0
     AND post.principal_amount = 0
     AND post.owner_amount = 0
      THEN 'ZERO_OK'
    WHEN post.engineer_amount = ct.comp_amount
     AND post.principal_amount = 0
     AND post.owner_amount = 0 - ct.comp_amount
     AND ct.comp_amount > 0
      THEN 'COMP_OK'
    ELSE 'FAIL'
  END AS verdict
FROM _cancel_targets ct
LEFT JOIN payments post ON post.task_id = ct.task_id
ORDER BY verdict, ct.task_no;

-- Cancel-target verdict summary
SELECT
  COUNT(*)                              AS total,
  COUNT(*) FILTER (WHERE post.engineer_amount = 0 AND post.principal_amount = 0 AND post.owner_amount = 0) AS zero_ok,
  COUNT(*) FILTER (WHERE post.engineer_amount = ct.comp_amount AND post.principal_amount = 0 AND post.owner_amount = 0 - ct.comp_amount AND ct.comp_amount > 0) AS comp_ok,
  COUNT(*) FILTER (WHERE NOT (
      (post.engineer_amount = 0 AND post.principal_amount = 0 AND post.owner_amount = 0)
   OR (post.engineer_amount = ct.comp_amount AND post.principal_amount = 0 AND post.owner_amount = 0 - ct.comp_amount AND ct.comp_amount > 0)
  )) AS fail_count
FROM _cancel_targets ct
LEFT JOIN payments post ON post.task_id = ct.task_id;


-- ============================================================================
-- [B] Track flip summary for cancel targets
-- ============================================================================
SELECT
  ct.track_pre,
  post.track      AS track_post,
  COUNT(*)        AS row_count
FROM _cancel_targets ct
LEFT JOIN payments post ON post.task_id = ct.task_id
GROUP BY ct.track_pre, post.track
ORDER BY ct.track_pre, post.track;


-- ============================================================================
-- [C] Regression + restore full-row diff (9 rows expected)
--   full_diff           : all differing keys (computed_at expected to change)
--   preserve_violations : subset of full_diff limited to preserve list.
--                         MUST be NULL / empty for every row.
-- ============================================================================
WITH post AS (
  SELECT p.task_id, row_to_json(p)::jsonb AS row_json
  FROM payments p
  WHERE p.task_id IN (
    SELECT id FROM tasks WHERE task_no IN (
      'A-260702-004','A-260701-023','A-260628-011','A-260701-016',
      'A-260628-016','A-260629-026','A-260701-017',
      'A-260701-008','A-260701-020'
    )
  )
),
pairs AS (
  SELECT pre.task_no, pre.kind,
         pre.row_json  AS pre_full,
         post.row_json AS post_full
  FROM _pre pre
  LEFT JOIN post ON post.task_id = pre.task_id
  WHERE pre.kind IN ('REGRESSION','RESTORE')
)
SELECT
  task_no, kind,
  (pairs.pre_full  ->> 'engineer_amount')::int  AS eng_pre,
  (pairs.post_full ->> 'engineer_amount')::int  AS eng_post,
  (pairs.pre_full  ->> 'principal_amount')::int AS prin_pre,
  (pairs.post_full ->> 'principal_amount')::int AS prin_post,
  (pairs.pre_full  ->> 'owner_amount')::int     AS own_pre,
  (pairs.post_full ->> 'owner_amount')::int     AS own_post,
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
ORDER BY kind, task_no;


-- ============================================================================
-- [D] Normal-sample amount unchanged check (3 rows)
-- ============================================================================
SELECT
  ns.task_no,
  ns.eng_pre,   post.engineer_amount   AS eng_post,
  ns.prin_pre,  post.principal_amount  AS prin_post,
  ns.own_pre,   post.owner_amount      AS own_post,
  (
    post.engineer_amount = ns.eng_pre
    AND post.principal_amount = ns.prin_pre
    AND post.owner_amount = ns.own_pre
  ) AS amounts_unchanged
FROM _normal_sample ns
LEFT JOIN payments post ON post.task_id = ns.task_id
ORDER BY ns.task_no;


-- ============================================================================
-- [E] Global gate summary
--   Aggregates all four verdicts. Every count must match expected before apply.
-- ============================================================================
WITH cancel_v AS (
  SELECT
    COUNT(*)   AS total,
    COUNT(*) FILTER (WHERE
      (post.engineer_amount = 0 AND post.principal_amount = 0 AND post.owner_amount = 0)
      OR (post.engineer_amount = ct.comp_amount AND post.principal_amount = 0 AND post.owner_amount = 0 - ct.comp_amount AND ct.comp_amount > 0)
    ) AS pass_count
  FROM _cancel_targets ct
  LEFT JOIN payments post ON post.task_id = ct.task_id
),
regr_v AS (
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE (
      SELECT COUNT(*) FROM (VALUES
        ('id'),('status'),('paid_at'),('confirmed_at'),('settled_at'),
        ('expected_settlement_date'),('actual_settlement_date'),('notes'),
        ('outstanding'),('principal_paid_at'),
        ('engineer_remitted_at'),('engineer_remit_confirmed_at'),('engineer_remit_confirmed_by')
      ) AS pv(k)
      WHERE (pre.row_json->k) IS DISTINCT FROM ((SELECT row_to_json(pp)::jsonb FROM payments pp WHERE pp.task_id = pre.task_id)->k)
    ) = 0) AS preserved_pass
  FROM _pre pre
  WHERE pre.kind IN ('REGRESSION','RESTORE')
),
normal_v AS (
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE
      post.engineer_amount = ns.eng_pre
      AND post.principal_amount = ns.prin_pre
      AND post.owner_amount = ns.own_pre
    ) AS unchanged_pass
  FROM _normal_sample ns
  LEFT JOIN payments post ON post.task_id = ns.task_id
)
SELECT
  (SELECT total FROM cancel_v)                                      AS cancel_total,
  (SELECT pass_count FROM cancel_v)                                 AS cancel_pass,
  (SELECT total FROM regr_v)                                        AS regression_total,
  (SELECT preserved_pass FROM regr_v)                               AS regression_preserved,
  (SELECT total FROM normal_v)                                      AS normal_total,
  (SELECT unchanged_pass FROM normal_v)                             AS normal_unchanged,
  CASE
    WHEN (SELECT total FROM cancel_v) = (SELECT pass_count FROM cancel_v)
     AND (SELECT total FROM regr_v)   = (SELECT preserved_pass FROM regr_v)
     AND (SELECT total FROM normal_v) = (SELECT unchanged_pass FROM normal_v)
    THEN 'ALL PASS - safe to apply Mig 162'
    ELSE 'FAIL - do NOT apply, inspect A/C/D above'
  END AS gate;


-- ----------------------------------------------------------------------------
-- Step 7: rollback everything
-- ----------------------------------------------------------------------------
ROLLBACK;
