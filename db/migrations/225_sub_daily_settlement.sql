-- ============================================================================
-- Migration 225 - 협력사 일일 정산 (방식 B: 협력사 관리자가 날짜별 1회 송금 보고)
-- 작성 2026-10-06 · 선행: 211a, 212~217, 223
--
-- 흐름
--   협력사 기사 --(현금)--> 협력사 --(수수료만, 날짜별 1회)--> 올데이케어
--   · 협력사 관리자: 날짜별 [송금 보고] (실제 보낸 금액 입력)
--   · 운영자: [입금 확인]
--   · 기사 -> 협력사 정산은 협력사 내부 일. 올잇은 숫자만 보여 줍니다.
--
-- 규칙
--   · 날짜 = 완료 처리 시각의 한국 날짜.
--   · 수수료는 신고액이 아니라 올잇 계산값 (payments.owner_amount, track S).
--   · 보고하는 순간 그 날짜는 "잠금" - 그때의 작업별 금액을 줄(line) 로 고정합니다.
--   · 잠긴 뒤의 변동(늦은 완료 / 금액 수정 / 완료 후 취소)은 원래 날짜를 다시 계산하지 않고
--     다음 정산일에 "추가분 / 차감분" 줄로 자동 반영합니다.
--
-- 표
--   subcontractor_daily_settlements   협력사 x 날짜 1행 (보고·확인 기록, 계산 수수료 사본)
--   subcontractor_settlement_lines    작업별 줄 (base = 잠금 때 고정한 본 금액 / adjust = 추가분·차감분)
--   subcontractors.staff_cut_rate     협력사가 기사에게서 떼는 비율 (기본 0 = 기사 몫 100%)
--
-- 금액 기준 (기사·협력사 화면 공통)
--   내 수익 = 공급가 - 올데이케어 수수료 - 협력사 회사 몫(공급가 x staff_cut_rate)
--   부가세 포함 건의 부가세는 수익에 넣지 않고 별도 표시 (신고·납부용).
--
-- 기존 데이터 영향: 없음. 새 표 2개, 새 칸 1개, 새 함수. payments 트리거는 track S 줄에만 반응.
-- ============================================================================

BEGIN;

ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS staff_cut_rate numeric NOT NULL DEFAULT 0
    CHECK (staff_cut_rate >= 0 AND staff_cut_rate <= 1);
COMMENT ON COLUMN subcontractors.staff_cut_rate IS
  '협력사가 소속 기사에게서 떼는 비율(공급가 기준). 기본 0 = 기사 몫 100%. 올잇은 표시만 함.';

CREATE TABLE IF NOT EXISTS subcontractor_daily_settlements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  subcontractor_id  uuid NOT NULL REFERENCES subcontractors(id),
  settle_date       date NOT NULL,
  calc_fee          int  NOT NULL DEFAULT 0,     -- 잠금 시점의 계산 수수료 (줄 합계)
  calc_received     int  NOT NULL DEFAULT 0,     -- 잠금 시점의 받은 금액 합계 (참고)
  task_count        int  NOT NULL DEFAULT 0,
  reported_amount   int,
  reported_at       timestamptz,
  reported_by       uuid REFERENCES users(id),
  confirmed_at      timestamptz,
  confirmed_by      uuid REFERENCES users(id),
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subcontractor_id, settle_date)
);

CREATE TABLE IF NOT EXISTS subcontractor_settlement_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  subcontractor_id  uuid NOT NULL REFERENCES subcontractors(id),
  settle_date       date NOT NULL,               -- 이 줄이 속한 정산일
  task_id           uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('base', 'adjust')),
  fee               int  NOT NULL,               -- 수수료 (adjust 는 음수 가능 = 차감분)
  received          int  NOT NULL DEFAULT 0,
  supply            int  NOT NULL DEFAULT 0,
  engineer_id       uuid REFERENCES users(id),
  origin_date       date,                        -- adjust: 원래 정산일
  memo              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sub_settle_lines_by_day  ON subcontractor_settlement_lines (subcontractor_id, settle_date);
CREATE INDEX IF NOT EXISTS sub_settle_lines_by_task ON subcontractor_settlement_lines (task_id);

ALTER TABLE subcontractor_daily_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_settlement_lines  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_daily_settlements FROM anon, authenticated;
REVOKE ALL ON TABLE subcontractor_settlement_lines  FROM anon, authenticated;

-- ============================================================
-- 내부: 그 날짜가 잠겼는가 (보고됨)
-- ============================================================
CREATE OR REPLACE FUNCTION _sub_day_locked(p_sub uuid, p_date date)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subcontractor_daily_settlements
     WHERE subcontractor_id = p_sub AND settle_date = p_date AND reported_at IS NOT NULL);
$$;

-- ============================================================
-- 내부: 잠긴 뒤 변동 -> 추가분/차감분 줄 맞추기 (작업 1건)
--   지금 수수료 - 이미 잠긴 줄들의 합 = 차이. 차이가 있으면 "다음 열린 정산일" 에 adjust 줄 1개.
--   아직 잠기지 않은 adjust 줄은 지우고 다시 계산하므로 여러 번 불려도 결과가 같습니다.
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
  IF v_sub IS NULL THEN RETURN; END IF;

  -- 잠기지 않은 adjust 줄은 지우고 다시 계산
  DELETE FROM subcontractor_settlement_lines l
   WHERE l.task_id = p_task_id AND l.kind = 'adjust'
     AND NOT _sub_day_locked(l.subcontractor_id, l.settle_date);

  SELECT COALESCE(SUM(fee), 0) INTO v_billed FROM subcontractor_settlement_lines WHERE task_id = p_task_id;

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

-- payments 가 바뀔 때 (협력사 줄만) 맞춘다. 실패해도 정산 계산 자체는 막지 않는다.
CREATE OR REPLACE FUNCTION trg_payments_sub_settle_sync()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task_id uuid := COALESCE(NEW.task_id, OLD.task_id);
BEGIN
  IF (TG_OP <> 'DELETE' AND NEW.track = 'S')
     OR (TG_OP <> 'INSERT' AND OLD.track = 'S')
     OR EXISTS (SELECT 1 FROM subcontractor_settlement_lines WHERE task_id = v_task_id) THEN
    BEGIN
      PERFORM _sub_settle_sync_task(v_task_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[sub settle sync] task % 실패: %', v_task_id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS payments_sub_settle_sync ON payments;
CREATE TRIGGER payments_sub_settle_sync
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_payments_sub_settle_sync();

-- ============================================================
-- 내부: 협력사 x 날짜의 작업별 줄 (잠겼으면 고정된 줄, 열려 있으면 실시간)
-- ============================================================
CREATE OR REPLACE FUNCTION _sub_day_lines(p_sub uuid, p_date date)
RETURNS TABLE (
  task_id uuid, task_no text, customer_name text, kind text, fee int, received int, supply int,
  vat_included boolean, engineer_id uuid, engineer_name text, origin_date date, memo text, photo_count int
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  IF _sub_day_locked(p_sub, p_date) THEN
    RETURN QUERY
    SELECT l.task_id, t.task_no, t.customer_name, l.kind, l.fee, l.received, l.supply,
           COALESCE(t.vat_included, false), l.engineer_id, u.name, l.origin_date, l.memo,
           (SELECT COUNT(*)::int FROM photos ph WHERE ph.task_id = l.task_id)
      FROM subcontractor_settlement_lines l
      JOIN tasks t      ON t.id = l.task_id
      LEFT JOIN users u ON u.id = l.engineer_id
     WHERE l.subcontractor_id = p_sub AND l.settle_date = p_date
     ORDER BY l.kind DESC, t.task_no;
    RETURN;
  END IF;

  RETURN QUERY
  -- 본 금액: 그 날 완료된 협력사 작업 (아직 어떤 정산일에도 고정되지 않은 것)
  SELECT t.id, t.task_no, t.customer_name, 'base'::text,
         COALESCE(p.owner_amount, 0)::int, COALESCE(t.received_total, 0)::int, COALESCE(t.supply_amount, 0)::int,
         COALESCE(t.vat_included, false), t.assigned_engineer_id, u.name, NULL::date, NULL::text,
         (SELECT COUNT(*)::int FROM photos ph WHERE ph.task_id = t.id)
    FROM tasks t
    JOIN payments p   ON p.task_id = t.id AND p.track = 'S'
    LEFT JOIN users u ON u.id = t.assigned_engineer_id
   WHERE t.subcontractor_id = p_sub
     AND t.status = '완료'
     AND t.completed_at IS NOT NULL
     AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date = p_date
     AND NOT EXISTS (SELECT 1 FROM subcontractor_settlement_lines l WHERE l.task_id = t.id AND l.kind = 'base')
  UNION ALL
  -- 추가분/차감분: 이 날짜로 넘어온 줄
  SELECT l.task_id, t.task_no, t.customer_name, l.kind, l.fee, l.received, l.supply,
         COALESCE(t.vat_included, false), l.engineer_id, u.name, l.origin_date, l.memo,
         (SELECT COUNT(*)::int FROM photos ph WHERE ph.task_id = l.task_id)
    FROM subcontractor_settlement_lines l
    JOIN tasks t      ON t.id = l.task_id
    LEFT JOIN users u ON u.id = l.engineer_id
   WHERE l.subcontractor_id = p_sub AND l.settle_date = p_date;
END;
$$;

REVOKE ALL ON FUNCTION _sub_day_lines(uuid, date) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 내부: 협력사의 기간 정산 요약 (날짜별 1행 + 줄)
--   상태: 확인 완료 / 차액(보고 금액 <> 계산) / 보고됨 / 미입금(다음 날 정오 지나 미보고) / 대기
-- ============================================================
CREATE OR REPLACE FUNCTION _sub_settle_days(p_sub uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_cut    numeric;
  v_out    jsonb := '[]'::jsonb;
  v_day    date;
  v_lines  jsonb;
  v_fee    int;
  v_recv   int;
  v_supply int;
  v_cnt    int;
  v_s      subcontractor_daily_settlements%ROWTYPE;
  v_status text;
  v_now    timestamptz := now();
BEGIN
  SELECT staff_cut_rate INTO v_cut FROM subcontractors WHERE id = p_sub;

  FOR v_day IN
    SELECT d FROM (
      SELECT (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS d
        FROM tasks t
       WHERE t.subcontractor_id = p_sub AND t.status = '완료' AND t.completed_at IS NOT NULL
      UNION SELECT settle_date FROM subcontractor_settlement_lines   WHERE subcontractor_id = p_sub
      UNION SELECT settle_date FROM subcontractor_daily_settlements WHERE subcontractor_id = p_sub
    ) x
    WHERE d BETWEEN p_from AND p_to
    ORDER BY d DESC
  LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'task_id', l.task_id, 'task_no', l.task_no, 'customer_name', l.customer_name,
             'kind', l.kind, 'fee', l.fee, 'received', l.received, 'supply', l.supply,
             'vat', GREATEST(l.received - l.supply, 0), 'vat_included', l.vat_included,
             'engineer_id', l.engineer_id, 'engineer_name', l.engineer_name,
             'origin_date', l.origin_date, 'memo', l.memo, 'photo_count', l.photo_count,
             -- 기사 수익 = 공급가 - 수수료 - 협력사 회사 몫 (adjust 줄은 수수료 변동분만 반영)
             'staff_cut', CASE WHEN l.kind = 'base' THEN ROUND(l.supply * COALESCE(v_cut, 0))::int ELSE 0 END,
             'net', CASE WHEN l.kind = 'base'
                         THEN l.supply - l.fee - ROUND(l.supply * COALESCE(v_cut, 0))::int
                         ELSE -l.fee END
           )), '[]'::jsonb),
           COALESCE(SUM(l.fee), 0)::int,
           COALESCE(SUM(l.received) FILTER (WHERE l.kind = 'base'), 0)::int,
           COALESCE(SUM(l.supply)   FILTER (WHERE l.kind = 'base'), 0)::int,
           COUNT(*) FILTER (WHERE l.kind = 'base')::int
      INTO v_lines, v_fee, v_recv, v_supply, v_cnt
      FROM _sub_day_lines(p_sub, v_day) l;

    SELECT * INTO v_s FROM subcontractor_daily_settlements WHERE subcontractor_id = p_sub AND settle_date = v_day;

    IF jsonb_array_length(v_lines) = 0 AND v_s.id IS NULL THEN
      CONTINUE;
    END IF;

    v_status := CASE
      WHEN v_s.confirmed_at IS NOT NULL THEN '확인 완료'
      WHEN v_s.reported_at IS NOT NULL AND COALESCE(v_s.reported_amount, 0) <> COALESCE(v_s.calc_fee, 0) THEN '차액'
      WHEN v_s.reported_at IS NOT NULL THEN '보고됨'
      WHEN v_fee <> 0 AND v_now >= ((v_day + 1)::timestamp + interval '12 hours') AT TIME ZONE 'Asia/Seoul' THEN '미입금'
      ELSE '대기'
    END;

    v_out := v_out || jsonb_build_object(
      'date', v_day,
      'locked', v_s.reported_at IS NOT NULL,
      'task_count', v_cnt, 'received', v_recv, 'supply', v_supply,
      'fee', CASE WHEN v_s.reported_at IS NOT NULL THEN v_s.calc_fee ELSE v_fee END,
      'reported_amount', v_s.reported_amount, 'reported_at', v_s.reported_at,
      'confirmed_at', v_s.confirmed_at,
      'diff', CASE WHEN v_s.reported_at IS NOT NULL THEN COALESCE(v_s.reported_amount, 0) - COALESCE(v_s.calc_fee, 0) ELSE NULL END,
      'status', v_status,
      'lines', v_lines
    );
  END LOOP;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION _sub_settle_days(uuid, date, date) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 협력사 관리자: 정산 목록
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_daily_settlements(
  p_actor uuid, p_token text, p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_to   date := COALESCE(p_to,   (now() AT TIME ZONE 'Asia/Seoul')::date + 7);
  v_from date := COALESCE(p_from, (now() AT TIME ZONE 'Asia/Seoul')::date - 31);
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'days', _sub_settle_days(v_sub, v_from, v_to),
    'staff_cut_rate', (SELECT staff_cut_rate FROM subcontractors WHERE id = v_sub));
END;
$$;

-- ============================================================
-- 협력사 관리자: 송금 보고 (그 날짜를 잠그고 작업별 금액을 고정)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_report_daily_fee(
  p_actor uuid, p_token text, p_date date, p_amount int
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_tenant uuid;
  v_today  date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_fee    int;
  v_recv   int;
  v_cnt    int;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  IF p_date IS NULL OR p_date > v_today THEN
    RETURN jsonb_build_object('ok', false, 'error', '오늘 이후 날짜는 보고할 수 없습니다.');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '보낸 금액을 입력해 주세요.');
  END IF;
  IF _sub_day_locked(v_sub, p_date) THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 송금 보고한 날짜입니다.');
  END IF;

  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = v_sub;

  -- 그 날의 본 금액을 줄로 고정 (추가분/차감분 줄은 이미 표에 있음)
  INSERT INTO subcontractor_settlement_lines
    (tenant_id, subcontractor_id, settle_date, task_id, kind, fee, received, supply, engineer_id)
  SELECT v_tenant, v_sub, p_date, l.task_id, 'base', l.fee, l.received, l.supply, l.engineer_id
    FROM _sub_day_lines(v_sub, p_date) l
   WHERE l.kind = 'base';

  SELECT COALESCE(SUM(fee), 0)::int,
         COALESCE(SUM(received) FILTER (WHERE kind = 'base'), 0)::int,
         COUNT(*) FILTER (WHERE kind = 'base')::int
    INTO v_fee, v_recv, v_cnt
    FROM subcontractor_settlement_lines
   WHERE subcontractor_id = v_sub AND settle_date = p_date;

  IF v_cnt = 0 AND v_fee = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 날짜에는 정산할 작업이 없습니다.');
  END IF;

  INSERT INTO subcontractor_daily_settlements
    (tenant_id, subcontractor_id, settle_date, calc_fee, calc_received, task_count, reported_amount, reported_at, reported_by)
  VALUES (v_tenant, v_sub, p_date, v_fee, v_recv, v_cnt, p_amount, now(), p_actor)
  ON CONFLICT (subcontractor_id, settle_date) DO UPDATE
    SET calc_fee = EXCLUDED.calc_fee, calc_received = EXCLUDED.calc_received, task_count = EXCLUDED.task_count,
        reported_amount = EXCLUDED.reported_amount, reported_at = now(), reported_by = p_actor;

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'calc_fee', v_fee, 'reported_amount', p_amount, 'diff', p_amount - v_fee);
END;
$$;

-- ============================================================
-- 협력사 기사: 내 정산 (날짜별)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_staff_list_settlement(
  p_actor uuid, p_token text, p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_cut  numeric;
  v_to   date := COALESCE(p_to,   (now() AT TIME ZONE 'Asia/Seoul')::date);
  v_from date := COALESCE(p_from, (now() AT TIME ZONE 'Asia/Seoul')::date - 31);
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 소속 기사만 사용할 수 있습니다.');
  END IF;
  SELECT staff_cut_rate INTO v_cut FROM subcontractors WHERE id = v_sub;

  RETURN jsonb_build_object('ok', true, 'days', COALESCE((
    SELECT jsonb_agg(d ORDER BY (d ->> 'date') DESC)
    FROM (
      SELECT jsonb_build_object(
               'date', x.d,
               'task_count', COUNT(*),
               'received', SUM(x.received), 'supply', SUM(x.supply), 'vat', SUM(x.received - x.supply),
               'fee', SUM(x.fee),
               'staff_cut', SUM(ROUND(x.supply * COALESCE(v_cut, 0))::int),
               'net', SUM(x.supply - x.fee - ROUND(x.supply * COALESCE(v_cut, 0))::int),
               'tasks', jsonb_agg(jsonb_build_object(
                          'task_no', x.task_no, 'customer_name', x.customer_name,
                          'received', x.received, 'supply', x.supply, 'vat', x.received - x.supply,
                          'vat_included', x.vat_included, 'fee', x.fee,
                          'net', x.supply - x.fee - ROUND(x.supply * COALESCE(v_cut, 0))::int))
             ) AS d
        FROM (
          SELECT (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS d, t.task_no, t.customer_name,
                 COALESCE(t.received_total, 0) AS received, COALESCE(t.supply_amount, 0) AS supply,
                 COALESCE(t.vat_included, false) AS vat_included,
                 COALESCE((SELECT SUM(p.owner_amount) FROM payments p WHERE p.task_id = t.id AND p.track = 'S'), 0)::int AS fee
            FROM tasks t
           WHERE t.subcontractor_id = v_sub
             AND t.assigned_engineer_id = p_actor
             AND t.status = '완료' AND t.completed_at IS NOT NULL
             AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN v_from AND v_to
        ) x
       GROUP BY x.d
    ) g
  ), '[]'::jsonb));
END;
$$;

-- ============================================================
-- 운영자: 협력사·날짜별 목록 / 입금 확인 / 확인 취소
-- ============================================================
CREATE OR REPLACE FUNCTION admin_list_sub_daily_fees(
  p_actor uuid, p_token text, p_from date DEFAULT NULL, p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_to   date := COALESCE(p_to,   (now() AT TIME ZONE 'Asia/Seoul')::date + 7);
  v_from date := COALESCE(p_from, (now() AT TIME ZONE 'Asia/Seoul')::date - 31);
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_actor;

  RETURN jsonb_build_object('ok', true, 'subcontractors', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', s.id, 'name', s.name, 'days', _sub_settle_days(s.id, v_from, v_to)) ORDER BY s.name)
      FROM subcontractors s
     WHERE s.tenant_id = v_tenant
  ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION admin_confirm_sub_daily_fee(
  p_actor uuid, p_token text, p_subcontractor_id uuid, p_date date, p_confirm boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_s      subcontractor_daily_settlements%ROWTYPE;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_actor;

  SELECT * INTO v_s FROM subcontractor_daily_settlements
   WHERE subcontractor_id = p_subcontractor_id AND settle_date = p_date AND tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND OR v_s.reported_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '아직 송금 보고가 없는 날짜입니다.');
  END IF;

  UPDATE subcontractor_daily_settlements
     SET confirmed_at = CASE WHEN p_confirm THEN now() ELSE NULL END,
         confirmed_by = CASE WHEN p_confirm THEN p_actor ELSE NULL END
   WHERE id = v_s.id;

  RETURN jsonb_build_object('ok', true, 'confirmed', p_confirm);
END;
$$;

GRANT EXECUTE ON FUNCTION sub_list_daily_settlements(uuid, text, date, date)               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sub_report_daily_fee(uuid, text, date, int)                      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sub_staff_list_settlement(uuid, text, date, date)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_list_sub_daily_fees(uuid, text, date, date)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_confirm_sub_daily_fee(uuid, text, uuid, date, boolean)     TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 표·칸 - 기대: 표 2행, staff_cut_rate 1행(기본 0)
SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('subcontractor_daily_settlements', 'subcontractor_settlement_lines') ORDER BY 1;
SELECT column_name, column_default FROM information_schema.columns
 WHERE table_name = 'subcontractors' AND column_name = 'staff_cut_rate';

-- 2) 트리거 - 기대: 1행
SELECT tgname FROM pg_trigger WHERE tgname = 'payments_sub_settle_sync' AND NOT tgisinternal;

-- 3) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT sub_list_daily_settlements('00000000-0000-0000-0000-000000000000'::uuid, NULL);
