-- 062_principal_remit_anon_select.sql
-- 2026-05-23 — principal_weekly_remittances SELECT RLS 측 anon-friendly 측 측
-- 배경:
--   Mig 059 측 정책 — principal_remit_partner_select / principal_remit_owner_operator_all —
--   둘 다 current_user_has_role(...) / current_user_principal_ids() 호출 → auth.uid() 기반.
--   PWA는 자체 인증(anon key only) → auth.uid() = NULL → 헬퍼 빈 결과 →
--   유솔(partner) / 운영자(owner·operator) 모두 SELECT 시 0건 반환.
-- 해결:
--   기존 anon-friendly 패턴 (Mig 020 payments_anon_select, Mig 037 tenants_anon_select)
--   과 동일 — tenant_id hardcoded 단일 SELECT 정책으로 교체.
--   원청 구분(partner / admin)은 클라이언트가 .eq("principal_id", ...) / .in(...) 측 측.
-- 영향:
--   · INSERT / UPDATE / DELETE 정책은 손대지 않음.
--     RPC mark / confirm / undo 측 모두 SECURITY DEFINER → RLS 우회.
--     클라이언트 측 직접 INSERT / UPDATE / DELETE 측 일체 없음 (RPC 경유만).
--   · principal_remit_owner_operator_all 측 ALL 정책 측 DROP 측 측 — admin도 SELECT는
--     신규 anon 정책 측 catch (tenant_id 측 동일), INSERT/UPDATE/DELETE 측 RPC 측 catch.

-- ============================================
-- 옛 정책 DROP (auth.uid() 기반)
-- ============================================
DROP POLICY IF EXISTS principal_remit_partner_select     ON principal_weekly_remittances;
DROP POLICY IF EXISTS principal_remit_owner_operator_all ON principal_weekly_remittances;

-- ============================================
-- 신규 — anon SELECT 정책 (tenant_id hardcoded)
-- ============================================
CREATE POLICY principal_remit_anon_select ON principal_weekly_remittances
  FOR SELECT
  TO anon, authenticated
  USING (tenant_id = '11111111-1111-1111-1111-111111111111'::uuid);

COMMENT ON POLICY principal_remit_anon_select ON principal_weekly_remittances IS
  '자체 인증 PWA 측 SELECT 허용 (Mig 020 payments_anon_select 패턴). 권한(partner / admin) 구분은 클라이언트 필터에 위임. INSERT/UPDATE/DELETE는 RPC SECURITY DEFINER 측 catch.';

-- ============================================
-- 검증 SQL — 실행 후
-- ============================================
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy
--  WHERE polrelid = 'principal_weekly_remittances'::regclass
--  ORDER BY polname;
--
-- 기대 (1 row):
--   · principal_remit_anon_select  | r (SELECT) | {anon, authenticated}
