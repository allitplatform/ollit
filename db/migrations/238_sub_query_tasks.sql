-- ============================================================================
-- Migration 238 - 협력사 관리자 PC: 기간별 작업 조회 (타임라인 · 전체 작업 검색)
-- 작성 2026-10-06 · 선행: 214, 237
--
-- 내용
--   sub_query_tasks (신규, 읽기 전용)
--     · 협력사 관리자만, 자기 협력사 작업만 (세션 확인 필수)
--     · 기간: 방문일(일정일, 없으면 희망일, 그것도 없으면 완료일·접수일) 기준 p_from ~ p_to
--     · 선택 조건: 기사, 검색어(고객명 · 주소 · 작업번호 · 전화 뒷자리)
--     · 단계·기간 안의 모든 상태(취소 포함), 최대 1000건
--     · sub_list_tasks 의 칸 + 종목 · 공급가 · 받은 금액 · 올데이케어 수수료
--   상태 · 종목으로 거르는 것과 정렬은 화면이 합니다 (1000건 이내).
--
-- 기존 함수·데이터 영향 없음 (함수 1개 추가). 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION sub_query_tasks(
  p_actor uuid, p_token text,
  p_from date, p_to date,
  p_engineer_id uuid DEFAULT NULL,
  p_query text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_today  date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_from   date := COALESCE(p_from, date_trunc('month', v_today)::date);
  v_to     date := COALESCE(p_to, v_today);
  v_q      text := btrim(COALESCE(p_query, ''));
  v_like   text;
  v_digits text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  IF v_to < v_from OR v_to - v_from > 400 THEN
    RETURN jsonb_build_object('ok', false, 'error', '기간을 확인해 주세요 (최대 400일).');
  END IF;

  v_like   := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_digits := regexp_replace(v_q, '[^0-9]', '', 'g');

  RETURN (
    WITH base AS (
      SELECT
        t.id, t.task_no, t.status,
        t.customer_name, t.phone, t.address, t.district,
        t.requested_date, t.requested_time, t.scheduled_at,
        t.started_at, t.completed_at,
        t.category_data ->> 'workType' AS work_type,
        t.category_data -> 'workItems' AS work_items,
        t.category_id,
        t.product_price,
        COALESCE(t.received_total, 0) AS received_total,
        COALESCE(t.supply_amount, 0)  AS supply_amount,
        COALESCE((SELECT SUM(p.owner_amount) FROM payments p WHERE p.task_id = t.id AND p.track = 'S'), 0)::int AS fee,
        t.assigned_engineer_id,
        u.name  AS engineer_name,
        u.phone AS engineer_phone,
        COALESCE(t.scheduled_at, t.requested_date::timestamptz, t.completed_at, t.received_at) AS sort_at,
        COALESCE((t.scheduled_at AT TIME ZONE 'Asia/Seoul')::date, t.requested_date,
                 (t.completed_at AT TIME ZONE 'Asia/Seoul')::date,
                 (t.received_at  AT TIME ZONE 'Asia/Seoul')::date) AS visit_date
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_engineer_id
      WHERE t.subcontractor_id = v_sub
        AND (p_engineer_id IS NULL OR t.assigned_engineer_id = p_engineer_id)
        AND (v_q = ''
             OR t.customer_name ILIKE v_like ESCAPE '\'
             OR COALESCE(t.address, '') ILIKE v_like ESCAPE '\'
             OR COALESCE(t.task_no, '') ILIKE v_like ESCAPE '\'
             OR (char_length(v_digits) >= 3 AND v_digits = v_q
                 AND right(regexp_replace(COALESCE(t.phone, ''), '[^0-9]', '', 'g'), char_length(v_digits)) = v_digits))
    ),
    hit AS (
      SELECT * FROM base WHERE visit_date BETWEEN v_from AND v_to
    ),
    cut AS (
      SELECT * FROM hit ORDER BY sort_at DESC NULLS LAST LIMIT 1000
    )
    SELECT jsonb_build_object(
      'ok', true, 'from', v_from, 'to', v_to,
      'total', (SELECT COUNT(*) FROM hit),
      'tasks', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort_at DESC NULLS LAST) FROM cut c), '[]'::jsonb))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sub_query_tasks(uuid, text, date, date, uuid, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 - 기대: 1행
SELECT proname FROM pg_proc WHERE proname = 'sub_query_tasks';

-- 2) 세션 없이 호출하면 거부 - 기대: {"ok": false, "error": "다시 로그인해 주세요."}
SELECT sub_query_tasks(NULL, NULL, NULL, NULL, NULL, NULL);
