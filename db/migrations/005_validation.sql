-- ============================================
-- Migration 005 — Validation (SELECT 전용 / 변경 X)
-- 작성일  : 2026-05-12 (Day 5)
-- 범위    : 001 + 003 + 004 적용 박힌 영역 측 검증
-- 실행    : Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 기대 결과:
--   tenants: 1 / principals: 7 / users: 33 / user_roles: 33
--   service_types: 7 / appliance_types: 7 / work_types: 13
--   policies: ~62 / permissions: ~60
-- ============================================

SELECT
  (SELECT count(*) FROM tenants)             AS tenants,
  (SELECT count(*) FROM principals)          AS principals,
  (SELECT count(*) FROM users)               AS users,
  (SELECT count(*) FROM user_roles)          AS user_roles,
  (SELECT count(*) FROM categories)          AS categories,
  (SELECT count(*) FROM service_types)       AS service_types,
  (SELECT count(*) FROM appliance_types)     AS appliance_types,
  (SELECT count(*) FROM work_types)          AS work_types,
  (SELECT count(*) FROM commission_policies) AS policies,
  (SELECT count(*) FROM engineer_permissions) AS permissions;

-- ============================================
-- 역할별 사용자 카운트
-- ============================================
SELECT role, count(*) AS cnt FROM user_roles GROUP BY role ORDER BY role;

-- ============================================
-- 원청별 정책 카운트
-- ============================================
SELECT principal_code, service_code, count(*) AS cnt
FROM commission_policies
GROUP BY principal_code, service_code
ORDER BY principal_code, service_code;

-- ============================================
-- RLS 활성 확인
-- ============================================
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- 함수 / 뷰 확인
-- ============================================
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('current_tenant_id', 'current_user_has_role', 'current_user_principal_id', 'compute_payment', 'log_task_status_change')
ORDER BY routine_name;

SELECT table_name FROM information_schema.views
WHERE table_schema = 'public';
