-- ============================================================================
-- Migration 255 - 쿨가이(KB) 전용 화면 수정판: 주방후드 전체 · 고객 정보 전부 · 접수 취소 · 푸시 문구
-- 작성 2026-10-07 · 선행: 203, 244, 245, 254
--
-- 사장님 결정 (2026-10-07, 블록 51)
--   · 쿨가이에게 작업은 "올데이케어가 하는 것". 협력사 이름 · 기사 이름은 보이지 않는다.
--   · 고객 정보는 전부 보인다 (이름 · 전화 · 주소 - 쿨가이 고객이므로). mig 254 의 가림 규칙은 쓰지 않는다.
--   · 보이는 작업 = 원청 KB + 종목 주방후드 전체 (협력사로 넘긴 것 + 직영 + 아직 미배정).
--   · 금액은 견적 · 쿨가이 수수료만. 받은 금액 · 실제 공급가 · 다른 몫은 내려가지 않는다 (그대로).
--   · 직영 주방후드의 쿨가이 수수료 규칙은 아직 정하지 않았다 -> 완료돼도 "확인 중".
--   · 이번 달 "받은 금액" = 송금일 기준 (이번 달에 송금 완료된 줄의 합). 합계는 완료일 기준 그대로.
--   · 쿨가이가 접수한 작업은 배정 전까지만 쿨가이가 취소할 수 있다.
--   · 쿨가이에게 가는 "작업이 배정되었습니다" 푸시에서 기사 이름을 뺀다.
--
-- 내용
--   [1] _partner_kb_hood_category / _partner_kb_task_json   허용 칸 다시 정의
--   [2] partner_kb_list_tasks / partner_kb_get_task / partner_kb_list_remits   범위 · 합계 기준 변경
--   [3] partner_kb_cancel_task   배정 전 접수 취소 (조건 확인 뒤 기존 partner_full_cancel 로 넘김)
--   [4] notify_lifecycle_push    (원문 mig 203 에서 자동 생성. 끼운 조각을 빼면 원문과 글자까지 같음을 검사했습니다)
--                                원청이 KB 일 때만 "배정" 푸시 본문에서 기사 이름을 뺀다. 다른 원청 · 운영자 · 기사 푸시는 그대로.
--   접수 자체는 기존 원청 접수와 같은 길(화면 -> 작업 저장)을 쓴다. 새 접수 함수는 없다.
--
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 허용 칸
-- ============================================================
CREATE OR REPLACE FUNCTION _partner_kb_hood_category()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT id FROM categories WHERE code = 'hood' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION _partner_kb_hood_category() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION _partner_kb_task_json(p_task_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'id', t.id,
           'task_no', t.task_no,
           'customer', COALESCE(NULLIF(btrim(t.customer_name), ''), '고객'),
           'phone', t.phone,
           'address', t.address,
           'scheduled_at', t.scheduled_at,
           'received_at', t.received_at,
           'completed_at', CASE WHEN t.status = '완료' THEN t.completed_at ELSE NULL END,
           'status', t.status,
           'performer', '올데이케어',
           -- 견적: 협력사로 넘긴 작업은 보관 견적(공급가), 그 밖에는 접수 견적. 0 이면 "견적 미정"
           'quote', CASE WHEN t.subcontractor_id IS NOT NULL THEN t.sub_quote_supply
                         ELSE NULLIF(COALESCE(t.product_price, 0), 0) END,
           -- 수수료: 완료 전 = pending / 완료 + 원청 몫 있음 = done / 완료인데 없음 = checking / 취소·출장만 = none
           'fee_state', CASE
                          WHEN t.status IN ('취소', 'visit_only') THEN 'none'
                          WHEN t.status <> '완료' THEN 'pending'
                          WHEN COALESCE(sh.share, 0) > 0 THEN 'done'
                          ELSE 'checking'
                        END,
           'fee', CASE WHEN t.status = '완료' AND COALESCE(sh.share, 0) > 0 THEN sh.share ELSE NULL END,
           -- 쿨가이가 직접 취소할 수 있는가: 아직 아무에게도 배정되지 않은 접수만
           'can_cancel', (t.status = '미배정' AND t.assigned_engineer_id IS NULL AND t.subcontractor_id IS NULL),
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
-- [2] 목록 / 상세 / 송금 줄
-- ============================================================
CREATE OR REPLACE FUNCTION partner_kb_list_tasks(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_pid  uuid;
  v_hood uuid := _partner_kb_hood_category();
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
        SELECT t.id, t.task_no, COALESCE(t.scheduled_at, t.completed_at, t.received_at, t.created_at) AS sort_at
          FROM tasks t
         WHERE t.principal_id = v_pid
           AND t.category_id = v_hood
           AND (t.status NOT IN ('완료', '취소', 'visit_only')
                OR COALESCE(t.completed_at, t.scheduled_at, t.received_at, t.created_at) >= now() - interval '120 days')
         ORDER BY 3 DESC NULLS LAST
         LIMIT 400
      ) q), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION partner_kb_list_tasks(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION partner_kb_get_task(p_actor uuid, p_token text, p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_pid  uuid;
  v_hood uuid := _partner_kb_hood_category();
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_pid := _caller_kb_principal(p_actor);
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 화면을 볼 수 있는 계정이 아닙니다.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tasks t
                  WHERE t.id = p_task_id AND t.principal_id = v_pid AND t.category_id = v_hood) THEN
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

-- 합계(수수료) = 이번 달에 완료된 작업의 쿨가이 수수료 (완료일 기준)
-- 받은 금액    = 이번 달에 [송금 완료] 된 줄의 합 (송금일 기준)
CREATE OR REPLACE FUNCTION partner_kb_list_remits(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_pid   uuid;
  v_hood  uuid := _partner_kb_hood_category();
  v_from  timestamptz := date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
  v_to    timestamptz := (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') + interval '1 month') AT TIME ZONE 'Asia/Seoul';
  v_total int;
  v_recv  int;
  v_wait  int;
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
   WHERE t.principal_id = v_pid AND t.category_id = v_hood
     AND t.status = '완료' AND t.completed_at >= v_from AND t.completed_at < v_to;

  SELECT COALESCE(SUM(pr.amount), 0)::int INTO v_recv
    FROM principal_remits pr
   WHERE pr.principal_id = v_pid AND pr.paid_at >= v_from AND pr.paid_at < v_to;

  -- 송금 예정 = 줄은 생겼고 아직 송금 완료가 아닌 금액 (달과 무관)
  SELECT COALESCE(SUM(pr.amount), 0)::int INTO v_wait
    FROM principal_remits pr
   WHERE pr.principal_id = v_pid AND pr.paid_at IS NULL AND pr.absorbed_into IS NULL AND pr.amount > 0;

  RETURN jsonb_build_object('ok', true,
    'month', jsonb_build_object(
      'label', to_char(now() AT TIME ZONE 'Asia/Seoul', 'FMMM') || '월',
      'total', v_total, 'received', v_recv, 'waiting', v_wait),
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

-- ============================================================
-- [3] 접수 취소 - 배정 전까지만
-- ============================================================
CREATE OR REPLACE FUNCTION partner_kb_cancel_task(p_actor uuid, p_token text, p_task_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pid    uuid;
  v_hood   uuid := _partner_kb_hood_category();
  v_task   tasks%ROWTYPE;
  v_reason text := LEFT(btrim(COALESCE(p_reason, '')), 300);
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_pid := _caller_kb_principal(p_actor);
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 화면을 볼 수 있는 계정이 아닙니다.');
  END IF;
  IF v_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '취소 사유를 입력해 주세요.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.principal_id IS DISTINCT FROM v_pid OR v_task.category_id IS DISTINCT FROM v_hood THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.status = '취소' THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 취소된 작업입니다.');
  END IF;
  IF v_task.status <> '미배정' OR v_task.assigned_engineer_id IS NOT NULL OR v_task.subcontractor_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 배정된 작업입니다. 취소는 올데이케어에 연락해 주세요.');
  END IF;

  RETURN partner_full_cancel(p_task_id, v_reason, p_actor);
END;
$$;
GRANT EXECUTE ON FUNCTION partner_kb_cancel_task(uuid, text, uuid, text) TO anon, authenticated;

-- ============================================================
-- [4] 푸시: 원청이 KB 일 때 "배정" 알림 본문에서 기사 이름을 뺀다 (원문 mig 203 + 조각 1곳)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_lifecycle_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  push_url       TEXT := 'https://ollit.vercel.app/api/push/send';
  api_key        TEXT;
  task_body      TEXT;
  cat            JSONB := COALESCE(NEW.category_data, '{}'::jsonb);
  work_type      TEXT  := COALESCE(cat->>'workType', '작업');
  customer       TEXT  := COALESCE(NEW.customer_name, '고객');
  district       TEXT  := COALESCE(NEW.district, '지역?');
  appliance      TEXT  := COALESCE(cat->>'appliance', '');
  qty            INT   := COALESCE((cat->>'qty')::int, 1);
  detail_suffix  TEXT  := CASE WHEN COALESCE(cat->>'appliance', '') != ''
                           THEN ' · ' || COALESCE(cat->>'appliance', '') || ' ×' || COALESCE((cat->>'qty')::int, 1)::text
                           ELSE '' END;
  cur_eng_code   TEXT;
  cur_eng_name   TEXT;
  old_eng_code   TEXT;
  cancel_reason  TEXT;
  is_refrigerant BOOLEAN;
  base_info      TEXT;
  body_assigned  TEXT;
  body_closed    TEXT;
  other_cand     TEXT;
  v_p_user       uuid;
  v_partner_body TEXT;
  -- 2026-06-19 Mig 145 — 시8 OLD 푸시 spec 본문용 (OLD 우선, NEW fallback)
  reassign_at    TIMESTAMPTZ;
  reassign_when  TEXT;
BEGIN
  SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name = 'PUSH_API_KEY' LIMIT 1;
  IF api_key IS NULL OR api_key = '' THEN
    RAISE NOTICE '[lifecycle push] PUSH_API_KEY not configured — skipping';
    RETURN NEW;
  END IF;

  IF NEW.assigned_engineer_id IS NOT NULL THEN
    SELECT code, name INTO cur_eng_code, cur_eng_name FROM users WHERE id = NEW.assigned_engineer_id;
  END IF;
  IF OLD.assigned_engineer_id IS NOT NULL THEN
    SELECT code INTO old_eng_code FROM users WHERE id = OLD.assigned_engineer_id;
  END IF;

  -- 시나리오 3 — 일정 확정
  IF NEW.scheduled_confirmed_at IS NOT NULL AND OLD.scheduled_confirmed_at IS NULL THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object('targetType','role','targetId','admin','title','📅 일정 확정','body',task_body,'url','/','tag','scheduled-' || NEW.id::text,'taskId', NEW.id::text)
    );
    v_partner_body := task_body;
    FOR v_p_user IN SELECT DISTINCT user_id FROM user_roles WHERE role = 'partner' AND principal_id = NEW.principal_id AND user_id IS NOT NULL LOOP
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object('targetType','user','targetId', v_p_user::text,'title','📅 일정 확정','body', v_partner_body,'url','/','tag','scheduled-partner-' || NEW.id::text || '-' || v_p_user::text,'taskId', NEW.id::text,'kind','partnerSchedule')
      );
    END LOOP;
  END IF;

  -- 시나리오 4 — 작업 시작 (admin)
  IF NEW.started_at IS NOT NULL AND OLD.started_at IS NULL THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object('targetType','role','targetId','admin','title','▶️ 작업 시작','body',task_body,'url','/','tag','started-' || NEW.id::text,'taskId', NEW.id::text)
    );
  END IF;

  -- 시나리오 5 — 작업 완료
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object('targetType','role','targetId','admin','title','✅ 작업 완료','body',task_body,'url','/','tag','completed-' || NEW.id::text,'taskId', NEW.id::text)
    );
    v_partner_body := task_body;
    FOR v_p_user IN SELECT DISTINCT user_id FROM user_roles WHERE role = 'partner' AND principal_id = NEW.principal_id AND user_id IS NOT NULL LOOP
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object('targetType','user','targetId', v_p_user::text,'title','✅ 작업이 완료되었습니다','body', v_partner_body,'url','/','tag','completed-partner-' || NEW.id::text || '-' || v_p_user::text,'taskId', NEW.id::text,'kind','partnerComplete')
      );
    END LOOP;
  END IF;

  -- 시나리오 6 — 일정 변경 (admin/engineer)
  -- 2026-06-19 Mig 145 — 재배정 시 시8 과 중복 발화 차단:
  --   AND NEW.assigned_engineer_id IS NOT DISTINCT FROM OLD.assigned_engineer_id
  --   순수 시간 변경(admin_reschedule_task)만 시6 진입. 재배정은 시8 만.
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     AND NEW.scheduled_at IS NOT NULL
     AND OLD.scheduled_confirmed_at IS NOT NULL
     AND NEW.scheduled_confirmed_at = OLD.scheduled_confirmed_at
     AND NEW.assigned_engineer_id IS NOT DISTINCT FROM OLD.assigned_engineer_id THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix || ' · ' || COALESCE(NEW.scheduled_at::text, '');
    IF cur_eng_code IS NOT NULL THEN
      PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object('targetType','engineer','targetId',cur_eng_code,'title','🔄 일정 변경','body',task_body,'url','/','tag','sched-change-' || NEW.id::text,'taskId', NEW.id::text));
    END IF;
    PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object('targetType','role','targetId','admin','title','🔄 일정 변경','body',task_body,'url','/','tag','sched-change-admin-' || NEW.id::text,'taskId', NEW.id::text));
  END IF;

  -- 시나리오 7 — 작업 취소
  IF NEW.status = '취소' AND OLD.status IS DISTINCT FROM '취소' THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
    IF cur_eng_code IS NOT NULL THEN
      PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object('targetType','engineer','targetId',cur_eng_code,'title','❌ 작업 취소','body',task_body,'url','/','tag','cancel-' || NEW.id::text,'taskId', NEW.id::text));
    END IF;
    PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object('targetType','role','targetId','admin','title','❌ 작업 취소','body',task_body,'url','/','tag','cancel-admin-' || NEW.id::text,'taskId', NEW.id::text));
    v_partner_body := task_body;
    FOR v_p_user IN SELECT DISTINCT user_id FROM user_roles WHERE role = 'partner' AND principal_id = NEW.principal_id AND user_id IS NOT NULL LOOP
      PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object('targetType','user','targetId', v_p_user::text,'title','❌ 작업이 취소되었습니다','body', v_partner_body,'url','/','tag','cancel-partner-' || NEW.id::text || '-' || v_p_user::text,'taskId', NEW.id::text,'kind','partnerCancel'));
    END LOOP;
  END IF;

  -- 시나리오 8 — 재배정 (admin/engineer)
  -- 2026-06-19 Mig 145 — OLD 기사 푸시 텍스트만 사장님 spec 으로 정정. NEW/운영자 그대로.
  IF NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id AND OLD.assigned_engineer_id IS NOT NULL AND NEW.assigned_engineer_id IS NOT NULL THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;

    -- (A) NEW 기사 — 그대로
    IF cur_eng_code IS NOT NULL THEN
      PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object('targetType','engineer','targetId',cur_eng_code,'title','🔄 새 작업 배정 (재배정)','body',task_body,'url','/','tag','reassign-new-' || NEW.id::text,'taskId', NEW.id::text));
    END IF;

    -- (B) OLD 기사 — 사장님 spec (Mig 145 정정).
    --   제목: 📅 일정 조정 안내
    --   본문: [올잇] {MM/DD HH:MM} {고객명} 작업이 일정 조정으로 다른 기사에게
    --         재배정되었습니다. 해당 일정은 진행하지 않으셔도 됩니다.
    --   시각: OLD.scheduled_at 우선, NULL 이면 NEW.scheduled_at fallback.
    IF old_eng_code IS NOT NULL THEN
      reassign_at := COALESCE(OLD.scheduled_at, NEW.scheduled_at);
      IF reassign_at IS NOT NULL THEN
        reassign_when := to_char(reassign_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI');
      ELSE
        reassign_when := '일정 미정';
      END IF;
      PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',old_eng_code,
          'title','📅 일정 조정 안내',
          'body', '[올잇] ' || reassign_when || ' ' || customer
                   || ' 작업이 일정 조정으로 다른 기사에게 재배정되었습니다. '
                   || '해당 일정은 진행하지 않으셔도 됩니다.',
          'url','/','tag','reassign-old-' || NEW.id::text,
          'taskId', NEW.id::text
        ));
    END IF;

    -- (C) 운영자 — 그대로
    PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object('targetType','role','targetId','admin','title','🔄 프로 재배정','body',task_body,'url','/','tag','reassign-admin-' || NEW.id::text,'taskId', NEW.id::text));
  END IF;

  -- 시나리오 9 — 기사 수락 (첫 배정)
  IF NEW.status = '배정' AND OLD.status IS DISTINCT FROM '배정' AND OLD.assigned_engineer_id IS NULL AND NEW.assigned_engineer_id IS NOT NULL THEN
    task_body := COALESCE(cur_eng_name, cur_eng_code, '기사') || ' · ' || customer || ' · ' || work_type || detail_suffix;
    PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object('targetType','role','targetId','admin','title','🙋 기사 수락','body',task_body,'url','/','tag','accept-' || NEW.id::text,'taskId', NEW.id::text));
    v_partner_body := task_body;
    -- Mig 255: 원청이 KB 면 기사 이름을 뺀다 (수행은 올데이케어로만 보인다)
    IF EXISTS (SELECT 1 FROM principals kp WHERE kp.id = NEW.principal_id AND kp.code = 'KB') THEN
      v_partner_body := customer || ' · ' || work_type || detail_suffix;
    END IF;
    FOR v_p_user IN SELECT DISTINCT user_id FROM user_roles WHERE role = 'partner' AND principal_id = NEW.principal_id AND user_id IS NOT NULL LOOP
      PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object('targetType','user','targetId', v_p_user::text,'title','🎯 작업이 배정되었습니다','body', v_partner_body,'url','/','tag','assign-partner-' || NEW.id::text || '-' || v_p_user::text,'taskId', NEW.id::text,'kind','partnerAssign'));
    END LOOP;
    is_refrigerant := (work_type LIKE '%냉매%');
    -- [Mig 203] 냉매 게이트 제거 — 세척 등 비냉매도 배정 기사에게 푸시.
    IF cur_eng_code IS NOT NULL THEN
      base_info     := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
      body_assigned := base_info || E'\n본인 작업으로 확정되었습니다';
      body_closed   := base_info || E'\n다른 기사님이 먼저 수락하셨습니다';
      PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object('targetType','engineer','targetId',cur_eng_code,'title',(CASE WHEN is_refrigerant THEN '📥 냉매 작업 배정 완료' ELSE '📥 작업 배정 완료' END),'body',body_assigned,'url','/','tag',(CASE WHEN is_refrigerant THEN 'refrig-accepted-' ELSE 'assigned-' END) || NEW.id::text,'taskId', NEW.id::text));
      IF NEW.push_candidates IS NOT NULL THEN
        FOR other_cand IN SELECT jsonb_array_elements_text(NEW.push_candidates) LOOP
          IF other_cand IS NULL OR other_cand = '' THEN CONTINUE; END IF;
          IF other_cand = cur_eng_code THEN CONTINUE; END IF;
          PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
            body := jsonb_build_object('targetType','engineer','targetId',other_cand,'title',(CASE WHEN is_refrigerant THEN '❌ 냉매 수락 마감' ELSE '❌ 작업 수락 마감' END),'body',body_closed,'url','/','tag',(CASE WHEN is_refrigerant THEN 'refrig-closed-' ELSE 'closed-' END) || NEW.id::text,'taskId', NEW.id::text));
        END LOOP;
      END IF;
    END IF;
  END IF;

  -- 시나리오 10 — 취소 요청 (admin)
  IF NEW.status = '취소요청' AND OLD.status IS DISTINCT FROM '취소요청' THEN
    cancel_reason := COALESCE(cat->>'cancelReason', '사유 없음');
    task_body := COALESCE(cur_eng_name, cur_eng_code, '기사') || ' · ' || customer || ' · ' || cancel_reason;
    PERFORM net.http_post(url := push_url, headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object('targetType','role','targetId','admin','title','🚨 취소 요청','body',task_body,'url','/','tag','cancel-request-' || NEW.id::text,'taskId', NEW.id::text));
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 - 기대: 7행
SELECT proname FROM pg_proc
 WHERE proname IN ('_partner_kb_hood_category', '_partner_kb_task_json', 'partner_kb_list_tasks', 'partner_kb_get_task',
                   'partner_kb_list_remits', 'partner_kb_cancel_task', 'notify_lifecycle_push')
 ORDER BY 1;

-- 2) 주방후드 종목이 있는가 - 기대: 1행 (id 값)
SELECT _partner_kb_hood_category() AS hood_category_id;

-- 3) 푸시 함수에 조각이 들어갔는가 - 기대: true
SELECT prosrc LIKE '%Mig 255%' AS has_255 FROM pg_proc WHERE proname = 'notify_lifecycle_push';

-- 4) 세션 없이 호출 - 기대: "다시 로그인해 주세요." 2번
SELECT partner_kb_list_tasks('00000000-0000-0000-0000-000000000000'::uuid, NULL);
SELECT partner_kb_cancel_task('00000000-0000-0000-0000-000000000000'::uuid, NULL, '00000000-0000-0000-0000-000000000000'::uuid, '시험');
