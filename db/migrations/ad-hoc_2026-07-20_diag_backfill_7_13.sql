-- ad-hoc_2026-07-20_diag_backfill_7_13.sql
-- 2026-07-20 — 진단 SQL (SELECT-only, BEGIN/COMMIT/TEMP TABLE 없음)
--
-- Supabase SQL Editor 는 마지막 SELECT 만 결과 표시 → 아래 섹션 [S1]~[S5] 를
-- 각각 개별 실행. 각 섹션 끝의 세미콜론 앞까지 블록 지정 후 Run.
-- 결과 테이블 형태로 반환 → NOTICE 안 보이는 문제 회피.

-- ============================================================================
-- [S1] 컬럼 타입 확인 (product_order_id 실제 타입 · 매칭 실패 원인 후보)
-- ============================================================================
SELECT
  attname   AS column_name,
  format_type(atttypid, atttypmod) AS column_type
  FROM pg_attribute
 WHERE attrelid = 'task_items'::regclass
   AND attname IN ('product_order_id', 'company_received_at', 'is_canceled', 'subtotal')
   AND attnum > 0
 ORDER BY attnum;

-- ============================================================================
-- [S2] remit row 정보 (id · week_start · confirmed_at · remitted_amount)
-- ============================================================================
SELECT id, week_start, week_end, confirmed_at, remitted_amount,
       snapshot_item_count
  FROM principal_weekly_remittances
 WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
   AND week_start = DATE '2026-07-06';

-- ============================================================================
-- [S3] 매칭 단계별 카운트 요약 (핵심 진단)
--   기대 (7_13): total=53, ti_matched=53, task_matched=53, passes_all=53
--   실제와 대조 → 어느 단계에서 유실됐는지 즉시 파악
-- ============================================================================
WITH usoln AS (SELECT id AS pid FROM principals WHERE code = 'usol_n'),
     excel(poid, subtotal) AS (
       VALUES
    ('2026070144072831'::text, 61385::int),
    ('2026070144072841'::text, 9444::int),
    ('2026060460243081'::text, 121824::int),
    ('2026060460458571'::text, 73189::int),
    ('2026060466331401'::text, 73190::int),
    ('2026060980211300'::text, 115591::int),
    ('2026060980211310'::text, 9444::int),
    ('2026070365802561'::text, 9444::int),
    ('2026060811965491'::text, 190763::int),
    ('2026060811965501'::text, 28332::int),
    ('2026060811965511'::text, 28332::int),
    ('2026060811965481'::text, 76589::int),
    ('2026070365802541'::text, 103976::int),
    ('2026070365802551'::text, 115403::int),
    ('2026053034580481'::text, 27387::int),
    ('2026051334158921'::text, 27967::int),
    ('2026060329095671'::text, 27387::int),
    ('2026060132418881'::text, 119463::int),
    ('2026052842413771'::text, 68467::int),
    ('2026051647998881'::text, 27387::int),
    ('2026051648651691'::text, 27387::int),
    ('2026052842413781'::text, 73284::int),
    ('2026060394018071'::text, 27388::int),
    ('2026060257614371'::text, 71773::int),
    ('2026051065506651'::text, 27387::int),
    ('2026053047088351'::text, 72151::int),
    ('2026052225795441'::text, 9444::int),
    ('2026060334975081'::text, 119463::int),
    ('2026051655424731'::text, 109642::int),
    ('2026051654766671'::text, 66484::int),
    ('2026052720443861'::text, 118519::int),
    ('2026053170369991'::text, 27387::int),
    ('2026060399764161'::text, 115780::int),
    ('2026050492308501'::text, 9444::int),
    ('2026050492308491'::text, 66106::int),
    ('2026052675530401'::text, 9444::int),
    ('2026052671557421'::text, 27387::int),
    ('2026051641043871'::text, 66484::int),
    ('2026060399764181'::text, 9444::int),
    ('2026051646230001'::text, 27387::int),
    ('2026050492308511'::text, 9444::int),
    ('2026050894283591'::text, 55935::int),
    ('2026060822065091'::text, 27967::int),
    ('2026052225795431'::text, 118519::int),
    ('2026060399764171'::text, 71773::int),
    ('2026052842413811'::text, 18888::int),
    ('2026051655424741'::text, 63745::int),
    ('2026052675530391'::text, 271979::int),
    ('2026052842413801'::text, 54774::int),
    ('2026060257614381'::text, 115780::int),
    ('2026060333984371'::text, 119463::int),
    ('2026052842413791'::text, 18888::int),
    ('2026053184230671'::text, 27387::int)
     ),
     joined AS (
       SELECT
         e.poid                                     AS excel_poid,
         e.subtotal                                 AS excel_subtotal,
         ti.id                                      AS ti_id,
         ti.product_order_id                        AS ti_poid,
         ti.company_received_at                     AS ti_stamped,
         ti.is_canceled                             AS ti_canceled,
         t.id                                       AS task_id,
         t.principal_id                             AS task_principal,
         t.status                                   AS task_status
       FROM excel e
       LEFT JOIN task_items ti ON ti.product_order_id = e.poid
       LEFT JOIN tasks       t ON t.id = ti.task_id
     ),
     existing AS (
       SELECT task_item_id FROM principal_weekly_remit_items
        WHERE remit_id = (
          SELECT id FROM principal_weekly_remittances
           WHERE principal_id = (SELECT pid FROM usoln)
             AND week_start = DATE '2026-07-06'
        )
     )
SELECT '01_excel_total'                            AS bucket, count(*) AS cnt FROM joined
UNION ALL SELECT '02_ti_matched',                    count(*) FROM joined WHERE ti_id IS NOT NULL
UNION ALL SELECT '03_ti_unmatched (poid mismatch)',  count(*) FROM joined WHERE ti_id IS NULL
UNION ALL SELECT '04_task_matched',                  count(*) FROM joined WHERE task_id IS NOT NULL
UNION ALL SELECT '05_task_orphan (ti O + task X)',   count(*) FROM joined WHERE ti_id IS NOT NULL AND task_id IS NULL
UNION ALL SELECT '06_principal_is_usoln',            count(*) FROM joined WHERE task_principal = (SELECT pid FROM usoln)
UNION ALL SELECT '07_principal_other',               count(*) FROM joined WHERE task_principal IS NOT NULL AND task_principal != (SELECT pid FROM usoln)
UNION ALL SELECT '08_status_not_cancelled',          count(*) FROM joined WHERE task_status != '취소' OR task_status IS NULL
UNION ALL SELECT '09_ti_not_cancelled',              count(*) FROM joined WHERE COALESCE(ti_canceled, false) = false
UNION ALL SELECT '10_passes_ALL_filters',            count(*) FROM joined
  WHERE ti_id IS NOT NULL
    AND task_principal = (SELECT pid FROM usoln)
    AND (task_status != '취소' OR task_status IS NULL)
    AND COALESCE(ti_canceled, false) = false
UNION ALL SELECT '11_already_snapshot (would conflict)', count(*) FROM joined
  WHERE ti_id IN (SELECT task_item_id FROM existing)
ORDER BY 1;

-- ============================================================================
-- [S4] 실패 샘플 상세 (앞 20건)
--   ti_matched / task_matched / task_principal (usol_n 여부) / task_status /
--   ti_stamped (company_received_at) 컬럼으로 실패 사유 판단.
-- ============================================================================
WITH usoln AS (SELECT id AS pid FROM principals WHERE code = 'usol_n'),
     excel(poid, subtotal) AS (
       VALUES
    ('2026070144072831'::text, 61385::int),
    ('2026070144072841'::text, 9444::int),
    ('2026060460243081'::text, 121824::int),
    ('2026060460458571'::text, 73189::int),
    ('2026060466331401'::text, 73190::int),
    ('2026060980211300'::text, 115591::int),
    ('2026060980211310'::text, 9444::int),
    ('2026070365802561'::text, 9444::int),
    ('2026060811965491'::text, 190763::int),
    ('2026060811965501'::text, 28332::int),
    ('2026060811965511'::text, 28332::int),
    ('2026060811965481'::text, 76589::int),
    ('2026070365802541'::text, 103976::int),
    ('2026070365802551'::text, 115403::int),
    ('2026053034580481'::text, 27387::int),
    ('2026051334158921'::text, 27967::int),
    ('2026060329095671'::text, 27387::int),
    ('2026060132418881'::text, 119463::int),
    ('2026052842413771'::text, 68467::int),
    ('2026051647998881'::text, 27387::int),
    ('2026051648651691'::text, 27387::int),
    ('2026052842413781'::text, 73284::int),
    ('2026060394018071'::text, 27388::int),
    ('2026060257614371'::text, 71773::int),
    ('2026051065506651'::text, 27387::int),
    ('2026053047088351'::text, 72151::int),
    ('2026052225795441'::text, 9444::int),
    ('2026060334975081'::text, 119463::int),
    ('2026051655424731'::text, 109642::int),
    ('2026051654766671'::text, 66484::int),
    ('2026052720443861'::text, 118519::int),
    ('2026053170369991'::text, 27387::int),
    ('2026060399764161'::text, 115780::int),
    ('2026050492308501'::text, 9444::int),
    ('2026050492308491'::text, 66106::int),
    ('2026052675530401'::text, 9444::int),
    ('2026052671557421'::text, 27387::int),
    ('2026051641043871'::text, 66484::int),
    ('2026060399764181'::text, 9444::int),
    ('2026051646230001'::text, 27387::int),
    ('2026050492308511'::text, 9444::int),
    ('2026050894283591'::text, 55935::int),
    ('2026060822065091'::text, 27967::int),
    ('2026052225795431'::text, 118519::int),
    ('2026060399764171'::text, 71773::int),
    ('2026052842413811'::text, 18888::int),
    ('2026051655424741'::text, 63745::int),
    ('2026052675530391'::text, 271979::int),
    ('2026052842413801'::text, 54774::int),
    ('2026060257614381'::text, 115780::int),
    ('2026060333984371'::text, 119463::int),
    ('2026052842413791'::text, 18888::int),
    ('2026053184230671'::text, 27387::int)
     )
SELECT
  e.poid                                           AS excel_poid,
  e.subtotal                                       AS excel_subtotal,
  ti.id IS NOT NULL                                AS ti_matched,
  t.id IS NOT NULL                                 AS task_matched,
  (t.principal_id = (SELECT pid FROM usoln))       AS is_usoln,
  t.status                                         AS task_status,
  ti.is_canceled                                   AS ti_canceled,
  ti.company_received_at                           AS ti_stamped
FROM excel e
LEFT JOIN task_items ti ON ti.product_order_id = e.poid
LEFT JOIN tasks       t ON t.id = ti.task_id
WHERE ti.id IS NULL
   OR t.principal_id IS NULL
   OR t.principal_id != (SELECT pid FROM usoln)
   OR t.status = '취소'
   OR COALESCE(ti.is_canceled, false)
LIMIT 20;

-- ============================================================================
-- [S5] 성공 샘플 상세 (앞 5건 — 실제로 매칭 · 필터 통과했는지 눈으로 확인)
-- ============================================================================
WITH usoln AS (SELECT id AS pid FROM principals WHERE code = 'usol_n'),
     excel(poid, subtotal) AS (
       VALUES
    ('2026070144072831'::text, 61385::int),
    ('2026070144072841'::text, 9444::int),
    ('2026060460243081'::text, 121824::int),
    ('2026060460458571'::text, 73189::int),
    ('2026060466331401'::text, 73190::int),
    ('2026060980211300'::text, 115591::int),
    ('2026060980211310'::text, 9444::int),
    ('2026070365802561'::text, 9444::int),
    ('2026060811965491'::text, 190763::int),
    ('2026060811965501'::text, 28332::int),
    ('2026060811965511'::text, 28332::int),
    ('2026060811965481'::text, 76589::int),
    ('2026070365802541'::text, 103976::int),
    ('2026070365802551'::text, 115403::int),
    ('2026053034580481'::text, 27387::int),
    ('2026051334158921'::text, 27967::int),
    ('2026060329095671'::text, 27387::int),
    ('2026060132418881'::text, 119463::int),
    ('2026052842413771'::text, 68467::int),
    ('2026051647998881'::text, 27387::int),
    ('2026051648651691'::text, 27387::int),
    ('2026052842413781'::text, 73284::int),
    ('2026060394018071'::text, 27388::int),
    ('2026060257614371'::text, 71773::int),
    ('2026051065506651'::text, 27387::int),
    ('2026053047088351'::text, 72151::int),
    ('2026052225795441'::text, 9444::int),
    ('2026060334975081'::text, 119463::int),
    ('2026051655424731'::text, 109642::int),
    ('2026051654766671'::text, 66484::int),
    ('2026052720443861'::text, 118519::int),
    ('2026053170369991'::text, 27387::int),
    ('2026060399764161'::text, 115780::int),
    ('2026050492308501'::text, 9444::int),
    ('2026050492308491'::text, 66106::int),
    ('2026052675530401'::text, 9444::int),
    ('2026052671557421'::text, 27387::int),
    ('2026051641043871'::text, 66484::int),
    ('2026060399764181'::text, 9444::int),
    ('2026051646230001'::text, 27387::int),
    ('2026050492308511'::text, 9444::int),
    ('2026050894283591'::text, 55935::int),
    ('2026060822065091'::text, 27967::int),
    ('2026052225795431'::text, 118519::int),
    ('2026060399764171'::text, 71773::int),
    ('2026052842413811'::text, 18888::int),
    ('2026051655424741'::text, 63745::int),
    ('2026052675530391'::text, 271979::int),
    ('2026052842413801'::text, 54774::int),
    ('2026060257614381'::text, 115780::int),
    ('2026060333984371'::text, 119463::int),
    ('2026052842413791'::text, 18888::int),
    ('2026053184230671'::text, 27387::int)
     )
SELECT
  e.poid          AS excel_poid,
  e.subtotal      AS excel_subtotal,
  ti.id           AS ti_id,
  ti.subtotal     AS ti_subtotal,
  t.customer_name AS customer_name,
  t.status        AS task_status,
  ROUND(e.subtotal::numeric * 0.85)::int AS expected_company_receive
FROM excel e
JOIN task_items ti ON ti.product_order_id = e.poid
JOIN tasks       t ON t.id = ti.task_id
WHERE t.principal_id = (SELECT pid FROM usoln)
  AND t.status != '취소'
  AND COALESCE(ti.is_canceled, false) = false
LIMIT 5;
