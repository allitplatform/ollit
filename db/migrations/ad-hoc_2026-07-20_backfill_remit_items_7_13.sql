-- ad-hoc_2026-07-20_backfill_remit_items_7_13.sql
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
--   · 총 건수: 53 (기대: 53)
--   · 이월 건수: 39 (기대: 39)
--   · Σ ROUND(subtotal × 0.85): 2,865,596 (기대: 2,865,597)

-- ============================================================================
-- [1] 스냅샷 INSERT
--   기대: 53 rows returned (편집기 하단 rows count 확인)
--   0 rows returned → remit 조회 실패 or 필터 이상 (진단 SQL [S3] 재확인)
--   53 미만 → 매칭 실패분 (진단 SQL [S4] 로 상세 확인)
-- ============================================================================
WITH remit AS (
  SELECT id AS remit_id, confirmed_at, tenant_id
    FROM principal_weekly_remittances
   WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
     AND week_start = DATE '2026-07-06'
     AND confirmed_at IS NOT NULL
),
excel(poid, buyer_name, subtotal, is_carryover, carry_monday) AS (
  VALUES
    ('2026070144072831', '최수영', 61385, false, NULL::date),
    ('2026070144072841', '최수영', 9444, false, NULL::date),
    ('2026060460243081', '안하정', 121824, false, NULL::date),
    ('2026060460458571', '김원철', 73189, false, NULL::date),
    ('2026060466331401', '임혜림', 73190, false, NULL::date),
    ('2026060980211300', '양우준', 115591, false, NULL::date),
    ('2026060980211310', '양우준', 9444, false, NULL::date),
    ('2026070365802561', '장지영', 9444, false, NULL::date),
    ('2026060811965491', '이주혁', 190763, false, NULL::date),
    ('2026060811965501', '이주혁', 28332, false, NULL::date),
    ('2026060811965511', '이주혁', 28332, false, NULL::date),
    ('2026060811965481', '이주혁', 76589, false, NULL::date),
    ('2026070365802541', '장지영', 103976, false, NULL::date),
    ('2026070365802551', '장지영', 115403, false, NULL::date),
    ('2026053034580481', '박서형', 27387, true, '2026-06-08'::date),
    ('2026051334158921', '강성철', 27967, true, '2026-06-15'::date),
    ('2026060329095671', '박유영', 27387, true, '2026-06-08'::date),
    ('2026060132418881', '이대원', 119463, true, '2026-06-15'::date),
    ('2026052842413771', '김종민', 68467, true, '2026-06-08'::date),
    ('2026051647998881', '유재위', 27387, true, '2026-06-15'::date),
    ('2026051648651691', '나소정', 27387, true, '2026-06-22'::date),
    ('2026052842413781', '김종민', 73284, true, '2026-06-08'::date),
    ('2026060394018071', '박승현', 27388, true, '2026-06-08'::date),
    ('2026060257614371', '정훈', 71773, true, '2026-06-15'::date),
    ('2026051065506651', '강예주', 27387, true, '2026-06-08'::date),
    ('2026053047088351', '이은서', 72151, true, '2026-06-15'::date),
    ('2026052225795441', '문연희', 9444, true, '2026-06-15'::date),
    ('2026060334975081', '김태윤', 119463, true, '2026-06-15'::date),
    ('2026051655424731', '서수명', 109642, true, '2026-06-15'::date),
    ('2026051654766671', '홍미', 66484, true, '2026-06-15'::date),
    ('2026052720443861', '최윤화', 118519, true, '2026-06-15'::date),
    ('2026053170369991', '김승현', 27387, true, '2026-06-08'::date),
    ('2026060399764161', '장주선', 115780, true, '2026-06-15'::date),
    ('2026050492308501', '김민정', 9444, true, '2026-06-01'::date),
    ('2026050492308491', '김민정', 66106, true, '2026-06-01'::date),
    ('2026052675530401', '신정원', 9444, true, '2026-06-15'::date),
    ('2026052671557421', '김의남', 27387, true, '2026-06-22'::date),
    ('2026051641043871', '김나영', 66484, true, '2026-06-15'::date),
    ('2026060399764181', '장주선', 9444, true, '2026-06-15'::date),
    ('2026051646230001', '김윤서', 27387, true, '2026-06-15'::date),
    ('2026050492308511', '김민정', 9444, true, '2026-06-01'::date),
    ('2026050894283591', '김진수', 55935, true, '2026-06-08'::date),
    ('2026060822065091', '유기성', 27967, true, '2026-06-15'::date),
    ('2026052225795431', '문연희', 118519, true, '2026-06-15'::date),
    ('2026060399764171', '장주선', 71773, true, '2026-06-15'::date),
    ('2026052842413811', '김종민', 18888, true, '2026-06-08'::date),
    ('2026051655424741', '서수명', 63745, true, '2026-06-15'::date),
    ('2026052675530391', '신정원', 271979, true, '2026-06-15'::date),
    ('2026052842413801', '김종민', 54774, true, '2026-06-08'::date),
    ('2026060257614381', '정훈', 115780, true, '2026-06-15'::date),
    ('2026060333984371', '홍경선', 119463, true, '2026-06-15'::date),
    ('2026052842413791', '김종민', 18888, true, '2026-06-08'::date),
    ('2026053184230671', '김대희', 27387, true, '2026-06-22'::date)
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
   SET snapshot_item_count = 53,
       updated_at = now()
 WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
   AND week_start = DATE '2026-07-06'
   AND confirmed_at IS NOT NULL
RETURNING id, week_start, confirmed_at, remitted_amount, snapshot_item_count;

-- ============================================================================
-- [3] company_received_at 스탬프 (스냅샷 items 중 NULL 만)
--   기대 (7_13):
--     · 7_13 → 이월 39건 스탬프 (당주 14 는 이미 다른 경로 스탬프됨)
--     · 7_6  → 4건 or 이하 (사장님 언급 111건 이미 스탬프 · 나머지 4건 유실 처리)
--   실제 rows returned 로 확인.
-- ============================================================================
UPDATE task_items ti
   SET company_received_at = (
     SELECT confirmed_at FROM principal_weekly_remittances
      WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
        AND week_start = DATE '2026-07-06'
        AND confirmed_at IS NOT NULL
   )
 WHERE ti.id IN (
   SELECT ri.task_item_id
     FROM principal_weekly_remit_items ri
    WHERE ri.remit_id = (
      SELECT id FROM principal_weekly_remittances
       WHERE principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
         AND week_start = DATE '2026-07-06'
         AND confirmed_at IS NOT NULL
    )
 )
   AND ti.company_received_at IS NULL
RETURNING ti.id;

-- ============================================================================
-- [4] 최종 검증 — 스냅샷 카운트 · 총액 · 이월 분리
--   기대: cnt=53 · sum_recv≈2,865,596 · carry_cnt=39
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
     AND week_start = DATE '2026-07-06'
);

-- ============================================================================
-- [5] (선택) 이월 소멸 확인 — 소급 후 미회수 items 재계산
--   기대: 7_13 소급 완료 후 그 주차까지의 미회수 이월 감소 확인
-- ============================================================================
-- SELECT count(*) AS remaining_unpaid_upto_7_13,
--        sum(ti.subtotal) AS remaining_sum
--   FROM task_items ti
--   JOIN tasks t ON ti.task_id = t.id
--  WHERE t.principal_id = (SELECT id FROM principals WHERE code = 'usol_n')
--    AND t.status = '완료'
--    AND ti.naver_settled_at IS NOT NULL
--    AND ti.company_received_at IS NULL
--    AND (ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date <= DATE '2026-07-12'
--    AND COALESCE(ti.is_canceled, false) = false
--    AND ti.subtotal > 0
--    AND EXISTS (SELECT 1 FROM payments p WHERE p.task_id = t.id AND p.track = 'B');
