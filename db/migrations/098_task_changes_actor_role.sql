-- 098_task_changes_actor_role.sql
-- 2026-06-09 — task_changes 에 actor role + 'create' 이벤트 enum 추가.
--
-- 사장님 결정 (감사 actor 결정):
--   · 타겟 = task_changes 만 (status_history 는 raw 디버그로 그대로 둠)
--   · 값(text): "운영자" / "원청" / "기사" / "시스템"
--   · 접수(생성) 이벤트 = change_type enum 'create' 추가
--   · 시스템 라벨 통일 ("시트동기화" / "자동배정" 분리 X)
--   · 과거 백필 안 함 (기존 행 role NULL → 표시 시 이름만 / 둘 다 NULL → "시스템")
--
-- 변경:
--   1) task_changes 에 changed_by_role text 컬럼 추가 (NULL 허용 — 옛 행 보존)
--   2) change_type_enum 에 'create' 값 추가
--
-- 실행: Supabase 콘솔 → SQL Editor → 통째 → Run (idempotent — ADD COLUMN IF NOT EXISTS / ADD VALUE IF NOT EXISTS)
-- 롤백: 컬럼 drop 가능하나, enum 추가는 PostgreSQL 측 자체 롤백 X (DROP TYPE 후 재생성 필요 — 운영 위험).

BEGIN;

-- [1] changed_by_role 컬럼 추가
ALTER TABLE task_changes
  ADD COLUMN IF NOT EXISTS changed_by_role text;

COMMENT ON COLUMN task_changes.changed_by_role IS
  '액션 수행자 역할 — 운영자 / 원청 / 기사 / 시스템. NULL = 옛 행 (Mig 098 이전) 또는 미상.';

COMMIT;

-- [2] change_type_enum 'create' 추가 (별도 트랜잭션 — enum 변경 commit 후 다른 SQL 에서 즉시 사용 가능)
ALTER TYPE change_type_enum ADD VALUE IF NOT EXISTS 'create';

-- ============================================
-- 검증 SQL (별도 실행)
-- ============================================
-- A. 컬럼 확인:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'task_changes' AND column_name = 'changed_by_role';
--   기대: text / YES.
--
-- B. enum 확인:
--   SELECT enum_range(NULL::change_type_enum);
--   기대: {schedule,engineer,items,extra_fee,cancel,visit_only,status,create}
--
-- C. 표시 동작 가정 — 옛 행 (role NULL):
--   SELECT id, change_type, changed_by_name, changed_by_role
--   FROM task_changes ORDER BY changed_at DESC LIMIT 5;
--   role 컬럼이 모두 NULL 이면 정상 (백필 안 함).
--
-- ============================================
-- 무손상 영역:
--   · status_history 트리거 / 데이터 — 그대로
--   · payments / compute_payment / RLS / 다른 함수 — 0 영향
--   · 옛 task_changes 행 — 보존 (role 만 NULL)
-- ============================================
