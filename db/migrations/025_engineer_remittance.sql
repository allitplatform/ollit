-- 025_engineer_remittance.sql
-- 2026-05-17 — 기사 → 회사 송금 흐름 박음
-- 사장님 spec:
--   1. 기사가 일자별 일괄 입금 박음 (1일 단위)
--   2. 매일 23:00 마감 (다음날 박지 X → 연체)
--   3. 흐름:
--      · 기사 "입금 완료 보고" 클릭     → engineer_remitted_at 박음
--      · 운영자 알림 (홈 배지 + 대기 화면)
--      · 운영자 계좌 확인
--      · 운영자 "확인 완료" 클릭        → engineer_remit_confirmed_at + by 박음

-- ============================================
-- payments 측 신규 컬럼 박음
-- ============================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS engineer_remitted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS engineer_remit_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS engineer_remit_confirmed_by uuid REFERENCES users(id);

-- ============================================
-- 인덱스 박음 (성능)
-- ============================================
-- 운영자 "확인 대기" 목록 빠른 조회용
-- 기사 보고 박은 spec 측 + 운영자 확인 박지 X 박은 spec 측
CREATE INDEX IF NOT EXISTS idx_payments_remit_pending
  ON payments(engineer_remitted_at, engineer_remit_confirmed_at)
  WHERE engineer_remitted_at IS NOT NULL
    AND engineer_remit_confirmed_at IS NULL;

-- 기사 미입금 목록 (보고 박지 X) 빠른 조회용
CREATE INDEX IF NOT EXISTS idx_payments_remit_unpaid
  ON payments(task_id)
  WHERE engineer_remitted_at IS NULL;

-- ============================================
-- 컬럼 설명
-- ============================================
COMMENT ON COLUMN payments.engineer_remitted_at        IS '기사 "입금 완료 보고" 박은 일시';
COMMENT ON COLUMN payments.engineer_remit_confirmed_at IS '운영자 "확인 완료" 박은 일시';
COMMENT ON COLUMN payments.engineer_remit_confirmed_by IS '확인 완료 박은 운영자 (users.id)';

-- ============================================
-- 검증 SQL — 박은 spec 측 catch 박을 spec
-- ============================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name='payments'
--   AND column_name LIKE 'engineer_remit%'
-- ORDER BY column_name;
--
-- 기대: 3 row
--   · engineer_remit_confirmed_at  timestamp with time zone
--   · engineer_remit_confirmed_by  uuid
--   · engineer_remitted_at         timestamp with time zone

-- ============================================
-- 인덱스 검증 SQL
-- ============================================
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename='payments'
--   AND indexname LIKE 'idx_payments_remit%';
--
-- 기대: 2 row
--   · idx_payments_remit_pending
--   · idx_payments_remit_unpaid
