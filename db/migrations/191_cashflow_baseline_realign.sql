-- Migration 191 — 통장 기준 잔고 재정렬 · 가짜 보정 입금 제거 (2026-07-25)
--
-- BACKGROUND
--   Mig 122: current_balance = baseline_amount + SUM(in) - SUM(out)
--            (time-independent; baseline_date is a label only, not a filter)
--
--   The 6/29 baseline 19,700,106 was defined from TWO accounts only
--   (올데이 8,642,606 + 현서 10,000,000, per the 2026-06-28 reset note),
--   but the ledger records movements across FOUR accounts
--   (우리 / 현서 / 카카오 / 농협). Evidence in the ledger itself:
--     2026-06-29 out 1,141,300   "현서통장 지출 · 에어컨 자재"
--     2026-07-15 out 26,294,828  "유솔N 기사 월정산 1차" (paid from 카카오)
--     2026-07-16 out 1,000,000   "쿨가이 수수료 · 농협 구현서 경유"
--   => the baseline undercounted the opening cash by the 카카오/농협 balances.
--
--   Two "보정" rows were inserted over time to force the displayed balance
--   to match the bank app. They are not real deposits and they inflate the
--   daily-inflow statistics:
--     2026-07-21 in  2,995,994   (Mig 186 step 5)
--     2026-07-25 in 10,430,625   (Mig 190 step 3)
--     total        13,426,619
--
-- MEASURED (2026-07-25)
--   ledger rows total net              24,049,342
--   minus the two 보정 rows            -13,426,619
--   genuine recorded movement          10,622,723
--   actual company cash (all accounts
--     now consolidated into 우리은행)   43,749,448
--   => correct opening balance = 43,749,448 - 10,622,723 = 33,126,725
--
-- EFFECT
--   displayed balance unchanged (43,749,448)
--   transaction list no longer contains fake deposits
--   daily inflow statistics corrected

BEGIN;

-- [1] remove the two force-fit correction deposits
DELETE FROM bookkeeping_cashflow
WHERE source = 'manual'
  AND direction = 'in'
  AND memo LIKE '통장 정합 보정%';

-- [2] restate the opening balance to cover all accounts
UPDATE bookkeeping_cashflow_baseline
SET baseline_date   = '2026-06-29',
    baseline_amount = 33126725,
    memo            = '개시 잔고 · 전 통장 합산 (우리/현서/카카오/농협) · Mig 191 재정렬',
    updated_at      = now()
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

COMMIT;

-- VERIFY — expect: balance 43749448 / 남은보정 0 / 기준잔고 33126725
SELECT
  (SELECT baseline_amount FROM bookkeeping_cashflow_baseline
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid)
  + COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0) AS 잔액,
  (SELECT COUNT(*) FROM bookkeeping_cashflow WHERE memo LIKE '통장 정합 보정%') AS 남은보정,
  (SELECT baseline_amount FROM bookkeeping_cashflow_baseline
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid) AS 기준잔고
FROM bookkeeping_cashflow;
