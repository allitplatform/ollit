-- ============================================================================
-- Migration 243 - 협력사 예외 처리 푸시는 알림 설정과 무관하게 항상 발송
-- 작성 2026-10-07 · 선행: 242
--
-- 사장님 결정 (2026-10-07): 운영자의 "변경 요청" · "올데이케어로 회수" 는 운영상 필수 알림이다.
--   협력사 관리자가 "작업 취소 · 일정 변경" 알림이나 전체 스위치를 꺼 두었어도 보낸다.
--   (처리 완료 -> 운영자 푸시는 mig 242 에서 이미 조건 없이 보낸다.)
--
-- 바꾸는 것: mig 242 의 내부 함수 _sub_push_managers 한 개 - 받는 사람 조건에서 알림 설정 확인을 뺀다.
--   그 협력사의 "활성 관리자 전원" 에게 보낸다. 나머지는 mig 242 와 같다.
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION _sub_push_managers(p_sub uuid, p_title text, p_body text, p_tag text, p_task uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT u.id FROM users u
     WHERE u.subcontractor_id = p_sub AND u.sub_role = 'manager' AND u.is_active = true
  LOOP
    PERFORM _msg_push(jsonb_build_object(
      'targetType', 'user', 'targetId', r.id::text,
      'title', p_title, 'body', p_body, 'url', '/', 'tag', p_tag, 'taskId', p_task::text));
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[sub push] 관리자 알림 실패 - 처리는 계속: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION _sub_push_managers(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

-- 검증 - 기대: 1행, 설정_확인_없음 = true
SELECT proname, position('_sub_notify_on' IN prosrc) = 0 AS 설정_확인_없음
  FROM pg_proc WHERE proname = '_sub_push_managers';
