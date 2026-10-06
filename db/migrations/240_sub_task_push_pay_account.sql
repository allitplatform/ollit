-- ============================================================================
-- Migration 240 - 협력사 관리자 푸시(취소 · 일정 변경 · 작업 완료) + 기사용 "보낼 계좌"
-- 작성 2026-10-06 · 선행: 220, 226, 236, 239
--
-- 사장님 결정 (2026-10-06)
--   1) 취소·일정 변경(c), 기사 작업 완료(e) 푸시를 연결한다.
--      기존 운영자·기사용 상태 푸시 함수는 건드리지 않고, 협력사 작업 전용 트리거를 새로 둔다.
--      본인이 한 처리에는 보내지 않는다. 같은 작업 · 같은 종류는 1분 안에 한 번만.
--   3) 기사의 계좌 [복사] 는 열람 기록에서 뺀다. 기사에게는 처음부터 전체 번호를 보여 준다.
--
-- 내용
--   [1] subcontractor_push_log          같은 작업 · 같은 종류의 마지막 발송 시각 (중복 막기)
--   [2] trg_tasks_notify_sub_changes    tasks 가 바뀐 뒤(AFTER UPDATE), 협력사 작업일 때만
--         취소       상태가 '취소' 로 바뀜            "취소 · 후드테스트 강남구 10/8 14:00"
--         일정 변경  잡혀 있던 일정이 다른 시각으로     "일정 변경 · 후드테스트 10/8 14:00 → 10/9 10:00"
--                    (처음 일정을 잡는 것은 변경이 아니라서 보내지 않음)
--         완료       상태가 '완료' 로 바뀜            "완료 · 윤인상 · 후드테스트 ₩100,000"
--       받는 사람: 그 협력사의 관리자 중 해당 알림을 켜 둔 사람 (mig 239 의 _sub_notify_on)
--       본인 처리 제외:
--         취소       취소한 사람 (category_data.cancelActorUserId - 취소 함수들이 이미 남기는 값)
--         완료       담당 기사 본인 (관리자가 자기 작업을 완료한 경우)
--         일정 변경  협력사 관리자가 앱에서 바꾼 경우 (아래 [3])
--   [3] sub_set_schedule (mig 226 의 감싼 함수)   본체(_impl_)를 부르기 전에 "지금 처리하는 사람" 을
--       이 처리 안에서만 보이는 값(app.sub_actor)으로 적어 둔다. 나머지는 mig 226 과 같다.
--   [4] sub_staff_get_pay_account       소속 기사·관리자용 "보낼 계좌". 전체 번호, 열람 기록 없음.
--       (가린 번호 + 👁 열람 기록은 관리자·운영자 화면의 sub_get_company_account 그대로)
--
-- 알아 둘 점
--   · 기사 앱의 일정 변경 함수(mig 076)와 운영자 일정 변경 함수(mig 144)는 건드리지 않았으므로
--     트리거가 "누가 바꿨는지" 를 알 수 없다. 그래서 관리자가 "기사 앱 화면에서" 자기 작업 일정을
--     바꾸면 본인에게도 알림이 간다. (관리자 화면에서 바꾸면 가지 않는다.)
--   · 발송 실패는 원래 처리(취소 · 일정 변경 · 완료)를 되돌리지 않는다.
--
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 중복 발송 막기용 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS subcontractor_push_log (
  task_id uuid NOT NULL,
  kind    text NOT NULL,                    -- cancel / reschedule / done
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, kind)
);
ALTER TABLE subcontractor_push_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_push_log FROM anon, authenticated;

-- ============================================================
-- [2] 협력사 작업 전용 트리거 - 취소 · 일정 변경 · 완료
-- ============================================================
CREATE OR REPLACE FUNCTION trg_tasks_notify_sub_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kind   text;      -- cancel / reschedule / done
  v_pref   text;      -- 알림 설정 이름
  v_title  text;
  v_body   text;
  v_actor  uuid;      -- 이 처리를 한 사람 (알 수 있을 때만)
  v_name   text := COALESCE(NULLIF(btrim(COALESCE(NEW.customer_name, '')), ''), '작업');
  v_when   text;
  v_rows   int;
  r        record;
BEGIN
  IF NEW.subcontractor_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- 이 처리 안에서 적어 둔 처리자 ([3] sub_set_schedule). 없으면 NULL.
    BEGIN
      v_actor := NULLIF(current_setting('app.sub_actor', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_actor := NULL;
    END;

    v_when := CASE WHEN NEW.scheduled_at IS NULL THEN ''
                   ELSE to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Seoul', 'FMMM/FMDD HH24:MI') END;

    IF NEW.status = '취소' AND OLD.status IS DISTINCT FROM '취소' THEN
      v_kind := 'cancel'; v_pref := 'cancel_change'; v_title := '작업 취소';
      v_body := btrim(regexp_replace('취소 · ' || v_name || ' ' || COALESCE(NEW.district, '') || ' ' || v_when, '\s+', ' ', 'g'));
      BEGIN
        v_actor := COALESCE((NEW.category_data ->> 'cancelActorUserId')::uuid, v_actor);
      EXCEPTION WHEN OTHERS THEN
        NULL;         -- user_id 형식이 아니면 처리자 없이 진행
      END;

    ELSIF NEW.status = '완료' AND OLD.status IS DISTINCT FROM '완료' THEN
      v_kind := 'done'; v_pref := 'task_done'; v_title := '작업 완료';
      v_actor := COALESCE(v_actor, NEW.assigned_engineer_id);
      v_body := '완료 · '
             || COALESCE((SELECT u.name FROM users u WHERE u.id = NEW.assigned_engineer_id), '기사')
             || ' · ' || v_name
             || CASE WHEN COALESCE(NEW.supply_amount, 0) > 0
                     THEN ' ₩' || to_char(NEW.supply_amount, 'FM999,999,999') ELSE '' END;

    ELSIF OLD.scheduled_at IS NOT NULL AND NEW.scheduled_at IS NOT NULL
          AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
          AND NEW.status NOT IN ('완료', '취소', 'visit_only', '정산완료') THEN
      v_kind := 'reschedule'; v_pref := 'cancel_change'; v_title := '일정 변경';
      v_body := '일정 변경 · ' || v_name || ' '
             || to_char(OLD.scheduled_at AT TIME ZONE 'Asia/Seoul', 'FMMM/FMDD HH24:MI')
             || ' → ' || v_when;
    ELSE
      RETURN NEW;
    END IF;

    -- 같은 작업 · 같은 종류는 1분 안에 한 번만
    INSERT INTO subcontractor_push_log (task_id, kind, sent_at) VALUES (NEW.id, v_kind, now())
    ON CONFLICT (task_id, kind) DO UPDATE SET sent_at = now()
      WHERE subcontractor_push_log.sent_at < now() - interval '1 minute';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RETURN NEW;
    END IF;

    FOR r IN
      SELECT u.id FROM users u
       WHERE u.subcontractor_id = NEW.subcontractor_id
         AND u.sub_role = 'manager'
         AND u.is_active = true
         AND (v_actor IS NULL OR u.id <> v_actor)        -- 본인이 한 처리에는 보내지 않는다
         AND _sub_notify_on(u.id, v_pref)
    LOOP
      PERFORM _msg_push(jsonb_build_object(
        'targetType', 'user',
        'targetId',   r.id::text,
        'title',      v_title,
        'body',       v_body,
        'url',        '/',
        'tag',        'sub-' || v_kind || '-' || NEW.id::text,
        'taskId',     NEW.id::text
      ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[sub push] 취소·일정·완료 알림 실패 - 저장은 계속: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_notify_sub_changes ON tasks;
CREATE TRIGGER tasks_notify_sub_changes
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (NEW.subcontractor_id IS NOT NULL)
  EXECUTE FUNCTION trg_tasks_notify_sub_changes();

-- ============================================================
-- [3] 협력사 관리자: 일정 확정·변경 - 처리자를 적어 두는 한 줄만 추가 (나머지는 mig 226 과 같음)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_set_schedule(
  p_actor uuid, p_token text, p_task_id uuid, p_scheduled_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_before timestamptz;
  v_res    jsonb;
BEGIN
  SELECT scheduled_at INTO v_before FROM tasks WHERE id = p_task_id;
  PERFORM set_config('app.sub_actor', p_actor::text, true);     -- Mig 240: 본인에게는 일정 변경 알림을 보내지 않기 위해
  v_res := _impl_sub_set_schedule(p_actor, p_token, p_task_id, p_scheduled_at);
  PERFORM set_config('app.sub_actor', '', true);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    PERFORM _sub_log_change(p_task_id, 'schedule', p_actor, 'sub_manager',
      CASE WHEN v_before IS NULL THEN '일정 확정: ' ELSE '일정 변경: ' END
        || to_char(p_scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'),
      jsonb_build_object('scheduledAt', v_before),
      jsonb_build_object('scheduledAt', p_scheduled_at));
  END IF;
  RETURN v_res;
END;
$$;
GRANT EXECUTE ON FUNCTION sub_set_schedule(uuid, text, uuid, timestamptz) TO anon, authenticated;

-- ============================================================
-- [4] 기사용 "보낼 계좌" - 전체 번호, 열람 기록 없음
-- ============================================================
CREATE OR REPLACE FUNCTION sub_staff_get_pay_account(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub uuid;
  v_s   subcontractors%ROWTYPE;
  v_num text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id INTO v_sub FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 소속만 사용할 수 있습니다.');
  END IF;
  SELECT * INTO v_s FROM subcontractors WHERE id = v_sub;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사를 찾지 못했습니다.');
  END IF;
  v_num := btrim(COALESCE(v_s.bank_account, ''));
  RETURN jsonb_build_object(
    'ok', true,
    'name', v_s.name,
    'account', CASE WHEN v_num = '' THEN NULL ELSE jsonb_build_object(
        'bank',   NULLIF(btrim(COALESCE(v_s.bank_name, '')), ''),
        'holder', NULLIF(btrim(COALESCE(v_s.account_holder, '')), ''),
        'number', v_num) END);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_get_pay_account(uuid, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 - 기대: 함수 3행 + 트리거 1행 = 4행
-- ============================================================================
SELECT '함수' AS 종류, proname AS 이름 FROM pg_proc
 WHERE proname IN ('trg_tasks_notify_sub_changes', 'sub_staff_get_pay_account', 'sub_set_schedule')
UNION ALL
SELECT '트리거', tgname FROM pg_trigger WHERE tgname = 'tasks_notify_sub_changes' AND NOT tgisinternal
 ORDER BY 1, 2;
