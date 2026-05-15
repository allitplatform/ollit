-- ============================================
-- Migration 013 — status 변경 시점 추적 (assigned_at / scheduled_confirmed_at)
-- 작성일  : 2026-05-15
-- 범위    : 운영자 작업 상세 "🕐 이력" 섹션 박힌 시점 채우기 위해
--          · 배정      → assigned_at            (기사 배정/수락 시점)
--          · 일정 확정 → scheduled_confirmed_at (기사 일정 확정 누른 시점)
--
-- 방식: BEFORE UPDATE trigger — status 변경 감지 시 자동 박음
--   · write path 3개 (assignEngineerDb / acceptOfferAdapter / handleSaveCall) 코드 변경 X
--   · 향후 새 write path 박혀도 trigger가 자동 catch
--
-- 매핑 (코드 측):
--   · src/data/tasksDb.js rowToTask          — assignedAt + scheduledConfirmedAt 2줄
--   · src/pages/AdminApp.jsx _v14NormalizeTask — 같은 두 필드 보존
--
-- 보호:
--   · 새 컬럼 2개 — NULL 허용 (backward-compatible)
--   · 기존 row 영향 0 — 백필 안 박으면 NULL 그대로
--   · 다른 컬럼 / 테이블 / 트리거 영향 X
--
-- 실행:
--   · Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   · 안전장치: BEGIN/COMMIT — 부분 실패 시 ROLLBACK
--   · 백필 [4]은 선택 — 기존 작업도 updated_at 기준 채우려면 같이 박음
--
-- 후속 (대표님 SQL 실행 후):
--   1. 신규 작업 1건으로 검증 (배정 + 일정 확정 → 이력 화면에 시간 박힘)
--   2. (선택) 백필 SQL 박은 후 기존 작업 이력도 채워짐
-- ============================================

BEGIN;

-- ============================================
-- [1] 컬럼 추가 (NULL 허용 / backward-compatible)
-- ============================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigned_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_confirmed_at TIMESTAMPTZ;

-- ============================================
-- [2] Trigger 함수 — status 변경 시점에 시간 박음
-- ============================================
-- · IS DISTINCT FROM 박은 이유: OLD.status NULL 케이스도 catch (insert 직후 update)
-- · IS NULL 박은 이유: 이미 박혀있으면 덮어쓰지 X (재배정 케이스 보존)
CREATE OR REPLACE FUNCTION tasks_status_timestamps() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = '배정'
     AND OLD.status IS DISTINCT FROM '배정'
     AND NEW.assigned_at IS NULL THEN
    NEW.assigned_at = NOW();
  END IF;

  IF NEW.status = '확정'
     AND OLD.status IS DISTINCT FROM '확정'
     AND NEW.scheduled_confirmed_at IS NULL THEN
    NEW.scheduled_confirmed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- [3] Trigger 박기 (BEFORE UPDATE)
-- ============================================
-- · 기존 trigger 박혀있으면 박지 X (DROP 후 CREATE 패턴)
DROP TRIGGER IF EXISTS tasks_status_timestamps_trg ON tasks;
CREATE TRIGGER tasks_status_timestamps_trg
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION tasks_status_timestamps();

COMMIT;

-- ============================================
-- [4] (선택) 백필 — 기존 row 채움
-- ============================================
-- · 기존 작업도 이력 화면에 시간 박히게 하려면 박음
-- · updated_at 기준 (정확한 배정/확정 시점은 X, 마지막 update 시각)
-- · 위 COMMIT 박힌 후 별도로 박는 거 추천 (트랜잭션 분리)
--
-- BEGIN;
-- UPDATE tasks
--   SET assigned_at = updated_at
--   WHERE status IN ('배정', '확정', '진행중', '완료', '정산완료')
--     AND assigned_at IS NULL;
-- UPDATE tasks
--   SET scheduled_confirmed_at = updated_at
--   WHERE status IN ('확정', '진행중', '완료', '정산완료')
--     AND scheduled_confirmed_at IS NULL;
-- COMMIT;
