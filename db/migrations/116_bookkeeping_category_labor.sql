-- Migration 116 — bookkeeping category swap: program -> labor
-- Replace 'program' (프로그램비) with 'labor' (인건비, staff salary).
-- Final 6 categories: rent / ad / tax / meal / labor / etc.
--
-- Safe: bookkeeping_expenses currently has 0 'program' rows (verified before apply).
--   If any 'program' rows existed, they would block the new CHECK after DROP+ADD.
--   Pre-check: SELECT count(*) FROM bookkeeping_expenses WHERE category='program';
--   Expect: 0.
--
-- Files updated together (apply order):
--   A) Mig 116 (this file): CHECK constraint + 2 RPC bodies.
--   B) Client: AdminPcBookkeeping.jsx + bookkeepingDb.js EXPENSE_CATEGORIES / EXPENSE_CATEGORY_KO.
-- English-only. Paste-safe.

BEGIN;

-- ============================================
-- [1] CHECK constraint — DROP + re-ADD with labor
-- ============================================
ALTER TABLE bookkeeping_expenses
  DROP CONSTRAINT IF EXISTS bk_exp_category_enum;

ALTER TABLE bookkeeping_expenses
  ADD CONSTRAINT bk_exp_category_enum CHECK (category IN
    ('rent','ad','tax','meal','labor','etc'));

-- ============================================
-- [2] bookkeeping_add_expense — category check updated
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_add_expense(
  p_work_month   text,
  p_category     text,
  p_amount       int,
  p_expense_date date,
  p_memo         text,
  p_actor        uuid
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
  IF p_category IS NULL OR p_category NOT IN ('rent','ad','tax','meal','labor','etc') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'category invalid');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be >= 0');
  END IF;
  IF p_expense_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expense_date required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  INSERT INTO bookkeeping_expenses (
    tenant_id, work_month, category, amount, expense_date, memo, created_by
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    p_work_month, p_category, p_amount, p_expense_date,
    NULLIF(TRIM(COALESCE(p_memo, '')), ''),
    p_actor
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ============================================
-- [3] bookkeeping_update_expense — category check updated
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_update_expense(
  p_id           uuid,
  p_category     text,
  p_amount       int,
  p_expense_date date,
  p_memo         text,
  p_actor        uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'id required');
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('rent','ad','tax','meal','labor','etc') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'category invalid');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be >= 0');
  END IF;
  IF p_expense_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expense_date required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  UPDATE bookkeeping_expenses
  SET category     = p_category,
      amount       = p_amount,
      expense_date = p_expense_date,
      memo         = NULLIF(TRIM(COALESCE(p_memo, '')), ''),
      updated_at   = now()
  WHERE id = p_id
    AND tenant_id = '11111111-1111-1111-1111-111111111111';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. CHECK constraint updated:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname = 'bk_exp_category_enum';
-- Expect: CHECK (category IN ('rent','ad','tax','meal','labor','etc'))
--
-- B. RPC functions return invalid for 'program':
-- SELECT bookkeeping_add_expense(
--   '2026-06', 'program', 1000, CURRENT_DATE, 'should fail',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
-- );
-- Expect: { ok: false, error: 'category invalid' }
--
-- C. RPC functions accept 'labor':
-- BEGIN;
--   SELECT bookkeeping_add_expense(
--     '2026-06', 'labor', 3000000, CURRENT_DATE, 'jun salary',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
-- ROLLBACK;
-- Expect: { ok: true, id: <uuid> }
