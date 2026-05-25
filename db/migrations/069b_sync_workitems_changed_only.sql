-- ============================================================================
-- Migration 069b — sync_category_data_to_task_items 가드 강화
--                  (UPDATE 시 workItems '변경'됐을 때만 발화)
-- 작성: 2026-05-25
-- 상태: 초안 (사장님 검토 대기 — 적용 X)
-- ============================================================================
-- 배경 (069 = usol_n 전멸 사고 트리거):
--   Mig 017 sync_task_items_trg 는 tasks INSERT/UPDATE 시 cat.workItems 키 검사
--   없이 task_items DELETE+INSERT 강행 → 2026-05-25 usol_n 전멸 사고.
--   Mig 069 에서 1차 안전화 — cat.workItems 키 존재 검사 후만 진행. 빈 cat 측 DELETE 차단.
--
-- 본 069b 의 추가 강화 사유:
--   070(취소 플래그) 적용 후 task_items_resync_task_total_trg 가 부분취소 시
--   tasks.product_price 를 UPDATE → 069 가드는 통과하지 못함(키 있는 task 측).
--   key 있는 task 측 product_price 만 변경된 경우에도 sync 발화 → DELETE+INSERT →
--   is_canceled 컬럼 DEFAULT false 로 재생성 → 부분취소 플래그 소실.
--
--   현재 운영 중 cat.workItems 키 보유 task = 20건 (전체 907 중). 즉시 영향 0건이나
--   본 마이그 적용 후 이 20건 중 하나라도 부분취소 진입 시 데이터 손실 발생.
--
-- 변경 한 줄 추가:
--   TG_OP='UPDATE' AND OLD/NEW workItems 동일 → RETURN NEW (sync skip).
--   IS NOT DISTINCT FROM 측 NULL-safe 비교 — 둘 다 NULL 도 동일 처리.
--
-- 발화 spec (정정 후):
--   · INSERT — cat.workItems 키 있으면 발화 (기존 동일)
--   · UPDATE + cat.workItems 키 있음 + workItems 실제 변경 → 발화 (DELETE+INSERT)
--   · UPDATE + cat.workItems 키 있음 + workItems 미변경 → RETURN (변경 없으니 동기 불필요)
--   · UPDATE + cat.workItems 키 없음 → RETURN (069 1차 가드)
--
-- 회귀 방지:
--   - 069 본문 통째 보존, 새 가드는 UPDATE 분기 진입 직전 한 줄만 추가.
--   - CREATE OR REPLACE FUNCTION = 멱등.
--   - 트리거 정의(sync_task_items_trg) 무수정 — 함수 본문만 재정의.
--   - 측 6 원청 신규 접수 흐름(INSERT) 회귀 0.
--   - 운영 중 cat.workItems 명시적 변경 흐름(원본 spec) 회귀 0 — 변경 감지 시 발화.
--   - 070 product_price UPDATE 측 → workItems 동일 → RETURN → is_canceled 영구 안전.
--
-- 의존:
--   - 069 적용 완료 (현 활성 sync 함수).
--   - 070 적용 직전 사전 가드 spec.
--
-- 롤백:
--   - 069 본문 그대로 CREATE OR REPLACE → 본 069b 효과 무효화.
--   - 또는 본 069b 의 가드 한 줄(IF TG_OP='UPDATE' ... IS NOT DISTINCT FROM ...) 제거.
--
-- 실행: 사장님 OK 후 Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION sync_category_data_to_task_items()
RETURNS trigger AS $$
DECLARE
  v_item jsonb;
  v_work_type_id uuid;
  v_appliance_type_id uuid;
  v_service_type_id uuid;
  v_qty numeric;
  v_unit_price int;
BEGIN
  -- [069 1차 가드] category_data.workItems 키 존재 여부 검사.
  --   없으면 RETURN — UPDATE 분기에서 DELETE 차단 (usol_n 전멸 사고 재발 방지).
  --   INSERT + cat 비어있는 경우도 동일하게 RETURN.
  IF NEW.category_data IS NULL OR NOT (NEW.category_data ? 'workItems') THEN
    RETURN NEW;
  END IF;

  -- [069b 추가 가드] UPDATE 시 workItems 실제 변경 여부 검사.
  --   미변경이면 RETURN — 다른 컬럼(product_price 등) 변경만으로는 DELETE+INSERT 차단.
  --   사유: 070 task_items_resync_task_total_trg 가 tasks.product_price UPDATE 시
  --         sync 가 발화하면 task_items DELETE+INSERT → is_canceled 등 신규 컬럼 소실.
  --   IS NOT DISTINCT FROM 측 NULL-safe (둘 다 NULL 도 같음 처리).
  IF TG_OP = 'UPDATE'
     AND OLD.category_data IS NOT NULL
     AND (OLD.category_data ? 'workItems')
     AND (OLD.category_data->'workItems') IS NOT DISTINCT FROM (NEW.category_data->'workItems')
  THEN
    RETURN NEW;
  END IF;

  -- 여기 도달 = (INSERT + cat.workItems 키 있음) 또는 (UPDATE + workItems 실제 변경).
  -- UPDATE 시 기존 task_items 삭제 (재생성 흐름) — 의도된 동기 spec.
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM task_items WHERE task_id = NEW.id;
  END IF;

  -- workItems 배열 순회 — Migration 017 본문 그대로 보존
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.category_data->'workItems')
  LOOP
    -- 한글 workType → service_type_id 찾기
    SELECT id INTO v_service_type_id
    FROM service_types
    WHERE name = (v_item->>'workType')
    LIMIT 1;

    -- service_type_id로 work_type_id 찾기 (appliance도 일치하는 거)
    SELECT wt.id INTO v_work_type_id
    FROM work_types wt
    WHERE wt.service_type_id = v_service_type_id
      AND wt.name LIKE '%' || (v_item->>'appliance') || '%'
    LIMIT 1;

    -- 한글 appliance → appliance_type_id
    SELECT id INTO v_appliance_type_id
    FROM appliance_types
    WHERE name = (v_item->>'appliance')
    LIMIT 1;

    -- qty와 unit_price
    v_qty := COALESCE((v_item->>'qty')::numeric, 1);
    v_unit_price := COALESCE(
      (v_item->>'quote')::int,
      NEW.product_price,
      0
    );

    -- task_items insert (NULL 가능)
    INSERT INTO task_items (
      task_id, work_type_id, appliance_type_id, qty, unit_price
    ) VALUES (
      NEW.id, v_work_type_id, v_appliance_type_id, v_qty, v_unit_price
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_category_data_to_task_items() IS
  '069b 가드 강화 — UPDATE 시 workItems 미변경이면 RETURN. 070 product_price UPDATE 측 sync 발화 차단 → is_canceled 영구 안전. (069 = usol_n 전멸 사고 트리거의 2차 안전화)';

COMMIT;

-- ============================================================================
-- 검증 SQL (별도 실행)
-- ============================================================================
-- 1) 함수 본문 적용 확인 (코멘트에 '069b 가드 강화' 포함):
-- SELECT proname, obj_description(oid, 'pg_proc')
-- FROM pg_proc WHERE proname = 'sync_category_data_to_task_items';
-- 기대 1 row: 코멘트 측 '069b 가드 강화' 포함.
--
-- 2) 트리거 정의 그대로인지 확인 (069b 측 함수만 재정의, 트리거 무수정):
-- SELECT trigger_name, event_manipulation, action_timing, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'sync_task_items_trg';
-- 기대: AFTER/BEFORE INSERT + UPDATE on tasks. 069 시점과 동일.
--
-- 3) 시뮬레이션 (cat.workItems 키 있는 task 측 product_price 변경 X 측 변경)
-- BEGIN;
--   -- (a) cat.workItems 키 있는 task 측 product_price 만 UPDATE
--   -- 기대: sync 발화 X. task_items 무변경.
--   UPDATE tasks SET product_price = product_price + 0 WHERE id = '<test 측 키 있는 task>';
--   -- task_items 개수·내용 변동 0 확인.
--
--   -- (b) cat.workItems 실제 변경 시
--   -- 기대: sync 발화. task_items DELETE+INSERT.
--   UPDATE tasks SET category_data = jsonb_set(category_data, '{workItems,0,qty}', '"2"'::jsonb)
--     WHERE id = '<test 측 키 있는 task>';
--   -- task_items qty 변경 확인.
-- ROLLBACK;
--
-- 4) 운영 cat.workItems 키 보유 20건 측 — 본 069b 적용 후 product_price/status 등 일반
--    컬럼 UPDATE 시 task_items 변동 0 확인 (디스플레이 측 무영향).
