-- Migration 129 — bookkeeping_cumulative_carryover v2 (DROP+CREATE)
-- v2 변경 (Mig 127/128 적용):
--   각 달 v_usoln = 자동(Mig 123 로직) + 보정(bookkeeping_usoln_adjustment).
--   monthly[] 에 usoln_auto / usoln_adjustment / usoln(합) 분리 반환.
--   누적 = (track_a + usoln_total + other − expense) − distribution 합.
--
-- DROP+CREATE — Mig 120 plan-cache 교훈. 반환 jsonb 구조 변경.
-- v1(Mig 126) 호환 필드(usoln) 유지 + 신규 필드(usoln_auto, usoln_adjustment) 추가.
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
    WHERE p.track = 'A'
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

COMMENT ON FUNCTION bookkeeping_cumulative_carryover(text, uuid) IS
  'v2 (Mig 129) — usoln 자동(track B) + 수동 보정(Mig 127) 합산. '
  'monthly[] 에 usoln_auto / usoln_adjustment / usoln(합) 분리 반환. '
  'v1(Mig 126) 보정 미반영 → v2 적용 필수.';

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. 함수 1개:
-- SELECT proname FROM pg_proc WHERE proname='bookkeeping_cumulative_carryover';
-- Expect: 1 row.
--
-- B. 5월 보정 5,223,110 입력 후 누적 확인:
-- BEGIN;
--   SELECT bookkeeping_set_usoln_adjustment('2026-05', 5223110, '4월 작업분 (앱 가동 전)',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
--   SELECT bookkeeping_cumulative_carryover('2026-06',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- ROLLBACK;
-- Expect: 5월 monthly_diff 약 −7,617,730, 6월 누적 약 +3,785,235.
--
-- C. 보정 없을 때 (Mig 126 v1과 동일 결과):
-- SELECT bookkeeping_cumulative_carryover('2026-06',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: 5월 monthly_diff 약 −12,840,840, 6월 누적 약 −1,437,875.
