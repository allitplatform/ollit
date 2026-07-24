-- ============================================================================
-- Migration 188e — 자기 알림 제외 (2026-07-24 사장님 발견)
--   역할 2개(기사+운영자) 계정이 기사로 메시지를 보내면 운영팀 푸시에 본인이 포함돼
--   자기가 보낸 메시지 알림을 자기가 받음 → excludeUserId 로 보낸 사람 제외.
--   운영자→기사 발송도 본인(=기사 겸직)에게 보내는 경우 푸시 생략.
--   ⚠️ send.js (excludeUserId 지원) 배포 후 실행.
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

  -- v3 (188e): 1회 발송 + 보낸 사람 제외 (excludeUserId).
  PERFORM _msg_push(jsonb_build_object(
    'targetType',    'role',
    'targetId',      'admin,operator,owner',
    'excludeUserId', p_actor::text,
    'title',         '💬 ' || COALESCE(v_name,'기사') || ' · ' || v_kind_ko
                     || COALESCE(' [' || v_task_no || ']', ''),
    'body',          TRIM(p_body),
    'url',           '/',
    'tag',           'eng-message-' || v_id::text,
    'kind',          'engineer_message'
  ));

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'created_at', v_now);
END;
$$;
GRANT EXECUTE ON FUNCTION engineer_send_message(uuid, uuid, text, text) TO anon, authenticated;

-- 운영자→기사: 본인에게 보내는 경우(겸직 테스트 등) 푸시 생략
CREATE OR REPLACE FUNCTION admin_send_message(
  p_actor         uuid,
  p_engineer_user uuid,
  p_task_id       uuid,
  p_kind          text,
  p_body          text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_tenant  uuid;
  v_id      uuid;
  v_task_no text;
  v_customer text;
  v_kind    text := COALESCE(NULLIF(TRIM(p_kind), ''), 'general');
  v_now     timestamptz := now();
BEGIN
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인'); END IF;
  IF p_engineer_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '수신 기사 누락'); END IF;
  IF p_body IS NULL OR TRIM(p_body) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '메시지 본문 필수');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;
  IF v_kind NOT IN ('general','assign','schedule','complete','settle') THEN v_kind := 'general'; END IF;

  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_actor;
  IF v_tenant IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'tenant 확인 실패'); END IF;

  IF p_task_id IS NOT NULL THEN
    SELECT task_no, customer_name INTO v_task_no, v_customer FROM tasks WHERE id = p_task_id;
    IF v_task_no IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;
  END IF;

  INSERT INTO task_messages (tenant_id, task_id, from_user, to_user, engineer_user, kind, body, created_at)
  VALUES (v_tenant, p_task_id, p_actor, p_engineer_user, p_engineer_user, v_kind, TRIM(p_body), v_now)
  RETURNING id INTO v_id;

  -- v2 (188e): 자기 자신에게 보낸 경우 푸시 생략
  IF p_engineer_user <> p_actor THEN
    PERFORM _msg_push(jsonb_build_object(
      'targetType', 'engineer',
      'targetId',   p_engineer_user::text,
      'title',      CASE WHEN v_task_no IS NOT NULL
                      THEN '📨 [' || v_task_no || ' ' || COALESCE(v_customer,'') || ']'
                      ELSE '📨 운영팀 메시지' END,
      'body',       TRIM(p_body),
      'url',        '/',
      'tag',        'task-message-' || v_id::text,
      'kind',       'message'
    ));
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'created_at', v_now);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_send_message(uuid, uuid, uuid, text, text) TO anon, authenticated;
