-- 186_remit_items_anon_select.sql
-- 2026-07-20 — principal_weekly_remit_items SELECT RLS anon-friendly 재정의
--
-- 배경:
--   Mig 185 정책 (remit_items_partner_select / remit_items_admin_all) 둘 다
--   current_user_has_role(...) / current_user_principal_ids() 호출 → auth.uid() 기반.
--   PWA · 운영자 화면 모두 자체 인증 (anon key + sign_in_with_phone + localStorage)
--   → auth.uid() = NULL → 헬퍼 빈 결과 → SELECT 시 0건 반환.
--
--   진단 로그 (2026-07-20 사장님 콘솔):
--     [SNAP.fetch] result: {remitId:'54bfa759-...', dataLen:0, error:null}
--   DB엔 principal_weekly_remit_items 53건 확실히 존재. remit_id 정확. error null.
--   → RLS 가 빈 결과 반환 (조용한 차단).
--
-- 해결:
--   Mig 062 패턴 정확 미러링 (principal_weekly_remittances 와 동일 정책 방식).
--   기존 anon-friendly 패턴 (Mig 020 payments_anon_select, Mig 037 tenants_anon_select,
--   Mig 062 principal_remit_anon_select) 재사용.
--
-- 영향:
--   · INSERT / UPDATE / DELETE 정책은 손대지 않음.
--     Mig 185 confirm_principal_remittance RPC 가 SECURITY DEFINER → RLS 우회.
--     클라이언트 직접 INSERT / UPDATE / DELETE 없음 (스냅샷은 confirm RPC + 소급 SQL 만).

-- ============================================
-- [1] 옛 정책 DROP (auth.uid() 기반)
-- ============================================
DROP POLICY IF EXISTS remit_items_partner_select ON principal_weekly_remit_items;
DROP POLICY IF EXISTS remit_items_admin_all      ON principal_weekly_remit_items;

-- ============================================
-- [2] 신규 — anon SELECT 정책 (tenant_id hardcoded)
-- ============================================
CREATE POLICY remit_items_anon_select ON principal_weekly_remit_items
  FOR SELECT
  TO anon, authenticated
  USING (tenant_id = '11111111-1111-1111-1111-111111111111'::uuid);

COMMENT ON POLICY remit_items_anon_select ON principal_weekly_remit_items IS
  '자체 인증 PWA·운영자 화면 SELECT 허용 (Mig 062 principal_remit_anon_select 미러). '
  '권한 구분은 클라이언트 필터에 위임. INSERT/UPDATE/DELETE 는 RPC SECURITY DEFINER 우회.';

-- ============================================
-- 검증 SQL — 실행 후
-- ============================================
-- [1] 정책 목록 (1 row 기대)
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy
--  WHERE polrelid = 'principal_weekly_remit_items'::regclass
--  ORDER BY polname;
-- 기대: remit_items_anon_select | r (SELECT) | {anon, authenticated}
--
-- [2] anon 시점에서 스냅샷 실제 조회 가능 확인
-- SET ROLE anon;
-- SELECT count(*) FROM principal_weekly_remit_items
--  WHERE remit_id = '54bfa759-fc15-4604-bd78-8f84c0faa8d0';
-- RESET ROLE;
-- 기대: 53
--
-- [3] 프론트 실측 — dev 서버 재로드 → 유솔N 카드 · 드릴인 클릭
-- 콘솔 [SNAP.fetch] result: dataLen=53 확인 (기존 0 에서 변화)
