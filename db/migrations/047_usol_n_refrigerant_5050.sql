-- 047_usol_n_refrigerant_5050.sql
-- 2026-05-21 — usol_n 냉매점검 정산 룰 정정 (전체 50/50)
--
-- 사장님 spec 확정:
--   usol_n 냉매 메인 작업 = 전체 금액(v_total) 기사 50% / 회사 50% / 원청 0
--
-- 옛 spec (Migration 009 / 잘못됨):
--   extra=0:  원청 100% (quoted) / 기사 0 / 회사 0
--   extra>0:  원청 = quoted / 기사 = extra/2 / 회사 = extra/2
--
-- 새 spec (이 Migration):
--   전체:     원청 0 / 기사 = v_total/2 / 회사 = v_total - 기사
--   → 직영_50_50과 동일 패턴 (allday 냉매가 이미 쓰는 검증된 룰)
--
-- 변경 범위:
--   calculate_commission 함수의 WHEN 'usol_n_냉매점검' 분기만 교체.
--   다른 WHEN 절 / 함수 시그니처 / commission_policies row = 모두 그대로.
--
-- 회귀 방지:
--   - 다른 calc_method (직영_50_50 / 직영_0 / 비율_* / 정액 / usol_n_본작업 / usol_n_추가선택 / 출장비_30K) 영향 0
--   - 다른 원청 (allday / KA / KB / yongin / usol_h / crikrin) 냉매 영향 0
--   - usol_n 세척(usol_n_본작업) / 추가선택(usol_n_추가선택) 영향 0
--   - WHEN 'usol_n_냉매점검' 분기만 변경
--
-- 의존:
--   - Migration 009 (commission_policies + calculate_commission v6)
--   - Migration 035 (usol_n_냉매점검 추가 row — refri_no_appliance)
--
-- 실행:
--   - Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   - CREATE OR REPLACE FUNCTION 측 재실행 안전 (idempotent)
--
-- 검증 (이 Migration 적용 후):
--   - usol_n 냉매 테스트 task 1건 → compute_payment → 기사 50% / 회사 50% / 원청 0 확인
--   - 다른 원청 task 재계산 → 변동 0건

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
  -- 정책 조회 (qty_condition 우선 매칭)
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

    WHEN 'usol_n_냉매점검' THEN
      -- 2026-05-21 Migration 047 (사장님 spec 확정):
      --   전체 금액(v_total) = 기사 50% / 회사 50% / 원청 0
      --   직영_50_50 측 동일 패턴 (allday 냉매가 이미 쓰는 검증된 룰)
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
  'v7 (Migration 047) — usol_n_냉매점검 = 전체 50/50 + 원청 0 (사장님 spec 정정). 그 외 calc_method 측 v6 그대로.';

-- ============================================
-- 검증 SQL (별도 실행 spec / Migration 047 적용 후)
-- ============================================

-- 1) usol_n 냉매점검 — 견적 10,000 / extra 0
-- 기대: engineer=5,000 / principal=0 / company=5,000
-- SELECT calculate_commission('usol_n', 'refrigerant', NULL, 10000, 0, 0, NULL);

-- 2) usol_n 냉매점검 — 견적 10,000 / extra 50,000
-- 기대: engineer=30,000 / principal=0 / company=30,000 (v_total=60,000)
-- SELECT calculate_commission('usol_n', 'refrigerant', NULL, 10000, 50000, 0, NULL);

-- 3) 회귀 — allday 냉매 (직영_50_50) 그대로
-- 기대: engineer=35,000 / principal=0 / company=35,000 (v_total=70,000)
-- SELECT calculate_commission('allday', 'refrigerant', '벽걸이', 70000, 0, 0, NULL);

-- 4) 회귀 — KA 냉매 (비율_견적금액) 그대로
-- 기대: principal=24,500 / engineer=35,000 / company=10,500
-- SELECT calculate_commission('KA', 'refrigerant', '벽걸이', 70000, 0, 0, NULL);

-- 5) usol_n 냉매 task 측 측 compute_payment 재실행 (Supabase 측 측 spec)
-- SELECT compute_payment(t.id) AS payment_id, t.task_no, t.customer_name
-- FROM tasks t
-- WHERE t.principal_id = (SELECT id FROM principals WHERE code = 'usol_n' LIMIT 1)
--   AND EXISTS (
--     SELECT 1 FROM task_items ti
--     JOIN work_types wt ON wt.id = ti.work_type_id
--     JOIN service_types st ON st.id = wt.service_type_id
--     WHERE ti.task_id = t.id AND st.code = 'refrigerant' AND ti.order_type = '본작업'
--   );
