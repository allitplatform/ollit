-- ============================================
-- Migration 051 — notify_lifecycle_push 확장: 기사 수락 + 취소 요청 알림 추가
-- 작성일  : 2026-05-22
-- 범위    : 015b 본체 그대로 + 신규 시나리오 9, 10 IF 블록 추가
--
-- 신규 시나리오 (운영 핵심 누락 알림):
--   9. 기사 수락 (status='배정' + OLD.assigned_engineer_id NULL → NEW IS NOT NULL)
--      → 운영자(role='admin')에게 "🙋 기사 수락" 알림
--   10. 취소 요청 (status='취소요청')
--      → 운영자(role='admin')에게 "🚨 취소 요청" 알림
--
-- 의존:
--   · Migration 014 (notify_push_candidates 함수 + trigger)
--   · Migration 015b (notify_lifecycle_push 함수 + trigger — 본 파일이 CREATE OR REPLACE)
--   · Migration 013 (status_timestamps trigger — assigned_at / scheduled_confirmed_at 자동 SET)
--   · Vault PUSH_API_KEY
--
-- 변경:
--   · notify_lifecycle_push 함수만 CREATE OR REPLACE (015b 본체 + 시나리오 9, 10 추가)
--   · trigger는 그대로 (notify_lifecycle_push_trg) — DROP/CREATE 불필요
--   · 015b의 시나리오 3~8 완전 무손상 (한 글자도 변경 X)
--
-- 회귀 방지:
--   · CREATE OR REPLACE 이므로 idempotent (재실행 안전)
--   · 015b 본체 6개 시나리오 그대로 유지 → 기존 정상 알림 영향 0
--   · 신규 IF 두 개만 추가 (블록 격리)
--
-- payload 측 taskId 포함 — SW 인앱 dedup 정상 동작 (send.js P1 수정과 함께)
--
-- 실행:
--   · Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   · BEGIN/COMMIT — 부분 실패 시 ROLLBACK
-- ============================================

BEGIN;

-- ============================================
-- notify_lifecycle_push 함수 — 015b 본체 + 시나리오 9, 10 추가
-- ============================================
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
BEGIN
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_API_KEY'
    LIMIT 1;

  IF api_key IS NULL OR api_key = '' THEN
    RAISE NOTICE '[lifecycle push] PUSH_API_KEY (vault) not configured — skipping';
    RETURN NEW;
  END IF;

  -- engineer 정보 lookup (UUID → code + name)
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
  END IF;

  -- ====== 시나리오 4 — 작업 시작 ======
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
  END IF;

  -- ====== 시나리오 6 — 일정 변경 ======
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
  END IF;

  -- ====== 시나리오 8 — 재배정 ======
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

  -- ====== 시나리오 9 (신규) — 기사 수락 (첫 배정) ======
  -- 조건: status='배정' 처음 진입 + assigned_engineer_id 첫 SET (OLD NULL → NEW IS NOT NULL).
  -- 자동 broadcast 후 기사 수락(acceptOfferAdapter) + 운영자 수동 배정(assignEngineerAdapter)
  -- 두 경로 모두 발화 — 운영자가 본인 행동 확인용으로도 유용.
  -- 시나리오 8(재배정)은 OLD NOT NULL 조건이라 본 분기와 겹치지 않음.
  IF NEW.status = '배정'
     AND OLD.status IS DISTINCT FROM '배정'
     AND OLD.assigned_engineer_id IS NULL
     AND NEW.assigned_engineer_id IS NOT NULL THEN
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
  END IF;

  -- ====== 시나리오 10 (신규) — 취소 요청 ======
  -- 조건: status='취소요청' 첫 진입. cancelReason 은 category_data 측에서 추출.
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
  'lifecycle push — 시나리오 3~10. 015b 본체 + 051 신규(수락/취소 요청).';

COMMIT;

-- ============================================
-- 검증 SQL
-- ============================================
-- 1. 함수 코멘트 확인 (051 적용 여부):
-- SELECT proname, obj_description(p.oid, 'pg_proc') AS note
-- FROM pg_proc p
-- WHERE p.proname = 'notify_lifecycle_push';
-- → 기대: note = 'lifecycle push — 시나리오 3~10. 015b 본체 + 051 신규(수락/취소 요청).'
--
-- 2. trigger 그대로 유지 확인:
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'tasks'::regclass AND tgname LIKE 'notify_%';
-- → 기대: notify_push_candidates_trg + notify_lifecycle_push_trg (그대로)
--
-- 3. 실제 발사 검증 (작업 1건 수락 + 1건 취소 요청 후):
-- SELECT id, status_code, content::jsonb->>'sent' AS sent, created
-- FROM net._http_response
-- WHERE created > NOW() - INTERVAL '5 minutes'
-- ORDER BY created DESC LIMIT 20;
-- → 기대: 수락 시 1건 + 취소 요청 시 1건 추가 발사
