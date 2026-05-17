-- 028_task_items_compute_trg.sql
-- 2026-05-17 — task_items 측 trigger 박음 (진짜 진짜 root cause)
-- 박힌 spec:
--   compute_payment_trg 측 — tasks 측만 박힘 (Migration 027 박은 spec 확장)
--   task_items 박힘 박은 spec 측 — 자동 compute 박지 X
--   → tasks INSERT 시 task_items 박지 X → policy 박지 X → engineer_amount NULL
--   → task_items 박은 후 → trigger 박지 X → 영원히 NULL
-- 박을 spec:
--   task_items 측 INSERT/UPDATE/DELETE trigger 박음
--   → task_id 측 task 박음 → compute_payment 박음

CREATE OR REPLACE FUNCTION trigger_compute_payment_from_items()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
BEGIN
  -- INSERT/UPDATE 측 — NEW.task_id 박음
  -- DELETE 측 — OLD.task_id 박음
  IF TG_OP = 'DELETE' THEN
    v_task_id := OLD.task_id;
  ELSE
    v_task_id := NEW.task_id;
  END IF;

  -- compute_payment 박음 (task 박지 X 박힐 spec 측 — 박지 X 박힐 spec 측 — exception swallow)
  BEGIN
    PERFORM compute_payment(v_task_id);
  EXCEPTION WHEN OTHERS THEN
    -- task_items 박지만 task 박지 X 박힐 spec (이론상 박지 X 박힐 spec) — 박을 spec 측 박지 X
    RAISE NOTICE '[task_items_compute_trg] compute_payment 박지 X: task_id=%, err=%', v_task_id, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS task_items_compute_trg ON task_items;
CREATE TRIGGER task_items_compute_trg
  AFTER INSERT OR UPDATE OR DELETE ON task_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_payment_from_items();

COMMENT ON TRIGGER task_items_compute_trg ON task_items IS
  'task_items 박힘 박은 spec 측 — 자동 compute_payment 박음 (진짜 root cause fix)';

-- ============================================
-- backfill — payments row 박지 X 박혀있거나 engineer_amount NULL 박힌 task 측
-- ============================================
SELECT compute_payment(t.id) AS payment_id, t.task_no, t.customer_name
FROM tasks t
LEFT JOIN payments p ON p.task_id = t.id
WHERE (p.id IS NULL OR p.engineer_amount IS NULL OR p.engineer_amount = 0)
  AND EXISTS (SELECT 1 FROM task_items WHERE task_id = t.id);

-- ============================================
-- 검증 SQL — trigger 박힌 spec catch
-- ============================================
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'task_items'
--   AND trigger_name = 'task_items_compute_trg';
--
-- 기대: INSERT / UPDATE / DELETE 박혀야 (3 row)

-- ============================================
-- 검증 SQL — 김아무 / 강남8888 측 박힘 catch
-- ============================================
-- SELECT
--   t.task_no, t.customer_name, t.status,
--   p.engineer_amount, p.principal_amount, p.owner_amount,
--   p.calc_method, p.is_balanced
-- FROM tasks t
-- LEFT JOIN payments p ON p.task_id = t.id
-- WHERE t.customer_name LIKE ANY (ARRAY['%강남8888%', '%김아무%']);
