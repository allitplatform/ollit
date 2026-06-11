-- ============================================================================
-- Migration 110 — tasks.status_order generated column + 인덱스
-- 2026-06-11
--
-- 배경:
--   원청 PC 내 작업 표 — 1,342건 fetch 측 Supabase 1000행 캡 임박.
--   서버 페이지네이션 + DB ORDER BY 측 정렬 spec (사장님 spec — 클라 정렬 금지).
--   PostgREST 측 ORDER BY CASE expression 직접 지원 X → STORED generated column 필요.
--
-- 정렬 우선순위 (사장님 spec):
--   배정 → 확정 → 진행중 → 완료 → visit_only → 취소요청 → 취소.
--   2차 정렬: scheduled_at DESC (PostgREST .order chain).
--
-- 변경:
--   · tasks 측 status_order INT STORED GENERATED column 추가.
--   · tasks(status_order, scheduled_at DESC) 인덱스 추가.
--   · 다른 테이블 / RPC / RLS 무관.
--
-- 회귀:
--   · IF NOT EXISTS — 재실행 idempotent.
--   · STORED generated — 기존 row 자동 채워짐.
--   · 옛 코드 측 status_order 참조 X 측 영향 0.
--
-- 실행:
--   · Supabase SQL Editor → 통째 붙여넣기 → Run.
--   · BEGIN/COMMIT — 부분 실패 시 ROLLBACK.
-- ============================================================================

BEGIN;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_order INT
  GENERATED ALWAYS AS (
    CASE status
      WHEN '배정'       THEN 1
      WHEN '확정'       THEN 2
      WHEN '진행중'     THEN 3
      WHEN '완료'       THEN 4
      WHEN 'visit_only' THEN 5
      WHEN '취소요청'   THEN 6
      WHEN '취소'       THEN 7
      ELSE 99
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS tasks_status_order_idx
  ON tasks(status_order, scheduled_at DESC NULLS LAST);

COMMIT;

-- 검증:
-- SELECT status, status_order, count(*) FROM tasks
--   GROUP BY status, status_order ORDER BY status_order;
-- 기대: 배정=1 / 확정=2 / 진행중=3 / 완료=4 / visit_only=5 / 취소요청=6 / 취소=7.
