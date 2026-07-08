-- ============================================================================
-- Migration 168 - calculate_commission v9 - 출장비_30K engineer_base 참조
-- Date    : 2026-07-08
-- Base    : Mig 066 v8 body (2026-05-24, usol_n_추가선택_냉매 분기 추가).
--
-- Problem case:
--   commission_policies 에 KB visit_fee 정책 추가 (engineer_base=40000).
--   calculate_commission('KB','visit_fee',NULL,0,0,0,NULL) 호출 시 engineer=30000
--   반환 (기대: 40000).
--
-- Root cause (Mig 066 v8):
--   CASE v_policy.calc_method 의 '출장비_30K' 분기가 하드코딩:
--     WHEN '출장비_30K' THEN
--       v_engineer  := 30000;      -- ★ 정책 base 무시
--       v_principal := 0;
--       v_company   := 0;
--   commission_policies.engineer_base 컬럼 값을 안 읽고 상수 30000 반환.
--
-- Fix (최소 침습, 사장님 지시 그대로 한 줄):
--   v_engineer := 30000  →  v_engineer := v_policy.engineer_base
--
--   효과:
--     · 6개 원청 (base 30000) + common (base 30000) 동일 결과 유지.
--     · KB (base 40000) 만 40000 반환.
--   CHECK 제약 / calc_method 라벨 / 다른 분기 (직영/비율/정액/usol_n/냉매)
--   전부 무손.
--
-- ⚠️ Deployment 전 필수 (사장님 지시 1):
--   1) 라이브 v8 prosrc 캡처:
--        SELECT prosrc FROM pg_proc
--        WHERE proname = 'calculate_commission' AND pronargs = 7;
--      이 파일 본문과 라인별 대조.
--   2) '출장비_30K' WHEN 분기 한 줄만 변경 재확인.
--   3) 다른 분기 (직영_0 / 직영_50_50 / 차감후비율_50 / 비율_견적금액 /
--      비율_총금액 / 비율_판매가 / 정액 / usol_n_본작업 / usol_n_추가선택 /
--      usol_n_추가선택_냉매 / usol_n_냉매점검) 전부 무손.
--   4) CREATE OR REPLACE (DROP 아님) — 사장님 spec.
--
-- Regression 안전:
--   · 6 원청 + common visit_fee row 모두 engineer_base=30000 → v9 반환 30000.
--     v8 동일 결과. 회귀 없음.
--   · KB 만 base=40000 → v9 반환 40000. 신규 지원.
--   · 다른 calc_method 분기 통과: v_policy.engineer_base 는 각자 이미 사용
--     (직영_0 / 차감후비율_50 / 비율_견적금액 cleaning / 비율_판매가 / 정액
--     cleaning / usol_n_본작업). '출장비_30K' 만 하드코딩되어 있던 예외.
--
-- Verification (사장님 지시 3):
--   · calculate_commission('KB','visit_fee',NULL,0,0,0,NULL) → engineer=40000
--   · calculate_commission('KA','visit_fee',NULL,0,0,0,NULL) → engineer=30000 (안 바뀜)
--   · calculate_commission('common','visit_fee',NULL,0,0,0,NULL) → engineer=30000
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION calculate_commission(
  p_principal_code text,
  p_service_code   text,
  p_appliance_code text,
  p_quoted_amount  int,
  p_extra_amount   int DEFAULT 0,
  p_naver_fee      int DEFAULT 0,
  p_qty_condition  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy    commission_policies%ROWTYPE;
  v_total     int;
  v_engineer  int := 0;
  v_principal int := 0;
  v_company   int := 0;
  v_fake_base int;
  v_principal_fee int;
BEGIN
  SELECT * INTO v_policy FROM commission_policies
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
    AND principal_code = p_principal_code
    AND service_code   = p_service_code
    AND (appliance_code = p_appliance_code OR (appliance_code IS NULL AND p_appliance_code IS NULL))
    AND (qty_condition IS NULL OR qty_condition = p_qty_condition)
  ORDER BY (qty_condition IS NOT NULL) DESC
  LIMIT 1;

  IF v_policy.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'policy_not_found',
      'principal', p_principal_code, 'service', p_service_code, 'appliance', p_appliance_code);
  END IF;

  v_total := COALESCE(p_quoted_amount, 0) + COALESCE(p_extra_amount, 0);

  CASE v_policy.calc_method
    WHEN '직영_0' THEN
      v_principal := 0;
      v_engineer  := v_policy.engineer_base;
      v_company   := p_quoted_amount - v_engineer;

    WHEN '직영_50_50' THEN
      v_principal := 0;
      v_engineer  := (v_total / 2)::int;
      v_company   := v_total - v_engineer;

    WHEN '차감후비율_50' THEN
      v_fake_base := (v_policy.notes::jsonb -> 'fake_base' ->> p_appliance_code)::int;
      v_principal := ((p_quoted_amount - v_fake_base) * 0.5)::int;
      v_engineer  := v_policy.engineer_base;
      v_company   := p_quoted_amount - v_principal - v_engineer;

    WHEN '비율_견적금액' THEN
      v_principal := (p_quoted_amount * v_policy.fee_rate)::int;
      IF p_service_code = 'cleaning' THEN
        v_engineer := v_policy.engineer_base;
        v_company  := p_quoted_amount - v_principal - v_engineer;
      ELSE
        v_engineer := (v_total / 2)::int;
        v_company  := v_total - v_principal - v_engineer;
      END IF;

    WHEN '비율_총금액' THEN
      v_principal := (v_total * v_policy.fee_rate)::int;
      v_engineer  := (v_total / 2)::int;
      v_company   := v_total - v_principal - v_engineer;

    WHEN '비율_판매가' THEN
      v_principal := (p_quoted_amount * v_policy.fee_rate)::int;
      v_engineer  := v_policy.engineer_base;
      v_company   := p_quoted_amount - v_principal - v_engineer;

    WHEN '정액' THEN
      v_principal_fee := COALESCE(v_policy.principal_fee::int, 10000);
      v_principal := v_principal_fee;
      IF p_service_code = 'cleaning' THEN
        v_engineer := v_policy.engineer_base;
        v_company  := p_quoted_amount - v_principal - v_engineer;
      ELSE
        v_engineer := (v_total / 2)::int;
        v_company  := v_total - v_principal - v_engineer;
      END IF;

    WHEN 'usol_n_본작업' THEN
      v_engineer  := (v_policy.engineer_base * 1.10)::int;
      v_principal := ((p_quoted_amount - COALESCE(p_naver_fee, 0)) * v_policy.fee_rate)::int;
      v_company   := (p_quoted_amount - COALESCE(p_naver_fee, 0)) - v_principal - v_engineer;

    WHEN 'usol_n_추가선택' THEN
      v_engineer  := (p_quoted_amount * (1 - v_policy.fee_rate))::int;  -- 85%
      v_principal := (p_quoted_amount * v_policy.fee_rate)::int;        -- 15%
      v_company   := 0;

    WHEN 'usol_n_추가선택_냉매' THEN
      -- 2026-05-24 Migration 066 — usol_n 추가선택 냉매점검 = 35/15/50
      v_engineer  := (p_quoted_amount * 0.35)::int;
      v_principal := (p_quoted_amount * 0.15)::int;
      v_company   := p_quoted_amount - v_engineer - v_principal;  -- 50% (round 차이는 company 흡수)

    WHEN 'usol_n_냉매점검' THEN
      -- Migration 047 (사장님 spec 확정):
      --   전체 금액(v_total) = 기사 50% / 회사 50% / 원청 0
      v_principal := 0;
      v_engineer  := (v_total / 2)::int;
      v_company   := v_total - v_engineer;

    WHEN '출장비_30K' THEN
      -- 2026-07-08 Migration 168 v9 — engineer_base 참조.
      --   이전 (v8): v_engineer := 30000 하드코딩 → commission_policies.engineer_base
      --     값 무시. KB visit_fee 정책 (base=40000) 넣어도 30000 반환.
      --   신 (v9): v_policy.engineer_base 참조 → seed 값 그대로.
      --     6 원청 + common (base=30000) 결과 무변화. KB (base=40000) 신규 지원.
      v_engineer  := v_policy.engineer_base;
      v_principal := 0;
      v_company   := 0;
  END CASE;

  RETURN jsonb_build_object(
    'ok',          true,
    'total',       v_total,
    'principal',   v_principal,
    'engineer',    v_engineer,
    'company',     v_company,
    'calc_method', v_policy.calc_method,
    'policy_key',  v_policy.policy_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_commission(text, text, text, int, int, int, text) TO authenticated;

COMMENT ON FUNCTION calculate_commission(text, text, text, int, int, int, text) IS
  'v9 (Migration 168, 2026-07-08) - 출장비_30K 분기 engineer_base 참조. '
  '이전 v8 하드코딩 30000 → v_policy.engineer_base. '
  '6원청+common (base 30000) 결과 무변화. KB (base 40000) 신규 지원. '
  'v8 다른 분기 (직영/비율/정액/usol_n/냉매) 완전 유지.';

COMMIT;

-- ============================================================================
-- 필수 사전 캡처 (사장님 지시 1) — 이 파일 실행 BEFORE 반드시 실행
-- ============================================================================
-- SELECT prosrc FROM pg_proc
-- WHERE proname = 'calculate_commission' AND pronargs = 7;
--
-- 라이브 v8 (Mig 066) 와 대조. 대조 후:
--   · '출장비_30K' WHEN 분기의 v_engineer 줄만 변경 재확인.
--     was: v_engineer  := 30000;
--     now: v_engineer  := v_policy.engineer_base;
--   · v_principal / v_company 는 v8 그대로 (0 / 0).
--   · 다른 WHEN 분기 (11개) 전부 무손.
--   · 정책 조회 SELECT (라인 80-87) v8 그대로.
--   · policy_not_found 반환 로직 그대로.
--   · RETURN jsonb_build_object 그대로.

-- ============================================================================
-- Post-apply verification (사장님 지시 3)
-- ============================================================================
--
-- A. 함수 코멘트 확인 - v9 표기:
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args,
--        obj_description(oid, 'pg_proc') AS note
-- FROM pg_proc
-- WHERE proname = 'calculate_commission';
-- 기대: v9 (Migration 168, 2026-07-08) 표기.
--
-- B. 3-way visit_fee 검증 (BEGIN/ROLLBACK 불필요 — read-only):
-- SELECT
--   'KB'      AS principal,
--   calculate_commission('KB','visit_fee',NULL,0,0,0,NULL) AS result;
-- 기대 result -> engineer: 40000, principal: 0, company: 0.
--
-- SELECT
--   'KA'      AS principal,
--   calculate_commission('KA','visit_fee',NULL,0,0,0,NULL) AS result;
-- 기대 result -> engineer: 30000 (안 바뀜).
--
-- SELECT
--   'common'  AS principal,
--   calculate_commission('common','visit_fee',NULL,0,0,0,NULL) AS result;
-- 기대 result -> engineer: 30000.
--
-- C. 회귀 - 다른 분기 sample (calc_method 별 1건씩):
-- SELECT '직영_0-allday-cleaning-벽걸이' AS lbl,
--        calculate_commission('allday','cleaning','벽걸이',70000,0,0,NULL) AS result;
-- 기대: v8 과 완전 동일 (engineer_base 이미 사용하던 분기).
--
-- SELECT '차감후비율_50-KA-cleaning-벽걸이' AS lbl,
--        calculate_commission('KA','cleaning','벽걸이',80000,0,0,NULL) AS result;
--
-- SELECT '비율_견적금액-KA-refri-1way' AS lbl,
--        calculate_commission('KA','refrigerant','1way',90000,0,0,'첫대') AS result;
--
-- SELECT '정액-yongin-cleaning-벽걸이' AS lbl,
--        calculate_commission('yongin','cleaning','벽걸이',70000,0,0,NULL) AS result;
--
-- SELECT 'usol_n_본작업-usol_n-cleaning-벽걸이' AS lbl,
--        calculate_commission('usol_n','cleaning','벽걸이',70000,0,0,NULL) AS result;
--
-- SELECT 'usol_n_추가선택_냉매-usol_n-addon-냉매점검' AS lbl,
--        calculate_commission('usol_n','addon','냉매점검',10000,0,0,NULL) AS result;
-- 기대: 전부 v8 완전 동일.
--
-- D. commission_policies visit_fee row 확인:
-- SELECT principal_code, service_code, appliance_code, engineer_base, calc_method, policy_key
-- FROM commission_policies
-- WHERE service_code = 'visit_fee'
-- ORDER BY principal_code;
-- 기대: KB row engineer_base=40000, 나머지 30000 (사장님 seed 상태 확인).
--
-- ============================================================================
-- Rollback (위급 시)
-- ============================================================================
-- 캡처한 v8 prosrc 로 CREATE OR REPLACE FUNCTION calculate_commission ... 재적용.
-- Mig 168 v9 는 '출장비_30K' 분기 한 줄만 변경 → diff 명확 → 롤백 리스크 낮음.
