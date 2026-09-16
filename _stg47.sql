-- =============================================================
-- Migration 179 — 냉매충전 자동배정 푸시 ON/OFF 토글 (2026-07-14)
--
-- 배경 (사장님):
--   "원래는 푸시 알림해서 기사님들이 수락하는 형태였는데 지금은 일이 많아서
--    기사님들이 일하느라 수락을 못하는 상황이라 우리가 배정을 해야 되는 상황"
--   → 성수기엔 푸시 끄고 바로 수동 배정, 비수기엔 다시 켜기.
--
-- 설계: Mig 104(ops_phone) 패턴 그대로 — tenants 컬럼 + 관리자 RPC.
--   읽기: tenants anon SELECT (Mig 037 기존 정책).
--   쓰기: admin_set_auto_push_assign RPC + _caller_is_admin.
--   기본값 true = 지금과 동일 (푸시 켜짐). 컬럼 미배포 시 클라는 true 로 동작.
-- =============================================================

-- [1] 컬럼 추가 (idempotent)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_push_assign boolean NOT NULL DEFAULT true;

-- [2] 쓰기 RPC — 운영자만 변경
CREATE OR REPLACE FUNCTION admin_set_auto_push_assign(
  p_enabled boolean,
  p_actor   uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant uuid;
  v_rows          int;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;

  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  SELECT tenant_id INTO v_caller_tenant FROM users WHERE id = p_actor;
  IF v_caller_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '호출자 tenant 확인 실패');
  END IF;

  UPDATE tenants
  SET auto_push_assign = COALESCE(p_enabled, true)
  WHERE id = v_caller_tenant;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '대상 tenant 없음');
  END IF;

  RETURN jsonb_build_object(
    'ok',               true,
    'tenant_id',        v_caller_tenant,
    'auto_push_assign', COALESCE(p_enabled, true),
    'rows_affected',    v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_auto_push_assign(boolean, uuid) TO anon, authenticated;

-- [3] 검증
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'auto_push_assign';

SELECT proname FROM pg_proc WHERE proname = 'admin_set_auto_push_assign';
