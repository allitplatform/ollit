-- ============================================================================
-- Migration 107 — 정산 완료 → 원청 push (테이블 트리거 2개)
-- 2026-06-08
--
-- 배경:
--   사장님 spec — 정산 완료 시 해당 원청 partner 에게 푸시.
--   금액은 본문에 포함 (정산만은 본인 입금액 노출).
--
-- 트리거 2개:
--   ① principal_daily_remittances AFTER INSERT — KA/crikrin/usol_h(일별).
--   ② principal_weekly_remittances AFTER UPDATE OF confirmed_at WHEN
--      OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL — usol_n(주간).
--
-- 왜 RPC 본문 변경 X / 테이블 트리거?
--   · mark_principal_daily_remit / confirm_principal_remittance 본체 무수정.
--   · 향후 RPC 추가/변경 무관 — DB row 생성/확정 시점에 자동 발사.
--
-- kind = 'partnerSettle' (Mig 108 whitelist).
-- ============================================================================

BEGIN;

-- ============================================================================
-- [1] 일별 정산 입금 push (KA/crikrin/usol_h 등 — principal_daily_remittances)
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_partner_daily_settle_push()
RETURNS TRIGGER AS $$
DECLARE
  push_url     TEXT := 'https://ollit.vercel.app/api/push/send';
  api_key      TEXT;
  v_p_user     uuid;
  v_p_name     TEXT;
  v_body       TEXT;
  v_amount_str TEXT;
BEGIN
  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets WHERE name = 'PUSH_API_KEY' LIMIT 1;
  IF api_key IS NULL OR api_key = '' THEN RETURN NEW; END IF;

  -- 원청 이름 + 금액 본문 구성
  SELECT name INTO v_p_name FROM principals WHERE id = NEW.principal_id;
  v_amount_str := to_char(COALESCE(NEW.remitted_amount, 0), 'FM999,999,999');
  v_body := COALESCE(v_p_name, '원청')
         || ' · ' || COALESCE(NEW.settle_date::text, '')
         || ' · ₩' || v_amount_str;

  -- partner LOOP
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
        'title','💰 정산 완료','body', v_body,
        'url','/','tag','settle-daily-' || NEW.id::text || '-' || v_p_user::text,
        'kind', 'partnerSettle'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_partner_daily_settle_trg ON principal_daily_remittances;
CREATE TRIGGER notify_partner_daily_settle_trg
  AFTER INSERT ON principal_daily_remittances
  FOR EACH ROW EXECUTE FUNCTION notify_partner_daily_settle_push();

-- ============================================================================
-- [2] 주간 정산 입금 push (usol_n — principal_weekly_remittances)
--    confirmed_at NULL → NOT NULL 전환 시점 (= 운영자 입금 확인).
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_partner_weekly_settle_push()
RETURNS TRIGGER AS $$
DECLARE
  push_url     TEXT := 'https://ollit.vercel.app/api/push/send';
  api_key      TEXT;
  v_p_user     uuid;
  v_p_name     TEXT;
  v_body       TEXT;
  v_amount_str TEXT;
BEGIN
  -- confirmed_at 전환 시점만 (NULL → NOT NULL)
  IF NOT (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO api_key
    FROM vault.decrypted_secrets WHERE name = 'PUSH_API_KEY' LIMIT 1;
  IF api_key IS NULL OR api_key = '' THEN RETURN NEW; END IF;

  SELECT name INTO v_p_name FROM principals WHERE id = NEW.principal_id;
  v_amount_str := to_char(COALESCE(NEW.remitted_amount, 0), 'FM999,999,999');
  v_body := COALESCE(v_p_name, '원청')
         || ' · ' || COALESCE(NEW.week_start::text, '')
         || '~' || COALESCE(NEW.week_end::text, '')
         || ' · ₩' || v_amount_str;

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
        'title','💰 정산 완료','body', v_body,
        'url','/','tag','settle-weekly-' || NEW.id::text || '-' || v_p_user::text,
        'kind', 'partnerSettle'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_partner_weekly_settle_trg ON principal_weekly_remittances;
CREATE TRIGGER notify_partner_weekly_settle_trg
  AFTER UPDATE OF confirmed_at ON principal_weekly_remittances
  FOR EACH ROW EXECUTE FUNCTION notify_partner_weekly_settle_push();

COMMIT;

-- 검증
SELECT tgname, tgrelid::regclass, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname IN ('notify_partner_daily_settle_trg','notify_partner_weekly_settle_trg');
