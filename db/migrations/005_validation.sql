-- ============================================
-- Migration 005 — Validation (SELECT 전용 / 변경 X)
-- 작성일  : 2026-05-12 (Day 5 / 시트 명단 36명 박은 영역)
-- 범위    : 001 + 003 + 004 적용 박힌 영역 측 검증
-- 실행    : Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 기대 결과:
--   tenants: 1 / principals: 7 / users: 36 / user_roles: 38
--   categories: 1 / service_types: 7 / appliance_types: 7 / work_types: 13
--   policies: 72 / permissions: 0 (다음 단계 박을 영역)
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
-- 역할별 사용자 카운트 (기대: admin 4 / engineer 29 / happycall 2 / partner 3)
-- ============================================
SELECT role, count(*) AS cnt FROM user_roles GROUP BY role ORDER BY role;

-- ============================================
-- 한 사람 = 한 row 정규화 검증 (다중 role)
-- ============================================
SELECT u.code, u.name, count(ur.role) AS role_count, array_agg(ur.role ORDER BY ur.role) AS roles
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE u.tenant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY u.code, u.name
HAVING count(ur.role) > 1
ORDER BY u.code;
-- 기대: E022 조동욱 [admin, engineer] / E002 구현서 [admin, engineer]

-- ============================================
-- 원청별 정책 카운트 (옛 7 원청 박은 영역)
-- ============================================
SELECT principal_code, service_code, count(*) AS cnt
FROM commission_policies
GROUP BY principal_code, service_code
ORDER BY principal_code, service_code;

-- ============================================
-- 원청별 partner 박혔나
-- ============================================
SELECT p.code AS principal, u.code AS user_code, u.name
FROM user_roles ur
JOIN users u ON ur.user_id = u.id
JOIN principals p ON ur.principal_id = p.id
WHERE ur.role = 'partner'
ORDER BY p.code;
-- 기대: KA → P001 에어컨프로 사장님 / crikrin → P002 크리크린 / usol_h → P003 유솔홈케어

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
  AND routine_name IN ('current_tenant_id', 'current_user_has_role', 'current_user_principal_id', 'compute_payment', 'log_task_status_change', 'sign_in_with_phone', 'change_password')
ORDER BY routine_name;

SELECT table_name FROM information_schema.views
WHERE table_schema = 'public';
