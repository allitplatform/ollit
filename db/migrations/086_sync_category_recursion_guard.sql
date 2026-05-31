-- ============================================
-- Migration 086 — sync_category_data_to_task_items 재귀 가드
-- 작성 : 2026-05-31
-- 실행 : 2026-05-31 (운영 DB 적용, A-260529-008 engineer 108k 적용 확인)
-- ============================================
--
-- Root cause (Phase C Step 4 검증 중 발견):
--   task_items 직접 UPDATE 시 cascade chain:
--     1) task_items_a_sync_received_total_trg (Mig 084) 발화
--        → UPDATE tasks SET received_total, extra_fee (depth=1)
--     2) tasks UPDATE → sync_task_items_trg (Mig 017/ad-hoc 2026-05-28) 발화
--        → sync_category_data_to_task_items 호출 (depth=2)
--     3) sync_category_data_to_task_items 본문 측 옛 spec:
--        DELETE FROM task_items WHERE task_id = NEW.id;
--        INSERT 재생성 (category_data.workItems 측 → received_amount NULL 측)
--     4) 결과: 1) 단계에서 UPDATE 한 task_items.received_amount 측 사라짐
--        → compute_payment 측 row received_amount NULL fallback → legacy path 측 잘못된 결과
--
--   대조 (정상 케이스): trigger_task_items_resync_task_total (Mig 070) 측
--     "v_sum != product_price 측만 UPDATE" 가드 있어 cascade 차단됨.
--     sync_category_data_to_task_items 측 동일 가드 없음 → 본 086 측 추가.
--
-- 처방:
--   sync_category_data_to_task_items 본문 진입 즉시 pg_trigger_depth() > 1 측 check.
--   cascade (depth >= 2) 측 RETURN NEW — DELETE / INSERT skip.
--   직접 invocation (depth = 1) 측 옛 spec 동작 그대로:
--     · tasks INSERT (AFTER INSERT trigger)
--     · tasks UPDATE OF category_data (운영자 측 명시적 변경)
--     · tasks UPDATE OF product_price (changePriceAdapter 측 → 재생성 정상 흐름)
--
-- 영향 분석:
--   · depth = 1 흐름: 가드 통과 → 옛 spec 그대로 (회귀 0)
--   · depth >= 2 흐름 (cascade 발화): RETURN NEW → task_items 보존 (Phase C 측 핵심 fix)
--   · workItem.quote / avg_unit 분배 본문 (ad-hoc 2026-05-28) 보존
--   · UPDATE 시 task_items DELETE → 재생성 동작 (cat.workItems 측 일 때만) 보존
--
-- A-260529-008 검증 (2026-05-31):
--   · before: task_items 재생성 → engineer 61k (LEGACY path, unit=35k)
--   · after Mig 086: task_items 보존 → engineer 108k ✓ 사장님 spec
--
-- 의존:
--   · Migration 017 (sync_task_items_trg)
--   · Migration 069 (cat.workItems 측 skip 가드)
--   · ad-hoc 2026-05-28 (avg_unit 분배 본문 — 본 086 측 base)
--   · Migration 084 (task_items.received_amount + task_items_a_sync_received_total_trg)
--
-- 안전:
--   · CREATE OR REPLACE FUNCTION — 재실행 안전
--   · trigger 등록 변경 X — sync_task_items_trg 측 정의 그대로
--   · 회귀 0: depth=1 측 동작 무변경
--
-- 재실행:
--   Supabase 콘솔 → SQL Editor → 통째 → Run.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION sync_category_data_to_task_items()
RETURNS trigger AS $$
DECLARE
  v_item              jsonb;
  v_work_type_id      uuid;
  v_appliance_type_id uuid;
  v_service_type_id   uuid;
  v_qty               numeric;
  v_unit_price        int;
  v_total_qty         numeric;
  v_avg_unit          int;
BEGIN
  -- ★ Migration 086 — 재귀 가드.
  --   cascade chain (task_items 직접 UPDATE → tasks UPDATE → 본 트리거 발화) 시
  --   pg_trigger_depth() >= 2 측 → DELETE/INSERT skip → received_amount 등 row 측 변경 보존.
  --   직접 invocation (tasks INSERT, tasks UPDATE OF category_data/product_price) 측 depth = 1 통과.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- UPDATE 시 기존 task_items 삭제 (재생성) — ad-hoc 2026-05-28 spec 그대로
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM task_items WHERE task_id = NEW.id;
  END IF;

  -- category_data.workItems 없으면 skip — ad-hoc 2026-05-28 spec 그대로
  IF NEW.category_data IS NULL OR NOT (NEW.category_data ? 'workItems') THEN
    RETURN NEW;
  END IF;

  -- 총수량 미리 계산 (평균 분배 기준)
  SELECT COALESCE(SUM((it->>'qty')::numeric), 0)
    INTO v_total_qty
    FROM jsonb_array_elements(NEW.category_data->'workItems') AS it;

  -- 평균 단가 (0 나눗셈 가드)
  IF v_total_qty > 0 THEN
    v_avg_unit := FLOOR(COALESCE(NEW.product_price, 0)::numeric / v_total_qty)::int;
  ELSE
    v_avg_unit := 0;
  END IF;

  -- workItems 배열 순회 — ad-hoc 2026-05-28 본문 보존
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.category_data->'workItems')
  LOOP
    SELECT id INTO v_service_type_id
    FROM service_types
    WHERE name = (v_item->>'workType')
    LIMIT 1;

    SELECT wt.id INTO v_work_type_id
    FROM work_types wt
    WHERE wt.service_type_id = v_service_type_id
      AND wt.name LIKE '%' || (v_item->>'appliance') || '%'
    LIMIT 1;

    SELECT id INTO v_appliance_type_id
    FROM appliance_types
    WHERE name = (v_item->>'appliance')
    LIMIT 1;

    v_qty := COALESCE((v_item->>'qty')::numeric, 1);

    -- 단가 결정 — 1순위 workItem.quote, 2순위 평균 분배 (avg_unit) — ad-hoc 2026-05-28 spec
    v_unit_price := COALESCE(
      (v_item->>'quote')::int,
      v_avg_unit
    );

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
  'v3 (Migration 086, 2026-05-31) — pg_trigger_depth() > 1 재귀 가드 추가. '
  'cascade chain (task_items UPDATE → tasks UPDATE → 본 트리거) 시 DELETE/INSERT skip → '
  'task_items 측 received_amount 등 row 직접 변경 보존. '
  '직접 invocation (depth=1) 측 ad-hoc 2026-05-28 spec (avg_unit 분배) 그대로.';

COMMIT;

-- ============================================
-- 검증 SQL (별도 실행 — 운영 측 2026-05-31 통과)
-- ============================================
--
-- A. 함수 본문에 pg_trigger_depth 가드 들어갔는지:
-- SELECT prosrc FROM pg_proc WHERE proname = 'sync_category_data_to_task_items';
-- 기대: 'pg_trigger_depth() > 1' 텍스트 포함
--
-- B. 함수 comment 확인:
-- SELECT obj_description(oid, 'pg_proc') FROM pg_proc WHERE proname = 'sync_category_data_to_task_items';
-- 기대: 'v3 (Migration 086' 포함.
--
-- C. 회귀 — 직접 invocation 측 옛 동작 그대로:
-- (개발 / ROLLBACK 안전한 task — 신규 접수 시뮬 또는 product_price UPDATE)
-- BEGIN;
--   INSERT INTO tasks ( ... category_data 측 {"workItems":[...]} ... ) RETURNING id;
--   SELECT qty, unit_price, subtotal FROM task_items WHERE task_id = <new_id>;
-- ROLLBACK;
-- 기대: task_items 자동 생성 (avg_unit 분배).
--
-- D. cascade 가드 — task_items 직접 UPDATE 측 보존 (Phase C 핵심):
-- (A-260529-008 측 측정)
-- BEGIN;
--   UPDATE task_items SET received_amount = 180000
--    WHERE id = <refrig_item_id>;
--   SELECT received_amount FROM task_items WHERE id = <refrig_item_id>;
-- ROLLBACK;
-- 기대: received_amount = 180000 ✓ (cascade 측 DELETE 측 발화 안 함)
--
-- E. A-260529-008 종합 검증 (운영 2026-05-31 통과):
-- · refrig row received_amount = 180000 UPDATE
-- · received_total = 250000, extra_fee = 110000 (자동 sync)
-- · engineer_amount = 108000 (refrig_rate 60% × 180000) ✓ 사장님 spec
