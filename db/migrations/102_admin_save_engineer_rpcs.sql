-- ============================================================================
-- Migration 102 — admin_*_engineer RPC 3종 (운영자 프로 관리 저장)
-- 2026-06-07
--
-- 배경:
--   users / user_roles / engineer_principal_permissions / engineer_zones 가
--   anon UPDATE/INSERT RLS 정책 없음 → PWA(anon key) 운영자 저장이 0행 매칭
--   silent fail. localStorage 만 갱신돼 다음 refetch 시 옛 값으로 초기화됨.
--
-- 해결:
--   Mig 074 / 096 / 098 패턴 (SECURITY DEFINER + p_actor + _caller_is_admin) 동일.
--   본 파일 RPC 3개:
--     · admin_upsert_engineer       — users + user_roles (INSERT or UPDATE)
--     · admin_save_engineer_skill   — engineer_principal_permissions + engineer_zones
--     · admin_delete_engineer_skill — engineer_principal_permissions DELETE
--
-- 회귀 안전:
--   · CREATE OR REPLACE — 재실행 idempotent.
--   · engineer_rates (Mig 012 anon 4종 정책) — 본 마이그 무손상.
--   · 기존 행 데이터 / 다른 컬럼 정책 / 트리거 무손상.
-- ============================================================================

BEGIN;

-- ============================================================================
-- [A] admin_upsert_engineer — users + user_roles (engineer 역할) 저장
-- ============================================================================
--
-- 인자:
--   p_code    text  — 기사 code ("E035") — 신규는 클라가 next_engineer_code() 호출 후 전달.
--   p_patch   jsonb — 화이트리스트된 필드만 추출 (그 외 키 무시):
--                     name, phone, email, is_active, bank_name, bank_account,
--                     account_holder, refrigerant_rate, region
--   p_actor   uuid  — 호출자 (운영자) user_id.
--
-- 응답:
--   { ok, action:'create'|'update', user_id, code, rows_affected }
--   { ok:false, error:'...' }
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_upsert_engineer(
  p_code    text,
  p_patch   jsonb,
  p_actor   uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant   uuid;
  v_user_id         uuid;
  v_rows            int;
  v_name            text;
  v_phone           text;
BEGIN
  -- 인자 검증
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF p_code IS NULL OR TRIM(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code 누락');
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'patch 누락 또는 object 아님');
  END IF;

  -- 권한 — 운영자 (owner/operator/admin) 만
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  -- 호출자 tenant_id 추출 (신규 INSERT 시 사용)
  SELECT tenant_id INTO v_caller_tenant FROM users WHERE id = p_actor;
  IF v_caller_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '호출자 tenant 확인 실패');
  END IF;

  -- 존재 여부 확인 (tenant_id + code)
  SELECT id INTO v_user_id
  FROM users
  WHERE tenant_id = v_caller_tenant
    AND code = p_code
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- ─── UPDATE 경로 ─────────────────────────────────────────────
    -- 화이트리스트 키만 변경. patch에 키 없으면 기존 값 보존.
    UPDATE users SET
      name              = COALESCE(p_patch->>'name',              name),
      phone             = COALESCE(p_patch->>'phone',             phone),
      email             = COALESCE(p_patch->>'email',             email),
      is_active         = COALESCE((p_patch->>'is_active')::boolean, is_active),
      bank_account      = COALESCE(p_patch->>'bank_account',      bank_account),
      region            = COALESCE(p_patch->>'region',            region)
    WHERE id = v_user_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    -- bank_name / account_holder / refrigerant_rate — 컬럼 존재 시에만 적용
    -- (옛 스키마 호환 — 운영 DB에 존재한다고 가정하고 시도, 없으면 무시)
    BEGIN
      EXECUTE format(
        'UPDATE users SET bank_name = COALESCE(%L, bank_name) WHERE id = %L',
        p_patch->>'bank_name', v_user_id
      );
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
    BEGIN
      EXECUTE format(
        'UPDATE users SET account_holder = COALESCE(%L, account_holder) WHERE id = %L',
        p_patch->>'account_holder', v_user_id
      );
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
    IF p_patch ? 'refrigerant_rate' AND (p_patch->>'refrigerant_rate') IS NOT NULL THEN
      BEGIN
        EXECUTE format(
          'UPDATE users SET refrigerant_rate = %L::numeric WHERE id = %L',
          p_patch->>'refrigerant_rate', v_user_id
        );
      EXCEPTION WHEN undefined_column THEN NULL;
      END;
    END IF;

    -- engineer 역할 보장 (멱등 — partial unique index 우회: SELECT → 없으면 INSERT)
    IF NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = v_user_id
        AND role = 'engineer'
        AND principal_id IS NULL
    ) THEN
      INSERT INTO user_roles (user_id, role, is_primary, principal_id)
      VALUES (v_user_id, 'engineer', true, NULL);
    END IF;

    RETURN jsonb_build_object(
      'ok',            true,
      'action',        'update',
      'user_id',       v_user_id,
      'code',          p_code,
      'rows_affected', v_rows
    );
  END IF;

  -- ─── INSERT 경로 ─────────────────────────────────────────────
  v_name  := COALESCE(p_patch->>'name', '');
  v_phone := COALESCE(p_patch->>'phone', '');
  IF v_name = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '이름 필수');
  END IF;
  IF v_phone = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '전화번호 필수');
  END IF;

  INSERT INTO users (
    tenant_id, code, name, phone, email, is_active,
    bank_account, region
  ) VALUES (
    v_caller_tenant,
    p_code,
    v_name,
    v_phone,
    NULLIF(p_patch->>'email', ''),
    COALESCE((p_patch->>'is_active')::boolean, true),
    NULLIF(p_patch->>'bank_account', ''),
    NULLIF(p_patch->>'region', '')
  )
  RETURNING id INTO v_user_id;

  -- bank_name / account_holder / refrigerant_rate (옵션 컬럼) — 존재 시 갱신
  BEGIN
    EXECUTE format(
      'UPDATE users SET bank_name = %L WHERE id = %L',
      NULLIF(p_patch->>'bank_name', ''), v_user_id
    );
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  BEGIN
    EXECUTE format(
      'UPDATE users SET account_holder = %L WHERE id = %L',
      NULLIF(p_patch->>'account_holder', ''), v_user_id
    );
  EXCEPTION WHEN undefined_column THEN NULL;
  END;
  IF p_patch ? 'refrigerant_rate' AND (p_patch->>'refrigerant_rate') IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'UPDATE users SET refrigerant_rate = %L::numeric WHERE id = %L',
        p_patch->>'refrigerant_rate', v_user_id
      );
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;

  -- engineer 역할 INSERT
  INSERT INTO user_roles (user_id, role, is_primary, principal_id)
  VALUES (v_user_id, 'engineer', true, NULL);

  RETURN jsonb_build_object(
    'ok',            true,
    'action',        'create',
    'user_id',       v_user_id,
    'code',          p_code,
    'rows_affected', 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_engineer(text, jsonb, uuid) TO anon, authenticated;

-- ============================================================================
-- [B] admin_save_engineer_skill — engineer_principal_permissions + engineer_zones
-- ============================================================================
--
-- 인자:
--   p_user_id      uuid — users.id
--   p_service_code text — 'cleaning' | 'refrigerant' 등
--   p_level        text — 'main' | 'sub' (NULL 이면 _skill_delete 로 우회)
--   p_zones        text[] — 지역 코드 배열 (전체 교체)
--   p_actor        uuid — 운영자 user_id
--
-- 응답: { ok, action, rows_affected }
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_save_engineer_skill(
  p_user_id      uuid,
  p_service_code text,
  p_level        text,
  p_zones        text[],
  p_actor        uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zones_count int := 0;
  z text;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_id 누락');
  END IF;
  IF p_service_code IS NULL OR TRIM(p_service_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_code 누락');
  END IF;

  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  -- level NULL → 호출 측이 delete RPC 사용해야 함
  IF p_level IS NULL OR TRIM(p_level) = '' OR p_level = 'none' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'level NULL — admin_delete_engineer_skill 사용');
  END IF;

  -- 1) epp 동일 (user_id, service_code) 의 모든 기존 row 삭제 (NULL + 원청별 통합)
  DELETE FROM engineer_principal_permissions
  WHERE user_id = p_user_id AND service_code = p_service_code;

  -- 2) NULL principal_code row 1개 INSERT
  INSERT INTO engineer_principal_permissions (
    user_id, principal_code, service_code, level, active
  ) VALUES (
    p_user_id, NULL, p_service_code, p_level, true
  );

  -- 3) zones 전체 교체 — user_id 의 모든 ez DELETE → 새 zones INSERT
  --    옛 D7 spec 보존: zones 는 service_code 비종속 (모든 service 공통).
  --    호출 측이 cleaning+refrigerant 양쪽 zones 합쳐서 전달해야 (현 클라 그대로).
  DELETE FROM engineer_zones WHERE user_id = p_user_id;

  IF p_zones IS NOT NULL AND array_length(p_zones, 1) > 0 THEN
    FOREACH z IN ARRAY p_zones LOOP
      IF z IS NOT NULL AND TRIM(z) <> '' THEN
        INSERT INTO engineer_zones (user_id, district, active)
        VALUES (p_user_id, TRIM(z), true)
        ON CONFLICT (user_id, district) DO NOTHING;
        v_zones_count := v_zones_count + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok',            true,
    'action',        'upsert',
    'user_id',       p_user_id,
    'service_code',  p_service_code,
    'level',         p_level,
    'zones_count',   v_zones_count,
    'rows_affected', 1 + v_zones_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_save_engineer_skill(uuid, text, text, text[], uuid) TO anon, authenticated;

-- ============================================================================
-- [C] admin_delete_engineer_skill — engineer_principal_permissions DELETE
--    (engineer_zones 는 보존 — D8 spec: 다른 service 가 zones 공유 가능)
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_delete_engineer_skill(
  p_user_id      uuid,
  p_service_code text,
  p_actor        uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
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
  IF p_service_code IS NULL OR TRIM(p_service_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_code 누락');
  END IF;

  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  DELETE FROM engineer_principal_permissions
  WHERE user_id = p_user_id AND service_code = p_service_code;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok',            true,
    'action',        'delete',
    'rows_affected', v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_engineer_skill(uuid, text, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 — 함수 3개 생성 확인 (1행씩 떠야 함)
-- ============================================================================
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname IN ('admin_upsert_engineer','admin_save_engineer_skill','admin_delete_engineer_skill')
ORDER BY proname;
