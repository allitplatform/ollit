-- ============================================
-- Migration 083 v2 — tasks.received_total + extra_fee 자동 sync (분기 가드)
-- 작성일 : 2026-05-30 — Phase B Step 1
-- 실행   : 2026-05-30 (운영 DB 적용 완료, 검증 통과)
-- 범위   : tasks 테이블 received_total 컬럼 + BEFORE 트리거 + 백필
--
-- v1 → v2 변경점 (2026-05-30):
--   tasks 테이블에 principal_code 컬럼이 없음 (v1 가정 오류) →
--   principals JOIN 으로 code 조회 (BEFORE 트리거 + 백필 WHERE 둘 다).
--   그 외 (컬럼 추가, 트리거 attach, compute_payment_trg 컬럼 확장, 백필 본문) 동일.
--
-- 운영 검증 결과 (2026-05-30):
--   filled = 53 (가드 외)
--   null_remaining = 1159 (= usol_n_all 1159 + prepaid_all 0, 가드 케이스)
--   트리거 발화 OK — A-260529-008 (received_total=180000 → extra_fee=40000 정확)
--
-- 사장님 spec:
--   기사 / 운영자가 '고객 결제 총액'(received_total) 을 입력하면 시스템이
--   extra_fee 를 자동 재계산 — (received_total - product_price), 음수 가드.
--   부분 취소로 product_price 가 줄어도 received_total 그대로 → extra_fee 자동 증가.
--   계기: A-260529-008 사건. 기사 머릿속 계산 부담 제거.
--
-- 분기 가드 (사장님 통찰):
--   · principals.code = 'usol_n'        — 네이버 결제(매가) 와 현장(추가금) 분리
--   · OR tasks.payment_method = 'prepaid' — 선결제 (매가 사전 결제)
--   두 케이스는 옛 흐름 유지 — extra_fee 직접 입력. received_total NULL 유지.
--
-- 트리거 흐름:
--   1) trg_tasks_sync_extra_fee (BEFORE INSERT OR UPDATE OF received_total, product_price)
--      · principals JOIN 으로 code 조회 → 가드 케이스 → return NEW
--      · 그 외 → NEW.extra_fee = GREATEST(NEW.received_total - COALESCE(NEW.product_price, 0), 0)
--   2) compute_payment_trg (AFTER INSERT OR UPDATE OF ...) 후속 발화 → 정산 재계산
--      · 컬럼 리스트에 received_total 추가 (027 의 5 컬럼 + received_total = 6 컬럼)
--      · 가드 케이스에서 BEFORE 가 extra_fee 변경 없이 return 해도 정산 재계산 보장
--
-- 안전:
--   · ADD COLUMN IF NOT EXISTS — 재실행 안전
--   · CREATE OR REPLACE FUNCTION — 재실행 안전
--   · DROP IF EXISTS / CREATE TRIGGER — 재실행 안전
--   · 백필 — 가드 케이스 제외하고 received_total = product_price + extra_fee
--   · 음수 가드 — GREATEST(..., 0) 으로 extra_fee 음수 방지
--   · 회귀 0 — compute_payment 함수 변경 X, 정산 값 동일
--
-- 재실행 :
--   Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run.
-- ============================================

BEGIN;

-- ============================================
-- 1) 컬럼 추가
-- ============================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS received_total integer;

COMMENT ON COLUMN public.tasks.received_total IS
  '고객 실제 결제 총액. 기사/운영자가 입력. '
  '가드 케이스 (principals.code = usol_n OR payment_method = prepaid) 제외 시 '
  'extra_fee = GREATEST(received_total - product_price, 0) 으로 자동 계산. '
  '가드 케이스는 NULL 유지 — 옛 extra_fee 직접 입력 흐름.';

-- ============================================
-- 2) BEFORE 트리거 함수 — extra_fee 자동 sync (가드 분기, principals JOIN)
-- ============================================
CREATE OR REPLACE FUNCTION trg_tasks_sync_extra_fee()
RETURNS TRIGGER AS $$
DECLARE
  v_principal_code text;
BEGIN
  -- principals JOIN 으로 code 조회 (tasks 에는 principal_code 컬럼 없음)
  SELECT code INTO v_principal_code
    FROM public.principals
   WHERE id = NEW.principal_id;

  -- 가드: usol_n 또는 선결제 → sync 안 함, 옛 흐름 유지
  IF v_principal_code = 'usol_n' OR NEW.payment_method = 'prepaid' THEN
    RETURN NEW;
  END IF;

  -- received_total 이 있을 때만 extra_fee 자동 계산
  -- product_price 가 NULL 이어도 안전 (COALESCE), 음수 가드 (GREATEST 0)
  IF NEW.received_total IS NOT NULL THEN
    NEW.extra_fee := GREATEST(NEW.received_total - COALESCE(NEW.product_price, 0), 0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trg_tasks_sync_extra_fee() IS
  'tasks.received_total / product_price 변경 시 extra_fee 자동 재계산. '
  '가드: principals.code = usol_n OR tasks.payment_method = prepaid 시 sync 안 함. '
  'principals 는 principal_id FK 로 JOIN.';

DROP TRIGGER IF EXISTS tasks_sync_extra_fee ON public.tasks;
CREATE TRIGGER tasks_sync_extra_fee
  BEFORE INSERT OR UPDATE OF received_total, product_price
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_tasks_sync_extra_fee();

COMMENT ON TRIGGER tasks_sync_extra_fee ON public.tasks IS
  '받은 돈 또는 매가 변경 시 extra_fee 자동 sync (usol_n / prepaid 가드 제외).';

-- ============================================
-- 3) compute_payment_trg 컬럼 리스트에 received_total 추가
-- ============================================
-- 027 의 5 컬럼 (status, extra_fee, product_price, total_amount, completed_at) + received_total.
-- 가드 케이스에서 BEFORE 트리거가 extra_fee 변경 없이 return 했을 때도
-- received_total 변경만으로 정산 재계산 트리거 발화하도록 확장.
DROP TRIGGER IF EXISTS compute_payment_trg ON public.tasks;
CREATE TRIGGER compute_payment_trg
  AFTER INSERT OR UPDATE OF status, extra_fee, product_price, total_amount, completed_at, received_total
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_payment();

COMMENT ON TRIGGER compute_payment_trg ON public.tasks IS
  '작업 INSERT, status / extra_fee / product_price / total_amount / completed_at / received_total 변경 시 자동 재계산. 083 에서 received_total 추가.';

-- ============================================
-- 4) 백필 — 가드 케이스 제외, 옛 작업의 received_total 채움
-- ============================================
-- received_total = product_price + extra_fee (옛 의미 보존)
-- 가드 케이스 (usol_n / prepaid) 는 NULL 유지 → 옛 입력 흐름 그대로.
-- usol_n 가드는 principals JOIN (NOT EXISTS 패턴).
UPDATE public.tasks AS t
   SET received_total = COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0)
 WHERE t.received_total IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.principals p
      WHERE p.id = t.principal_id
        AND p.code = 'usol_n'
   )
   AND (t.payment_method IS NULL OR t.payment_method <> 'prepaid');

COMMIT;

-- ============================================
-- 검증 SQL (별도 실행 — 콘솔에서 확인)
-- ============================================
-- 1) 컬럼 + COMMENT 확인:
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name='tasks' AND column_name='received_total';
-- 기대: 1 row. integer, YES.
--
-- 2) 트리거 확인:
-- SELECT trigger_name, action_timing, event_manipulation
--   FROM information_schema.triggers
--  WHERE event_object_table='tasks'
--    AND trigger_name IN ('tasks_sync_extra_fee', 'compute_payment_trg')
--  ORDER BY trigger_name, action_timing;
-- 기대: 2 trigger.
--   · tasks_sync_extra_fee — BEFORE INSERT + BEFORE UPDATE
--   · compute_payment_trg — AFTER  INSERT + AFTER  UPDATE
--
-- 3) 백필 분포 (실행 시점 — 2026-05-30):
-- SELECT
--   COUNT(*) FILTER (WHERE t.received_total IS NOT NULL)                AS filled,
--   COUNT(*) FILTER (WHERE t.received_total IS NULL)                    AS null_remaining,
--   COUNT(*) FILTER (
--     WHERE EXISTS (SELECT 1 FROM public.principals p
--                    WHERE p.id = t.principal_id AND p.code = 'usol_n')
--   )                                                                    AS usol_n_all,
--   COUNT(*) FILTER (WHERE t.payment_method = 'prepaid')                 AS prepaid_all
--   FROM public.tasks t;
-- 실측 결과 (2026-05-30): filled=53, null_remaining=1159, usol_n_all=1159, prepaid_all=0.
--
-- 4) 트리거 발화 테스트 (개발 DB 또는 ROLLBACK 안전):
-- BEGIN;
--   UPDATE public.tasks SET received_total = 180000 WHERE id = '<test_task_id>';
--   SELECT received_total, extra_fee, product_price
--     FROM public.tasks WHERE id = '<test_task_id>';
-- ROLLBACK;
-- 기대: extra_fee = GREATEST(180000 - product_price, 0).
-- 실측 (A-260529-008): received_total=180000, product_price=140000 → extra_fee=40000 ✓
--
-- 5) 가드 검증 — usol_n 작업:
-- BEGIN;
--   UPDATE public.tasks SET received_total = 999999 WHERE id = '<usol_n_task_id>';
--   SELECT received_total, extra_fee FROM public.tasks WHERE id = '<usol_n_task_id>';
-- ROLLBACK;
-- 기대: extra_fee 변경 X (옛 값 유지). received_total 은 들어가지만 sync 안 됨.
--
-- 6) 가드 검증 — payment_method='prepaid':
-- BEGIN;
--   UPDATE public.tasks SET received_total = 999999 WHERE id = '<prepaid_task_id>';
--   SELECT received_total, extra_fee FROM public.tasks WHERE id = '<prepaid_task_id>';
-- ROLLBACK;
-- 기대: extra_fee 변경 X.
--
-- 7) 음수 가드 검증:
-- BEGIN;
--   UPDATE public.tasks SET received_total = 1 WHERE id = '<test_task_id_with_big_product>';
--   SELECT extra_fee FROM public.tasks WHERE id = '<test_task_id_with_big_product>';
-- ROLLBACK;
-- 기대: extra_fee = 0 (음수 가드).
