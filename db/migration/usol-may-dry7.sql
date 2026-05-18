-- ============================================
-- 유솔N 시트 → Supabase tasks/task_items 마이그 (Fix #31)
-- DRY RUN 7건 — 각 미검증 케이스 1건씩
-- 생성: 2026-05-18 21:43:57
-- 원본: db/migration/usol-may-v2.xlsx 시트 '시트1' (1,143건 중 7건 샘플)
-- ============================================

BEGIN;

-- ============================================
-- CASE 1: 다중 row 그룹 (2 rows, 본작업+추가선택)
-- order_no=2026051850084781 / task_no=YS-260518-082 / channel=네이버 / 상태=기사배정완료 / items=2
-- ============================================
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-082', '2026051850084781',
  '신희섭', '010-2231-9170',
  '경기도 남양주시 진관로22번안길 1-26 (다산동) 다산동 3008-64', '남양주시',
  '최대한 빠른일정으로 부탁드립니다!', '배정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  122600, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item 1/2: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-082", "external_item_no": "2026051815668341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-082' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item 2/2: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-081", "external_item_no": "2026051815668351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-082' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- ============================================
-- CASE 2: 작업완료 + completed_at 채워짐
-- order_no=2026051612333101 / task_no=YS-260516-123 / channel=네이버 / 상태=작업완료 / items=3
-- ============================================
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-123', '2026051612333101',
  '곽동우', '010-6483-0858',
  '서울특별시 종로구 인사동길 50-1 (관훈동) 2층', '종로구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 15:00:00+09:00', '2026-05-18 00:00:00+09:00',
  82100, NULL,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item 1/3: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-123", "external_item_no": "2026051649413811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-123' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item 2/3: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-122", "external_item_no": "2026051649413821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-123' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item 3/3: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-121", "external_item_no": "2026051649413831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-123' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- ============================================
-- CASE 3: 현금접수 → principal_code=usol_h
-- order_no=YS-260514-101 / task_no=YS-260514-101 / channel=현금접수 / 상태=작업완료 / items=1
-- ============================================
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_h' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-101', 'YS-260514-101',
  '강남 벽', '01030729564',
  '강남구 선릉로 141길 18-4 101호', NULL,
  '5/15이나 빠른날원하십니다 7만원당일현금결제', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-15 17:00:00+09:00', '2026-05-16 00:00:00+09:00',
  70000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item 1/1: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-101", "external_item_no": "YS-260514-101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-101' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- ============================================
-- CASE 4: 추가선택/냉매점검 → service_type=refrigerant
-- order_no=2026051851916211 / task_no=YS-260518-072 / channel=네이버 / 상태=기사배정완료 / items=4
-- ============================================
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-072', '2026051851916211',
  '김민경', '010-9400-6522',
  '서울특별시 노원구 초안산로1길 18 (월계동, 월계주공2단지아파트) 204동 1405호', '노원구',
  '문 앞에 놓아주세요', '배정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  77000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item 1/4: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-072", "external_item_no": "2026051818515451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item 2/4: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-071", "external_item_no": "2026051818515461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item 3/4: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-070", "external_item_no": "2026051818515471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item 4/4: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-069", "external_item_no": "2026051818515481"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- ============================================
-- CASE 5: 추가선택/송풍팬분해·실외기·피톤치드 → service_type=cleaning
-- order_no=2026051851249161 / task_no=YS-260518-076 / channel=네이버 / 상태=일정확정 / items=2
-- ============================================
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-076', '2026051851249161',
  '김주연', '010-4675-6172',
  '서울특별시 마포구 월드컵북로 481 (상암동, 상암 오벨리스크 2차) 2-715호', '마포구',
  NULL, '일정확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 12:00:00+09:00', NULL,
  96400, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item 1/2: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-076", "external_item_no": "2026051817471341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item 2/2: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-075", "external_item_no": "2026051817471351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- ============================================
-- CASE 6: 미배정 → assigned_engineer_id=NULL
-- order_no=None / task_no=YS-260424-072 / channel=현금접수 / 상태=접수 / items=1
-- ============================================
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_h' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-072', NULL,
  '성남 다량건(4w4,스탠1,벽1,실외기2)', '010-2085-3621',
  '경기 성남시 중원구 사기막골로45번길 14 우림라이온스밸리 b 동 505호', NULL,
  NULL, '접수',
  NULL,
  NULL, NULL,
  730000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item 1/1: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-072", "external_item_no": "YS-260424-072"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- ============================================
-- CASE 7: spec 외 appliance → appliance_type_id=NULL
-- order_no=2026051694335871 / task_no=YS-260516-105 / channel=네이버 / 상태=일정확정 / items=1
-- ============================================
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-105', '2026051694335871',
  '홍정수', '010-5454-8736',
  '서울특별시 강북구 도봉로 328 (번동, 가든타워빌딩) 915호', '강북구',
  NULL, '일정확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 19:00:00+09:00', NULL,
  100000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item 1/1: 서비스=사무실 에어컨청소 / 구분=2way / qty=1.0 → work_type=NULL / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  NULL,
  NULL,
  '{"item_code": "YS-260516-105", "external_item_no": "2026051638232001", "raw_service": "사무실 에어컨청소", "raw_appliance": "2way"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-105' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

COMMIT;
