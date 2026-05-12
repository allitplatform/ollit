-- ============================================
-- Migration 008 — engineer_permissions 시드 (29명 engineers.js workTypes 박은 영역)
-- 작성일  : 2026-05-12 (Day 5)
-- 범위    : 30 row (각 기사 박은 영역 cleaning + refrigerant 박은 영역 박은 영역)
-- 출처    : src/data/engineers.js SEED_ENGINEERS 박은 영역 workTypes
-- 매핑    : role='main' → level='main' / role='backup' → level='sub' / role='none' → 박지 X
-- 전제    : 001 + 003 + 004 적용 박힘 (users 측 36명 박혀있음)
-- 실행    : Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- 안전장치:
--   - BEGIN/COMMIT — 부분 실패 시 ROLLBACK
--   - ON CONFLICT DO UPDATE — 재실행 안전 (level / active 박은 영역 박은 영역)
-- ============================================

BEGIN;

-- row 박은 영역 (UUID / service / level):
--   E001 강병익      refrigerant  main
--   E003 권창용      cleaning     sub
--   E005 김동효      cleaning     sub
--   E005 김동효      refrigerant  main
--   E006 김병철      cleaning     sub
--   E007 김영수      cleaning     main
--   E007 김영수      refrigerant  main
--   E008 김윤섭      cleaning     main
--   E008 김윤섭      refrigerant  main
--   E009 김재현      cleaning     sub
--   E010 김태승      cleaning     sub
--   E010 김태승      refrigerant  main
--   E011 김현동      cleaning     main
--   E012 문성목      cleaning     sub
--   E013 손동식      cleaning     sub
--   E014 안승웅      cleaning     main
--   E014 안승웅      refrigerant  main
--   E015 양승문      cleaning     main
--   E015 양승문      refrigerant  main
--   E016 류근학      cleaning     main
--   E017 이상준      cleaning     sub
--   E017 이상준      refrigerant  main
--   E018 임종일      cleaning     main
--   E019 전현진      cleaning     main
--   E019 전현진      refrigerant  main
--   E020 정상현      cleaning     main
--   E020 정상현      refrigerant  main
--   E021 정훈       cleaning     main
--   E021 정훈       refrigerant  main
--   E028 변기현      refrigerant  main

INSERT INTO engineer_permissions (user_id, service_code, level, active) VALUES
  ('77777777-7777-7777-7777-7777777e0001', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0003', 'cleaning', 'sub', true),
  ('77777777-7777-7777-7777-7777777e0005', 'cleaning', 'sub', true),
  ('77777777-7777-7777-7777-7777777e0005', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0006', 'cleaning', 'sub', true),
  ('77777777-7777-7777-7777-7777777e0007', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0007', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0008', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0008', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0009', 'cleaning', 'sub', true),
  ('77777777-7777-7777-7777-7777777e0010', 'cleaning', 'sub', true),
  ('77777777-7777-7777-7777-7777777e0010', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0011', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0012', 'cleaning', 'sub', true),
  ('77777777-7777-7777-7777-7777777e0013', 'cleaning', 'sub', true),
  ('77777777-7777-7777-7777-7777777e0014', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0014', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0015', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0015', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0016', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0017', 'cleaning', 'sub', true),
  ('77777777-7777-7777-7777-7777777e0017', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0018', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0019', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0019', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0020', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0020', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0021', 'cleaning', 'main', true),
  ('77777777-7777-7777-7777-7777777e0021', 'refrigerant', 'main', true),
  ('77777777-7777-7777-7777-7777777e0028', 'refrigerant', 'main', true)
ON CONFLICT (user_id, service_code) DO UPDATE
  SET level  = EXCLUDED.level,
      active = EXCLUDED.active;

COMMIT;

-- ============================================
-- 검증 — 박힌 영역 박을 영역 (기대: 30 row)
-- ============================================
SELECT u.code, u.name, ep.service_code, ep.level, ep.active
FROM engineer_permissions ep
JOIN users u ON u.id = ep.user_id
WHERE u.tenant_id = '11111111-1111-1111-1111-111111111111'
ORDER BY u.code, ep.service_code;

-- 카운트
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE level = 'main') AS main_count,
  count(*) FILTER (WHERE level = 'sub')  AS sub_count
FROM engineer_permissions ep
JOIN users u ON u.id = ep.user_id
WHERE u.tenant_id = '11111111-1111-1111-1111-111111111111';
