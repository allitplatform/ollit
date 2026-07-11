-- ============================================================================
-- ad-hoc 2026-07-11 — 누설(leak) 수수료 정책 INSERT + A-260711-032 재계산
-- 사장님 진단 확인:
--   · 스캔 결과 A-260711-032 딱 1건 (payments row 없음).
--   · KA / leak / 1way 조합 → commission_policies 매칭 없음.
--   · Mig 173 배포 후 앞으로는 배너로 즉시 감지 가능.
--
-- spec :
--   compute_payment v22+ 은 leak 을 refrigerant 와 동일 rate/override 로 처리
--     (v_service_code IN ('refrigerant','leak')).
--   → leak 정책은 refrigerant 정책과 동일 계산방식·rate·engineer_base 로 mirror.
--
-- 범위 :
--   6 원청 × 5~6 기종 = leak 정책 추가.
--   · allday   : 직영_50_50 (mirror refri)
--   · KA       : 비율_견적금액 fee_rate=0.35 (mirror refri, 1way 첫대/추가 분리)
--   · KB       : 비율_총금액   fee_rate=0.35 (mirror refri)
--   · yongin   : 정액 principal_fee=10000 (mirror refri)
--   · usol_h   : 정액 principal_fee=10000 (mirror refri)
--   · crikrin  : 비율_견적금액 fee_rate=0.20 (mirror refri)
--   ⚠️ usol_n 은 별도 냉매점검·본작업 flow 라 leak 정책 미포함 (사장님 별도 판단).
--
-- 안전 :
--   · ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING → 재실행 무해.
--   · category_id / tenant_id 는 Mig 004 seed 상수 그대로.
--
-- 실행 후:
--   · SELECT compute_payment(...) 로 A-260711-032 재계산 → payments 생성.
--   · UI 새로고침하면 분배 표시 + 빨강 배너 사라짐.
-- ============================================================================

BEGIN;

-- ── [1] leak 정책 INSERT (refrigerant mirror) ────────────────────────────

-- allday leak — 직영_50_50 (원청 0 / 기사 50% / 회사 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'leak', '벽걸이',  '직영_50_50', 'allday_leak_wall'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'leak', '1way',    '직영_50_50', 'allday_leak_1way'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'leak', '스탠드',  '직영_50_50', 'allday_leak_stand'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'leak', '4way',    '직영_50_50', 'allday_leak_4way'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'allday', 'leak', '투인원',  '직영_50_50', 'allday_leak_2in1')
ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING;

-- KA leak — 비율_견적금액 35% (1way 첫대/추가 분리) — mirror KA refri
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, engineer_base, fee_rate, qty_condition) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'leak', '벽걸이',  '비율_견적금액', 'KA_leak_wall',       70000,  0.35, NULL),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'leak', '1way',    '비율_견적금액', 'KA_leak_1way_first', 90000,  0.35, '첫대'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'leak', '1way',    '비율_견적금액', 'KA_leak_1way_extra', 70000,  0.35, '추가'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'leak', '스탠드',  '비율_견적금액', 'KA_leak_stand',      80000,  0.35, NULL),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'leak', '4way',    '비율_견적금액', 'KA_leak_4way',       100000, 0.35, NULL),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KA', 'leak', '투인원',  '비율_견적금액', 'KA_leak_2in1',       100000, 0.35, NULL)
ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING;

-- KB leak — 비율_총금액 35% (기사 = 총금액 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, fee_rate) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'leak', '벽걸이',  '비율_총금액', 'KB_leak_wall',  0.35),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'leak', '1way',    '비율_총금액', 'KB_leak_1way',  0.35),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'leak', '스탠드',  '비율_총금액', 'KB_leak_stand', 0.35),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'leak', '4way',    '비율_총금액', 'KB_leak_4way',  0.35),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'KB', 'leak', '투인원',  '비율_총금액', 'KB_leak_2in1',  0.35)
ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING;

-- yongin leak — 정액 10000 (기사 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, principal_fee) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'leak', '벽걸이',  '정액', 'yongin_leak_wall',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'leak', '1way',    '정액', 'yongin_leak_1way',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'leak', '스탠드',  '정액', 'yongin_leak_stand', '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'leak', '4way',    '정액', 'yongin_leak_4way',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'yongin', 'leak', '투인원',  '정액', 'yongin_leak_2in1',  '10000')
ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING;

-- usol_h leak — 정액 10000 (기사 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, principal_fee) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'leak', '벽걸이',  '정액', 'usol_h_leak_wall',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'leak', '1way',    '정액', 'usol_h_leak_1way',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'leak', '스탠드',  '정액', 'usol_h_leak_stand', '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'leak', '4way',    '정액', 'usol_h_leak_4way',  '10000'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'usol_h', 'leak', '투인원',  '정액', 'usol_h_leak_2in1',  '10000')
ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING;

-- crikrin leak — 비율_견적금액 20% (기사 50%)
INSERT INTO commission_policies (tenant_id, category_id, principal_code, service_code, appliance_code, calc_method, policy_key, fee_rate) VALUES
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'leak', '벽걸이',  '비율_견적금액', 'crikrin_leak_wall',  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'leak', '1way',    '비율_견적금액', 'crikrin_leak_1way',  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'leak', '스탠드',  '비율_견적금액', 'crikrin_leak_stand', 0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'leak', '4way',    '비율_견적금액', 'crikrin_leak_4way',  0.20),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', 'crikrin', 'leak', '투인원',  '비율_견적금액', 'crikrin_leak_2in1',  0.20)
ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING;


-- ── [2] 검증 — INSERT 결과 ────────────────────────────────────────────
SELECT
  principal_code,
  appliance_code,
  qty_condition,
  calc_method,
  engineer_base,
  fee_rate,
  principal_fee,
  policy_key
FROM commission_policies
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND service_code = 'leak'
ORDER BY principal_code, appliance_code, qty_condition NULLS FIRST;
-- 기대: 31 row (allday 5 + KA 6 + KB 5 + yongin 5 + usol_h 5 + crikrin 5).


-- ── [3] KA 김병철 rate 확인 (재계산 검증 값 산정) ──────────────────────
SELECT id, name, code, refrigerant_rate
FROM users
WHERE name = '김병철'
   OR code = 'E028';  -- 사장님이 code 다르면 조정
-- 기대: refrigerant_rate 60 (Mig 160 언급). 필요시 확인.


-- ── [4] A-260711-032 재계산 ────────────────────────────────────────────
SELECT
  t.task_no,
  t.status,
  t.product_price,
  t.extra_fee,
  compute_payment(t.id) AS new_payment_id
FROM tasks t
WHERE t.task_no = 'A-260711-032';
-- 기대: new_payment_id 반환 (uuid).
--   RAISE EXCEPTION 나면 → task_items 실제 service_code / appliance_code 재확인 필요.


-- ── [5] 결과 확인 ────────────────────────────────────────────────────
SELECT
  t.task_no,
  p.engineer_amount,
  p.principal_amount,
  p.owner_amount,
  p.is_balanced,
  p.calc_method,
  p.policy_key,
  p.compute_error   -- Mig 173 컬럼. NULL 이면 성공.
FROM tasks t
JOIN payments p ON p.task_id = t.id
WHERE t.task_no = 'A-260711-032';
-- 기대 (김병철 rate 60, product 250,000, 1way 첫대 기준):
--   engineer_amount   = product * 0.6 = 150,000 (extra 없으면)
--   principal_amount  = product * 0.35 = 87,500
--   owner_amount      = 250,000 - 150,000 - 87,500 = 12,500
--   compute_error     = NULL


COMMIT;

-- ============================================================================
-- 롤백 (문제 발생 시)
-- ============================================================================
-- BEGIN;
--   DELETE FROM commission_policies
--   WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
--     AND service_code = 'leak';
-- COMMIT;

-- ============================================================================
-- 참고 — usol_n leak (별도 판단):
-- ============================================================================
-- usol_n 은 냉매점검·본작업 이 별 flow 라 leak 정책 표준 없음.
-- 만약 usol_n leak 필요하면 다음 중 하나 (사장님 판단):
--   (a) usol_n_본작업 mirror — INSERT (..., 'usol_n', 'leak', '<기종>', 'usol_n_본작업', 'usol_n_leak_<key>', <engineer_base>, 0.15)
--   (b) 냉매점검 mirror     — INSERT (..., 'usol_n', 'leak', NULL, 'usol_n_냉매점검', 'usol_n_leak_check')
