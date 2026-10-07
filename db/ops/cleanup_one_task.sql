-- ============================================================================
-- 작업 1건 정리 (교육용 · 시험용 작업을 흔적 없이 지우기) - 다시 쓰는 틀
-- 작성 2026-10-07 · 실행은 사장님 · 선행: mig 225, 227, 228, 231, 233, 234
--
-- 대상: [입력 A] 에 적은 작업번호 1건
--   · 작업 자체
--   · 그 작업에 딸린 행 전부 (결제 · 작업 항목 · 사진 기록 · 메모 · 변경 이력 등 - tasks 를 가리키는 표를 DB 에서 직접 찾음)
--   · 협력사 작업이었다면 그 작업의 정산 줄, 그리고 "그 작업 때문에 생긴" 정산 기록:
--       그 날짜에 다른 작업이 없을 때  -> 정산 일자 · 처리 기록 · 기사 보고 기록 · 연결된 가계부 줄(sub_fee / sub_refund) 까지 삭제
--       그 날짜에 다른 작업이 섞여 있을 때 -> 이 작업의 줄만 지우고, 잠긴 정산 일자의 계산 값(수수료 · 받은 금액 · 건수)을
--                                             남은 줄로 다시 맞춤. 일자 · 보고 금액 · 가계부 · 기사 보고는 그대로 둠
--                                             (결과 표 "4 주의" 에 날짜가 나옵니다 - 보고 금액과 계산 값이 달라질 수 있음)
--
-- 지우기 전에 대상 행을 전부 _backup_one_<작업번호>_<표이름> 표에 복사합니다 (앱에서는 읽을 수 없게 잠금).
-- 사진 파일 자체(저장소)는 SQL 로 지울 수 없어 기록(photos 행)만 지웁니다.
--
-- 쓰는 법 - 파일 전체를 한 번에 실행합니다.
--   1) [입력 B] 실행 = false -> 마지막 표가 "미리 보기" (아무것도 지우지 않음)
--   2) 결과 확인
--   3) [입력 B] 실행 = true  -> 정리하고, 마지막 표가 "9 확인"
--
-- 안전장치 - 하나라도 해당하면 아무것도 지우지 않고 멈춥니다 (한 묶음이라 중간 오류도 전부 취소)
--   (a) 작업번호로 찾은 작업이 정확히 1건이 아님
--   (b) 교육용 · 시험용으로 보이지 않음 = 실작업일 수 있음
--       (고객명에 "교육" · "테스트" · "시험" 이 없고, 고객 전화도 010-0000-0000 이 아님)
--       실작업을 정말 지워야 하면 [입력 C] 를 true 로 바꿉니다 (보통은 건드리지 않습니다).
--   (c) 그 작업의 정산 줄이 작업의 협력사가 아닌 다른 협력사 이름으로 있음
-- ============================================================================

DROP TABLE IF EXISTS _result;

BEGIN;

CREATE TEMP TABLE _in (task_no text, run boolean, allow_real boolean) ON COMMIT DROP;
CREATE TEMP TABLE _out (grp text, target text, d date, amount int, note text) ON COMMIT DROP;

-- ▼▼▼ [입력 A] 작업번호 / [입력 B] 실행 여부 (false = 미리 보기) / [입력 C] 실작업도 허용 (보통 false) ▼▼▼
INSERT INTO _in VALUES ('A-261007-001', false, false);
-- ▲▲▲ [입력] 끝 ▲▲▲

DO $$
DECLARE
  v_no     text;
  v_run    boolean;
  v_real   boolean;
  v_tag    text;
  v_cnt    int;
  v_task   tasks%ROWTYPE;
  v_id     uuid;
  v_ids    uuid[];
  v_sub    uuid;
  v_eng    uuid;
  v_phone  text;
  v_bad    text;
  v_n      bigint;
  v_solo   date[];      -- 이 작업만 있는 정산 날짜
  v_mixed  date[];      -- 다른 작업이 섞인 정산 날짜
  v_days   uuid[];      -- 지울 정산 일자 id (이 작업만 있는 날짜)
  r        record;
  n_task   int := 0;
  n_line   int := 0;
  n_day    int := 0;
  n_event  int := 0;
  n_remit  int := 0;
  n_cash   int := 0;
BEGIN
  SELECT btrim(task_no), run, allow_real INTO v_no, v_run, v_real FROM _in LIMIT 1;
  v_tag := '_backup_one_' || lower(regexp_replace(v_no, '[^A-Za-z0-9]', '', 'g')) || '_';

  -- (a) 정확히 1건
  SELECT COUNT(*) INTO v_cnt FROM tasks WHERE task_no = v_no;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '작업번호 % 로 찾은 작업이 %건입니다 (1건이어야 함). 아무것도 하지 않았습니다.', v_no, v_cnt;
  END IF;
  SELECT * INTO v_task FROM tasks WHERE task_no = v_no;
  v_id  := v_task.id;
  v_ids := ARRAY[v_id];
  v_sub := v_task.subcontractor_id;
  v_eng := v_task.assigned_engineer_id;
  v_phone := regexp_replace(COALESCE(to_jsonb(v_task) ->> 'customer_phone', to_jsonb(v_task) ->> 'phone', ''), '[^0-9]', '', 'g');

  INSERT INTO _out VALUES ('1 작업', v_task.task_no, NULL, COALESCE(v_task.received_total, 0)::int,
    v_task.status || ' · ' || COALESCE(v_task.customer_name, '')
      || COALESCE(' · 담당 ' || (SELECT name FROM users u WHERE u.id = v_eng), ' · 미배정')
      || COALESCE(' · 협력사 ' || (SELECT name FROM subcontractors s WHERE s.id = v_sub), ' · 직영'));

  -- 딸린 행: tasks 를 가리키는 모든 표
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col, c.confdeltype AS del
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.tasks'::regclass AND array_length(c.conkey, 1) = 1
     ORDER BY 1
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %s WHERE %I = ANY ($1)', r.tbl, r.col) INTO v_n USING v_ids;
    IF v_n > 0 THEN
      INSERT INTO _out VALUES ('2 딸린 행', r.tbl::text || '.' || r.col, NULL, v_n::int,
        CASE r.del WHEN 'c' THEN '작업과 함께 자동 삭제' WHEN 'n' THEN '지우지 않음 (연결만 끊김)' ELSE '먼저 지운 뒤 작업 삭제' END);
    END IF;
  END LOOP;

  -- 정산: 이 작업의 줄이 걸린 날짜를 "이 작업만" / "섞임" 으로 나눈다
  SELECT COALESCE(array_agg(d) FILTER (WHERE NOT mixed), ARRAY[]::date[]),
         COALESCE(array_agg(d) FILTER (WHERE mixed),     ARRAY[]::date[])
    INTO v_solo, v_mixed
    FROM (
      SELECT x.settle_date AS d,
             EXISTS (SELECT 1 FROM subcontractor_settlement_lines o
                      WHERE o.subcontractor_id = x.subcontractor_id AND o.settle_date = x.settle_date AND o.task_id <> v_id) AS mixed
        FROM (SELECT DISTINCT subcontractor_id, settle_date FROM subcontractor_settlement_lines WHERE task_id = v_id) x
    ) q;

  SELECT COALESCE(array_agg(s.id), ARRAY[]::uuid[]) INTO v_days
    FROM subcontractor_daily_settlements s
   WHERE s.subcontractor_id = v_sub AND s.settle_date = ANY (v_solo);

  INSERT INTO _out
  SELECT '3 정산', '정산 줄 (' || l.kind || ')', l.settle_date, l.fee, '받은 금액 ' || l.received
    FROM subcontractor_settlement_lines l WHERE l.task_id = v_id;
  INSERT INTO _out
  SELECT '3 정산', '정산 일자 (이 작업만 있는 날 - 삭제)', s.settle_date, COALESCE(s.reported_amount, s.calc_fee),
         CASE WHEN s.confirmed_at IS NOT NULL THEN '입금 확인됨' WHEN s.reported_at IS NOT NULL THEN '송금 보고됨' ELSE '잠김' END
    FROM subcontractor_daily_settlements s WHERE s.id = ANY (v_days);
  INSERT INTO _out VALUES
    ('3 정산', '처리 기록', NULL, (SELECT COUNT(*)::int FROM subcontractor_settlement_events e
        WHERE e.subcontractor_id = v_sub AND e.settle_date = ANY (v_solo)), NULL),
    ('3 정산', '기사 보고 기록', NULL, (SELECT COUNT(*)::int FROM subcontractor_staff_remits m
        WHERE m.subcontractor_id = v_sub AND m.settle_date = ANY (v_solo)), NULL),
    ('3 정산', '가계부 줄 (sub_fee / sub_refund)', NULL, (SELECT COUNT(*)::int FROM bookkeeping_cashflow c
        WHERE c.source IN ('sub_fee', 'sub_refund') AND c.source_ref = ANY (v_days)), NULL);
  INSERT INTO _out
  SELECT '4 주의', '다른 작업이 섞인 날짜 - 줄만 지우고 계산 값 다시 맞춤', d, NULL,
         '정산 일자 · 보고 금액 · 가계부 · 기사 보고는 그대로 둡니다. 정리 뒤 이 날짜의 금액을 확인해 주세요.'
    FROM unnest(v_mixed) AS d;

  -- (b) 교육용 · 시험용인지
  IF NOT (COALESCE(v_task.customer_name, '') ~ '(교육|테스트|시험)' OR v_phone = '01000000000') THEN
    INSERT INTO _out VALUES ('4 주의', '실작업일 수 있음', NULL, NULL,
      '고객명에 교육 · 테스트 · 시험 이 없고 전화도 010-0000-0000 이 아닙니다. [입력 C] 가 false 면 정리하지 않고 멈춥니다.');
    IF COALESCE(v_run, false) AND NOT COALESCE(v_real, false) THEN
      RAISE EXCEPTION '작업 % (고객 %) 은 교육용 · 시험용으로 보이지 않습니다. 실작업일 수 있어 멈춥니다. 아무것도 지우지 않았습니다.', v_no, v_task.customer_name;
    END IF;
  END IF;

  IF NOT COALESCE(v_run, false) THEN
    INSERT INTO _out VALUES ('9 안내', '미리 보기', NULL, 1,
      '아무것도 지우지 않았습니다. 정리하려면 [입력 B] 를 true 로 바꿔 다시 실행해 주세요.');
    RETURN;
  END IF;

  -- ── 여기부터 정리 ──
  -- (c) 이 작업의 정산 줄이 다른 협력사 이름으로 있으면 중단
  SELECT string_agg(DISTINCT l.subcontractor_id::text, ', ') INTO v_bad
    FROM subcontractor_settlement_lines l
   WHERE l.task_id = v_id AND l.subcontractor_id IS DISTINCT FROM v_sub;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '이 작업의 정산 줄이 다른 협력사에 걸려 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;

  -- ── 복사해 두기 ──
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM tasks WHERE false', v_tag || 'tasks');
  EXECUTE format('INSERT INTO %I SELECT * FROM tasks WHERE id = ANY ($1)', v_tag || 'tasks') USING v_ids;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_tag || 'tasks');
  EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', v_tag || 'tasks');

  FOR r IN
    SELECT DISTINCT c.conrelid::regclass AS tbl, cl.relname AS name, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.tasks'::regclass AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %s WHERE %I = ANY ($1)', r.tbl, r.col) INTO v_n USING v_ids;
    IF v_n > 0 THEN
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM %s WHERE false', v_tag || r.name, r.tbl);
      EXECUTE format('INSERT INTO %I SELECT * FROM %s WHERE %I = ANY ($1)', v_tag || r.name, r.tbl, r.col) USING v_ids;
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_tag || r.name);
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', v_tag || r.name);
    END IF;
  END LOOP;

  IF v_sub IS NOT NULL THEN
    FOR r IN SELECT * FROM (VALUES
        ('subcontractor_daily_settlements', 'subcontractor_id = $1 AND settle_date = ANY ($2)'),
        ('subcontractor_settlement_events', 'subcontractor_id = $1 AND settle_date = ANY ($2)'),
        ('subcontractor_staff_remits',      'subcontractor_id = $1 AND settle_date = ANY ($2)')
      ) AS x(name, cond)
    LOOP
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM %I WHERE false', v_tag || r.name, r.name);
      -- 섞인 날짜의 정산 일자도 (계산 값을 고치므로) 이전 값을 남긴다
      EXECUTE format('INSERT INTO %I SELECT * FROM %I WHERE %s', v_tag || r.name, r.name, r.cond) USING v_sub, v_solo || v_mixed;
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_tag || r.name);
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', v_tag || r.name);
    END LOOP;
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM bookkeeping_cashflow WHERE false', v_tag || 'bookkeeping_cashflow');
    EXECUTE format('INSERT INTO %I SELECT * FROM bookkeeping_cashflow WHERE source IN (''sub_fee'', ''sub_refund'') AND source_ref = ANY ($1)', v_tag || 'bookkeeping_cashflow') USING v_days;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_tag || 'bookkeeping_cashflow');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', v_tag || 'bookkeeping_cashflow');

    -- ── 정산 먼저 지운다 (잠긴 일자가 남아 있으면 결제 행 삭제 때 "조정 줄" 이 새로 생길 수 있다) ──
    DELETE FROM bookkeeping_cashflow WHERE source IN ('sub_fee', 'sub_refund') AND source_ref = ANY (v_days);
    GET DIAGNOSTICS n_cash = ROW_COUNT;
    DELETE FROM subcontractor_settlement_events WHERE subcontractor_id = v_sub AND settle_date = ANY (v_solo);
    GET DIAGNOSTICS n_event = ROW_COUNT;
    DELETE FROM subcontractor_staff_remits WHERE subcontractor_id = v_sub AND settle_date = ANY (v_solo);
    GET DIAGNOSTICS n_remit = ROW_COUNT;
  END IF;

  DELETE FROM subcontractor_settlement_lines WHERE task_id = v_id;
  GET DIAGNOSTICS n_line = ROW_COUNT;

  IF v_sub IS NOT NULL THEN
    DELETE FROM subcontractor_daily_settlements WHERE id = ANY (v_days);
    GET DIAGNOSTICS n_day = ROW_COUNT;
  END IF;

  -- ── 딸린 행 중 "자동 삭제가 아닌 것" 을 먼저 지운다 (연결만 끊기는 표는 그대로 둔다) ──
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.tasks'::regclass AND array_length(c.conkey, 1) = 1
       AND c.confdeltype IN ('a', 'r')
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', r.tbl, r.col) USING v_ids;
  END LOOP;

  -- ── 작업 삭제 ──
  DELETE FROM tasks WHERE id = v_id;
  GET DIAGNOSTICS n_task = ROW_COUNT;

  -- 결제 행이 지워지면서 조정 줄이 새로 생겼다면 그것도 없앤다
  DELETE FROM subcontractor_settlement_lines WHERE task_id = v_id;

  -- ── 섞인 날짜: 잠긴 정산 일자의 계산 값을 남은 줄로 다시 맞춘다 ──
  IF v_sub IS NOT NULL AND COALESCE(array_length(v_mixed, 1), 0) > 0 THEN
    UPDATE subcontractor_daily_settlements s
       SET calc_fee      = COALESCE((SELECT SUM(l.fee) FROM subcontractor_settlement_lines l
                                      WHERE l.subcontractor_id = s.subcontractor_id AND l.settle_date = s.settle_date), 0),
           calc_received = COALESCE((SELECT SUM(l.received) FROM subcontractor_settlement_lines l
                                      WHERE l.subcontractor_id = s.subcontractor_id AND l.settle_date = s.settle_date), 0),
           task_count    = COALESCE((SELECT COUNT(DISTINCT l.task_id) FROM subcontractor_settlement_lines l
                                      WHERE l.subcontractor_id = s.subcontractor_id AND l.settle_date = s.settle_date AND l.kind = 'base'), 0)
     WHERE s.subcontractor_id = v_sub AND s.settle_date = ANY (v_mixed);
  END IF;

  INSERT INTO _out VALUES
    ('9 확인', '지운 작업',        NULL, n_task,  '복사본: ' || v_tag || 'tasks'),
    ('9 확인', '지운 정산 줄',     NULL, n_line,  NULL),
    ('9 확인', '지운 정산 일자',   NULL, n_day,   NULL),
    ('9 확인', '지운 처리 기록',   NULL, n_event, NULL),
    ('9 확인', '지운 기사 보고',   NULL, n_remit, NULL),
    ('9 확인', '지운 가계부 줄',   NULL, n_cash,  NULL),
    ('9 확인', '남은 작업 (이 번호)', NULL, (SELECT COUNT(*)::int FROM tasks WHERE task_no = v_no), '기대 0'),
    ('9 확인', '남은 정산 줄 (이 작업)', NULL, (SELECT COUNT(*)::int FROM subcontractor_settlement_lines WHERE task_id = v_id), '기대 0');
  IF v_sub IS NOT NULL THEN
    INSERT INTO _out VALUES
      ('9 확인', '그 협력사의 열린 정산 날짜', NULL, (SELECT COUNT(*)::int FROM _sub_open_plan(v_sub)), '다른 작업이 없으면 0');
  END IF;
END $$;

-- 마지막 표: 미리 보기(false) 또는 지운 수 + 확인(true)
CREATE TEMP TABLE _result ON COMMIT PRESERVE ROWS AS
SELECT grp AS 구분, target AS 대상, d AS 날짜, amount AS 건수_금액, note AS 내용 FROM _out;

COMMIT;

SELECT * FROM _result ORDER BY 1, 3, 2;
