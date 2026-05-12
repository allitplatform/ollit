-- ============================================
-- Migration 002a — Add Missing Columns (tasks 6 + payments 2 = 8)
-- 작성일  : 2026-05-12 (Day 5)
-- 출처    : docs/시트_vs_운영DB_갭.md / 운영 50열 매핑 측 박은 누락 영역
-- 범위    : tasks 6 컬럼 + payments 2 컬럼 추가
-- 전제    : 001_init.sql + 003_rls_views_funcs.sql + 004_seed.sql 적용 박힘
-- 실행    : Supabase 콘솔 → SQL Editor → New query → 통째 붙여넣기 → Run
-- 안전장치:
--   - BEGIN/COMMIT 박음 → 부분 실패 시 자동 ROLLBACK
--   - ADD COLUMN IF NOT EXISTS 박음 → 재실행 안전 (idempotent)
--   - CREATE INDEX IF NOT EXISTS 박음 → 재실행 안전
-- ============================================

BEGIN;

-- ============================================
-- [1] tasks 6 컬럼 추가
-- ============================================
-- happycall_at         : 해피콜일시 (M열)
-- extra_fee_at         : 현장추가일시 (AF열)
-- calendar_event_id    : 캘린더 이벤트 ID (AX열) — 캘린더 1+20 양방향 동기화 측 catch
-- external_order_no    : 상품주문번호 (AU열) — 유솔/세스코 외부 시트 원본 ID
-- external_principal_no: 원청주문번호 (AV열) — 외부 시트 원청 측 ID
-- external_received_at : 원본접수일 (AW열) — 외부 시트 측 접수 시각 (PWA 수신 시각과 별개)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS happycall_at          timestamptz,
  ADD COLUMN IF NOT EXISTS extra_fee_at          timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_event_id     text,
  ADD COLUMN IF NOT EXISTS external_order_no     text,
  ADD COLUMN IF NOT EXISTS external_principal_no text,
  ADD COLUMN IF NOT EXISTS external_received_at  timestamptz;

-- 인덱스 박음 — 외부 시트 동기화 측 lookup 박힘 (NULL 박지 X 박힌 영역만 박음 / partial index)
CREATE INDEX IF NOT EXISTS idx_tasks_external_order_no
  ON tasks (external_order_no)
  WHERE external_order_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_external_principal_no
  ON tasks (external_principal_no)
  WHERE external_principal_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_calendar_event_id
  ON tasks (calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

-- ============================================
-- [2] payments 2 컬럼 추가
-- ============================================
-- outstanding       : 미수금 (AM열) — DEFAULT 0
-- principal_paid_at : 원청정산일 (AP열) — 원청 측 입금 완료 시각
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS outstanding       int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS principal_paid_at timestamptz;

COMMIT;

-- ============================================
-- 끝 — tasks 6 컬럼 + payments 2 컬럼 = 8 컬럼 추가 / 인덱스 3개
-- 검증 : db/migrations/002a_validation.sql
-- 다음 : src/data/tasksDb.js (Phase 2 본격 / 2단계)
-- ============================================
