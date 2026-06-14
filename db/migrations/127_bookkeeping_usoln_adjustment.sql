-- Migration 127 — bookkeeping_usoln_adjustment (유솔N 월정산 수동 보정)
-- 사장님 spec (2026-06-14):
--   유솔N 월정산은 자동 계산(track B owner_amount, 전월 작업분, Mig 123).
--   앱 가동 전 과거 달은 작업 데이터가 DB에 없어 자동값 = 0.
--   → 사장님이 손계산한 보정액을 그 달에 수동 입력. 음수 허용(차감 보정).
--
-- 1 row per (tenant, work_month). UNIQUE 패턴 (carryover 와 동일).
-- RLS: owner/admin/operator (Mig 114 패턴 동일).
--
-- English-only. Paste-safe.

BEGIN;

-- ============================================
-- [1] bookkeeping_usoln_adjustment
-- ============================================
CREATE TABLE IF NOT EXISTS bookkeeping_usoln_adjustment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  work_month  text NOT NULL,
  amount      bigint NOT NULL,                  -- 음수 허용 (차감 보정용)
  memo        text,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bk_uadj_month_fmt CHECK (work_month ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT bk_uadj_unique    UNIQUE (tenant_id, work_month)
);

-- UNIQUE 가 인덱스 생성. 추가 인덱스 불필요 (월별 1행 조회).

-- ============================================
-- [2] RLS — owner / admin / operator (Mig 114 패턴)
-- ============================================
ALTER TABLE bookkeeping_usoln_adjustment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bk_uadj_owner_admin_op_all ON bookkeeping_usoln_adjustment;
CREATE POLICY bk_uadj_owner_admin_op_all ON bookkeeping_usoln_adjustment
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
COMMENT ON TABLE bookkeeping_usoln_adjustment IS
  '유솔N 월정산 수동 보정 (자동 계산 외 추가/차감). 1 row per (tenant, work_month). 음수 허용.';
COMMENT ON COLUMN bookkeeping_usoln_adjustment.work_month IS '보정이 표시되는 달 (YYYY-MM).';
COMMENT ON COLUMN bookkeeping_usoln_adjustment.amount     IS 'KRW 보정액. 음수 허용 — 자동값 차감 시 사용.';
COMMENT ON COLUMN bookkeeping_usoln_adjustment.memo       IS '예: "4월 작업분 (앱 가동 전, 손계산)".';

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. Table + policy:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='bookkeeping_usoln_adjustment';
-- Expect: 1 row.
--
-- SELECT policyname FROM pg_policies WHERE tablename='bookkeeping_usoln_adjustment';
-- Expect: 1 row.
--
-- B. UNIQUE enforcement:
-- BEGIN;
--   INSERT INTO bookkeeping_usoln_adjustment (tenant_id, work_month, amount)
--   VALUES ('11111111-1111-1111-1111-111111111111', '2026-05', 5223110);
--   INSERT INTO bookkeeping_usoln_adjustment (tenant_id, work_month, amount)
--   VALUES ('11111111-1111-1111-1111-111111111111', '2026-05', 1000);
-- ROLLBACK;
-- Expect: 2nd INSERT fails — UNIQUE bk_uadj_unique violated.
--
-- C. Negative amount allowed:
-- BEGIN;
--   INSERT INTO bookkeeping_usoln_adjustment (tenant_id, work_month, amount)
--   VALUES ('11111111-1111-1111-1111-111111111111', '2026-04', -500000);
-- ROLLBACK;
-- Expect: success (no non-negative CHECK).
