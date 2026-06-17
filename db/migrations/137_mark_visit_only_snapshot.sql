-- ============================================
-- Migration 137 — mark_visit_only RPC 보강 (스냅샷 기록)
-- 작성일 : 2026-06-17
-- 의존   : Mig 054 / 099 / 111 (mark_visit_only 본문) + Mig 039 (task_changes)
--
-- 사장님 spec:
--   visit_only 전환 직전 현재 상태를 task_changes.before_data 에 JSON 스냅샷 기록.
--   기존 동작 (task_items 재구성 + tasks UPDATE + payments INSERT) 그대로.
--   신규 visit_only 부터 unmark_visit_only RPC (Mig 138) 가 자동 복원 가능.
--
-- 스냅샷 구조:
--   {
--     "task": {
--       "status", "product_price", "extra_fee", "travel_fee",
--       "received_total", "total_amount", "payment_method"
--     },
--     "task_items": [ { work_type_id, appliance_type_id, qty, unit_price,
--                       order_type, subtotal, received_amount, is_canceled,
--                       product_order_id }, ... ],
--     "payments":   [ { policy_key, calc_method, product_price, extra_fee,
--                       travel_fee, naver_fee, engineer_amount, principal_amount,
--                       owner_amount, track }, ... ]
--   }
--
-- task_changes 행:
--   change_type = 'visit_only' (ENUM 그대로, ALTER TYPE 불필요)
--   before_data = 스냅샷
--   after_data  = { "type":"mark", "reason":..., "memo":..., "markedAt":... }
--   note        = p_reason
--   changed_by  = auth.uid() (또는 NULL — 기사 PWA 익명 호출 시)
--
-- 회귀 보호:
--   · 본문 흐름 (DELETE items / UPDATE tasks / DELETE+INSERT payments) 변경 0
--   · task_changes INSERT 가 어떤 이유로든 실패해도 전체 트랜잭션 롤백 (정합 보장)
--   · CREATE OR REPLACE — 재실행 안전
--
-- 실행 : Supabase 콘솔 SQL Editor → 통째 → Run
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION mark_visit_only(
  p_task_id  uuid,
  p_reason   text,
  p_memo     text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task             tasks%ROWTYPE;
  v_visit_wt_id      uuid;
  v_task_snapshot    jsonb;
  v_items_snapshot   jsonb;
  v_payments_snapshot jsonb;
  v_snapshot         jsonb;
BEGIN
  -- ─── [0] task 존재 확인 ───
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  -- ─── [0.5] 스냅샷 수집 (변경 직전 — 신규 보강) ───
  --   task 스냅샷
  v_task_snapshot := jsonb_build_object(
    'status',         v_task.status,
    'product_price',  v_task.product_price,
    'extra_fee',      v_task.extra_fee,
    'travel_fee',     v_task.travel_fee,
    'received_total', v_task.received_total,
    'total_amount',   v_task.total_amount,
    'payment_method', v_task.payment_method
  );

  --   task_items 스냅샷 (전체 행)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'work_type_id',      ti.work_type_id,
      'appliance_type_id', ti.appliance_type_id,
      'qty',               ti.qty,
      'unit_price',        ti.unit_price,
      'order_type',        ti.order_type,
      'subtotal',          ti.subtotal,
      'received_amount',   ti.received_amount,
      'is_canceled',       COALESCE(ti.is_canceled, false),
      'product_order_id',  ti.product_order_id
    )
    ORDER BY ti.id
  ), '[]'::jsonb)
  INTO v_items_snapshot
  FROM task_items ti
  WHERE ti.task_id = p_task_id;

  --   payments 스냅샷 (전체 행)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'policy_key',       p.policy_key,
      'calc_method',      p.calc_method,
      'product_price',    p.product_price,
      'extra_fee',        p.extra_fee,
      'travel_fee',       p.travel_fee,
      'naver_fee',        p.naver_fee,
      'engineer_amount',  p.engineer_amount,
      'principal_amount', p.principal_amount,
      'owner_amount',     p.owner_amount,
      'track',            p.track,
      'status',           p.status
    )
  ), '[]'::jsonb)
  INTO v_payments_snapshot
  FROM payments p
  WHERE p.task_id = p_task_id;

  v_snapshot := jsonb_build_object(
    'task',       v_task_snapshot,
    'task_items', v_items_snapshot,
    'payments',   v_payments_snapshot
  );

  -- ─── [0.6] task_changes audit row 기록 (스냅샷 보존) ───
  --   change_type='visit_only' ENUM 그대로. after_data.type='mark' 로 mark/unmark 구분.
  INSERT INTO task_changes (
    task_id, tenant_id, change_type,
    before_data, after_data, note, changed_by
  ) VALUES (
    p_task_id, v_task.tenant_id, 'visit_only',
    v_snapshot,
    jsonb_build_object(
      'type',     'mark',
      'reason',   COALESCE(p_reason, ''),
      'memo',     COALESCE(p_memo, ''),
      'markedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    p_reason,
    auth.uid()
  );

  -- ─── [1] visit work_type 조회 ───
  SELECT id INTO v_visit_wt_id
    FROM work_types
    WHERE code = 'visit'
    LIMIT 1;
  IF v_visit_wt_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'visit work_type 시드 누락');
  END IF;

  -- ─── [2] 기존 task_items 제거 ───
  DELETE FROM task_items WHERE task_id = p_task_id;

  -- ─── [3] visit_fee row 신규 ───
  INSERT INTO task_items (task_id, work_type_id, appliance_type_id, qty, unit_price)
  VALUES (p_task_id, v_visit_wt_id, NULL, 1, 30000);

  -- ─── [4] tasks UPDATE — Mig 111 패턴 (received_total=NULL 로 trg_tasks_sync_extra_fee 가드 통과) ───
  UPDATE tasks SET
    status         = 'visit_only',
    product_price  = 0,
    extra_fee      = 0,
    travel_fee     = 30000,
    received_total = NULL,
    completed_at   = NOW(),
    category_data  = COALESCE(category_data, '{}'::jsonb)
                     || jsonb_build_object('visitOnly',
                          jsonb_build_object(
                            'reason',   COALESCE(p_reason, ''),
                            'memo',     COALESCE(p_memo, ''),
                            'markedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                          )),
    updated_at     = NOW()
  WHERE id = p_task_id;

  -- ─── [5] payments DELETE + visit 1행 INSERT (compute_payment 우회 — fallback 함정 회피) ───
  DELETE FROM payments WHERE task_id = p_task_id;

  INSERT INTO payments (
    task_id, computed_by,
    policy_key, calc_method,
    product_price, extra_fee, travel_fee, naver_fee,
    engineer_amount, principal_amount, owner_amount,
    status, track
  ) VALUES (
    p_task_id, auth.uid(),
    'common_visit_fee', '출장비_30K',
    0, 0, 30000, 0,
    30000, 0, 0,
    '미정산', 'A'
  );

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id);
END;
$$;

COMMENT ON FUNCTION mark_visit_only(uuid, text, text) IS
  '출장비만 처리 — task_items 재구성 + tasks UPDATE + payments INSERT. '
  'Mig 137 (2026-06-17): 전환 직전 task/items/payments 스냅샷을 task_changes.before_data 에 기록 → '
  'unmark_visit_only (Mig 138) 자동 복원 활용. Mig 111 received_total=NULL 패턴 유지.';

COMMIT;

-- ============================================
-- Verify (별도 실행)
-- ============================================
-- 1) RPC COMMENT 확인:
-- SELECT obj_description('mark_visit_only(uuid,text,text)'::regprocedure);
-- 기대: '... Mig 137 (2026-06-17): 전환 직전 ... 스냅샷 ...'

-- 2) 신규 visit_only 처리 시 task_changes 스냅샷 확인 (테스트 task 1건):
-- BEGIN;
--   SELECT mark_visit_only('<test_task_uuid>'::uuid, 'customer_absent', '테스트');
--   SELECT change_type,
--          jsonb_pretty(before_data) AS snapshot,
--          jsonb_pretty(after_data)  AS after_meta
--   FROM task_changes
--   WHERE task_id = '<test_task_uuid>'::uuid
--   ORDER BY changed_at DESC LIMIT 1;
-- ROLLBACK;
-- 기대:
--   change_type = 'visit_only'
--   before_data.task = { status, product_price, extra_fee, travel_fee, received_total, total_amount, payment_method }
--   before_data.task_items = [ N rows with work_type_id / appliance_type_id / qty / unit_price / order_type / ... ]
--   before_data.payments   = [ M rows with calc_method / engineer_amount / ... ]
--   after_data.type = 'mark'

-- 3) 기존 동작 무변경 확인 — 사장님 검증 case 동일 결과:
-- BEGIN;
--   SELECT mark_visit_only('<test_task_uuid>'::uuid, 'customer_absent', '');
--   SELECT task_no, status, product_price, extra_fee, travel_fee, received_total, total_amount
--   FROM tasks WHERE id = '<test_task_uuid>'::uuid;
-- ROLLBACK;
-- 기대: status='visit_only', product=0, extra=0, travel=30000, received_total=NULL, total=30000
