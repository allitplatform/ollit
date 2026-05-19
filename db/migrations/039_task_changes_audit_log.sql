-- 039_task_changes_audit_log.sql
-- 2026-05-19 Phase 5 Step 0.C-4 — 변경 이력 audit log
-- 6개 변경 액션 측 자동 INSERT:
--   schedule (일정 변경) / engineer (기사 변경) / items (항목 변경)
--   extra_fee (추가금) / cancel (작업 취소) / visit_only (출장비만) / status (상태 일반)
-- before_data / after_data jsonb 측 diff 저장.

CREATE TYPE change_type_enum AS ENUM (
  'schedule', 'engineer', 'items', 'extra_fee', 'cancel', 'visit_only', 'status'
);

CREATE TABLE task_changes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  change_type     change_type_enum NOT NULL,
  before_data     jsonb,
  after_data      jsonb,
  note            text,
  changed_by      uuid REFERENCES users(id),
  changed_by_name text,
  changed_at      timestamptz DEFAULT now()
);

CREATE INDEX task_changes_by_task ON task_changes(task_id, changed_at DESC);
CREATE INDEX task_changes_by_tenant_time ON task_changes(tenant_id, changed_at DESC);

-- RLS 활성
ALTER TABLE task_changes ENABLE ROW LEVEL SECURITY;

-- anon SELECT — PWA 측 조회 (Migration 020 / 037 동일 패턴)
CREATE POLICY task_changes_anon_select ON task_changes
  FOR SELECT
  TO anon, authenticated
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
    )
  );

-- anon INSERT — PWA 측 변경 이력 기록
CREATE POLICY task_changes_anon_insert ON task_changes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
    )
  );

COMMENT ON TABLE  task_changes              IS '변경 이력 audit log — 6개 변경 액션 측 자동 INSERT (Phase 5 Step 0.C-4)';
COMMENT ON COLUMN task_changes.change_type  IS 'schedule / engineer / items / extra_fee / cancel / visit_only / status';
COMMENT ON COLUMN task_changes.before_data  IS '변경 전 데이터 (jsonb / diff 측 활용)';
COMMENT ON COLUMN task_changes.after_data   IS '변경 후 데이터 (jsonb / diff 측 활용)';
COMMENT ON COLUMN task_changes.note         IS '운영자 입력 사유';
COMMENT ON COLUMN task_changes.changed_by_name IS '변경 시점 사용자 이름 snapshot (users 측 변경/삭제 시 보존)';
