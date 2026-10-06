-- ============================================================================
-- Migration 233 - 협력사 이월 금액: 환급 처리로 닫기
-- 작성 2026-10-06 · 선행: 225, 227, 228, 229
--
-- 사장님 결정 (2026-10-06)
--   이월(합계가 음수) 금액을 받을 날이 계속 생기지 않으면, 운영자가 협력사에 그 금액을
--   돌려주고 [환급 처리로 닫기] 로 마감합니다.
--     · 금액·사유 입력 -> 그 이월 줄 잠금 (화면 상태 "환급 완료")
--     · 가계부 현금에 지출 1줄 자동 기록
--     · 처리 기록(누가·언제·금액·사유) 남김
--
-- 내용
--   [1] subcontractor_daily_settlements 에 refunded_at / refund_amount / refund_reason 칸 추가
--   [2] admin_close_sub_carry_refund (신규)
--       · 운영자만. 대상은 "가장 마지막 이월 날짜" (뒤에 열린 날짜가 있으면 그날로 넘어가므로 거부)
--       · 금액은 이월 금액과 같아야 합니다 (화면이 미리 채워 줍니다)
--       · 앞선 이월 날짜들의 줄을 이 날짜로 모아 함께 잠급니다 (송금 보고와 같은 방식)
--   [3] admin_confirm_sub_daily_fee (mig 229 감싸기 함수) 에 보호 한 조각 추가
--       환급으로 닫은 날짜는 입금 확인·확인 취소를 할 수 없습니다.
--       이 함수는 저장소의 mig 229 본문에서 자동으로 만들었고, 끼운 조각을 빼면 229 와 완전히 같습니다.
--
-- 기존 데이터 영향: 없음 (칸 3개 추가, 함수 1개 추가, 함수 1개에 보호 조각).
-- 되돌리기: 환급 처리를 잘못 닫았으면 SQL 로만 풉니다 (화면에는 되돌리기 버튼을 두지 않았습니다).
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 칸 추가
-- ============================================================
ALTER TABLE subcontractor_daily_settlements
  ADD COLUMN IF NOT EXISTS refunded_at   timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount int,
  ADD COLUMN IF NOT EXISTS refund_reason text;

-- ============================================================
-- [2] 환급 처리로 닫기
-- ============================================================
CREATE OR REPLACE FUNCTION admin_close_sub_carry_refund(
  p_actor uuid, p_token text, p_subcontractor_id uuid, p_date date, p_amount int, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_name   text;
  v_plan   record;
  v_src    date;
  v_fee    int;
  v_recv   int;
  v_cnt    int;
  v_id     uuid;
  v_reason text := LEFT(btrim(COALESCE(p_reason, '')), 500);
  v_cash   text := NULL;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF v_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '사유를 입력해 주세요.');
  END IF;
  SELECT tenant_id, name INTO v_tenant, v_name FROM subcontractors WHERE id = p_subcontractor_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사를 찾지 못했습니다.');
  END IF;
  IF _sub_day_locked(p_subcontractor_id, p_date) THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 닫힌 날짜입니다.');
  END IF;

  SELECT * INTO v_plan FROM _sub_open_plan(p_subcontractor_id) pl WHERE pl.d = p_date;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 날짜에는 이월 금액이 없습니다.');
  END IF;
  IF v_plan.total >= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '돌려줄 금액이 없습니다 (합계가 음수인 날짜만 닫을 수 있습니다).');
  END IF;
  IF EXISTS (SELECT 1 FROM _sub_open_plan(p_subcontractor_id) pl WHERE pl.d > p_date) THEN
    RETURN jsonb_build_object('ok', false, 'error', '뒤에 열린 날짜가 있습니다. 이 금액은 그 날짜 송금에서 차감됩니다.');
  END IF;
  IF p_amount IS NULL OR p_amount <> -v_plan.total THEN
    RETURN jsonb_build_object('ok', false, 'error',
      '환급 금액이 이월 금액과 다릅니다. 이월 금액: ' || (-v_plan.total) || '원');
  END IF;

  -- 앞선 이월 날짜들의 줄을 이 날짜로 모은다 (원래 날짜는 origin_date 에 남김) - 송금 보고와 같은 방식
  FOREACH v_src IN ARRAY COALESCE(v_plan.carry_from, ARRAY[]::date[]) LOOP
    INSERT INTO subcontractor_settlement_lines
      (tenant_id, subcontractor_id, settle_date, task_id, kind, fee, received, supply, engineer_id, origin_date, memo)
    SELECT v_tenant, p_subcontractor_id, p_date, l.task_id, 'base', l.fee, l.received, l.supply, l.engineer_id, v_src, '이월'
      FROM _sub_day_lines(p_subcontractor_id, v_src) l
     WHERE l.kind = 'base';
    UPDATE subcontractor_settlement_lines
       SET settle_date = p_date,
           origin_date = COALESCE(origin_date, v_src),
           memo        = COALESCE(memo, '') || ' · 이월'
     WHERE subcontractor_id = p_subcontractor_id AND settle_date = v_src AND kind = 'adjust';
  END LOOP;

  -- 이 날짜의 본 금액을 줄로 고정
  INSERT INTO subcontractor_settlement_lines
    (tenant_id, subcontractor_id, settle_date, task_id, kind, fee, received, supply, engineer_id)
  SELECT v_tenant, p_subcontractor_id, p_date, l.task_id, 'base', l.fee, l.received, l.supply, l.engineer_id
    FROM _sub_day_lines(p_subcontractor_id, p_date) l
   WHERE l.kind = 'base'
     AND NOT EXISTS (SELECT 1 FROM subcontractor_settlement_lines x WHERE x.task_id = l.task_id AND x.kind = 'base');

  SELECT COALESCE(SUM(fee), 0)::int,
         COALESCE(SUM(received) FILTER (WHERE kind = 'base' AND origin_date IS NULL), 0)::int,
         (COUNT(*) FILTER (WHERE kind = 'base' AND origin_date IS NULL))::int
    INTO v_fee, v_recv, v_cnt
    FROM subcontractor_settlement_lines
   WHERE subcontractor_id = p_subcontractor_id AND settle_date = p_date;

  IF v_fee <> v_plan.total THEN
    -- 모은 줄 합계가 계획과 다르면 아무것도 남기지 않고 멈춘다
    RAISE EXCEPTION '줄 합계(%)가 이월 금액(%)과 다릅니다. 처리하지 않았습니다.', v_fee, v_plan.total;
  END IF;

  INSERT INTO subcontractor_daily_settlements
    (tenant_id, subcontractor_id, settle_date, calc_fee, calc_received, task_count,
     reported_amount, reported_at, reported_by, confirmed_at, confirmed_by, note,
     refunded_at, refund_amount, refund_reason)
  VALUES (v_tenant, p_subcontractor_id, p_date, v_fee, v_recv, v_cnt,
          v_fee, now(), p_actor, now(), p_actor, '환급 완료',
          now(), p_amount, v_reason)
  ON CONFLICT (subcontractor_id, settle_date) DO UPDATE
    SET calc_fee = EXCLUDED.calc_fee, calc_received = EXCLUDED.calc_received, task_count = EXCLUDED.task_count,
        reported_amount = EXCLUDED.reported_amount, reported_at = now(), reported_by = p_actor,
        confirmed_at = now(), confirmed_by = p_actor, note = '환급 완료',
        refunded_at = now(), refund_amount = EXCLUDED.refund_amount, refund_reason = EXCLUDED.refund_reason
  RETURNING id INTO v_id;

  INSERT INTO subcontractor_settlement_events
    (tenant_id, subcontractor_id, settle_date, event, amount, reason, actor_id, actor_name)
  VALUES (v_tenant, p_subcontractor_id, p_date, 'refund', p_amount, v_reason,
          p_actor, (SELECT name FROM users WHERE id = p_actor));

  -- 가계부 현금: 지출 1줄 (기록 실패가 환급 처리를 되돌리지 않게 하고, 결과에 표시)
  BEGIN
    INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
    VALUES (v_tenant, 'out', p_amount, (now() AT TIME ZONE 'Asia/Seoul')::date,
            '협력사 수수료 환급 · ' || COALESCE(v_name, '') || ' · ' || to_char(p_date, 'MM/DD') || ' 이월분',
            p_actor, 'sub_refund', v_id)
    ON CONFLICT (source, source_ref) WHERE source IS NOT NULL DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    v_cash := SQLERRM;
  END;

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'refund_amount', p_amount)
         || CASE WHEN v_cash IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('cashflow_error', v_cash) END;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_close_sub_carry_refund(uuid, text, uuid, date, int, text) TO anon, authenticated;

-- ============================================================
-- [3] 입금 확인 감싸기 함수 - 환급으로 닫은 날짜 보호
-- ============================================================
CREATE OR REPLACE FUNCTION admin_confirm_sub_daily_fee(
  p_actor uuid, p_token text, p_subcontractor_id uuid, p_date date, p_confirm boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_res  jsonb;
  v_s    subcontractor_daily_settlements%ROWTYPE;
  v_name text;
BEGIN
  -- Mig 233: 환급 처리로 닫은 날짜는 입금 확인·확인 취소 대상이 아니다
  IF EXISTS (SELECT 1 FROM subcontractor_daily_settlements
              WHERE subcontractor_id = p_subcontractor_id AND settle_date = p_date AND refunded_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', '환급 처리로 닫은 날짜는 바꿀 수 없습니다.');
  END IF;
  v_res := _impl_admin_confirm_sub_daily_fee(p_actor, p_token, p_subcontractor_id, p_date, p_confirm);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RETURN v_res;
  END IF;

  SELECT * INTO v_s FROM subcontractor_daily_settlements
   WHERE subcontractor_id = p_subcontractor_id AND settle_date = p_date;
  IF NOT FOUND THEN
    RETURN v_res;
  END IF;

  BEGIN
    IF p_confirm THEN
      IF COALESCE(v_s.reported_amount, 0) > 0 THEN
        SELECT name INTO v_name FROM subcontractors WHERE id = p_subcontractor_id;
        INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
        VALUES (v_s.tenant_id, 'in', v_s.reported_amount, (now() AT TIME ZONE 'Asia/Seoul')::date,
                '협력사 수수료 · ' || COALESCE(v_name, '') || ' · ' || to_char(p_date, 'MM/DD') || ' 작업분',
                p_actor, 'sub_fee', v_s.id)
        ON CONFLICT (source, source_ref) WHERE source IS NOT NULL DO NOTHING;
      END IF;
    ELSE
      DELETE FROM bookkeeping_cashflow WHERE source = 'sub_fee' AND source_ref = v_s.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 가계부 기록 실패가 입금 확인 자체를 되돌리지 않게 한다 (결과에 표시)
    RETURN v_res || jsonb_build_object('cashflow_error', SQLERRM);
  END;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_confirm_sub_daily_fee(uuid, text, uuid, date, boolean) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 칸 3개 - 기대: 3행
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'subcontractor_daily_settlements'
   AND column_name IN ('refunded_at', 'refund_amount', 'refund_reason') ORDER BY 1;

-- 2) 세션 없이 호출하면 거부 - 기대: {"ok": false, "error": "다시 로그인해 주세요."}
SELECT admin_close_sub_carry_refund(NULL, NULL, NULL, NULL, NULL, '시험');
