-- ============================================================================
-- Migration 188b — 메시지 스레드 휴지통 (운영자 소프트 삭제, 2026-07-24 사장님 spec)
--   채팅 헤더 🗑 → 스레드 전체 deleted_at 마킹 (양쪽 목록에서 사라짐, 데이터는 보존).
-- 실행: Supabase SQL Editor → 통째 → Run
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_delete_message_thread(
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
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '권한 없음 — operator/owner/admin 필요');
  END IF;

  UPDATE task_messages SET deleted_at = now()
  WHERE engineer_user = p_engineer_user
    AND task_id IS NOT DISTINCT FROM p_task_id
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'deleted', v_n);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_delete_message_thread(uuid, uuid, uuid) TO anon, authenticated;
