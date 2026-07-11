-- ============================================================================
-- Migration 173 — compute_payment 실패 가시화 (조용한 실패 방지)
-- 작성 : 2026-07-11
-- 의존 :
--   · 016 (compute_payment_trg 정의)
--   · 028 (task_items_compute_trg 정의)
--   · 025 (payments 테이블)
--
-- 문제 (사장님 리포트, A-260711-032):
--   완료 작업인데 payments 분배 (기사/원청/회사) 전부 NULL.
--   원인 : commission_policies (KA, leak, 1way) row 없음
--        → calculate_commission 'policy_not_found'
--        → compute_payment RAISE EXCEPTION
--        → trigger 안 EXCEPTION WHEN OTHERS → swallow → payments 미생성
--        → UI 가 payments row 없어서 '분배 없음' 무음 표시.
--   같은 사고가 이전에도 발생 (KA 1way NULL 버그 등).
--
-- 옵션 D 채택 (사장님 spec):
--   조용히 넘기지 말 것. 실패 시 로그 + payments row (에러 마킹) + UI 경고 표시.
--
-- 변경:
--   [1] ALTER TABLE payments
--       ADD COLUMN compute_error text NULL.
--       - 정상 계산 시 NULL.
--       - 실패 시 마지막 에러 메시지 저장.
--       - UI 는 IS NOT NULL 이면 '분배 미계산' 배너 표시.
--
--   [2] trigger_compute_payment (Mig 016 fn 재정의):
--       - 원래: WARNING + swallow.
--       - 신규: WARNING + payments stub row (compute_error 세팅) INSERT or UPDATE.
--         · 정상 payments 못 만들었지만 이력·경고는 남김.
--         · 다음 계산 성공 시 compute_error 는 자동 NULL 로 (compute_payment 안 SET).
--
--   [3] trigger_compute_payment_from_items (Mig 028 fn 재정의):
--       - 원래: NOTICE + swallow.
--       - 신규: WARNING + payments stub row (compute_error 세팅) INSERT or UPDATE.
--
--   [4] compute_payment 자체는 무손 — RAISE EXCEPTION 그대로.
--       stub row 는 트리거가 catch 후 만듦.
--
-- 회귀 방지:
--   · 정상 성공 경로: compute_payment 정상 완료 → stub 로직 미실행 → 기존 동작.
--   · compute_error 컬럼 추가는 nullable → 기존 payments row 무해.
--   · UNIQUE(task_id, track) 인덱스 있는 경우 UPSERT ON CONFLICT.
--
-- 사장님 실행 순서:
--   1. Supabase 에서 본 파일 실행.
--   2. ad-hoc_2026-07-11_leak_policy_diag.sql [A-1]~[A-6] 실행 → 결과 리포트.
--   3. leak 정책 INSERT (별 파일, 진단 결과 확인 후).
--   4. compute_payment(A-260711-032 id) 재호출로 payments 재생성.
-- ============================================================================

BEGIN;

-- ── [1] payments.compute_error 컬럼 추가 ────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS compute_error text;

COMMENT ON COLUMN payments.compute_error IS
  '2026-07-11 Mig 173 — 마지막 compute_payment 실패 원인. NULL = 정상. '
  'NOT NULL = 정책 없음 / 계산 실패 등, UI 는 분배 미계산 배너 표시.';


-- ── [2] trigger_compute_payment (tasks status/extra_fee 등 변경 시) ──────
CREATE OR REPLACE FUNCTION trigger_compute_payment()
RETURNS trigger AS $$
DECLARE
  v_err_msg text;
BEGIN
  -- 원래 조건: status가 '완료' 로 변경된 경우.
  IF NEW.status = '완료' AND (OLD.status IS NULL OR OLD.status <> '완료') THEN
    BEGIN
      PERFORM compute_payment(NEW.id);
      -- 성공 시 compute_error 는 compute_payment 내부에서 UPDATE 하지 않으므로
      -- 옛 에러 마킹이 남아있으면 그대로. 명시적으로 NULL 로 초기화.
      UPDATE payments SET compute_error = NULL
      WHERE task_id = NEW.id AND compute_error IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      v_err_msg := SQLERRM;
      RAISE WARNING '[compute_payment_trg] task=% error=%', NEW.id, v_err_msg;
      -- stub row — 최소 필드 + compute_error.
      -- 이미 있으면 compute_error 만 UPDATE.
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
          NULL, NULL, NULL,
          '미정산', 'A', v_err_msg, now()
        );
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── [3] trigger_compute_payment_from_items (task_items 변경 시) ──────────
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
    -- 성공 시 옛 에러 마킹 초기화.
    UPDATE payments SET compute_error = NULL
    WHERE task_id = v_task_id AND compute_error IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    RAISE WARNING '[task_items_compute_trg] task=% error=%', v_task_id, v_err_msg;
    -- stub row 마킹 (task 정보는 참조하되 amount 는 NULL).
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
        NULL, NULL, NULL,
        '미정산', 'A', v_err_msg, now()
      );
    END IF;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;


COMMENT ON FUNCTION trigger_compute_payment() IS
  'v2 (Mig 173, 2026-07-11) — compute_payment 실패 시 payments stub row 생성 + compute_error 마킹. '
  '조용한 실패 방지 (사장님 spec).';

COMMENT ON FUNCTION trigger_compute_payment_from_items() IS
  'v2 (Mig 173, 2026-07-11) — compute_payment 실패 시 payments stub row 생성 + compute_error 마킹. '
  '조용한 실패 방지 (사장님 spec).';

COMMIT;


-- ============================================================================
-- 검증 SQL
-- ============================================================================
--
-- A. 컬럼 확인
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'payments' AND column_name = 'compute_error';
--
-- B. 함수 comment 확인
-- SELECT proname, obj_description(oid, 'pg_proc') AS note
-- FROM pg_proc WHERE proname IN ('trigger_compute_payment', 'trigger_compute_payment_from_items');
-- 기대: 'v2 (Mig 173, 2026-07-11) ...'
--
-- C. A-260711-032 재계산 시나리오 (leak 정책 없는 상태에서 확인용):
-- SELECT compute_payment(id) FROM tasks WHERE task_no = 'A-260711-032';
-- → RAISE EXCEPTION 예상.
-- SELECT engineer_amount, principal_amount, owner_amount, compute_error
-- FROM payments WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'A-260711-032');
-- 기대: engineer_amount=NULL, compute_error='calculate_commission failed: {...policy_not_found...}'.
--
-- D. 정책 INSERT 후 재계산 → compute_error 자동 NULL:
-- (leak 정책 INSERT 완료 후)
-- UPDATE task_items SET updated_at = now()
-- WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'A-260711-032') LIMIT 1;
-- → task_items_compute_trg 발화 → compute_payment 성공 → compute_error = NULL.
--
-- ============================================================================
-- 롤백
-- ============================================================================
-- BEGIN;
--   -- 컬럼 제거 (있으면):
--   ALTER TABLE payments DROP COLUMN IF EXISTS compute_error;
--   -- 함수 v1 재적용: Mig 016 / 028 재실행.
-- COMMIT;
