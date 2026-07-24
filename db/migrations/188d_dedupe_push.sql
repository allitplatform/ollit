-- ============================================================================
-- Migration 188d — 기사 메시지 푸시 중복 제거 (2026-07-24 사장님 발견)
--   원인: engineer_send_message 가 admin/operator/owner 역할별로 3회 발송
--         → 역할 2개 이상 가진 계정(사장님)이 같은 알림을 2~3번 수신.
--   수리: 1회 발송 + targetId='admin,operator,owner' (send.js 복수 role 지원과 세트).
--   ⚠️ send.js 배포 후 실행 권장 (구버전 send.js 는 'admin,...' 문자열을 단일 role 로 봐 매칭 0건).
-- 실행: Supabase SQL Editor → 통째 → Run
-- ============================================================================

CREATE OR REPLACE FUNCTION engineer_send_message(
  p_actor   uuid,
  p_task_id uuid,
  p_kind    text,
  p_body    text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_tenant  uuid;
  v_name    text;
  v_id      uuid;
  v_task_no text;
  v_kind    text := COALESCE(NULLIF(TRIM(p_kind), ''), 'general');
  v_kind_ko text;
  v_now     timestamptz := now();
BEGIN
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인'); END IF;
  IF p_body IS NULL OR TRIM(p_body) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '메시지 본문 필수');
  END IF;
  IF v_kind NOT IN ('general','assign','schedule','complete','settle') THEN v_kind := 'general'; END IF;

  IF NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p_actor AND ur.role = 'engineer') THEN
    RETURN jsonb_build_object('ok', false, 'error', '기사 권한 필요');
  END IF;

  SELECT tenant_id, name INTO v_tenant, v_name FROM users WHERE id = p_actor;
  IF v_tenant IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'tenant 확인 실패'); END IF;

  IF p_task_id IS NOT NULL THEN
    SELECT task_no INTO v_task_no FROM tasks WHERE id = p_task_id;
    IF v_task_no IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;
  END IF;

  INSERT INTO task_messages (tenant_id, task_id, from_user, to_user, engineer_user, kind, body, created_at)
  VALUES (v_tenant, p_task_id, p_actor, NULL, p_actor, v_kind, TRIM(p_body), v_now)
  RETURNING id INTO v_id;

  v_kind_ko := CASE v_kind
    WHEN 'assign' THEN '배정' WHEN 'schedule' THEN '일정'
    WHEN 'complete' THEN '완료' WHEN 'settle' THEN '정산' ELSE '메시지' END;

  -- v2 (188d): 운영팀 푸시 1회 — 복수 role 을 send.js 가 중복 없이 풀어냄.
  PERFORM _msg_push(jsonb_build_object(
    'targetType', 'role',
    'targetId',   'admin,operator,owner',
    'title',      '💬 ' || COALESCE(v_name,'기사') || ' · ' || v_kind_ko
                  || COALESCE(' [' || v_task_no || ']', ''),
    'body',       TRIM(p_body),
    'url',        '/',
    'tag',        'eng-message-' || v_id::text,
    'kind',       'engineer_message'
  ));

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'created_at', v_now);
END;
$$;
GRANT EXECUTE ON FUNCTION engineer_send_message(uuid, uuid, text, text) TO anon, authenticated;
