-- Migration 202 — 고객용 재배정 문자 분리 (2026-07-30)
--
-- WHY
--   지금까지 재배정(기사 A → 기사 B)에도 고객에겐 초배정과 똑같은
--   "기사 배정 안내" 문자가 그대로 나갔다. 고객 입장에선 이름/번호만 다른
--   같은 문자가 두 번 오는 셈이라 "기사 두 명이 배정됐나?"(이중배정)로 읽힌다.
--   게다가 앞 기사 연락처가 무효라는 안내가 없어 잘못된 번호로 전화하는
--   사고가 생길 수 있다.
--   → 재배정일 때만 type='reassign' 으로 보내 문구를 분리한다.
--
-- WHAT CHANGES (Mig 193 대비 딱 한 곳)
--   고객 배정 분기의 http_post 에서 'type' 을 고정 'assign' 이 아니라
--   OLD.assigned_engineer_id 유무로 'assign' / 'reassign' 중 선택.
--   발화 조건 / 화이트리스트 / 기사 분기 / 완료 / 출장비 — 전부 무변경.
--
-- DEPLOY ORDER (critical — Mig 184/193 과 동일)
--   1. api/sms/send.js 먼저 push (reassign 타입 + eng_assign 재배정 문구)
--   2. 그다음 본 SQL 실행
--   (SQL 먼저면 API 가 reassign 을 400 으로 거절 — pg_net 은 fire-and-forget,
--    재시도 없음 → 문자 영구 소실.)

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
BEGIN
  SELECT code INTO v_principal FROM principals WHERE id = NEW.principal_id;

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
          'vars', jsonb_build_object('amount', NEW.received_total)
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

COMMENT ON FUNCTION sms_send_notify() IS
  'Mig 146+184+193+202 - SMS trigger. Customer: assign/reassign/complete/visit_fee (principal whitelist). Engineer: eng_assign(+reassigned flag)/eng_unassign on engineer change (all principals).';

-- VERIFY — 기대: 함수 1 / 트리거 1 / 재배정분기 ✅ 있음
SELECT
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'sms_send_notify')                 AS 함수,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE '%sms%' AND NOT tgisinternal) AS 트리거,
  CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname = 'sms_send_notify')
            LIKE '%v_assign_type := ''reassign''%'
       THEN '✅ 있음' ELSE '❌ 없음' END                                            AS 재배정분기;
