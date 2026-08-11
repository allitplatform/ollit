-- ============================================================
-- Mig 206 — 2026-08-06 : allow negative monthly carryover
-- ============================================================
-- Why (owner report): distribution 30,000,000 > this month's net profit
--   21,695,117 was BLOCKED ("monthly carryover cannot be negative"),
--   even though prior months' undistributed profit (cumulative carryover)
--   easily covers the difference and cash ceiling (41.5M) allows it.
--
-- New rule (owner confirmed):
--   · Monthly carryover MAY be negative (this month distributes more than
--     it earned, drawing from prior months' accumulated share).
--   · The CLIENT blocks saving only when the CUMULATIVE carryover
--     (Mig 129, since 2026-04) would go below zero.
--
-- Changes:
--   [1] DROP CHECK bk_carry_amount_nonneg on bookkeeping_carryover.
--   [2] bookkeeping_set_carryover: remove the p_amount >= 0 guard
--       (NULL still rejected). Body otherwise identical to Mig 115.
--
-- Safety: cumulative RPC (Mig 129) computes from profits - distributions
--   directly and does NOT read bookkeeping_carryover, so nothing downstream
--   assumes non-negative carryover.
-- ============================================================

BEGIN;

-- [1] relax table constraint
ALTER TABLE bookkeeping_carryover
  DROP CONSTRAINT IF EXISTS bk_carry_amount_nonneg;

-- [2] set_carryover without the non-negative guard
CREATE OR REPLACE FUNCTION bookkeeping_set_carryover(
  p_work_month text,
  p_amount     int,
  p_memo       text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  -- Mig 206: negative allowed (draws from prior months' accumulated share).
  IF p_amount IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  INSERT INTO bookkeeping_carryover (
    tenant_id, work_month, amount, memo, created_by, updated_at
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    p_work_month, p_amount,
    NULLIF(TRIM(COALESCE(p_memo, '')), ''),
    p_actor, now()
  )
  ON CONFLICT (tenant_id, work_month)
  DO UPDATE SET
    amount     = EXCLUDED.amount,
    memo       = EXCLUDED.memo,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_set_carryover(text, int, text, uuid) TO anon, authenticated;

COMMIT;

-- VERIFY: constraint gone (expect 0 rows)
SELECT conname FROM pg_constraint
WHERE conname = 'bk_carry_amount_nonneg';
