-- ============================================================================
-- Migration 189 — 견적 항목 수정 시 tasks.product_price 재동기 + 재계산
-- 작성 : 2026-07-24
-- 의존 : 153 (admin_update/insert_task_item), 173 (compute_error), 177 (compute v26)
--
-- 문제 (사장님 리포트 — 위례광장로 2220, 냉매 1way ×2):
--   ✏️ 견적 수정으로 항목 단가를 90,000 → 35,000 (합 180,000 → 70,000) 고침.
--   → task_items 트리거로 compute_payment 재계산은 돌았으나:
--       · 원청 수수료 24,500 = 새 견적 70,000 기준 ✓ (per-item 식)
--       · 기사 분배 108,000 = 옛 견적 180,000 × 60% ✗
--       · 회사 수익 47,500 = 180,000 − 108,000 − 24,500 ✗
--   원인: compute_payment 의 순수냉매 기사식(rate 분기)과 owner 식이
--         tasks.product_price 기준인데, Mig 153 RPC 는 task_items 만 수정하고
--         tasks.product_price(생성 시 총견적)는 안 건드림 → 180,000 잔존.
--
-- 수정:
--   [A] admin_update_task_item v2 — 항목 수정 후
--       tasks.product_price := 활성(비취소) task_items.subtotal 합 재동기
--       + compute_payment 명시 재호출 (173 패턴: 실패 시 compute_error 마킹).
--   [B] admin_insert_task_item v2 — 동일 재동기 추가.
--   [C] 백필 — Mig 153 으로 편집된 이력(task_changes change_type='items') 있는
--       작업 중 product_price ≠ 활성 items 합 & 송금 미확정 건 재동기 + 재계산.
--       (위례광장로 2220 건 포함)
--   [D] 검증.
-- ============================================================================

BEGIN;

-- ============================================================================
-- [A] admin_update_task_item v2 — qty / unit_price 수정 + product_price 재동기
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_update_task_item(
  p_actor      uuid,
  p_item_id    uuid,
  p_qty        numeric,
  p_unit_price int,
  p_note       text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id         uuid;
  v_tenant_id       uuid;
  v_principal_code  text;
  v_remit_confirmed timestamptz;
  v_payment_track   text;
  v_old_qty         numeric;
  v_old_unit_price  int;
  v_caller_name     text;
  v_items_sum       int;
  v_err_msg         text;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;
  IF p_note IS NULL OR LENGTH(TRIM(p_note)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', '변경 사유 5자 이상 필수');
  END IF;
  IF p_qty IS NOT NULL AND p_qty <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'qty > 0 필요');
  END IF;
  IF p_unit_price IS NOT NULL AND p_unit_price < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unit_price >= 0 필요');
  END IF;

  SELECT ti.task_id, ti.qty, ti.unit_price, t.tenant_id, p.code
    INTO v_task_id, v_old_qty, v_old_unit_price, v_tenant_id, v_principal_code
  FROM task_items ti
  JOIN tasks t ON t.id = ti.task_id
  LEFT JOIN principals p ON p.id = t.principal_id
  WHERE ti.id = p_item_id;

  IF v_task_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '항목 없음');
  END IF;

  SELECT engineer_remit_confirmed_at, track
    INTO v_remit_confirmed, v_payment_track
  FROM payments WHERE task_id = v_task_id;

  IF v_remit_confirmed IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '정산 송금 확인 완료 — 수정 불가');
  END IF;

  IF v_principal_code = 'usol_n' AND v_payment_track = 'B' THEN
    RETURN jsonb_build_object('ok', false, 'error', '유솔N 월정산 작업 — 수정 불가 (월정산 사이클)');
  END IF;

  SELECT name INTO v_caller_name FROM users WHERE id = p_actor;

  -- UPDATE (item 트리거가 1차 재계산 — 이 시점엔 product_price 아직 옛값)
  UPDATE task_items SET
    qty        = COALESCE(p_qty, qty),
    unit_price = COALESCE(p_unit_price, unit_price)
  WHERE id = p_item_id;

  -- ⭐ Mig 189 — tasks.product_price 재동기 (활성 항목 subtotal 합).
  --   냉매 기사식/owner 식이 product_price 기준 → 견적 수정이 분배에 반영되려면 필수.
  SELECT COALESCE(SUM(ti.subtotal), 0)::int INTO v_items_sum
  FROM task_items ti
  WHERE ti.task_id = v_task_id AND NOT COALESCE(ti.is_canceled, false);

  IF v_items_sum > 0 THEN
    UPDATE tasks SET product_price = v_items_sum WHERE id = v_task_id;
  END IF;

  -- ⭐ Mig 189 — 새 product_price 로 2차(확정) 재계산. 173 패턴 에러 마킹.
  BEGIN
    PERFORM compute_payment(v_task_id);
    UPDATE payments SET compute_error = NULL
    WHERE task_id = v_task_id AND compute_error IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    RAISE WARNING '[admin_update_task_item] recompute fail task=% err=%', v_task_id, v_err_msg;
    UPDATE payments SET compute_error = v_err_msg, computed_at = now()
    WHERE task_id = v_task_id;
  END;

  INSERT INTO task_changes (
    task_id, tenant_id, change_type,
    before_data, after_data, note,
    changed_by, changed_by_name
  ) VALUES (
    v_task_id, v_tenant_id, 'items',
    jsonb_build_object('action', 'update', 'item_id', p_item_id, 'qty', v_old_qty, 'unit_price', v_old_unit_price),
    jsonb_build_object('action', 'update', 'item_id', p_item_id, 'qty', COALESCE(p_qty, v_old_qty), 'unit_price', COALESCE(p_unit_price, v_old_unit_price), 'product_price_synced', v_items_sum),
    TRIM(p_note),
    p_actor, v_caller_name
  );

  RETURN jsonb_build_object('ok', true, 'task_id', v_task_id, 'product_price', v_items_sum);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_update_task_item(uuid, uuid, numeric, int, text) TO anon, authenticated;

-- ============================================================================
-- [B] admin_insert_task_item v2 — 항목 추가 + product_price 재동기
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_insert_task_item(
  p_actor             uuid,
  p_task_id           uuid,
  p_work_type_id      uuid,
  p_appliance_type_id uuid,
  p_qty               numeric,
  p_unit_price        int,
  p_order_type        text,
  p_note              text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id       uuid;
  v_principal_code  text;
  v_service_code    text;
  v_appliance_code  text;
  v_remit_confirmed timestamptz;
  v_payment_track   text;
  v_calc_check      jsonb;
  v_new_id          uuid;
  v_caller_name     text;
  v_items_sum       int;
  v_err_msg         text;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;
  IF p_note IS NULL OR LENGTH(TRIM(p_note)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', '변경 사유 5자 이상 필수');
  END IF;
  IF p_task_id IS NULL OR p_work_type_id IS NULL OR p_qty IS NULL OR p_unit_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_id / work_type_id / qty / unit_price 필요');
  END IF;
  IF p_qty <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'qty > 0 필요');
  END IF;
  IF p_unit_price < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unit_price >= 0 필요');
  END IF;

  SELECT t.tenant_id, p.code
    INTO v_tenant_id, v_principal_code
  FROM tasks t LEFT JOIN principals p ON p.id = t.principal_id
  WHERE t.id = p_task_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  SELECT engineer_remit_confirmed_at, track
    INTO v_remit_confirmed, v_payment_track
  FROM payments WHERE task_id = p_task_id;

  IF v_remit_confirmed IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '정산 송금 확인 완료 — 수정 불가');
  END IF;

  IF v_principal_code = 'usol_n' AND v_payment_track = 'B' THEN
    RETURN jsonb_build_object('ok', false, 'error', '유솔N 월정산 작업 — 수정 불가');
  END IF;

  SELECT st.code INTO v_service_code
  FROM work_types wt
  JOIN service_types st ON st.id = wt.service_type_id
  WHERE wt.id = p_work_type_id;

  IF v_service_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_type 없음 또는 service_type 매핑 실패');
  END IF;

  IF p_appliance_type_id IS NOT NULL THEN
    SELECT code INTO v_appliance_code FROM appliance_types WHERE id = p_appliance_type_id;
  END IF;

  v_calc_check := calculate_commission(
    v_principal_code,
    v_service_code,
    v_appliance_code,
    (p_unit_price * p_qty)::int,
    0,
    0,
    CASE WHEN p_order_type IN ('첫대','추가') THEN p_order_type ELSE NULL END
  );

  IF v_calc_check IS NULL OR NOT COALESCE((v_calc_check->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'policy_not_found',
      'detail', format(
        '정책 없음 — 원청 %s / 서비스 %s / 기종 %s',
        COALESCE(v_principal_code, '?'),
        COALESCE(v_service_code, '?'),
        COALESCE(v_appliance_code, '(없음)')
      )
    );
  END IF;

  SELECT name INTO v_caller_name FROM users WHERE id = p_actor;

  INSERT INTO task_items (
    task_id, work_type_id, appliance_type_id,
    qty, unit_price, order_type
  ) VALUES (
    p_task_id, p_work_type_id, p_appliance_type_id,
    p_qty, p_unit_price, NULLIF(TRIM(COALESCE(p_order_type, '')), '')
  )
  RETURNING id INTO v_new_id;

  -- ⭐ Mig 189 — tasks.product_price 재동기 + 확정 재계산 (A 와 동일).
  SELECT COALESCE(SUM(ti.subtotal), 0)::int INTO v_items_sum
  FROM task_items ti
  WHERE ti.task_id = p_task_id AND NOT COALESCE(ti.is_canceled, false);

  IF v_items_sum > 0 THEN
    UPDATE tasks SET product_price = v_items_sum WHERE id = p_task_id;
  END IF;

  BEGIN
    PERFORM compute_payment(p_task_id);
    UPDATE payments SET compute_error = NULL
    WHERE task_id = p_task_id AND compute_error IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    RAISE WARNING '[admin_insert_task_item] recompute fail task=% err=%', p_task_id, v_err_msg;
    UPDATE payments SET compute_error = v_err_msg, computed_at = now()
    WHERE task_id = p_task_id;
  END;

  INSERT INTO task_changes (
    task_id, tenant_id, change_type,
    before_data, after_data, note,
    changed_by, changed_by_name
  ) VALUES (
    p_task_id, v_tenant_id, 'items',
    NULL,
    jsonb_build_object(
      'action',            'insert',
      'item_id',           v_new_id,
      'work_type_id',      p_work_type_id,
      'appliance_type_id', p_appliance_type_id,
      'service_code',      v_service_code,
      'appliance_code',    v_appliance_code,
      'qty',               p_qty,
      'unit_price',        p_unit_price,
      'order_type',        p_order_type,
      'product_price_synced', v_items_sum
    ),
    TRIM(p_note),
    p_actor, v_caller_name
  );

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', v_new_id,
    'task_id', p_task_id,
    'product_price', v_items_sum
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_insert_task_item(uuid, uuid, uuid, uuid, numeric, int, text, text) TO anon, authenticated;

-- ============================================================================
-- [C] 백필 — 이미 편집돼 어긋난 작업 재동기 + 재계산
--   대상: task_changes(change_type='items') 이력 있음 (= Mig 153 RPC 로 편집)
--       + tasks.product_price ≠ 활성 items subtotal 합
--       + 송금 미확정 (engineer_remit_confirmed_at IS NULL)
--       + 비취소.
--   위례광장로 2220 건이 여기 포함됨.
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  v_fixed int := 0;
BEGIN
  FOR r IN
    SELECT t.id, t.task_no, t.customer_name, t.product_price,
           s.items_sum
    FROM tasks t
    JOIN LATERAL (
      SELECT COALESCE(SUM(ti.subtotal), 0)::int AS items_sum
      FROM task_items ti
      WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)
    ) s ON true
    LEFT JOIN payments p ON p.task_id = t.id
    WHERE t.id IN (SELECT DISTINCT task_id FROM task_changes WHERE change_type = 'items')
      AND t.status <> '취소'
      AND s.items_sum > 0
      AND COALESCE(t.product_price, 0) <> s.items_sum
      AND p.engineer_remit_confirmed_at IS NULL
  LOOP
    RAISE NOTICE '[189 백필] % (%) product_price % → %',
      r.task_no, r.customer_name, r.product_price, r.items_sum;
    UPDATE tasks SET product_price = r.items_sum WHERE id = r.id;
    BEGIN
      PERFORM compute_payment(r.id);
      UPDATE payments SET compute_error = NULL
      WHERE task_id = r.id AND compute_error IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[189 백필] recompute fail task=% err=%', r.task_no, SQLERRM;
      UPDATE payments SET compute_error = SQLERRM, computed_at = now()
      WHERE task_id = r.id;
    END;
    v_fixed := v_fixed + 1;
  END LOOP;
  RAISE NOTICE '[189 백필] 총 % 건 재동기 완료', v_fixed;
END $$;

COMMIT;

-- ============================================================================
-- [D] 검증 — 위례광장로 2220 건 (기대: product_price 70000 /
--     engineer 42000 안팎(요율 60%) / owner+principal 합 = 70000 - engineer)
-- ============================================================================
SELECT t.task_no, t.customer_name, t.product_price, t.received_total,
       p.engineer_amount, p.owner_amount, p.principal_amount,
       p.calc_method, p.compute_error, p.computed_at
FROM tasks t
LEFT JOIN payments p ON p.task_id = t.id
WHERE t.phone LIKE '%3432%2220%' OR t.customer_name LIKE '%위례광장로%2220%';
