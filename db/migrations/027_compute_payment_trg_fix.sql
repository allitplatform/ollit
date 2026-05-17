-- 027_compute_payment_trg_fix.sql
-- 2026-05-17 — compute_payment trigger 박은 spec 강화 (진짜 root cause)
-- 박힌 spec:
--   AFTER INSERT OR UPDATE OF status ON tasks
--   → extra_fee / product_price / total_amount 박은 spec 측 박지 X
--   → 작업 입력 측 extra_fee 박은 spec 측 — payments row 박지 X 박힐 spec
--   → INSERT 측 — timing 박힐 spec (task_items 박힌 spec 측 박지 X 박을 spec)
-- 박을 spec:
--   AFTER INSERT OR UPDATE OF status, extra_fee, product_price, total_amount, completed_at
--   → 박은 spec 측 자동 재계산

DROP TRIGGER IF EXISTS compute_payment_trg ON tasks;
CREATE TRIGGER compute_payment_trg
  AFTER INSERT OR UPDATE OF status, extra_fee, product_price, total_amount, completed_at
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_payment();

COMMENT ON TRIGGER compute_payment_trg ON tasks IS
  '작업 INSERT, status / extra_fee / product_price / total_amount / completed_at 변경 시 자동 재계산';

-- ============================================
-- backfill — payments row 박지 X 박힌 task 측 수동 compute
-- ============================================
SELECT compute_payment(id) AS payment_id, task_no, customer_name
FROM tasks
WHERE id NOT IN (SELECT task_id FROM payments WHERE task_id IS NOT NULL)
  AND status IN ('진행중', '완료', '취소');

-- ============================================
-- 검증 SQL — trigger 박힌 spec catch
-- ============================================
-- SELECT trigger_name, event_manipulation, action_statement, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'tasks'
--   AND trigger_name = 'compute_payment_trg';
--
-- 기대: AFTER INSERT, AFTER UPDATE OF 박은 spec 측 — 5 컬럼 박혀야

-- ============================================
-- 검증 SQL — 강남8888 측 payments row 박혀있나
-- ============================================
-- SELECT
--   t.task_no, t.customer_name,
--   p.engineer_amount, p.principal_amount, p.owner_amount,
--   p.calc_method, p.is_balanced
-- FROM tasks t
-- LEFT JOIN payments p ON p.task_id = t.id
-- WHERE t.customer_name LIKE '%강남8888%';
--
-- 기대: engineer_amount = 100000 (Migration 022 / 024 정책 박은 spec)
