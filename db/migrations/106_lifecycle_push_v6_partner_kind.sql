-- ============================================================================
-- Migration 106 — notify_lifecycle_push v6 (partner kind 명시 + 시나리오 3 추가)
-- 2026-06-08
--
-- v5 (Mig 097) 본문 100% 보존 + 2가지 변경만:
--   ① 시나리오 3 (일정 확정) — partner LOOP 추가 (옛: admin 만)
--   ② 모든 partner LOOP 에 payload 'kind' 명시:
--      · 시나리오 3 partner → 'partnerSchedule'
--      · 시나리오 5 partner → 'partnerComplete'
--      · 시나리오 7 partner → 'partnerCancel'
--      · 시나리오 9 partner → 'partnerAssign'
--   send.js 가 payload.kind 우선 사용 → user_notification_preferences 게이트 정합.
--
-- 사장님 spec:
--   · 작업 시작 (4) / 취소 요청 (10) — 원청 발송 X (운영자 전용 유지).
--   · 정산 완료 → markPartnerDailyRemit RPC 안에서 발사 (= Migration 107 별도).
--
-- 회귀 안전:
--   · CREATE OR REPLACE — 재실행 idempotent.
--   · 기존 admin / engineer LOOP 무손상.
--   · 다른 트리거 / RPC / 정책 무손상.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION notify_lifecycle_push() RETURNS TRIGGER AS $$
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
                           THEN ' · ' || COALESCE(cat->>'appliance', '')
                                || ' ×' || COALESCE((cat->>'qty')::int, 1)::text
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
BEGIN
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_API_KEY'
    LIMIT 1;

  IF api_key IS NULL OR api_key = '' THEN
    RAISE NOTICE '[lifecycle push] PUSH_API_KEY (vault) not configured — skipping';
    RETURN NEW;
  END IF;

  IF NEW.assigned_engineer_id IS NOT NULL THEN
    SELECT code, name INTO cur_eng_code, cur_eng_name
      FROM users WHERE id = NEW.assigned_engineer_id;
  END IF;
  IF OLD.assigned_engineer_id IS NOT NULL THEN
    SELECT code INTO old_eng_code FROM users WHERE id = OLD.assigned_engineer_id;
  END IF;

  -- ====== 시나리오 3 — 일정 확정 ======
  IF NEW.scheduled_confirmed_at IS NOT NULL AND OLD.scheduled_confirmed_at IS NULL THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
    -- (3a) admin (v5 그대로)
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','📅 일정 확정','body',task_body,
        'url','/','tag','scheduled-' || NEW.id::text,
        'taskId', NEW.id::text
      )
    );
    -- (3-partner) v6 신규 — partner LOOP
    v_partner_body := task_body;
    FOR v_p_user IN
      SELECT DISTINCT user_id FROM user_roles
      WHERE role = 'partner'
        AND principal_id = NEW.principal_id
        AND user_id IS NOT NULL
    LOOP
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','user','targetId', v_p_user::text,
          'title','📅 일정 확정','body', v_partner_body,
          'url','/','tag','scheduled-partner-' || NEW.id::text || '-' || v_p_user::text,
          'taskId', NEW.id::text,
          'kind', 'partnerSchedule'
        )
      );
    END LOOP;
  END IF;

  -- ====== 시나리오 4 — 작업 시작 (admin 전용, partner X) ======
  IF NEW.started_at IS NOT NULL AND OLD.started_at IS NULL THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','▶️ 작업 시작','body',task_body,
        'url','/','tag','started-' || NEW.id::text,
        'taskId', NEW.id::text
      )
    );
  END IF;

  -- ====== 시나리오 5 — 작업 완료 ======
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
    -- (5a) admin (v5 그대로)
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','✅ 작업 완료','body',task_body,
        'url','/','tag','completed-' || NEW.id::text,
        'taskId', NEW.id::text
      )
    );
    -- (5b) v5 partner LOOP + v6 kind 명시
    v_partner_body := task_body;
    FOR v_p_user IN
      SELECT DISTINCT user_id FROM user_roles
      WHERE role = 'partner'
        AND principal_id = NEW.principal_id
        AND user_id IS NOT NULL
    LOOP
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','user','targetId', v_p_user::text,
          'title','✅ 작업이 완료되었습니다','body', v_partner_body,
          'url','/','tag','completed-partner-' || NEW.id::text || '-' || v_p_user::text,
          'taskId', NEW.id::text,
          'kind', 'partnerComplete'
        )
      );
    END LOOP;
  END IF;

  -- ====== 시나리오 6 — 일정 변경 (admin/engineer, partner X) ======
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     AND NEW.scheduled_at IS NOT NULL
     AND OLD.scheduled_confirmed_at IS NOT NULL
     AND NEW.scheduled_confirmed_at = OLD.scheduled_confirmed_at THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix
              || ' · ' || COALESCE(NEW.scheduled_at::text, '');
    IF cur_eng_code IS NOT NULL THEN
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',cur_eng_code,
          'title','🔄 일정 변경','body',task_body,
          'url','/','tag','sched-change-' || NEW.id::text,
          'taskId', NEW.id::text
        )
      );
    END IF;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','🔄 일정 변경','body',task_body,
        'url','/','tag','sched-change-admin-' || NEW.id::text,
        'taskId', NEW.id::text
      )
    );
  END IF;

  -- ====== 시나리오 7 — 작업 취소 (운영자 취소 확인) ======
  IF NEW.status = '취소' AND OLD.status IS DISTINCT FROM '취소' THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
    -- (7a) 기사 (v5 그대로)
    IF cur_eng_code IS NOT NULL THEN
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',cur_eng_code,
          'title','❌ 작업 취소','body',task_body,
          'url','/','tag','cancel-' || NEW.id::text,
          'taskId', NEW.id::text
        )
      );
    END IF;
    -- (7b) admin (v5 그대로)
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','❌ 작업 취소','body',task_body,
        'url','/','tag','cancel-admin-' || NEW.id::text,
        'taskId', NEW.id::text
      )
    );
    -- (7c) v5 partner LOOP + v6 kind 명시
    v_partner_body := task_body;
    FOR v_p_user IN
      SELECT DISTINCT user_id FROM user_roles
      WHERE role = 'partner'
        AND principal_id = NEW.principal_id
        AND user_id IS NOT NULL
    LOOP
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','user','targetId', v_p_user::text,
          'title','❌ 작업이 취소되었습니다','body', v_partner_body,
          'url','/','tag','cancel-partner-' || NEW.id::text || '-' || v_p_user::text,
          'taskId', NEW.id::text,
          'kind', 'partnerCancel'
        )
      );
    END LOOP;
  END IF;

  -- ====== 시나리오 8 — 재배정 (admin/engineer, partner X) ======
  IF NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id
     AND OLD.assigned_engineer_id IS NOT NULL
     AND NEW.assigned_engineer_id IS NOT NULL THEN
    task_body := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
    IF cur_eng_code IS NOT NULL THEN
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',cur_eng_code,
          'title','🔄 새 작업 배정 (재배정)','body',task_body,
          'url','/','tag','reassign-new-' || NEW.id::text,
          'taskId', NEW.id::text
        )
      );
    END IF;
    IF old_eng_code IS NOT NULL THEN
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',old_eng_code,
          'title','🔄 작업 재배정 (해제)','body',task_body,
          'url','/','tag','reassign-old-' || NEW.id::text,
          'taskId', NEW.id::text
        )
      );
    END IF;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','🔄 프로 재배정','body',task_body,
        'url','/','tag','reassign-admin-' || NEW.id::text,
        'taskId', NEW.id::text
      )
    );
  END IF;

  -- ====== 시나리오 9 — 기사 수락 (첫 배정) ======
  IF NEW.status = '배정'
     AND OLD.status IS DISTINCT FROM '배정'
     AND OLD.assigned_engineer_id IS NULL
     AND NEW.assigned_engineer_id IS NOT NULL THEN
    -- (9a) admin (v5 그대로)
    task_body := COALESCE(cur_eng_name, cur_eng_code, '기사')
              || ' · ' || customer
              || ' · ' || work_type || detail_suffix;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','🙋 기사 수락','body',task_body,
        'url','/','tag','accept-' || NEW.id::text,
        'taskId', NEW.id::text
      )
    );

    -- (9-partner) v5 partner LOOP + v6 kind 명시
    v_partner_body := task_body;
    FOR v_p_user IN
      SELECT DISTINCT user_id FROM user_roles
      WHERE role = 'partner'
        AND principal_id = NEW.principal_id
        AND user_id IS NOT NULL
    LOOP
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','user','targetId', v_p_user::text,
          'title','🎯 작업이 배정되었습니다','body', v_partner_body,
          'url','/','tag','assign-partner-' || NEW.id::text || '-' || v_p_user::text,
          'taskId', NEW.id::text,
          'kind', 'partnerAssign'
        )
      );
    END LOOP;

    -- (9b/9c) 냉매일 때만 추가 발사 (v5 그대로)
    is_refrigerant := (work_type LIKE '%냉매%');
    IF is_refrigerant AND cur_eng_code IS NOT NULL THEN
      base_info     := customer || ' · ' || district || ' · ' || work_type || detail_suffix;
      body_assigned := base_info || E'\n본인 작업으로 확정되었습니다';
      body_closed   := base_info || E'\n다른 기사님이 먼저 수락하셨습니다';

      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',cur_eng_code,
          'title','📥 냉매 작업 배정 완료','body',body_assigned,
          'url','/','tag','refrig-accepted-' || NEW.id::text,
          'taskId', NEW.id::text
        )
      );

      IF NEW.push_candidates IS NOT NULL THEN
        FOR other_cand IN SELECT jsonb_array_elements_text(NEW.push_candidates) LOOP
          IF other_cand IS NULL OR other_cand = '' THEN CONTINUE; END IF;
          IF other_cand = cur_eng_code THEN CONTINUE; END IF;
          PERFORM net.http_post(
            url := push_url,
            headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
            body := jsonb_build_object(
              'targetType','engineer','targetId',other_cand,
              'title','❌ 냉매 수락 마감','body',body_closed,
              'url','/','tag','refrig-closed-' || NEW.id::text,
              'taskId', NEW.id::text
            )
          );
        END LOOP;
      END IF;
    END IF;
  END IF;

  -- ====== 시나리오 10 — 취소 요청 (admin 전용, partner X) ======
  IF NEW.status = '취소요청' AND OLD.status IS DISTINCT FROM '취소요청' THEN
    cancel_reason := COALESCE(cat->>'cancelReason', '사유 없음');
    task_body := COALESCE(cur_eng_name, cur_eng_code, '기사')
              || ' · ' || customer
              || ' · ' || cancel_reason;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','🚨 취소 요청','body',task_body,
        'url','/','tag','cancel-request-' || NEW.id::text,
        'taskId', NEW.id::text
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_lifecycle_push() IS
  'v6 (Migration 106, 2026-06-08) — 시나리오 3 partner LOOP 추가 + 모든 partner LOOP 에 payload kind 명시. '
  'v5 (Mig 097) 본문 100% 보존 + 2가지 변경만. '
  'partner kind: scenario 3=partnerSchedule / 5=partnerComplete / 7=partnerCancel / 9=partnerAssign. '
  'send.js 가 payload.kind 우선 사용 → user_notification_preferences 게이트 정합.';

COMMIT;

-- 검증
SELECT proname, obj_description(oid, 'pg_proc')
FROM pg_proc WHERE proname = 'notify_lifecycle_push';
