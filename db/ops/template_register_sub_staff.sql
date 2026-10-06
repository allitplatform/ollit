-- ============================================================================
-- 협력사 기사 일괄 등록 - 틀 (복사해서 쓰는 파일)
-- 작성 2026-10-06 · 선행: mig 231 (_sub_register_staff)
--
-- 쓰는 법
--   1) 이 파일을 복사해 이름을 바꿉니다 (예: register_whitecore_staff_2610xx.sql).
--   2) 아래 두 곳의 [입력] 구역을 채웁니다. 두 구역의 내용은 같아야 합니다.
--        - 협력사 코드 (예: whitecore)
--        - 기사 목록: 이름, 전화, 구분(staff / manager), 지역 표시 이름, 담당 지역 목록
--   3) [1] 미리 보기를 먼저 실행해 "등록 예정 / 건너뜀" 을 확인합니다 (아무것도 넣지 않음).
--   4) [2] 등록을 실행합니다. 결과 표에 한 줄씩 "등록 / 건너뜀(사유)" 이 나옵니다.
--
-- 규칙
--   · 한 줄이 실패해도 나머지는 계속 등록합니다 (행 단위 건너뛰기).
--     건너뛰는 경우: 이미 있는 전화번호(비활성 포함), 전화번호 형식 오류, 이름 없음, 구분 오류
--   · 초기 비밀번호 = 전화번호 뒤 4자리, 첫 로그인 때 변경
--   · 기사 코드(E###)는 자동으로 이어서 붙습니다.
--   · 사업자 정보는 여기 넣지 않습니다 (운영자 화면에서 입력).
--   · 구분 manager 는 이 SQL 로만 지정할 수 있습니다 (협력사 관리자 화면에서는 일반 기사만 추가).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- [1] 미리 보기 (읽기 전용)
-- ----------------------------------------------------------------------------
WITH input(ord, name, phone, sub_role, region_label, zones) AS (
  VALUES
    -- ▼▼▼ [입력] 기사 목록 - 아래 예시 줄을 지우고 채워 주세요 ▼▼▼
    (1, '홍길동', '010-0000-0001', 'staff', '경기남부', ARRAY['수원시', '화성시']),
    (2, '김철수', '010-0000-0002', 'staff', '인천',     ARRAY['부평구', '계양구'])
    -- ▲▲▲ [입력] 끝 ▲▲▲
)
SELECT i.ord AS 순번, i.name AS 이름, i.phone AS 전화, i.sub_role AS 구분,
       COALESCE(array_length(i.zones, 1), 0) AS 지역수,
       CASE
         WHEN s.id IS NULL THEN '중단: 협력사 코드를 찾지 못함'
         WHEN regexp_replace(i.phone, '[^0-9]', '', 'g') !~ '^01[0-9]{8,9}$' THEN '건너뜀: 전화번호 형식'
         WHEN u.id IS NOT NULL THEN '건너뜀: 이미 등록된 전화번호 (' || u.name || CASE WHEN u.is_active THEN '' ELSE ', 비활성' END || ')'
         WHEN COUNT(*) OVER (PARTITION BY regexp_replace(i.phone, '[^0-9]', '', 'g')) > 1
              AND ROW_NUMBER() OVER (PARTITION BY regexp_replace(i.phone, '[^0-9]', '', 'g') ORDER BY i.ord) > 1
              THEN '건너뜀: 목록 안에서 전화번호 중복'
         ELSE '등록 예정'
       END AS 결과
  FROM input i
  LEFT JOIN subcontractors s ON s.code = 'whitecore'      -- [입력] 협력사 코드
  LEFT JOIN users u ON regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = regexp_replace(i.phone, '[^0-9]', '', 'g')
 ORDER BY i.ord;

-- ----------------------------------------------------------------------------
-- [2] 등록 (한 줄씩 등록하고, 안 되는 줄은 사유와 함께 건너뜀)
-- ----------------------------------------------------------------------------
WITH input(ord, name, phone, sub_role, region_label, zones) AS (
  VALUES
    -- ▼▼▼ [입력] 기사 목록 - [1] 과 같은 내용 ▼▼▼
    (1, '홍길동', '010-0000-0001', 'staff', '경기남부', ARRAY['수원시', '화성시']),
    (2, '김철수', '010-0000-0002', 'staff', '인천',     ARRAY['부평구', '계양구'])
    -- ▲▲▲ [입력] 끝 ▲▲▲
),
target AS (
  SELECT id FROM subcontractors WHERE code = 'whitecore'   -- [입력] 협력사 코드
),
done AS MATERIALIZED (
  SELECT i.ord, i.name, i.phone, i.sub_role,
         CASE WHEN t.id IS NULL
              THEN jsonb_build_object('ok', false, 'error', '협력사 코드를 찾지 못했습니다.')
              ELSE _sub_register_staff(t.id, i.name, i.phone, i.sub_role, i.region_label, i.zones)
         END AS r
    FROM input i
    LEFT JOIN target t ON true
   ORDER BY i.ord
)
SELECT d.ord AS 순번, d.name AS 이름, d.phone AS 전화, d.sub_role AS 구분,
       CASE WHEN (d.r ->> 'ok')::boolean THEN '등록' ELSE '건너뜀' END AS 결과,
       d.r ->> 'code'  AS 기사코드,
       d.r ->> 'zones' AS 지역수,
       d.r ->> 'error' AS 사유
  FROM done d
 ORDER BY d.ord;
