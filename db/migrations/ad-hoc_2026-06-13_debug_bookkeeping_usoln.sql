-- AD-HOC DEBUG — 가계부 RPC vs raw SQL 차이 격리.
-- 같은 본문 SQL을 함수 안 컨텍스트에서 실행 + 환경 정보 함께 반환.
-- After diagnosis, run: DROP FUNCTION _debug_bookkeeping_usoln(text);

CREATE OR REPLACE FUNCTION _debug_bookkeeping_usoln(p_work_month text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year     int;
  v_month    int;
  v_start    timestamptz;
  v_end      timestamptz;
  v_sum      bigint;
  v_task_cnt int;
  v_tz       text;
  v_db       text;
  v_user     text;
  v_schema   text;
  v_payments_schema text;
  v_tasks_schema    text;
BEGIN
  v_year  := SUBSTRING(p_work_month FROM 1 FOR 4)::int;
  v_month := SUBSTRING(p_work_month FROM 6 FOR 2)::int;
  v_start := make_timestamptz(v_year, v_month, 1, 0, 0, 0, 'Asia/Seoul');
  v_end   := v_start + INTERVAL '1 month';

  v_tz     := current_setting('timezone');
  v_db     := current_database();
  v_user   := current_user;
  v_schema := current_schema();

  -- 어느 schema의 payments / tasks 가 보이는가?
  SELECT n.nspname INTO v_payments_schema
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'payments' AND c.relkind IN ('r','v','p')
    AND has_table_privilege(c.oid, 'SELECT')
  ORDER BY n.oid
  LIMIT 1;

  SELECT n.nspname INTO v_tasks_schema
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'tasks' AND c.relkind IN ('r','v','p')
    AND has_table_privilege(c.oid, 'SELECT')
  ORDER BY n.oid
  LIMIT 1;

  -- 함수 안에서 동일 SQL — 진짜 SUM
  SELECT COALESCE(SUM(p.owner_amount), 0)::bigint
    INTO v_sum
  FROM payments p
  JOIN tasks t       ON t.id = p.task_id
  JOIN principals pr ON pr.id = t.principal_id
  WHERE pr.code = 'usol_n'
    AND t.status = '완료'
    AND p.track  = 'B'
    AND t.completed_at >= v_start
    AND t.completed_at <  v_end
    AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

  -- range 안 task 개수만
  SELECT count(*) INTO v_task_cnt
  FROM tasks t
  JOIN principals pr ON pr.id = t.principal_id
  WHERE pr.code = 'usol_n'
    AND t.status = '완료'
    AND t.completed_at >= v_start
    AND t.completed_at <  v_end
    AND t.tenant_id = '11111111-1111-1111-1111-111111111111';

  RETURN jsonb_build_object(
    'v_year',           v_year,
    'v_month',          v_month,
    'v_start',          v_start,
    'v_end',            v_end,
    'session_timezone', v_tz,
    'current_database', v_db,
    'current_user',     v_user,
    'current_schema',   v_schema,
    'payments_schema',  v_payments_schema,
    'tasks_schema',     v_tasks_schema,
    'task_count_in_range', v_task_cnt,
    'sum_in_func',      v_sum
  );
END;
$$;

GRANT EXECUTE ON FUNCTION _debug_bookkeeping_usoln(text) TO anon, authenticated;
