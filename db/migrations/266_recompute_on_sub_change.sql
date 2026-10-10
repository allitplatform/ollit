-- ============================================================================
-- Migration 266 - 수행처(협력사)가 바뀌면 정산을 다시 계산
-- 작성 2026-10-10 · 선행: 265
--
-- 발견 (블록 79)
--   화이트코어로 넘긴 주방후드 미완료 작업 4건의 저장된 정산이 "직영_주방후드"(기사 65%) 로 남아 있었다.
--
-- 원인
--   정산 계산(compute_payment)은 (1) 작업이 완료로 바뀔 때 (2) 항목이 바뀔 때 (3) 금액을 고치는 함수 안에서 불린다.
--   협력사로 넘기기(admin_assign_task_to_subcontractor) · 직영으로 회수(admin_recall_sub_task) · 협력사 반려(sub_reject_task)는
--   tasks.subcontractor_id 만 바꾸고 다시 계산하지 않는다. 그래서 접수 때 직영 식으로 계산된 값이 그대로 남는다.
--   (완료 때는 (1) 로 다시 계산되어 협력사 식 · 보장 · 정액이 맞게 걸린다. 틀린 것은 완료 전의 예상 숫자뿐이다)
--
-- 바꾼 것
--   tasks.subcontractor_id 가 바뀌면 그 작업의 정산을 다시 계산하는 장치(트리거) 1개.
--   넘기기 · 회수 · 반려 · 협력사 변경 함수는 손대지 않았다 - 어느 길로 바뀌든 이 장치가 받는다.
--   · 정산이 이미 있는 작업만 다시 계산한다 (아직 한 번도 계산되지 않은 작업은 건드리지 않음).
--   · 취소된 작업은 건드리지 않는다.
--   · 계산이 실패해도(예: 그 협력사의 수수료 규칙이 없음) 넘기기 · 회수 자체는 막지 않는다.
--     실패 사유는 payments.compute_error 에 남는다 (운영자 작업 상세에 "정산 계산 오류" 로 보임. mig 173 의 방식).
--
-- 기존 데이터 영향: 없음 (이미 넘겨진 작업은 db/ops/recompute_sub_open.sql 로 따로 다시 계산).
-- 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION trg_tasks_recompute_on_sub_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_err text;
BEGIN
  IF NEW.subcontractor_id IS NOT DISTINCT FROM OLD.subcontractor_id THEN
    RETURN NULL;
  END IF;
  IF NEW.status IN ('취소', '취소요청') THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM payments p WHERE p.task_id = NEW.id) THEN
    RETURN NULL;
  END IF;

  BEGIN
    PERFORM compute_payment(NEW.id);
    UPDATE payments SET compute_error = NULL
     WHERE task_id = NEW.id AND compute_error IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    RAISE WARNING '[recompute_on_sub_change] task=% error=%', NEW.id, v_err;
    UPDATE payments SET compute_error = v_err, computed_at = now() WHERE task_id = NEW.id;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tasks_recompute_on_sub_change ON tasks;
CREATE TRIGGER tasks_recompute_on_sub_change
  AFTER UPDATE OF subcontractor_id ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_tasks_recompute_on_sub_change();

COMMIT;

-- 검증 - 기대: 한 줄, enabled = true
SELECT tgname AS trigger_name, tgenabled <> 'D' AS enabled
  FROM pg_trigger WHERE tgname = 'tasks_recompute_on_sub_change';
