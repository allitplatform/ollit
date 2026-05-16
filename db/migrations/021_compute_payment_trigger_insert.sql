-- 021_compute_payment_trigger_insert.sql
-- 2026-05-17 — INSERT 박은 spec 측도 compute_payment 박음
-- catch: Migration 016 측 AFTER UPDATE OF status만 박음, INSERT 박지 X
-- → 신규접수 시 또는 직접 완료 INSERT 시 payments 안 만들어짐

DROP TRIGGER IF EXISTS compute_payment_trg ON tasks;

CREATE TRIGGER compute_payment_trg
  AFTER INSERT OR UPDATE OF status ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_payment();

-- backfill: status='완료' 박은 spec 측 payments 박지 X 박은 spec
-- 사장님이 Supabase 측 직접 실행:
-- SELECT compute_payment(t.id)
-- FROM tasks t
-- LEFT JOIN payments p ON p.task_id = t.id
-- WHERE t.status = '완료' AND p.id IS NULL;
