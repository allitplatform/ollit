-- Migration 125 — bookkeeping_other_income RPCs (4 functions)
-- Pattern: Mig 115 동일 (SECURITY DEFINER + p_actor uuid + role check inside body).
-- All RPCs return jsonb: { ok: true, ... } | { ok: false, error: 'reason' }.
--
-- RPCs:
--   bookkeeping_list_other_income(work_month, actor)
--   bookkeeping_add_other_income(work_month, category, amount, income_date, memo, actor)
--   bookkeeping_update_other_income(id, category, amount, income_date, memo, actor)
--   bookkeeping_delete_other_income(id, actor)
--
-- Enforcement (Mig 124 CHECK + RPC validation):
--   to_char(income_date, 'YYYY-MM') = work_month — RPC가 먼저 검사해 명확한 에러 반환.
--
-- English-only. Paste-safe.

BEGIN;

-- ============================================
-- Helper note
--   tenant_id constant: '11111111-1111-1111-1111-111111111111'
--   allowed role: owner | admin | operator
-- ============================================

-- ============================================
-- [1] bookkeeping_list_other_income
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_list_other_income(
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

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY income_date DESC, created_at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT id, work_month, category, amount, income_date, memo, created_by, created_at, updated_at
    FROM bookkeeping_other_income
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
      AND work_month = p_work_month
  ) t;

  RETURN jsonb_build_object('ok', true, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_list_other_income(text, uuid) TO anon, authenticated;

-- ============================================
-- [2] bookkeeping_add_other_income
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_add_other_income(
  p_work_month  text,
  p_category    text,
  p_amount      int,
  p_income_date date,
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
  IF p_category IS NULL OR p_category NOT IN ('commission','personal','etc') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'category invalid');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be >= 0');
  END IF;
  IF p_income_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'income_date required');
  END IF;
  IF to_char(p_income_date, 'YYYY-MM') <> p_work_month THEN
    RETURN jsonb_build_object('ok', false, 'error', 'income_date month must match work_month');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  INSERT INTO bookkeeping_other_income (
    tenant_id, work_month, category, amount, income_date, memo, created_by
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    p_work_month, p_category, p_amount, p_income_date,
    NULLIF(TRIM(COALESCE(p_memo, '')), ''),
    p_actor
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_add_other_income(text, text, int, date, text, uuid) TO anon, authenticated;

-- ============================================
-- [3] bookkeeping_update_other_income
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_update_other_income(
  p_id          uuid,
  p_category    text,
  p_amount      int,
  p_income_date date,
  p_memo        text,
  p_actor       uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_month text;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'id required');
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('commission','personal','etc') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'category invalid');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be >= 0');
  END IF;
  IF p_income_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'income_date required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  -- 기존 행의 work_month 와 새 income_date 의 YYYY-MM 가 일치하는지 검사.
  SELECT work_month INTO v_work_month
  FROM bookkeeping_other_income
  WHERE id = p_id
    AND tenant_id = '11111111-1111-1111-1111-111111111111';

  IF v_work_month IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row not found');
  END IF;

  IF to_char(p_income_date, 'YYYY-MM') <> v_work_month THEN
    RETURN jsonb_build_object('ok', false, 'error', 'income_date month must match work_month');
  END IF;

  UPDATE bookkeeping_other_income
  SET category    = p_category,
      amount      = p_amount,
      income_date = p_income_date,
      memo        = NULLIF(TRIM(COALESCE(p_memo, '')), ''),
      updated_at  = now()
  WHERE id = p_id
    AND tenant_id = '11111111-1111-1111-1111-111111111111';

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_update_other_income(uuid, text, int, date, text, uuid) TO anon, authenticated;

-- ============================================
-- [4] bookkeeping_delete_other_income
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_delete_other_income(
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

  DELETE FROM bookkeeping_other_income
  WHERE id = p_id
    AND tenant_id = '11111111-1111-1111-1111-111111111111';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_delete_other_income(uuid, uuid) TO anon, authenticated;

COMMIT;

-- ============================================
-- Verify (separate run)
-- ============================================
-- A. 4 functions registered:
-- SELECT proname FROM pg_proc
--   WHERE proname LIKE 'bookkeeping_%other_income%' ORDER BY proname;
-- Expect: 4 rows.
--
-- B. Round-trip (ROLLBACK safe) — A004 admin:
-- BEGIN;
--   SELECT bookkeeping_add_other_income(
--     '2026-06', 'commission', 1000000, '2026-06-15', 'test',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
--   );
--   SELECT bookkeeping_list_other_income('2026-06',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- ROLLBACK;
-- Expect: ok=true; list rows>=1.
--
-- C. month mismatch — should fail with explicit error:
-- SELECT bookkeeping_add_other_income(
--   '2026-06', 'commission', 1000, '2026-05-15', 'mismatch',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
-- );
-- Expect: { ok: false, error: 'income_date month must match work_month' }
--
-- D. permission denied — random uuid:
-- SELECT bookkeeping_list_other_income('2026-06',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }
