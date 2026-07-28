-- Migration 195 - new service type 누수 (water leak) (2026-07-28)
--
-- Owner decision (2026-07-28):
--   "수리" is not a real category. 누수 (water dripping repair) is separate
--   from 누설 (refrigerant leak). Pool = refrigerant engineers. Split = same
--   as refrigerant/leak (rate based). Homepage will offer the two separately.
--
-- This migration:
--   [1] service_types: add 누수 (code 'water_leak')
--   [2] work_types: 누수 x appliances (price 0 - decided on site)
--       + backfill 누설 work_types if missing (same pattern, ON CONFLICT safe)
--   [3] commission_policies: clone every existing leak policy row to
--       water_leak (column-agnostic via jsonb_populate_record - keeps
--       calc_method/fee_rate/engineer_base identical to leak = refrigerant mirror)
--   [4] NOTE: compute_payment must also learn 'water_leak' -> run Mig 196 next.
--
-- DEPLOY ORDER: 195 -> 196 -> then push the app forms.

BEGIN;

-- [1] service type
INSERT INTO service_types (id, category_id, code, name) VALUES
  ('44444444-4444-4444-4444-444444444008', '33333333-3333-3333-3333-333333333001', 'water_leak', '누수')
ON CONFLICT (id) DO NOTHING;

-- [2] work_types for 누수 (and 누설 backfill) - price 0, on-site pricing
INSERT INTO work_types (service_type_id, appliance_type_id, code, name, default_unit_price)
SELECT st.id, a.id, st.code || '_' || a.code, st.name || '_' || a.name, 0
FROM service_types st
CROSS JOIN appliance_types a
WHERE st.code IN ('water_leak', 'leak')
  AND a.code IN ('wall', '1way', 'stand', '4way', '2in1')
ON CONFLICT (service_type_id, appliance_type_id, code) DO NOTHING;

-- [3] commission policies: clone leak -> water_leak (identical numbers)
INSERT INTO commission_policies
SELECT (jsonb_populate_record(
          c,
          jsonb_build_object(
            'id',           gen_random_uuid(),
            'service_code', 'water_leak',
            'policy_key',   replace(c.policy_key, '_leak_', '_wleak_')
          )
       )).*
FROM commission_policies c
WHERE c.service_code = 'leak'
ON CONFLICT DO NOTHING;

COMMIT;

-- VERIFY - expect: 종목 1 / 작업행 5이상 / 정책 = 누설 정책 수와 동일
SELECT
  (SELECT COUNT(*) FROM service_types WHERE code = 'water_leak')                AS 종목,
  (SELECT COUNT(*) FROM work_types wt JOIN service_types st ON st.id = wt.service_type_id
    WHERE st.code = 'water_leak')                                               AS 작업행,
  (SELECT COUNT(*) FROM commission_policies WHERE service_code = 'water_leak')  AS 누수정책,
  (SELECT COUNT(*) FROM commission_policies WHERE service_code = 'leak')        AS 누설정책;
