-- ============================================================================
-- Migration 105 — set_notification_pref RPC 화이트리스트 확장 (4 kind 추가)
-- 2026-06-07
--
-- 배경:
--   send.js inferKindFromTitle 가 매핑 안 했던 4종 title — 토글 게이트 통과 못 함.
--   사장님 요청: 토글로 끌 수 있게 4 kind 추가.
--     · taskStart      — "▶️ 작업 시작"
--     · engineerAccept — "🙋 기사 수락"
--     · cancelRequest  — "🚨 취소 요청"
--     · refrigClosed   — "❌ 냉매 수락 마감"
--
-- 변경: set_notification_pref 본문 화이트리스트만 확장. CHECK 제약 있으면 같이 갱신.
--
-- 회귀 안전:
--   · 기존 6 kind 거동 무수정.
--   · row 없음 = ON (default) 약속 그대로.
--   · 다른 RPC / 트리거 / 정책 무손상.
-- ============================================================================

BEGIN;

-- ── [1] CHECK 제약 확장 (있을 때만 — 없으면 SKIP) ──
DO $$
DECLARE
  v_check_name text;
BEGIN
  -- kind 컬럼에 걸린 CHECK 제약 자동 탐색
  SELECT conname INTO v_check_name
  FROM pg_constraint
  WHERE conrelid = 'public.user_notification_preferences'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%kind%'
  LIMIT 1;

  IF v_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_notification_preferences DROP CONSTRAINT %I', v_check_name);
  END IF;

  ALTER TABLE public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_kind_check
    CHECK (kind IN (
      'newOrder','assignment','scheduleChange','taskComplete',
      'partialEtc','settleComplete',
      'taskStart','engineerAccept','cancelRequest','refrigClosed'
    ));
END $$;

-- ── [2] set_notification_pref RPC 본문 갱신 (화이트리스트만 확장, 그 외 동작 보존) ──
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

  -- UPSERT — (user_id, kind) 유니크 키. enabled 갱신.
  INSERT INTO user_notification_preferences (user_id, kind, enabled, updated_at)
  VALUES (p_user_id, p_kind, p_enabled, now())
  ON CONFLICT (user_id, kind)
  DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'kind', p_kind, 'enabled', p_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION set_notification_pref(uuid, text, boolean, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) CHECK 제약 확인
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.user_notification_preferences'::regclass
  AND contype = 'c';

-- 2) 함수 본문 확인 — 기대: kind 화이트리스트에 10개 모두 포함
SELECT pg_get_functiondef('set_notification_pref(uuid, text, boolean, uuid)'::regprocedure);
