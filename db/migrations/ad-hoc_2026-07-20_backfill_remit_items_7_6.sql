-- ad-hoc_2026-07-20_backfill_remit_items_7_6.sql
-- 2026-07-20 v3 — DO 블록 / RAISE NOTICE / TEMP TABLE / BEGIN·COMMIT 전부 제거
--
-- v2 실패 원인 (Supabase SQL Editor):
--   DO $$ 블록 실행 여부 확인 불가. "Success. No rows returned" 만 표시.
--   NOTICE 안 보임. 트랜잭션 컨텍스트 처리 방식 불명 → 실제 INSERT 0건.
--   진단 SQL [S3] 결과: 매칭·필터 모두 정상 (10_passes_ALL=53).
--
-- v3 구조: 순수 SQL 문장 4개.
--   [1] INSERT ... SELECT ... ON CONFLICT DO NOTHING RETURNING id
--       → 편집기에 rows returned 로 삽입 건수 표시
--   [2] UPDATE principal_weekly_remittances SET snapshot_item_count ... RETURNING
--       → 요약 세팅 확인
--   [3] UPDATE task_items SET company_received_at ... RETURNING id
--       → 스탬프 건수 표시
--   [4] SELECT 검증 — 최종 카운트 · 총액
--
-- 실행:
--   각 섹션 [1]~[4] 를 블록 지정 후 개별 Run.
--   각 문장 자동 커밋 (BEGIN/COMMIT 없음).
--   문제 발생 시 각 문장 결과 즉시 확인 가능.
--
-- 엑셀 파싱 결과:
--   · 총 건수: 115 (기대: 115)
--   · 이월 건수: 0 (기대: 0)
--   · Σ ROUND(subtotal × 0.85): 8,187,027 (기대: 8,187,023)

-- ============================================================================
-- [1] 스냅샷 INSERT
--   기대: 115 rows returned (편집기 하단 rows count 확인)
--   0 rows returned → remit 조회 실패 or 필터 이상 (진단 SQL [S3] 재확인)
--   115 미만 → 매칭 실패분 (진단 SQL [S4] 로 상세 확인)
-- ============================================================================
WITH remit AS (
  SELECT id AS remit_id, confirmed_at, tenant_id
    FROM principal_weekly_remittances
   WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
     AND week_start = DATE '2026-06-29'
     AND confirmed_at IS NOT NULL
),
excel(poid, buyer_name, subtotal, is_carryover, carry_monday) AS (
  VALUES
    ('2026061916308991', '박우용', 66106, false, NULL::date),
    ('2026061916309011', '박우용', 27387, false, NULL::date),
    ('2026052870145181', '정주연', 114836, false, NULL::date),
    ('2026052870145191', '정주연', 68467, false, NULL::date),
    ('2026060461185911', '정현지', 9452, false, NULL::date),
    ('2026053046457571', '조미란', 118142, false, NULL::date),
    ('2026053046457581', '조미란', 71773, false, NULL::date),
    ('2026052846509911', '한성림', 118141, false, NULL::date),
    ('2026052846509921', '한성림', 68467, false, NULL::date),
    ('2026052986299531', '이지은', 91038, false, NULL::date),
    ('2026052919759211', '김병귀', 118519, false, NULL::date),
    ('2026053028241311', '이현우', 69917, false, NULL::date),
    ('2026052733912371', '김지은', 453298, false, NULL::date),
    ('2026060461185901', '정현지', 73239, false, NULL::date),
    ('2026060254308251', '율', 75456, false, NULL::date),
    ('2026052916051981', '박지윤', 72150, false, NULL::date),
    ('2026053029807011', '류영석', 118141, false, NULL::date),
    ('2026053029807021', '류영석', 71773, false, NULL::date),
    ('2026053029093151', '김현준', 77054, false, NULL::date),
    ('2026052717913121', '곽수민', 91038, false, NULL::date),
    ('2026052842709571', '정성수', 121824, false, NULL::date),
    ('2026052843464661', '서건윤', 75456, false, NULL::date),
    ('2026052989243811', '임근재', 75456, false, NULL::date),
    ('2026061541892241', '김미미', 111908, false, NULL::date),
    ('2026061541892251', '김미미', 67051, false, NULL::date),
    ('2026061541892261', '김미미', 9444, false, NULL::date),
    ('2026052715148911', '손영우', 121880, false, NULL::date),
    ('2026052914846531', '장윤정', 72150, false, NULL::date),
    ('2026061916309001', '박우용', 9444, false, NULL::date),
    ('2026052922272431', '이채영', 118519, false, NULL::date),
    ('2026052915329581', '문형준', 118141, false, NULL::date),
    ('2026052915329591', '문형준', 71773, false, NULL::date),
    ('2026053037553871', '강명혜', 118520, false, NULL::date),
    ('2026053037553881', '강명혜', 9444, false, NULL::date),
    ('2026052916467291', '남보경', 72150, false, NULL::date),
    ('2026053041037291', '임경민', 72151, false, NULL::date),
    ('2026053044412711', '김민서', 72150, false, NULL::date),
    ('2026053042837501', '윤용숙', 72151, false, NULL::date),
    ('2026052844284661', '최지윤', 72151, false, NULL::date),
    ('2026052725784801', '손배영', 121824, false, NULL::date),
    ('2026052732116931', '김희정', 114836, false, NULL::date),
    ('2026052732116941', '김희정', 68467, false, NULL::date),
    ('2026052794599381', '이연옥', 118142, false, NULL::date),
    ('2026052794599391', '이연옥', 90660, false, NULL::date),
    ('2026052922272441', '이채영', 27387, false, NULL::date),
    ('2026052791355931', '박범수', 75456, false, NULL::date),
    ('2026052791887001', '박정현', 75456, false, NULL::date),
    ('2026052714677921', '이춘자', 75456, false, NULL::date),
    ('2026052722857021', '채지형', 72150, false, NULL::date),
    ('2026060126978261', '윤순', 75456, false, NULL::date),
    ('2026053156717341', '최정우', 72151, false, NULL::date),
    ('2026053178458141', '박나현', 72150, false, NULL::date),
    ('2026060135477331', '박수인', 9444, false, NULL::date),
    ('2026060135477321', '박수인', 119463, false, NULL::date),
    ('2026053031663411', '하나영', 68467, false, NULL::date),
    ('2026053031663421', '하나영', 115780, false, NULL::date),
    ('2026053161584691', '서창환', 68467, false, NULL::date),
    ('2026053048223041', '박경은', 72150, false, NULL::date),
    ('2026053183880441', '유연하', 118519, false, NULL::date),
    ('2026053183880451', '유연하', 9445, false, NULL::date),
    ('2026060314956661', '이대원', 71773, false, NULL::date),
    ('2026060314956671', '이대원', 115780, false, NULL::date),
    ('2026053176369661', '유현지', 68467, false, NULL::date),
    ('2026053170402211', '김예은', 72151, false, NULL::date),
    ('2026053188539881', '이재경', 118141, false, NULL::date),
    ('2026053188539891', '이재경', 68467, false, NULL::date),
    ('2026053188539901', '이재경', 9444, false, NULL::date),
    ('2026053031663431', '하나영', 9444, false, NULL::date),
    ('2026053031663441', '하나영', 27387, false, NULL::date),
    ('2026060192921771', '유규상', 71773, false, NULL::date),
    ('2026060192921781', '유규상', 115780, false, NULL::date),
    ('2026053176369651', '유현지', 115780, false, NULL::date),
    ('2026053161584701', '서창환', 115780, false, NULL::date),
    ('2026053172746661', '민혜원', 72150, false, NULL::date),
    ('2026053174414691', '박효정', 72150, false, NULL::date),
    ('2026053176725731', '박인우', 91038, false, NULL::date),
    ('2026053176725741', '박인우', 9444, false, NULL::date),
    ('2026060132862811', '이진아', 73189, false, NULL::date),
    ('2026060150617561', '이승은', 73189, false, NULL::date),
    ('2026060147608671', '메이브', 73189, false, NULL::date),
    ('2026060137409671', '노다희', 121824, false, NULL::date),
    ('2026060198463541', '최동준', 75456, false, NULL::date),
    ('2026060260621571', '최유니', 121824, false, NULL::date),
    ('2026060260621581', '최유니', 9444, false, NULL::date),
    ('2026060254482701', '설재진', 75456, false, NULL::date),
    ('2026060274882991', '정신화', 71773, false, NULL::date),
    ('2026060274883001', '정신화', 118141, false, NULL::date),
    ('2026060283259971', '김미영', 119465, false, NULL::date),
    ('2026060286845371', '이정화', 91982, false, NULL::date),
    ('2026060286845381', '이정화', 9444, false, NULL::date),
    ('2026060290477611', '한철인', 121824, false, NULL::date),
    ('2026060287642331', '유성찬', 141184, false, NULL::date),
    ('2026060276147451', '윤영임', 115780, false, NULL::date),
    ('2026060276147461', '윤영임', 71773, false, NULL::date),
    ('2026060273959951', '김다연', 73190, false, NULL::date),
    ('2026060442947261', '주성빈', 73189, false, NULL::date),
    ('2026060317264241', '박순천', 71773, false, NULL::date),
    ('2026060317264231', '박순천', 115780, false, NULL::date),
    ('2026060317002651', '이의칠', 115780, false, NULL::date),
    ('2026060446581431', '남예은', 73245, false, NULL::date),
    ('2026060442508011', '안성훈', 73189, false, NULL::date),
    ('2026060441284771', '김찬종', 73189, false, NULL::date),
    ('2026060329578021', '박희숙', 119463, false, NULL::date),
    ('2026060318932671', '신지혜', 115780, false, NULL::date),
    ('2026060318932681', '신지혜', 143545, false, NULL::date),
    ('2026060322676701', '남가경', 73190, false, NULL::date),
    ('2026060330958061', '이성삼', 75456, false, NULL::date),
    ('2026060318932691', '신지혜', 9444, false, NULL::date),
    ('2026060317002661', '이의칠', 71773, false, NULL::date),
    ('2026060442786481', '김보경', 73189, false, NULL::date),
    ('2026060333338491', '박미선', 118142, false, NULL::date),
    ('2026060322377711', '이일주', 115780, false, NULL::date),
    ('2026060322377721', '이일주', 71773, false, NULL::date),
    ('2026060319478431', '곽윤기', 115780, false, NULL::date),
    ('2026060319478441', '곽윤기', 71773, false, NULL::date)
)
INSERT INTO principal_weekly_remit_items (
  tenant_id, remit_id, task_item_id,
  subtotal, net_amount, company_receive_amount,
  is_carryover, carryover_source_monday,
  naver_settled_at, captured_at
)
SELECT
  r.tenant_id,
  r.remit_id,
  ti.id,
  e.subtotal,
  NULL,
  ROUND(e.subtotal::numeric * 0.85)::int,
  e.is_carryover,
  e.carry_monday,
  ti.naver_settled_at,
  r.confirmed_at
FROM excel e
JOIN task_items ti ON ti.product_order_id = e.poid
JOIN tasks       t ON t.id = ti.task_id
CROSS JOIN remit r
WHERE t.principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
  AND (t.status IS NULL OR t.status != '취소')
  AND COALESCE(ti.is_canceled, false) = false
ON CONFLICT (remit_id, task_item_id) DO NOTHING
RETURNING id;

-- ============================================================================
-- [2] snapshot_item_count 세팅 (엑셀 원본 건수 · 매칭 실패해도 사장님 값 유지)
--   기대: 1 row returned (그 remit row 정보 표시)
-- ============================================================================
UPDATE principal_weekly_remittances
   SET snapshot_item_count = 115,
       updated_at = now()
 WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
   AND week_start = DATE '2026-06-29'
   AND confirmed_at IS NOT NULL
RETURNING id, week_start, confirmed_at, remitted_amount, snapshot_item_count;

-- ============================================================================
-- [3] company_received_at 스탬프 (스냅샷 items 중 NULL 만)
--   기대 (7_6):
--     · 7_13 → 이월 39건 스탬프 (당주 14 는 이미 다른 경로 스탬프됨)
--     · 7_6  → 4건 or 이하 (사장님 언급 111건 이미 스탬프 · 나머지 4건 유실 처리)
--   실제 rows returned 로 확인.
-- ============================================================================
UPDATE task_items ti
   SET company_received_at = (
     SELECT confirmed_at FROM principal_weekly_remittances
      WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
        AND week_start = DATE '2026-06-29'
        AND confirmed_at IS NOT NULL
   )
 WHERE ti.id IN (
   SELECT ri.task_item_id
     FROM principal_weekly_remit_items ri
    WHERE ri.remit_id = (
      SELECT id FROM principal_weekly_remittances
       WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
         AND week_start = DATE '2026-06-29'
         AND confirmed_at IS NOT NULL
    )
 )
   AND ti.company_received_at IS NULL
RETURNING ti.id;

-- ============================================================================
-- [4] 최종 검증 — 스냅샷 카운트 · 총액 · 이월 분리
--   기대: cnt=115 · sum_recv≈8,187,027 · carry_cnt=0
--   (반올림 차이 ±수원 정상)
-- ============================================================================
SELECT
  count(*)                                      AS cnt,
  sum(company_receive_amount)                   AS sum_recv,
  sum(CASE WHEN is_carryover THEN 1 ELSE 0 END) AS carry_cnt,
  sum(subtotal)                                 AS sum_subtotal
FROM principal_weekly_remit_items
WHERE remit_id = (
  SELECT id FROM principal_weekly_remittances
   WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
     AND week_start = DATE '2026-06-29'
);

-- ============================================================================
-- [5] (선택) 이월 소멸 확인 — 소급 후 미회수 items 재계산
--   기대: 7_6 소급 완료 후 그 주차까지의 미회수 이월 감소 확인
-- ============================================================================
-- SELECT count(*) AS remaining_unpaid_upto_7_6,
--        sum(ti.subtotal) AS remaining_sum
--   FROM task_items ti
--   JOIN tasks t ON ti.task_id = t.id
--  WHERE t.principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
--    AND t.status = '완료'
--    AND ti.naver_settled_at IS NOT NULL
--    AND ti.company_received_at IS NULL
--    AND (ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date <= DATE '2026-07-05'
--    AND COALESCE(ti.is_canceled, false) = false
--    AND ti.subtotal > 0
--    AND EXISTS (SELECT 1 FROM payments p WHERE p.task_id = t.id AND p.track = 'B');
