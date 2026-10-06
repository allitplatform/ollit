-- ============================================================================
-- Migration 229 - 협력사 수수료를 회사 수입에 반영 (누적 이월 + 가계부 현금)
-- 작성 2026-10-06 · 선행: 225 (227·228 과는 순서 무관)
--
-- 사장님 결정 (2026-10-06)
--   · 매출 리포트: 협력사 수수료를 "회사 수입" 합계에 포함 + 별도 줄 "협력사 수수료" (완료일 기준)
--   · 가계부 현금: 운영자 [입금 확인] 시점에 자동 기록 (기사 송금 확인 - mig 156 - 과 같은 방식)
--
-- 내용
--   [1] bookkeeping_cumulative_carryover (누적 이월)
--       mig 129 본문 그대로 + 일정산 수입 조건 한 곳: track = 'A'  ->  track IN ('A','S')
--       -> 협력사 작업은 수수료(owner_amount)만 그 달 회사 수입으로 더해집니다.
--       이 파일은 저장소의 mig 129 본문에서 자동으로 만들었고, 바꾼 한 곳을 되돌리면
--       129 와 완전히 같다는 것을 만들 때 검사했습니다.
--   [2] admin_confirm_sub_daily_fee
--       기존 함수(mig 225)는 _impl_ 로 보존하고, 새 함수가 그것을 부른 뒤
--       · 입금 확인  -> 가계부 현금 입금 1줄 (금액 = 보고 금액, 날짜 = 확인한 날)
--       · 확인 취소  -> 그 줄 삭제
--
-- 매출 리포트 화면 쪽 서버 집계(mig 175·176)는 바꾸지 않습니다. 협력사 수수료는 앱이
-- 같은 작업 목록에서 따로 더합니다 -> 기존 원청·직영 숫자는 서버에서 한 글자도 달라지지 않습니다.
--
-- 기존 데이터 영향
--   · 과거 달: track S 작업이 없으므로 누적 이월 결과가 달라지지 않습니다
--     (대조 조회: db/ops/verify_sub_fee_revenue.sql).
--   · 이미 입금 확인한 날짜에는 가계부 줄이 자동으로 생기지 않습니다 (이후 확인분부터).
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 누적 이월
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
    SELECT COALESCE(SUM(p.owner_amount), 0)::bigint INTO v_track_a
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
-- [2] 입금 확인 -> 가계부 현금 자동 기록
-- ============================================================
DO $$
BEGIN
  IF to_regprocedure('_impl_admin_confirm_sub_daily_fee(uuid, text, uuid, date, boolean)') IS NULL THEN
    ALTER FUNCTION admin_confirm_sub_daily_fee(uuid, text, uuid, date, boolean) RENAME TO _impl_admin_confirm_sub_daily_fee;
  END IF;
END $$;

REVOKE ALL ON FUNCTION _impl_admin_confirm_sub_daily_fee(uuid, text, uuid, date, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION admin_confirm_sub_daily_fee(
  p_actor uuid, p_token text, p_subcontractor_id uuid, p_date date, p_confirm boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_res  jsonb;
  v_s    subcontractor_daily_settlements%ROWTYPE;
  v_name text;
BEGIN
  v_res := _impl_admin_confirm_sub_daily_fee(p_actor, p_token, p_subcontractor_id, p_date, p_confirm);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RETURN v_res;
  END IF;

  SELECT * INTO v_s FROM subcontractor_daily_settlements
   WHERE subcontractor_id = p_subcontractor_id AND settle_date = p_date;
  IF NOT FOUND THEN
    RETURN v_res;
  END IF;

  BEGIN
    IF p_confirm THEN
      IF COALESCE(v_s.reported_amount, 0) > 0 THEN
        SELECT name INTO v_name FROM subcontractors WHERE id = p_subcontractor_id;
        INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
        VALUES (v_s.tenant_id, 'in', v_s.reported_amount, (now() AT TIME ZONE 'Asia/Seoul')::date,
                '협력사 수수료 · ' || COALESCE(v_name, '') || ' · ' || to_char(p_date, 'MM/DD') || ' 작업분',
                p_actor, 'sub_fee', v_s.id)
        ON CONFLICT (source, source_ref) WHERE source IS NOT NULL DO NOTHING;
      END IF;
    ELSE
      DELETE FROM bookkeeping_cashflow WHERE source = 'sub_fee' AND source_ref = v_s.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 가계부 기록 실패가 입금 확인 자체를 되돌리지 않게 한다 (결과에 표시)
    RETURN v_res || jsonb_build_object('cashflow_error', SQLERRM);
  END;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_confirm_sub_daily_fee(uuid, text, uuid, date, boolean) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 누적 이월 함수에 반영됐는지 - 기대: true
SELECT pg_get_functiondef(p.oid) LIKE '%IN (''A'', ''S'')%' AS 반영됨
  FROM pg_proc p WHERE p.proname = 'bookkeeping_cumulative_carryover' LIMIT 1;

-- 2) 입금 확인 함수 구성 - 기대: 2행 (_impl_ 1 + 새 함수 1)
SELECT proname FROM pg_proc
 WHERE proname IN ('admin_confirm_sub_daily_fee', '_impl_admin_confirm_sub_daily_fee') ORDER BY 1;
