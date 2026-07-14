-- ============================================================================
-- Migration 176 — get_admin_dashboard_summary_range (읽기 전용 RPC)
-- 작성 : 2026-07-14
-- 목적 : 대시보드 매출 카드 '이번 달' 토글 + 전월비(▲%) 서버 집계.
--        Mig 175 (get_admin_dashboard_summary, 당일 전용) 의 기간 버전.
--        클라는 이 RPC 를 3회 병렬 호출: (이번달 1일~오늘) / (전월 동일일 하루)
--        / (전월 1일~동일일). 각 ~0.2s.
--
-- 의존 / base 필터 / service_code 판별 = Mig 175 와 100% 동일:
--   task.status IN ('완료','visit_only')
--   AND completed_at KST [p_start_kst 00:00, p_end_kst 다음날 00:00)
--   AND payments.track = 'A'
--   main service_code = task_items order_type='본작업' 우선 (is_canceled 제외)
--
-- counts 없음 — 시점성 카운트는 Mig 175 가 담당. 이 RPC 는 기간 매출만.
--
-- 반환 (jsonb):
--   {
--     "start_kst": "2026-07-01", "end_kst": "2026-07-14",
--     "revenue": { total, engineer_settle, principal_fee, company_margin },
--     "by_service": { cleaning/refrigerant/install/leak/other:
--                     { count, amount, owner } }
--   }
--
-- 회귀 방지:
--   · SECURITY DEFINER + search_path=public + _caller_is_admin.
--   · 읽기 전용. 스키마 변경 X, 인덱스 추가 X.
--   · 실패 시 EXCEPTION → 클라는 옛 방식(fallback)으로 계산.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION get_admin_dashboard_summary_range(
  p_actor     uuid,
  p_start_kst text,
  p_end_kst   text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start   timestamptz;
  v_end     timestamptz;
  v_total   bigint := 0;
  v_engineer bigint := 0;
  v_principal bigint := 0;
  v_owner   bigint := 0;
  v_c_cnt int := 0; v_c_amt bigint := 0; v_c_own bigint := 0;
  v_r_cnt int := 0; v_r_amt bigint := 0; v_r_own bigint := 0;
  v_i_cnt int := 0; v_i_amt bigint := 0; v_i_own bigint := 0;
  v_l_cnt int := 0; v_l_amt bigint := 0; v_l_own bigint := 0;
  v_o_cnt int := 0; v_o_amt bigint := 0; v_o_own bigint := 0;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION '미로그인 — actor 필요';
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;
  IF p_start_kst IS NULL OR p_end_kst IS NULL THEN
    RAISE EXCEPTION '기간 (p_start_kst, p_end_kst) 필요 (YYYY-MM-DD)';
  END IF;
  IF p_start_kst::date > p_end_kst::date THEN
    RAISE EXCEPTION '시작일이 종료일보다 늦음';
  END IF;
  -- 과도 범위 방어 (읽기 전용이지만 실수 방지) — 최대 366일.
  IF (p_end_kst::date - p_start_kst::date) > 366 THEN
    RAISE EXCEPTION '기간이 366일 초과';
  END IF;

  v_start := (p_start_kst || ' 00:00:00 Asia/Seoul')::timestamptz;
  v_end   := ((p_end_kst::date + 1) || ' 00:00:00 Asia/Seoul')::timestamptz;

  WITH base AS (
    SELECT
      t.total_amount  AS total_amount,
      p.engineer_amount,
      p.principal_amount,
      p.owner_amount,
      main.service_code
    FROM tasks t
    JOIN payments p
      ON p.task_id = t.id AND p.track = 'A'
    LEFT JOIN LATERAL (
      SELECT st.code AS service_code
      FROM task_items ti
      LEFT JOIN work_types wt    ON wt.id = ti.work_type_id
      LEFT JOIN service_types st ON st.id = wt.service_type_id
      WHERE ti.task_id = t.id
        AND NOT COALESCE(ti.is_canceled, false)
      ORDER BY (ti.order_type = '본작업') DESC, ti.id ASC
      LIMIT 1
    ) main ON TRUE
    WHERE t.status IN ('완료', 'visit_only')
      AND t.completed_at >= v_start
      AND t.completed_at <  v_end
  )
  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(engineer_amount), 0),
    COALESCE(SUM(principal_amount), 0),
    COALESCE(SUM(owner_amount), 0),
    COALESCE(SUM(CASE WHEN service_code = 'cleaning'    THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'cleaning'    THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'cleaning'    THEN owner_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'refrigerant' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'refrigerant' THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'refrigerant' THEN owner_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'install'     THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'install'     THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'install'     THEN owner_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'leak'        THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'leak'        THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code = 'leak'        THEN owner_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code IS NULL
                        OR service_code NOT IN ('cleaning','refrigerant','install','leak')
                      THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code IS NULL
                        OR service_code NOT IN ('cleaning','refrigerant','install','leak')
                      THEN total_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN service_code IS NULL
                        OR service_code NOT IN ('cleaning','refrigerant','install','leak')
                      THEN owner_amount ELSE 0 END), 0)
  INTO
    v_total, v_engineer, v_principal, v_owner,
    v_c_cnt, v_c_amt, v_c_own,
    v_r_cnt, v_r_amt, v_r_own,
    v_i_cnt, v_i_amt, v_i_own,
    v_l_cnt, v_l_amt, v_l_own,
    v_o_cnt, v_o_amt, v_o_own
  FROM base;

  RETURN jsonb_build_object(
    'start_kst', p_start_kst,
    'end_kst',   p_end_kst,
    'revenue', jsonb_build_object(
      'total',           v_total,
      'engineer_settle', v_engineer,
      'principal_fee',   v_principal,
      'company_margin',  v_owner
    ),
    'by_service', jsonb_build_object(
      'cleaning',    jsonb_build_object('count', v_c_cnt, 'amount', v_c_amt, 'owner', v_c_own),
      'refrigerant', jsonb_build_object('count', v_r_cnt, 'amount', v_r_amt, 'owner', v_r_own),
      'install',     jsonb_build_object('count', v_i_cnt, 'amount', v_i_amt, 'owner', v_i_own),
      'leak',        jsonb_build_object('count', v_l_cnt, 'amount', v_l_amt, 'owner', v_l_own),
      'other',       jsonb_build_object('count', v_o_cnt, 'amount', v_o_amt, 'owner', v_o_own)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_dashboard_summary_range(uuid, text, text) TO anon, authenticated;

COMMENT ON FUNCTION get_admin_dashboard_summary_range(uuid, text, text) IS
  '2026-07-14 Mig 176 — 대시보드 매출 카드 기간 집계 (이번 달 토글 + 전월비). '
  'base 필터 = Mig 175 와 동일 (완료/visit_only + completed_at KST 범위 + track=A).';

COMMIT;

-- ============================================================================
-- 검증 (실행 후 SQL Editor 에서):
--   1) 이번 달 = get_admin_dashboard_summary_range(uuid, '2026-07-01', '오늘')
--      → 대시보드 '이번 달' 토글 숫자와 대조
--   2) 오늘 하루 범위 = 175 오늘 결과와 완전 일치해야 함:
--      SELECT get_admin_dashboard_summary_range(u, d, d) = 175 결과의 revenue 부분
-- ============================================================================
