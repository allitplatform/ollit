-- ============================================================================
-- Migration 068 — tasks 부분완료 컬럼 2개 추가
-- 작성: 2026-05-25
-- ============================================================================
-- 배경:
--   기사 PWA "부분 완료" 흐름 — 상품(task_item)별 실 작업 수량 조정 + 사유/메모.
--   task_items.qty UPDATE는 측 catch task_items_compute_trg(Mig 028)가 자동 재계산.
--   tasks에 사유/메모 보관할 컬럼 추가.
--
-- 변경:
--   ALTER TABLE tasks ADD COLUMN IF NOT EXISTS partial_reason text;
--   ALTER TABLE tasks ADD COLUMN IF NOT EXISTS partial_memo   text;
--
-- 영향:
--   - 측 catch row 측 catch X (nullable / DEFAULT 측 catch)
--   - 측 6 원청 측 catch — 컬럼 측 catch / 측 catch 측 catch X
--   - 측 catch tasks SELECT * 호출처 — 측 catch 컬럼 측 catch 측 catch 측 catch X
--
-- 재실행: IF NOT EXISTS 측 catch — idempotent
-- ============================================================================

BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS partial_reason text,
  ADD COLUMN IF NOT EXISTS partial_memo   text;

COMMENT ON COLUMN tasks.partial_reason IS '부분완료 사유 ID (customer_change / appliance_issue / 측 등)';
COMMENT ON COLUMN tasks.partial_memo   IS '부분완료 메모 — 자동 생성된 측 catch (상품별 주문→실제, 취소 K건) + 기사 메모';

COMMIT;

-- ============================================================================
-- 검증 SQL (별도 실행)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'tasks' AND column_name IN ('partial_reason','partial_memo');
-- 기대: 2 row, text, YES
