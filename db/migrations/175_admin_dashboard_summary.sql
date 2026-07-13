-- ============================================================================
-- Migration 175 — get_admin_dashboard_summary (읽기 전용 RPC)
-- 작성 : 2026-07-13
-- 목적 : 운영 대시보드 상단 '오늘 매출 현황' 카드 숫자를 서버 집계.
--        브라우저가 tasks 전체 (~2,300건) 를 내려받아 클라 계산하던 것을 대체.
--        오늘 이미 DB 과부하로 다운 이력 있음 → **읽기 전용 + 인덱스 안전** 만.
--
-- ⚠️ 이번 커밋 = 파일 생성 (Stage 1). 사장님 SQL Editor 에서 BEGIN/ROLLBACK 로
--     드라이런 → 반환값이 현재 대시보드 숫자와 일치하는지 눈으로 대조 후에만
--     실제 CREATE. React 교체는 Stage 2 (별도 커밋).
--
-- 의존:
--   · _caller_is_admin(uuid) — Mig 098
--   · payments (track / engineer_amount / principal_amount / owner_amount) — Mig 025+
--   · tasks (status / completed_at / category_data) — Mig 001
--   · task_items → work_types → service_types (main service code 판별)
--   · principals (principal_code = 'usol_n' 판별)
--   · inquiries (Mig 117 계열 — status='new' 카운트)
--
-- 클라 계산 참조 (반드시 일치):
--   src/utils/dashboardStats.js       — computeDashboardStats revenueBaseTasks
--   src/utils/revenueStats.js         — computeRevenueByYmRange (byServiceDetail)
--   src/utils/remitFilter.js          — isTrackARemittance = track='A' AND isCompletedStatus
--   src/utils/taskStatus.js           — isCompletedStatus = status IN ('완료','visit_only')
--
-- 매출 base 필터 (사장님 spec 확정):
--   task.status IN ('완료','visit_only')
--   AND completed_at KST 오늘 (Asia/Seoul)
--   AND payments.track = 'A' (트랙 🅐 = 일일정산)
--
-- 반환 필드 (jsonb):
--   {
--     "date_kst": "2026-07-13",
--     "revenue": {
--       "total": ...,           -- Σ total_amount (product+extra+travel)
--       "engineer_settle": ..., -- Σ payments.engineer_amount
--       "principal_fee": ...,   -- Σ payments.principal_amount
--       "company_margin": ...   -- Σ payments.owner_amount
--     },
--     "by_service": {
--       "cleaning":    { "count": ..., "amount": ..., "owner": ... },
--       "refrigerant": { "count": ..., "amount": ..., "owner": ... },
--       "install":     { "count": ..., "amount": ..., "owner": ... },
--       "leak":        { "count": ..., "amount": ..., "owner": ... },
--       "other":       { "count": ..., "amount": ..., "owner": ... }
--     },
--     "counts": {
--       "unassigned":         ...,  -- status='미배정' + _isUsolNMainRefrigerant 필터
--       "inquiry_new":        ...,  -- inquiries.status='new'
--       "reassign":           ...,  -- category_data->reassignRequest->>requestedAt IS NOT NULL AND status<>'취소'
--       "refri_unprocessed":  ...   -- category_data->refrigerant_addon->>processed = 'false'
--     }
--   }
--
-- 회귀 방지:
--   · SECURITY DEFINER + search_path=public + _caller_is_admin 권한 체크.
--   · 스키마 변경 X (CREATE OR REPLACE FUNCTION 만). 인덱스 추가 X (본 커밋).
--   · 실패 시 EXCEPTION 로 명시 (클라 fallback 필요).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION get_admin_dashboard_summary(
  p_actor    uuid,
  p_date_kst text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_start        timestamptz;
  v_day_end          timestamptz;
  v_ymd              text;
  -- revenue
  v_total            bigint := 0;
  v_engineer         bigint := 0;
  v_principal        bigint := 0;
  v_owner            bigint := 0;
  -- by_service (cleaning/refrigerant/install/leak/other) — count, amount, owner
  v_c_cnt int := 0; v_c_amt bigint := 0; v_c_own bigint := 0;
  v_r_cnt int := 0; v_r_amt bigint := 0; v_r_own bigint := 0;
  v_i_cnt int := 0; v_i_amt bigint := 0; v_i_own bigint := 0;
  v_l_cnt int := 0; v_l_amt bigint := 0; v_l_own bigint := 0;
  v_o_cnt int := 0; v_o_amt bigint := 0; v_o_own bigint := 0;
  -- counts
  v_unassigned       int := 0;
  v_inquiry_new      int := 0;
  v_reassign         int := 0;
  v_refri_unproc     int := 0;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION '미로그인 — actor 필요';
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;
  IF p_date_kst IS NULL THEN
    RAISE EXCEPTION 'p_date_kst 필요 (YYYY-MM-DD)';
  END IF;

  v_ymd       := p_date_kst;
  v_day_start := (p_date_kst || ' 00:00:00 Asia/Seoul')::timestamptz;
  v_day_end   := ((p_date_kst::date + 1) || ' 00:00:00 Asia/Seoul')::timestamptz;

  -- ── [1] 매출 base (track A + 완료계열 + KST 오늘 completed) ────────────
  -- payments.track = 'A' 만 대상 (일일정산). visit_only 는 완료 계열 (payments 정상).
  -- LATERAL 로 각 task 의 main service_code 판별 (order_type='본작업' 우선).
  WITH base AS (
    SELECT
      t.id            AS task_id,
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
      AND t.completed_at >= v_day_start
      AND t.completed_at <  v_day_end
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

  -- ── [2] unassigned_count — 미배정 + _isUsolNMainRefrigerant 필터 ──────
  -- 클라 spec: 6원청 전부 포함. usol_n 은 본작업 refrigerant 만 포함.
  SELECT COUNT(*)::int INTO v_unassigned
  FROM tasks t
  LEFT JOIN principals pr ON pr.id = t.principal_id
  WHERE t.status = '미배정'
    AND (
      COALESCE(pr.code, '') <> 'usol_n'
      OR EXISTS (
        SELECT 1
        FROM task_items ti
        LEFT JOIN work_types wt    ON wt.id = ti.work_type_id
        LEFT JOIN service_types st ON st.id = wt.service_type_id
        WHERE ti.task_id = t.id
          AND NOT COALESCE(ti.is_canceled, false)
          AND ti.order_type = '본작업'
          AND st.code = 'refrigerant'
      )
    );

  -- ── [3] inquiry_new — inquiries.status='new' (누적) ───────────────────
  BEGIN
    SELECT COUNT(*)::int INTO v_inquiry_new
    FROM inquiries
    WHERE status = 'new';
  EXCEPTION WHEN OTHERS THEN
    v_inquiry_new := 0;   -- inquiries 없는 환경 방어
  END;

  -- ── [4] reassign_count — 재배정 요청 + 취소 아님 ──────────────────────
  SELECT COUNT(*)::int INTO v_reassign
  FROM tasks
  WHERE category_data ? 'reassignRequest'
    AND (category_data->'reassignRequest'->>'requestedAt') IS NOT NULL
    AND status <> '취소';

  -- ── [5] refri_unprocessed_count — refrigerant_addon.processed=false ───
  SELECT COUNT(*)::int INTO v_refri_unproc
  FROM tasks
  WHERE category_data ? 'refrigerant_addon'
    AND (category_data->'refrigerant_addon'->>'processed') = 'false';

  RETURN jsonb_build_object(
    'date_kst', v_ymd,
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
    ),
    'counts', jsonb_build_object(
      'unassigned',        v_unassigned,
      'inquiry_new',       v_inquiry_new,
      'reassign',          v_reassign,
      'refri_unprocessed', v_refri_unproc
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_dashboard_summary(uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION get_admin_dashboard_summary(uuid, text) IS
  '2026-07-13 Mig 175 — 운영 대시보드 오늘 매출 카드 서버 집계. '
  'base 필터: task.status IN 완료/visit_only + completed_at KST 오늘 + payments.track=A. '
  '반환: revenue (total/engineer/principal/owner) + by_service (5종 count/amount/owner) + counts (4종).';

COMMIT;


-- ============================================================================
-- 사장님 실행 순서 (Stage 1 검증):
-- ============================================================================
-- [A] 드라이런 (실제 CREATE 전 임시 트랜잭션 안 검증):
--
-- BEGIN;
--   -- 위 CREATE OR REPLACE 실행 (본 파일 상단 부분).
--
--   SELECT get_admin_dashboard_summary(
--     '<사장님 user_id UUID>'::uuid,
--     to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
--   );
--
--   -- 반환 jsonb 를 현재 대시보드 카드 숫자와 눈으로 대조:
--   --   · revenue.total           = 오늘 매출 총액
--   --   · revenue.engineer_settle = 기사 정산 합
--   --   · revenue.principal_fee   = 원청 수수료 합
--   --   · revenue.company_margin  = 회사 마진 합
--   --   · by_service.cleaning.count / amount = 세척 완료 건수 / 금액
--   --   · by_service.refrigerant.count / amount = 냉매 완료 건수 / 금액
--   --   · counts.unassigned  = 미배정 개수 (핑크 카드)
--   --   · counts.inquiry_new = 접수함 신규
--   --   · counts.reassign    = 재배정 요청
--   --   · counts.refri_unprocessed = 냉매 미처리
--
-- ROLLBACK;
--
-- 눈 대조 결과 정확히 일치하면 → 재실행 (COMMIT 포함) 로 실제 CREATE.
-- 값 하나라도 어긋나면 Coco에게 리포트 → 계산 로직 재확인.
--
-- ============================================================================
-- 참고 인덱스 (부하 심하면 별건 커밋으로 검토):
-- ============================================================================
-- 매출 base 쿼리 hot path:
--   CREATE INDEX IF NOT EXISTS idx_tasks_status_completed_at
--     ON tasks (status, completed_at)
--     WHERE status IN ('완료', 'visit_only');
--   CREATE INDEX IF NOT EXISTS idx_payments_track_task_id
--     ON payments (track, task_id);
--
-- ⚠️ 인덱스 CREATE 는 lock 유발 가능 — 트래픽 낮은 시간에 CONCURRENTLY 로 별도 실행.
