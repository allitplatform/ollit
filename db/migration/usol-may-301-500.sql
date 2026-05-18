-- ============================================
-- 유솔N 시트 → Supabase tasks/task_items 마이그 (Fix #31)
-- 생성: 2026-05-19 00:11:43
-- 원본: db/migration/usol-may-v2.xlsx 시트 '시트1'
-- 시트 데이터 1143건 → tasks 769개
-- 출력 범위: skip=300, limit=200 → 200 task
-- ============================================

BEGIN;

-- [301] order_no=2026051565772001, task_no=YS-260515-004, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-004', '2026051565772001',
  '이문주', '010-9083-8848',
  '서울특별시 용산구 새창로 70 (도원동, 도원동삼성래미안) 111동 2106호', '용산구',
  '빠른 예약 부탁드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 14:30:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-004", "external_item_no": "2026051586366971"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-003", "external_item_no": "2026051586366981"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-002", "external_item_no": "2026051586366991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [302] order_no=2026051566072081, task_no=YS-260515-001, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-001', '2026051566072081',
  '오혜원', '010-9047-4748',
  '경기도 구리시 갈매순환로204번길 44-17 (갈매동) 1층 상가', '구리시',
  '빠르게 원합니다', '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 15:00:00+09:00', NULL,
  120500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-001", "external_item_no": "2026051586845331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-001' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [303] order_no=YS-260514-101, task_no=YS-260514-101, channel=현금접수, items=1
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

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-101", "external_item_no": "YS-260514-101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-101' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [304] order_no=2026051450828111, task_no=YS-260514-100, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-100', '2026051450828111',
  '최지원', '010-9838-7205',
  '서울특별시 강남구 언주로30길 10 (도곡동, 현대비전21) 오피스텔 910호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 11:00:00+09:00', NULL,
  115500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-100", "external_item_no": "2026051464039461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-100' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [305] order_no=2026051452376751, task_no=YS-260514-099, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-099', '2026051452376751',
  '강수영', '010-6284-5568',
  '서울특별시 서초구 신반포로33길 71 (잠원동, 잠원한신그린아파트) 한신그린아파트 A동210호', '서초구',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 10:30:00+09:00', NULL,
  115500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-099", "external_item_no": "2026051466368711"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-099' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-098", "external_item_no": "2026051466368721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-099' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [306] order_no=2026051454288901, task_no=YS-260514-097, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-097', '2026051454288901',
  '김민서', '010-9178-8585',
  '서울특별시 강남구 선릉로132길 54 (청담동, 청담3차 e-편한세상) 301-601', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 08:30:00+09:00', NULL,
  114500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-097", "external_item_no": "2026051469174341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-097' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [307] order_no=2026051454542151, task_no=YS-260514-096, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-096', '2026051454542151',
  '이행석', '010-8429-0057',
  '경기도 구리시 갈매중앙로 201-3 (갈매동, 별내역 메트로망 3차 오피스텔) 214호', '구리시',
  '공동현관 비번 #9999# 입니다', '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 18:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-096", "external_item_no": "2026051469542881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-096' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [308] order_no=2026051460886061, task_no=YS-260514-095, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-095', '2026051460886061',
  '한진환', '010-5771-7132',
  '경기도 구리시 갈매중앙로 185-4 (갈매동, 별내역 메트로망 2차 오피스텔) 309호', '구리시',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 12:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-095", "external_item_no": "2026051478759591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-095' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [309] order_no=2026051458045131, task_no=YS-260514-094, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-094', '2026051458045131',
  '임동욱', '010-9046-6793',
  '서울특별시 강남구 광평로10길 15 (일원동, 상록수아파트) 209동 101호', '강남구',
  '최대한 빨리 부탁드려요', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 17:30:00+09:00', '2026-05-16 00:00:00+09:00',
  112500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-094", "external_item_no": "2026051474558561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-094' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [310] order_no=2026051459051351, task_no=YS-260514-093, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-093', '2026051459051351',
  '박건우', '010-2781-2618',
  '서울특별시 관악구 난곡로64가길 30 (신림동) 404호', '관악구',
  '서울이고 최대한 빠르게 부탁드려요
 이번주 토요일, 담주 화 수 목 금 토 불가합니다.', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 11:00:00+09:00', '2026-05-18 00:00:00+09:00',
  70400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-093", "external_item_no": "2026051476002571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-093' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [311] order_no=2026051458260241, task_no=YS-260514-091, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-091', '2026051458260241',
  '김유리', '010-3057-5944',
  '서울특별시 영등포구 양평로28가길 39 (양평동6가, 선유도디와이파크) 502호', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 15:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-091", "external_item_no": "2026051474861691"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-091' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-090", "external_item_no": "2026051474861701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-091' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [312] order_no=2026051459912381, task_no=YS-260514-089, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-089', '2026051459912381',
  '김도희', '0502-2757-0994',
  '서울특별시 동작구 여의대방로10길 59 (신대방동, 보라매파크빌아파트) 상가동 201호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 18:00:00+09:00', NULL,
  81500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-089", "external_item_no": "2026051477282491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-089' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-088", "external_item_no": "2026051477282501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-089' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [313] order_no=2026051456222611, task_no=YS-260514-083, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-083', '2026051456222611',
  '오규성', '010-8508-2766',
  '서울특별시 관악구 남부순환로192길 23-3 (신림동) 원하우스103호', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 15:00:00+09:00', '2026-05-18 00:00:00+09:00',
  70400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-083", "external_item_no": "2026051471971361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-083' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-082", "external_item_no": "2026051471971371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-083' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [314] order_no=2026051456290311, task_no=YS-260514-081, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-081', '2026051456290311',
  '유경림', '010-8620-6510',
  '경기도 고양시 일산동구 강촌로 114 (백석동, 백송마을5단지아파트) 511동 805호', '일산동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 14:00:00+09:00', NULL,
  67500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-081", "external_item_no": "2026051472068731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-081' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-080", "external_item_no": "2026051472068741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-081' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-079", "external_item_no": "2026051472068751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-081' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [315] order_no=2026051456509411, task_no=YS-260514-078, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-078', '2026051456509411',
  '안종건', '010-4552-4606',
  '서울특별시 성북구 화랑로48길 16 (석관동, 두산아파트) 125동 604호', '성북구',
  '가능한 빠르게 부탁드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 15:30:00+09:00', '2026-05-18 00:00:00+09:00',
  115500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-078", "external_item_no": "2026051472377021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-078' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [316] order_no=2026051451832531, task_no=YS-260514-077, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-077', '2026051451832531',
  '김연지', '010-7677-2906',
  '서울특별시 은평구 갈현로 21-2 (신사동, 동산주택홈타운) 502호 1층비번 종누르고 1470', '은평구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 11:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-077", "external_item_no": "2026051465561011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-077' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-076", "external_item_no": "2026051465561021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-077' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [317] order_no=2026051455984791, task_no=YS-260514-075, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-075', '2026051455984791',
  '이재훈', '010-6602-5252',
  '경기도 의정부시 민락로 211 (민락동, 호반베르디움1차) 108동2301호', '의정부시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 11:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-075", "external_item_no": "2026051471634991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-075' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-074", "external_item_no": "2026051471635001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-075' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [318] order_no=2026051456328921, task_no=YS-260514-073, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-073', '2026051456328921',
  '김민규', '010-4494-1608',
  '서울특별시 은평구 연서로 12 (역촌동, 청암빌딩) 7층', '은평구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 13:00:00+09:00', NULL,
  228700, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=2.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-073", "external_item_no": "2026051472123461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-073' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-072", "external_item_no": "2026051472123471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-073' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [319] order_no=2026051452820261, task_no=YS-260514-071, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-071', '2026051452820261',
  '이하윤', '010-6481-8004',
  '서울특별시 강남구 강남대로120길 74 (논현동, 논현동 188-6 공동주택) 405호', '강남구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 20:30:00+09:00', '2026-05-15 00:00:00+09:00',
  73900, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-071", "external_item_no": "2026051467029261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-071' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [320] order_no=2026051453602001, task_no=YS-260514-070, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-070', '2026051453602001',
  '김민영', '010-9512-6615',
  '서울특별시 영등포구 영등포로72길 18 (신길동, 그랜드하임) 그랜드하임 502호', '영등포구',
  '빠른 일정 문의드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 14:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-070", "external_item_no": "2026051468167801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-070' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [321] order_no=2026051449906421, task_no=YS-260514-069, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-069', '2026051449906421',
  '오수이', '010-2645-6338',
  '서울특별시 광진구 아차산로 353 (자양동, 금강태극빌) 6층 605호', '광진구',
  '문 옆에 놓아주세요.', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 18:00:00+09:00', NULL,
  73900, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-069", "external_item_no": "2026051462648471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-069' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-068", "external_item_no": "2026051462648481"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-069' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [322] order_no=2026051450270271, task_no=YS-260514-067, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-067', '2026051450270271',
  '조예진', '010-2025-0381',
  '서울특별시 관악구 조원로31길 49 (신림동, STAY02) 304호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 18:30:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-067", "external_item_no": "2026051463195351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-067' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [323] order_no=2026051450475931, task_no=YS-260514-066, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-066', '2026051450475931',
  '박현진', '010-9072-9356',
  '서울특별시 중랑구 동일로 752 (중화동, 중화한신아파트) 105동 704호', '중랑구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 17:00:00+09:00', '2026-05-17 00:00:00+09:00',
  70400, 10000,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-066", "external_item_no": "2026051463509641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-066' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [324] order_no=2026051450499801, task_no=YS-260514-065, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-065', '2026051450499801',
  '장선남', '010-9486-0699',
  '서울특별시 금천구 가산로3가길 5 (가산동) 202호', '금천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:00:00+09:00', NULL,
  73900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-065", "external_item_no": "2026051463544111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-065' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-064", "external_item_no": "2026051463544121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-065' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [325] order_no=2026051449384761, task_no=YS-260514-063, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-063', '2026051449384761',
  '정상엽', '010-6414-5062',
  '서울특별시 서대문구 신촌로 121 (창천동, 아남오피스텔) 817호', '서대문구',
  '최대한 빠르게 부탁드립니다. 가능하면 이번 주말에 부탁드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 16:45:00+09:00', NULL,
  73900, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-063", "external_item_no": "2026051461866951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-063' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [326] order_no=2026051449436321, task_no=YS-260514-062, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-062', '2026051449436321',
  '정상신', '010-9406-6699',
  '서울특별시 강서구 허준로 209 (가양동, 가양7단지아파트) 104동901호', '강서구',
  '가급적 빠른일정? 원해요~~~', '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 13:00:00+09:00', NULL,
  73900, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-062", "external_item_no": "2026051461946001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-062' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [327] order_no=2026051446032821, task_no=YS-260514-061, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-061', '2026051446032821',
  '김다슬', '010-8446-7254',
  '서울특별시 관악구 신림로56길 42-1 (신림동) 1층 B102호', '관악구',
  '최대한 빨리 요청', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 20:00:00+09:00', NULL,
  69400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-061", "external_item_no": "2026051456848601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-061' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [328] order_no=2026051450959161, task_no=YS-260514-060, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-060', '2026051450959161',
  '김진현', '010-5022-3302',
  '서울특별시 서초구 논현로11길 16-18 (양재동, 꿈꾸지오) 404호', '서초구',
  '공동현관#1234#', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 19:00:00+09:00', '2026-05-15 00:00:00+09:00',
  70400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-060", "external_item_no": "2026051464238801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-060' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [329] order_no=2026051441777731, task_no=YS-260514-059, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-059', '2026051441777731',
  '이혜연', '010-9319-8923',
  '서울특별시 성북구 동소문로 284 (하월곡동, 길음 서희스타힐스) 1704호', '성북구',
  '최대한 빠르게 부탁드려요~!', '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 10:00:00+09:00', NULL,
  67500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-059", "external_item_no": "2026051450426551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-059' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-058", "external_item_no": "2026051450426561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-059' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [330] order_no=2026051450321481, task_no=YS-260514-057, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-057', '2026051450321481',
  '김은희', '010-2224-8794',
  '서울특별시 관악구 법원단지16길 31 (신림동, 한신위너스) 301호', '관악구',
  '최대한 빠르게 부탁드릴게요.', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 17:30:00+09:00', '2026-05-15 00:00:00+09:00',
  86400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-057", "external_item_no": "2026051463274771"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-057' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [331] order_no=2026051451044461, task_no=YS-260514-056, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-056', '2026051451044461',
  '김민정', '010-4105-3981',
  '서울특별시 구로구 부일로11길 59 (궁동, 동양연립) 다동A동 305호', '구로구',
  '주말에 청소를 원합니다', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 09:00:00+09:00', NULL,
  114500, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-056", "external_item_no": "2026051464367401"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-056' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [332] order_no=2026051450340201, task_no=YS-260514-055, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-055', '2026051450340201',
  '배성연', '010-4166-2418',
  '서울특별시 양천구 신정이펜1로 51 (신정동, 신정이펜하우스4단지) 402동 603호', '양천구',
  '차주 평일 희망합니다.', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 11:00:00+09:00', '2026-05-18 00:00:00+09:00',
  70400, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-055", "external_item_no": "2026051463302691"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [333] order_no=2026051450484281, task_no=YS-260514-054, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-054', '2026051450484281',
  '주연정', '010-4872-5910',
  '서울특별시 영등포구 버드나루로 89 (당산동, 조인타운) 1401호', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 18:00:00+09:00', NULL,
  73900, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-054", "external_item_no": "2026051463522741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-054' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-053", "external_item_no": "2026051463522751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-054' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [334] order_no=2026051441304261, task_no=YS-260514-052, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-052', '2026051441304261',
  '임병관', '010-4571-1754',
  '서울특별시 광진구 광나루로52길 34-3 (구의동) 401호', '광진구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 15:00:00+09:00', '2026-05-14 00:00:00+09:00',
  115500, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-052", "external_item_no": "2026051449716831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-051", "external_item_no": "2026051449716841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [335] order_no=2026051443004291, task_no=YS-260514-047, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-047', '2026051443004291',
  '조은영', '010-3123-3395',
  '경기도 성남시 분당구 성남대로 393 (정자동, 두산위브파빌리온) B동2420호', '분당구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 13:00:00+09:00', '2026-05-15 00:00:00+09:00',
  70400, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-047", "external_item_no": "2026051452275361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-047' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [336] order_no=2026051443067261, task_no=YS-260514-046, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-046', '2026051443067261',
  '송현민', '010-5229-2042',
  '서울특별시 강남구 논현로126길 18 (논현동) 304호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 15:30:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-046", "external_item_no": "2026051452370351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-044", "external_item_no": "2026051452370371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-043", "external_item_no": "2026051452370381"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [337] order_no=2026051443322051, task_no=YS-260514-042, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-042', '2026051443322051',
  '장훈수', '010-5007-6001',
  '경기도 고양시 덕양구 오금로 40 (오금동) 212동405호', '덕양구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 10:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-042", "external_item_no": "2026051452761311"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-041", "external_item_no": "2026051452761321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [338] order_no=2026051443549741, task_no=YS-260514-040, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-040', '2026051443549741',
  '최성은', '010-7705-6597',
  '서울특별시 종로구 자하문로33길 31 (청운동) 202호', '종로구',
  '종1234', '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 11:00:00+09:00', '2026-05-15 00:00:00+09:00',
  70400, NULL,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-040", "external_item_no": "2026051453114341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-040' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [339] order_no=2026051443845451, task_no=YS-260514-039, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-039', '2026051443845451',
  '박경린', '0502-2750-3010',
  '서울특별시 종로구 동숭4라길 33 (동숭동) 302호', '종로구',
  '이번주 토,일요일 중에 예약 원합니다.', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-17 09:00:00+09:00', '2026-05-17 00:00:00+09:00',
  73900, NULL,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-039", "external_item_no": "2026051453558501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [340] order_no=2026051444102501, task_no=YS-260514-036, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-036', '2026051444102501',
  'yun sandra', '010-8993-3080',
  '서울특별시 강남구 영동대로142길 16 (청담동, 청담래미안로이뷰) 101동 111호', '강남구',
  '빠른 시일내 부탁드립니다!', '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 15:00:00+09:00', NULL,
  170500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-036", "external_item_no": "2026051453946951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [341] order_no=2026051327750941, task_no=YS-260514-035, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-035', '2026051327750941',
  '추수정', '010-5173-1954',
  '서울특별시 송파구 오금로11길 43 (방이동, 잠실 트리움) 1005호', '송파구',
  '오피스텔이구 삼성 시스템(천장형) 1way 에어컨입니다. 5월 16일 토요일 일정으로 부탁드립니다!', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-16 09:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-035", "external_item_no": "2026051329374321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [342] order_no=2026050994256621, task_no=YS-260514-034, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-034', '2026050994256621',
  'Otadang', '010-2922-2478',
  '서울특별시 용산구 한강대로43길 8 (한강로2가, 벽산메가트리움) 103동 2807호', '용산구',
  '5-15 1시 시간지정!!!', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-15 14:00:00+09:00', '2026-05-15 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-034", "external_item_no": "2026050938731321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [343] order_no=2026051326767551, task_no=YS-260514-033, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-033', '2026051326767551',
  '임민현', '010-9400-1102',
  '서울특별시 광진구 뚝섬로51길 68 3층', '광진구',
  '지하1호 벽걸이
 101호 벽걸이
 3층 스탠드 벽걸이', '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 12:00:00+09:00', NULL,
  108600, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-033", "external_item_no": "2026051327962761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=3.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-032", "external_item_no": "2026051327962771"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [344] order_no=2026051327585561, task_no=YS-260514-031, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-031', '2026051327585561',
  '김수민', '010-7536-2262',
  '경기도 수원시 팔달구 중부대로239번길 5 (우만동, 우만동R타워) 809호', '팔달구',
  '최대한 빠른 일정 원합니다! (이번주 일요일 오전)', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 10:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-031", "external_item_no": "2026051329138411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [345] order_no=2026051327707401, task_no=YS-260514-030, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-030', '2026051327707401',
  '손미선', '010-6284-8089',
  '경기도 광명시 하안로 198 (소하동, 동양2차아파트) 210동 2502호', '광명시',
  '최대한 빨리 부탁드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 15:00:00+09:00', NULL,
  115500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-030", "external_item_no": "2026051329312271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-029", "external_item_no": "2026051329312281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [346] order_no=2026051329587331, task_no=YS-260514-028, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-028', '2026051329587331',
  '홍선동', '010-3761-0556',
  '서울특별시 강남구 선릉로90길 56 (대치동, 대치동 대우아이빌명문가) 1134호', '강남구',
  '문앞에 놓아 주세요.', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 09:00:00+09:00', '2026-05-16 00:00:00+09:00',
  70400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-028", "external_item_no": "2026051331965441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [347] order_no=2026051330619531, task_no=YS-260514-027, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-027', '2026051330619531',
  '연제광', '010-8881-2088',
  '서울특별시 도봉구 방학로15길 40 (방학동, 신동아아파트) 103동 301호', '도봉구',
  '최대한 빠르게 부탁드립니다. 감사합니다.
 (평일은 16시 이후, 주말 선호 입니다)', '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 16:00:00+09:00', '2026-05-15 00:00:00+09:00',
  115500, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-027", "external_item_no": "2026051333448561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-027' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [348] order_no=2026051437215601, task_no=YS-260514-026, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-026', '2026051437215601',
  '차형진', '010-2698-6530',
  '서울특별시 강남구 논현로6길 4-11 (개포동, 가우디) 201호', '강남구',
  '가능하면 최대한 빨리 해주세요 감사합니다', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 09:00:00+09:00', '2026-05-18 00:00:00+09:00',
  89900, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-026", "external_item_no": "2026051443634331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-025", "external_item_no": "2026051443634341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-024", "external_item_no": "2026051443634351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [349] order_no=2026051331170141, task_no=YS-260514-023, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-023', '2026051331170141',
  '오다혜', '010-8849-6086',
  '서울특별시 노원구 동일로245가길 41 (상계동, 은빛2단지아파트) 205동103호', '노원구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-31 15:00:00+09:00', '2026-05-14 00:00:00+09:00',
  73900, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-023", "external_item_no": "2026051334274731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [350] order_no=2026051332286701, task_no=YS-260514-022, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-022', '2026051332286701',
  '김정아', '0502-2652-5952',
  '서울특별시 용산구 만리재로 202 (서계동, 서울역풍림아이원플러스) 1512호', '용산구',
  '배송 시 문자주시고 파손 주의해주세요', '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 13:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-022", "external_item_no": "2026051335958971"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [351] order_no=2026051332581791, task_no=YS-260514-020, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-020', '2026051332581791',
  '경다혜', '010-9848-1130',
  '서울특별시 영등포구 양평로22라길 1 (양평동5가, 대우미래사랑2차) 102동 505호', '영등포구',
  '공동현관 0315#103호출', '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 19:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-020", "external_item_no": "2026051336407831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [352] order_no=2026051332895291, task_no=YS-260514-019, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-019', '2026051332895291',
  '김슬아', '010-5646-5791',
  '서울특별시 광진구 아차산로 353 (자양동, 금강태극빌) 801호', '광진구',
  '공동현관 0315#103호출', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 12:15:00+09:00', '2026-05-15 00:00:00+09:00',
  70400, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-019", "external_item_no": "2026051336890931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [353] order_no=2026051333742791, task_no=YS-260514-018, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-018', '2026051333742791',
  '김비경', '010-3651-6468',
  '서울특별시 광진구 뚝섬로54길 74 (자양동, 자양5차현대아파트) 501동 505호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  116100, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-018", "external_item_no": "2026051338198321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-017", "external_item_no": "2026051338198331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [354] order_no=2026051335549301, task_no=YS-260514-016, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-016', '2026051335549301',
  '이은희', '010-5376-6253',
  '서울특별시 양천구 신정로 293 (신정동, 신트리1단지아파트) 103동 705호', '양천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:00:00+09:00', '2026-05-18 00:00:00+09:00',
  67500, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-016", "external_item_no": "2026051341015991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-015", "external_item_no": "2026051341016001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [355] order_no=2026051336021741, task_no=YS-260514-014, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-014', '2026051336021741',
  '나오미', '010-6887-9056',
  '서울특별시 은평구 통일로71가길 10-13 (대조동) 세진빌라 3층 302호', '은평구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 13:00:00+09:00', '2026-05-15 00:00:00+09:00',
  209500, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=3.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-014", "external_item_no": "2026051341753491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [356] order_no=2026051436928031, task_no=YS-260514-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-013', '2026051436928031',
  '이준서', '010-2795-1620',
  '서울특별시 동작구 상도로53길 51-4 (상도1동) 101호 (현관비번 : 열쇠 3698종)', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 09:00:00+09:00', '2026-05-16 00:00:00+09:00',
  70400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-013", "external_item_no": "2026051443175721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [357] order_no=2026051439259401, task_no=YS-260514-011, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-011', '2026051439259401',
  '박가은', '010-2590-2675',
  '서울특별시 성북구 성북로23길 30 (성북동) 103호', '성북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 13:00:00+09:00', NULL,
  67500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-011", "external_item_no": "2026051446733591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [358] order_no=2026051330843411, task_no=YS-260514-010, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-010', '2026051330843411',
  '차준기', '010-7921-7070',
  '서울특별시 강남구 영동대로138길 12 청담자이아파트 104동 3203호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 16:00:00+09:00', NULL,
  257500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-010", "external_item_no": "2026051333784131"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-009", "external_item_no": "2026051333784141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [359] order_no=2026051331093381, task_no=YS-260514-008, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-008', '2026051331093381',
  '강성철', '010-3697-3435',
  '서울특별시 성북구 솔샘로24길 15 (정릉동, 정릉 이-편한세상) 106동 704호', '성북구',
  '주말작업 부탁 드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 12:00:00+09:00', '2026-05-16 00:00:00+09:00',
  115500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-008", "external_item_no": "2026051334158901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-007", "external_item_no": "2026051334158911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-006", "external_item_no": "2026051334158921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [360] order_no=2026051333353491, task_no=YS-260514-005, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-005', '2026051333353491',
  '임태경', '010-8007-2508',
  '서울특별시 양천구 목동로19길 29 (신정동, 예지쉐르빌) B동 501호', '양천구',
  '최대한 빠르게 부탁드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 16:30:00+09:00', '2026-05-16 00:00:00+09:00',
  115500, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260514-005", "external_item_no": "2026051337595651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-004", "external_item_no": "2026051337595661"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [361] order_no=2026051438067231, task_no=YS-260514-001, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260514-001', '2026051438067231',
  '최은정', '010-5316-4529',
  '경기도 양주시 평화로1475번길 161-14 (덕계동, 덕계 신도브래뉴) 101동203호', '양주시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 15:00:00+09:00', NULL,
  29000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260514-001", "external_item_no": "2026051445012061"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260514-001' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [362] order_no=2026050911917581, task_no=YS-260513-043, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-043', '2026050911917581',
  '최가을', '010-5632-5129',
  '서울특별시 광진구 능동로21길 14-6 (군자동, Forus빌) 201호', '광진구',
  '5-23 오전10시 시간지정', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-23 11:00:00+09:00', NULL,
  66500, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-043", "external_item_no": "2026050949676701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-043' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [363] order_no=2026050728765511, task_no=YS-260513-042, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-042', '2026050728765511',
  '이은숙', '010-3336-8026',
  '서울특별시 동대문구 한천로37길 33 108-1001', '동대문구',
  '5-20 오후 6시반 지정', '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-20 18:30:00+09:00', NULL,
  114000, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-042", "external_item_no": "2026050732309841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [364] order_no=2026051325308551, task_no=YS-260513-041, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-041', '2026051325308551',
  '김현진', '0502-2651-5410',
  '서울특별시 송파구 송이로34길 15 (문정동, 아이존빌) 204호', '송파구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 08:30:00+09:00', '2026-05-18 00:00:00+09:00',
  130700, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-041", "external_item_no": "2026051325807761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [365] order_no=2026051325336141, task_no=YS-260513-040, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-040', '2026051325336141',
  '김선순', '010-4297-8222',
  '서울특별시 금천구 문성로3길 43 (독산동, 동은아파트) 101호', '금천구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:00:00+09:00', '2026-05-15 00:00:00+09:00',
  130700, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-040", "external_item_no": "2026051325848721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-040' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [366] order_no=2026051319995781, task_no=YS-260513-037, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-037', '2026051319995781',
  '아베크 모델스', '010-9833-9317',
  '서울특별시 강남구 가로수길 57-6 (신사동) 6층', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 13:00:00+09:00', '2026-05-15 00:00:00+09:00',
  67100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-037", "external_item_no": "2026051317780001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=2.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-036", "external_item_no": "2026051317780011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [367] order_no=2026051320722021, task_no=YS-260513-035, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-035', '2026051320722021',
  '진청두', '010-2209-1612',
  '경기도 의왕시 학현로 170-42 (학의동, 예원) 이우철한정식', '의왕시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-14 15:00:00+09:00', '2026-05-14 00:00:00+09:00',
  160700, 20000,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-035", "external_item_no": "2026051318886801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [368] order_no=2026051321808551, task_no=YS-260513-033, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-033', '2026051321808551',
  '김지애', '010-4732-0114',
  '서울특별시 광진구 능동로25길 31 (군자동, 시티하임B동) 시티하임B동 303호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  85400, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-033", "external_item_no": "2026051320556741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [369] order_no=2026051321891211, task_no=YS-260513-031, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-031', '2026051321891211',
  '김영웅', '010-5875-4656',
  '경기도 성남시 중원구 자혜로72번길 2 (금광동) 1층', '중원구',
  '청소 일정 조정은 문자 먼저 부탁드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 10:00:00+09:00', '2026-05-15 00:00:00+09:00',
  115000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-031", "external_item_no": "2026051320682551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260513-030", "external_item_no": "2026051320682561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [370] order_no=2026051321919371, task_no=YS-260513-029, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-029', '2026051321919371',
  '김화영', '010-3616-1266',
  '서울특별시 동작구 동작대로3길 45 (사당동) 1층 좌측상가', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 15:30:00+09:00', '2026-05-14 00:00:00+09:00',
  81500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-029", "external_item_no": "2026051320726851"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [371] order_no=2026051322436431, task_no=YS-260513-028, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-028', '2026051322436431',
  '배준성', '010-3295-2554',
  '서울특별시 송파구 오금로32길 31 (송파동, 래미안송파파인탑) 102동 401호', '송파구',
  '가장 빠른 토요일로 부탁드려요', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 12:30:00+09:00', '2026-05-16 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-028", "external_item_no": "2026051321520221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-027", "external_item_no": "2026051321520231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [372] order_no=2026051322998621, task_no=YS-260513-026, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-026', '2026051322998621',
  '권은희', '010-9092-2672',
  '서울특별시 성북구 장월로 160 (장위동) 래미안 장위 포레카운티 104동 401호', '성북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 11:00:00+09:00', '2026-05-14 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-026", "external_item_no": "2026051322355451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [373] order_no=2026051323925041, task_no=YS-260513-025, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-025', '2026051323925041',
  '박세진', '010-6481-0895',
  '서울특별시 동작구 국사봉7길 21 (상도동) 401호', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 12:00:00+09:00', '2026-05-17 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-025", "external_item_no": "2026051323748281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [374] order_no=2026051324158001, task_no=YS-260513-024, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-024', '2026051324158001',
  '박진영', '010-2604-4376',
  '서울특별시 강남구 봉은사로11길 61 (논현동, 이레재) 204호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 09:00:00+09:00', '2026-05-15 00:00:00+09:00',
  86400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-024", "external_item_no": "2026051324099601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [375] order_no=2026051324174361, task_no=YS-260513-023, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-023', '2026051324174361',
  '김경림', '010-5839-0406',
  '서울특별시 성북구 아리랑로6가길 11 (동선동5가) 베스트빌 206호', '성북구',
  '최대한 빠르게 부탁합니다', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 17:30:00+09:00', '2026-05-14 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-023", "external_item_no": "2026051324123621"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [376] order_no=2026051324510331, task_no=YS-260513-022, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-022', '2026051324510331',
  '김윤숙', '010-3728-1758',
  '서울특별시 동작구 만양로14가길 8 주택 1층', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 13:30:00+09:00', '2026-05-16 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-022", "external_item_no": "2026051324620211"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260513-021", "external_item_no": "2026051324620221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [377] order_no=2026051324543121, task_no=YS-260513-020, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-020', '2026051324543121',
  '김윤숙', '010-3728-1758',
  '서울특별시 동작구 노량진동 330 삼익주상복합아파트 1013호', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 13:00:00+09:00', '2026-05-16 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-020", "external_item_no": "2026051324668531"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260513-019", "external_item_no": "2026051324668541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [378] order_no=2026051324594181, task_no=YS-260513-018, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-018', '2026051324594181',
  '장일남', '010-3825-9002',
  '서울특별시 관악구 조원로 8 (신림동, 민영빌딩) 민영빌딩 3층 장일남컬렉션', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 16:30:00+09:00', '2026-05-15 00:00:00+09:00',
  117500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-018", "external_item_no": "2026051324743761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [379] order_no=2026051324850991, task_no=YS-260513-017, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-017', '2026051324850991',
  '로이드손해사정법인', '0502-2822-7519',
  '서울특별시 용산구 대사관로 62 (한남동) 3층', '용산구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 13:00:00+09:00', '2026-05-18 00:00:00+09:00',
  120500, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-017", "external_item_no": "2026051325124731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [380] order_no=2026051325180491, task_no=YS-260513-016, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-016', '2026051325180491',
  '이광훈', '010-5606-6580',
  '서울특별시 구로구 구로중앙로18길 56 (구로동, 성삼하이츠아파트) 306호', '구로구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 09:00:00+09:00', NULL,
  63600, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-016", "external_item_no": "2026051325617441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-015", "external_item_no": "2026051325617451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [381] order_no=2026051312223361, task_no=YS-260513-014, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-014', '2026051312223361',
  '문은주', '010-9025-7687',
  '서울특별시 영등포구 대림로34마길 6-1 (대림동) 1층', '영등포구',
  '주말가능, 토요일은 3시이후, 일요일은 3시이전에만 가능합니다', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 15:00:00+09:00', '2026-05-16 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-014", "external_item_no": "2026051396122501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [382] order_no=2026051317303101, task_no=YS-260513-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-013', '2026051317303101',
  '신지은', '010-4796-9770',
  '서울특별시 중구 동호로7길 14 (신당동, 약수역 더시티) 515호', '중구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 08:30:00+09:00', '2026-05-14 00:00:00+09:00',
  89900, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-013", "external_item_no": "2026051313722031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [383] order_no=2026051293000081, task_no=YS-260513-010, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-010', '2026051293000081',
  '최정미', '010-3787-0592',
  '서울특별시 강북구 인수봉로79길 93 (수유동, 현대수유빌라) 2동 101호', '강북구',
  '최대한 빠르게 주말로 부탁드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 17:30:00+09:00', '2026-05-16 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-010", "external_item_no": "2026051282017931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-009", "external_item_no": "2026051282017941"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [384] order_no=2026051293574871, task_no=YS-260513-008, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-008', '2026051293574871',
  '황옥자', '010-8467-1209',
  '서울특별시 광진구 아차산로 552 (광장동, 광장극동아파트) 8동 1001호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 12:00:00+09:00', NULL,
  112100, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-008", "external_item_no": "2026051282886891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-007", "external_item_no": "2026051282886901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [385] order_no=2026051293919981, task_no=YS-260513-006, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-006', '2026051293919981',
  '차진영', '010-6799-3827',
  '서울특별시 광진구 뚝섬로40길 30 (자양동, 해연오) 해연오빌 202호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 14:00:00+09:00', NULL,
  66500, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-006", "external_item_no": "2026051283417601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260513-005", "external_item_no": "2026051283417611"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [386] order_no=2026051295280711, task_no=YS-260513-004, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-004', '2026051295280711',
  '진지혜', '010-9896-2149',
  '인천광역시 부평구 경인로972번길 30 (부평동, 번성홈타운) A동 301호', '부평구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  70000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-004", "external_item_no": "2026051285546691"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260513-003", "external_item_no": "2026051285546701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [387] order_no=2026051295376011, task_no=YS-260513-002, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260513-002', '2026051295376011',
  '김미영', '010-5028-9367',
  '경기도 남양주시 오남읍 진건오남로 564 (오남읍, 유호아파트) 유호아파트103동1202호', '남양주시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 10:00:00+09:00', NULL,
  67100, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-002", "external_item_no": "2026051285700121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260513-001", "external_item_no": "2026051285700131"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260513-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [388] order_no=2026051285327711, task_no=YS-260512-095, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-095', '2026051285327711',
  '전주연', '010-5830-9621',
  '서울특별시 관악구 남부순환로 1641 (신림동) 706호', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 17:00:00+09:00', '2026-05-14 00:00:00+09:00',
  86400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-095", "external_item_no": "2026051270781571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-095' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [389] order_no=2026051286108621, task_no=YS-260512-094, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-094', '2026051286108621',
  '이찬희', '010-2389-4348',
  '서울특별시 금천구 범안로12가길 13 (독산동, 우진빌) 201호', '금천구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 09:00:00+09:00', '2026-05-18 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-094", "external_item_no": "2026051271946241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-094' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [390] order_no=2026051286865401, task_no=YS-260512-093, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-093', '2026051286865401',
  '남동완', '010-5092-7041',
  '서울특별시 관악구 낙성대역14가길 15 (봉천동, 몰디브) 101호', '관악구',
  '최대한 빠르게 부탁드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 19:00:00+09:00', '2026-05-13 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-093", "external_item_no": "2026051273074471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-093' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-092", "external_item_no": "2026051273074481"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-093' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-091", "external_item_no": "2026051273074491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-093' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-090", "external_item_no": "2026051273074501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-093' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [391] order_no=2026051287787751, task_no=YS-260512-089, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-089', '2026051287787751',
  '이현경', '010-3288-1542',
  '경기도 남양주시 화도읍 경춘보학1길 8 (화도읍, 남양주 라온 프라이빗 5단지) 505동1303호', '남양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 12:00:00+09:00', '2026-05-15 00:00:00+09:00',
  112100, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-089", "external_item_no": "2026051274432231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-089' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-088", "external_item_no": "2026051274432241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-089' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [392] order_no=2026051287894851, task_no=YS-260512-087, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-087', '2026051287894851',
  '안효성', '010-8853-3648',
  '서울특별시 성동구 고산자로 160 (응봉동, 대림 강변 타운) 107동1001호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 09:00:00+09:00', NULL,
  257500, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-087", "external_item_no": "2026051274585781"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-087' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [393] order_no=2026051288221941, task_no=YS-260512-086, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-086', '2026051288221941',
  '현승우', '010-7149-9140',
  '서울특별시 중구 다산로31길 60-14 (신당동) 403호', '중구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 11:00:00+09:00', '2026-05-14 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-086", "external_item_no": "2026051275066471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-086' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [394] order_no=2026051288290191, task_no=YS-260512-084, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-084', '2026051288290191',
  '조희연', '010-7623-1272',
  '서울특별시 동대문구 답십리로57길 53 (답십리동, 답십리청솔우성아파트) 201동 701호', '동대문구',
  '문 앞 배송 부탁드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 14:00:00+09:00', '2026-05-18 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-084", "external_item_no": "2026051275165061"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-084' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [395] order_no=2026051288479691, task_no=YS-260512-082, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-082', '2026051288479691',
  '유영재', '010-4800-7124',
  '서울특별시 강북구 오패산로 118-18 (미아동) 201호', '강북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 12:00:00+09:00', '2026-05-15 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-082", "external_item_no": "2026051275439321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-082' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [396] order_no=2026051290476671, task_no=YS-260512-081, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-081', '2026051290476671',
  '김경환', '010-8433-4571',
  '서울특별시 송파구 가락로5길 25 (석촌동, 서일주택) 4층 404호', '송파구',
  '최대한 빨리', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 15:30:00+09:00', '2026-05-13 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-081", "external_item_no": "2026051278278281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-081' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [397] order_no=2026051291319541, task_no=YS-260512-080, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-080', '2026051291319541',
  '이강희', '010-4852-8582',
  '서울특별시 서초구 신반포로45길 29-30 아진빌라트 301호', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 16:00:00+09:00', '2026-05-13 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-080", "external_item_no": "2026051279509851"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-080' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-079", "external_item_no": "2026051279509861"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-080' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [398] order_no=2026051291647721, task_no=YS-260512-078, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-078', '2026051291647721',
  '최성현', '0502-2730-2336',
  '서울특별시 강서구 공항대로63길 41 (염창동) 제3층 301호', '강서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 12:00:00+09:00', NULL,
  66500, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-078", "external_item_no": "2026051279989211"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-078' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [399] order_no=2026051291717001, task_no=YS-260512-077, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-077', '2026051291717001',
  '김가경', '010-2953-8838',
  '경기도 구리시 안골로57번길 36-15 (수택동) 4층(공동현관36155*', '구리시',
  '현관36155*', '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 09:00:00+09:00', NULL,
  108600, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-077", "external_item_no": "2026051280088921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-077' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-076", "external_item_no": "2026051280088931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-077' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [400] order_no=2026051156465011, task_no=YS-260512-075, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-075', '2026051156465011',
  '이강준', '010-8231-1355',
  '경기도 남양주시 경춘로 442-2 (다산동) 도농역네이션스오피스텔 1811호', '남양주시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 13:30:00+09:00', NULL,
  86400, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-075", "external_item_no": "2026051126682231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-075' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [401] order_no=2026051280249751, task_no=YS-260512-074, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-074', '2026051280249751',
  '문지윤', '010-4210-3065',
  '서울특별시 은평구 가좌로7길 9-12 (응암동, 태경쉐르빌) 태경쉐르빌 302호', '은평구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 10:00:00+09:00', '2026-05-15 00:00:00+09:00',
  130700, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-074", "external_item_no": "2026051262984231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-074' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [402] order_no=2026051280292521, task_no=YS-260512-073, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-073', '2026051280292521',
  '함보민', '010-3345-8548',
  '서울특별시 마포구 동교로 63-3 (망원동) 202호', '마포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 14:00:00+09:00', '2026-05-14 00:00:00+09:00',
  65500, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-073", "external_item_no": "2026051263048421"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-073' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [403] order_no=2026051280542611, task_no=YS-260512-072, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-072', '2026051280542611',
  '유은겸', '0502-2807-0688',
  '서울특별시 강남구 역삼로15길 15 (역삼동) 302호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 14:00:00+09:00', '2026-05-16 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-072", "external_item_no": "2026051263434331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [404] order_no=2026051281895071, task_no=YS-260512-071, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-071', '2026051281895071',
  '한나래', '010-6309-0564',
  '서울특별시 성동구 한림말5길 15 (옥수동) 3층', '성동구',
  '삼성스탠드 에어컨(AF16T5774WZN) 입니다.
 가능 날짜 금주 5월 13일(수), 15일(금) 가능합니다.
 집에 강아지가 있어서 혹시 안좋아하시면 말씀주세요.', '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-15 13:00:00+09:00', '2026-05-15 00:00:00+09:00',
  86400, 30000,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-071", "external_item_no": "2026051265542951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-071' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [405] order_no=2026051282685501, task_no=YS-260512-067, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-067', '2026051282685501',
  '박효림', '010-3034-2731',
  '서울특별시 관악구 인헌15길 15 (봉천동) 101호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 11:00:00+09:00', NULL,
  112100, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-067", "external_item_no": "2026051266761361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-067' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-066", "external_item_no": "2026051266761371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-067' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [406] order_no=2026051283259891, task_no=YS-260512-065, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-065', '2026051283259891',
  '박영빈', '010-2805-6158',
  '경기도 성남시 분당구 구미로9번길 16 (구미동, 체리빌오피스텔) 106호 백암순대', '분당구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 07:30:00+09:00', '2026-05-13 00:00:00+09:00',
  120500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-065", "external_item_no": "2026051267652821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-065' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [407] order_no=2026051283935921, task_no=YS-260512-064, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-064', '2026051283935921',
  '고태형', '010-4921-2649',
  '서울특별시 동대문구 이문로9나길 4 (이문동) 102호', '동대문구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 11:00:00+09:00', '2026-05-15 00:00:00+09:00',
  65500, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-064", "external_item_no": "2026051268695191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-064' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [408] order_no=2026051284064801, task_no=YS-260512-063, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-063', '2026051284064801',
  '강유미', '010-4900-0268',
  '서울특별시 용산구 백범로 275 (효창동, 용산케이씨씨스위첸) 103동 1604호', '용산구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 10:00:00+09:00', '2026-05-16 00:00:00+09:00',
  257500, 10000,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-063", "external_item_no": "2026051268887601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-063' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [409] order_no=2026051284534731, task_no=YS-260512-061, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-061', '2026051284534731',
  '권혜림', '010-4890-4349',
  '서울특별시 광진구 면목로11길 39 (중곡동, 월드하우스) 502호', '광진구',
  '공동현관 종1379', '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 12:00:00+09:00', NULL,
  66500, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-061", "external_item_no": "2026051269608941"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-061' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-060", "external_item_no": "2026051269608951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-061' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [410] order_no=2026051284612491, task_no=YS-260512-059, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-059', '2026051284612491',
  '배수성', '010-8828-0346',
  '서울특별시 관악구 신림로 137 (신림동, 조홍빌딩) 1층 늘푸른약국', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 21:00:00+09:00', '2026-05-13 00:00:00+09:00',
  124000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-059", "external_item_no": "2026051269726331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-059' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [411] order_no=2026051284620931, task_no=YS-260512-058, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-058', '2026051284620931',
  '박지영', '010-2313-2635',
  '서울특별시 송파구 중대로 24 (문정동, 올림픽훼밀리타운) 227동 701호', '송파구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 11:00:00+09:00', '2026-05-15 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-058", "external_item_no": "2026051269739631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-058' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [412] order_no=2026051145747641, task_no=YS-260512-057, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-057', '2026051145747641',
  '장지훈', '010-9720-2315',
  '서울특별시 성북구 성북로8길 31 (성북동, 엔시엔아트) 104호', '성북구',
  '5-18일 이전까지만 청소 가능', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-16 12:00:00+09:00', '2026-05-17 00:00:00+09:00',
  86400, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-057", "external_item_no": "2026051110475901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-057' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-056", "external_item_no": "2026051110475911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-057' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [413] order_no=2026051274933451, task_no=YS-260512-053, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-053', '2026051274933451',
  '김경훈', '010-4577-4338',
  '서울특별시 성북구 성북로8길 44-1 (성북동, 삼성아트빌 3차) B동 201호', '성북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 13:30:00+09:00', '2026-05-15 00:00:00+09:00',
  86400, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-053", "external_item_no": "2026051254765501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-053' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [414] order_no=2026051275681501, task_no=YS-260512-052, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-052', '2026051275681501',
  '김성은', '010-4693-2680',
  '서울특별시 금천구 금하로 793 (시흥동, 벽산1단지아파트) 114동1602호', '금천구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 10:30:00+09:00', '2026-05-15 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-052", "external_item_no": "2026051255946241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [415] order_no=2026051275827211, task_no=YS-260512-051, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-051', '2026051275827211',
  '박세열', '010-7176-5594',
  '서울특별시 광진구 영화사로3길 27-3 (중곡동) 2층', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 09:00:00+09:00', NULL,
  115000, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-051", "external_item_no": "2026051256174941"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-051' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [416] order_no=2026051276650551, task_no=YS-260512-050, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-050', '2026051276650551',
  '오동옥', '010-9986-8028',
  '서울특별시 강북구 오현로25길 12-5 (번동, 한마음오동타운) 201호', '강북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 16:00:00+09:00', '2026-05-12 00:00:00+09:00',
  108600, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-050", "external_item_no": "2026051257442011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-050' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-049", "external_item_no": "2026051257442021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-050' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [417] order_no=2026051277258701, task_no=YS-260512-048, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-048', '2026051277258701',
  '지윤경', '0502-2647-0050',
  '서울특별시 마포구 월드컵북로 502-7 (상암동, 상암월드컵파크12단지) 1205-503', '마포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 09:00:00+09:00', '2026-05-18 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-048", "external_item_no": "2026051258391231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-047", "external_item_no": "2026051258391241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [418] order_no=2026051277592581, task_no=YS-260512-046, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-046', '2026051277592581',
  '이정훈', '010-3219-3048',
  '서울특별시 노원구 석계로 49 (월계동, 현대아파트) 108동 502호', '노원구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-31 12:04:00+09:00', '2026-05-14 00:00:00+09:00',
  134200, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-046", "external_item_no": "2026051258907281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [419] order_no=2026051277639731, task_no=YS-260512-045, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-045', '2026051277639731',
  '김혜정', '010-3315-8036',
  '서울특별시 동대문구 장한로18길 82-14 (장안동, 장안현대홈타운) 122동 103호', '동대문구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 15:30:00+09:00', '2026-05-15 00:00:00+09:00',
  63600, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-045", "external_item_no": "2026051258979751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-045' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-044", "external_item_no": "2026051258979761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-045' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [420] order_no=2026051278315431, task_no=YS-260512-043, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-043', '2026051278315431',
  '박봉금', '010-4014-2760',
  '서울특별시 강동구 상일로 74 (상일동, 고덕리엔파크3단지아파트) 302동 701호', '강동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:00:00+09:00', '2026-05-15 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-043", "external_item_no": "2026051260026711"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-043' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [421] order_no=2026051278750711, task_no=YS-260512-042, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-042', '2026051278750711',
  '장홍석', '010-2062-4082',
  '서울특별시 서초구 신반포로 165 (잠원동, 반포쇼핑타운) 2동 218호 영일무역', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 14:00:00+09:00', '2026-05-13 00:00:00+09:00',
  81500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-042", "external_item_no": "2026051260689511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-041", "external_item_no": "2026051260689521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [422] order_no=2026051278906541, task_no=YS-260512-040, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-040', '2026051278906541',
  '이재은', '010-5303-4741',
  '서울특별시 강서구 곰달래로25길 65-12 (화곡동) 301호', '강서구',
  '최대한 빨리 부탁드립니다!', '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 17:00:00+09:00', '2026-05-13 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-040", "external_item_no": "2026051260925871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-040' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [423] order_no=2026042291994801, task_no=YS-260512-039, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-039', '2026042291994801',
  '김혜미', '010-5547-5611',
  '경기도 남양주시 별내3로 251 (별내동, 별사랑마을2-10단지) 2006동 1606호', '남양주시',
  '5월20일 오전9시 시간지정', '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-20 09:00:00+09:00', NULL,
  112100, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-039", "external_item_no": "2026042283831811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-038", "external_item_no": "2026042283831821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [424] order_no=2026042024170771, task_no=YS-260512-037, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-037', '2026042024170771',
  '강민지', '010-7156-3940',
  '경기도 의정부시 송양로 94 (민락동) 엘레트 아파트 1911-2403', '의정부시',
  '5-14 오후 한시반 지정', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-14 13:30:00+09:00', '2026-05-14 00:00:00+09:00',
  112100, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-037", "external_item_no": "2026042071751061"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-036", "external_item_no": "2026042071751071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-035", "external_item_no": "2026042071751081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [425] order_no=2026050869389601, task_no=YS-260512-034, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-034', '2026050869389601',
  '이은하', '010-5381-7626',
  '서울특별시 강북구 삼양로111길 18-24 (수유동, 그린하이츠빌라) 303호', '강북구',
  '2026. 5. 14 오전 9시 지정', '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-14 09:00:00+09:00', '2026-05-14 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-034", "external_item_no": "2026050892974891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [426] order_no=2026050913376151, task_no=YS-260512-033, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-033', '2026050913376151',
  '함민경', '010-9048-9748',
  '서울특별시 성동구 무학로6길 50 (도선동, 성동삼성쉐르빌) 103동1416호', '성동구',
  '5-15 오전 10시 지정', '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-15 13:30:00+09:00', '2026-05-16 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-033", "external_item_no": "2026050951986331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [427] order_no=2026050990803121, task_no=YS-260512-032, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-032', '2026050990803121',
  '심원종', '010-6474-3489',
  '경기도 남양주시 의안로 155 (평내동, 평내마을신명스카이뷰아파트) 1806동 1703호', '남양주시',
  '5-16 오후 4시 지정', '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-16 17:30:00+09:00', NULL,
  111500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-032", "external_item_no": "2026050933944081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [428] order_no=2026050163349821, task_no=YS-260512-031, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-031', '2026050163349821',
  '이라영', '010-3122-2274',
  '서울특별시 광진구 자양번영로3길 65 (자양동, 삼성아파트) 103동 608호', '광진구',
  '5-16 오후 12시 지정', '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-16 16:00:00+09:00', '2026-05-16 00:00:00+09:00',
  109300, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-031", "external_item_no": "2026050185446731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-030", "external_item_no": "2026050185446741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [429] order_no=2026050441152621, task_no=YS-260512-029, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-029', '2026050441152621',
  '정지혜', '010-8877-3133',
  '경기도 양주시 옥정서로 130 (옥정동, 옥정 센트럴파크 푸르지오) 914동 2303호', '양주시',
  '5월19일(화) 오전 11시 일정 지정', '확정',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-19 11:00:00+09:00', NULL,
  112200, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-029", "external_item_no": "2026050495895721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [430] order_no=2026042888517811, task_no=YS-260512-028, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-028', '2026042888517811',
  '조성우', '010-9345-6513',
  '경기도 양주시 장흥면 권율로 83-32 (장흥면, 네츄럴시티) B동 701호', '양주시',
  '5월19일(화) 오전 9시 일정 지정', '확정',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-19 09:00:00+09:00', NULL,
  87900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-028", "external_item_no": "2026042878608171"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [431] order_no=2026051161341791, task_no=YS-260512-027, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-027', '2026051161341791',
  '황재현', '010-4501-5098',
  '서울특별시 노원구 섬밭로 196 (하계동, 장미아파트) 604동414호', '노원구',
  '배송 전에 미리 연락 바랍니다.부재시 전화 주시거나 문자 남겨 주세요.배송 전에 미리 연락 바랍니다.부재시 경비실에 맡겨 주세요.', '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 15:00:00+09:00', '2026-05-13 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-027", "external_item_no": "2026051133918751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-027' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-026", "external_item_no": "2026051133918761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-027' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [432] order_no=2026051156314711, task_no=YS-260512-025, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-025', '2026051156314711',
  '박미선', '010-9070-1257',
  '서울특별시 노원구 동일로196길 9-3 (공릉동) 2층', '노원구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 11:00:00+09:00', '2026-05-14 00:00:00+09:00',
  115000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-025", "external_item_no": "2026051126453521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [433] order_no=2026051164929751, task_no=YS-260512-024, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-024', '2026051164929751',
  '박태근', '010-8785-5612',
  '서울특별시 노원구 노원로1길 21 (공릉동, 공릉9단지청솔아파트) 901동 104호', '노원구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 11:00:00+09:00', NULL,
  112100, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-024", "external_item_no": "2026051139370581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-023", "external_item_no": "2026051139370591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [434] order_no=2026051267856141, task_no=YS-260512-022, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-022', '2026051267856141',
  '김시윤', '010-8874-8399',
  '경기도 의정부시 본원로 39 (녹양동, 휴먼시아) 303동 102호', '의정부시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 14:00:00+09:00', '2026-05-18 00:00:00+09:00',
  111500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-022", "external_item_no": "2026051244008311"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-021", "external_item_no": "2026051244008321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [435] order_no=2026051156798181, task_no=YS-260512-020, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-020', '2026051156798181',
  '박찬선', '010-7234-1657',
  '서울특별시 송파구 법원로 114 (문정동, 엠스테이트) c동 1506호', '송파구',
  '5월 16일 청소하고 싶네여', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-16 10:00:00+09:00', '2026-05-16 00:00:00+09:00',
  170500, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-020", "external_item_no": "2026051127181111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [436] order_no=2026051160540581, task_no=YS-260512-016, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-016', '2026051160540581',
  '김예현', '010-5135-3685',
  '서울특별시 동대문구 답십리로 130 (답십리동, 래미안위브) 202동 605호', '동대문구',
  '최대한 빠르게 부탁드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 14:00:00+09:00', '2026-05-16 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-016", "external_item_no": "2026051132744731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-015", "external_item_no": "2026051132744741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [437] order_no=2026051161776911, task_no=YS-260512-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-013', '2026051161776911',
  '김선우', '010-4132-4272',
  '경기도 고양시 덕양구 원흥1로 35 (원흥동, 고양삼송 엘에이치 13단지 아파트) 1302동 307호', '덕양구',
  '5/17일 청소 가능할지 확인 부탁드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-17 15:00:00+09:00', NULL,
  66500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-013", "external_item_no": "2026051134557811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [438] order_no=2026051163259811, task_no=YS-260512-012, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-012', '2026051163259811',
  '조한나', '010-3565-2962',
  '서울특별시 강남구 광평로 295 (수서동, 사이룩스오피스텔) 동관 521호', '강남구',
  '5/18일로 지정 가능할까요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-18 10:00:00+09:00', '2026-05-18 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-012", "external_item_no": "2026051136793741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [439] order_no=2026051165185711, task_no=YS-260512-011, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-011', '2026051165185711',
  '이네르', '010-3364-6018',
  '서울특별시 중랑구 숙선옹주로 6-9 (묵동, 묵동자이아파트1단지) 2층 232호', '중랑구',
  '짐 없을때 하고 싶습니다 최대한 빠르게 방문 부탁드립니다!', '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 14:00:00+09:00', NULL,
  120500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-011", "external_item_no": "2026051139766851"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [440] order_no=2026051165770451, task_no=YS-260512-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-010', '2026051165770451',
  '지준엽', '010-7934-0706',
  '서울특별시 은평구 녹번로 10 (녹번동, 세민빌딩) 406호', '은평구',
  '최대한 빠르게 부탁드려요', '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 14:00:00+09:00', '2026-05-13 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-010", "external_item_no": "2026051140693101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [441] order_no=2026051165661621, task_no=YS-260512-009, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-009', '2026051165661621',
  '지수', '010-6737-6663',
  '서울특별시 성동구 독서당로 242 (옥수동, 동인 샤인빌) 904호', '성동구',
  '이번주 가능한 날짜 문자로 남겨주시면 감사하겠습니다.', '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 15:00:00+09:00', '2026-05-15 00:00:00+09:00',
  67100, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-009", "external_item_no": "2026051140522561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-008", "external_item_no": "2026051140522571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [442] order_no=2026051268392201, task_no=YS-260512-007, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-007', '2026051268392201',
  '신우진', '010-3108-5903',
  '서울특별시 성북구 보문로30가길 41-23 (동선동2가, 필하우스) 203호', '성북구',
  '5월 15일 금요일로 요청드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-15 11:00:00+09:00', '2026-05-15 00:00:00+09:00',
  130700, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-007", "external_item_no": "2026051244855801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [443] order_no=2026051164396211, task_no=YS-260512-006, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-006', '2026051164396211',
  '정해용', '010-2551-0076',
  '서울특별시 구로구 신도림로 16 (신도림동, 신도림 대림아파트) 201동 2703호', '구로구',
  'LG 휘센 투인원입니다
 일정은 이번주 목요일 오전 10시로 부탁드리겠습니다.', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 10:00:00+09:00', NULL,
  112100, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-006", "external_item_no": "2026051138537241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-005", "external_item_no": "2026051138537251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-004", "external_item_no": "2026051138537261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [444] order_no=2026051269616041, task_no=YS-260512-003, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260512-003', '2026051269616041',
  '박은주', '0502-2720-7915',
  '서울특별시 은평구 증산로19길 13-4 (신사동) 단독주택', '은평구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 10:00:00+09:00', NULL,
  130700, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260512-003", "external_item_no": "2026051246842011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=2.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-002", "external_item_no": "2026051246842021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=2.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260512-001", "external_item_no": "2026051246842031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260512-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [445] order_no=2026051157469281, task_no=YS-260511-036, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-036', '2026051157469281',
  '이향희', '010-4797-3310',
  '서울특별시 구로구 도림천로 448 (구로동, 예성유토피아) 202동 808호', '구로구',
  '문앞에 놔주세요.', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 16:00:00+09:00', '2026-05-14 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-036", "external_item_no": "2026051128188661"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-035", "external_item_no": "2026051128188671"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [446] order_no=2026051158168161, task_no=YS-260511-034, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-034', '2026051158168161',
  '문연경', '0502-2896-9349',
  '서울특별시 강남구 언주로107길 11 (역삼동, 시티프라디움 더 강남 2차) 시티프라디움더강남2차 605호', '강남구',
  '송풍팬 분해 청소 및 냉매 점검 등은 현장에서 구매결정 하겠습니다.', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 11:00:00+09:00', '2026-05-18 00:00:00+09:00',
  257500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-034", "external_item_no": "2026051129241401"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [447] order_no=2026051159763851, task_no=YS-260511-033, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-033', '2026051159763851',
  '이하나', '010-9722-1204',
  '서울특별시 성북구 보국문로28길 6 (정릉동, 하나빌라) 101호', '성북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 14:00:00+09:00', '2026-05-14 00:00:00+09:00',
  63600, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-033", "external_item_no": "2026051131606701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-032", "external_item_no": "2026051131606711"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-031", "external_item_no": "2026051131606721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-030", "external_item_no": "2026051131606731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [448] order_no=2026051152359321, task_no=YS-260511-029, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-029', '2026051152359321',
  '김민기', '010-6414-4576',
  '경기도 남양주시 홍유릉로248번길 51 (금곡동, 지에스아파트) 101동 1101호', '남양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 09:00:00+09:00', '2026-05-17 00:00:00+09:00',
  344500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=4.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 4, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-029", "external_item_no": "2026051120413141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-028", "external_item_no": "2026051120413151"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [449] order_no=2026051148059161, task_no=YS-260511-027, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-027', '2026051148059161',
  '안수진', '0502-2711-3122',
  '서울특별시 관악구 봉천로 610 (봉천동) 3층', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 09:00:00+09:00', '2026-05-15 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-027", "external_item_no": "2026051113938491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-027' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [450] order_no=2026051152535331, task_no=YS-260511-025, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-025', '2026051152535331',
  '홍수인', '010-8234-1509',
  '서울특별시 영등포구 신길로15나길 7-1 (대림동) 2층', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 10:00:00+09:00', NULL,
  67100, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-025", "external_item_no": "2026051120682351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-024", "external_item_no": "2026051120682361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [451] order_no=2026051147012351, task_no=YS-260511-018, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-018', '2026051147012351',
  '한유경', '010-9515-3625',
  '경기도 고양시 덕양구 중고개길 83-65 (지축동) 단독주택', '덕양구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 15:00:00+09:00', '2026-05-15 00:00:00+09:00',
  5900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-018", "external_item_no": "2026051112360281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-017", "external_item_no": "2026051112360291"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-016", "external_item_no": "2026051112360301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-015", "external_item_no": "2026051112360311"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [452] order_no=2026051144320721, task_no=YS-260511-014, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-014', '2026051144320721',
  '유혜련', '010-3662-1523',
  '인천광역시 서구 완정로228번길 18 (금곡동, 산마루) 202호', '서구',
  '최대한 빠르게 부탁드려요.', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 17:00:00+09:00', NULL,
  70000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-014", "external_item_no": "2026051198312551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-013", "external_item_no": "2026051198312561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-012", "external_item_no": "2026051198312571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [453] order_no=2026051142600381, task_no=YS-260511-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-010', '2026051142600381',
  '박소영', '010-9763-1227',
  '서울특별시 관악구 은천로 66-35 (봉천동, 명성트윈빌A동) 201호', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 16:00:00+09:00', '2026-05-19 00:00:00+09:00',
  86400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-010", "external_item_no": "2026051195710851"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [454] order_no=2026051141589251, task_no=YS-260511-009, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-009', '2026051141589251',
  'MATSUDA MAKOTO', '010-5236-1127',
  '서울특별시 마포구 상암산로1길 52 (상암동, 상암 월드컵파크 5단지) 508동 1503호', '마포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 09:00:00+09:00', '2026-05-13 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-009", "external_item_no": "2026051194171601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-008", "external_item_no": "2026051194171611"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260511-007", "external_item_no": "2026051194171631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [455] order_no=2026051028899841, task_no=YS-260511-006, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-006', '2026051028899841',
  '김현경', '010-7446-1696',
  '서울특별시 강남구 개포로 516 (개포동, 개포주공아파트) 702동 602호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 17:00:00+09:00', '2026-05-15 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-006", "external_item_no": "2026051074632591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-005", "external_item_no": "2026051074632601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [456] order_no=2026051030250261, task_no=YS-260511-004, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260511-004', '2026051030250261',
  '황채연', '0502-2884-4385',
  '서울특별시 관악구 낙성대로 4 (봉천동, 아놀노타워) 506호', '관악구',
  '최대한 빠른 방문 원합니다. 5월 13일 또는 14일 방문 희망합니다.', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 13:00:00+09:00', '2026-05-14 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260511-004", "external_item_no": "2026051076601291"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260511-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [457] order_no=2026051019969821, task_no=YS-260510-020, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260510-020', '2026051019969821',
  '윤원규', '010-5257-1602',
  '경기도 군포시 용호2로 36 (당동, 주공4단지아파트) 401동1602호', '군포시',
  '5/17(일)오후였으면 합니다', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 15:00:00+09:00', '2026-05-17 00:00:00+09:00',
  112100, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260510-020", "external_item_no": "2026051061669981"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260510-019", "external_item_no": "2026051061669991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260510-018", "external_item_no": "2026051061670001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [458] order_no=2026051025827941, task_no=YS-260510-017, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260510-017', '2026051025827941',
  '신상호', '010-2533-3564',
  '서울특별시 동작구 사당로29다길 61 (사당동, 레드빌) 303호', '동작구',
  '최대한 빠른 일정에 맞추겠습니다.', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 11:00:00+09:00', '2026-05-14 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260510-017", "external_item_no": "2026051070169111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260510-016", "external_item_no": "2026051070169121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [459] order_no=2026051022621301, task_no=YS-260510-015, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260510-015', '2026051022621301',
  '강예주', '010-2627-4227',
  '서울특별시 강남구 강남대로 256 (도곡동, 대우양재디오빌) 1512호', '강남구',
  '5월 19일 오후나 5월 21일 이후로 예약 가능할지 문의드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 15:00:00+09:00', NULL,
  70000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260510-015", "external_item_no": "2026051065506621"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260510-014", "external_item_no": "2026051065506631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260510-013", "external_item_no": "2026051065506641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260510-012", "external_item_no": "2026051065506651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [460] order_no=2026051017882701, task_no=YS-260510-008, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260510-008', '2026051017882701',
  '김지선', '010-8419-1006',
  '서울특별시 강서구 양천로30길 77 (마곡동, 한솔솔파크아파트) 104동 1202호', '강서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 10:00:00+09:00', NULL,
  109300, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260510-008", "external_item_no": "2026051058611441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260510-007", "external_item_no": "2026051058611451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260510-006", "external_item_no": "2026051058611461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [461] order_no=2026050999455481, task_no=YS-260510-005, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260510-005', '2026050999455481',
  '윤현정', '010-4748-7087',
  '서울특별시 강남구 개포로 264 (개포동, 개포 래미안 포레스트) 101-1104', '강남구',
  '5/19 오전중으로 원하십니다', '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-19 10:00:00+09:00', NULL,
  344500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=4.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 4, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260510-005", "external_item_no": "2026050946006201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [462] order_no=2026051013955881, task_no=YS-260510-004, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260510-004', '2026051013955881',
  '홍혜현', '010-4531-0255',
  '경기도 광명시 가림일로 101 (철산동, 도덕파크타운 2차) 205동 2303호', '광명시',
  '부재시 문앞에 두고가주세요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 14:30:00+09:00', '2026-05-12 00:00:00+09:00',
  66500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260510-004", "external_item_no": "2026051052876631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260510-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [463] order_no=YS-260509-012, task_no=YS-260509-012, channel=현금접수, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_h' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260509-012', 'YS-260509-012',
  '종로 기고객', '010-3521-8607',
  '서울 종로구 종로 329-4 203호', NULL,
  '5/16 오후1시 픽스 현금8만원받아야함', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-16 10:00:00+09:00', '2026-05-16 00:00:00+09:00',
  80000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260509-012", "external_item_no": "YS-260509-012"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [464] order_no=2026050988696741, task_no=YS-260509-011, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260509-011', '2026050988696741',
  '조훈화', '010-6415-7768',
  '서울특별시 강서구 강서로 187 (화곡동, 경동엠파이어시티) 101동 211호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-09 13:00:00+09:00', '2026-05-09 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260509-011", "external_item_no": "2026050931081731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [465] order_no=2026050875842321, task_no=YS-260509-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260509-010', '2026050875842321',
  '정초희', '010-8369-3039',
  '경기도 고양시 덕양구 원흥1로 35 (원흥동, 고양삼송 엘에이치 13단지 아파트) 1312동 406호', '덕양구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 13:00:00+09:00', '2026-05-12 00:00:00+09:00',
  111500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260509-010", "external_item_no": "2026050812473081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [466] order_no=2026050984894111, task_no=YS-260509-009, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260509-009', '2026050984894111',
  '구환웅', '010-5504-4137',
  '서울특별시 마포구 독막로19길 30-8 (상수동, 명빌딩) 206호', '마포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 15:00:00+09:00', '2026-05-13 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260509-009", "external_item_no": "2026050925713191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [467] order_no=2026050986262151, task_no=YS-260509-008, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260509-008', '2026050986262151',
  '이혜정', '010-7149-8305',
  '서울특별시 영등포구 경인로82길 3-4 (문래동1가, 센터플러스) 813호', '영등포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 09:00:00+09:00', '2026-05-12 00:00:00+09:00',
  120500, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260509-008", "external_item_no": "2026050927667991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260509-007", "external_item_no": "2026050927668001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [468] order_no=2026050983914231, task_no=YS-260509-006, channel=네이버, items=5
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260509-006', '2026050983914231',
  '이천수', '010-6717-2074',
  '서울특별시 강동구 구천면로68나길 49 (천호동) 301호', '강동구',
  '서울 강동구 최대한 빠른 일정 원합니다 엘지 에어컨 fnq161st1g 모델입니다', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:00:00+09:00', '2026-05-12 00:00:00+09:00',
  109300, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260509-006", "external_item_no": "2026050924229151"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260509-005", "external_item_no": "2026050924229161"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260509-004", "external_item_no": "2026050924229171"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260509-003", "external_item_no": "2026050924229181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260509-002", "external_item_no": "2026050924229191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260509-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [469] order_no=2026050874456951, task_no=YS-260508-018, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260508-018', '2026050874456951',
  '전세림', '010-9428-1203',
  '서울특별시 서초구 반포대로12길 37 (서초동, 서초 리슈빌) 212호', '서초구',
  '공용현관번호 #*7530#
 5/15 청소 가능할까요?', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 11:00:00+09:00', '2026-05-15 00:00:00+09:00',
  86400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260508-018", "external_item_no": "2026050810481291"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [470] order_no=2026050874723731, task_no=YS-260508-017, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260508-017', '2026050874723731',
  '이경화', '010-2039-2406',
  '경기도 파주시 양지로 120 (동패동, e편한세상 운정 어반프라임) 1201동 1002호', '파주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 14:15:00+09:00', '2026-05-16 00:00:00+09:00',
  109300, NULL,
  NULL,
  '["손동식", "조동욱"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260508-017", "external_item_no": "2026050810863411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260508-016", "external_item_no": "2026050810863421"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [471] order_no=2026050870277791, task_no=YS-260508-015, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260508-015', '2026050870277791',
  '김진수', '010-8294-2589',
  '서울특별시 강남구 논현로157길 37 (신사동) 102호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 14:30:00+09:00', '2026-05-11 00:00:00+09:00',
  130700, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260508-015", "external_item_no": "2026050894283571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=2.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260508-014", "external_item_no": "2026050894283581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=2.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260508-013", "external_item_no": "2026050894283591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=2.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260508-012", "external_item_no": "2026050894283601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [472] order_no=2026050864029711, task_no=YS-260508-011, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260508-011', '2026050864029711',
  '이승림', '010-9271-0770',
  '서울특별시 양천구 목동로 177 (신정동, 정동프라자) 2층 애니빌런 만화학원', '양천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-31 13:00:00+09:00', '2026-05-13 00:00:00+09:00',
  844200, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=7.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 7, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260508-011", "external_item_no": "2026050884952261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=7.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 7, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260508-010", "external_item_no": "2026050884952271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [473] order_no=2026050865912031, task_no=YS-260508-009, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260508-009', '2026050865912031',
  '이규진', '010-9283-1385',
  '서울특별시 관악구 법원단지길 158-8 (신림동, 청림주택) B04호', '관악구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 09:00:00+09:00', '2026-05-11 00:00:00+09:00',
  109300, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260508-009", "external_item_no": "2026050887803721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260508-008", "external_item_no": "2026050887803731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260508-007", "external_item_no": "2026050887803741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [474] order_no=2026050861256651, task_no=YS-260508-006, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260508-006', '2026050861256651',
  '이가령', '010-4812-3264',
  '서울특별시 광진구 동일로30길 23 (화양동, 케이타워 오피스텔 B) 408호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 10:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260508-006", "external_item_no": "2026050880930821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260508-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [475] order_no=2026050734184791, task_no=YS-260507-023, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-023', '2026050734184791',
  '이보배', '010-8764-8601',
  '서울특별시 용산구 대사관로24길 15 (한남동) 301호', '용산구',
  NULL, '취소',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 13:00:00+09:00', '2026-05-15 00:00:00+09:00',
  130700, 10000,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-023", "external_item_no": "2026050740380931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [476] order_no=2026050743360631, task_no=YS-260507-022, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-022', '2026050743360631',
  '임헌준', '010-9037-9190',
  '서울특별시 영등포구 도신로 231-12 (신길동) 1층 왼쪽집', '영등포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 10:40:00+09:00', '2026-05-09 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-022", "external_item_no": "2026050754156401"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260507-021", "external_item_no": "2026050754156411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [477] order_no=2026050733841561, task_no=YS-260507-019, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-019', '2026050733841561',
  '김연수', '010-5366-3729',
  '서울특별시 성동구 행당로 82 (행당동, 행당 한진타운) 115동 1904호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 09:30:00+09:00', NULL,
  109300, 60000,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-019", "external_item_no": "2026050739871581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-018", "external_item_no": "2026050739871591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [478] order_no=2026050734153911, task_no=YS-260507-017, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-017', '2026050734153911',
  '신지혜', '010-5002-7883',
  '서울특별시 강남구 일원로 120 (일원동, 샘터마을아파트) 108동302호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:00:00+09:00', '2026-05-08 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-017", "external_item_no": "2026050740334141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [479] order_no=2026050736672271, task_no=YS-260507-016, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-016', '2026050736672271',
  '강인식', '010-9929-3499',
  '서울특별시 강남구 남부순환로 2935 (대치동, 대치 프라자) 1층 경비실', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 09:00:00+09:00', '2026-05-14 00:00:00+09:00',
  88500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-016", "external_item_no": "2026050744124701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-015", "external_item_no": "2026050744124711"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [480] order_no=2026050734202401, task_no=YS-260507-012, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-012', '2026050734202401',
  '이아영', '010-3022-0204',
  '서울특별시 마포구 월드컵로14길 50-10 (서교동, 서교리치빌) 304호', '마포구',
  '종누르고 1234
 문 앞 부탁드려요   5/8 4시 원하십니다', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-08 16:00:00+09:00', '2026-05-08 00:00:00+09:00',
  170500, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-012", "external_item_no": "2026050740406931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [481] order_no=2026050615060591, task_no=YS-260507-011, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-011', '2026050615060591',
  '이민용', '010-4846-0695',
  '경기도 성남시 중원구 성남대로 993 (여수동, 성남 여수 오렌지카운티) 520호', '중원구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:00:00+09:00', '2026-05-13 00:00:00+09:00',
  87200, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-011", "external_item_no": "2026050611673811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [482] order_no=2026050615728741, task_no=YS-260507-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-010', '2026050615728741',
  '김지환', '010-4915-2009',
  '서울특별시 강남구 도산대로70길 22 (청담동) 101호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 12:30:00+09:00', '2026-05-12 00:00:00+09:00',
  67900, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-010", "external_item_no": "2026050612664901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [483] order_no=2026050621838691, task_no=YS-260507-009, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-009', '2026050621838691',
  '이경미', '010-8726-0724',
  '서울특별시 양천구 신정로11길 63 (신정동, 푸른마을3단지아파트) 305동402호', '양천구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 16:00:00+09:00', '2026-05-13 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-009", "external_item_no": "2026050621616451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-008", "external_item_no": "2026050621616461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260507-007", "external_item_no": "2026050621616471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [484] order_no=2026050622434831, task_no=YS-260507-006, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-006', '2026050622434831',
  '임준혁', '010-8999-8247',
  '서울특별시 강서구 가로공원로78길 45-14 (화곡동, 미래하이츠) A동402호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 10:30:00+09:00', '2026-05-14 00:00:00+09:00',
  111500, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-006", "external_item_no": "2026050622488601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [485] order_no=2026050627368111, task_no=YS-260507-005, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-005', '2026050627368111',
  '이남희', '010-3807-9446',
  '서울특별시 종로구 평창12길 8-22 (평창동, 금강주택) 1동 202호', '종로구',
  '파손없이 문앞에 배송부탁드려요', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 10:00:00+09:00', '2026-05-08 00:00:00+09:00',
  63600, NULL,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-005", "external_item_no": "2026050630132421"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-004", "external_item_no": "2026050630132431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [486] order_no=2026050729012601, task_no=YS-260507-003, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260507-003', '2026050729012601',
  '김형일', '010-6253-3033',
  '서울특별시 강북구 오패산로77길 13-1 (번동, 다우빌딩) 302호', '강북구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 14:00:00+09:00', '2026-05-08 00:00:00+09:00',
  66500, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260507-003", "external_item_no": "2026050732691281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260507-002", "external_item_no": "2026050732691291"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260507-001", "external_item_no": "2026050732691301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260507-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [487] order_no=2026050620357881, task_no=YS-260506-022, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-022', '2026050620357881',
  '장윤아', '010-6766-2748',
  '서울특별시 동대문구 왕산로 190 (전농동) 청량리역렉스프라임 1119호', '동대문구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 14:30:00+09:00', '2026-05-08 00:00:00+09:00',
  87200, 30000,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-022", "external_item_no": "2026050619471021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [488] order_no=2026050615269991, task_no=YS-260506-021, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-021', '2026050615269991',
  '한인규', '0502-2830-1465',
  '서울특별시 강서구 마곡서로 133 709동 1101호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-06 13:00:00+09:00', '2026-05-06 00:00:00+09:00',
  67900, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-021", "external_item_no": "2026050611984251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [489] order_no=2026050691731281, task_no=YS-260506-020, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-020', '2026050691731281',
  '박승구', '010-2697-7810',
  '서울특별시 강서구 까치산로28길 14 (화곡동, 아인스빌1) 아인스빌1동 302호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 16:30:00+09:00', '2026-05-09 00:00:00+09:00',
  112200, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-020", "external_item_no": "2026050681365351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [490] order_no=2026050695077911, task_no=YS-260506-019, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-019', '2026050695077911',
  '최홍준', '010-9902-2345',
  '서울특별시 마포구 월드컵로42길 12 (상암동, 상암월드컵8단지) 804동 302호', '마포구',
  '5월23일(토) 오전중 예약합니다', '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 09:00:00+09:00', NULL,
  67900, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-019", "external_item_no": "2026050686439441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [491] order_no=2026050611428391, task_no=YS-260506-018, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-018', '2026050611428391',
  '박승현', '010-2023-4244',
  '서울특별시 용산구 이촌로 1 (한강로3가, 지에스 한강에클라트) 1009호', '용산구',
  '빠른 청소 부탁드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 14:00:00+09:00', '2026-05-08 00:00:00+09:00',
  89900, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-018", "external_item_no": "2026050696121651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [492] order_no=2026050614305271, task_no=YS-260506-017, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-017', '2026050614305271',
  '강지윤', '010-8585-9214',
  '서울특별시 양천구 월정로9길 20 (신월동, 양천벽산블루밍2단지) 201동 907호', '양천구',
  '문앞에 배송부탁드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:00:00+09:00', '2026-05-13 00:00:00+09:00',
  109300, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-017", "external_item_no": "2026050610539891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-016", "external_item_no": "2026050610539901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [493] order_no=2026050696089861, task_no=YS-260506-015, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-015', '2026050696089861',
  '우숙자', '010-5042-8410',
  '서울특별시 동작구 국사봉길 21-5 (상도동) 청운하우스 302호', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 16:00:00+09:00', '2026-05-10 00:00:00+09:00',
  87200, 10000,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-015", "external_item_no": "2026050687983401"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260506-014", "external_item_no": "2026050687983411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [494] order_no=2026050698281551, task_no=YS-260506-013, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-013', '2026050698281551',
  '연규석', '010-7207-8162',
  '서울특별시 용산구 녹사평대로40길 43 (이태원동) 1층 Y.POT', '용산구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 09:00:00+09:00', '2026-05-11 00:00:00+09:00',
  124000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-013", "external_item_no": "2026050691322311"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260506-012", "external_item_no": "2026050691322321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [495] order_no=2026050698538881, task_no=YS-260506-011, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-011', '2026050698538881',
  '최재호', '010-4039-6053',
  '서울특별시 강서구 곰달래로35길 163 (화곡동, 한빛타운) 402호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 10:00:00+09:00', '2026-05-13 00:00:00+09:00',
  109300, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-011", "external_item_no": "2026050691712221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-010", "external_item_no": "2026050691712231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260506-009", "external_item_no": "2026050691712241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [496] order_no=2026050613767251, task_no=YS-260506-007, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-007', '2026050613767251',
  '지영규', '010-8648-8264',
  '서울특별시 영등포구 선유동2로 29 (양평동3가, 현대2차아파트) 201동 905호', '영등포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 16:00:00+09:00', '2026-05-15 00:00:00+09:00',
  109300, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-007", "external_item_no": "2026050699724641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-006", "external_item_no": "2026050699724651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260506-005", "external_item_no": "2026050699724661"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [497] order_no=2026050578415991, task_no=YS-260506-004, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-004', '2026050578415991',
  '김유나', '0502-2735-2601',
  '서울특별시 은평구 통일로 630 (녹번동, 래미안베라힐즈) 204동 1004호', '은평구',
  '문앞에 놓아주세요. 감사합니다.', '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 11:00:00+09:00', '2026-05-16 00:00:00+09:00',
  171200, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-004", "external_item_no": "2026050561024271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [498] order_no=2026050689953111, task_no=YS-260506-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-003', '2026050689953111',
  '정승현', '010-7552-0880',
  '서울특별시 용산구 청파로47다길 26 (청파동2가, 청파신비빌A) 302호', '용산구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 13:00:00+09:00', '2026-05-12 00:00:00+09:00',
  87200, 10000,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-003", "external_item_no": "2026050678715701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [499] order_no=2026050579794471, task_no=YS-260506-002, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-002', '2026050579794471',
  '김진애', '010-9626-4286',
  '서울특별시 강서구 강서로 266 (화곡동, 우장산아이파크이편한세상아파트) 125-1004', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 09:00:00+09:00', '2026-05-16 00:00:00+09:00',
  112200, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-002", "external_item_no": "2026050563075451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [500] order_no=2026050580776301, task_no=YS-260506-001, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260506-001', '2026050580776301',
  '이은순', '010-8305-0040',
  '서울특별시 강남구 자곡로 260 (자곡동, 강남한양수자인아파트) 404동 401호', '강남구',
  '빠르게 예약 된다면 5/8(금) 오후 1-3시 사이,
 안되면 다음주 5/14(목)~5/15(금) 오후 1-3시 사이 예약 요청드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 14:00:00+09:00', '2026-05-14 00:00:00+09:00',
  112200, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260506-001", "external_item_no": "2026050564543871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260506-001' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

COMMIT;
