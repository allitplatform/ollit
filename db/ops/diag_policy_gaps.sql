-- ============================================================================
-- 확인 (읽기만 합니다) - 분배 규칙이 하나도 없는 "원청 x 서비스" 조합 - 블록 (82)
--   접수 화면에서 고를 수 있는 서비스(selectable) x 원청 마다, 정산 규칙이 어디에 있는지 보여 줍니다.
--   옛 단가표(commission_policies) 에도, 새 규칙표(fee_rules 직영 규칙) 에도 없으면 "규칙 없음" -> 미리보기 · 정산이 막히는 조합.
--   결과 표 하나: 맨 위 요약 + 조합마다 한 줄 (규칙 없음 줄이 위로).
--
-- 칸
--   원청 · 종목 · 서비스 · 서비스 코드 · 옛 단가표 줄 수 · 새 규칙(직영) · 판정
--   판정: "옛 단가표" / "새 규칙 (주방후드 · 로봇청소기 직영)" / "규칙 없음"
--   참고: 원청 범위(scope)가 usol_n 인 서비스는 유솔N 에만 맞춰 봅니다. 공통 서비스(출장비)는 원청별 출장비 규칙으로 봅니다.
-- ============================================================================
WITH pr AS (
  SELECT DISTINCT p.code, p.name FROM principals p WHERE p.code IS NOT NULL
),
sv AS (
  SELECT st.code AS service_code, st.name AS service_name, COALESCE(st.scope, 'all') AS scope, c.code AS cat_code, c.name AS cat_name
    FROM service_types st JOIN categories c ON c.id = st.category_id
   WHERE st.selectable = true
),
combo AS (
  SELECT pr.code AS principal_code, pr.name AS principal_name, sv.*,
         (SELECT count(*) FROM commission_policies cp
           WHERE cp.tenant_id = '11111111-1111-1111-1111-111111111111'
             AND cp.principal_code = pr.code
             AND cp.service_code = sv.service_code) AS old_rows,
         EXISTS (SELECT 1 FROM fee_rules f
                  WHERE f.subcontractor_id IS NULL AND f.active
                    AND f.service_code = sv.cat_code
                    AND (f.principal_code IS NULL OR f.principal_code = pr.code)) AS new_rule
    FROM pr CROSS JOIN sv
   WHERE sv.scope = 'all' OR sv.scope = pr.code
),
judged AS (
  SELECT *, CASE WHEN old_rows > 0 THEN '옛 단가표'
                 WHEN new_rule THEN '새 규칙 (주방후드 · 로봇청소기 직영)'
                 ELSE '규칙 없음' END AS verdict
    FROM combo
)
SELECT "원청", "종목", "서비스", "서비스 코드", "옛 단가표 줄 수", "새 규칙(직영)", "판정" FROM (
  SELECT 0 AS ord, '요약' AS "원청",
         '조합 ' || count(*) || '개 · 규칙 없음 ' || count(*) FILTER (WHERE verdict = '규칙 없음') || '개' AS "종목",
         NULL::text AS "서비스", NULL::text AS "서비스 코드", NULL::bigint AS "옛 단가표 줄 수", NULL::boolean AS "새 규칙(직영)", NULL::text AS "판정",
         NULL::text AS s1, NULL::text AS s2
    FROM judged
  UNION ALL
  SELECT CASE WHEN verdict = '규칙 없음' THEN 1 ELSE 2 END,
         principal_name || ' (' || principal_code || ')', cat_name, service_name, service_code, old_rows, new_rule, verdict,
         principal_code, service_name
    FROM judged
) z
ORDER BY ord, s1, s2;
