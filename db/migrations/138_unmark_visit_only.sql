-- ============================================
-- Migration 138 — unmark_visit_only RPC (visit_only → 정상 작업 되돌리기)
-- 작성일 : 2026-06-17
-- 의존   : Mig 137 (mark_visit_only 스냅샷 보강) + Mig 111 (received_total=NULL 패턴) +
--          Mig 028 (task_items_compute_trg) + Mig 084 (received_total sync) +
--          Mig 083 (trg_tasks_sync_extra_fee) + Mig 027 (compute_payment_trg) +
--          Mig 096 (compute_payment v19)
--
-- 사장님 spec:
--   visit_only 작업을 정상 작업(완료)으로 복원.
--   두 모드:
--     A. 자동 — task_changes 최근 visit_only mark 스냅샷 사용 (p_manual NULL)
--     B. 수동 — 운영자가 p_manual jsonb 로 직접 입력 (스냅샷 무시 / override)
--
-- 시그니처:
--   unmark_visit_only(p_task_id uuid, p_actor uuid, p_manual jsonb DEFAULT NULL)
--
-- p_manual 구조 (수동 모드):
--   {
--     "task": {
--       "status":         "완료",        -- optional, 기본 '완료'
--       "product_price":  100000,        -- required
--       "extra_fee":      0,             -- 기본 0
--       "travel_fee":     0,             -- 기본 0
--       "payment_method": "cash"         -- optional
--     },
--     "task_items": [                    -- required, ≥1 행
--       {
--         "work_type_id":      "uuid",   -- required
--         "appliance_type_id": "uuid",   -- optional (NULL 허용)
--         "qty":               1,        -- 기본 1
--         "unit_price":        100000,   -- required
--         "order_type":        "본작업", -- 기본 '본작업'
--         "product_order_id":  "..."     -- optional
--       }
--     ]
--   }
--
-- 가드:
--   · p_actor owner/admin/operator 만 (운영자 전용)
--   · task.status != 'visit_only' 면 reject
--   · 자동 모드 + 스냅샷 없으면 'no_snapshot' 에러 (manual 입력 안내)
--   · task_items 0행이면 'no_items' 에러
--   · work_type 이 appliance 요구 (work_types.appliance_type_id NOT NULL) 이고
--     입력/스냅샷 item 의 appliance_type_id NULL → 'appliance_required' 에러
--     (이게 빠지면 compute_payment 의 calculate_commission 정책 조회가 빈
--     appliance_code 로 깨짐. 수동 모드 부주의 입력 차단)
--
-- 복원 흐름 (트리거 순서 주의):
--   [1] task_items: 현재 visit row 전체 DELETE → 원본/입력 행 INSERT
--       → task_items_a_sync_received_total_trg (084) → task_items_compute_trg (028)
--       → compute_payment 자동 호출 (그러나 tasks 상태 visit_only 라 부정확 — [2] 후 재호출)
--   [2] tasks UPDATE: status='완료' (자동/수동 따라), product_price/extra_fee/travel_fee 복원,
--       received_total=NULL (Mig 111 패턴 → trg_tasks_sync_extra_fee 가드 통과),
--       category_data.visitOnly 키 제거
--       → compute_payment_trg 자동 발화 (027/083)
--   [3] payments DELETE (선행 트리거가 stale row 남길 가능성 대비)
--   [4] compute_payment(p_task_id) 명시 호출 — fallback safety
--   [5] task_changes audit row 기록 (after_data.type='unmark')
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION unmark_visit_only(
  p_task_id uuid,
  p_actor   uuid,
  p_manual  jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task          tasks%ROWTYPE;
  v_snapshot      jsonb;
  v_source        text;            -- 'auto' | 'manual'
  v_task_data     jsonb;
  v_items_data    jsonb;
  v_item          jsonb;
  v_item_count    int;
  v_new_status    text;
  v_new_product   int;
  v_new_extra     int;
  v_new_travel    int;
  v_new_payment   text;
  v_inserted_cnt  int := 0;
  v_payment_id    uuid;
BEGIN
  -- ─── [0] auth ───
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'login required');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor AND role IN ('owner','admin','operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission denied');
  END IF;

  -- ─── [1] task 존재 + visit_only 확인 ───
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task not found');
  END IF;
  IF v_task.status <> 'visit_only' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'task is not visit_only',
      'current_status', v_task.status
    );
  END IF;

  -- ─── [2] 자동/수동 분기 ───
  IF p_manual IS NOT NULL THEN
    -- 수동 모드 — p_manual 검증 + 사용
    v_source := 'manual';
    v_task_data  := COALESCE(p_manual->'task',       '{}'::jsonb);
    v_items_data := COALESCE(p_manual->'task_items', '[]'::jsonb);
  ELSE
    -- 자동 모드 — task_changes 최근 mark 스냅샷 조회
    --   change_type='visit_only' + after_data->>'type' = 'mark' + before_data 존재
    SELECT before_data INTO v_snapshot
    FROM task_changes
    WHERE task_id      = p_task_id
      AND change_type  = 'visit_only'
      AND before_data IS NOT NULL
      AND after_data->>'type' = 'mark'
    ORDER BY changed_at DESC NULLS LAST
    LIMIT 1;

    IF v_snapshot IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'no_snapshot',
        'hint', 'p_manual 인자로 수동 입력 필요 (work_type_id / appliance_type_id / qty / unit_price / product_price 등)'
      );
    END IF;

    v_source     := 'auto';
    v_task_data  := COALESCE(v_snapshot->'task',       '{}'::jsonb);
    v_items_data := COALESCE(v_snapshot->'task_items', '[]'::jsonb);
  END IF;

  -- ─── [3] items 검증 — 최소 1행 + 모든 row 에 work_type_id / unit_price 존재 ───
  v_item_count := jsonb_array_length(v_items_data);
  IF v_item_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_items', 'source', v_source);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_data) LOOP
    IF v_item->>'work_type_id' IS NULL OR v_item->>'work_type_id' = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'item.work_type_id required', 'source', v_source);
    END IF;
    IF v_item->>'unit_price' IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'item.unit_price required', 'source', v_source);
    END IF;
    -- 2026-06-17 — appliance 필수 가드:
    --   work_type 의 appliance_type_id NOT NULL → task_items.appliance_type_id 도 NOT NULL 필수.
    --   안 그러면 compute_payment → calculate_commission 정책 조회가 NULL appliance_code 로 깨짐.
    --   visit/addon 류 (work_types.appliance_type_id NULL) 는 통과.
    IF EXISTS (
      SELECT 1 FROM work_types wt
      WHERE wt.id = (v_item->>'work_type_id')::uuid
        AND wt.appliance_type_id IS NOT NULL
    ) AND COALESCE(v_item->>'appliance_type_id', '') = '' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'appliance_required',
        'hint', 'work_type 이 기종(appliance)을 요구합니다. appliance_type_id 를 입력하세요.',
        'work_type_id', v_item->>'work_type_id',
        'source', v_source
      );
    END IF;
  END LOOP;

  -- task 필드 — 기본값 fallback
  v_new_status  := COALESCE(NULLIF(v_task_data->>'status', ''), '완료');
  v_new_product := COALESCE((v_task_data->>'product_price')::int, 0);
  v_new_extra   := COALESCE((v_task_data->>'extra_fee')::int,    0);
  v_new_travel  := COALESCE((v_task_data->>'travel_fee')::int,   0);
  v_new_payment := NULLIF(v_task_data->>'payment_method', '');

  -- visit_only 가 아닌 상태로 복원해야 하므로 status 가 'visit_only' 면 거부.
  IF v_new_status = 'visit_only' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'snapshot/manual status cannot be visit_only', 'source', v_source);
  END IF;

  -- ─── [4] task_items: visit row 전체 DELETE → 원본/입력 INSERT ───
  --   subtotal 은 GENERATED. is_canceled 는 스냅샷 보존 (자동 모드).
  DELETE FROM task_items WHERE task_id = p_task_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_data) LOOP
    INSERT INTO task_items (
      task_id, work_type_id, appliance_type_id,
      qty, unit_price, order_type,
      received_amount, is_canceled, product_order_id
    ) VALUES (
      p_task_id,
      (v_item->>'work_type_id')::uuid,
      NULLIF(v_item->>'appliance_type_id', '')::uuid,
      COALESCE((v_item->>'qty')::numeric, 1),
      COALESCE((v_item->>'unit_price')::int, 0),
      COALESCE(NULLIF(v_item->>'order_type', ''), '본작업'),
      NULLIF(v_item->>'received_amount', '')::int,
      COALESCE((v_item->>'is_canceled')::boolean, false),
      NULLIF(v_item->>'product_order_id', '')
    );
    v_inserted_cnt := v_inserted_cnt + 1;
  END LOOP;

  -- ─── [5] tasks UPDATE — 상태/금액 복원 + received_total=NULL (트리거 가드) + visitOnly 제거 ───
  UPDATE tasks SET
    status         = v_new_status,
    product_price  = v_new_product,
    extra_fee      = v_new_extra,
    travel_fee     = v_new_travel,
    received_total = NULL,
    payment_method = COALESCE(v_new_payment, payment_method),
    -- category_data.visitOnly 키만 제거 (다른 키 보존)
    category_data  = COALESCE(category_data, '{}'::jsonb) - 'visitOnly',
    updated_at     = NOW()
  WHERE id = p_task_id;

  -- ─── [6] payments — stale row 정리 + compute_payment 명시 호출 (fallback safety) ───
  DELETE FROM payments WHERE task_id = p_task_id;
  v_payment_id := compute_payment(p_task_id);

  -- ─── [7] task_changes audit (visit_only 되돌리기 기록) ───
  INSERT INTO task_changes (
    task_id, tenant_id, change_type,
    before_data, after_data, note, changed_by
  ) VALUES (
    p_task_id, v_task.tenant_id, 'visit_only',
    jsonb_build_object(
      'type',           'unmark',
      'previous_status', 'visit_only'
    ),
    jsonb_build_object(
      'type',            'unmark',
      'source',          v_source,
      'status',          v_new_status,
      'product_price',   v_new_product,
      'extra_fee',       v_new_extra,
      'travel_fee',      v_new_travel,
      'item_count',      v_inserted_cnt,
      'unmarkedAt',      to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    'unmark_visit_only by ' || v_source,
    p_actor
  );

  RETURN jsonb_build_object(
    'ok',          true,
    'task_id',     p_task_id,
    'source',      v_source,
    'new_status',  v_new_status,
    'item_count',  v_inserted_cnt,
    'payment_id',  v_payment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION unmark_visit_only(uuid, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION unmark_visit_only(uuid, uuid, jsonb) IS
  'visit_only → 정상 작업 되돌리기 (Mig 138, 2026-06-17). '
  'p_manual NULL → 자동 모드 (task_changes 스냅샷 / Mig 137). '
  'p_manual jsonb → 수동 모드 (스냅샷 무시 override). '
  'received_total=NULL 패턴으로 trg_tasks_sync_extra_fee 가드 통과. '
  'compute_payment 명시 호출 → engineer/principal/owner 자동 재계산.';

COMMIT;

-- ============================================
-- Verify (별도 실행 — 사장님 검증)
-- ============================================
-- 1) RPC 등록:
-- SELECT proname, obj_description(oid, 'pg_proc') AS note
-- FROM pg_proc WHERE proname = 'unmark_visit_only';

-- 2) auth 가드:
-- SELECT unmark_visit_only(
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   NULL
-- );
-- 기대: { ok: false, error: 'permission denied' }

-- 3) visit_only 아닌 작업 거부:
-- SELECT unmark_visit_only(
--   '<완료_작업_uuid>'::uuid,
--   '<admin_uuid>'::uuid,
--   NULL
-- );
-- 기대: { ok: false, error: 'task is not visit_only', current_status: '완료' }

-- 4) 자동 모드 — 스냅샷 없으면 안내:
-- SELECT unmark_visit_only(
--   '<옛_visit_only_task_uuid>'::uuid,  -- Mig 137 전에 mark 된 task
--   '<admin_uuid>'::uuid,
--   NULL
-- );
-- 기대: { ok: false, error: 'no_snapshot', hint: 'p_manual ... 수동 입력 필요' }

-- 5) 수동 모드 — 작업 1행 복원:
-- SELECT unmark_visit_only(
--   '<visit_only_task_uuid>'::uuid,
--   '<admin_uuid>'::uuid,
--   jsonb_build_object(
--     'task', jsonb_build_object(
--       'status',        '완료',
--       'product_price', 100000,
--       'extra_fee',     0,
--       'travel_fee',    0,
--       'payment_method','cash'
--     ),
--     'task_items', jsonb_build_array(
--       jsonb_build_object(
--         'work_type_id',      '<wall_cleaning_wt_uuid>'::text,
--         'appliance_type_id', '<wall_appliance_uuid>'::text,
--         'qty',               1,
--         'unit_price',        100000,
--         'order_type',        '본작업'
--       )
--     )
--   )
-- );
-- 기대: { ok:true, source:'manual', new_status:'완료', item_count:1, payment_id:'...' }

-- 6) 복원 결과 검증:
-- SELECT t.task_no, t.status, t.product_price, t.extra_fee, t.travel_fee,
--        t.received_total, t.total_amount,
--        t.category_data ? 'visitOnly' AS still_has_visit_only_key
-- FROM tasks t WHERE t.id = '<task_uuid>'::uuid;
-- 기대: status='완료', product=100000, extra=0, travel=0, received_total=NULL,
--       total=100000, still_has_visit_only_key=false

-- SELECT qty, unit_price, subtotal, order_type FROM task_items
-- WHERE task_id = '<task_uuid>'::uuid;
-- 기대: 1 row, qty=1, unit_price=100000, subtotal=100000, order_type='본작업'

-- SELECT engineer_amount, principal_amount, owner_amount, calc_method, track
-- FROM payments WHERE task_id = '<task_uuid>'::uuid;
-- 기대: calc_method 가 원청 정책 따라 (정액 / 비율_총금액 등) 자동 계산. 합계 = product_price.

-- ============================================
-- 롤백 (위급 시):
-- DROP FUNCTION IF EXISTS unmark_visit_only(uuid, uuid, jsonb);
-- ============================================
