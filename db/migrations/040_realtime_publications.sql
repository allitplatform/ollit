-- 040_realtime_publications.sql
-- 2026-05-19 Phase 5 Step 0.C-9 — Supabase Realtime publication 확장
--
-- 배경:
--   기존: tasks 테이블 측 publication 등록 (옛 Phase 4 사장님 SQL 실행)
--   추가: task_items / task_changes / payments 측 publication 필요
--     · task_items   = 정산 사이클 카드 (Stage 0.C-1 / 0.C-9) 자동 갱신
--     · task_changes = 변경 이력 카드 (Stage 0.C-4 / 0.C-9) 자동 갱신
--     · payments     = 정산 화면 (옛 spec) 자동 갱신
--
-- 안전 spec:
--   idempotent — 이미 추가된 테이블 측 duplicate_object 발생 시 skip.
--   PG 16+ 측 ADD TABLE IF NOT EXISTS 미지원 → DO 블록 + EXCEPTION 측 대응.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE task_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE task_changes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE payments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 검증 SQL (실행 후 결과창 측 확인):
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
