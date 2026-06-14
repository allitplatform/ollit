-- Migration 132 — usoln_settle_board_summary v3 (DROP+CREATE)
-- 사장님 spec (2026-06-14):
--   item 단위 company_received_at 으로 engineer_amount / owner_amount 갈라서 집계.
--   task 단위 아님 — 부분 입금 가능.
--
-- 신규 필드 (v2 → v3):
--   · received_engineer — items WHERE company_received_at NOT NULL 에 분배된 engineer_amount 합
--   · received_owner    — 동일 items 의 owner_amount 합 (= 받은 마진)
--   · pending_engineer  — items WHERE company_received_at NULL 에 분배된 engineer_amount 합
--   · pending_owner     — 동일 items 의 owner_amount 합 (= 안 받은 마진)
--
-- 분배 산식:
--   task 의 payments.engineer_amount × (item.subtotal / SUM(active items subtotal in same task))
--   ↑ 동일 산식이 owner_amount 에도 적용.
--   task_sub_sum = 0 (희귀) → 분배 0.
--   is_canceled 아이템 제외.
--
-- DROP+CREATE (plan-cache 교훈).
-- 권한·로직 동일.

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

  -- v3 신규 — item 단위 분배 후 company_received_at 기준 split
  v_received_engineer bigint;
  v_received_owner    bigint;
  v_pending_engineer  bigint;
  v_pending_owner     bigint;

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

    -- 기사 지급 (task 단위 — engineer_settled_at fully-stamped 기준)
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

    -- 유솔(원청) 몫 + 회사 마진 + 현장 추가금 (task 합산)
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

    -- v3 신규 — item 단위 engineer/owner 분배 후 company_received_at 으로 split
    --   분배: item_eng = task.engineer_amount × (item.subtotal / task_sub_sum)
    --        item_own = task.owner_amount    × (item.subtotal / task_sub_sum)
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
    item_alloc AS (
      SELECT
        ti.company_received_at,
        CASE WHEN ts.task_sub_sum > 0
          THEN p.engineer_amount::numeric * (ti.subtotal::numeric / ts.task_sub_sum)
          ELSE 0 END AS item_eng,
        CASE WHEN ts.task_sub_sum > 0
          THEN p.owner_amount::numeric * (ti.subtotal::numeric / ts.task_sub_sum)
          ELSE 0 END AS item_own
      FROM task_items ti
      JOIN tasks t       ON t.id = ti.task_id
      JOIN payments p    ON p.task_id = t.id AND p.track = 'B'
      JOIN task_sub ts   ON ts.task_id = ti.task_id
      WHERE t.tenant_id    = c_tenant
        AND t.principal_id = v_usoln_id
        AND t.status       = '완료'
        AND t.completed_at >= v_month_start
        AND t.completed_at <  v_next_start
        AND NOT COALESCE(ti.is_canceled, false)
    )
    SELECT
      COALESCE(SUM(item_eng) FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_own) FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_eng) FILTER (WHERE company_received_at IS NULL), 0)::bigint,
      COALESCE(SUM(item_own) FILTER (WHERE company_received_at IS NULL), 0)::bigint
    INTO v_received_engineer, v_received_owner, v_pending_engineer, v_pending_owner
    FROM item_alloc;

    -- Mig 127 보정값
    SELECT COALESCE(amount, 0)::bigint, memo INTO v_adj_amount, v_adj_memo
    FROM bookkeeping_usoln_adjustment
    WHERE tenant_id = c_tenant AND work_month = v_wm;
    v_adj_amount := COALESCE(v_adj_amount, 0);

    v_months_arr := v_months_arr || jsonb_build_array(jsonb_build_object(
      'wm',                   v_wm,
      'passthrough_total',    v_pass_total,
      'passthrough_received', v_pass_recv,
      'passthrough_pending',  v_pass_pend,
      'item_count',           v_item_cnt,
      'received_count',       v_recv_cnt,
      'pending_count',        v_pend_cnt,
      'task_count',           v_task_cnt,
      'engineer_total',       v_eng_total,
      'engineer_paid',        v_eng_paid,
      'engineer_pending',     v_eng_pending,
      'principal_total',      v_principal_total,
      'extra_total',          v_extra_total,
      'margin',               v_margin,
      'received_engineer',    v_received_engineer,
      'received_owner',       v_received_owner,
      'pending_engineer',     v_pending_engineer,
      'pending_owner',        v_pending_owner,
      'adjustment_amount',    v_adj_amount,
      'adjustment_memo',      v_adj_memo
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
  'v3 (Mig 132) — item 단위 engineer/owner 분배 후 company_received_at 기준 split. '
  '신규 필드: received_engineer / received_owner / pending_engineer / pending_owner.';

COMMIT;

-- ============================================
-- Verify (separate run)
-- ============================================
-- A. 함수 등록 (DROP 후 CREATE):
-- SELECT proname FROM pg_proc WHERE proname='usoln_settle_board_summary';
-- Expect: 1 row.
--
-- B. 5월 신규 필드:
-- SELECT usoln_settle_board_summary(
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect 2026-05 (현재 DB 기준):
--   · 168 items 회사 입금 완료 → received_engineer + received_owner 합산
--   · 나머지 1076 items 입금 대기 → pending_engineer + pending_owner 합산
--   · 합계 정합성: received_engineer + pending_engineer = engineer_total
--                  received_owner    + pending_owner    = margin
--
-- C. 분배 검증 — task 단위 합과 item 단위 분배 합 일치:
-- task 의 engineer_amount = SUM(item_eng) of items in same task ✓ (분배 비율 합 = 1)
