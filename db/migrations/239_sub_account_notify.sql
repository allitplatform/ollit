-- ============================================================================
-- Migration 239 - 협력사 관리자 "내 정보": 회사 계좌 · 알림 설정 · 푸시 연결
-- 작성 2026-10-06 · 선행: 212, 214, 220, 225, 234
--
-- 내용
--   [1] 협력사 회사 계좌 (subcontractors 에 칸 3개 + 변경·열람 기록 표)
--       sub_get_company_account   소속 기사·관리자(자기 협력사) / 운영자(지정한 협력사)
--                                 계좌번호는 가려서 주고, p_reveal = true 면 전체 + 열람 기록
--                                 함께 "올데이케어로 보낼 곳"(운영자가 설정한 회사 계좌)도 돌려줌 - 협력사는 수정 불가
--       sub_set_company_account   협력사 관리자만. 이전 값 · 바꾼 사람 · 시각을 기록
--   [2] 알림 설정 (subcontractor_notify_prefs)
--       sub_get_notify_prefs / sub_set_notify_prefs   협력사 관리자 본인 것만
--   [3] 푸시 연결
--       a. 새 작업 들어옴   - 기존 트리거(mig 220)에 "설정이 켜진 관리자만" 조건과 짧은 문구
--                             (저장소의 mig 220 본문에서 자동으로 만들었고, 바꾼 조각을 되돌리면 220 과 같습니다)
--       b. 기사 [보냄] 보고 - sub_staff_report_remit 을 _impl_ 로 보존하고 감싸서, 보고가 끝나면 관리자에게 푸시
--       d. 오늘 보낼 수수료 - sub_send_fee_reminders() : 정해 둔 시각이 지난 관리자에게 하루 한 번
--                             pg_cron 이 켜져 있으면 10분마다 돌도록 등록합니다. 꺼져 있으면 등록하지 않고 알려 줍니다.
--       c(취소·일정 변경) · e(작업 완료) 는 설정만 저장하고 발송은 아직 연결하지 않았습니다.
--
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 협력사 회사 계좌
-- ============================================================
ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS bank_name      text,
  ADD COLUMN IF NOT EXISTS bank_account   text,
  ADD COLUMN IF NOT EXISTS account_holder text;

CREATE TABLE IF NOT EXISTS subcontractor_account_changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id),
  action           text NOT NULL,             -- update / view
  before_data      jsonb,
  after_data       jsonb,
  actor_id         uuid REFERENCES users(id),
  actor_name       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sub_account_changes_by_sub ON subcontractor_account_changes (subcontractor_id, created_at DESC);
ALTER TABLE subcontractor_account_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_account_changes FROM anon, authenticated;

-- 계좌번호 가리기: 앞 3 · 뒤 4자리만
CREATE OR REPLACE FUNCTION _mask_account(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN btrim(COALESCE(p, '')) = '' THEN NULL
    WHEN length(regexp_replace(p, '[^0-9]', '', 'g')) <= 7 THEN repeat('*', GREATEST(length(regexp_replace(p, '[^0-9]', '', 'g')), 4))
    ELSE left(regexp_replace(p, '[^0-9]', '', 'g'), 3)
         || repeat('*', length(regexp_replace(p, '[^0-9]', '', 'g')) - 7)
         || right(regexp_replace(p, '[^0-9]', '', 'g'), 4)
  END;
$$;

CREATE OR REPLACE FUNCTION sub_get_company_account(
  p_actor uuid, p_token text, p_reveal boolean DEFAULT false, p_subcontractor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub   uuid;
  v_role  text;
  v_s     subcontractors%ROWTYPE;
  v_hq    jsonb;
  v_num   text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF p_subcontractor_id IS NOT NULL AND _caller_is_admin(p_actor) THEN
    v_sub := p_subcontractor_id; v_role := 'admin';
  ELSE
    SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  END IF;
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 소속만 사용할 수 있습니다.');
  END IF;
  SELECT * INTO v_s FROM subcontractors WHERE id = v_sub;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사를 찾지 못했습니다.');
  END IF;

  v_num := btrim(COALESCE(v_s.bank_account, ''));
  IF COALESCE(p_reveal, false) AND v_num <> '' THEN
    -- 열람 기록을 먼저 남긴다 (남기지 못하면 번호도 주지 않는다)
    INSERT INTO subcontractor_account_changes (subcontractor_id, action, actor_id, actor_name)
    VALUES (v_sub, 'view', p_actor, (SELECT name FROM users WHERE id = p_actor));
  END IF;

  -- 올데이케어로 보낼 곳: 운영자가 설정한 회사 계좌 (tenants.settings.company_account). 협력사는 보기만.
  SELECT t.settings -> 'company_account' INTO v_hq FROM tenants t WHERE t.id = v_s.tenant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'can_edit', v_role = 'manager',
    'name', v_s.name,
    'account', CASE WHEN v_num = '' THEN NULL ELSE jsonb_build_object(
        'bank', NULLIF(btrim(COALESCE(v_s.bank_name, '')), ''),
        'holder', NULLIF(btrim(COALESCE(v_s.account_holder, '')), ''),
        'number_masked', _mask_account(v_num),
        'number', CASE WHEN COALESCE(p_reveal, false) THEN v_num END) END,
    'hq_account', CASE WHEN v_hq IS NULL OR btrim(COALESCE(v_hq ->> 'accountNumber', '')) = '' THEN NULL ELSE jsonb_build_object(
        'bank', v_hq ->> 'bankName', 'number', v_hq ->> 'accountNumber', 'holder', v_hq ->> 'accountHolder') END,
    'changes', CASE WHEN v_role IN ('manager', 'admin') THEN COALESCE((
        SELECT jsonb_agg(x ORDER BY (x ->> 'created_at') DESC) FROM (
          SELECT jsonb_build_object('action', c.action, 'actor', c.actor_name, 'created_at', c.created_at) AS x
            FROM subcontractor_account_changes c WHERE c.subcontractor_id = v_sub
           ORDER BY c.created_at DESC LIMIT 10) q), '[]'::jsonb) ELSE '[]'::jsonb END);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_get_company_account(uuid, text, boolean, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sub_set_company_account(
  p_actor uuid, p_token text, p_bank text, p_account text, p_holder text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_s      subcontractors%ROWTYPE;
  v_bank   text := NULLIF(LEFT(btrim(COALESCE(p_bank, '')), 40), '');
  v_num    text := NULLIF(LEFT(btrim(COALESCE(p_account, '')), 40), '');
  v_holder text := NULLIF(LEFT(btrim(COALESCE(p_holder, '')), 40), '');
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 바꿀 수 있습니다.');
  END IF;
  IF v_bank IS NULL OR v_num IS NULL OR v_holder IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '은행 · 계좌번호 · 예금주를 모두 입력해 주세요.');
  END IF;
  IF length(regexp_replace(v_num, '[^0-9]', '', 'g')) < 8 OR v_num !~ '^[0-9 -]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', '계좌번호를 확인해 주세요 (숫자와 - 만).');
  END IF;

  SELECT * INTO v_s FROM subcontractors WHERE id = v_sub FOR UPDATE;
  UPDATE subcontractors SET bank_name = v_bank, bank_account = v_num, account_holder = v_holder WHERE id = v_sub;

  INSERT INTO subcontractor_account_changes (subcontractor_id, action, before_data, after_data, actor_id, actor_name)
  VALUES (v_sub, 'update',
          jsonb_build_object('bank', v_s.bank_name, 'number', v_s.bank_account, 'holder', v_s.account_holder),
          jsonb_build_object('bank', v_bank, 'number', v_num, 'holder', v_holder),
          p_actor, (SELECT name FROM users WHERE id = p_actor));

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_set_company_account(uuid, text, text, text, text) TO anon, authenticated;

-- ============================================================
-- [2] 알림 설정 (협력사 관리자별)
-- ============================================================
CREATE TABLE IF NOT EXISTS subcontractor_notify_prefs (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_task           boolean NOT NULL DEFAULT true,    -- a. 새 작업 들어옴
  staff_remit        boolean NOT NULL DEFAULT true,    -- b. 기사가 [보냄] 보고
  cancel_change      boolean NOT NULL DEFAULT true,    -- c. 작업 취소 · 일정 변경 (발송은 아직 연결 전)
  fee_reminder       boolean NOT NULL DEFAULT true,    -- d. 오늘 보낼 수수료
  fee_reminder_time  time    NOT NULL DEFAULT '20:00',
  task_done          boolean NOT NULL DEFAULT false,   -- e. 기사 작업 완료 (발송은 아직 연결 전)
  fee_reminded_on    date,                             -- 오늘 이미 보냈는지
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subcontractor_notify_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_notify_prefs FROM anon, authenticated;

-- 내부: 그 관리자가 그 종류의 알림을 받는지 (설정 줄이 없으면 기본값)
CREATE OR REPLACE FUNCTION _sub_notify_on(p_user uuid, p_kind text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE p_kind
             WHEN 'new_task'      THEN p.new_task
             WHEN 'staff_remit'   THEN p.staff_remit
             WHEN 'cancel_change' THEN p.cancel_change
             WHEN 'fee_reminder'  THEN p.fee_reminder
             WHEN 'task_done'     THEN p.task_done
           END
      FROM subcontractor_notify_prefs p WHERE p.user_id = p_user),
    p_kind <> 'task_done');
$$;
REVOKE ALL ON FUNCTION _sub_notify_on(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sub_get_notify_prefs(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_p    subcontractor_notify_prefs%ROWTYPE;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  SELECT * INTO v_p FROM subcontractor_notify_prefs WHERE user_id = p_actor;
  RETURN jsonb_build_object('ok', true, 'prefs', jsonb_build_object(
    'new_task',          COALESCE(v_p.new_task, true),
    'staff_remit',       COALESCE(v_p.staff_remit, true),
    'cancel_change',     COALESCE(v_p.cancel_change, true),
    'fee_reminder',      COALESCE(v_p.fee_reminder, true),
    'fee_reminder_time', to_char(COALESCE(v_p.fee_reminder_time, TIME '20:00'), 'HH24:MI'),
    'task_done',         COALESCE(v_p.task_done, false)));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_get_notify_prefs(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION sub_set_notify_prefs(p_actor uuid, p_token text, p_prefs jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_time time;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  BEGIN
    v_time := COALESCE(NULLIF(p_prefs ->> 'fee_reminder_time', '')::time, TIME '20:00');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', '알림 시각을 확인해 주세요.');
  END;

  INSERT INTO subcontractor_notify_prefs
    (user_id, new_task, staff_remit, cancel_change, fee_reminder, fee_reminder_time, task_done, updated_at)
  VALUES (p_actor,
          COALESCE((p_prefs ->> 'new_task')::boolean, true),
          COALESCE((p_prefs ->> 'staff_remit')::boolean, true),
          COALESCE((p_prefs ->> 'cancel_change')::boolean, true),
          COALESCE((p_prefs ->> 'fee_reminder')::boolean, true),
          v_time,
          COALESCE((p_prefs ->> 'task_done')::boolean, false),
          now())
  ON CONFLICT (user_id) DO UPDATE
    SET new_task = EXCLUDED.new_task, staff_remit = EXCLUDED.staff_remit, cancel_change = EXCLUDED.cancel_change,
        fee_reminder = EXCLUDED.fee_reminder, task_done = EXCLUDED.task_done,
        -- 시각을 바꾸면 오늘 다시 받을 수 있게 표시를 지운다
        fee_reminded_on = CASE WHEN subcontractor_notify_prefs.fee_reminder_time IS DISTINCT FROM EXCLUDED.fee_reminder_time
                               THEN NULL ELSE subcontractor_notify_prefs.fee_reminded_on END,
        fee_reminder_time = EXCLUDED.fee_reminder_time,
        updated_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_set_notify_prefs(uuid, text, jsonb) TO anon, authenticated;

-- ============================================================
-- [3-a] 새 작업 푸시 - 설정이 켜진 관리자만 + 짧은 문구 (mig 220 의 트리거 함수)
-- ============================================================
CREATE OR REPLACE FUNCTION trg_tasks_notify_sub_managers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.subcontractor_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.subcontractor_id IS NOT DISTINCT FROM OLD.subcontractor_id THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('완료', '취소', 'visit_only') THEN
    RETURN NEW;
  END IF;

  BEGIN
    FOR r IN
      SELECT u.id FROM users u
       WHERE u.subcontractor_id = NEW.subcontractor_id
         AND u.sub_role = 'manager'
         AND u.is_active = true
         AND _sub_notify_on(u.id, 'new_task')      -- Mig 239: 알림 설정이 켜진 관리자만
    LOOP
      PERFORM _msg_push(jsonb_build_object(
        'targetType', 'user',
        'targetId',   r.id::text,
        'title',      '새 작업',
        'body',       btrim('새 작업 1건 · ' || COALESCE(NEW.district, '') || ' '
                      || COALESCE((SELECT c.name FROM categories c WHERE c.id = NEW.category_id), '')),
        'url',        '/',
        'tag',        'sub-new-task-' || NEW.id::text,
        'taskId',     NEW.id::text
      ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[sub push] 발송 실패 - 저장은 계속: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================
-- [3-b] 기사 [보냄] 보고 -> 관리자 푸시
-- ============================================================
DO $$
BEGIN
  IF to_regprocedure('_impl_sub_staff_report_remit(uuid, text, date)') IS NULL THEN
    ALTER FUNCTION sub_staff_report_remit(uuid, text, date) RENAME TO _impl_sub_staff_report_remit;
  END IF;
END $$;
REVOKE ALL ON FUNCTION _impl_sub_staff_report_remit(uuid, text, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sub_staff_report_remit(p_actor uuid, p_token text, p_date date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_res  jsonb;
  v_sub  uuid;
  v_name text;
  r      record;
BEGIN
  v_res := _impl_sub_staff_report_remit(p_actor, p_token, p_date);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) OR COALESCE((v_res ->> 'auto_received')::boolean, false) THEN
    RETURN v_res;                 -- 실패했거나, 관리자 본인 작업(자동 받음)이면 알리지 않는다
  END IF;

  BEGIN
    SELECT subcontractor_id, name INTO v_sub, v_name FROM users WHERE id = p_actor;
    FOR r IN
      SELECT u.id FROM users u
       WHERE u.subcontractor_id = v_sub AND u.sub_role = 'manager' AND u.is_active = true
         AND u.id <> p_actor AND _sub_notify_on(u.id, 'staff_remit')
    LOOP
      PERFORM _msg_push(jsonb_build_object(
        'targetType', 'user',
        'targetId',   r.id::text,
        'title',      '기사 송금 보고',
        'body',       COALESCE(v_name, '기사') || ' 님 송금 보고 ₩' || to_char(COALESCE((v_res ->> 'amount')::int, 0), 'FM999,999,999'),
        'url',        '/',
        'tag',        'sub-staff-remit-' || p_actor::text || '-' || p_date::text
      ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[sub push] 송금 보고 알림 실패 - 보고는 그대로: %', SQLERRM;
  END;

  RETURN v_res;
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_report_remit(uuid, text, date) TO anon, authenticated;

-- ============================================================
-- [3-d] 오늘 보낼 수수료 알림 - 정해 둔 시각이 지난 관리자에게 하루 한 번
--   오늘 날짜에 보낼 수수료(열린 날짜, 0 보다 큼)가 있을 때만 보냅니다.
-- ============================================================
CREATE OR REPLACE FUNCTION sub_send_fee_reminders()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_now   timestamp := now() AT TIME ZONE 'Asia/Seoul';
  v_today date := v_now::date;
  v_fee   int;
  v_sent  int := 0;
  r       record;
BEGIN
  FOR r IN
    SELECT u.id, u.subcontractor_id
      FROM users u
      JOIN subcontractors s ON s.id = u.subcontractor_id AND s.active = true
      LEFT JOIN subcontractor_notify_prefs p ON p.user_id = u.id
     WHERE u.sub_role = 'manager' AND u.is_active = true
       AND COALESCE(p.fee_reminder, true)
       AND v_now::time >= COALESCE(p.fee_reminder_time, TIME '20:00')
       AND p.fee_reminded_on IS DISTINCT FROM v_today
  LOOP
    SELECT pl.total INTO v_fee FROM _sub_open_plan(r.subcontractor_id) pl WHERE pl.d = v_today;
    -- 오늘은 한 번만 확인한다 (보낼 금액이 없어도 표시해서 10분마다 다시 계산하지 않게)
    INSERT INTO subcontractor_notify_prefs (user_id, fee_reminded_on) VALUES (r.id, v_today)
    ON CONFLICT (user_id) DO UPDATE SET fee_reminded_on = v_today;
    IF COALESCE(v_fee, 0) > 0 THEN
      BEGIN
        PERFORM _msg_push(jsonb_build_object(
          'targetType', 'user',
          'targetId',   r.id::text,
          'title',      '오늘 보낼 수수료',
          'body',       '오늘 보낼 수수료 ₩' || to_char(v_fee, 'FM999,999,999') || ' · 송금 후 보고해 주세요',
          'url',        '/',
          'tag',        'sub-fee-reminder-' || v_today::text
        ));
        v_sent := v_sent + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[sub push] 수수료 알림 실패: %', SQLERRM;
      END;
    END IF;
  END LOOP;
  RETURN v_sent;
END;
$$;
REVOKE ALL ON FUNCTION sub_send_fee_reminders() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ============================================================
-- [3-d] 예약 등록 - pg_cron 이 켜져 있을 때만 (묶음 밖: 실패해도 위 내용은 적용된 채로 남는다)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('sub-fee-reminder');
    EXCEPTION WHEN OTHERS THEN NULL;       -- 처음이면 지울 것이 없다
    END;
    PERFORM cron.schedule('sub-fee-reminder', '*/10 * * * *', 'SELECT sub_send_fee_reminders()');
    RAISE NOTICE '수수료 알림 예약을 등록했습니다 (10분마다 확인).';
  ELSE
    RAISE NOTICE 'pg_cron 이 꺼져 있어 수수료 알림 예약을 등록하지 않았습니다. (Database > Extensions 에서 pg_cron 을 켠 뒤 이 파일을 다시 실행)';
  END IF;
END $$;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 - 기대: 9행
SELECT proname FROM pg_proc
 WHERE proname IN ('sub_get_company_account', 'sub_set_company_account', 'sub_get_notify_prefs', 'sub_set_notify_prefs',
                   '_sub_notify_on', 'sub_staff_report_remit', '_impl_sub_staff_report_remit', 'sub_send_fee_reminders', '_mask_account')
 ORDER BY 1;

-- 2) 수수료 알림 예약 - 기대: pg_cron_켜짐 = true (false 면 예약이 등록되지 않은 것 - 위 NOTICE 참고)
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron_켜짐;
