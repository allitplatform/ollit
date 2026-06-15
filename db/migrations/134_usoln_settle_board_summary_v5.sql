-- Migration 134 — usoln_settle_board_summary v5 (DROP+CREATE)
-- 사장님 spec (2026-06-15):
--   신규 4필드: naver_pending_eng / naver_pending_margin / naver_pending_count / naver_pending_subtotal
--   정의: task_items WHERE naver_settled_at IS NULL (네이버 정산 대기, 작업완료 후 첫 단계).
--   배너용 — UsolNSettleScreen / PrincipalSettleTab 의 "정산 대기" 와 동일 모집단.
--
-- 산식 (옛 Mig 133 분배 그대로):
--   task_eng_excl   = engineer_amount  − (extra_fee − FLOOR(extra_fee × 0.15))
--   task_prin_excl  = principal_amount − FLOOR(extra_fee × 0.15)
--   task_margin_unc = task_sub_sum − task_eng_excl − task_prin_excl
--   item_eng_excl   = task_eng_excl   × (item.subtotal / task_sub_sum)
--   item_margin_unc = task_margin_unc × (item.subtotal / task_sub_sum)
--   회사 실수령 합 = Σ(item_eng_excl + item_margin_unc) WHERE naver_settled_at IS NULL
--                  = Σ(subtotal − distributed_principal_excl) — 동치
--
-- 배너 합산: client 가 months 배열 순회해 naver_pending_eng + naver_pending_margin 합.

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

  v_engineer_excl   bigint;
  v_principal_excl  bigint;
  v_margin_unc      bigint;

  v_received_engineer bigint;
  v_received_owner    bigint;
  v_pending_engineer  bigint;
  v_pending_owner     bigint;
  v_recv_eng_excl     bigint;
  v_pend_eng_excl     bigint;

  v_received_eng_new    bigint;
  v_received_margin_new bigint;
  v_pending_eng_new     bigint;
  v_pending_margin_new  bigint;

  -- v5 신규 — naver_settled_at NULL 기준 정산 대기 분
  v_naver_pending_eng       bigint;
  v_naver_pending_margin    bigint;
  v_naver_pending_count     int;
  v_naver_pending_subtotal  bigint;

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

    -- 기사 정산 (engineer_settled_at fully-stamped 기준)
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

    -- 유솔 몫 + 회사 마진 + 현장 추가금 + _excl_extra task 합
    SELECT
      COALESCE(SUM(p.principal_amount), 0)::bigint,
      COALESCE(SUM(p.owner_amount),     0)::bigint,
      COALESCE(SUM(p.extra_fee),        0)::bigint,
      COALESCE(SUM(p.engineer_amount - (p.extra_fee - FLOOR(p.extra_fee * 0.15)::bigint))::bigint, 0),
      COALESCE(SUM(p.principal_amount - FLOOR(p.extra_fee * 0.15)::bigint)::bigint, 0)
    INTO v_principal_total, v_margin, v_extra_total, v_engineer_excl, v_principal_excl
    FROM payments p
    JOIN tasks t ON t.id = p.task_id
    WHERE p.track       = 'B'
      AND t.principal_id = v_usoln_id
      AND t.status       = '완료'
      AND t.completed_at >= v_month_start
      AND t.completed_at <  v_next_start
      AND t.tenant_id    = c_tenant;

    v_margin_unc := v_pass_total - v_engineer_excl - v_principal_excl;

    -- item-level 분배: 받음/안받음 (company_received_at) + 정산대기 (naver_settled_at NULL) 동시 집계
    WITH task_sub AS (
      SELECT
        ti.task_id,
        SUM(ti.subtotal)::numeric AS task_sub_sum
      FROM task_items ti
      JOIN tasks t ON t.id = ti.task_id
      WHERE t.tenant_id    = c_tenant
        AND t.principal_id = v_usoln_id
        AND t.status       = '완료'
        AND t.completed_at >= v_month_start
        AND t.completed_at <  v_next_start
        AND NOT COALESCE(ti.is_canceled, false)
      GROUP BY ti.task_id
    ),
    task_calc AS (
      SELECT
        p.task_id,
        ts.task_sub_sum,
        p.engineer_amount,
        p.owner_amount,
        (p.engineer_amount - (p.extra_fee - FLOOR(p.extra_fee * 0.15)::bigint))::numeric AS task_eng_excl,
        (p.principal_amount - FLOOR(p.extra_fee * 0.15)::bigint)::numeric AS task_prin_excl,
        ts.task_sub_sum
          - (p.engineer_amount - (p.extra_fee - FLOOR(p.extra_fee * 0.15)::bigint))::numeric
          - (p.principal_amount - FLOOR(p.extra_fee * 0.15)::bigint)::numeric AS task_margin_unc
      FROM payments p
      JOIN task_sub ts ON ts.task_id = p.task_id
      JOIN tasks t      ON t.id = p.task_id
      WHERE p.track = 'B'
        AND t.tenant_id    = c_tenant
        AND t.principal_id = v_usoln_id
        AND t.status       = '완료'
        AND t.completed_at >= v_month_start
        AND t.completed_at <  v_next_start
    ),
    item_alloc AS (
      SELECT
        ti.company_received_at,
        ti.naver_settled_at,
        ti.subtotal,
        CASE WHEN tc.task_sub_sum > 0
          THEN tc.engineer_amount::numeric * (ti.subtotal::numeric / tc.task_sub_sum)
          ELSE 0 END AS item_eng_raw,
        CASE WHEN tc.task_sub_sum > 0
          THEN tc.owner_amount::numeric * (ti.subtotal::numeric / tc.task_sub_sum)
          ELSE 0 END AS item_own_raw,
        CASE WHEN tc.task_sub_sum > 0
          THEN tc.task_eng_excl * (ti.subtotal::numeric / tc.task_sub_sum)
          ELSE 0 END AS item_eng_excl,
        CASE WHEN tc.task_sub_sum > 0
          THEN tc.task_margin_unc * (ti.subtotal::numeric / tc.task_sub_sum)
          ELSE 0 END AS item_margin_unc
      FROM task_items ti
      JOIN tasks t       ON t.id = ti.task_id
      JOIN task_calc tc  ON tc.task_id = ti.task_id
      WHERE t.tenant_id    = c_tenant
        AND t.principal_id = v_usoln_id
        AND t.status       = '완료'
        AND t.completed_at >= v_month_start
        AND t.completed_at <  v_next_start
        AND NOT COALESCE(ti.is_canceled, false)
        AND ti.subtotal > 0
    )
    SELECT
      COALESCE(SUM(item_eng_raw)    FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_own_raw)    FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_eng_raw)    FILTER (WHERE company_received_at IS NULL),     0)::bigint,
      COALESCE(SUM(item_own_raw)    FILTER (WHERE company_received_at IS NULL),     0)::bigint,
      COALESCE(SUM(item_eng_excl)   FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_eng_excl)   FILTER (WHERE company_received_at IS NULL),     0)::bigint,
      COALESCE(SUM(item_margin_unc) FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_margin_unc) FILTER (WHERE company_received_at IS NULL),     0)::bigint,
      -- v5 신규 — naver_settled_at IS NULL 기준 (정산 대기)
      COALESCE(SUM(item_eng_excl)   FILTER (WHERE naver_settled_at IS NULL), 0)::bigint,
      COALESCE(SUM(item_margin_unc) FILTER (WHERE naver_settled_at IS NULL), 0)::bigint,
      COUNT(*)                      FILTER (WHERE naver_settled_at IS NULL)::int,
      COALESCE(SUM(subtotal)        FILTER (WHERE naver_settled_at IS NULL), 0)::bigint
    INTO
      v_received_engineer, v_received_owner, v_pending_engineer, v_pending_owner,
      v_recv_eng_excl,     v_pend_eng_excl,
      v_received_margin_new, v_pending_margin_new,
      v_naver_pending_eng, v_naver_pending_margin,
      v_naver_pending_count, v_naver_pending_subtotal
    FROM item_alloc;
    v_received_eng_new := v_recv_eng_excl;
    v_pending_eng_new  := v_pend_eng_excl;

    -- Mig 127 보정값
    SELECT COALESCE(amount, 0)::bigint, memo INTO v_adj_amount, v_adj_memo
    FROM bookkeeping_usoln_adjustment
    WHERE tenant_id = c_tenant AND work_month = v_wm;
    v_adj_amount := COALESCE(v_adj_amount, 0);

    v_months_arr := v_months_arr || jsonb_build_array(jsonb_build_object(
      'wm',                          v_wm,
      'passthrough_total',           v_pass_total,
      'passthrough_received',        v_pass_recv,
      'passthrough_pending',         v_pass_pend,
      'item_count',                  v_item_cnt,
      'received_count',              v_recv_cnt,
      'pending_count',               v_pend_cnt,
      'task_count',                  v_task_cnt,
      'engineer_total',              v_eng_total,
      'engineer_paid',               v_eng_paid,
      'engineer_pending',            v_eng_pending,
      'principal_total',             v_principal_total,
      'extra_total',                 v_extra_total,
      'engineer_excl_extra',         v_engineer_excl,
      'principal_excl_extra',        v_principal_excl,
      'margin',                      v_margin,
      'margin_unclamped',            v_margin_unc,
      'received_engineer',           v_received_engineer,
      'received_owner',              v_received_owner,
      'pending_engineer',            v_pending_engineer,
      'pending_owner',               v_pending_owner,
      'received_engineer_excl_extra', v_recv_eng_excl,
      'pending_engineer_excl_extra',  v_pend_eng_excl,
      'received_eng',                v_received_eng_new,
      'received_margin',             v_received_margin_new,
      'pending_eng',                 v_pending_eng_new,
      'pending_margin',              v_pending_margin_new,
      -- v5 신규 4필드 (배너 합산용)
      'naver_pending_eng',           v_naver_pending_eng,
      'naver_pending_margin',        v_naver_pending_margin,
      'naver_pending_count',         v_naver_pending_count,
      'naver_pending_subtotal',      v_naver_pending_subtotal,
      'adjustment_amount',           v_adj_amount,
      'adjustment_memo',             v_adj_memo
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
  'v5 (Mig 134) — naver_pending_* 4필드 추가 (네이버 정산 대기 단계). '
  '배너용 — UsolNSettleScreen / PrincipalSettleTab "정산 대기" 와 동일 모집단.';

COMMIT;

-- ============================================
-- Verify (배너 합산)
-- ============================================
-- SELECT
--   wm,
--   (m->>'naver_pending_count')::int       AS pending_cnt,
--   (m->>'naver_pending_subtotal')::bigint AS pending_sub,
--   (m->>'naver_pending_eng')::bigint
--     + (m->>'naver_pending_margin')::bigint AS pending_company_receive
-- FROM jsonb_array_elements(
--   (usoln_settle_board_summary('77777777-7777-7777-7777-aaaaaaaa0004'::uuid))->'months'
-- ) AS m, jsonb_to_record(m) AS x(wm text);
--
-- Expect Σ pending_company_receive ≈ 22,385,902 (사장님 목표).
