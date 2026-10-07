-- ============================================================================
-- Migration 249 - 접수 화면 분배 미리보기에 원청 몫을 보여 주기 위한 규칙 조회 보강
-- 작성 2026-10-07 · 선행: 234, 244
--
-- 배경: 접수 화면의 "분배 미리보기" 가 원청 몫을 빼지 않고 "올데이케어 수수료 45,500" 으로 보여 줬다.
--       미리보기가 읽는 규칙 조회 함수(운영자 전용)에 원청 몫 칸이 없어서다.
-- 내용: list_subcontractor_fee_rules (mig 234) 에 principal_rate · principal_base 두 값만 추가.
--       저장소의 mig 234 본문에서 자동으로 만들었고, 추가한 조각을 되돌리면 234 와 글자 하나까지 같습니다.
--       운영자 전용 함수 그대로입니다 (협력사에는 내려가지 않음).
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION list_subcontractor_fee_rules(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'rules', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'subcontractor_id', f.subcontractor_id, 'principal_code', f.principal_code, 'service_code', f.service_code,
             'fee_type', f.fee_type, 'fee_rate', f.fee_rate, 'fee_amount', f.fee_amount, 'fee_base', f.fee_base,
             'principal_rate', f.principal_rate, 'principal_base', f.principal_base)
           ORDER BY f.subcontractor_id, f.service_code NULLS LAST, f.effective_from DESC)
      FROM fee_rules f
      JOIN subcontractors s ON s.id = f.subcontractor_id AND s.active = true
     WHERE f.active = true AND f.effective_from <= (now() AT TIME ZONE 'Asia/Seoul')::date
  ), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION list_subcontractor_fee_rules(uuid, text) TO anon, authenticated;

COMMIT;

-- 검증 - 기대: 1행, 원청_몫_칸 = true
SELECT proname AS 함수, position('principal_rate' IN prosrc) > 0 AS 원청_몫_칸
  FROM pg_proc WHERE proname = 'list_subcontractor_fee_rules';
