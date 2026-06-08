-- ============================================
-- Migration 097 — 강남구6429 사전 정리 + 강북구9810 / 강남구6429 재계산
-- 작성 : 2026-06-08
-- 실행 : 사장님 직접 — Supabase 콘솔 → SQL Editor → 통째 → Run
--        ⚠️ 096 (compute_payment v19) 측 먼저 적용된 상태에서 본 097 실행.
-- ============================================
--
-- 본 097 처리 범위:
--   [A] 강남구6429 (crikrin, CK-260608-001):
--       · 데이터 정정 3종 — 비정상 접수 (product=0 + extra=110,000 + appliance NULL + unit_price=0):
--           (1) tasks: product_price=80,000 (crikrin/refrigerant/stand 정가) + extra_fee=30,000 (현장추가)
--           (2) task_items: unit_price=80,000 (subtotal 측 GENERATED ALWAYS — 자동 80,000 갱신)
--                            received_amount=110,000 유지 → Phase C row_extra=30,000
--           (3) task_items.appliance_type_id=stand (이미 set 측 measure idempotent)
--       · ⚠️ tasks.extra_fee=30,000 필수 — v19 기사 override 측 tasks.product_price+extra_fee 측 측 측.
--                                          task_item received 측 측 측 측 측 측 측 측 측 80k×60%=48k 측 측 측.
--       · 사전 검증: crikrin/refrigerant/stand 정책 존재 확인 완료
--           policy_key=crikrin_refri_stand, calc_method=비율_견적금액, fee_rate=0.2
--       · compute_payment 측 자동 발화 + 보강 호출 → payments 신규 INSERT
--       · 기대: engineer=66,000 / principal=16,000 / owner=28,000
--           산식:
--             eng  = (80,000+30,000) × 60% = 66,000   (v19 override)
--             prin = 80,000 × 0.2 = 16,000            (비율_견적금액 측 quoted_amount 측 측 측 extra 제외)
--             own  = 110,000 − 66,000 − 16,000 = 28,000
--
--   [B] 강북구9810 (yongin, A-260608-003):
--       · 데이터 정리 불필요 (v19 함수 자체가 정정).
--       · compute_payment 호출 → payments 재계산.
--       · 기대: engineer=192,000 / principal=10,000 / owner=118,000
--
-- 사전 검증 (실행 직전):
--   · 096 적용 확인:
--       SELECT obj_description(oid) FROM pg_proc WHERE proname = 'compute_payment';
--     → 'v19' 포함 확인.
--   · 강남구 현재 상태:
--       SELECT t.product_price, t.extra_fee, ti.unit_price, ti.subtotal, ti.received_amount, ti.appliance_type_id
--       FROM tasks t JOIN task_items ti ON ti.task_id = t.id
--       WHERE t.id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5';
--     → product=0, extra=110000, unit_price=0, subtotal=0, received=110000, appliance=stand 확인.
--
-- 사장님 현장 확인 완료 (2026-06-08): 강남구6429 = 스탠드 (stand, crikrin 정가 80,000) + 현장추가 30,000
-- ============================================

BEGIN;

-- ============================================
-- [A] 강남구6429 — appliance set + 재계산
-- ============================================

-- [A-1] 백업 (rollback 측 사전 보존)
CREATE TEMP TABLE IF NOT EXISTS _backup_097_gangnam AS
SELECT 'task_items' AS src, id::text AS row_id, to_jsonb(t.*) AS data
FROM task_items t WHERE task_id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5'
UNION ALL
SELECT 'payments' AS src, id::text AS row_id, to_jsonb(p.*) AS data
FROM payments p WHERE task_id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5'
UNION ALL
SELECT 'tasks' AS src, id::text AS row_id, to_jsonb(t.*) AS data
FROM tasks t WHERE id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5';

SELECT src, row_id, data->>'appliance_type_id' AS appliance_id, data->>'received_amount' AS recv
FROM _backup_097_gangnam;

-- [A-2] tasks UPDATE — product_price 80,000 / extra_fee 30,000 (분리 정정)
--   ⚠️ extra_fee=30,000 필수 — v19 기사 override 측 (product + extra) × rate 측 측 측 측.
--   task_item received 측 측 measure measure measure 측 80,000 × 60% = 48,000 측 측 측 측 측 측.
UPDATE tasks
SET product_price = 80000,
    extra_fee     = 30000
WHERE id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5'
  AND (product_price IS DISTINCT FROM 80000 OR extra_fee IS DISTINCT FROM 30000);

-- [A-3] task_items UPDATE — unit_price=80,000 + appliance_type_id=stand (idempotent)
--   · subtotal 측 GENERATED ALWAYS AS ((qty * unit_price)::int) STORED → 자동 80,000 갱신.
--   · received_amount=110,000 측 그대로 유지 (Phase C row_extra=30,000 측 측 측 측).
--   · 본 UPDATE 측 task_items_compute_trg(Mig 028) 측 자동 발화 → compute_payment 호출.
UPDATE task_items
SET unit_price        = 80000,
    appliance_type_id = (SELECT id FROM appliance_types WHERE code = 'stand')
WHERE task_id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5'
  AND (
    unit_price IS DISTINCT FROM 80000
    OR appliance_type_id IS DISTINCT FROM (SELECT id FROM appliance_types WHERE code = 'stand')
  );

-- [A-4] 보강 호출 — 트리거 측 이미 발화했어도 idempotent (DELETE + INSERT).
SELECT compute_payment('be31c04b-9283-4ca2-ae3e-546db7010fc5'::uuid) AS gangnam_payment_id;

-- [A-5] 강남구 검증
SELECT
  t.task_no, t.customer_name,
  t.product_price, t.extra_fee, t.travel_fee,
  ti.unit_price, ti.subtotal, ti.received_amount,
  p.engineer_amount, p.principal_amount, p.owner_amount,
  p.calc_method, p.policy_key, p.track, p.status,
  p.computed_at
FROM tasks t
LEFT JOIN task_items ti ON ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)
LEFT JOIN payments p ON p.task_id = t.id
WHERE t.id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5';
-- 기대: product=80000, extra=30000, unit_price=80000, subtotal=80000, received=110000,
--       eng=66000, prin=16000, own=28000,
--       calc_method='비율_견적금액', policy_key='crikrin_refri_stand'.

-- ============================================
-- [B] 강북구9810 — 재계산 (데이터 정리 불필요, v19 함수만으로 정정)
-- ============================================

-- [B-1] 백업
CREATE TEMP TABLE IF NOT EXISTS _backup_097_gangbuk AS
SELECT 'payments' AS src, id::text AS row_id, to_jsonb(p.*) AS data
FROM payments p WHERE task_id = '7e03a275-f638-4199-9a40-7ef810e79b76';

SELECT src, row_id,
       data->>'engineer_amount' AS eng_before,
       data->>'principal_amount' AS prin_before,
       data->>'owner_amount' AS own_before
FROM _backup_097_gangbuk;

-- [B-2] compute_payment 호출 (v19) — 측 받기 측 — idempotent.
SELECT compute_payment('7e03a275-f638-4199-9a40-7ef810e79b76'::uuid) AS gangbuk_payment_id;

-- [B-3] 강북구 검증
SELECT
  t.task_no, t.customer_name,
  t.product_price, t.extra_fee, t.travel_fee,
  p.engineer_amount, p.principal_amount, p.owner_amount,
  p.calc_method, p.policy_key, p.track, p.status,
  p.computed_at
FROM tasks t LEFT JOIN payments p ON p.task_id = t.id
WHERE t.id = '7e03a275-f638-4199-9a40-7ef810e79b76';
-- 기대: product=100000, extra=220000, eng=192000, prin=10000, own=118000,
--       calc_method='정액', policy_key='yongin_refri_2in1'.

-- ============================================
-- [C] 용산구4527 회귀 확인 (변동 0 기대)
-- ============================================
SELECT
  t.task_no, t.customer_name,
  p.engineer_amount, p.principal_amount, p.owner_amount,
  p.calc_method, p.policy_key
FROM tasks t LEFT JOIN payments p ON p.task_id = t.id
WHERE t.id = 'a4dc2dca-d42a-41b7-b976-946b04e31511';
-- 기대 (v18 동일): eng=108000, prin=0, own=72000 — 회귀 0.
-- 본 097 측 용산구는 compute_payment 직접 호출 안 함 (필요 시 별도 호출).

COMMIT;

-- ============================================
-- 추가 권장 (별도 실행 — 회귀 sanity check):
-- ============================================
-- 1) 용산구4527 도 v19 회귀 0 측 명시 확인하려면:
--   SELECT compute_payment('a4dc2dca-d42a-41b7-b976-946b04e31511'::uuid);
--   SELECT engineer_amount, principal_amount, owner_amount
--   FROM payments WHERE task_id = 'a4dc2dca-d42a-41b7-b976-946b04e31511';
--   기대: eng=108000, prin=0, own=72000 (동일).
--
-- 2) 최근 1주 refrigerant 완료 task 5건 sample 회귀 확인:
--   WITH s AS (
--     SELECT t.id, p.engineer_amount AS e_old, p.principal_amount AS p_old, p.owner_amount AS o_old
--     FROM tasks t JOIN payments p ON p.task_id = t.id
--     WHERE t.status = '완료'
--       AND t.updated_at > now() - interval '7 days'
--       AND EXISTS (
--         SELECT 1 FROM task_items ti
--           JOIN work_types wt ON wt.id = ti.work_type_id
--           JOIN service_types st ON st.id = wt.service_type_id
--         WHERE ti.task_id = t.id AND st.code = 'refrigerant' AND NOT COALESCE(ti.is_canceled, false)
--       )
--     ORDER BY random() LIMIT 5
--   )
--   SELECT s.id, s.e_old, s.p_old, s.o_old,
--          compute_payment(s.id) AS new_pid
--   FROM s;
--   -- 적용 후 다시 payments SELECT 측 diff 0 확인 (rate=60 기사 + 비-정액 정책 → 0 기대).
--
-- ============================================
-- 롤백 (위급 시):
-- ============================================
-- [강남구]
--   · tasks 원복:
--     UPDATE tasks SET product_price = 0, extra_fee = 110000
--     WHERE id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5';
--   · task_items 원복:
--     UPDATE task_items SET unit_price = 0, appliance_type_id = NULL
--     WHERE task_id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5';
--   · payments DELETE (v19 결과 폐기):
--     DELETE FROM payments WHERE task_id = 'be31c04b-9283-4ca2-ae3e-546db7010fc5';
--
-- [강북구]
--   · 094 (v18) 재실행 → compute_payment 다시 호출 → eng=60000 측 복원:
--     SELECT compute_payment('7e03a275-f638-4199-9a40-7ef810e79b76'::uuid);
--
-- ============================================
