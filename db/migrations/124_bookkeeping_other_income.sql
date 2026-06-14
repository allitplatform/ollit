-- Migration 124 — bookkeeping_other_income (가계부 기타 수입)
-- 사장님 spec (2026-06-14):
--   수익이 일정산(track A) + 유솔N(track B) 자동 계산만 잡혀 손익이 과소.
--   세스코 수수료·개인건 등 수동 수입 입력 자리 추가.
--
-- 운영비(Mig 114 bookkeeping_expenses)와 대칭 구조:
--   · work_month (YYYY-MM) — 가계부 화면 그 달.
--   · income_date — 실제 발생일 (KST date).
--   · category enum 3개 — commission(수수료) / personal(개인건) / etc(기타).
--
-- RLS: owner/admin/operator (Mig 114 패턴 동일).
-- 통장 cashflow(Mig 122)와는 별개 — 통장엔 이미 실제 거래일 입금 들어가 있음.
--
-- English-only. Paste-safe.

BEGIN;

-- ============================================
-- [1] bookkeeping_other_income (manual income entries)
-- ============================================
CREATE TABLE IF NOT EXISTS bookkeeping_other_income (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  work_month   text NOT NULL,
  category     text NOT NULL,
  amount       int  NOT NULL,
  income_date  date NOT NULL,
  memo         text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bk_oi_month_fmt     CHECK (work_month ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT bk_oi_amount_nonneg CHECK (amount >= 0),
  CONSTRAINT bk_oi_category_enum CHECK (category IN ('commission','personal','etc')),
  CONSTRAINT bk_oi_month_date_match CHECK (
    to_char(income_date, 'YYYY-MM') = work_month
  )
);

CREATE INDEX IF NOT EXISTS idx_bk_oi_month
  ON bookkeeping_other_income(tenant_id, work_month);

CREATE INDEX IF NOT EXISTS idx_bk_oi_month_category
  ON bookkeeping_other_income(tenant_id, work_month, category);

-- ============================================
-- [2] RLS — owner / admin / operator only (Mig 114 패턴 동일)
-- ============================================
ALTER TABLE bookkeeping_other_income ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bk_oi_owner_admin_op_all ON bookkeeping_other_income;
CREATE POLICY bk_oi_owner_admin_op_all ON bookkeeping_other_income
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
-- [3] Comments
-- ============================================
COMMENT ON TABLE bookkeeping_other_income IS
  '가계부 기타 수입 (세스코 수수료, 개인건 등 수동 입력). 일정산/유솔N 자동 마진과 합산해 수입 합계 산출.';
COMMENT ON COLUMN bookkeeping_other_income.work_month  IS 'YYYY-MM (income_date 와 YYYY-MM 강제 일치).';
COMMENT ON COLUMN bookkeeping_other_income.category    IS 'commission(수수료) / personal(개인건) / etc(기타).';
COMMENT ON COLUMN bookkeeping_other_income.income_date IS 'KST 발생일 (date type, no timezone).';
COMMENT ON COLUMN bookkeeping_other_income.amount      IS 'KRW non-negative.';

COMMIT;

-- ============================================
-- Verify (separate run)
-- ============================================
-- A. Table + index + policy:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='bookkeeping_other_income';
-- Expect: 1 row.
--
-- SELECT indexname FROM pg_indexes
--   WHERE tablename='bookkeeping_other_income' ORDER BY indexname;
-- Expect: 2 idx_bk_oi_* + 1 pkey.
--
-- SELECT policyname FROM pg_policies WHERE tablename='bookkeeping_other_income';
-- Expect: 1 row (bk_oi_owner_admin_op_all).
--
-- B. Constraint enforcement — work_month vs income_date mismatch should fail:
-- BEGIN;
--   INSERT INTO bookkeeping_other_income
--     (tenant_id, work_month, category, amount, income_date)
--   VALUES
--     ('11111111-1111-1111-1111-111111111111', '2026-06', 'commission', 1000, '2026-05-15');
-- ROLLBACK;
-- Expect: ERROR — bk_oi_month_date_match.
--
-- C. Constraint enforcement — invalid category:
-- BEGIN;
--   INSERT INTO bookkeeping_other_income
--     (tenant_id, work_month, category, amount, income_date)
--   VALUES
--     ('11111111-1111-1111-1111-111111111111', '2026-06', 'bogus', 1000, '2026-06-15');
-- ROLLBACK;
-- Expect: ERROR — bk_oi_category_enum.
