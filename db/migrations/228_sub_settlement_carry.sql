-- ============================================================================
-- Migration 228 - 협력사 일일 정산: 합계 0 이하인 날은 자동 이월
-- 작성 2026-10-06 · 선행: 225
--
-- 배경 (실화면 확인 결과)
--   완료 후 취소로 차감분만 있는 날은 보낼 수수료가 0 이하인데 [송금 보고] 가 가능했습니다.
--
-- 규칙
--   · 합계가 0 이하인 열린 날은 송금 보고를 하지 않습니다. 상태 "이월".
--   · 그 금액은 "다음 열린 날" 의 합계에 자동으로 더해집니다 (다음 송금에서 차감).
--     다음 날도 합쳐서 0 이하이면 그날도 "이월" 이고 계속 넘어갑니다.
--   · 넘어간 금액을 받은 날을 송금 보고하면, 이월된 날들의 줄을 그 보고일로 옮겨 함께 잠급니다
--     (원래 날짜는 origin_date 로 남습니다).
--
-- 내용
--   _sub_open_plan          열린 날짜들의 자체 합계 / 넘겨받은 금액 / 최종 합계 계산 (내부)
--   _sub_settle_days (교체) 날짜별 요약에 carry_in · own_fee · carry_from 추가, 상태 "이월"
--   sub_report_daily_fee (교체) 합계 0 이하면 거부, 이월분을 보고일로 옮겨 잠금
--
-- 기존 데이터 영향: 없음. 이미 보고·확인된 날짜는 건드리지 않습니다 (함수 교체만).
-- ============================================================================

BEGIN;

-- ============================================================
-- 내부: 열린 날짜별 계획 (날짜 오름차순으로 0 이하 합계를 다음 날로 넘김)
-- ============================================================
CREATE OR REPLACE FUNCTION _sub_open_plan(p_sub uuid)
RETURNS TABLE (d date, own_fee int, carry_in int, total int, carry_from date[])
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_day   date;
  v_own   int;
  v_carry int := 0;
  v_from  date[] := ARRAY[]::date[];
BEGIN
  FOR v_day IN
    SELECT x.dd FROM (
      SELECT (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS dd
        FROM tasks t
        JOIN payments p ON p.task_id = t.id AND p.track = 'S'
       WHERE t.subcontractor_id = p_sub AND t.status = '완료' AND t.completed_at IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM subcontractor_settlement_lines l WHERE l.task_id = t.id AND l.kind = 'base')
      UNION
      SELECT l.settle_date FROM subcontractor_settlement_lines l WHERE l.subcontractor_id = p_sub
    ) x
    WHERE NOT _sub_day_locked(p_sub, x.dd)
    ORDER BY x.dd
  LOOP
    SELECT COALESCE(SUM(l.fee), 0)::int INTO v_own FROM _sub_day_lines(p_sub, v_day) l;

    d := v_day; own_fee := v_own; carry_in := v_carry; total := v_own + v_carry; carry_from := v_from;
    RETURN NEXT;

    IF v_own + v_carry <= 0 THEN
      -- 이 날도 0 이하 -> 통째로 다음 열린 날로 넘김
      v_carry := v_own + v_carry;
      v_from  := v_from || v_day;
    ELSE
      v_carry := 0;
      v_from  := ARRAY[]::date[];
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION _sub_open_plan(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 날짜별 요약 (mig 225 의 _sub_settle_days 교체)
--   상태: 확인 완료 / 차액 / 보고됨 / 이월(합계 0 이하) / 미입금 / 대기
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
  v_plan   record;
  v_total  int;
  v_carry  int;
  v_cfrom  date[];
BEGIN
  SELECT staff_cut_rate INTO v_cut FROM subcontractors WHERE id = p_sub;

  FOR v_day IN
    SELECT x.dd FROM (
      SELECT (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS dd
        FROM tasks t
       WHERE t.subcontractor_id = p_sub AND t.status = '완료' AND t.completed_at IS NOT NULL
      UNION SELECT settle_date FROM subcontractor_settlement_lines   WHERE subcontractor_id = p_sub
      UNION SELECT settle_date FROM subcontractor_daily_settlements WHERE subcontractor_id = p_sub
    ) x
    WHERE x.dd BETWEEN p_from AND p_to
    ORDER BY x.dd DESC
  LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'task_id', l.task_id, 'task_no', l.task_no, 'customer_name', l.customer_name,
             'kind', l.kind, 'fee', l.fee, 'received', l.received, 'supply', l.supply,
             'vat', GREATEST(l.received - l.supply, 0), 'vat_included', l.vat_included,
             'engineer_id', l.engineer_id, 'engineer_name', l.engineer_name,
             'origin_date', l.origin_date, 'memo', l.memo, 'photo_count', l.photo_count,
             'staff_cut', CASE WHEN l.kind = 'base' THEN ROUND(l.supply * COALESCE(v_cut, 0))::int ELSE 0 END,
             -- 기사 수익은 본 금액 줄에서만 계산한다. 조정 줄(추가분·차감분)은 수수료 변동만 뜻하므로 0.
             'net', CASE WHEN l.kind = 'base'
                         THEN l.supply - l.fee - ROUND(l.supply * COALESCE(v_cut, 0))::int
                         ELSE 0 END
           )), '[]'::jsonb),
           COALESCE(SUM(l.fee), 0)::int,
           COALESCE(SUM(l.received) FILTER (WHERE l.kind = 'base'), 0)::int,
           COALESCE(SUM(l.supply)   FILTER (WHERE l.kind = 'base'), 0)::int,
           (COUNT(*) FILTER (WHERE l.kind = 'base'))::int
      INTO v_lines, v_fee, v_recv, v_supply, v_cnt
      FROM _sub_day_lines(p_sub, v_day) l;

    SELECT * INTO v_s FROM subcontractor_daily_settlements WHERE subcontractor_id = p_sub AND settle_date = v_day;

    IF jsonb_array_length(v_lines) = 0 AND v_s.id IS NULL THEN
      CONTINUE;
    END IF;

    -- 열린 날: 넘겨받은 금액 포함한 합계
    v_carry := 0; v_cfrom := ARRAY[]::date[]; v_total := v_fee;
    IF v_s.reported_at IS NULL THEN
      SELECT pl.carry_in, pl.total, pl.carry_from INTO v_plan
        FROM _sub_open_plan(p_sub) pl WHERE pl.d = v_day;
      IF FOUND THEN
        v_carry := v_plan.carry_in; v_total := v_plan.total; v_cfrom := v_plan.carry_from;
      END IF;
    END IF;

    v_status := CASE
      WHEN v_s.confirmed_at IS NOT NULL THEN '확인 완료'
      WHEN v_s.reported_at IS NOT NULL AND COALESCE(v_s.reported_amount, 0) <> COALESCE(v_s.calc_fee, 0) THEN '차액'
      WHEN v_s.reported_at IS NOT NULL THEN '보고됨'
      WHEN v_total <= 0 THEN '이월'
      WHEN v_now >= ((v_day + 1)::timestamp + interval '12 hours') AT TIME ZONE 'Asia/Seoul' THEN '미입금'
      ELSE '대기'
    END;

    v_out := v_out || jsonb_build_object(
      'date', v_day,
      'locked', v_s.reported_at IS NOT NULL,
      'task_count', v_cnt, 'received', v_recv, 'supply', v_supply,
      'fee', CASE WHEN v_s.reported_at IS NOT NULL THEN v_s.calc_fee ELSE v_total END,
      'own_fee', v_fee, 'carry_in', v_carry, 'carry_from', to_jsonb(v_cfrom),
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
-- 송금 보고 (mig 225 의 sub_report_daily_fee 교체)
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
  v_plan   record;
  v_src    date;
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

  SELECT * INTO v_plan FROM _sub_open_plan(v_sub) pl WHERE pl.d = p_date;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 날짜에는 정산할 작업이 없습니다.');
  END IF;
  IF v_plan.total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '보낼 수수료가 없습니다. 이 금액은 다음 송금에서 자동으로 차감됩니다.');
  END IF;

  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = v_sub;

  -- 넘겨받은 날들의 줄을 보고일로 옮긴다 (원래 날짜는 origin_date 에 남김)
  FOREACH v_src IN ARRAY COALESCE(v_plan.carry_from, ARRAY[]::date[]) LOOP
    INSERT INTO subcontractor_settlement_lines
      (tenant_id, subcontractor_id, settle_date, task_id, kind, fee, received, supply, engineer_id, origin_date, memo)
    SELECT v_tenant, v_sub, p_date, l.task_id, 'base', l.fee, l.received, l.supply, l.engineer_id, v_src, '이월'
      FROM _sub_day_lines(v_sub, v_src) l
     WHERE l.kind = 'base';
    UPDATE subcontractor_settlement_lines
       SET settle_date = p_date,
           origin_date = COALESCE(origin_date, v_src),
           memo        = COALESCE(memo, '') || ' · 이월'
     WHERE subcontractor_id = v_sub AND settle_date = v_src AND kind = 'adjust';
  END LOOP;

  -- 보고일의 본 금액을 줄로 고정
  INSERT INTO subcontractor_settlement_lines
    (tenant_id, subcontractor_id, settle_date, task_id, kind, fee, received, supply, engineer_id)
  SELECT v_tenant, v_sub, p_date, l.task_id, 'base', l.fee, l.received, l.supply, l.engineer_id
    FROM _sub_day_lines(v_sub, p_date) l
   WHERE l.kind = 'base'
     AND NOT EXISTS (SELECT 1 FROM subcontractor_settlement_lines x WHERE x.task_id = l.task_id AND x.kind = 'base');

  SELECT COALESCE(SUM(fee), 0)::int,
         COALESCE(SUM(received) FILTER (WHERE kind = 'base' AND origin_date IS NULL), 0)::int,
         (COUNT(*) FILTER (WHERE kind = 'base' AND origin_date IS NULL))::int
    INTO v_fee, v_recv, v_cnt
    FROM subcontractor_settlement_lines
   WHERE subcontractor_id = v_sub AND settle_date = p_date;

  INSERT INTO subcontractor_daily_settlements
    (tenant_id, subcontractor_id, settle_date, calc_fee, calc_received, task_count, reported_amount, reported_at, reported_by)
  VALUES (v_tenant, v_sub, p_date, v_fee, v_recv, v_cnt, p_amount, now(), p_actor)
  ON CONFLICT (subcontractor_id, settle_date) DO UPDATE
    SET calc_fee = EXCLUDED.calc_fee, calc_received = EXCLUDED.calc_received, task_count = EXCLUDED.task_count,
        reported_amount = EXCLUDED.reported_amount, reported_at = now(), reported_by = p_actor, note = NULL;

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'calc_fee', v_fee, 'reported_amount', p_amount, 'diff', p_amount - v_fee);
END;
$$;

GRANT EXECUTE ON FUNCTION sub_report_daily_fee(uuid, text, date, int) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 화이트코어의 열린 날짜 계획 - 차감분만 있는 날(예: 10/7)은 total 이 0 이하,
--    그 뒤 날짜가 있으면 carry_in 에 그 금액이 들어 있어야 합니다.
SELECT pl.* FROM subcontractors s, LATERAL _sub_open_plan(s.id) pl WHERE s.code = 'whitecore' ORDER BY pl.d;

-- 2) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT sub_report_daily_fee('00000000-0000-0000-0000-000000000000'::uuid, NULL, CURRENT_DATE, 0);
