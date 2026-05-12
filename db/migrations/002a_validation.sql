-- ============================================
-- Migration 002a — Validation (SELECT 전용 / 변경 X)
-- 작성일  : 2026-05-12 (Day 5)
-- 범위    : 002a_add_missing_columns.sql 적용 박힌 영역 측 검증
-- 실행    : Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 기대 결과:
--   tasks 컬럼 6 row / payments 컬럼 2 row / 인덱스 3 row
-- ============================================

-- ============================================
-- [1] tasks 6 컬럼 박혔나 확인
-- ============================================
-- 기대: 6 row (happycall_at / extra_fee_at / calendar_event_id /
--             external_order_no / external_principal_no / external_received_at)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name IN (
    'happycall_at',
    'extra_fee_at',
    'calendar_event_id',
    'external_order_no',
    'external_principal_no',
    'external_received_at'
  )
ORDER BY column_name;

-- ============================================
-- [2] payments 2 컬럼 박혔나 확인
-- ============================================
-- 기대: 2 row (outstanding / principal_paid_at)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payments'
  AND column_name IN ('outstanding', 'principal_paid_at')
ORDER BY column_name;

-- ============================================
-- [3] 인덱스 박혔나 확인
-- ============================================
-- 기대: 3 row
--   idx_tasks_calendar_event_id
--   idx_tasks_external_order_no
--   idx_tasks_external_principal_no
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  = 'tasks'
  AND indexname IN (
    'idx_tasks_calendar_event_id',
    'idx_tasks_external_order_no',
    'idx_tasks_external_principal_no'
  )
ORDER BY indexname;

-- ============================================
-- 끝 — 8 컬럼 + 3 인덱스 / 합 13 row 박혀있으면 성공
-- ============================================
