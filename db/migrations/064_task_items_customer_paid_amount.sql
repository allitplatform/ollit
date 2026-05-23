-- ════════════════════════════════════════════════════════════════
-- Migration 064 — task_items.customer_paid_amount 컬럼 추가
-- 2026-05-24 — 사장님 확정 (옵션 C — subtotal 의미 유지 + 고객 결제 별도 보관)
-- ════════════════════════════════════════════════════════════════
--
-- 배경
--   네이버 접수 엑셀 "최종 상품별 총 주문금액"(AG) = 고객 실결제액 (예: 10,000원).
--   "정산예정금액" = 네이버 수수료 차감 후 (예: 9,444원).
--
--   기존 spec (Migration 046 v11):
--     task_items.subtotal = unit_price * qty (GENERATED COLUMN)
--     usol_n owner 계산: SUM(task_items.subtotal) = SUM(정산예정금액)
--   → subtotal 측 catch 정산예정금액(9,444) 측 보관 — 그대로 유지.
--
--   신규 요구
--     "고객이 실제 결제한 금액(10,000)"을 작업 상세 화면에 표시 필요.
--   → 별도 컬럼 customer_paid_amount 신설 — 정산 계산엔 사용 X, 표시만.
--
-- 변경
--   ALTER TABLE task_items ADD COLUMN customer_paid_amount int;
--     · nullable — 기존 row는 NULL (재업로드/백필 시 채움)
--     · 단위: 원
--     · 정산 계산 측 사용 X (compute_payment 영향 없음)
--
-- 영향 범위
--   · 코드: naverOrderParser → bulkInsertUsolNOrders → fetchTaskItemsForDetail → ItemAmounts
--   · 정산 계산: 영향 없음
--   · 기존 row: NULL (표시 가드 측 catch)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE task_items
  ADD COLUMN IF NOT EXISTS customer_paid_amount int;

COMMENT ON COLUMN task_items.customer_paid_amount IS
  '고객 실결제액 (네이버 접수 엑셀 "최종 상품별 총 주문금액", AG 칼럼). 표시 전용 / 정산 계산 측 사용 X.';

-- 검증
--   SELECT id, qty, unit_price, subtotal, customer_paid_amount
--   FROM task_items
--   LIMIT 5;
