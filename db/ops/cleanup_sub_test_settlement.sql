-- ============================================================================
-- 협력사 시험 정산 데이터 정리 (다시 쓰는 틀)
-- 작성 2026-10-06 · 실행은 사장님 · 선행: mig 225, 227, 228, 231, 233, 234
--
-- 쓰는 법 - 파일 전체를 한 번에 실행합니다. 맨 위 [입력] 세 곳만 바꿉니다.
--   1) 시험 작업을 앱에서 먼저 "취소" 상태로 만듭니다 (완료 상태로 남아 있으면 정리가 멈춥니다).
--   2) [입력 C] 실행 = false 로 두고 전체 실행 -> 마지막 표가 "미리 보기" 입니다. 아무것도 지우지 않습니다.
--        · "0 후보" 줄: 시험으로 보이는 작업 (고객 전화 010-4887-4002, 또는 고객명·요청 메모·작업 메모에 "테스트")
--                       내용 칸에 [목록에 있음] / [목록에 없음] 이 붙습니다.
--        · "1 ~ 5" 줄: 지워질 정산 줄 / 정산 일자 / 처리 기록 / 가계부 줄 / 기사 보고 기록
--   3) 후보 중 지울 작업번호를 [입력 B] 에 적고 다시 false 로 실행해 지워질 행을 확인합니다.
--   4) [입력 C] 실행 = true 로 바꿔 전체 실행 -> 정리하고, 마지막 표가 "지운 행 + 9 확인" 입니다.
--
-- 지우는 것 (그 협력사 것만)
--   · 정산 줄        : 목록에 적은 작업의 줄
--   · 정산 일자      : 그 줄들이 걸린 날짜 + 그 작업을 완료했던 날짜
--   · 정산 처리 기록 : 같은 날짜
--   · 가계부 현금    : 그 정산 일자에 연결된 협력사 수수료 입금 / 환급 지출 줄
--   · 기사 보고 기록 : 목록 작업의 담당 기사가 그 날짜에 남긴 [보냄]·[받음] 기록 (mig 234)
--
-- 건드리지 않는 것
--   · 작업 자체(취소 상태 그대로)와 그 payments, 회사 몫 %·이력, 다른 날짜, 다른 협력사, 직영·원청 데이터
--
-- 안전장치 - 하나라도 해당하면 아무것도 지우지 않고 멈춥니다 (오류 메시지에 사유)
--   (a) 목록의 작업 중 못 찾은 것, 그 협력사 작업이 아닌 것, 취소 상태가 아닌 것이 있음
--   (b) 지울 날짜의 정산 줄에 목록에 없는 작업이 섞여 있음
--   (c) 지울 날짜에 "완료" 상태로 남아 있는, 목록에 없는 그 협력사 작업이 있음 (실작업일 수 있음)
-- ============================================================================

DROP TABLE IF EXISTS _result;

BEGIN;

CREATE TEMP TABLE _in_sub  (code text)    ON COMMIT DROP;
CREATE TEMP TABLE _in_task (task_no text) ON COMMIT DROP;
CREATE TEMP TABLE _in_mode (run boolean)  ON COMMIT DROP;
CREATE TEMP TABLE _out (grp text, target text, d date, amount int, note text) ON COMMIT DROP;

-- ▼▼▼ [입력 A] 협력사 코드 ▼▼▼
INSERT INTO _in_sub VALUES ('whitecore');

-- ▼▼▼ [입력 B] 지울 시험 작업번호 (미리 보기의 "0 후보" 를 보고 채웁니다) ▼▼▼
INSERT INTO _in_task VALUES
  ('A-000000-000');          -- 예시 줄. 실제 작업번호로 바꾸고, 여러 건이면 줄을 추가: ('A-261006-014'), ('A-261006-015');

-- ▼▼▼ [입력 C] 실행 여부: false = 미리 보기만 / true = 정리 ▼▼▼
INSERT INTO _in_mode VALUES (false);
-- ▲▲▲ [입력] 끝 ▲▲▲

DO $$
DECLARE
  v_sub    uuid;
  v_run    boolean;
  v_tests  uuid[];
  v_dates  date[];
  v_days   uuid[];
  v_engs   uuid[];
  v_remits uuid[];
  n_remit  int := 0;
  v_bad    text;
  n_cash   int := 0;
  n_event  int := 0;
  n_line   int := 0;
  n_day    int := 0;
BEGIN
  SELECT s.id INTO v_sub FROM subcontractors s JOIN _in_sub i ON i.code = s.code;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION '협력사 코드를 찾지 못했습니다. [입력 A] 를 확인해 주세요.';
  END IF;
  SELECT run INTO v_run FROM _in_mode LIMIT 1;

  -- 0 후보: 시험으로 보이는 그 협력사 작업
  INSERT INTO _out
  SELECT '0 후보', t.task_no,
         (COALESCE(t.completed_at, t.scheduled_at, t.received_at) AT TIME ZONE 'Asia/Seoul')::date,
         COALESCE(t.received_total, 0)::int,
         t.status || ' · ' || t.customer_name
           || CASE WHEN EXISTS (SELECT 1 FROM _in_task i WHERE i.task_no = t.task_no) THEN ' [목록에 있음]' ELSE ' [목록에 없음]' END
    FROM tasks t
   WHERE t.subcontractor_id = v_sub
     AND (   regexp_replace(COALESCE(t.phone, ''), '[^0-9]', '', 'g') = '01048874002'
          OR t.customer_name ILIKE '%테스트%'
          OR COALESCE(t.request_note, '') ILIKE '%테스트%'
          OR COALESCE(t.work_memo, '') ILIKE '%테스트%'
          OR EXISTS (SELECT 1 FROM _in_task i WHERE i.task_no = t.task_no));

  SELECT COALESCE(array_agg(t.id), ARRAY[]::uuid[]) INTO v_tests
    FROM tasks t JOIN _in_task i ON i.task_no = t.task_no
   WHERE t.subcontractor_id = v_sub
      OR EXISTS (SELECT 1 FROM subcontractor_settlement_lines l WHERE l.task_id = t.id AND l.subcontractor_id = v_sub);

  -- 지울 날짜: 그 작업의 줄이 걸린 날짜 + 원래 날짜 + 완료했던 날짜
  SELECT COALESCE(array_agg(DISTINCT x.d), ARRAY[]::date[]) INTO v_dates FROM (
    SELECT l.settle_date AS d FROM subcontractor_settlement_lines l
     WHERE l.subcontractor_id = v_sub AND l.task_id = ANY (v_tests)
    UNION
    SELECT l.origin_date FROM subcontractor_settlement_lines l
     WHERE l.subcontractor_id = v_sub AND l.task_id = ANY (v_tests) AND l.origin_date IS NOT NULL
    UNION
    SELECT (t.completed_at AT TIME ZONE 'Asia/Seoul')::date FROM tasks t
     WHERE t.id = ANY (v_tests) AND t.completed_at IS NOT NULL
  ) x;

  SELECT COALESCE(array_agg(s.id), ARRAY[]::uuid[]) INTO v_days
    FROM subcontractor_daily_settlements s
   WHERE s.subcontractor_id = v_sub AND s.settle_date = ANY (v_dates);

  -- 기사 보고 기록: 목록 작업의 담당 기사(작업·정산 줄 기준)가 지울 날짜에 남긴 것 + 그 날짜에 묶여 닫힌 것
  SELECT COALESCE(array_agg(DISTINCT x.e), ARRAY[]::uuid[]) INTO v_engs FROM (
    SELECT t.assigned_engineer_id AS e FROM tasks t WHERE t.id = ANY (v_tests) AND t.assigned_engineer_id IS NOT NULL
    UNION
    SELECT l.engineer_id FROM subcontractor_settlement_lines l
     WHERE l.subcontractor_id = v_sub AND l.task_id = ANY (v_tests) AND l.engineer_id IS NOT NULL
  ) x;
  SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[]) INTO v_remits
    FROM subcontractor_staff_remits r
   WHERE r.subcontractor_id = v_sub AND r.engineer_id = ANY (v_engs)
     AND (r.settle_date = ANY (v_dates) OR r.carried_to = ANY (v_dates));

  -- 1 ~ 5: 지워질 행
  INSERT INTO _out
  SELECT '1 정산 줄', COALESCE(t.task_no, l.task_id::text), l.settle_date, l.fee,
         l.kind || COALESCE(' · 원래 ' || l.origin_date::text, '') || COALESCE(' · ' || l.memo, '')
    FROM subcontractor_settlement_lines l LEFT JOIN tasks t ON t.id = l.task_id
   WHERE l.subcontractor_id = v_sub AND l.task_id = ANY (v_tests);

  INSERT INTO _out
  SELECT '2 정산 일자', '계산 ' || s.calc_fee || ' / 보고 ' || COALESCE(s.reported_amount::text, '-'), s.settle_date, s.calc_fee,
         CASE WHEN s.refunded_at IS NOT NULL THEN '환급 완료' WHEN s.confirmed_at IS NOT NULL THEN '확인 완료'
              WHEN s.reported_at IS NOT NULL THEN '보고됨' ELSE '열림' END
    FROM subcontractor_daily_settlements s WHERE s.id = ANY (v_days);

  INSERT INTO _out
  SELECT '3 처리 기록', e.event, e.settle_date, e.amount, COALESCE(e.actor_name, '') || ' · ' || COALESCE(e.reason, '')
    FROM subcontractor_settlement_events e
   WHERE e.subcontractor_id = v_sub AND e.settle_date = ANY (v_dates);

  INSERT INTO _out
  SELECT '4 가계부', c.source || ' · ' || c.direction, c.flow_date, c.amount::int, c.memo
    FROM bookkeeping_cashflow c
   WHERE c.source IN ('sub_fee', 'sub_refund') AND c.source_ref = ANY (v_days);

  INSERT INTO _out
  SELECT '5 기사 보고', COALESCE(u.name, r.engineer_id::text), r.settle_date, r.amount,
         CASE WHEN r.carried_to IS NOT NULL THEN '이월(' || r.carried_to::text || ' 보고에 포함)'
              WHEN r.received_at IS NOT NULL THEN '받음' ELSE '보고됨' END || COALESCE(' · ' || r.note, '')
    FROM subcontractor_staff_remits r LEFT JOIN users u ON u.id = r.engineer_id
   WHERE r.id = ANY (v_remits);

  IF NOT COALESCE(v_run, false) THEN
    INSERT INTO _out VALUES ('9 안내', '미리 보기', NULL, NULL, '아무것도 지우지 않았습니다. 정리하려면 [입력 C] 를 true 로 바꿔 다시 실행해 주세요.');
    RETURN;
  END IF;

  -- ── 여기부터 정리 ──
  -- (a) 목록 확인
  SELECT string_agg(i.task_no, ', ') INTO v_bad
    FROM _in_task i
   WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.task_no = i.task_no AND t.id = ANY (v_tests));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '목록에서 찾지 못했거나 이 협력사 작업이 아닌 번호가 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;
  SELECT string_agg(t.task_no || ' (' || t.status || ')', ', ') INTO v_bad
    FROM tasks t WHERE t.id = ANY (v_tests) AND t.status <> '취소';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '취소 상태가 아닌 작업이 있습니다: %. 앱에서 먼저 취소한 뒤 다시 실행해 주세요. 아무것도 지우지 않았습니다.', v_bad;
  END IF;

  -- (b) 지울 날짜의 정산 줄에 목록에 없는 작업이 있으면 중단
  SELECT string_agg(DISTINCT COALESCE(t.task_no, l.task_id::text) || ' (' || l.settle_date::text || ')', ', ') INTO v_bad
    FROM subcontractor_settlement_lines l LEFT JOIN tasks t ON t.id = l.task_id
   WHERE l.subcontractor_id = v_sub AND l.settle_date = ANY (v_dates) AND NOT (l.task_id = ANY (v_tests));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '지울 날짜의 정산 줄에 목록에 없는 작업이 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;

  -- (c) 지울 날짜에 완료 상태로 남은, 목록에 없는 작업이 있으면 중단
  SELECT string_agg(t.task_no, ', ') INTO v_bad
    FROM tasks t
   WHERE t.subcontractor_id = v_sub AND t.status = '완료' AND t.completed_at IS NOT NULL
     AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date = ANY (v_dates)
     AND NOT (t.id = ANY (v_tests));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '지울 날짜에 완료 상태인 다른 작업이 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;

  DELETE FROM bookkeeping_cashflow WHERE source IN ('sub_fee', 'sub_refund') AND source_ref = ANY (v_days);
  GET DIAGNOSTICS n_cash = ROW_COUNT;
  DELETE FROM subcontractor_settlement_events WHERE subcontractor_id = v_sub AND settle_date = ANY (v_dates);
  GET DIAGNOSTICS n_event = ROW_COUNT;
  DELETE FROM subcontractor_settlement_lines WHERE subcontractor_id = v_sub AND task_id = ANY (v_tests);
  GET DIAGNOSTICS n_line = ROW_COUNT;
  DELETE FROM subcontractor_daily_settlements WHERE id = ANY (v_days);
  GET DIAGNOSTICS n_day = ROW_COUNT;
  DELETE FROM subcontractor_staff_remits WHERE id = ANY (v_remits);
  GET DIAGNOSTICS n_remit = ROW_COUNT;

  INSERT INTO _out VALUES
    ('9 확인', '지운 가계부 줄',   NULL, n_cash,  NULL),
    ('9 확인', '지운 처리 기록',   NULL, n_event, NULL),
    ('9 확인', '지운 정산 줄',     NULL, n_line,  NULL),
    ('9 확인', '지운 정산 일자',   NULL, n_day,   NULL),
    ('9 확인', '지운 기사 보고',   NULL, n_remit, NULL),
    ('9 확인', '남은 기사 보고',   NULL, (SELECT COUNT(*)::int FROM subcontractor_staff_remits WHERE subcontractor_id = v_sub), '시험만 있었다면 0'),
    ('9 확인', '남은 정산 줄',     NULL, (SELECT COUNT(*)::int FROM subcontractor_settlement_lines  WHERE subcontractor_id = v_sub), '시험만 있었다면 0'),
    ('9 확인', '남은 정산 일자',   NULL, (SELECT COUNT(*)::int FROM subcontractor_daily_settlements WHERE subcontractor_id = v_sub), '시험만 있었다면 0'),
    ('9 확인', '열린 날짜',        NULL, (SELECT COUNT(*)::int FROM _sub_open_plan(v_sub)), '시험만 있었다면 0'),
    ('9 확인', '이월(음수) 날짜',  NULL, (SELECT COUNT(*)::int FROM _sub_open_plan(v_sub) pl WHERE pl.total < 0), '기대 0'),
    ('9 확인', '회사 몫 %',        NULL, _sub_cut_pct_on(v_sub, (now() AT TIME ZONE 'Asia/Seoul')::date), '바뀌지 않음'),
    ('9 확인', '회사 몫 이력 줄수', NULL, (SELECT COUNT(*)::int FROM subcontractor_cut_rates WHERE subcontractor_id = v_sub), '바뀌지 않음');
END $$;

-- 마지막 표: 미리 보기(false) 또는 지운 행 + 확인(true)
CREATE TEMP TABLE _result ON COMMIT PRESERVE ROWS AS
SELECT grp AS 구분, target AS 대상, d AS 날짜, amount AS 금액, note AS 내용 FROM _out;

COMMIT;

SELECT * FROM _result ORDER BY 1, 3, 2;
