-- ============================================================================
-- Migration 188c — 채팅 메시지에 보낸 사람 이름 (2026-07-24 사장님 spec)
--   "운영자도 누가 답했는지" — list_thread_messages 반환에 from_name 추가.
--   반환 컬럼 변경이라 DROP 후 재생성 (데이터 무관).
-- 실행: Supabase SQL Editor → 통째 → Run
-- ============================================================================

DROP FUNCTION IF EXISTS list_thread_messages(uuid, uuid, uuid);

CREATE FUNCTION list_thread_messages(
  p_actor         uuid,
  p_engineer_user uuid,
  p_task_id       uuid
)
RETURNS TABLE (
  id            uuid,
  from_user     uuid,
  from_engineer boolean,
  from_name     text,
  kind          text,
  body          text,
  created_at    timestamptz,
  read_at       timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL OR p_engineer_user IS NULL THEN RETURN; END IF;
  IF NOT _caller_is_admin(p_actor) AND p_actor <> p_engineer_user THEN RETURN; END IF;
  RETURN QUERY
  SELECT m.id, m.from_user, (m.from_user = p_engineer_user) AS from_engineer,
         u.name AS from_name,
         m.kind, m.body, m.created_at, m.read_at
  FROM task_messages m
  LEFT JOIN users u ON u.id = m.from_user
  WHERE m.engineer_user = p_engineer_user
    AND m.task_id IS NOT DISTINCT FROM p_task_id
    AND m.deleted_at IS NULL
  ORDER BY m.created_at ASC
  LIMIT 500;
END;
$$;
GRANT EXECUTE ON FUNCTION list_thread_messages(uuid, uuid, uuid) TO anon, authenticated;
