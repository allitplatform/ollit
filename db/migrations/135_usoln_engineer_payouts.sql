-- ============================================
-- Migration 135 — 유솔N 기사 지급 이력 (append-only) + RPC 4개
-- 작성일 : 2026-06-16
-- 사장님 spec:
--   기존 task_items.engineer_settled_at 는 단일 timestamp 2상태 (NULL/paid) →
--   회차/누적/환불 audit 불가.
--   해결: usoln_engineer_payouts 별도 이력 테이블 (append-only).
--   engineer_settled_at 는 "지급 완료 여부" 플래그로 유지. 금액/회차 SOT 는 이력.
--
-- 데이터 모델:
--   회차(payout_round): '1차' (15일) / '2차' (말일) / '추가' (노일건 등 개별 지급)
--   환불(is_refund=true): 음수 amount row 로 회수 audit.
--   단위: task_item 별 (정석 — 환불 정확).
--
-- RPC 4개:
--   ① mark_usoln_payout_by_month(p_work_month, p_round, p_actor)
--      작업월 단위 일괄 지급 — 미지급 (engineer_settled_at NULL) + 회사 입금 완료 row 만 대상.
--      각 row 에 회차 명시 + 금액 계산 (task 의 engineer_excl_extra × item.subtotal / SUM(subtotals)).
--      payouts row INSERT + engineer_settled_at stamp.
--
--   ② mark_usoln_payout_by_item(p_task_item_id, p_round, p_amount, p_actor, p_memo)
--      단건 지급 (추가 회차용 — 노일건 등).
--      금액 명시. payouts row INSERT + engineer_settled_at stamp (NULL 이면).
--
--   ③ refund_usoln_payout(p_task_item_id, p_round, p_amount, p_actor, p_memo)
--      환불/회수 — 음수 amount row INSERT (is_refund=true).
--      engineer_settled_at 손대지 않음 (audit 목적, 지급 완료 플래그는 유지).
--
--   ④ usoln_payouts_summary(p_work_month, p_actor)
--      회차별 SUM(amount) + count, 환불 합계, 순합계 반환. UI 표시용.
--
-- 권한: SECURITY DEFINER + p_actor uuid + role IN (owner/admin/operator).
-- RLS: 테이블 자체 RLS 활성화 (정책 없음 → 직접 접근 차단 / 모든 접근 RPC 경유).
-- ============================================

BEGIN;

-- ============================================
-- [1] 테이블 — usoln_engineer_payouts (append-only)
-- ============================================
CREATE TABLE IF NOT EXISTS usoln_engineer_payouts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  task_item_id  uuid        NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
  engineer_id   uuid        NOT NULL REFERENCES users(id),
  work_month    text        NOT NULL CHECK (work_month ~ '^[0-9]{4}-[0-9]{2}$'),
  payout_round  text        NOT NULL CHECK (payout_round IN ('1차', '2차', '추가')),
  amount        int         NOT NULL,           -- 환불 시 음수
  paid_at       timestamptz NOT NULL DEFAULT now(),
  actor         uuid        REFERENCES users(id),
  memo          text,
  is_refund     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usoln_payouts_task_item_idx
  ON usoln_engineer_payouts(task_item_id);
CREATE INDEX IF NOT EXISTS usoln_payouts_engineer_month_idx
  ON usoln_engineer_payouts(engineer_id, work_month);
CREATE INDEX IF NOT EXISTS usoln_payouts_month_round_idx
  ON usoln_engineer_payouts(work_month, payout_round);
CREATE INDEX IF NOT EXISTS usoln_payouts_paid_at_idx
  ON usoln_engineer_payouts(paid_at);

COMMENT ON TABLE usoln_engineer_payouts IS
  '유솔N 기사 지급 이력 (append-only). 회차/누적/환불 audit. SOT for 지급 금액/회차.';
COMMENT ON COLUMN usoln_engineer_payouts.payout_round IS
  '1차 (15일) / 2차 (말일) / 추가 (노일건 등 개별 지급)';
COMMENT ON COLUMN usoln_engineer_payouts.amount IS
  '지급액 (환불 시 음수). 단위 = task_item.';
COMMENT ON COLUMN usoln_engineer_payouts.is_refund IS
  '환불/회수 row 여부. 환불 시 amount 음수 + 이 플래그 true.';

-- RLS — 테이블 직접 접근 차단. 모든 접근은 SECURITY DEFINER RPC 경유.
ALTER TABLE usoln_engineer_payouts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- [2] RPC ① mark_usoln_payout_by_month
--   작업월 단위 일괄 지급 + 회차 명시.
--   기존 mark_usoln_engineer_settled_by_month (Mig 130) 의 확장판.
-- ============================================
DROP FUNCTION IF EXISTS mark_usoln_payout_by_month(text, text, uuid);

CREATE FUNCTION mark_usoln_payout_by_month(
  p_work_month text,
  p_round      text,
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
  v_inserted   int;
  v_total      bigint;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_work_month IS NULL OR p_work_month !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_month invalid');
  END IF;
  IF p_round NOT IN ('1차', '2차', '추가') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'round invalid');
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

  -- 대상 task_items 선정 + 금액 계산 (task 의 engineer_excl_extra × item.subtotal / SUM)
  WITH target_tasks AS (
    SELECT
      t.id           AS task_id,
      t.assigned_engineer_id,
      p.engineer_amount,
      p.extra_fee,
      -- engineer_excl_extra = eng - (extra - FLOOR(extra * 0.15))
      (p.engineer_amount
        - (COALESCE(p.extra_fee, 0) - FLOOR(COALESCE(p.extra_fee, 0) * 0.15))
      )::int AS eng_excl_extra
    FROM tasks t
    JOIN payments p ON p.task_id = t.id
    WHERE t.tenant_id    = c_tenant
      AND t.principal_id = v_usoln_id
      AND t.status       = '완료'
      AND t.completed_at >= v_start
      AND t.completed_at <  v_end
      AND t.assigned_engineer_id IS NOT NULL
  ),
  task_sums AS (
    SELECT
      task_id,
      SUM(subtotal) FILTER (WHERE NOT COALESCE(is_canceled, false))::numeric AS sum_subtotal
    FROM task_items
    WHERE task_id IN (SELECT task_id FROM target_tasks)
    GROUP BY task_id
  ),
  target_items AS (
    SELECT
      ti.id AS item_id,
      tt.task_id,
      tt.assigned_engineer_id,
      tt.eng_excl_extra,
      ti.subtotal,
      ts.sum_subtotal,
      CASE
        WHEN ts.sum_subtotal > 0
          THEN ROUND(tt.eng_excl_extra::numeric * ti.subtotal::numeric / ts.sum_subtotal)::int
        ELSE tt.eng_excl_extra  -- subtotal 0 edge: 전액 (드물지만 안전)
      END AS item_amount
    FROM task_items ti
    JOIN target_tasks tt ON tt.task_id = ti.task_id
    JOIN task_sums    ts ON ts.task_id = ti.task_id
    WHERE NOT COALESCE(ti.is_canceled, false)
      AND ti.company_received_at IS NOT NULL
      AND ti.engineer_settled_at IS NULL
  ),
  inserted AS (
    INSERT INTO usoln_engineer_payouts (
      tenant_id, task_item_id, engineer_id, work_month,
      payout_round, amount, paid_at, actor, is_refund
    )
    SELECT
      c_tenant, ti.item_id, ti.assigned_engineer_id, p_work_month,
      p_round, ti.item_amount, now(), p_actor, false
    FROM target_items ti
    RETURNING task_item_id, amount
  ),
  stamped AS (
    UPDATE task_items SET engineer_settled_at = now()
    WHERE id IN (SELECT task_item_id FROM inserted)
    RETURNING id
  )
  SELECT COUNT(*)::int, COALESCE(SUM(amount), 0)::bigint
  INTO v_inserted, v_total
  FROM inserted;

  RETURN jsonb_build_object(
    'ok',           true,
    'work_month',   p_work_month,
    'round',        p_round,
    'count',        v_inserted,
    'total_amount', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION mark_usoln_payout_by_month(text, text, uuid) TO anon, authenticated;

-- ============================================
-- [3] RPC ② mark_usoln_payout_by_item
--   단건 지급 (추가 회차용 — 노일건 등). 금액 명시.
-- ============================================
DROP FUNCTION IF EXISTS mark_usoln_payout_by_item(uuid, text, int, uuid, text);

CREATE FUNCTION mark_usoln_payout_by_item(
  p_task_item_id uuid,
  p_round        text,
  p_amount       int,
  p_actor        uuid,
  p_memo         text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tenant CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  v_item     RECORD;
  v_task     RECORD;
  v_wm       text;
  v_payout_id uuid;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_task_item_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_item_id required');
  END IF;
  IF p_round NOT IN ('1차', '2차', '추가') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'round invalid');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be positive');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  SELECT ti.id, ti.task_id, ti.engineer_settled_at, ti.is_canceled
    INTO v_item
    FROM task_items ti
    WHERE ti.id = p_task_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_item not found');
  END IF;
  IF COALESCE(v_item.is_canceled, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_item canceled');
  END IF;

  SELECT t.id, t.tenant_id, t.principal_id, t.assigned_engineer_id, t.completed_at, t.status
    INTO v_task
    FROM tasks t
    WHERE t.id = v_item.task_id;
  IF v_task.tenant_id <> c_tenant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant mismatch');
  END IF;
  IF v_task.assigned_engineer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'assigned_engineer_id null');
  END IF;
  -- principal check (usol_n)
  IF NOT EXISTS (
    SELECT 1 FROM principals p WHERE p.id = v_task.principal_id AND p.code = 'usol_n'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not usol_n principal');
  END IF;

  v_wm := to_char(v_task.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM');

  INSERT INTO usoln_engineer_payouts (
    tenant_id, task_item_id, engineer_id, work_month,
    payout_round, amount, paid_at, actor, memo, is_refund
  ) VALUES (
    c_tenant, p_task_item_id, v_task.assigned_engineer_id, v_wm,
    p_round, p_amount, now(), p_actor, p_memo, false
  )
  RETURNING id INTO v_payout_id;

  -- engineer_settled_at NULL 이면 stamp (이미 stamp 됐으면 그대로 — 누적 추가 지급)
  IF v_item.engineer_settled_at IS NULL THEN
    UPDATE task_items SET engineer_settled_at = now() WHERE id = p_task_item_id;
  END IF;

  RETURN jsonb_build_object(
    'ok',         true,
    'payout_id',  v_payout_id,
    'work_month', v_wm,
    'round',      p_round,
    'amount',     p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION mark_usoln_payout_by_item(uuid, text, int, uuid, text) TO anon, authenticated;

-- ============================================
-- [4] RPC ③ refund_usoln_payout
--   환불/회수 — 음수 amount row INSERT (is_refund=true). engineer_settled_at 손대지 않음.
-- ============================================
DROP FUNCTION IF EXISTS refund_usoln_payout(uuid, text, int, uuid, text);

CREATE FUNCTION refund_usoln_payout(
  p_task_item_id uuid,
  p_round        text,
  p_amount       int,    -- 양수로 전달 (RPC 내부에서 음수로 INSERT)
  p_actor        uuid,
  p_memo         text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_tenant CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  v_item     RECORD;
  v_task     RECORD;
  v_wm       text;
  v_payout_id uuid;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF p_task_item_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_item_id required');
  END IF;
  IF p_round NOT IN ('1차', '2차', '추가') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'round invalid');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be positive (RPC negates internally)');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  SELECT ti.id, ti.task_id INTO v_item
    FROM task_items ti
    WHERE ti.id = p_task_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_item not found');
  END IF;

  SELECT t.tenant_id, t.assigned_engineer_id, t.completed_at, t.principal_id
    INTO v_task
    FROM tasks t WHERE t.id = v_item.task_id;
  IF v_task.tenant_id <> c_tenant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenant mismatch');
  END IF;
  IF v_task.assigned_engineer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'assigned_engineer_id null');
  END IF;

  v_wm := to_char(v_task.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM');

  INSERT INTO usoln_engineer_payouts (
    tenant_id, task_item_id, engineer_id, work_month,
    payout_round, amount, paid_at, actor, memo, is_refund
  ) VALUES (
    c_tenant, p_task_item_id, v_task.assigned_engineer_id, v_wm,
    p_round, -p_amount, now(), p_actor, p_memo, true
  )
  RETURNING id INTO v_payout_id;

  -- engineer_settled_at 손대지 않음 — 지급 완료 플래그는 audit 와 분리.

  RETURN jsonb_build_object(
    'ok',         true,
    'payout_id',  v_payout_id,
    'work_month', v_wm,
    'round',      p_round,
    'amount',     -p_amount,
    'is_refund',  true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION refund_usoln_payout(uuid, text, int, uuid, text) TO anon, authenticated;

-- ============================================
-- [5] RPC ④ usoln_payouts_summary
--   회차별 SUM + count, 환불 합계, 순합계 반환.
-- ============================================
DROP FUNCTION IF EXISTS usoln_payouts_summary(text, uuid);

CREATE FUNCTION usoln_payouts_summary(
  p_work_month text,
  p_actor      uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  c_tenant CONSTANT uuid := '11111111-1111-1111-1111-111111111111';
  v_first_amt   bigint;
  v_first_cnt   int;
  v_second_amt  bigint;
  v_second_cnt  int;
  v_extra_amt   bigint;
  v_extra_cnt   int;
  v_refund_sum  bigint;
  v_refund_cnt  int;
  v_total_paid  bigint;
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

  -- 회차별 (지급 + 환불 모두 포함, amount 그대로 SUM — 환불은 음수)
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE payout_round = '1차'), 0)::bigint,
    COUNT(*)             FILTER (WHERE payout_round = '1차')::int,
    COALESCE(SUM(amount) FILTER (WHERE payout_round = '2차'), 0)::bigint,
    COUNT(*)             FILTER (WHERE payout_round = '2차')::int,
    COALESCE(SUM(amount) FILTER (WHERE payout_round = '추가'), 0)::bigint,
    COUNT(*)             FILTER (WHERE payout_round = '추가')::int,
    COALESCE(SUM(amount) FILTER (WHERE is_refund),            0)::bigint,
    COUNT(*)             FILTER (WHERE is_refund)::int,
    COALESCE(SUM(amount), 0)::bigint
  INTO
    v_first_amt, v_first_cnt,
    v_second_amt, v_second_cnt,
    v_extra_amt, v_extra_cnt,
    v_refund_sum, v_refund_cnt,
    v_total_paid
  FROM usoln_engineer_payouts
  WHERE tenant_id = c_tenant AND work_month = p_work_month;

  RETURN jsonb_build_object(
    'ok',          true,
    'work_month',  p_work_month,
    'rounds', jsonb_build_object(
      '1차', jsonb_build_object('amount', v_first_amt,  'count', v_first_cnt),
      '2차', jsonb_build_object('amount', v_second_amt, 'count', v_second_cnt),
      '추가', jsonb_build_object('amount', v_extra_amt,  'count', v_extra_cnt)
    ),
    'refund', jsonb_build_object('amount', v_refund_sum, 'count', v_refund_cnt),
    'total_paid',  v_total_paid   -- 환불 포함 net
  );
END;
$$;

GRANT EXECUTE ON FUNCTION usoln_payouts_summary(text, uuid) TO anon, authenticated;

-- ============================================
COMMENT ON FUNCTION mark_usoln_payout_by_month(text, text, uuid) IS
  '유솔N 작업월 단위 일괄 지급 (회차 명시). payouts row INSERT + engineer_settled_at stamp.';
COMMENT ON FUNCTION mark_usoln_payout_by_item(uuid, text, int, uuid, text) IS
  '유솔N 단건 지급 (추가 회차 / 노일건 등). 금액 명시.';
COMMENT ON FUNCTION refund_usoln_payout(uuid, text, int, uuid, text) IS
  '유솔N 환불/회수 — 음수 amount row INSERT (is_refund=true). engineer_settled_at 손대지 않음.';
COMMENT ON FUNCTION usoln_payouts_summary(text, uuid) IS
  '유솔N 작업월 회차별 지급 집계 (1차/2차/추가 + 환불). UI 표시용.';

COMMIT;

-- ============================================
-- Verify (별도 실행)
-- ============================================
-- 1) 테이블 + 인덱스 확인:
-- \d+ usoln_engineer_payouts
-- 기대: 4 인덱스 (task_item / engineer_month / month_round / paid_at), RLS enabled.
--
-- 2) 4 RPC 등록 확인:
-- SELECT proname, obj_description(oid, 'pg_proc') AS note
-- FROM pg_proc
-- WHERE proname IN (
--   'mark_usoln_payout_by_month',
--   'mark_usoln_payout_by_item',
--   'refund_usoln_payout',
--   'usoln_payouts_summary'
-- ) ORDER BY proname;
-- 기대: 4 rows.
--
-- 3) ROLLBACK 안전 테스트 — 5월 1차 일괄 지급 시뮬레이션:
-- BEGIN;
--   SELECT mark_usoln_payout_by_month('2026-05', '1차',
--     '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- ROLLBACK;
-- 기대: { ok:true, count: N, total_amount: M }
--
-- 4) summary 확인 (지급 전):
-- SELECT usoln_payouts_summary('2026-05',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid);
-- 기대 (백필 전): rounds 전부 amount=0, count=0.
