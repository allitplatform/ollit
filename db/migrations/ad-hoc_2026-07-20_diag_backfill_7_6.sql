-- ad-hoc_2026-07-20_diag_backfill_7_6.sql
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
   AND week_start = DATE '2026-06-29';

-- ============================================================================
-- [S3] 매칭 단계별 카운트 요약 (핵심 진단)
--   기대 (7_13): total=53, ti_matched=53, task_matched=53, passes_all=53
--   실제와 대조 → 어느 단계에서 유실됐는지 즉시 파악
-- ============================================================================
WITH usoln AS (SELECT id AS pid FROM principals WHERE code = 'usol_n'),
     excel(poid, subtotal) AS (
       VALUES
    ('2026061916308991'::text, 66106::int),
    ('2026061916309011'::text, 27387::int),
    ('2026052870145181'::text, 114836::int),
    ('2026052870145191'::text, 68467::int),
    ('2026060461185911'::text, 9452::int),
    ('2026053046457571'::text, 118142::int),
    ('2026053046457581'::text, 71773::int),
    ('2026052846509911'::text, 118141::int),
    ('2026052846509921'::text, 68467::int),
    ('2026052986299531'::text, 91038::int),
    ('2026052919759211'::text, 118519::int),
    ('2026053028241311'::text, 69917::int),
    ('2026052733912371'::text, 453298::int),
    ('2026060461185901'::text, 73239::int),
    ('2026060254308251'::text, 75456::int),
    ('2026052916051981'::text, 72150::int),
    ('2026053029807011'::text, 118141::int),
    ('2026053029807021'::text, 71773::int),
    ('2026053029093151'::text, 77054::int),
    ('2026052717913121'::text, 91038::int),
    ('2026052842709571'::text, 121824::int),
    ('2026052843464661'::text, 75456::int),
    ('2026052989243811'::text, 75456::int),
    ('2026061541892241'::text, 111908::int),
    ('2026061541892251'::text, 67051::int),
    ('2026061541892261'::text, 9444::int),
    ('2026052715148911'::text, 121880::int),
    ('2026052914846531'::text, 72150::int),
    ('2026061916309001'::text, 9444::int),
    ('2026052922272431'::text, 118519::int),
    ('2026052915329581'::text, 118141::int),
    ('2026052915329591'::text, 71773::int),
    ('2026053037553871'::text, 118520::int),
    ('2026053037553881'::text, 9444::int),
    ('2026052916467291'::text, 72150::int),
    ('2026053041037291'::text, 72151::int),
    ('2026053044412711'::text, 72150::int),
    ('2026053042837501'::text, 72151::int),
    ('2026052844284661'::text, 72151::int),
    ('2026052725784801'::text, 121824::int),
    ('2026052732116931'::text, 114836::int),
    ('2026052732116941'::text, 68467::int),
    ('2026052794599381'::text, 118142::int),
    ('2026052794599391'::text, 90660::int),
    ('2026052922272441'::text, 27387::int),
    ('2026052791355931'::text, 75456::int),
    ('2026052791887001'::text, 75456::int),
    ('2026052714677921'::text, 75456::int),
    ('2026052722857021'::text, 72150::int),
    ('2026060126978261'::text, 75456::int),
    ('2026053156717341'::text, 72151::int),
    ('2026053178458141'::text, 72150::int),
    ('2026060135477331'::text, 9444::int),
    ('2026060135477321'::text, 119463::int),
    ('2026053031663411'::text, 68467::int),
    ('2026053031663421'::text, 115780::int),
    ('2026053161584691'::text, 68467::int),
    ('2026053048223041'::text, 72150::int),
    ('2026053183880441'::text, 118519::int),
    ('2026053183880451'::text, 9445::int),
    ('2026060314956661'::text, 71773::int),
    ('2026060314956671'::text, 115780::int),
    ('2026053176369661'::text, 68467::int),
    ('2026053170402211'::text, 72151::int),
    ('2026053188539881'::text, 118141::int),
    ('2026053188539891'::text, 68467::int),
    ('2026053188539901'::text, 9444::int),
    ('2026053031663431'::text, 9444::int),
    ('2026053031663441'::text, 27387::int),
    ('2026060192921771'::text, 71773::int),
    ('2026060192921781'::text, 115780::int),
    ('2026053176369651'::text, 115780::int),
    ('2026053161584701'::text, 115780::int),
    ('2026053172746661'::text, 72150::int),
    ('2026053174414691'::text, 72150::int),
    ('2026053176725731'::text, 91038::int),
    ('2026053176725741'::text, 9444::int),
    ('2026060132862811'::text, 73189::int),
    ('2026060150617561'::text, 73189::int),
    ('2026060147608671'::text, 73189::int),
    ('2026060137409671'::text, 121824::int),
    ('2026060198463541'::text, 75456::int),
    ('2026060260621571'::text, 121824::int),
    ('2026060260621581'::text, 9444::int),
    ('2026060254482701'::text, 75456::int),
    ('2026060274882991'::text, 71773::int),
    ('2026060274883001'::text, 118141::int),
    ('2026060283259971'::text, 119465::int),
    ('2026060286845371'::text, 91982::int),
    ('2026060286845381'::text, 9444::int),
    ('2026060290477611'::text, 121824::int),
    ('2026060287642331'::text, 141184::int),
    ('2026060276147451'::text, 115780::int),
    ('2026060276147461'::text, 71773::int),
    ('2026060273959951'::text, 73190::int),
    ('2026060442947261'::text, 73189::int),
    ('2026060317264241'::text, 71773::int),
    ('2026060317264231'::text, 115780::int),
    ('2026060317002651'::text, 115780::int),
    ('2026060446581431'::text, 73245::int),
    ('2026060442508011'::text, 73189::int),
    ('2026060441284771'::text, 73189::int),
    ('2026060329578021'::text, 119463::int),
    ('2026060318932671'::text, 115780::int),
    ('2026060318932681'::text, 143545::int),
    ('2026060322676701'::text, 73190::int),
    ('2026060330958061'::text, 75456::int),
    ('2026060318932691'::text, 9444::int),
    ('2026060317002661'::text, 71773::int),
    ('2026060442786481'::text, 73189::int),
    ('2026060333338491'::text, 118142::int),
    ('2026060322377711'::text, 115780::int),
    ('2026060322377721'::text, 71773::int),
    ('2026060319478431'::text, 115780::int),
    ('2026060319478441'::text, 71773::int)
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
             AND week_start = DATE '2026-06-29'
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
    ('2026061916308991'::text, 66106::int),
    ('2026061916309011'::text, 27387::int),
    ('2026052870145181'::text, 114836::int),
    ('2026052870145191'::text, 68467::int),
    ('2026060461185911'::text, 9452::int),
    ('2026053046457571'::text, 118142::int),
    ('2026053046457581'::text, 71773::int),
    ('2026052846509911'::text, 118141::int),
    ('2026052846509921'::text, 68467::int),
    ('2026052986299531'::text, 91038::int),
    ('2026052919759211'::text, 118519::int),
    ('2026053028241311'::text, 69917::int),
    ('2026052733912371'::text, 453298::int),
    ('2026060461185901'::text, 73239::int),
    ('2026060254308251'::text, 75456::int),
    ('2026052916051981'::text, 72150::int),
    ('2026053029807011'::text, 118141::int),
    ('2026053029807021'::text, 71773::int),
    ('2026053029093151'::text, 77054::int),
    ('2026052717913121'::text, 91038::int),
    ('2026052842709571'::text, 121824::int),
    ('2026052843464661'::text, 75456::int),
    ('2026052989243811'::text, 75456::int),
    ('2026061541892241'::text, 111908::int),
    ('2026061541892251'::text, 67051::int),
    ('2026061541892261'::text, 9444::int),
    ('2026052715148911'::text, 121880::int),
    ('2026052914846531'::text, 72150::int),
    ('2026061916309001'::text, 9444::int),
    ('2026052922272431'::text, 118519::int),
    ('2026052915329581'::text, 118141::int),
    ('2026052915329591'::text, 71773::int),
    ('2026053037553871'::text, 118520::int),
    ('2026053037553881'::text, 9444::int),
    ('2026052916467291'::text, 72150::int),
    ('2026053041037291'::text, 72151::int),
    ('2026053044412711'::text, 72150::int),
    ('2026053042837501'::text, 72151::int),
    ('2026052844284661'::text, 72151::int),
    ('2026052725784801'::text, 121824::int),
    ('2026052732116931'::text, 114836::int),
    ('2026052732116941'::text, 68467::int),
    ('2026052794599381'::text, 118142::int),
    ('2026052794599391'::text, 90660::int),
    ('2026052922272441'::text, 27387::int),
    ('2026052791355931'::text, 75456::int),
    ('2026052791887001'::text, 75456::int),
    ('2026052714677921'::text, 75456::int),
    ('2026052722857021'::text, 72150::int),
    ('2026060126978261'::text, 75456::int),
    ('2026053156717341'::text, 72151::int),
    ('2026053178458141'::text, 72150::int),
    ('2026060135477331'::text, 9444::int),
    ('2026060135477321'::text, 119463::int),
    ('2026053031663411'::text, 68467::int),
    ('2026053031663421'::text, 115780::int),
    ('2026053161584691'::text, 68467::int),
    ('2026053048223041'::text, 72150::int),
    ('2026053183880441'::text, 118519::int),
    ('2026053183880451'::text, 9445::int),
    ('2026060314956661'::text, 71773::int),
    ('2026060314956671'::text, 115780::int),
    ('2026053176369661'::text, 68467::int),
    ('2026053170402211'::text, 72151::int),
    ('2026053188539881'::text, 118141::int),
    ('2026053188539891'::text, 68467::int),
    ('2026053188539901'::text, 9444::int),
    ('2026053031663431'::text, 9444::int),
    ('2026053031663441'::text, 27387::int),
    ('2026060192921771'::text, 71773::int),
    ('2026060192921781'::text, 115780::int),
    ('2026053176369651'::text, 115780::int),
    ('2026053161584701'::text, 115780::int),
    ('2026053172746661'::text, 72150::int),
    ('2026053174414691'::text, 72150::int),
    ('2026053176725731'::text, 91038::int),
    ('2026053176725741'::text, 9444::int),
    ('2026060132862811'::text, 73189::int),
    ('2026060150617561'::text, 73189::int),
    ('2026060147608671'::text, 73189::int),
    ('2026060137409671'::text, 121824::int),
    ('2026060198463541'::text, 75456::int),
    ('2026060260621571'::text, 121824::int),
    ('2026060260621581'::text, 9444::int),
    ('2026060254482701'::text, 75456::int),
    ('2026060274882991'::text, 71773::int),
    ('2026060274883001'::text, 118141::int),
    ('2026060283259971'::text, 119465::int),
    ('2026060286845371'::text, 91982::int),
    ('2026060286845381'::text, 9444::int),
    ('2026060290477611'::text, 121824::int),
    ('2026060287642331'::text, 141184::int),
    ('2026060276147451'::text, 115780::int),
    ('2026060276147461'::text, 71773::int),
    ('2026060273959951'::text, 73190::int),
    ('2026060442947261'::text, 73189::int),
    ('2026060317264241'::text, 71773::int),
    ('2026060317264231'::text, 115780::int),
    ('2026060317002651'::text, 115780::int),
    ('2026060446581431'::text, 73245::int),
    ('2026060442508011'::text, 73189::int),
    ('2026060441284771'::text, 73189::int),
    ('2026060329578021'::text, 119463::int),
    ('2026060318932671'::text, 115780::int),
    ('2026060318932681'::text, 143545::int),
    ('2026060322676701'::text, 73190::int),
    ('2026060330958061'::text, 75456::int),
    ('2026060318932691'::text, 9444::int),
    ('2026060317002661'::text, 71773::int),
    ('2026060442786481'::text, 73189::int),
    ('2026060333338491'::text, 118142::int),
    ('2026060322377711'::text, 115780::int),
    ('2026060322377721'::text, 71773::int),
    ('2026060319478431'::text, 115780::int),
    ('2026060319478441'::text, 71773::int)
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
    ('2026061916308991'::text, 66106::int),
    ('2026061916309011'::text, 27387::int),
    ('2026052870145181'::text, 114836::int),
    ('2026052870145191'::text, 68467::int),
    ('2026060461185911'::text, 9452::int),
    ('2026053046457571'::text, 118142::int),
    ('2026053046457581'::text, 71773::int),
    ('2026052846509911'::text, 118141::int),
    ('2026052846509921'::text, 68467::int),
    ('2026052986299531'::text, 91038::int),
    ('2026052919759211'::text, 118519::int),
    ('2026053028241311'::text, 69917::int),
    ('2026052733912371'::text, 453298::int),
    ('2026060461185901'::text, 73239::int),
    ('2026060254308251'::text, 75456::int),
    ('2026052916051981'::text, 72150::int),
    ('2026053029807011'::text, 118141::int),
    ('2026053029807021'::text, 71773::int),
    ('2026053029093151'::text, 77054::int),
    ('2026052717913121'::text, 91038::int),
    ('2026052842709571'::text, 121824::int),
    ('2026052843464661'::text, 75456::int),
    ('2026052989243811'::text, 75456::int),
    ('2026061541892241'::text, 111908::int),
    ('2026061541892251'::text, 67051::int),
    ('2026061541892261'::text, 9444::int),
    ('2026052715148911'::text, 121880::int),
    ('2026052914846531'::text, 72150::int),
    ('2026061916309001'::text, 9444::int),
    ('2026052922272431'::text, 118519::int),
    ('2026052915329581'::text, 118141::int),
    ('2026052915329591'::text, 71773::int),
    ('2026053037553871'::text, 118520::int),
    ('2026053037553881'::text, 9444::int),
    ('2026052916467291'::text, 72150::int),
    ('2026053041037291'::text, 72151::int),
    ('2026053044412711'::text, 72150::int),
    ('2026053042837501'::text, 72151::int),
    ('2026052844284661'::text, 72151::int),
    ('2026052725784801'::text, 121824::int),
    ('2026052732116931'::text, 114836::int),
    ('2026052732116941'::text, 68467::int),
    ('2026052794599381'::text, 118142::int),
    ('2026052794599391'::text, 90660::int),
    ('2026052922272441'::text, 27387::int),
    ('2026052791355931'::text, 75456::int),
    ('2026052791887001'::text, 75456::int),
    ('2026052714677921'::text, 75456::int),
    ('2026052722857021'::text, 72150::int),
    ('2026060126978261'::text, 75456::int),
    ('2026053156717341'::text, 72151::int),
    ('2026053178458141'::text, 72150::int),
    ('2026060135477331'::text, 9444::int),
    ('2026060135477321'::text, 119463::int),
    ('2026053031663411'::text, 68467::int),
    ('2026053031663421'::text, 115780::int),
    ('2026053161584691'::text, 68467::int),
    ('2026053048223041'::text, 72150::int),
    ('2026053183880441'::text, 118519::int),
    ('2026053183880451'::text, 9445::int),
    ('2026060314956661'::text, 71773::int),
    ('2026060314956671'::text, 115780::int),
    ('2026053176369661'::text, 68467::int),
    ('2026053170402211'::text, 72151::int),
    ('2026053188539881'::text, 118141::int),
    ('2026053188539891'::text, 68467::int),
    ('2026053188539901'::text, 9444::int),
    ('2026053031663431'::text, 9444::int),
    ('2026053031663441'::text, 27387::int),
    ('2026060192921771'::text, 71773::int),
    ('2026060192921781'::text, 115780::int),
    ('2026053176369651'::text, 115780::int),
    ('2026053161584701'::text, 115780::int),
    ('2026053172746661'::text, 72150::int),
    ('2026053174414691'::text, 72150::int),
    ('2026053176725731'::text, 91038::int),
    ('2026053176725741'::text, 9444::int),
    ('2026060132862811'::text, 73189::int),
    ('2026060150617561'::text, 73189::int),
    ('2026060147608671'::text, 73189::int),
    ('2026060137409671'::text, 121824::int),
    ('2026060198463541'::text, 75456::int),
    ('2026060260621571'::text, 121824::int),
    ('2026060260621581'::text, 9444::int),
    ('2026060254482701'::text, 75456::int),
    ('2026060274882991'::text, 71773::int),
    ('2026060274883001'::text, 118141::int),
    ('2026060283259971'::text, 119465::int),
    ('2026060286845371'::text, 91982::int),
    ('2026060286845381'::text, 9444::int),
    ('2026060290477611'::text, 121824::int),
    ('2026060287642331'::text, 141184::int),
    ('2026060276147451'::text, 115780::int),
    ('2026060276147461'::text, 71773::int),
    ('2026060273959951'::text, 73190::int),
    ('2026060442947261'::text, 73189::int),
    ('2026060317264241'::text, 71773::int),
    ('2026060317264231'::text, 115780::int),
    ('2026060317002651'::text, 115780::int),
    ('2026060446581431'::text, 73245::int),
    ('2026060442508011'::text, 73189::int),
    ('2026060441284771'::text, 73189::int),
    ('2026060329578021'::text, 119463::int),
    ('2026060318932671'::text, 115780::int),
    ('2026060318932681'::text, 143545::int),
    ('2026060322676701'::text, 73190::int),
    ('2026060330958061'::text, 75456::int),
    ('2026060318932691'::text, 9444::int),
    ('2026060317002661'::text, 71773::int),
    ('2026060442786481'::text, 73189::int),
    ('2026060333338491'::text, 118142::int),
    ('2026060322377711'::text, 115780::int),
    ('2026060322377721'::text, 71773::int),
    ('2026060319478431'::text, 115780::int),
    ('2026060319478441'::text, 71773::int)
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
