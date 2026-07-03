-- ============================================================================
-- ad-hoc 2026-07-03 - investigate 7/2 backfill stamp loss
--
-- Context:
--   Yesterday (2026-07-02) five refrigerant tasks were recomputed via v20
--   (leak fix + preservation both missing). Because v20 does DELETE + INSERT,
--   any engineer_remit_* or paid_at stamps set BEFORE the recompute call
--   were wiped to NULL. This file investigates whether that actually happened
--   and which tasks are affected.
--
--   User referenced "4 tasks" but the backfill script targeted 5:
--     A-260701-020 (권창용)
--     A-260701-008 (구현서)
--     A-260702-004 (김병철)
--     A-260701-023 (임종일 #1)
--     A-260702-007 (임종일 #2)
--   All 5 are queried below.
--
-- Detection strategy (no dedicated payments_backup table exists):
--   1. Cross-reference bookkeeping_cashflow rows tagged source='auto_engineer_remit'
--      with matching payments.engineer_remit_confirmed_at. Mig 156 keeps them
--      in lock-step at RPC time. If a cashflow IN row exists for a task_id
--      but payments.engineer_remit_confirmed_at IS NULL, the stamp was
--      almost certainly wiped by the 7/2 recompute.
--   2. Compare payments.computed_at (updated when compute_payment ran) against
--      cashflow flow_date. If computed_at > flow_date (recompute happened
--      after confirmation), plus condition 1, it's a confirmed wipe.
--
-- Read-only, no writes. Safe to run anytime.
-- ============================================================================


-- ============================================================================
-- [A] Current stamp state on the 5 backfilled tasks
-- ============================================================================
SELECT
  t.task_no,
  t.status                          AS task_status,
  t.completed_at,
  p.status                          AS payment_status,
  p.engineer_amount,
  p.principal_amount,
  p.owner_amount,
  p.engineer_remitted_at,
  p.engineer_remit_confirmed_at,
  p.engineer_remit_confirmed_by,
  p.paid_at,
  p.settled_at,
  p.computed_at,
  p.calc_method
FROM tasks t
LEFT JOIN payments p ON p.task_id = t.id
WHERE t.task_no IN (
  'A-260701-020', 'A-260701-008',
  'A-260702-004', 'A-260701-023', 'A-260702-007'
)
ORDER BY t.task_no;


-- ============================================================================
-- [B] Cashflow cross-check - is there an auto_engineer_remit row for each task?
--   If bc row exists but engineer_remit_confirmed_at IS NULL   => wipe detected
--   If bc row exists AND engineer_remit_confirmed_at is set    => stamp intact
--   If no bc row                                               => never confirmed
-- ============================================================================
SELECT
  t.task_no,
  p.engineer_remit_confirmed_at                     AS confirmed_at_now,
  p.engineer_remit_confirmed_by                     AS confirmed_by_now,
  bc.id                                             AS cashflow_row_id,
  bc.flow_date                                      AS cashflow_flow_date,
  bc.amount                                         AS cashflow_amount,
  bc.created_by                                     AS cashflow_created_by,
  bc.created_at                                     AS cashflow_created_at,
  p.computed_at                                     AS payment_computed_at,
  CASE
    WHEN bc.id IS NOT NULL AND p.engineer_remit_confirmed_at IS NULL
      THEN 'WIPE_DETECTED'
    WHEN bc.id IS NOT NULL AND p.engineer_remit_confirmed_at IS NOT NULL
      THEN 'INTACT'
    WHEN bc.id IS NULL AND p.engineer_remit_confirmed_at IS NULL
      THEN 'NEVER_CONFIRMED'
    ELSE 'ORPHAN_STAMP_NO_CASHFLOW'
  END                                               AS verdict
FROM tasks t
LEFT JOIN payments p            ON p.task_id = t.id
LEFT JOIN bookkeeping_cashflow bc
  ON bc.source = 'auto_engineer_remit'
 AND bc.source_ref = t.id
WHERE t.task_no IN (
  'A-260701-020', 'A-260701-008',
  'A-260702-004', 'A-260701-023', 'A-260702-007'
)
ORDER BY t.task_no;


-- ============================================================================
-- [C] Broader sweep - any payments recomputed on 7/2 KST with wipe pattern
--   (cashflow row exists but confirmed_at NULL). Catches tasks NOT in the 5
--   list that may also have been wiped by unrelated recomputes on 7/2.
-- ============================================================================
SELECT
  t.task_no,
  p.computed_at                     AS recomputed_at,
  bc.flow_date                      AS cashflow_flow_date,
  bc.amount                         AS cashflow_amount,
  p.engineer_remit_confirmed_at     AS confirmed_at_now,
  'WIPE_DETECTED'                   AS verdict
FROM payments p
JOIN tasks t                       ON t.id = p.task_id
JOIN bookkeeping_cashflow bc
  ON bc.source = 'auto_engineer_remit'
 AND bc.source_ref = p.task_id
WHERE p.computed_at >= (DATE '2026-07-02' AT TIME ZONE 'Asia/Seoul')
  AND p.computed_at <  (DATE '2026-07-03' AT TIME ZONE 'Asia/Seoul')
  AND p.engineer_remit_confirmed_at IS NULL
ORDER BY p.computed_at;


-- ============================================================================
-- [D] Restore-plan preview (READ-ONLY - no writes)
--   For each WIPE_DETECTED row, propose the restored values based on the
--   cashflow row. Operator reviews this before running the actual restore.
--
-- Proposed restore mapping:
--   engineer_remit_confirmed_at := bc.created_at
--   engineer_remit_confirmed_by := bc.created_by
--   engineer_remitted_at        := coalesce(bc.created_at - interval '1 day', bc.created_at)
--                                  (rough estimate - actual value not recoverable)
--   status                      := '정산완료'
--
-- ⚠️ engineer_remitted_at is the earlier engineer-side stamp. We cannot recover
--    the exact original value from cashflow alone. The proposal uses an
--    approximation (day before confirmation). Operator should verify against
--    other records (bookkeeping notes, chat logs, etc.) before applying.
-- ============================================================================
SELECT
  t.task_no,
  p.task_id,
  bc.created_at                                       AS proposed_engineer_remit_confirmed_at,
  bc.created_by                                       AS proposed_engineer_remit_confirmed_by,
  (bc.created_at - INTERVAL '1 day')                  AS proposed_engineer_remitted_at_approx,
  '정산완료'                                          AS proposed_status,
  p.engineer_remit_confirmed_at                       AS current_confirmed_at,
  p.status                                            AS current_status
FROM payments p
JOIN tasks t                       ON t.id = p.task_id
JOIN bookkeeping_cashflow bc
  ON bc.source = 'auto_engineer_remit'
 AND bc.source_ref = p.task_id
WHERE p.engineer_remit_confirmed_at IS NULL
  AND t.task_no IN (
    'A-260701-020', 'A-260701-008',
    'A-260702-004', 'A-260701-023', 'A-260702-007'
  )
ORDER BY t.task_no;


-- ============================================================================
-- [E] Restore SQL template (DO NOT RUN without review)
--   Wrap in BEGIN/COMMIT; verify Step D output first, then execute matching
--   UPDATE statements one task_no at a time. This is a direct write to payments
--   which is normally forbidden, but here it's a data recovery from an
--   irreversible bug - not a routine operation.
--
-- Template (fill in per task after reviewing Step D):
--
--   BEGIN;
--   UPDATE payments SET
--     status                      = '정산완료',
--     engineer_remit_confirmed_at = <proposed_engineer_remit_confirmed_at>,
--     engineer_remit_confirmed_by = <proposed_engineer_remit_confirmed_by>,
--     engineer_remitted_at        = <verified original OR proposed approx>
--   WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'A-260701-020');
--   -- (verify)
--   SELECT status, engineer_remitted_at, engineer_remit_confirmed_at,
--          engineer_remit_confirmed_by
--   FROM payments
--   WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'A-260701-020');
--   -- (if OK) COMMIT; (else) ROLLBACK;
--
-- ⚠️ Do NOT run this template until Mig 161 v22 is applied. Otherwise the
--    next compute_payment trigger firing will wipe the stamps again.
-- ============================================================================
