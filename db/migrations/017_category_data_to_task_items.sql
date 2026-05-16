-- 017_category_data_to_task_items.sql
-- 2026-05-16 — category_data JSON → task_items 자동 변환 trigger
-- F3 옵션: frontend 변경 없이 DB에서 자동 채움

CREATE OR REPLACE FUNCTION sync_category_data_to_task_items()
RETURNS trigger AS $$
DECLARE
  v_item jsonb;
  v_work_type_id uuid;
  v_appliance_type_id uuid;
  v_service_type_id uuid;
  v_qty numeric;
  v_unit_price int;
BEGIN
  -- UPDATE 시 기존 task_items 삭제 (재생성)
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM task_items WHERE task_id = NEW.id;
  END IF;

  -- category_data.workItems가 없으면 skip
  IF NEW.category_data IS NULL OR NOT (NEW.category_data ? 'workItems') THEN
    RETURN NEW;
  END IF;

  -- workItems 배열 순회
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.category_data->'workItems')
  LOOP
    -- 한글 workType → service_type_id 찾기
    SELECT id INTO v_service_type_id
    FROM service_types
    WHERE name = (v_item->>'workType')
    LIMIT 1;

    -- service_type_id로 work_type_id 찾기 (appliance도 일치하는 거)
    SELECT wt.id INTO v_work_type_id
    FROM work_types wt
    WHERE wt.service_type_id = v_service_type_id
      AND wt.name LIKE '%' || (v_item->>'appliance') || '%'
    LIMIT 1;

    -- 한글 appliance → appliance_type_id
    SELECT id INTO v_appliance_type_id
    FROM appliance_types
    WHERE name = (v_item->>'appliance')
    LIMIT 1;

    -- qty와 unit_price
    v_qty := COALESCE((v_item->>'qty')::numeric, 1);
    v_unit_price := COALESCE(
      (v_item->>'quote')::int,
      NEW.product_price,
      0
    );

    -- task_items insert (NULL 가능)
    INSERT INTO task_items (
      task_id, work_type_id, appliance_type_id, qty, unit_price
    ) VALUES (
      NEW.id, v_work_type_id, v_appliance_type_id, v_qty, v_unit_price
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_task_items_trg ON tasks;
CREATE TRIGGER sync_task_items_trg
  AFTER INSERT OR UPDATE OF category_data, product_price ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION sync_category_data_to_task_items();
