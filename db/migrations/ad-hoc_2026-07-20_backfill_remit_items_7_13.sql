-- ad-hoc_2026-07-20_backfill_remit_items_7_13.sql
-- 2026-07-20 — 자동 생성 (scripts/gen-backfill-remit-items-sql.py)
--
-- 소급 대상: 7_13 확정 주차 (usol_n, week_start=2026-07-06, week_end=2026-07-12)
-- 엑셀 소스: 유솔N_주정산_7월 2주차 (1).xlsx
--
-- 엑셀 파싱 결과:
--   · 총 건수: 53 (기대: 53)
--   · 이월 건수: 39 (기대: 39)
--   · Σ ROUND(subtotal × 0.85): 2,865,596 (기대: 2,865,597)
--
-- 처리 (임시 테이블 방식):
--   1. remit_id 조회 (usol_n · week_start · confirmed)
--   2. _excel_rows 임시 테이블에 엑셀 items INSERT
--   3. _matched 임시 테이블 = LEFT JOIN task_items (매칭 성공/실패 함께 보존)
--   4. 매칭 실패 리포트 — FOR 루프로 poid · buyer · subtotal RAISE NOTICE 각 행 출력
--   5. principal_weekly_remit_items INSERT (매칭 성공만)
--   6. snapshot_item_count = 53 UPDATE (매칭 실패해도 사장님 값 유지)
--   7. company_received_at 스탬프 (스냅샷 items 중 NULL만)
--   8. 최종 요약 리포트
--
-- 실행:
--   BEGIN;
--   \i ad-hoc_2026-07-20_backfill_remit_items_7_13.sql
--   -- 리포트 확인 후 COMMIT (문제 시 ROLLBACK)
--   COMMIT;

BEGIN;

DO $$
DECLARE
  v_pid            uuid;
  v_remit_id       uuid;
  v_confirmed_at   timestamptz;
  v_snapshot_count int;
  v_stamped_count  int;
  v_missing_count  int;
  r RECORD;
BEGIN
  SELECT id INTO v_pid FROM principals WHERE code = 'usol_n';
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'principal usol_n 없음';
  END IF;

  SELECT id, confirmed_at INTO v_remit_id, v_confirmed_at
    FROM principal_weekly_remittances
   WHERE principal_id = v_pid
     AND week_start = DATE '2026-07-06'
     AND confirmed_at IS NOT NULL;
  IF v_remit_id IS NULL THEN
    RAISE EXCEPTION '2026-07-06 확정 remit row 없음 (미확정 or 없음)';
  END IF;

  -- (2) 엑셀 items → 임시 테이블
  CREATE TEMP TABLE _excel_rows (
    product_order_id text,
    buyer_name       text,
    subtotal         int,
    is_carryover     boolean,
    carry_monday     date
  ) ON COMMIT DROP;

  INSERT INTO _excel_rows (product_order_id, buyer_name, subtotal, is_carryover, carry_monday)
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
    ('2026053184230671', '김대희', 27387, true, '2026-06-22'::date);

  -- (3) 매칭 — LEFT JOIN 결과 임시 보존 (매칭 실패도 포함)
  CREATE TEMP TABLE _matched ON COMMIT DROP AS
  SELECT
    e.product_order_id,
    e.buyer_name,
    e.subtotal,
    e.is_carryover,
    e.carry_monday,
    ti.id                     AS task_item_id,
    ti.tenant_id,
    ti.naver_settled_at,
    ti.company_received_at,
    t.customer_name           AS db_customer_name,
    t.principal_id,
    t.status                  AS task_status,
    ti.is_canceled            AS ti_canceled
  FROM _excel_rows e
  LEFT JOIN task_items ti ON ti.product_order_id = e.product_order_id::text
  LEFT JOIN tasks       t ON t.id = ti.task_id;

  -- (4) 매칭 실패 상세 리포트 — 각 행 poid · buyer · subtotal · task_status · 스탬프 여부 · 사유
  --     사장님 개별 처리 판단용 (취소분 vs 주문번호 변경분 구분).
  FOR r IN
    SELECT product_order_id, buyer_name, subtotal,
           task_item_id, principal_id, task_status, ti_canceled, company_received_at,
           CASE
             WHEN task_item_id IS NULL          THEN 'task_items 없음 (주문번호 변경 or 삭제)'
             WHEN principal_id != v_pid          THEN 'principal 불일치 (다른 원청)'
             WHEN task_status = '취소'           THEN 'tasks.status=취소 (확정 후 취소)'
             WHEN COALESCE(ti_canceled, false)   THEN 'task_items.is_canceled=true'
             ELSE '기타'
           END AS reason
      FROM _matched
     WHERE task_item_id IS NULL OR principal_id != v_pid
        OR task_status = '취소' OR COALESCE(ti_canceled, false)
     ORDER BY product_order_id
  LOOP
    RAISE NOTICE '[missing] poid=% buyer=% subtotal=% task_status=% stamped=% reason=%',
      r.product_order_id,
      r.buyer_name,
      r.subtotal,
      COALESCE(r.task_status, '(N/A)'),
      CASE WHEN r.company_received_at IS NULL THEN 'NO' ELSE r.company_received_at::text END,
      r.reason;
  END LOOP;

  SELECT count(*) INTO v_missing_count FROM _matched
   WHERE task_item_id IS NULL OR principal_id != v_pid
      OR task_status = '취소' OR COALESCE(ti_canceled, false);

  -- (5) 스냅샷 INSERT (매칭 성공 + usol_n 소속 + 취소 아닌 것만)
  WITH inserted AS (
    INSERT INTO principal_weekly_remit_items (
      tenant_id, remit_id, task_item_id,
      subtotal, net_amount, company_receive_amount,
      is_carryover, carryover_source_monday,
      naver_settled_at, captured_at
    )
    SELECT
      m.tenant_id, v_remit_id, m.task_item_id,
      m.subtotal, NULL,
      ROUND(m.subtotal::numeric * 0.85)::int,
      m.is_carryover, m.carry_monday,
      m.naver_settled_at, v_confirmed_at
    FROM _matched m
    WHERE m.task_item_id IS NOT NULL
      AND m.principal_id = v_pid
      AND m.task_status != '취소'
      AND COALESCE(m.ti_canceled, false) = false
    ON CONFLICT (remit_id, task_item_id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_snapshot_count FROM inserted;

  -- (6) 요약 스냅샷: 엑셀 원본 건수 (매칭 실패해도 사장님 값 유지)
  UPDATE principal_weekly_remittances
     SET snapshot_item_count = 53
   WHERE id = v_remit_id;

  -- (7) company_received_at 스탬프 (스냅샷 items, NULL 만)
  WITH stamped AS (
    UPDATE task_items ti
       SET company_received_at = v_confirmed_at
     WHERE ti.id IN (
       SELECT ri.task_item_id FROM principal_weekly_remit_items ri
        WHERE ri.remit_id = v_remit_id
     )
       AND ti.company_received_at IS NULL
    RETURNING ti.id
  )
  SELECT count(*) INTO v_stamped_count FROM stamped;

  RAISE NOTICE '[backfill 7_13] remit_id=% snapshot_inserted=% missing=% stamped=% snapshot_item_count=53',
    v_remit_id, v_snapshot_count, v_missing_count, v_stamped_count;
END $$;

-- ============================================================================
-- 검증 SQL (COMMIT 전 실행)
-- ============================================================================
--
-- [1] 스냅샷 대조
-- SELECT
--   count(*) AS cnt,
--   sum(company_receive_amount) AS sum_recv,
--   sum(CASE WHEN is_carryover THEN 1 ELSE 0 END) AS carry_cnt
--   FROM principal_weekly_remit_items
--  WHERE remit_id = (
--    SELECT id FROM principal_weekly_remittances
--     WHERE principal_id = (SELECT id FROM principals WHERE code='usol_n')
--       AND week_start = DATE '2026-07-06'
--  );
-- 기대: cnt=? sum_recv=2,865,597 carry_cnt=39
--
-- [2] snapshot_item_count 확인
-- SELECT snapshot_item_count FROM principal_weekly_remittances
--  WHERE principal_id = (SELECT id FROM principals WHERE code='usol_n')
--    AND week_start = DATE '2026-07-06';
-- 기대: 53
--
-- [3] 스탬프 확인 — 이월 소멸 검증 (다음 미확정 주차 이월 재계산)
-- WITH usoln AS (SELECT id AS pid FROM principals WHERE code='usol_n')
-- SELECT count(*), sum(ti.subtotal)
--   FROM task_items ti JOIN tasks t ON ti.task_id = t.id
--  WHERE t.principal_id = (SELECT pid FROM usoln)
--    AND t.status = '완료'
--    AND ti.naver_settled_at IS NOT NULL
--    AND ti.company_received_at IS NULL
--    AND (ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date <= DATE '2026-07-12'
--    AND COALESCE(ti.is_canceled, false) = false
--    AND ti.subtotal > 0
--    AND EXISTS (SELECT 1 FROM payments p WHERE p.task_id = t.id AND p.track = 'B');
-- 기대: 매칭 실패분 (v_missing_count) 근접. 0 이면 완전 소멸.

-- 이상 없으면:
COMMIT;
-- 문제 시:
-- ROLLBACK;
