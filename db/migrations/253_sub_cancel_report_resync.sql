-- ============================================================================
-- Migration 253 - 날짜 보고 취소 때 수수료가 두 번 잡히지 않게
-- 작성 2026-10-07 · 선행: 227, 252
--
-- !! db/ops/verify_sub_cancel_double.sql 결과가 "재현됨" 일 때만 실행합니다. !!
--
-- 문제
--   날짜 D 를 보고(잠금)한 뒤에 끝난 작업은 본 금액 줄이 없고, 다음 날짜에 추가 줄만 있다.
--   그 상태에서 D 의 보고를 취소하면 D 가 다시 열리면서 그 작업이 "D 의 본 금액" 으로 실시간 집계되는데,
--   다음 날짜의 추가 줄은 그대로 남는다 -> 같은 수수료가 두 번 잡힌다.
--   (227 은 D 에 본 금액 줄이 있던 작업만 다시 맞춘다)
--
-- 수정 (사장님 결정 2026-10-07)
--   날짜 보고 취소 시, 그 날짜 작업 때문에 생긴 다음 날짜 추가 줄(아직 보고 · 잠금 안 된 것)을 지우고 다시 계산한다.
--   그 추가 줄이 이미 보고된(잠긴) 날짜에 들어가 있으면 취소를 막고 안내한다.
--
-- 방식: mig 252 의 감싸기 함수(admin_cancel_sub_daily_report)를 다시 정의한다.
--       안쪽 원본(_impl_admin_cancel_sub_daily_report = mig 227 본문)은 건드리지 않는다.
--       252 의 "추가분 보고가 있으면 막기" 는 그대로 들어 있다.
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('_impl_admin_cancel_sub_daily_report(uuid, text, uuid, date, text)') IS NULL THEN
    RAISE EXCEPTION 'mig 252 를 먼저 실행해 주세요 (_impl_admin_cancel_sub_daily_report 없음).';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION admin_cancel_sub_daily_report(
  p_actor uuid, p_token text, p_subcontractor_id uuid, p_date date, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cnt  int;
  v_res  jsonb;
  v_task uuid;
BEGIN
  -- 로그인 · 권한이 맞지 않으면 원본이 내는 안내를 그대로 돌려준다
  IF NOT _session_check_strict(p_actor, p_token) OR NOT _caller_is_admin(p_actor) THEN
    RETURN _impl_admin_cancel_sub_daily_report(p_actor, p_token, p_subcontractor_id, p_date, p_reason);
  END IF;

  -- Mig 252: 이 날짜 작업의 추가분 보고가 있으면 먼저 막는다
  SELECT COUNT(DISTINCT e.id) INTO v_cnt
    FROM subcontractor_fee_extras e
    JOIN subcontractor_fee_extra_lines el ON el.extra_id = e.id
   WHERE e.subcontractor_id = p_subcontractor_id
     AND (el.origin_date = p_date
          OR EXISTS (SELECT 1 FROM subcontractor_settlement_lines b
                      WHERE b.task_id = el.task_id AND b.kind = 'base' AND b.settle_date = p_date));
  IF v_cnt > 0 THEN
    RETURN jsonb_build_object('ok', false,
      'error', '이 날짜 작업의 추가분 보고가 ' || v_cnt || '건 있습니다. 추가분 보고를 먼저 취소해 주세요.');
  END IF;

  -- Mig 253: 이 날짜를 잠근 뒤에 끝난 작업(본 금액 줄 없음)의 추가 줄이 이미 보고된 뒷날짜에 있으면 막는다
  SELECT COUNT(DISTINCT a.task_id) INTO v_cnt
    FROM subcontractor_settlement_lines a
   WHERE a.subcontractor_id = p_subcontractor_id AND a.kind = 'adjust'
     AND a.origin_date = p_date AND a.settle_date <> p_date
     AND _sub_day_locked(a.subcontractor_id, a.settle_date)
     AND NOT EXISTS (SELECT 1 FROM subcontractor_settlement_lines b WHERE b.task_id = a.task_id AND b.kind = 'base');
  IF v_cnt > 0 THEN
    RETURN jsonb_build_object('ok', false,
      'error', '이 날짜의 작업 ' || v_cnt || '건이 이미 보고된 뒷날짜에 추가분으로 들어가 있습니다. 뒷날짜 보고를 먼저 취소해 주세요.');
  END IF;

  v_res := _impl_admin_cancel_sub_daily_report(p_actor, p_token, p_subcontractor_id, p_date, p_reason);
  IF NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RETURN v_res;
  END IF;

  -- Mig 253: 이 날짜 때문에 생긴 열린 추가 줄을 다시 맞춘다
  --   (날짜가 다시 열렸으므로 그 작업은 이 날짜의 본 금액으로 집계된다 -> 추가 줄은 지워진다)
  FOR v_task IN
    SELECT DISTINCT a.task_id
      FROM subcontractor_settlement_lines a
     WHERE a.subcontractor_id = p_subcontractor_id AND a.kind = 'adjust' AND a.origin_date = p_date
       AND NOT _sub_day_locked(a.subcontractor_id, a.settle_date)
       AND NOT EXISTS (SELECT 1 FROM subcontractor_settlement_lines b WHERE b.task_id = a.task_id AND b.kind = 'base')
  LOOP
    PERFORM _sub_settle_sync_task(v_task);
  END LOOP;

  RETURN v_res;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_cancel_sub_daily_report(uuid, text, uuid, date, text) TO anon, authenticated;

COMMIT;

-- 검증
-- 1) 조각이 들어갔는가 - 기대: true
SELECT prosrc LIKE '%Mig 253%' AS has_253 FROM pg_proc WHERE proname = 'admin_cancel_sub_daily_report';
-- 2) 세션 없이 호출 - 기대: "다시 로그인해 주세요."
SELECT admin_cancel_sub_daily_report('00000000-0000-0000-0000-000000000000'::uuid, NULL,
                                     '00000000-0000-0000-0000-000000000000'::uuid, CURRENT_DATE, '시험');
