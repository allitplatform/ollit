-- ============================================================================
-- 화이트코어 직원 일괄 등록 (5명)
-- 작성 2026-10-06
--
-- ★★ 지금 실행 금지 ★★
--   실행 조건: 묶음 1 코드 배포 완료 + PWA 실화면 확인 후.
--   [지역] 목록과 초기 비밀번호 규칙은 2026-10-06 사장님 확정.
--
-- 하는 일
--   · users 5명 생성 (기사 코드는 현재 가장 큰 E번호 다음부터 자동 부여)
--   · user_roles 에 engineer 역할
--   · 소속 = 화이트코어, 구분 = manager(한성용·김상욱) / staff(나머지)
--     -> manager 는 로그인하면 협력사 관리자 화면 + 기사 화면 전환 가능
--   · engineer_zones 에 담당 지역
-- 하지 않는 일
--   · 에어컨 기능 권한(engineer_principal_permissions)은 넣지 않습니다
--     -> 직영 추천·자동배정 후보에 나오지 않습니다.
--   · 사업자 정보는 넣지 않습니다 (각자 앱 설정에서 입력).
--
-- 초기 비밀번호
--   전화번호 뒤 4자리. 첫 로그인 때 변경 화면이 뜹니다 (must_change_password = true).
--
-- 안전장치
--   · 5명 중 한 명이라도 같은 전화번호가 이미 users 에 있으면 아무것도 넣지 않고 멈춥니다.
--   · 화이트코어 협력사 행이 없으면 멈춥니다.
--   · 전체가 한 트랜잭션 - 중간에 실패하면 전부 취소됩니다.
-- ============================================================================

-- [0] 실행 전 확인 - 같은 번호가 이미 있는지 (기대: 0행)
SELECT code, name, phone, is_active
  FROM users
 WHERE REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', '')
       IN ('01088889239', '01031695086', '01099220455', '01057159520', '01092079507');

BEGIN;

DO $$
DECLARE
  v_tenant uuid := '11111111-1111-1111-1111-111111111111';
  v_sub    uuid;
  v_next   int;
  v_dup    text;
  v_id     uuid;
  r        record;
  z        text;
BEGIN
  SELECT id INTO v_sub FROM subcontractors WHERE tenant_id = v_tenant AND code = 'whitecore';
  IF v_sub IS NULL THEN
    RAISE EXCEPTION '화이트코어 협력사 행이 없습니다 (mig 212 확인). 중단합니다.';
  END IF;

  -- 같은 전화번호가 이미 있으면 중단
  SELECT string_agg(u.name || ' ' || u.phone || ' (' || COALESCE(u.code, '-') || ')', ', ')
    INTO v_dup
    FROM users u
   WHERE REPLACE(REPLACE(REPLACE(u.phone, '-', ''), ' ', ''), '+', '')
         IN ('01088889239', '01031695086', '01099220455', '01057159520', '01092079507');
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION '이미 등록된 전화번호가 있습니다: %. 아무것도 넣지 않고 중단합니다.', v_dup;
  END IF;

  -- 다음 기사 코드 번호 (E + 숫자 3자리 형식만 대상)
  SELECT COALESCE(MAX(SUBSTRING(code FROM 2)::int), 0) + 1
    INTO v_next
    FROM users
   WHERE tenant_id = v_tenant AND code ~ '^E[0-9]{3}$';

  FOR r IN
    SELECT * FROM (VALUES
      -- 순번, 이름, 전화, 구분, 지역(표시용), 담당 지역 목록
      -- ▼▼▼ [지역] 사장님 확정 (2026-10-06) ▼▼▼
      -- 한성용: 서울 25개 구 + 경기 시·군 전부(31)
      (1, '한성용', '010-8888-9239', 'manager', '서울, 경기', ARRAY[
          '강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구','노원구','도봉구',
          '동대문구','동작구','마포구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구',
          '용산구','은평구','종로구','중구','중랑구',
          '수원시','성남시','고양시','용인시','부천시','안산시','안양시','남양주시','화성시','평택시',
          '의정부시','시흥시','파주시','김포시','광명시','광주시','군포시','하남시','오산시','이천시',
          '안성시','구리시','의왕시','양주시','포천시','여주시','양평군','가평군','연천군','과천시',
          '동두천시']),
      -- 김상욱: 서울 25개 구 + 경기동부 10
      (2, '김상욱', '010-3169-5086', 'manager', '서울, 경기동부', ARRAY[
          '강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구','노원구','도봉구',
          '동대문구','동작구','마포구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구',
          '용산구','은평구','종로구','중구','중랑구',
          '성남시','용인시','하남시','남양주시','구리시','이천시','광주시','여주시','양평군','가평군']),
      -- 윤인상: 인천 6개 구 (중구·동구·강화군·옹진군 제외)
      (3, '윤인상', '010-9922-0455', 'staff', '인천', ARRAY[
          '계양구','부평구','서구','남동구','연수구','미추홀구']),
      -- 제민규·김시민: 경기남부 11 (시흥시·광명시 제외)
      (4, '제민규', '010-5715-9520', 'staff', '경기남부', ARRAY[
          '수원시','화성시','용인시','안양시','군포시','의왕시','과천시','안산시','평택시','오산시','안성시']),
      (5, '김시민', '010-9207-9507', 'staff', '경기남부', ARRAY[
          '수원시','화성시','용인시','안양시','군포시','의왕시','과천시','안산시','평택시','오산시','안성시'])
      -- ▲▲▲ [지역] 끝 ▲▲▲
    ) AS t(ord, name, phone, sub_role, region_label, zones)
    ORDER BY ord
  LOOP
    INSERT INTO users (
      tenant_id, code, name, phone, is_active, region,
      password_hash, must_change_password,
      subcontractor_id, sub_role
    ) VALUES (
      v_tenant,
      'E' || LPAD(v_next::text, 3, '0'),
      r.name,
      r.phone,
      true,
      r.region_label,
      extensions.crypt(RIGHT(REPLACE(r.phone, '-', ''), 4), extensions.gen_salt('bf')),
      true,
      v_sub,
      r.sub_role
    )
    RETURNING id INTO v_id;

    INSERT INTO user_roles (user_id, role, is_primary, principal_id)
    VALUES (v_id, 'engineer', true, NULL);

    FOREACH z IN ARRAY r.zones LOOP
      INSERT INTO engineer_zones (user_id, district, active)
      VALUES (v_id, z, true)
      ON CONFLICT (user_id, district) DO NOTHING;
    END LOOP;

    RAISE NOTICE '등록: % % (%) - %', 'E' || LPAD(v_next::text, 3, '0'), r.name, r.sub_role, r.phone;
    v_next := v_next + 1;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- 실행 후 확인
-- ============================================================================
-- 1) 등록 결과 - 기대: 5행, 소속 화이트코어, 관리자 2 / 직원 3, 기능권한 0
--    지역수 기대: 한성용 56 / 김상욱 35 / 윤인상 6 / 제민규 11 / 김시민 11
SELECT u.code, u.name, u.phone, s.name AS 소속, u.sub_role AS 구분,
       (SELECT COUNT(*) FROM engineer_zones z WHERE z.user_id = u.id)                 AS 지역수,
       (SELECT COUNT(*) FROM engineer_principal_permissions p WHERE p.user_id = u.id) AS 에어컨_기능권한,
       u.must_change_password AS 첫로그인_비번변경
  FROM users u
  JOIN subcontractors s ON s.id = u.subcontractor_id
 WHERE s.code = 'whitecore'
 ORDER BY u.code;

-- 2) 로그인 확인은 PWA 에서: 전화번호 + 뒤 4자리 -> 비밀번호 변경 화면 -> 관리자 2명은 협력사 화면
