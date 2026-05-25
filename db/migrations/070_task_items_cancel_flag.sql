-- ============================================================================
-- Migration 070 — task_items 품목 단위 취소 플래그 + subtotal 재정의 + 동기 트리거
-- 작성: 2026-05-25
-- 상태: 초안 (사장님 검토 대기 — 적용 X)
-- ============================================================================
-- 배경:
--   '부분완료'(Migration 068 + EngineerTaskCompletionScreens)가 task_items.qty=0
--   으로 취소 품목을 표현. compute_payment는 정확히 재계산되나 다음 3개 컬럼이
--   미정정 — '반쪽 반영' 현상:
--     · task_items.customer_paid_amount (고객결제) — 원본 그대로
--     · task_items.net_amount            (네이버 정산금액) — 원본 그대로
--     · tasks.product_price              (작업 합계) — 원본 그대로
--   결과: 원청 화면 SettleDetailBox 합계가 취소 전 금액으로 보임.
--
-- 사장님 spec (Round 1 / ⑦-a):
--   · is_canceled 플래그로 표현 — qty는 원본 의뢰 수량 보존.
--   · is_canceled=true → subtotal·customer_paid_amount·net_amount = 0.
--   · tasks.product_price = SUM(미취소 품목 subtotal).
--
-- 변경 (한 트랜잭션):
--   [1] task_items: is_canceled / canceled_reason / canceled_at 컬럼 추가.
--   [2] task_items.subtotal GENERATED 식 재정의 — DROP COLUMN + ADD COLUMN.
--       새 식: CASE WHEN is_canceled THEN 0 ELSE (qty * unit_price)::int END
--   [3] 새 트리거 task_items_partial_sync_trg:
--       · BEFORE INSERT/UPDATE: is_canceled=true → customer_paid_amount, net_amount
--         원본을 metadata._pre_cancel_paid / _pre_cancel_net 에 백업 후 0 강제.
--         is_canceled=false 복원 시 metadata 백업값 복구.
--       · AFTER INSERT/UPDATE/DELETE: tasks.product_price 재합산 (미취소 SUM).
--
-- 의존 점검 (사전 조사 결과):
--   · subtotal 참조 view: 없음 (tasks_partner_view 측 subtotal 미참조)
--   · subtotal 참조 함수: compute_payment v11~v14 (046/048/049/050) + 065
--       모두 plpgsql — 동적 컬럼 참조라 DROP+ADD 후 첫 호출 시 재해석. 트랜잭션
--       내 DROP→ADD라 안전.
--   · 클라이언트(src/lib/principalSettleDb.js)는 SELECT만 — DB 변경 무영향.
--
-- 회귀 방지:
--   · is_canceled DEFAULT false — 기존 행 무영향 (자연스레 옛 식과 동일)
--   · subtotal GENERATED STORED — 자동 재계산
--   · tasks.product_price 자동 동기는 task_items 변경 시점에만 → race 없음
--     (017/069 sync_task_items_trg 는 tasks.category_data.workItems 변경 시만
--      발화 — 무한 루프 X)
--
-- 후속:
--   071_compute_payment_v15_is_canceled.sql — FOR LOOP 측 is_canceled=false 필터
--     추가 (qty × unit_price 직접 산출 분기에서 미취소만 사용).
--   072_backfill_partial_cancel.sql — 기존 qty=0 행을 is_canceled=true 로 정정
--     + qty 원본 복구 + customer_paid_amount/net_amount 0 + metadata 백업.
--
-- 실행: 사장님 OK 후 Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run.
-- 재실행: idempotent (IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE).
-- ============================================================================

BEGIN;

-- ============================================
-- [1] 컬럼 추가
-- ============================================
ALTER TABLE task_items
  ADD COLUMN IF NOT EXISTS is_canceled     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_reason text,
  ADD COLUMN IF NOT EXISTS canceled_at     timestamptz;

COMMENT ON COLUMN task_items.is_canceled IS
  '품목 단위 취소 플래그. true 시 subtotal/customer_paid_amount/net_amount = 0 강제. qty는 원본 보존.';
COMMENT ON COLUMN task_items.canceled_reason IS
  '품목 취소 사유 (자유 텍스트 또는 ID — 사장님 spec 추후 확장).';
COMMENT ON COLUMN task_items.canceled_at IS '품목 취소 시각.';

-- ============================================
-- [2] subtotal GENERATED 식 재정의 (DROP + ADD)
-- ============================================
-- 옛 식: (qty * unit_price)::int
-- 새 식: CASE WHEN is_canceled THEN 0 ELSE (qty * unit_price)::int END
-- 의존 view 없음 + plpgsql 함수는 동적 참조 — 트랜잭션 내 DROP→ADD 안전.
ALTER TABLE task_items DROP COLUMN IF EXISTS subtotal;
ALTER TABLE task_items
  ADD COLUMN subtotal int GENERATED ALWAYS AS (
    CASE WHEN COALESCE(is_canceled, false)
         THEN 0
         ELSE (qty * unit_price)::int
    END
  ) STORED;

COMMENT ON COLUMN task_items.subtotal IS
  'qty × unit_price (취소 품목은 0). GENERATED STORED.';

-- ============================================
-- [3] BEFORE 트리거 — is_canceled 진입/복원 시 customer_paid_amount / net_amount 동기
-- ============================================
CREATE OR REPLACE FUNCTION trigger_task_items_partial_sync_before()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_was_canceled boolean;
  v_now_canceled boolean;
  v_pre_paid     int;
  v_pre_net      int;
BEGIN
  v_now_canceled := COALESCE(NEW.is_canceled, false);
  v_was_canceled := CASE WHEN TG_OP = 'UPDATE'
                         THEN COALESCE(OLD.is_canceled, false)
                         ELSE false
                    END;

  -- (a) false → true (취소 진입): 원본 백업 후 0 강제
  IF v_now_canceled AND NOT v_was_canceled THEN
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
                    || jsonb_build_object(
                         '_pre_cancel_paid', COALESCE(NEW.customer_paid_amount, NULL),
                         '_pre_cancel_net',  COALESCE(NEW.net_amount,           NULL)
                       );
    NEW.customer_paid_amount := 0;
    NEW.net_amount           := 0;
    IF NEW.canceled_at IS NULL THEN
      NEW.canceled_at := now();
    END IF;
  END IF;

  -- (b) true → false (취소 해제): metadata 백업값 복구
  IF v_was_canceled AND NOT v_now_canceled THEN
    v_pre_paid := NULLIF(NEW.metadata->>'_pre_cancel_paid', '')::int;
    v_pre_net  := NULLIF(NEW.metadata->>'_pre_cancel_net',  '')::int;
    IF v_pre_paid IS NOT NULL THEN NEW.customer_paid_amount := v_pre_paid; END IF;
    IF v_pre_net  IS NOT NULL THEN NEW.net_amount           := v_pre_net;  END IF;
    -- 백업 키 제거
    NEW.metadata := (COALESCE(NEW.metadata, '{}'::jsonb)
                     - '_pre_cancel_paid' - '_pre_cancel_net');
    NEW.canceled_at     := NULL;
    NEW.canceled_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_items_partial_sync_before_trg ON task_items;
CREATE TRIGGER task_items_partial_sync_before_trg
  BEFORE INSERT OR UPDATE ON task_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_items_partial_sync_before();

COMMENT ON TRIGGER task_items_partial_sync_before_trg ON task_items IS
  'is_canceled true/false 전환 시 customer_paid_amount/net_amount 동기. 원본은 metadata 백업.';

-- ============================================
-- [4] AFTER 트리거 — tasks.product_price 재합산 (미취소 subtotal SUM)
-- ============================================
-- ⚠️ 트리거 체인 안전 가드 (2026-05-25 추가):
--   compute_payment_trg (Mig 027): AFTER INSERT OR UPDATE OF status, extra_fee,
--     product_price, total_amount, completed_at ON tasks → compute_payment 호출.
--   sync_task_items_trg (Mig 017→069 안전화): cat.workItems 키 있을 때 task_items
--     DELETE/INSERT — 시나리오 B에서 무한 루프 위험.
--
--   본 트리거가 tasks.product_price 를 무조건 UPDATE 하면:
--     · compute_payment_trg 재발화 → compute_payment 중복 호출 (idempotent라 무해하나 낭비)
--     · sync_task_items_trg 재발화 가능 → task_items DELETE/INSERT → 본 트리거 재발화 → 루프!
--
--   해결: 새 합계 v_sum 이 옛 product_price 와 다를 때만 UPDATE.
--     동일 시 UPDATE 자체 미발생 → 후속 트리거 모두 미발화 → 절대 안전.
CREATE OR REPLACE FUNCTION trigger_task_items_resync_task_total()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_task_id uuid;
  v_sum     int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_task_id := OLD.task_id;
  ELSE
    v_task_id := NEW.task_id;
  END IF;

  -- subtotal 자체가 is_canceled=true 항목은 0이라 SUM(subtotal) 그대로 미취소 합.
  SELECT COALESCE(SUM(subtotal), 0)::int INTO v_sum
  FROM task_items WHERE task_id = v_task_id;

  -- ★ 가드: product_price 가 실제로 변경될 때만 UPDATE → 트리거 체인 차단.
  UPDATE tasks
     SET product_price = v_sum
   WHERE id = v_task_id
     AND COALESCE(product_price, -1) <> v_sum;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS task_items_resync_task_total_trg ON task_items;
CREATE TRIGGER task_items_resync_task_total_trg
  AFTER INSERT OR UPDATE OR DELETE ON task_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_items_resync_task_total();

COMMENT ON TRIGGER task_items_resync_task_total_trg ON task_items IS
  'task_items 변경 시 tasks.product_price = SUM(미취소 subtotal) 자동 동기.';

COMMIT;

-- ============================================
-- 검증 SQL (별도 실행)
-- ============================================
-- 1) 컬럼 존재 확인:
-- SELECT column_name, data_type, is_nullable, column_default, is_generated
-- FROM information_schema.columns
-- WHERE table_name='task_items'
--   AND column_name IN ('is_canceled','canceled_reason','canceled_at','subtotal')
-- ORDER BY column_name;
-- 기대: 4 row. subtotal is_generated='ALWAYS'.
--
-- 2) 트리거 등록 확인:
-- SELECT tgname FROM pg_trigger WHERE tgname IN (
--   'task_items_partial_sync_before_trg', 'task_items_resync_task_total_trg');
-- 기대: 2 row.
--
-- 3) 시뮬레이션 (테스트 task 측):
-- BEGIN;
--   -- (a) 신규 항목 — is_canceled false 기본
--   INSERT INTO task_items (task_id, work_type_id, qty, unit_price)
--     VALUES ('<test-task>', '<wt>', 1, 50000);
--   -- (b) 취소 진입
--   UPDATE task_items SET is_canceled = true, canceled_reason = 'test'
--     WHERE task_id = '<test-task>';
--   -- 기대: subtotal=0 / customer_paid_amount=0 / net_amount=0 /
--   --        metadata._pre_cancel_paid·_pre_cancel_net 백업 / tasks.product_price=0
--   -- (c) 취소 해제
--   UPDATE task_items SET is_canceled = false
--     WHERE task_id = '<test-task>';
--   -- 기대: subtotal 복원 / customer_paid_amount/net_amount 백업값 복구 / product_price 복원
-- ROLLBACK;
