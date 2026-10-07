-- ============================================================================
-- [조회 전용] 직영 기사별 기술(서비스) · 등급 · 담당 지역 수
-- 작성 2026-10-07 · 실행은 사장님 · 아무것도 바꾸지 않습니다 (SELECT 뿐)
--
-- 배경: 설치 작업의 추천 화면에 냉매 기사들이 지역별로 나온다. 추천은 기사의 기술 표
--       (engineer_principal_permissions.service_code)를 보는데, 지금 앱이 저장하는 기술은
--       cleaning(세척) / refrigerant(냉매충전) 두 가지뿐이다. 이 조회로 실제 저장 상태를 확인한다.
--
-- 마지막 표
--   "1 기술 종류" : 기술 표에 실제로 들어 있는 service_code 별 기사 수 (install · leak 이 있는지)
--   "2 기사별"    : 활성 기사 한 명당 한 줄 - 기술(등급) 목록 · 담당 지역 수 · 소속
--                   (김시율 기사와 냉매 기사들의 기술이 어떻게 들어가 있는지 여기서 본다)
-- ============================================================================
SELECT * FROM (
  SELECT '1 기술 종류' AS 구분,
         e.service_code AS 대상,
         COUNT(DISTINCT e.user_id) FILTER (WHERE e.active AND e.level = 'main')::text || '명 메인' AS 값1,
         COUNT(DISTINCT e.user_id) FILTER (WHERE e.active AND e.level = 'sub')::text  || '명 백업' AS 값2,
         COUNT(DISTINCT e.user_id) FILTER (WHERE NOT e.active OR e.level NOT IN ('main', 'sub'))::text || '명 그 외(안 함 등)' AS 값3,
         NULL::text AS 내용
    FROM engineer_principal_permissions e
   GROUP BY e.service_code
  UNION ALL
  SELECT '2 기사별',
         u.name || ' (' || COALESCE(u.code, '-') || ')',
         COALESCE((SELECT string_agg(DISTINCT e.service_code || ':' || e.level, ', ')
                     FROM engineer_principal_permissions e
                    WHERE e.user_id = u.id AND e.active), '(기술 없음)'),
         '지역 ' || (SELECT COUNT(*) FROM engineer_zones z WHERE z.user_id = u.id AND COALESCE(z.active, true))::text || '곳',
         COALESCE((SELECT s.name FROM subcontractors s WHERE s.id = u.subcontractor_id), '직영'),
         COALESCE(u.region, '')
    FROM users u
   WHERE u.is_active = true
     AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'engineer')
) r
ORDER BY 1, 2;
