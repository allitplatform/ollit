-- ============================================
-- Cleanup — users 관련만 삭제 (개발용)
-- 작성일  : 2026-05-12 (Day 5)
-- 범위    : engineer_permissions / user_roles / users 박은 영역 박은 영역 박음
-- 박지 X  : commission_policies / principals / categories / service_types 등
--          (수수료 별도 단계 박은 영역 박은 영역 박을 영역 박지 X)
-- 실행    : Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 다음    : 004_seed.sql 재실행 (users 36 / user_roles 38 박음)
-- ⚠️ 운영 박지 X — 시드 박은 영역 박을 영역 박은 영역.
-- ============================================

BEGIN;

-- [1] engineer_permissions 박은 영역 박음
DELETE FROM engineer_permissions
WHERE user_id IN (
  SELECT id FROM users
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
);

-- [2] user_roles 박은 영역 박음
DELETE FROM user_roles
WHERE user_id IN (
  SELECT id FROM users
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
);

-- [3] users 박은 영역 박음
DELETE FROM users
WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

COMMIT;

-- ============================================
-- 검증 — 남은 row 카운트 (기대: 모두 0)
-- ============================================
SELECT
  (SELECT count(*) FROM users               WHERE tenant_id = '11111111-1111-1111-1111-111111111111') AS users_left,
  (SELECT count(*) FROM user_roles ur JOIN users u ON ur.user_id = u.id WHERE u.tenant_id = '11111111-1111-1111-1111-111111111111') AS roles_left,
  (SELECT count(*) FROM engineer_permissions ep JOIN users u ON ep.user_id = u.id WHERE u.tenant_id = '11111111-1111-1111-1111-111111111111') AS perms_left,
  (SELECT count(*) FROM principals          WHERE tenant_id = '11111111-1111-1111-1111-111111111111') AS principals_keep,
  (SELECT count(*) FROM commission_policies WHERE tenant_id = '11111111-1111-1111-1111-111111111111') AS policies_keep;
-- 기대: users_left=0 / roles_left=0 / perms_left=0 / principals_keep=7 / policies_keep=72
