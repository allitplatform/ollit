-- ============================================================================
-- 확인 (읽기만 합니다) - 로봇청소기 랜딩으로 들어온 접수 - 블록 (81)
--   랜딩(public/robot.html)은 종류를 'unknown' 으로 보내고, 로봇청소기 여부는 접수 출처(source)로만 알 수 있습니다.
--   결과 표 하나: 맨 위 요약 줄 + 접수마다 한 줄. 아무것도 고치지 않습니다.
--
-- 칸
--   접수 시각 · 고객 · 전화 뒤 4자리 · 출처 · 범위(본체 / 본체+스테이션 / 미정) · 희망일 · 접수 상태 · 전환된 작업
--   전환된 작업이 있으면 그 작업의 종목 · 항목 (로봇청소기 종목이 생기기 전이라 "종목 미정" 이나 다른 종목으로 들어가 있을 수 있음)
-- ============================================================================
WITH r AS (
  SELECT i.*,
         split_part(i.source, '/', 2) AS kind,
         split_part(i.source, '/', 3) AS hope
    FROM inquiries i
   WHERE i.source LIKE 'robot_landing%'
)
SELECT * FROM (
  SELECT 0 AS ord, NULL::timestamptz AS at_sort,
         '요약' AS "접수 시각",
         '전체 ' || count(*) || '건 · 작업으로 전환 ' || count(*) FILTER (WHERE task_id IS NOT NULL)
           || '건 · 아직 접수함 ' || count(*) FILTER (WHERE task_id IS NULL) || '건' AS "고객",
         NULL::text AS "전화 뒤 4자리", NULL::text AS "출처", NULL::text AS "범위", NULL::text AS "희망일",
         NULL::text AS "접수 상태", NULL::text AS "전환된 작업", NULL::text AS "작업 종목", NULL::text AS "작업 항목"
    FROM r
  UNION ALL
  SELECT 1, r.created_at,
         to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI'),
         r.name,
         right(regexp_replace(COALESCE(r.phone, ''), '\D', '', 'g'), 4),
         r.source,
         CASE r.kind WHEN 'body' THEN '본체만 69,000' WHEN 'dock' THEN '본체+스테이션 99,000' WHEN 'ask' THEN '미정' ELSE r.kind END,
         CASE WHEN r.hope ~ '^\d{2}-\d{2}$' THEN r.hope ELSE '-' END,
         r.status,
         t.task_no,
         (SELECT c.name FROM categories c WHERE c.id = t.category_id),
         (SELECT string_agg(COALESCE(wt.name, '?') || ' x' || COALESCE(ti.qty, 1), ' + ')
            FROM task_items ti LEFT JOIN work_types wt ON wt.id = ti.work_type_id
           WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false))
    FROM r
    LEFT JOIN tasks t ON t.id = r.task_id
) z
ORDER BY ord, at_sort DESC;
