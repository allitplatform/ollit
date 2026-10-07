-- ============================================================================
-- Migration 250 - 기사 -> 협력사 "추가로 보낼 돈": 잠긴 날짜 뒤에 생긴 차액을 바로 보이고 바로 보내기
-- 작성 2026-10-07 · 선행: 234, 239
--
-- 배경 (사장님 시험에서 확인)
--   기사가 [보냄] 한 날짜는 잠긴다. 그 뒤 같은 날짜에 작업이 더 완료되면 차액은 "다음 보낼 날" 에 더해진다 (mig 234).
--   그런데 다음 보낼 날(= 완료 작업이 있는 다른 날짜)이 아직 없으면 그 차액이 기사 화면 어디에도 나타나지 않았다
--   - 버튼도 없고 숫자도 없는 상태.
--
-- 바뀌는 것
--   · 그런 차액을 "추가로 보낼 돈" 으로 바로 알려 주고, 기사가 [추가분 보냈어요] 로 그 금액만 따로 보고할 수 있다.
--   · 보고한 추가분은 관리자가 [받음 확인] 한다 (관리자 본인 작업이면 바로 받음).
--   · 추가분으로 보낸 금액은 이미 보낸 돈이므로 "다음 보낼 날" 에 다시 더해지지 않는다.
--   · 열린 날짜(아직 보내지 않은 날)가 있으면 추가분은 생기지 않는다 - 차액은 지금처럼 그 날짜의 보낼 돈에 들어간다.
--   · 차액이 음수(더 보낸 경우)면 지금처럼 다음 보낼 날에서 빼 준다. 추가분으로 다루지 않는다.
--
-- 내용
--   [1] subcontractor_staff_remit_extras          추가분 보고 기록
--   [2] _sub_staff_remit_days (mig 234)           "아직 반영하지 않은 금액" 에서 추가분으로 보낸 금액을 뺀다 (한 곳)
--       저장소의 mig 234 본문에서 자동으로 만들었고, 넣은 조각을 되돌리면 234 와 글자 하나까지 같습니다.
--   [3] _sub_staff_extra_due                      지금 추가로 보낼 돈 (내부)
--   [4] sub_staff_list_remits                     기사 목록에 extra_due · extra_tasks · extras 를 함께 돌려준다
--   [5] sub_staff_report_extra                    기사: [추가분 보냈어요]
--   [6] sub_manager_list_staff_extras / sub_manager_confirm_staff_extra   관리자: 추가분 확인
--
-- 협력사 -> 올데이케어 정산(225~233)과 원청 송금(245)은 건드리지 않습니다.
-- 기존 데이터 영향 없음 (추가분 기록이 없으면 계산 결과가 전과 같습니다). 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- [1]
CREATE TABLE IF NOT EXISTS subcontractor_staff_remit_extras (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id),
  engineer_id      uuid NOT NULL REFERENCES users(id),
  ref_date         date NOT NULL,                 -- 차액이 생긴 (잠긴) 날짜
  amount           int  NOT NULL CHECK (amount > 0),
  reported_at      timestamptz NOT NULL DEFAULT now(),
  received_at      timestamptz,
  received_by      uuid REFERENCES users(id),
  note             text
);
CREATE INDEX IF NOT EXISTS sub_staff_extras_by_eng ON subcontractor_staff_remit_extras (subcontractor_id, engineer_id, reported_at DESC);
ALTER TABLE subcontractor_staff_remit_extras ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_staff_remit_extras FROM anon, authenticated;

-- [2]
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
  -- Mig 250: 따로 보낸 추가분(잠긴 날짜 뒤에 생긴 차액을 바로 보낸 것)은 이미 보낸 돈이므로 뺀다
  v_pool := v_pool - COALESCE((SELECT SUM(e.amount) FROM subcontractor_staff_remit_extras e
                                WHERE e.subcontractor_id = p_sub AND e.engineer_id = p_eng), 0)::int;

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

-- [3] 지금 추가로 보낼 돈: 열린 날짜가 하나도 없을 때의 "아직 반영하지 않은 금액" (양수일 때만)
CREATE OR REPLACE FUNCTION _sub_staff_extra_due(p_sub uuid, p_eng uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_pool int;
BEGIN
  -- 열린 날짜(아직 보내지 않은 완료 작업이 있는 날)가 있으면 차액은 그 날짜의 보낼 돈에 들어간다
  IF EXISTS (SELECT 1 FROM tasks t
              WHERE t.subcontractor_id = p_sub AND t.assigned_engineer_id = p_eng
                AND t.status = '완료' AND t.completed_at IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM subcontractor_staff_remits r
                                 WHERE r.subcontractor_id = p_sub AND r.engineer_id = p_eng
                                   AND r.settle_date = (t.completed_at AT TIME ZONE 'Asia/Seoul')::date)) THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(SUM((SELECT o.own FROM _sub_staff_own(p_sub, p_eng, r.settle_date) o) - r.calc_own), 0)::int
         - COALESCE(SUM(r.adjust_in), 0)::int
    INTO v_pool
    FROM subcontractor_staff_remits r
   WHERE r.subcontractor_id = p_sub AND r.engineer_id = p_eng;
  v_pool := COALESCE(v_pool, 0)
          - COALESCE((SELECT SUM(e.amount) FROM subcontractor_staff_remit_extras e
                       WHERE e.subcontractor_id = p_sub AND e.engineer_id = p_eng), 0)::int;
  RETURN GREATEST(v_pool, 0);
END;
$$;
REVOKE ALL ON FUNCTION _sub_staff_extra_due(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- [4] 기사: 목록 (mig 234 와 같은 권한 확인 + 추가분 정보)
--   extra_due   : 지금 추가로 보낼 돈 (없으면 0)
--   extra_tasks : 잠긴 날짜에, 그 날짜를 보고한 뒤에 완료된 작업 [{ date, task_no, customer_name }] (이유 문구 · "추가" 표시용)
--   extras      : 추가분 보고 기록 (최근 20건) [{ id, ref_date, amount, reported_at, received_at }]
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
  RETURN jsonb_build_object(
    'ok', true,
    'days', _sub_staff_remit_days(v_sub, p_actor),
    'extra_due', _sub_staff_extra_due(v_sub, p_actor),
    'extra_tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', r.settle_date, 'task_no', t.task_no, 'customer_name', t.customer_name)
                       ORDER BY t.completed_at)
        FROM subcontractor_staff_remits r
        JOIN tasks t ON t.subcontractor_id = r.subcontractor_id AND t.assigned_engineer_id = r.engineer_id
                    AND t.status = '완료' AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date = r.settle_date
                    AND t.completed_at > r.reported_at
       WHERE r.subcontractor_id = v_sub AND r.engineer_id = p_actor AND r.carried_to IS NULL), '[]'::jsonb),
    'extras', COALESCE((
      SELECT jsonb_agg(x.j ORDER BY x.reported_at DESC)
        FROM (SELECT e.reported_at, jsonb_build_object('id', e.id, 'ref_date', e.ref_date, 'amount', e.amount,
                                                       'reported_at', e.reported_at, 'received_at', e.received_at) AS j
                FROM subcontractor_staff_remit_extras e
               WHERE e.subcontractor_id = v_sub AND e.engineer_id = p_actor
               ORDER BY e.reported_at DESC LIMIT 20) x), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_list_remits(uuid, text) TO anon, authenticated;

-- [5] 기사: [추가분 보냈어요]
CREATE OR REPLACE FUNCTION sub_staff_report_extra(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_tenant uuid;
  v_due    int;
  v_ref    date;
  v_name   text;
  r        record;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 소속 기사만 사용할 수 있습니다.');
  END IF;

  -- 같은 기사의 보고가 겹치지 않게 (mig 234 의 [보냄] 과 같은 잠금)
  PERFORM pg_advisory_xact_lock(hashtext('sub_staff_remit:' || p_actor::text));

  v_due := _sub_staff_extra_due(v_sub, p_actor);
  IF COALESCE(v_due, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '추가로 보낼 돈이 없습니다.');
  END IF;

  -- 차액이 생긴 날짜 = 보고 뒤에 완료된 작업이 있는 가장 최근의 잠긴 날짜 (없으면 가장 최근의 잠긴 날짜)
  SELECT MAX(m.settle_date) INTO v_ref
    FROM subcontractor_staff_remits m
   WHERE m.subcontractor_id = v_sub AND m.engineer_id = p_actor AND m.carried_to IS NULL
     AND EXISTS (SELECT 1 FROM tasks t
                  WHERE t.subcontractor_id = v_sub AND t.assigned_engineer_id = p_actor AND t.status = '완료'
                    AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date = m.settle_date AND t.completed_at > m.reported_at);
  IF v_ref IS NULL THEN
    SELECT MAX(m.settle_date) INTO v_ref FROM subcontractor_staff_remits m
     WHERE m.subcontractor_id = v_sub AND m.engineer_id = p_actor;
  END IF;
  v_ref := COALESCE(v_ref, (now() AT TIME ZONE 'Asia/Seoul')::date);

  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = v_sub;
  SELECT name INTO v_name FROM users WHERE id = p_actor;

  INSERT INTO subcontractor_staff_remit_extras
    (tenant_id, subcontractor_id, engineer_id, ref_date, amount, received_at, received_by, note)
  VALUES (v_tenant, v_sub, p_actor, v_ref, v_due,
          CASE WHEN v_role = 'manager' THEN now() END,
          CASE WHEN v_role = 'manager' THEN p_actor END,
          CASE WHEN v_role = 'manager' THEN '본인 작업 자동 받음' END);

  PERFORM _sub_staff_remit_log(v_sub, v_ref,
    CASE WHEN v_role = 'manager' THEN 'staff_auto_received' ELSE 'staff_report' END,
    v_due, p_actor, p_actor,
    CASE WHEN v_role = 'manager' THEN '추가분 · 본인 작업 자동 받음' ELSE '추가분 보냄 보고' END);

  -- 관리자에게 알림 (기사 송금 보고 알림을 켠 관리자만 - mig 239 와 같은 조건). 관리자 본인 작업이면 보내지 않는다.
  IF v_role <> 'manager' THEN
    BEGIN
      FOR r IN
        SELECT u.id FROM users u
         WHERE u.subcontractor_id = v_sub AND u.sub_role = 'manager' AND u.is_active = true
           AND u.id <> p_actor AND _sub_notify_on(u.id, 'staff_remit')
      LOOP
        PERFORM _msg_push(jsonb_build_object(
          'targetType', 'user', 'targetId', r.id::text,
          'title', '기사 송금 보고 (추가분)',
          'body',  COALESCE(v_name, '기사') || ' 님 추가분 송금 보고 ₩' || to_char(v_due, 'FM999,999,999'),
          'url', '/', 'tag', 'sub-staff-extra-' || p_actor::text || '-' || v_ref::text));
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[sub push] 추가분 알림 실패 - 보고는 그대로: %', SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'amount', v_due, 'ref_date', v_ref, 'auto_received', v_role = 'manager');
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_report_extra(uuid, text) TO anon, authenticated;

-- [6] 관리자: 추가분 목록 (받음 확인 전 전부 + 최근 14일) / 받음 확인 · 취소
CREATE OR REPLACE FUNCTION sub_manager_list_staff_extras(p_actor uuid, p_token text)
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
  RETURN jsonb_build_object('ok', true, 'rows', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', e.id, 'engineer_id', e.engineer_id, 'name', u.name, 'ref_date', e.ref_date, 'amount', e.amount,
             'reported_at', e.reported_at, 'received_at', e.received_at) ORDER BY e.reported_at DESC)
      FROM subcontractor_staff_remit_extras e JOIN users u ON u.id = e.engineer_id
     WHERE e.subcontractor_id = v_sub
       AND (e.received_at IS NULL OR e.reported_at >= now() - interval '14 days')), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_manager_list_staff_extras(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sub_manager_confirm_staff_extra(p_actor uuid, p_token text, p_id uuid, p_confirm boolean DEFAULT true)
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
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  SELECT * INTO v_e FROM subcontractor_staff_remit_extras WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_e.subcontractor_id IS DISTINCT FROM v_sub THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 내역을 찾지 못했습니다.');
  END IF;
  UPDATE subcontractor_staff_remit_extras
     SET received_at = CASE WHEN COALESCE(p_confirm, true) THEN now() END,
         received_by = CASE WHEN COALESCE(p_confirm, true) THEN p_actor END
   WHERE id = p_id;
  PERFORM _sub_staff_remit_log(v_sub, v_e.ref_date,
    CASE WHEN COALESCE(p_confirm, true) THEN 'staff_received' ELSE 'staff_unreceived' END,
    v_e.amount, v_e.engineer_id, p_actor,
    CASE WHEN COALESCE(p_confirm, true) THEN '추가분 받음 확인' ELSE '추가분 받음 확인 취소' END);
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'received', COALESCE(p_confirm, true));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_manager_confirm_staff_extra(uuid, text, uuid, boolean) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 - 기대: 표 1 + 함수 6 = 7행
-- ============================================================================
SELECT '표' AS 종류, table_name AS 이름 FROM information_schema.tables WHERE table_name = 'subcontractor_staff_remit_extras'
UNION ALL
SELECT '함수', proname FROM pg_proc
 WHERE proname IN ('_sub_staff_remit_days', '_sub_staff_extra_due', 'sub_staff_list_remits', 'sub_staff_report_extra',
                   'sub_manager_list_staff_extras', 'sub_manager_confirm_staff_extra')
 ORDER BY 1, 2;
