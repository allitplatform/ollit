-- ============================================================================
-- Migration 066 — usol_n 추가선택 냉매점검 = 35/15/50 정책 변경
-- 작성: 2026-05-24
-- ============================================================================
-- 배경:
--   현재 usol_n + order_type='추가선택' + service='refrigerant' (=addon/냉매점검 변환)
--     = calc_method='usol_n_추가선택' → 기사 85% / 유솔 15% / 회사 0
--
-- 신규 spec (사장님 확정):
--   usol_n 추가선택 냉매점검 = 정산금액 기준 기사 35% / 유솔 15% / 회사 50%
--   (round 차이는 회사가 흡수 — engineer + principal 측 정확히 35/15, 회사 = 나머지)
--
-- 변경 범위:
--   1) calculate_commission 측 catch 새 WHEN 'usol_n_추가선택_냉매' 분기 추가
--   2) commission_policies 측 catch usol_n_addon_refri_check.calc_method
--      = 'usol_n_추가선택' → 'usol_n_추가선택_냉매'
--
--   다른 usol_n 추가선택 (송풍팬분해/실외기/피톤치드) = usol_n_추가선택 측 catch 그대로 (85/15/0)
--   compute_payment / Migration 065 RPC = 측 catch 측 catch X (calc_method 측 catch 측 catch X)
--
-- 의존:
--   - Migration 009 (commission_policies + calculate_commission v6)
--   - Migration 047 (calculate_commission v7 — usol_n_냉매점검 50/50)
--   - Migration 050 (compute_payment v14)
--
-- 회귀 방지:
--   - 측 6 원청 측 catch — calc_method 측 catch 측 catch X
--   - usol_n 본작업 (cleaning) — 측 catch X
--   - usol_n 추가선택 송풍팬분해/실외기/피톤치드 — calc_method='usol_n_추가선택' 측 catch — 측 catch X
--   - usol_n 냉매점검 (refrigerant 본작업) — calc_method='usol_n_냉매점검' 측 catch — 측 catch X
--   - usol_n 추가선택 + 냉매점검 (addon_refri_check) 측 — 측 catch 측 catch 35/15/50
--
-- 재실행:
--   - CREATE OR REPLACE FUNCTION — idempotent
--   - UPDATE … WHERE policy_key = 'usol_n_addon_refri_check' — idempotent
--
-- 재계산:
--   - Migration 적용 측 catch 영향 105 task compute_payment 일괄 호출 측 catch (별도 단계)
-- ============================================================================

BEGIN;

-- [0] commission_policies_calc_method_check 갱신 — 측 calc_method 'usol_n_추가선택_냉매' 측 catch
-- (Migration 009 측 catch CHECK 측 catch 11개 + 1 = 12개. 기존 측 catch 측 catch 측 catch — 측 catch 측 catch 측 catch 측 catch.)
ALTER TABLE commission_policies DROP CONSTRAINT IF EXISTS commission_policies_calc_method_check;
ALTER TABLE commission_policies ADD CONSTRAINT commission_policies_calc_method_check
  CHECK (calc_method IN (
    '직영_0', '직영_50_50',
    '차감후비율_50',
    '비율_견적금액', '비율_총금액', '비율_판매가',
    '정액',
    'usol_n_본작업', 'usol_n_추가선택', 'usol_n_추가선택_냉매', 'usol_n_냉매점검',
    '출장비_30K'
  ));

-- [1] calculate_commission v8 — 새 WHEN 측 catch 추가
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
      v_engineer  := 30000;
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
  'v8 (Migration 066) — usol_n_추가선택_냉매 분기 추가 (35/15/50). v7 기능 측 catch 그대로.';

-- [2] commission_policies UPDATE — usol_n_addon_refri_check 측 calc_method 측 catch
UPDATE commission_policies
SET calc_method = 'usol_n_추가선택_냉매'
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND policy_key = 'usol_n_addon_refri_check';

COMMIT;

-- ============================================================================
-- 검증 SQL (별도 실행)
-- ============================================================================

-- 1) 정책 변경 확인 — calc_method='usol_n_추가선택_냉매'
-- SELECT policy_key, service_code, appliance_code, calc_method, fee_rate
-- FROM commission_policies
-- WHERE principal_code = 'usol_n' AND policy_key = 'usol_n_addon_refri_check';
-- 기대: calc_method = 'usol_n_추가선택_냉매'

-- 2) calculate_commission 검증 — 견적 10,000
-- SELECT calculate_commission('usol_n', 'addon', '냉매점검', 10000, 0, 0, NULL);
-- 기대: engineer=3500 / principal=1500 / company=5000 (round 측 catch 측 catch)

-- 3) 회귀 — 측 측 catch addon 측 catch
-- SELECT calculate_commission('usol_n', 'addon', '송풍팬분해', 10000, 0, 0, NULL);
-- 기대: engineer=8500 / principal=1500 / company=0 (= usol_n_추가선택 측 catch)

-- 4) 회귀 — usol_n_본작업 (cleaning)
-- SELECT calculate_commission('usol_n', 'cleaning', 'wall', 70400, 0, 0, NULL);
-- 기대: 측 catch 측 catch 측 catch 측 catch (engineer = engineer_base × 1.10 = 44000)

-- 5) 회귀 — 측 6 원청 (allday cleaning)
-- SELECT calculate_commission('allday', 'cleaning', '벽걸이', 70000, 0, 0, NULL);
-- 기대: 측 v7 측 catch 측 catch

-- ============================================================================
-- 재계산 SQL — 영향 105 task 일괄 compute_payment (Migration 측 catch 별도)
-- ============================================================================
-- SELECT compute_payment(t.id) AS payment_id, t.task_no, t.customer_name
-- FROM tasks t
-- WHERE t.principal_id = (SELECT id FROM principals WHERE code = 'usol_n' LIMIT 1)
--   AND EXISTS (
--     SELECT 1 FROM task_items ti
--     JOIN work_types wt ON wt.id = ti.work_type_id
--     JOIN service_types st ON st.id = wt.service_type_id
--     WHERE ti.task_id = t.id
--       AND ti.order_type = '추가선택'
--       AND st.code = 'refrigerant'
--   );
