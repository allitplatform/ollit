-- Migration 115 — bookkeeping RPCs (9 functions)
-- PWA uses anon key + custom auth (sign_in_with_phone) → auth.uid() = NULL.
-- RLS helpers (current_tenant_id / current_user_has_role) all rely on auth.uid()
-- → table-level RLS blocks PWA direct access.
-- Pattern (same as update_principal_account / mark_principal_daily_remit):
--   SECURITY DEFINER RPC + explicit p_actor uuid arg + role check inside body.
-- All RPCs return jsonb: { ok: true, ... } | { ok: false, error: 'reason' }.
-- English-only. Paste-safe.

BEGIN;

-- ============================================
-- Helper note
--   tenant_id constant: '11111111-1111-1111-1111-111111111111'
--   allowed role: owner | admin | operator
-- ============================================

-- ============================================
-- [1] bookkeeping_list_expenses
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_list_expenses(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY expense_date DESC, created_at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT id, work_month, category, amount, expense_date, memo, created_by, created_at, updated_at
    FROM bookkeeping_expenses
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
      AND work_month = p_work_month
  ) t;

  RETURN jsonb_build_object('ok', true, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_list_expenses(text, uuid) TO anon, authenticated;

-- ============================================
-- [2] bookkeeping_add_expense
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
  IF p_category IS NULL OR p_category NOT IN ('rent','ad','tax','meal','program','etc') THEN
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

GRANT EXECUTE ON FUNCTION bookkeeping_add_expense(text, text, int, date, text, uuid) TO anon, authenticated;

-- ============================================
-- [3] bookkeeping_update_expense
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
  IF p_category IS NULL OR p_category NOT IN ('rent','ad','tax','meal','program','etc') THEN
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

GRANT EXECUTE ON FUNCTION bookkeeping_update_expense(uuid, text, int, date, text, uuid) TO anon, authenticated;

-- ============================================
-- [4] bookkeeping_delete_expense
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_delete_expense(
  p_id    uuid,
  p_actor uuid
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
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  DELETE FROM bookkeeping_expenses
  WHERE id = p_id
    AND tenant_id = '11111111-1111-1111-1111-111111111111';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_delete_expense(uuid, uuid) TO anon, authenticated;

-- ============================================
-- [5] bookkeeping_get_carryover
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_get_carryover(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  SELECT row_to_json(t)::jsonb INTO v_row
  FROM (
    SELECT id, work_month, amount, memo, created_by, created_at, updated_at
    FROM bookkeeping_carryover
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
      AND work_month = p_work_month
    LIMIT 1
  ) t;

  RETURN jsonb_build_object('ok', true, 'row', COALESCE(v_row, 'null'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_get_carryover(text, uuid) TO anon, authenticated;

-- ============================================
-- [6] bookkeeping_set_carryover (upsert)
-- ============================================
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

-- ============================================
-- [7] bookkeeping_list_distributions
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_list_distributions(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY created_at ASC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT id, work_month, representative_user_id, amount, memo, created_by, created_at, updated_at
    FROM bookkeeping_distributions
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
      AND work_month = p_work_month
  ) t;

  RETURN jsonb_build_object('ok', true, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_list_distributions(text, uuid) TO anon, authenticated;

-- ============================================
-- [8] bookkeeping_set_distribution (upsert)
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_set_distribution(
  p_work_month  text,
  p_rep_user_id uuid,
  p_amount      int,
  p_memo        text,
  p_actor       uuid
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

  -- representative must exist in users
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_rep_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'representative not found');
  END IF;

  INSERT INTO bookkeeping_distributions (
    tenant_id, work_month, representative_user_id, amount, memo, created_by, updated_at
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    p_work_month, p_rep_user_id, p_amount,
    NULLIF(TRIM(COALESCE(p_memo, '')), ''),
    p_actor, now()
  )
  ON CONFLICT (tenant_id, work_month, representative_user_id)
  DO UPDATE SET
    amount     = EXCLUDED.amount,
    memo       = EXCLUDED.memo,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_set_distribution(text, uuid, int, text, uuid) TO anon, authenticated;

-- ============================================
-- [9] bookkeeping_delete_distribution
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_delete_distribution(
  p_work_month  text,
  p_rep_user_id uuid,
  p_actor       uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  DELETE FROM bookkeeping_distributions
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
    AND work_month = p_work_month
    AND representative_user_id = p_rep_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_delete_distribution(text, uuid, uuid) TO anon, authenticated;

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. 9 functions registered:
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args
-- FROM pg_proc WHERE proname LIKE 'bookkeeping_%' ORDER BY proname;
-- Expect: 9 rows.
--
-- B. permission denied for non-operator actor:
-- SELECT bookkeeping_list_expenses('2026-06', '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }
--
-- C. operator (admin) can list (replace UUID with actual A004):
-- SELECT bookkeeping_list_expenses('2026-06',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: { ok: true, rows: [] }
--
-- D. add + list + update + delete round-trip (ROLLBACK safe):
-- BEGIN;
--   SELECT bookkeeping_add_expense(
--     '2026-06', 'rent', 500000, '2026-06-12'::date, 'test',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
--   SELECT bookkeeping_list_expenses('2026-06',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- ROLLBACK;
-- Expect: rows length = 1 with that test expense.
--
-- E. carryover upsert:
-- BEGIN;
--   SELECT bookkeeping_set_carryover('2026-06', 1000000, 'jun retain',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_set_carryover('2026-06', 1200000, 'updated',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_get_carryover('2026-06',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- ROLLBACK;
-- Expect: row.amount = 1200000 (upsert).
--
-- F. distribution upsert + delete:
-- BEGIN;
--   SELECT bookkeeping_set_distribution(
--     '2026-06',
--     '77777777-7777-7777-7777-777777770022'::uuid,  -- 조동욱 E022
--     2000000, 'first',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
--   SELECT bookkeeping_set_distribution(
--     '2026-06',
--     '77777777-7777-7777-7777-777777770022'::uuid,
--     2500000, 'adjusted',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
--   SELECT bookkeeping_list_distributions('2026-06',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_delete_distribution(
--     '2026-06',
--     '77777777-7777-7777-7777-777777770022'::uuid,
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
-- ROLLBACK;
-- Expect: list -> 1 row, amount=2500000; delete -> ok.
