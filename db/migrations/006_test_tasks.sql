-- ============================================
-- Migration 006 — tasksDb 테스트 (개발용)
-- 작성일  : 2026-05-12 (Day 5)
-- 범위    : 더미 task 박음 + 박힌 영역 박음 + status_history trigger 확인
-- 실행    : Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 다음    : 006_test_cleanup.sql (테스트 데이터 박은 영역 박음)
-- 전제    : 001 + 003 + 004 + 002a 적용 박힘
-- ⚠️ 운영 박지 X — 개발/검증 박은 영역 박힘.
-- ============================================

-- ============================================
-- [1] 더미 task 박음 (createTaskDb 시뮬레이션)
-- 기대: 1 row / total_amount = 130000 (product_price + travel_fee, GENERATED)
-- ============================================
BEGIN;

INSERT INTO tasks (
  tenant_id, task_no, principal_id, category_id, channel,
  customer_name, phone, address, district, request_note,
  status, product_price, travel_fee
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'TEST-260512-001',
  '22222222-2222-2222-2222-222222222001',   -- allday (올데이케어)
  '33333333-3333-3333-3333-333333333001',   -- aircon (Phase 1 MVP)
  'phone',
  '테스트 고객',
  '010-1234-5678',
  '서울시 강남구 테헤란로 123',
  '강남구',
  '벽걸이 에어컨 1대 세척',
  '미배정',
  100000,
  30000
)
RETURNING id, task_no, customer_name, status, total_amount;

COMMIT;

-- ============================================
-- [2] 박힌 영역 catch (loadTasksDb 시뮬레이션)
-- 기대: 1 row (테스트 고객 / status='미배정' / total_amount=130000)
-- ============================================
SELECT
  id, task_no, customer_name, phone, status,
  product_price, travel_fee, total_amount,
  received_at, created_at
FROM tasks
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND task_no LIKE 'TEST-%'
ORDER BY received_at DESC;

-- ============================================
-- [3] 박은 영역 박음 (assignEngineerDb 시뮬레이션)
-- 기대: assigned_engineer_id 박힘 / status='약속대기' / updated_at 갱신
-- ============================================
UPDATE tasks
SET
  assigned_engineer_id = (
    SELECT id FROM users
    WHERE code = 'E022'
      AND tenant_id = '11111111-1111-1111-1111-111111111111'
  ),
  status = '약속대기',
  updated_at = now()
WHERE task_no = 'TEST-260512-001'
RETURNING id, task_no, assigned_engineer_id, status, updated_at;

-- ============================================
-- [4] status_history 박혔나 확인 (log_task_status_change trigger)
-- 기대: 1 row / from_status='미배정' / to_status='약속대기'
-- ============================================
SELECT
  th.id, t.task_no,
  th.from_status, th.to_status, th.changed_at
FROM status_history th
JOIN tasks t ON th.task_id = t.id
WHERE t.task_no = 'TEST-260512-001'
ORDER BY th.changed_at DESC;

-- ============================================
-- [5] 박은 영역 박음 (updateTaskDb 시뮬레이션 / 002a 컬럼 박은 영역)
-- 기대: work_memo / happycall_at 박힘 / status 그대로 (변경 X)
-- ============================================
UPDATE tasks
SET
  work_memo    = '테스트 메모 박음',
  happycall_at = now(),
  updated_at   = now()
WHERE task_no = 'TEST-260512-001'
RETURNING id, task_no, work_memo, happycall_at, status;

-- ============================================
-- 끝 — 5 단계 검증 박힘. 다음: 006_test_cleanup.sql 박을 차례.
-- ============================================
