-- ============================================================================
-- Migration 254 - 쿨가이(KB) 원청 전용 화면: 보기 전용 서버 함수 3개
-- 작성 2026-10-07 · 선행: 244, 245
--
-- 사장님 결정 (2026-10-07)
--   쿨가이는 전용 화면으로 자기 수수료(원청 몫)만 본다. 이번 범위는 화이트코어(협력사) 작업만.
--   직영 작업은 아예 나오지 않는다 (KB 기존 정책과 섞이지 않게).
--   보임 : 작업코드 · 종목 · 고객 이름(가운데 가림) · 구·동 · 일정 · 상태 · 견적(보관 견적) · 쿨가이 수수료 · 날짜별 송금
--   숨김 : 전화번호 · 상세 주소 · 수행 협력사 · 기사 · 받은 금액 · 실제 공급가 · 협력사 수수료 · 올데이케어 몫 · 사진
--   보기 전용 (접수 · 취소 · 변경 없음)
--
-- 내용 (새 함수만. 기존 함수 · 표 · 데이터는 건드리지 않습니다)
--   _caller_kb_principal        내부: 호출자가 KB 원청 계정이면 원청 id
--   _mask_person_name           내부: 김철수 -> 김*수
--   _area_of_address            내부: 주소 -> 시·구·동까지
--   _partner_kb_task_json       내부: 작업 1건의 허용 칸
--   partner_kb_list_tasks       작업 목록
--   partner_kb_get_task         작업 상세 (+ 이 작업의 송금 줄)
--   partner_kb_list_remits      날짜별 송금 줄 + 이번 달 합계
--
-- 세 함수 모두: 세션 확인 + 계정의 원청 = KB + 작업의 원청 = KB + 협력사 작업만.
-- 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION _caller_kb_principal(p_actor uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT p.id
    FROM user_roles r
    JOIN principals p ON p.id = r.principal_id
    JOIN users u      ON u.id = r.user_id
   WHERE r.user_id = p_actor AND r.role = 'partner' AND p.code = 'KB'
     AND COALESCE(u.is_active, true)
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION _caller_kb_principal(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION _mask_person_name(p_name text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
           WHEN n IS NULL OR n = ''      THEN '고객'
           WHEN char_length(n) = 1       THEN n
           WHEN char_length(n) = 2       THEN left(n, 1) || '*'
           ELSE left(n, 1) || repeat('*', char_length(n) - 2) || right(n, 1)
         END
    FROM (SELECT btrim(COALESCE(p_name, '')) AS n) x;
$$;

-- 주소에서 시·구·동까지만. 숫자로 시작하는 조각(번지 · 동호수)은 쓰지 않고, 동/읍/면/리/가 를 만나면 멈춘다.
CREATE OR REPLACE FUNCTION _area_of_address(p_address text, p_district text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_parts text[] := regexp_split_to_array(btrim(COALESCE(p_address, '')), '\s+');
  v_out   text[] := ARRAY[]::text[];
  v_tok   text;
  i       int;
BEGIN
  FOR i IN 1 .. LEAST(COALESCE(array_length(v_parts, 1), 0), 4) LOOP
    v_tok := v_parts[i];
    CONTINUE WHEN v_tok IS NULL OR v_tok = '';
    EXIT WHEN v_tok ~ '[0-9]';                       -- 숫자가 든 조각부터는 상세 주소로 본다
    IF i = 1 OR v_tok ~ '(시|도|구|군|동|읍|면|리|가)$' THEN
      v_out := v_out || v_tok;
    ELSE
      EXIT;                                          -- 도로 이름 등
    END IF;
    EXIT WHEN i > 1 AND v_tok ~ '(동|읍|면|리|가)$';
  END LOOP;
  IF array_length(v_out, 1) IS NULL THEN
    RETURN COALESCE(NULLIF(btrim(COALESCE(p_district, '')), ''), '');
  END IF;
  RETURN array_to_string(v_out, ' ');
END;
$$;

-- 작업 1건의 허용 칸 (여기 없는 칸은 쿨가이 화면으로 내려가지 않는다)
CREATE OR REPLACE FUNCTION _partner_kb_task_json(p_task_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'id', t.id,
           'task_no', t.task_no,
           'customer', _mask_person_name(t.customer_name),
           'area', _area_of_address(t.address, t.district),
           'scheduled_at', t.scheduled_at,
           'completed_at', CASE WHEN t.status = '완료' THEN t.completed_at ELSE NULL END,
           'status', t.status,
           'performer', '올데이케어',
           'quote', t.sub_quote_supply,
           -- 수수료: 완료 전 = pending / 완료 + 원청 몫 있음 = done / 완료인데 없음 = checking / 취소·출장만 = none
           'fee_state', CASE
                          WHEN t.status IN ('취소', 'visit_only') THEN 'none'
                          WHEN t.status <> '완료' THEN 'pending'
                          WHEN COALESCE(sh.share, 0) > 0 THEN 'done'
                          ELSE 'checking'
                        END,
           'fee', CASE WHEN t.status = '완료' AND COALESCE(sh.share, 0) > 0 THEN sh.share ELSE NULL END,
           'workItems', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                       'serviceCode', COALESCE(st.code, ''),
                       'workType', COALESCE(wt.name, ''),
                       'appliance', COALESCE(ap.name, ''),
                       'qty', COALESCE(ti.qty, 1),
                       'isCanceled', COALESCE(ti.is_canceled, false)))
                FROM task_items ti
                LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
                LEFT JOIN service_types st   ON st.id = wt.service_type_id
                LEFT JOIN appliance_types ap ON ap.id = ti.appliance_type_id
               WHERE ti.task_id = t.id), '[]'::jsonb))
    FROM tasks t
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(p.sub_principal_share), 0)::int AS share
        FROM payments p WHERE p.task_id = t.id AND p.track = 'S'
    ) sh ON true
   WHERE t.id = p_task_id;
$$;
REVOKE ALL ON FUNCTION _partner_kb_task_json(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 작업 목록: 아직 끝나지 않은 것 전부 + 최근 120일
-- ============================================================
CREATE OR REPLACE FUNCTION partner_kb_list_tasks(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_pid uuid;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_pid := _caller_kb_principal(p_actor);
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 화면을 볼 수 있는 계정이 아닙니다.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'rows', COALESCE((
    SELECT jsonb_agg(_partner_kb_task_json(q.id) ORDER BY q.sort_at DESC NULLS LAST, q.task_no DESC)
      FROM (
        SELECT t.id, t.task_no, COALESCE(t.scheduled_at, t.completed_at, t.created_at) AS sort_at
          FROM tasks t
         WHERE t.principal_id = v_pid
           AND t.subcontractor_id IS NOT NULL
           AND (t.status NOT IN ('완료', '취소', 'visit_only')
                OR COALESCE(t.completed_at, t.scheduled_at, t.created_at) >= now() - interval '120 days')
         ORDER BY 3 DESC NULLS LAST
         LIMIT 400
      ) q), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION partner_kb_list_tasks(uuid, text) TO anon, authenticated;

-- ============================================================
-- 작업 상세 (+ 이 작업이 들어간 송금 줄)
-- ============================================================
CREATE OR REPLACE FUNCTION partner_kb_get_task(p_actor uuid, p_token text, p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_pid uuid;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_pid := _caller_kb_principal(p_actor);
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 화면을 볼 수 있는 계정이 아닙니다.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tasks t
                  WHERE t.id = p_task_id AND t.principal_id = v_pid AND t.subcontractor_id IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;

  RETURN jsonb_build_object('ok', true,
    'task', _partner_kb_task_json(p_task_id),
    'remits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'date', pr.settle_date, 'amount', pl.delta, 'paid_at', pr.paid_at) ORDER BY pr.settle_date)
        FROM principal_remit_lines pl
        JOIN principal_remits pr ON pr.id = pl.remit_id
       WHERE pl.task_id = p_task_id AND pr.principal_id = v_pid), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION partner_kb_get_task(uuid, text, uuid) TO anon, authenticated;

-- ============================================================
-- 날짜별 송금 줄 + 이번 달 합계
--   합계   = 이번 달에 완료된 작업의 쿨가이 수수료
--   받은 금액 = 그 작업들 가운데 [송금 완료] 된 줄의 금액
-- ============================================================
CREATE OR REPLACE FUNCTION partner_kb_list_remits(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_pid   uuid;
  v_from  timestamptz := date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
  v_to    timestamptz := (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') + interval '1 month') AT TIME ZONE 'Asia/Seoul';
  v_total int;
  v_recv  int;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_pid := _caller_kb_principal(p_actor);
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 화면을 볼 수 있는 계정이 아닙니다.');
  END IF;

  SELECT COALESCE(SUM(p.sub_principal_share), 0)::int INTO v_total
    FROM tasks t JOIN payments p ON p.task_id = t.id AND p.track = 'S'
   WHERE t.principal_id = v_pid AND t.subcontractor_id IS NOT NULL
     AND t.status = '완료' AND t.completed_at >= v_from AND t.completed_at < v_to;

  SELECT COALESCE(SUM(pl.delta), 0)::int INTO v_recv
    FROM principal_remit_lines pl
    JOIN principal_remits pr ON pr.id = pl.remit_id
    JOIN tasks t             ON t.id = pl.task_id
   WHERE pr.principal_id = v_pid AND pr.paid_at IS NOT NULL
     AND t.principal_id = v_pid AND t.subcontractor_id IS NOT NULL
     AND t.status = '완료' AND t.completed_at >= v_from AND t.completed_at < v_to;

  RETURN jsonb_build_object('ok', true,
    'month', jsonb_build_object(
      'label', to_char(now() AT TIME ZONE 'Asia/Seoul', 'FMMM') || '월',
      'total', v_total, 'received', v_recv, 'remaining', v_total - v_recv),
    'rows', COALESCE((
      SELECT jsonb_agg(q.j ORDER BY q.settle_date DESC)
        FROM (
          SELECT pr.settle_date,
                 jsonb_build_object(
                   'id', pr.id, 'date', pr.settle_date, 'amount', pr.amount, 'carried_in', pr.carried_in,
                   'paid_at', pr.paid_at,
                   'task_count', (SELECT COUNT(DISTINCT pl.task_id)::int FROM principal_remit_lines pl WHERE pl.remit_id = pr.id),
                   'lines', COALESCE((
                      SELECT jsonb_agg(jsonb_build_object('task_id', t.id, 'task_no', t.task_no, 'amount', pl.delta)
                                       ORDER BY t.task_no)
                        FROM principal_remit_lines pl JOIN tasks t ON t.id = pl.task_id
                       WHERE pl.remit_id = pr.id), '[]'::jsonb)) AS j
            FROM principal_remits pr
           WHERE pr.principal_id = v_pid
             AND pr.absorbed_into IS NULL
             AND (pr.paid_at IS NOT NULL OR pr.amount > 0)
             AND (pr.settle_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 180 OR pr.paid_at IS NULL)
        ) q), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION partner_kb_list_remits(uuid, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 - 기대: 7행
SELECT proname FROM pg_proc
 WHERE proname IN ('_caller_kb_principal', '_mask_person_name', '_area_of_address', '_partner_kb_task_json',
                   'partner_kb_list_tasks', 'partner_kb_get_task', 'partner_kb_list_remits')
 ORDER BY 1;

-- 2) 가림 · 지역 - 기대: 김*수 / 김* / 서울 강남구 역삼동 / 서울 강남구 / 경기 화성시 동탄구 반송동
SELECT _mask_person_name('김철수')                                   AS n1,
       _mask_person_name('김수')                                     AS n2,
       _area_of_address('서울 강남구 역삼동 123-4 101동 202호')      AS a1,
       _area_of_address('서울 강남구 테헤란로 123')                  AS a2,
       _area_of_address('경기 화성시 동탄구 반송동 77')              AS a3;

-- 3) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT partner_kb_list_tasks('00000000-0000-0000-0000-000000000000'::uuid, NULL);
