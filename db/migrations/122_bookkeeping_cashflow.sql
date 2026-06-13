-- Migration 122 — bookkeeping cashflow (통장)
-- Two tables for manual cash flow tracking + balance:
--   1) bookkeeping_cashflow          — in/out transactions (multiple per month).
--   2) bookkeeping_cashflow_baseline — baseline balance (one row per tenant).
-- 7 SECURITY DEFINER RPCs with p_actor + role check (owner/admin/operator),
-- same pattern as bookkeeping Mig 115.
--
-- Lesson from Mig 117-121 (date arithmetic):
--   flow_date is `date` (no timezone). For month range filtering use
--   make_date(year, month, 1) — explicit + December rollover handled.
--   Do NOT use `timestamptz + INTERVAL '1 month'` (UTC date preservation bug).
--
-- English-only. Paste-safe.

BEGIN;

-- ============================================
-- [1] bookkeeping_cashflow (in/out transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS bookkeeping_cashflow (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  direction   text NOT NULL,
  amount      bigint NOT NULL,
  flow_date   date NOT NULL,
  memo        text,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bk_cf_direction_enum CHECK (direction IN ('in','out')),
  CONSTRAINT bk_cf_amount_nonneg  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bk_cf_tenant_date
  ON bookkeeping_cashflow(tenant_id, flow_date);
CREATE INDEX IF NOT EXISTS idx_bk_cf_tenant_dir_date
  ON bookkeeping_cashflow(tenant_id, direction, flow_date);

-- ============================================
-- [2] bookkeeping_cashflow_baseline (one row per tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS bookkeeping_cashflow_baseline (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  baseline_date   date NOT NULL,
  baseline_amount bigint NOT NULL,             -- negative allowed (overdraft / loan)
  memo            text,
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bk_cf_baseline_tenant_unique UNIQUE (tenant_id)
);

-- ============================================
-- [3] RLS — owner / admin / operator only (same as Mig 114)
-- ============================================
ALTER TABLE bookkeeping_cashflow          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookkeeping_cashflow_baseline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bk_cf_owner_admin_op_all ON bookkeeping_cashflow;
CREATE POLICY bk_cf_owner_admin_op_all ON bookkeeping_cashflow
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_has_role('owner')
      OR current_user_has_role('admin')
      OR current_user_has_role('operator')
    )
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      current_user_has_role('owner')
      OR current_user_has_role('admin')
      OR current_user_has_role('operator')
    )
  );

DROP POLICY IF EXISTS bk_cf_baseline_owner_admin_op_all ON bookkeeping_cashflow_baseline;
CREATE POLICY bk_cf_baseline_owner_admin_op_all ON bookkeeping_cashflow_baseline
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_has_role('owner')
      OR current_user_has_role('admin')
      OR current_user_has_role('operator')
    )
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      current_user_has_role('owner')
      OR current_user_has_role('admin')
      OR current_user_has_role('operator')
    )
  );

-- ============================================
-- [4] Table / column comments
-- ============================================
COMMENT ON TABLE bookkeeping_cashflow IS
  '통장 입출금 거래. direction = in/out. Manual entry only (Phase 1).';
COMMENT ON COLUMN bookkeeping_cashflow.direction IS '입금=in / 출금=out';
COMMENT ON COLUMN bookkeeping_cashflow.amount    IS 'KRW non-negative (direction enumerates flow).';
COMMENT ON COLUMN bookkeeping_cashflow.flow_date IS 'KST 발생일 (date type, no timezone).';

COMMENT ON TABLE bookkeeping_cashflow_baseline IS
  '통장 기준 잔고. 한 tenant당 1 row (UNIQUE). 음수 허용 (overdraft).';

COMMIT;

-- ============================================
-- [5] RPC 7개 — separate transaction (so table+RLS visible)
-- ============================================
BEGIN;

-- ---------- helper: 월 범위 (date) ----------
-- For each function that needs range, inline:
--   v_year/v_month parse, December rollover, make_date(year, month, 1).

-- ---------- 5-1) bookkeeping_cashflow_list ----------
DROP FUNCTION IF EXISTS bookkeeping_cashflow_list(text, uuid);

CREATE FUNCTION bookkeeping_cashflow_list(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year       int;
  v_month      int;
  v_next_year  int;
  v_next_month int;
  v_start      date;
  v_end        date;
  v_rows       jsonb;
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

  v_year  := SUBSTRING(p_work_month FROM 1 FOR 4)::int;
  v_month := SUBSTRING(p_work_month FROM 6 FOR 2)::int;
  IF v_month = 12 THEN
    v_next_year := v_year + 1; v_next_month := 1;
  ELSE
    v_next_year := v_year;     v_next_month := v_month + 1;
  END IF;
  v_start := make_date(v_year,      v_month,      1);
  v_end   := make_date(v_next_year, v_next_month, 1);

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY flow_date DESC, created_at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT id, direction, amount, flow_date, memo, created_by, created_at, updated_at
    FROM bookkeeping_cashflow
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
      AND flow_date >= v_start
      AND flow_date <  v_end
  ) t;

  RETURN jsonb_build_object('ok', true, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_cashflow_list(text, uuid) TO anon, authenticated;

-- ---------- 5-2) bookkeeping_cashflow_add ----------
DROP FUNCTION IF EXISTS bookkeeping_cashflow_add(text, bigint, date, text, uuid);

CREATE FUNCTION bookkeeping_cashflow_add(
  p_direction text,
  p_amount    bigint,
  p_flow_date date,
  p_memo      text,
  p_actor     uuid
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
  IF p_direction IS NULL OR p_direction NOT IN ('in','out') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'direction invalid');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be >= 0');
  END IF;
  IF p_flow_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'flow_date required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  INSERT INTO bookkeeping_cashflow (
    tenant_id, direction, amount, flow_date, memo, created_by
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    p_direction, p_amount, p_flow_date,
    NULLIF(TRIM(COALESCE(p_memo, '')), ''),
    p_actor
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_cashflow_add(text, bigint, date, text, uuid) TO anon, authenticated;

-- ---------- 5-3) bookkeeping_cashflow_update ----------
DROP FUNCTION IF EXISTS bookkeeping_cashflow_update(uuid, text, bigint, date, text, uuid);

CREATE FUNCTION bookkeeping_cashflow_update(
  p_id        uuid,
  p_direction text,
  p_amount    bigint,
  p_flow_date date,
  p_memo      text,
  p_actor     uuid
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
  IF p_direction IS NULL OR p_direction NOT IN ('in','out') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'direction invalid');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be >= 0');
  END IF;
  IF p_flow_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'flow_date required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  UPDATE bookkeeping_cashflow
  SET direction  = p_direction,
      amount     = p_amount,
      flow_date  = p_flow_date,
      memo       = NULLIF(TRIM(COALESCE(p_memo, '')), ''),
      updated_at = now()
  WHERE id = p_id
    AND tenant_id = '11111111-1111-1111-1111-111111111111';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_cashflow_update(uuid, text, bigint, date, text, uuid) TO anon, authenticated;

-- ---------- 5-4) bookkeeping_cashflow_delete ----------
DROP FUNCTION IF EXISTS bookkeeping_cashflow_delete(uuid, uuid);

CREATE FUNCTION bookkeeping_cashflow_delete(
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

  DELETE FROM bookkeeping_cashflow
  WHERE id = p_id
    AND tenant_id = '11111111-1111-1111-1111-111111111111';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row not found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_cashflow_delete(uuid, uuid) TO anon, authenticated;

-- ---------- 5-5) bookkeeping_cashflow_baseline_get ----------
DROP FUNCTION IF EXISTS bookkeeping_cashflow_baseline_get(uuid);

CREATE FUNCTION bookkeeping_cashflow_baseline_get(
  p_actor uuid
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
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  SELECT row_to_json(t)::jsonb INTO v_row
  FROM (
    SELECT id, baseline_date, baseline_amount, memo, created_by, created_at, updated_at
    FROM bookkeeping_cashflow_baseline
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
    LIMIT 1
  ) t;

  RETURN jsonb_build_object('ok', true, 'row', COALESCE(v_row, 'null'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_cashflow_baseline_get(uuid) TO anon, authenticated;

-- ---------- 5-6) bookkeeping_cashflow_baseline_set (upsert) ----------
DROP FUNCTION IF EXISTS bookkeeping_cashflow_baseline_set(date, bigint, text, uuid);

CREATE FUNCTION bookkeeping_cashflow_baseline_set(
  p_baseline_date   date,
  p_baseline_amount bigint,
  p_memo            text,
  p_actor           uuid
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
  IF p_baseline_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'baseline_date required');
  END IF;
  IF p_baseline_amount IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'baseline_amount required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  INSERT INTO bookkeeping_cashflow_baseline (
    tenant_id, baseline_date, baseline_amount, memo, created_by, updated_at
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    p_baseline_date, p_baseline_amount,
    NULLIF(TRIM(COALESCE(p_memo, '')), ''),
    p_actor, now()
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    baseline_date   = EXCLUDED.baseline_date,
    baseline_amount = EXCLUDED.baseline_amount,
    memo            = EXCLUDED.memo,
    updated_at      = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_cashflow_baseline_set(date, bigint, text, uuid) TO anon, authenticated;

-- ---------- 5-7) bookkeeping_cashflow_summary ----------
-- Returns: { month_in, month_out, current_balance }
-- current_balance = baseline_amount + Σ all in − Σ all out (time-independent, real bank balance).
DROP FUNCTION IF EXISTS bookkeeping_cashflow_summary(text, uuid);

CREATE FUNCTION bookkeeping_cashflow_summary(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year       int;
  v_month      int;
  v_next_year  int;
  v_next_month int;
  v_start      date;
  v_end        date;
  v_month_in   bigint;
  v_month_out  bigint;
  v_baseline   bigint;
  v_total_in   bigint;
  v_total_out  bigint;
  v_balance    bigint;
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

  v_year  := SUBSTRING(p_work_month FROM 1 FOR 4)::int;
  v_month := SUBSTRING(p_work_month FROM 6 FOR 2)::int;
  IF v_month = 12 THEN
    v_next_year := v_year + 1; v_next_month := 1;
  ELSE
    v_next_year := v_year;     v_next_month := v_month + 1;
  END IF;
  v_start := make_date(v_year,      v_month,      1);
  v_end   := make_date(v_next_year, v_next_month, 1);

  -- 그 달 in/out 합
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)::bigint
  INTO v_month_in, v_month_out
  FROM bookkeeping_cashflow
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
    AND flow_date >= v_start
    AND flow_date <  v_end;

  -- baseline (없으면 0)
  SELECT COALESCE(baseline_amount, 0)::bigint INTO v_baseline
  FROM bookkeeping_cashflow_baseline
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  LIMIT 1;
  v_baseline := COALESCE(v_baseline, 0);

  -- 전체 누적 in/out
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END), 0)::bigint,
    COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)::bigint
  INTO v_total_in, v_total_out
  FROM bookkeeping_cashflow
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

  v_balance := v_baseline + v_total_in - v_total_out;

  RETURN jsonb_build_object(
    'ok', true,
    'month_in',        v_month_in,
    'month_out',       v_month_out,
    'current_balance', v_balance,
    'baseline_amount', v_baseline,
    'total_in',        v_total_in,
    'total_out',       v_total_out
  );
END;
$$;

GRANT EXECUTE ON FUNCTION bookkeeping_cashflow_summary(text, uuid) TO anon, authenticated;

COMMIT;

-- ============================================
-- Verify (separate run)
-- ============================================
-- A. Tables + policies:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name LIKE 'bookkeeping_cashflow%'
--   ORDER BY table_name;
-- Expect: 2 rows.
--
-- SELECT tablename, policyname FROM pg_policies
--   WHERE tablename LIKE 'bookkeeping_cashflow%' ORDER BY tablename;
-- Expect: 2 policies.
--
-- B. 7 functions registered:
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args
--   FROM pg_proc WHERE proname LIKE 'bookkeeping_cashflow%' ORDER BY proname;
-- Expect: 7 rows.
--
-- C. Round-trip (ROLLBACK safe):
-- BEGIN;
--   SELECT bookkeeping_cashflow_baseline_set('2026-01-01'::date, 5000000, 'opening',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_cashflow_add('in',  1000000, '2026-06-05'::date, 'test in',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_cashflow_add('out',  300000, '2026-06-10'::date, 'test out',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_cashflow_summary('2026-06',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- ROLLBACK;
-- Expect: month_in=1000000, month_out=300000,
--         current_balance = 5000000 + 1000000 - 300000 = 5700000.
--
-- D. Permission denied:
-- SELECT bookkeeping_cashflow_list('2026-06',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }.
