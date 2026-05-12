-- ============================================
-- Migration 007 — Validation (SELECT 전용 / 변경 X)
-- 작성일  : 2026-05-12 (Day 5)
-- 범위    : 007_auth_setup.sql 적용 박은 후 검증
-- 실행    : Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 기대 결과:
--   [1] 4 컬럼 박혔음 (email / password_hash / must_change_password / last_login_at)
--   [2] total=33, with_email=33, with_password=33, need_change=33
--   [3] sample 5 row — email 박혀있음 / must_change_password=true
--   [4] 함수 2개 박혔음 (sign_in_with_phone / change_password / SECURITY DEFINER)
--   [5] 로그인 박은 영역 박음 — ok=true / name='조동욱' / E022
-- ============================================

-- [1] 새 컬럼 박혔나
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
  AND column_name IN ('email', 'password_hash', 'must_change_password', 'last_login_at')
ORDER BY column_name;

-- [2] 시드 박은 영역 박혔나 — 33명 모두 email + password_hash 박힌 영역
SELECT
  count(*) AS total,
  count(email) AS with_email,
  count(password_hash) AS with_password,
  count(*) FILTER (WHERE must_change_password) AS need_change
FROM users
WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

-- [3] sample 5명
SELECT code, name, phone, email, must_change_password
FROM users
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
ORDER BY code
LIMIT 5;

-- [4] 함수 박혔나
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('sign_in_with_phone', 'change_password')
ORDER BY routine_name;

-- [5] 로그인 박은 영역 박음 — 조동욱 E022 (phone=010-9447-1547 / password='1547')
SELECT sign_in_with_phone('010-9447-1547', '1547') AS result_correct;

-- [6] 잘못된 비밀번호 박은 영역 박음 — invalid_password 기댓값
SELECT sign_in_with_phone('010-9447-1547', '9999') AS result_wrong_password;

-- [7] 없는 phone 박은 영역 박음 — user_not_found 기댓값
SELECT sign_in_with_phone('010-0000-9999', '0000') AS result_no_user;

-- ============================================
-- 끝 — 7 단계 검증.
-- ============================================
