-- ============================================
-- 유솔N 시트 → Supabase tasks/task_items 마이그 (Fix #31)
-- 생성: 2026-05-18 22:18:49
-- 원본: db/migration/usol-may-v2.xlsx 시트 '시트1'
-- 시트 데이터 1143건 → tasks 769개
-- DRY RUN 한도: 100 task
-- ============================================

BEGIN;

-- [1] order_no=2026051849549701, task_no=YS-260518-092, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-092', '2026051849549701',
  '이호천', '010-2405-0122',
  '서울특별시 송파구 올림픽로 135 (잠실동, 리센츠) 252동 904호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  124500, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-092", "external_item_no": "2026051814838071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-092' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [2] order_no=2026051618675031, task_no=YS-260518-091, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-091', '2026051618675031',
  '백시안', '010-5145-2319',
  '경기도 남양주시 퇴계원읍 경춘북로558번길 10 (퇴계원읍, 엘리시아) 103동 1003호', '남양주시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
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
  '{"item_code": "YS-260518-091", "external_item_no": "2026051658662881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-091' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [3] order_no=2026051739922261, task_no=YS-260518-088, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-088', '2026051739922261',
  '이정옥', '010-3382-5644',
  '인천광역시 중구 영종진로11번길 13 (중산동) 202호', '중구',
  '5월21일 희망합니다', '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  287500, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-088", "external_item_no": "2026051789774201"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-088' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [4] order_no=2026051847806571, task_no=YS-260518-087, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-087', '2026051847806571',
  '윤정우', '010-6889-1600',
  '서울특별시 용산구 백범로 313 (효창동, 용산 롯데캐슬 센터포레) 102동 1904호', '용산구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 10:00:00+09:00', NULL,
  189500, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-087", "external_item_no": "2026051812185551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-087' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [5] order_no=2026051849456551, task_no=YS-260518-086, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-086', '2026051849456551',
  '공영미', '010-5554-5313',
  '서울특별시 광진구 자양로50길 35 (구의동) 2층', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-086", "external_item_no": "2026051814694721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-086' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [6] order_no=2026051849465071, task_no=YS-260518-085, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-085', '2026051849465071',
  '주상은', '010-3002-0799',
  '서울특별시 서초구 효령로27길 59 (방배동, 도브홈) 302호', '서초구',
  '공동출입문 종2580이고 문앞에 놓아주세요!', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  79900, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-085", "external_item_no": "2026051814706681"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-085' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [7] order_no=2026051849995741, task_no=YS-260518-083, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-083', '2026051849995741',
  '문혜경', '010-6348-6387',
  '서울특별시 강서구 양천로10길 38 (방화동) 신마곡벽산블루밍 102동 1002호', '강서구',
  '빠르게 부탁드려요~감사합니다', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 12:00:00+09:00', NULL,
  287500, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 3, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-083", "external_item_no": "2026051815527721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-083' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [8] order_no=2026051850084781, task_no=YS-260518-082, channel=네이버, items=2
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
  '최대한 빠른일정으로 부탁드립니다!', '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  122600, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-082", "external_item_no": "2026051815668341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-082' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-081", "external_item_no": "2026051815668351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-082' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [9] order_no=2026051850719331, task_no=YS-260518-080, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-080', '2026051850719331',
  '조수호', '010-5632-9915',
  '서울특별시 관악구 난곡로25가길 14 (신림동) 1층 101호', '관악구',
  '최대한 빠르게', '확정',
  '77777777-7777-7777-7777-7777777e0005',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-080", "external_item_no": "2026051816645041"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-080' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [10] order_no=2026051850746341, task_no=YS-260518-079, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-079', '2026051850746341',
  '남현진', '010-5626-7255',
  '서울특별시 강동구 올림픽로104길 41 (암사동, 한강현대아파트) 102동 806호', '강동구',
  '문앞', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  125500, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-079", "external_item_no": "2026051816687031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-079' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [11] order_no=2026051851249161, task_no=YS-260518-076, channel=네이버, items=2
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
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 12:00:00+09:00', NULL,
  96400, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-076", "external_item_no": "2026051817471341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-075", "external_item_no": "2026051817471351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [12] order_no=2026051851365241, task_no=YS-260518-074, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-074', '2026051851365241',
  '최건이', '010-5529-2872',
  '경기도 남양주시 호평로 93 (호평동, 동원로얄듀크아파트) 1703동 1002호', '남양주시',
  '최대한 빠른 날짜 부탁드립니다 :)', '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  76400, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-074", "external_item_no": "2026051817653251"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-074' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [13] order_no=2026051851640791, task_no=YS-260518-073, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-073', '2026051851640791',
  '홍석남', '010-2866-5798',
  '서울특별시 용산구 효창원로 17 (산천동, 리버힐삼성아파트) 114동 1502호', '용산구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 16:00:00+09:00', NULL,
  150500, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-073", "external_item_no": "2026051818087101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-073' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [14] order_no=2026051851916211, task_no=YS-260518-072, channel=네이버, items=4
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
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  77000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-072", "external_item_no": "2026051818515451"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-071", "external_item_no": "2026051818515461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-070", "external_item_no": "2026051818515471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-069", "external_item_no": "2026051818515481"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [15] order_no=2026051851953021, task_no=YS-260518-068, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-068', '2026051851953021',
  '유은진', '010-2713-4819',
  '서울특별시 은평구 서오릉로 228-22 (갈현동) 1층', '은평구',
  '냉매도 같이 최대한빠르게', '확정',
  '77777777-7777-7777-7777-7777777e0015',
  NULL, NULL,
  150500, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-068", "external_item_no": "2026051818573561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-068' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [16] order_no=2026051852343681, task_no=YS-260518-067, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-067', '2026051852343681',
  '박영준', '010-2640-3405',
  '서울특별시 강남구 선릉로89길 16 (역삼동, 능현오피스텔) 1320호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-067", "external_item_no": "2026051819188021"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-067' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-066", "external_item_no": "2026051819188031"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-067' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [17] order_no=2026051852422711, task_no=YS-260518-065, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-065', '2026051852422711',
  '채송이', '010-9733-9653',
  '서울특별시 중구 을지로43길 15 (을지로6가) 5층 문앞', '중구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 09:00:00+09:00', NULL,
  125500, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-065", "external_item_no": "2026051819311471"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-065' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [18] order_no=2026051853046881, task_no=YS-260518-064, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-064', '2026051853046881',
  '박근식', '010-8936-8812',
  '서울특별시 강북구 삼각산로 40-7 (수유동) 2층', '강북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  125500, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-064", "external_item_no": "2026051820270081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-064' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [19] order_no=2026051853229731, task_no=YS-260518-063, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-063', '2026051853229731',
  '홍유리', '010-9181-5073',
  '서울특별시 용산구 한남대로 35 (한남동) 2층', '용산구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 10:00:00+09:00', NULL,
  76400, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-063", "external_item_no": "2026051820557461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-063' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [20] order_no=2026051853335621, task_no=YS-260518-062, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-062', '2026051853335621',
  '이지은', '010-8650-3749',
  '서울특별시 중랑구 상봉중앙로8길 76 (상봉동, 건영캐스빌) 1507동 2304호', '중랑구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  73500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-062", "external_item_no": "2026051820723521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-062' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-061", "external_item_no": "2026051820723531"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-062' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [21] order_no=2026051853504091, task_no=YS-260518-060, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-060', '2026051853504091',
  '리더스컴퍼니', '010-6426-7513',
  '서울특별시 중구 을지로43길 15 (을지로6가) 2F', '중구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 08:00:00+09:00', NULL,
  129000, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-060", "external_item_no": "2026051820985801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-060' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [22] order_no=2026051854067201, task_no=YS-260518-059, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-059', '2026051854067201',
  '이현경', '010-8618-4831',
  '서울특별시 광진구 자양로 278-5 (구의동) 2층 안쪽집', '광진구',
  '문자주세요', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-059", "external_item_no": "2026051821866441"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-059' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [23] order_no=2026051854170131, task_no=YS-260518-058, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-058', '2026051854170131',
  '마송희', '010-7917-6103',
  '서울특별시 양천구 신월로15길 25 (신월동, 신월대성유니드아파트) 102동 1302호', '양천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 14:00:00+09:00', NULL,
  73500, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-058", "external_item_no": "2026051822026871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-058' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-057", "external_item_no": "2026051822026881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-058' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [24] order_no=2026051854413491, task_no=YS-260518-056, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-056', '2026051854413491',
  '정하은', '0502-2882-6792',
  '서울특별시 성동구 마조로12길 12-9 (마장동) 303호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-056", "external_item_no": "2026051822403841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-056' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [25] order_no=2026051737922991, task_no=YS-260518-055, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-055', '2026051737922991',
  '이원준', '010-6234-4322',
  '서울특별시 양천구 목동동로 350 (목동, 목동신시가지아파트5단지) 534-301', '양천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 15:30:00+09:00', NULL,
  126100, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-055", "external_item_no": "2026051786729181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-054", "external_item_no": "2026051786729191"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-055' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [26] order_no=2026051738300211, task_no=YS-260518-053, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-053', '2026051738300211',
  '박정복', '010-8277-8599',
  '서울특별시 강남구 논현로79길 25 (역삼동, 역삼동한스빌라텔) 403호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-053", "external_item_no": "2026051787293321"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-053' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [27] order_no=2026051739608991, task_no=YS-260518-052, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-052', '2026051739608991',
  '장예나', '010-6424-3518',
  '서울특별시 영등포구 선유동2로 29 (양평동3가, 현대2차아파트) 202동 307호', '영등포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  126100, NULL,
  NULL,
  '["김동효", "전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-052", "external_item_no": "2026051789290551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-051", "external_item_no": "2026051789290561"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-052' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [28] order_no=2026051739905221, task_no=YS-260518-050, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-050', '2026051739905221',
  '장예림', '0502-2659-2677',
  '서울특별시 관악구 남부순환로246라길 12 (봉천동) 406호', '관악구',
  '최대한 빨리 부탁드립니다 감사합니다.', '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 08:00:00+09:00', NULL,
  76400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-050", "external_item_no": "2026051789748351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-050' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [29] order_no=2026051740185931, task_no=YS-260518-049, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-049', '2026051740185931',
  '남혜정', '010-3567-0545',
  '서울특별시 종로구 성균관로 62-7 (명륜1가) 307호(영원빌딩)', '종로구',
  '빠른 일정 부탁드리겠습니다.', '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 16:30:00+09:00', NULL,
  73400, NULL,
  NULL,
  '["양승문", "김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-049", "external_item_no": "2026051790188071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-049' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [30] order_no=2026051741066451, task_no=YS-260518-048, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-048', '2026051741066451',
  'WEN XIANJIA', '010-5535-5931',
  '서울특별시 금천구 독산로 342-1 (독산동) 서울 금천구 독산로 342-1 필하우스501호', '금천구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 14:00:00+09:00', NULL,
  76400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-048", "external_item_no": "2026051791564861"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [31] order_no=2026051741082391, task_no=YS-260518-047, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-047', '2026051741082391',
  '임은정', '0502-2876-4078',
  '서울특별시 관악구 신림로65길 41 (신림동) 테라타워 5층 501호', '관악구',
  '공동현관 : 경비 열쇠 0075 종, 5층 중문 : 9915* 열고 501호 현관 수령', '확정',
  '77777777-7777-7777-7777-7777777e0005',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-047", "external_item_no": "2026051791590681"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-047' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [32] order_no=2026051741676541, task_no=YS-260518-046, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-046', '2026051741676541',
  '김성동', '010-7702-8223',
  '서울특별시 은평구 녹번로9길 9 (녹번동, 신정아트빌) 3층 303호', '은평구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0015',
  NULL, NULL,
  96400, NULL,
  NULL,
  '["양승문"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-046", "external_item_no": "2026051792534601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [33] order_no=2026051741881681, task_no=YS-260518-045, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-045', '2026051741881681',
  '배제윤', '010-5287-9325',
  '서울특별시 마포구 백범로 199 (신공덕동, 메트로디오빌) 1803호', '마포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 19:00:00+09:00', NULL,
  76400, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-045", "external_item_no": "2026051792859691"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-045' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [34] order_no=2026051742197511, task_no=YS-260518-044, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-044', '2026051742197511',
  '김규림', '010-6778-1298',
  '서울특별시 양천구 신정로 300 (신정동, 신정5차현대아파트) 501동 403호', '양천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 14:30:00+09:00', NULL,
  122600, NULL,
  NULL,
  '["전현진", "최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-044", "external_item_no": "2026051793370511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-044' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-043", "external_item_no": "2026051793370521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-044' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-042", "external_item_no": "2026051793370531"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-044' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [35] order_no=2026051742389141, task_no=YS-260518-041, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-041', '2026051742389141',
  '이은수', '010-6215-9102',
  '서울특별시 동작구 상도로47바길 10 (상도1동, 두손 베스티움) 303호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-041", "external_item_no": "2026051793686481"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-041' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [36] order_no=2026051742963501, task_no=YS-260518-040, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-040', '2026051742963501',
  '주연진', '010-6245-6541',
  '서울특별시 마포구 마포대로 73 (도화동, SK허브그린) 1210호', '마포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 14:30:00+09:00', NULL,
  99900, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-040", "external_item_no": "2026051794604631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-040' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [37] order_no=2026051743037071, task_no=YS-260518-039, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-039', '2026051743037071',
  '권지예', '0502-2796-1791',
  '서울특별시 동대문구 답십리로 61-1 (전농동) 401호', '동대문구',
  '현관비번 손1004#', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-039", "external_item_no": "2026051794725571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [38] order_no=2026051743157471, task_no=YS-260518-038, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-038', '2026051743157471',
  '김지은', '010-7656-9788',
  '서울특별시 성북구 한천로 713 (장위동, 래미안장위퍼스트하이) 515동 502호', '성북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
  125500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-038", "external_item_no": "2026051794921291"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [39] order_no=2026051743267171, task_no=YS-260518-037, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-037', '2026051743267171',
  '김연수', '010-3003-3408',
  '서울특별시 강남구 테헤란로64길 8 (대치동, 선릉역 롯데골드로즈오피스텔) 712호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-037", "external_item_no": "2026051795101461"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [40] order_no=2026051743878561, task_no=YS-260518-036, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-036', '2026051743878561',
  '강형우', '010-3382-0530',
  '서울특별시 서초구 서초중앙로 51 (서초동, 서초신성미소시티) 1209호', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  96400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-036", "external_item_no": "2026051796091611"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [41] order_no=2026051743936771, task_no=YS-260518-035, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-035', '2026051743936771',
  '한아연', '010-4451-4858',
  '서울특별시 도봉구 시루봉로23길 113 (도봉동) 102호', '도봉구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  125500, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-035", "external_item_no": "2026051796189491"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-035' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [42] order_no=2026051846449341, task_no=YS-260518-034, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-034', '2026051846449341',
  '조은영', '010-7303-6807',
  '서울특별시 노원구 중계로8길 20 (중계동, 현대6차아파트) 104동1603호', '노원구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  126100, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-034", "external_item_no": "2026051810219581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-033", "external_item_no": "2026051810219591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [43] order_no=2026051846568191, task_no=YS-260518-032, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-032', '2026051846568191',
  '이계화', '010-8925-5112',
  '서울특별시 용산구 녹사평대로 66 (동빙고동, 용산푸르지오파크타운) 201동 704호', '용산구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 09:00:00+09:00', NULL,
  73500, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-032", "external_item_no": "2026051810389791"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-031", "external_item_no": "2026051810389801"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-032' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [44] order_no=2026051846590201, task_no=YS-260518-030, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-030', '2026051846590201',
  '송은정', '010-6303-2658',
  '서울특별시 동대문구 망우로 67 (휘경동, 효자 워너빌) 404호', '동대문구',
  '주말에 부탁드립니다', '확정',
  '77777777-7777-7777-7777-7777777e0020',
  NULL, NULL,
  122600, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-030", "external_item_no": "2026051810422421"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-029", "external_item_no": "2026051810422431"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-030' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [45] order_no=2026051846849761, task_no=YS-260518-028, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-028', '2026051846849761',
  '이혜민', '0502-2879-3550',
  '서울특별시 강남구 자곡로11길 28 (자곡동) 203동 1001호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-028", "external_item_no": "2026051810804231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-028' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [46] order_no=2026051847703521, task_no=YS-260518-027, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-027', '2026051847703521',
  '전성만', '010-2685-7959',
  '서울특별시 송파구 바람드리25길 5 (풍납동) 스카이빌 101호', '송파구',
  '최대한 빠르게 부탁드리겠습니다', '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-027", "external_item_no": "2026051812036931"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-027' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [47] order_no=2026051847782261, task_no=YS-260518-026, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-026', '2026051847782261',
  '최시연', '010-7112-3729',
  '서울특별시 금천구 시흥대로 315 (독산동, 금천롯데캐슬골드파크4차) 1210호', '금천구',
  '최대한 빠르게', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 12:00:00+09:00', NULL,
  96400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-026", "external_item_no": "2026051812150671"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-026' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [48] order_no=2026051847974531, task_no=YS-260518-025, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-025', '2026051847974531',
  '박지연', '010-3846-7440',
  '서울특별시 송파구 백제고분로25길 29 (삼전동) 404호', '송파구',
  '5월 23일 오전시간대 희망합니다', '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-025", "external_item_no": "2026051812433131"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-025' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [49] order_no=2026051844686271, task_no=YS-260518-023, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-023', '2026051844686271',
  '김부의', '010-4099-3098',
  '서울특별시 동작구 사당로26길 78-3 (사당동) 201호', '동작구',
  '배송 전 미리 연락해 주세요', '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 14:00:00+09:00', NULL,
  150500, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-023", "external_item_no": "2026051897384961"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-023' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [50] order_no=2026051844696751, task_no=YS-260518-022, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-022', '2026051844696751',
  '이기연', '010-3584-5241',
  '서울특별시 강동구 천호대로 1078 (성내동, 씨제이나인파크) 1101호', '강동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  125500, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-022", "external_item_no": "2026051897401591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-022' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [51] order_no=2026051844831191, task_no=YS-260518-021, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-021', '2026051844831191',
  '김가연', '010-5891-0081',
  '서울특별시 구로구 신도림로 32 (신도림동, 신도림5차 e-편한세상) 705동701호', '구로구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 09:00:00+09:00', NULL,
  73500, NULL,
  NULL,
  '["전현진"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-021", "external_item_no": "2026051897618901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-020", "external_item_no": "2026051897618911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-021' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [52] order_no=2026051846123291, task_no=YS-260518-019, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-019', '2026051846123291',
  '김태금', '010-4013-0783',
  '서울특별시 강서구 양천로47길 118 (마곡동, 마곡벽산아파트) 104-303', '강서구',
  '최대한 빠르게~', '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 11:30:00+09:00', NULL,
  129000, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-019", "external_item_no": "2026051899739541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-019' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [53] order_no=2026051739152771, task_no=YS-260518-018, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-018', '2026051739152771',
  '추서연', '010-4247-4547',
  '서울특별시 중랑구 봉우재로 50 (면목동, 봄작시티 50) 201동303호', '중랑구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  96400, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-018", "external_item_no": "2026051788591621"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-017", "external_item_no": "2026051788591631"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-018' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [54] order_no=2026051741411801, task_no=YS-260518-016, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-016', '2026051741411801',
  '이효주', '010-7517-7585',
  '서울특별시 관악구 보라매로 25 (봉천동, 칸타빌레7차) 517호', '관악구',
  '사다리 오피스텔에 있습니다!', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  96400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-016", "external_item_no": "2026051792114331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-015", "external_item_no": "2026051792114341"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-014", "external_item_no": "2026051792114351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-016' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [55] order_no=2026051846482751, task_no=YS-260518-013, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-013', '2026051846482751',
  '이성환 반장님 경비실', '010-3625-2617',
  '서울특별시 성동구 아차산로 121 (성수동2가) 오쎄 재인산업 경비실', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  85000, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-013", "external_item_no": "2026051810268081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-012", "external_item_no": "2026051810268091"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-011", "external_item_no": "2026051810268101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-013' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [56] order_no=2026051848438321, task_no=YS-260518-010, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-010', '2026051848438321',
  '이다솜', '010-5177-5956',
  '서울특별시 강남구 논현로175길 111 (신사동, 신사동 만수빌딩) 2층', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  129000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=사무실 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-010", "external_item_no": "2026051813123071"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-009", "external_item_no": "2026051813123081"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-008", "external_item_no": "2026051813123091"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-010' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [57] order_no=2026051844529061, task_no=YS-260518-007, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-007', '2026051844529061',
  '조완수', '010-5648-3651',
  '서울특별시 강북구 월계로21가길 41 (미아동, 미아한일유앤아이) 103동 303호', '강북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  77000, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-007", "external_item_no": "2026051897132351"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-006", "external_item_no": "2026051897132361"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-005", "external_item_no": "2026051897132371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-007' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [58] order_no=2026051845486461, task_no=YS-260518-004, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-004', '2026051845486461',
  '김선율', '010-4659-7729',
  '서울특별시 동대문구 서울시립대로16길 25 (전농동) 옥탑', '동대문구',
  '최대한 빠르게', '확정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-004", "external_item_no": "2026051898716891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260518-003", "external_item_no": "2026051898716901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-004' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [59] order_no=2026051845808711, task_no=YS-260518-002, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260518-002', '2026051845808711',
  '박윤범', '010-7112-6340',
  '서울특별시 중구 동호로10길 30 (신당동, 약수하이츠) 113동 2009호', '중구',
  '가능한 빠른 일정이 좋습니다.', '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 07:00:00+09:00', NULL,
  73130, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-002", "external_item_no": "2026051899249911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260518-001", "external_item_no": "2026051899249921"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260518-002' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [60] order_no=2026051737353691, task_no=YS-260517-098, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-098', '2026051737353691',
  '이보영', '010-6370-9913',
  '서울특별시 성북구 월곡로14길 26 (하월곡동, 월곡래미안루나밸리) 105동 1602호', '성북구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0020',
  NULL, NULL,
  150500, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-098", "external_item_no": "2026051785893781"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-098' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-097", "external_item_no": "2026051785893791"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-098' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [61] order_no=2026051737572061, task_no=YS-260517-096, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-096', '2026051737572061',
  '안솔미', '010-3078-8677',
  '서울특별시 광진구 능동로32길 82-48 (능동, 아성스위트타운) 305호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 16:00:00+09:00', NULL,
  125500, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-096", "external_item_no": "2026051786212781"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-096' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [62] order_no=2026051735306171, task_no=YS-260517-093, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-093', '2026051735306171',
  '강지훈', '010-9126-8373',
  '서울특별시 관악구 문성로32길 25 (신림동, 은성빌) 3층 302호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 11:00:00+09:00', NULL,
  75400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-093", "external_item_no": "2026051782912711"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-093' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [63] order_no=2026051735583221, task_no=YS-260517-092, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-092', '2026051735583221',
  '오승철', '010-3229-4382',
  '서울특별시 성동구 고산자로 164 (행당동, 서울숲한신더휴) 117동1404호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  NULL, NULL,
  129000, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-092", "external_item_no": "2026051783312231"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-092' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [64] order_no=2026051736061141, task_no=YS-260517-091, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-091', '2026051736061141',
  '박희웅', '010-4599-9140',
  '경기도 양주시 옥정동로 104 (옥정동) Gs제이드웰 21단지 2109동504호', '양주시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 10:00:00+09:00', NULL,
  129000, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-091", "external_item_no": "2026051783998601"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-091' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-090", "external_item_no": "2026051783998611"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-091' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [65] order_no=2026051737213651, task_no=YS-260517-089, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-089', '2026051737213651',
  '김동욱', '010-7929-7723',
  '서울특별시 동대문구 무학로26길 30 (용두동, 신동아아파트) 101동 207호', '동대문구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0018',
  NULL, NULL,
  126100, NULL,
  NULL,
  '["안승웅", "정상현", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-089", "external_item_no": "2026051785687571"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-089' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-088", "external_item_no": "2026051785687581"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-089' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-087", "external_item_no": "2026051785687591"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-089' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [66] order_no=2026051731595991, task_no=YS-260517-086, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-086', '2026051731595991',
  '이춘식', '0502-2791-0057',
  '서울특별시 중구 난계로23길 27 (황학동) 청계블루카운티 305호', '중구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 15:00:00+09:00', NULL,
  99900, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-086", "external_item_no": "2026051777522541"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-086' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [67] order_no=2026051731640131, task_no=YS-260517-085, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-085', '2026051731640131',
  '류인수', '010-8644-5877',
  '서울특별시 중랑구 신내로 151 (신내동, 신내9단지신내아파트) 904-912', '중랑구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-31 08:30:00+09:00', NULL,
  79900, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-085", "external_item_no": "2026051777587101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-085' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [68] order_no=2026051731648431, task_no=YS-260517-084, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-084', '2026051731648431',
  '김해슬', '010-9245-1102',
  '서울특별시 송파구 송파대로28길 27 (가락동, 송파성원쌍떼빌) 102동 806호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  154000, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=2.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-084", "external_item_no": "2026051777599001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-084' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-083", "external_item_no": "2026051777599011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-084' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [69] order_no=2026051731674251, task_no=YS-260517-082, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-082', '2026051731674251',
  '신현주', '010-9419-8825',
  '서울특별시 관악구 문성로31길 5 (신림동, 골든하우스) 502호', '관악구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 15:00:00+09:00', NULL,
  76400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-082", "external_item_no": "2026051777636001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-082' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [70] order_no=2026051732361201, task_no=YS-260517-081, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-081', '2026051732361201',
  '박민수', '010-3443-3109',
  '경기도 안양시 동안구 안양판교로 42 (관양동, 인덕원마을삼성아파트) 106동 804호', '동안구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 09:00:00+09:00', NULL,
  125500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-081", "external_item_no": "2026051778636161"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-081' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [71] order_no=2026051732380411, task_no=YS-260517-080, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-080', '2026051732380411',
  '안효정', '010-8786-1545',
  '서울특별시 강북구 삼양로98길 41 (수유동) 2층', '강북구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 09:00:00+09:00', NULL,
  126100, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=4way (송풍팬 포함) / qty=1.0 → work_type=clean_4way / appliance=4way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_4way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='4way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-080", "external_item_no": "2026051778664881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-080' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-079", "external_item_no": "2026051778664891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-080' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [72] order_no=2026051732594201, task_no=YS-260517-078, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-078', '2026051732594201',
  '노규연', '010-9384-0062',
  '서울특별시 서초구 서초중앙로20길 33-17 (서초동, 서초빌리지1) 603호', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  96400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-078", "external_item_no": "2026051778978871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-078' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-077", "external_item_no": "2026051778978881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-078' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [73] order_no=2026051732823211, task_no=YS-260517-076, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-076', '2026051732823211',
  '문선아', '010-5819-1000',
  '서울특별시 마포구 마포대로 53 (도화동, 마포트라팰리스) B동 2406호', '마포구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 13:00:00+09:00', NULL,
  96400, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-076", "external_item_no": "2026051779309391"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-076' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [74] order_no=2026051732923421, task_no=YS-260517-075, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-075', '2026051732923421',
  '강규희', '010-3247-3980',
  '서울특별시 광진구 능동로37길 9 (중곡동, 평강오피스텔) 1201호', '광진구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
  99900, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-075", "external_item_no": "2026051779454421"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-075' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [75] order_no=2026051733802651, task_no=YS-260517-074, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-074', '2026051733802651',
  '윤현지', '010-7578-0720',
  '서울특별시 동작구 사당로20바길 21 (사당동) 유진아트빌 401호', '동작구',
  '현관 종 6988 / 문앞에 두시고 문자주세요', '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 07:00:00+09:00', NULL,
  76400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-074", "external_item_no": "2026051780735911"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-074' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [76] order_no=2026051729177311, task_no=YS-260517-073, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-073', '2026051729177311',
  '이민지', '010-3466-4619',
  '경기도 하남시 감일순환로 40 (감이동) 감일한라비발디2차 903동2404호', '하남시',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  96400, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=1.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-073", "external_item_no": "2026051774031991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-073' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [77] order_no=2026051729690101, task_no=YS-260517-072, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-072', '2026051729690101',
  '조유진', '010-2008-5029',
  '서울특별시 서초구 강남대로6길 59-10 (양재동) 303호', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-072", "external_item_no": "2026051774765981"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-072' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [78] order_no=2026051727876401, task_no=YS-260517-071, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-071', '2026051727876401',
  '이명순', '010-7142-8090',
  '서울특별시 강북구 오패산로 260 (미아동, 대성그린빌라) 4동105호', '강북구',
  '부모님댁왔는데 에어컨 계속틀고계시네요. 부모님댁인데 급히 요청드립니다. 18일에 가능할까요...?', '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 11:00:00+09:00', NULL,
  125500, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-071", "external_item_no": "2026051772170641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-071' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [79] order_no=2026051722724961, task_no=YS-260517-070, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-070', '2026051722724961',
  '전예진', '010-9523-3404',
  '서울특별시 강동구 천호옛17길 17-5 (성내동, 해인하우스12차) 401호 공동현관 종9119', '강동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
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
  '{"item_code": "YS-260517-070", "external_item_no": "2026051764759721"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-070' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [80] order_no=2026051722898111, task_no=YS-260517-069, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-069', '2026051722898111',
  '김민주', '0502-2868-0385',
  '서울특별시 금천구 독산로 29-1 (시흥동) DS타운 2층 202호', '금천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-31 12:00:00+09:00', NULL,
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
  '{"item_code": "YS-260517-069", "external_item_no": "2026051765004181"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-069' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [81] order_no=2026051720313091, task_no=YS-260517-068, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-068', '2026051720313091',
  '전유신', '010-4599-0513',
  '서울특별시 성동구 뚝섬로3나길 20 (성수동1가, 위더스하임1차) 501호', '성동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0014',
  NULL, NULL,
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
  '{"item_code": "YS-260517-068", "external_item_no": "2026051761182311"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-068' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [82] order_no=2026051615461621, task_no=YS-260517-067, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-067', '2026051615461621',
  '윤도운', '010-4123-3144',
  '서울특별시 강동구 양재대로111길 27 (길동, 골드클래스) 406호', '강동구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
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
  '{"item_code": "YS-260517-067", "external_item_no": "2026051653805701"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-067' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [83] order_no=2026051730529871, task_no=YS-260517-066, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-066', '2026051730529871',
  '오설아', '010-7701-2470',
  '서울특별시 중랑구 면목로22길 14 2층', '중랑구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0017',
  '2026-05-31 11:30:00+09:00', NULL,
  76400, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-066", "external_item_no": "2026051775981551"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-066' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [84] order_no=2026051730681091, task_no=YS-260517-065, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-065', '2026051730681091',
  '손진영', '010-8463-8813',
  '서울특별시 중구 만리재로 175 (만리동2가) 서울센트럴자이 112동 702호', '중구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 09:00:00+09:00', NULL,
  190500, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0 → work_type=clean_1way / appliance=1way
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='clean_1way' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-065", "external_item_no": "2026051776200991"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-065' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-064", "external_item_no": "2026051776201001"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-065' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=2.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 2, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-063", "external_item_no": "2026051776201011"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-065' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [85] order_no=2026051731154611, task_no=YS-260517-060, channel=네이버, items=3
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-060', '2026051731154611',
  '한은혜', '010-6364-2634',
  '서울특별시 강서구 공항대로58나길 39 (등촌동, 신구아트빌라) 지층102호', '강서구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 18:30:00+09:00', NULL,
  79900, NULL,
  NULL,
  '["최은규"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-060", "external_item_no": "2026051776882371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-060' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-059", "external_item_no": "2026051776882381"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-060' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=실외기 / qty=1.0 → work_type=outdoor_unit / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='outdoor_unit' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-058", "external_item_no": "2026051776882391"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-060' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [86] order_no=2026051724605341, task_no=YS-260517-057, channel=네이버, items=4
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-057', '2026051724605341',
  '공형준', '010-8745-4114',
  '서울특별시 중랑구 동일로101길 12 (면목동, 예성그린빌) 501호', '중랑구',
  '택배 선반쪽에 놔주세요.', '확정',
  '77777777-7777-7777-7777-7777777e0018',
  '2026-05-31 18:00:00+09:00', NULL,
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
  '{"item_code": "YS-260517-057", "external_item_no": "2026051767451871"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-057' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-056", "external_item_no": "2026051767451881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-057' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-055", "external_item_no": "2026051767451891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-057' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=순수 천연 피톤치드 분사 / qty=1.0 → work_type=phytoncide / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='phytoncide' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-054", "external_item_no": "2026051767451901"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-057' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [87] order_no=2026051616570291, task_no=YS-260517-053, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-053', '2026051616570291',
  '서수명', '010-3813-9203',
  '서울특별시 노원구 동일로227길 26 (상계동, 상계주공15단지아파트) 1510동 1211호', '노원구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0007',
  '2026-05-31 13:00:00+09:00', NULL,
  116100, NULL,
  NULL,
  '["김영수", "김현동"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-053", "external_item_no": "2026051655424731"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-053' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-052", "external_item_no": "2026051655424741"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-053' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [88] order_no=2026051722014641, task_no=YS-260517-051, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-051', '2026051722014641',
  '이경민', '010-3008-7417',
  '서울특별시 양천구 목동동로 202 (목동, 현대아파트) 101동 1402호', '양천구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0019',
  '2026-05-31 16:00:00+09:00', NULL,
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
  '{"item_code": "YS-260517-051", "external_item_no": "2026051763759511"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-051' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-050", "external_item_no": "2026051763759521"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-051' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [89] order_no=2026051723743931, task_no=YS-260517-049, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-049', '2026051723743931',
  '최유진', '010-4450-2164',
  '서울특별시 송파구 송이로36길 54-19 (문정동) 하나빌 302호', '송파구',
  '최대한 빠르게 부탁드려요 (송풍팬 탈거? 는 현장에서 필요하면 진행후 기사님 납부 가능할까요?)', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  115500, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-049", "external_item_no": "2026051766210841"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-049' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [90] order_no=2026051723864531, task_no=YS-260517-048, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-048', '2026051723864531',
  '심재현', '010-4582-2955',
  '서울특별시 송파구 중대로25길 18-7 (오금동) 403호', '송파구',
  '문 앞에 놓아주세요', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
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
  '{"item_code": "YS-260517-048", "external_item_no": "2026051766382791"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-048' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [91] order_no=2026051723948301, task_no=YS-260517-047, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-047', '2026051723948301',
  '이경종', '010-4528-4904',
  '서울특별시 서초구 강남대로99길 29-9 (잠원동, 정원빌딩) 302호', '서초구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
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
  '{"item_code": "YS-260517-047", "external_item_no": "2026051766503221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-047' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [92] order_no=2026051726070571, task_no=YS-260517-046, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-046', '2026051726070571',
  '이가희', '010-6678-0813',
  '서울특별시 송파구 백제고분로42길 14-18 (송파동) 303호', '송파구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  67400, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-046", "external_item_no": "2026051769567641"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-046' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [93] order_no=2026051726234671, task_no=YS-260517-045, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-045', '2026051726234671',
  '한우진', '010-2105-1102',
  '서울특별시 광진구 자양로23나길 11 (구의동, 플러스빌) 202호', '광진구',
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
  '{"item_code": "YS-260517-045", "external_item_no": "2026051769806831"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-045' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [94] order_no=2026051727008361, task_no=YS-260517-042, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-042', '2026051727008361',
  '정재희', '010-4097-5510',
  '서울특별시 강남구 도곡로57길 9-7 (역삼동, 역삼동트레벨아파트) 503호', '강남구',
  '최대한 빠르게로 부탁드려요.', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-042", "external_item_no": "2026051770927371"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-042' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [95] order_no=2026051727257921, task_no=YS-260517-040, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-040', '2026051727257921',
  '김웅', '010-2744-0469',
  '서울특별시 강남구 언주로141길 29 (논현동) 수경빌라트 101호', '강남구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  10000, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=추가선택 / 구분=냉매점검(서울 경기북부만 가능) / qty=1.0 → work_type=refri_no_appliance / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='refri_no_appliance' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-040", "external_item_no": "2026051771283111"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-040' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [96] order_no=2026051727490631, task_no=YS-260517-039, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-039', '2026051727490631',
  '김호연', '010-2056-1485',
  '서울특별시 강남구 학동로47길 23 (논현동) 301호', '강남구',
  '최대한 빠른날로 부탁드립니다', '확정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["임종일", "정훈", "김병철"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-039", "external_item_no": "2026051771619101"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-039' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [97] order_no=2026051727945241, task_no=YS-260517-038, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-038', '2026051727945241',
  '김시하', '010-4876-7482',
  '서울특별시 중구 동호로8길 10 (신당동) 신당씨티빌 A동 102호', '중구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 13:00:00+09:00', NULL,
  79900, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-038", "external_item_no": "2026051772268761"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-038' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [98] order_no=2026051729420781, task_no=YS-260517-037, channel=네이버, items=1
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-037', '2026051729420781',
  '임수민', '010-4449-9523',
  '서울특별시 동작구 상도로60가길 8 (상도동) 정원 202호', '동작구',
  NULL, '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["김동효"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-037", "external_item_no": "2026051774379331"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-037' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [99] order_no=2026051451798931, task_no=YS-260517-036, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-036', '2026051451798931',
  '한유원', '010-3181-9388',
  '서울특별시 종로구 평창11길 5 (평창동) 302호', '종로구',
  '5/21 원하심', '확정',
  '77777777-7777-7777-7777-7777777e0005',
  '2026-05-21 09:00:00+09:00', NULL,
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
  '{"item_code": "YS-260517-036", "external_item_no": "2026051465512211"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=사무실 에어컨청소 / 구분=스탠드 사무실 (송풍팬 뒷판 포함) / qty=1.0 → work_type=clean_stand / appliance=stand
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_stand' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-035", "external_item_no": "2026051465512221"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-036' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

-- [100] order_no=2026051616702101, task_no=YS-260517-034, channel=네이버, items=2
INSERT INTO tasks (
  tenant_id, category_id, principal_id, task_no,
  external_order_no, customer_name, phone, address, district,
  request_note, status, assigned_engineer_id,
  scheduled_at, completed_at,
  product_price, extra_fee, extra_reason,
  push_candidates, category_data
) VALUES (
  '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333001', (SELECT id FROM principals WHERE code='usol_n' AND tenant_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
  'YS-260517-034', '2026051616702101',
  '임소영', '010-9465-1562',
  '서울특별시 중랑구 상봉로25길 42 (상봉동, 승조오피스텔) 5층 504호', '중랑구',
  '504호실입니다', '확정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
  73900, NULL,
  NULL,
  '["안승웅", "정상현"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0 → work_type=clean_wall / appliance=wall
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='clean_wall' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  '{"item_code": "YS-260517-034", "external_item_no": "2026051655623881"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';
-- item: 서비스=추가선택 / 구분=송풍팬분해/층고 / qty=1.0 → work_type=fan_disassembly / appliance=NULL
INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)
SELECT
  t.id, 1, 0,
  (SELECT id FROM work_types WHERE code='fan_disassembly' LIMIT 1),
  NULL,
  '{"item_code": "YS-260517-033", "external_item_no": "2026051655623891"}'::jsonb
FROM tasks t WHERE t.task_no = 'YS-260517-034' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

COMMIT;
