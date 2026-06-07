-- ============================================================================
-- Migration 105b — set_notification_pref 회귀 정정 (tenant_id INSERT 컬럼 추가)
-- 2026-06-07 (사장님 환경 적용 완료 — 본 파일은 저장소 회귀 방지 reference)
--
-- 배경:
--   Mig 105 본체에서 user_notification_preferences INSERT 시 tenant_id 누락
--   → NOT NULL 제약 위반 또는 RLS 정합성 깨짐.
--   사장님이 Supabase SQL Editor 에서 즉시 정정 (105b 패턴).
--
-- 정정 내용:
--   · users 테이블에서 p_user_id 의 tenant_id 조회
--   · NULL fallback = '11111111-1111-1111-1111-111111111111' (Phase 1 단일 tenant)
--   · INSERT 컬럼 + VALUES 에 tenant_id 포함
--
-- ★ 회귀 방지 가드:
--   이후 set_notification_pref 본체를 다시 갱신하는 모든 마이그(108 등)는
--   반드시 tenant_id INSERT 컬럼을 유지해야 함. 본 105b 본문이 표준.
--
-- 회귀 안전:
--   · CREATE OR REPLACE — 재실행 idempotent.
--   · whitelist (Mig 105) 동일 — kind 변경 X.
--   · 본 시점 = 10 kind (Mig 105 기존). Mig 108 에서 partner 5종 추가.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION set_notification_pref(
  p_user_id uuid,
  p_kind    text,
  p_enabled boolean,
  p_actor   uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_id 누락');
  END IF;
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN (
    'newOrder','assignment','scheduleChange','taskComplete',
    'partialEtc','settleComplete',
    'taskStart','engineerAccept','cancelRequest','refrigClosed'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'kind 미지원');
  END IF;

  -- tenant_id 조회 (users.tenant_id, NULL 이면 Phase 1 단일 tenant 기본값)
  SELECT tenant_id INTO v_tenant FROM users WHERE id = p_user_id;
  IF v_tenant IS NULL THEN
    v_tenant := '11111111-1111-1111-1111-111111111111'::uuid;
  END IF;

  INSERT INTO user_notification_preferences (tenant_id, user_id, kind, enabled, updated_at)
  VALUES (v_tenant, p_user_id, p_kind, p_enabled, now())
  ON CONFLICT (user_id, kind)
  DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'kind', p_kind, 'enabled', p_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION set_notification_pref(uuid, text, boolean, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- ★ 정책 메모 (향후 마이그 작성자 필독):
--   set_notification_pref 본문 갱신 시 다음 3가지 반드시 유지:
--     1) v_tenant 변수 선언 + users.tenant_id 조회 + NULL fallback
--     2) INSERT 컬럼 목록에 tenant_id 포함
--     3) VALUES 에 v_tenant 포함
--   회귀 사고 이력: Mig 108 초안에서 tenant_id 빠뜨림 → 사장님 발견 → 즉시 정정.
-- ============================================================================
