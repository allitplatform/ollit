-- 026_payments_anon_update.sql
-- 2026-05-17 — payments 측 anon UPDATE 박음
-- catch: Stage 3-D 박은 spec 측 reportEngineerRemit 박지 X
-- 박힌 spec:
--   · payments_anon_select 박힘 (SELECT만, Migration 020)
--   · UPDATE policy 박지 X → reportEngineerRemit 측 막힘
-- 박을 spec:
--   · payments_anon_update policy 박음
--   · engineer_remitted_at / engineer_remit_confirmed_at / engineer_remit_confirmed_by 박은 spec 측 박을 spec

DROP POLICY IF EXISTS payments_anon_update ON payments;
CREATE POLICY payments_anon_update ON payments
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY payments_anon_update ON payments IS
  '기사 → 회사 송금 흐름 박은 spec — engineer_remit_* 컬럼 박을 spec (Migration 025 박음 spec)';

-- ============================================
-- 검증 SQL — policy 박힌 spec catch
-- ============================================
-- SELECT polname, polcmd
-- FROM pg_policy
-- WHERE polrelid = 'payments'::regclass
-- ORDER BY polname;
--
-- 기대 결과:
--   · payments_anon_select  (r = SELECT)
--   · payments_anon_update  (w = UPDATE)
--   · 그 외 박혀있는 policy 박은 spec
