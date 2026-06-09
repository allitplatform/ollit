-- 100_fix_wolgyedong_visit_to_refri.sql
-- 2026-06-09 — 월계동9401 (A-260609-004) 종류 정정.
--
-- 증상:
--   본 task 측 사장님 quote(견적) 70,000 / workType='냉매충전' / appliance='벽걸이' /
--   reason='wrong_type' (작업 종류 다름) 측 — KA 냉매 벽걸이 작업이었으나
--   기사 측 mark_visit_only 처리 (출장비 30k) 측 종류 mismatch.
--   금액(60k→30k 백필) 사고 와 별개 — 본 건은 종류 자체 오류.
--
-- 정정 spec (사장님 spec):
--   task_item: work_type visit (30,000) → 냉매_벽걸이 (qty=1, unit_price=70,000)
--   tasks:    status visit_only → 완료
--             product_price 0 → 70,000
--             travel_fee 30,000 → 0
--             category_data 측 visitOnly 키 제거
--   payments: 옛 출장비_30K row 제거 → compute_payment 측 KA 냉매 정책 재산출
--
-- 정합 산출 (calculate_commission(KA, refrigerant, wall, 70000) 사전 측정):
--   policy_key: KA_refri_wall
--   calc_method: 비율_견적금액
--   engineer:  35,000
--   principal: 24,500
--   company:   10,500
--   total:     70,000
--
-- 실행 순서 (사장님 직접 — Supabase SQL Editor):
--   [STEP 1] 백업 — 옛 상태 snapshot table
--   [STEP 2] task_items UPDATE — work_type/unit_price 정정
--   [STEP 3] tasks UPDATE — status/product_price/travel_fee/category_data
--   [STEP 4] payments DELETE — 옛 출장비_30K
--   [STEP 5] compute_payment(p_task_id) 호출 — KA 냉매 정책 재산출
--   [STEP 6] verify SELECT — payments / task_items / tasks 정합 확인
--
-- 무손상:
--   다른 task 측 0 영향 (WHERE id 측 단일 task UUID 한정).
--   compute_payment 함수 측 변경 X (이미 정의된 KA 냉매 정책 호출).
--   다른 visit_only / payments / RPC — 0 영향.
--
-- 롤백:
--   STEP 1 백업 테이블 측 복원 SQL 사장님 별도 실행.

-- ============================================
-- 상수 (SQL 측 인라인)
-- ============================================
--   task_id  = b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4   (task_no='A-260609-004')
--   task_item_id (현재 visit row) = e08f3a18-ca8b-4678-9931-4b7d1fe37bd3
--   payment_id (현재 출장비_30K)   = 9d89149e-ab9d-49e4-a2d1-9c3661204f22
--   appliance_id (벽걸이)          = 55555555-5555-5555-5555-555555555001
--   refri_wall work_type           = SELECT id FROM work_types WHERE code='refri_wall'

-- ============================================
-- [STEP 1] 백업 — 옛 상태 snapshot (롤백 안전망)
-- ============================================
BEGIN;

CREATE TABLE IF NOT EXISTS backup_wolgyedong_260609 AS
SELECT 'tasks'::text AS source,
       row_to_json(t)::jsonb AS data,
       NOW() AS backed_up_at
FROM tasks t
WHERE t.id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;

INSERT INTO backup_wolgyedong_260609 (source, data, backed_up_at)
SELECT 'task_items'::text, row_to_json(ti)::jsonb, NOW()
FROM task_items ti
WHERE ti.task_id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;

INSERT INTO backup_wolgyedong_260609 (source, data, backed_up_at)
SELECT 'payments'::text, row_to_json(p)::jsonb, NOW()
FROM payments p
WHERE p.task_id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;

COMMIT;

-- 백업 확인:
--   SELECT source, jsonb_pretty(data) FROM backup_wolgyedong_260609 ORDER BY source;
--   기대: tasks 1 + task_items 1 + payments 1 = 3 row.

-- ============================================
-- [STEP 2] task_items UPDATE — work_type / unit_price / appliance 정정
-- ============================================
BEGIN;

UPDATE task_items
SET work_type_id      = (SELECT id FROM work_types WHERE code = 'refri_wall' LIMIT 1),
    appliance_type_id = '55555555-5555-5555-5555-555555555001'::uuid,
    qty               = 1,
    unit_price        = 70000
WHERE id = 'e08f3a18-ca8b-4678-9931-4b7d1fe37bd3'::uuid;

COMMIT;

-- 검증:
--   SELECT id, qty, unit_price, subtotal, work_type_id, appliance_type_id
--   FROM task_items WHERE id = 'e08f3a18-ca8b-4678-9931-4b7d1fe37bd3';
--   기대: qty=1, unit_price=70000, subtotal=70000 (GENERATED 측 자동), work_type 측 refri_wall.

-- ============================================
-- [STEP 3] tasks UPDATE — status / product_price / travel_fee / category_data 정정
-- ============================================
BEGIN;

UPDATE tasks
SET status        = '완료',
    product_price = 70000,
    travel_fee    = 0,
    extra_fee     = 0,
    category_data = category_data - 'visitOnly'
WHERE id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;

COMMIT;

-- 검증:
--   SELECT status, product_price, extra_fee, travel_fee, total_amount,
--          category_data ? 'visitOnly' AS still_has_visit_only
--   FROM tasks WHERE id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4';
--   기대: 완료 / 70000 / 0 / 0 / 70000 / false.

-- ============================================
-- [STEP 4] payments DELETE — 옛 출장비_30K row 제거
-- ============================================
BEGIN;

DELETE FROM payments
WHERE task_id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;

COMMIT;

-- 검증:
--   SELECT COUNT(*) FROM payments WHERE task_id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4';
--   기대: 0 (STEP 5 호출 전).

-- ============================================
-- [STEP 5] compute_payment 측 KA 냉매 정책 재산출
-- ============================================
SELECT compute_payment('b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid);

-- ============================================
-- [STEP 6] verify SELECT — 정합 확인
-- ============================================
--
-- 6-A) payments 정합:
--
--   SELECT policy_key, calc_method,
--          product_price, extra_fee, travel_fee,
--          engineer_amount, principal_amount, owner_amount,
--          status, track
--   FROM payments
--   WHERE task_id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;
--
--   기대 (calculate_commission 사전 측정 결과):
--     policy_key:     'KA_refri_wall'
--     calc_method:    '비율_견적금액'
--     product_price:  70000
--     extra_fee:      0
--     travel_fee:     0
--     engineer_amount: 35000
--     principal_amount: 24500
--     owner_amount:   10500   (= 70000 − 35000 − 24500)
--     status:         '미정산'
--     track:          'A'
--
-- 6-B) tasks 정합:
--
--   SELECT task_no, status, product_price, extra_fee, travel_fee, total_amount,
--          category_data ? 'visitOnly' AS still_has_visit_only
--   FROM tasks WHERE id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4';
--
--   기대: A-260609-004 / 완료 / 70000 / 0 / 0 / 70000 / false.
--
-- 6-C) task_items 정합:
--
--   SELECT ti.qty, ti.unit_price, ti.subtotal,
--          wt.code AS wt_code, wt.name AS wt_name,
--          at.code AS app_code, at.name AS app_name,
--          st.code AS svc_code
--   FROM task_items ti
--   LEFT JOIN work_types wt ON wt.id = ti.work_type_id
--   LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
--   LEFT JOIN service_types st ON st.id = wt.service_type_id
--   WHERE ti.task_id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;
--
--   기대: qty=1, unit_price=70000, subtotal=70000, wt_code='refri_wall',
--         wt_name='냉매_벽걸이', app_code='wall', svc_code='refrigerant'.

-- ============================================
-- 사장님 운영 화면 verify (SQL 후):
--   1. KA 정산 화면 (PartnerDailySettleTab) 측 6/9 일별 카드:
--      · 완료 카운트 +1 (취소 측 −1)
--      · 합계 +24,500 (KA 측 principal_amount)
--      · 월계동9401 클릭 → TaskDetail 측 SettleDetailBoxSimple 측 견적금액 70,000 / KA 수수료 24,500 (35%)
--   2. 매출 현황 대시보드 측 출장비 측 "기타" −30,000 / 냉매 측 +70,000 정합 (운영자 측 확인)
--   3. AdminApp 측 본 task 측 🚗 아이콘 → 일반 냉매 아이콘 (Zap) 전환
-- ============================================

-- ============================================
-- 롤백 (위급 시):
--   BEGIN;
--   DELETE FROM payments WHERE task_id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;
--   DELETE FROM task_items WHERE task_id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;
--   INSERT INTO task_items (id, task_id, work_type_id, appliance_type_id, qty, unit_price)
--   SELECT (data->>'id')::uuid, (data->>'task_id')::uuid,
--          (data->>'work_type_id')::uuid,
--          NULLIF(data->>'appliance_type_id','')::uuid,
--          (data->>'qty')::int, (data->>'unit_price')::int
--   FROM backup_wolgyedong_260609 WHERE source='task_items';
--   UPDATE tasks SET
--     status        = (SELECT data->>'status' FROM backup_wolgyedong_260609 WHERE source='tasks'),
--     product_price = (SELECT (data->>'product_price')::int FROM backup_wolgyedong_260609 WHERE source='tasks'),
--     travel_fee    = (SELECT (data->>'travel_fee')::int FROM backup_wolgyedong_260609 WHERE source='tasks'),
--     extra_fee     = (SELECT (data->>'extra_fee')::int FROM backup_wolgyedong_260609 WHERE source='tasks'),
--     category_data = (SELECT (data->>'category_data')::jsonb FROM backup_wolgyedong_260609 WHERE source='tasks')
--   WHERE id = 'b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid;
--   -- payments 측 mark_visit_only RPC 측 재호출 측 옛 출장비_30K 측 재생성:
--   SELECT mark_visit_only('b15ab2fe-58c0-45e5-bda5-7d52acc6b0d4'::uuid, 'wrong_type', '');
--   COMMIT;
-- ============================================
