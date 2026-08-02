-- ============================================================
-- Mig 204 — 2026-08-02 : distribution -> cashflow auto link
-- ============================================================
-- Why (owner report): "amount was distributed but the bank ledger did not move."
--   bookkeeping_set_distribution wrote ONLY bookkeeping_distributions.
--   bookkeeping_cashflow had no link at all, so the balance never changed.
--
-- What this does:
--   [1] bookkeeping_distributions gets a paid_date column
--       (the day the money actually LEFT the account -- owner rule:
--        distribution is dated by the day it left, not the work month).
--   [2] bookkeeping_set_distribution takes p_paid_date and keeps a matching
--       cashflow OUT row in sync, keyed by (source, source_ref)
--         source     = 'auto_distribution'
--         source_ref = bookkeeping_distributions.id
--       Same idempotency pattern as Mig 156 (auto_engineer_remit).
--   [3] bookkeeping_delete_distribution removes that auto row too.
--
-- Safety:
--   · paid_date IS NULL  -> no cashflow row is created.
--     Existing rows (Apr~Jul, already entered by hand in the ledger) all have
--     NULL, so NOTHING is created retroactively and nothing is double counted.
--   · amount = 0 -> auto row is deleted (treated as "no payout").
--   · Manual cashflow rows (source IS NULL) are never touched.
--   · Old 5-arg call signature is dropped, but the new function gives
--     p_paid_date a DEFAULT, so an old client calling with named args still
--     works -> SQL can be run BEFORE the push without breaking the live app.
--
-- Order: run this SQL FIRST, then push the client.
-- ============================================================

-- ------------------------------------------------------------
-- [1] paid_date column
-- ------------------------------------------------------------
ALTER TABLE bookkeeping_distributions
  ADD COLUMN IF NOT EXISTS paid_date date;

COMMENT ON COLUMN bookkeeping_distributions.paid_date IS
  'Day the distribution actually left the bank account. NULL = not paid yet / legacy manual entry. Non-NULL creates an auto cashflow OUT row.';

-- ------------------------------------------------------------
-- [2] bookkeeping_set_distribution (v2 — writes cashflow)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS bookkeeping_set_distribution(text, uuid, int, text, uuid);
DROP FUNCTION IF EXISTS bookkeeping_set_distribution(text, uuid, int, text, uuid, date);

CREATE FUNCTION bookkeeping_set_distribution(
  p_work_month  text,
  p_rep_user_id uuid,
  p_amount      int,
  p_memo        text,
  p_actor       uuid,
  p_paid_date   date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tenant   CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  c_source   CONSTANT text := 'auto_distribution';
  v_id       uuid;
  v_rep_name text;
  v_memo     text;
  v_cf       text := 'none';   -- none | inserted | updated | deleted
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  IF p_rep_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rep_user_id required');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be >= 0');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  SELECT name INTO v_rep_name FROM users WHERE id = p_rep_user_id;
  IF v_rep_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'representative not found');
  END IF;

  -- upsert the distribution row itself
  INSERT INTO bookkeeping_distributions (
    tenant_id, work_month, representative_user_id, amount, memo,
    paid_date, created_by, updated_at
  ) VALUES (
    c_tenant, p_work_month, p_rep_user_id, p_amount,
    NULLIF(TRIM(COALESCE(p_memo, '')), ''),
    p_paid_date, p_actor, now()
  )
  ON CONFLICT (tenant_id, work_month, representative_user_id)
  DO UPDATE SET
    amount     = EXCLUDED.amount,
    memo       = EXCLUDED.memo,
    paid_date  = EXCLUDED.paid_date,
    updated_at = now()
  RETURNING id INTO v_id;

  -- ---- cashflow sync -------------------------------------------------
  IF p_paid_date IS NULL OR p_amount = 0 THEN
    -- not paid yet (or zeroed out) -> remove any auto row we made before
    DELETE FROM bookkeeping_cashflow
     WHERE tenant_id  = c_tenant
       AND source     = c_source
       AND source_ref = v_id;
    IF FOUND THEN
      v_cf := 'deleted';
    END IF;
  ELSE
    v_memo := '분배 · ' || v_rep_name || ' · ' || p_work_month || '월분';

    UPDATE bookkeeping_cashflow
       SET direction  = 'out',
           amount     = p_amount,
           flow_date  = p_paid_date,
           memo       = v_memo,
           updated_at = now()
     WHERE tenant_id  = c_tenant
       AND source     = c_source
       AND source_ref = v_id;

    IF FOUND THEN
      v_cf := 'updated';
    ELSE
      INSERT INTO bookkeeping_cashflow (
        tenant_id, direction, amount, flow_date, memo,
        created_by, source, source_ref
      ) VALUES (
        c_tenant, 'out', p_amount, p_paid_date, v_memo,
        p_actor, c_source, v_id
      )
      ON CONFLICT (source, source_ref) WHERE source IS NOT NULL DO NOTHING;
      v_cf := 'inserted';
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'cashflow', v_cf);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_set_distribution(text, uuid, int, text, uuid, date)
  TO anon, authenticated;

-- ------------------------------------------------------------
-- [3] bookkeeping_delete_distribution (also drops the auto cashflow row)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS bookkeeping_delete_distribution(text, uuid, uuid);

CREATE FUNCTION bookkeeping_delete_distribution(
  p_work_month  text,
  p_rep_user_id uuid,
  p_actor       uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tenant CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  c_source CONSTANT text := 'auto_distribution';
  v_id     uuid;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_rep_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month / rep_user_id required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  SELECT id INTO v_id
    FROM bookkeeping_distributions
   WHERE tenant_id              = c_tenant
     AND work_month             = p_work_month
     AND representative_user_id = p_rep_user_id;

  IF v_id IS NOT NULL THEN
    DELETE FROM bookkeeping_cashflow
     WHERE tenant_id  = c_tenant
       AND source     = c_source
       AND source_ref = v_id;

    DELETE FROM bookkeeping_distributions WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'deleted', (v_id IS NOT NULL));
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_delete_distribution(text, uuid, uuid)
  TO anon, authenticated;

-- ============================================================
-- VERIFY (run after)
-- ============================================================
-- 1) column exists, all existing rows NULL (= nothing created retroactively)
SELECT
  count(*)                                      AS dist_rows,
  count(*) FILTER (WHERE paid_date IS NOT NULL) AS with_paid_date
FROM bookkeeping_distributions;

-- 2) no auto_distribution cashflow row exists yet (expected 0 right after migration)
--    and manual rows are untouched.
-- SELECT source, count(*) FROM bookkeeping_cashflow GROUP BY source ORDER BY 1;
