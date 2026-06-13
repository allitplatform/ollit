-- Migration 112 — principals.phone column
-- Adds contact phone number for principals (for account screen).
-- Idempotent. Safe to re-run.

BEGIN;

ALTER TABLE principals
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN principals.phone IS 'Contact phone number. Used on principal account screen alongside bank/account/holder.';

COMMIT;

-- Verify:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='principals' AND column_name='phone';
-- Expect: 1 row, phone / text
