-- Migration 184 — SMS 출장비(visit_only) 안내 발송 추가 (2026-07-21).
--
-- 배경 (사장님 발견): 출장비 4만원 건은 고객 문자가 안 감.
--   원인 — mark_visit_only(Mig 054/178) 는 status 를 'visit_only' 로 바꾸는데,
--   sms_send_notify(Mig 146) 완료 분기는 status='완료' 전환만 감지 → 출장비 건 발송 누락.
--
-- 변경: sms_send_notify 에 visit_only 분기 추가.
--   · 조건: status → 'visit_only' 전환 + sms_complete_sent_at NULL(중복 차단, 완료 플래그 재사용)
--           + travel_fee > 0 + 고객 phone 존재. 대상 원청 가드(allday/KA/usol_h/yongin/crikrin)는 기존 그대로.
--   · 금액: NEW.travel_fee (mark_visit_only 가 같은 UPDATE 에서 set — 30,000/40,000 규칙 자동 반영).
--   · endpoint type 'visit_fee' — /api/sms/send 에 템플릿 추가됨 (커밋: 출장비 안내).
--
-- ⚠️ 적용 순서: ① api/sms/send.js 배포(push→Vercel) 먼저 → ② 본 SQL 실행.
--    (SQL 먼저 실행하면 API 가 type 거부 → 발송 유실. fire-and-forget 이라 재시도 없음.)
-- ⚠️ 배정/완료 분기 로직 변경 0 — 기존 함수에 분기 추가만. BEFORE UPDATE 트리거 재사용 (재등록 불필요).

CREATE OR REPLACE FUNCTION sms_send_notify() RETURNS TRIGGER AS $$
DECLARE
  v_endpoint    TEXT := 'https://ollit.vercel.app/api/sms/send';
  v_secret      TEXT;
  v_principal   TEXT;
  v_eng_name    TEXT;
  v_eng_phone   TEXT;
  v_is_assign   BOOLEAN := FALSE;
  v_is_complete BOOLEAN := FALSE;
  v_is_visit    BOOLEAN := FALSE;
BEGIN
  SELECT code INTO v_principal FROM principals WHERE id = NEW.principal_id;
  IF v_principal IS NULL
     OR v_principal NOT IN ('allday','KA','usol_h','yongin','crikrin') THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'SMS_TRIGGER_SECRET'
    LIMIT 1;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE '[sms_send_notify] SMS_TRIGGER_SECRET (vault) 미등록 — skip';
    RETURN NEW;
  END IF;

  -- 배정 분기 (기존 그대로)
  IF NEW.assigned_engineer_id IS NOT NULL
     AND NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id
     AND NEW.status NOT IN ('완료', '취소')
     AND NEW.phone IS NOT NULL
     AND NEW.phone <> ''
  THEN
    SELECT name, phone INTO v_eng_name, v_eng_phone
      FROM users
      WHERE id = NEW.assigned_engineer_id;
    IF v_eng_name IS NOT NULL  AND v_eng_name  <> ''
       AND v_eng_phone IS NOT NULL AND v_eng_phone <> ''
    THEN
      v_is_assign := TRUE;
    END IF;
  END IF;

  -- 완료 분기 (기존 그대로)
  IF NEW.status = '완료'
     AND OLD.status IS DISTINCT FROM '완료'
     AND NEW.received_total IS NOT NULL
     AND NEW.sms_complete_sent_at IS NULL
     AND NEW.phone IS NOT NULL
     AND NEW.phone <> ''
  THEN
    v_is_complete := TRUE;
  END IF;

  -- 출장비 분기 (Mig 184 신규) — visit_only 전환 시 딱 한 번.
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
        'type',          'assign',
        'principal',     v_principal,
        'customerPhone', NEW.phone,
        'vars', jsonb_build_object(
          'engineerName',  v_eng_name,
          'engineerPhone', v_eng_phone
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
        'vars', jsonb_build_object(
          'amount', NEW.received_total
        )
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
        'vars', jsonb_build_object(
          'amount', NEW.travel_fee
        )
      )
    );
    NEW.sms_complete_sent_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sms_send_notify() IS
  'Migration 146+184 — SMS 발송 트리거 함수. 배정/완료(146) + 출장비 visit_only(184). principal IN (allday/KA/usol_h/yongin/crikrin) 가드.';
