-- ============================================
-- Migration 030 — users INSERT 시 자동 인증 초기화
-- 작성일  : 2026-05-18
-- 범위    : users 테이블 INSERT 시 password_hash / email / must_change_password
--          자동 박음 (시드 33명 Migration 007 [2]와 동일 spec)
--
-- 원래 spec 번호는 "Migration 008"이었으나 008_engineer_permissions.sql과 충돌해
-- 다음 빈 번호 030으로 박음 (내용은 spec 그대로).
--
-- 시드 spec과 동일:
--   email                = phone_clean || '@allit.internal'
--   password_hash        = bcrypt(휴대폰 뒷 4자리)
--   must_change_password = true
--
-- 효과:
--   - 운영자가 "프로 관리"에서 신규 기사 추가 → users INSERT →
--     trigger가 자동으로 phone 기반 email + 뒷4자리 hash 박음
--   - 신규 기사: 자기 휴대폰 번호 + 뒷4자리로 첫 로그인 가능
--   - 첫 로그인 후 must_change_password=true 흐름으로 비번 변경 강제
--
-- 회귀 방지:
--   - password_hash 이미 박힌 INSERT (Supabase Auth 등 미래): 가드로 그대로 통과
--   - email / must_change_password 이미 박힌 경우: 그대로
--   - 기존 row (시드 33명 / 사장님 A004 admin): BEFORE INSERT 이므로 영향 0
--   - users RLS / 다른 화면 / 기사 PWA: 영향 0
--
-- 실행:
--   - Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   - 한 번만 실행하면 됨 (CREATE OR REPLACE + DROP IF EXISTS로 재실행 안전)
-- ============================================

CREATE OR REPLACE FUNCTION auto_init_user_auth() RETURNS TRIGGER AS $$
DECLARE phone_clean TEXT;
BEGIN
  -- 가드: password_hash 이미 박힌 경우 그대로 (시드/마이그레이션 호환)
  IF NEW.password_hash IS NOT NULL THEN RETURN NEW; END IF;

  -- phone 정규화 (-/공백/+ 제거)
  phone_clean := REPLACE(REPLACE(REPLACE(COALESCE(NEW.phone,''), '-',''), ' ',''), '+','');

  -- phone 없거나 너무 짧으면 skip (안전)
  IF phone_clean = '' OR LENGTH(phone_clean) < 4 THEN RETURN NEW; END IF;

  -- email 자동 박기 (이미 박혀있으면 그대로)
  IF NEW.email IS NULL OR NEW.email = '' THEN
    NEW.email := phone_clean || '@allit.internal';
  END IF;

  -- password_hash = bcrypt(phone 뒷4자리)
  NEW.password_hash := extensions.crypt(RIGHT(phone_clean, 4), extensions.gen_salt('bf'));

  -- 첫 로그인 시 비번 변경 강제
  IF NEW.must_change_password IS NULL THEN NEW.must_change_password := true; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_init_user_auth_trg ON users;
CREATE TRIGGER auto_init_user_auth_trg
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_init_user_auth();

-- ============================================
-- (선택) 검증 SQL — 사장님이 trigger 박힌 후 신규 기사 추가하고 확인
-- ============================================
-- 1. 함수 박힌 거 확인:
-- SELECT proname FROM pg_proc WHERE proname = 'auto_init_user_auth';
--
-- 2. trigger 박힌 거 확인:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'auto_init_user_auth_trg';
--
-- 3. 신규 기사 추가 후 password_hash 자동 박힌 거 확인:
-- SELECT code, name, phone, email, (password_hash IS NULL) AS no_password, must_change_password
-- FROM users
-- WHERE created_at > now() - interval '7 days'
-- ORDER BY created_at DESC;
--
-- → 신규 기사: no_password=false, must_change_password=true 정답
