-- ============================================================================
-- Migration 269 - 접수 폼 분배 미리보기: 직영 주방후드 · 직영 로봇청소기도 실제 정산과 같은 규칙으로
-- 작성 2026-10-16 · 선행: 268
--
-- 사장님 제보 (블록 82)
--   운영자 새 접수에서 직영 로봇청소기 · 직영 주방후드를 고르면 분배 미리보기에
--   "이 종목은 직영 단가 규칙이 없습니다" 가 나온다.
-- 원인
--   미리보기는 옛 단가표(commission_policies)를 읽는 calculate_commission 을 부른다.
--   직영 주방후드 · 직영 로봇청소기 규칙은 새 규칙표(fee_rules) + compute_payment 에만 있다 -> policy_not_found.
--   실제 정산(compute_payment)은 맞게 계산된다. 화면 미리보기만 틀렸다.
--
-- 바꾼 것
--   새 함수 preview_direct_split(원청 코드, 항목 목록, 견적 합계) - 읽기만 하고 아무것도 저장하지 않는다.
--   · 로봇청소기: compute_payment 의 로봇청소기 분기가 부르는 _robot_split 을 그대로 부른다.
--   · 주방후드:  compute_payment 의 직영 주방후드 분기와 같은 규칙 · 같은 함수(_sub_principal_share, _hood_fixed_calc).
--                접수 때 견적은 부가세 별도라 견적 = 공급가로 본다 (완료 전 예상과 같은 기준).
--   · 그 밖의 종목: { applies: false } -> 화면은 지금처럼 calculate_commission 으로 미리보기한다.
--   compute_payment · calculate_commission 은 손대지 않았다.
--
-- 기존 데이터 영향: 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION preview_direct_split(
  p_principal_code text,
  p_items          jsonb,        -- [{ workType, appliance, qty, unitPrice? }]  접수 화면의 작업 항목 그대로
  p_total          int           -- 견적 합계
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid := '11111111-1111-1111-1111-111111111111';
  v_today  date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_total  int  := GREATEST(COALESCE(p_total, 0), 0);
  v_cat    text;
  v_rule   fee_rules%ROWTYPE;
  v_fx     jsonb;
  v_fee    int := 0;
  v_eng    int := 0;
  v_share  int := 0;
  v_kbnote text;
  v_lines  jsonb;
  v_pfee   int;
  v_method text;
  v_basis  text;
  v_sum    text;
BEGIN
  -- 종목: 공통 서비스(출장비)를 건너뛴 첫 항목의 종목 (작업 저장 때 종목을 정하는 규칙과 같은 순서)
  SELECT c.code INTO v_cat
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY AS e(x, ord)
    JOIN service_types st ON st.name = e.x ->> 'workType'
    JOIN categories c     ON c.id = st.category_id
   WHERE NOT COALESCE(st.is_common, false)
   ORDER BY e.ord
   LIMIT 1;

  IF v_cat = 'robot' THEN
    SELECT * INTO v_rule FROM fee_rules f
     WHERE f.tenant_id = v_tenant AND f.subcontractor_id IS NULL AND f.service_code = 'robot'
       AND f.active AND f.effective_from <= v_today
     ORDER BY f.effective_from DESC LIMIT 1;
    IF v_rule.id IS NULL THEN RETURN jsonb_build_object('applies', false); END IF;

    v_fx  := _robot_split(v_total, v_rule.fee_type, v_rule.fee_rate, v_rule.fee_amount);
    v_fee := (v_fx ->> 'fee')::int;
    v_eng := (v_fx ->> 'engineer')::int;
    v_method := '직영_로봇청소기';
    v_basis  := '받은 총금액 기준';

  ELSIF v_cat = 'hood' THEN
    SELECT * INTO v_rule FROM fee_rules f
     WHERE f.tenant_id = v_tenant AND f.subcontractor_id IS NULL AND f.service_code = 'hood'
       AND f.active AND f.effective_from <= v_today
       AND (f.principal_code IS NULL OR f.principal_code = p_principal_code)
     ORDER BY (f.principal_code IS NOT NULL)::int DESC, f.effective_from DESC LIMIT 1;
    IF v_rule.id IS NULL THEN RETURN jsonb_build_object('applies', false); END IF;

    -- compute_payment 직영 주방후드 분기와 같은 식 (견적 = 공급가)
    v_fee := CASE WHEN v_rule.fee_type = 'rate' THEN ROUND(v_total * v_rule.fee_rate)::int
                  ELSE COALESCE(v_rule.fee_amount, 0) END;
    v_fee := LEAST(GREATEST(v_fee, 0), v_total);
    v_eng := GREATEST(v_total - v_fee, 0);

    IF v_rule.principal_rate IS NOT NULL THEN
      v_share := _sub_principal_share(v_total, v_fee, v_rule.principal_rate);
      -- 줄별 정액 (mig 264 · 265): 항목 이름 -> 단가표 줄 코드
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'code', wt.code,
               'qty', GREATEST(COALESCE((e.x ->> 'qty')::int, 1), 1),
               'unit_price', COALESCE(NULLIF((e.x ->> 'unitPrice')::int, 0), wt.default_unit_price, 0))), '[]'::jsonb)
        INTO v_lines
        FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS e(x)
        LEFT JOIN work_types wt ON wt.name = (e.x ->> 'workType') || '_' || (e.x ->> 'appliance');
      v_fx := _hood_fixed_calc(v_lines, v_total, v_fee, NULL, NULL, p_principal_code, v_rule.principal_rate, v_total, v_today);
      IF (v_fx ->> 'kb_share') IS NOT NULL THEN
        v_share  := (v_fx ->> 'kb_share')::int;
        v_kbnote := '정액';
      END IF;
    END IF;
    v_method := '직영_주방후드';
    v_basis  := '공급가(부가세 별도) 기준';

  ELSE
    RETURN jsonb_build_object('applies', false);
  END IF;

  v_pfee := CASE WHEN v_rule.fee_type = 'rate' THEN ROUND(v_rule.fee_rate * 100)::int END;
  v_sum := CASE WHEN v_pfee IS NOT NULL
                THEN '기사 ' || (100 - v_pfee) || '% ₩' || to_char(v_eng, 'FM999,999,999')
                     || ' · 회사 ' || v_pfee || '% ₩' || to_char(v_fee, 'FM999,999,999')
                ELSE '기사 ₩' || to_char(v_eng, 'FM999,999,999') || ' · 회사 ₩' || to_char(v_fee, 'FM999,999,999') END
           || ' (' || v_basis || ')'
           || CASE WHEN v_share > 0
                   THEN ' · 회사 몫 가운데 원청 ₩' || to_char(v_share, 'FM999,999,999') || COALESCE(' (' || v_kbnote || ')', '')
                   ELSE '' END;

  RETURN jsonb_build_object(
    'applies',     true,
    'category',    v_cat,
    'calc_method', v_method,
    'engineer',    v_eng,
    'fee',         v_fee,
    'principal',   v_share,
    'company',     GREATEST(v_fee - v_share, 0),
    'summary',     v_sum
  );
END;
$$;
GRANT EXECUTE ON FUNCTION preview_direct_split(text, jsonb, int) TO anon, authenticated;

COMMIT;

-- 검증 - 기대 4줄
--   로봇청소기 99,000       -> 기사 65% ₩64,350 · 회사 35% ₩34,650 (받은 총금액 기준)
--   직영 후드 289,000       -> 기사 65% ₩187,850 · 회사 35% ₩101,150 (공급가(부가세 별도) 기준)
--   쿨가이 직영 후드 289,000 -> 위와 같고 " · 회사 몫 가운데 원청 ₩85,000 (정액)"
--   에어컨 세척             -> applies = false (지금처럼 옛 단가표로 미리보기)
SELECT v.label, preview_direct_split(v.pc, v.items, v.total) ->> 'summary' AS summary,
       preview_direct_split(v.pc, v.items, v.total) ->> 'applies' AS applies
  FROM (VALUES
    ('로봇청소기 99,000',        'allday', '[{"workType":"로봇청소기","appliance":"본체 + 도크스테이션","qty":1}]'::jsonb, 99000),
    ('직영 후드 289,000',        'allday', '[{"workType":"주방후드(업소용)","appliance":"1,000~2,000mm(2구)","qty":1}]'::jsonb, 289000),
    ('쿨가이 직영 후드 289,000', 'KB',     '[{"workType":"주방후드(업소용)","appliance":"1,000~2,000mm(2구)","qty":1}]'::jsonb, 289000),
    ('에어컨 세척 벽걸이',       'allday', '[{"workType":"세척","appliance":"벽걸이","qty":1}]'::jsonb, 80000)
  ) v(label, pc, items, total);
