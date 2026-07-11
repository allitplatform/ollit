-- ============================================================================
-- ad-hoc 2026-07-11 — 잔존 취소 표식 정리 (status != '취소' AND cancelReason 잔존)
-- 상황:
--   · Mig 157 v1 (옵션 A) 시대에 복구한 작업이 category_data 잔존 상태로 남음.
--   · 이후 마스 UPDATE (status='취소' backfill) + 재복구 사이클로 불일치 누적.
--   · 클라 isEffectivelyCanceled(cancelReason 기반) → 배지 '취소' 잘못 표시.
--
-- 대상:
--   status != '취소' AND category_data->>'cancelReason' IS NOT NULL
--
-- ⚠️ 주의:
--   · status='취소' AND cancelReason 있음 = 정상 취소 상태 → 절대 손대지 말 것.
--   · 본 SQL 은 status != '취소' 만 대상.
--
-- 실행 순서:
--   [A] 드라이런 SELECT — 대상 건수 + 리스트 확인.
--   [B] 사장님 확인 후 [C] 실행.
--   [C] 표식 클리어 UPDATE — sync_task_items_trg 우회 (Mig 171 flag 사용).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- [A] 드라이런 — 대상 건수
-- ─────────────────────────────────────────────────────────────────────────

SELECT COUNT(*) AS total_targets
FROM tasks
WHERE status <> '취소'
  AND category_data->>'cancelReason' IS NOT NULL;

-- 세부 리스트 (상위 100 건)
SELECT
  task_no,
  status,
  category_data->>'cancelReason'    AS cancel_reason,
  category_data->>'previousStatus'  AS prev_status,
  category_data->>'cancelAt'        AS cancel_at,
  scheduled_at::date                AS scheduled_date
FROM tasks
WHERE status <> '취소'
  AND category_data->>'cancelReason' IS NOT NULL
ORDER BY task_no DESC
LIMIT 100;


-- ─────────────────────────────────────────────────────────────────────────
-- [B] 사장님 확인 후 아래 UPDATE 블록 주석 해제 실행
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ 실행 전:
--   1) Mig 171 (or 172) 실행 완료 상태여야 함 (sync trigger session flag 가드 존재).
--   2) [A] 결과 확인 — 대상 건수 · 리스트 사장님 승인.
-- ─────────────────────────────────────────────────────────────────────────

/*
BEGIN;

-- sync_task_items_trg 우회 flag ON (트랜잭션 로컬)
SELECT set_config('app.skip_sync_trigger', 'true', true);

-- 표식 클리어
WITH targets AS (
  SELECT id, category_data
  FROM tasks
  WHERE status <> '취소'
    AND category_data->>'cancelReason' IS NOT NULL
),
cleaned AS (
  SELECT
    t.id,
    (
      COALESCE(t.category_data, '{}'::jsonb)
        - 'cancelReason'
        - 'cancelActor'
        - 'cancelActorUserId'
        - 'cancelActorPrincipalCode'
        - 'cancelAt'
        - 'previousStatus'
        - 'wasCompleted'
    )
    ||
    CASE
      WHEN t.category_data ? 'workItems'
       AND jsonb_typeof(t.category_data->'workItems') = 'array'
      THEN jsonb_build_object(
        'workItems',
        (
          SELECT COALESCE(jsonb_agg(
            (elem - 'isCanceled' - 'canceledReason' - 'canceledAt')
          ), '[]'::jsonb)
          FROM jsonb_array_elements(t.category_data->'workItems') AS elem
        )
      )
      ELSE '{}'::jsonb
    END AS new_cd
  FROM targets t
)
UPDATE tasks
SET category_data              = c.new_cd,
    cancel_engineer_comp_kind  = NULL,
    cancel_engineer_comp_amount= NULL,
    updated_at                 = now()
FROM cleaned c
WHERE tasks.id = c.id;

-- task_items 취소 상태도 정리 (혹시 남은 것)
UPDATE task_items ti
SET is_canceled = false,
    canceled_reason = NULL,
    canceled_at = NULL
FROM tasks t
WHERE ti.task_id = t.id
  AND t.status <> '취소'
  AND COALESCE(ti.is_canceled, false) = true;

-- 확인
SELECT COUNT(*) AS remaining
FROM tasks
WHERE status <> '취소'
  AND category_data->>'cancelReason' IS NOT NULL;
-- 기대: 0

-- COMMIT;      -- ← 문제 없으면 이 줄 주석 해제 + ROLLBACK 주석 처리 후 재실행.
ROLLBACK;      -- ← 안전 기본값. COMMIT 확신 없으면 이대로.
*/


-- ─────────────────────────────────────────────────────────────────────────
-- [C] 사후 검증
-- ─────────────────────────────────────────────────────────────────────────
-- 실행 후:
--   SELECT COUNT(*) FROM tasks WHERE status <> '취소' AND category_data ? 'cancelReason';
--   기대: 0
--
--   SELECT status, COUNT(*) FROM tasks WHERE category_data ? 'cancelReason' GROUP BY status;
--   기대: '취소' 만 남음.
