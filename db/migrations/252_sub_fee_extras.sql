-- ============================================================================
-- Migration 252 - 협력사 -> 올데이케어 "추가분" 따로 보고 · 받음 확인
-- 작성 2026-10-07 · 선행: 225, 227, 228, 233, 245, 247
--
-- 사장님 결정 (2026-10-07)
--   오늘 수수료를 이미 송금 보고한 뒤에 작업이 더 끝나면(또는 금액이 늘면) 그 차액이
--   내일 날짜 줄로만 생겨서 오늘은 보이지도, 보고하지도 못했다. 기사 쪽(mig 250)과 같은 방식으로 막는다.
--     협력사 관리자: 맨 위 "추가로 보낼 수수료 n원" + [추가분 송금 보고]
--     운영자       : "추가분 확인 대기" + [받음 확인]. 받음 확인하면 원청 송금 줄에 그 작업의 원청 몫이 들어간다.
--     줄어든 경우  : 지금처럼 다음 날짜에서 빠진다 (바꾸지 않음).
--     취소         : 관리자 본인은 받음 확인 전까지 / 운영자는 사유를 적고.
--
-- 구조
--   "추가분" = 오늘이 이미 잠겨서 내일 이후 날짜로 잡힌 추가 줄(kind = 'adjust', 금액 > 0).
--   [추가분 송금 보고] 를 하면 그 줄들을 날짜별 정산에서 꺼내 추가분 표로 옮긴다.
--   -> 날짜별 정산(이월 · 보고 · 입금 확인)은 그 줄을 더 이상 보지 않으므로 두 번 청구되지 않는다.
--   보고하지 않고 두면 지금처럼 다음 날짜 정산에 그대로 들어간다 (기존 동작 그대로).
--
-- 기존 함수 변경 (저장소 원문에서 자동 생성. 끼운 조각을 빼면 원문과 글자까지 같음을 검사했습니다)
--   _sub_settle_sync_task       (원문 mig 225) 이미 청구한 금액에 "보고한 추가분" 을 더함 - 2곳
--   _principal_remit_build      (원문 mig 245) 대상 작업에 "받음 확인한 추가분의 작업" 을 더함 - 1곳
--   admin_cancel_sub_daily_report (mig 227)    이름 변경 + 감싸기: 그 날짜에 딸린 추가분 보고가 있으면 먼저 막음
--
-- 기존 데이터 영향 없음 (표 2개 추가, 함수 교체). 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 표
-- ============================================================
CREATE TABLE IF NOT EXISTS subcontractor_fee_extras (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  subcontractor_id  uuid NOT NULL REFERENCES subcontractors(id),
  ref_date          date NOT NULL,               -- 보고한 날 (한국 날짜)
  calc_amount       int  NOT NULL,               -- 올잇 계산 추가분 (줄 합계)
  amount            int  NOT NULL,               -- 협력사가 보냈다고 보고한 금액
  reported_at       timestamptz NOT NULL DEFAULT now(),
  reported_by       uuid REFERENCES users(id),
  received_at       timestamptz,
  received_by       uuid REFERENCES users(id),
  remit_date        date,                        -- 받음 확인 때 원청 송금 줄을 만든 날짜
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sub_fee_extras_by_sub ON subcontractor_fee_extras (subcontractor_id, ref_date DESC);

CREATE TABLE IF NOT EXISTS subcontractor_fee_extra_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extra_id     uuid NOT NULL REFERENCES subcontractor_fee_extras(id) ON DELETE CASCADE,
  task_id      uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  fee          int  NOT NULL,
  received     int  NOT NULL DEFAULT 0,
  supply       int  NOT NULL DEFAULT 0,
  engineer_id  uuid REFERENCES users(id),
  origin_date  date,
  memo         text
);
CREATE INDEX IF NOT EXISTS sub_fee_extra_lines_by_task  ON subcontractor_fee_extra_lines (task_id);
CREATE INDEX IF NOT EXISTS sub_fee_extra_lines_by_extra ON subcontractor_fee_extra_lines (extra_id);

ALTER TABLE subcontractor_fee_extras      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_fee_extra_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_fee_extras      FROM anon, authenticated;
REVOKE ALL ON TABLE subcontractor_fee_extra_lines FROM anon, authenticated;

-- ============================================================
-- [2] 기존 함수 2개 (원문 + 끼운 조각)
-- ============================================================
CREATE OR REPLACE FUNCTION _sub_settle_sync_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task    tasks%ROWTYPE;
  v_sub     uuid;
  v_fee_now int := 0;
  v_billed  int := 0;
  v_origin  date;
  v_target  date;
  v_today   date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_delta   int;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- 이 작업의 정산 협력사: 지금 수행처, 없으면 이미 잠긴 줄의 협력사
  v_sub := v_task.subcontractor_id;
  IF v_sub IS NULL THEN
    SELECT subcontractor_id INTO v_sub FROM subcontractor_settlement_lines WHERE task_id = p_task_id LIMIT 1;
  END IF;
  -- Mig 252: 따로 보고한 추가분만 남아 있는 작업
  IF v_sub IS NULL THEN
    SELECT e.subcontractor_id INTO v_sub
      FROM subcontractor_fee_extra_lines el JOIN subcontractor_fee_extras e ON e.id = el.extra_id
     WHERE el.task_id = p_task_id LIMIT 1;
  END IF;
  IF v_sub IS NULL THEN RETURN; END IF;

  -- 잠기지 않은 adjust 줄은 지우고 다시 계산
  DELETE FROM subcontractor_settlement_lines l
   WHERE l.task_id = p_task_id AND l.kind = 'adjust'
     AND NOT _sub_day_locked(l.subcontractor_id, l.settle_date);

  SELECT COALESCE(SUM(fee), 0) INTO v_billed FROM subcontractor_settlement_lines WHERE task_id = p_task_id;
  -- Mig 252: 따로 보고한 추가분도 "이미 청구한 금액" 이다 (다시 추가분 줄이 생기지 않게)
  v_billed := v_billed + COALESCE((SELECT SUM(el.fee) FROM subcontractor_fee_extra_lines el WHERE el.task_id = p_task_id), 0)::int;

  IF v_task.status = '완료' AND v_task.subcontractor_id IS NOT NULL THEN
    SELECT COALESCE(SUM(p.owner_amount), 0) INTO v_fee_now
      FROM payments p WHERE p.task_id = p_task_id AND p.track = 'S';
  END IF;

  v_origin := (COALESCE(v_task.completed_at, now()) AT TIME ZONE 'Asia/Seoul')::date;

  -- 원래 날짜가 아직 열려 있고 잠긴 줄도 없으면: 그 날짜의 본 금액으로 실시간 집계되므로 할 일 없음
  IF v_billed = 0 AND NOT _sub_day_locked(v_sub, v_origin) THEN
    RETURN;
  END IF;

  v_delta := v_fee_now - v_billed;
  IF v_delta = 0 THEN RETURN; END IF;

  -- 다음 열린 정산일 (오늘 이후, 잠긴 날은 건너뜀)
  v_target := GREATEST(v_today, v_origin);
  WHILE _sub_day_locked(v_sub, v_target) LOOP
    v_target := v_target + 1;
  END LOOP;

  INSERT INTO subcontractor_settlement_lines
    (tenant_id, subcontractor_id, settle_date, task_id, kind, fee, received, supply, engineer_id, origin_date, memo)
  VALUES
    (v_task.tenant_id, v_sub, v_target, p_task_id, 'adjust', v_delta,
     COALESCE(v_task.received_total, 0), COALESCE(v_task.supply_amount, 0), v_task.assigned_engineer_id, v_origin,
     CASE WHEN v_billed = 0 THEN '추가분: 정산 보고 뒤 완료'
          WHEN v_fee_now = 0 THEN '차감분: 완료 후 취소·회수'
          WHEN v_delta > 0  THEN '추가분: 금액 수정'
          ELSE '차감분: 금액 수정' END);
END;
$$;

REVOKE ALL ON FUNCTION _sub_settle_sync_task(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION _principal_remit_build(p_sub uuid, p_date date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_remit  uuid;
  v_carry  int;
  r        record;
BEGIN
  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = p_sub;

  -- 원청별로: 입금 확인된 날짜에 속한 작업들의 (지금 몫 - 이미 줄로 만든 몫)
  FOR r IN
    SELECT x.principal_id,
           jsonb_agg(jsonb_build_object('task_id', x.task_id, 'delta', x.delta, 'share', x.share)) AS items,
           SUM(x.delta)::int AS total
      FROM (
        SELECT t.principal_id, t.id AS task_id,
               COALESCE((SELECT p.sub_principal_share FROM payments p WHERE p.task_id = t.id AND p.track = 'S' LIMIT 1), 0) AS share,
               COALESCE((SELECT p.sub_principal_share FROM payments p WHERE p.task_id = t.id AND p.track = 'S' LIMIT 1), 0)
                 - COALESCE((SELECT SUM(pl.delta) FROM principal_remit_lines pl WHERE pl.task_id = t.id), 0)::int AS delta
          FROM tasks t
         WHERE t.principal_id IS NOT NULL
           AND t.id IN (
             SELECT l.task_id
               FROM subcontractor_settlement_lines l
               JOIN subcontractor_daily_settlements d
                 ON d.subcontractor_id = l.subcontractor_id AND d.settle_date = l.settle_date
              WHERE l.subcontractor_id = p_sub AND d.confirmed_at IS NOT NULL
             UNION
             -- Mig 252: [받음 확인] 한 추가분의 작업
             SELECT el.task_id
               FROM subcontractor_fee_extra_lines el
               JOIN subcontractor_fee_extras e ON e.id = el.extra_id
              WHERE e.subcontractor_id = p_sub AND e.received_at IS NOT NULL)
      ) x
     WHERE x.delta <> 0
     GROUP BY x.principal_id
  LOOP
    INSERT INTO principal_remits (tenant_id, principal_id, subcontractor_id, settle_date, amount)
    VALUES (v_tenant, r.principal_id, p_sub, p_date, 0)
    ON CONFLICT (principal_id, subcontractor_id, settle_date) DO NOTHING;
    SELECT id INTO v_remit FROM principal_remits
     WHERE principal_id = r.principal_id AND subcontractor_id = p_sub AND settle_date = p_date;
    -- 이미 [송금 완료] 한 줄에는 더하지 않는다 (다음 입금 확인 때 차이로 다시 잡힌다)
    CONTINUE WHEN (SELECT paid_at IS NOT NULL FROM principal_remits WHERE id = v_remit);

    INSERT INTO principal_remit_lines (remit_id, task_id, delta, share_after)
    SELECT v_remit, (i ->> 'task_id')::uuid, (i ->> 'delta')::int, (i ->> 'share')::int
      FROM jsonb_array_elements(r.items) i;

    -- 앞에 남아 있는 "보낼 것 없는 줄"(0 이하, 아직 넘기지 않은 것)을 이 줄로 넘겨받는다
    SELECT COALESCE(SUM(pr.amount), 0)::int INTO v_carry
      FROM principal_remits pr
     WHERE pr.principal_id = r.principal_id AND pr.subcontractor_id = p_sub
       AND pr.id <> v_remit AND pr.amount <= 0 AND pr.paid_at IS NULL AND pr.absorbed_into IS NULL
       AND pr.settle_date < p_date;
    UPDATE principal_remits pr SET absorbed_into = v_remit
     WHERE pr.principal_id = r.principal_id AND pr.subcontractor_id = p_sub
       AND pr.id <> v_remit AND pr.amount <= 0 AND pr.paid_at IS NULL AND pr.absorbed_into IS NULL
       AND pr.settle_date < p_date;

    UPDATE principal_remits pr
       SET carried_in = pr.carried_in + v_carry,
           amount = (SELECT COALESCE(SUM(pl.delta), 0)::int FROM principal_remit_lines pl WHERE pl.remit_id = pr.id)
                    + pr.carried_in + v_carry
     WHERE pr.id = v_remit;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION _principal_remit_build(uuid, date) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- [3] 내부: 지금 따로 보낼 추가분 (오늘이 잠겨서 내일 이후로 잡힌 추가 줄)
-- ============================================================
CREATE OR REPLACE FUNCTION _sub_fee_extra_due(p_sub uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'amount', COALESCE(SUM(l.fee), 0)::int,
           'count',  COUNT(*)::int,
           'lines',  COALESCE(jsonb_agg(jsonb_build_object(
                       'task_id', l.task_id, 'task_no', t.task_no, 'customer_name', t.customer_name,
                       'fee', l.fee, 'origin_date', l.origin_date, 'memo', l.memo,
                       'engineer_name', u.name) ORDER BY t.task_no), '[]'::jsonb))
    FROM subcontractor_settlement_lines l
    JOIN tasks t      ON t.id = l.task_id
    LEFT JOIN users u ON u.id = l.engineer_id
   WHERE l.subcontractor_id = p_sub
     AND l.kind = 'adjust'
     AND l.fee > 0
     AND l.settle_date > (now() AT TIME ZONE 'Asia/Seoul')::date;
$$;
REVOKE ALL ON FUNCTION _sub_fee_extra_due(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION _sub_fee_extra_json(p_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'id', e.id, 'sub_id', e.subcontractor_id, 'sub_name', s.name,
           'ref_date', e.ref_date, 'calc_amount', e.calc_amount, 'amount', e.amount,
           'diff', e.amount - e.calc_amount,
           'reported_at', e.reported_at, 'received_at', e.received_at,
           'lines', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'task_id', el.task_id, 'task_no', t.task_no, 'customer_name', t.customer_name,
                      'fee', el.fee, 'origin_date', el.origin_date, 'memo', el.memo,
                      'engineer_name', u.name) ORDER BY t.task_no)
               FROM subcontractor_fee_extra_lines el
               JOIN tasks t      ON t.id = el.task_id
               LEFT JOIN users u ON u.id = el.engineer_id
              WHERE el.extra_id = e.id), '[]'::jsonb))
    FROM subcontractor_fee_extras e
    JOIN subcontractors s ON s.id = e.subcontractor_id
   WHERE e.id = p_id;
$$;
REVOKE ALL ON FUNCTION _sub_fee_extra_json(uuid) FROM PUBLIC, anon, authenticated;

-- 내부: 추가분 보고를 없애고 그 작업들의 줄을 다시 맞춘다 (추가 줄이 다음 열린 날짜에 다시 생긴다)
CREATE OR REPLACE FUNCTION _sub_fee_extra_drop(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tasks uuid[];
  v_task  uuid;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT task_id), ARRAY[]::uuid[]) INTO v_tasks
    FROM subcontractor_fee_extra_lines WHERE extra_id = p_id;
  DELETE FROM subcontractor_fee_extras WHERE id = p_id;
  FOREACH v_task IN ARRAY v_tasks LOOP
    PERFORM _sub_settle_sync_task(v_task);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION _sub_fee_extra_drop(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- [4] 협력사 관리자: 목록 / 보고 / 취소
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_fee_extras(p_actor uuid, p_token text)
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

  RETURN jsonb_build_object('ok', true,
    'due', _sub_fee_extra_due(v_sub),
    'rows', COALESCE((
      SELECT jsonb_agg(_sub_fee_extra_json(e.id) ORDER BY e.reported_at DESC)
        FROM subcontractor_fee_extras e
       WHERE e.subcontractor_id = v_sub
         AND (e.received_at IS NULL OR e.ref_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 60)
    ), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_list_fee_extras(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sub_report_fee_extra(p_actor uuid, p_token text, p_amount int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_tenant uuid;
  v_today  date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_calc   int;
  v_id     uuid;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '보낸 금액을 입력해 주세요.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sub_fee_extra:' || v_sub::text));

  SELECT COALESCE(SUM(l.fee), 0)::int INTO v_calc
    FROM subcontractor_settlement_lines l
   WHERE l.subcontractor_id = v_sub AND l.kind = 'adjust' AND l.fee > 0 AND l.settle_date > v_today;
  IF v_calc <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '따로 보낼 추가분이 없습니다.');
  END IF;

  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = v_sub;

  INSERT INTO subcontractor_fee_extras (tenant_id, subcontractor_id, ref_date, calc_amount, amount, reported_by)
  VALUES (v_tenant, v_sub, v_today, v_calc, p_amount, p_actor)
  RETURNING id INTO v_id;

  -- 줄을 날짜별 정산에서 꺼내 추가분 표로 옮긴다
  WITH moved AS (
    DELETE FROM subcontractor_settlement_lines l
     WHERE l.subcontractor_id = v_sub AND l.kind = 'adjust' AND l.fee > 0 AND l.settle_date > v_today
    RETURNING l.task_id, l.fee, l.received, l.supply, l.engineer_id, l.origin_date, l.memo
  )
  INSERT INTO subcontractor_fee_extra_lines (extra_id, task_id, fee, received, supply, engineer_id, origin_date, memo)
  SELECT v_id, m.task_id, m.fee, m.received, m.supply, m.engineer_id, m.origin_date, m.memo FROM moved m;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'calc_amount', v_calc, 'amount', p_amount, 'diff', p_amount - v_calc);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_report_fee_extra(uuid, text, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sub_cancel_fee_extra(p_actor uuid, p_token text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_e    subcontractor_fee_extras%ROWTYPE;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sub_fee_extra:' || v_sub::text));

  SELECT * INTO v_e FROM subcontractor_fee_extras WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_e.subcontractor_id IS DISTINCT FROM v_sub THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 내역을 찾지 못했습니다.');
  END IF;
  IF v_e.received_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '올데이케어가 이미 받음 확인을 했습니다. 취소하려면 올데이케어에 요청해 주세요.');
  END IF;

  INSERT INTO subcontractor_settlement_events
    (tenant_id, subcontractor_id, settle_date, event, amount, reason, actor_id, actor_name)
  VALUES (v_e.tenant_id, v_sub, v_e.ref_date, 'cancel_extra', v_e.amount, '추가분 보고 취소: 협력사 관리자',
          p_actor, (SELECT name FROM users WHERE id = p_actor));

  PERFORM _sub_fee_extra_drop(p_id);
  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_cancel_fee_extra(uuid, text, uuid) TO anon, authenticated;

-- ============================================================
-- [5] 운영자: 목록 / 받음 확인 / 취소(사유 필수)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_list_sub_fee_extras(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_actor;

  RETURN jsonb_build_object('ok', true, 'rows', COALESCE((
    SELECT jsonb_agg(_sub_fee_extra_json(e.id) ORDER BY e.reported_at DESC)
      FROM subcontractor_fee_extras e
     WHERE e.tenant_id = v_tenant
       AND (e.received_at IS NULL OR e.ref_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 60)
  ), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION admin_list_sub_fee_extras(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_confirm_sub_fee_extra(p_actor uuid, p_token text, p_id uuid, p_confirm boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_e      subcontractor_fee_extras%ROWTYPE;
  v_today  date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_name   text;
  v_warn   text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_actor;

  SELECT * INTO v_e FROM subcontractor_fee_extras WHERE id = p_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 내역을 찾지 못했습니다.');
  END IF;

  IF COALESCE(p_confirm, true) THEN
    IF v_e.received_at IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'id', p_id, 'received', true);
    END IF;
    UPDATE subcontractor_fee_extras
       SET received_at = now(), received_by = p_actor, remit_date = v_today
     WHERE id = p_id;

    -- 원청 송금 줄 (실패해도 받음 확인은 되돌리지 않는다)
    BEGIN
      PERFORM _principal_remit_build(v_e.subcontractor_id, v_today);
    EXCEPTION WHEN OTHERS THEN
      v_warn := SQLERRM;
    END;
    -- 가계부 입금
    BEGIN
      IF v_e.amount > 0 THEN
        SELECT name INTO v_name FROM subcontractors WHERE id = v_e.subcontractor_id;
        INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
        VALUES (v_e.tenant_id, 'in', v_e.amount, v_today,
                '협력사 수수료 추가분 · ' || COALESCE(v_name, '') || ' · ' || to_char(v_e.ref_date, 'MM/DD') || ' 보고',
                p_actor, 'sub_fee_extra', v_e.id)
        ON CONFLICT (source, source_ref) WHERE source IS NOT NULL DO NOTHING;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_warn := COALESCE(v_warn || ' / ', '') || SQLERRM;
    END;
  ELSE
    IF v_e.received_at IS NULL THEN
      RETURN jsonb_build_object('ok', true, 'id', p_id, 'received', false);
    END IF;
    IF v_e.remit_date IS NOT NULL AND EXISTS (
         SELECT 1 FROM principal_remits pr
          WHERE pr.subcontractor_id = v_e.subcontractor_id AND pr.settle_date = v_e.remit_date AND pr.paid_at IS NOT NULL) THEN
      RETURN jsonb_build_object('ok', false,
        'error', to_char(v_e.remit_date, 'MM/DD') || ' 원청 송금이 완료로 처리돼 있습니다. [원청 송금 완료] 를 먼저 되돌려 주세요.');
    END IF;

    UPDATE subcontractor_fee_extras SET received_at = NULL, received_by = NULL WHERE id = p_id;
    DELETE FROM bookkeeping_cashflow WHERE source = 'sub_fee_extra' AND source_ref = v_e.id;

    -- 그 날짜의 원청 송금 줄을 지우고, 받음 확인이 남아 있는 것만으로 다시 만든다
    IF v_e.remit_date IS NOT NULL THEN
      DELETE FROM principal_remits pr
       WHERE pr.subcontractor_id = v_e.subcontractor_id AND pr.settle_date = v_e.remit_date;
      PERFORM _principal_remit_build(v_e.subcontractor_id, v_e.remit_date);
    END IF;
    UPDATE subcontractor_fee_extras SET remit_date = NULL WHERE id = p_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_id, 'received', COALESCE(p_confirm, true))
         || CASE WHEN v_warn IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('warning', v_warn) END;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_confirm_sub_fee_extra(uuid, text, uuid, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_cancel_sub_fee_extra(p_actor uuid, p_token text, p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_e      subcontractor_fee_extras%ROWTYPE;
  v_reason text := LEFT(btrim(COALESCE(p_reason, '')), 300);
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF v_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '취소 사유를 입력해 주세요.');
  END IF;
  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_actor;

  SELECT * INTO v_e FROM subcontractor_fee_extras WHERE id = p_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 내역을 찾지 못했습니다.');
  END IF;
  IF v_e.received_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 받음 확인된 내역입니다. 받음 확인을 먼저 취소해 주세요.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sub_fee_extra:' || v_e.subcontractor_id::text));

  INSERT INTO subcontractor_settlement_events
    (tenant_id, subcontractor_id, settle_date, event, amount, reason, actor_id, actor_name)
  VALUES (v_e.tenant_id, v_e.subcontractor_id, v_e.ref_date, 'cancel_extra', v_e.amount, '추가분 보고 취소: ' || v_reason,
          p_actor, (SELECT name FROM users WHERE id = p_actor));

  PERFORM _sub_fee_extra_drop(p_id);
  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_cancel_sub_fee_extra(uuid, text, uuid, text) TO anon, authenticated;

-- ============================================================
-- [6] 날짜 보고 취소 감싸기 - 그 날짜에 딸린 추가분 보고가 있으면 먼저 막는다
--     (날짜가 다시 열리면 그 작업이 본 금액으로 다시 잡혀서 추가분과 겹치기 때문)
-- ============================================================
DO $$
BEGIN
  IF to_regprocedure('_impl_admin_cancel_sub_daily_report(uuid, text, uuid, date, text)') IS NULL THEN
    ALTER FUNCTION admin_cancel_sub_daily_report(uuid, text, uuid, date, text) RENAME TO _impl_admin_cancel_sub_daily_report;
  END IF;
END $$;

REVOKE ALL ON FUNCTION _impl_admin_cancel_sub_daily_report(uuid, text, uuid, date, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION admin_cancel_sub_daily_report(
  p_actor uuid, p_token text, p_subcontractor_id uuid, p_date date, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cnt int;
BEGIN
  SELECT COUNT(DISTINCT e.id) INTO v_cnt
    FROM subcontractor_fee_extras e
    JOIN subcontractor_fee_extra_lines el ON el.extra_id = e.id
   WHERE e.subcontractor_id = p_subcontractor_id
     AND (el.origin_date = p_date
          OR EXISTS (SELECT 1 FROM subcontractor_settlement_lines b
                      WHERE b.task_id = el.task_id AND b.kind = 'base' AND b.settle_date = p_date));
  IF v_cnt > 0 THEN
    RETURN jsonb_build_object('ok', false,
      'error', '이 날짜 작업의 추가분 보고가 ' || v_cnt || '건 있습니다. 추가분 보고를 먼저 취소해 주세요.');
  END IF;
  RETURN _impl_admin_cancel_sub_daily_report(p_actor, p_token, p_subcontractor_id, p_date, p_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_cancel_sub_daily_report(uuid, text, uuid, date, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 표 - 기대: 2행
SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('subcontractor_fee_extras', 'subcontractor_fee_extra_lines') ORDER BY 1;

-- 2) 함수 - 기대: 9행
SELECT proname FROM pg_proc
 WHERE proname IN ('_sub_fee_extra_due', '_sub_fee_extra_json', '_sub_fee_extra_drop',
                   'sub_list_fee_extras', 'sub_report_fee_extra', 'sub_cancel_fee_extra',
                   'admin_list_sub_fee_extras', 'admin_confirm_sub_fee_extra', 'admin_cancel_sub_fee_extra')
 ORDER BY 1;

-- 3) 기존 함수에 조각이 들어갔는가 - 기대: 2행 모두 true
SELECT proname, prosrc LIKE '%subcontractor_fee_extra_lines%' AS has_extra
  FROM pg_proc WHERE proname IN ('_sub_settle_sync_task', '_principal_remit_build') ORDER BY 1;

-- 4) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT sub_list_fee_extras('00000000-0000-0000-0000-000000000000'::uuid, NULL);
