-- ============================================
-- Migration 033 — task_items.metadata jsonb 컬럼 추가
-- 작성일  : 2026-05-18
-- 범위    : task_items 테이블 metadata jsonb DEFAULT '{}' 컬럼 추가
--
-- 사장님 spec (Fix #31 — 유솔N 시트 → Supabase 마이그):
--   한 task(주문번호) 안에 여러 item이 있을 때, 각 item의 시트 원본 ID 보존.
--   예: {"item_code": "YS-260518-082", "external_item_no": "2026051850084781"}
--
-- 의도:
--   - tasks.task_no = 그룹 첫 row의 작업코드 (대표값)
--   - task_items.metadata = 각 row의 시트 원본 작업코드 + 상품주문번호 보존
--   - 마이그 후 시트 원본 추적 가능 (item_code로 시트 row 역추적)
--
-- 회귀 방지:
--   - DEFAULT '{}' + NOT NULL → 기존 task_items row 자동 빈 객체
--   - 기존 SELECT/INSERT 쿼리 무영향 (새 컬럼 무시)
--   - compute_payment 함수 무영향 (metadata 미참조)
--
-- 실행:
--   - Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   - 한 번만 실행 (ADD COLUMN IF NOT EXISTS idempotent)
-- ============================================

ALTER TABLE task_items
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN task_items.metadata IS
  '아이템별 메타 (시트 마이그 시 원본 ID 보존용). 예: {"item_code": "YS-260518-082", "external_item_no": "2026051850084781"}.';

-- ============================================
-- 검증 SQL
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name='task_items' AND column_name='metadata';
--
-- 기대 1 row:
--   column_name='metadata', data_type='jsonb', is_nullable='NO', column_default='''{}''::jsonb'

-- ============================================
-- 백필 확인 (기존 row 자동 '{}')
-- ============================================
-- SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE metadata = '{}'::jsonb) AS empty_metadata
-- FROM task_items;
--
-- 기대: total = empty_metadata (모든 기존 row metadata 빈 객체)
