-- ============================================================================
-- Migration 104 — tenants.ops_phone 컬럼 + 운영자 변경 RPC
-- 2026-06-07
--
-- 배경:
--   기사 PWA "내 정보" → "📞 전화" 버튼이 EngineerApp.jsx:4690 에서 더미
--   상수("tel:01012345678")로 하드코딩. 운영자가 직접 변경 가능하게 tenants
--   레벨 설정값으로 분리.
--
-- 읽기: tenants anon SELECT 정책 (Mig 037) 이미 존재 → 클라가 직접 SELECT.
-- 쓰기: SECURITY DEFINER RPC + _caller_is_admin(p_actor) — Mig 096 패턴.
--
-- 회귀 안전:
--   · 컬럼 추가만 (기존 컬럼 무손상).
--   · 다른 RPC/트리거/정책 무손상.
-- ============================================================================

BEGIN;

-- [1] 컬럼 추가 (idempotent)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ops_phone text;

-- [2] 쓰기 RPC — 운영자만 변경
CREATE OR REPLACE FUNCTION admin_set_tenant_ops_phone(
  p_phone text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant uuid;
  v_clean         text;
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

  -- 빈 문자열 / NULL → NULL 로 정규화. 형식 검증은 클라(UX)에서.
  v_clean := NULLIF(TRIM(COALESCE(p_phone, '')), '');

  UPDATE tenants
  SET ops_phone = v_clean
  WHERE id = v_caller_tenant;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '대상 tenant 없음');
  END IF;

  RETURN jsonb_build_object(
    'ok',            true,
    'tenant_id',     v_caller_tenant,
    'ops_phone',     v_clean,
    'rows_affected', v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_tenant_ops_phone(text, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 — 컬럼 + 함수 확인
-- ============================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'ops_phone';

SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'admin_set_tenant_ops_phone';
