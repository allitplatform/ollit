-- ============================================================================
-- Migration 241 - 작업 종목 서버 안전장치 + 협력사 관리자 "푸시 전체 끄기"
-- 작성 2026-10-07 · 선행: 215, 219, 239, 240
--
-- 사장님 결정 (2026-10-07)
--   2) 서버 안전장치 추가. 앱이 아닌 경로(일괄 등록 등)로 작업이 들어와도 종목이 맞게 저장되도록.
--   5) 푸시 전체 끄기 = 하위 5종 모두 발송 안 함 (전체 스위치가 우선).
--
-- [1] 작업 종목 안전장치
--     tasks 를 저장할 때(새로 넣을 때 / 작업 항목 칸 category_data 가 바뀔 때) 작업 항목의 서비스로 종목을 맞춘다.
--     규칙은 앱(src/lib/serviceCatalog.js 의 categoryIdOfTask)과 같다.
--       · category_data.workItems 를 앞에서부터 보고, 공통 서비스(출장비)는 건너뛴 "첫 항목" 의 종목
--         (항목의 serviceCode -> service_types.code, 없으면 이름 "서비스_기종" 의 앞부분 -> service_types.name)
--       · 항목이 없으면 category_data.workType 으로 같은 방법
--       · 알 수 없으면(모르는 이름, 같은 이름이 여러 종목에 있음) 기존 값을 그대로 둔다 - 에어컨으로 덮어쓰지 않는다
--     바꾸는 칸은 tasks.category_id 하나뿐. 금액 · 정산 · 상태 칸은 건드리지 않는다.
--     이 파일은 이미 저장된 작업을 한꺼번에 고치지 않는다 (그것은 db/ops/fix_task_category_mismatch.sql 로 따로).
--     다만 어긋나 있던 작업도 이후 작업 항목이 다시 저장되면 그때 맞춰진다.
--
-- [2] 푸시 전체 끄기 (협력사 관리자)
--     subcontractor_notify_prefs.push_all (기본 켜짐). 꺼져 있으면 5종 모두 보내지 않는다.
--       · _sub_notify_on        (mig 239 의 내부 함수)  : 전체 스위치를 먼저 본다
--       · sub_send_fee_reminders (mig 239)             : 전체 스위치가 꺼진 관리자는 건너뛴다 (조건 한 줄 추가, 나머지 같음)
--       · sub_get_notify_prefs  : 본체를 _impl_ 로 보존하고 감싸서 push_all 을 함께 돌려준다
--       · sub_set_push_all      : 새 함수. 전체 스위치만 바꾼다 (5종 각각의 설정은 그대로 남는다)
--
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 작업 종목 안전장치
-- ============================================================
-- 항목 하나 -> 종목. 공통이면 is_common = true, 모르면 category_id = NULL.
CREATE OR REPLACE FUNCTION _task_item_category(p_code text, p_name text, OUT category_id uuid, OUT is_common boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code text := NULLIF(btrim(COALESCE(p_code, '')), '');
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_n    int;
BEGIN
  category_id := NULL; is_common := false;

  -- 1) 서비스 코드
  IF v_code IS NOT NULL THEN
    SELECT COUNT(DISTINCT st.category_id), bool_or(COALESCE(st.is_common, false)), MIN(st.category_id::text)::uuid
      INTO v_n, is_common, category_id
      FROM service_types st WHERE st.code = v_code;
    IF COALESCE(is_common, false) THEN category_id := NULL; is_common := true; RETURN; END IF;
    IF v_n = 1 THEN is_common := false; RETURN; END IF;
    category_id := NULL; is_common := false;
  END IF;

  -- 2) 이름 - 통째로 먼저, 없으면 "서비스_기종" 의 앞부분
  IF v_name IS NULL THEN RETURN; END IF;
  SELECT COUNT(DISTINCT st.category_id), bool_or(COALESCE(st.is_common, false)), MIN(st.category_id::text)::uuid
    INTO v_n, is_common, category_id
    FROM service_types st WHERE st.name = v_name;
  IF COALESCE(v_n, 0) = 0 AND position('_' IN v_name) > 1 THEN
    SELECT COUNT(DISTINCT st.category_id), bool_or(COALESCE(st.is_common, false)), MIN(st.category_id::text)::uuid
      INTO v_n, is_common, category_id
      FROM service_types st WHERE st.name = split_part(v_name, '_', 1);
  END IF;
  IF COALESCE(is_common, false) THEN category_id := NULL; is_common := true; RETURN; END IF;
  is_common := false;
  IF COALESCE(v_n, 0) <> 1 THEN category_id := NULL; END IF;     -- 모르거나, 같은 이름이 여러 종목에 있으면 정하지 않는다
END;
$$;
REVOKE ALL ON FUNCTION _task_item_category(text, text) FROM PUBLIC, anon, authenticated;

-- 작업 항목 칸(category_data) -> 종목. 정할 수 없으면 NULL.
CREATE OR REPLACE FUNCTION _task_category_from_data(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  w    jsonb;
  v_c  uuid;
  v_cm boolean;
BEGIN
  IF p_data IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_data -> 'workItems') = 'array' THEN
    FOR w IN SELECT e.value FROM jsonb_array_elements(p_data -> 'workItems') WITH ORDINALITY AS e(value, ord) ORDER BY e.ord
    LOOP
      IF jsonb_typeof(w) = 'string' THEN
        SELECT c.category_id, c.is_common INTO v_c, v_cm FROM _task_item_category(NULL, w #>> '{}') c;
      ELSIF jsonb_typeof(w) = 'object' THEN
        SELECT c.category_id, c.is_common INTO v_c, v_cm
          FROM _task_item_category(COALESCE(w ->> 'serviceCode', w ->> 'service_code'),
                                   COALESCE(w ->> 'workType', w ->> 'work_type', w ->> 'name')) c;
      ELSE
        CONTINUE;
      END IF;
      IF v_cm THEN CONTINUE; END IF;      -- 공통(출장비)은 건너뛴다
      RETURN v_c;                         -- 공통이 아닌 첫 항목으로 정한다 (모르면 NULL = 기존 값 유지)
    END LOOP;
  END IF;
  -- 항목이 없거나 공통뿐이면 작업 이름으로
  SELECT c.category_id, c.is_common INTO v_c, v_cm
    FROM _task_item_category(COALESCE(p_data ->> 'serviceCode', p_data ->> 'service_code'), p_data ->> 'workType') c;
  IF v_cm THEN RETURN NULL; END IF;
  RETURN v_c;
END;
$$;
REVOKE ALL ON FUNCTION _task_category_from_data(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION trg_tasks_category_from_items()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cat uuid;
BEGIN
  BEGIN
    v_cat := _task_category_from_data(NEW.category_data);
    IF v_cat IS NOT NULL AND NEW.category_id IS DISTINCT FROM v_cat THEN
      NEW.category_id := v_cat;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[category guard] 종목 판정 실패 - 저장은 계속: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_category_from_items ON tasks;
CREATE TRIGGER tasks_category_from_items
  BEFORE INSERT OR UPDATE OF category_data ON tasks
  FOR EACH ROW EXECUTE FUNCTION trg_tasks_category_from_items();

-- ============================================================
-- [2] 푸시 전체 끄기
-- ============================================================
ALTER TABLE subcontractor_notify_prefs
  ADD COLUMN IF NOT EXISTS push_all boolean NOT NULL DEFAULT true;

-- 내부: 그 관리자가 그 종류의 알림을 받는지 - 전체 스위치가 우선 (나머지는 mig 239 와 같음)
CREATE OR REPLACE FUNCTION _sub_notify_on(p_user uuid, p_kind text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE WHEN NOT p.push_all THEN false ELSE
           CASE p_kind
             WHEN 'new_task'      THEN p.new_task
             WHEN 'staff_remit'   THEN p.staff_remit
             WHEN 'cancel_change' THEN p.cancel_change
             WHEN 'fee_reminder'  THEN p.fee_reminder
             WHEN 'task_done'     THEN p.task_done
           END END
      FROM subcontractor_notify_prefs p WHERE p.user_id = p_user),
    p_kind <> 'task_done');
$$;
REVOKE ALL ON FUNCTION _sub_notify_on(uuid, text) FROM PUBLIC, anon, authenticated;

-- 오늘 보낼 수수료 알림 - 전체 스위치가 꺼진 관리자는 건너뛴다 (조건 한 줄 추가, 나머지는 mig 239 와 같음)
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
       AND COALESCE(p.push_all, true)                 -- Mig 241: 전체 스위치
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

-- 알림 설정 읽기 - 본체를 보존하고 감싸서 전체 스위치를 함께 돌려준다
DO $$
BEGIN
  IF to_regprocedure('_impl_sub_get_notify_prefs(uuid, text)') IS NULL THEN
    ALTER FUNCTION sub_get_notify_prefs(uuid, text) RENAME TO _impl_sub_get_notify_prefs;
  END IF;
END $$;
REVOKE ALL ON FUNCTION _impl_sub_get_notify_prefs(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sub_get_notify_prefs(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_res jsonb;
BEGIN
  v_res := _impl_sub_get_notify_prefs(p_actor, p_token);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RETURN v_res;
  END IF;
  RETURN v_res || jsonb_build_object('push_all',
    COALESCE((SELECT p.push_all FROM subcontractor_notify_prefs p WHERE p.user_id = p_actor), true));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_get_notify_prefs(uuid, text) TO anon, authenticated;

-- 전체 스위치 바꾸기 (협력사 관리자 본인 것만). 5종 각각의 설정은 그대로 남는다.
CREATE OR REPLACE FUNCTION sub_set_push_all(p_actor uuid, p_token text, p_on boolean)
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
  INSERT INTO subcontractor_notify_prefs (user_id, push_all) VALUES (p_actor, COALESCE(p_on, true))
  ON CONFLICT (user_id) DO UPDATE SET push_all = COALESCE(p_on, true), updated_at = now();
  RETURN jsonb_build_object('ok', true, 'push_all', COALESCE(p_on, true));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_set_push_all(uuid, text, boolean) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 - 마지막 표 한 장
--   "1 트리거"  : 1행 (tasks_category_from_items)
--   "2 판정"    : 주방후드(업소용) 항목 -> 주방후드 / 출장비 + 세척 -> 에어컨 / 모르는 이름 -> (정하지 않음)
--   "3 시험"    : 가짜 작업 1건을 넣어 보고 되돌림. 에어컨으로 넣어도 주방후드로 저장되면 "통과".
--                 (시험하는 동안만 다른 트리거를 끄고 이 트리거만 켜 둡니다 - 알림 · 문자 · 정산이 움직이지 않게.
--                  넣은 행과 트리거 설정은 전부 되돌려집니다. 시험을 할 수 없는 사정이 있으면 사유가 나옵니다.)
-- ============================================================================
DROP TABLE IF EXISTS _result_241;
CREATE TEMP TABLE _result_241 (구분 text, 대상 text, 결과 text);

INSERT INTO _result_241
SELECT '1 트리거', tgname, '있음' FROM pg_trigger WHERE tgname = 'tasks_category_from_items' AND NOT tgisinternal;

INSERT INTO _result_241
SELECT '2 판정', x.label,
       COALESCE((SELECT c.name FROM categories c WHERE c.id = _task_category_from_data(x.data)), '(정하지 않음 - 기존 값 유지)')
  FROM (VALUES
    ('주방후드(업소용) 항목',        '{"workItems":[{"workType":"주방후드(업소용)","appliance":"(공통)"}]}'::jsonb),
    ('출장비 + 세척_1way',           '{"workItems":[{"workType":"출장비"},{"workType":"세척_1way"}]}'::jsonb),
    ('서비스 코드 hood_home',        '{"workItems":[{"serviceCode":"hood_home"}]}'::jsonb),
    ('모르는 이름',                  '{"workItems":[{"workType":"없는서비스"}]}'::jsonb)
  ) AS x(label, data);

DO $$
DECLARE
  v_src   tasks%ROWTYPE;
  v_new   tasks%ROWTYPE;
  v_air   uuid;
  v_hood  uuid;
  v_got   uuid;
  v_msg   text;
BEGIN
  SELECT id INTO v_air  FROM categories WHERE code = 'aircon';
  SELECT id INTO v_hood FROM categories WHERE code = 'hood';
  SELECT * INTO v_src FROM tasks ORDER BY received_at DESC NULLS LAST LIMIT 1;
  IF v_air IS NULL OR v_hood IS NULL OR v_src.id IS NULL THEN
    INSERT INTO _result_241 VALUES ('3 시험', '가짜 작업 넣어 보기', '건너뜀 - 종목(aircon/hood) 또는 본뜰 작업이 없습니다');
    RETURN;
  END IF;
  BEGIN
    -- 이 트리거만 켠 채로 넣어 본다 (알림 · 문자 · 정산 트리거가 움직이지 않게)
    ALTER TABLE tasks DISABLE TRIGGER USER;
    ALTER TABLE tasks ENABLE TRIGGER tasks_category_from_items;
    v_new := jsonb_populate_record(v_src, jsonb_build_object(
      'id', gen_random_uuid(),
      'task_no', 'ZZ-TEST-241',
      'category_id', v_air,
      'subcontractor_id', NULL,
      'assigned_engineer_id', NULL,
      'status', '미배정',
      'category_data', jsonb_build_object('workItems', jsonb_build_array(
          jsonb_build_object('workType', '주방후드(업소용)', 'appliance', '(공통)', 'qty', 1)))));
    INSERT INTO tasks SELECT v_new.*;
    SELECT category_id INTO v_got FROM tasks WHERE id = v_new.id;
    RAISE EXCEPTION 'ROLLBACK_241:%', COALESCE(v_got::text, 'NULL');
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;                    -- 여기로 오면 위에서 한 일(넣은 행 · 트리거 설정)은 전부 되돌려진 상태
  END;
  IF v_msg LIKE 'ROLLBACK_241:%' THEN
    INSERT INTO _result_241 VALUES ('3 시험', '에어컨으로 넣은 주방후드 작업',
      CASE WHEN split_part(v_msg, ':', 2) = v_hood::text THEN '통과 - 주방후드로 저장됨 (넣은 행은 되돌림)'
           ELSE '실패 - 저장된 종목 ' || split_part(v_msg, ':', 2) END);
  ELSE
    INSERT INTO _result_241 VALUES ('3 시험', '가짜 작업 넣어 보기', '시험 못 함 (트리거 자체는 "2 판정" 으로 확인) - 사유: ' || v_msg);
  END IF;
END $$;

INSERT INTO _result_241
SELECT '4 남은 흔적', 'ZZ-TEST-241 작업', COUNT(*)::text || '건 (기대 0)' FROM tasks WHERE task_no = 'ZZ-TEST-241';
INSERT INTO _result_241
SELECT '5 전체 스위치', 'push_all 칸', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subcontractor_notify_prefs' AND column_name = 'push_all') THEN '있음' ELSE '없음' END;

SELECT * FROM _result_241 ORDER BY 1, 2;
