-- ============================================================================
-- Migration 237 - 협력사 관리자: 작업 검색 (기간 밖 작업 포함)
-- 작성 2026-10-06 · 선행: 214
--
-- 내용
--   sub_search_tasks (신규, 읽기 전용)
--     · 협력사 관리자만, 자기 협력사 작업만 (세션 확인 필수)
--     · 검색어: 고객명 · 주소 · 작업번호에 들어 있는 글자, 또는 고객 전화 뒷자리(숫자 3자리 이상)
--     · 단계·기간과 상관없이 전체(취소 포함)에서 찾습니다
--     · 최근순 최대 50건
--     · 돌려주는 칸은 sub_list_tasks (mig 214) 와 같아서 화면이 같은 카드로 그립니다
--
-- 기존 함수·데이터 영향 없음 (함수 1개 추가). 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION sub_search_tasks(p_actor uuid, p_token text, p_query text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
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
  IF char_length(v_q) < 2 THEN
    RETURN jsonb_build_object('ok', true, 'tasks', '[]'::jsonb, 'too_short', true);
  END IF;

  -- 검색어의 % _ \ 는 글자 그대로 찾는다
  v_like   := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_digits := regexp_replace(v_q, '[^0-9]', '', 'g');

  RETURN jsonb_build_object('ok', true, 'tasks', COALESCE((
    SELECT jsonb_agg(to_jsonb(y) ORDER BY y.sort_at DESC NULLS LAST)
    FROM (
      SELECT x.* FROM (
        SELECT
          t.id, t.task_no, t.status,
          t.customer_name, t.phone, t.address, t.district,
          t.requested_date, t.requested_time, t.scheduled_at,
          t.started_at, t.completed_at,
          t.request_note, t.work_memo,
          t.category_data ->> 'workType' AS work_type,
          t.category_data -> 'workItems' AS work_items,
          t.product_price, t.received_total,
          t.assigned_engineer_id,
          u.name  AS engineer_name,
          u.phone AS engineer_phone,
          COALESCE(t.scheduled_at, t.requested_date::timestamptz, t.received_at) AS sort_at
        FROM tasks t
        LEFT JOIN users u ON u.id = t.assigned_engineer_id
        WHERE t.subcontractor_id = v_sub
          AND (   t.customer_name ILIKE v_like ESCAPE '\'
               OR COALESCE(t.address, '') ILIKE v_like ESCAPE '\'
               OR COALESCE(t.task_no, '') ILIKE v_like ESCAPE '\'
               OR (char_length(v_digits) >= 3 AND v_digits = v_q
                   AND right(regexp_replace(COALESCE(t.phone, ''), '[^0-9]', '', 'g'), char_length(v_digits)) = v_digits))
      ) x
      ORDER BY x.sort_at DESC NULLS LAST
      LIMIT 50
    ) y
  ), '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION sub_search_tasks(uuid, text, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 - 기대: 1행
SELECT proname FROM pg_proc WHERE proname = 'sub_search_tasks';

-- 2) 세션 없이 호출하면 거부 - 기대: {"ok": false, "error": "다시 로그인해 주세요."}
SELECT sub_search_tasks(NULL, NULL, '시험');
