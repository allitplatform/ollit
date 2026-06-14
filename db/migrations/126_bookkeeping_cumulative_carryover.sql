-- Migration 126 — bookkeeping_cumulative_carryover RPC
-- 누적 이월 = 시작월부터 work_month 까지 (그 달까지 포함) 누적 합.
--   당월 차이 = (일정산 + 유솔N + 기타) − 운영비 − 분배
--   누적 이월 += 당월 차이
--
-- 사장님 spec (2026-06-14 확정):
--   · 시작월: 2026-04 (사업 시작월, 4월 1일 0원).
--   · 유솔N 마진: Mig 123 동일 — work_month 의 "전 달" completed_at 합 (settle-month).
--     예: 4월 → 3월 작업분(0). 6월 → 5월 작업분(18,946,363).
--   · 응답: monthly 배열 + 단일 cumulative_carryover (둘 다 반환).
--
-- 데이트 산술 교훈 (Mig 117-121):
--   make_timestamptz(year, month, 1, 0, 0, 0, 'Asia/Seoul') 명시 — UTC date preservation 회피.
--   12월 rollover 명시 처리.
--
-- English-only. Paste-safe.

BEGIN;

DROP FUNCTION IF EXISTS bookkeeping_cumulative_carryover(text, uuid);

CREATE FUNCTION bookkeeping_cumulative_carryover(
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
  v_target_key   int;   -- year*12 + month
  v_cur_year     int;
  v_cur_month    int;
  v_cur_key      int;
  v_wm           text;

  -- 월 범위 (그 달 / 다음 달 1일 KST)
  v_month_start timestamptz;
  v_next_start  timestamptz;

  -- 유솔N 전월 범위
  v_prev_year   int;
  v_prev_month  int;
  v_prev_start  timestamptz;
  v_prev_end    timestamptz;  -- = v_month_start (이번 달 1일)

  -- 월별 컴포넌트
  v_track_a    bigint;
  v_usoln      bigint;
  v_other      bigint;
  v_expense    bigint;
  v_distrib    bigint;
  v_net        bigint;
  v_monthly    bigint;
  v_cumulative bigint;

  v_monthly_arr jsonb := '[]'::jsonb;
BEGIN
  -- 권한
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

  -- 시작월이 work_month 보다 미래면 빈 결과
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

    -- 이번 달 범위 KST (다음 달 1일 명시 — 12월 rollover)
    v_month_start := make_timestamptz(v_cur_year, v_cur_month, 1, 0, 0, 0, 'Asia/Seoul');
    IF v_cur_month = 12 THEN
      v_next_start := make_timestamptz(v_cur_year + 1, 1, 1, 0, 0, 0, 'Asia/Seoul');
    ELSE
      v_next_start := make_timestamptz(v_cur_year, v_cur_month + 1, 1, 0, 0, 0, 'Asia/Seoul');
    END IF;

    -- 유솔N 전월 범위 (settle-month basis, Mig 123 동일)
    IF v_cur_month = 1 THEN
      v_prev_year  := v_cur_year - 1;
      v_prev_month := 12;
    ELSE
      v_prev_year  := v_cur_year;
      v_prev_month := v_cur_month - 1;
    END IF;
    v_prev_start := make_timestamptz(v_prev_year, v_prev_month, 1, 0, 0, 0, 'Asia/Seoul');
    v_prev_end   := v_month_start;  -- = 이번 달 1일

    -- ① 일정산 마진 (track A owner_amount, 이번 달 completed_at)
    SELECT COALESCE(SUM(p.owner_amount), 0)::bigint INTO v_track_a
    FROM payments p
    JOIN tasks t ON t.id = p.task_id
    WHERE p.track = 'A'
      AND t.status = '완료'
      AND t.completed_at >= v_month_start
      AND t.completed_at <  v_next_start
      AND t.tenant_id = c_tenant;

    -- ② 유솔N 월정산 (track B owner_amount, "전 달" completed_at — Mig 123)
    SELECT COALESCE(SUM(p.owner_amount), 0)::bigint INTO v_usoln
    FROM payments p
    JOIN tasks t       ON t.id = p.task_id
    JOIN principals pr ON pr.id = t.principal_id
    WHERE pr.code = 'usol_n'
      AND t.status = '완료'
      AND p.track  = 'B'
      AND t.completed_at >= v_prev_start
      AND t.completed_at <  v_prev_end
      AND t.tenant_id = c_tenant;

    -- ③ 기타 수입 (Mig 124, work_month = 이번 달)
    SELECT COALESCE(SUM(amount), 0)::bigint INTO v_other
    FROM bookkeeping_other_income
    WHERE tenant_id  = c_tenant
      AND work_month = v_wm;

    -- ④ 운영비 (Mig 114, work_month = 이번 달)
    SELECT COALESCE(SUM(amount), 0)::bigint INTO v_expense
    FROM bookkeeping_expenses
    WHERE tenant_id  = c_tenant
      AND work_month = v_wm;

    -- ⑤ 분배 (Mig 114, work_month = 이번 달)
    SELECT COALESCE(SUM(amount), 0)::bigint INTO v_distrib
    FROM bookkeeping_distributions
    WHERE tenant_id  = c_tenant
      AND work_month = v_wm;

    v_net        := (v_track_a + v_usoln + v_other) - v_expense;
    v_monthly    := v_net - v_distrib;
    v_cumulative := v_cumulative + v_monthly;

    v_monthly_arr := v_monthly_arr || jsonb_build_array(jsonb_build_object(
      'wm',            v_wm,
      'track_a',       v_track_a,
      'usoln',         v_usoln,
      'other',         v_other,
      'expense',       v_expense,
      'distribution',  v_distrib,
      'net',           v_net,
      'monthly_diff',  v_monthly,
      'cumulative',    v_cumulative
    ));

    -- 다음 달
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

COMMENT ON FUNCTION bookkeeping_cumulative_carryover(text, uuid) IS
  '누적 이월 RPC — 시작월(2026-04)부터 p_work_month 까지 월별 (수입−운영비−분배) 합산. '
  '유솔N 은 Mig 123 동일 (settle-month basis, 전월 작업분). '
  '반환: monthly[] + cumulative_carryover.';

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. 함수 등록:
-- SELECT proname FROM pg_proc
--   WHERE proname = 'bookkeeping_cumulative_carryover';
-- Expect: 1 row.
--
-- B. 2026-06 누적 계산 (A004 admin):
-- SELECT bookkeeping_cumulative_carryover('2026-06',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect (현재 DB 기준, 5월·6월 입력 후):
--   monthly: 3 항목 (2026-04, 2026-05, 2026-06)
--   2026-04: 거의 0 (4월 데이터 미입력)
--   2026-05: 일정산 970,500 / 유솔N 0 / 기타 0 / 운영비 −10,811,340 / 분배 −3,000,000 → 약 −12,840,840
--   2026-06: 일정산 4,151,500 / 유솔N 18,946,363 / 기타 0 / 운영비 −3,694,898 / 분배 −8,000,000 → +11,402,965
--   cumulative_carryover: 약 −1,437,875 (5월 + 6월)
--
-- C. permission denied:
-- SELECT bookkeeping_cumulative_carryover('2026-06',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }
--
-- D. 시작월 전 query (2026-03 → 빈 결과):
-- SELECT bookkeeping_cumulative_carryover('2026-03',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: monthly=[], cumulative_carryover=0
