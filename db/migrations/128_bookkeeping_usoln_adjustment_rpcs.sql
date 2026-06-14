-- Migration 128 — bookkeeping_usoln_adjustment RPCs (3 functions)
-- Pattern: Mig 115 동일 (SECURITY DEFINER + p_actor uuid + role check inside).
-- Set 은 upsert (ON CONFLICT (tenant_id, work_month)).
-- 모두 jsonb 반환: { ok: true, ... } | { ok: false, error: 'reason' }.
--
-- English-only. Paste-safe.

BEGIN;

-- ============================================
-- [1] bookkeeping_get_usoln_adjustment
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_get_usoln_adjustment(
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
    FROM bookkeeping_usoln_adjustment
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
      AND work_month = p_work_month
    LIMIT 1
  ) t;

  RETURN jsonb_build_object('ok', true, 'row', COALESCE(v_row, 'null'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_get_usoln_adjustment(text, uuid) TO anon, authenticated;

-- ============================================
-- [2] bookkeeping_set_usoln_adjustment (upsert)
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_set_usoln_adjustment(
  p_work_month text,
  p_amount     bigint,
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

  INSERT INTO bookkeeping_usoln_adjustment (
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

GRANT EXECUTE ON FUNCTION bookkeeping_set_usoln_adjustment(text, bigint, text, uuid) TO anon, authenticated;

-- ============================================
-- [3] bookkeeping_delete_usoln_adjustment
-- ============================================
CREATE OR REPLACE FUNCTION bookkeeping_delete_usoln_adjustment(
  p_work_month text,
  p_actor      uuid
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
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  DELETE FROM bookkeeping_usoln_adjustment
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
    AND work_month = p_work_month;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_delete_usoln_adjustment(text, uuid) TO anon, authenticated;

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. 3 functions:
-- SELECT proname FROM pg_proc
--   WHERE proname LIKE 'bookkeeping_%usoln_adjustment'
--   ORDER BY proname;
-- Expect: 3 rows.
--
-- B. set → get round-trip (A004 admin):
-- BEGIN;
--   SELECT bookkeeping_set_usoln_adjustment('2026-05', 5223110, '4월 작업분 (앱 가동 전)',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_get_usoln_adjustment('2026-05',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- ROLLBACK;
-- Expect: set ok=true, get row.amount = 5223110.
--
-- C. upsert — 같은 월 두번 set:
-- BEGIN;
--   SELECT bookkeeping_set_usoln_adjustment('2026-05', 1000, 'first',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_set_usoln_adjustment('2026-05', 2000, 'second',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT amount, memo FROM bookkeeping_usoln_adjustment
--     WHERE work_month='2026-05';
-- ROLLBACK;
-- Expect: 1 row, amount=2000, memo='second'.
--
-- D. delete then get → row=null:
-- BEGIN;
--   SELECT bookkeeping_set_usoln_adjustment('2026-05', 5223110, 'x',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_delete_usoln_adjustment('2026-05',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_get_usoln_adjustment('2026-05',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- ROLLBACK;
-- Expect: get returns { ok: true, row: null }.
