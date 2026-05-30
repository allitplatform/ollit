-- ============================================
-- Migration 084 — task_items.received_amount + tasks 자동 sync (Phase C Step 1)
-- 작성일 : 2026-05-30
-- 범위   : task_items 새 컬럼 + AFTER 트리거 (items → tasks received_total/extra_fee sync) + 백필
--
-- 사장님 spec (2026-05-30):
--   Phase B 의 단일 tasks.received_total 흐름 → Phase C 의 task_items.received_amount
--   per-row 흐름으로 본질 전환. 메인 2개+ 시 각 work_type 측 독립 거래로 정책 정확 적용.
--   계기: A-260529-008 — 세척 + 냉매 추가금이 어떤 종류 측인지 구분 불가 문제.
--
-- 본 step 범위 (Step 1 만):
--   1) task_items.received_amount integer 컬럼 추가
--   2) trg_task_items_sync_received_total AFTER 트리거 — items 변경 시 tasks 자동 sync
--      · 가드 (principals.code = 'usol_n' OR tasks.payment_method = 'prepaid') 동일 적용
--      · 새 received_total = SUM(COALESCE(received_amount, subtotal, 0) WHERE NOT is_canceled)
--      · 새 extra_fee = GREATEST(received_total - product_price, 0)
--   3) 백필 — status != '완료' & 가드 외 작업 측 received_amount = subtotal
--
-- compute_payment 함수 본문 (cleaning_extra_applied 식 제거, row 측 received_amount 사용) 는
-- Phase C Step 2 별도 마이그레이션 산출.
--
-- Q&A 결정 (2026-05-30, 사장님 OK):
--   Q1 = B (status='완료' 백필 제외 — 확정 정산 보호)
--   Q2 = A (tasks.received_total 측 derived — items SUM 기준, trigger 자동 sync)
--   Q3 = A (메인 1개 케이스 측 row write 경로 — task_items.received_amount 측)
--
-- 트리거 발화 순서 (task_items 변경 시):
--   AFTER 트리거 2개 측 alphabetical 순:
--     1) task_items_a_sync_received_total_trg (본 084, "_a_" prefix → 먼저)
--        → tasks.received_total + extra_fee 자동 sync
--     2) task_items_compute_trg (Mig 028)
--        → compute_payment 호출 — 1) 의 fresh state 사용
--
-- 기존 트리거 측 호환:
--   · trg_tasks_sync_extra_fee (Phase B 083, BEFORE on tasks) 유지 —
--     동일 공식이라 idempotent. 본 084 트리거 측 tasks UPDATE 시 BEFORE 트리거가 한 번 더 발화하나
--     extra_fee 결과 동일 (안전망).
--   · compute_payment_trg (Mig 027/083, AFTER on tasks) 유지 — 본 084 트리거 측 tasks UPDATE 시
--     발화. compute_payment 함수 자체는 Step 2 에서 수정 예정.
--
-- 안전:
--   · ADD COLUMN IF NOT EXISTS — 재실행 안전
--   · CREATE OR REPLACE FUNCTION — 재실행 안전
--   · DROP IF EXISTS / CREATE TRIGGER — 재실행 안전
--   · 백필 가드: status='완료' 제외 → 확정 payments 보호
--   · 가드 케이스 (usol_n / prepaid) 의 task_items 측 received_amount NULL 유지
--   · is_canceled = true 측 NULL 유지 (SUM 측 0 으로 처리)
--
-- 회귀:
--   · 가드 (usol_n / prepaid) 동작 무변경
--   · status='완료' 작업 측 백필 영향 X — 확정 정산 보호
--   · status='진행중' / '확정' 등 in-flight 작업 측: task_items 변경 시 received_total 측 SUM 으로 재정렬.
--     사장님 spec — Phase C UI 측 row 측 받은 돈 다시 입력 (의도된 transition).
--
-- 재실행:
--   Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run.
-- ============================================

BEGIN;

-- ============================================
-- 1) 컬럼 추가
-- ============================================
ALTER TABLE public.task_items
  ADD COLUMN IF NOT EXISTS received_amount integer;

COMMENT ON COLUMN public.task_items.received_amount IS
  'row 측 받은 돈 (사용자 입력). NULL = 옛 흐름 fallback (subtotal). '
  '가드 케이스 (principals.code = usol_n OR tasks.payment_method = prepaid) 측 NULL 유지. '
  'SUM(COALESCE(received_amount, subtotal, 0) WHERE NOT is_canceled) → tasks.received_total 자동 derived.';

-- ============================================
-- 2) AFTER 트리거 함수 — task_items → tasks 자동 sync (가드 분기)
-- ============================================
CREATE OR REPLACE FUNCTION trg_task_items_sync_received_total()
RETURNS TRIGGER AS $$
DECLARE
  v_task_id        uuid;
  v_principal_code text;
  v_payment_method text;
  v_product_price  integer;
  v_new_received   integer;
BEGIN
  -- INSERT/UPDATE → NEW.task_id, DELETE → OLD.task_id
  v_task_id := COALESCE(NEW.task_id, OLD.task_id);
  IF v_task_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 가드 + product_price 동시 조회 (1 query)
  SELECT p.code, t.payment_method, t.product_price
    INTO v_principal_code, v_payment_method, v_product_price
    FROM public.tasks t
    LEFT JOIN public.principals p ON p.id = t.principal_id
   WHERE t.id = v_task_id;

  -- 가드: usol_n 또는 선결제 → sync 안 함 (옛 흐름 유지)
  IF v_principal_code = 'usol_n' OR v_payment_method = 'prepaid' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 새 received_total = SUM(COALESCE(received_amount, subtotal, 0)) WHERE NOT is_canceled
  --   NULL fallback 측 subtotal 사용 (옛 흐름 호환).
  SELECT COALESCE(SUM(COALESCE(received_amount, subtotal, 0)), 0)
    INTO v_new_received
    FROM public.task_items
   WHERE task_id = v_task_id
     AND NOT COALESCE(is_canceled, false);

  -- tasks.received_total + extra_fee 자동 sync.
  --   extra_fee 공식 Phase B 083 BEFORE 트리거 (trg_tasks_sync_extra_fee) 와 동일 →
  --   BEFORE 트리거가 한 번 더 발화해도 idempotent (안전망).
  UPDATE public.tasks
     SET received_total = v_new_received,
         extra_fee      = GREATEST(v_new_received - COALESCE(v_product_price, 0), 0)
   WHERE id = v_task_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trg_task_items_sync_received_total() IS
  'task_items 측 INSERT/UPDATE OF received_amount, is_canceled, qty, unit_price / DELETE 시 '
  'tasks.received_total + extra_fee 자동 sync. 가드: principals.code = usol_n OR payment_method = prepaid 제외.';

-- 트리거명 "_a_" prefix → task_items_compute_trg (Mig 028) 보다 alphabetical 측 먼저 발화 → fresh state 보장.
DROP TRIGGER IF EXISTS task_items_a_sync_received_total_trg ON public.task_items;
CREATE TRIGGER task_items_a_sync_received_total_trg
  AFTER INSERT OR UPDATE OF received_amount, is_canceled, qty, unit_price OR DELETE
  ON public.task_items
  FOR EACH ROW
  EXECUTE FUNCTION trg_task_items_sync_received_total();

COMMENT ON TRIGGER task_items_a_sync_received_total_trg ON public.task_items IS
  'Phase C 084. task_items 측 received_amount/is_canceled/qty/unit_price 변경 시 '
  'tasks.received_total + extra_fee 자동 sync. "_a_" prefix 측 알파벳 순 측 compute_trg 보다 먼저 발화.';

-- ============================================
-- 3) 백필 — status != '완료' & 가드 외 작업 측 received_amount = subtotal
-- ============================================
-- Q1-B: status='완료' 제외 (확정 정산 보호).
-- 가드 (usol_n / prepaid) 측 NULL 유지 → 옛 흐름.
-- is_canceled = true 측 NULL 유지 → SUM 측 0 으로 처리.
UPDATE public.task_items ti
   SET received_amount = COALESCE(ti.subtotal, 0)
  FROM public.tasks t
  LEFT JOIN public.principals p ON p.id = t.principal_id
 WHERE ti.task_id = t.id
   AND ti.received_amount IS NULL
   AND NOT COALESCE(ti.is_canceled, false)
   AND COALESCE(t.status, '') NOT IN ('완료')
   AND (p.code IS NULL OR p.code <> 'usol_n')
   AND (t.payment_method IS NULL OR t.payment_method <> 'prepaid');

COMMIT;

-- ============================================
-- 검증 SQL (별도 실행 — 콘솔에서 확인)
-- ============================================
-- 1) 컬럼 + COMMENT 확인:
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name='task_items' AND column_name='received_amount';
-- 기대: 1 row. integer, YES.
--
-- 2) 트리거 확인 — task_items 측 2개:
-- SELECT trigger_name, action_timing, event_manipulation
--   FROM information_schema.triggers
--  WHERE event_object_table='task_items'
--  ORDER BY trigger_name, event_manipulation;
-- 기대 (트리거명 알파벳 순):
--   · task_items_a_sync_received_total_trg — AFTER INSERT / UPDATE OF (received_amount,is_canceled,qty,unit_price) / DELETE
--   · task_items_compute_trg                — AFTER INSERT / UPDATE / DELETE
--
-- 3) 백필 분포:
-- SELECT
--   COUNT(*) FILTER (WHERE ti.received_amount IS NOT NULL)             AS filled,
--   COUNT(*) FILTER (WHERE ti.received_amount IS NULL)                 AS null_remaining,
--   COUNT(*) FILTER (WHERE COALESCE(t.status,'') = '완료')             AS skipped_done,
--   COUNT(*) FILTER (WHERE COALESCE(ti.is_canceled,false) = true)      AS skipped_canceled,
--   COUNT(*) FILTER (
--     WHERE EXISTS (SELECT 1 FROM public.principals p
--                    WHERE p.id = t.principal_id AND p.code = 'usol_n')
--   )                                                                    AS usol_n_all,
--   COUNT(*) FILTER (WHERE t.payment_method = 'prepaid')                AS prepaid_all
--   FROM public.task_items ti
--   JOIN public.tasks t ON t.id = ti.task_id;
-- 기대: filled ≈ 전체 - (status='완료' + is_canceled + usol_n + prepaid).
--
-- 4) 트리거 발화 테스트 — non-guarded, status!='완료' item (개발 / ROLLBACK 안전):
-- BEGIN;
--   UPDATE public.task_items
--      SET received_amount = 100000
--    WHERE id = '<test_item_id>';
--   SELECT t.received_total, t.extra_fee, t.product_price
--     FROM public.tasks t
--     JOIN public.task_items ti ON ti.task_id = t.id
--    WHERE ti.id = '<test_item_id>';
-- ROLLBACK;
-- 기대: received_total = SUM(item received_amount NOT canceled), extra_fee = max(received - product, 0).
--
-- 5) 가드 검증 — usol_n 작업 측 item:
-- BEGIN;
--   UPDATE public.task_items
--      SET received_amount = 999999
--    WHERE id = '<usol_n_item_id>';
--   SELECT t.received_total, t.extra_fee
--     FROM public.tasks t
--     JOIN public.task_items ti ON ti.task_id = t.id
--    WHERE ti.id = '<usol_n_item_id>';
-- ROLLBACK;
-- 기대: received_total / extra_fee 측 변경 X (가드 동작).
--
-- 6) 부분 취소 시 SUM 자동 재계산:
-- BEGIN;
--   UPDATE public.task_items
--      SET is_canceled = true, canceled_at = now()
--    WHERE id = '<cleaning_item_id_in_non_guarded_task>';
--   SELECT t.received_total, t.extra_fee, t.product_price
--     FROM public.tasks t
--     JOIN public.task_items ti ON ti.task_id = t.id
--    WHERE ti.id = '<cleaning_item_id_in_non_guarded_task>';
-- ROLLBACK;
-- 기대: received_total = SUM 측 cleaning 제외 → 자동 감소.
