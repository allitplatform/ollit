-- ad-hoc_2026-07-20_backfill_remit_items_7_6.sql
-- 2026-07-20 — 자동 생성 (scripts/gen-backfill-remit-items-sql.py)
--
-- 소급 대상: 7_6 확정 주차 (usol_n, week_start=2026-06-29, week_end=2026-07-05)
-- 엑셀 소스: 유솔N_주정산_7월 1주차 (1).xlsx
--
-- 엑셀 파싱 결과:
--   · 총 건수: 115 (기대: 115)
--   · 이월 건수: 0 (기대: 0)
--   · Σ ROUND(subtotal × 0.85): 8,187,027 (기대: 8,187,023)
--
-- 처리 (임시 테이블 방식):
--   1. remit_id 조회 (usol_n · week_start · confirmed)
--   2. _excel_rows 임시 테이블에 엑셀 items INSERT
--   3. _matched 임시 테이블 = LEFT JOIN task_items (매칭 성공/실패 함께 보존)
--   4. 매칭 실패 리포트 — FOR 루프로 poid · buyer · subtotal RAISE NOTICE 각 행 출력
--   5. principal_weekly_remit_items INSERT (매칭 성공만)
--   6. snapshot_item_count = 115 UPDATE (매칭 실패해도 사장님 값 유지)
--   7. company_received_at 스탬프 (스냅샷 items 중 NULL만)
--   8. 최종 요약 리포트
--
-- 실행:
--   BEGIN;
--   \i ad-hoc_2026-07-20_backfill_remit_items_7_6.sql
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
     AND week_start = DATE '2026-06-29'
     AND confirmed_at IS NOT NULL;
  IF v_remit_id IS NULL THEN
    RAISE EXCEPTION '2026-06-29 확정 remit row 없음 (미확정 or 없음)';
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
    ('2026060319478441', '곽윤기', 71773, false, NULL::date);

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
     SET snapshot_item_count = 115
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

  RAISE NOTICE '[backfill 7_6] remit_id=% snapshot_inserted=% missing=% stamped=% snapshot_item_count=115',
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
--       AND week_start = DATE '2026-06-29'
--  );
-- 기대: cnt=? sum_recv=8,187,023 carry_cnt=0
--
-- [2] snapshot_item_count 확인
-- SELECT snapshot_item_count FROM principal_weekly_remittances
--  WHERE principal_id = (SELECT id FROM principals WHERE code='usol_n')
--    AND week_start = DATE '2026-06-29';
-- 기대: 115
--
-- [3] 스탬프 확인 — 이월 소멸 검증 (다음 미확정 주차 이월 재계산)
-- WITH usoln AS (SELECT id AS pid FROM principals WHERE code='usol_n')
-- SELECT count(*), sum(ti.subtotal)
--   FROM task_items ti JOIN tasks t ON ti.task_id = t.id
--  WHERE t.principal_id = (SELECT pid FROM usoln)
--    AND t.status = '완료'
--    AND ti.naver_settled_at IS NOT NULL
--    AND ti.company_received_at IS NULL
--    AND (ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date <= DATE '2026-07-05'
--    AND COALESCE(ti.is_canceled, false) = false
--    AND ti.subtotal > 0
--    AND EXISTS (SELECT 1 FROM payments p WHERE p.task_id = t.id AND p.track = 'B');
-- 기대: 매칭 실패분 (v_missing_count) 근접. 0 이면 완전 소멸.

-- 이상 없으면:
COMMIT;
-- 문제 시:
-- ROLLBACK;
