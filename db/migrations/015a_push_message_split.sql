-- ============================================
-- Migration 015a — Migration 014 함수 측 메시지 분기 박음
-- 작성일  : 2026-05-15
-- 범위    : notify_push_candidates() 측 N>=2 / N==1 분기 박힘
--          · 시나리오 1 (자동 broadcast, push_candidates N>=2): "📥 새 접수 도착"
--          · 시나리오 2 (수동 배정, push_candidates N==1):       "🎯 작업 배정"
--
-- 의존:
--   · Migration 014 박힘 (notify_push_candidates 함수 + trigger)
--   · Vault 측 PUSH_API_KEY 박힘 (current_setting 박지 X / decrypted_secrets 박는 거)
--
-- 변경:
--   · 함수만 CREATE OR REPLACE (trigger 측 박지 X)
--   · api_key 박는 방식: current_setting → SELECT FROM vault.decrypted_secrets
--   · cand_count = jsonb_array_length(NEW.push_candidates) 측 분기 박힘
--
-- 실행:
--   · Supabase SQL Editor → 통째 박기 → Run
-- ============================================

BEGIN;

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
BEGIN
  -- push_candidates 박지 X 또는 빈 배열 → skip
  IF NEW.push_candidates IS NULL OR jsonb_array_length(NEW.push_candidates) = 0 THEN
    RETURN NEW;
  END IF;

  -- UPDATE 시 OLD = NEW (동일) → skip (재발송 박지 X)
  IF TG_OP = 'UPDATE' AND OLD.push_candidates = NEW.push_candidates THEN
    RETURN NEW;
  END IF;

  -- 2026-05-15 — Vault 측 API key catch (current_setting 박지 X)
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_API_KEY'
    LIMIT 1;

  IF api_key IS NULL OR api_key = '' THEN
    RAISE NOTICE '[push trigger] PUSH_API_KEY (vault) not configured — skipping';
    RETURN NEW;
  END IF;

  -- 2026-05-15 시나리오 분기 — push_candidates 개수로 판단
  --   N>=2: 자동 broadcast (냉매충전 등) → 📥 새 접수 도착
  --   N==1: 수동 배정 (세척 등) → 🎯 작업 배정
  cand_count := jsonb_array_length(NEW.push_candidates);
  IF cand_count >= 2 THEN
    task_title := '📥 새 접수 도착';
  ELSE
    task_title := '🎯 작업 배정';
  END IF;

  -- 메시지 박기 (고객명 · 지역 · 작업유형)
  cat := COALESCE(NEW.category_data, '{}'::jsonb);
  work_type := COALESCE(cat->>'workType', '작업');
  task_body := COALESCE(NEW.customer_name, '고객')
            || ' · ' || COALESCE(NEW.district, '지역?')
            || ' · ' || work_type;

  -- 각 candidate에게 비동기 발송 (response 안 기다림)
  FOR cand IN SELECT jsonb_array_elements_text(NEW.push_candidates) LOOP
    IF cand IS NULL OR cand = '' THEN CONTINUE; END IF;

    payload := jsonb_build_object(
      'targetType', 'engineer',
      'targetId',   cand,
      'title',      task_title,
      'body',       task_body,
      'url',        '/',
      'tag',        'new-task-' || NEW.id::text
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

COMMIT;

-- ============================================
-- (선택) 검증 SQL — 함수 측 박힌 거 catch
-- ============================================
-- SELECT prosrc FROM pg_proc WHERE proname = 'notify_push_candidates';
-- → 박힌 함수 body 측 "📥 새 접수 도착" / "🎯 작업 배정" 박혀있어야 정답
