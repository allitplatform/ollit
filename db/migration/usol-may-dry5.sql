-- ============================================
-- 유솔N 시트 → Supabase tasks/task_items 마이그 (Fix #31)
-- 생성: 2026-05-18 18:43:31
-- 원본: db/migration/usol-may-v2.xlsx 시트 '시트1'
-- 시트 데이터 1143건 → tasks 769개
-- DRY RUN 한도: 5 task
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
  NULL, '배정',
  '77777777-7777-7777-7777-7777777e0021',
  NULL, NULL,
  124500, NULL,
  NULL,
  '["류근학", "정훈"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0
INSERT INTO task_items (task_id, qty, service_type_id, appliance_type_id)
SELECT
  t.id, 1,
  (SELECT id FROM service_types WHERE code='cleaning' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1)
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
  NULL, '배정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  115500, NULL,
  NULL,
  '[]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=가정용 스탠드 (송풍팬 뒷판 포함) / qty=1.0
INSERT INTO task_items (task_id, qty, service_type_id, appliance_type_id)
SELECT
  t.id, 1,
  (SELECT id FROM service_types WHERE code='cleaning' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='stand' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1)
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
  '5월21일 희망합니다', '배정',
  '77777777-7777-7777-7777-7777777e0006',
  NULL, NULL,
  287500, NULL,
  NULL,
  '["구현서", "문성목"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=3.0
INSERT INTO task_items (task_id, qty, service_type_id, appliance_type_id)
SELECT
  t.id, 3,
  (SELECT id FROM service_types WHERE code='cleaning' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1)
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
  NULL, '일정확정',
  '77777777-7777-7777-7777-7777777e0008',
  '2026-05-31 10:00:00+09:00', NULL,
  189500, NULL,
  NULL,
  '["김윤섭"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=1way / qty=2.0
INSERT INTO task_items (task_id, qty, service_type_id, appliance_type_id)
SELECT
  t.id, 2,
  (SELECT id FROM service_types WHERE code='cleaning' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='1way' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1)
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
  NULL, '배정',
  '77777777-7777-7777-7777-7777777e0004',
  NULL, NULL,
  76400, NULL,
  NULL,
  '["구현서"]'::jsonb, '{}'::jsonb
);

-- item: 서비스=가정집 에어컨청소 / 구분=벽걸이 / qty=1.0
INSERT INTO task_items (task_id, qty, service_type_id, appliance_type_id)
SELECT
  t.id, 1,
  (SELECT id FROM service_types WHERE code='cleaning' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1),
  (SELECT id FROM appliance_types WHERE code='wall' AND category_id='33333333-3333-3333-3333-333333333001' LIMIT 1)
FROM tasks t WHERE t.task_no = 'YS-260518-086' AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

COMMIT;
