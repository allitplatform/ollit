-- ============================================================================
-- Migration 246 - 보관 견적 자동 따라가기 · 가계부 회사 수입에서 원청 몫 빼기 · 협력사 관리자용 휴무 조회
-- 작성 2026-10-07 · 선행: 229, 244, 245
--
-- 사장님 결정 (2026-10-07)
--   1. 보관 견적(tasks.sub_quote_supply)은, 운영자가 [견적 수정] 으로 고친 적이 없으면
--      협력사로 넘긴 뒤에도 접수 견적(product_price)이 바뀔 때 따라간다. 작업 완료 뒤에는 따라가지 않는다.
--   2. 가계부 "그 달 회사 수입" = 수수료(owner_amount) - 원청 몫(sub_principal_share).
--      원청 송금 출금(principal_fee)은 현금 흐름(통장)에만 남는다.
--      (확인: 가계부의 비용 합계는 운영비 표 bookkeeping_expenses 에서만 나오고 현금 흐름 표는 더하지 않는다
--       -> 출금 기록을 비용에서 따로 뺄 것은 없다. 수입 쪽 한 곳만 고치면 같은 돈이 두 번 빠지지 않는다.)
--   5. 협력사 타임라인에서 정기(반복) 휴무 기사를 숨기기 위한 휴무 조회 함수 (자기 협력사 기사만, 세션 확인).
--
-- 내용
--   [1] trg_tasks_sub_quote_snapshot (mig 244 의 트리거 함수) 교체 + 트리거가 product_price 변경에도 움직이게
--   [2] bookkeeping_cumulative_carryover - mig 229 본문 + 일정산 수입 합계 한 곳만
--       (저장소의 mig 229 본문에서 자동으로 만들었고, 바꾼 한 곳을 되돌리면 229 와 글자 하나까지 같습니다)
--   [3] sub_list_staff_offs - 협력사 관리자 전용
--
-- 기존 데이터 영향
--   · 원청 몫이 0 인 달(지금까지 전부)은 가계부 숫자가 달라지지 않습니다. 맨 아래 비교 표에서 확인합니다.
-- 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 보관 견적: 넘기는 순간 채우기 + (고친 적 없고 완료 전이면) 접수 견적을 따라가기
-- ============================================================
CREATE OR REPLACE FUNCTION trg_tasks_sub_quote_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subcontractor_id IS NULL OR NEW.sub_quote_edited_at IS NOT NULL THEN
    RETURN NEW;                       -- 협력사 작업이 아니거나, 운영자가 직접 고친 값이 있으면 그대로 둔다
  END IF;
  -- 협력사로 넘기는 순간
  IF TG_OP = 'INSERT' OR OLD.subcontractor_id IS DISTINCT FROM NEW.subcontractor_id THEN
    NEW.sub_quote_supply := COALESCE(NEW.product_price, 0);
    RETURN NEW;
  END IF;
  -- 넘긴 뒤 접수 견적이 바뀜 -> 따라간다. 단 작업이 끝난 뒤에는 따라가지 않는다 (그때는 [견적 수정] 만).
  IF NEW.product_price IS DISTINCT FROM OLD.product_price
     AND COALESCE(OLD.status, '') NOT IN ('완료', '정산완료', 'visit_only', '취소')
     AND COALESCE(NEW.status, '') NOT IN ('완료', '정산완료', 'visit_only', '취소') THEN
    NEW.sub_quote_supply := COALESCE(NEW.product_price, 0);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tasks_sub_quote_snapshot ON tasks;
CREATE TRIGGER tasks_sub_quote_snapshot
  BEFORE INSERT OR UPDATE OF subcontractor_id, product_price ON tasks
  FOR EACH ROW EXECUTE FUNCTION trg_tasks_sub_quote_snapshot();

-- ============================================================
-- [2] 가계부 누적 이월 - 일정산 수입에서 원청 몫을 뺀다
-- ============================================================
CREATE OR REPLACE FUNCTION bookkeeping_cumulative_carryover(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_start_year  CONSTANT int  := 2026;
  c_start_month CONSTANT int  := 4;
  c_tenant      CONSTANT uuid := '11111111-1111-1111-1111-111111111111';

  v_target_year  int;
  v_target_month int;
  v_target_key   int;
  v_cur_year     int;
  v_cur_month    int;
  v_cur_key      int;
  v_wm           text;

  v_month_start timestamptz;
  v_next_start  timestamptz;

  v_prev_year   int;
  v_prev_month  int;
  v_prev_start  timestamptz;
  v_prev_end    timestamptz;

  v_track_a    bigint;
  v_usoln_auto bigint;
  v_usoln_adj  bigint;
  v_usoln      bigint;
  v_other      bigint;
  v_expense    bigint;
  v_distrib    bigint;
  v_net        bigint;
  v_monthly    bigint;
  v_cumulative bigint;

  v_monthly_arr jsonb := '[]'::jsonb;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  v_target_year  := SUBSTRING(p_work_month FROM 1 FOR 4)::int;
  v_target_month := SUBSTRING(p_work_month FROM 6 FOR 2)::int;
  v_target_key   := v_target_year * 12 + v_target_month;

  IF (c_start_year * 12 + c_start_month) > v_target_key THEN
    RETURN jsonb_build_object(
      'ok', true,
      'work_month',  p_work_month,
      'start_month', to_char(make_date(c_start_year, c_start_month, 1), 'YYYY-MM'),
      'monthly',     '[]'::jsonb,
      'cumulative_carryover', 0
    );
  END IF;

  v_cur_year   := c_start_year;
  v_cur_month  := c_start_month;
  v_cumulative := 0;

  LOOP
    v_cur_key := v_cur_year * 12 + v_cur_month;
    EXIT WHEN v_cur_key > v_target_key;

    v_wm := to_char(make_date(v_cur_year, v_cur_month, 1), 'YYYY-MM');

    v_month_start := make_timestamptz(v_cur_year, v_cur_month, 1, 0, 0, 0, 'Asia/Seoul');
    IF v_cur_month = 12 THEN
      v_next_start := make_timestamptz(v_cur_year + 1, 1, 1, 0, 0, 0, 'Asia/Seoul');
    ELSE
      v_next_start := make_timestamptz(v_cur_year, v_cur_month + 1, 1, 0, 0, 0, 'Asia/Seoul');
    END IF;

    IF v_cur_month = 1 THEN
      v_prev_year  := v_cur_year - 1;
      v_prev_month := 12;
    ELSE
      v_prev_year  := v_cur_year;
      v_prev_month := v_cur_month - 1;
    END IF;
    v_prev_start := make_timestamptz(v_prev_year, v_prev_month, 1, 0, 0, 0, 'Asia/Seoul');
    v_prev_end   := v_month_start;

    -- ① 일정산 마진 (track A owner, 이번 달 completed_at)
    -- Mig 246: 협력사 작업의 수수료 가운데 원청 몫(sub_principal_share)은 회사 수입이 아니다 -> 뺀다
    SELECT COALESCE(SUM(p.owner_amount - COALESCE(p.sub_principal_share, 0)), 0)::bigint INTO v_track_a
    FROM payments p
    JOIN tasks t ON t.id = p.task_id
    WHERE p.track IN ('A', 'S')   -- Mig 229: 협력사 수수료(track S 의 owner_amount)도 그 달 회사 수입
      AND t.status = '완료'
      AND t.completed_at >= v_month_start
      AND t.completed_at <  v_next_start
      AND t.tenant_id = c_tenant;

    -- ② 유솔N 자동 (track B, 전월 작업분 — Mig 123)
    SELECT COALESCE(SUM(p.owner_amount), 0)::bigint INTO v_usoln_auto
    FROM payments p
    JOIN tasks t       ON t.id = p.task_id
    JOIN principals pr ON pr.id = t.principal_id
    WHERE pr.code = 'usol_n'
      AND t.status = '완료'
      AND p.track  = 'B'
      AND t.completed_at >= v_prev_start
      AND t.completed_at <  v_prev_end
      AND t.tenant_id = c_tenant;

    -- ②' 유솔N 수동 보정 (Mig 127, 그 달 work_month)
    SELECT COALESCE(amount, 0)::bigint INTO v_usoln_adj
    FROM bookkeeping_usoln_adjustment
    WHERE tenant_id  = c_tenant
      AND work_month = v_wm;
    v_usoln_adj := COALESCE(v_usoln_adj, 0);

    v_usoln := v_usoln_auto + v_usoln_adj;

    -- ③ 기타 수입 (Mig 124)
    SELECT COALESCE(SUM(amount), 0)::bigint INTO v_other
    FROM bookkeeping_other_income
    WHERE tenant_id  = c_tenant
      AND work_month = v_wm;

    -- ④ 운영비
    SELECT COALESCE(SUM(amount), 0)::bigint INTO v_expense
    FROM bookkeeping_expenses
    WHERE tenant_id  = c_tenant
      AND work_month = v_wm;

    -- ⑤ 분배
    SELECT COALESCE(SUM(amount), 0)::bigint INTO v_distrib
    FROM bookkeeping_distributions
    WHERE tenant_id  = c_tenant
      AND work_month = v_wm;

    v_net        := (v_track_a + v_usoln + v_other) - v_expense;
    v_monthly    := v_net - v_distrib;
    v_cumulative := v_cumulative + v_monthly;

    v_monthly_arr := v_monthly_arr || jsonb_build_array(jsonb_build_object(
      'wm',                v_wm,
      'track_a',           v_track_a,
      'usoln_auto',        v_usoln_auto,
      'usoln_adjustment',  v_usoln_adj,
      'usoln',             v_usoln,
      'other',             v_other,
      'expense',           v_expense,
      'distribution',      v_distrib,
      'net',               v_net,
      'monthly_diff',      v_monthly,
      'cumulative',        v_cumulative
    ));

    IF v_cur_month = 12 THEN
      v_cur_year  := v_cur_year + 1;
      v_cur_month := 1;
    ELSE
      v_cur_month := v_cur_month + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'work_month',           p_work_month,
    'start_month',          to_char(make_date(c_start_year, c_start_month, 1), 'YYYY-MM'),
    'monthly',              v_monthly_arr,
    'cumulative_carryover', v_cumulative
  );
END;
$$;
GRANT EXECUTE ON FUNCTION bookkeeping_cumulative_carryover(text, uuid) TO anon, authenticated;



-- ============================================================
-- [3] 협력사 관리자: 그 날짜의 소속 기사 휴무
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_staff_offs(p_actor uuid, p_token text, p_date date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'offs', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'engineer_id', o.user_id, 'name', u.name, 'type', o.type,
             'start_time', to_char(o.start_time, 'HH24:MI'), 'end_time', to_char(o.end_time, 'HH24:MI')))
      FROM user_off_days o
      JOIN users u ON u.id = o.user_id AND u.subcontractor_id = v_sub
     WHERE o.off_date = p_date), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_list_staff_offs(uuid, text, date) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 - 마지막 표 한 장
--   "1 가계부 비교" : 최근 4개월, 달마다 일정산 수입(직영 A + 협력사 S) 을 고치기 전 식 / 고친 식으로 나란히.
--                     차이 = 그 달 완료 작업의 원청 몫 합계. 원청 몫이 없는 달은 차이 0 (숫자 그대로).
--   "2 설치 확인"   : 트리거가 product_price 변경에도 걸려 있는지 · 휴무 조회 함수
-- ============================================================================
SELECT * FROM (
  SELECT '1 가계부 비교' AS 구분,
         to_char(m.d, 'YYYY-MM') AS 대상,
         '고치기 전 ' || to_char(COALESCE(SUM(p.owner_amount), 0), 'FM999,999,999,999') AS 값1,
         '고친 뒤 '   || to_char(COALESCE(SUM(p.owner_amount - COALESCE(p.sub_principal_share, 0)), 0), 'FM999,999,999,999') AS 값2,
         '차이(원청 몫) ' || to_char(COALESCE(SUM(COALESCE(p.sub_principal_share, 0)), 0), 'FM999,999,999,999') AS 값3,
         1 AS 순서
    FROM generate_series(date_trunc('month', (now() AT TIME ZONE 'Asia/Seoul')) - interval '3 months',
                         date_trunc('month', (now() AT TIME ZONE 'Asia/Seoul')), interval '1 month') AS m(d)
    LEFT JOIN tasks t
      ON t.status = '완료'
     AND (t.completed_at AT TIME ZONE 'Asia/Seoul') >= m.d
     AND (t.completed_at AT TIME ZONE 'Asia/Seoul') <  m.d + interval '1 month'
    LEFT JOIN payments p ON p.task_id = t.id AND p.track IN ('A', 'S')
   GROUP BY m.d
  UNION ALL
  SELECT '2 설치 확인', '보관 견적 트리거가 보는 칸',
         (SELECT string_agg(a.attname, ', ' ORDER BY a.attname)
            FROM pg_trigger tg JOIN pg_attribute a ON a.attrelid = tg.tgrelid AND a.attnum = ANY (tg.tgattr)
           WHERE tg.tgname = 'tasks_sub_quote_snapshot'),
         '기대: product_price, subcontractor_id', NULL, 2
  UNION ALL
  SELECT '2 설치 확인', '휴무 조회 함수', COUNT(*)::text, '기대: 1', NULL, 3
    FROM pg_proc WHERE proname = 'sub_list_staff_offs'
) r
ORDER BY 순서, 대상;
