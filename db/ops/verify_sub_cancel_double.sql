-- ============================================================================
-- 검증 - 날짜 보고 취소(mig 227) 때 수수료가 두 번 잡히는가
-- 작성 2026-10-07 · 데이터는 바뀌지 않습니다 (안쪽 블록을 통째로 되돌립니다)
--
-- 무엇을 하나
--   실제 완료된 협력사 작업 1건을 골라, 되돌릴 수 있는 블록 안에서 아래 순서를 흉내 냅니다.
--     A. 그 작업의 완료 날짜를 "이미 보고(잠금)" 상태로 만든다 (그 작업은 아직 줄이 없는 상태)
--     B. 줄 맞추기(_sub_settle_sync_task) -> 다음 열린 날짜에 추가 줄이 생긴다
--     C. 날짜 보고 취소 (227 의 본문과 같은 동작: 보고 해제 + 그 날짜 본 금액 줄 삭제 + 줄 맞추기)
--     D. 수정안 (mig 253 과 같은 동작: 그 날짜 때문에 생긴 열린 추가 줄을 다시 맞추기)
--   단계마다 "그 작업이 정산에 잡힌 금액 합계" 를 적고, 끝에 전부 되돌립니다.
--
--   운영자 함수(admin_cancel_sub_daily_report)는 로그인 확인이 있어 SQL Editor 에서 직접 부를 수 없습니다.
--   그래서 C 는 227 본문의 동작을 그대로 옮겨 적은 것입니다.
--
-- [입력] 작업을 직접 고르려면 아래 '' 안에 작업번호를 넣습니다. 비워 두면 가장 최근 것을 고릅니다.
--        (완료 날짜가 이미 입금 확인·환급 처리된 작업은 고를 수 없습니다)
--
-- 결과 읽는 법
--   "3 보고 취소 뒤" 의 합계 > "0 실제 수수료"  -> 재현됨 (두 번 잡힘). mig 253 을 실행하세요.
--   "3 보고 취소 뒤" 의 합계 = "0 실제 수수료"  -> 재현 안 됨. 253 은 실행하지 않습니다.
--   "4 수정안 적용 뒤" 의 합계 = "0 실제 수수료" 여야 수정안이 맞는 것입니다.
--   마지막 줄 "9 되돌림 확인" 의 값이 0 이어야 합니다 (남은 시험 기록 없음).
-- ============================================================================

DROP TABLE IF EXISTS _verify_cancel_out;
CREATE TEMP TABLE _verify_cancel_out (step text, amount int, note text);

DO $$
DECLARE
  c_task_no CONSTANT text := '';          -- [입력] 작업번호 (비우면 자동)
  v_task  tasks%ROWTYPE;
  v_sub   uuid;
  v_d     date;
  v_fee   int;
  v_n1 int; v_n2 int; v_n3 int; v_n4 int;
  v_t2 text; v_t3 text; v_t4 text;
  v_x     uuid;
  v_msg   text;
  v_left  int;
BEGIN
  SELECT t.* INTO v_task
    FROM tasks t
    JOIN payments p ON p.task_id = t.id AND p.track = 'S'
   WHERE t.subcontractor_id IS NOT NULL AND t.status = '완료' AND t.completed_at IS NOT NULL
     AND COALESCE(p.owner_amount, 0) > 0
     AND (c_task_no = '' OR t.task_no = c_task_no)
     AND NOT EXISTS (
           SELECT 1 FROM subcontractor_daily_settlements d
            WHERE d.subcontractor_id = t.subcontractor_id
              AND d.settle_date = (t.completed_at AT TIME ZONE 'Asia/Seoul')::date
              AND (d.confirmed_at IS NOT NULL OR d.refunded_at IS NOT NULL))
   ORDER BY t.completed_at DESC
   LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO _verify_cancel_out VALUES ('- 대상 없음', NULL,
      '조건에 맞는 완료 작업이 없습니다 (협력사 작업 · 수수료 > 0 · 완료 날짜가 입금 확인 전).');
    RETURN;
  END IF;

  v_sub := v_task.subcontractor_id;
  v_d   := (v_task.completed_at AT TIME ZONE 'Asia/Seoul')::date;
  SELECT COALESCE(SUM(owner_amount), 0)::int INTO v_fee FROM payments WHERE task_id = v_task.id AND track = 'S';

  -- 여기부터 안쪽 블록: 끝에서 일부러 오류를 내 전부 되돌린다
  BEGIN
    -- A. 완료 날짜를 "보고됨(잠금)" 으로, 이 작업은 줄이 없는 상태로
    DELETE FROM subcontractor_settlement_lines WHERE task_id = v_task.id;
    INSERT INTO subcontractor_daily_settlements
      (tenant_id, subcontractor_id, settle_date, calc_fee, calc_received, task_count, reported_amount, reported_at)
    VALUES (v_task.tenant_id, v_sub, v_d, 0, 0, 0, 0, now())
    ON CONFLICT (subcontractor_id, settle_date) DO UPDATE SET reported_amount = 0, reported_at = now();

    SELECT COALESCE(SUM(l.fee), 0)::int INTO v_n1
      FROM subcontractor_settlement_lines l WHERE l.task_id = v_task.id;

    -- B. 줄 맞추기 -> 다음 열린 날짜에 추가 줄
    PERFORM _sub_settle_sync_task(v_task.id);
    SELECT COALESCE(SUM(l.fee), 0)::int, string_agg(l.kind || ' ' || to_char(l.settle_date, 'MM/DD') || ' ' || l.fee, ', ')
      INTO v_n2, v_t2
      FROM subcontractor_settlement_lines l WHERE l.task_id = v_task.id;

    -- C. 날짜 보고 취소 (mig 227 본문과 같은 동작)
    UPDATE subcontractor_daily_settlements
       SET reported_amount = NULL, reported_at = NULL, reported_by = NULL
     WHERE subcontractor_id = v_sub AND settle_date = v_d;
    FOR v_x IN
      DELETE FROM subcontractor_settlement_lines
       WHERE subcontractor_id = v_sub AND settle_date = v_d AND kind = 'base'
      RETURNING task_id
    LOOP
      PERFORM _sub_settle_sync_task(v_x);
    END LOOP;

    -- 이 작업이 정산에 잡힌 금액 = 열린 날짜들에 실시간으로 보이는 줄 + 저장된 줄
    SELECT COALESCE(SUM(x.fee), 0)::int, string_agg(x.kind || ' ' || to_char(x.dd, 'MM/DD') || ' ' || x.fee, ', ')
      INTO v_n3, v_t3
      FROM (
        SELECT dl.kind, v_d AS dd, dl.fee FROM _sub_day_lines(v_sub, v_d) dl WHERE dl.task_id = v_task.id
        UNION ALL
        SELECT l.kind, l.settle_date, l.fee FROM subcontractor_settlement_lines l
         WHERE l.task_id = v_task.id AND l.settle_date <> v_d
      ) x;

    -- D. 수정안 (mig 253): 이 날짜 때문에 생긴 열린 추가 줄을 다시 맞춘다
    FOR v_x IN
      SELECT DISTINCT a.task_id
        FROM subcontractor_settlement_lines a
       WHERE a.subcontractor_id = v_sub AND a.kind = 'adjust' AND a.origin_date = v_d
         AND NOT _sub_day_locked(a.subcontractor_id, a.settle_date)
         AND NOT EXISTS (SELECT 1 FROM subcontractor_settlement_lines b WHERE b.task_id = a.task_id AND b.kind = 'base')
    LOOP
      PERFORM _sub_settle_sync_task(v_x);
    END LOOP;

    SELECT COALESCE(SUM(x.fee), 0)::int, string_agg(x.kind || ' ' || to_char(x.dd, 'MM/DD') || ' ' || x.fee, ', ')
      INTO v_n4, v_t4
      FROM (
        SELECT dl.kind, v_d AS dd, dl.fee FROM _sub_day_lines(v_sub, v_d) dl WHERE dl.task_id = v_task.id
        UNION ALL
        SELECT l.kind, l.settle_date, l.fee FROM subcontractor_settlement_lines l
         WHERE l.task_id = v_task.id AND l.settle_date <> v_d
      ) x;

    RAISE EXCEPTION 'VERIFY_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;      -- 안쪽 블록의 변경은 여기서 전부 되돌려졌다
  END;

  IF v_msg <> 'VERIFY_ROLLBACK' THEN
    INSERT INTO _verify_cancel_out VALUES ('- 도중 오류', NULL, v_msg || ' (데이터는 되돌려졌습니다)');
    RETURN;
  END IF;

  INSERT INTO _verify_cancel_out VALUES
    ('0 실제 수수료', v_fee, v_task.task_no || ' · 완료 ' || to_char(v_d, 'MM/DD')),
    ('1 잠근 직후 (줄 없음)', v_n1, '0 이어야 함'),
    ('2 줄 맞춘 뒤', v_n2, COALESCE(v_t2, '줄 없음')),
    ('3 보고 취소 뒤', v_n3, COALESCE(v_t3, '줄 없음')
       || CASE WHEN v_n3 > v_fee THEN '  <- 재현됨: 두 번 잡힘' WHEN v_n3 = v_fee THEN '  <- 재현 안 됨' ELSE '  <- 모자람: 확인 필요' END),
    ('4 수정안 적용 뒤', v_n4, COALESCE(v_t4, '줄 없음')
       || CASE WHEN v_n4 = v_fee THEN '  <- 맞음' ELSE '  <- 맞지 않음: 253 실행하지 말 것' END);

  -- 되돌림 확인: 시험으로 만든 "보고 금액 0, 계산 0" 정산 일자가 남아 있지 않아야 한다
  SELECT COUNT(*) INTO v_left
    FROM subcontractor_daily_settlements d
   WHERE d.subcontractor_id = v_sub AND d.settle_date = v_d
     AND d.reported_amount = 0 AND d.calc_fee = 0 AND d.reported_at > now() - interval '1 minute';
  INSERT INTO _verify_cancel_out VALUES ('9 되돌림 확인', v_left, '0 이어야 함');
END $$;

SELECT step AS "단계", amount AS "금액", note AS "내용" FROM _verify_cancel_out ORDER BY step;
