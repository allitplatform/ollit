-- ============================================================================
-- Migration 251 - 기사용 [보냄 취소] · 추가분 취소 (기사 / 관리자)
-- 작성 2026-10-07 · 선행: 234, 250
--
-- 사장님 결정 (2026-10-07)
--   1. 기사가 자기 [보냄] 을 취소할 수 있다. 받음 확인 전까지만, 본인 보고만.
--      취소하면 그 날짜는 다시 "보낼 돈" 상태로 돌아간다. 누가 · 언제 취소했는지 이력에 남는다.
--      관리자 취소(사유 필수)는 그대로다 (mig 234).
--   2. 추가분도 같은 규칙. 기사: 받음 확인 전 [추가분 취소] / 관리자: 사유를 적고 취소.
--
-- 내용 (함수 3개 추가. 기존 함수는 건드리지 않습니다)
--   sub_staff_cancel_remit           기사: 날짜 보고 취소 (받음 확인 전, 본인 것)
--   sub_staff_cancel_extra           기사: 추가분 보고 취소 (받음 확인 전, 본인 것)
--   sub_manager_cancel_staff_extra   관리자: 추가분 보고 취소 (사유 필수, 받음 확인 전)
--
-- 취소는 보고 기록을 지우는 방식이다 (관리자 취소 - mig 234 - 와 같음). 지운 사실은 정산 처리 기록에 남는다.
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION sub_staff_cancel_remit(p_actor uuid, p_token text, p_date date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_r    subcontractor_staff_remits%ROWTYPE;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 소속 기사만 사용할 수 있습니다.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sub_staff_remit:' || p_actor::text));

  -- 본인 보고만 (engineer_id = 호출자)
  SELECT * INTO v_r FROM subcontractor_staff_remits
   WHERE subcontractor_id = v_sub AND engineer_id = p_actor AND settle_date = p_date
   FOR UPDATE;
  IF NOT FOUND OR v_r.carried_to IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 내역을 찾지 못했습니다.');
  END IF;
  IF v_r.received_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '관리자가 이미 받음 확인을 했습니다. 취소하려면 관리자에게 요청해 주세요.');
  END IF;

  DELETE FROM subcontractor_staff_remits
   WHERE subcontractor_id = v_sub AND engineer_id = p_actor
     AND (id = v_r.id OR carried_to = p_date);

  PERFORM _sub_staff_remit_log(v_sub, p_date, 'staff_cancel_report', v_r.amount, p_actor, p_actor, '보냄 취소: 기사 본인');
  RETURN jsonb_build_object('ok', true, 'date', p_date);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_cancel_remit(uuid, text, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sub_staff_cancel_extra(p_actor uuid, p_token text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_e    subcontractor_staff_remit_extras%ROWTYPE;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 소속 기사만 사용할 수 있습니다.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sub_staff_remit:' || p_actor::text));

  SELECT * INTO v_e FROM subcontractor_staff_remit_extras WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_e.subcontractor_id IS DISTINCT FROM v_sub OR v_e.engineer_id IS DISTINCT FROM p_actor THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 내역을 찾지 못했습니다.');
  END IF;
  IF v_e.received_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '관리자가 이미 받음 확인을 했습니다. 취소하려면 관리자에게 요청해 주세요.');
  END IF;

  DELETE FROM subcontractor_staff_remit_extras WHERE id = p_id;
  PERFORM _sub_staff_remit_log(v_sub, v_e.ref_date, 'staff_cancel_report', v_e.amount, p_actor, p_actor, '추가분 보냄 취소: 기사 본인');
  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_cancel_extra(uuid, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sub_manager_cancel_staff_extra(p_actor uuid, p_token text, p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_e      subcontractor_staff_remit_extras%ROWTYPE;
  v_reason text := LEFT(btrim(COALESCE(p_reason, '')), 300);
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  IF v_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '취소 사유를 입력해 주세요.');
  END IF;

  SELECT * INTO v_e FROM subcontractor_staff_remit_extras WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_e.subcontractor_id IS DISTINCT FROM v_sub THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 내역을 찾지 못했습니다.');
  END IF;
  IF v_e.received_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 받음 확인된 내역입니다. 받음 확인을 먼저 취소해 주세요.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sub_staff_remit:' || v_e.engineer_id::text));
  DELETE FROM subcontractor_staff_remit_extras WHERE id = p_id;
  PERFORM _sub_staff_remit_log(v_sub, v_e.ref_date, 'staff_cancel_report', v_e.amount, v_e.engineer_id, p_actor,
                               '추가분 보냄 취소: ' || v_reason);
  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_manager_cancel_staff_extra(uuid, text, uuid, text) TO anon, authenticated;

COMMIT;

-- 검증 - 기대: 3행
SELECT proname FROM pg_proc
 WHERE proname IN ('sub_staff_cancel_remit', 'sub_staff_cancel_extra', 'sub_manager_cancel_staff_extra')
 ORDER BY 1;
