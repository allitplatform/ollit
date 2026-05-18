-- ============================================
-- 유솔N 시트 → Supabase tasks/task_items 마이그 (Fix #31)
-- 생성: 2026-05-19 00:11:44
-- 원본: db/migration/usol-may-v2.xlsx 시트 '시트1'
-- 시트 데이터 1143건 → tasks 769개
-- 출력 범위: skip=500, limit=200 → 200 task
-- ============================================

BEGIN;

-- [501] order_no=2026050571313051, task_no=YS-260505-018, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260505-018', '2026050571313051',
  '박호진', '010-9193-5963',
  '서울특별시 관악구 중앙1나길 22 (봉천동) 파란색한 쪽문(외문)으로 들어와서 철계단으로 올라가면 3층 402호 있습니다!', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 12:00:00+09:00', '2026-05-06 00:00:00+09:00',
  69000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260505-018", "external_item_no": "2026050550817931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260505-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [502] order_no=2026050571409541, task_no=YS-260505-017, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260505-017', '2026050571409541',
  '황주은', '010-4157-2849',
  '서울특별시 동작구 상도로61가길 13 (상도동) 205호', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 18:30:00+09:00', '2026-05-06 00:00:00+09:00',
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
  '{"item_code": "YS-260505-017", "external_item_no": "2026050550956941"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260505-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [503] order_no=2026050571869351, task_no=YS-260505-016, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260505-016', '2026050571869351',
  '박지영', '010-2790-4355',
  '서울특별시 서초구 효령로79길 1 (서초동, 강남역파라디아골드) 705호', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 13:00:00+09:00', '2026-05-10 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260505-016", "external_item_no": "2026050551622811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260505-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [504] order_no=2026050572155211, task_no=YS-260505-015, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260505-015', '2026050572155211',
  '박은진', '010-9268-4308',
  '서울특별시 중구 동호로 214 (신당동) 대현프리몰 501호', '중구',
  '5/9 오후 진행 가능할까요~?', '완료',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 18:00:00+09:00', '2026-05-14 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260505-015", "external_item_no": "2026050552035301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260505-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [505] order_no=2026050573954241, task_no=YS-260505-014, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260505-014', '2026050573954241',
  '한성원', '010-5069-0994',
  '서울특별시 관악구 문성로 221-8 (신림동) 302호', '관악구',
  '5월 10일날 작업을 희망합니다.', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 12:00:00+09:00', '2026-05-10 00:00:00+09:00',
  63050, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260505-014", "external_item_no": "2026050554625311"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260505-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [506] order_no=2026050575010061, task_no=YS-260505-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260505-013', '2026050575010061',
  '임상희', '010-8393-0030',
  '서울특별시 강남구 도곡로3길 26 (역삼동, 역삼한스빌아파트) 907호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 11:30:00+09:00', '2026-05-16 00:00:00+09:00',
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
  '{"item_code": "YS-260505-013", "external_item_no": "2026050556140221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260505-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [507] order_no=2026050577029861, task_no=YS-260505-008, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260505-008', '2026050577029861',
  '손보성', '0502-2816-0087',
  '서울특별시 송파구 문정로4길 10-30 (문정동, 대림빌딩) 5층', '송파구',
  '일요일로 희망합니다. 빠를수록 좋아요', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-31 12:00:00+09:00', '2026-05-10 00:00:00+09:00',
  112200, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260505-008", "external_item_no": "2026050559030251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260505-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [508] order_no=YS-260504-042, task_no=YS-260504-042, channel=현금접수, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_h' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-042', 'YS-260504-042',
  '성함미정', '01024102890',
  '역삼동 823-33 602호', NULL,
  '9만원현금결제해야함', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-07 13:00:00+09:00', '2026-05-07 00:00:00+09:00',
  90000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-042", "external_item_no": "YS-260504-042"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [509] order_no=2026050444403171, task_no=YS-260504-041, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-041', '2026050444403171',
  '노사령', '010-7250-1881',
  '서울특별시 성동구 금호동4가 567 3층 코리아와와퀵', '성동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 15:00:00+09:00', '2026-05-09 00:00:00+09:00',
  67900, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-041", "external_item_no": "2026050410837881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260504-040", "external_item_no": "2026050410837891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260504-039", "external_item_no": "2026050410837901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [510] order_no=2026050449484341, task_no=YS-260504-038, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-038', '2026050449484341',
  '황예원', '010-6575-9917',
  '서울특별시 강남구 도곡로 113 (역삼동) 강남웅진베어스빌 1602호', '강남구',
  '높이4미터 집에사다리 있으나 안되면 관리실에서 빌려주세요!!!', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 15:00:00+09:00', '2026-05-16 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-038", "external_item_no": "2026050418500461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=4.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 4, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260504-037", "external_item_no": "2026050418500471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [511] order_no=2026050444723901, task_no=YS-260504-036, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-036', '2026050444723901',
  '김진우', '010-4899-0247',
  '서울특별시 용산구 후암로34길 15 (후암동, 예인아트빌) 가동 401호', '용산구',
  '5/9 오전~오후2시까지 가능
 오후 5시 이후도 가능 합니다.
 어려우시면 차주 주말에 가능하신지 스케줄 확인 부탁드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 17:00:00+09:00', '2026-05-09 00:00:00+09:00',
  112200, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-036", "external_item_no": "2026050411328041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [512] order_no=2026050439312921, task_no=YS-260504-034, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-034', '2026050439312921',
  '이수연', '010-9920-7573',
  '서울특별시 구로구 구로중앙로28길 52 (구로동, 태형팰리스) 102동 601호', '구로구',
  '시스템에어컨 1대이고 5월 7일이나 8일 가능한가요?', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 14:00:00+09:00', '2026-05-08 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-034", "external_item_no": "2026050493099741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [513] order_no=2026050319192661, task_no=YS-260504-033, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-033', '2026050319192661',
  '손재범', '010-6747-0008',
  '경기도 용인시 수지구 용구대로 2720 (죽전동, 현암마을동성2차아파트) 105동 202호', '수지구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 14:30:00+09:00', '2026-05-08 00:00:00+09:00',
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
  '{"item_code": "YS-260504-033", "external_item_no": "2026050362484251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [514] order_no=2026050323588331, task_no=YS-260504-032, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-032', '2026050323588331',
  '양동주', '010-8564-2551',
  '서울특별시 강남구 도곡로4길 31 (도곡동, 도곡현대하이페리온) 102동 1003호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 09:00:00+09:00', NULL,
  201300, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=3.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-032", "external_item_no": "2026050368909511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-011", "external_item_no": "2026050368909501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [515] order_no=2026050323665611, task_no=YS-260504-031, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-031', '2026050323665611',
  '자인채최민지', '010-4155-3959',
  '경기도 고양시 덕양구 성신로 4 (화정동) 자인채오피스텔 1206호', '덕양구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 12:00:00+09:00', '2026-05-11 00:00:00+09:00',
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
  '{"item_code": "YS-260504-031", "external_item_no": "2026050369023291"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=2.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260504-030", "external_item_no": "2026050369023301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [516] order_no=2026050324109991, task_no=YS-260504-029, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-029', '2026050324109991',
  '황수연', '010-5067-5222',
  '서울특별시 노원구 공릉동 415-80 진주빌라 A동 401호', '노원구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-31 02:00:00+09:00', NULL,
  131400, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-029", "external_item_no": "2026050369671021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [517] order_no=2026050432540261, task_no=YS-260504-028, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-028', '2026050432540261',
  '이익범', '010-7963-9297',
  '경기도 구리시 안골로103번길 15-1 (수택동) 옥탑층', '구리시',
  '청소 시간 미리 조정 부탁드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 11:00:00+09:00', '2026-05-10 00:00:00+09:00',
  67900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-028", "external_item_no": "2026050482726211"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [518] order_no=2026050436129101, task_no=YS-260504-024, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-024', '2026050436129101',
  '김현주', '010-7929-7555',
  '경기도 고양시 덕양구 북한산로387번길 7-1 (효자동, 유일빌리지) 3동401호', '덕양구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-31 12:30:00+09:00', '2026-05-08 00:00:00+09:00',
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
  '{"item_code": "YS-260504-024", "external_item_no": "2026050488277081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260504-022", "external_item_no": "2026050488277101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [519] order_no=2026050437154451, task_no=YS-260504-021, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-021', '2026050437154451',
  '이경애', '010-2875-2227',
  '서울특별시 양천구 목동중앙본로15길 36 (목동) 단독', '양천구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 12:00:00+09:00', '2026-05-07 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-021", "external_item_no": "2026050489807631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260504-020", "external_item_no": "2026050489807641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260504-004", "external_item_no": "2026050489807651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [520] order_no=2026050316491631, task_no=YS-260504-019, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-019', '2026050316491631',
  '임연옥', '010-7458-3388',
  '서울특별시 중랑구 용마산로129나길 101 (신내동, 라이프미성아파트) A동 404호', '중랑구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 12:00:00+09:00', '2026-05-11 00:00:00+09:00',
  67030, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-019", "external_item_no": "2026050358510651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260504-018", "external_item_no": "2026050358510661"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [521] order_no=2026050321921411, task_no=YS-260504-015, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-015', '2026050321921411',
  '이성희', '010-3729-7096',
  '경기도 성남시 분당구 정자일로 197 (정자동) 푸르지오시티 2차 918호', '분당구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 09:00:00+09:00', '2026-05-07 00:00:00+09:00',
  89900, 10000,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-015", "external_item_no": "2026050366480541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [522] order_no=2026050322241621, task_no=YS-260504-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-013', '2026050322241621',
  '김예림', '0502-2893-1890',
  '서울특별시 강서구 양천로 714-18 (염창동) 동남빌리지 701호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 16:00:00+09:00', '2026-05-11 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-013", "external_item_no": "2026050366946151"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [523] order_no=2026050323087551, task_no=YS-260504-012, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-012', '2026050323087551',
  '박혜정', '010-6349-5601',
  '서울특별시 금천구 금하로5길 7 (시흥동, 지엠씨타워) 401호', '금천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 13:00:00+09:00', '2026-05-17 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-012", "external_item_no": "2026050368181281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [524] order_no=2026050326902251, task_no=YS-260504-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-010', '2026050326902251',
  '김중현', '010-2744-2798',
  '서울특별시 강서구 허준로 234 (가양동, 가양9단지아파트) 908동1001호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 16:00:00+09:00', '2026-05-09 00:00:00+09:00',
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
  '{"item_code": "YS-260504-010", "external_item_no": "2026050373817591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [525] order_no=2026050327338061, task_no=YS-260504-009, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-009', '2026050327338061',
  '백혜원', '010-5192-3647',
  '서울특별시 동작구 흑석로13가길 34-10 (흑석동, 라호지움) 103호', '동작구',
  '최대한 빨리 청소 받고싶어요. 평일 저녁 원해요', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 17:10:00+09:00', '2026-05-14 00:00:00+09:00',
  67900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-009", "external_item_no": "2026050374476011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [526] order_no=2026050329965861, task_no=YS-260504-007, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-007', '2026050329965861',
  '김연주', '010-6743-7743',
  '서울특별시 강남구 자곡로11길 28 (자곡동) LH수서역세권 행복주택 203동 304호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 11:00:00+09:00', '2026-05-08 00:00:00+09:00',
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
  '{"item_code": "YS-260504-007", "external_item_no": "2026050378578851"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [527] order_no=2026050433866081, task_no=YS-260504-006, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-006', '2026050433866081',
  '김승언', '010-2053-2325',
  '서울특별시 송파구 한가람로 414 (풍납동, 갑을아파트) 1202호', '송파구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-31 12:00:00+09:00', '2026-05-09 00:00:00+09:00',
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
  '{"item_code": "YS-260504-006", "external_item_no": "2026050484867461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260504-005", "external_item_no": "2026050484867471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [528] order_no=2026050437327721, task_no=YS-260504-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-003', '2026050437327721',
  '김은경', '010-5454-0689',
  '서울특별시 강서구 양천로57길 9-19 (가양동, 동양트레벨스카이오피스텔) 1316', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 11:00:00+09:00', '2026-05-06 00:00:00+09:00',
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
  '{"item_code": "YS-260504-003", "external_item_no": "2026050490073781"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [529] order_no=2026050438664151, task_no=YS-260504-002, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260504-002', '2026050438664151',
  '김민정', '010-6660-3911',
  '서울특별시 강서구 강서로18다길 8-7 (화곡동) 402호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 15:00:00+09:00', '2026-05-09 00:00:00+09:00',
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
  '{"item_code": "YS-260504-002", "external_item_no": "2026050492107501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260504-001", "external_item_no": "2026050492107511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260504-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [530] order_no=2026050298662501, task_no=YS-260503-007, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260503-007', '2026050298662501',
  '박서영', '0502-2886-7803',
  '서울특별시 강서구 까치산로4다길 13-3 (화곡동, 프리즘빌라) B동 202호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:00:00+09:00', '2026-05-12 00:00:00+09:00',
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
  '{"item_code": "YS-260503-007", "external_item_no": "2026050246905021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260503-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260503-006", "external_item_no": "2026050246905031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260503-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [531] order_no=2026050399437101, task_no=YS-260503-005, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260503-005', '2026050399437101',
  '안수진', '0502-2887-1375',
  '서울특별시 관악구 봉천로 610 (봉천동) 3층', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 10:00:00+09:00', '2026-05-06 00:00:00+09:00',
  67900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260503-005", "external_item_no": "2026050348074021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260503-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [532] order_no=2026050312374451, task_no=YS-260503-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260503-003', '2026050312374451',
  '나연서', '010-9659-8155',
  '경기도 양주시 회천로 200 (옥정동, 옥정25단지) 2505동 1805호', '양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 15:30:00+09:00', '2026-05-11 00:00:00+09:00',
  67900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260503-003", "external_item_no": "2026050352449551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260503-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [533] order_no=2026050312407621, task_no=YS-260503-002, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260503-002', '2026050312407621',
  '임정윤', '010-6702-2310',
  '서울특별시 동작구 남부순환로267길 24-1 (사당동) B05', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-31 13:00:00+09:00', '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260503-002", "external_item_no": "2026050352498821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260503-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [534] order_no=2026050312538691, task_no=YS-260503-001, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260503-001', '2026050312538691',
  '김하진', '010-8837-6738',
  '서울특별시 노원구 누원로 19 (상계동, 수락리버타운) 수락리버타운 310호', '노원구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0017',
  NULL, NULL,
  67900, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260503-001", "external_item_no": "2026050352688451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260503-001' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [535] order_no=2026050285237231, task_no=YS-260502-019, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-019', '2026050285237231',
  '이경화', '010-5689-5333',
  '서울특별시 강서구 양천로30길 123-9 (마곡동, 신안아파트) 102동 107호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 11:30:00+09:00', '2026-05-11 00:00:00+09:00',
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
  '{"item_code": "YS-260502-019", "external_item_no": "2026050227389431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260502-018", "external_item_no": "2026050227389441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [536] order_no=2026050286067441, task_no=YS-260502-017, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-017', '2026050286067441',
  '조아라', '010-5516-0201',
  '경기도 양주시 회천로 377 (회정동, 양주회천 10단지) 1002동602호', '양주시',
  '부재시 문앞에 부탁드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 12:30:00+09:00', '2026-05-11 00:00:00+09:00',
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
  '{"item_code": "YS-260502-017", "external_item_no": "2026050228563131"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [537] order_no=2026050286524601, task_no=YS-260502-016, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-016', '2026050286524601',
  '강호영', '010-3636-3934',
  '서울특별시 강남구 테헤란로20길 15 (역삼동, 메이플라워멤버스빌오피스텔) 810호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-31 09:00:00+09:00', '2026-05-09 00:00:00+09:00',
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
  '{"item_code": "YS-260502-016", "external_item_no": "2026050229209081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [538] order_no=2026050168869861, task_no=YS-260502-011, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-011', '2026050168869861',
  '김수지', '010-8637-9278',
  '서울특별시 동대문구 장한로 91 (장안동, 현대썬앤빌601) B1314', '동대문구',
  '5/4(월) 요청 드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 16:30:00+09:00', '2026-05-04 00:00:00+09:00',
  89900, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260502-011", "external_item_no": "2026050193420321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [539] order_no=2026050169667391, task_no=YS-260502-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-010', '2026050169667391',
  '이영아', '010-8514-0222',
  '서울특별시 성동구 무학로 33 (하왕십리동, 텐즈힐) 103동 1203호', '성동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-05-31 14:00:00+09:00', '2026-05-07 00:00:00+09:00',
  87200, 10000,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260502-010", "external_item_no": "2026050194555601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [540] order_no=2026050169763421, task_no=YS-260502-009, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-009', '2026050169763421',
  '김성춘', '010-6256-5237',
  '서울특별시 양천구 신정중앙로2길 11-7 (신정동, 발렌시아펠리스) 401호', '양천구',
  '톡톡으로 문의드린대로, 5월4일 오후 17시로 부탁드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-04 17:00:00+09:00', '2026-05-04 00:00:00+09:00',
  112200, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260502-009", "external_item_no": "2026050194691371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260502-008", "external_item_no": "2026050194691381"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [541] order_no=2026050170779431, task_no=YS-260502-006, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-006', '2026050170779431',
  '장한', '010-6780-5186',
  '서울특별시 동대문구 회기로12나길 29 (회기동) 401호', '동대문구',
  '빠르게 청소원함', '확정',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 10:00:00+09:00', NULL,
  67900, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260502-006", "external_item_no": "2026050196141111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [542] order_no=2026050173006101, task_no=YS-260502-005, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-005', '2026050173006101',
  '오지은', '010-3024-1402',
  '서울특별시 영등포구 시흥대로 595 (대림동, H HOUSE 대림 뉴스테이) 102동 405호', '영등포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 18:30:00+09:00', '2026-05-04 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260502-005", "external_item_no": "2026050199303301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [543] order_no=2026050173107931, task_no=YS-260502-004, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-004', '2026050173107931',
  '조민호', '010-2692-4722',
  '서울특별시 강서구 양천로67길 32 (염창동, 신동아아파트) 102동 105호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 09:00:00+09:00', '2026-05-12 00:00:00+09:00',
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
  '{"item_code": "YS-260502-004", "external_item_no": "2026050199448821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260502-003", "external_item_no": "2026050199448831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260502-002", "external_item_no": "2026050199448841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [544] order_no=2026050280223461, task_no=YS-260502-001, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260502-001', '2026050280223461',
  '최연주', '010-4793-9512',
  '서울특별시 동작구 성대로6마길 8-11 (상도동) 로얄팰리스 302호', '동작구',
  '현관문1234부재시 문 앞에 두고 가주세요', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 15:00:00+09:00', '2026-05-07 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260502-001", "external_item_no": "2026050220215431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260502-001' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [545] order_no=2026043042412761, task_no=YS-260501-013, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260501-013', '2026043042412761',
  '송영민', '0502-2779-3202',
  '서울특별시 관악구 신림로31가길 1 (신림동, 가온빌) 2층 203호', '관악구',
  '월요일에 청소받고 싶습니다. (5/4일)', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 15:00:00+09:00', '2026-05-04 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260501-013", "external_item_no": "2026043054356151"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260501-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260501-012", "external_item_no": "2026043054356161"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260501-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [546] order_no=2026043052373281, task_no=YS-260501-011, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260501-011', '2026043052373281',
  '황우현', '010-9905-2376',
  '서울특별시 강서구 화곡로66길 105 (등촌동, 라빌라스오피스텔) 102동1003호', '강서구',
  '5월9일 토요일 / 5월 20일 수요일 / 5월23일 토요일 중 청소원합니다.', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 13:30:00+09:00', '2026-05-09 00:00:00+09:00',
  171200, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260501-011", "external_item_no": "2026043068645051"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260501-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [547] order_no=2026043053344621, task_no=YS-260501-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260501-010', '2026043053344621',
  'YU WENJUAN', '010-8461-9188',
  '서울특별시 양천구 목동중앙서로7다길 46 (목동, 삼보하우스) 204호', '양천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 11:30:00+09:00', '2026-05-08 00:00:00+09:00',
  67900, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260501-010", "external_item_no": "2026043070122201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260501-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [548] order_no=2026050156819481, task_no=YS-260501-008, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260501-008', '2026050156819481',
  '이희원', '010-6778-6849',
  '서울특별시 동작구 신대방1가길 38 (신대방동, 동작상떼빌아파트) 106동 1809호', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 13:00:00+09:00', '2026-05-16 00:00:00+09:00',
  67900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260501-008", "external_item_no": "2026050175830071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260501-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260501-007", "external_item_no": "2026050175830081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260501-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [549] order_no=2026050158130631, task_no=YS-260501-004, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260501-004', '2026050158130631',
  '최두환', '010-4400-2471',
  '경기도 고양시 덕양구 삼원로3길 20 (삼송동) 303호', '덕양구',
  '토요일 (5/23 제외) 예약원합니다.일정 관련 전화는 010-2060-3548
 로 부탁드립니다~^^', '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 12:00:00+09:00', '2026-05-09 00:00:00+09:00',
  67900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260501-004", "external_item_no": "2026050177787181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260501-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [550] order_no=2026050159608841, task_no=YS-260501-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260501-003', '2026050159608841',
  '신예진', '0502-2869-3603',
  '서울특별시 관악구 관악로15길 48 (봉천동, 봉천동오피스텔) 밀레니엄 오피스텔 207호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-31 15:00:00+09:00', NULL,
  67900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260501-003", "external_item_no": "2026050179989141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260501-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [551] order_no=2026043051645431, task_no=YS-260501-001, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260501-001', '2026043051645431',
  '이휘애', '010-2888-7496',
  '서울특별시 송파구 백제고분로19길 11-15 (잠실동) 샤인하우스 401호', '송파구',
  '010-2888-7496 연락안될시, 
 010-8591-3245 연락주세요', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-06 15:00:00+09:00', '2026-05-06 00:00:00+09:00',
  87200, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260501-001", "external_item_no": "2026043067548931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260501-001' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [552] order_no=2026043038402981, task_no=YS-260430-026, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-026', '2026043038402981',
  '이아름', '010-7774-8518',
  '서울특별시 강서구 양천로 424 (등촌동, 가양역 데시앙플렉스 지식산업센터) 927호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-30 11:00:00+09:00', '2026-05-16 00:00:00+09:00',
  239400, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=2.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-026", "external_item_no": "2026043048514651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [553] order_no=2026043038568931, task_no=YS-260430-025, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-025', '2026043038568931',
  '도여진', '010-5577-5628',
  '경기도 성남시 중원구 산성대로396번길 11 (금광동, 신흥연립) 201호', '중원구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-30 08:00:00+09:00', '2026-05-16 00:00:00+09:00',
  67900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-025", "external_item_no": "2026043048760241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [554] order_no=2026043039520731, task_no=YS-260430-024, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-024', '2026043039520731',
  '윤지영', '0502-2858-9288',
  '서울특별시 강남구 압구정로30길 17 (신사동, 이소니프라자) 701호 아트풀', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-30 10:00:00+09:00', NULL,
  325600, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=4.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 4, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-024", "external_item_no": "2026043050143121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260430-023", "external_item_no": "2026043050143131"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [555] order_no=2026043036758201, task_no=YS-260430-022, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-022', '2026043036758201',
  '심소연', '010-4020-7796',
  '서울특별시 양천구 중앙로29길 61 (신월동, 신정뉴타운롯데캐슬) 108동 2002호', '양천구',
  '꼼꼼하게부탁드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-07 08:30:00+09:00', '2026-05-07 00:00:00+09:00',
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
  '{"item_code": "YS-260430-022", "external_item_no": "2026043046061271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-021", "external_item_no": "2026043046061281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [556] order_no=2026042920555501, task_no=YS-260430-019, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-019', '2026042920555501',
  '이정은', '0502-2847-9909',
  '서울특별시 강남구 개포로128길 29-8 (일원동) 202호', '강남구',
  '공동현관 종버튼 1234 (5시반이후)', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-04 17:30:00+09:00', '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260430-019", "external_item_no": "2026042922278011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [557] order_no=2026042920826901, task_no=YS-260430-018, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-018', '2026042920826901',
  '김다은', '010-9605-8281',
  '서울특별시 강남구 자곡로11길 28 (자곡동) LH수서2단지아파트 203동 905호', '강남구',
  '원룸이라 공간이 많이 협소하며 에어컨 밑에 침대가 있습니다. 매트리스를 임의로 치울수있으나 프레임은 이동이 어려운 점 참고 부탁드립니다. 가장 빠른 일정으로 예약 부탁드립니다!', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-09 10:30:00+09:00', '2026-05-09 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-018", "external_item_no": "2026042922669431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [558] order_no=2026042922112451, task_no=YS-260430-017, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-017', '2026042922112451',
  '이종훈', '010-7211-8730',
  '서울특별시 종로구 종로18길 37 (관수동) 종로하이뷰디아트 608호', '종로구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-31 08:30:00+09:00', '2026-05-06 00:00:00+09:00',
  89900, 30000,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-017", "external_item_no": "2026042924534411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [559] order_no=2026042922138421, task_no=YS-260430-016, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-016', '2026042922138421',
  '홍애란', '010-9768-8766',
  '서울특별시 성동구 송정12바길 11 201호', '성동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-09 11:00:00+09:00', '2026-05-09 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-016", "external_item_no": "2026042924571031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [560] order_no=2026042923650201, task_no=YS-260430-015, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-015', '2026042923650201',
  '이소연', '010-3142-9945',
  '서울특별시 노원구 한글비석로 396 (상계동, 벽산아파트) 108동 304호', '노원구',
  '삼성무풍갤러리 에어컨입니다. (제품명: AF17TX772FFRS) 청소가능한 일자 말씀주시면 감사하겠습니다.', '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-30 09:00:00+09:00', '2026-05-07 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-015", "external_item_no": "2026042926701751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260430-014", "external_item_no": "2026042926701761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260430-013", "external_item_no": "2026042926701771"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [561] order_no=2026042925788771, task_no=YS-260430-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-010', '2026042925788771',
  '최민희', '010-4465-6445',
  '서울특별시 성동구 마장로 137 (상왕십리동, 텐즈힐) 2층 143호 (텐즈힐몰상가)', '성동구',
  '저녁7시원하시는데 통화해보세요', '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-04 09:00:00+09:00', '2026-05-04 00:00:00+09:00',
  92900, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-010", "external_item_no": "2026042929717451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [562] order_no=2026042926225281, task_no=YS-260430-009, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-009', '2026042926225281',
  '박지운', '010-4785-8410',
  '서울특별시 마포구 월드컵북로 481 (상암동, 상암 오벨리스크 2차) 2동831호', '마포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-05 11:00:00+09:00', '2026-05-05 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-009", "external_item_no": "2026042930349911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [563] order_no=2026042927699781, task_no=YS-260430-008, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-008', '2026042927699781',
  '이나래', '010-2344-2345',
  '서울특별시 송파구 가락로15길 32 (석촌동, 백제주택) 204호', '송파구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-09 15:30:00+09:00', '2026-05-02 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-008", "external_item_no": "2026042932547961"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [564] order_no=2026042927937891, task_no=YS-260430-007, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-007', '2026042927937891',
  '정해원', '010-9916-3212',
  '서울특별시 도봉구 덕릉로59가길 47-1 (창동, 한신빌라트) A동 601호', '도봉구',
  '01032242523 으로 전화 부탁드려요', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-11 13:00:00+09:00', '2026-05-11 00:00:00+09:00',
  89900, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-007", "external_item_no": "2026042932906011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [565] order_no=2026042928597051, task_no=YS-260430-005, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-005', '2026042928597051',
  '양민희', '010-8561-2438',
  '서울특별시 노원구 섬밭로 265 (중계동, 경남,롯데,상아아파트) 경남아파트 2동 307호', '노원구',
  '010-8561-2438', '완료',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-06 09:00:00+09:00', '2026-05-12 00:00:00+09:00',
  97100, 50000,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-005", "external_item_no": "2026042933907721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-004", "external_item_no": "2026042933907731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [566] order_no=2026042930030421, task_no=YS-260430-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-003', '2026042930030421',
  '최희지', '010-9935-7223',
  '서울특별시 강동구 올림픽로70길 61 (천호동, 두산위브센티움) 1908호', '강동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-06 15:00:00+09:00', '2026-05-04 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-003", "external_item_no": "2026042936018651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [567] order_no=2026042930566351, task_no=YS-260430-002, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260430-002', '2026042930566351',
  '이유진', '010-5718-3609',
  '서울특별시 강북구 삼양로138길 60 (수유동, 대신빌라) 101호', '강북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-04 16:45:00+09:00', '2026-05-06 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260430-002", "external_item_no": "2026042936840131"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260430-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [568] order_no=2026042913518621, task_no=YS-260429-041, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-041', '2026042913518621',
  '박진희', '010-5197-1745',
  '서울특별시 강동구 명일로 145-6 (둔촌동, 진주캐슬) 301호', '강동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, '2026-05-02 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-041", "external_item_no": "2026042911675511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [569] order_no=2026042914032721, task_no=YS-260429-040, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-040', '2026042914032721',
  '윤성희', '010-3844-7023',
  '서울특별시 동작구 여의대방로22카길 17 (신대방동) 보라매파크맨션 501호', '동작구',
  '3시가능', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-08 15:00:00+09:00', '2026-05-08 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-040", "external_item_no": "2026042912451521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-040' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260429-039", "external_item_no": "2026042912451531"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-040' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [570] order_no=2026042914213611, task_no=YS-260429-038, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-038', '2026042914213611',
  '박현화', '010-7770-3743',
  '서울특별시 은평구 통일로 780 (불광동, 미성아파트) 7동 1306호', '은평구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-09 10:00:00+09:00', '2026-05-10 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-038", "external_item_no": "2026042912726781"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-037", "external_item_no": "2026042912726791"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [571] order_no=2026042915233901, task_no=YS-260429-036, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-036', '2026042915233901',
  '김식', '010-2883-0372',
  '서울특별시 성북구 보문사길 111 (보문동6가, 보문파크뷰자이) 111동 1702A호', '성북구',
  '오후6시반이후가능', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-07 14:00:00+09:00', '2026-05-04 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-036", "external_item_no": "2026042914284041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [572] order_no=2026042916869151, task_no=YS-260429-035, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-035', '2026042916869151',
  '홍상원', '010-2480-9234',
  '서울특별시 금천구 벚꽃로6길 3 (독산동, 이랜드해가든아파트) 103동 102호', '금천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-05 12:00:00+09:00', '2026-05-05 00:00:00+09:00',
  134200, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-035", "external_item_no": "2026042916786751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-034", "external_item_no": "2026042916786761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [573] order_no=2026042916988431, task_no=YS-260429-033, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-033', '2026042916988431',
  '김미선', '010-3159-6757',
  '서울특별시 양천구 목동중앙본로7가길 81-9 (목동, 힐링하임) 502호', '양천구',
  '공동현관 종+5744  (일요일 5시에 가능)', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-03 09:00:00+09:00', '2026-05-04 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-033", "external_item_no": "2026042916967691"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [574] order_no=2026042917239911, task_no=YS-260429-032, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-032', '2026042917239911',
  '홍윤정', '010-2882-5720',
  '서울특별시 중랑구 망우로75길 19 (망우동, 중랑숲리가아파트) 104-1104호', '중랑구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-06 10:30:00+09:00', '2026-05-06 00:00:00+09:00',
  65100, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-032", "external_item_no": "2026042917350791"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-031", "external_item_no": "2026042917350801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [575] order_no=2026042917973771, task_no=YS-260429-030, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-030', '2026042917973771',
  '김균아', '010-6639-7767',
  '서울특별시 강서구 화곡로 252 (화곡동, 우장산투웨니퍼스트) 1002호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-06 17:30:00+09:00', '2026-05-07 00:00:00+09:00',
  172000, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-030", "external_item_no": "2026042918485321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [576] order_no=2026042919521431, task_no=YS-260429-029, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-029', '2026042919521431',
  '김경수', '010-2388-9194',
  '서울특별시 중구 난계로17길 48 (황학동, 청계리버팰리스) A동 403호', '중구',
  '5월1일 이번주 금요일날 오후 3시 이후로 예약 가능할까요? 
 혹은 5월5일도 일요일도 시간 관계없이 가능 합니다', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-05 13:00:00+09:00', '2026-05-05 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-029", "external_item_no": "2026042920796581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260429-028", "external_item_no": "2026042920796591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [577] order_no=2026042920486851, task_no=YS-260429-025, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-025', '2026042920486851',
  '김응건', '010-2313-3103',
  '경기도 고양시 덕양구 도래울로 86 (도내동, 도래울 센트럴 더 힐) 313동 401호', '덕양구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-05 13:00:00+09:00', '2026-05-05 00:00:00+09:00',
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
  '{"item_code": "YS-260429-025", "external_item_no": "2026042922181071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-024", "external_item_no": "2026042922181081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260429-023", "external_item_no": "2026042922181091"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [578] order_no=2026042997850621, task_no=YS-260429-022, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-022', '2026042997850621',
  '서재강', '010-6471-1170',
  '서울특별시 강서구 등촌로13가길 12 (등촌동, 엘림하우스) 403호', '강서구',
  '1시이후', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-09 11:30:00+09:00', '2026-05-09 00:00:00+09:00',
  89900, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-022", "external_item_no": "2026042992923331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [579] order_no=2026042999062391, task_no=YS-260429-021, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-021', '2026042999062391',
  '나비', '0502-2760-4025',
  '서울특별시 노원구 노원로 428 (상계동, 상계2차중앙하이츠아파트) 204동 1801호', '노원구',
  '2시', '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-04 13:00:00+09:00', '2026-05-04 00:00:00+09:00',
  112100, 20000,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-021", "external_item_no": "2026042994789551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-020", "external_item_no": "2026042994789561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [580] order_no=2026042917403661, task_no=YS-260429-019, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-019', '2026042917403661',
  '윤미애', '010-7707-7757',
  '서울특별시 동대문구 제기로 109 (청량리동) 청량리롯데캐슬하이루체 105동1305호', '동대문구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-07 13:00:00+09:00', '2026-05-07 00:00:00+09:00',
  259000, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-019", "external_item_no": "2026042917602711"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [581] order_no=2026042915097211, task_no=YS-260429-018, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-018', '2026042915097211',
  '조한례', '010-3688-9496',
  '서울특별시 서초구 사임당로17길 116 (서초동, 서초삼성래미안아파트) 102동 1101호', '서초구',
  '010-3688-9496 여기로 전화주세요', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-04 14:30:00+09:00', '2026-05-04 00:00:00+09:00',
  110100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-018", "external_item_no": "2026042914076861"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=3.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-017", "external_item_no": "2026042914076871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=3.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260429-016", "external_item_no": "2026042914076881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [582] order_no=2026042871758631, task_no=YS-260429-015, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-015', '2026042871758631',
  '신혜령', '010-2386-1156',
  '서울특별시 금천구 독산로109길 11 (독산동) A동 502호', '금천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-06 14:30:00+09:00', '2026-05-06 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-015", "external_item_no": "2026042853438581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [583] order_no=2026042878246611, task_no=YS-260429-012, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-012', '2026042878246611',
  '한지희', '010-3150-5432',
  '서울특별시 양천구 월정로 139-5 (신월동) 3층', '양천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-09 09:00:00+09:00', '2026-05-09 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-012", "external_item_no": "2026042863436891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [584] order_no=2026042878458321, task_no=YS-260429-011, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-011', '2026042878458321',
  '김성예', '010-8527-8925',
  '서울특별시 송파구 삼전로10길 26 (삼전동) 501호', '송파구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-06 12:30:00+09:00', '2026-05-06 00:00:00+09:00',
  132200, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-011", "external_item_no": "2026042863765891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [585] order_no=2026042883579941, task_no=YS-260429-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-010', '2026042883579941',
  '김명래', '010-3595-6128',
  '서울특별시 영등포구 국회대로55길 5 (영등포동7가, 여의리버파크) 304호', '영등포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-04 14:30:00+09:00', '2026-05-04 00:00:00+09:00',
  89900, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-010", "external_item_no": "2026042871420251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [586] order_no=2026042884734931, task_no=YS-260429-009, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-009', '2026042884734931',
  '이동희', '010-8955-8048',
  '경기도 의정부시 체육로 298-27 (녹양동) 506호 해오름빌딩', '의정부시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-03 13:00:00+09:00', '2026-05-03 00:00:00+09:00',
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
  '{"item_code": "YS-260429-009", "external_item_no": "2026042873093071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [587] order_no=2026042993100581, task_no=YS-260429-008, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-008', '2026042993100581',
  '극동', '010-4097-9301',
  '경기도 남양주시 오남읍 진건오남로884번길 22-59 (오남읍, 극동아파트) 103동 406호', '남양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-02 13:30:00+09:00', '2026-05-02 00:00:00+09:00',
  111470, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-008", "external_item_no": "2026042985783441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-007", "external_item_no": "2026042985783451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [588] order_no=2026042892104561, task_no=YS-260429-005, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-005', '2026042892104561',
  '김경희', '010-9451-3896',
  '서울특별시 송파구 문정로4길 22 (문정동, 벤틀리 하우스) 102동 303호', '송파구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-02 14:00:00+09:00', '2026-05-02 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-005", "external_item_no": "2026042884226711"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [589] order_no=2026042994117911, task_no=YS-260429-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-003', '2026042994117911',
  '김명규', '010-2134-8500',
  '서울특별시 관악구 봉천로4길 20 (신림동) 스카이홈 403호 김명규', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-05 15:00:00+09:00', '2026-05-05 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-003", "external_item_no": "2026042987405701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [590] order_no=2026042994815081, task_no=YS-260429-002, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260429-002', '2026042994815081',
  '김호준', '010-4055-5510',
  '서울특별시 강서구 까치산로16길 27 (화곡동, 성도빌라) 성도빌라 101호', '강서구',
  '전화안받으면문자로해주세요', '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-01 15:00:00+09:00', '2026-05-01 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260429-002", "external_item_no": "2026042988478931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260429-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [591] order_no=2026042872563571, task_no=YS-260428-048, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-048', '2026042872563571',
  '이지애', '010-5009-2328',
  '서울특별시 강남구 도곡로73길 31 (대치동) 301호', '강남구',
  '오전 9:00:00시희망', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-07 09:00:00+09:00', '2026-05-07 00:00:00+09:00',
  201300, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=3.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-048", "external_item_no": "2026042854683821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-047", "external_item_no": "2026042854683831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260428-046", "external_item_no": "2026042854683841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [592] order_no=2026042873118371, task_no=YS-260428-045, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-045', '2026042873118371',
  '강예림', '010-8201-0709',
  '서울특별시 강서구 초록마을로3길 38 (화곡동, 리젠트라움-화곡) 602호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-04 16:00:00+09:00', '2026-05-05 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-045", "external_item_no": "2026042855545431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-045' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-044", "external_item_no": "2026042855545441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-045' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [593] order_no=2026042874441171, task_no=YS-260428-039, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-039', '2026042874441171',
  '홍문기', '010-7399-8542',
  '서울특별시 서대문구 증가로4길 66 (홍은동, 아이엠하우스) 202호', '서대문구',
  '오늘 7시 이후 전화좀 주세요!!!', '완료',
  '77777777-7777-7777-7777-7777777e0003',
  '2026-05-02 11:00:00+09:00', '2026-05-02 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-039", "external_item_no": "2026042857567301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260428-038", "external_item_no": "2026042857567311"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [594] order_no=2026042874619171, task_no=YS-260428-037, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-037', '2026042874619171',
  '김영미', '010-5121-4219',
  '경기도 의정부시 용민로 304 (낙양동, 반도유보라 아이비파크) 505동204호', '의정부시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-03 11:00:00+09:00', '2026-05-03 00:00:00+09:00',
  65100, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-037", "external_item_no": "2026042857837201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-036", "external_item_no": "2026042857837211"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [595] order_no=2026042875143211, task_no=YS-260428-035, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-035', '2026042875143211',
  '조상현', '010-9301-1107',
  '경기도 양주시 옥정동로2길 20 (옥정동, 제일풍경채 옥정) 314동 508호', '양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-10 10:00:00+09:00', '2026-05-10 00:00:00+09:00',
  65100, 50000,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-035", "external_item_no": "2026042858636431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-034", "external_item_no": "2026042858636441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [596] order_no=2026042880268651, task_no=YS-260428-028, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-028', '2026042880268651',
  '이형구', '010-6727-0229',
  '서울특별시 구로구 오리로10길 19 (오류동) 303호', '구로구',
  '현관 비밀번호 8420# 입니다', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-04 11:00:00+09:00', '2026-05-04 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-028", "external_item_no": "2026042866549551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [597] order_no=2026042881470521, task_no=YS-260428-024, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-024', '2026042881470521',
  '권이현', '010-9241-5654',
  '경기도 구리시 갈매중앙로 132 (갈매동 ,LH이스트힐 206동 1202호', '구리시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-06 16:00:00+09:00', '2026-05-12 00:00:00+09:00',
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
  '{"item_code": "YS-260428-024", "external_item_no": "2026042868321961"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-023", "external_item_no": "2026042868321971"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [598] order_no=YS-260428-020, task_no=YS-260428-020, channel=현금접수, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_h' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-020', 'YS-260428-020',
  '79.0', '1036636840',
  '강남구 봉은사로 30길 22 401호', NULL,
  '결제안된거라서 현금결제해야함', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-04 12:30:00+09:00', '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260428-020", "external_item_no": "YS-260428-020"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [599] order_no=2026042759357941, task_no=YS-260428-019, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-019', '2026042759357941',
  '황현종', '010-4024-1025',
  '서울특별시 관악구 인헌1가길 32-4 (봉천동) 302호', '관악구',
  '서울 관악구 지역이고 4/29일 수요일 오전시간 가능한가요?', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-04-29 08:00:00+09:00', '2026-05-04 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-019", "external_item_no": "2026042734075351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [600] order_no=2026042759754011, task_no=YS-260428-018, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-018', '2026042759754011',
  '박근태', '0502-2742-6335',
  '서울특별시 마포구 서강로9길 26 (창전동) 301호', '마포구',
  '5월 1~3일 가능합니다', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-01 17:30:00+09:00', '2026-05-02 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-018", "external_item_no": "2026042734709421"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [601] order_no=2026042762553851, task_no=YS-260428-017, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-017', '2026042762553851',
  '박효임', '010-6656-2384',
  '서울특별시 마포구 삼개로 33 (도화동, 도화3지구우성아파트) 9동 401호', '마포구',
  '이번주중 오전에 서비스 받을수 있나요? 무풍 3구 스탠드 에어컨입니다. 마포역인근 아파트 4층입니다. 오후 3시 이전에 끝나면 됩니다.', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-01 08:30:00+09:00', '2026-05-01 00:00:00+09:00',
  110000, 20000,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-017", "external_item_no": "2026042739245591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [602] order_no=2026042742566631, task_no=YS-260428-016, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-016', '2026042742566631',
  '박찬숙', '010-9921-8180',
  '경기도 파주시 문산읍 방촌로 1720 (문산읍, 휴먼시아) 304동 704호', '파주시',
  '5월2일, 5일,8일 중에 희망합니다', '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-02 16:30:00+09:00', '2026-05-02 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["손동식", "조동욱"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-016", "external_item_no": "2026042798491441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [603] order_no=2026042749508121, task_no=YS-260428-012, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-012', '2026042749508121',
  '우혜진', '010-3168-7914',
  '경기도 구리시 건원대로 92 (인창동, 인창1단지주공아파트) 115동 305호', '구리시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-02 13:00:00+09:00', '2026-05-02 00:00:00+09:00',
  112100, 50000,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-012", "external_item_no": "2026042719232991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-011", "external_item_no": "2026042719233001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260428-010", "external_item_no": "2026042719233011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [604] order_no=2026042749781801, task_no=YS-260428-009, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-009', '2026042749781801',
  '임보연', '010-2241-4369',
  '서울특별시 종로구 충신4나길 1 (충신동) 302호(2층)', '종로구',
  '도로명주소 우측 유리문열면 3층 올라올 수 있어요', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-08 17:30:00+09:00', '2026-05-06 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-009", "external_item_no": "2026042719655811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [605] order_no=2026042759283131, task_no=YS-260428-008, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-008', '2026042759283131',
  '김민철', '010-7759-4185',
  '서울특별시 광진구 능동로16길 16 (화양동) 402호', '광진구',
  '오전일찍도 가능', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-01 15:00:00+09:00', '2026-05-09 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-008", "external_item_no": "2026042733953951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [606] order_no=2026042761988441, task_no=YS-260428-007, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-007', '2026042761988441',
  '이영재', '010-9931-9413',
  '서울특별시 광진구 자양로19길 62-7 (자양동) 헤렌하우스 202호', '광진구',
  '빠르게 청소 원함', '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-03 16:30:00+09:00', '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260428-007", "external_item_no": "2026042738329011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [607] order_no=2026042762477911, task_no=YS-260428-006, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-006', '2026042762477911',
  '오화영', '010-5788-3450',
  '서울특별시 성북구 아리랑로 75 (돈암동, 돈암코오롱하늘채) 106동 503호', '성북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-02 15:00:00+09:00', '2026-05-03 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-006", "external_item_no": "2026042739122091"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [608] order_no=2026042864218351, task_no=YS-260428-005, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-005', '2026042864218351',
  '김무진', '010-7202-1453',
  '서울특별시 성동구 청계천로10가길 84 (마장동) 501호', '성동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-03 18:00:00+09:00', '2026-05-02 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-005", "external_item_no": "2026042841944261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260428-004", "external_item_no": "2026042841944271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [609] order_no=2026042864302771, task_no=YS-260428-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-003', '2026042864302771',
  '김민채', '010-6778-1669',
  '서울특별시 관악구 조원로2길 85 (신림동) 그린주택 501호', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-06 16:00:00+09:00', '2026-05-03 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-003", "external_item_no": "2026042842080861"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [610] order_no=2026042868106061, task_no=YS-260428-002, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260428-002', '2026042868106061',
  '이승준', '010-5360-6248',
  '서울특별시 성동구 난계로 84 (하왕십리동, 왕십리풍림아이원) 108동 1504호', '성동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-03 12:00:00+09:00', '2026-05-12 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-002", "external_item_no": "2026042847814501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260428-001", "external_item_no": "2026042847814511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260428-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [611] order_no=2026042744034581, task_no=YS-260427-063, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-063', '2026042744034581',
  '김수연', '010-2576-5881',
  '서울특별시 관악구 봉천로23다길 38 (봉천동, 올림포스하우스 (OLYMPOS HOUSE)) 3층 304호', '관악구',
  '5/1 확정', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-01 14:00:00+09:00', '2026-05-01 00:00:00+09:00',
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
  '{"item_code": "YS-260427-063", "external_item_no": "2026042710716171"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-063' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-062", "external_item_no": "2026042710716181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-063' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [612] order_no=2026042745362851, task_no=YS-260427-061, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-061', '2026042745362851',
  'ICEL', '0502-2736-9856',
  '서울특별시 마포구 양화로11길 42 (서교동, 팍스타) 4층', '마포구',
  '5/8 확정 (9시-5시) 사이에만 가능', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-08 12:00:00+09:00', '2026-05-08 00:00:00+09:00',
  240200, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=2.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-061", "external_item_no": "2026042712761301"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-061' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [613] order_no=2026042746346161, task_no=YS-260427-060, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-060', '2026042746346161',
  '허지선', '010-3243-7528',
  '경기도 남양주시 와부읍 덕소로 180 (와부읍, 덕소두산위브아파트) 105동1103호', '남양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-11 13:00:00+09:00', '2026-05-11 00:00:00+09:00',
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
  '{"item_code": "YS-260427-060", "external_item_no": "2026042714298641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-060' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-059", "external_item_no": "2026042714298651"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-060' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [614] order_no=2026042746724191, task_no=YS-260427-058, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-058', '2026042746724191',
  '송미경', '010-4117-5961',
  '서울특별시 중랑구 동일로121가길 6-8 (중화동, 루체빌) 402호', '중랑구',
  '오전 9시~ 1시까지만 가능합니다. 서울입니다. 연락부탁드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-05 10:00:00+09:00', '2026-05-05 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-058", "external_item_no": "2026042714890221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-058' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [615] order_no=2026042747531441, task_no=YS-260427-057, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-057', '2026042747531441',
  '이정미', '010-3347-0340',
  '서울특별시 구로구 개봉로11길 66-4 (개봉동, 해마루) B동 502호', '구로구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-04 09:00:00+09:00', '2026-05-08 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-057", "external_item_no": "2026042716155091"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-057' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [616] order_no=2026042736667891, task_no=YS-260427-055, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-055', '2026042736667891',
  '이상준', '010-8902-4435',
  '서울특별시 강서구 양천로 595 (염창동, 염창금호타운아파트) 104동 1101호', '강서구',
  '부재시 010-2411-4367로 연락 바랍니다.', '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-04 10:00:00+09:00', '2026-05-08 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-055", "external_item_no": "2026042789581881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-054", "external_item_no": "2026042789581891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-053", "external_item_no": "2026042789581901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-052", "external_item_no": "2026042789581911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [617] order_no=2026042736850391, task_no=YS-260427-051, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-051', '2026042736850391',
  '강수진', '010-3850-1171',
  '서울특별시 중구 난계로21길 39 (황학동) 골드캐슬3 1203호', '중구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-01 12:00:00+09:00', '2026-05-01 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-051", "external_item_no": "2026042789866041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-051' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [618] order_no=2026042737457341, task_no=YS-260427-050, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-050', '2026042737457341',
  '김은경', '0502-2815-0406',
  '서울특별시 강서구 강서로 348 (내발산동, 우장산힐스테이트) 113동 503호', '강서구',
  '빠른시일내 연락주세요!!!스케줄', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-03 14:00:00+09:00', '2026-05-03 00:00:00+09:00',
  172000, 20000,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-050", "external_item_no": "2026042790795191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-050' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [619] order_no=2026042738603151, task_no=YS-260427-049, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-049', '2026042738603151',
  '홍종표', '010-7388-9876',
  '서울특별시 관악구 남부순환로194길 38 (신림동) 201호', '관악구',
  '5월 2일 ~ 5월 3일', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-03 11:00:00+09:00', '2026-05-09 00:00:00+09:00',
  70000, 10000,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-049", "external_item_no": "2026042792568591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-049' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [620] order_no=2026042739690021, task_no=YS-260427-046, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-046', '2026042739690021',
  '안승우', '010-8488-6150',
  '서울특별시 강동구 고덕로97길 100 (강일동, 강일리버파크11단지) 1101동 909호', '강동구',
  '오후6시 이후가능', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-04-29 09:00:00+09:00', '2026-05-01 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-046", "external_item_no": "2026042794196541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-045", "external_item_no": "2026042794196551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-044", "external_item_no": "2026042794196561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [621] order_no=2026042739951651, task_no=YS-260427-041, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-041', '2026042739951651',
  '김현아', '010-3353-7160',
  '서울특별시 동작구 성대로21가길 8-12 (상도동) 좌측 2층 301호', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-01 17:00:00+09:00', '2026-05-01 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-041", "external_item_no": "2026042794559211"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [622] order_no=2026042742212271, task_no=YS-260427-039, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-039', '2026042742212271',
  '조재환', '010-8864-5756',
  '서울특별시 동작구 양녕로 267 (상도1동, 민진하임) 303호', '동작구',
  '현관 벨+9876, 303호 문앞', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-02 10:00:00+09:00', '2026-05-05 00:00:00+09:00',
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
  '{"item_code": "YS-260427-039", "external_item_no": "2026042797953071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-038", "external_item_no": "2026042797953081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [623] order_no=2026042742477561, task_no=YS-260427-037, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-037', '2026042742477561',
  '김나형', '010-4893-7049',
  '서울특별시 중구 동호로25가길 52 (장충동2가) 303호', '중구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-02 16:30:00+09:00', '2026-05-05 00:00:00+09:00',
  70000, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-037", "external_item_no": "2026042798354931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [624] order_no=2026042742484921, task_no=YS-260427-036, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-036', '2026042742484921',
  '조명은', '0502-2665-0542',
  '서울특별시 동작구 동작대로29길 91 (사당동, 사당우성아파트) 201동 407호', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-01 08:00:00+09:00', '2026-05-05 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-036", "external_item_no": "2026042798365921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [625] order_no=2026042626992781, task_no=YS-260427-035, channel=네이버, items=5
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-035', '2026042626992781',
  '박재광', '010-2614-1261',
  '경기도 남양주시 퇴계원읍 경춘북로613번길 15 (퇴계원읍, 퇴계원쌍용예가) 104동1304호', '남양주시',
  '오전10시확정', '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-02 10:00:00+09:00', '2026-05-02 00:00:00+09:00',
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
  '{"item_code": "YS-260427-035", "external_item_no": "2026042674405571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-034", "external_item_no": "2026042674405581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-017", "external_item_no": "2026042674405541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-016", "external_item_no": "2026042674405551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-015", "external_item_no": "2026042674405561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [626] order_no=2026042621680991, task_no=YS-260427-033, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-033', '2026042621680991',
  '김도연', '010-2100-5611',
  '서울특별시 구로구 가마산로 162 (구로동) 401호', '구로구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-01 16:00:00+09:00', '2026-05-01 00:00:00+09:00',
  67300, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-033", "external_item_no": "2026042666366111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [627] order_no=2026042622427701, task_no=YS-260427-028, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-028', '2026042622427701',
  '권기태', '010-4000-2624',
  '서울특별시 서초구 효령로27길 8 (방배동, 주련하우스) 201호', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-04-29 14:00:00+09:00', '2026-05-01 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-028", "external_item_no": "2026042667452311"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-027", "external_item_no": "2026042667452321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [628] order_no=2026042622818941, task_no=YS-260427-025, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-025', '2026042622818941',
  '김희성', '010-3335-0183',
  '서울특별시 동대문구 이문로35길 21 (이문동, 래미안라그란데아파트) 203동 1901호', '동대문구',
  '3시30분이후!!', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-05 16:30:00+09:00', '2026-05-08 00:00:00+09:00',
  235000, 10000,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-025", "external_item_no": "2026042668034271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [629] order_no=2026042623407061, task_no=YS-260427-024, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-024', '2026042623407061',
  '함초롬', '010-2002-6454',
  '서울특별시 광진구 아차산로36길 39 (자양동, 자양7차우성아파트) 704동 2103호', '광진구',
  '오전10시희망하신다고', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-05-06 10:00:00+09:00', '2026-05-07 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-024", "external_item_no": "2026042668903611"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [630] order_no=2026042623835581, task_no=YS-260427-023, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-023', '2026042623835581',
  '황광남', '010-5031-1183',
  '서울특별시 동대문구 회기로4길 17 (제기동) 대동빌라301호', '동대문구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-02 11:00:00+09:00', '2026-05-04 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-023", "external_item_no": "2026042669536791"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-022", "external_item_no": "2026042669536801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [631] order_no=2026042623864941, task_no=YS-260427-021, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-021', '2026042623864941',
  '이정열', '010-4100-1372',
  '서울특별시 중구 동호로33길 15 (오장동, 오렌지카운티을지로) 606호', '중구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-03 16:30:00+09:00', '2026-05-03 00:00:00+09:00',
  81900, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-021", "external_item_no": "2026042669580981"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-020", "external_item_no": "2026042669580991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [632] order_no=2026042623988671, task_no=YS-260427-019, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-019', '2026042623988671',
  '이차순', '0502-2808-8199',
  '서울특별시 동대문구 답십리로38길 33 (답십리동) 202호', '동대문구',
  '어머니: 010-2251-2259
 아들 : 010-5069-7701', '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-04-29 14:00:00+09:00', '2026-05-11 00:00:00+09:00',
  116100, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-019", "external_item_no": "2026042669766031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-018", "external_item_no": "2026042669766041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [633] order_no=2026042627267611, task_no=YS-260427-014, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-014', '2026042627267611',
  '김민정', '010-9919-1470',
  '서울특별시 서초구 효령로34길 32 (방배동) 동문안 203호', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-02 13:00:00+09:00', '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260427-014", "external_item_no": "2026042674845261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [634] order_no=2026042627542301, task_no=YS-260427-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-013', '2026042627542301',
  '민태균', '010-9515-4601',
  '서울특별시 광진구 능동로27가길 9 (군자동) 201호', '광진구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-02 09:00:00+09:00', '2026-05-02 00:00:00+09:00',
  67000, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-013", "external_item_no": "2026042675284251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [635] order_no=2026042628642991, task_no=YS-260427-012, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-012', '2026042628642991',
  '이용희', '010-4555-5726',
  '서울특별시 강서구 등촌로13다길 32-34 (화곡동, 푸른풍경채) 101동 201호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-03 14:30:00+09:00', '2026-05-03 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-012", "external_item_no": "2026042677080711"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [636] order_no=2026042628705951, task_no=YS-260427-011, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-011', '2026042628705951',
  '박종수', '010-7527-3155',
  '서울특별시 송파구 송이로17길 46-18 (가락동, 아크로시티) 305호', '송파구',
  '12시희망합니다', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-11 12:00:00+09:00', '2026-05-11 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-011", "external_item_no": "2026042677189191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-010", "external_item_no": "2026042677189201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [637] order_no=2026042629259231, task_no=YS-260427-008, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-008', '2026042629259231',
  '박솔이', '010-3173-5903',
  '경기도 남양주시 진접읍 부평로48번길 140 (진접읍) 더샵남양주퍼스트시티 108동 1001호', '남양주시',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-04-28 17:00:00+09:00', '2026-05-06 00:00:00+09:00',
  113000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-008", "external_item_no": "2026042678074521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260427-007", "external_item_no": "2026042678074531"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [638] order_no=2026042730391581, task_no=YS-260427-006, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-006', '2026042730391581',
  '편미희', '010-9531-8864',
  '서울특별시 관악구 관악로25길 26 (봉천동) 205호', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-01 17:00:00+09:00', '2026-05-03 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-006", "external_item_no": "2026042779893901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [639] order_no=2026042731521821, task_no=YS-260427-004, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-004', '2026042731521821',
  '한인규', '0502-2731-3238',
  '서울특별시 강서구 마곡서로 133 709동 1101호', '강서구',
  '벽걸이 하나더  추가!!현장 결재해세요', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-06 13:00:00+09:00', '2026-05-06 00:00:00+09:00',
  65100, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-004", "external_item_no": "2026042781754621"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-003", "external_item_no": "2026042781754631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [640] order_no=2026042734273051, task_no=YS-260427-002, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260427-002', '2026042734273051',
  '허유정', '010-2349-8809',
  '서울특별시 강서구 월정로28길 28-3 (화곡동, LAHOME(라홈)) B동 403호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-03 09:00:00+09:00', '2026-05-04 00:00:00+09:00',
  87900, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260427-002", "external_item_no": "2026042785947331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260427-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [641] order_no=2026042618613081, task_no=YS-260426-042, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-042', '2026042618613081',
  '양한나', '010-9854-7825',
  '경기도 남양주시 와부읍 석실로자운길 19 (와부읍, 도곡1리마을회관) 근처농막', '남양주시',
  '빠른배송부탁드려요', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-05 08:00:00+09:00', '2026-05-09 00:00:00+09:00',
  68000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-042", "external_item_no": "2026042661860201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [642] order_no=2026042610203681, task_no=YS-260426-041, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-041', '2026042610203681',
  '한송이', '010-9901-0241',
  '서울특별시 서대문구 증가로8길 82-6 (홍은동) 에이스하임 202호', '서대문구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-05-01 13:00:00+09:00', '2026-05-04 00:00:00+09:00',
  79900, 89900,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-041", "external_item_no": "2026042649558761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [643] order_no=2026042615021301, task_no=YS-260426-040, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-040', '2026042615021301',
  '김진우', '010-8924-5603',
  '서울특별시 영등포구 대림로23길 4 (대림동) 건영타워 601호', '영등포구',
  '5월1일(금)
 5월 2일 (토)
 5월 5일 (화)
 5월 9일 (토)
 5월 16일 (토)
 
 중 희망합니다!', '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-01 11:00:00+09:00', '2026-05-01 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-040", "external_item_no": "2026042656604451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-040' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [644] order_no=2026042613622341, task_no=YS-260426-037, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-037', '2026042613622341',
  '신현수', '010-2784-9993',
  '서울특별시 영등포구 여의대방로67길 8 (여의도동, 고려빌딩) 1층 스쿱스 젤라또', '영등포구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-05 13:00:00+09:00', '2026-05-05 00:00:00+09:00',
  117000, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-037", "external_item_no": "2026042654575141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260426-036", "external_item_no": "2026042654575151"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [645] order_no=2026042696746111, task_no=YS-260426-035, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-035', '2026042696746111',
  '장기영', '010-5231-5211',
  '서울특별시 관악구 미성8길 26 (신림동) 3층 301호', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-03 15:00:00+09:00', '2026-05-03 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-035", "external_item_no": "2026042644438451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [646] order_no=2026042610570691, task_no=YS-260426-033, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-033', '2026042610570691',
  '김영희', '010-9939-7290',
  '서울특별시 관악구 청룡7길 55 (봉천동, 선경아파트) 501호', '관악구',
  '010-9939-7290', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-04 14:00:00+09:00', '2026-05-04 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-033", "external_item_no": "2026042650111571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [647] order_no=2026042611350691, task_no=YS-260426-032, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-032', '2026042611350691',
  '선다영', '010-9136-9302',
  '서울특별시 금천구 시흥대로 315 (독산동, 금천롯데캐슬골드파크4차) 롯데캐슬4차 2222호', '금천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-05 13:00:00+09:00', '2026-05-05 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-032", "external_item_no": "2026042651261341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260426-031", "external_item_no": "2026042651261351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [648] order_no=2026042612164921, task_no=YS-260426-030, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-030', '2026042612164921',
  '유승준', '010-5438-9535',
  '서울특별시 서초구 바우뫼로2길 49 (우면동) 303호', '서초구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-02 11:00:00+09:00', '2026-05-02 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-030", "external_item_no": "2026042652452701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [649] order_no=2026042615729461, task_no=YS-260426-028, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-028', '2026042615729461',
  '김해솔', '010-3408-1015',
  '서울특별시 동작구 양녕로 220 (상도동, 상도역 롯데캐슬 파크엘) 107동 404호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-01 09:00:00+09:00', NULL,
  235000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-028", "external_item_no": "2026042657635091"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [650] order_no=2026042617795101, task_no=YS-260426-025, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-025', '2026042617795101',
  '최민운', '010-5050-2601',
  '서울특별시 서초구 남부순환로350길 11 (양재동, 써밋파크) 1113호', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-04 15:00:00+09:00', '2026-05-04 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-025", "external_item_no": "2026042660658601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [651] order_no=2026042587945541, task_no=YS-260426-019, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-019', '2026042587945541',
  '최송희', '0502-2715-4881',
  '서울특별시 관악구 신사로20길 43 (신림동) 아담채 203호', '관악구',
  '문 모양 버튼 4770', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-02 12:00:00+09:00', '2026-05-04 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-019", "external_item_no": "2026042531533721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [652] order_no=2026042588740571, task_no=YS-260426-016, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-016', '2026042588740571',
  '이지은', '010-5044-6914',
  '서울특별시 중랑구 겸재로44길 22 (면목동, 성진듀얼팰리스) b동 302호', '중랑구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-02 15:30:00+09:00', '2026-05-02 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-016", "external_item_no": "2026042532643211"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260426-015", "external_item_no": "2026042532643221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [653] order_no=2026042591508851, task_no=YS-260426-010, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-010', '2026042591508851',
  '정모아', '0502-2717-1925',
  '서울특별시 강서구 강서로52길 43 (내발산동, DH647) 1003호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-02 16:30:00+09:00', '2026-05-02 00:00:00+09:00',
  235000, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-010", "external_item_no": "2026042536490161"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [654] order_no=2026042592028751, task_no=YS-260426-009, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-009', '2026042592028751',
  '김진용', '010-7579-0664',
  '서울특별시 마포구 상암산로1길 24 (상암동, 상암 월드컵파크 4단지) 412동 102호', '마포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-04 12:00:00+09:00', '2026-05-04 00:00:00+09:00',
  237000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-009", "external_item_no": "2026042537245211"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [655] order_no=2026042593362561, task_no=YS-260426-006, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-006', '2026042593362561',
  '슈슈', '010-5482-4367',
  '경기도 남양주시 별내1로 6 (별내동) 힐스테이트별내역 102-3801', '남양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-04-29 09:00:00+09:00', '2026-05-05 00:00:00+09:00',
  79900, 10000,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-006", "external_item_no": "2026042539225011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-006' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [656] order_no=2026042593506501, task_no=YS-260426-005, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-005', '2026042593506501',
  '김시연', '010-5875-5949',
  '서울특별시 영등포구 대방천로14길 8 (신길동, 신길우성3차아파트) 302동 801호', '영등포구',
  '문앞에 두고 가주세요^^', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-04-27 14:00:00+09:00', '2026-05-02 00:00:00+09:00',
  112100, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-005", "external_item_no": "2026042539442541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-004", "external_item_no": "2026042539442551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-005' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [657] order_no=2026042593831791, task_no=YS-260426-003, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-003', '2026042593831791',
  '정승아', '010-5663-5027',
  '서울특별시 종로구 창경궁로26길 17-2 (명륜4가, 유빌리지) 401호', '종로구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-02 15:00:00+09:00', '2026-05-02 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-003", "external_item_no": "2026042539933961"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-003' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [658] order_no=2026042595054001, task_no=YS-260426-001, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260426-001', '2026042595054001',
  '조민혁', '010-7656-3682',
  '서울특별시 관악구 남부순환로226길 40 (봉천동, 리치타워) 1403호', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-04-29 20:00:00+09:00', '2026-05-01 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260426-001", "external_item_no": "2026042541850201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260426-001' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [659] order_no=2026042583693061, task_no=YS-260425-047, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-047', '2026042583693061',
  '김민영', '010-2280-3696',
  '서울특별시 마포구 월드컵로19길 85 (망원동) 2층', '마포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-02 13:00:00+09:00', '2026-05-03 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260425-047", "external_item_no": "2026042525623451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-047' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [660] order_no=2026042583942841, task_no=YS-260425-046, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-046', '2026042583942841',
  '이송', '010-9694-0162',
  '서울특별시 동대문구 천호대로77나길 8 (장안동) 301호', '동대문구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-01 12:05:00+09:00', '2026-05-01 00:00:00+09:00',
  115000, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260425-046", "external_item_no": "2026042525969401"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260425-045", "external_item_no": "2026042525969411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [661] order_no=2026042584133611, task_no=YS-260425-044, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-044', '2026042584133611',
  '유동현', '010-5185-5786',
  '서울특별시 강남구 도산대로19길 21 (신사동) 303호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-01 19:00:00+09:00', '2026-05-01 00:00:00+09:00',
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
  '{"item_code": "YS-260425-044", "external_item_no": "2026042526234551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-044' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [662] order_no=2026042585367581, task_no=YS-260425-043, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-043', '2026042585367581',
  '이은규', '010-7168-1305',
  '서울특별시 동대문구 고산자로34길 70 (용두동, 청량리역 해링턴플레이스) A동 1203호', '동대문구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-01 14:00:00+09:00', '2026-05-01 00:00:00+09:00',
  237000, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260425-043", "external_item_no": "2026042527951921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-043' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [663] order_no=2026042585491181, task_no=YS-260425-042, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-042', '2026042585491181',
  '이승준', '010-8928-0391',
  '서울특별시 동대문구 회기로31나길 2 (휘경동) 107호', '동대문구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-02 18:00:00+09:00', '2026-05-01 00:00:00+09:00',
  67130, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260425-042", "external_item_no": "2026042528123691"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260425-041", "external_item_no": "2026042528123701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [664] order_no=2026042457373001, task_no=YS-260425-022, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-022', '2026042457373001',
  '김지은', '010-6487-4787',
  '서울특별시 양천구 목동동로 130 (신정동, 목동신시가지아파트14단지) 1421동402호', '양천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-01 11:30:00+09:00', '2026-05-01 00:00:00+09:00',
  65100, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260425-022", "external_item_no": "2026042477182911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [665] order_no=2026042578231161, task_no=YS-260425-020, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-020', '2026042578231161',
  '고바람', '010-9500-6327',
  '서울특별시 영등포구 대림로35길 1 (대림동) SKE그랑빌 303호', '영등포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-02 11:30:00+09:00', '2026-05-02 00:00:00+09:00',
  81900, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260425-020", "external_item_no": "2026042518010391"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-020' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [666] order_no=2026042469496971, task_no=YS-260425-016, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-016', '2026042469496971',
  '강정현', '0502-2707-3113',
  '서울특별시 영등포구 영중로8길 6 (영등포동3가, 성남빌딩) 신관 1층 104호 약국', '영등포구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-06 10:00:00+09:00', '2026-05-06 00:00:00+09:00',
  117000, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260425-016", "external_item_no": "2026042495197581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [667] order_no=2026042470228061, task_no=YS-260425-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-013', '2026042470228061',
  '김정민', '010-2383-6230',
  '서울특별시 강북구 한천로105길 23 (번동, 번동1단지주공아파트) 110동 504호', '강북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-04-29 15:00:00+09:00', '2026-05-05 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260425-013", "external_item_no": "2026042496225921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [668] order_no=2026042470274781, task_no=YS-260425-012, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260425-012', '2026042470274781',
  '손원주', '010-7929-2217',
  '서울특별시 광진구 자양로 235-9 (구의동, 명성아트빌라) 302호', '광진구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  NULL, '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260425-012", "external_item_no": "2026042496293181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260425-011", "external_item_no": "2026042496293191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260425-010", "external_item_no": "2026042496293201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260425-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [669] order_no=2026042469163591, task_no=YS-260424-111, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-111', '2026042469163591',
  '김덕용', '010-7414-4675',
  '서울특별시 금천구 독산로8길 18 (시흥동) 1층 103호', '금천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-01 16:00:00+09:00', '2026-05-01 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-111", "external_item_no": "2026042494738661"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-111' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-110", "external_item_no": "2026042494738671"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-111' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [670] order_no=2026042466926591, task_no=YS-260424-107, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-107', '2026042466926591',
  '김율', '010-5879-0023',
  '서울특별시 서초구 방배로2길 24-5 (방배동, 임광아파트) 15동 403호', '서초구',
  '송풍팬분해/층고', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-04-30 13:00:00+09:00', '2026-05-02 00:00:00+09:00',
  20000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=2.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-107", "external_item_no": "2026042491573271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-107' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [671] order_no=2026042467648441, task_no=YS-260424-106, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-106', '2026042467648441',
  '고선호', '010-5283-4218',
  '서울특별시 종로구 대학로 47 (연건동, 이화에수풀) 508호', '종로구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-09 13:00:00+09:00', '2026-05-09 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-106", "external_item_no": "2026042492619681"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-106' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [672] order_no=2026042468864621, task_no=YS-260424-099, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-099', '2026042468864621',
  '김효진', '010-7139-1800',
  '서울특별시 서초구 서초중앙로 26 (서초동, 래미안 서초유니빌) 2409호', '서초구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-04 17:00:00+09:00', '2026-05-04 00:00:00+09:00',
  158000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-099", "external_item_no": "2026042494323631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-099' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-098", "external_item_no": "2026042494323641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-099' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [673] order_no=2026042456812851, task_no=YS-260424-095, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-095', '2026042456812851',
  '박재이', '010-5417-8764',
  '서울특별시 강남구 학동로18길 50-9 (논현동, 좋은사람좋은집) 203호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-04-30 12:30:00+09:00', '2026-05-08 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-095", "external_item_no": "2026042476326241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-095' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [674] order_no=2026042460737501, task_no=YS-260424-090, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-090', '2026042460737501',
  '래샤', '010-4360-5528',
  '서울특별시 관악구 조원로 138 (신림동) 호강드림 502호', '관악구',
  '010-4630-5528 이리전화주세요!!!', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-04-27 15:00:00+09:00', '2026-05-01 00:00:00+09:00',
  74900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-090", "external_item_no": "2026042482289751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-090' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-089", "external_item_no": "2026042482289761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-090' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [675] order_no=2026042460905111, task_no=YS-260424-088, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-088', '2026042460905111',
  '지승혜', '010-4569-9654',
  '서울특별시 동대문구 망우로21길 26 (휘경동, 리브인) 102동 702호', '동대문구',
  '일요일만 가능', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-05-03 10:00:00+09:00', '2026-05-03 00:00:00+09:00',
  155000, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-088", "external_item_no": "2026042482540571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-088' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [676] order_no=2026042462560071, task_no=YS-260424-086, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-086', '2026042462560071',
  '이재준', '010-4065-0702',
  '서울특별시 용산구 청파로47나길 25 (청파동2가) 102호 씨티공인중개사 사무소', '용산구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-04-28 14:00:00+09:00', '2026-05-06 00:00:00+09:00',
  119000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-086", "external_item_no": "2026042485072471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-086' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [677] order_no=2026042462859411, task_no=YS-260424-081, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-081', '2026042462859411',
  '성민석', '010-2682-2691',
  '서울특별시 서초구 방배로 14 (방배동, 임광아파트) 5동 306호', '서초구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-04-30 11:00:00+09:00', '2026-05-01 00:00:00+09:00',
  65100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=추가선택 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-081", "external_item_no": "2026042485532341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-081' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-080", "external_item_no": "2026042485532351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-081' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [678] order_no=2026042463999281, task_no=YS-260424-076, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-076', '2026042463999281',
  '(주)홍익덕원', '010-8426-8426',
  '서울특별시 영등포구 영등포로5길 19 (양평동2가, 동아프라임밸리) 813호', '영등포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-04-30 14:30:00+09:00', '2026-05-07 00:00:00+09:00',
  154200, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-076", "external_item_no": "2026042487267521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-075", "external_item_no": "2026042487267531"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-074", "external_item_no": "2026042487267541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [679] order_no=2026042465872621, task_no=YS-260424-073, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-073', '2026042465872621',
  '김경옥', '0502-2658-9630',
  '서울특별시 구로구 디지털로32가길 65 (구로동, 컴포터블하우스Ⅰ) 904호', '구로구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-01 14:00:00+09:00', '2026-05-01 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-073", "external_item_no": "2026042490051551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-073' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [680] order_no=None, task_no=YS-260424-072, channel=현금접수, items=1
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
  NULL, '미배정',
  NULL,
  NULL, NULL,
  730000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-072", "external_item_no": "YS-260424-072"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [681] order_no=2026042340326161, task_no=YS-260424-069, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-069', '2026042340326161',
  '서현진', '010-9884-0293',
  '서울특별시 관악구 양녕로 5 (봉천동, KS타워) 502호', '관악구',
  '오전에 희망 합니다 ㅠㅠ', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-01 14:00:00+09:00', '2026-05-01 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-069", "external_item_no": "2026042351274041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-069' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [682] order_no=2026042348758271, task_no=YS-260424-064, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-064', '2026042348758271',
  '이훈재', '010-3002-7244',
  '서울특별시 강남구 역삼로4길 16 (역삼동, 성우스타우스오피스텔) 416호', '강남구',
  '오후6부탁드려요 평일', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-04-28 11:00:00+09:00', '2026-05-03 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-064", "external_item_no": "2026042363943801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-064' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [683] order_no=2026042454082581, task_no=YS-260424-063, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-063', '2026042454082581',
  '박세용', '010-3068-9283',
  '서울특별시 송파구 송파대로 111 (문정동, 파크하비오) 102동 1804호', '송파구',
  '오전 9시!!!오전9시희망 컨택완료 입니다!', '완료',
  '77777777-7777-7777-7777-7777777e0009',
  '2026-04-30 09:00:00+09:00', '2026-05-06 00:00:00+09:00',
  314000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=4.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 4, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-063", "external_item_no": "2026042472180231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-063' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [684] order_no=2026042161363501, task_no=YS-260424-052, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-052', '2026042161363501',
  '김주성', '010-9306-0097',
  '서울특별시 강남구 봉은사로29길 44-1 (논현동) 7층', '강남구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-01 13:00:00+09:00', '2026-05-01 00:00:00+09:00',
  65100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-052", "external_item_no": "2026042137923931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-051", "external_item_no": "2026042137923941"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-050", "external_item_no": "2026042137923951"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [685] order_no=2026042163429011, task_no=YS-260424-049, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-049', '2026042163429011',
  '이현정', '010-4329-6412',
  '서울특별시 금천구 독산로 133 (시흥동) 1층 가까운약국', '금천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-02 14:00:00+09:00', '2026-05-02 00:00:00+09:00',
  117000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-049", "external_item_no": "2026042140925531"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-049' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [686] order_no=2026042163601481, task_no=YS-260424-048, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-048', '2026042163601481',
  '이지나', '010-2359-8610',
  '서울특별시 중구 동호로17길 257-9 (신당동, 트레져빌) 204호', '중구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-09 13:00:00+09:00', '2026-05-09 00:00:00+09:00',
  241000, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-048", "external_item_no": "2026042141187321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-047", "external_item_no": "2026042141187331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [687] order_no=2026042164963511, task_no=YS-260424-046, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-046', '2026042164963511',
  '엄일준', '010-4492-2055',
  '서울특별시 광진구 아차산로 220 (자양동) 성수송천빌딩 501호 리영의원 건대점', '광진구',
  '영업시간만 통화 가능한 폰이라서 전화 안받으면 문자남겨주세요', '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-06 14:00:00+09:00', '2026-05-06 00:00:00+09:00',
  116100, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-046", "external_item_no": "2026042143246621"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-045", "external_item_no": "2026042143246631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=2.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-044", "external_item_no": "2026042143246641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [688] order_no=2026042043019071, task_no=YS-260424-033, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-033', '2026042043019071',
  '손지윤', '010-2235-3743',
  '경기도 남양주시 평내로 145 (평내동, e편한세상 평내 메트로원) 113동 1904호', '남양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-03 09:00:00+09:00', '2026-05-03 00:00:00+09:00',
  160000, 10000,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-033", "external_item_no": "2026042010195281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-033' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [689] order_no=2026042154642791, task_no=YS-260424-032, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-032', '2026042154642791',
  '최수진', '010-4530-2053',
  '서울특별시 용산구 백범로90라길 42 (원효로1가, 용산1차휴먼타운) 902호', '용산구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-04-29 19:00:00+09:00', '2026-05-07 00:00:00+09:00',
  81900, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-032", "external_item_no": "2026042127734341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [690] order_no=2026042329987401, task_no=YS-260424-031, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-031', '2026042329987401',
  '강은영', '0502-2870-2316',
  '경기도 하남시 덕산로 50 (덕풍동, 한솔리치빌아파트5단지) 503동 1903호', '하남시',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-04-30 16:00:00+09:00', '2026-05-01 00:00:00+09:00',
  65100, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-031", "external_item_no": "2026042335818561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-030", "external_item_no": "2026042335818571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-029", "external_item_no": "2026042335818581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-028", "external_item_no": "2026042335818591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [691] order_no=2026042332307601, task_no=YS-260424-026, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-026', '2026042332307601',
  '정보영', '010-5430-8175',
  '경기도 하남시 미사강변한강로 60 (선동, 미사강변 2차 푸르지오) 111동1802호', '하남시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-06 09:00:00+09:00', '2026-05-13 00:00:00+09:00',
  158000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-026", "external_item_no": "2026042339302201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [692] order_no=2026042332494821, task_no=YS-260424-025, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-025', '2026042332494821',
  '유다은', '010-9272-5788',
  '서울특별시 성북구 화랑로 299 (장위동, 석계역 한일노벨리아시티) 1211호(생활주택)', '성북구',
  '공동현관: 1211열쇠 0309종 (4/26 27 30) 오전오후가능', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-04-26 12:00:00+09:00', '2026-05-05 00:00:00+09:00',
  79900, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-025", "external_item_no": "2026042339578751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [693] order_no=2026042333291621, task_no=YS-260424-024, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-024', '2026042333291621',
  '최진범', '010-5005-9134',
  '서울특별시 강남구 삼성로 212 (대치동, 은마아파트) 17동 614호', '강남구',
  '17:00:00', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-02 17:00:00+09:00', '2026-05-02 00:00:00+09:00',
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
  '{"item_code": "YS-260424-024", "external_item_no": "2026042340768281"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-023", "external_item_no": "2026042340768291"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-024' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [694] order_no=2026042333354661, task_no=YS-260424-022, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-022', '2026042333354661',
  '손지윤', '010-9172-2072',
  '서울특별시 중구 필동로6길 30 (필동2가 ,푸른마을 푸른마을 105호', '중구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-04-30 14:30:00+09:00', '2026-05-07 00:00:00+09:00',
  110100, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-022", "external_item_no": "2026042340864061"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-021", "external_item_no": "2026042340864071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [695] order_no=2026042333890881, task_no=YS-260424-019, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-019', '2026042333890881',
  '조현정', '010-3289-3534',
  '서울특별시 마포구 마포대로11다길 9 (염리동, 삼성빌라) 302호', '마포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-04-28 09:00:00+09:00', '2026-05-05 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-019", "external_item_no": "2026042341673601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [696] order_no=2026042334585251, task_no=YS-260424-017, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-017', '2026042334585251',
  '조영빈', '010-5032-4874',
  '경기도 구리시 안골로63번길 38 (수택동) 구리클래시아 1207호', '구리시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0011',
  '2026-05-02 14:00:00+09:00', '2026-05-02 00:00:00+09:00',
  156000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-017", "external_item_no": "2026042342730811"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-016", "external_item_no": "2026042342730821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [697] order_no=2026042336264791, task_no=YS-260424-015, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-015', '2026042336264791',
  '조경옥', '0502-2872-9152',
  '경기도 고양시 일산서구 송산로515번길 36-8 (덕이동) 덕이동 944-15', '일산서구',
  '1시 원하심', '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-04-30 13:00:00+09:00', '2026-05-07 00:00:00+09:00',
  132200, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-015", "external_item_no": "2026042345285891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-015' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [698] order_no=2026042336478991, task_no=YS-260424-014, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-014', '2026042336478991',
  '유성호', '010-3007-7285',
  '서울특별시 금천구 시흥대로 278 (독산동, BK 힐타운) A동 604호', '금천구',
  '오전오후 상관없음', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-06 10:00:00+09:00', '2026-05-06 00:00:00+09:00',
  156000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-014", "external_item_no": "2026042345611511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260424-013", "external_item_no": "2026042345611521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [699] order_no=2026042337179441, task_no=YS-260424-012, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-012', '2026042337179441',
  '이선웅', '010-7736-0423',
  '서울특별시 서초구 서초중앙로 15 (서초동, 현대슈퍼빌) D동 406호', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-04 13:30:00+09:00', '2026-05-04 00:00:00+09:00',
  116100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-012", "external_item_no": "2026042346655101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-011", "external_item_no": "2026042346655111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [700] order_no=2026042338194391, task_no=YS-260424-009, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260424-009', '2026042338194391',
  '마음과인지', '010-3284-5636',
  '서울특별시 동작구 상도로 258 (상도동, 신혜의원) 2층 마음과인지아동청소년상담센터', '동작구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-08 09:00:00+09:00', '2026-05-08 00:00:00+09:00',
  116100, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-009", "external_item_no": "2026042348161871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=3.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-008", "external_item_no": "2026042348161881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260424-007", "external_item_no": "2026042348161891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260424-009' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

COMMIT;
