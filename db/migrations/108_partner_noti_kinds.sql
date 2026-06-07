-- ============================================================================
-- Migration 108 — partner 5 kind 확장 (set_notification_pref + CHECK)
-- 2026-06-08
--
-- 배경:
--   원청 알림 5종 신설. 운영자 kind (taskComplete 등) 와 이름 분리 — 같은
--   "완료" 제목이라도 운영자 토글과 안 섞이게.
--
-- 새 5 kind:
--   partnerAssign    — 🎯 작업이 배정되었습니다
--   partnerSchedule  — 📅 일정 확정 (원청)
--   partnerComplete  — ✅ 작업이 완료되었습니다
--   partnerCancel    — ❌ 작업이 취소되었습니다
--   partnerSettle    — 💰 정산 완료
--
-- Mig 105 패턴 동일 (whitelist + CHECK 제약 확장).
-- ============================================================================

BEGIN;

-- [1] CHECK 제약 확장 (있을 때만)
DO $$
DECLARE
  v_check_name text;
BEGIN
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
      -- 운영자 / 기사 (Mig 105 기존 10종)
      'newOrder','assignment','scheduleChange','taskComplete',
      'partialEtc','settleComplete',
      'taskStart','engineerAccept','cancelRequest','refrigClosed',
      -- 원청 (2026-06-08 신규 5종)
      'partnerAssign','partnerSchedule','partnerComplete','partnerCancel','partnerSettle'
    ));
END $$;

-- [2] set_notification_pref RPC 본문 갱신 (whitelist 확장)
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
    'taskStart','engineerAccept','cancelRequest','refrigClosed',
    'partnerAssign','partnerSchedule','partnerComplete','partnerCancel','partnerSettle'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'kind 미지원');
  END IF;

  INSERT INTO user_notification_preferences (user_id, kind, enabled, updated_at)
  VALUES (p_user_id, p_kind, p_enabled, now())
  ON CONFLICT (user_id, kind)
  DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'kind', p_kind, 'enabled', p_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION set_notification_pref(uuid, text, boolean, uuid) TO anon, authenticated;

COMMIT;

-- 검증
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.user_notification_preferences'::regclass
  AND contype = 'c';
