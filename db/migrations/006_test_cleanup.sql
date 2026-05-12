-- ============================================
-- Migration 006 — 테스트 데이터 박은 영역 박음 (cleanup)
-- 작성일  : 2026-05-12 (Day 5)
-- 범위    : TEST-% 박은 영역 박은 영역 + status_history 박은 영역 박음
-- 실행    : 006_test_tasks.sql 박은 후 박을 차례
-- ============================================

BEGIN;

-- [1] status_history 박은 영역 박음 (FK CASCADE 박은 영역 박지만 명시적으로)
DELETE FROM status_history
WHERE task_id IN (
  SELECT id FROM tasks
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
    AND task_no LIKE 'TEST-%'
);

-- [2] tasks 박은 영역 박음
DELETE FROM tasks
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND task_no LIKE 'TEST-%';

COMMIT;

-- ============================================
-- 검증 — 남은 테스트 행 박혀있나 (기대: 0)
-- ============================================
SELECT count(*) AS remaining_test_tasks
FROM tasks
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND task_no LIKE 'TEST-%';

SELECT count(*) AS remaining_test_history
FROM status_history th
JOIN tasks t ON th.task_id = t.id
WHERE t.task_no LIKE 'TEST-%';

-- ============================================
-- 끝 — 두 카운트 모두 0 박혀있으면 정리 성공.
-- ============================================
