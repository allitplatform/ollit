-- ============================================================================
-- Migration 170 — inquiries.spam_reason + set_inquiry_status(p_spam_reason)
-- 2026-07-11
--
-- 배경 (사장님 spec):
--   · 스팸 처리 시 사유 (spam_reason) 입력 받기.
--   · 자유 텍스트 + 빠른 선택 (장난·허위 / 광고·스팸문자 / 중복접수 /
--     타지역·서비스불가 / 연락두절).
--   · 스팸 목록에서 각 건 사유 표시. 없으면 "사유 없음".
--
-- 변경:
--   1) inquiries 에 spam_reason text 컬럼 추가 (nullable).
--   2) set_inquiry_status RPC 재정의 — p_spam_reason 옵션 파라미터 추가.
--      · status='spam' 시 spam_reason 저장.
--      · status != 'spam' 로 재분류 시 spam_reason NULL 로 초기화 (옛 사유 잔존 방지).
--      · 기존 호출자 (사유 미지정) 는 p_spam_reason NULL default → 사유 없음.
--
-- 보안/조건:
--   · SECURITY DEFINER + search_path=public.
--   · _caller_is_admin(p_actor) 통과자만.
--   · 허용 상태 유지: 'new' / 'contacted' / 'spam'.
--   · DROP + CREATE (반환 타입 or 시그니처 변경 안전).
--   · GRANT: anon + authenticated (기존 정책 유지 — set_inquiry_status 자체는 anon 도 허용).
-- ============================================================================

BEGIN;

-- [1] 컬럼 추가 (idempotent).
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS spam_reason text;

COMMENT ON COLUMN inquiries.spam_reason IS
  '스팸 처리 사유 (status=spam 인 행에서만 의미. 빠른 선택 or 자유 텍스트).';

-- [2] set_inquiry_status 재정의 — p_spam_reason 옵션 추가.
DROP FUNCTION IF EXISTS set_inquiry_status(uuid, uuid, text);
DROP FUNCTION IF EXISTS set_inquiry_status(uuid, uuid, text, text);

CREATE FUNCTION set_inquiry_status(
  p_actor        uuid,
  p_inquiry_id   uuid,
  p_status       text,
  p_spam_reason  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_rows   int;
BEGIN
  IF p_actor      IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'actor 필요'); END IF;
  IF p_inquiry_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'inquiry_id 필요'); END IF;
  IF p_status NOT IN ('new', 'contacted', 'spam') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'status 는 new/contacted/spam 중 하나');
  END IF;

  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_actor;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '호출자 tenant 확인 실패');
  END IF;

  -- status='spam' 이면 spam_reason 저장 (NULL 도 허용 — 사유 미입력).
  -- status 재분류 시 spam_reason NULL 로 초기화 (옛 사유 잔존 방지).
  UPDATE inquiries SET
    status      = p_status,
    spam_reason = CASE WHEN p_status = 'spam' THEN p_spam_reason ELSE NULL END
   WHERE id        = p_inquiry_id
     AND tenant_id = v_tenant
     AND status IN ('new', 'contacted', 'spam');
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok',            v_rows > 0,
    'rows_affected', v_rows
  );
END;
$$;

-- 기존 정책 유지 — set_inquiry_status 는 anon + authenticated 둘 다.
GRANT EXECUTE ON FUNCTION set_inquiry_status(uuid, uuid, text, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
SELECT proname,
       pg_get_function_arguments(oid) AS args,
       pg_get_function_result(oid)    AS returns,
       prosecdef                       AS security_definer
FROM pg_proc
WHERE proname = 'set_inquiry_status';

-- 컬럼 확인.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'inquiries'
  AND column_name  = 'spam_reason';
