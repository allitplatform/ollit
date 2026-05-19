-- 037_tenants_anon_select.sql
-- 2026-05-19 — tenants anon SELECT 정책 추가 (회사 계좌 조회용)
-- 배경: PWA에서 auth.uid() = NULL이라 tenants_self (id = current_tenant_id()) 정책 차단
--   → getCompanyAccountFromDb (lib/companyAccountDb.js) 호출 시 0행 반환 (silent filter)
--   → 기사 PWA 정산 화면이 항상 DEFAULT 계좌번호 ("1002-XXX-XXXXXX") 노출
-- 영향 범위: tenants.settings.company_account 한 키만 공개. 현재 settings에는 company_account 외 키 없음.
-- 향후 민감 키 (api_key / webhook_secret 등) 추가 시 본 정책 제거 + C안 (SECURITY DEFINER RPC) 재검토.
-- 패턴: 020_payments_anon_select.sql / 012_engineer_rates anon SELECT 동일.

CREATE POLICY tenants_anon_select_settings ON tenants
  FOR SELECT
  TO anon, authenticated
  USING (true);
