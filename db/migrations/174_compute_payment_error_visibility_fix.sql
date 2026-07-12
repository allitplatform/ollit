-- ============================================================================
-- Migration 174 — Mig 173 부작용 정정 (NOT NULL 위반 → 저장 실패 차단)
-- 작성 : 2026-07-12
-- 의존 : Mig 173 (compute error 가시화)
--
-- 문제 (사장님 리포트, 긴급):
--   Mig 173 trigger 안 stub INSERT 가 engineer_amount/principal_amount/owner_amount
--   NULL 로 저장 시도 → payments 테이블 NOT NULL 제약 위반 → INSERT 실패 →
--   task_items INSERT rollback → tasks INSERT rollback → 접수 저장 자체가 실패.
--
--   에러 예:
--     null value in column "engineer_amount" of relation "payments"
--     violates not-null constraint
--
-- 원인:
--   173 spec 의 stub row 로 NULL amount 를 넣으면 UI 가 '분배 미계산' 배너 표시,
--   그러나 payments.engineer_amount / principal_amount / owner_amount 은
--   NOT NULL 컬럼 → INSERT 자체 실패.
--
-- 수정:
--   stub INSERT 에 amount 3개를 0 으로 채움. compute_error 컬럼 만이 실질 마킹.
--   UI 배너 조건은 컴포넌트 안 compute_error IS NOT NULL 또는 paymentMissing 검사
--   이므로 0/0/0 이라도 배너는 정상 표시.
--
--   원래 Mig 173 의도 (작업 저장 살리고 배너만 뜨기) 그대로 복원.
--
-- 변경 최소:
--   Mig 173 함수 2개 (trigger_compute_payment / trigger_compute_payment_from_items)
--   재정의. stub INSERT 3줄만 NULL → 0.
-- ============================================================================

BEGIN;

-- ── [1] trigger_compute_payment (tasks status/extra_fee 등 변경 시) ──────
CREATE OR REPLACE FUNCTION trigger_compute_payment()
RETURNS trigger AS $$
DECLARE
  v_err_msg text;
BEGIN
  IF NEW.status = '완료' AND (OLD.status IS NULL OR OLD.status <> '완료') THEN
    BEGIN
      PERFORM compute_payment(NEW.id);
      UPDATE payments SET compute_error = NULL
      WHERE task_id = NEW.id AND compute_error IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      v_err_msg := SQLERRM;
      RAISE WARNING '[compute_payment_trg] task=% error=%', NEW.id, v_err_msg;
      IF EXISTS (SELECT 1 FROM payments WHERE task_id = NEW.id) THEN
        UPDATE payments
        SET compute_error = v_err_msg,
            computed_at   = now()
        WHERE task_id = NEW.id;
      ELSE
        INSERT INTO payments (
          task_id, computed_by,
          product_price, extra_fee, travel_fee, naver_fee,
          engineer_amount, principal_amount, owner_amount,
          status, track, compute_error, computed_at
        ) VALUES (
          NEW.id, auth.uid(),
          COALESCE(NEW.product_price, 0), COALESCE(NEW.extra_fee, 0),
          COALESCE(NEW.travel_fee, 0), 0,
          0, 0, 0,                        -- 2026-07-12 v3 (Mig 174) — NULL → 0.
          '미정산', 'A', v_err_msg, now()
        );
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── [2] trigger_compute_payment_from_items (task_items 변경 시) ──────────
CREATE OR REPLACE FUNCTION trigger_compute_payment_from_items()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
  v_err_msg text;
  v_task    tasks%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_task_id := OLD.task_id;
  ELSE
    v_task_id := NEW.task_id;
  END IF;

  BEGIN
    PERFORM compute_payment(v_task_id);
    UPDATE payments SET compute_error = NULL
    WHERE task_id = v_task_id AND compute_error IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    RAISE WARNING '[task_items_compute_trg] task=% error=%', v_task_id, v_err_msg;
    SELECT * INTO v_task FROM tasks WHERE id = v_task_id;
    IF v_task.id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    IF EXISTS (SELECT 1 FROM payments WHERE task_id = v_task_id) THEN
      UPDATE payments
      SET compute_error = v_err_msg,
          computed_at   = now()
      WHERE task_id = v_task_id;
    ELSE
      INSERT INTO payments (
        task_id, computed_by,
        product_price, extra_fee, travel_fee, naver_fee,
        engineer_amount, principal_amount, owner_amount,
        status, track, compute_error, computed_at
      ) VALUES (
        v_task_id, auth.uid(),
        COALESCE(v_task.product_price, 0), COALESCE(v_task.extra_fee, 0),
        COALESCE(v_task.travel_fee, 0), 0,
        0, 0, 0,                          -- 2026-07-12 v3 (Mig 174) — NULL → 0.
        '미정산', 'A', v_err_msg, now()
      );
    END IF;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;


COMMENT ON FUNCTION trigger_compute_payment() IS
  'v3 (Mig 174, 2026-07-12) — Mig 173 NULL amount NOT NULL 위반 정정. '
  'stub INSERT amount 3개 0 으로. compute_error 만 실질 마킹.';

COMMENT ON FUNCTION trigger_compute_payment_from_items() IS
  'v3 (Mig 174, 2026-07-12) — Mig 173 NULL amount NOT NULL 위반 정정. '
  'stub INSERT amount 3개 0 으로. compute_error 만 실질 마킹.';

COMMIT;
