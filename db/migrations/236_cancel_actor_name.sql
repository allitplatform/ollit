-- ============================================================================
-- Migration 236 - 취소자 이름 기록
-- 작성 2026-10-06 · 선행: 073/074(원청·운영자 취소), 098(취소 정보 기록), 142(기사 취소)
--
-- 사장님 결정 (2026-10-06)
--   취소 배너에 "취소자 홍길동(운영자)" 처럼 이름까지 보여 준다. 기존 취소 건은 구분만 (소급 없음).
--
-- 방식
--   취소로 끝나는 서버 경로는 이미 전부 "누가 취소했는지" 를 user_id 로 남깁니다
--   (tasks.category_data 의 cancelActorUserId):
--     · 원청 취소      partner_full_cancel   (mig 074)
--     · 운영자 취소    admin_full_cancel     (mig 074)
--     · 취소 정보 기록 set_task_cancel_info  (mig 098)
--     · 기사 취소      engineer_full_cancel  (mig 142)
--   그래서 RPC 본문은 하나도 고치지 않고, 저장 직전 트리거 한 개로 이름을 같이 적습니다.
--     · cancelActorUserId 가 새로 들어오거나 바뀌면      -> cancelActorName      = 그 사용자의 이름
--     · cancelRequestedByUserId 가 새로 들어오거나 바뀌면 -> cancelRequestedByName = 그 사용자의 이름
--       (기사의 취소 요청 · 운영자의 취소 요청 승인은 앱이 user_id 를 적어 보냅니다 - 이번 코드 변경)
--   "새로 들어오거나 바뀔 때만" 적으므로 이미 취소된 작업에는 이름이 생기지 않습니다 (소급 없음).
--
-- 참고: 협력사 관리자의 "반려" 는 취소가 아니라 직영으로 되돌리는 처리라 대상이 아닙니다
--       (반려한 사람은 작업 메모·처리 이력에 이미 이름으로 남습니다 - mig 232).
--
-- 기존 데이터 영향 없음 (함수 1개, 트리거 1개 추가). 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION trg_tasks_cancel_actor_name()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_new  text;
  v_old  text;
  v_name text;
BEGIN
  IF NEW.category_data IS NULL THEN
    RETURN NEW;
  END IF;

  -- 취소자
  v_new := NEW.category_data ->> 'cancelActorUserId';
  v_old := CASE WHEN TG_OP = 'UPDATE' THEN OLD.category_data ->> 'cancelActorUserId' END;
  IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old THEN
    BEGIN
      SELECT name INTO v_name FROM users WHERE id = v_new::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_name := NULL;        -- user_id 형식이 아니면 이름 없이 진행 (취소 자체는 막지 않는다)
    END;
    IF v_name IS NOT NULL THEN
      NEW.category_data := NEW.category_data || jsonb_build_object('cancelActorName', v_name);
    ELSE
      NEW.category_data := NEW.category_data - 'cancelActorName';
    END IF;
  END IF;

  -- 취소 요청자
  v_name := NULL;
  v_new := NEW.category_data ->> 'cancelRequestedByUserId';
  v_old := CASE WHEN TG_OP = 'UPDATE' THEN OLD.category_data ->> 'cancelRequestedByUserId' END;
  IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old THEN
    BEGIN
      SELECT name INTO v_name FROM users WHERE id = v_new::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_name := NULL;
    END;
    IF v_name IS NOT NULL THEN
      NEW.category_data := NEW.category_data || jsonb_build_object('cancelRequestedByName', v_name);
    ELSE
      NEW.category_data := NEW.category_data - 'cancelRequestedByName';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_cancel_actor_name ON tasks;
CREATE TRIGGER tasks_cancel_actor_name
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION trg_tasks_cancel_actor_name();

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 트리거 - 기대: 1행
SELECT tgname FROM pg_trigger WHERE tgname = 'tasks_cancel_actor_name' AND NOT tgisinternal;

-- 2) 소급 없음 확인 - 기대: 이름_있음 = 0 (실행 직후. 이후 새로 취소한 건부터 늘어남)
SELECT COUNT(*) AS 취소_작업,
       COUNT(*) FILTER (WHERE category_data ? 'cancelActorUserId') AS 취소자_기록_있음,
       COUNT(*) FILTER (WHERE category_data ? 'cancelActorName')   AS 이름_있음
  FROM tasks WHERE status = '취소';
