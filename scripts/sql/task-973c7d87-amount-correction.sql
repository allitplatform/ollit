-- 반포 task 973c7d87 — 금액 2배 버그 정정 (Supabase SQL Editor 측 실행)
-- 2026-05-26
--
-- 배경:
--   · task_no: YS-260526-001 (반포)
--   · 폼 입력: 견적 금액 190,000 (qty=2)
--   · DB 측 상태: product_price=380,000 / task_items.unit_price=190,000 / subtotal=380,000 (×2 측 catch)
--   · 원인: Mig 017 trigger 측 catch workItem.quote 측 X 측 catch NEW.product_price 측 catch fallback
--           → unit_price=총액 → subtotal=qty×총액 측 catch ×qty 측 catch
--   · 폼 수정 측 catch 완료 (commit 01571db) — 측 catch 측 catch task 측 catch DB 측 catch 1건 별도 정정.
--
-- 정정 방법:
--   task_items.unit_price 측 catch 95,000 측 catch UPDATE
--   → trigger chain 측 catch 자동:
--     1) task_items.subtotal (GENERATED) 측 catch 재계산: 2 × 95,000 = 190,000
--     2) Mig 070 task_items_resync_task_total_trg → tasks.product_price = Σsubtotal = 190,000
--     3) tasks.total_amount (GENERATED) = product_price + extra_fee + travel_fee = 190,000
--     4) Mig 027 compute_payment_trg fire → payments 재계산 (status='미배정' 측 catch 측 catch 측 X)
--
-- 실행 순서: 1 → 2 → 3 (각 SELECT 측 catch 측 catch UPDATE 측 catch 측 catch 측 catch 측 측 측)

-- ============================================================
-- 1) 정정 전 현재 상태 확인
-- ============================================================
SELECT t.task_no, t.product_price, t.total_amount,
       ti.qty, ti.unit_price, ti.subtotal
FROM tasks t JOIN task_items ti ON ti.task_id = t.id
WHERE t.id = '973c7d87-f56f-43db-a0b2-1bf56da3e1a0';
-- 기대: product_price=380000 / total_amount=380000 / qty=2 / unit_price=190000 / subtotal=380000


-- ============================================================
-- 2) 정정 — unit_price 측 catch 95,000 측 catch UPDATE
-- ============================================================
-- trigger chain 측 catch 측 catch subtotal / product_price / total_amount 측 catch 재계산.
UPDATE task_items
   SET unit_price = 95000
 WHERE task_id = '973c7d87-f56f-43db-a0b2-1bf56da3e1a0';
-- 기대: 1 row updated


-- ============================================================
-- 3) 정정 후 검증
-- ============================================================
SELECT t.task_no, t.product_price, t.total_amount,
       ti.qty, ti.unit_price, ti.subtotal
FROM tasks t JOIN task_items ti ON ti.task_id = t.id
WHERE t.id = '973c7d87-f56f-43db-a0b2-1bf56da3e1a0';
-- 기대: product_price=190000 / total_amount=190000 / qty=2 / unit_price=95000 / subtotal=190000
