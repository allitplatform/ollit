-- ============================================================================
-- Migration 169 — delete_inquiry RPC (스팸 문의 영구 삭제)
-- 2026-07-10
--
-- 요구 (사장님 spec):
--   · 스팸 상태 문의만 영구 삭제 가능 (테스트/쓰레기 정리 목적).
--   · converted (task_id IS NOT NULL) 실데이터는 삭제 불가 — 정산/이력 보존.
--   · 관리자 (_caller_is_admin) 만 실행 가능 — anon 직접 DELETE 금지.
--
-- 시그니처:
--   delete_inquiry(p_actor uuid, p_inquiry_id uuid)
--   RETURNS jsonb — { ok: bool, error?: text, deleted?: bool }
--
-- 동작:
--   · 권한 미통과 → RAISE EXCEPTION.
--   · status != 'spam' → { ok: false, error: '스팸 상태 아님' }
--   · task_id IS NOT NULL → { ok: false, error: '전환된 실데이터라 삭제 불가' }
--   · 성공 → DELETE 실행 후 { ok: true, deleted: true }.
--
-- 영향:
--   · inquiries 행 완전 삭제 → get_inquiry_funnel / get_inquiry_daily_counts
--     자동 반영 (다음 fetch 부터 카운트 즉시 감소).
--   · Mig 152 mark_inquiry_converted 는 UPDATE 만 → 이 함수는 그것과 무관.
--     (converted 는 여기서 못 지움. 전환 실데이터 정합 유지.)
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS delete_inquiry(uuid, uuid);

CREATE FUNCTION delete_inquiry(
  p_actor      uuid,
  p_inquiry_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant  uuid;
  v_status  text;
  v_task_id uuid;
  v_rows    int;
BEGIN
  IF p_actor      IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'actor 필요'); END IF;
  IF p_inquiry_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'inquiry_id 필요'); END IF;

  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_actor;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '호출자 tenant 확인 실패');
  END IF;

  -- 대상 행 상태 확인.
  SELECT status, task_id
    INTO v_status, v_task_id
    FROM inquiries
   WHERE id        = p_inquiry_id
     AND tenant_id = v_tenant;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '문의 없음 (id 오류 or 다른 tenant)');
  END IF;

  IF v_status <> 'spam' THEN
    RETURN jsonb_build_object('ok', false, 'error', '스팸 상태 아님 — 스팸만 삭제 가능');
  END IF;

  IF v_task_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '전환된 실데이터 (task_id 존재) — 삭제 불가');
  END IF;

  DELETE FROM inquiries
   WHERE id        = p_inquiry_id
     AND tenant_id = v_tenant
     AND status    = 'spam'
     AND task_id IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok',      v_rows > 0,
    'deleted', v_rows > 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_inquiry(uuid, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
SELECT proname, pg_get_function_arguments(oid) AS args, pg_get_function_result(oid) AS returns
FROM pg_proc
WHERE proname = 'delete_inquiry';
