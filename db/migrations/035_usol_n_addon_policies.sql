-- Migration 035 - usol_n addon commission policies (Fix #31)
-- 작성일: 2026-05-19
-- Migration 034 신규 service_types 4개에 대응하는 commission_policies 시드
-- 사장님 spec: 기사 85% / 유솔 15% (cleaning 패턴 동일)
-- 단가: 시트 평균 단가 적용 (사장님 운영 단가표 추후 정정 가능)
-- 실행: Supabase SQL Editor 통째 복붙 후 Run. ON CONFLICT idempotent.

INSERT INTO commission_policies (
  tenant_id, category_id, principal_code, service_code, appliance_code,
  calc_method, policy_key, engineer_base, fee_rate
) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001',
    'usol_n', 'fan_disassembly',    NULL, 'usol_n_추가선택', 'usol_n_addon_fan',          10000, 0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001',
    'usol_n', 'outdoor_unit',       NULL, 'usol_n_추가선택', 'usol_n_addon_outdoor',      29000, 0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001',
    'usol_n', 'phytoncide',         NULL, 'usol_n_추가선택', 'usol_n_addon_phytoncide',    5900, 0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001',
    'usol_n', 'refri_no_appliance', NULL, 'usol_n_냉매점검', 'usol_n_refri_no_appliance', 10000, 0.15)
ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING;

-- 검증 SQL (별도 실행)
-- SELECT service_code, calc_method, engineer_base, fee_rate, policy_key
-- FROM commission_policies
-- WHERE principal_code='usol_n'
--   AND service_code IN ('fan_disassembly', 'outdoor_unit', 'phytoncide', 'refri_no_appliance')
-- ORDER BY service_code;
-- 기대 4 row: 각 service_code 정책 1건
