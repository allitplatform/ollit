-- ============================================
-- 유솔N 시트 → Supabase tasks/task_items 마이그 (Fix #31)
-- 생성: 2026-05-19 00:11:38
-- 원본: db/migration/usol-may-v2.xlsx 시트 '시트1'
-- 시트 데이터 1143건 → tasks 769개
-- 출력 범위: skip=100, limit=200 → 200 task
-- ============================================

BEGIN;

-- [101] order_no=2026051616801251, task_no=YS-260517-032, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-032', '2026051616801251',
  '김민정', '010-8558-5068',
  '서울특별시 성북구 북악산로29길 32 (종암동) 504호', '성북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 09:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-032", "external_item_no": "2026051655762871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-031", "external_item_no": "2026051655762881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [102] order_no=2026051619816841, task_no=YS-260517-030, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-030', '2026051619816841',
  '장성숙', '010-2822-2470',
  '서울특별시 동대문구 답십리로56길 21-1 (답십리동, 두산아파트) 202동710호', '동대문구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 17:30:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-030", "external_item_no": "2026051660437851"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-029", "external_item_no": "2026051660437861"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [103] order_no=2026051721562531, task_no=YS-260517-028, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-028', '2026051721562531',
  '강인성', '010-2928-2628',
  '서울특별시 마포구 고산길 94-2 (노고산동) 301호', '마포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 16:00:00+09:00', NULL,
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
  '{"item_code": "YS-260517-028", "external_item_no": "2026051763119491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-027", "external_item_no": "2026051763119501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [104] order_no=2026051617426611, task_no=YS-260517-026, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-026', '2026051617426611',
  '윤현아', '010-8799-2596',
  '서울특별시 동작구 만양로14바길 29 (노량진동, 한강하이츠빌라) 5동 102호(공동현관258369)', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  67500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-026", "external_item_no": "2026051656715191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-025", "external_item_no": "2026051656715201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [105] order_no=2026051617430851, task_no=YS-260517-024, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-024', '2026051617430851',
  '오진영', '010-4743-3506',
  '서울특별시 영등포구 영등포로13길 12-2 (양평동1가, 성운타운2) 603호', '영등포구',
  '5/18,19,22,28,29 가능합니다.', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260517-024", "external_item_no": "2026051656721501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [106] order_no=2026051618039281, task_no=YS-260517-023, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-023', '2026051618039281',
  '전아름', '010-3869-3091',
  '서울특별시 서초구 방배로25길 47 (방배동) 201호', '서초구',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 19:30:00+09:00', NULL,
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
  '{"item_code": "YS-260517-023", "external_item_no": "2026051657667811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [107] order_no=2026051618051431, task_no=YS-260517-022, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-022', '2026051618051431',
  '김소연', '010-2662-7872',
  '서울특별시 은평구 백련산로14길 7-16 (응암동, 응암하우스) 302호', '은평구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 16:30:00+09:00', NULL,
  69400, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-022", "external_item_no": "2026051657686271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [108] order_no=2026051618310991, task_no=YS-260517-021, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-021', '2026051618310991',
  '이가홍', '010-9394-2627',
  '서울특별시 노원구 동일로208길 20 (중계동, 무지개아파트) 210동 808호', '노원구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-31 10:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-021", "external_item_no": "2026051658092681"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [109] order_no=2026051618378251, task_no=YS-260517-020, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-020', '2026051618378251',
  '유정선', '010-3301-6698',
  '서울특별시 영등포구 신풍로2길 1 (신길동) 1층 / 대문기준 가장 오른쪽 집', '영등포구',
  '빠르게 부탁드려요 / 주말 선호합니다', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
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
  '{"item_code": "YS-260517-020", "external_item_no": "2026051658196401"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [110] order_no=2026051618464771, task_no=YS-260517-019, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-019', '2026051618464771',
  '박경훈', '010-2652-3039',
  '서울특별시 은평구 갈현로33길 36-28 (갈현동, 목화빌라) 202호', '은평구',
  '최대한 빨리 부탁드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 14:00:00+09:00', NULL,
  138500, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-019", "external_item_no": "2026051658332991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=2.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-018", "external_item_no": "2026051658333001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [111] order_no=2026051618489051, task_no=YS-260517-017, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-017', '2026051618489051',
  '류해랑', '010-3977-5494',
  '서울특별시 중구 다산로36다길 17 (신당동) 202호', '중구',
  '최대한빠르게', '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 18:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-017", "external_item_no": "2026051658370671"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [112] order_no=2026051618787271, task_no=YS-260517-016, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-016', '2026051618787271',
  '허남욱', '010-9377-6631',
  '경기도 구리시 동구릉로53번길 4 (인창동) 동진타워오피스텔 606호', '구리시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 14:30:00+09:00', NULL,
  89900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-016", "external_item_no": "2026051658842241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [113] order_no=2026051619233561, task_no=YS-260517-015, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-015', '2026051619233561',
  '류세은', '010-8665-4958',
  '경기도 하남시 감일로 86 (감일동) 감일스윗시티 1단지 106동 801호', '하남시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
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
  '{"item_code": "YS-260517-015", "external_item_no": "2026051659549541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-014", "external_item_no": "2026051659549551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [114] order_no=2026051619305911, task_no=YS-260517-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-013', '2026051619305911',
  '전민솔', '010-4194-7830',
  '서울특별시 강남구 선릉로100길 42 (삼성동, LG선릉에클라트) A동 620호', '강남구',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 05:15:00+09:00', NULL,
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
  '{"item_code": "YS-260517-013", "external_item_no": "2026051659659821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [115] order_no=2026051619664021, task_no=YS-260517-012, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-012', '2026051619664021',
  '나', '010-7153-3329',
  '서울특별시 강남구 개포로31길 15-4 (개포동) 6층', '강남구',
  '최대한 빠르게 부탁드려요', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 01:45:00+09:00', NULL,
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
  '{"item_code": "YS-260517-012", "external_item_no": "2026051660203071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [116] order_no=2026051720547831, task_no=YS-260517-011, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-011', '2026051720547831',
  '김아름', '0502-2866-5971',
  '서울특별시 강남구 영동대로 22 (일원동, 디에이치 자이 개포) 806동 613호', '강남구',
  '최대한 빠르게 부탁드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 03:00:00+09:00', NULL,
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
  '{"item_code": "YS-260517-011", "external_item_no": "2026051761544251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [117] order_no=2026051720595131, task_no=YS-260517-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-010', '2026051720595131',
  '손홍규', '010-6368-5084',
  '서울특별시 광진구 자양로7길 6-16 (자양동) 202호', '광진구',
  '최대한 빨리 부탁드립니다 !!', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  NULL, NULL,
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
  '{"item_code": "YS-260517-010", "external_item_no": "2026051761616071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [118] order_no=2026051720595731, task_no=YS-260517-009, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-009', '2026051720595731',
  '박사랑', '010-7569-6585',
  '서울특별시 용산구 우사단로14길 48 (한남동) 401호', '용산구',
  '최대한 빠르게 부탁드립니다 ㅎㅎ', '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 17:00:00+09:00', NULL,
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
  '{"item_code": "YS-260517-009", "external_item_no": "2026051761617391"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [119] order_no=2026051720639111, task_no=YS-260517-008, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-008', '2026051720639111',
  '고현욱', '010-3127-5003',
  '서울특별시 양천구 목동중앙로13다길 36-10 (목동, 목동 빌리지 2차) 502호', '양천구',
  '최대한 빠른날짜희망
 수, 토, 일 가능', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:30:00+09:00', NULL,
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
  '{"item_code": "YS-260517-008", "external_item_no": "2026051761684121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [120] order_no=2026051720969521, task_no=YS-260517-007, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-007', '2026051720969521',
  '라영길', '010-4555-9827',
  '서울특별시 도봉구 덕릉로59바길 12 (창동) 582-43 2층 202호', '도봉구',
  '최대한 빠르게 부탁드려요', '확정',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-31 12:02:00+09:00', NULL,
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
  '{"item_code": "YS-260517-007", "external_item_no": "2026051762195451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [121] order_no=2026051721191241, task_no=YS-260517-006, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-006', '2026051721191241',
  '선병현', '010-9018-1858',
  '서울특별시 중랑구 겸재로27가길 16 (면목동) 301호', '중랑구',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  138500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-006", "external_item_no": "2026051762549041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [122] order_no=2026051721474551, task_no=YS-260517-005, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-005', '2026051721474551',
  '윤구선', '010-7705-4816',
  '서울특별시 금천구 가산로5길 14 (가산동, 해찬행복드림) 해찬행복드림 202호', '금천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 14:00:00+09:00', NULL,
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
  '{"item_code": "YS-260517-005", "external_item_no": "2026051762986821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [123] order_no=2026051721504901, task_no=YS-260517-004, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-004', '2026051721504901',
  '김하나', '0502-2785-9416',
  '서울특별시 강남구 언주로71길 31-5 (역삼동, 성진빌라) 302호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  NULL, NULL,
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
  '{"item_code": "YS-260517-004", "external_item_no": "2026051763031661"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [124] order_no=2026051721602791, task_no=YS-260517-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-003', '2026051721602791',
  '이예림', '010-5631-0463',
  '서울특별시 관악구 솔밭로2길 44 (봉천동, 목양) 503호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
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
  '{"item_code": "YS-260517-003", "external_item_no": "2026051763178931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [125] order_no=2026051722458071, task_no=YS-260517-002, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-002', '2026051722458071',
  '이유환', '010-9750-2276',
  '서울특별시 성동구 마장로37길 7 (마장동, 대성유니드아파트) 103동 503호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  116100, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-002", "external_item_no": "2026051764385041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-001", "external_item_no": "2026051764385051"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [126] order_no=2026051615956771, task_no=YS-260516-182, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-182', '2026051615956771',
  '장덕팔', '010-2513-8933',
  '서울특별시 송파구 백제고분로28길 27-19 (삼전동) 303호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 10:00:00+09:00', NULL,
  69400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-182", "external_item_no": "2026051654522041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-182' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-181", "external_item_no": "2026051654522051"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-182' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [127] order_no=2026051616123451, task_no=YS-260516-180, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-180', '2026051616123451',
  '홍미', '010-6312-1912',
  '서울특별시 노원구 한글비석로54길 92 (상계동, 상계주공13단지아파트) 1306동1402호', '노원구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-31 11:30:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-180", "external_item_no": "2026051654766671"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-180' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [128] order_no=2026051616155351, task_no=YS-260516-179, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-179', '2026051616155351',
  '홍미', '010-6312-1912',
  '인천광역시 서구 가정로 387 (신현동, 신현이편한세상하늘채) 135동1001호', '서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260516-179", "external_item_no": "2026051654812621"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-179' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-178", "external_item_no": "2026051654812631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-179' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [129] order_no=2026051616245191, task_no=YS-260516-177, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-177', '2026051616245191',
  '성주희', '010-8995-4198',
  '서울특별시 송파구 양산로4길 8 (거여동, 거여4단지아파트) 406-411', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  69400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-177", "external_item_no": "2026051654943361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-177' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [130] order_no=2026051616414651, task_no=YS-260516-176, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-176', '2026051616414651',
  '이지훈', '010-6346-9879',
  '서울특별시 송파구 양재대로 1218 (방이동, 올림픽선수기자촌아파트) 312동 1201호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 03:00:00+09:00', NULL,
  142000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-176", "external_item_no": "2026051655192231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-176' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [131] order_no=2026051615410201, task_no=YS-260516-175, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-175', '2026051615410201',
  '김지은', '010-5053-5670',
  '서울특별시 관악구 인헌길 148 (봉천동) 403호', '관악구',
  '최대한 빠르게 부탁드려요. 감사합니다!', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
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
  '{"item_code": "YS-260516-175", "external_item_no": "2026051653733231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-175' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [132] order_no=2026051615431951, task_no=YS-260516-174, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-174', '2026051615431951',
  '조수혁', '010-4669-5839',
  '경기도 구리시 벌말로147번길 51 (토평동) 305호', '구리시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 18:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-174", "external_item_no": "2026051653763731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-174' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [133] order_no=2026051615813711, task_no=YS-260516-173, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-173', '2026051615813711',
  '김혜원', '010-9279-9967',
  '서울특별시 영등포구 신길로42길 14-1 (신길동) 2층', '영등포구',
  '최대한 빨리 부탁드려영❤', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
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
  '{"item_code": "YS-260516-173", "external_item_no": "2026051654312891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-173' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [134] order_no=2026051616414441, task_no=YS-260516-170, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-170', '2026051616414441',
  '장현우', '010-2707-7803',
  '서울특별시 양천구 목동중앙본로29길 26-14 (목동, 우남파크빌) 402호', '양천구',
  '최대한 빠르게 부탁드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 19:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-170", "external_item_no": "2026051655191991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-170' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [135] order_no=2026051616714701, task_no=YS-260516-168, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-168', '2026051616714701',
  '박정훈', '010-4704-1346',
  '서울특별시 마포구 백범로37길 6 (신공덕동, 신공덕1차삼성래미안아파트) 112동 207호', '마포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 11:00:00+09:00', NULL,
  10000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-168", "external_item_no": "2026051655641951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-168' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [136] order_no=2026051616752331, task_no=YS-260516-167, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-167', '2026051616752331',
  '김수경', '010-4271-2212',
  '서울특별시 송파구 문정로4길 24-11 (문정동) 202호', '송파구',
  '송파구 문정동입니다. 
 벽걸이에어컨 꿉꿉한 냄새가 나서 송풍팬까지 세척해서 청소 희망합니다. 가급적 빠른 일자 희망합니다^^ (평일 7:30이후도 가능한지 문의)', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 08:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-167", "external_item_no": "2026051655694031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-167' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-166", "external_item_no": "2026051655694041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-167' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [137] order_no=2026051617163501, task_no=YS-260516-163, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-163', '2026051617163501',
  '변준아', '010-4653-8685',
  '서울특별시 광진구 군자로 173-4 (군자동) 3층옥탑방', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 14:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-163", "external_item_no": "2026051656309461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-163' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [138] order_no=2026051612892641, task_no=YS-260516-161, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-161', '2026051612892641',
  '강예지', '010-2923-9779',
  '서울특별시 서초구 매헌로14길 25 (양재동, 준영빌라) 302호', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 16:30:00+09:00', NULL,
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
  '{"item_code": "YS-260516-161", "external_item_no": "2026051650190061"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-161' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [139] order_no=2026051612970951, task_no=YS-260516-160, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-160', '2026051612970951',
  '장보연', '010-7242-4782',
  '서울특별시 성북구 고려대로17가길 37-1 (안암동2가) 단독주택', '성북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-31 15:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-160", "external_item_no": "2026051650298261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-160' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [140] order_no=2026051613026091, task_no=YS-260516-159, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-159', '2026051613026091',
  '최루리', '010-9919-5922',
  '서울특별시 도봉구 도봉로137길 25-11 (쌍문동) Sg블루빌 201호', '도봉구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 13:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-159", "external_item_no": "2026051650374461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-159' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-158", "external_item_no": "2026051650374471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-159' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [141] order_no=2026051613155131, task_no=YS-260516-157, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-157', '2026051613155131',
  '갈시아', '010-9810-3249',
  '서울특별시 동대문구 망우로 28 (휘경동) 502호', '동대문구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 11:00:00+09:00', NULL,
  73900, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-157", "external_item_no": "2026051650556831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-157' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [142] order_no=2026051694448691, task_no=YS-260516-156, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-156', '2026051694448691',
  '이준기', '010-3490-1681',
  '서울특별시 양천구 오목로50길 32 (신정동) 202호', '양천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:30:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-156", "external_item_no": "2026051638391941"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-156' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-155", "external_item_no": "2026051638391951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-156' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [143] order_no=2026051694587611, task_no=YS-260516-154, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-154', '2026051694587611',
  '김라희', '010-9787-5279',
  '서울특별시 송파구 백제고분로28길 23-16 (삼전동, 어반하임) A동 404호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 11:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-154", "external_item_no": "2026051638590411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-154' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [144] order_no=2026051696621571, task_no=YS-260516-153, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-153', '2026051696621571',
  '김예영', '010-8217-4292',
  '서울특별시 영등포구 버드나루로15길 9 (당산동, 신현빌5차) 205호', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
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
  '{"item_code": "YS-260516-153", "external_item_no": "2026051641417191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-153' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [145] order_no=2026051696715081, task_no=YS-260516-152, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-152', '2026051696715081',
  '강지혜', '010-8948-0021',
  '서울특별시 강서구 강서로33길 65 (화곡동, DH팰리스) 502호', '강서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 18:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-152", "external_item_no": "2026051641545921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-152' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [146] order_no=2026051696882561, task_no=YS-260516-151, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-151', '2026051696882561',
  '이건희', '010-5265-6210',
  '서울특별시 관악구 남부순환로180길 9 (신림동, 건우빌딩) 503호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
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
  '{"item_code": "YS-260516-151", "external_item_no": "2026051641775611"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-151' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [147] order_no=2026051697699061, task_no=YS-260516-150, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-150', '2026051697699061',
  '임형수', '010-6405-6977',
  '서울특별시 강남구 테헤란로13길 47-7 (역삼동) 3층', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 17:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-150", "external_item_no": "2026051642918951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-150' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [148] order_no=2026051698329681, task_no=YS-260516-149, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-149', '2026051698329681',
  '지진우', '010-9765-1947',
  '서울특별시 관악구 인헌3가길 13-9 (봉천동) 102호(대문정면계단 위 문앞)', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  115500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-149", "external_item_no": "2026051643791201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-149' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [149] order_no=2026051698498461, task_no=YS-260516-148, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-148', '2026051698498461',
  '김민경', '010-9157-8115',
  '서울특별시 서대문구 통일로35길 14-4 (홍제동) (제니스 오피스텔 512호)', '서대문구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 12:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-148", "external_item_no": "2026051644027281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-148' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [150] order_no=2026051610078131, task_no=YS-260516-147, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-147', '2026051610078131',
  '박성삼', '010-8415-6737',
  '서울특별시 광진구 동일로18가길 32 (자양동, 리베르떼 리버) 303호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 12:15:00+09:00', NULL,
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
  '{"item_code": "YS-260516-147", "external_item_no": "2026051646253191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-147' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [151] order_no=2026051610374811, task_no=YS-260516-146, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-146', '2026051610374811',
  '김은석', '010-4850-2912',
  '서울특별시 강서구 화곡로35길 23-7 (화곡동, 서우에코빌) 203호', '강서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 18:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-146", "external_item_no": "2026051646668801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-146' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [152] order_no=2026051610557281, task_no=YS-260516-145, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-145', '2026051610557281',
  '김규태', '010-5420-0731',
  '서울특별시 용산구 원효로77가길 4 (원효로1가) 2층 204호', '용산구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 09:15:00+09:00', NULL,
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
  '{"item_code": "YS-260516-145", "external_item_no": "2026051646921641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-145' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [153] order_no=2026051610599661, task_no=YS-260516-144, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-144', '2026051610599661',
  '신현식', '010-5384-5119',
  '서울특별시 은평구 통일로 850 (불광동, 연서시장) 2층 201호 금강보청기 은평센터', '은평구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 15:30:00+09:00', NULL,
  85000, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-144", "external_item_no": "2026051646980941"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-144' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [154] order_no=2026051610919801, task_no=YS-260516-143, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-143', '2026051610919801',
  '김해림', '010-2780-7963',
  '경기도 의정부시 흥선로5번길 43 (가능동) 베네스트파크 1003호', '의정부시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 14:00:00+09:00', NULL,
  89900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-143", "external_item_no": "2026051647429221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-143' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [155] order_no=2026051611034151, task_no=YS-260516-142, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-142', '2026051611034151',
  '강태윤', '010-2884-4319',
  '서울특별시 광진구 뚝섬로58길 101 (자양동, 자양현대3차아파트) 302동 101호', '광진구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 11:15:00+09:00', NULL,
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
  '{"item_code": "YS-260516-142", "external_item_no": "2026051647589411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-142' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [156] order_no=2026051611138161, task_no=YS-260516-141, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-141', '2026051611138161',
  '김민경', '0502-2860-7132',
  '서울특별시 금천구 시흥대로101길 3-18 (독산동, 철매아파트) 102동 403호', '금천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 12:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-141", "external_item_no": "2026051647735351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-141' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [157] order_no=2026051611323101, task_no=YS-260516-140, channel=네이버, items=5
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-140', '2026051611323101',
  '유재위', '010-5306-1220',
  '서울특별시 강서구 등촌로39길 63-39 (등촌동, 다비맨션) 201호', '강서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 16:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-140", "external_item_no": "2026051647998871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-140' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-139", "external_item_no": "2026051647998881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-140' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-138", "external_item_no": "2026051647998891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-140' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-137", "external_item_no": "2026051647998901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-140' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-136", "external_item_no": "2026051647998911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-140' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [158] order_no=2026051611391331, task_no=YS-260516-135, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-135', '2026051611391331',
  '김기록', '010-4416-0910',
  '서울특별시 중랑구 봉우재로37가길 13 (상봉동, 대영리치빌) 602호', '중랑구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  89900, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-135", "external_item_no": "2026051648097151"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-135' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [159] order_no=2026051611452911, task_no=YS-260516-134, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-134', '2026051611452911',
  '조헌준', '010-7724-8781',
  '경기도 구리시 건원대로34번길 77 (인창동, 인창6단지주공아파트) 602동 1206호', '구리시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 09:00:00+09:00', NULL,
  119000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-134", "external_item_no": "2026051648183451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-134' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [160] order_no=2026051611627281, task_no=YS-260516-133, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-133', '2026051611627281',
  '이성민', '010-7799-6922',
  '서울특별시 송파구 오금로15길 7-12 (방이동, 초원하우스) 201호', '송파구',
  '1층 1255', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 07:00:00+09:00', NULL,
  73900, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-133", "external_item_no": "2026051648425021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-133' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-132", "external_item_no": "2026051648425031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-133' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-131", "external_item_no": "2026051648425041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-133' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [161] order_no=2026051611661651, task_no=YS-260516-130, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-130', '2026051611661651',
  '허은진', '010-5263-8123',
  '서울특별시 영등포구 선유동2로 29 (양평동3가, 현대2차아파트) 203동 408호', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  116100, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-130", "external_item_no": "2026051648472831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-130' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-129", "external_item_no": "2026051648472841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-130' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [162] order_no=2026051611791031, task_no=YS-260516-128, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-128', '2026051611791031',
  '나소정', '010-4101-1271',
  '서울특별시 관악구 신림로 285 (신림동, 동방빌딩) 501호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260516-128", "external_item_no": "2026051648651681"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-128' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-127", "external_item_no": "2026051648651691"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-128' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [163] order_no=2026051611939651, task_no=YS-260516-126, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-126', '2026051611939651',
  '김소연', '010-4194-8268',
  '서울특별시 중랑구 면목로 490 (상봉동, 상봉타워) 상봉타워 1702호', '중랑구',
  '최대한 빠른 시일내에 부탁드립니다ㅠㅠ!', '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
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
  '{"item_code": "YS-260516-126", "external_item_no": "2026051648860791"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-126' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [164] order_no=2026051612021451, task_no=YS-260516-125, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-125', '2026051612021451',
  '한아영', '010-3545-2810',
  '서울특별시 강서구 공항대로 195 (마곡동, 힐스테이트에코동익) 101동1424호', '강서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 16:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-125", "external_item_no": "2026051648979211"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-125' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [165] order_no=2026051612077321, task_no=YS-260516-124, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-124', '2026051612077321',
  '김태연', '010-4131-3573',
  '서울특별시 서초구 논현로31길 65 (양재동, 비버리하임(2단지)) 105동 201호', '서초구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 10:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-124", "external_item_no": "2026051649054301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-124' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [166] order_no=2026051612333101, task_no=YS-260516-123, channel=네이버, items=3
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

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-123", "external_item_no": "2026051649413811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-123' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-122", "external_item_no": "2026051649413821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-123' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-121", "external_item_no": "2026051649413831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-123' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [167] order_no=2026051612477211, task_no=YS-260516-120, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-120', '2026051612477211',
  '김서현', '010-7653-9683',
  '서울특별시 중구 퇴계로 248 (묵정동) 충무로역스위트엠 702호', '중구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 13:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-120", "external_item_no": "2026051649613651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-120' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [168] order_no=2026051612488061, task_no=YS-260516-119, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-119', '2026051612488061',
  '독고윤', '010-3942-5957',
  '서울특별시 송파구 백제고분로48길 18 (방이동, 진성빌딩) 403호', '송파구',
  '벨 누르지말고 문앞에놔주세요벨누르지말고 문앞에놔주세요벨 누르지말고 문앞에놔주세요벨 누르지말고 문앞에놔주세요벨누르지말고 문앞에놔주세요벨 누르지말고 문앞에놔주세요', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 11:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-119", "external_item_no": "2026051649628551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-119' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [169] order_no=2026051697858111, task_no=YS-260516-118, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-118', '2026051697858111',
  '형민우', '010-4779-5456',
  '서울특별시 동작구 상도로60길 1 (상도동) 알파건물 4층 401호', '동작구',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 12:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-118", "external_item_no": "2026051643137391"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-118' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-117", "external_item_no": "2026051643137401"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-118' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [170] order_no=2026051698147161, task_no=YS-260516-116, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-116', '2026051698147161',
  '김진산', '010-4165-1779',
  '서울특별시 강남구 선릉로100길 42 (삼성동, LG선릉에클라트) A동 610호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 16:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-116", "external_item_no": "2026051643539271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-116' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-115", "external_item_no": "2026051643539281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-116' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [171] order_no=2026051698612691, task_no=YS-260516-114, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-114', '2026051698612691',
  '배다솜', '010-8839-9794',
  '서울특별시 강남구 도산대로78길 34 (청담동, 리더스빌) 301호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 04:15:00+09:00', NULL,
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
  '{"item_code": "YS-260516-114", "external_item_no": "2026051644185541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-114' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [172] order_no=2026051698691321, task_no=YS-260516-113, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-113', '2026051698691321',
  '박새롬', '010-7774-1309',
  '서울특별시 관악구 복은길 58-19 (신림동, 서린빌) 302호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 18:00:00+09:00', NULL,
  63180, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-113", "external_item_no": "2026051644294901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-113' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [173] order_no=2026051698957371, task_no=YS-260516-112, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-112', '2026051698957371',
  '변영식', '010-2409-9359',
  '서울특별시 영등포구 당산로41길 23 (당산동4가, 당산현대아파트) 106동 1004호', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  116100, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-112", "external_item_no": "2026051644673251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-112' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-111", "external_item_no": "2026051644673261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-112' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [174] order_no=2026051699844731, task_no=YS-260516-110, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-110', '2026051699844731',
  '이한겸', '010-7635-7247',
  '서울특별시 송파구 백제고분로41길 24 (송파동, 덕성빌딩) 502호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 11:00:00+09:00', NULL,
  73900, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-110", "external_item_no": "2026051645923191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-110' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [175] order_no=2026051610001881, task_no=YS-260516-109, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-109', '2026051610001881',
  '김희선', '010-6717-4678',
  '서울특별시 구로구 고척로21다길 34-12 (개봉동, 대동하이츠빌라) B동102호', '구로구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:30:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-109", "external_item_no": "2026051646145791"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-109' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [176] order_no=2026051694181941, task_no=YS-260516-108, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-108', '2026051694181941',
  '노혜수', '010-8889-7203',
  '서울특별시 성동구 난계로 100 (하왕십리동, 왕십리자이) 103동805호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  116100, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-108", "external_item_no": "2026051638017781"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-108' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-107", "external_item_no": "2026051638017791"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-108' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-106", "external_item_no": "2026051638017801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-108' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [177] order_no=2026051694335871, task_no=YS-260516-105, channel=네이버, items=1
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
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 19:00:00+09:00', NULL,
  100000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=2way / qty=1.0 → work_type=NULL / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  NULL,
  NULL,
  '{"item_code": "YS-260516-105", "external_item_no": "2026051638232001", "raw_service": "사무실 에어컨청소", "raw_appliance": "2way"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-105' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [178] order_no=2026051694374941, task_no=YS-260516-104, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-104', '2026051694374941',
  '이정민', '010-4503-4631',
  '서울특별시 중랑구 면목로55가길 5 (면목동, 효원캐스빌) 502호', '중랑구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
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
  '{"item_code": "YS-260516-104", "external_item_no": "2026051638287101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-104' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [179] order_no=2026051694392981, task_no=YS-260516-103, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-103', '2026051694392981',
  '노소영', '010-4818-4015',
  '경기도 하남시 감일백제로 35 (감이동, 감일스윗시티14단지) 1401동 1304호', '하남시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 23:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-103", "external_item_no": "2026051638313251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-103' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-102", "external_item_no": "2026051638313261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-103' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [180] order_no=2026051694719311, task_no=YS-260516-101, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-101', '2026051694719311',
  '이새별', '010-2001-2460',
  '서울특별시 관악구 장군봉13길 14 (봉천동, 관악중앙하이츠포레) 101동 102호', '관악구',
  '빠르게 일정 부탁드리며, 송풍팬 분해 가능여부 확인 후 현장서 결제하겠습니다.', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  167500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-101", "external_item_no": "2026051638774121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-101' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [181] order_no=2026051695062381, task_no=YS-260516-096, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-096', '2026051695062381',
  '윤주근', '010-7134-5045',
  '서울특별시 구로구 오리로21가길 23-18 (궁동, 궁골별장빌) 궁골빌라 401호', '구로구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:30:00+09:00', NULL,
  71000, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-096", "external_item_no": "2026051639245091"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-096' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-095", "external_item_no": "2026051639245101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-096' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-094", "external_item_no": "2026051639245111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-096' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [182] order_no=2026051695118121, task_no=YS-260516-091, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-091', '2026051695118121',
  '송지혜', '010-9514-0530',
  '경기도 구리시 동구릉로238번길 20 (인창동, 한진아파트) 103동 2305호', '구리시',
  '빠른 일정 조율 부탁 드립니다!', '확정',
  '77777777-7777-7777-7777-7777777e0007',
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
  '{"item_code": "YS-260516-091", "external_item_no": "2026051639321201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-091' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [183] order_no=2026051695894981, task_no=YS-260516-090, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-090', '2026051695894981',
  '황민지', '010-7654-7065',
  '서울특별시 광진구 능동로37길 6 (중곡동) 603호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  89900, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-090", "external_item_no": "2026051640403891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-090' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [184] order_no=2026051696193411, task_no=YS-260516-089, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-089', '2026051696193411',
  '김은정', '010-6698-6561',
  '서울특별시 성동구 무학봉길 35 (하왕십리동, 왕십리KCC스위첸) 103동505호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  115500, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-089", "external_item_no": "2026051640818441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-089' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [185] order_no=2026051696196231, task_no=YS-260516-088, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-088', '2026051696196231',
  '박경주', '010-2997-6458',
  '서울특별시 강남구 개포로138길 21 (일원동) 701호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 17:00:00+09:00', NULL,
  69400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-088", "external_item_no": "2026051640822201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-088' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [186] order_no=2026051696311331, task_no=YS-260516-087, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-087', '2026051696311331',
  '김유영', '010-3278-2290',
  '서울특별시 도봉구 도봉로180길 6-23 (도봉동, 동아에코빌아파트) 101동1202호', '도봉구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  70400, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-087", "external_item_no": "2026051640983951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-087' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [187] order_no=2026051696350201, task_no=YS-260516-086, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-086', '2026051696350201',
  '이아루', '0502-2858-1548',
  '서울특별시 강서구 강서로 47-6 (화곡동, 삼보빌딩) 403호', '강서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 09:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-086", "external_item_no": "2026051641038441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-086' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [188] order_no=2026051696353651, task_no=YS-260516-085, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-085', '2026051696353651',
  '김나영', '010-2579-9525',
  '서울특별시 동작구 노량진로14길 35-8 (노량진동) 503호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 16:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-085", "external_item_no": "2026051641043871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-085' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [189] order_no=2026051696366241, task_no=YS-260516-084, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-084', '2026051696366241',
  '이지현', '010-3726-7291',
  '서울특별시 영등포구 도영로7길 7 (도림동, 도림청구아파트) 101동 1305호', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 17:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-084", "external_item_no": "2026051641061521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-084' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [190] order_no=2026051696451601, task_no=YS-260516-083, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-083', '2026051696451601',
  '박종호', '010-3374-4242',
  '서울특별시 서대문구 통일로39다길 38 (홍제동) 3층', '서대문구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 11:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-083", "external_item_no": "2026051641179841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-083' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-082", "external_item_no": "2026051641179851"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-083' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [191] order_no=2026051696512111, task_no=YS-260516-081, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-081', '2026051696512111',
  '기하윤', '010-2053-1134',
  '서울특별시 광진구 천호대로110길 109 (능동, 다우하우스) 402호', '광진구',
  '최대한빠르게부탁드려요', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 22:00:00+09:00', NULL,
  89900, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-081", "external_item_no": "2026051641265101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-081' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [192] order_no=2026051696742851, task_no=YS-260516-080, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-080', '2026051696742851',
  '오민주', '010-9342-4068',
  '서울특별시 서초구 잠원로3길 20 (잠원동, 잠원2차 중앙하이츠아파트) B동 208호', '서초구',
  '5/23 24 원하십니다', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  116100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-080", "external_item_no": "2026051641584801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-080' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-079", "external_item_no": "2026051641584811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-080' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [193] order_no=2026051697000201, task_no=YS-260516-078, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-078', '2026051697000201',
  '박영미', '010-3239-0824',
  '서울특별시 송파구 송파대로43길 20 (석촌동, 트윈캐슬 B동) 501호', '송파구',
  '가장빠른 일정 언제될까요?? 
 이전 청소때 다른곳에서 벽이랑 가구에 오염되었어서 오염없이 잘 부탁드려요 ㅠㅠ', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 11:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-078", "external_item_no": "2026051641936341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-078' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [194] order_no=2026051697222391, task_no=YS-260516-077, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-077', '2026051697222391',
  '임세경', '010-2721-3235',
  '서울특별시 용산구 효창원로 227 (효창동, 용산 데시앙 포레) 102동 203호', '용산구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 10:00:00+09:00', NULL,
  344500, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=4.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 4, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-077", "external_item_no": "2026051642248751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-077' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [195] order_no=2026051697434781, task_no=YS-260516-076, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-076', '2026051697434781',
  '이경일', '010-2248-3217',
  '서울특별시 강남구 광평로34길 55 (수서동, 강남데시앙포레아파트) 107동 102호', '강남구',
  '최대한 빠르게 부탁드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 15:00:00+09:00', NULL,
  67500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-076", "external_item_no": "2026051642546341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-075", "external_item_no": "2026051642546351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-074", "external_item_no": "2026051642546361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-073", "external_item_no": "2026051642546371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [196] order_no=2026051610062131, task_no=YS-260516-068, channel=네이버, items=5
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-068', '2026051610062131',
  '김윤서', '010-4580-6479',
  '서울특별시 은평구 통일로 1030 (진관동, 은평헤스티아) 907호', '은평구',
  '방문 전에 미리 연락 주세요!', '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 13:30:00+09:00', '2026-05-18 00:00:00+09:00',
  89900, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-068", "external_item_no": "2026051646229981"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-068' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-067", "external_item_no": "2026051646229991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-068' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-066", "external_item_no": "2026051646230001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-068' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-065", "external_item_no": "2026051646230011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-068' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-064", "external_item_no": "2026051646230021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-068' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [197] order_no=2026051581887711, task_no=YS-260516-060, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-060', '2026051581887711',
  '김수현', '010-9865-1238',
  '서울특별시 마포구 신촌로 160 (대흥동, 이대역스타힐스) 905호', '마포구',
  '최대한 빠르게 부탁드립니다', '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 09:30:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-060", "external_item_no": "2026051520092391"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-060' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [198] order_no=2026051581911201, task_no=YS-260516-059, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-059', '2026051581911201',
  '김세현', '010-8126-7997',
  '경기도 구리시 인창2로43번길 54 (인창동) 302호', '구리시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 09:00:00+09:00', NULL,
  73900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-059", "external_item_no": "2026051520125421"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-059' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [199] order_no=2026051582146671, task_no=YS-260516-058, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-058', '2026051582146671',
  '미소빌', '010-4679-3113',
  '서울특별시 서초구 강남대로6길 134-12 (양재동, 미소빌리지) 201호', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 13:00:00+09:00', '2026-05-18 00:00:00+09:00',
  209500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=3.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-058", "external_item_no": "2026051520464811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-058' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [200] order_no=2026051582718541, task_no=YS-260516-057, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-057', '2026051582718541',
  '서지원', '010-5661-0258',
  '서울특별시 중구 마른내로 79 (인현동2가, 세운 푸르지오 헤리시티) 1702호', '중구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 10:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-057", "external_item_no": "2026051521280901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-057' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [201] order_no=2026051582984021, task_no=YS-260516-056, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-056', '2026051582984021',
  '오동필', '010-9865-9429',
  '서울특별시 강서구 마곡서1로 132 (마곡동, 마곡엠밸리3단지) 302동 1504호', '강서구',
  '일정이 빠듯해서 이번주 일요일 방문 일정이 가능할까요...??
 010-9865-9429 로 언제든 연락주시면 감사하겠습니다!', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 08:00:00+09:00', '2026-05-18 00:00:00+09:00',
  435000, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=5.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 5, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-056", "external_item_no": "2026051521651951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-056' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-055", "external_item_no": "2026051521651961"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-056' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-054", "external_item_no": "2026051521651971"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-056' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [202] order_no=2026051583322901, task_no=YS-260516-053, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-053', '2026051583322901',
  '최재훈', '010-6373-5455',
  '서울특별시 마포구 광성로6길 68 (대흥동) 201호', '마포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0003',
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
  '{"item_code": "YS-260516-053", "external_item_no": "2026051522122841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-053' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [203] order_no=2026051583594921, task_no=YS-260516-052, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-052', '2026051583594921',
  '김자옥', '010-7121-1361',
  '서울특별시 용산구 장문로 18 (동빙고동) 유진막국수', '용산구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 23:00:00+09:00', NULL,
  78600, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-052", "external_item_no": "2026051522507161"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=2.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-051", "external_item_no": "2026051522507171"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [204] order_no=2026051584013931, task_no=YS-260516-047, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-047', '2026051584013931',
  '박애련', '010-2907-1674',
  '서울특별시 동작구 국사봉1길 43-4 (상도동) 루체포레 703호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260516-047", "external_item_no": "2026051523101651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-047' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-046", "external_item_no": "2026051523101661"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-047' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [205] order_no=2026051584039801, task_no=YS-260516-045, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-045', '2026051584039801',
  '박길현', '010-9198-4298',
  '경기도 구리시 동구릉로53번길 42 (인창동, 동원베네스트) 107동 1701호', '구리시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 12:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-045", "external_item_no": "2026051523137811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-045' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-044", "external_item_no": "2026051523137821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-045' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [206] order_no=2026051584180841, task_no=YS-260516-043, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-043', '2026051584180841',
  '진재방', '010-8561-7833',
  '서울특별시 강남구 개포로109길 5 (개포동, 대치아파트) 107-1307', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 11:30:00+09:00', '2026-05-18 00:00:00+09:00',
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
  '{"item_code": "YS-260516-043", "external_item_no": "2026051523334931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-043' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [207] order_no=2026051584435231, task_no=YS-260516-042, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-042', '2026051584435231',
  '정소연', '010-9422-8058',
  '서울특별시 영등포구 의사당대로 26 (여의도동, 더하우스 소호 여의도 오피스텔) 1308호', '영등포구',
  '5.23 토요일에 부탁드려요', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260516-042", "external_item_no": "2026051523693251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [208] order_no=2026051584673291, task_no=YS-260516-041, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-041', '2026051584673291',
  '조규범', '010-3336-3789',
  '서울특별시 관악구 조원로 25 (신림동) 힐스테이트뉴포레 106동 2105호', '관악구',
  '5월22일 금요일 오전 1순위로 희망합니다.', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 17:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-041", "external_item_no": "2026051524026991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [209] order_no=2026051585136971, task_no=YS-260516-040, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-040', '2026051585136971',
  '조윤주', '010-5183-5779',
  '서울특별시 송파구 오금로34길 24 (가락동, 화이트빌) 401호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 11:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-040", "external_item_no": "2026051524697551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-040' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [210] order_no=2026051585449811, task_no=YS-260516-039, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-039', '2026051585449811',
  '구무정', '010-2792-3511',
  '서울특별시 광진구 아차산로55길 57-3 (구의동, 장원캐슬) 504호', '광진구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 10:15:00+09:00', NULL,
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
  '{"item_code": "YS-260516-039", "external_item_no": "2026051525146871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [211] order_no=2026051585454441, task_no=YS-260516-038, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-038', '2026051585454441',
  '전금영', '010-2087-3806',
  '서울특별시 광진구 광나루로39길 11 (구의동, 구의자이르네) 101동 709호', '광진구',
  'B동 엘베 : 열쇠 0378', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  63340, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=대형실외기 / qty=1.0 → work_type=NULL / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  NULL,
  NULL,
  '{"item_code": "YS-260516-038", "external_item_no": "2026051525153751", "raw_service": "가정집 에어컨청소", "raw_appliance": "대형실외기"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-037", "external_item_no": "2026051525153761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-036", "external_item_no": "2026051525153771"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [212] order_no=2026051585871861, task_no=YS-260516-035, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-035', '2026051585871861',
  '김경란', '010-9244-2620',
  '서울특별시 관악구 봉천로13나길 60 (봉천동) 402호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  115500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-035", "external_item_no": "2026051525767361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [213] order_no=2026051586038141, task_no=YS-260516-034, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-034', '2026051586038141',
  '김세훈', '010-6515-1245',
  '서울특별시 금천구 시흥대로134길 59 (독산동) 2층', '금천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 09:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-034", "external_item_no": "2026051526015291"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-033", "external_item_no": "2026051526015301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [214] order_no=2026051586335411, task_no=YS-260516-032, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-032', '2026051586335411',
  'KOHJAEKUN', '010-8742-6445',
  '서울특별시 송파구 올림픽로 99 (잠실동, 잠실엘스) 169동 302호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 05:00:00+09:00', NULL,
  142000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-032", "external_item_no": "2026051526460491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-031", "external_item_no": "2026051526460501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [215] order_no=2026051587005811, task_no=YS-260516-028, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-028', '2026051587005811',
  '최유선', '010-5552-2982',
  '서울특별시 송파구 문정로17길 9 (오금동, 유진빌라트) 501호', '송파구',
  '빠르게 부탁드립니다.', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 01:00:00+09:00', NULL,
  142000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-028", "external_item_no": "2026051527481421"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-027", "external_item_no": "2026051527481431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=2.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-026", "external_item_no": "2026051527481441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [216] order_no=2026051587100681, task_no=YS-260516-025, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-025', '2026051587100681',
  '엔트라움', '010-8386-8998',
  '서울특별시 강남구 언주로69길 23-4 (역삼동, 엔 트라움) A동 601호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 13:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-025", "external_item_no": "2026051527624261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=2.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-024", "external_item_no": "2026051527624271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [217] order_no=2026051587441021, task_no=YS-260516-023, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-023', '2026051587441021',
  '조용현', '010-3063-0130',
  '서울특별시 광진구 동일로24길 18-7 (화양동) B103', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260516-023", "external_item_no": "2026051528136671"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-022", "external_item_no": "2026051528136681"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-021", "external_item_no": "2026051528136691"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [218] order_no=2026051588260311, task_no=YS-260516-018, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-018', '2026051588260311',
  '백승민', '010-5554-6338',
  '서울특별시 동대문구 고산자로56길 42-1 (제기동) 2층 202호', '동대문구',
  '일요일에 청소 받고자 합니다~ 연락주세요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 18:40:00+09:00', '2026-05-16 00:00:00+09:00',
  73900, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-018", "external_item_no": "2026051529416251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [219] order_no=2026051588653951, task_no=YS-260516-017, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-017', '2026051588653951',
  '정윤정', '010-3475-0511',
  '서울특별시 강남구 도곡로63길 28 (대치동) 302호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 17:00:00+09:00', NULL,
  119000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-017", "external_item_no": "2026051530041891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [220] order_no=2026051588710191, task_no=YS-260516-016, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-016', '2026051588710191',
  '윤환', '010-5296-4028',
  '서울특별시 금천구 독산로41가길 14 (시흥동, Dream House) 402호', '금천구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 06:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-016", "external_item_no": "2026051530126361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [221] order_no=2026051588876981, task_no=YS-260516-015, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-015', '2026051588876981',
  '옹예주', '010-7506-3675',
  '서울특별시 광진구 아차산로53길 28-10 (구의동) 101호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 15:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-015", "external_item_no": "2026051530375721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [222] order_no=2026051689479211, task_no=YS-260516-014, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-014', '2026051689479211',
  '황동현', '010-4937-5972',
  '서울특별시 광진구 능동로24길 49 (능동, 능마루주택) 101호', '광진구',
  '계단 올라오시면 101호 있습니다! 문앞에 놓아주세요!', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 13:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-014", "external_item_no": "2026051631286441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [223] order_no=2026051690011471, task_no=YS-260516-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-013', '2026051690011471',
  '지성혜', '010-8937-8503',
  '서울특별시 관악구 호암로24가길 31 (신림동) 도희스테이 211호', '관악구',
  '2431* 공동현관 오른쪽 선반 위 택배보관 장소에 놓아주세요.', '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 13:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-013", "external_item_no": "2026051632077261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [224] order_no=2026051690163471, task_no=YS-260516-012, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-012', '2026051690163471',
  '김문수', '010-5152-2513',
  '서울특별시 중랑구 상봉중앙로1가길 8 (상봉동, 리더스타운) 304호', '중랑구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 09:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-012", "external_item_no": "2026051632307181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [225] order_no=2026051690049841, task_no=YS-260516-011, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-011', '2026051690049841',
  '이덕희', '010-5968-0229',
  '서울특별시 송파구 위례성대로2길 14 (방이동, 잠실 소프라우스 오피스텔) 508호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:00:00+09:00', NULL,
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
  '{"item_code": "YS-260516-011", "external_item_no": "2026051632133891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-010", "external_item_no": "2026051632133901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [226] order_no=2026051691338851, task_no=YS-260516-009, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-009', '2026051691338851',
  '이소희', '010-4782-0630',
  '서울특별시 관악구 남부순환로 1755 (봉천동, YK서울대) 803호', '관악구',
  '6월 주말 중 빠른 일정 원합니다 ~', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260516-009", "external_item_no": "2026051634032811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [227] order_no=2026051691543891, task_no=YS-260516-008, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-008', '2026051691543891',
  '김수진', '010-4124-6474',
  '서울특별시 구로구 신도림로 16 (신도림동, 신도림 대림아파트) 302동 904호', '구로구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 12:00:00+09:00', NULL,
  67500, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-008", "external_item_no": "2026051634320071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-007", "external_item_no": "2026051634320081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [228] order_no=2026051691879561, task_no=YS-260516-006, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-006', '2026051691879561',
  '김태호', '010-3790-3973',
  '서울특별시 동작구 성대로11길 6 (상도동) 지층 102호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  119000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-006", "external_item_no": "2026051634790491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-005", "external_item_no": "2026051634790501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [229] order_no=2026051692063831, task_no=YS-260516-004, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-004', '2026051692063831',
  '김범중', '010-6400-4965',
  '서울특별시 동대문구 한천로58길 181 (이문동, 이문2차푸르지오) 201동 701호', '동대문구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0020',
  NULL, NULL,
  119000, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-004", "external_item_no": "2026051635044931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [230] order_no=2026051692085321, task_no=YS-260516-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-003', '2026051692085321',
  '고난영', '010-8570-0785',
  '서울특별시 강북구 오현로 45 (미아동) 꿈의숲 효성 해링턴플레이스 102동 201호', '강북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 14:00:00+09:00', NULL,
  170500, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260516-003", "external_item_no": "2026051635073921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [231] order_no=2026051692110211, task_no=YS-260516-002, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260516-002', '2026051692110211',
  '김소영', '010-3641-5344',
  '서울특별시 동작구 사당로4길 11-3 (사당동) 301호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260516-002", "external_item_no": "2026051635108431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260516-001", "external_item_no": "2026051635108441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260516-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [232] order_no=2026051461181931, task_no=YS-260515-117, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-117', '2026051461181931',
  '임성준', '010-3774-0473',
  '서울특별시 강동구 진황도로31길 26 (천호동, 성원아파트) 305호', '강동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 15:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-117", "external_item_no": "2026051479207011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-117' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-039", "external_item_no": "2026051479207021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-117' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [233] order_no=2026051570191961, task_no=YS-260515-116, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-116', '2026051570191961',
  '조진흥', '010-4517-5024',
  '서울특별시 서초구 서운로 194 (서초동, 두산위브트레지움아파트) 101동 805호', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 14:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-116", "external_item_no": "2026051592806781"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-116' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-065", "external_item_no": "2026051592806771"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-116' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [234] order_no=2026051581520841, task_no=YS-260515-111, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-111', '2026051581520841',
  '이현', '010-6331-2012',
  '경기도 양주시 백석읍 꿈나무로 298 (백석읍, 세아청솔아파트) 303동 1309호', '양주시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 14:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-111", "external_item_no": "2026051519563481"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-111' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-110", "external_item_no": "2026051519563491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-111' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-109", "external_item_no": "2026051519563501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-111' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [235] order_no=2026051579222661, task_no=YS-260515-108, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-108', '2026051579222661',
  '최수정', '010-6555-9512',
  '서울특별시 노원구 중계로 233 (중계동, 청구3차아파트) 107동 206호', '노원구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 10:00:00+09:00', NULL,
  142000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-108", "external_item_no": "2026051516245141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-108' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-107", "external_item_no": "2026051516245151"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-108' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [236] order_no=2026051578935431, task_no=YS-260515-106, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-106', '2026051578935431',
  '김혜진', '010-4585-1809',
  '서울특별시 서초구 방배천로18길 11 (방배동, 방배롯데캐슬아르떼) 106동302호', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 09:00:00+09:00', NULL,
  169500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-106", "external_item_no": "2026051515823541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-106' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [237] order_no=2026051580498051, task_no=YS-260515-105, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-105', '2026051580498051',
  '임준병', '010-9199-4408',
  '서울특별시 광진구 긴고랑로31길 18 (중곡동, 평강온새미로) 502호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 09:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-105", "external_item_no": "2026051518086881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-105' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [238] order_no=2026051580545351, task_no=YS-260515-104, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-104', '2026051580545351',
  '이우찬', '010-4342-3494',
  '서울특별시 강남구 테헤란로13길 22-9 (역삼동, 공간9차) 201호', '강남구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 14:00:00+09:00', '2026-05-16 00:00:00+09:00',
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
  '{"item_code": "YS-260515-104", "external_item_no": "2026051518154891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-104' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [239] order_no=2026051580701841, task_no=YS-260515-103, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-103', '2026051580701841',
  '유지훈', '010-5593-0630',
  '서울특별시 영등포구 양평로12가길 14 (양평동4가, 르네상스 한강 오피스텔) 1403호', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 15:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-103", "external_item_no": "2026051518378841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-103' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [240] order_no=2026051580750261, task_no=YS-260515-102, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-102', '2026051580750261',
  '박혜민', '010-5815-5879',
  '서울특별시 금천구 독산로 344-1 (독산동, 메트로시티) 401호', '금천구',
  '24년에 여기서 진행했었던 기고객입니다', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 17:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-102", "external_item_no": "2026051518448371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-102' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [241] order_no=2026051580860851, task_no=YS-260515-101, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-101', '2026051580860851',
  '박예진', '010-4065-5493',
  '서울특별시 마포구 동교로30길 17-1 (동교동, 빌딩 이카토) 3층 블루메네일 blume nail', '마포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 17:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-101", "external_item_no": "2026051518603801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-101' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [242] order_no=2026051580932181, task_no=YS-260515-100, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-100', '2026051580932181',
  '유정온', '010-9521-6987',
  '서울특별시 광진구 긴고랑로1길 55 (중곡동, 중곡아파트) 5동 607호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 11:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-100", "external_item_no": "2026051518705901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-100' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [243] order_no=2026051578708291, task_no=YS-260515-097, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-097', '2026051578708291',
  '최민지', '010-2471-2443',
  '서울특별시 성북구 화랑로48길 16 두산아파트 114동 901호', '성북구',
  '안녕하세요
 5월 20일 14시 청소 진행 가능할까요?', '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 13:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-097", "external_item_no": "2026051515485271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-097' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-096", "external_item_no": "2026051515485281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-097' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-094", "external_item_no": "2026051515485301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-097' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [244] order_no=2026051581251991, task_no=YS-260515-092, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-092', '2026051581251991',
  '강하영', '010-3312-2065',
  '서울특별시 서대문구 신촌로1길 42-5 (창천동) 307호', '서대문구',
  '5/24(일) 혹은 5/25(월) 오전 시간대 방문 희망합니다', '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-25 11:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-092", "external_item_no": "2026051519171301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-092' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [245] order_no=2026051581026751, task_no=YS-260515-091, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-091', '2026051581026751',
  '서윤호', '010-8738-1558',
  '인천광역시 남동구 구월로 65 (간석동, 현대홈타운아파트) 101동 506호', '남동구',
  '공동현관문 #506#1126', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260515-091", "external_item_no": "2026051518839111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-091' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-090", "external_item_no": "2026051518839121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-091' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-089", "external_item_no": "2026051518839131"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-091' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [246] order_no=2026051576690731, task_no=YS-260515-088, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-088', '2026051576690731',
  '채형근', '010-8688-1069',
  '서울특별시 서대문구 가재울미래로 2 (남가좌동, DMC파크뷰자이) 106동 702호', '서대문구',
  '최대한빠르게 부탁드립니다..', '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 13:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-088", "external_item_no": "2026051512446111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-088' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [247] order_no=2026051577589771, task_no=YS-260515-087, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-087', '2026051577589771',
  '박동규', '0502-2847-4870',
  '서울특별시 송파구 백제고분로15길 43 (잠실동, 고려시티빌) 202호(2층)', '송파구',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 13:30:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-087", "external_item_no": "2026051513804191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-087' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [248] order_no=2026051578307661, task_no=YS-260515-085, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-085', '2026051578307661',
  '장수경(스카이캐슬)', '010-6345-2930',
  '서울특별시 동작구 대방동17길 6 (대방동, 스카이캐슬) 302호 (공동현관 :종1290)', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  170500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-085", "external_item_no": "2026051514888431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-085' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [249] order_no=2026051579030821, task_no=YS-260515-084, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-084', '2026051579030821',
  '박경은', '010-8490-0319',
  '서울특별시 강동구 아리수로50길 50 (고덕동, 래미안힐스테이트고덕) 111동 1201호', '강동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 10:30:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-084", "external_item_no": "2026051515965181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-084' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-083", "external_item_no": "2026051515965191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-084' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [250] order_no=2026051579031301, task_no=YS-260515-082, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-082', '2026051579031301',
  '박지혜', '010-5564-6644',
  '서울특별시 서초구 주흥길 45 (반포동, 벨라지오텔) 405호', '서초구',
  '최대한빠르게 부탁드립니다 시간관계없이 내일도 가능해요!', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-082", "external_item_no": "2026051515965611"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-082' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [251] order_no=2026051579668311, task_no=YS-260515-081, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-081', '2026051579668311',
  '김선희', '010-8311-3662',
  '서울특별시 서초구 청두곶8길 28-6 (방배동) 1층', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 18:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-081", "external_item_no": "2026051516898871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-081' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [252] order_no=2026051579843831, task_no=YS-260515-080, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-080', '2026051579843831',
  '양창우', '010-5552-2918',
  '서울특별시 용산구 신흥로26길 14 (용산동2가, 정일아트빌) 304호', '용산구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 15:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-080", "external_item_no": "2026051517153931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-080' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [253] order_no=2026051579931871, task_no=YS-260515-079, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-079', '2026051579931871',
  '신지은', '010-2313-9322',
  '서울특별시 양천구 남부순환로54길 20-8 (신월동) 1층(은색열린대문들어와반층위갈색대문)', '양천구',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 15:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-079", "external_item_no": "2026051517280591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-079' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [254] order_no=2026051578823101, task_no=YS-260515-078, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-078', '2026051578823101',
  '박수민', '010-4739-1007',
  '서울특별시 노원구 한글비석로 530 (상계동, 상계주공12단지아파트) 1215동1503호', '노원구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 10:00:00+09:00', NULL,
  119000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-078", "external_item_no": "2026051515658831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-078' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-077", "external_item_no": "2026051515658841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-078' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [255] order_no=2026051579316821, task_no=YS-260515-076, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-076', '2026051579316821',
  '김남준', '010-4324-5683',
  '서울특별시 광진구 아차산로23길 46 (화양동) 201호', '광진구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 19:30:00+09:00', '2026-05-15 00:00:00+09:00',
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
  '{"item_code": "YS-260515-076", "external_item_no": "2026051516384821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-075", "external_item_no": "2026051516384831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [256] order_no=2026051579438521, task_no=YS-260515-074, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-074', '2026051579438521',
  '강민지', '010-3797-8106',
  '서울특별시 서초구 효령로33길 50 (방배동, 방배서리풀이편한세상) 102동 406호', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 09:00:00+09:00', NULL,
  261000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-074", "external_item_no": "2026051516561911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-074' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-073", "external_item_no": "2026051516561921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-074' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [257] order_no=2026051576097051, task_no=YS-260515-072, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-072', '2026051576097051',
  '이희영', '010-9058-2815',
  '서울특별시 노원구 동일로234길 14 (상계동) 필하우스10차 601호', '노원구',
  '송풍팬분해/ 냉매정검/실외기는 저희집 오셨을때 상태를 보시고 결정하고 현장구매 하고 싶습니다.
 일정은 최대한 빠른 날짜로 언제 될까요?', '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 09:00:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-072", "external_item_no": "2026051511548941"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [258] order_no=2026051576990411, task_no=YS-260515-071, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-071', '2026051576990411',
  '임유진', '010-9092-4085',
  '서울특별시 은평구 서오릉로22길 9-7 (갈현동, 천지투스타빌) 202호', '은평구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 17:15:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-071", "external_item_no": "2026051512901141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-071' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-070", "external_item_no": "2026051512901151"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-071' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-069", "external_item_no": "2026051512901161"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-071' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [259] order_no=2026051450852441, task_no=YS-260515-068, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-068', '2026051450852441',
  '홍하나', '010-3371-8592',
  '서울특별시 강북구 인수봉로84길 40-15 (수유동) 로벨리아 4층 405호', '강북구',
  '5-18. 5시반 시간지정 ', '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-18 17:30:00+09:00', NULL,
  86400, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-068", "external_item_no": "2026051464076411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-068' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [260] order_no=2026051574000421, task_no=YS-260515-067, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-067', '2026051574000421',
  '정혁진', '010-8765-7241',
  '서울특별시 금천구 금하로 632 (시흥동, 김안과의원) 2층 정한의원', '금천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  78600, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-067", "external_item_no": "2026051598460721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-067' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=2.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-066", "external_item_no": "2026051598460731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-067' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [261] order_no=2026051571225591, task_no=YS-260515-062, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-062', '2026051571225591',
  '장한별', '010-4954-4560',
  '서울특별시 관악구 신림로3가길 7 (신림동, 신림2차금호타운) 201동 1108호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  67500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-062", "external_item_no": "2026051594341381"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-062' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [262] order_no=2026051571358311, task_no=YS-260515-061, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-061', '2026051571358311',
  '유미라', '010-4127-0857',
  '경기도 의정부시 신촌로53번길 40-16 (가능동) 201호', '의정부시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 15:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-061", "external_item_no": "2026051594537501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-061' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [263] order_no=2026051572094611, task_no=YS-260515-060, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-060', '2026051572094611',
  '박영선', '010-6560-6734',
  '서울특별시 동작구 상도로38나길 5 (상도1동, 한빛위너스) A동 601호', '동작구',
  '최대한 빠르게 부탁드립니다!', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 13:00:00+09:00', '2026-05-18 00:00:00+09:00',
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
  '{"item_code": "YS-260515-060", "external_item_no": "2026051595623811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-060' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [264] order_no=2026051572544771, task_no=YS-260515-059, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-059', '2026051572544771',
  '나덕경', '010-8030-3718',
  '서울특별시 동작구 상도로65길 8 (상도동) 201호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 13:00:00+09:00', NULL,
  138500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-059", "external_item_no": "2026051596304011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-059' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [265] order_no=2026051454262191, task_no=YS-260515-058, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-058', '2026051454262191',
  '김승환', '010-2553-4170',
  '서울특별시 종로구 지봉로5길 7 (창신동, 두산아파트) 101동702호', '종로구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 15:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-058", "external_item_no": "2026051469133801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-058' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-057", "external_item_no": "2026051469133811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-058' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [266] order_no=2026051454352191, task_no=YS-260515-056, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-056', '2026051454352191',
  '송은미(집)', '0502-2655-0739',
  '서울특별시 강동구 고덕로27길 33-12 (암사동, 하우징허브) 가동 601호', '강동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 13:30:00+09:00', NULL,
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
  '{"item_code": "YS-260515-056", "external_item_no": "2026051469266141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-056' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [267] order_no=2026051454589871, task_no=YS-260515-055, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-055', '2026051454589871',
  '황명하', '010-8310-8301',
  '서울특별시 성북구 아리랑로4길 49-7 (동선동5가) 85 3층', '성북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 10:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-055", "external_item_no": "2026051469612821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-054", "external_item_no": "2026051469612831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [268] order_no=2026051455221061, task_no=YS-260515-053, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-053', '2026051455221061',
  '노주원', '010-7744-4576',
  '서울특별시 강동구 양재대로 1300 (둔촌동, 올림픽파크포레온) 120동 3304호', '강동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:30:00+09:00', NULL,
  348000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=4.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 4, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-053", "external_item_no": "2026051470538531"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-053' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [269] order_no=2026051455265391, task_no=YS-260515-052, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-052', '2026051455265391',
  '와이즈', '0507-095-0634',
  '서울특별시 성동구 무수막18길 10 (금호동2가) 102호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 15:30:00+09:00', NULL,
  124000, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-052", "external_item_no": "2026051470599781"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [270] order_no=2026051455633311, task_no=YS-260515-051, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-051', '2026051455633311',
  '김승대', '010-4293-1425',
  '서울특별시 광진구 뚝섬로56길 35 (자양동, 그린아파트) 704호', '광진구',
  '현관앞에놔주세요', '확정',
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
  '{"item_code": "YS-260515-051", "external_item_no": "2026051471128001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-051' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-050", "external_item_no": "2026051471128011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-051' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [271] order_no=2026051455648911, task_no=YS-260515-049, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-049', '2026051455648911',
  '최영주', '010-2500-3779',
  '서울특별시 성북구 낙산길 243-15 105동 1002호 (삼선힐스테이트)', '성북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 10:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-049", "external_item_no": "2026051471150631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-049' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [272] order_no=2026051455667361, task_no=YS-260515-048, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-048', '2026051455667361',
  '이채현', '010-7242-0299',
  '서울특별시 중랑구 상봉중앙로6길 10 (상봉동) 501호', '중랑구',
  '부재 시 연락 부탁드려요', '확정',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 09:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-048", "external_item_no": "2026051471178021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-047", "external_item_no": "2026051471178031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [273] order_no=2026051456766701, task_no=YS-260515-046, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-046', '2026051456766701',
  '김희선', '010-9275-1391',
  '서울특별시 동작구 남부순환로263길 15 (사당동, 라움하우스) 201호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 18:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-046", "external_item_no": "2026051472741521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [274] order_no=2026051460380871, task_no=YS-260515-043, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-043', '2026051460380871',
  '허예림', '010-8488-7956',
  '경기도 김포시 고촌읍 인향로24번길 66-24 (고촌읍, 디아이빌6단지) 601동 701호', '김포시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 10:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-043", "external_item_no": "2026051477989511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-043' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [275] order_no=2026051460686831, task_no=YS-260515-042, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-042', '2026051460686831',
  '현진', '010-2478-4121',
  '서울특별시 성동구 마조로5길 4-5 (행당동) 303호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  70400, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-042", "external_item_no": "2026051478456481"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [276] order_no=2026051460733051, task_no=YS-260515-041, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-041', '2026051460733051',
  '최진모', '010-4949-2071',
  '서울특별시 동작구 사당로20라길 29 (사당동) 101호', '동작구',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 11:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-041", "external_item_no": "2026051478527491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-040", "external_item_no": "2026051478527501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [277] order_no=2026051461344741, task_no=YS-260515-038, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-038', '2026051461344741',
  '손승희', '010-4142-2740',
  '서울특별시 광진구 아차산로27길 28-5 (화양동) 302호', '광진구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 16:00:00+09:00', '2026-05-16 00:00:00+09:00',
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
  '{"item_code": "YS-260515-038", "external_item_no": "2026051479457031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [278] order_no=2026051462091631, task_no=YS-260515-037, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-037', '2026051462091631',
  '김주현', '010-4104-0294',
  '경기도 의정부시 녹양로34번길 47 (가능동, e편한세상 녹양역) 105동902호', '의정부시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 09:00:00+09:00', NULL,
  170500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-037", "external_item_no": "2026051480598151"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [279] order_no=2026051462117371, task_no=YS-260515-036, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-036', '2026051462117371',
  '이현희', '010-2227-9445',
  '서울특별시 강남구 선릉로132길 19-20 (청담동) 도도하우스 201호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 12:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-036", "external_item_no": "2026051480637241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [280] order_no=2026051462627021, task_no=YS-260515-035, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-035', '2026051462627021',
  '최지희', '010-8785-3617',
  '서울특별시 구로구 신도림로 11 (신도림동, 신도림3차대림아파트) 601동 1002호', '구로구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 09:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-035", "external_item_no": "2026051481436241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-034", "external_item_no": "2026051481436251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [281] order_no=2026051462665011, task_no=YS-260515-033, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-033', '2026051462665011',
  '박재권', '010-9417-8637',
  '서울특별시 성북구 서경로13길 36 (정릉동) 304호', '성북구',
  '공동현관 비밀번호 벨 8940 입니다.', '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 17:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-033", "external_item_no": "2026051481495531"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [282] order_no=2026051462758841, task_no=YS-260515-032, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-032', '2026051462758841',
  '허혜정', '010-4934-5386',
  '서울특별시 관악구 청림2길 21-20 (봉천동) 2층', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 09:00:00+09:00', '2026-05-18 00:00:00+09:00',
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
  '{"item_code": "YS-260515-032", "external_item_no": "2026051481641771"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [283] order_no=2026051463272001, task_no=YS-260515-031, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-031', '2026051463272001',
  '권나영', '0502-2758-5874',
  '서울특별시 강남구 학동로68길 29 (삼성동, 삼성동힐스테이트1단지아파트) 101동 301호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:30:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-031", "external_item_no": "2026051482444551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-030", "external_item_no": "2026051482444561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [284] order_no=2026051463489071, task_no=YS-260515-029, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-029', '2026051463489071',
  '김민찬', '010-8972-3180',
  '서울특별시 강남구 역삼로33길 13 (역삼동, 세연예지향 아파트) 502호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 18:00:00+09:00', NULL,
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
  '{"item_code": "YS-260515-029", "external_item_no": "2026051482778931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-028", "external_item_no": "2026051482778941"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [285] order_no=2026051564925491, task_no=YS-260515-027, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-027', '2026051564925491',
  '최도연', '010-2455-8834',
  '경기도 고양시 덕양구 행신로143번길 54-8 (행신동, 행신2차에스케이뷰아파트) 203-1401', '덕양구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 13:30:00+09:00', NULL,
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
  '{"item_code": "YS-260515-027", "external_item_no": "2026051585005751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-027' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-026", "external_item_no": "2026051585005761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-027' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [286] order_no=2026051565235971, task_no=YS-260515-025, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-025', '2026051565235971',
  '김민영', '010-2026-9219',
  '서울특별시 구로구 경인로20나길 46 (오류동, 해오름빌) 305호', '구로구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 12:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-025", "external_item_no": "2026051585496771"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [287] order_no=2026051565525461, task_no=YS-260515-024, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-024', '2026051565525461',
  '유지은', '0502-2841-0471',
  '서울특별시 강서구 개화동로29길 53 (방화동, 원타워펠리체) 502호', '강서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 13:00:00+09:00', NULL,
  70400, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-024", "external_item_no": "2026051585964141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [288] order_no=2026051565621751, task_no=YS-260515-023, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-023', '2026051565621751',
  '조희정', '010-9140-3757',
  '서울특별시 동작구 사당로8나길 17 (사당동) 502호', '동작구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 15:30:00+09:00', '2026-05-15 00:00:00+09:00',
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
  '{"item_code": "YS-260515-023", "external_item_no": "2026051586122101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-022", "external_item_no": "2026051586122111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [289] order_no=2026051566141191, task_no=YS-260515-021, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-021', '2026051566141191',
  '최윤식', '010-7374-0979',
  '서울특별시 강남구 언주로85길 14 (역삼동, 엠코스퀘어720) 304호', '강남구',
  '5/16 원하심', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-16 10:30:00+09:00', '2026-05-16 00:00:00+09:00',
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
  '{"item_code": "YS-260515-021", "external_item_no": "2026051586945861"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-020", "external_item_no": "2026051586945871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [290] order_no=2026051566540771, task_no=YS-260515-019, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-019', '2026051566540771',
  '김동신', '010-9025-6636',
  '서울특별시 강북구 오현로9길 140 (미아동, 명화빌라) 가동B02호', '강북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-31 14:00:00+09:00', '2026-05-15 00:00:00+09:00',
  70400, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-019", "external_item_no": "2026051587519071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-018", "external_item_no": "2026051587519081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [291] order_no=2026051566981741, task_no=YS-260515-017, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-017', '2026051566981741',
  '이현주', '0502-2760-4993',
  '서울특별시 서초구 신반포로43길 35-33 (잠원동, 세종빌라) 401호', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 08:00:00+09:00', NULL,
  10000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=서울지역 / 구분=냉매 점검비 / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-017", "external_item_no": "2026051588143431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [292] order_no=2026051567402391, task_no=YS-260515-016, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-016', '2026051567402391',
  '장나영', '010-9871-5258',
  '서울특별시 강남구 봉은사로 125 (논현동, 리스트 강남(List Gangnam)) 1212', '강남구',
  '5/15 당일 요청 ', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-15 12:00:00+09:00', '2026-05-15 00:00:00+09:00',
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
  '{"item_code": "YS-260515-016", "external_item_no": "2026051588741581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [293] order_no=2026051567234731, task_no=YS-260515-015, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-015', '2026051567234731',
  '이신영', '010-2232-0056',
  '서울특별시 관악구 행운1마길 7 (봉천동) 201호', '관악구',
  '근무중 통화 힘들어서 문자 남겨주시면
 연락드릴께요', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 17:30:00+09:00', NULL,
  142000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-015", "external_item_no": "2026051588502111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [294] order_no=2026051568560281, task_no=YS-260515-014, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-014', '2026051568560281',
  '임꽃무리', '010-2261-4998',
  '서울특별시 송파구 동남로13길 23-13 (가락동) 401', '송파구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:00:00+09:00', NULL,
  73900, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-014", "external_item_no": "2026051590392681"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [295] order_no=2026051461429131, task_no=YS-260515-013, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-013', '2026051461429131',
  '왕종근', '010-3234-6238',
  '서울특별시 영등포구 버드나루로11길 7 (영등포동7가, 한가람더원오피스텔) 2동 502호', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260515-013", "external_item_no": "2026051479586661"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-012", "external_item_no": "2026051479586671"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [296] order_no=2026051463005001, task_no=YS-260515-011, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-011', '2026051463005001',
  '안익현', '010-8841-5550',
  '서울특별시 강남구 압구정로29길 71 (압구정동, 현대아파트) 구현대 아파트 13동 1104호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 13:00:00+09:00', NULL,
  138500, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260515-011", "external_item_no": "2026051482031001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [297] order_no=2026051463947531, task_no=YS-260515-010, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-010', '2026051463947531',
  '김난영', '010-8393-9189',
  '서울특별시 금천구 독산로27길 25 (시흥동) 1층 (지하x)', '금천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 11:30:00+09:00', NULL,
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
  '{"item_code": "YS-260515-010", "external_item_no": "2026051483493001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-009", "external_item_no": "2026051483493011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [298] order_no=2026051463957951, task_no=YS-260515-008, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-008', '2026051463957951',
  '김흥진', '010-5411-5656',
  '서울특별시 영등포구 버드나루로23길 25 휴브릿지2 901호', '영등포구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
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
  '{"item_code": "YS-260515-008", "external_item_no": "2026051483509801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [299] order_no=2026051564357171, task_no=YS-260515-007, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-007', '2026051564357171',
  '유범수', '010-4321-6641',
  '서울특별시 동작구 성대로 58-11 (상도동) 101호', '동작구',
  '실내기 모델명: CS-A061GSI (캐리어)', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 18:30:00+09:00', '2026-05-15 00:00:00+09:00',
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
  '{"item_code": "YS-260515-007", "external_item_no": "2026051584126181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260515-006", "external_item_no": "2026051584126191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [300] order_no=2026051564388111, task_no=YS-260515-005, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260515-005', '2026051564388111',
  '김지연', '010-5636-6879',
  '서울특별시 강남구 논현로113길 32 (논현동) 103호', '강남구',
  '최대한 빠르게 부탁드려요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 12:30:00+09:00', '2026-05-16 00:00:00+09:00',
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
  '{"item_code": "YS-260515-005", "external_item_no": "2026051584172891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260515-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

COMMIT;
