-- 038_task_items_settlement_cycle.sql
-- 2026-05-19 — task_items 정산 사이클 컬럼 추가 (Phase 5 Step 0.B)
-- 배경:
--   1 task = 1 고객 방문 (그룹) / task_items별로 정산 시점 다름 (네이버 → 유솔 → 회사 입금이 각 상품주문번호별)
--   → tasks 변경 0 / task_items 측에 정산 시점 + 메타 컬럼 추가
-- 영향:
--   기존 1,143건 task_items = 새 컬럼 모두 NULL로 시작 (NULL 허용)
--   Stage 0.C 시점 "결제완료 / 회사 입금 / 기사 정산 완료" 버튼 UI 추가 spec
-- 정산 사이클 (사장님 spec):
--   매주 월요일 정산 = 그 주 11~17일 작업분
--   사장님 → 유솔 정산시트 받음 → CSV 매칭 → 결제완료 → naver_settled_at 일괄 마킹
--   유솔 → 회사 입금 후 회사 입금 완료 → company_received_at
--   매월 15일 회사 → 기사 송금 → 기사 정산 완료 → engineer_settled_at

ALTER TABLE task_items
  ADD COLUMN naver_settled_at    timestamptz NULL,
  ADD COLUMN company_received_at timestamptz NULL,
  ADD COLUMN engineer_settled_at timestamptz NULL,
  ADD COLUMN net_amount          int         NULL,
  ADD COLUMN product_order_id    varchar     NULL,
  ADD COLUMN order_type          text        NULL
    CHECK (order_type IS NULL OR order_type IN ('본작업', '추가선택', '방문비', '현금수동'));

-- 인덱스 (정산 사이클 단계별 조회 + 상품주문번호 lookup 가속)
CREATE INDEX task_items_naver_settled_idx    ON task_items(naver_settled_at)    WHERE naver_settled_at    IS NOT NULL;
CREATE INDEX task_items_company_received_idx ON task_items(company_received_at) WHERE company_received_at IS NOT NULL;
CREATE INDEX task_items_engineer_settled_idx ON task_items(engineer_settled_at) WHERE engineer_settled_at IS NOT NULL;
CREATE INDEX task_items_product_order_id_idx ON task_items(product_order_id)    WHERE product_order_id    IS NOT NULL;

-- 컬럼 코멘트
COMMENT ON COLUMN task_items.naver_settled_at    IS '네이버 → 유솔 결제 완료 시각 (각 상품주문번호별 / 매주 월요일 정산)';
COMMENT ON COLUMN task_items.company_received_at IS '유솔 → 회사 입금 완료 시각';
COMMENT ON COLUMN task_items.engineer_settled_at IS '회사 → 기사 정산 완료 시각 (매월 15일 일괄)';
COMMENT ON COLUMN task_items.net_amount          IS '각 항목별 실수령 금액 (subtotal에서 수수료 차감 후)';
COMMENT ON COLUMN task_items.product_order_id    IS '네이버 상품주문번호 (정산 CSV 매칭 키)';
COMMENT ON COLUMN task_items.order_type          IS '본작업 / 추가선택 / 방문비 / 현금수동';
