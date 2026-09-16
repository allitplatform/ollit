-- ============================================================================
-- Migration 203 — 세척(비냉매) 첫 배정 기사 푸시 복구 (2026-07-30)
--
-- 증상 (사장님): "앱 푸시가 기사님이 안 온다" — 임동혁(E039) 기사님.
--   조사 결과 기기/구독/발송 전부 정상. 안 온 게 아니라 안 보낸 것.
--
-- 원인 추적
--   2026-05-29 ad-hoc v5 : 시나리오 9b 를 냉매/비냉매 모두 발사로 확장
--                          ('📥 작업 배정 완료') → 화면(AdminApp) 쪽 옛
--                          push_candidates UPDATE 경로는 중복이라 같은 날 삭제.
--   2026-06-04 Mig 097   : partner 분기 추가하며 ad-hoc v5 가 아닌 그 이전
--                          본문(Mig 078, 냉매 전용 게이트)을 베이스로 복사.
--                          → 비냉매 분기 유실. 화면 쪽 대체 경로는 이미 없음.
--   2026-06-08 Mig 106 / 2026-06-19 Mig 145 가 그대로 승계.
--   결과: 2026-06-04 ~ 오늘, 세척 기사님은 첫 배정 푸시 0건.
--         (재배정·일정변경·취소·공지·냉매는 정상이라 발견이 늦음)
--
-- 변경 (Mig 145 본문 100% 보존, 시나리오 9 안에서 3곳만)
--   ① IF is_refrigerant AND cur_eng_code IS NOT NULL  →  IF cur_eng_code IS NOT NULL
--   ② 9b title  : 냉매면 '📥 냉매 작업 배정 완료', 아니면 '📥 작업 배정 완료'
--   ③ 9c title  : 냉매면 '❌ 냉매 수락 마감',      아니면 '❌ 작업 수락 마감'
--      (tag 도 같은 방식으로 분기 — 냉매 tag 는 기존값 그대로 유지)
--
-- 안전성
--   · 두 title 모두 '작업 배정' 을 포함 → send.js inferKindFromTitle 이
--     kind='assignment' 로 매핑 → 기존 "배정 알림" ON/OFF 설정 그대로 적용.
--   · 9c LOOP 은 push_candidates 기반. 세척 수동 배정은 push_candidates 가
--     비어 있어 실제로는 돌지 않음 (자동배정=냉매 흐름 전용). 정합성 위해 함께 정정.
--   · 중복 우려: notify_push_candidates 트리거의 '🎯 작업 배정'(cand_count==1)
--     과 겹치려면 세척 task 에 push_candidates 가 1건 기록돼야 하는데,
--     그 경로는 2026-05-29 에 화면에서 제거됨.
--   · CREATE OR REPLACE — 재실행 idempotent. 시나리오 3~8,10 무변경.
--
-- 선행 조건: 없음 (서버 코드 변경 없음 — SQL 단독 실행 가능)
-- ============================================================================

BEGIN;

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
COMMENT ON FUNCTION public.notify_lifecycle_push() IS
  'lifecycle push — Mig 078 본체 + Mig 145 정정(시6 중복차단 / 시8 OLD 일정 조정 안내) + Mig 203 시9 비냉매 배정 푸시 복구.';

COMMIT;

-- ============================================================================
-- VERIFY — 기대: 게이트해제 ✅ / 비냉매문구 ✅ / 냉매문구 ✅
-- ============================================================================
SELECT
  CASE WHEN prosrc LIKE '%IF is_refrigerant AND cur_eng_code IS NOT NULL THEN%'
       THEN '❌ 아직 냉매 전용' ELSE '✅ 게이트 해제' END              AS 게이트,
  CASE WHEN prosrc LIKE '%📥 작업 배정 완료%'
       THEN '✅ 있음' ELSE '❌ 없음' END                                AS 비냉매문구,
  CASE WHEN prosrc LIKE '%📥 냉매 작업 배정 완료%'
       THEN '✅ 보존' ELSE '❌ 유실' END                                AS 냉매문구,
  CASE WHEN prosrc LIKE '%🔄 프로 재배정%'
       THEN '✅ 보존' ELSE '❌ 유실' END                                AS 시나리오8보존
FROM pg_proc WHERE proname = 'notify_lifecycle_push';
