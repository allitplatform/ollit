-- Migration 197 - inquiries accept leak / water_leak (2026-07-28)
-- ALREADY EXECUTED in production on 2026-07-28 (emergency, homepage submits
-- were rejected after the 누설/누수 option split). This file is the record.
--
-- [1] create_inquiry whitelist: + 'leak', 'water_leak'
-- [2] inquiries_service_type_check constraint: same extension

-- [1] (function body identical to production original except the whitelist line)
-- See production for full body - whitelist line now:
--   IF p_service_type IS NULL OR p_service_type NOT IN
--        ('refrigerant','cleaning','repair','install','unknown','leak','water_leak') THEN

-- [2]
-- BEGIN;
-- ALTER TABLE inquiries DROP CONSTRAINT inquiries_service_type_check;
-- ALTER TABLE inquiries ADD CONSTRAINT inquiries_service_type_check
--   CHECK (service_type = ANY (ARRAY[
--     'refrigerant'::text, 'cleaning'::text, 'repair'::text,
--     'install'::text, 'unknown'::text,
--     'leak'::text, 'water_leak'::text
--   ]));
-- COMMIT;

-- VERIFY
SELECT pg_get_constraintdef(oid) AS 제약
FROM pg_constraint
WHERE conrelid = 'inquiries'::regclass AND conname = 'inquiries_service_type_check';
