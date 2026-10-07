-- ============================================================================
-- [조회 전용] 고객명으로 작업의 종목 · 작업 항목 · 접수 경로 보기 (아이콘이 안 맞을 때 원인 확인용)
-- 작성 2026-10-07 · 실행은 사장님 · 아무것도 바꾸지 않습니다 (SELECT 뿐)
--
-- 쓰는 법: 아래 [입력] 의 고객명(일부만 적어도 됨)을 바꿔 전체 실행. 기본값 '청년치킨'. 최근 접수 5건까지.
--
-- 보는 법 (한 작업당 한 줄)
--   저장된_종목     : tasks.category_id 의 종목 이름
--   작업_이름       : category_data.workType (접수 폼의 대표 작업 종류)
--   항목_category_data : category_data.workItems 의 작업 이름들 (접수 폼이 넣은 것)
--   항목_task_items : 작업 항목 표의 "서비스 코드:작업 종류 이름" (저장 후 자동으로 만들어진 것)
--   기대_종목       : 항목의 서비스로 본 종목 (공통/출장비 제외, 여러 종목이면 '혼합', 항목이 없으면 '(알 수 없음)')
--   접수_경로       : 채널(channel) · 원청 · 문의 전환 여부(홈페이지/랜딩 문의에서 넘어온 작업이면 그 문의의 출처)
--   판정            : a 항목은 후드인데 종목이 에어컨  /  b 항목이 비어 있음(종목 미정 접수)  /  c 저장은 맞음(화면 표시 문제)
--                     / d 항목이 에어컨 서비스로 저장됨(접수할 때 고른 값 자체가 에어컨)
-- ============================================================================
WITH input AS (
  -- ▼▼▼ [입력] 고객명 (일부) ▼▼▼
  SELECT '청년치킨'::text AS name_part
  -- ▲▲▲
),
picked AS (
  SELECT t.* FROM tasks t, input i
   WHERE t.customer_name LIKE '%' || i.name_part || '%'
   ORDER BY t.received_at DESC NULLS LAST
   LIMIT 5
),
ti AS (
  SELECT ti.task_id,
         string_agg(st.code || ':' || wt.name, ', ' ORDER BY wt.name) AS items,
         COUNT(DISTINCT st.category_id) FILTER (WHERE NOT COALESCE(st.is_common, false)) AS n_cat,
         MIN(st.category_id::text) FILTER (WHERE NOT COALESCE(st.is_common, false))      AS cat_id
    FROM task_items ti
    JOIN work_types wt    ON wt.id = ti.work_type_id
    JOIN service_types st ON st.id = wt.service_type_id
   WHERE ti.task_id IN (SELECT id FROM picked)
   GROUP BY ti.task_id
),
inq AS (
  -- 문의에서 전환된 작업이면 그 문의의 출처 (칸 이름이 달라도 찾도록 jsonb 로 본다)
  SELECT p.id AS task_id,
         (SELECT string_agg(COALESCE(j ->> 'source', '홈페이지') || ' / 희망 서비스 ' || COALESCE(j ->> 'service_type', '-'), ' | ')
            FROM (SELECT to_jsonb(q) AS j FROM inquiries q) x
           WHERE p.id::text IN (j ->> 'converted_task_id', j ->> 'task_id')) AS src
    FROM picked p
)
SELECT p.task_no                                                        AS 작업번호,
       p.customer_name                                                  AS 고객명,
       p.status                                                         AS 상태,
       to_char(p.received_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS 접수,
       COALESCE(c.name, '(없음)')                                        AS 저장된_종목,
       COALESCE(NULLIF(p.category_data ->> 'workType', ''), '(비어 있음)') AS 작업_이름,
       COALESCE((SELECT string_agg(CASE WHEN jsonb_typeof(w) = 'string' THEN w #>> '{}'
                                        ELSE COALESCE(w ->> 'workType', w ->> 'name', '?') END, ', ')
                   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.category_data -> 'workItems') = 'array'
                                                  THEN p.category_data -> 'workItems' ELSE '[]'::jsonb END) w), '(비어 있음)') AS 항목_category_data,
       COALESCE(ti.items, '(비어 있음)')                                 AS 항목_task_items,
       CASE WHEN ti.task_id IS NULL OR COALESCE(ti.n_cat, 0) = 0 THEN '(알 수 없음)'
            WHEN ti.n_cat > 1 THEN '혼합'
            ELSE (SELECT c2.name FROM categories c2 WHERE c2.id::text = ti.cat_id) END AS 기대_종목,
       COALESCE('채널 ' || NULLIF(p.channel, ''), '채널 없음(운영자 접수)')
         || ' · 원청 ' || COALESCE((SELECT pr.name FROM principals pr WHERE pr.id = p.principal_id), '-')
         || CASE WHEN inq.src IS NOT NULL THEN ' · 문의 전환 [' || inq.src || ']' ELSE ' · 문의 전환 아님' END
         || CASE WHEN (p.category_data ->> 'applianceUndecided') = 'true' THEN ' · 기종 미정 접수' ELSE '' END AS 접수_경로,
       CASE
         WHEN ti.task_id IS NULL AND COALESCE(NULLIF(p.category_data ->> 'workType', ''), '') = ''
              AND COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p.category_data -> 'workItems') = 'array'
                                                   THEN p.category_data -> 'workItems' ELSE '[]'::jsonb END), 0) = 0
           THEN 'b 항목이 비어 있음 (종목 미정 접수) - 화면은 이제 🔧 미정으로 나옵니다'
         WHEN ti.n_cat = 1 AND ti.cat_id IS DISTINCT FROM p.category_id::text
           THEN 'a 항목의 종목과 저장된 종목이 다름 - 보정 대상 (fix_task_category_mismatch.sql)'
         WHEN ti.n_cat = 1 AND ti.cat_id = p.category_id::text AND c.code = 'aircon'
           THEN 'd 항목이 에어컨 서비스로 저장됨 - 접수할 때 고른 작업 종류가 에어컨 (작업 수정에서 항목을 바꿔야 함)'
         WHEN ti.n_cat = 1 AND ti.cat_id = p.category_id::text
           THEN 'c 저장은 맞음 - 화면 표시를 확인해야 함'
         ELSE '기타 - 위 칸들을 보고 판단'
       END AS 판정
  FROM picked p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN ti  ON ti.task_id = p.id
  LEFT JOIN inq ON inq.task_id = p.id
 ORDER BY p.received_at DESC NULLS LAST;
