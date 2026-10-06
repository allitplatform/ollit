-- ============================================================================
-- Migration 213 - 묶음 1 (2/3): 작업 수행처 자동 맞춤 + 푸시 후보 걸러내기
-- 작성 2026-10-06 · 선행: 212
--
-- 내용
--   tasks BEFORE 트리거 1개 (tasks_sync_subcontractor)
--
--   [A] 배정 기사가 바뀌면 tasks.subcontractor_id 를 그 기사의 소속에 맞춥니다.
--       · 직영 기사 배정        -> NULL (직영 작업)
--       · 협력사 직원 배정      -> 그 협력사
--       · 배정 해제(기사 NULL)  -> 그대로 둠 ("협력사에 넘김 · 직원 미정" 상태 유지)
--       기존 배정 코드(운영자 앱의 직접 UPDATE)를 고치지 않아도 값이 맞게 유지됩니다.
--
--   [B] 푸시 후보(push_candidates)에서 "이 작업의 수행처가 아닌 협력사 소속 기사"를
--       뺍니다. 직영 작업의 수락 요청 푸시가 협력사 직원에게 가지 않게 하는
--       서버 쪽 방어선입니다 (Q6). 화면 쪽 추천 목록 제외는 코드에서 따로 합니다.
--       후보는 기사 code 또는 이름으로 들어오므로 둘 다 대조합니다.
--
-- 기존 데이터 영향
--   없음. 트리거는 이후의 INSERT / UPDATE 에만 작동하고, 지금은 소속 있는 기사가
--   0명이라 [A] 는 항상 NULL -> NULL, [B] 는 걸러낼 대상이 없습니다.
--   트리거 대상 칸: assigned_engineer_id, push_candidates, subcontractor_id.
-- ============================================================================

BEGIN;

-- 안전 확인: push_candidates 칸은 저장소 마이그레이션에 정의가 없습니다(운영 DB 에서
-- 직접 추가된 칸). jsonb 가 아니면 아래 트리거가 작업 저장을 막게 되므로,
-- 형식이 다르면 여기서 멈추고 아무것도 바꾸지 않습니다.
DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'push_candidates';
  IF v_type IS DISTINCT FROM 'jsonb' THEN
    RAISE EXCEPTION 'tasks.push_candidates 형식이 jsonb 가 아닙니다 (현재: %). 213 을 중단합니다 - 이 메시지를 전달해 주세요.', COALESCE(v_type, '칸 없음');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION trg_tasks_sync_subcontractor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_engineer_sub uuid;
  v_filtered     jsonb;
BEGIN
  -- [A] 배정 기사 변경 -> 수행처 맞춤
  IF NEW.assigned_engineer_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_engineer_id IS DISTINCT FROM OLD.assigned_engineer_id) THEN
    SELECT u.subcontractor_id INTO v_engineer_sub
      FROM users u
     WHERE u.id = NEW.assigned_engineer_id;
    NEW.subcontractor_id := v_engineer_sub;
  END IF;

  -- [B] 푸시 후보에서 다른 소속 협력사 기사 제외
  IF NEW.push_candidates IS NOT NULL
     AND jsonb_typeof(NEW.push_candidates) = 'array'
     AND jsonb_array_length(NEW.push_candidates) > 0
     AND (TG_OP = 'INSERT'
          OR NEW.push_candidates  IS DISTINCT FROM OLD.push_candidates
          OR NEW.subcontractor_id IS DISTINCT FROM OLD.subcontractor_id) THEN
    SELECT COALESCE(jsonb_agg(c.elem ORDER BY c.ord), '[]'::jsonb)
      INTO v_filtered
      FROM jsonb_array_elements(NEW.push_candidates) WITH ORDINALITY AS c(elem, ord)
     WHERE NOT EXISTS (
             SELECT 1
               FROM users u
              WHERE u.subcontractor_id IS NOT NULL
                AND u.subcontractor_id IS DISTINCT FROM NEW.subcontractor_id
                AND (u.code = (c.elem #>> '{}') OR u.name = (c.elem #>> '{}'))
           );
    NEW.push_candidates := v_filtered;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_tasks_sync_subcontractor() IS
  'Mig 213 - 배정 기사 소속에 tasks.subcontractor_id 맞춤 + 푸시 후보에서 다른 소속 협력사 기사 제외.';

DROP TRIGGER IF EXISTS tasks_sync_subcontractor ON tasks;
CREATE TRIGGER tasks_sync_subcontractor
  BEFORE INSERT OR UPDATE OF assigned_engineer_id, push_candidates, subcontractor_id
  ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_tasks_sync_subcontractor();

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 트리거 등록 - 기대: 1행
SELECT tgname FROM pg_trigger WHERE tgname = 'tasks_sync_subcontractor' AND NOT tgisinternal;

-- 2) 기존 작업 무변경 - 기대: 0
SELECT COUNT(*) AS 협력사_작업 FROM tasks WHERE subcontractor_id IS NOT NULL;

-- 3) 실화면 확인 (PWA, 코드 push 전에도 가능)
--   · 운영자: 직영 기사 1명 배정 / 재배정 -> 정상 저장, 기사 푸시 정상
--   · 운영자: 자동 배정 화면 진입 -> 후보 푸시가 평소대로 발송
