-- ============================================================================
-- Migration 231 - 협력사 관리자: 기사 관리 + 회사 몫 % (작업별 고정)
-- 작성 2026-10-06 · 선행: 212, 214, 225, 228
--
-- 사장님 결정 (2026-10-06)
--   · 협력사 관리자가 할 수 있는 것: 소속 기사 목록 / 추가 / 담당 지역 수정 / 비활성·재활성
--     (삭제 · 올데이케어 수수료 · 소속 변경 · 관리자 지정은 운영자만)
--   · 회사 몫 % (협력사가 소속 기사에게서 떼는 비율)
--       - 협력사 관리자가 직접 수정, 운영자는 보기만
--       - 0~100 정수, 적용 시작일 필수, 오늘 또는 그 이후 날짜만
--       - 작업을 완료한 날의 비율을 그 작업에 고정 저장 -> 나중에 비율을 바꿔도 지난 작업은 그대로
--       - 변경 이력 보존 (누가 언제 몇 %로)
--       - 올데이케어 수수료(35%)와는 무관한, 협력사 안의 분배입니다.
--
-- 내용
--   [1] subcontractor_cut_rates (적용일 표 = 변경 이력)  +  tasks.sub_staff_cut_pct (작업별 고정 비율)
--   [2] 완료 시점에 비율을 작업에 적어 두는 트리거
--   [3] 정산 함수 2개의 회사 몫 계산식 교체 (협력사 현재 비율 -> 작업에 고정된 비율)
--       _sub_settle_days (mig 228), sub_staff_list_settlement (mig 225)
--       두 함수는 저장소 본문에서 자동으로 만들었고, 바꾼 계산식을 되돌리면 원본과 완전히 같다는 것을
--       만들 때 검사했습니다.
--   [4] 회사 몫 조회·변경 RPC
--   [5] 기사 관리 RPC (목록 / 추가 / 지역 수정 / 비활성)
--       _sub_register_staff 는 일괄 등록 SQL(db/ops)도 같이 씁니다.
--
-- 기존 데이터 영향
--   · 지금 화이트코어 회사 몫은 0% -> 이미 완료된 협력사 작업에 0 을 적어 둡니다. 금액 변화 없음.
--   · 수수료(올데이케어 몫)·payments 는 건드리지 않습니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 적용일 표 + 작업별 고정 비율
-- ============================================================
CREATE TABLE IF NOT EXISTS subcontractor_cut_rates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id),
  rate_pct         int  NOT NULL CHECK (rate_pct BETWEEN 0 AND 100),
  effective_from   date NOT NULL,
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sub_cut_rates_by_sub ON subcontractor_cut_rates (subcontractor_id, effective_from DESC, created_at DESC);
ALTER TABLE subcontractor_cut_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_cut_rates FROM anon, authenticated;
COMMENT ON TABLE subcontractor_cut_rates IS
  '협력사 회사 몫 % 적용일 표. 줄을 고치지 않고 쌓기만 합니다(= 변경 이력). 같은 시작일이 여러 줄이면 나중에 넣은 줄이 적용.';

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_staff_cut_pct int
  CHECK (sub_staff_cut_pct IS NULL OR sub_staff_cut_pct BETWEEN 0 AND 100);
COMMENT ON COLUMN tasks.sub_staff_cut_pct IS
  '협력사 회사 몫 % - 작업을 완료한 날의 비율을 고정 저장 (mig 231). 협력사 작업이 아니면 NULL.';

-- 시작 줄: 지금 비율을 "처음부터 적용"으로 한 줄 (이미 있으면 넣지 않음)
INSERT INTO subcontractor_cut_rates (tenant_id, subcontractor_id, rate_pct, effective_from)
SELECT s.tenant_id, s.id, ROUND(COALESCE(s.staff_cut_rate, 0) * 100)::int, DATE '2000-01-01'
  FROM subcontractors s
 WHERE NOT EXISTS (SELECT 1 FROM subcontractor_cut_rates r WHERE r.subcontractor_id = s.id);

-- 그 날짜에 적용되는 비율(%)
CREATE OR REPLACE FUNCTION _sub_cut_pct_on(p_sub uuid, p_date date)
RETURNS int
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT r.rate_pct FROM subcontractor_cut_rates r
      WHERE r.subcontractor_id = p_sub AND r.effective_from <= p_date
      ORDER BY r.effective_from DESC, r.created_at DESC LIMIT 1),
    (SELECT ROUND(COALESCE(s.staff_cut_rate, 0) * 100)::int FROM subcontractors s WHERE s.id = p_sub),
    0);
$$;
REVOKE ALL ON FUNCTION _sub_cut_pct_on(uuid, date) FROM PUBLIC, anon, authenticated;

-- 작업 한 건의 회사 몫 금액 = 공급가 x (그 작업에 고정된 비율). 원 단위 반올림.
CREATE OR REPLACE FUNCTION _sub_task_cut(p_task_id uuid, p_supply int)
RETURNS int
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT ROUND(COALESCE(p_supply, 0) * COALESCE((SELECT t.sub_staff_cut_pct FROM tasks t WHERE t.id = p_task_id), 0) / 100.0)::int;
$$;
REVOKE ALL ON FUNCTION _sub_task_cut(uuid, int) FROM PUBLIC, anon, authenticated;

-- 이미 완료된 협력사 작업: 완료한 날 기준 비율을 적어 둔다 (지금은 전부 0)
UPDATE tasks t
   SET sub_staff_cut_pct = _sub_cut_pct_on(t.subcontractor_id, (COALESCE(t.completed_at, now()) AT TIME ZONE 'Asia/Seoul')::date)
 WHERE t.subcontractor_id IS NOT NULL
   AND t.status = '완료'
   AND t.sub_staff_cut_pct IS NULL;

-- ============================================================
-- [2] 완료 시점에 비율 고정
-- ============================================================
CREATE OR REPLACE FUNCTION trg_tasks_fix_sub_cut()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.subcontractor_id IS NOT NULL AND NEW.status = '완료'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM '완료'
          OR OLD.subcontractor_id IS DISTINCT FROM NEW.subcontractor_id) THEN
    NEW.sub_staff_cut_pct := _sub_cut_pct_on(
      NEW.subcontractor_id, (COALESCE(NEW.completed_at, now()) AT TIME ZONE 'Asia/Seoul')::date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_fix_sub_cut ON tasks;
CREATE TRIGGER tasks_fix_sub_cut
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION trg_tasks_fix_sub_cut();

-- ============================================================
-- [3] 정산 함수 - 회사 몫 계산식 교체
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
             'staff_cut', CASE WHEN l.kind = 'base' THEN _sub_task_cut(l.task_id, l.supply) ELSE 0 END,
             -- 기사 수익은 본 금액 줄에서만 계산한다. 조정 줄(추가분·차감분)은 수수료 변동만 뜻하므로 0.
             'net', CASE WHEN l.kind = 'base'
                         THEN l.supply - l.fee - _sub_task_cut(l.task_id, l.supply)
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
               'staff_cut', SUM(_sub_task_cut(x.task_id, x.supply)),
               'net', SUM(x.supply - x.fee - _sub_task_cut(x.task_id, x.supply)),
               'tasks', jsonb_agg(jsonb_build_object(
                          'task_no', x.task_no, 'customer_name', x.customer_name,
                          'received', x.received, 'supply', x.supply, 'vat', x.received - x.supply,
                          'vat_included', x.vat_included, 'fee', x.fee,
                          'net', x.supply - x.fee - _sub_task_cut(x.task_id, x.supply)))
             ) AS d
        FROM (
          SELECT t.id AS task_id, (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS d, t.task_no, t.customer_name,
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

GRANT EXECUTE ON FUNCTION sub_staff_list_settlement(uuid, text, date, date) TO anon, authenticated;

-- ============================================================
-- [4] 회사 몫 % 조회 · 변경
-- ============================================================
-- 조회: 협력사 관리자(자기 협력사) 또는 운영자(p_subcontractor_id 지정, 보기만)
CREATE OR REPLACE FUNCTION sub_get_cut_rates(p_actor uuid, p_token text, p_subcontractor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub   uuid;
  v_role  text;
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF _caller_is_admin(p_actor) AND p_subcontractor_id IS NOT NULL THEN
    v_sub := p_subcontractor_id;
  ELSE
    SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
    IF v_sub IS NULL OR v_role <> 'manager' THEN
      RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'today', v_today,
    'current_pct', _sub_cut_pct_on(v_sub, v_today),
    'upcoming', (SELECT jsonb_build_object('pct', x.rate_pct, 'from', x.effective_from)
                   FROM (SELECT DISTINCT ON (r.effective_from) r.rate_pct, r.effective_from
                           FROM subcontractor_cut_rates r
                          WHERE r.subcontractor_id = v_sub AND r.effective_from > v_today
                          ORDER BY r.effective_from, r.created_at DESC) x
                  ORDER BY x.effective_from LIMIT 1),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'pct', r.rate_pct, 'from', r.effective_from, 'created_at', r.created_at,
               'by', (SELECT u.name FROM users u WHERE u.id = r.created_by))
             ORDER BY r.created_at DESC)
        FROM subcontractor_cut_rates r
       WHERE r.subcontractor_id = v_sub), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_get_cut_rates(uuid, text, uuid) TO anon, authenticated;

-- 변경: 협력사 관리자만. 운영자도 바꿀 수 없습니다.
CREATE OR REPLACE FUNCTION sub_set_cut_rate(p_actor uuid, p_token text, p_pct int, p_effective_from date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_tenant uuid;
  v_today  date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 바꿀 수 있습니다.');
  END IF;
  IF p_pct IS NULL OR p_pct < 0 OR p_pct > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', '비율은 0~100 사이 정수로 입력해 주세요.');
  END IF;
  IF p_effective_from IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '적용 시작일을 정해 주세요.');
  END IF;
  IF p_effective_from < v_today THEN
    RETURN jsonb_build_object('ok', false, 'error', '적용 시작일은 오늘 또는 그 이후 날짜만 가능합니다.');
  END IF;

  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = v_sub;
  INSERT INTO subcontractor_cut_rates (tenant_id, subcontractor_id, rate_pct, effective_from, created_by)
  VALUES (v_tenant, v_sub, p_pct, p_effective_from, p_actor);

  RETURN jsonb_build_object('ok', true, 'pct', p_pct, 'from', p_effective_from,
                            'current_pct', _sub_cut_pct_on(v_sub, v_today));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_set_cut_rate(uuid, text, int, date) TO anon, authenticated;

-- ============================================================
-- [5] 기사 관리
-- ============================================================
-- 내부: 협력사 직원 한 명 등록. 실패해도 예외를 던지지 않고 사유를 돌려준다 (일괄 등록에서 행 단위로 건너뛰기 위해).
--   초기 비밀번호 = 전화번호 뒤 4자리, 첫 로그인 때 변경.
CREATE OR REPLACE FUNCTION _sub_register_staff(
  p_sub uuid, p_name text, p_phone text, p_sub_role text, p_region text, p_zones text[]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_digits text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  v_phone  text;
  v_name   text := btrim(COALESCE(p_name, ''));
  v_role   text := COALESCE(NULLIF(btrim(COALESCE(p_sub_role, '')), ''), 'staff');
  v_dup    record;
  v_next   int;
  v_code   text;
  v_id     uuid;
  z        text;
  v_zcnt   int := 0;
BEGIN
  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = p_sub;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사를 찾지 못했습니다.');
  END IF;
  IF v_name = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '이름을 입력해 주세요.');
  END IF;
  IF v_digits !~ '^01[0-9]{8,9}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', '휴대폰 번호를 확인해 주세요.');
  END IF;
  IF v_role NOT IN ('staff', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', '구분은 staff 또는 manager 만 가능합니다.');
  END IF;
  v_phone := CASE WHEN length(v_digits) = 11
                  THEN substr(v_digits, 1, 3) || '-' || substr(v_digits, 4, 4) || '-' || substr(v_digits, 8)
                  ELSE substr(v_digits, 1, 3) || '-' || substr(v_digits, 4, 3) || '-' || substr(v_digits, 7) END;

  SELECT u.name, u.code, u.is_active INTO v_dup
    FROM users u
   WHERE regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = v_digits
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error',
      '이미 등록된 전화번호입니다 (' || v_dup.name || CASE WHEN v_dup.is_active THEN '' ELSE ', 비활성' END || ').');
  END IF;

  -- 기사 코드 번호가 겹치지 않게 한 번에 한 건씩
  PERFORM pg_advisory_xact_lock(hashtext('ollit_engineer_code'));
  SELECT COALESCE(MAX(SUBSTRING(code FROM 2)::int), 0) + 1 INTO v_next
    FROM users WHERE tenant_id = v_tenant AND code ~ '^E[0-9]{3,}$';
  v_code := 'E' || LPAD(v_next::text, 3, '0');

  INSERT INTO users (tenant_id, code, name, phone, is_active, region,
                     password_hash, must_change_password, subcontractor_id, sub_role)
  VALUES (v_tenant, v_code, v_name, v_phone, true, NULLIF(btrim(COALESCE(p_region, '')), ''),
          extensions.crypt(RIGHT(v_digits, 4), extensions.gen_salt('bf')), true, p_sub, v_role)
  RETURNING id INTO v_id;

  INSERT INTO user_roles (user_id, role, is_primary, principal_id)
  VALUES (v_id, 'engineer', true, NULL);

  FOREACH z IN ARRAY COALESCE(p_zones, ARRAY[]::text[]) LOOP
    IF btrim(COALESCE(z, '')) <> '' THEN
      INSERT INTO engineer_zones (user_id, district, active)
      VALUES (v_id, btrim(z), true)
      ON CONFLICT (user_id, district) DO NOTHING;
      v_zcnt := v_zcnt + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'code', v_code, 'name', v_name, 'phone', v_phone, 'zones', v_zcnt);
END;
$$;
REVOKE ALL ON FUNCTION _sub_register_staff(uuid, text, text, text, text, text[]) FROM PUBLIC, anon, authenticated;

-- 목록 (비활성 포함)
CREATE OR REPLACE FUNCTION sub_manage_list_staff(p_actor uuid, p_token text)
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
    SELECT jsonb_agg(jsonb_build_object(
             'id', u.id, 'code', u.code, 'name', u.name, 'phone', u.phone, 'sub_role', u.sub_role,
             'is_active', u.is_active, 'region', u.region,
             'zones', COALESCE((SELECT jsonb_agg(z.district ORDER BY z.district)
                                  FROM engineer_zones z
                                 WHERE z.user_id = u.id AND COALESCE(z.active, true)), '[]'::jsonb),
             'open_tasks', (SELECT COUNT(*) FROM tasks t
                             WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                               AND t.status NOT IN ('완료', '취소', 'visit_only', '정산완료'))
           ) ORDER BY u.is_active DESC, u.name)
      FROM users u
     WHERE u.subcontractor_id = v_sub
  ), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_manage_list_staff(uuid, text) TO anon, authenticated;

-- 추가 (항상 일반 기사로. 관리자 지정은 운영자만)
CREATE OR REPLACE FUNCTION sub_add_staff(
  p_actor uuid, p_token text, p_name text, p_phone text, p_region text, p_zones text[]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  RETURN _sub_register_staff(v_sub, p_name, p_phone, 'staff', p_region, p_zones);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_add_staff(uuid, text, text, text, text, text[]) TO anon, authenticated;

-- 담당 지역 수정 (소속 직원만)
CREATE OR REPLACE FUNCTION sub_update_staff_zones(
  p_actor uuid, p_token text, p_user_id uuid, p_region text, p_zones text[]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub   uuid;
  v_role  text;
  v_zones text[];
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND subcontractor_id = v_sub) THEN
    RETURN jsonb_build_object('ok', false, 'error', '소속 직원을 찾지 못했습니다.');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT btrim(x)), ARRAY[]::text[]) INTO v_zones
    FROM unnest(COALESCE(p_zones, ARRAY[]::text[])) x
   WHERE btrim(COALESCE(x, '')) <> '';

  UPDATE users SET region = NULLIF(btrim(COALESCE(p_region, '')), '') WHERE id = p_user_id;
  DELETE FROM engineer_zones WHERE user_id = p_user_id AND NOT (district = ANY (v_zones));
  INSERT INTO engineer_zones (user_id, district, active)
  SELECT p_user_id, x, true FROM unnest(v_zones) x
  ON CONFLICT (user_id, district) DO UPDATE SET active = true;

  RETURN jsonb_build_object('ok', true, 'zones', COALESCE(array_length(v_zones, 1), 0));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_update_staff_zones(uuid, text, uuid, text, text[]) TO anon, authenticated;

-- 비활성 · 재활성 (일반 기사만. 관리자 계정과 본인은 운영자에게 요청)
CREATE OR REPLACE FUNCTION sub_set_staff_active(p_actor uuid, p_token text, p_user_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub   uuid;
  v_role  text;
  v_u     users%ROWTYPE;
  v_open  int;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  SELECT * INTO v_u FROM users WHERE id = p_user_id AND subcontractor_id = v_sub;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '소속 직원을 찾지 못했습니다.');
  END IF;
  IF p_user_id = p_actor OR v_u.sub_role = 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '관리자 계정은 운영자에게 요청해 주세요.');
  END IF;

  IF NOT COALESCE(p_active, false) THEN
    SELECT COUNT(*) INTO v_open FROM tasks t
     WHERE t.assigned_engineer_id = p_user_id
       AND t.status NOT IN ('완료', '취소', 'visit_only', '정산완료');
    IF v_open > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error',
        '진행할 작업이 ' || v_open || '건 남아 있습니다. 다른 기사에게 넘긴 뒤 비활성으로 바꿔 주세요.');
    END IF;
    UPDATE users SET is_active = false WHERE id = p_user_id;
    UPDATE user_sessions SET revoked_at = now() WHERE user_id = p_user_id AND revoked_at IS NULL;
  ELSE
    UPDATE users SET is_active = true WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_user_id, 'is_active', COALESCE(p_active, false));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_set_staff_active(uuid, text, uuid, boolean) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 - 기대: 10행
SELECT proname FROM pg_proc
 WHERE proname IN ('_sub_cut_pct_on', '_sub_task_cut', 'trg_tasks_fix_sub_cut', 'sub_get_cut_rates', 'sub_set_cut_rate',
                   '_sub_register_staff', 'sub_manage_list_staff', 'sub_add_staff', 'sub_update_staff_zones',
                   'sub_set_staff_active')
 ORDER BY 1;

-- 2) 협력사별 현재 회사 몫 - 기대: 화이트코어 0
SELECT s.name, _sub_cut_pct_on(s.id, (now() AT TIME ZONE 'Asia/Seoul')::date) AS 현재_회사몫_퍼센트,
       (SELECT COUNT(*) FROM subcontractor_cut_rates r WHERE r.subcontractor_id = s.id) AS 이력_줄수
  FROM subcontractors s ORDER BY 1;

-- 3) 완료된 협력사 작업에 비율이 적혔는지 - 기대: 비어_있음 = 0
SELECT COUNT(*) AS 완료_협력사_작업, COUNT(*) FILTER (WHERE sub_staff_cut_pct IS NULL) AS 비어_있음
  FROM tasks WHERE subcontractor_id IS NOT NULL AND status = '완료';
