-- 016_compute_payment_trigger.sql
-- 2026-05-16 — 작업 완료 시 compute_payment 자동 호출 trigger
-- 옵션 C 이중 안전망 중 #1 (DB layer)

CREATE OR REPLACE FUNCTION trigger_compute_payment()
RETURNS trigger AS $$
BEGIN
  -- status가 '완료'로 변경된 경우에만 실행
  IF NEW.status = '완료' AND (OLD.status IS NULL OR OLD.status != '완료') THEN
    BEGIN
      PERFORM compute_payment(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      -- 정책 미설정 등 에러 시에도 작업 완료는 통과
      -- WARNING 로그만 남기고 UPDATE는 rollback 안 함
      RAISE WARNING 'compute_payment failed for task %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS compute_payment_trg ON tasks;
CREATE TRIGGER compute_payment_trg
  AFTER UPDATE OF status ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_payment();
