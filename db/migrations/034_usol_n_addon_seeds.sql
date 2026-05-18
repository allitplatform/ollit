-- Migration 034 - usol_n addon seeds (Fix #31)
-- 작성일: 2026-05-18
-- service_types 3개 + work_types 4개 신규 (모두 appliance_type_id NULL)
-- 사장님 spec: 추가선택 옵션 (송풍팬분해/실외기/피톤치드) 별도 service_type 매핑
-- 실행: Supabase SQL Editor 통째 복붙 후 Run. ON CONFLICT idempotent.

INSERT INTO service_types (id, category_id, code, name) VALUES
  ('44444444-4444-4444-4444-444444444008', '33333333-3333-3333-3333-333333333001', 'fan_disassembly', '송풍팬분해'),
  ('44444444-4444-4444-4444-444444444009', '33333333-3333-3333-3333-333333333001', 'outdoor_unit',    '실외기 청소'),
  ('44444444-4444-4444-4444-44444444400a', '33333333-3333-3333-3333-333333333001', 'phytoncide',      '피톤치드')
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_types (service_type_id, appliance_type_id, code, name, default_unit_price) VALUES
  ('44444444-4444-4444-4444-444444444008', NULL, 'fan_disassembly',    '송풍팬분해/층고',   0),
  ('44444444-4444-4444-4444-444444444009', NULL, 'outdoor_unit',       '실외기 청소',       0),
  ('44444444-4444-4444-4444-44444444400a', NULL, 'phytoncide',         '피톤치드',          0),
  ('44444444-4444-4444-4444-444444444002', NULL, 'refri_no_appliance', '냉매점검(단독)',    0)
ON CONFLICT (service_type_id, appliance_type_id, code) DO NOTHING;

-- 검증 SQL (별도 실행)
-- SELECT code, name FROM service_types WHERE code IN ('fan_disassembly', 'outdoor_unit', 'phytoncide') ORDER BY code;
-- SELECT code, name, default_unit_price FROM work_types WHERE code IN ('fan_disassembly', 'outdoor_unit', 'phytoncide', 'refri_no_appliance') ORDER BY code;
