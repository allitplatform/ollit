-- ============================================================================
-- ad-hoc 2026-07-04 - 85 cancel-phantom backfill (post Mig 162 apply)
--
-- Prerequisite:
--   Mig 162 (compute_payment v23) MUST be applied and verified. Confirm via:
--     SELECT obj_description('compute_payment(uuid)'::regprocedure)
--     -> expect 'v23 (Migration 162, ...)'.
--   If v23 is not live, do NOT run this file. The item cancel would fire the
--   old v22 body via the trigger, which zeros the amount only for tasks whose
--   comp_kind is not null. Phantom rows (comp_kind NULL) would stay non-zero.
--
-- Scope:
--   Any task where:
--     principals.code = 'usol_n'
--     AND tasks.status = '취소'
--     AND payments has non-zero engineer/principal/owner
--   User expects ~85 rows; actual count is printed in Step 1.
--
-- Method:
--   Trigger-driven for tasks with active items, plus explicit compute_payment
--   for stale-item tasks. This mirrors the dryrun harness verified previously.
--
-- Wrapping:
--   Wrapped in BEGIN/COMMIT so partial failure rolls back. If verification
--   fails after Step 3, replace COMMIT with ROLLBACK and investigate.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Step 1: identify cancel-phantom target tasks
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _cancel_targets AS
SELECT DISTINCT t.id AS task_id, t.task_no,
       t.cancel_engineer_comp_kind             AS comp_kind,
       COALESCE(t.cancel_engineer_comp_amount, 0) AS comp_amount,
       p.track                                  AS track_pre,
       COALESCE(p.engineer_amount, 0)           AS eng_pre,
       COALESCE(p.principal_amount, 0)          AS prin_pre,
       COALESCE(p.owner_amount, 0)              AS own_pre,
       (SELECT COUNT(*) FROM task_items ti
         WHERE ti.task_id = t.id
           AND NOT COALESCE(ti.is_canceled, false)) AS active_items_pre
FROM tasks t
JOIN principals pr ON pr.id = t.principal_id
JOIN payments p    ON p.task_id = t.id
WHERE pr.code = 'usol_n'
  AND t.status = '취소'
  AND (COALESCE(p.engineer_amount, 0)  != 0
    OR COALESCE(p.principal_amount, 0) != 0
    OR COALESCE(p.owner_amount, 0)     != 0);

-- Pre-check counts
SELECT COUNT(*)                                    AS target_count,
       COUNT(*) FILTER (WHERE active_items_pre = 0) AS stale_no_items,
       COUNT(*) FILTER (WHERE active_items_pre > 0) AS with_items,
       SUM(eng_pre)                                 AS phantom_engineer_sum,
       SUM(prin_pre)                                AS phantom_principal_sum,
       SUM(own_pre)                                 AS phantom_owner_sum
FROM _cancel_targets;

-- ----------------------------------------------------------------------------
-- Step 2: item cancel UPDATE (task_items trigger fires compute_payment)
-- ----------------------------------------------------------------------------
UPDATE task_items ti SET
  is_canceled = true,
  canceled_at = now()
WHERE ti.task_id IN (SELECT task_id FROM _cancel_targets)
  AND NOT COALESCE(ti.is_canceled, false);

-- ----------------------------------------------------------------------------
-- Step 3: explicit compute_payment for stale-item tasks (0 active items to begin)
--   These do not get an item UPDATE so the trigger never fires - explicit call
--   is required so v23 cancel branch runs and clears their phantom amounts.
-- ----------------------------------------------------------------------------
SELECT ct.task_no, compute_payment(ct.task_id) AS new_pid
FROM _cancel_targets ct
WHERE ct.active_items_pre = 0
ORDER BY ct.task_no;

-- ----------------------------------------------------------------------------
-- Step 4: verification - every cancel target must now be 0/0/0 (or comp)
-- ----------------------------------------------------------------------------
SELECT
  ct.task_no,
  ct.comp_kind,
  ct.comp_amount,
  ct.track_pre,
  post.track                       AS track_post,
  ct.eng_pre,   post.engineer_amount   AS eng_post,
  ct.prin_pre,  post.principal_amount  AS prin_post,
  ct.own_pre,   post.owner_amount      AS own_post,
  CASE
    WHEN post.engineer_amount = 0
     AND post.principal_amount = 0
     AND post.owner_amount = 0
      THEN 'ZERO_OK'
    WHEN post.engineer_amount = ct.comp_amount
     AND post.principal_amount = 0
     AND post.owner_amount = 0 - ct.comp_amount
     AND ct.comp_amount > 0
      THEN 'COMP_OK'
    ELSE 'FAIL'
  END AS verdict
FROM _cancel_targets ct
LEFT JOIN payments post ON post.task_id = ct.task_id
ORDER BY verdict, ct.task_no;

-- Aggregate verdict gate
SELECT
  COUNT(*)                                                                     AS total,
  COUNT(*) FILTER (WHERE post.engineer_amount = 0 AND post.principal_amount = 0 AND post.owner_amount = 0) AS zero_ok,
  COUNT(*) FILTER (WHERE post.engineer_amount = ct.comp_amount AND post.principal_amount = 0 AND post.owner_amount = 0 - ct.comp_amount AND ct.comp_amount > 0) AS comp_ok,
  COUNT(*) FILTER (WHERE NOT (
      (post.engineer_amount = 0 AND post.principal_amount = 0 AND post.owner_amount = 0)
   OR (post.engineer_amount = ct.comp_amount AND post.principal_amount = 0 AND post.owner_amount = 0 - ct.comp_amount AND ct.comp_amount > 0)
  )) AS fail_count,
  CASE WHEN COUNT(*) FILTER (WHERE NOT (
      (post.engineer_amount = 0 AND post.principal_amount = 0 AND post.owner_amount = 0)
   OR (post.engineer_amount = ct.comp_amount AND post.principal_amount = 0 AND post.owner_amount = 0 - ct.comp_amount AND ct.comp_amount > 0)
  )) = 0
    THEN 'ALL PASS - safe to COMMIT'
    ELSE 'FAIL - replace COMMIT with ROLLBACK and investigate'
  END AS gate;

-- ----------------------------------------------------------------------------
-- Step 5: 3-restore-task stamp re-check (from previous cycles)
--   Confirms that recomputing the cancel targets did not touch these three
--   preserved tasks via any unexpected trigger cascade.
-- ----------------------------------------------------------------------------
SELECT
  t.task_no,
  p.status,
  p.engineer_amount,
  p.engineer_remitted_at,
  p.engineer_remit_confirmed_at,
  p.engineer_remit_confirmed_by,
  p.notes
FROM tasks t
JOIN payments p ON p.task_id = t.id
WHERE t.task_no IN ('A-260701-008','A-260701-020','A-260702-004')
ORDER BY t.task_no;

-- ----------------------------------------------------------------------------
-- Step 6: COMMIT (or ROLLBACK on gate = FAIL)
--   If Step 4 gate reads 'ALL PASS', keep COMMIT below. If FAIL, replace with ROLLBACK.
-- ----------------------------------------------------------------------------
COMMIT;
-- ROLLBACK;
