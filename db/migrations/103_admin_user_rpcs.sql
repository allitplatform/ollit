-- ============================================================================
-- Migration 103 — admin_*_user RPC 3종 (운영자 사용자/권한 관리)
-- 2026-06-07
--
-- 배경:
--   "사용자/권한" 화면 (UserListScreen / UserEditScreen) 저장이 localStorage 만
--   갱신하고 DB로는 안 감. 옛 anon 직접 UPDATE 경로조차 없음.
--
-- 해결: Mig 102 패턴 (SECURITY DEFINER + p_actor + _caller_is_admin) 동일.
--   A) admin_upsert_user           — 계정 정보 수정 + 신규 + 활성 토글
--   B) admin_set_user_roles        — 역할 SET 변경 (다중 역할 허용)
--   C) admin_reset_user_password   — 운영자 비번 리셋 (must_change_password=true)
--
-- 결정사항 (사장님 확정):
--   · 전화번호 변경 허용 (= 로그인 식별자 변경, UI 측에서 경고).
--   · 역할 다중 허용 — admin+engineer 등 (E022 조동욱·E002 구현서 패턴 보존).
--   · 비번 = 운영자 리셋 (옛 비번 검증 없음). 리셋 후 must_change_password=true.
--   · 삭제 → is_active=false (행 보존, FK 안전).
--   · partner role + principal_id 처리는 본 마이그 범위 밖.
--
-- 회귀 안전: 다른 RPC/트리거/정책 무손상. 행 데이터 변경 0.
-- ============================================================================

BEGIN;

-- ============================================================================
-- [A] admin_upsert_user — 계정 정보 수정 + 신규 + 활성 토글
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_upsert_user(
  p_code  text,
  p_patch jsonb,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant uuid;
  v_user_id       uuid;
  v_rows          int;
  v_name          text;
  v_phone         text;
  v_default_role  text;
  v_prefix        text;
  v_next_num      int;
  v_new_code      text;
  v_old_phone     text;
  v_dup_count     int;
  v_clean_phone   text;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'patch 누락 또는 object 아님');
  END IF;

  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  SELECT tenant_id INTO v_caller_tenant FROM users WHERE id = p_actor;
  IF v_caller_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '호출자 tenant 확인 실패');
  END IF;

  -- ────────────────────────────────────────────────────────────
  -- UPDATE 경로 — p_code 있고 해당 user 존재 시
  -- ────────────────────────────────────────────────────────────
  IF p_code IS NOT NULL AND TRIM(p_code) <> '' THEN
    SELECT id, phone INTO v_user_id, v_old_phone
    FROM users
    WHERE tenant_id = v_caller_tenant AND code = p_code
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      -- phone 변경 시 unique 충돌 검사
      IF p_patch ? 'phone' THEN
        v_clean_phone := REPLACE(REPLACE(REPLACE(COALESCE(p_patch->>'phone',''), '-',''), ' ',''), '+','');
        IF v_clean_phone <> '' AND v_clean_phone <> REPLACE(REPLACE(REPLACE(COALESCE(v_old_phone,''), '-',''), ' ',''), '+','') THEN
          SELECT COUNT(*) INTO v_dup_count
          FROM users
          WHERE tenant_id = v_caller_tenant
            AND id <> v_user_id
            AND REPLACE(REPLACE(REPLACE(COALESCE(phone,''), '-',''), ' ',''), '+','') = v_clean_phone;
          IF v_dup_count > 0 THEN
            RETURN jsonb_build_object('ok', false, 'error', '이미 사용 중인 전화번호');
          END IF;
        END IF;
      END IF;

      UPDATE users SET
        name      = COALESCE(p_patch->>'name',  name),
        phone     = COALESCE(p_patch->>'phone', phone),
        email     = NULLIF(COALESCE(p_patch->>'email',  email), ''),
        region    = NULLIF(COALESCE(p_patch->>'region', region), ''),
        is_active = COALESCE((p_patch->>'is_active')::boolean, is_active)
      WHERE id = v_user_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;

      RETURN jsonb_build_object(
        'ok',            true,
        'action',        'update',
        'user_id',       v_user_id,
        'code',          p_code,
        'rows_affected', v_rows
      );
    END IF;
  END IF;

  -- ────────────────────────────────────────────────────────────
  -- INSERT 경로 — 신규 사용자
  -- ────────────────────────────────────────────────────────────
  v_name  := COALESCE(p_patch->>'name', '');
  v_phone := COALESCE(p_patch->>'phone', '');
  IF v_name = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '이름 필수');
  END IF;
  IF v_phone = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '전화번호 필수');
  END IF;

  -- default_role 결정 — prefix 매핑
  v_default_role := COALESCE(p_patch->>'default_role', 'operator');
  IF v_default_role NOT IN ('admin','operator','engineer','owner') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'default_role 은 admin/operator/engineer/owner 중 하나 (신규 partner 별도)');
  END IF;

  v_prefix := CASE v_default_role
    WHEN 'admin'    THEN 'A'
    WHEN 'operator' THEN 'H'
    WHEN 'engineer' THEN 'E'
    WHEN 'owner'    THEN 'O'
  END;

  -- phone unique 검사 (신규)
  v_clean_phone := REPLACE(REPLACE(REPLACE(v_phone, '-',''), ' ',''), '+','');
  SELECT COUNT(*) INTO v_dup_count
  FROM users
  WHERE tenant_id = v_caller_tenant
    AND REPLACE(REPLACE(REPLACE(COALESCE(phone,''), '-',''), ' ',''), '+','') = v_clean_phone;
  IF v_dup_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 사용 중인 전화번호');
  END IF;

  -- p_code 직접 전달되면 그대로, 없으면 prefix MAX+1 (3자리 zero-pad)
  IF p_code IS NOT NULL AND TRIM(p_code) <> '' THEN
    v_new_code := p_code;
  ELSE
    SELECT COALESCE(MAX(SUBSTRING(code FROM 2)::int), 0) + 1 INTO v_next_num
    FROM users
    WHERE tenant_id = v_caller_tenant
      AND code ~ ('^' || v_prefix || '[0-9]+$');
    v_new_code := v_prefix || LPAD(v_next_num::text, 3, '0');
  END IF;

  -- INSERT users — 트리거 auto_init_user_auth 가 password_hash + email 자동 부여
  INSERT INTO users (tenant_id, code, name, phone, region, is_active)
  VALUES (
    v_caller_tenant,
    v_new_code,
    v_name,
    v_phone,
    NULLIF(p_patch->>'region', ''),
    COALESCE((p_patch->>'is_active')::boolean, true)
  )
  RETURNING id INTO v_user_id;

  -- email 명시값이 있으면 트리거 결과 덮어쓰기 (옵션)
  IF p_patch ? 'email' AND NULLIF(p_patch->>'email','') IS NOT NULL THEN
    UPDATE users SET email = p_patch->>'email' WHERE id = v_user_id;
  END IF;

  -- 기본 역할 1개 INSERT (principal_id=NULL, partial index ① 준수)
  INSERT INTO user_roles (user_id, role, is_primary, principal_id)
  VALUES (v_user_id, v_default_role, true, NULL);

  RETURN jsonb_build_object(
    'ok',            true,
    'action',        'create',
    'user_id',       v_user_id,
    'code',          v_new_code,
    'rows_affected', 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_user(text, jsonb, uuid) TO anon, authenticated;

-- ============================================================================
-- [B] admin_set_user_roles — 역할 SET 변경 (다중 역할 허용)
--    partner+principal_id 행은 보존 (이 RPC 범위 밖).
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_set_user_roles(
  p_user_id uuid,
  p_roles   jsonb,
  p_actor   uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant uuid;
  v_role_text     text;
  v_role_arr      text[];
  v_first         boolean := true;
  v_removed       int;
  v_inserted      int := 0;
  v_has_admin     boolean := false;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_id 누락');
  END IF;
  IF p_roles IS NULL OR jsonb_typeof(p_roles) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'roles 누락 또는 배열 아님');
  END IF;

  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  SELECT tenant_id INTO v_caller_tenant FROM users WHERE id = p_actor;
  IF v_caller_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '호출자 tenant 확인 실패');
  END IF;

  -- 역할 배열 추출 + 검증
  SELECT array_agg(DISTINCT TRIM(elem))
    INTO v_role_arr
  FROM jsonb_array_elements_text(p_roles) AS elem
  WHERE TRIM(elem) <> '';

  IF v_role_arr IS NULL OR array_length(v_role_arr, 1) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'roles 비어있음 — 최소 1개 필요');
  END IF;

  -- 각 role 값 검증 (partner 거부)
  FOREACH v_role_text IN ARRAY v_role_arr LOOP
    IF v_role_text NOT IN ('owner','admin','operator','engineer') THEN
      IF v_role_text = 'partner' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'partner 역할은 별도 RPC 사용 (principal_id 필요)');
      END IF;
      RETURN jsonb_build_object('ok', false, 'error', '알 수 없는 role: ' || v_role_text);
    END IF;
    IF v_role_text = 'admin' OR v_role_text = 'owner' THEN
      v_has_admin := true;
    END IF;
  END LOOP;

  -- 자기보호 — 운영자가 본인 admin/owner 권한 제거 시도 거부
  IF p_actor = p_user_id AND NOT v_has_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', '본인 관리자 권한은 해제할 수 없어요');
  END IF;

  -- 기존 principal_id=NULL 역할 모두 삭제 (partner+principal_id 행은 보존)
  DELETE FROM user_roles
  WHERE user_id = p_user_id AND principal_id IS NULL;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- 새 역할 INSERT — 첫째 is_primary=true
  FOREACH v_role_text IN ARRAY v_role_arr LOOP
    INSERT INTO user_roles (user_id, role, is_primary, principal_id)
    VALUES (p_user_id, v_role_text, v_first, NULL);
    v_inserted := v_inserted + 1;
    v_first := false;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',            true,
    'user_id',       p_user_id,
    'roles_set',     v_inserted,
    'roles_removed', v_removed,
    'rows_affected', v_inserted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_user_roles(uuid, jsonb, uuid) TO anon, authenticated;

-- ============================================================================
-- [C] admin_reset_user_password — 운영자 비번 리셋
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_reset_user_password(
  p_user_id      uuid,
  p_new_password text,
  p_actor        uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rows int;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_id 누락');
  END IF;
  IF COALESCE(TRIM(p_new_password), '') = '' OR LENGTH(p_new_password) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'password_too_short (최소 4자)');
  END IF;

  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  -- 옛 비번 검증 없음 (= 운영자 리셋 패턴). 새 해시 + must_change_password=true.
  UPDATE users SET
    password_hash        = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    must_change_password = true
  WHERE id = p_user_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '대상 사용자 없음 또는 권한 부족');
  END IF;

  RETURN jsonb_build_object(
    'ok',                   true,
    'user_id',              p_user_id,
    'rows_affected',        v_rows,
    'must_change_password', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_user_password(uuid, text, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 — 함수 3개 생성 확인 (3행이 떠야 함)
-- ============================================================================
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname IN ('admin_upsert_user','admin_set_user_roles','admin_reset_user_password')
ORDER BY proname;
