-- ============================================
-- 유솔N 시트 → Supabase tasks/task_items 마이그 (Fix #31)
-- 생성: 2026-05-19 00:11:46
-- 원본: db/migration/usol-may-v2.xlsx 시트 '시트1'
-- 시트 데이터 1143건 → tasks 769개
-- 출력 범위: skip=700, limit=전체 → 69 task
-- ============================================

BEGIN;

-- [701] order_no=2026042218749341, task_no=YS-260423-001, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260423-001', '2026042218749341',
  '정다원', '010-3048-4861',
  '경기도 양주시 삼숭로38번길 91 (삼숭동, 양주자이아파트) 402동 801호', '양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-04-25 17:30:00+09:00', '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260423-001", "external_item_no": "2026042218743841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260423-001' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [702] order_no=2026042295873861, task_no=YS-260422-041, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260422-041', '2026042295873861',
  '김현아', '010-3016-0203',
  '서울특별시 강남구 언주로100길 19 (역삼동) 102호', '강남구',
  '주말만가능', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-04-25 08:00:00+09:00', '2026-05-01 00:00:00+09:00',
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
  '{"item_code": "YS-260422-041", "external_item_no": "2026042289745181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260422-040", "external_item_no": "2026042289745191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [703] order_no=2026042297886021, task_no=YS-260422-038, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260422-038', '2026042297886021',
  '오선주', '010-8902-3792',
  '서울특별시 성동구 용답길 157-32 (용답동) 1층카펠라', '성동구',
  '가장늦은시간 고객님과 통화후', '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-04-28 20:00:00+09:00', '2026-05-03 00:00:00+09:00',
  230200, 40000,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=2.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260422-038", "external_item_no": "2026042292840221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [704] order_no=2026042298071961, task_no=YS-260422-037, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260422-037', '2026042298071961',
  '이혜강', '010-3202-5360',
  '서울특별시 서대문구 독립문로 15 (영천동) 3층', '서대문구',
  '6시이후도 됩니다', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-04-28 09:00:00+09:00', '2026-05-03 00:00:00+09:00',
  119000, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260422-037", "external_item_no": "2026042293119731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [705] order_no=2026042299636291, task_no=YS-260422-031, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260422-031', '2026042299636291',
  '국보림', '010-2468-9351',
  '서울특별시 용산구 효창원로25다길 14 (용문동) 202호', '용산구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-04-29 13:00:00+09:00', '2026-05-04 00:00:00+09:00',
  115000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260422-031", "external_item_no": "2026042295471341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-031' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [706] order_no=2026042212419191, task_no=YS-260422-030, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260422-030', '2026042212419191',
  '한동규', '010-7127-7622',
  '경기도 남양주시 다산순환로 300 (다산동, 다산 반도유보라 메이플타운) 2104동 1904호', '남양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-04-28 15:00:00+09:00', '2026-05-15 00:00:00+09:00',
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
  '{"item_code": "YS-260422-030", "external_item_no": "2026042299528261"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260422-029", "external_item_no": "2026042299528271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [707] order_no=2026042176383931, task_no=YS-260422-026, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260422-026', '2026042176383931',
  '강성대', '010-9898-2337',
  '서울특별시 구로구 구일로2길 29 (구로동, 노블리안아파트) 1동 804호', '구로구',
  '공동현관 비번 : 종 누르고 2026', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-04-27 10:00:00+09:00', '2026-05-07 00:00:00+09:00',
  314000, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=4.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 4, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260422-026", "external_item_no": "2026042160262201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [708] order_no=2026042289382471, task_no=YS-260422-017, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260422-017', '2026042289382471',
  '류여정', '010-8709-5090',
  '서울특별시 광진구 동일로18길 10 (자양동, 한영해시안아파트) 508호', '광진구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-04-30 09:00:00+09:00', '2026-05-12 00:00:00+09:00',
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
  '{"item_code": "YS-260422-017", "external_item_no": "2026042279838361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260422-016", "external_item_no": "2026042279838371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260422-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [709] order_no=2026042155589181, task_no=YS-260421-013, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260421-013', '2026042155589181',
  '이예민', '010-9733-9750',
  '서울특별시 서초구 서초중앙로29길 28 (반포동, 반포미도아파트) 305-1309', '서초구',
  '송풍팬분해', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-04-30 09:30:00+09:00', '2026-05-06 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260421-013", "external_item_no": "2026042129167351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260421-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [710] order_no=2026042043157071, task_no=YS-260420-186, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-186', '2026042043157071',
  '김은하', '010-5405-4816',
  '서울특별시 용산구 이촌로29길 21-7 (한강로3가, 한강로 우림필유) 103-802', '용산구',
  '전화를 안 받을경우 문자 남겨주세요', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-04-23 09:30:00+09:00', '2026-05-07 00:00:00+09:00',
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
  '{"item_code": "YS-260420-186", "external_item_no": "2026042010395061"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-186' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-185", "external_item_no": "2026042010395071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-186' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [711] order_no=2026042044020911, task_no=YS-260420-184, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-184', '2026042044020911',
  '박주영', '010-2810-8039',
  '서울특별시 성동구 뚝섬로 341 (성수동1가, 한스포레) 3층 18호', '성동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-09 13:30:00+09:00', '2026-05-09 00:00:00+09:00',
  83900, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-184", "external_item_no": "2026042011658671"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-184' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [712] order_no=2026042044410121, task_no=YS-260420-183, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-183', '2026042044410121',
  '황선영', '010-9011-2795',
  '서울특별시 금천구 시흥대로 315 (독산동, 금천롯데캐슬골드파크4차) 613호', '금천구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-04-28 08:00:00+09:00', '2026-05-06 00:00:00+09:00',
  81900, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-183", "external_item_no": "2026042012225981"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-183' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [713] order_no=2026042045935791, task_no=YS-260420-177, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-177', '2026042045935791',
  '채종수', '010-2498-5414',
  '서울특별시 영등포구 영등포로62길 30 (영등포동) 202호', '영등포구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-04-28 08:00:00+09:00', '2026-05-03 00:00:00+09:00',
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
  '{"item_code": "YS-260420-177", "external_item_no": "2026042014397721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-177' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-176", "external_item_no": "2026042014397731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-177' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [714] order_no=2026042046207021, task_no=YS-260420-175, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-175', '2026042046207021',
  '김진성', '010-2759-3073',
  '서울특별시 영등포구 당산로31길 18-10 (당산동3가, 밀레니엄) 502호', '영등포구',
  '청소뿐만 아니라 분해,조립에도 실수 없는 베테랑 기사님 모십니다!! 잘 부탁드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-01 11:00:00+09:00', '2026-05-01 00:00:00+09:00',
  68000, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-175", "external_item_no": "2026042014788731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-175' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [715] order_no=2026042047497991, task_no=YS-260420-172, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-172', '2026042047497991',
  '박정은', '010-9491-3369',
  '서울특별시 서초구 명달로 42 (서초동, 서초예성빌) 402호', '서초구',
  '18:00:00', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-03 18:00:00+09:00', '2026-05-03 00:00:00+09:00',
  81900, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-172", "external_item_no": "2026042016670631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-172' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [716] order_no=2026042028256161, task_no=YS-260420-170, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-170', '2026042028256161',
  '양재현', '010-6690-7117',
  '서울특별시 영등포구 양평로30가길 15 (양평동6가, 동양아파트) 103동 301호', '영등포구',
  '저녁7시 희망', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-06 18:00:00+09:00', '2026-05-06 00:00:00+09:00',
  322000, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=4.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 4, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-170", "external_item_no": "2026042077804761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-170' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [717] order_no=2026042031313751, task_no=YS-260420-169, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-169', '2026042031313751',
  '정승민', '010-9318-2231',
  '경기도 고양시 일산동구 백석로 119 (백석동, 백송마을2단지아파트) 210-903', '일산동구',
  '오전오후둘다가능', '완료',
  '77777777-7777-7777-7777-7777777e0015',
  '2026-04-30 13:30:00+09:00', '2026-05-02 00:00:00+09:00',
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
  '{"item_code": "YS-260420-169", "external_item_no": "2026042082367091"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-169' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-168", "external_item_no": "2026042082367101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-169' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [718] order_no=2026042041575301, task_no=YS-260420-162, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-162', '2026042041575301',
  '손승명', '010-9707-9936',
  '서울특별시 중구 퇴계로 336-12 (광희동2가) 102호', '중구',
  '오전11시만 가능', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-06 09:00:00+09:00', '2026-05-06 00:00:00+09:00',
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
  '{"item_code": "YS-260420-162", "external_item_no": "2026042098049271"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-162' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [719] order_no=2026042041927381, task_no=YS-260420-161, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-161', '2026042041927381',
  '신지혜', '010-2231-8530',
  '서울특별시 강서구 화곡로35길 1 (화곡동) 1층신지네일', '강서구',
  '오전일찍희망', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-04 09:00:00+09:00', '2026-05-04 00:00:00+09:00',
  117000, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-161", "external_item_no": "2026042098575191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-161' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [720] order_no=2026042029900311, task_no=YS-260420-154, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-154', '2026042029900311',
  '김만필', '0502-2742-5158',
  '서울특별시 용산구 신흥로30길 21 (용산동2가) 단독주택 1층', '용산구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-04-24 08:30:00+09:00', '2026-05-08 00:00:00+09:00',
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
  '{"item_code": "YS-260420-154", "external_item_no": "2026042080305291"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-154' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [721] order_no=2026042030728911, task_no=YS-260420-153, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-153', '2026042030728911',
  '박단비', '010-6475-7106',
  '서울특별시 강동구 성안로25길 54 (천호동, 다성이즈빌) 1002호', '강동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-04-29 09:00:00+09:00', '2026-05-03 00:00:00+09:00',
  81900, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-153", "external_item_no": "2026042081525871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-153' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [722] order_no=2026042031628421, task_no=YS-260420-150, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-150', '2026042031628421',
  '송민호', '010-4262-7688',
  '서울특별시 마포구 연남로 52 (연남동, 코오롱하늘채아파트) 102동 103호', '마포구',
  '금요일 낮에 시간 가능합니다. 전화통화 어려울 수 있어서 문자로 먼저 연락바랍니다.', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-01 16:30:00+09:00', '2026-05-01 00:00:00+09:00',
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
  '{"item_code": "YS-260420-150", "external_item_no": "2026042082841381"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-150' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-149", "external_item_no": "2026042082841391"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-150' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260420-148", "external_item_no": "2026042082841401"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-150' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [723] order_no=2026042031992201, task_no=YS-260420-146, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-146', '2026042031992201',
  '이영찬', '010-9386-9309',
  '경기도 구리시 응달말로19번길 13-23 (인창동) 501호', '구리시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0004',
  '2026-05-11 09:00:00+09:00', '2026-05-10 00:00:00+09:00',
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
  '{"item_code": "YS-260420-146", "external_item_no": "2026042083392411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-146' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [724] order_no=2026042034250851, task_no=YS-260420-141, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-141', '2026042034250851',
  '전연경', '010-9605-9610',
  '서울특별시 도봉구 도봉로180길 6-83 (도봉동, 삼환도봉아파트) 4동 607호', '도봉구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-04-24 08:00:00+09:00', '2026-05-01 00:00:00+09:00',
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
  '{"item_code": "YS-260420-141", "external_item_no": "2026042086812191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-141' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [725] order_no=2026042036204301, task_no=YS-260420-139, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-139', '2026042036204301',
  '정현진', '010-8273-3550',
  '경기도 남양주시 사릉로 16-11 (금곡동) 단층', '남양주시',
  '미리 연락주세요', '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-04-29 16:00:00+09:00', '2026-05-06 00:00:00+09:00',
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
  '{"item_code": "YS-260420-139", "external_item_no": "2026042089843391"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-139' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [726] order_no=2026042036458131, task_no=YS-260420-138, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-138', '2026042036458131',
  '박정훈', '010-5321-8986',
  '서울특별시 금천구 가산로 99 (가산동, 두산위브아파트) 112동 405호', '금천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-04-25 10:00:00+09:00', '2026-05-02 00:00:00+09:00',
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
  '{"item_code": "YS-260420-138", "external_item_no": "2026042090223901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-138' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [727] order_no=2026042040275421, task_no=YS-260420-130, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-130', '2026042040275421',
  '박지현', '010-5395-3090',
  '서울특별시 강서구 강서로17가길 46 (화곡동, 중앙하이츠아파트) 1동1110호', '강서구',
  '문앞에 두고 가주세요', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-04-26 09:00:00+09:00', '2026-05-01 00:00:00+09:00',
  115000, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-130", "external_item_no": "2026042096100411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-130' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [728] order_no=2026042022397971, task_no=YS-260420-123, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-123', '2026042022397971',
  '이철진', '0502-2642-9978',
  '서울특별시 관악구 신림동5나길 42 (신림동, 삼성오피스텔) 삼성오피스텔 307호', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-01 13:00:00+09:00', '2026-05-01 00:00:00+09:00',
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
  '{"item_code": "YS-260420-123", "external_item_no": "2026042068892421"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-123' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [729] order_no=2026042027498351, task_no=YS-260420-113, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-113', '2026042027498351',
  '김하은', '010-2514-9809',
  '서울특별시 양천구 중앙로48길 68 (신정동, 건향파크빌7차B) 201호', '양천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-04-26 16:30:00+09:00', '2026-05-04 00:00:00+09:00',
  83900, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-113", "external_item_no": "2026042076628411"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-113' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [730] order_no=2026042027586021, task_no=YS-260420-112, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-112', '2026042027586021',
  '주현정', '010-3220-9348',
  '서울특별시 강남구 학동로55길 12-7 (청담동) 304호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-04-26 10:00:00+09:00', '2026-05-10 00:00:00+09:00',
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
  '{"item_code": "YS-260420-112", "external_item_no": "2026042076766351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-112' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [731] order_no=2026041914097961, task_no=YS-260420-108, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-108', '2026041914097961',
  '신승엽', '010-3538-6055',
  '서울특별시 강남구 학동로 405 (청담동, 청담래미안아파트) 101동 1205호', '강남구',
  '4시이후희망', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-04-25 18:00:00+09:00', '2026-05-09 00:00:00+09:00',
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
  '{"item_code": "YS-260420-108", "external_item_no": "2026041955852331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-108' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [732] order_no=2026041915093611, task_no=YS-260420-107, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-107', '2026041915093611',
  '최예림', '010-7644-5730',
  '서울특별시 서초구 사평대로53길 65-11 (반포동) TJ하우스 3층 401호', '서초구',
  '저녘7시희망!!!!', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-04-27 13:00:00+09:00', '2026-05-03 00:00:00+09:00',
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
  '{"item_code": "YS-260420-107", "external_item_no": "2026041957312841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-107' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [733] order_no=2026041918752191, task_no=YS-260420-095, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-095', '2026041918752191',
  '이선정', '010-5314-1659',
  '서울특별시 관악구 조원로 25 (신림동) 힐스테이트관악뉴포레 104동1004호', '관악구',
  '주말만 가능', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-04-26 13:00:00+09:00', '2026-05-03 00:00:00+09:00',
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
  '{"item_code": "YS-260420-095", "external_item_no": "2026041962954471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-095' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-094", "external_item_no": "2026041962954481"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-095' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [734] order_no=2026041920203841, task_no=YS-260420-089, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-089', '2026041920203841',
  '김진원', '010-3908-9505',
  '서울특별시 서초구 사평대로 154 (반포동, 현대동궁아파트) 101-211', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-04-28 11:00:00+09:00', '2026-05-02 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-089", "external_item_no": "2026041965317921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-089' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [735] order_no=2026041920389841, task_no=YS-260420-088, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-088', '2026041920389841',
  '정연주', '010-7777-1372',
  '서울특별시 광진구 능동로50길 28-6 (중곡동) 401호', '광진구',
  '저녘 7시 희망!!퇴근후 해야함!!', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-04-27 10:00:00+09:00', '2026-05-09 00:00:00+09:00',
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
  '{"item_code": "YS-260420-088", "external_item_no": "2026041965627781"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-088' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [736] order_no=2026041920658111, task_no=YS-260420-087, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-087', '2026041920658111',
  '김재영', '010-9583-0228',
  '경기도 하남시 덕풍서로 80 (덕풍동, 빌리브하남) 611A호', '하남시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  '2026-05-03 14:00:00+09:00', '2026-05-03 00:00:00+09:00',
  79900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-087", "external_item_no": "2026041966072121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-087' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [737] order_no=2026041911419411, task_no=YS-260420-076, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-076', '2026041911419411',
  '김종성', '010-6522-5971',
  '서울특별시 마포구 와우산로29길 51 (서교동) 지하 1층', '마포구',
  '낮12시희망', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-04-30 13:30:00+09:00', '2026-05-01 00:00:00+09:00',
  119000, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-076", "external_item_no": "2026041951934331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260420-075", "external_item_no": "2026041951934341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [738] order_no=2026041911847481, task_no=YS-260420-071, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-071', '2026041911847481',
  '박준용', '010-7678-8317',
  '서울특별시 강남구 테헤란로53길 47 (역삼동, 공간1차) 401호', '강남구',
  '부재시 문앞에 놓아주세요.', '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-02 08:30:00+09:00', '2026-05-02 00:00:00+09:00',
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
  '{"item_code": "YS-260420-071", "external_item_no": "2026041952560901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-071' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [739] order_no=2026041912950941, task_no=YS-260420-059, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-059', '2026041912950941',
  '김수지', 'ㄹ',
  '서울특별시 강동구 상암로3길 77 (암사동, 삼성 광나루 아파트) 102동 2002호', '강동구',
  '배송 전 미리 연락해 주세요', '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-04-29 13:00:00+09:00', '2026-05-01 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-059", "external_item_no": "2026041954166701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-059' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [740] order_no=2026041913109061, task_no=YS-260420-058, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-058', '2026041913109061',
  '차은희', '010-4644-0163',
  '서울특별시 광진구 자양번영로8길 15-9 (자양동) 302호', '광진구',
  '내일다시연락', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-04-26 14:00:00+09:00', '2026-05-01 00:00:00+09:00',
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
  '{"item_code": "YS-260420-058", "external_item_no": "2026041954402111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-058' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-057", "external_item_no": "2026041954402121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-058' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [741] order_no=2026041913444181, task_no=YS-260420-056, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-056', '2026041913444181',
  '이주연', '010-2717-3617',
  '경기도 남양주시 오남읍 진건오남로 529-3 (오남읍) 해솔빌라404호', '남양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-02 11:00:00+09:00', '2026-05-02 00:00:00+09:00',
  79900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-056", "external_item_no": "2026041954890401"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-056' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [742] order_no=2026041998444741, task_no=YS-260420-039, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-039', '2026041998444741',
  '김다솜', '010-8191-3714',
  '서울특별시 강남구 선릉로72길 45 (대치동, 풍림아이원아파트) 201동 101호', '강남구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  '2026-05-04 08:00:00+09:00', '2026-05-04 00:00:00+09:00',
  109100, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-039", "external_item_no": "2026041947580821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260419-068", "external_item_no": "2026041947580831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [743] order_no=2026041999642321, task_no=YS-260420-029, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-029', '2026041999642321',
  '김영석', '010-3384-8504',
  '서울특별시 구로구 중앙로 101 (고척동, 청솔우성아파트) 101동 303호', '구로구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  '2026-05-07 09:00:00+09:00', '2026-05-07 00:00:00+09:00',
  65100, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-029", "external_item_no": "2026041949332721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-028", "external_item_no": "2026041949332731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260420-026", "external_item_no": "2026041949332751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260419-059", "external_item_no": "2026041949332741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [744] order_no=2026041992504261, task_no=YS-260420-021, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-021', '2026041992504261',
  '이세형', '010-9178-9159',
  '서울특별시 성북구 성북로4길 52 (돈암동, 한신한진아파트) 209동 719호', '성북구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0014',
  '2026-04-27 09:00:00+09:00', '2026-05-08 00:00:00+09:00',
  62100, 20000,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-021", "external_item_no": "2026041938944671"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-020", "external_item_no": "2026041938944681"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [745] order_no=2026041995881681, task_no=YS-260420-012, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260420-012', '2026041995881681',
  '고성자', '010-7280-2014',
  '서울특별시 중랑구 숙선옹주로9길 25 (묵동, 세방아파트) 101-1103', '중랑구',
  '11시', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-04-28 11:00:00+09:00', '2026-05-02 00:00:00+09:00',
  115000, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260420-012", "external_item_no": "2026041943855831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260420-012' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [746] order_no=2026041912462081, task_no=YS-260419-094, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260419-094', '2026041912462081',
  '신기원', '010-3861-7120',
  '서울특별시 강남구 테헤란로14길 8 (역삼동, 강남역두산위브센티움) 1206호', NULL,
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, '2026-05-02 00:00:00+09:00',
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
  '{"item_code": "YS-260419-094", "external_item_no": "2026041953452761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-094' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [747] order_no=2026041912542971, task_no=YS-260419-093, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260419-093', '2026041912542971',
  '김기남', '010-6275-0373',
  '서울특별시 서대문구 연희로11마길 10-4 (연희동) 좌측나무계단울타리', '서대문구',
  '좌측 나무 계단 울타리문을 열고 조금만 들어오시면 현관입니다. 감사합니다.', '완료',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, '2026-05-02 00:00:00+09:00',
  10000, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260419-093", "external_item_no": "2026041953571841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-093' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260419-092", "external_item_no": "2026041953571831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-093' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260419-091", "external_item_no": "2026041953571821"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-093' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [748] order_no=2026041913860871, task_no=YS-260419-077, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260419-077', '2026041913860871',
  '이상화', '010-9005-3688',
  '서울특별시 영등포구 당산로42길 16 (당산동4가, 당산현대5차아파트) 511동 1303호', NULL,
  '이번주 수요일 토요일 일요일 중에 가능하면 부탁드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  NULL, '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260419-077", "external_item_no": "2026041955502891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-077' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260419-076", "external_item_no": "2026041955502901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-077' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [749] order_no=2026041913969811, task_no=YS-260419-075, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260419-075', '2026041913969811',
  '배승오', '010-6500-7881',
  '서울특별시 서초구 서초중앙로 200 (서초동, 삼풍아파트) 1동 1005호', NULL,
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  NULL, '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260419-075", "external_item_no": "2026041955663971"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-075' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [750] order_no=2026041999645341, task_no=YS-260419-055, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260419-055', '2026041999645341',
  '임진영', '010-2492-0216',
  '서울특별시 강남구 테헤란로83길 19 (삼성동) 현대썬앤빌삼성역 905호', NULL,
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  NULL, '2026-05-08 00:00:00+09:00',
  79900, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260419-055", "external_item_no": "2026041949337131"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [751] order_no=2026041910069321, task_no=YS-260419-054, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260419-054', '2026041910069321',
  '김예슬', '010-8285-9887',
  '서울특별시 광진구 동일로78길 7 (중곡동) 201호', NULL,
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, '2026-05-01 00:00:00+09:00',
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
  '{"item_code": "YS-260419-054", "external_item_no": "2026041949956371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-054' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [752] order_no=2026041886020631, task_no=YS-260419-013, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260419-013', '2026041886020631',
  '김수혁', '010-3797-4097',
  '경기도 남양주시 오남읍 진건오남로 778 (오남읍, 선일프라자) 109호 가장맛있는족발', '남양주시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, '2026-05-05 00:00:00+09:00',
  75100, 60000,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260419-013", "external_item_no": "2026041829043541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260419-011", "external_item_no": "2026041829043561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [753] order_no=2026041887367591, task_no=YS-260419-008, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260419-008', '2026041887367591',
  '조성준', '010-2745-9185',
  '서울특별시 서초구 효령로 391 (서초동, 서초그랑자이) 102-2206', '서초구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  NULL, '2026-05-01 00:00:00+09:00',
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
  '{"item_code": "YS-260419-008", "external_item_no": "2026041831177731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260419-007", "external_item_no": "2026041831177741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260419-008' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [754] order_no=2026041878411971, task_no=YS-260418-030, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260418-030', '2026041878411971',
  '이도연', '010-8887-5808',
  '서울특별시 은평구 녹번로 53-12 (녹번동, MK109) 401호', '은평구',
  '공동 현관 비번 종2187', '완료',
  '77777777-7777-7777-7777-7777777e0015',
  NULL, '2026-05-01 00:00:00+09:00',
  81900, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260418-030", "external_item_no": "2026041818114041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260418-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [755] order_no=2026041879189661, task_no=YS-260418-027, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260418-027', '2026041879189661',
  '오형석', '010-9047-6589',
  '서울특별시 송파구 백제고분로48나길 7-13 (방이동) 202호 (대건빌라)', '송파구',
  '5월2일 토요일 희망합니다', '완료',
  '77777777-7777-7777-7777-7777777e0016',
  NULL, '2026-05-02 00:00:00+09:00',
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
  '{"item_code": "YS-260418-027", "external_item_no": "2026041819213751"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260418-027' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [756] order_no=2026041872860741, task_no=YS-260418-011, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260418-011', '2026041872860741',
  '강아름', '010-6590-9089',
  '서울특별시 관악구 남부순환로 1622 (신림동) 1층 바른침한의원', '관악구',
  '문 앞에 놓아주세요', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  NULL, '2026-05-02 00:00:00+09:00',
  154200, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260418-011", "external_item_no": "2026041810256441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260418-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260418-010", "external_item_no": "2026041810256451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260418-011' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [757] order_no=2026041762124311, task_no=YS-260417-051, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260417-051', '2026041762124311',
  '변다혜', '010-6390-7775',
  '서울특별시 양천구 목동서로 280 (신정동, 목동신시가지아파트8단지) 810동 1006호', '양천구',
  '5시이후가능', '완료',
  '77777777-7777-7777-7777-7777777e0005',
  NULL, '2026-05-03 00:00:00+09:00',
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
  '{"item_code": "YS-260417-051", "external_item_no": "2026041784562061"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260417-051' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260417-050", "external_item_no": "2026041784562071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260417-051' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [758] order_no=2026041755136791, task_no=YS-260417-045, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260417-045', '2026041755136791',
  '성효지안', '010-9838-0712',
  '서울특별시 서대문구 신촌로7안길 54 (창천동, 언제나미소) 306', '서대문구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0015',
  NULL, '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260417-045", "external_item_no": "2026041774102961"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260417-045' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [759] order_no=2026041641817261, task_no=YS-260417-014, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260417-014', '2026041641817261',
  '조남규', '010-8834-7178',
  '서울특별시 중랑구 봉우재로70길 24-6 (망우동) 서울시 중랑구 망우3동 459-50호', '중랑구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0020',
  NULL, '2026-05-01 00:00:00+09:00',
  134200, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260417-014", "external_item_no": "2026041653644161"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260417-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [760] order_no=2026041747052351, task_no=YS-260417-007, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260417-007', '2026041747052351',
  '최호린', '010-8538-3831',
  '서울특별시 양천구 목동중앙로13나길 40 (목동) 글로리캐슬 401호', '양천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, '2026-05-04 00:00:00+09:00',
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
  '{"item_code": "YS-260417-007", "external_item_no": "2026041761831111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260417-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260417-006", "external_item_no": "2026041761831121"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260417-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260417-004", "external_item_no": "2026041761831141"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260417-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [761] order_no=2026041633495701, task_no=YS-260416-072, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260416-072', '2026041633495701',
  '정소영', '010-5065-0322',
  '서울특별시 용산구 이촌로 248 (이촌동, 한강맨션) 24동 201호', '용산구',
  '오전부탁드립니다', '완료',
  '77777777-7777-7777-7777-7777777e0008',
  NULL, '2026-05-02 00:00:00+09:00',
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
  '{"item_code": "YS-260416-072", "external_item_no": "2026041641459361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260416-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260416-071", "external_item_no": "2026041641459371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260416-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [762] order_no=2026041634358211, task_no=YS-260416-067, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260416-067', '2026041634358211',
  '김예지', '0502-2701-9983',
  '서울특별시 강서구 화곡로54길 43 (화곡동) 강서금호어울림퍼스티어 102동 1001호', '강서구',
  '오후2시이후 컨택!!!!오후2시이후', '완료',
  '77777777-7777-7777-7777-7777777e0019',
  NULL, '2026-05-02 00:00:00+09:00',
  113000, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260416-067", "external_item_no": "2026041642758331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260416-067' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [763] order_no=2026041596010301, task_no=YS-260416-036, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260416-036', '2026041596010301',
  '박재경', '010-9444-0657',
  '서울특별시 중구 다산로 32 (신당동, 남산타운) 8동 705 호', '중구',
  '4월27일,28일
  5월4일, 6일,7일 가능합니다
 시간은 오전에 해 주셨으면 합니다
 연락주세요', '완료',
  '77777777-7777-7777-7777-7777777e0020',
  '2026-04-27 11:00:00+09:00', '2026-05-04 00:00:00+09:00',
  108100, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260416-036", "external_item_no": "2026041589411231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260416-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260416-035", "external_item_no": "2026041589411241"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260416-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [764] order_no=2026041619767311, task_no=YS-260416-014, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260416-014', '2026041619767311',
  '이서연', '010-6325-0848',
  '서울특별시 관악구 신림로63길 20 (신림동, 다솜) 1203호', '관악구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-04-25 10:00:00+09:00', '2026-05-05 00:00:00+09:00',
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
  '{"item_code": "YS-260416-014", "external_item_no": "2026041620366641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260416-014' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [765] order_no=2026041591778511, task_no=YS-260415-106, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260415-106', '2026041591778511',
  '김민지', '010-2051-0709',
  '경기도 구리시 안골로63번길 38 (수택동, 클래시아 구리 오피스텔) 1626호', '구리시',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, '2026-05-06 00:00:00+09:00',
  79000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260415-106", "external_item_no": "2026041582953071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260415-106' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260415-105", "external_item_no": "2026041582953081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260415-106' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260415-104", "external_item_no": "2026041582953091"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260415-106' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [766] order_no=2026041592769971, task_no=YS-260415-101, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260415-101', '2026041592769971',
  '이호용', '0502-2868-9553',
  '서울특별시 금천구 시흥대로145길 60-6 (가산동, 해오름) 506호', '금천구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  NULL, '2026-05-02 00:00:00+09:00',
  59000, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260415-101", "external_item_no": "2026041584504071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260415-101' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [767] order_no=2026041594049611, task_no=YS-260415-039, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260415-039', '2026041594049611',
  '박숙영', '0502-2694-5830',
  '서울특별시 강서구 양천로 125 (방화동, 장미아파트) 102동 1507호', '강서구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-01 08:00:00+09:00', '2026-05-01 00:00:00+09:00',
  108100, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260415-039", "external_item_no": "2026041586463961"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260415-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260415-038", "external_item_no": "2026041586463971"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260415-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [768] order_no=2026041474176631, task_no=YS-260415-029, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260415-029', '2026041474176631',
  '최진영', '010-7344-1482',
  '서울특별시 강동구 진황도로 151-5 (둔촌동, KNP이스트빌) 701호', '강동구',
  NULL, '완료',
  '77777777-7777-7777-7777-7777777e0016',
  NULL, '2026-05-09 00:00:00+09:00',
  59000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260415-029", "external_item_no": "2026041455940491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260415-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260415-028", "external_item_no": "2026041455940501"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260415-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260415-027", "external_item_no": "2026041455940511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260415-029' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [769] order_no=2026040883182061, task_no=YS-260408-017, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260408-017', '2026040883182061',
  '이지현', '010-3315-8193',
  '서울특별시 동대문구 장안벚꽃로 107 (장안동, 장안현대홈타운) 102동 305호', '동대문구',
  '일정은 주말로 부탁 드립니다.', '완료',
  '77777777-7777-7777-7777-7777777e0007',
  NULL, '2026-05-09 00:00:00+09:00',
  50500, 20000,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260408-017", "external_item_no": "2026040869843721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260408-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260408-016", "external_item_no": "2026040869843731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260408-017' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

COMMIT;
