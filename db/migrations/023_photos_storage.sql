-- 023_photos_storage.sql
-- 2026-05-17 — photos Storage bucket + anon RLS 박음
-- catch: photos_inherit 박은 spec 측 current_tenant_id() 박음 → anon 박지 X
-- 박은 spec 측 — PWA 측 사진 업로드 / 표시 박지 X
-- 박은 spec — Migration 020 (payments_anon_select) 동일 패턴

-- 1. Storage bucket 박음 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. photos table 측 anon RLS 박음
DROP POLICY IF EXISTS photos_anon_all ON photos;
CREATE POLICY photos_anon_all ON photos
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. storage.objects 측 RLS (task-photos bucket)
DROP POLICY IF EXISTS photos_storage_anon_all ON storage.objects;
CREATE POLICY photos_storage_anon_all ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'task-photos')
  WITH CHECK (bucket_id = 'task-photos');
