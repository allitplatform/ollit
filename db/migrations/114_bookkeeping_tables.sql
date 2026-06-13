-- Migration 114 — bookkeeping (expenses + carryover + distributions)
-- Three tables for monthly ledger:
--   1) bookkeeping_expenses      — multiple rows per month (per transaction).
--   2) bookkeeping_carryover     — one row per month (amount retained).
--   3) bookkeeping_distributions — one row per (month, representative).
-- Income side is NOT stored — derived from revenueStats (matches revenue report).
--
-- Distribution targets (3 representatives, fixed for Phase 1):
--   E022 / cho_dong_uk  / 77777777-7777-7777-7777-777777770022
--   E002 / koo_hyun_seo / 77777777-7777-7777-7777-77777770002b
--   A003 / cho_dong_seok/ 77777777-7777-7777-7777-aaaaaaaa0003
-- Representative selection enforced at app layer (FK keeps referential safety).
--
-- RLS:
--   Read/write only owner + admin + operator. A004 (admin role) passes.
--   English-only. Paste-safe.

BEGIN;

-- ============================================
-- [1] bookkeeping_expenses (operating expenses)
-- ============================================
CREATE TABLE IF NOT EXISTS bookkeeping_expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  work_month   text NOT NULL,
  category     text NOT NULL,
  amount       int  NOT NULL,
  expense_date date NOT NULL,
  memo         text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bk_exp_month_fmt    CHECK (work_month ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT bk_exp_amount_nonneg CHECK (amount >= 0),
  CONSTRAINT bk_exp_category_enum CHECK (category IN
    ('rent','ad','tax','meal','program','etc'))
);

CREATE INDEX IF NOT EXISTS idx_bk_exp_month
  ON bookkeeping_expenses(tenant_id, work_month);

CREATE INDEX IF NOT EXISTS idx_bk_exp_month_category
  ON bookkeeping_expenses(tenant_id, work_month, category);

-- ============================================
-- [2] bookkeeping_carryover (amount retained per month)
-- ============================================
CREATE TABLE IF NOT EXISTS bookkeeping_carryover (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  work_month  text NOT NULL,
  amount      int  NOT NULL,
  memo        text,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bk_carry_month_fmt     CHECK (work_month ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT bk_carry_amount_nonneg CHECK (amount >= 0),
  CONSTRAINT bk_carry_month_unique  UNIQUE (tenant_id, work_month)
);

-- ============================================
-- [3] bookkeeping_distributions (per representative share)
-- ============================================
CREATE TABLE IF NOT EXISTS bookkeeping_distributions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id),
  work_month              text NOT NULL,
  representative_user_id  uuid NOT NULL REFERENCES users(id),
  amount                  int  NOT NULL,
  memo                    text,
  created_by              uuid REFERENCES users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bk_dist_month_fmt     CHECK (work_month ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT bk_dist_amount_nonneg CHECK (amount >= 0),
  CONSTRAINT bk_dist_unique        UNIQUE (tenant_id, work_month, representative_user_id)
);

CREATE INDEX IF NOT EXISTS idx_bk_dist_month
  ON bookkeeping_distributions(tenant_id, work_month);

-- ============================================
-- [4] RLS — owner + admin + operator only
-- ============================================
ALTER TABLE bookkeeping_expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookkeeping_carryover     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookkeeping_distributions ENABLE ROW LEVEL SECURITY;

-- expenses
DROP POLICY IF EXISTS bk_exp_owner_admin_op_all ON bookkeeping_expenses;
CREATE POLICY bk_exp_owner_admin_op_all ON bookkeeping_expenses
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

-- carryover
DROP POLICY IF EXISTS bk_carry_owner_admin_op_all ON bookkeeping_carryover;
CREATE POLICY bk_carry_owner_admin_op_all ON bookkeeping_carryover
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

-- distributions
DROP POLICY IF EXISTS bk_dist_owner_admin_op_all ON bookkeeping_distributions;
CREATE POLICY bk_dist_owner_admin_op_all ON bookkeeping_distributions
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
-- [5] Table / column comments
-- ============================================
COMMENT ON TABLE bookkeeping_expenses IS
  'Monthly operating expenses (rent/ad/tax/meal/program/etc). Multiple rows per work_month allowed.';
COMMENT ON COLUMN bookkeeping_expenses.work_month   IS 'YYYY-MM (KST work month).';
COMMENT ON COLUMN bookkeeping_expenses.category     IS 'rent / ad / tax / meal / program / etc.';
COMMENT ON COLUMN bookkeeping_expenses.amount       IS 'KRW, non-negative.';
COMMENT ON COLUMN bookkeeping_expenses.expense_date IS 'Actual disbursement date.';

COMMENT ON TABLE bookkeeping_carryover IS
  'Monthly retained earnings (amount kept in the company account before distribution). One row per work_month.';
COMMENT ON COLUMN bookkeeping_carryover.work_month IS 'YYYY-MM (KST work month).';
COMMENT ON COLUMN bookkeeping_carryover.amount     IS 'KRW retained, non-negative.';

COMMENT ON TABLE bookkeeping_distributions IS
  'Monthly distribution to representatives. One row per (work_month, representative_user_id).';
COMMENT ON COLUMN bookkeeping_distributions.work_month             IS 'YYYY-MM (KST work month).';
COMMENT ON COLUMN bookkeeping_distributions.representative_user_id IS 'users.id of the recipient.';
COMMENT ON COLUMN bookkeeping_distributions.amount                 IS 'KRW share, non-negative.';

COMMIT;

-- ============================================
-- Verify (run separately)
-- ============================================
-- A. Tables created:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema='public' AND table_name LIKE 'bookkeeping_%'
-- ORDER BY table_name;
-- Expect: 3 rows (carryover, distributions, expenses).
--
-- B. Policies installed:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename LIKE 'bookkeeping_%' ORDER BY tablename, policyname;
-- Expect: 3 policies (one per table).
--
-- C. CHECK constraints active:
-- BEGIN;
--   INSERT INTO bookkeeping_expenses(tenant_id, work_month, category, amount, expense_date)
--   VALUES ('11111111-1111-1111-1111-111111111111', '2026-99', 'rent', 1000, CURRENT_DATE);
-- ROLLBACK;
-- Expect: error (bk_exp_month_fmt CHECK violation).
--
-- D. RLS — A004 (admin) can SELECT (via service role bypass it always works;
--    test via PWA login session):
-- SELECT count(*) FROM bookkeeping_expenses;  -- expect 0 (no rows yet)
