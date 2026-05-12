-- ============================================
-- Migration 009 — commission_policies v6 (대표님 확정 정책 / 78 row + 자동 계산 함수)
-- 작성일  : 2026-05-12 (Day 5)
-- 범위    :
--   [1] 스키마 박음 (fee_rate 컬럼 + CHECK 박은 영역)
--   [2] 옛 72 row 박은 영역
--   [3] 새 78 row 시드 INSERT (세척 42 + 냉매 31 + 유솔N 냉매점검 1 + 유솔N 추가선택 3 + 출장비 1)
--   [4] calculate_commission() 함수 박음
--   [5] 검증 / 테스트 SELECT
-- 전제    : 001 + 003 + 004 적용 박힘
-- 실행    : Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- ============================================

BEGIN;

-- ============================================
-- [1] 스키마 박음 — fee_rate 컬럼 + CHECK constraint
-- ============================================

-- fee_rate 컬럼 (비율_판매가 / 비율_견적금액 / 비율_총금액 박은 영역 / 0.15 / 0.20 / 0.35 등)
ALTER TABLE commission_policies ADD COLUMN IF NOT EXISTS fee_rate numeric;

-- CHECK constraint 박은 영역 박음 (옛 박은 영역 박지 X / 대표님 박은 영역 박은 영역)
ALTER TABLE commission_policies DROP CONSTRAINT IF EXISTS commission_policies_calc_method_check;
ALTER TABLE commission_policies ADD CONSTRAINT commission_policies_calc_method_check
  CHECK (calc_method IN (
    '직영_0', '직영_50_50',
    '차감후비율_50',
    '비율_견적금액', '비율_총금액', '비율_판매가',
    '정액',
    'usol_n_본작업', 'usol_n_추가선택', 'usol_n_냉매점검',
    '출장비_30K'
  ));

-- ============================================
-- [2] 옛 72 row 박은 영역
-- ============================================
DELETE FROM commission_policies WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

-- ============================================
-- [3] 새 시드 INSERT — 세척 42 row (7 원청 × 6 기종 / 시스템멀티 박지 X)
-- 기사 단가표: 벽걸이 40000 / 1way 50000 / 스탠드 60000 / 4way 70000 / 원형 80000 / 투인원 100000
-- ============================================

-- allday 세척 — 직영_0 (원청 0 / 기사 단가 / 회사 = 판매가 - 기사단가)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'cleaning', '벽걸이',  '직영_0', 'allday_cleaning_wall',  40000),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'cleaning', '1way',    '직영_0', 'allday_cleaning_1way',  50000),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'cleaning', '스탠드',  '직영_0', 'allday_cleaning_stand', 60000),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'cleaning', '4way',    '직영_0', 'allday_cleaning_4way',  70000),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'cleaning', '원형',    '직영_0', 'allday_cleaning_round', 80000),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'cleaning', '투인원',  '직영_0', 'allday_cleaning_2in1',  100000);

-- KA 세척 — 차감후비율_50 (가짜단가 박은 영역 notes JSON 박은 영역)
-- 원청 = (판매가 - 가짜단가) × 50% / 기사 = 단가표 / 회사 = 판매가 - 원청 - 기사
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base, notes) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'cleaning', '벽걸이',  '차감후비율_50', 'KA_cleaning_wall',  40000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'cleaning', '1way',    '차감후비율_50', 'KA_cleaning_1way',  50000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'cleaning', '스탠드',  '차감후비율_50', 'KA_cleaning_stand', 60000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'cleaning', '4way',    '차감후비율_50', 'KA_cleaning_4way',  70000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'cleaning', '원형',    '차감후비율_50', 'KA_cleaning_round', 80000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'cleaning', '투인원',  '차감후비율_50', 'KA_cleaning_2in1',  100000, '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}');

-- KB 세척 — 차감후비율_50 (가짜단가 박은 영역 KA 박은 영역)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base, notes) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'cleaning', '벽걸이',  '차감후비율_50', 'KB_cleaning_wall',  40000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'cleaning', '1way',    '차감후비율_50', 'KB_cleaning_1way',  50000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'cleaning', '스탠드',  '차감후비율_50', 'KB_cleaning_stand', 60000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'cleaning', '4way',    '차감후비율_50', 'KB_cleaning_4way',  70000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'cleaning', '원형',    '차감후비율_50', 'KB_cleaning_round', 80000,  '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'cleaning', '투인원',  '차감후비율_50', 'KB_cleaning_2in1',  100000, '{"fake_base":{"벽걸이":50000,"1way":60000,"스탠드":70000,"4way":80000,"원형":90000,"투인원":110000}}');

-- yongin 세척 — 정액 (원청 10000 / 기사 단가표 / 회사 = 판매가 - 10000 - 기사단가)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base, principal_fee) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'cleaning', '벽걸이',  '정액', 'yongin_cleaning_wall',  40000,  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'cleaning', '1way',    '정액', 'yongin_cleaning_1way',  50000,  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'cleaning', '스탠드',  '정액', 'yongin_cleaning_stand', 60000,  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'cleaning', '4way',    '정액', 'yongin_cleaning_4way',  70000,  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'cleaning', '원형',    '정액', 'yongin_cleaning_round', 80000,  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'cleaning', '투인원',  '정액', 'yongin_cleaning_2in1',  100000, '10000');

-- usol_h 세척 — 비율_판매가 15% (원청 = 판매가 × 15% / 기사 단가표 / 회사 = 판매가 - 원청 - 기사)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base, fee_rate) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'cleaning', '벽걸이',  '비율_판매가', 'usol_h_cleaning_wall',  40000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'cleaning', '1way',    '비율_판매가', 'usol_h_cleaning_1way',  50000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'cleaning', '스탠드',  '비율_판매가', 'usol_h_cleaning_stand', 60000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'cleaning', '4way',    '비율_판매가', 'usol_h_cleaning_4way',  70000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'cleaning', '원형',    '비율_판매가', 'usol_h_cleaning_round', 80000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'cleaning', '투인원',  '비율_판매가', 'usol_h_cleaning_2in1',  100000, 0.15);

-- usol_n 세척 — usol_n_본작업 (기사 단가 × 1.10 / 원청 = (판매가 - 네이버수수료) × 15%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base, fee_rate) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'cleaning', '벽걸이',  'usol_n_본작업', 'usol_n_cleaning_wall',  40000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'cleaning', '1way',    'usol_n_본작업', 'usol_n_cleaning_1way',  50000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'cleaning', '스탠드',  'usol_n_본작업', 'usol_n_cleaning_stand', 60000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'cleaning', '4way',    'usol_n_본작업', 'usol_n_cleaning_4way',  70000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'cleaning', '원형',    'usol_n_본작업', 'usol_n_cleaning_round', 80000,  0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'cleaning', '투인원',  'usol_n_본작업', 'usol_n_cleaning_2in1',  100000, 0.15);

-- crikrin 세척 — 비율_견적금액 20% (현장추가 X)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base, fee_rate) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'cleaning', '벽걸이',  '비율_견적금액', 'crikrin_cleaning_wall',  40000,  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'cleaning', '1way',    '비율_견적금액', 'crikrin_cleaning_1way',  50000,  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'cleaning', '스탠드',  '비율_견적금액', 'crikrin_cleaning_stand', 60000,  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'cleaning', '4way',    '비율_견적금액', 'crikrin_cleaning_4way',  70000,  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'cleaning', '원형',    '비율_견적금액', 'crikrin_cleaning_round', 80000,  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'cleaning', '투인원',  '비율_견적금액', 'crikrin_cleaning_2in1',  100000, 0.20);

-- ============================================
-- 냉매충전 31 row (5 기종 박은 영역 / 원형 박지 X)
-- ============================================

-- allday 냉매 — 직영_50_50 (원청 0 / 기사 총금액 50% / 회사 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'refrigerant', '벽걸이',  '직영_50_50', 'allday_refri_wall'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'refrigerant', '1way',    '직영_50_50', 'allday_refri_1way'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'refrigerant', '스탠드',  '직영_50_50', 'allday_refri_stand'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'refrigerant', '4way',    '직영_50_50', 'allday_refri_4way'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'refrigerant', '투인원',  '직영_50_50', 'allday_refri_2in1');

-- KA 냉매 — 비율_견적금액 35% (현장추가 X / 1way 첫대/추가 분리)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base, fee_rate, qty_condition) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'refrigerant', '벽걸이',  '비율_견적금액', 'KA_refri_wall',       70000,  0.35, NULL),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'refrigerant', '1way',    '비율_견적금액', 'KA_refri_1way_first', 90000,  0.35, '첫대'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'refrigerant', '1way',    '비율_견적금액', 'KA_refri_1way_extra', 70000,  0.35, '추가'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'refrigerant', '스탠드',  '비율_견적금액', 'KA_refri_stand',      80000,  0.35, NULL),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'refrigerant', '4way',    '비율_견적금액', 'KA_refri_4way',       100000, 0.35, NULL),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'refrigerant', '투인원',  '비율_견적금액', 'KA_refri_2in1',       100000, 0.35, NULL);

-- KB 냉매 — 비율_총금액 35% (현장추가 O / 기사 = 총금액 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, fee_rate) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'refrigerant', '벽걸이',  '비율_총금액', 'KB_refri_wall',  0.35),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'refrigerant', '1way',    '비율_총금액', 'KB_refri_1way',  0.35),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'refrigerant', '스탠드',  '비율_총금액', 'KB_refri_stand', 0.35),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'refrigerant', '4way',    '비율_총금액', 'KB_refri_4way',  0.35),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'refrigerant', '투인원',  '비율_총금액', 'KB_refri_2in1',  0.35);

-- yongin 냉매 — 정액 10000 (기사 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, principal_fee) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'refrigerant', '벽걸이',  '정액', 'yongin_refri_wall',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'refrigerant', '1way',    '정액', 'yongin_refri_1way',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'refrigerant', '스탠드',  '정액', 'yongin_refri_stand', '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'refrigerant', '4way',    '정액', 'yongin_refri_4way',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'refrigerant', '투인원',  '정액', 'yongin_refri_2in1',  '10000');

-- usol_h 냉매 — 정액 10000 (기사 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, principal_fee) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'refrigerant', '벽걸이',  '정액', 'usol_h_refri_wall',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'refrigerant', '1way',    '정액', 'usol_h_refri_1way',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'refrigerant', '스탠드',  '정액', 'usol_h_refri_stand', '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'refrigerant', '4way',    '정액', 'usol_h_refri_4way',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'refrigerant', '투인원',  '정액', 'usol_h_refri_2in1',  '10000');

-- crikrin 냉매 — 비율_견적금액 20% (현장추가 X / 기사 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, fee_rate) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'refrigerant', '벽걸이',  '비율_견적금액', 'crikrin_refri_wall',  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'refrigerant', '1way',    '비율_견적금액', 'crikrin_refri_1way',  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'refrigerant', '스탠드',  '비율_견적금액', 'crikrin_refri_stand', 0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'refrigerant', '4way',    '비율_견적금액', 'crikrin_refri_4way',  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'refrigerant', '투인원',  '비율_견적금액', 'crikrin_refri_2in1',  0.20);

-- ============================================
-- 유솔N 냉매점검 1 row
-- 1만원 박은 영역 박은 영역: 원청 100% / 기사 0 / 회사 0
-- 추가 박은 영역 박은 영역: 기사 추가금액의 50% / 회사 50%
-- ============================================
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'refrigerant', NULL, 'usol_n_냉매점검', 'usol_n_refri_check');

-- ============================================
-- 유솔N 추가선택 3 row (송풍팬분해 / 실외기 / 피톤치드)
-- 기사 85% / 원청 15% / 회사 0
-- ============================================
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, fee_rate) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'addon', '송풍팬분해', 'usol_n_추가선택', 'usol_n_addon_blowerfan', 0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'addon', '실외기',     'usol_n_추가선택', 'usol_n_addon_outdoor',   0.15),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_n', 'addon', '피톤치드',   'usol_n_추가선택', 'usol_n_addon_phyton',    0.15);

-- ============================================
-- 출장비 1 row (모든 원청 공통 / 작업 불가 시 / 기사 30000 / 원청 0 / 회사 0)
-- ============================================
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'common', 'visit_fee', NULL, '출장비_30K', 'common_visit_fee', 30000);

COMMIT;

-- ============================================
-- [4] calculate_commission() 함수 박음
-- ============================================
CREATE OR REPLACE FUNCTION calculate_commission(
  p_principal_code text,
  p_service_code   text,
  p_appliance_code text,
  p_quoted_amount  int,
  p_extra_amount   int DEFAULT 0,
  p_naver_fee      int DEFAULT 0,
  p_qty_condition  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy    commission_policies%ROWTYPE;
  v_total     int;
  v_engineer  int := 0;
  v_principal int := 0;
  v_company   int := 0;
  v_fake_base int;
  v_principal_fee int;
BEGIN
  -- 정책 조회 (qty_condition 박은 영역 박은 영역 박은 영역)
  SELECT * INTO v_policy FROM commission_policies
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
    AND principal_code = p_principal_code
    AND service_code   = p_service_code
    AND (appliance_code = p_appliance_code OR (appliance_code IS NULL AND p_appliance_code IS NULL))
    AND (qty_condition IS NULL OR qty_condition = p_qty_condition)
  ORDER BY (qty_condition IS NOT NULL) DESC  -- qty_condition 일치 박은 영역 우선
  LIMIT 1;

  IF v_policy.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'policy_not_found',
      'principal', p_principal_code, 'service', p_service_code, 'appliance', p_appliance_code);
  END IF;

  v_total := COALESCE(p_quoted_amount, 0) + COALESCE(p_extra_amount, 0);

  CASE v_policy.calc_method
    WHEN '직영_0' THEN
      v_principal := 0;
      v_engineer  := v_policy.engineer_base;
      v_company   := p_quoted_amount - v_engineer;

    WHEN '직영_50_50' THEN
      v_principal := 0;
      v_engineer  := (v_total / 2)::int;
      v_company   := v_total - v_engineer;

    WHEN '차감후비율_50' THEN
      v_fake_base := (v_policy.notes::jsonb -> 'fake_base' ->> p_appliance_code)::int;
      v_principal := ((p_quoted_amount - v_fake_base) * 0.5)::int;
      v_engineer  := v_policy.engineer_base;
      v_company   := p_quoted_amount - v_principal - v_engineer;

    WHEN '비율_견적금액' THEN
      v_principal := (p_quoted_amount * v_policy.fee_rate)::int;
      -- 세척 박은 영역 박은 영역 박은 영역 박은 영역 (engineer_base 박은 영역) / 냉매 박은 영역 박은 영역 (총금액 50%)
      IF p_service_code = 'cleaning' THEN
        v_engineer := v_policy.engineer_base;
        v_company  := p_quoted_amount - v_principal - v_engineer;
      ELSE
        v_engineer := (v_total / 2)::int;
        v_company  := v_total - v_principal - v_engineer;
      END IF;

    WHEN '비율_총금액' THEN
      v_principal := (v_total * v_policy.fee_rate)::int;
      v_engineer  := (v_total / 2)::int;
      v_company   := v_total - v_principal - v_engineer;

    WHEN '비율_판매가' THEN
      v_principal := (p_quoted_amount * v_policy.fee_rate)::int;
      v_engineer  := v_policy.engineer_base;
      v_company   := p_quoted_amount - v_principal - v_engineer;

    WHEN '정액' THEN
      v_principal_fee := COALESCE(v_policy.principal_fee::int, 10000);
      v_principal := v_principal_fee;
      -- 세척 박은 영역 박은 영역 = engineer_base / 냉매 박은 영역 박은 영역 = 총금액 50%
      IF p_service_code = 'cleaning' THEN
        v_engineer := v_policy.engineer_base;
        v_company  := p_quoted_amount - v_principal - v_engineer;
      ELSE
        v_engineer := (v_total / 2)::int;
        v_company  := v_total - v_principal - v_engineer;
      END IF;

    WHEN 'usol_n_본작업' THEN
      v_engineer  := (v_policy.engineer_base * 1.10)::int;
      v_principal := ((p_quoted_amount - COALESCE(p_naver_fee, 0)) * v_policy.fee_rate)::int;
      v_company   := (p_quoted_amount - COALESCE(p_naver_fee, 0)) - v_principal - v_engineer;

    WHEN 'usol_n_추가선택' THEN
      v_engineer  := (p_quoted_amount * (1 - v_policy.fee_rate))::int;  -- 85%
      v_principal := (p_quoted_amount * v_policy.fee_rate)::int;        -- 15%
      v_company   := 0;

    WHEN 'usol_n_냉매점검' THEN
      IF COALESCE(p_extra_amount, 0) > 0 THEN
        v_principal := p_quoted_amount;
        v_engineer  := (p_extra_amount / 2)::int;
        v_company   := p_extra_amount - v_engineer;
      ELSE
        v_principal := p_quoted_amount;
        v_engineer  := 0;
        v_company   := 0;
      END IF;

    WHEN '출장비_30K' THEN
      v_engineer  := 30000;
      v_principal := 0;
      v_company   := 0;
  END CASE;

  RETURN jsonb_build_object(
    'ok',          true,
    'total',       v_total,
    'principal',   v_principal,
    'engineer',    v_engineer,
    'company',     v_company,
    'calc_method', v_policy.calc_method,
    'policy_key',  v_policy.policy_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_commission(text, text, text, int, int, int, text) TO authenticated;

-- ============================================
-- [5] 검증 — 카운트 + 테스트 SELECT
-- ============================================

-- 카운트 (기대: 78 row)
SELECT
  count(*) AS total_policies,
  count(*) FILTER (WHERE service_code = 'cleaning')    AS cleaning_count,
  count(*) FILTER (WHERE service_code = 'refrigerant') AS refrigerant_count,
  count(*) FILTER (WHERE service_code = 'addon')       AS addon_count,
  count(*) FILTER (WHERE service_code = 'visit_fee')   AS visit_fee_count
FROM commission_policies
WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
-- 기대: total 78 / cleaning 42 / refrigerant 31 + 1(점검) = 32 / addon 3 / visit_fee 1

-- 원청별 카운트
SELECT principal_code, count(*) AS cnt
FROM commission_policies
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY principal_code
ORDER BY principal_code;

-- 테스트 1 — KA 냉매 벽걸이 / 견적 70000
-- 기대: principal=24500 (70000×0.35) / engineer=35000 (70000/2) / company=10500
SELECT calculate_commission('KA', 'refrigerant', '벽걸이', 70000, 0, 0, NULL) AS test_ka_refri_wall;

-- 테스트 2 — KA 냉매 1way 첫대 / 견적 90000
-- 기대: principal=31500 / engineer=45000 / company=13500
SELECT calculate_commission('KA', 'refrigerant', '1way', 90000, 0, 0, '첫대') AS test_ka_refri_1way_first;

-- 테스트 3 — KA 냉매 1way 추가 / 견적 70000
-- 기대: principal=24500 / engineer=35000 / company=10500
SELECT calculate_commission('KA', 'refrigerant', '1way', 70000, 0, 0, '추가') AS test_ka_refri_1way_extra;

-- 테스트 4 — crikrin 세척 스탠드 / 견적 110000 / 추가 20000
-- 기대: principal=22000 (110000×0.20 / 견적기준 / 추가 X) / engineer=60000 / company=28000
SELECT calculate_commission('crikrin', 'cleaning', '스탠드', 110000, 20000, 0, NULL) AS test_crikrin_cleaning_stand;

-- 테스트 5 — KB 세척 벽걸이 / 견적 80000 (가짜단가 50000)
-- 기대: principal=15000 ((80000-50000)×0.5) / engineer=40000 / company=25000
SELECT calculate_commission('KB', 'cleaning', '벽걸이', 80000, 0, 0, NULL) AS test_kb_cleaning_wall;

-- 테스트 6 — 출장비
-- 기대: engineer=30000 / principal=0 / company=0
SELECT calculate_commission('common', 'visit_fee', NULL, 0, 0, 0, NULL) AS test_visit_fee;

-- 테스트 7 — usol_n 추가선택 송풍팬분해 / 견적 30000
-- 기대: engineer=25500 (85%) / principal=4500 (15%) / company=0
SELECT calculate_commission('usol_n', 'addon', '송풍팬분해', 30000, 0, 0, NULL) AS test_usol_n_addon;

-- 테스트 8 — usol_n 본작업 벽걸이 / 판매가 50000 / 네이버수수료 1750
-- 기대: engineer=44000 (40000×1.10) / principal=7237 ((50000-1750)×0.15) / company=(48250-7237-44000=-2987 음수 / 단가 박은 영역 박은 영역 박은 영역 박은 영역)
SELECT calculate_commission('usol_n', 'cleaning', '벽걸이', 50000, 0, 1750, NULL) AS test_usol_n_main_wall;
