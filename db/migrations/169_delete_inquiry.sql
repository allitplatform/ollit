-- ============================================================================
-- Migration 169 — delete_inquiry RPC (스팸/미전환 문의 영구 삭제)
-- 2026-07-11 (사장님 spec 재작성)
--
-- 요구:
--   · 프론트 [삭제 (영구)] 버튼이 호출하는 RPC. DB에 함수 없어 에러:
--       Could not find function public.delete_inquiry(p_actor, p_inquiry_id).
--
-- 보안/조건 (사장님 spec):
--   · SECURITY DEFINER + search_path=public.
--   · _caller_is_admin(p_actor) 통과자만 실행 (기존 RPC 와 동일 권한 체크).
--   · task_id IS NULL 인 건만 삭제 — 전환된 실데이터 (task_id 존재) 보호.
--     ⚠️ status='spam' 조건은 DB 수준에서 넣지 않음 (프론트가 이미 스팸 필터
--        상태에서만 노출). DB-level 은 task_id 만으로 가드.
--   · GRANT: authenticated 만 (anon 제외).
--   · SECURITY DEFINER 는 DROP + CREATE 규칙 (기존 함수 상 있을 수 있어 안전).
--
-- 시그니처:
--   delete_inquiry(p_actor uuid, p_inquiry_id uuid) RETURNS jsonb
--   응답: { ok: bool, deleted?: bool, error?: text }
--
-- 영향:
--   · inquiries 행 완전 삭제 → get_inquiry_funnel / get_inquiry_daily_counts
--     자동 반영 (다음 fetch 부터 카운트 즉시 감소).
--   · Mig 152 mark_inquiry_converted 는 UPDATE 만 → task_id 채워진 converted 는
--     이 함수로 못 지움 (정산/이력 보호 정합).
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
  v_task_id uuid;
  v_status  text;
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

  -- 대상 행 상태 사전 확인 (안내용 에러 메시지 제공).
  SELECT status, task_id
    INTO v_status, v_task_id
    FROM inquiries
   WHERE id        = p_inquiry_id
     AND tenant_id = v_tenant;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '문의 없음 (id 오류 or 다른 tenant)');
  END IF;

  IF v_task_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '전환된 실데이터 (task_id 존재) — 삭제 불가');
  END IF;

  -- 삭제 실행 — task_id IS NULL 조건은 이중 안전장치 (동시성 대비).
  DELETE FROM inquiries
   WHERE id        = p_inquiry_id
     AND tenant_id = v_tenant
     AND task_id IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok',      v_rows > 0,
    'deleted', v_rows > 0
  );
END;
$$;

-- 사장님 spec: anon 제외, authenticated 만 GRANT.
REVOKE ALL ON FUNCTION delete_inquiry(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION delete_inquiry(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION delete_inquiry(uuid, uuid) TO authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
SELECT proname,
       pg_get_function_arguments(oid) AS args,
       pg_get_function_result(oid)    AS returns,
       prosecdef                       AS security_definer
FROM pg_proc
WHERE proname = 'delete_inquiry';

-- 권한 확인 (anon 없음, authenticated 만 EXECUTE).
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name   = 'delete_inquiry';
