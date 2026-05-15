-- ============================================
-- Migration 014 — 새 작업 push_candidates UPDATE 시 자동 push 발송
-- 작성일  : 2026-05-15
-- 범위    : tasks.push_candidates 변경 시 각 candidate에게 /api/push/send 비동기 호출
--          · 운영자가 자동 배정 화면 진입 → AutoAssignScreen이 push_candidates 박음
--          · 그 INSERT/UPDATE를 catch하여 각 기사 푸시 발송
--
-- 의존:
--   · pg_net extension (Supabase 기본 박혀있음 / 박지 X면 CREATE EXTENSION 박힘)
--   · Vault 측 PUSH_API_KEY 박힘 (vault.decrypted_secrets 박는 거)
--   · /api/push/send Vercel endpoint 배포 박힘 (ollit.vercel.app)
--
-- 흐름:
--   1. 운영자 작업 등록 → tasks INSERT (push_candidates 빈값)
--   2. 운영자 자동 배정 화면 진입 → AdminApp.jsx AutoAssignScreen
--      → supabase.update({ push_candidates: [...] }) 박음
--   3. ▶ 이 trigger 발화 → 각 candidate에게 /api/push/send POST
--   4. Vercel send.js → GAS 시트에서 구독 lookup → web-push로 발송
--   5. 기사 폰 SW → showNotification (절전 상태에서도 박힘)
--
-- 보호:
--   · push_candidates 박지 X / 빈 배열 → skip
--   · OLD = NEW (동일) → skip (재발송 박지 X)
--   · api_key (vault) 박지 X → silent skip (RAISE NOTICE만)
--   · net.http_post는 비동기 — response 안 기다림 (트랜잭션 부담 X)
--
-- 제한 사항 (별도 round 박을 차례):
--   · 수동 배정(assignEngineerDb) 측 push 박지 X — push_candidates 박지 X 박힘 (72203ee 측 Path B 박힘)
--   · 일정 확정/시작/완료 알림 별도 trigger 박을 차례 (Migration 015 측 박힘)
--
-- 실행:
--   · Supabase SQL Editor → 통째 박기 → Run
--   · Vault 측 PUSH_API_KEY 박은 후 박을 차례
-- ============================================

BEGIN;

-- ============================================
-- [1] pg_net extension 박기 (Supabase 기본 박혀있을 차례)
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- [2] Trigger function — push_candidates 변화 감지 → 발송
-- ============================================
CREATE OR REPLACE FUNCTION notify_push_candidates() RETURNS TRIGGER AS $$
DECLARE
  cand        TEXT;
  push_url    TEXT := 'https://ollit.vercel.app/api/push/send';
  api_key     TEXT;
  payload     JSONB;
  task_title  TEXT := '🚀 새 작업 도착';
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

  -- 메시지 박기 (고객명 · 지역 · 작업유형)
  cat := COALESCE(NEW.category_data, '{}'::jsonb);
  work_type := COALESCE(cat->>'workType', '작업');
  task_body := COALESCE(NEW.customer_name, '고객')
            || ' · ' || COALESCE(NEW.district, '지역?')
            || ' · ' || work_type;

  -- 각 candidate에게 비동기 발송 (response 안 기다림)
  FOR cand IN SELECT jsonb_array_elements_text(NEW.push_candidates) LOOP
    -- 빈 문자열 박힌 entry skip
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

-- ============================================
-- [3] Trigger 박기 (AFTER INSERT or UPDATE OF push_candidates)
-- ============================================
DROP TRIGGER IF EXISTS notify_push_candidates_trg ON tasks;
CREATE TRIGGER notify_push_candidates_trg
  AFTER INSERT OR UPDATE OF push_candidates ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_candidates();

COMMIT;

-- ============================================
-- [4] (선택) 즉시 검증 SQL — 박지 X. 운영자 측에서 박은 후 박을 차례.
-- ============================================
-- 새 작업 1건 박은 후 자동 배정 화면 → push_candidates 박힘 → trigger 발화 확인
--
-- 박혀있는 http 호출 큐 확인 (pg_net 큐):
-- SELECT id, status_code, content, error_msg, created
--   FROM net._http_response
--   ORDER BY created DESC LIMIT 10;
--
-- ▶ 박힌 응답 status_code = 200 + content = {"ok":true,...} → trigger OK
-- ▶ status_code = 401 → api_key 박은 거 다름 (ALTER DATABASE 박지 X 박힘)
-- ▶ status_code = 500 → Vercel 측 에러 (env / GAS)
-- ▶ 큐 비어있음 → trigger 발화 X (push_candidates 박지 X 또는 비활성)
