-- ============================================================================
-- Migration 227 - 협력사 송금 보고 취소 (운영자)
-- 작성 2026-10-06 · 선행: 225
--
-- 내용
--   subcontractor_settlement_events   정산 처리 기록 (누가·언제·무엇을·사유)
--   admin_cancel_sub_daily_report     보고됨/차액 상태의 보고를 운영자가 취소 -> 다시 대기(잠금 해제)
--
-- 규칙
--   · 확인 완료 상태는 취소할 수 없습니다 (입금 확인을 먼저 취소).
--   · 사유 입력 필수. 취소자·사유·취소 전 보고 금액을 기록합니다.
--   · 취소하면 그 날짜에 고정해 둔 본 금액 줄을 지워 잠금을 풉니다.
--     그 날짜로 넘어와 있던 추가분/차감분 줄은 그대로 남습니다.
--   · 그 날짜의 작업이 "이미 보고된 뒷날짜" 에 추가분/차감분으로 걸려 있으면 취소를 거부합니다
--     (뒷날짜 금액이 틀어지기 때문 - 뒷날짜 보고를 먼저 취소해야 합니다).
--
-- 기존 데이터 영향: 없음 (새 표 1개, 새 함수 1개).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS subcontractor_settlement_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  subcontractor_id  uuid NOT NULL REFERENCES subcontractors(id),
  settle_date       date NOT NULL,
  event             text NOT NULL,              -- cancel_report (이후 종류 추가 가능)
  amount            int,
  reason            text,
  actor_id          uuid REFERENCES users(id),
  actor_name        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sub_settle_events_by_day ON subcontractor_settlement_events (subcontractor_id, settle_date);

ALTER TABLE subcontractor_settlement_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_settlement_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION admin_cancel_sub_daily_report(
  p_actor uuid, p_token text, p_subcontractor_id uuid, p_date date, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_s      subcontractor_daily_settlements%ROWTYPE;
  v_task   uuid;
  v_block  int;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '취소 사유를 입력해 주세요.');
  END IF;
  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_actor;

  SELECT * INTO v_s FROM subcontractor_daily_settlements
   WHERE subcontractor_id = p_subcontractor_id AND settle_date = p_date AND tenant_id = v_tenant
   FOR UPDATE;
  IF NOT FOUND OR v_s.reported_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '보고된 날짜가 아닙니다.');
  END IF;
  IF v_s.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 입금 확인된 날짜입니다. 입금 확인을 먼저 취소해 주세요.');
  END IF;

  -- 이 날짜의 작업이 이미 보고된 뒷날짜에 추가분/차감분으로 걸려 있으면 거부
  SELECT COUNT(*) INTO v_block
    FROM subcontractor_settlement_lines b
    JOIN subcontractor_settlement_lines a
      ON a.task_id = b.task_id AND a.kind = 'adjust' AND a.settle_date > p_date
   WHERE b.subcontractor_id = p_subcontractor_id AND b.settle_date = p_date AND b.kind = 'base'
     AND _sub_day_locked(a.subcontractor_id, a.settle_date);
  IF v_block > 0 THEN
    RETURN jsonb_build_object('ok', false,
      'error', '이 날짜의 작업 ' || v_block || '건이 이미 보고된 뒷날짜에 추가분·차감분으로 들어가 있습니다. 뒷날짜 보고를 먼저 취소해 주세요.');
  END IF;

  INSERT INTO subcontractor_settlement_events
    (tenant_id, subcontractor_id, settle_date, event, amount, reason, actor_id, actor_name)
  VALUES (v_tenant, p_subcontractor_id, p_date, 'cancel_report', v_s.reported_amount, LEFT(TRIM(p_reason), 500),
          p_actor, (SELECT name FROM users WHERE id = p_actor));

  -- 잠금 해제: 보고 기록을 비우고, 고정해 둔 본 금액 줄을 지운 뒤 해당 작업들의 추가분/차감분을 다시 맞춘다
  UPDATE subcontractor_daily_settlements
     SET reported_amount = NULL, reported_at = NULL, reported_by = NULL,
         note = LEFT('보고 취소: ' || TRIM(p_reason), 500)
   WHERE id = v_s.id;

  FOR v_task IN
    DELETE FROM subcontractor_settlement_lines
     WHERE subcontractor_id = p_subcontractor_id AND settle_date = p_date AND kind = 'base'
    RETURNING task_id
  LOOP
    PERFORM _sub_settle_sync_task(v_task);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'date', p_date);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_cancel_sub_daily_report(uuid, text, uuid, date, text) TO anon, authenticated;

COMMIT;

-- 검증: 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT admin_cancel_sub_daily_report('00000000-0000-0000-0000-000000000000'::uuid, NULL,
                                     '00000000-0000-0000-0000-000000000000'::uuid, CURRENT_DATE, '시험');
