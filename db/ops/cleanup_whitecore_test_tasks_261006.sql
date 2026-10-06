-- ============================================================================
-- 화이트코어 시험 작업 전부 정리 (작업 자체 + 정산 + 딸린 기록)
-- 작성 2026-10-06 · 실행은 사장님 · 선행: mig 225, 227, 228, 231, 233, 234
--
-- 사장님 결정: 실작업은 10/8 시작. 그 전에 만든 화이트코어 작업은 전부 시험 → 목록에서 완전히 없앤다.
--
-- 대상
--   · 화이트코어 작업 중 "접수한 날(한국 시간)이 2026-10-07 이전" 인 것 전부 (완료 · 취소 · 미배정 상관없이)
--   · 그 작업에 딸린 행 전부 (결제 · 작업 항목 · 사진 기록 · 메모 · 변경 이력 등 - tasks 를 가리키는 표를 DB 에서 직접 찾아 처리)
--   · 화이트코어의 2026-10-07 이전 정산: 정산 줄 · 정산 일자 · 처리 기록 · 기사 보고 기록 · 연결된 가계부 줄(sub_fee / sub_refund)
--
-- 작업에 "숨김 / 삭제 표시" 칸은 없습니다(확인함). 그래서 실제로 지웁니다.
-- 지우기 전에 대상 행을 전부 _backup_261006_<표이름> 표에 복사해 둡니다 (앱에서는 읽을 수 없게 잠금).
--
-- 건드리지 않는 것
--   · 10/8 이후 접수한 화이트코어 작업, 다른 협력사 · 직영 · 원청 작업
--   · 화이트코어 기사 계정 · 담당 지역 · 가능 종목 · 회사 몫 %(0%, 이력 1줄) · 수수료 규칙
--   · 사진 파일 자체(저장소) - SQL 로는 지울 수 없어 기록(photos 행)만 지웁니다. 파일은 남습니다.
--
-- 쓰는 법 - 파일 전체를 한 번에 실행합니다. 맨 아래가 아니라 바로 아래 [입력] 한 곳만 바꿉니다.
--   1) 실행 = false 로 전체 실행 -> 마지막 표가 "미리 보기" (아무것도 지우지 않음)
--        "1 작업"   : 지울 작업 (완료 상태는 내용 칸에 [완료] 표시)
--        "2 딸린 행": 표별 건수
--        "3 정산"   : 지울 정산 줄 · 일자 · 처리 기록 · 기사 보고 · 가계부 건수
--   2) 결과를 Claude 와 확인
--   3) 실행 = true 로 바꿔 전체 실행 -> 정리하고, 마지막 표가 "9 확인"
--
-- 안전장치 - 하나라도 해당하면 아무것도 지우지 않고 멈춥니다 (한 묶음이라 중간 오류도 전부 취소)
--   (a) 대상 작업이 0건이거나 40건을 넘음 (예상 5건 안팎 - 범위가 잘못 잡힌 경우를 막음)
--   (b) 화이트코어의 10/7 이전 정산 줄에 대상이 아닌 작업이 섞여 있음
--   (c) 대상 작업의 정산 줄이 다른 협력사 이름으로 있음
--
-- 이 파일로 10/8 아침 정리가 끝납니다. db/ops/cleanup_sub_test_settlement.sql 은 따로 실행하지 않아도 됩니다.
-- ============================================================================

DROP TABLE IF EXISTS _result;

BEGIN;

CREATE TEMP TABLE _in_mode (run boolean) ON COMMIT DROP;
CREATE TEMP TABLE _out (grp text, target text, d date, amount int, note text) ON COMMIT DROP;

-- ▼▼▼ [입력] 실행 여부: false = 미리 보기만 / true = 정리 ▼▼▼
INSERT INTO _in_mode VALUES (false);
-- ▲▲▲ [입력] 끝 ▲▲▲

DO $$
DECLARE
  c_cut   CONSTANT date := DATE '2026-10-07';     -- 이 날짜까지 접수한 작업이 대상 (10/8 부터는 실작업)
  c_tag   CONSTANT text := '_backup_261006_';
  v_sub   uuid;
  v_run   boolean;
  v_ids   uuid[];
  v_days  uuid[];
  v_bad   text;
  v_n     bigint;
  r       record;
  n_task  int := 0;
  n_line  int := 0;
  n_day   int := 0;
  n_event int := 0;
  n_remit int := 0;
  n_cash  int := 0;
BEGIN
  SELECT id INTO v_sub FROM subcontractors WHERE code = 'whitecore';
  IF v_sub IS NULL THEN
    RAISE EXCEPTION '화이트코어 협력사 행이 없습니다. 중단합니다.';
  END IF;
  SELECT run INTO v_run FROM _in_mode LIMIT 1;

  -- 대상 작업: 화이트코어 + 접수일(한국 시간) 이 기준일 이전
  SELECT COALESCE(array_agg(t.id), ARRAY[]::uuid[]) INTO v_ids
    FROM tasks t
   WHERE t.subcontractor_id = v_sub
     AND (COALESCE((to_jsonb(t) ->> 'created_at')::timestamptz, t.received_at) AT TIME ZONE 'Asia/Seoul')::date <= c_cut;

  INSERT INTO _out
  SELECT '1 작업', t.task_no,
         (COALESCE((to_jsonb(t) ->> 'created_at')::timestamptz, t.received_at) AT TIME ZONE 'Asia/Seoul')::date,
         COALESCE(t.received_total, 0)::int,
         CASE WHEN t.status = '완료' THEN '[완료] ' ELSE '' END || t.status || ' · ' || t.customer_name
           || COALESCE(' · 담당 ' || (SELECT name FROM users u WHERE u.id = t.assigned_engineer_id), ' · 미배정')
    FROM tasks t WHERE t.id = ANY (v_ids);

  -- 딸린 행: tasks 를 가리키는 모든 표를 DB 에서 찾는다 (외래키 기준)
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conrelid AS tbl_oid, a.attname AS col, c.confdeltype AS del
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.tasks'::regclass AND array_length(c.conkey, 1) = 1
     ORDER BY 1
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %s WHERE %I = ANY ($1)', r.tbl, r.col) INTO v_n USING v_ids;
    INSERT INTO _out VALUES ('2 딸린 행', r.tbl::text || '.' || r.col, NULL, v_n::int,
      CASE r.del WHEN 'c' THEN '작업과 함께 자동 삭제' WHEN 'n' THEN '지우지 않음 (연결만 끊김)' ELSE '먼저 지운 뒤 작업 삭제' END);
  END LOOP;

  -- 정산 쪽 (화이트코어, 기준일 이전 + 대상 작업의 줄)
  SELECT COALESCE(array_agg(s.id), ARRAY[]::uuid[]) INTO v_days
    FROM subcontractor_daily_settlements s
   WHERE s.subcontractor_id = v_sub AND s.settle_date <= c_cut;

  INSERT INTO _out VALUES
    ('3 정산', '정산 줄', NULL, (SELECT COUNT(*)::int FROM subcontractor_settlement_lines l
        WHERE l.subcontractor_id = v_sub AND (l.settle_date <= c_cut OR l.task_id = ANY (v_ids))), NULL),
    ('3 정산', '정산 일자', NULL, COALESCE(array_length(v_days, 1), 0), NULL),
    ('3 정산', '처리 기록', NULL, (SELECT COUNT(*)::int FROM subcontractor_settlement_events e
        WHERE e.subcontractor_id = v_sub AND e.settle_date <= c_cut), NULL),
    ('3 정산', '기사 보고 기록', NULL, (SELECT COUNT(*)::int FROM subcontractor_staff_remits m
        WHERE m.subcontractor_id = v_sub AND m.settle_date <= c_cut), NULL),
    ('3 정산', '가계부 줄 (sub_fee / sub_refund)', NULL, (SELECT COUNT(*)::int FROM bookkeeping_cashflow c
        WHERE c.source IN ('sub_fee', 'sub_refund') AND c.source_ref = ANY (v_days)), NULL);

  IF NOT COALESCE(v_run, false) THEN
    INSERT INTO _out VALUES ('9 안내', '미리 보기', NULL, COALESCE(array_length(v_ids, 1), 0),
      '아무것도 지우지 않았습니다. 정리하려면 [입력] 을 true 로 바꿔 다시 실행해 주세요.');
    RETURN;
  END IF;

  -- ── 여기부터 정리 ──
  -- (a) 범위 확인
  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION '대상 작업이 없습니다. 아무것도 하지 않았습니다.';
  END IF;
  IF array_length(v_ids, 1) > 40 THEN
    RAISE EXCEPTION '대상 작업이 %건입니다 (예상 5건 안팎). 범위를 확인해 주세요. 아무것도 지우지 않았습니다.', array_length(v_ids, 1);
  END IF;

  -- (b) 기준일 이전 정산 줄에 대상이 아닌 작업이 있으면 중단
  SELECT string_agg(DISTINCT COALESCE(t.task_no, l.task_id::text) || ' (' || l.settle_date::text || ')', ', ') INTO v_bad
    FROM subcontractor_settlement_lines l LEFT JOIN tasks t ON t.id = l.task_id
   WHERE l.subcontractor_id = v_sub AND l.settle_date <= c_cut AND NOT (l.task_id = ANY (v_ids));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '10/7 이전 정산 줄에 대상이 아닌 작업이 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;

  -- (c) 대상 작업의 정산 줄이 다른 협력사 이름으로 있으면 중단
  SELECT string_agg(DISTINCT l.subcontractor_id::text, ', ') INTO v_bad
    FROM subcontractor_settlement_lines l
   WHERE l.task_id = ANY (v_ids) AND l.subcontractor_id IS DISTINCT FROM v_sub;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '대상 작업의 정산 줄이 다른 협력사에 걸려 있습니다: %. 아무것도 지우지 않고 중단합니다.', v_bad;
  END IF;

  -- ── 복사해 두기 (_backup_261006_<표>) : 작업 · 딸린 행 · 정산 ──
  --   복사본은 앱(anon)이 읽을 수 없게 잠급니다.
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM tasks WHERE false', c_tag || 'tasks');
  EXECUTE format('INSERT INTO %I SELECT * FROM tasks WHERE id = ANY ($1)', c_tag || 'tasks') USING v_ids;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', c_tag || 'tasks');
  EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', c_tag || 'tasks');

  FOR r IN
    SELECT DISTINCT c.conrelid::regclass AS tbl, cl.relname AS name, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.tasks'::regclass AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM %s WHERE false', c_tag || r.name, r.tbl);
    EXECUTE format('INSERT INTO %I SELECT * FROM %s WHERE %I = ANY ($1)', c_tag || r.name, r.tbl, r.col) USING v_ids;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', c_tag || r.name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', c_tag || r.name);
  END LOOP;

  FOR r IN SELECT * FROM (VALUES
      ('subcontractor_daily_settlements', 'subcontractor_id = $1 AND settle_date <= $2'),
      ('subcontractor_settlement_events', 'subcontractor_id = $1 AND settle_date <= $2'),
      ('subcontractor_staff_remits',      'subcontractor_id = $1 AND settle_date <= $2')
    ) AS x(name, cond)
  LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM %I WHERE false', c_tag || r.name, r.name);
    EXECUTE format('INSERT INTO %I SELECT * FROM %I WHERE %s', c_tag || r.name, r.name, r.cond) USING v_sub, c_cut;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', c_tag || r.name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', c_tag || r.name);
  END LOOP;
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I AS SELECT * FROM bookkeeping_cashflow WHERE false', c_tag || 'bookkeeping_cashflow');
  EXECUTE format('INSERT INTO %I SELECT * FROM bookkeeping_cashflow WHERE source IN (''sub_fee'', ''sub_refund'') AND source_ref = ANY ($1)', c_tag || 'bookkeeping_cashflow') USING v_days;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', c_tag || 'bookkeeping_cashflow');
  EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', c_tag || 'bookkeeping_cashflow');

  -- ── 정산 먼저 지운다 ──
  --   (잠긴 정산 일자가 남아 있으면, 작업의 결제 행이 지워질 때 "조정 줄" 이 새로 생길 수 있다 → 먼저 없앤다)
  DELETE FROM bookkeeping_cashflow WHERE source IN ('sub_fee', 'sub_refund') AND source_ref = ANY (v_days);
  GET DIAGNOSTICS n_cash = ROW_COUNT;
  DELETE FROM subcontractor_settlement_events WHERE subcontractor_id = v_sub AND settle_date <= c_cut;
  GET DIAGNOSTICS n_event = ROW_COUNT;
  DELETE FROM subcontractor_staff_remits WHERE subcontractor_id = v_sub AND settle_date <= c_cut;
  GET DIAGNOSTICS n_remit = ROW_COUNT;
  DELETE FROM subcontractor_settlement_lines WHERE subcontractor_id = v_sub AND (settle_date <= c_cut OR task_id = ANY (v_ids));
  GET DIAGNOSTICS n_line = ROW_COUNT;
  DELETE FROM subcontractor_daily_settlements WHERE id = ANY (v_days);
  GET DIAGNOSTICS n_day = ROW_COUNT;

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

  -- ── 작업 삭제 (자동 삭제로 묶인 딸린 행은 여기서 함께 지워진다) ──
  DELETE FROM tasks WHERE id = ANY (v_ids);
  GET DIAGNOSTICS n_task = ROW_COUNT;

  -- 결제 행이 지워지면서 조정 줄이 새로 생겼다면 그것도 없앤다 (대상 작업의 줄은 남기지 않는다)
  DELETE FROM subcontractor_settlement_lines WHERE task_id = ANY (v_ids);

  INSERT INTO _out VALUES
    ('9 확인', '지운 작업',          NULL, n_task,  '복사본: ' || c_tag || 'tasks'),
    ('9 확인', '지운 정산 줄',       NULL, n_line,  NULL),
    ('9 확인', '지운 정산 일자',     NULL, n_day,   NULL),
    ('9 확인', '지운 처리 기록',     NULL, n_event, NULL),
    ('9 확인', '지운 기사 보고',     NULL, n_remit, NULL),
    ('9 확인', '지운 가계부 줄',     NULL, n_cash,  NULL),
    ('9 확인', '남은 화이트코어 작업', NULL, (SELECT COUNT(*)::int FROM tasks WHERE subcontractor_id = v_sub), '기대 0 (10/8 이후 접수분이 있으면 그 수)'),
    ('9 확인', '남은 정산 줄',       NULL, (SELECT COUNT(*)::int FROM subcontractor_settlement_lines  WHERE subcontractor_id = v_sub), '기대 0'),
    ('9 확인', '남은 정산 일자',     NULL, (SELECT COUNT(*)::int FROM subcontractor_daily_settlements WHERE subcontractor_id = v_sub), '기대 0'),
    ('9 확인', '남은 기사 보고',     NULL, (SELECT COUNT(*)::int FROM subcontractor_staff_remits      WHERE subcontractor_id = v_sub), '기대 0'),
    ('9 확인', '열린 정산 날짜',     NULL, (SELECT COUNT(*)::int FROM _sub_open_plan(v_sub)), '기대 0'),
    ('9 확인', '가계부 sub_fee / sub_refund', NULL, (SELECT COUNT(*)::int FROM bookkeeping_cashflow WHERE source IN ('sub_fee', 'sub_refund')), '기대 0'),
    ('9 확인', '회사 몫 %',          NULL, _sub_cut_pct_on(v_sub, (now() AT TIME ZONE 'Asia/Seoul')::date), '바뀌지 않음 (0)'),
    ('9 확인', '회사 몫 이력 줄수',  NULL, (SELECT COUNT(*)::int FROM subcontractor_cut_rates WHERE subcontractor_id = v_sub), '바뀌지 않음 (1)'),
    ('9 확인', '화이트코어 기사 수', NULL, (SELECT COUNT(*)::int FROM users WHERE subcontractor_id = v_sub), '바뀌지 않음');
END $$;

-- 마지막 표: 미리 보기(false) 또는 지운 수 + 확인(true)
CREATE TEMP TABLE _result ON COMMIT PRESERVE ROWS AS
SELECT grp AS 구분, target AS 대상, d AS 날짜, amount AS 건수_금액, note AS 내용 FROM _out;

COMMIT;

SELECT * FROM _result ORDER BY 1, 3, 2;
