-- Migration 131 — usoln_settle_board_summary v2 (DROP+CREATE)
-- 사장님 spec (2026-06-14):
--   기존 v1(Mig 130) 반환에 principal_total + extra_total 추가.
--   화면 "회사가 진짜 먹는 것" 3분할(기사/유솔/회사) 비율 표시용.
--
-- 신규 필드:
--   · principal_total — SUM(payments.principal_amount) track B (= 유솔 몫)
--   · extra_total     — SUM(payments.extra_fee)        track B (= 현장 추가금)
--
-- 합계 정합성:
--   passthrough_total + extra_total ≈ engineer_total + principal_total + margin
--   (compute_payment 의 v_total_owner = subtotal + extra + travel − engineer − principal)
--
-- DROP+CREATE (plan-cache 교훈 / 반환 jsonb 구조 변경).
-- 권한·로직·시작월(2026-04) 동일.

BEGIN;

DROP FUNCTION IF EXISTS usoln_settle_board_summary(uuid);

CREATE FUNCTION usoln_settle_board_summary(
  p_actor uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tenant      CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  c_start_year  CONSTANT int  := 2026;
  c_start_month CONSTANT int  := 4;

  v_now_kst    date;
  v_target_yr  int;
  v_target_mo  int;
  v_target_key int;
  v_cur_yr     int;
  v_cur_mo     int;
  v_cur_key    int;
  v_wm         text;

  v_usoln_id   uuid;
  v_month_start timestamptz;
  v_next_start  timestamptz;

  v_pass_total   bigint;
  v_pass_recv    bigint;
  v_pass_pend    bigint;
  v_item_cnt     int;
  v_recv_cnt     int;
  v_pend_cnt     int;

  v_task_cnt        int;
  v_eng_total       bigint;
  v_eng_paid        bigint;
  v_eng_pending     bigint;
  v_principal_total bigint;
  v_margin          bigint;
  v_extra_total     bigint;

  v_adj_amount   bigint;
  v_adj_memo     text;

  v_months_arr   jsonb := '[]'::jsonb;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  SELECT id INTO v_usoln_id FROM principals WHERE code = 'usol_n';
  IF v_usoln_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usol_n principal not found');
  END IF;

  v_now_kst   := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_target_yr := EXTRACT(YEAR FROM v_now_kst)::int;
  v_target_mo := EXTRACT(MONTH FROM v_now_kst)::int;
  v_target_key := v_target_yr * 12 + v_target_mo;

  v_cur_yr := c_start_year;
  v_cur_mo := c_start_month;

  LOOP
    v_cur_key := v_cur_yr * 12 + v_cur_mo;
    EXIT WHEN v_cur_key > v_target_key;

    v_wm := to_char(make_date(v_cur_yr, v_cur_mo, 1), 'YYYY-MM');
    v_month_start := make_timestamptz(v_cur_yr, v_cur_mo, 1, 0, 0, 0, 'Asia/Seoul');
    IF v_cur_mo = 12 THEN
      v_next_start := make_timestamptz(v_cur_yr + 1, 1, 1, 0, 0, 0, 'Asia/Seoul');
    ELSE
      v_next_start := make_timestamptz(v_cur_yr, v_cur_mo + 1, 1, 0, 0, 0, 'Asia/Seoul');
    END IF;

    -- 통과자금 (task_items.subtotal)
    SELECT
      COALESCE(SUM(ti.subtotal), 0)::bigint,
      COALESCE(SUM(CASE WHEN ti.company_received_at IS NOT NULL THEN ti.subtotal ELSE 0 END), 0)::bigint,
      COALESCE(SUM(CASE WHEN ti.company_received_at IS NULL     THEN ti.subtotal ELSE 0 END), 0)::bigint,
      COUNT(*)::int,
      COUNT(*) FILTER (WHERE ti.company_received_at IS NOT NULL)::int,
      COUNT(*) FILTER (WHERE ti.company_received_at IS NULL)::int
    INTO v_pass_total, v_pass_recv, v_pass_pend, v_item_cnt, v_recv_cnt, v_pend_cnt
    FROM task_items ti
    JOIN tasks t ON t.id = ti.task_id
    WHERE t.tenant_id    = c_tenant
      AND t.principal_id = v_usoln_id
      AND t.status       = '완료'
      AND t.completed_at >= v_month_start
      AND t.completed_at <  v_next_start
      AND NOT COALESCE(ti.is_canceled, false);

    -- 기사 지급 (task 단위 — fully-stamped 기준)
    WITH task_status AS (
      SELECT
        t.id AS task_id,
        p.engineer_amount,
        COUNT(ti.id) FILTER (WHERE ti.engineer_settled_at IS NULL) AS not_settled_cnt,
        COUNT(ti.id) FILTER (WHERE ti.company_received_at IS NOT NULL) AS company_recv_cnt
      FROM tasks t
      JOIN payments p   ON p.task_id = t.id AND p.track = 'B'
      JOIN task_items ti ON ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)
      WHERE t.tenant_id    = c_tenant
        AND t.principal_id = v_usoln_id
        AND t.status       = '완료'
        AND t.completed_at >= v_month_start
        AND t.completed_at <  v_next_start
      GROUP BY t.id, p.engineer_amount
    )
    SELECT
      COUNT(*)::int,
      COALESCE(SUM(engineer_amount), 0)::bigint,
      COALESCE(SUM(CASE WHEN not_settled_cnt = 0 THEN engineer_amount ELSE 0 END), 0)::bigint,
      COALESCE(SUM(CASE WHEN not_settled_cnt > 0 AND company_recv_cnt > 0 THEN engineer_amount ELSE 0 END), 0)::bigint
    INTO v_task_cnt, v_eng_total, v_eng_paid, v_eng_pending
    FROM task_status;

    -- 유솔(원청) 몫 + 회사 마진 + 현장 추가금
    SELECT
      COALESCE(SUM(p.principal_amount), 0)::bigint,
      COALESCE(SUM(p.owner_amount),     0)::bigint,
      COALESCE(SUM(p.extra_fee),        0)::bigint
    INTO v_principal_total, v_margin, v_extra_total
    FROM payments p
    JOIN tasks t ON t.id = p.task_id
    WHERE p.track       = 'B'
      AND t.principal_id = v_usoln_id
      AND t.status       = '완료'
      AND t.completed_at >= v_month_start
      AND t.completed_at <  v_next_start
      AND t.tenant_id    = c_tenant;

    -- Mig 127 보정값
    SELECT COALESCE(amount, 0)::bigint, memo INTO v_adj_amount, v_adj_memo
    FROM bookkeeping_usoln_adjustment
    WHERE tenant_id = c_tenant AND work_month = v_wm;
    v_adj_amount := COALESCE(v_adj_amount, 0);

    v_months_arr := v_months_arr || jsonb_build_array(jsonb_build_object(
      'wm',                  v_wm,
      'passthrough_total',   v_pass_total,
      'passthrough_received',v_pass_recv,
      'passthrough_pending', v_pass_pend,
      'item_count',          v_item_cnt,
      'received_count',      v_recv_cnt,
      'pending_count',       v_pend_cnt,
      'task_count',          v_task_cnt,
      'engineer_total',      v_eng_total,
      'engineer_paid',       v_eng_paid,
      'engineer_pending',    v_eng_pending,
      'principal_total',     v_principal_total,
      'extra_total',         v_extra_total,
      'margin',              v_margin,
      'adjustment_amount',   v_adj_amount,
      'adjustment_memo',     v_adj_memo
    ));

    IF v_cur_mo = 12 THEN v_cur_yr := v_cur_yr + 1; v_cur_mo := 1;
    ELSE                   v_cur_mo := v_cur_mo + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'start_month', to_char(make_date(c_start_year, c_start_month, 1), 'YYYY-MM'),
    'months',      v_months_arr
  );
END;
$$;

GRANT EXECUTE ON FUNCTION usoln_settle_board_summary(uuid) TO anon, authenticated;

COMMENT ON FUNCTION usoln_settle_board_summary(uuid) IS
  'v2 (Mig 131) — principal_total + extra_total 추가. 화면 3분할(기사/유솔/회사) 비율 표시용.';

COMMIT;

-- ============================================
-- Verify
-- ============================================
-- A. 함수 등록 (DROP 후 CREATE):
-- SELECT proname FROM pg_proc WHERE proname='usoln_settle_board_summary';
-- Expect: 1 row.
--
-- B. 5월 신규 필드:
-- SELECT usoln_settle_board_summary(
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect: 2026-05 항목 principal_total ≈ 14,479,681 / extra_total ≈ 1,079,900.
