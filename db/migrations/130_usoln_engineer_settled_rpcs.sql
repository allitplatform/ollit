-- Migration 130 — 유솔N 정산 현황판 RPC 3개 (stamp / unstamp / summary)
-- 사장님 spec (2026-06-14):
--   기존 4단계 시스템(task_items.naver_settled_at / company_received_at / engineer_settled_at, Mig 038)
--   재활용. 신규 = engineer_settled_at 작업월 일괄 stamp + 운영 화면용 집계.
--
-- RPCs:
--   ① mark_usoln_engineer_settled_by_month(p_work_month, p_actor)
--      그 작업월(completed_at KST) usol_n task_items 중
--      company_received_at NOT NULL AND engineer_settled_at IS NULL AND NOT is_canceled
--      을 전부 engineer_settled_at = now() stamp.
--   ② unmark_usoln_engineer_settled_by_month(p_work_month, p_actor)
--      되돌리기. 그 작업월 usol_n task_items 중 engineer_settled_at NOT NULL → NULL.
--   ③ usoln_settle_board_summary(p_actor)
--      시작월(2026-04)부터 현재월(KST)까지 작업월별 집계:
--        통과자금 (subtotal): 받은/받을 거 + 카운트
--        기사 지급 (engineer_amount, task level): 준/줄 거 (task fully-stamped 기준)
--        회사 마진 (owner_amount track B)
--        Mig 127 보정값 (work_month 일치 시)
--
-- 권한: SECURITY DEFINER + p_actor uuid + role IN (owner/admin/operator).
-- English-only. Paste-safe.

BEGIN;

-- ============================================
-- [1] mark_usoln_engineer_settled_by_month
-- ============================================
DROP FUNCTION IF EXISTS mark_usoln_engineer_settled_by_month(text, uuid);

CREATE FUNCTION mark_usoln_engineer_settled_by_month(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tenant CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  v_year       int;
  v_month      int;
  v_next_year  int;
  v_next_month int;
  v_start      timestamptz;
  v_end        timestamptz;
  v_usoln_id   uuid;
  v_stamped    int;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  v_year  := SUBSTRING(p_work_month FROM 1 FOR 4)::int;
  v_month := SUBSTRING(p_work_month FROM 6 FOR 2)::int;
  IF v_month = 12 THEN v_next_year := v_year + 1; v_next_month := 1;
  ELSE                  v_next_year := v_year;     v_next_month := v_month + 1;
  END IF;
  v_start := make_timestamptz(v_year,      v_month,      1, 0, 0, 0, 'Asia/Seoul');
  v_end   := make_timestamptz(v_next_year, v_next_month, 1, 0, 0, 0, 'Asia/Seoul');

  SELECT id INTO v_usoln_id FROM principals WHERE code = 'usol_n';
  IF v_usoln_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usol_n principal not found');
  END IF;

  WITH target AS (
    SELECT ti.id
    FROM task_items ti
    JOIN tasks t ON t.id = ti.task_id
    WHERE t.tenant_id    = c_tenant
      AND t.principal_id = v_usoln_id
      AND t.status       = '완료'
      AND t.completed_at >= v_start
      AND t.completed_at <  v_end
      AND NOT COALESCE(ti.is_canceled, false)
      AND ti.company_received_at IS NOT NULL
      AND ti.engineer_settled_at IS NULL
  )
  UPDATE task_items SET engineer_settled_at = now()
  WHERE id IN (SELECT id FROM target);

  GET DIAGNOSTICS v_stamped = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'work_month', p_work_month,
    'stamped_count', v_stamped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION mark_usoln_engineer_settled_by_month(text, uuid) TO anon, authenticated;

-- ============================================
-- [2] unmark_usoln_engineer_settled_by_month
-- ============================================
DROP FUNCTION IF EXISTS unmark_usoln_engineer_settled_by_month(text, uuid);

CREATE FUNCTION unmark_usoln_engineer_settled_by_month(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tenant CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  v_year       int;
  v_month      int;
  v_next_year  int;
  v_next_month int;
  v_start      timestamptz;
  v_end        timestamptz;
  v_usoln_id   uuid;
  v_unstamped  int;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  v_year  := SUBSTRING(p_work_month FROM 1 FOR 4)::int;
  v_month := SUBSTRING(p_work_month FROM 6 FOR 2)::int;
  IF v_month = 12 THEN v_next_year := v_year + 1; v_next_month := 1;
  ELSE                  v_next_year := v_year;     v_next_month := v_month + 1;
  END IF;
  v_start := make_timestamptz(v_year,      v_month,      1, 0, 0, 0, 'Asia/Seoul');
  v_end   := make_timestamptz(v_next_year, v_next_month, 1, 0, 0, 0, 'Asia/Seoul');

  SELECT id INTO v_usoln_id FROM principals WHERE code = 'usol_n';
  IF v_usoln_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'usol_n principal not found');
  END IF;

  WITH target AS (
    SELECT ti.id
    FROM task_items ti
    JOIN tasks t ON t.id = ti.task_id
    WHERE t.tenant_id    = c_tenant
      AND t.principal_id = v_usoln_id
      AND t.status       = '완료'
      AND t.completed_at >= v_start
      AND t.completed_at <  v_end
      AND ti.engineer_settled_at IS NOT NULL
  )
  UPDATE task_items SET engineer_settled_at = NULL
  WHERE id IN (SELECT id FROM target);

  GET DIAGNOSTICS v_unstamped = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'work_month', p_work_month,
    'unstamped_count', v_unstamped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION unmark_usoln_engineer_settled_by_month(text, uuid) TO anon, authenticated;

-- ============================================
-- [3] usoln_settle_board_summary
-- ============================================
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

  -- 통과자금 (subtotal, task_items 단위)
  v_pass_total   bigint;
  v_pass_recv    bigint;
  v_pass_pend    bigint;
  v_item_cnt     int;
  v_recv_cnt     int;
  v_pend_cnt     int;

  -- 기사 지급 (engineer_amount, task 단위 — task fully-stamped 기준)
  v_task_cnt     int;
  v_eng_total    bigint;
  v_eng_paid     bigint;
  v_eng_pending  bigint;
  v_margin       bigint;

  -- Mig 127 보정
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

  -- 현재 월 (KST)
  v_now_kst := (now() AT TIME ZONE 'Asia/Seoul')::date;
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

    -- ── 통과자금 (task_items.subtotal)
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

    -- ── 기사 지급 (engineer_amount, task 단위 — fully-stamped 기준)
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

    -- ── 회사 마진 (payments.owner_amount track B)
    SELECT COALESCE(SUM(p.owner_amount), 0)::bigint INTO v_margin
    FROM payments p
    JOIN tasks t ON t.id = p.task_id
    WHERE p.track       = 'B'
      AND t.principal_id = v_usoln_id
      AND t.status       = '완료'
      AND t.completed_at >= v_month_start
      AND t.completed_at <  v_next_start
      AND t.tenant_id    = c_tenant;

    -- ── Mig 127 보정값 (work_month 일치)
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

COMMENT ON FUNCTION mark_usoln_engineer_settled_by_month(text, uuid) IS
  '유솔N 작업월별 task_items.engineer_settled_at 일괄 stamp (company_received_at NOT NULL & engineer_settled_at NULL).';
COMMENT ON FUNCTION unmark_usoln_engineer_settled_by_month(text, uuid) IS
  '유솔N 작업월별 task_items.engineer_settled_at 일괄 unstamp (실수 되돌리기).';
COMMENT ON FUNCTION usoln_settle_board_summary(uuid) IS
  '유솔N 정산 현황판 집계 (시작월 2026-04 ~ 현재월 KST). monthly[] 반환.';

COMMIT;

-- ============================================
-- Verify (separate run)
-- ============================================
-- A. 3 functions:
-- SELECT proname FROM pg_proc
--   WHERE proname IN (
--     'mark_usoln_engineer_settled_by_month',
--     'unmark_usoln_engineer_settled_by_month',
--     'usoln_settle_board_summary'
--   ) ORDER BY proname;
-- Expect: 3 rows.
--
-- B. summary (A004 admin) — 4월/5월/6월:
-- SELECT usoln_settle_board_summary(
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect (현재 DB 기준):
--   2026-04: item 0, margin 0, adjustment 0
--   2026-05: item 1244, recv 169 / pend 1075, margin 18,946,363, adjustment 5,223,110 (memo "4월 작업분...")
--   2026-06: item 496,  recv 107 / pend 389,  margin 10,476,875, adjustment 0
--
-- C. stamp 5월 (ROLLBACK 안전):
-- BEGIN;
--   SELECT mark_usoln_engineer_settled_by_month('2026-05',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- ROLLBACK;
-- Expect: stamped_count 169 (현재 회사 입금 완료 미지급 건수와 일치).
--
-- D. permission denied:
-- SELECT mark_usoln_engineer_settled_by_month('2026-05',
--   '00000000-0000-0000-0000-000000000000'::uuid);
-- Expect: { ok: false, error: 'permission denied' }
