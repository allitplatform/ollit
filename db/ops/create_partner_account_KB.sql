-- ============================================================================
-- 운영 SQL - 쿨가이(KB) 원청 계정 만들기
-- 작성 2026-10-07
--
-- !! 아직 실행하지 마세요. !!
--   지금 원청 앱은 쿨가이용 화면이 없습니다. 이 계정으로 로그인하면 유솔용 접수 화면이 나오고,
--   화이트코어 작업의 수수료가 0원으로 보이며, 숨겨야 할 값(수행 기사, 받은 금액 등)이 그대로 내려갑니다.
--   (docs/to_claude.md (49) 조사 결과 참고) 쿨가이 화면이 준비된 뒤에 실행합니다.
--
-- 무엇을 하나
--   users 1행 + user_roles 1행(partner, 원청 = KB).
--   비밀번호 = 휴대폰 뒤 4자리, 첫 로그인 때 변경(must_change_password = true).
--   방식은 화이트코어 기사 등록(register_whitecore_staff_261006.sql)과 같습니다.
--   사용자 코드는 기존 원청 계정과 같은 P + 3자리(P001 ...) 다음 번호.
--
-- 멈추는 경우 (아무것도 넣지 않음)
--   [입력] 을 바꾸지 않았을 때 / 같은 휴대폰 사용자가 이미 있을 때 /
--   원청 code KB 가 없거나 이름에 "쿨가이" 가 없을 때 / KB 에 연결된 partner 계정이 이미 있을 때
--
-- [입력] 아래 두 줄을 바꿉니다.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  c_name   CONSTANT text := '이름을 넣어 주세요';       -- [입력] 이름
  c_phone  CONSTANT text := '010-0000-0000';            -- [입력] 휴대폰 (하이픈 있어도 됨)

  v_tenant uuid := '11111111-1111-1111-1111-111111111111';
  v_digits text := REPLACE(REPLACE(REPLACE(c_phone, '-', ''), ' ', ''), '+', '');
  v_pid    uuid;
  v_pname  text;
  v_dup    text;
  v_next   int;
  v_code   text;
  v_id     uuid;
BEGIN
  IF btrim(c_name) = '' OR c_name = '이름을 넣어 주세요' OR v_digits = '01000000000' THEN
    RAISE EXCEPTION '[입력] 의 이름과 휴대폰을 먼저 바꿔 주세요. 아무것도 넣지 않았습니다.';
  END IF;
  IF v_digits !~ '^01[0-9]{8,9}$' THEN
    RAISE EXCEPTION '휴대폰 번호 모양이 맞지 않습니다: %. 아무것도 넣지 않았습니다.', c_phone;
  END IF;

  SELECT id, name INTO v_pid, v_pname FROM principals WHERE tenant_id = v_tenant AND code = 'KB';
  IF v_pid IS NULL THEN
    RAISE EXCEPTION '원청 code KB 가 없습니다. 아무것도 넣지 않았습니다.';
  END IF;
  IF v_pname NOT LIKE '%쿨가이%' THEN
    RAISE EXCEPTION '원청 code KB 의 이름이 "%" 입니다 ("쿨가이" 가 들어 있지 않음). 아무것도 넣지 않았습니다.', v_pname;
  END IF;

  SELECT string_agg(u.name || ' ' || u.phone || ' (' || COALESCE(u.code, '-') || ')', ', ') INTO v_dup
    FROM users u
   WHERE REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), '-', ''), ' ', ''), '+', '') = v_digits;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION '같은 휴대폰의 사용자가 이미 있습니다: %. 아무것도 넣지 않았습니다.', v_dup;
  END IF;

  SELECT string_agg(u.name || ' (' || COALESCE(u.code, '-') || ')', ', ') INTO v_dup
    FROM user_roles r JOIN users u ON u.id = r.user_id
   WHERE r.role = 'partner' AND r.principal_id = v_pid;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'KB 에 연결된 원청 계정이 이미 있습니다: %. 아무것도 넣지 않았습니다.', v_dup;
  END IF;

  SELECT COALESCE(MAX(SUBSTRING(code FROM 2)::int), 0) + 1 INTO v_next
    FROM users WHERE tenant_id = v_tenant AND code ~ '^P[0-9]{3}$';
  v_code := 'P' || LPAD(v_next::text, 3, '0');

  INSERT INTO users (tenant_id, code, name, phone, is_active, password_hash, must_change_password)
  VALUES (v_tenant, v_code, btrim(c_name), c_phone, true,
          extensions.crypt(RIGHT(v_digits, 4), extensions.gen_salt('bf')), true)
  RETURNING id INTO v_id;

  INSERT INTO user_roles (user_id, role, is_primary, principal_id)
  VALUES (v_id, 'partner', true, v_pid);

  RAISE NOTICE '등록: % % - % (원청 KB)', v_code, btrim(c_name), c_phone;
END $$;

COMMIT;

-- 확인 - 기대: 1행 (role = partner, principal = KB, must_change_password = true)
SELECT u.code, u.name, u.phone, u.is_active, u.must_change_password, r.role, p.code AS principal
  FROM user_roles r
  JOIN users u      ON u.id = r.user_id
  JOIN principals p ON p.id = r.principal_id
 WHERE r.role = 'partner' AND p.code = 'KB';
