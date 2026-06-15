-- Migration 133 — usoln_settle_board_summary v4 (DROP+CREATE)
-- 사장님 spec (2026-06-15):
--   신규 4필드: received_eng / received_margin / pending_eng / pending_margin
--   산식: item 단위 _excl_extra 분배 + margin_unclamped (환불 시 음수).
--   분배 비율 = item.subtotal / task_sub_sum (task 의 모든 active items 합).
--
-- 신규 필드:
--   · received_eng    = Σ(item_eng_excl   WHERE company_received_at NOT NULL)
--   · received_margin = Σ(item_margin_unc WHERE company_received_at NOT NULL)
--   · pending_eng     = Σ(item_eng_excl   WHERE company_received_at IS NULL)
--   · pending_margin  = Σ(item_margin_unc WHERE company_received_at IS NULL)
--   · margin_unclamped = passthrough_total − engineer_excl_extra − principal_excl_extra (task-level)
--
-- 산식 정의 (task-level):
--   task_eng_excl  = engineer_amount  − (extra_fee − FLOOR(extra_fee × 0.15))
--   task_prin_excl = principal_amount − FLOOR(extra_fee × 0.15)
--   task_margin_unc = task_sub_sum − task_eng_excl − task_prin_excl  (환불 시 음수)
--
-- item-level (subtotal 비율 분배):
--   item_eng_excl   = task_eng_excl   × (item.subtotal / task_sub_sum)
--   item_margin_unc = task_margin_unc × (item.subtotal / task_sub_sum)
--
-- 검증 (5월):
--   · received_eng + pending_eng       = 62,195,598 (engineer_excl_extra)
--   · received_margin + pending_margin = 18,946,363 (margin_unclamped)
--   · 합계 = 81,141,961 (= passthrough_total − principal_excl_extra = 회사받을)
--
-- 기존 필드 유지 (호환). DROP+CREATE — plan cache 교훈.

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
  v_margin          bigint;  -- 옛: SUM(owner_amount) clamped
  v_extra_total     bigint;

  v_engineer_excl   bigint;
  v_principal_excl  bigint;
  v_margin_unc      bigint;  -- 신규: passthrough − engineer_excl − principal_excl (환불 시 음수)

  -- 옛 v3 필드 (호환 유지)
  v_received_engineer bigint;
  v_received_owner    bigint;
  v_pending_engineer  bigint;
  v_pending_owner     bigint;
  v_recv_eng_excl     bigint;
  v_pend_eng_excl     bigint;

  -- v4 신규 4필드
  v_received_eng_new    bigint;
  v_received_margin_new bigint;
  v_pending_eng_new     bigint;
  v_pending_margin_new  bigint;

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

    -- 유솔 몫 (raw + excl_extra) / 회사 마진 (clamped, raw) / 현장 추가금 / 기사 (excl_extra)
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

    -- margin_unclamped (task-level, 환불 시 음수)
    v_margin_unc := v_pass_total - v_engineer_excl - v_principal_excl;

    -- item-level 분배 (받음/안받음)
    --   task_sub_sum  = Σ task active items subtotal
    --   task_eng_excl = engineer_amount  − (extra − FLOOR(extra × 0.15))
    --   task_prin_excl= principal_amount − FLOOR(extra × 0.15)
    --   task_margin_unc = task_sub_sum − task_eng_excl − task_prin_excl
    --   item_eng_excl   = task_eng_excl   × (item.subtotal / task_sub_sum)
    --   item_margin_unc = task_margin_unc × (item.subtotal / task_sub_sum)
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
        -- 옛 v3 (raw engineer / owner, 호환 유지)
        CASE WHEN tc.task_sub_sum > 0
          THEN tc.engineer_amount::numeric * (ti.subtotal::numeric / tc.task_sub_sum)
          ELSE 0 END AS item_eng_raw,
        CASE WHEN tc.task_sub_sum > 0
          THEN tc.owner_amount::numeric * (ti.subtotal::numeric / tc.task_sub_sum)
          ELSE 0 END AS item_own_raw,
        -- 옛 _excl 엔지니어 (호환)
        CASE WHEN tc.task_sub_sum > 0
          THEN tc.task_eng_excl * (ti.subtotal::numeric / tc.task_sub_sum)
          ELSE 0 END AS item_eng_excl,
        -- v4 신규 margin_unclamped (음수 가능)
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
    )
    SELECT
      COALESCE(SUM(item_eng_raw)    FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_own_raw)    FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_eng_raw)    FILTER (WHERE company_received_at IS NULL),     0)::bigint,
      COALESCE(SUM(item_own_raw)    FILTER (WHERE company_received_at IS NULL),     0)::bigint,
      COALESCE(SUM(item_eng_excl)   FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_eng_excl)   FILTER (WHERE company_received_at IS NULL),     0)::bigint,
      COALESCE(SUM(item_margin_unc) FILTER (WHERE company_received_at IS NOT NULL), 0)::bigint,
      COALESCE(SUM(item_margin_unc) FILTER (WHERE company_received_at IS NULL),     0)::bigint
    INTO
      v_received_engineer, v_received_owner, v_pending_engineer, v_pending_owner,
      v_recv_eng_excl,     v_pend_eng_excl,
      v_received_margin_new, v_pending_margin_new
    FROM item_alloc;
    -- v4 신규 이름은 received_eng_new / pending_eng_new = excl 버전과 동일.
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
      'margin',                      v_margin,           -- raw SUM(owner), clamped at compute_payment
      'margin_unclamped',            v_margin_unc,       -- v4 신규, 환불 시 음수
      -- 옛 v3 (호환)
      'received_engineer',           v_received_engineer,
      'received_owner',              v_received_owner,
      'pending_engineer',            v_pending_engineer,
      'pending_owner',               v_pending_owner,
      'received_engineer_excl_extra', v_recv_eng_excl,
      'pending_engineer_excl_extra',  v_pend_eng_excl,
      -- v4 신규 4필드 (사장님 spec — 화면이 이걸로 사용)
      'received_eng',                v_received_eng_new,
      'received_margin',             v_received_margin_new,
      'pending_eng',                 v_pending_eng_new,
      'pending_margin',              v_pending_margin_new,
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
  'v4 (Mig 133) — 신규 4필드 received_eng / received_margin / pending_eng / pending_margin '
  '+ margin_unclamped. _excl_extra 산식 통일. 환불 시 음수 그대로.';

COMMIT;

-- ============================================
-- Verify (5월 작업 기준)
-- ============================================
-- SELECT usoln_settle_board_summary('77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- Expect 2026-05:
--   passthrough_total     = 95,459,657
--   principal_excl_extra  = 14,317,696
--   engineer_excl_extra   = 62,195,598
--   margin_unclamped      = 18,946,363  (= 95,459,657 − 62,195,598 − 14,317,696)
--   received_eng + pending_eng       = 62,195,598
--   received_margin + pending_margin = 18,946,363
--   (received_eng + received_margin) + (pending_eng + pending_margin) = 81,141,961
