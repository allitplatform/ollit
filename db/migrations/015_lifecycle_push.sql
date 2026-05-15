-- ============================================
-- Migration 015 — 시나리오 3~8 lifecycle OS push 박힘
-- 작성일  : 2026-05-15
-- 범위    : tasks 측 status / scheduled_confirmed_at / started_at / completed_at /
--          scheduled_at / assigned_engineer_id 변경 박힐 때 OS push 발송
--
-- 시나리오 (Migration 014 + 015a = 시나리오 1, 2):
--   3. 일정 확정 (scheduled_confirmed_at SET): "📅 일정 확정" + admin
--   4. 작업 시작 (started_at SET):              "▶️ 작업 시작" + admin
--   5. 작업 완료 (completed_at SET):            "✅ 작업 완료" + admin
--   6. 일정 변경 (scheduled_at 변경, 기존 확정 박힘): "🔄 일정 변경" + 기사 + admin
--   7. 작업 취소 (status='취소'):               "❌ 작업 취소" + 기사 + admin
--   8. 재배정 (assigned_engineer_id 변경, 옛 박힘): "🔄 재배정" + 새 기사 + 옛 기사 + admin
--
-- 의존:
--   · pg_net extension (Migration 014 박힘)
--   · Vault 측 PUSH_API_KEY (Migration 015a 측 사용 spec 박힘)
--   · users.code 박힘 ("E022" 패턴 — assigned_engineer_id UUID → code 변환)
--   · GAS 시트 측 role="admin" / engineer="E0XX" 매칭 박힘
--
-- 보호:
--   · 다른 trigger / 함수 / 테이블 박지 X
--   · 신규 trigger 박는 거 (014 측 notify_push_candidates_trg와 별개)
--   · 한 task UPDATE 박힐 때 동시 여러 시나리오 박힐 차례 박혀있음 (각 IF 별도 박힘)
--
-- 실행:
--   · Supabase SQL Editor → 통째 박기 → Run
--   · BEGIN/COMMIT — 부분 실패 시 ROLLBACK
-- ============================================

BEGIN;

-- ============================================
-- [1] Trigger 함수 — 시나리오 3~8 박는 거
-- ============================================
CREATE OR REPLACE FUNCTION notify_lifecycle_push() RETURNS TRIGGER AS $$
DECLARE
  push_url     TEXT := 'https://ollit.vercel.app/api/push/send';
  api_key      TEXT;
  task_body    TEXT;
  cat          JSONB := COALESCE(NEW.category_data, '{}'::jsonb);
  work_type    TEXT := COALESCE(cat->>'workType', '작업');
  customer     TEXT := COALESCE(NEW.customer_name, '고객');
  cur_eng_code TEXT;
  old_eng_code TEXT;
BEGIN
  -- Vault 측 API key catch
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_API_KEY'
    LIMIT 1;

  IF api_key IS NULL OR api_key = '' THEN
    RAISE NOTICE '[lifecycle push] PUSH_API_KEY (vault) not configured — skipping';
    RETURN NEW;
  END IF;

  -- engineer code lookup (UUID → "E022" 박힘)
  IF NEW.assigned_engineer_id IS NOT NULL THEN
    SELECT code INTO cur_eng_code FROM users WHERE id = NEW.assigned_engineer_id;
  END IF;
  IF OLD.assigned_engineer_id IS NOT NULL THEN
    SELECT code INTO old_eng_code FROM users WHERE id = OLD.assigned_engineer_id;
  END IF;

  -- ============================================
  -- 시나리오 3 — 일정 확정 (scheduled_confirmed_at 처음 박힘)
  -- ============================================
  IF NEW.scheduled_confirmed_at IS NOT NULL AND OLD.scheduled_confirmed_at IS NULL THEN
    task_body := customer || ' · ' || work_type;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','📅 일정 확정','body',task_body,
        'url','/','tag','scheduled-' || NEW.id::text
      )
    );
  END IF;

  -- ============================================
  -- 시나리오 4 — 작업 시작 (started_at 처음 박힘)
  -- ============================================
  IF NEW.started_at IS NOT NULL AND OLD.started_at IS NULL THEN
    task_body := customer || ' · ' || work_type;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','▶️ 작업 시작','body',task_body,
        'url','/','tag','started-' || NEW.id::text
      )
    );
  END IF;

  -- ============================================
  -- 시나리오 5 — 작업 완료 (completed_at 처음 박힘)
  -- ============================================
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    task_body := customer || ' · ' || work_type;
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','✅ 작업 완료','body',task_body,
        'url','/','tag','completed-' || NEW.id::text
      )
    );
  END IF;

  -- ============================================
  -- 시나리오 6 — 일정 변경 (기존 확정 박힌 후 scheduled_at 변경)
  -- ============================================
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
     AND NEW.scheduled_at IS NOT NULL
     AND OLD.scheduled_confirmed_at IS NOT NULL
     AND NEW.scheduled_confirmed_at = OLD.scheduled_confirmed_at THEN
    task_body := customer || ' · ' || COALESCE(NEW.scheduled_at::text, '');
    -- 기사에게
    IF cur_eng_code IS NOT NULL THEN
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',cur_eng_code,
          'title','🔄 일정 변경','body',task_body,
          'url','/','tag','sched-change-' || NEW.id::text
        )
      );
    END IF;
    -- 운영자에게
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','🔄 일정 변경','body',task_body,
        'url','/','tag','sched-change-admin-' || NEW.id::text
      )
    );
  END IF;

  -- ============================================
  -- 시나리오 7 — 작업 취소 (status='취소')
  -- ============================================
  IF NEW.status = '취소' AND OLD.status IS DISTINCT FROM '취소' THEN
    task_body := customer || ' · ' || work_type;
    -- 기사에게 (배정 박혀있던 케이스)
    IF cur_eng_code IS NOT NULL THEN
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',cur_eng_code,
          'title','❌ 작업 취소','body',task_body,
          'url','/','tag','cancel-' || NEW.id::text
        )
      );
    END IF;
    -- 운영자에게
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','❌ 작업 취소','body',task_body,
        'url','/','tag','cancel-admin-' || NEW.id::text
      )
    );
  END IF;

  -- ============================================
  -- 시나리오 8 — 재배정 (assigned_engineer_id 변경, 옛 박혀있음)
  -- ============================================
  IF NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id
     AND OLD.assigned_engineer_id IS NOT NULL
     AND NEW.assigned_engineer_id IS NOT NULL THEN
    task_body := customer || ' · ' || work_type;
    -- 새 기사에게
    IF cur_eng_code IS NOT NULL THEN
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',cur_eng_code,
          'title','🔄 새 작업 배정 (재배정)','body',task_body,
          'url','/','tag','reassign-new-' || NEW.id::text
        )
      );
    END IF;
    -- 옛 기사에게
    IF old_eng_code IS NOT NULL THEN
      PERFORM net.http_post(
        url := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body := jsonb_build_object(
          'targetType','engineer','targetId',old_eng_code,
          'title','🔄 작업 재배정 (해제)','body',task_body,
          'url','/','tag','reassign-old-' || NEW.id::text
        )
      );
    END IF;
    -- 운영자에게
    PERFORM net.http_post(
      url := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body := jsonb_build_object(
        'targetType','role','targetId','admin',
        'title','🔄 프로 재배정','body',task_body,
        'url','/','tag','reassign-admin-' || NEW.id::text
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- [2] Trigger 박기 (AFTER UPDATE — 014 측과 분리 박힘)
-- ============================================
-- 기존 trigger 박혀있으면 박지 X (DROP 후 CREATE 패턴)
DROP TRIGGER IF EXISTS notify_lifecycle_push_trg ON tasks;
CREATE TRIGGER notify_lifecycle_push_trg
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_lifecycle_push();

COMMIT;

-- ============================================
-- (선택) 검증 SQL
-- ============================================
-- 1. 함수 박힌 거 catch:
-- SELECT proname FROM pg_proc WHERE proname IN ('notify_push_candidates', 'notify_lifecycle_push');
--
-- 2. trigger 박힌 거 catch:
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'tasks'::regclass AND tgname LIKE 'notify_%';
-- → notify_push_candidates_trg + notify_lifecycle_push_trg 박혀있어야 정답
--
-- 3. 실행 후 push 응답 catch:
-- SELECT id, status_code, content, created
--   FROM net._http_response
--   WHERE created > NOW() - INTERVAL '5 minutes'
--   ORDER BY created DESC LIMIT 20;
