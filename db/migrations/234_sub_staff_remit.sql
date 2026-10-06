-- ============================================================================
-- Migration 234 - 협력사 기사 -> 협력사 송금 보고 (2단계 보고) + 접수 폼·내 정보용 조회
-- 작성 2026-10-06 · 선행: 214, 215, 225, 231
--
-- 사장님 결정 (2026-10-06)
--   · 기사도 날짜별로 [협력사에 보냄] 1탭 보고 -> 협력사 관리자 [받음 확인]
--     -> 그다음 관리자가 올데이케어에 날짜별 송금 보고 (기존, 바뀌지 않음)
--   · 기사가 보낼 금액 = 그 기사의 그날 올데이케어 수수료 + 협력사 회사 몫 (작업에 고정된 비율)
--   · 관리자의 올데이케어 송금 보고는 기사 상태와 무관하게 가능 (화면에 "기사 미보고 n명" 경고만)
--   · 조정·이월은 협력사 단위와 같은 방식
--       - 보고한 날짜는 잠금. 그 뒤 금액이 바뀌면 차이는 "다음 보낼 날" 에 더하거나 뺌
--       - 합계가 0 이하인 날은 보고 없이 다음 날로 넘어감
--
-- 내용
--   [1] subcontractor_staff_remits      기사별·날짜별 보고 기록
--   [2] _sub_staff_own / _sub_staff_remit_days   (내부 계산)
--   [3] sub_staff_list_remits            기사: 내 날짜별 보낼 금액·상태
--       sub_staff_report_remit           기사: [협력사에 보냄]
--       sub_manager_list_staff_remits    관리자: 기사별·날짜별 상태
--       sub_manager_confirm_staff_remit  관리자: [받음 확인] / 확인 취소
--       sub_manager_cancel_staff_remit   관리자: [보냄 취소] (사유 필수, 그 기사 줄을 다시 대기로)
--     · 협력사 관리자 본인 작업은 본인이 [보냄] 을 누르면 바로 "받음" (이력: 본인 작업 자동 받음)
--     · 보고 / 받음 확인 / 받음 취소 / 보냄 취소는 정산 처리 기록(subcontractor_settlement_events)에 남습니다
--     · 다시 실행해도 안전합니다 (표·칸은 없을 때만 만들고, 함수는 덮어씀)
--   [4] sub_staff_get_contacts           기사 "내 정보" 문의 카드용 - 소속 협력사 관리자 연락처
--   [5] list_subcontractor_fee_rules     접수 폼의 수행 추천·분배 미리보기용 (운영자만)
--
-- 기존 함수·데이터 영향 없음 (표 1개, 함수 추가만). 올데이케어 쪽 정산(225~233)은 건드리지 않습니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 기사별 보고 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS subcontractor_staff_remits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id),
  engineer_id      uuid NOT NULL REFERENCES users(id),
  settle_date      date NOT NULL,
  calc_own         int  NOT NULL DEFAULT 0,   -- 보고 시점의 그날 자체 금액 (수수료 + 회사 몫)
  adjust_in        int  NOT NULL DEFAULT 0,   -- 이 보고에 함께 반영한 지난 날짜 변동분
  amount           int  NOT NULL DEFAULT 0,   -- 보낸 금액 (자체 + 변동분 + 넘겨받은 날)
  carried_to       date,                      -- 0 이하라 다른 날 보고에 묶여 닫힌 날이면 그 날짜
  reported_at      timestamptz NOT NULL DEFAULT now(),
  received_at      timestamptz,
  received_by      uuid REFERENCES users(id),
  UNIQUE (subcontractor_id, engineer_id, settle_date)
);
CREATE INDEX IF NOT EXISTS sub_staff_remits_by_eng ON subcontractor_staff_remits (engineer_id, settle_date DESC);
ALTER TABLE subcontractor_staff_remits ADD COLUMN IF NOT EXISTS note text;

-- 내부: 기사 보고 관련 처리 기록 (기록 실패가 처리를 되돌리지 않게)
CREATE OR REPLACE FUNCTION _sub_staff_remit_log(
  p_sub uuid, p_date date, p_event text, p_amount int, p_engineer uuid, p_actor uuid, p_reason text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO subcontractor_settlement_events
    (tenant_id, subcontractor_id, settle_date, event, amount, reason, actor_id, actor_name)
  SELECT s.tenant_id, s.id, p_date, p_event, p_amount,
         LEFT('기사 ' || COALESCE((SELECT name FROM users WHERE id = p_engineer), '') || COALESCE(' · ' || NULLIF(btrim(p_reason), ''), ''), 500),
         p_actor, (SELECT name FROM users WHERE id = p_actor)
    FROM subcontractors s WHERE s.id = p_sub;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[staff remit log] 기록 실패 - 처리는 계속: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION _sub_staff_remit_log(uuid, date, text, int, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
ALTER TABLE subcontractor_staff_remits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_staff_remits FROM anon, authenticated;

-- ============================================================
-- [2] 내부 계산
-- ============================================================
-- 기사의 그날 자체 금액 (지금 기준): 완료 작업의 올데이케어 수수료 + 회사 몫
CREATE OR REPLACE FUNCTION _sub_staff_own(p_sub uuid, p_eng uuid, p_date date)
RETURNS TABLE (own int, cnt int, fee int, cut int, supply int)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE(SUM(x.fee + x.cut), 0)::int, COUNT(*)::int,
         COALESCE(SUM(x.fee), 0)::int, COALESCE(SUM(x.cut), 0)::int, COALESCE(SUM(x.supply), 0)::int
    FROM (
      SELECT COALESCE((SELECT SUM(p.owner_amount) FROM payments p WHERE p.task_id = t.id AND p.track = 'S'), 0)::int AS fee,
             _sub_task_cut(t.id, COALESCE(t.supply_amount, 0)) AS cut,
             COALESCE(t.supply_amount, 0) AS supply
        FROM tasks t
       WHERE t.subcontractor_id = p_sub AND t.assigned_engineer_id = p_eng
         AND t.status = '완료' AND t.completed_at IS NOT NULL
         AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date = p_date
    ) x;
$$;
REVOKE ALL ON FUNCTION _sub_staff_own(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

-- 기사 한 명의 날짜별 계획 (오래된 날부터 계산, 최근 날짜가 앞에 오도록 돌려줌)
--   상태: 받음 / 보고됨 / 이월(다른 날 보고에 묶여 닫힘, 또는 음수라 넘어가는 중) /
--         보낼 금액 없음(정확히 0) / 미보고(다음 날 정오 지남) / 대기
CREATE OR REPLACE FUNCTION _sub_staff_remit_days(p_sub uuid, p_eng uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_pool   int;                       -- 잠긴 날짜들의 변동분 중 아직 반영하지 않은 금액
  v_ocarry int := 0;                  -- 0 이하라 넘어오는 열린 날들의 자체 금액 합
  v_from   date[] := ARRAY[]::date[];
  v_day    date;
  v_r      subcontractor_staff_remits%ROWTYPE;
  v_o      record;
  v_total  int;
  v_status text;
  v_now    timestamptz := now();
  v_out    jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(SUM((SELECT o.own FROM _sub_staff_own(p_sub, p_eng, r.settle_date) o) - r.calc_own), 0)::int
         - COALESCE(SUM(r.adjust_in), 0)::int
    INTO v_pool
    FROM subcontractor_staff_remits r
   WHERE r.subcontractor_id = p_sub AND r.engineer_id = p_eng;
  v_pool := COALESCE(v_pool, 0);

  FOR v_day IN
    SELECT x.d FROM (
      SELECT (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS d
        FROM tasks t
       WHERE t.subcontractor_id = p_sub AND t.assigned_engineer_id = p_eng
         AND t.status = '완료' AND t.completed_at IS NOT NULL
      UNION
      SELECT r.settle_date FROM subcontractor_staff_remits r
       WHERE r.subcontractor_id = p_sub AND r.engineer_id = p_eng
    ) x ORDER BY x.d
  LOOP
    SELECT * INTO v_o FROM _sub_staff_own(p_sub, p_eng, v_day);
    SELECT * INTO v_r FROM subcontractor_staff_remits
     WHERE subcontractor_id = p_sub AND engineer_id = p_eng AND settle_date = v_day;

    IF v_r.id IS NOT NULL THEN
      v_out := jsonb_build_object(
        'date', v_day, 'locked', true, 'task_count', v_o.cnt, 'supply', v_o.supply,
        'fee', v_o.fee, 'cut', v_o.cut, 'own', v_r.calc_own, 'carry_in', v_r.amount - v_r.calc_own,
        'due', v_r.amount, 'amount', v_r.amount,
        'reported_at', v_r.reported_at, 'received_at', v_r.received_at, 'carried_to', v_r.carried_to,
        'status', CASE WHEN v_r.carried_to IS NOT NULL THEN '이월'
                       WHEN v_r.received_at IS NOT NULL THEN '받음' ELSE '보고됨' END
      ) || v_out;
      CONTINUE;
    END IF;

    v_total := v_o.own + v_pool + v_ocarry;
    v_status := CASE
      WHEN v_total = 0 THEN '보낼 금액 없음'
      WHEN v_total < 0 THEN '이월'
      WHEN v_now >= ((v_day + 1)::timestamp + interval '12 hours') AT TIME ZONE 'Asia/Seoul' THEN '미보고'
      ELSE '대기'
    END;
    v_out := jsonb_build_object(
      'date', v_day, 'locked', false, 'task_count', v_o.cnt, 'supply', v_o.supply,
      'fee', v_o.fee, 'cut', v_o.cut, 'own', v_o.own, 'carry_in', v_pool + v_ocarry,
      'due', v_total, 'amount', NULL,
      'pool_in', v_pool, 'carry_from', to_jsonb(v_from),
      'status', v_status
    ) || v_out;

    IF v_total <= 0 THEN
      v_ocarry := v_ocarry + v_o.own;
      v_from   := v_from || v_day;
    ELSE
      v_pool := 0; v_ocarry := 0; v_from := ARRAY[]::date[];
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION _sub_staff_remit_days(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- [3] 기사: 목록 / 보냄 보고
-- ============================================================
CREATE OR REPLACE FUNCTION sub_staff_list_remits(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 소속 기사만 사용할 수 있습니다.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'days', _sub_staff_remit_days(v_sub, p_actor));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_list_remits(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sub_staff_report_remit(p_actor uuid, p_token text, p_date date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_tenant uuid;
  v_day    jsonb;
  v_src    date;
  v_own    int;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 소속 기사만 사용할 수 있습니다.');
  END IF;
  IF p_date IS NULL OR p_date > (now() AT TIME ZONE 'Asia/Seoul')::date THEN
    RETURN jsonb_build_object('ok', false, 'error', '오늘 이후 날짜는 보고할 수 없습니다.');
  END IF;

  -- 같은 기사의 보고가 겹치지 않게
  PERFORM pg_advisory_xact_lock(hashtext('sub_staff_remit:' || p_actor::text));

  SELECT d INTO v_day FROM jsonb_array_elements(_sub_staff_remit_days(v_sub, p_actor)) d
   WHERE (d ->> 'date')::date = p_date;
  IF v_day IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 날짜에는 보낼 금액이 없습니다.');
  END IF;
  IF (v_day ->> 'locked')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 보고한 날짜입니다.');
  END IF;
  IF (v_day ->> 'due')::int <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '보낼 금액이 없습니다. 이 금액은 다음 보낼 날에 자동으로 반영됩니다.');
  END IF;

  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = v_sub;

  -- 0 이하라 넘어온 날들을 함께 닫는다 (금액은 이 날짜 보고에 들어 있음)
  FOR v_src IN SELECT (x #>> '{}')::date FROM jsonb_array_elements(COALESCE(v_day -> 'carry_from', '[]'::jsonb)) x LOOP
    SELECT o.own INTO v_own FROM _sub_staff_own(v_sub, p_actor, v_src) o;
    INSERT INTO subcontractor_staff_remits
      (tenant_id, subcontractor_id, engineer_id, settle_date, calc_own, adjust_in, amount, carried_to, received_at)
    VALUES (v_tenant, v_sub, p_actor, v_src, COALESCE(v_own, 0), 0, 0, p_date, now())
    ON CONFLICT (subcontractor_id, engineer_id, settle_date) DO NOTHING;
  END LOOP;

  -- 협력사 관리자 본인 작업: 받는 사람이 본인이므로 바로 "받음"
  INSERT INTO subcontractor_staff_remits
    (tenant_id, subcontractor_id, engineer_id, settle_date, calc_own, adjust_in, amount, received_at, received_by, note)
  VALUES (v_tenant, v_sub, p_actor, p_date, (v_day ->> 'own')::int,
          COALESCE((v_day ->> 'pool_in')::int, 0), (v_day ->> 'due')::int,
          CASE WHEN v_role = 'manager' THEN now() END,
          CASE WHEN v_role = 'manager' THEN p_actor END,
          CASE WHEN v_role = 'manager' THEN '본인 작업 자동 받음' END);

  PERFORM _sub_staff_remit_log(v_sub, p_date,
    CASE WHEN v_role = 'manager' THEN 'staff_auto_received' ELSE 'staff_report' END,
    (v_day ->> 'due')::int, p_actor, p_actor,
    CASE WHEN v_role = 'manager' THEN '본인 작업 자동 받음' ELSE '보냄 보고' END);

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'amount', (v_day ->> 'due')::int,
                            'auto_received', v_role = 'manager');
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_report_remit(uuid, text, date) TO anon, authenticated;

-- ============================================================
-- [3] 관리자: 기사별 상태 / 받음 확인
-- ============================================================
CREATE OR REPLACE FUNCTION sub_manager_list_staff_remits(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'staff', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('engineer_id', u.id, 'name', u.name,
                                        'days', _sub_staff_remit_days(v_sub, u.id)) ORDER BY u.name)
      FROM users u
     WHERE u.subcontractor_id = v_sub
       AND (   EXISTS (SELECT 1 FROM tasks t WHERE t.subcontractor_id = v_sub AND t.assigned_engineer_id = u.id
                                               AND t.status = '완료' AND t.completed_at IS NOT NULL)
            OR EXISTS (SELECT 1 FROM subcontractor_staff_remits r WHERE r.subcontractor_id = v_sub AND r.engineer_id = u.id))
  ), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_manager_list_staff_remits(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sub_manager_confirm_staff_remit(
  p_actor uuid, p_token text, p_engineer_id uuid, p_date date, p_confirm boolean DEFAULT true
)
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
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  SELECT * INTO v_r FROM subcontractor_staff_remits
   WHERE subcontractor_id = v_sub AND engineer_id = p_engineer_id AND settle_date = p_date
   FOR UPDATE;
  IF NOT FOUND OR v_r.carried_to IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 내역을 찾지 못했습니다.');
  END IF;

  IF COALESCE(p_confirm, true) THEN
    UPDATE subcontractor_staff_remits SET received_at = now(), received_by = p_actor WHERE id = v_r.id;
  ELSE
    UPDATE subcontractor_staff_remits SET received_at = NULL, received_by = NULL, note = NULL WHERE id = v_r.id;
  END IF;
  PERFORM _sub_staff_remit_log(v_sub, p_date,
    CASE WHEN COALESCE(p_confirm, true) THEN 'staff_received' ELSE 'staff_unreceived' END,
    v_r.amount, p_engineer_id, p_actor,
    CASE WHEN COALESCE(p_confirm, true) THEN '받음 확인' ELSE '받음 확인 취소' END);
  RETURN jsonb_build_object('ok', true, 'engineer_id', p_engineer_id, 'date', p_date, 'received', COALESCE(p_confirm, true));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_manager_confirm_staff_remit(uuid, text, uuid, date, boolean) TO anon, authenticated;

-- 관리자: 기사의 [보냄] 취소 -> 그 기사 줄을 다시 "대기" 로
--   · 사유 필수. 이미 받음 확인된 줄은 받음 취소를 먼저 해야 합니다.
--   · 그 보고에 묶여 함께 닫힌 날짜(0 이하라 넘어온 날)도 같이 다시 열립니다.
--   · 협력사 안의 기록이라 올데이케어 송금 보고·정산에는 영향이 없습니다 (그 날짜를 이미 올데이케어에 보고했어도 가능).
CREATE OR REPLACE FUNCTION sub_manager_cancel_staff_remit(
  p_actor uuid, p_token text, p_engineer_id uuid, p_date date, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_r      subcontractor_staff_remits%ROWTYPE;
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

  PERFORM pg_advisory_xact_lock(hashtext('sub_staff_remit:' || p_engineer_id::text));

  SELECT * INTO v_r FROM subcontractor_staff_remits
   WHERE subcontractor_id = v_sub AND engineer_id = p_engineer_id AND settle_date = p_date
   FOR UPDATE;
  IF NOT FOUND OR v_r.carried_to IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 내역을 찾지 못했습니다.');
  END IF;
  IF v_r.received_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 받음 확인된 내역입니다. 받음 확인을 먼저 취소해 주세요.');
  END IF;

  DELETE FROM subcontractor_staff_remits
   WHERE subcontractor_id = v_sub AND engineer_id = p_engineer_id
     AND (id = v_r.id OR carried_to = p_date);

  PERFORM _sub_staff_remit_log(v_sub, p_date, 'staff_cancel_report', v_r.amount, p_engineer_id, p_actor,
                               '보냄 취소: ' || v_reason);
  RETURN jsonb_build_object('ok', true, 'engineer_id', p_engineer_id, 'date', p_date);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_manager_cancel_staff_remit(uuid, text, uuid, date, text) TO anon, authenticated;

-- ============================================================
-- [4] 기사 "내 정보": 소속 협력사 관리자 연락처 (본인 제외)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_staff_get_contacts(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 소속 기사만 사용할 수 있습니다.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'managers', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name', u.name, 'phone', u.phone) ORDER BY u.name)
      FROM users u
     WHERE u.subcontractor_id = v_sub AND u.sub_role = 'manager' AND u.is_active = true AND u.id <> p_actor
  ), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_get_contacts(uuid, text) TO anon, authenticated;

-- ============================================================
-- [5] 접수 폼: 활성 협력사의 현재 수수료 규칙 요약 (운영자만)
-- ============================================================
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
             'fee_type', f.fee_type, 'fee_rate', f.fee_rate, 'fee_amount', f.fee_amount, 'fee_base', f.fee_base)
           ORDER BY f.subcontractor_id, f.service_code NULLS LAST, f.effective_from DESC)
      FROM fee_rules f
      JOIN subcontractors s ON s.id = f.subcontractor_id AND s.active = true
     WHERE f.active = true AND f.effective_from <= (now() AT TIME ZONE 'Asia/Seoul')::date
  ), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION list_subcontractor_fee_rules(uuid, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 - 기대: 10행
SELECT proname FROM pg_proc
 WHERE proname IN ('_sub_staff_own', '_sub_staff_remit_days', 'sub_staff_list_remits', 'sub_staff_report_remit',
                   'sub_manager_list_staff_remits', 'sub_manager_confirm_staff_remit',
                   'sub_manager_cancel_staff_remit', '_sub_staff_remit_log',
                   'sub_staff_get_contacts', 'list_subcontractor_fee_rules')
 ORDER BY 1;

-- 2) 화이트코어 수수료 규칙 - 기대: 1줄 (service_code 비어 있음 = 모든 서비스, rate 0.35, supply)
SELECT s.name, f.service_code, f.fee_type, f.fee_rate, f.fee_base
  FROM fee_rules f JOIN subcontractors s ON s.id = f.subcontractor_id
 WHERE f.active = true ORDER BY 1, 2;
