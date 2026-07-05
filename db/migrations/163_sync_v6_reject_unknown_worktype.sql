-- ============================================================================
-- Migration 163 - sync_category_data_to_task_items v6 - reject unknown workType
-- Date    : 2026-07-05
-- Base    : Mig 154 v5 body (2026-06-28, live).
--
-- Problem case:
--   A-260704-011 (누설 접수 phantom): parser produced a workType string that
--   did not match any service_types.name. sync trigger continued silently:
--     v_service_type_id = NULL  (no matching row)
--     v_work_type_id    = NULL  (join anchored on v_service_type_id)
--     INSERT task_items (work_type_id = NULL, ...)
--   Result: task saved, but every aggregation joining task_items -> work_types
--   -> service_types produced NULL service_code. Dashboard filters, list rows,
--   and compute_payment silently dropped or mis-classified the task.
--   Operator did not see it in the leak bucket, re-received the same job
--   (A-260704-012), leaving 011 as a hidden duplicate.
--
-- Fix strategy:
--   Add a single RAISE inside the workItems loop, right after the
--   service_types name lookup. When v_service_type_id IS NULL, the trigger
--   aborts the surrounding transaction. tasks INSERT / UPDATE is reverted.
--   Front end reception form receives the SQL error and can prompt the
--   operator to pick a valid work type.
--
-- Why guard on service_type_id (NOT work_type_id):
--   Install 5 sub-types (신규설치 / 이전설치 / 철거 / 실외기중고교체 /
--   기계중고교체) are intentionally UI-only labels. work_types has no matching
--   row for them, so v_work_type_id may be NULL by design (see Mig 154 header
--   comments: "정책 install+null 매칭 → 분배 75/25"). Raising on
--   v_work_type_id NULL would regress install. Raising on v_service_type_id
--   NULL catches the 011 pattern (unknown workType top-level) while leaving
--   install's known-workType + unknown-appliance path intact.
--
-- Regression safety:
--   Every workType currently emitted by the parser (WORK_TYPES in
--   src/utils/receptionForm.js) already has a matching service_types row -
--   otherwise existing 세척 / 냉매충전 / 누설 / 설치 tasks would have been
--   failing for months. So the new RAISE only fires for out-of-set strings,
--   which today equals the bug set.
--
-- Guard chain preserved (all three from Mig 154 v5):
--   1) pg_trigger_depth() > 1              recursion cutoff (Mig 086)
--   2) workItems key missing               early RETURN (Mig 069)
--   3) IS NOT DISTINCT FROM unchanged      early RETURN (Mig 069b, Mig 154)
--
-- Related front-end change (same commit):
--   src/utils/receptionForm.js parseKakaoText workTypeMap adds "누수" ->
--   "누설" alias, so paste text that only says "누수" now produces the correct
--   workType and never triggers the new RAISE for that specific keyword.
--
-- Deployment:
--   CREATE OR REPLACE FUNCTION (not SECURITY DEFINER, no plan-cache concern).
--   Trigger binding by function name is preserved.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION sync_category_data_to_task_items()
RETURNS trigger AS $$
DECLARE
  v_item              jsonb;
  v_work_type_id      uuid;
  v_appliance_type_id uuid;
  v_service_type_id   uuid;
  v_qty               numeric;
  v_unit_price        int;
  v_total_qty         numeric;
  v_avg_unit          int;
  v_order_type        text;
  v_description       text;
  v_work_type_label   text;
BEGIN
  -- Guard 1 (Mig 086) - recursion cutoff.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Guard 2 (Mig 069) - workItems key missing.
  IF NEW.category_data IS NULL OR NOT (NEW.category_data ? 'workItems') THEN
    RETURN NEW;
  END IF;

  -- Guard 3 (Mig 069b, Mig 154) - workItems unchanged on UPDATE.
  IF TG_OP = 'UPDATE'
     AND OLD.category_data IS NOT NULL
     AND (OLD.category_data ? 'workItems')
     AND (OLD.category_data->'workItems') IS NOT DISTINCT FROM (NEW.category_data->'workItems')
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM task_items WHERE task_id = NEW.id;
  END IF;

  SELECT COALESCE(SUM((it->>'qty')::numeric), 0)
    INTO v_total_qty
    FROM jsonb_array_elements(NEW.category_data->'workItems') AS it;

  IF v_total_qty > 0 THEN
    v_avg_unit := FLOOR(COALESCE(NEW.product_price, 0)::numeric / v_total_qty)::int;
  ELSE
    v_avg_unit := 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.category_data->'workItems')
  LOOP
    v_work_type_label := v_item->>'workType';

    SELECT id INTO v_service_type_id
    FROM service_types
    WHERE name = v_work_type_label
    LIMIT 1;

    -- v6 (Mig 163) - reject unknown workType. Aborts transaction so the caller
    -- sees the failure and can pick a valid work type instead of silently
    -- creating a phantom task with NULL work_type_id (A-260704-011 pattern).
    IF v_service_type_id IS NULL THEN
      RAISE EXCEPTION
        '알 수 없는 작업 유형: "%" — 접수 저장 거부. 유효한 작업 유형(세척 / 냉매충전 / 누설 / 설치 등) 을 선택해주세요.',
        COALESCE(v_work_type_label, '(빈 값)')
        USING HINT = 'parser 또는 UI 에서 매핑 안 된 workType 이 category_data.workItems 에 들어왔습니다. 해당 항목의 workType 을 확인하세요.',
              ERRCODE = 'check_violation';
    END IF;

    SELECT wt.id INTO v_work_type_id
    FROM work_types wt
    WHERE wt.service_type_id = v_service_type_id
      AND wt.name LIKE '%' || (v_item->>'appliance') || '%'
    LIMIT 1;

    SELECT id INTO v_appliance_type_id
    FROM appliance_types
    WHERE name = (v_item->>'appliance')
    LIMIT 1;

    v_qty := COALESCE((v_item->>'qty')::numeric, 1);

    v_unit_price := COALESCE(
      (v_item->>'quote')::int,
      v_avg_unit
    );

    v_order_type  := v_item->>'orderType';
    v_description := v_item->>'description';

    INSERT INTO task_items (
      task_id, work_type_id, appliance_type_id,
      qty, unit_price, order_type, description
    ) VALUES (
      NEW.id, v_work_type_id, v_appliance_type_id,
      v_qty, v_unit_price, v_order_type, v_description
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_category_data_to_task_items() IS
  'v6 (Migration 163, 2026-07-05) - reject unknown workType (service_types.name mismatch) '
  'with RAISE EXCEPTION inside workItems loop. Guards 1/2/3 preserved from v5. '
  'INSERT block (order_type from Mig 093 + description from Mig 154) unchanged. '
  'Install path unaffected: v_work_type_id NULL is still allowed when '
  'v_service_type_id is not null (5 sub-types intentionally unmatched at work_types level).';

COMMIT;

-- ============================================================================
-- Verify (run separately)
-- ============================================================================
--
-- A. Function comment shows v6:
-- SELECT proname, obj_description(oid, 'pg_proc') AS note
-- FROM pg_proc WHERE proname = 'sync_category_data_to_task_items';
--
-- B. Positive path - normal 누설 task INSERT still works:
-- BEGIN;
-- INSERT INTO tasks (id, tenant_id, principal_id, customer_name, address, product_price, category_data)
-- VALUES (
--   gen_random_uuid(),
--   '11111111-1111-1111-1111-111111111111',
--   (SELECT id FROM principals WHERE code='KA'),
--   '드라이런 누설', '드라이런 주소',
--   100000,
--   jsonb_build_object('workItems',
--     jsonb_build_array(jsonb_build_object('workType','누설','appliance','벽걸이','qty',1)))
-- );
-- ROLLBACK;
-- Expect: no error. task_items row created with non-null work_type_id.
--
-- C. Negative path - unknown workType is rejected:
-- BEGIN;
-- INSERT INTO tasks (id, tenant_id, principal_id, customer_name, address, product_price, category_data)
-- VALUES (
--   gen_random_uuid(),
--   '11111111-1111-1111-1111-111111111111',
--   (SELECT id FROM principals WHERE code='KA'),
--   '드라이런 누수 phantom', '드라이런 주소',
--   100000,
--   jsonb_build_object('workItems',
--     jsonb_build_array(jsonb_build_object('workType','누수','appliance','벽걸이','qty',1)))
-- );
-- ROLLBACK;
-- Expect: RAISE EXCEPTION with the unknown-workType message.
-- (After the paired parser fix in receptionForm.js, this scenario never
-- reaches sync trigger from parser output. The RAISE is defense-in-depth
-- for direct SQL / other entry points.)
--
-- D. Install path still works (positive control, unknown-appliance permitted):
-- BEGIN;
-- INSERT INTO tasks (id, tenant_id, principal_id, customer_name, address, product_price, category_data)
-- VALUES (
--   gen_random_uuid(),
--   '11111111-1111-1111-1111-111111111111',
--   (SELECT id FROM principals WHERE code='allday'),
--   '드라이런 설치', '드라이런 주소',
--   200000,
--   jsonb_build_object('workItems',
--     jsonb_build_array(jsonb_build_object('workType','설치','appliance','신규설치','qty',1)))
-- );
-- ROLLBACK;
-- Expect: no error. work_type_id may be NULL (install 5-sub-type policy),
-- but service_type_id is set, so the RAISE does NOT fire.
