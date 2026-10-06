-- ============================================================================
-- Migration 224 - 고객 문자: 종목 이름 + 완료 문자의 부가세 포함 여부 전달
-- 작성 2026-10-06 · 선행: 218, 223
--
-- ★★ 실행 순서 (SMS 규칙) ★★
--   api/sms/send.js 가 push·배포된 것을 확인한 "뒤에" 실행합니다.
--
-- 변경점 (mig 218 의 sms_send_notify 본문 그대로 + 3곳)
--   · 고객용 배정·재배정·완료 문자에 serviceName(종목 이름) 을 덧붙입니다.
--     주방후드 작업이면 "주방후드", 그 외는 기존대로 "에어컨" -> "신청하신 주방후드 서비스에…"
--   협력사 작업 완료 문자의 vars 에 vatIncluded(부가세 포함해서 받았는지) 를 덧붙입니다.
--   -> 문자: "받은 금액 ○○원" / 체크한 경우에만 "받은 금액 ○○원 (부가세 포함)"
--   그 외 분기와 발송 조건은 바꾸지 않았습니다. 이 파일은 mig 218 본문에서 자동으로 만들었습니다.
--
-- 직영·원청의 에어컨 작업: 지금과 완전히 같은 문자가 나갑니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION sms_send_notify() RETURNS TRIGGER AS $$
DECLARE
  v_endpoint    TEXT := 'https://ollit.vercel.app/api/sms/send';
  v_secret      TEXT;
  v_principal   TEXT;
  v_eng_name    TEXT;
  v_eng_phone   TEXT;
  v_old_phone   TEXT;
  v_is_assign   BOOLEAN := FALSE;
  v_is_complete BOOLEAN := FALSE;
  v_is_visit    BOOLEAN := FALSE;
  v_cust_ok     BOOLEAN := TRUE;
  v_sched       TEXT;
  v_assign_type TEXT := 'assign';   -- [Mig 202] 재배정이면 'reassign'
  v_service_name TEXT := '에어컨';  -- [Mig 224] 고객 문자에 넣을 종목 이름
BEGIN
  SELECT code INTO v_principal FROM principals WHERE id = NEW.principal_id;

  -- [Mig 224] 종목 이름 - 작업 종류가 주방후드 계열이면 '주방후드', 그 외는 기존대로 '에어컨'
  IF COALESCE(NEW.category_data ->> 'workType', '') LIKE '주방후드%'
     OR COALESCE(NEW.category_data ->> 'workType', '') LIKE '후드설치%'
     OR COALESCE(NEW.category_data -> 'workItems' -> 0 ->> 'workType', '') LIKE '주방후드%'
     OR COALESCE(NEW.category_data -> 'workItems' -> 0 ->> 'workType', '') LIKE '후드설치%' THEN
    v_service_name := '주방후드';
  END IF;

  -- Customer-SMS principal whitelist (Mig 146/184 behavior, unchanged).
  -- Engineer SMS below is NOT gated by this.
  IF v_principal IS NULL
     OR v_principal NOT IN ('allday','KA','usol_h','yongin','crikrin') THEN
    v_cust_ok := FALSE;
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'SMS_TRIGGER_SECRET'
    LIMIT 1;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE '[sms_send_notify] SMS_TRIGGER_SECRET (vault) missing - skip';
    RETURN NEW;
  END IF;

  -- ============================================================
  -- [Mig 193] engineer branches - fire on engineer change, all principals
  -- ============================================================
  IF NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id
     AND NEW.status NOT IN ('완료', '취소')
  THEN
    v_sched := COALESCE(
      to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'), '');

    -- new engineer -> eng_assign
    IF NEW.assigned_engineer_id IS NOT NULL THEN
      SELECT name, phone INTO v_eng_name, v_eng_phone
        FROM users WHERE id = NEW.assigned_engineer_id;
      IF v_eng_phone IS NOT NULL AND v_eng_phone <> '' THEN
        PERFORM net.http_post(
          url     := v_endpoint,
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body    := jsonb_build_object(
            'secret',        v_secret,
            'type',          'eng_assign',
            'principal',     COALESCE(v_principal, ''),
            'customerPhone', v_eng_phone,
            'vars', jsonb_build_object(
              'customer',   COALESCE(NEW.customer_name, ''),
              'region',     COALESCE(NEW.district, ''),
              'scheduled',  v_sched,
              'taskNo',     COALESCE(NEW.task_no, ''),
              'reassigned', (OLD.assigned_engineer_id IS NOT NULL)
            )
          )
        );
      END IF;
    END IF;

    -- previous engineer -> eng_unassign (reassign or unassign)
    IF OLD.assigned_engineer_id IS NOT NULL THEN
      SELECT phone INTO v_old_phone
        FROM users WHERE id = OLD.assigned_engineer_id;
      IF v_old_phone IS NOT NULL AND v_old_phone <> '' THEN
        PERFORM net.http_post(
          url     := v_endpoint,
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body    := jsonb_build_object(
            'secret',        v_secret,
            'type',          'eng_unassign',
            'principal',     COALESCE(v_principal, ''),
            'customerPhone', v_old_phone,
            'vars', jsonb_build_object(
              'customer', COALESCE(NEW.customer_name, ''),
              'region',   COALESCE(NEW.district, ''),
              'taskNo',   COALESCE(NEW.task_no, '')
            )
          )
        );
      END IF;
    END IF;
  END IF;

  -- ============================================================
  -- customer branches (Mig 146 + 184), whitelist gated
  -- ============================================================
  IF v_cust_ok THEN

    IF NEW.assigned_engineer_id IS NOT NULL
       AND NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id
       AND NEW.status NOT IN ('완료', '취소')
       AND NEW.phone IS NOT NULL
       AND NEW.phone <> ''
    THEN
      IF v_eng_name IS NULL THEN
        SELECT name, phone INTO v_eng_name, v_eng_phone
          FROM users WHERE id = NEW.assigned_engineer_id;
      END IF;
      IF v_eng_name IS NOT NULL  AND v_eng_name  <> ''
         AND v_eng_phone IS NOT NULL AND v_eng_phone <> ''
      THEN
        v_is_assign := TRUE;
        -- [Mig 202] 앞에 기사가 있었으면 재배정 — 문구 분리
        IF OLD.assigned_engineer_id IS NOT NULL THEN
          v_assign_type := 'reassign';
        END IF;
      END IF;
    END IF;

    IF NEW.status = '완료'
       AND OLD.status IS DISTINCT FROM '완료'
       AND NEW.received_total IS NOT NULL
       AND NEW.sms_complete_sent_at IS NULL
       AND NEW.phone IS NOT NULL
       AND NEW.phone <> ''
    THEN
      v_is_complete := TRUE;
    END IF;

    IF NEW.status = 'visit_only'
       AND OLD.status IS DISTINCT FROM 'visit_only'
       AND COALESCE(NEW.travel_fee, 0) > 0
       AND NEW.sms_complete_sent_at IS NULL
       AND NEW.phone IS NOT NULL
       AND NEW.phone <> ''
    THEN
      v_is_visit := TRUE;
    END IF;

    IF v_is_assign THEN
      PERFORM net.http_post(
        url     := v_endpoint,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := jsonb_build_object(
          'secret',        v_secret,
          'type',          v_assign_type,        -- [Mig 202] assign / reassign
          'principal',     v_principal,
          'customerPhone', NEW.phone,
          'vars', jsonb_build_object(
            'engineerName',  v_eng_name,
            'engineerPhone', v_eng_phone,
            'serviceName',   v_service_name
          )
        )
      );
    END IF;

    IF v_is_complete THEN
      PERFORM net.http_post(
        url     := v_endpoint,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := jsonb_build_object(
          'secret',        v_secret,
          'type',          'complete',
          'principal',     v_principal,
          'customerPhone', NEW.phone,
          'vars', jsonb_build_object('amount', NEW.received_total, 'serviceName', v_service_name)
                  || CASE WHEN NEW.subcontractor_id IS NOT NULL AND COALESCE(NEW.supply_amount, 0) > 0
                          THEN jsonb_build_object('supplyAmount', NEW.supply_amount,
                                                  'vatIncluded',  COALESCE(NEW.vat_included, false))
                          ELSE '{}'::jsonb END
        )
      );
      NEW.sms_complete_sent_at := NOW();
    END IF;

    IF v_is_visit THEN
      PERFORM net.http_post(
        url     := v_endpoint,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := jsonb_build_object(
          'secret',        v_secret,
          'type',          'visit_fee',
          'principal',     v_principal,
          'customerPhone', NEW.phone,
          'vars', jsonb_build_object('amount', NEW.travel_fee)
        )
      );
      NEW.sms_complete_sent_at := NOW();
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- 검증: 기대 true
SELECT pg_get_functiondef('sms_send_notify()'::regprocedure) LIKE '%vatIncluded%' AS 적용됨;
