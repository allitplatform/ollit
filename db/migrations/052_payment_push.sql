-- ============================================
-- Migration 052 — payments 측 push trigger 신규 (입금 보고 + 입금 확인)
-- 작성일  : 2026-05-22
-- 범위    : payments AFTER UPDATE — engineer_remitted_at / engineer_remit_confirmed_at
--          첫 SET 시점에 각각 알림 발사
--
-- 시나리오:
--   5C-1. 입금 보고 (engineer_remitted_at NULL → SET)
--         → 운영자(role='admin')에게 "💸 입금 보고 도착" 알림
--         · 기사가 회사로 송금 후 보고 버튼 누름
--         · 23:00 KST 마감 흐름 — 즉시 인지 필요
--   5C-2. 입금 확인 (engineer_remit_confirmed_at NULL → SET)
--         → 해당 기사(engineer code)에게 "✅ 입금 확인 완료" 알림
--         · 운영자가 통장에서 입금 확인 후 확인 버튼
--         · 기사 입장에서 본인 보고 처리 여부 확인
--
-- 송금액 공식 (입금 내역 탭과 통일):
--   송금액 = product_price + extra_fee + travel_fee - engineer_amount
--         = 회사 보유분 + 원청 송금분
--
-- 의존:
--   · pg_net extension (Migration 014 이전에 설치 완료)
--   · Vault PUSH_API_KEY
--   · Migration 025 (engineer_remitted_at / engineer_remit_confirmed_at 컬럼)
--   · Migration 026 (payments anon UPDATE RLS — 클라이언트 UPDATE 가능)
--   · tasks.assigned_engineer_id → users.code 매핑 (engineer code 조회)
--
-- 안전장치:
--   · NEW vs OLD 비교로 첫 SET만 catch (재발사 방지)
--   · api_key NULL 또는 빈값 → silent skip (RAISE NOTICE)
--   · task 조회 실패 시 SKIP (UPDATE 자체는 통과)
--   · 입금 확인 측: engineer code NULL 이면 skip (배정 없는 작업 방어)
--   · cancelConfirmRemit (NULL 되돌리기) 측은 첫 SET 조건 아니므로 발사 X
--
-- 회귀 방지:
--   · payments 측 다른 trigger / 함수 / 컬럼 영향 0
--   · 기존 tasks 측 trigger (014/051) 영향 0
--
-- 실행:
--   · Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   · BEGIN/COMMIT — 부분 실패 시 ROLLBACK
-- ============================================

BEGIN;

-- ============================================
-- [1] Trigger 함수 — payments UPDATE 측 engineer_remit_* 변화 감지
-- ============================================
CREATE OR REPLACE FUNCTION notify_payment_push() RETURNS TRIGGER AS $$
DECLARE
  push_url       TEXT := 'https://ollit.vercel.app/api/push/send';
  api_key        TEXT;
  v_customer     TEXT;
  v_engineer_id  uuid;
  v_eng_code     TEXT;
  v_eng_name     TEXT;
  v_remit_amount INT;
  v_amount_label TEXT;
  task_body      TEXT;
BEGIN
  -- 첫 SET 두 케이스 모두 만족 안 하면 즉시 종료 (불필요 lookup 회피)
  IF (NEW.engineer_remitted_at IS NULL OR OLD.engineer_remitted_at IS NOT NULL)
     AND (NEW.engineer_remit_confirmed_at IS NULL OR OLD.engineer_remit_confirmed_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  -- Vault 측 API key
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_API_KEY'
    LIMIT 1;

  IF api_key IS NULL OR api_key = '' THEN
    RAISE NOTICE '[payment push] PUSH_API_KEY (vault) not configured — skipping';
    RETURN NEW;
  END IF;

  -- task + engineer 정보 조회 (한 번에)
  SELECT t.customer_name, t.assigned_engineer_id, u.code, u.name
    INTO v_customer, v_engineer_id, v_eng_code, v_eng_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_engineer_id
    WHERE t.id = NEW.task_id;

  IF v_customer IS NULL THEN
    -- task 조회 실패 — 발사 skip, UPDATE 자체는 통과
    RAISE NOTICE '[payment push] task lookup 실패 task_id=% — skipping', NEW.task_id;
    RETURN NEW;
  END IF;

  -- 송금액 = totalAmount - engineer_amount (회사 보유 + 원청 송금분)
  v_remit_amount := COALESCE(NEW.product_price, 0)
                  + COALESCE(NEW.extra_fee, 0)
                  + COALESCE(NEW.travel_fee, 0)
                  - COALESCE(NEW.engineer_amount, 0);
  IF v_remit_amount < 0 THEN v_remit_amount := 0; END IF;
  v_amount_label := '₩' || to_char(v_remit_amount, 'FM999,999,999');

  -- ====== 시나리오 5C-1 — 입금 보고 (운영자에게) ======
  IF NEW.engineer_remitted_at IS NOT NULL AND OLD.engineer_remitted_at IS NULL THEN
    task_body := COALESCE(v_eng_name, v_eng_code, '기사')
              || ' · ' || COALESCE(v_customer, '고객')
              || ' · ' || v_amount_label;
    PERFORM net.http_post(
      url     := push_url,
      headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
      body    := jsonb_build_object(
        'targetType', 'role',
        'targetId',   'admin',
        'title',      '💸 입금 보고 도착',
        'body',       task_body,
        'url',        '/',
        'tag',        'remit-report-' || NEW.task_id::text,
        'taskId',     NEW.task_id::text
      )
    );
  END IF;

  -- ====== 시나리오 5C-2 — 입금 확인 (해당 기사에게) ======
  IF NEW.engineer_remit_confirmed_at IS NOT NULL AND OLD.engineer_remit_confirmed_at IS NULL THEN
    -- engineer code 없으면 발사 X (배정 없는 작업 방어)
    IF v_eng_code IS NOT NULL THEN
      task_body := COALESCE(v_customer, '고객') || ' · ' || v_amount_label;
      PERFORM net.http_post(
        url     := push_url,
        headers := jsonb_build_object('Content-Type','application/json','X-API-Key',api_key),
        body    := jsonb_build_object(
          'targetType', 'engineer',
          'targetId',   v_eng_code,
          'title',      '✅ 입금 확인 완료',
          'body',       task_body,
          'url',        '/',
          'tag',        'remit-confirm-' || NEW.task_id::text,
          'taskId',     NEW.task_id::text
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_payment_push() IS
  'payment push — 입금 보고(운영자) / 입금 확인(기사). Migration 052.';

-- ============================================
-- [2] Trigger 등록 (AFTER UPDATE on payments)
-- ============================================
DROP TRIGGER IF EXISTS notify_payment_push_trg ON payments;
CREATE TRIGGER notify_payment_push_trg
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_push();

COMMIT;

-- ============================================
-- 검증 SQL
-- ============================================
-- 1. 함수 등록 확인:
-- SELECT proname, obj_description(p.oid, 'pg_proc') AS note
-- FROM pg_proc p
-- WHERE p.proname = 'notify_payment_push';
-- → 기대: note = 'payment push — 입금 보고(운영자) / 입금 확인(기사). Migration 052.'
--
-- 2. trigger 등록 확인:
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'payments'::regclass AND tgname = 'notify_payment_push_trg';
-- → 기대: notify_payment_push_trg 한 줄
--
-- 3. 실제 발사 검증 (기사 1명 입금 보고 + 운영자 확인 후):
-- SELECT id, status_code, content::jsonb->>'sent' AS sent, created
-- FROM net._http_response
-- WHERE created > NOW() - INTERVAL '5 minutes'
-- ORDER BY created DESC LIMIT 20;
-- → 기대: 보고 1건 + 확인 1건 발사
--
-- 4. cancelConfirmRemit (NULL 되돌리기) 측 발사 안 하는지 확인:
--    confirmed → reported 되돌리는 케이스 — OLD.engineer_remit_confirmed_at IS NOT NULL
--    이므로 5C-2 분기 진입 X. 안전.
