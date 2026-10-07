-- ============================================================================
-- [조회 전용] 작업의 종목(tasks.category_id)이 작업 항목(서비스)의 종목과 어긋난 건
-- 작성 2026-10-07 · 실행은 사장님 · 아무것도 바꾸지 않습니다 (SELECT 뿐)
--
-- 배경
--   접수 저장 코드가 종목을 항상 "에어컨" 으로 넣고 있었습니다 (src/data/tasksDb.js 의 기본값).
--   그래서 주방후드 작업도 category_id = 에어컨 으로 저장됐고, 협력사 배정 시트가
--   "이 종목 불가" 로 판정했습니다 (기사의 가능 종목 = 주방후드 ≠ 작업 종목 = 에어컨).
--   코드는 2026-10-07 에 고쳤습니다. 이 파일은 이미 저장된 작업 중 어긋난 것을 보여 줍니다.
--
-- 기대 종목을 정하는 법
--   · 작업 항목(task_items) -> 작업 종류(work_types) -> 서비스(service_types) 의 종목. 공통 서비스(출장비)는 뺌.
--   · 작업 항목 행이 없는 작업은 category_data.workItems 의 이름("서비스_기종" 의 앞부분)으로 서비스 표를 찾음.
--   · 항목의 종목이 두 가지 이상 섞인 작업은 "혼합" 으로만 표시 (보정 대상 아님).
--
-- 마지막 표
--   "0 지정 작업" : A-261007-001 한 건의 현재 종목 / 항목 서비스 코드 / 기대 종목
--   "1 요약"      : 어긋난 건수 (현재 종목 -> 기대 종목 별)
--   "2 목록"      : 어긋난 작업 (최근 접수 순, 최대 200건)
-- ============================================================================
WITH item_cat AS (
  SELECT ti.task_id, st.category_id, st.code AS service_code
    FROM task_items ti
    JOIN work_types wt    ON wt.id = ti.work_type_id
    JOIN service_types st ON st.id = wt.service_type_id
   WHERE NOT COALESCE(st.is_common, false)
  UNION ALL
  SELECT t.id, st.category_id, st.code
    FROM tasks t
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(t.category_data -> 'workItems') = 'array' THEN t.category_data -> 'workItems' ELSE '[]'::jsonb END) AS w
    JOIN service_types st
      ON true
     AND st.name = split_part(CASE WHEN jsonb_typeof(w) = 'string' THEN w #>> '{}'
                                   ELSE COALESCE(w ->> 'workType', w ->> 'name', '') END, '_', 1)
     AND NOT COALESCE(st.is_common, false)
   WHERE NOT EXISTS (SELECT 1 FROM task_items ti WHERE ti.task_id = t.id)
),
expect AS (
  SELECT task_id,
         COUNT(DISTINCT category_id)              AS n_cat,
         MIN(category_id::text)::uuid             AS category_id,
         string_agg(DISTINCT service_code, ', ')  AS service_codes
    FROM item_cat GROUP BY task_id
),
bad AS (
  SELECT t.id, t.task_no, t.status, t.customer_name, t.received_at, t.subcontractor_id,
         t.category_id AS now_id, e.category_id AS want_id, e.n_cat, e.service_codes
    FROM tasks t JOIN expect e ON e.task_id = t.id
   WHERE e.n_cat > 1 OR t.category_id IS DISTINCT FROM e.category_id
)
SELECT * FROM (
  SELECT '0 지정 작업' AS 구분, t.task_no AS 대상,
         COALESCE((SELECT c.name FROM categories c WHERE c.id = t.category_id), '(없음)') AS 현재_종목,
         CASE WHEN e.task_id IS NULL THEN '(항목으로 알 수 없음)'
              WHEN e.n_cat > 1 THEN '혼합'
              ELSE (SELECT c.name FROM categories c WHERE c.id = e.category_id) END AS 기대_종목,
         1 AS 건수,
         '항목 서비스 코드: ' || COALESCE(e.service_codes, '(없음)') || ' · 상태 ' || t.status
           || ' · category_id ' || COALESCE(t.category_id::text, 'NULL') AS 내용,
         t.received_at AS 접수
    FROM tasks t LEFT JOIN expect e ON e.task_id = t.id
   WHERE t.task_no = 'A-261007-001'
  UNION ALL
  SELECT '1 요약', '어긋난 작업',
         COALESCE((SELECT c.name FROM categories c WHERE c.id = b.now_id), '(없음)'),
         CASE WHEN b.n_cat > 1 THEN '혼합' ELSE (SELECT c.name FROM categories c WHERE c.id = b.want_id) END,
         COUNT(*)::int,
         '협력사 작업 ' || COUNT(*) FILTER (WHERE b.subcontractor_id IS NOT NULL) || '건 포함',
         MAX(b.received_at)
    FROM bad b GROUP BY b.now_id, b.want_id, (b.n_cat > 1)
  UNION ALL
  SELECT * FROM (
    SELECT '2 목록', b.task_no,
           COALESCE((SELECT c.name FROM categories c WHERE c.id = b.now_id), '(없음)'),
           CASE WHEN b.n_cat > 1 THEN '혼합' ELSE (SELECT c.name FROM categories c WHERE c.id = b.want_id) END,
           1,
           b.status || ' · ' || COALESCE(b.customer_name, '') || ' · ' || COALESCE(b.service_codes, '')
             || CASE WHEN b.subcontractor_id IS NOT NULL THEN ' · 협력사' ELSE '' END,
           b.received_at
      FROM bad b ORDER BY b.received_at DESC NULLS LAST LIMIT 200
  ) q
) r
ORDER BY 1, 7 DESC NULLS LAST;
