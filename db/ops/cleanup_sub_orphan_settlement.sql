-- ============================================================================
-- 협력사 정산의 "주인 없는 기록" 정리 (지운 시험 작업이 남긴 기사 보고 · 일일 정산 · 원청 송금 줄)
-- 작성 2026-10-07 · 실행은 사장님 · 먼저 db/ops/check_sub_settlement_window.sql 결과를 확인한 뒤에
--
-- 왜 필요한가
--   작업을 지워도 그 작업으로 만들어졌던 "기사 -> 협력사 보고(받음)" 기록이 남아 있으면 그 날짜가 잠긴 채로 남는다.
--   그 날짜에 새 작업이 완료되면, 기사 화면에는 예전 금액(받음)만 보이고 새 금액의 [보냄] 이 나오지 않는다
--   (차액은 다음 보낼 날로 넘어가는데, 다음 날 작업이 없으면 화면에 나타나지 않는다).
--
-- 지우는 것 (그 협력사 · 그 기간만)
--   A. 기사 보고 기록 : 그 기록이 가리키던 작업이 지금 하나도 없는 것
--        = 그 기사가 그 날짜에 "보고 시각 이전에 완료한" 작업이 현재 0건
--        (보고 뒤에 완료된 작업만 있는 경우 포함 - 그 보고는 그 작업의 것이 아니다)
--      + 그 기록에 묶여 닫힌 이월 날짜 기록(carried_to 가 그 날짜인 것)
--   B. 일일 정산 일자 : 정산 줄이 하나도 없는 것 (+ 그 날짜의 처리 기록 · 가계부 수수료 입금 줄)
--   C. 원청 송금 줄   : 작업 줄이 하나도 없고 넘겨받은 금액도 0 인 것 (+ 가계부 원청 송금 출금 줄)
--
-- 건드리지 않는 것
--   · 보고 시각 이전에 완료한 작업이 하나라도 남아 있는 기사 보고 기록 (실제 보고일 수 있음 - "유지" 로 표시)
--   · 작업 · 결제 · 정산 줄 자체, 다른 협력사, 기간 밖
--
-- 쓰는 법 - 파일 전체를 한 번에 실행합니다.
--   1) [입력] 실행 = false -> 마지막 표가 "미리 보기" (아무것도 지우지 않음)
--   2) 결과 확인 (지울 줄 / 유지할 줄)
--   3) [입력] 실행 = true  -> 정리하고, 마지막 표가 "9 확인"
--
-- 안전장치 - 하나라도 해당하면 아무것도 지우지 않고 멈춥니다 (한 묶음이라 중간 오류도 전부 취소)
--   (a) 지울 기사 보고 기록이 [입력] 상한(기본 10건)을 넘음
--   (b) 지울 원청 송금 줄이 이미 "송금 완료" 상태 (먼저 화면에서 [되돌리기])
--   (c) 지울 일일 정산 일자에 보고 금액이 있는데 실행 허용(allow_reported)이 false
--       (시험 때 송금 보고까지 눌렀던 날짜면 true 로 바꿔 실행)
-- 지우기 전에 대상 행을 _backup_orphan_<표이름> 표에 복사합니다 (앱에서는 읽을 수 없게 잠금).
-- ============================================================================

DROP TABLE IF EXISTS _result;

BEGIN;

CREATE TEMP TABLE _in (sub_code text, d1 date, d2 date, run boolean, max_rows int, allow_reported boolean) ON COMMIT DROP;
CREATE TEMP TABLE _out (grp text, target text, d date, amount int, note text) ON COMMIT DROP;

-- ▼▼▼ [입력] 협력사 코드 / 시작일 / 끝일 / 실행(false = 미리 보기) / 상한 / 보고 금액 있는 일자도 지움 ▼▼▼
INSERT INTO _in VALUES ('whitecore', DATE '2026-10-06', DATE '2026-10-08', false, 10, false);
-- ▲▲▲ [입력] 끝 ▲▲▲

DO $$
DECLARE
  c_tag   CONSTANT text := '_backup_orphan_';
  v_in    record;
  v_sub   uuid;
  v_rem   uuid[];
  v_days  uuid[];
  v_pr    uuid[];
  v_bad   text;
  r       record;
  n_rem int := 0; n_day int := 0; n_evt int := 0; n_cash int := 0; n_pr int := 0;
BEGIN
  SELECT * INTO v_in FROM _in LIMIT 1;
  SELECT id INTO v_sub FROM subcontractors WHERE code = v_in.sub_code;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION '협력사 코드 % 를 찾지 못했습니다. 아무것도 하지 않았습니다.', v_in.sub_code;
  END IF;

  -- A. 기사 보고 기록
  SELECT COALESCE(array_agg(m.id), ARRAY[]::uuid[]) INTO v_rem
    FROM subcontractor_staff_remits m
   WHERE m.subcontractor_id = v_sub AND m.settle_date BETWEEN v_in.d1 AND v_in.d2
     AND m.carried_to IS NULL
     AND NOT EXISTS (SELECT 1 FROM tasks t
                      WHERE t.subcontractor_id = m.subcontractor_id AND t.assigned_engineer_id = m.engineer_id
                        AND t.status = '완료' AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date = m.settle_date
                        AND t.completed_at <= m.reported_at);
  -- 그 기록에 묶여 닫힌 이월 날짜 기록도 함께
  SELECT v_rem || COALESCE(array_agg(c.id), ARRAY[]::uuid[]) INTO v_rem
    FROM subcontractor_staff_remits c
    JOIN subcontractor_staff_remits m ON m.id = ANY (v_rem)
     AND c.subcontractor_id = m.subcontractor_id AND c.engineer_id = m.engineer_id AND c.carried_to = m.settle_date;

  INSERT INTO _out
  SELECT CASE WHEN m.id = ANY (v_rem) THEN '1 지울 기사 보고' ELSE '1 유지할 기사 보고' END,
         COALESCE((SELECT u.name FROM users u WHERE u.id = m.engineer_id), '?'), m.settle_date, m.amount,
         CASE WHEN m.carried_to IS NOT NULL THEN '이월 -> ' || m.carried_to::text
              WHEN m.received_at IS NOT NULL THEN '받음' ELSE '보냄' END
           || ' · 보고 당시 ' || m.calc_own || ' / 지금 ' || (SELECT o.own FROM _sub_staff_own(m.subcontractor_id, m.engineer_id, m.settle_date) o)
    FROM subcontractor_staff_remits m
   WHERE m.subcontractor_id = v_sub AND m.settle_date BETWEEN v_in.d1 AND v_in.d2;

  -- B. 줄이 없는 일일 정산 일자
  SELECT COALESCE(array_agg(d.id), ARRAY[]::uuid[]) INTO v_days
    FROM subcontractor_daily_settlements d
   WHERE d.subcontractor_id = v_sub AND d.settle_date BETWEEN v_in.d1 AND v_in.d2
     AND NOT EXISTS (SELECT 1 FROM subcontractor_settlement_lines l
                      WHERE l.subcontractor_id = d.subcontractor_id AND l.settle_date = d.settle_date);
  INSERT INTO _out
  SELECT '2 지울 일일 정산 일자', to_char(d.settle_date, 'MM/DD'), d.settle_date, COALESCE(d.reported_amount, d.calc_fee),
         '줄 0개 · ' || CASE WHEN d.confirmed_at IS NOT NULL THEN '입금 확인됨' WHEN d.reported_at IS NOT NULL THEN '송금 보고됨' ELSE '잠김' END
    FROM subcontractor_daily_settlements d WHERE d.id = ANY (v_days);

  -- C. 작업 줄이 없는 원청 송금 줄
  SELECT COALESCE(array_agg(pr.id), ARRAY[]::uuid[]) INTO v_pr
    FROM principal_remits pr
   WHERE pr.subcontractor_id = v_sub AND pr.settle_date BETWEEN v_in.d1 AND v_in.d2
     AND pr.carried_in = 0
     AND NOT EXISTS (SELECT 1 FROM principal_remit_lines pl WHERE pl.remit_id = pr.id);
  INSERT INTO _out
  SELECT '3 지울 원청 송금 줄', to_char(pr.settle_date, 'MM/DD'), pr.settle_date, pr.amount,
         '작업 줄 0개 · ' || CASE WHEN pr.paid_at IS NOT NULL THEN '송금 완료' ELSE '미송금' END
    FROM principal_remits pr WHERE pr.id = ANY (v_pr);

  IF NOT COALESCE(v_in.run, false) THEN
    INSERT INTO _out VALUES ('9 안내', '미리 보기', NULL,
      COALESCE(array_length(v_rem, 1), 0) + COALESCE(array_length(v_days, 1), 0) + COALESCE(array_length(v_pr, 1), 0),
      '아무것도 지우지 않았습니다. 정리하려면 [입력] 실행을 true 로 바꿔 다시 실행해 주세요.');
    RETURN;
  END IF;

  -- ── 여기부터 정리 ──
  IF COALESCE(array_length(v_rem, 1), 0) > v_in.max_rows THEN
    RAISE EXCEPTION '지울 기사 보고 기록이 %건으로 상한(%건)을 넘습니다. 기간을 확인해 주세요. 아무것도 지우지 않았습니다.', array_length(v_rem, 1), v_in.max_rows;
  END IF;
  SELECT string_agg(to_char(pr.settle_date, 'MM/DD'), ', ') INTO v_bad FROM principal_remits pr WHERE pr.id = ANY (v_pr) AND pr.paid_at IS NOT NULL;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '지울 원청 송금 줄 가운데 송금 완료 상태가 있습니다 (%). 화면에서 [되돌리기] 한 뒤 다시 실행해 주세요. 아무것도 지우지 않았습니다.', v_bad;
  END IF;
  IF NOT COALESCE(v_in.allow_reported, false) THEN
    SELECT string_agg(to_char(d.settle_date, 'MM/DD'), ', ') INTO v_bad
      FROM subcontractor_daily_settlements d WHERE d.id = ANY (v_days) AND COALESCE(d.reported_amount, 0) <> 0;
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION '지울 일일 정산 일자에 보고 금액이 있습니다 (%). 시험 때 누른 보고가 맞으면 [입력] 의 마지막 값을 true 로 바꿔 실행해 주세요. 아무것도 지우지 않았습니다.', v_bad;
    END IF;
  END IF;

  -- 복사해 두기
  FOR r IN SELECT * FROM (VALUES
      ('subcontractor_staff_remits',      'id = ANY ($1)'),
      ('subcontractor_daily_settlements', 'id = ANY ($2)'),
      ('principal_remits',                'id = ANY ($3)')
    ) AS x(name, cond)
  LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM %I WHERE false', c_tag || r.name, r.name);
    EXECUTE format('INSERT INTO %I SELECT * FROM %I WHERE %s', c_tag || r.name, r.name, r.cond) USING v_rem, v_days, v_pr;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', c_tag || r.name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', c_tag || r.name);
  END LOOP;

  DELETE FROM bookkeeping_cashflow WHERE (source IN ('sub_fee', 'sub_refund') AND source_ref = ANY (v_days))
                                      OR (source = 'principal_fee' AND source_ref = ANY (v_pr));
  GET DIAGNOSTICS n_cash = ROW_COUNT;
  DELETE FROM principal_remits WHERE id = ANY (v_pr);
  GET DIAGNOSTICS n_pr = ROW_COUNT;
  DELETE FROM subcontractor_settlement_events e
   WHERE e.subcontractor_id = v_sub
     AND e.settle_date IN (SELECT d.settle_date FROM subcontractor_daily_settlements d WHERE d.id = ANY (v_days));
  GET DIAGNOSTICS n_evt = ROW_COUNT;
  -- 정산 일자는 정산 줄이 없는 것만 고른 것이라, 지워도 원청 송금 줄 트리거가 만들 줄이 없다
  DELETE FROM subcontractor_daily_settlements WHERE id = ANY (v_days);
  GET DIAGNOSTICS n_day = ROW_COUNT;
  DELETE FROM subcontractor_staff_remits WHERE id = ANY (v_rem);
  GET DIAGNOSTICS n_rem = ROW_COUNT;

  INSERT INTO _out VALUES
    ('9 확인', '지운 기사 보고',      NULL, n_rem,  '복사본: ' || c_tag || 'subcontractor_staff_remits'),
    ('9 확인', '지운 일일 정산 일자', NULL, n_day,  NULL),
    ('9 확인', '지운 처리 기록',      NULL, n_evt,  NULL),
    ('9 확인', '지운 원청 송금 줄',   NULL, n_pr,   NULL),
    ('9 확인', '지운 가계부 줄',      NULL, n_cash, NULL);
END $$;

CREATE TEMP TABLE _result ON COMMIT PRESERVE ROWS AS
SELECT grp AS 구분, target AS 대상, d AS 날짜, amount AS 건수_금액, note AS 내용 FROM _out;

COMMIT;

SELECT * FROM _result ORDER BY 1, 3, 2;
