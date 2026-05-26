-- 반포 task 973c7d87 — payments 재계산 (Supabase SQL Editor 측 실행)
-- 2026-05-26
--
-- 배경:
--   · task_no: YS-260526-001 (반포)
--   · 이전 SQL (task-973c7d87-amount-correction.sql)로 task_items.unit_price=95000 정정 완료.
--   · tasks.product_price/total_amount = 190,000 으로 재계산됨 ✓
--   · 그러나 payments 행은 옛 380,000 기준 그대로 (stale):
--     product_price=380000 / engineer=100000 / principal=28500 / owner=251500
--
-- 원인 (trigger order):
--   task_items UPDATE 측 catch fire 측 catch trigger 측 catch 측 (alphabetic order):
--     1. partial_sync_before_trg (BEFORE) — 측 측 catch X
--     2. task_items_compute_trg (AFTER, 'c' < 'r') — compute_payment 호출
--        ★ 측 시점 측 catch tasks.product_price = 측 catch 380K (resync 측 catch fire 전)
--        → payments 측 catch product_price=380K 측 catch 측 catch.
--     3. task_items_resync_task_total_trg (AFTER, 'r') — tasks.product_price=190K 측 catch UPDATE.
--     4. compute_payment_trg (Mig 027, AFTER UPDATE OF product_price ON tasks) fire:
--        ★ trigger_compute_payment (Mig 016) 측 catch `IF NEW.status = '완료'` 가드 측 catch
--          → status='미배정' 측 catch skip → payments 측 catch 측 catch 측 catch X.
--
-- 정정 방법:
--   compute_payment(p_task_id) 측 catch DELETE+INSERT (idempotent) — 수동 호출 측 catch 측 catch.
--   함수 본체 측 catch status 가드 측 X — '미배정' 측 catch 측 catch 측 catch 측 catch 측 catch.
--
-- 실행 순서: 1 → 2 → 3 (각 SELECT 측 catch 측 catch compute 측 catch 측 측 측)

-- ============================================================
-- 1) 정정 전 — 현재 payments stale 상태 확인
-- ============================================================
SELECT
  t.task_no, t.product_price AS t_product_price, t.total_amount,
  p.product_price AS p_product_price,
  p.engineer_amount, p.principal_amount, p.owner_amount,
  p.calc_method, p.policy_key, p.computed_at
FROM tasks t LEFT JOIN payments p ON p.task_id = t.id
WHERE t.id = '973c7d87-f56f-43db-a0b2-1bf56da3e1a0';
-- 기대 (정정 전):
--   t_product_price=190000 / total_amount=190000  ← tasks 측 정정 완료
--   p_product_price=380000 / engineer=100000 / principal=28500 / owner=251500  ← payments stale


-- ============================================================
-- 2) compute_payment 수동 호출 — payments 재계산
-- ============================================================
-- compute_payment 측 catch DELETE FROM payments + INSERT INTO payments (idempotent).
-- 측 catch task_items 측 catch 측 catch 측 catch (unit_price=95K, subtotal=190K) — 측 catch 측 catch 측 catch.
SELECT compute_payment('973c7d87-f56f-43db-a0b2-1bf56da3e1a0') AS new_payment_id;
-- 기대: 측 catch payment_id (UUID) 측 catch. 측 catch 측 catch 측 catch payment 측 catch DELETE 측 catch 측 catch INSERT.


-- ============================================================
-- 3) 정정 후 검증 — payments 측 catch 190,000 기준 측 catch 측 catch
-- ============================================================
SELECT
  t.task_no, t.product_price AS t_product_price, t.total_amount,
  p.product_price AS p_product_price,
  p.engineer_amount, p.principal_amount, p.owner_amount,
  (p.engineer_amount + p.principal_amount + p.owner_amount) AS sum_three,
  p.calc_method, p.policy_key, p.computed_at, p.is_balanced
FROM tasks t LEFT JOIN payments p ON p.task_id = t.id
WHERE t.id = '973c7d87-f56f-43db-a0b2-1bf56da3e1a0';
-- 기대 (정정 후):
--   t_product_price=190000 / total_amount=190000
--   p_product_price=190000  ← ★ 정상 측 측
--   engineer + principal + owner = 190,000  ← sum_three = 190000
--   calc_method = '비율_판매가' (옛 measurement 측 catch, ratio 측 catch — 측 catch 측 catch 측 catch 측 catch 측 catch ½)
--   is_balanced = true
--   computed_at = 측 catch 측 catch 시각


-- ============================================================
-- 참고 — engineer/principal/owner 측 catch 측 catch
-- ============================================================
-- usol_h_cleaning_1way policy / 비율_판매가:
--   측 catch policy 측 catch 정확한 비율 측 catch commission_policies 측 catch 측 catch.
--   기존 (380K 측 catch): engineer=100K / principal=28.5K / owner=251.5K
--   재계산 (190K 측 catch): 측 catch 측 catch 측 catch 측 catch 1/2 측 catch — 측 catch 측 catch:
--     engineer=50K / principal=14.25K (또는 정수 측 catch 14250) / owner≈125.75K
--   ※ 측 catch 측 catch 측 catch X — calculate_commission(usol_h, cleaning, 1way, 95K) 측 catch 측 catch.
