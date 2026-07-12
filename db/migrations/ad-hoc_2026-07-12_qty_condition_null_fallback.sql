-- ============================================================================
-- ad-hoc 2026-07-12 — 조건부 (첫대/추가) 만 있고 NULL 조건 없는 policy 전수 backfill
-- 사장님 리포트:
--   KA / refrigerant / 1way 관리자 폼 접수 (1way ×2 한 줄, order_type=NULL)
--   → 첫대/추가 정책만 있어 매칭 실패. leak 때와 동일 패턴 반복.
--   → "누설 때처럼 한 건씩 두더지잡기 말고 전 원청·전 종목 한 번에".
--
-- 진단 방식:
--   commission_policies 그룹핑 (principal_code, service_code, appliance_code):
--     · null_count       = qty_condition IS NULL row 수
--     · qty_cond_count   = qty_condition IS NOT NULL row 수
--   조건: null_count = 0 AND qty_cond_count > 0
--         → NULL fallback 정책 부재 → 관리자 폼 단일 row 접수 시 사고.
--
-- 백필 전략:
--   각 hole 마다 '첫대' row 우선 (있으면), 없으면 첫 조건부 row 를
--   qty_condition=NULL 로 복제. engineer_base / fee_rate / principal_fee /
--   calc_method / notes 모두 원본 그대로. policy_key 만 '_first'/'_extra'
--   접미사 제거 (없으면 그대로).
--
-- 안전:
--   · ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING → 재실행 무해.
--   · calculate_commission ORDER BY (qty_condition IS NOT NULL) DESC LIMIT 1 덕에
--     '첫대' / '추가' 명시된 task 는 여전히 조건부 정책 우선 매칭.
--     NULL fallback 은 order_type 없는 task 에만 적용.
--
-- 실행 후:
--   compute_payment 재계산 → payments 재저장.
-- ============================================================================

BEGIN;

-- ── [1] 사전 진단 — 어떤 combo 가 hole 인지 확인 ─────────────────────
SELECT
  principal_code,
  service_code,
  appliance_code,
  COUNT(*) FILTER (WHERE qty_condition IS NULL)     AS null_count,
  COUNT(*) FILTER (WHERE qty_condition = '첫대')     AS first_count,
  COUNT(*) FILTER (WHERE qty_condition = '추가')     AS extra_count,
  string_agg(policy_key, ' | ' ORDER BY qty_condition NULLS FIRST) AS existing_keys
FROM commission_policies
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY principal_code, service_code, appliance_code
HAVING
  COUNT(*) FILTER (WHERE qty_condition IS NULL) = 0
  AND COUNT(*) FILTER (WHERE qty_condition IS NOT NULL) > 0
ORDER BY principal_code, service_code, appliance_code;
-- 기대: hole 리스트 (예: KA / refrigerant / 1way, KA / leak / 1way [이미 어제 patch], ...).
-- 사장님: 이 리스트를 저에게 알려주시면 예상 backfill 건수 확인 가능.


-- ── [2] 백필 INSERT — '첫대' row 를 qty_condition=NULL 로 복제 ────────
INSERT INTO commission_policies
  (tenant_id, category_id, principal_code, service_code, appliance_code,
   calc_method, policy_key, engineer_base, fee_rate, principal_fee,
   qty_condition, notes)
SELECT DISTINCT ON (tenant_id, principal_code, service_code, appliance_code)
  cp.tenant_id,
  cp.category_id,
  cp.principal_code,
  cp.service_code,
  cp.appliance_code,
  cp.calc_method,
  regexp_replace(cp.policy_key, '_(first|extra)$', '') AS policy_key,
  cp.engineer_base,
  cp.fee_rate,
  cp.principal_fee,
  NULL::text AS qty_condition,
  cp.notes
FROM commission_policies cp
WHERE cp.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND cp.qty_condition IS NOT NULL
  -- 같은 combo 에 이미 NULL row 있으면 skip
  AND NOT EXISTS (
    SELECT 1 FROM commission_policies cp2
    WHERE cp2.tenant_id      = cp.tenant_id
      AND cp2.principal_code = cp.principal_code
      AND cp2.service_code   = cp.service_code
      AND cp2.appliance_code IS NOT DISTINCT FROM cp.appliance_code
      AND cp2.qty_condition IS NULL
  )
ORDER BY tenant_id, principal_code, service_code, appliance_code,
         (qty_condition = '첫대') DESC,   -- 첫대 우선
         (qty_condition = '추가') DESC    -- 그다음 추가
ON CONFLICT (tenant_id, policy_key, effective_from) DO NOTHING;


-- ── [3] 백필 결과 — 방금 추가된 NULL row 리스트 ────────────────────
SELECT
  principal_code,
  service_code,
  appliance_code,
  calc_method,
  engineer_base,
  fee_rate,
  principal_fee,
  policy_key
FROM commission_policies
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND qty_condition IS NULL
  AND policy_key IN (
    SELECT regexp_replace(policy_key, '_(first|extra)$', '')
    FROM commission_policies
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
      AND qty_condition IS NOT NULL
  )
ORDER BY principal_code, service_code, appliance_code;
-- 기대: [1] 진단에서 발견된 hole 마다 정확히 1 row 씩 신설.


-- ── [4] 재진단 — hole 완전 제거 확인 ──────────────────────────────
SELECT
  principal_code,
  service_code,
  appliance_code,
  COUNT(*) FILTER (WHERE qty_condition IS NULL) AS null_count
FROM commission_policies
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY principal_code, service_code, appliance_code
HAVING
  COUNT(*) FILTER (WHERE qty_condition IS NULL) = 0
  AND COUNT(*) FILTER (WHERE qty_condition IS NOT NULL) > 0;
-- 기대: 0 row (hole 완전 해소).


COMMIT;

-- ============================================================================
-- 롤백 (문제 발생 시)
-- ============================================================================
-- BEGIN;
--   -- 방금 신설된 NULL fallback row 만 삭제 (다른 NULL row 보존).
--   DELETE FROM commission_policies
--   WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
--     AND qty_condition IS NULL
--     AND policy_key IN (
--       SELECT regexp_replace(policy_key, '_(first|extra)$', '')
--       FROM commission_policies
--       WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
--         AND qty_condition IS NOT NULL
--     );
-- COMMIT;
