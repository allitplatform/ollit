-- Migration 193 - engineer assignment SMS (2026-07-26)
--
-- WHY
--   Push to engineer phones can be delayed (doze / stale subscription).
--   Owner decision: send SMS on every assignment as a guaranteed channel.
--   Reassignment is the riskier case, so BOTH sides get one:
--     new engineer -> 'eng_assign'  (you got this job)
--     old engineer -> 'eng_unassign' (job removed, do not visit)
--
-- HOW
--   Extends sms_send_notify() (Mig 146 + 184). Existing customer branches
--   (assign / complete / visit_fee) unchanged, still gated by the principal
--   whitelist. NEW engineer branches have NO principal guard - engineers
--   need this for every principal including usol_n.
--   Fires on any UPDATE that changes assigned_engineer_id (app, timeline
--   RPC, admin form - all paths hit the same column).
--   Same-engineer reselect (Mig 192 case) does NOT fire (IS DISTINCT FROM).
--
-- DEPLOY ORDER (critical, same as Mig 184):
--   1. push api/sms/send.js first (adds eng_assign / eng_unassign types)
--   2. then run this SQL
--   (SQL first would make the API reject the new types - fire-and-forget,
--    no retry, messages lost.)

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
  -- customer branches below - unchanged (Mig 146 + 184), whitelist gated
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
  'Mig 146+184+193 - SMS trigger. Customer: assign/complete/visit_fee (principal whitelist). Engineer: eng_assign/eng_unassign on engineer change (all principals).';

-- VERIFY - expect: 함수 1 / 트리거 1
SELECT
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'sms_send_notify')                    AS 함수,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE '%sms%' AND NOT tgisinternal)    AS 트리거;
