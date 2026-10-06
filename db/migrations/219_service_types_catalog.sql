-- ============================================================================
-- Migration 219 - 작업 종류 공통 목록용 칸 (service_types)
-- 작성 2026-10-06 · 선행: 215
--
-- 목적
--   작업 종류를 고르는 화면(모바일 접수 / PC 접수 / 작업 상세 종목 선택)이
--   화면마다 따로 적어 둔 목록 대신 service_types + categories 를 읽도록 통일합니다.
--   앞으로 서비스를 추가할 때는 이 표에 행을 넣고 selectable 만 켜면 모든 화면에 나옵니다.
--
-- 추가하는 칸 (service_types)
--   selectable  boolean  접수·종목 선택 화면에 보일지 (기본 false - 내부용 서비스는 안 보임)
--   sort_order  int      묶음 안 표시 순서
--   scope       text     'all' = 항상 / 'usol_n' = 유솔N 작업일 때만 (YS-N 전용)
--   is_common   boolean  종목과 무관한 공통 항목 (출장비) -> [공통] 묶음
--
-- 기존 데이터 영향
--   칸 추가 + 표시용 값 설정뿐입니다. 서비스 이름·코드·정산에는 영향이 없습니다.
--   앱은 이 칸을 못 읽으면 기본 목록으로 동작하므로, 코드 배포와 실행 순서는 무관합니다.
--
-- 서비스는 code 로 찾습니다. YS-N 전용 2종은 운영 DB 의 code 를 저장소에서 확인할 수
-- 없어 이름으로 찾습니다 (접수 화면이 쓰는 이름과 같은 글자).
-- ============================================================================

BEGIN;

ALTER TABLE service_types
  ADD COLUMN IF NOT EXISTS selectable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order int     NOT NULL DEFAULT 999,
  ADD COLUMN IF NOT EXISTS scope      text    NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS is_common  boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_types_scope_check') THEN
    ALTER TABLE service_types ADD CONSTRAINT service_types_scope_check CHECK (scope IN ('all', 'usol_n'));
  END IF;
END $$;

-- [에어컨] 세척 · 냉매충전 · 누설 · 누수 · 설치
UPDATE service_types SET selectable = true, sort_order = 1 WHERE code = 'cleaning';
UPDATE service_types SET selectable = true, sort_order = 2 WHERE code = 'refrigerant';
UPDATE service_types SET selectable = true, sort_order = 3 WHERE code = 'leak';
UPDATE service_types SET selectable = true, sort_order = 4 WHERE code = 'water_leak';
UPDATE service_types SET selectable = true, sort_order = 5 WHERE code = 'install';

-- [주방후드] 업소용 · 가정용 · 후드설치
UPDATE service_types SET selectable = true, sort_order = 1 WHERE code = 'hood_commercial';
UPDATE service_types SET selectable = true, sort_order = 2 WHERE code = 'hood_home';
UPDATE service_types SET selectable = true, sort_order = 3 WHERE code = 'hood_install';

-- [공통] 출장비
UPDATE service_types SET selectable = true, sort_order = 1, is_common = true WHERE code = 'visit_fee';

-- YS-N 전용 - 유솔N 작업일 때만
UPDATE service_types SET selectable = true, sort_order = 90, scope = 'usol_n' WHERE name = '추가선택(YS-N)';
UPDATE service_types SET selectable = true, sort_order = 91, scope = 'usol_n' WHERE name = '냉매점검(YS-N)';

COMMIT;

-- ============================================================================
-- 검증 - 화면에 나올 목록 (이 결과를 보내 주세요)
--   기대: 에어컨 5 (+ YS-N 전용 2) / 주방후드 3 / 공통 1
--   ★ 이름이 접수 화면의 글자(세척, 냉매충전, 누설, 누수, 설치, 출장비,
--     주방후드(업소용), 주방후드(가정용), 후드설치, 추가선택(YS-N), 냉매점검(YS-N))와
--     한 글자라도 다르면 알려 주세요.
-- ============================================================================
SELECT CASE WHEN st.is_common THEN '공통' ELSE c.name END AS 묶음,
       st.sort_order AS 순서, st.code, st.name, st.scope
  FROM service_types st
  LEFT JOIN categories c ON c.id = st.category_id
 WHERE st.selectable
 ORDER BY 1, 2;

-- 참고: 화면에 안 나오는 서비스 (내부용)
-- SELECT code, name FROM service_types WHERE NOT selectable ORDER BY code;
