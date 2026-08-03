-- ============================================================================
-- Migration 205 — sync_category_data_to_task_items v7: restore lost guards
-- Date : 2026-08-03
--
-- Incident (owner report, A-260802-082 이알음):
--   견적 수정 "종목 변경" (leak -> refrigerant) was applied 4 times.
--   Each time task_changes history was written, yet task_items stayed at
--   the reception snapshot (누설_투인원, 0원). product_price ended at 0.
--
-- Root cause (static diff of migration history):
--   · sync_task_items_trg fires AFTER UPDATE OF category_data, product_price
--     and rebuilds ALL task_items from category_data.workItems (reception
--     snapshot).
--   · Guard 3 ("workItems unchanged on UPDATE -> skip", Mig 069b/154/163)
--     prevented product_price-only updates from triggering the rebuild.
--   · Mig 182 (2026-07-15, visit_only skip) was based on the OLD v4 body,
--     silently DROPPING guard 3 and the v6 unknown-workType RAISE (Mig 163).
--   · Since then, every product_price sync (admin_update_task_item Mig 189,
--     admin_insert_task_item, admin_change_task_item_type Mig 201) revives
--     the reception snapshot and erases the edit — history says "changed",
--     data says "not changed".
--
-- Fix:
--   [1] v7 = full v6 body (Mig 163: guards 1/2/3 + unknown-workType RAISE)
--            + Mig 182 visit_only skip. Nothing else changed.
--   [2] Data repair for A-260802-082: rewrite category_data (workItems
--       snapshot + top labels) to refrigerant 2in1 140,000 confirmed by
--       owner, sync product_price in the same UPDATE. The v7 trigger then
--       rebuilds task_items correctly from the corrected snapshot, and we
--       recompute payments.
--   [3] Verify.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- [1] v7 — guards restored
-- ────────────────────────────────────────────────────────────────────────────
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
  -- Guard 0 (Mig 182) - visit_only tasks are managed by mark/unmark RPCs only.
  IF NEW.status = 'visit_only'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'visit_only') THEN
    RETURN NEW;
  END IF;

  -- Guard 1 (Mig 086) - recursion cutoff.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Guard 2 (Mig 069) - workItems key missing.
  IF NEW.category_data IS NULL OR NOT (NEW.category_data ? 'workItems') THEN
    RETURN NEW;
  END IF;

  -- Guard 3 (Mig 069b/154 - RESTORED, dropped by Mig 182) -
  --   workItems unchanged on UPDATE -> skip rebuild.
  --   This is what protects item edits (Mig 189/201 product_price sync)
  --   from being reverted to the reception snapshot.
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

    -- v6 (Mig 163 - RESTORED, dropped by Mig 182) - reject unknown workType.
    IF v_service_type_id IS NULL THEN
      RAISE EXCEPTION
        '알 수 없는 작업 유형: "%" — 접수 저장 거부. 유효한 작업 유형(세척 / 냉매충전 / 누설 / 설치 등) 을 선택해주세요.',
        COALESCE(v_work_type_label, '(빈 값)')
        USING HINT = 'parser 또는 UI 에서 매핑 안 된 workType 이 category_data.workItems 에 들어왔습니다.',
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
  'v7 (Migration 205, 2026-08-03) - restore guard 3 (workItems unchanged skip, '
  'Mig 069b/154) and v6 unknown-workType RAISE (Mig 163), both silently dropped '
  'by Mig 182 which was based on the old v4 body. Adds nothing new: '
  'v7 = v6 body + Mig 182 visit_only skip.';

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- [2] Data repair — A-260802-082 (owner confirmed: refrigerant 2in1, 140,000)
--     One UPDATE touches category_data + product_price together, so the v7
--     trigger rebuilds task_items from the corrected snapshot exactly once.
-- ────────────────────────────────────────────────────────────────────────────
BEGIN;

UPDATE tasks
   SET category_data = category_data
         || jsonb_build_object(
              'workType',  '냉매충전',
              'appliance', '투인원',
              'qty',       1,
              'workItems', jsonb_build_array(jsonb_build_object(
                'workType',  '냉매충전',
                'appliance', '투인원',
                'qty',       1,
                'quote',     140000
              ))
            ),
       product_price = 140000
 WHERE task_no = 'A-260802-082';

-- payments recompute (same pattern as Mig 189/201)
SELECT compute_payment(t.id)
FROM tasks t
WHERE t.task_no = 'A-260802-082';

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- [3] Verify — expect: item 냉매_투인원 / refrigerant / 투인원 / 1 x 140000,
--     product_price 140000, engineer_amount 70000 (allday 직영 50/50)
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  wt.name  AS item_worktype,
  st.code  AS item_service,
  ap.name  AS item_appliance,
  ti.qty, ti.unit_price, ti.subtotal,
  t.product_price, t.status,
  t.category_data->>'workType' AS cat_worktype,
  p.engineer_amount, p.owner_amount,
  (SELECT obj_description(oid, 'pg_proc')
     FROM pg_proc WHERE proname = 'sync_category_data_to_task_items') AS trigger_version
FROM tasks t
JOIN task_items ti        ON ti.task_id = t.id
LEFT JOIN work_types wt       ON wt.id = ti.work_type_id
LEFT JOIN service_types st    ON st.id = wt.service_type_id
LEFT JOIN appliance_types ap  ON ap.id = ti.appliance_type_id
LEFT JOIN payments p          ON p.task_id = t.id
WHERE t.task_no = 'A-260802-082';
