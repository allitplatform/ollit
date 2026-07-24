-- ============================================================================
-- Migration 188 — 기사↔운영자 메시지 창구 (양방향, 2026-07-24 사장님 확정 설계)
--
-- 설계 문서: claude/올잇_설계확정_기사메시지창구_2026-07-24.md
--   · 기존 task_messages(Mig 150, 운영자→기사 일방) 확장 — 기존 데이터·RPC 보존.
--   · 종류(kind): general(일반)/assign(배정)/schedule(일정)/complete(완료)/settle(정산)
--   · 스레드 = (engineer_user, task_id) 쌍. task_id NULL = 작업 무관 일반 대화 (기사당 1스레드).
--   · read_at = "수신자가 읽은 시각" (기사 수신분 = 기사 읽음 / 기사 발신분 = 운영자 읽음)
--   · 푸시: 기사→운영자 = role(admin/operator/owner) 대상 / 운영자→기사 = 기존 패턴.
--
-- 실행: Supabase SQL Editor → 통째 → Run (재실행 안전)
-- ============================================================================

BEGIN;

-- ─── [A] 테이블 확장 ───
ALTER TABLE task_messages ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE task_messages ALTER COLUMN to_user DROP NOT NULL;
ALTER TABLE task_messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'general';
ALTER TABLE task_messages ADD COLUMN IF NOT EXISTS engineer_user uuid REFERENCES users(id);

DO $$ BEGIN
  ALTER TABLE task_messages ADD CONSTRAINT task_messages_kind_chk
    CHECK (kind IN ('general','assign','schedule','complete','settle'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN task_messages.kind          IS '대화 종류: general/assign/schedule/complete/settle';
COMMENT ON COLUMN task_messages.engineer_user IS '스레드의 기사 참여자 (방향 무관 — 스레드 그룹 키)';

-- 기존 행 백필: 운영자→기사 메시지 → engineer_user = to_user
UPDATE task_messages SET engineer_user = to_user WHERE engineer_user IS NULL AND to_user IS NOT NULL;

CREATE INDEX IF NOT EXISTS task_messages_thread_idx
  ON task_messages (engineer_user, task_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── [B] 공용: 푸시 발송 헬퍼 (Vault + pg_net) ───
CREATE OR REPLACE FUNCTION _msg_push(p_payload jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_api_key text;
BEGIN
  SELECT decrypted_secret INTO v_api_key
    FROM vault.decrypted_secrets WHERE name = 'PUSH_API_KEY' LIMIT 1;
  IF v_api_key IS NULL OR v_api_key = '' THEN
    RAISE NOTICE '[msg push] PUSH_API_KEY 미설정 — skip';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := 'https://ollit.vercel.app/api/push/send',
    headers := jsonb_build_object('Content-Type','application/json','X-API-Key',v_api_key),
    body    := p_payload
  );
END;
$$;

-- ─── [C] engineer_send_message — 기사 발신 (신규) ───
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
  v_role    text;
  v_now     timestamptz := now();
BEGIN
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인'); END IF;
  IF p_body IS NULL OR TRIM(p_body) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '메시지 본문 필수');
  END IF;
  IF v_kind NOT IN ('general','assign','schedule','complete','settle') THEN v_kind := 'general'; END IF;

  -- 기사 본인 확인
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

  -- 운영팀 푸시 (admin / operator / owner 전부)
  FOREACH v_role IN ARRAY ARRAY['admin','operator','owner'] LOOP
    PERFORM _msg_push(jsonb_build_object(
      'targetType', 'role',
      'targetId',   v_role,
      'title',      '💬 ' || COALESCE(v_name,'기사') || ' · ' || v_kind_ko
                    || COALESCE(' [' || v_task_no || ']', ''),
      'body',       TRIM(p_body),
      'url',        '/',
      'tag',        'eng-message-' || v_id::text,
      'kind',       'engineer_message'
    ));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'created_at', v_now);
END;
$$;
GRANT EXECUTE ON FUNCTION engineer_send_message(uuid, uuid, text, text) TO anon, authenticated;

-- ─── [D] admin_send_message — 운영자 발신 v2 (task 무관 + kind, 기존 RPC 보존) ───
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

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'created_at', v_now);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_send_message(uuid, uuid, uuid, text, text) TO anon, authenticated;

-- ─── [E] 스레드 목록 — 운영자 ───
CREATE OR REPLACE FUNCTION admin_list_message_threads(p_actor uuid)
RETURNS TABLE (
  engineer_user  uuid,
  engineer_name  text,
  engineer_code  text,
  task_id        uuid,
  task_no        text,
  customer_name  text,
  last_body      text,
  last_kind      text,
  last_from_me   boolean,
  last_at        timestamptz,
  unread_count   bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL OR NOT _caller_is_admin(p_actor) THEN RETURN; END IF;
  RETURN QUERY
  WITH threads AS (
    SELECT m.engineer_user AS eng, m.task_id AS tid,
           max(m.created_at) AS last_at,
           count(*) FILTER (WHERE m.to_user IS NULL AND m.read_at IS NULL) AS unread
    FROM task_messages m
    WHERE m.deleted_at IS NULL AND m.engineer_user IS NOT NULL
    GROUP BY m.engineer_user, m.task_id
  )
  SELECT
    th.eng, u.name, u.code,
    th.tid, t.task_no, t.customer_name,
    lm.body, lm.kind, (lm.to_user IS NOT NULL) AS last_from_me,
    th.last_at, th.unread
  FROM threads th
  JOIN users u ON u.id = th.eng
  LEFT JOIN tasks t ON t.id = th.tid
  JOIN LATERAL (
    SELECT m2.body, m2.kind, m2.to_user
    FROM task_messages m2
    WHERE m2.engineer_user = th.eng
      AND m2.task_id IS NOT DISTINCT FROM th.tid
      AND m2.deleted_at IS NULL
    ORDER BY m2.created_at DESC LIMIT 1
  ) lm ON true
  ORDER BY th.last_at DESC
  LIMIT 200;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_list_message_threads(uuid) TO anon, authenticated;

-- ─── [F] 스레드 목록 — 기사 ───
CREATE OR REPLACE FUNCTION list_engineer_message_threads(p_actor uuid)
RETURNS TABLE (
  task_id        uuid,
  task_no        text,
  customer_name  text,
  last_body      text,
  last_kind      text,
  last_from_me   boolean,
  last_at        timestamptz,
  unread_count   bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH threads AS (
    SELECT m.task_id AS tid,
           max(m.created_at) AS last_at,
           count(*) FILTER (WHERE m.to_user = p_actor AND m.read_at IS NULL) AS unread
    FROM task_messages m
    WHERE m.deleted_at IS NULL AND m.engineer_user = p_actor
    GROUP BY m.task_id
  )
  SELECT
    th.tid, t.task_no, t.customer_name,
    lm.body, lm.kind, (lm.to_user IS NULL) AS last_from_me,
    th.last_at, th.unread
  FROM threads th
  LEFT JOIN tasks t ON t.id = th.tid
  JOIN LATERAL (
    SELECT m2.body, m2.kind, m2.to_user
    FROM task_messages m2
    WHERE m2.engineer_user = p_actor
      AND m2.task_id IS NOT DISTINCT FROM th.tid
      AND m2.deleted_at IS NULL
    ORDER BY m2.created_at DESC LIMIT 1
  ) lm ON true
  ORDER BY th.last_at DESC
  LIMIT 100;
END;
$$;
GRANT EXECUTE ON FUNCTION list_engineer_message_threads(uuid) TO anon, authenticated;

-- ─── [G] 스레드 메시지 (채팅 화면 — 양방향 시간순) ───
CREATE OR REPLACE FUNCTION list_thread_messages(
  p_actor         uuid,
  p_engineer_user uuid,
  p_task_id       uuid
)
RETURNS TABLE (
  id         uuid,
  from_user  uuid,
  from_engineer boolean,
  kind       text,
  body       text,
  created_at timestamptz,
  read_at    timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL OR p_engineer_user IS NULL THEN RETURN; END IF;
  -- 권한: 운영자 전체 / 기사 본인 스레드만
  IF NOT _caller_is_admin(p_actor) AND p_actor <> p_engineer_user THEN RETURN; END IF;
  RETURN QUERY
  SELECT m.id, m.from_user, (m.from_user = p_engineer_user) AS from_engineer,
         m.kind, m.body, m.created_at, m.read_at
  FROM task_messages m
  WHERE m.engineer_user = p_engineer_user
    AND m.task_id IS NOT DISTINCT FROM p_task_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at ASC
  LIMIT 500;
END;
$$;
GRANT EXECUTE ON FUNCTION list_thread_messages(uuid, uuid, uuid) TO anon, authenticated;

-- ─── [H] 읽음 처리 (스레드 열 때 — 자기 수신분만) ───
CREATE OR REPLACE FUNCTION mark_thread_read(
  p_actor         uuid,
  p_engineer_user uuid,
  p_task_id       uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int := 0;
BEGIN
  IF p_actor IS NULL OR p_engineer_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actor/engineer 누락');
  END IF;
  IF p_actor = p_engineer_user THEN
    -- 기사: 자기가 받은 메시지 읽음
    UPDATE task_messages SET read_at = now()
    WHERE engineer_user = p_engineer_user
      AND task_id IS NOT DISTINCT FROM p_task_id
      AND to_user = p_actor AND read_at IS NULL AND deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF _caller_is_admin(p_actor) THEN
    -- 운영자: 기사 발신분 읽음
    UPDATE task_messages SET read_at = now()
    WHERE engineer_user = p_engineer_user
      AND task_id IS NOT DISTINCT FROM p_task_id
      AND to_user IS NULL AND read_at IS NULL AND deleted_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', '권한 없음');
  END IF;
  RETURN jsonb_build_object('ok', true, 'marked', v_n);
END;
$$;
GRANT EXECUTE ON FUNCTION mark_thread_read(uuid, uuid, uuid) TO anon, authenticated;

-- ─── [I] 운영자 안읽음 총계 (개요 카드 배지) ───
CREATE OR REPLACE FUNCTION admin_messages_unread_count(p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n bigint := 0;
BEGIN
  IF p_actor IS NULL OR NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', true, 'count', 0);
  END IF;
  SELECT count(*) INTO v_n
  FROM task_messages m
  WHERE m.deleted_at IS NULL AND m.to_user IS NULL AND m.read_at IS NULL;
  RETURN jsonb_build_object('ok', true, 'count', v_n);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_messages_unread_count(uuid) TO anon, authenticated;

COMMIT;

-- 검증
SELECT count(*) AS 총메시지, count(*) FILTER (WHERE engineer_user IS NULL) AS engineer_user_null
FROM task_messages;
