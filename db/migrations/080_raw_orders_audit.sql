-- ============================================
-- Migration 080 — raw_orders audit 테이블
-- 작성일  : 2026-05-29 (실제 운영 DB 적용일)
-- 파일 산출 : 2026-05-29 (사장님이 콘솔에서 직접 DDL 적용한 흔적을
--             db/migrations 컨벤션으로 회복 / 077 와 동일 패턴)
-- 범위    : raw_orders 테이블 신규 + 인덱스 + RLS 정책 (idempotent)
--
-- 사장님 spec (Phase 1):
--   CSV 업로드 / 시트 sync 로 들어오는 발주 row 원본을 task 와 독립된 별도 테이블에
--   영구 보관. task 가 trigger 버그 / 취소 / 삭제 등으로 변하거나 사라져도 원본은
--   안 사라지게 → 분쟁 / 진단 / 추적 대응.
--
-- 계기:
--   2026-05-29 sync_category_data_to_task_items trigger 버그로 usol_n 9건 task_items
--   손실 사고. 옛 발주가 시트에서만 추적 가능하고 DB 엔 없어 사장님 답답함 누적.
--
-- 사용처 (코드 측):
--   · src/lib/usolNTasksDb.js bulkInsertUsolNOrders — CSV 업로드 시 자동 INSERT
--     (신규 → task_id 연결 / 중복 → task_id=NULL + notes='중복_옛작업' or '중복_기존작업')
--   · src/lib/rawOrdersDb.js — searchRawOrders / getRawOrderById / listRawOrdersByTaskId
--   · src/screens/admin/RawOrdersArchiveScreen.jsx — 운영자 PWA archive 화면
--
-- 회귀:
--   · raw_orders INSERT 실패가 tasks INSERT 전체를 막지 않음 (클라이언트 try/catch)
--   · 옛 작업 백필 안 함 — 신규 CSV 업로드부터만 적용
--   · DB UNIQUE 없음 — 같은 external_order_no 재업로드 시 row 추가 (변경 이력 추적, 의도된 설계)
--
-- 재실행:
--   Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run.
--   IF NOT EXISTS / CREATE OR REPLACE 패턴 — 운영 DB 영향 0.
-- ============================================

BEGIN;

-- ============================================================
-- [1] raw_orders 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.raw_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111',
  principal_code   text NOT NULL,
  source           text NOT NULL,
  external_order_no text,
  product_order_no  text,
  customer_name    text,
  phone            text,
  address          text,
  raw_payload      jsonb NOT NULL,
  task_id          uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  uploaded_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  notes            text
);

COMMENT ON TABLE  public.raw_orders IS
  '발주 원본 audit. CSV 업로드 / 시트 sync 측 들어오는 row 를 task 와 독립 보관. task 변경/삭제와 무관하게 영구 보존.';
COMMENT ON COLUMN public.raw_orders.principal_code IS
  '원청 코드 (usol_n / usol_h / allday / KA / KB / yongin / crikrin).';
COMMENT ON COLUMN public.raw_orders.source IS
  '입수 경로 (csv_upload / sheet_sync / manual / api).';
COMMENT ON COLUMN public.raw_orders.raw_payload IS
  'CSV row 또는 sync 원본 객체 그대로 (jsonb). 모든 컬럼 포함 — 분쟁 시 전체 정보 필요.';
COMMENT ON COLUMN public.raw_orders.task_id IS
  '연결된 tasks.id. 신규 INSERT 시 채움. 중복 케이스 / task 삭제 시 NULL.';
COMMENT ON COLUMN public.raw_orders.notes IS
  '중복 케이스 등 메타 (중복_옛작업 / 중복_기존작업 / NULL).';

-- ============================================================
-- [2] 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_raw_orders_task_id
  ON public.raw_orders(task_id)
  WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raw_orders_external_order_no
  ON public.raw_orders(external_order_no)
  WHERE external_order_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raw_orders_uploaded_at
  ON public.raw_orders(uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_orders_principal_uploaded
  ON public.raw_orders(principal_code, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_orders_phone
  ON public.raw_orders(phone)
  WHERE phone IS NOT NULL;

-- ============================================================
-- [3] RLS 정책 (PWA anon 키 사용 — anon SELECT/INSERT/UPDATE 허용)
-- ============================================================
ALTER TABLE public.raw_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS raw_orders_select_anon ON public.raw_orders;
CREATE POLICY raw_orders_select_anon ON public.raw_orders
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS raw_orders_insert_anon ON public.raw_orders;
CREATE POLICY raw_orders_insert_anon ON public.raw_orders
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS raw_orders_update_anon ON public.raw_orders;
CREATE POLICY raw_orders_update_anon ON public.raw_orders
  FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- DELETE 정책 없음 = anon 측 DELETE 차단 (audit 무결성).

COMMIT;

-- ============================================
-- 검증 SQL (별도 실행)
-- ============================================
--
-- 1) 테이블 존재 + 컬럼 확인:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name='raw_orders'
-- ORDER BY ordinal_position;
--
-- 2) 인덱스 5개 확인:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename='raw_orders'
-- ORDER BY indexname;
-- 기대: idx_raw_orders_external_order_no / phone / principal_uploaded / task_id / uploaded_at
--      + raw_orders_pkey
--
-- 3) RLS 정책 3개 확인:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename='raw_orders'
-- ORDER BY policyname;
-- 기대: raw_orders_insert_anon / raw_orders_select_anon / raw_orders_update_anon
--
-- 4) 신규 INSERT 시뮬 (롤백):
-- BEGIN;
-- INSERT INTO raw_orders (principal_code, source, external_order_no, raw_payload)
-- VALUES ('usol_n', 'csv_upload', 'TEST-ORDER-001', '{"고객명":"테스트","주문":"TEST"}'::jsonb)
-- RETURNING id, uploaded_at;
-- ROLLBACK;
