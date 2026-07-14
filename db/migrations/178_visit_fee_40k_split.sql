-- ============================================================================
-- Migration 178 — 출장비 4만원 + 60/40 실적용 (mark_visit_only v2 + 정책 금액)
-- 작성 : 2026-07-14 (사장님 spec — Mig 177 v26 과 세트)
--
-- 배경:
--   방문출장 처리는 compute_payment 를 우회하고 mark_visit_only RPC 가
--   금액(30,000)과 분배(기사 100%)를 직접 기록 → Mig 177 만으로는 안 바뀜.
--
-- 이 파일이 하는 것 (오늘 실행해도 안전 — 자정 자동 전환):
--   [1] mark_visit_only v2 — now() 게이트:
--       ~7/14 처리분: 30,000 / 기사 100% (기존 그대로)
--       7/15~ 처리분: 40,000 / 기사 24,000 · 회사 16,000
--   [2] commission_policies visit_fee 7줄 engineer_base 30,000 → 40,000
--       (KB 는 이미 40,000 — 그대로). compute_payment v26 이 7/15 이후
--       완료건에 ×0.6 적용 → 24,000 로 일관.
--
-- ⚠️ 알려진 한계 (실행 후):
--   7/15 이전 방문출장 건을 "재계산" 하면 정책이 40,000 기준이라 금액이 부풀 수
--   있음. 과거 방문출장 건은 재계산하지 말 것 (필요 시 수동 정정).
-- ============================================================================

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
  -- v2 (Mig 178) — 출장비 새 규칙: 2026-07-15 KST 부터 40,000 / 기사 60% · 회사 40%.
  v_new_rule         boolean;
  v_fee              int;
  v_eng              int;
  v_own              int;
BEGIN
  -- ─── [0] task 존재 확인 ───
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  -- v2 (Mig 178) — 처리 시각 기준 (completed_at = NOW() 이므로 동일 기준).
  v_new_rule := now() >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz;
  v_fee := CASE WHEN v_new_rule THEN 40000 ELSE 30000 END;
  v_eng := CASE WHEN v_new_rule THEN 24000 ELSE v_fee END;  -- 60% (FLOOR 불필요 — 고정액)
  v_own := v_fee - v_eng;                                    -- 40% (구 규칙이면 0)

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
  VALUES (p_task_id, v_visit_wt_id, NULL, 1, v_fee);  -- v2

  -- ─── [4] tasks UPDATE — Mig 111 패턴 (received_total=NULL 로 trg_tasks_sync_extra_fee 가드 통과) ───
  UPDATE tasks SET
    status         = 'visit_only',
    product_price  = 0,
    extra_fee      = 0,
    travel_fee     = v_fee,  -- v2
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
    0, 0, v_fee, 0,
    v_eng, 0, v_own,
    '미정산', 'A'
  );

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id);
END;
$$;

COMMENT ON FUNCTION mark_visit_only(uuid, text, text) IS
  'v2 (Mig 178, 2026-07-14): 출장비 새 규칙 — 2026-07-15 KST 부터 40,000 / 기사 24,000(60%) · 회사 16,000(40%). '
  '그 전 처리분은 기존 30,000 / 기사 100% (now() 게이트 — 자정 자동 전환). '
  'Mig 137 스냅샷 기록 / Mig 111 received_total=NULL 패턴 유지.';

-- [2] 정책 금액 — visit_fee 30,000 → 40,000 (KB 는 이미 40,000)
UPDATE commission_policies
SET engineer_base = 40000,
    notes = COALESCE(notes, '') || ' | 2026-07-15부터 출장비 40,000 (Mig 178)'
WHERE service_code = 'visit_fee'
  AND engineer_base = 30000;

COMMIT;

-- ============================================================================
-- 검증 (실행 후):
-- SELECT policy_key, engineer_base FROM commission_policies
-- WHERE service_code = 'visit_fee' ORDER BY policy_key;
--   → 전부 40000 이어야 함
-- SELECT obj_description('mark_visit_only(uuid,text,text)'::regprocedure);
--   → 'v2 (Mig 178 ...' 로 시작해야 함
-- ============================================================================
