-- ============================================
-- Migration 015b — payload taskId + body appliance×qty 박기
-- 작성일  : 2026-05-15
-- 범위    : notify_push_candidates() + notify_lifecycle_push() 측 CREATE OR REPLACE
--
-- Spec 1 — payload 측 taskId 박기:
--   직전 spec — payload 측 taskId 박지 X
--   → SW 측 saveToIndexedDB(data) 측 data.taskId = null 박힘
--   → 인앱 알림 박힘 (autoIncrement 박힘) 그러나 박은 거 dedup 측 박지 X
--   → 시나리오 3~8 측 운영자 측 알림탭 측 박은 거 박지 X 박은 가능성 catch
--   박을 spec — 'taskId', NEW.id::text 박기 (모든 push payload 측 박힘)
--
-- Spec 2 — body 측 appliance × qty 박기:
--   직전 spec — body 측 "고객 · 지역 · 작업유형" 박힘 (3~8 측은 "고객 · 작업유형"만)
--   박을 spec — "고객 · 지역 · 작업유형 · 기종 ×수량" 박기
--   예: "나정이 · 강남구 · 세척 · 벽걸이 ×1"
--   category_data jsonb 측 박은 거 cat->>'appliance' / cat->>'qty' 박힘
--
-- 의존:
--   · Migration 014 박힘 (notify_push_candidates 함수 + trigger)
--   · Migration 015a 박힘 (notify_push_candidates 측 메시지 분기 박힘 / 015b 측 통째 박음)
--   · Migration 015 박힘 (notify_lifecycle_push 함수 + trigger)
--   · Vault 측 PUSH_API_KEY 박힘
--
-- 변경:
--   · 두 함수 모두 CREATE OR REPLACE 박힘
--   · trigger 측 박지 X (014 측 notify_push_candidates_trg / 015 측 notify_lifecycle_push_trg 그대로)
--
-- 실행:
--   · Supabase SQL Editor → 통째 박기 → Run
--   · BEGIN/COMMIT — 부분 실패 시 ROLLBACK
-- ============================================

BEGIN;

-- ============================================
-- [1] notify_push_candidates 측 CREATE OR REPLACE (시나리오 1, 2)
-- ============================================
CREATE OR REPLACE FUNCTION notify_push_candidates() RETURNS TRIGGER AS $$
DECLARE
  cand        TEXT;
  cand_count  INT;
  push_url    TEXT := 'https://ollit.vercel.app/api/push/send';
  api_key     TEXT;
  payload     JSONB;
  task_title  TEXT;
  task_body   TEXT;
  cat         JSONB;
  work_type   TEXT;
  appliance   TEXT;
  qty         INT;
BEGIN
  IF NEW.push_candidates IS NULL OR jsonb_array_length(NEW.push_candidates) = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.push_candidates = NEW.push_candidates THEN
    RETURN NEW;
  END IF;

  -- Vault 측 API key catch
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_API_KEY'
    LIMIT 1;

  IF api_key IS NULL OR api_key = '' THEN
    RAISE NOTICE '[push trigger] PUSH_API_KEY (vault) not configured — skipping';
    RETURN NEW;
  END IF;

  -- 시나리오 분기 (015a 측 박힌 거 그대로)
  cand_count := jsonb_array_length(NEW.push_candidates);
  IF cand_count >= 2 THEN
    task_title := '📥 새 접수 도착';
  ELSE
    task_title := '🎯 작업 배정';
  END IF;

  -- 2026-05-15 Spec 2 — body 측 appliance × qty 박기
  cat := COALESCE(NEW.category_data, '{}'::jsonb);
  work_type := COALESCE(cat->>'workType', '작업');
  appliance := COALESCE(cat->>'appliance', '');
  qty       := COALESCE((cat->>'qty')::int, 1);
  task_body := COALESCE(NEW.customer_name, '고객')
            || ' · ' || COALESCE(NEW.district, '지역?')
            || ' · ' || work_type
            || CASE WHEN appliance != ''
                 THEN ' · ' || appliance || ' ×' || qty::text
                 ELSE '' END;

  FOR cand IN SELECT jsonb_array_elements_text(NEW.push_candidates) LOOP
    IF cand IS NULL OR cand = '' THEN CONTINUE; END IF;

    -- 2026-05-15 Spec 1 — payload 측 taskId 박기 (SW saveToIndexedDB 측 catch)
    payload := jsonb_build_object(
      'targetType', 'engineer',
      'targetId',   cand,
      'title',      task_title,
      'body',       task_body,
      'url',        '/',
      'tag',        'new-task-' || NEW.id::text,
      'taskId',     NEW.id::text
    );

    PERFORM net.http_post(
      url     := push_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-API-Key',    api_key
      ),
      body    := payload
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- [2] notify_lifecycle_push 측 CREATE OR REPLACE (시나리오 3~8)
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
  old_eng_code   TEXT;
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
    SELECT code INTO cur_eng_code FROM users WHERE id = NEW.assigned_engineer_id;
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

  -- ====== 시나리오 7 — 작업 취소 ======
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ============================================
-- (선택) 검증 SQL
-- ============================================
-- 1. 함수 박힌 spec catch (가장 최근 박힌 거):
-- SELECT proname, prosrc FROM pg_proc
--   WHERE proname IN ('notify_push_candidates', 'notify_lifecycle_push');
-- → body 측 박힌 거 "appliance" + "qty" 박혀있어야 정답 / payload 측 'taskId' 박혀있어야 정답
--
-- 2. trigger 박힌 거 그대로 catch:
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'tasks'::regclass AND tgname LIKE 'notify_%';
-- → notify_push_candidates_trg + notify_lifecycle_push_trg 박혀있어야 정답
--
-- 3. 새 push 박은 후 response catch:
-- SELECT id, status_code, (content::jsonb)->>'sent' as sent, created
--   FROM net._http_response
--   WHERE created > NOW() - INTERVAL '5 minutes'
--   ORDER BY created DESC LIMIT 10;
