-- ============================================================================
-- Mig 201 — 견적 항목 "종목 변경" + "오입력 삭제"
-- 작성 2026-07-30 / 사장님 spec: "우리 종목도 변경 하는 것도 만들자"
-- ============================================================================
--
-- 왜 필요한가
-- ----------------------------------------------------------------------------
--   지금은 항목의 수량·단가만 고칠 수 있다 (admin_update_task_item / Mig 189).
--   종목(work_type)을 잘못 넣으면 고칠 방법이 없어서, 맞는 항목을 하나 더
--   추가하는 수밖에 없다 → 잘못된 항목이 그대로 남아 금액이 두 배가 된다.
--
--   ⚠️ 종목이 바뀌면 정산 분배율이 통째로 바뀐다.
--        세척 = 기존 비율 / 설치 = 75:25 (자재비 우선공제, Mig 198)
--        냉매 = 별도 식 (Mig 096 이후) / 누수 = Mig 195·196
--      그래서 이 RPC 는 반드시 compute_payment 를 다시 돌린다.
--
-- ----------------------------------------------------------------------------
-- [중요] 이미 있는 admin_partial_cancel_item (Mig 074) 와 무엇이 다른가
-- ----------------------------------------------------------------------------
--   ◐ 부분 취소 = "고객이 이 품목만 안 하기로 했다" — 실제로 일어난 영업 사건.
--                 is_canceled = true 로 남아 부분완료 통계에 잡힌다.
--   🗑 오입력 삭제 = "처음부터 잘못 넣은 줄이다" — 일어난 적 없는 일.
--                 행을 지운다. 부분취소 통계를 오염시키지 않는다.
--
--   두 개를 하나로 합치면 "부분취소 건수" 가 운영자 오타 개수만큼 부풀어
--   오른다. 오접수(실수) 를 취소와 분리한 것과 같은 이유다.
--
--   그리고 admin_partial_cancel_item 은 tasks.product_price 재동기도,
--   compute_payment 재계산도 하지 않는다 (Mig 189 가 고쳤던 바로 그 버그).
--   여기 두 RPC 는 둘 다 한다.
--
-- ----------------------------------------------------------------------------
-- 공통 가드 (Mig 189 admin_insert_task_item v2 시퀀스 그대로)
-- ----------------------------------------------------------------------------
--   1. p_actor 필수 / operator·owner·admin 만
--   2. 사유 5자 이상
--   3. 정산 송금 확인 완료 → 거부
--   4. 유솔N 월정산(track B) → 거부
--   5. ★ 완료 전까지만 (사장님 결정 2026-07-30)
--        허용: 미배정 / 약속대기 / 배정 / 취소요청 / 확정 / 진행중
--        거부: 완료 / 취소 / visit_only
--   6. (종목 변경) calculate_commission 으로 정책 존재 선검증 — 없으면 거부
--   7. product_price 재동기 → compute_payment → task_changes 기록
--
-- 실행: Supabase SQL Editor 에서 [A], [B], [C] 를 순서대로 붙여넣기.
--       마지막 검증 블록은 따로 한 번 더 (SQL Editor 는 마지막 SELECT 만 보여줌).
-- ============================================================================


-- ============================================================================
-- [A] admin_change_task_item_type — 항목 종목(work_type) 변경
-- ============================================================================
--   p_qty / p_unit_price 는 NULL 이면 기존 값 유지.
--   종목이 바뀌면 보통 단가도 같이 바뀌므로 한 번에 받는다.
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_change_task_item_type(
  p_actor             uuid,
  p_item_id           uuid,
  p_work_type_id      uuid,
  p_appliance_type_id uuid,
  p_qty               numeric,
  p_unit_price        int,
  p_note              text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item            task_items%ROWTYPE;
  v_task_status     text;
  v_tenant_id       uuid;
  v_principal_code  text;
  v_remit_confirmed timestamptz;
  v_payment_track   text;

  v_old_service     text;
  v_old_appliance   text;
  v_old_worktype    text;
  v_new_service     text;
  v_new_appliance   text;
  v_new_worktype    text;

  v_new_qty         numeric;
  v_new_up          int;
  v_calc_check      jsonb;
  v_caller_name     text;
  v_items_sum       int;
  v_err_msg         text;
BEGIN
  ---------------------------------------------------------------- 1. 권한
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;
  IF p_note IS NULL OR LENGTH(TRIM(p_note)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', '변경 사유 5자 이상 필수');
  END IF;
  IF p_item_id IS NULL OR p_work_type_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_id / work_type_id 필요');
  END IF;

  ---------------------------------------------------------------- 2. 항목
  SELECT * INTO v_item FROM task_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '품목을 찾을 수 없습니다');
  END IF;

  v_new_qty := COALESCE(p_qty,        v_item.qty);
  v_new_up  := COALESCE(p_unit_price, v_item.unit_price);

  IF v_new_qty <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'qty > 0 필요');
  END IF;
  IF v_new_up < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unit_price >= 0 필요');
  END IF;

  ---------------------------------------------------------------- 3. 작업
  SELECT t.tenant_id, t.status, p.code
    INTO v_tenant_id, v_task_status, v_principal_code
  FROM tasks t LEFT JOIN principals p ON p.id = t.principal_id
  WHERE t.id = v_item.task_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  -- ★ 완료 전까지만 (사장님 결정 2026-07-30)
  IF v_task_status NOT IN ('미배정','약속대기','배정','취소요청','확정','진행중') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('완료·취소된 작업은 종목을 바꿀 수 없습니다 (현재 상태: %s)', v_task_status)
    );
  END IF;

  SELECT engineer_remit_confirmed_at, track
    INTO v_remit_confirmed, v_payment_track
  FROM payments WHERE task_id = v_item.task_id;

  IF v_remit_confirmed IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '정산 송금 확인 완료 — 수정 불가');
  END IF;
  IF v_principal_code = 'usol_n' AND v_payment_track = 'B' THEN
    RETURN jsonb_build_object('ok', false, 'error', '유솔N 월정산 작업 — 수정 불가');
  END IF;

  ---------------------------------------------------------------- 4. 새 종목
  SELECT st.code, wt.name INTO v_new_service, v_new_worktype
  FROM work_types wt
  JOIN service_types st ON st.id = wt.service_type_id
  WHERE wt.id = p_work_type_id;

  IF v_new_service IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'work_type 없음 또는 service_type 매핑 실패');
  END IF;

  IF p_appliance_type_id IS NOT NULL THEN
    SELECT code INTO v_new_appliance FROM appliance_types WHERE id = p_appliance_type_id;
  END IF;

  -- 옛 종목 (변경 이력용)
  SELECT st.code, wt.name INTO v_old_service, v_old_worktype
  FROM work_types wt
  JOIN service_types st ON st.id = wt.service_type_id
  WHERE wt.id = v_item.work_type_id;

  IF v_item.appliance_type_id IS NOT NULL THEN
    SELECT code INTO v_old_appliance FROM appliance_types WHERE id = v_item.appliance_type_id;
  END IF;

  ---------------------------------------------------------------- 5. 정책 선검증
  v_calc_check := calculate_commission(
    v_principal_code,
    v_new_service,
    v_new_appliance,
    (v_new_up * v_new_qty)::int,
    0,
    0,
    CASE WHEN v_item.order_type IN ('첫대','추가') THEN v_item.order_type ELSE NULL END
  );

  IF v_calc_check IS NULL OR NOT COALESCE((v_calc_check->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'policy_not_found',
      'detail', format(
        '정책 없음 — 원청 %s / 서비스 %s / 기종 %s',
        COALESCE(v_principal_code, '?'),
        COALESCE(v_new_service, '?'),
        COALESCE(v_new_appliance, '(없음)')
      )
    );
  END IF;

  SELECT name INTO v_caller_name FROM users WHERE id = p_actor;

  ---------------------------------------------------------------- 6. 변경
  UPDATE task_items
     SET work_type_id      = p_work_type_id,
         appliance_type_id = p_appliance_type_id,
         qty               = v_new_qty,
         unit_price        = v_new_up
   WHERE id = p_item_id;

  ---------------------------------------------------------------- 7. 재동기
  SELECT COALESCE(SUM(ti.subtotal), 0)::int INTO v_items_sum
  FROM task_items ti
  WHERE ti.task_id = v_item.task_id AND NOT COALESCE(ti.is_canceled, false);

  IF v_items_sum > 0 THEN
    UPDATE tasks SET product_price = v_items_sum WHERE id = v_item.task_id;
  END IF;

  BEGIN
    PERFORM compute_payment(v_item.task_id);
    UPDATE payments SET compute_error = NULL
    WHERE task_id = v_item.task_id AND compute_error IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    RAISE WARNING '[admin_change_task_item_type] recompute fail task=% err=%', v_item.task_id, v_err_msg;
    UPDATE payments SET compute_error = v_err_msg, computed_at = now()
    WHERE task_id = v_item.task_id;
  END;

  ---------------------------------------------------------------- 8. 이력
  INSERT INTO task_changes (
    task_id, tenant_id, change_type,
    before_data, after_data, note,
    changed_by, changed_by_name
  ) VALUES (
    v_item.task_id, v_tenant_id, 'items',
    jsonb_build_object(
      'action',            'change_type',
      'item_id',           p_item_id,
      'work_type_id',      v_item.work_type_id,
      'work_type_name',    v_old_worktype,
      'appliance_type_id', v_item.appliance_type_id,
      'service_code',      v_old_service,
      'appliance_code',    v_old_appliance,
      'qty',               v_item.qty,
      'unit_price',        v_item.unit_price
    ),
    jsonb_build_object(
      'action',            'change_type',
      'item_id',           p_item_id,
      'work_type_id',      p_work_type_id,
      'work_type_name',    v_new_worktype,
      'appliance_type_id', p_appliance_type_id,
      'service_code',      v_new_service,
      'appliance_code',    v_new_appliance,
      'qty',               v_new_qty,
      'unit_price',        v_new_up,
      'product_price_synced', v_items_sum
    ),
    TRIM(p_note),
    p_actor, v_caller_name
  );

  RETURN jsonb_build_object(
    'ok',            true,
    'item_id',       p_item_id,
    'task_id',       v_item.task_id,
    'old_service',   v_old_service,
    'new_service',   v_new_service,
    'product_price', v_items_sum
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_change_task_item_type(uuid, uuid, uuid, uuid, numeric, int, text)
  TO anon, authenticated;


-- ============================================================================
-- [B] admin_remove_task_item — 잘못 넣은 항목 삭제 (오입력 정리)
-- ============================================================================
--   ⚠️ 진짜 DELETE 다. 되돌리기 버튼은 없다.
--      복구가 필요하면 task_changes.before_data 에 전체 값이 남아 있으므로
--      그걸 보고 다시 추가하면 된다.
--
--   왜 소프트 삭제(플래그) 가 아닌가:
--      새 플래그를 만들면 task_items 를 읽는 모든 곳
--      (compute_payment / 원청 정산 / 유솔N / 상세 화면 …) 에
--      필터를 다 추가해야 하고, 한 군데라도 빠뜨리면 조용히 금액이 틀어진다.
--      is_canceled 는 이미 그 용도로 쓰이고 있고 의미가 다르다 (부분취소).
--
--   마지막 남은 항목은 지울 수 없다 → 그건 "작업 취소" 로 처리해야 한다.
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_remove_task_item(
  p_actor   uuid,
  p_item_id uuid,
  p_note    text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item            task_items%ROWTYPE;
  v_task_id         uuid;
  v_task_status     text;
  v_tenant_id       uuid;
  v_principal_code  text;
  v_remit_confirmed timestamptz;
  v_payment_track   text;
  v_service_code    text;
  v_appliance_code  text;
  v_worktype_name   text;
  v_remaining       int;
  v_caller_name     text;
  v_items_sum       int;
  v_err_msg         text;
BEGIN
  ---------------------------------------------------------------- 1. 권한
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;
  IF p_note IS NULL OR LENGTH(TRIM(p_note)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', '삭제 사유 5자 이상 필수');
  END IF;
  IF p_item_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_id 누락');
  END IF;

  ---------------------------------------------------------------- 2. 항목
  SELECT * INTO v_item FROM task_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '품목을 찾을 수 없습니다');
  END IF;
  v_task_id := v_item.task_id;

  ---------------------------------------------------------------- 3. 작업
  SELECT t.tenant_id, t.status, p.code
    INTO v_tenant_id, v_task_status, v_principal_code
  FROM tasks t LEFT JOIN principals p ON p.id = t.principal_id
  WHERE t.id = v_task_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  -- ★ 완료 전까지만
  IF v_task_status NOT IN ('미배정','약속대기','배정','취소요청','확정','진행중') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('완료·취소된 작업은 항목을 지울 수 없습니다 (현재 상태: %s)', v_task_status)
    );
  END IF;

  SELECT engineer_remit_confirmed_at, track
    INTO v_remit_confirmed, v_payment_track
  FROM payments WHERE task_id = v_task_id;

  IF v_remit_confirmed IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '정산 송금 확인 완료 — 수정 불가');
  END IF;
  IF v_principal_code = 'usol_n' AND v_payment_track = 'B' THEN
    RETURN jsonb_build_object('ok', false, 'error', '유솔N 월정산 작업 — 수정 불가');
  END IF;

  ---------------------------------------------------------------- 4. 마지막 1개 보호
  SELECT COUNT(*)::int INTO v_remaining FROM task_items WHERE task_id = v_task_id;
  IF v_remaining <= 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', '마지막 항목은 지울 수 없습니다 — 작업 자체를 취소하세요'
    );
  END IF;

  ---------------------------------------------------------------- 5. 이력용 스냅샷
  SELECT st.code, wt.name INTO v_service_code, v_worktype_name
  FROM work_types wt
  JOIN service_types st ON st.id = wt.service_type_id
  WHERE wt.id = v_item.work_type_id;

  IF v_item.appliance_type_id IS NOT NULL THEN
    SELECT code INTO v_appliance_code FROM appliance_types WHERE id = v_item.appliance_type_id;
  END IF;

  SELECT name INTO v_caller_name FROM users WHERE id = p_actor;

  ---------------------------------------------------------------- 6. 삭제
  DELETE FROM task_items WHERE id = p_item_id;

  ---------------------------------------------------------------- 7. 재동기
  SELECT COALESCE(SUM(ti.subtotal), 0)::int INTO v_items_sum
  FROM task_items ti
  WHERE ti.task_id = v_task_id AND NOT COALESCE(ti.is_canceled, false);

  IF v_items_sum > 0 THEN
    UPDATE tasks SET product_price = v_items_sum WHERE id = v_task_id;
  END IF;

  BEGIN
    PERFORM compute_payment(v_task_id);
    UPDATE payments SET compute_error = NULL
    WHERE task_id = v_task_id AND compute_error IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_err_msg := SQLERRM;
    RAISE WARNING '[admin_remove_task_item] recompute fail task=% err=%', v_task_id, v_err_msg;
    UPDATE payments SET compute_error = v_err_msg, computed_at = now()
    WHERE task_id = v_task_id;
  END;

  ---------------------------------------------------------------- 8. 이력
  INSERT INTO task_changes (
    task_id, tenant_id, change_type,
    before_data, after_data, note,
    changed_by, changed_by_name
  ) VALUES (
    v_task_id, v_tenant_id, 'items',
    jsonb_build_object(
      'action',               'remove',
      'item_id',              p_item_id,
      'work_type_id',         v_item.work_type_id,
      'work_type_name',       v_worktype_name,
      'appliance_type_id',    v_item.appliance_type_id,
      'service_code',         v_service_code,
      'appliance_code',       v_appliance_code,
      'qty',                  v_item.qty,
      'unit_price',           v_item.unit_price,
      'order_type',           v_item.order_type,
      'description',          v_item.description,
      'customer_paid_amount', v_item.customer_paid_amount,
      'net_amount',           v_item.net_amount,
      'metadata',             v_item.metadata
    ),
    jsonb_build_object(
      'action',                'remove',
      'item_id',               p_item_id,
      'deleted',               true,
      'remaining_items',       v_remaining - 1,
      'product_price_synced',  v_items_sum
    ),
    TRIM(p_note),
    p_actor, v_caller_name
  );

  RETURN jsonb_build_object(
    'ok',            true,
    'item_id',       p_item_id,
    'task_id',       v_task_id,
    'remaining',     v_remaining - 1,
    'product_price', v_items_sum
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_remove_task_item(uuid, uuid, text)
  TO anon, authenticated;


-- ============================================================================
-- [C] preview_task_item_type_change — 바꾸기 전 "기사 몫 얼마 → 얼마" 미리보기
-- ============================================================================
--   종목이 바뀌면 분배율이 통째로 바뀌는데, 그걸 모른 채 저장하면
--   기사 몫이 조용히 달라진다. 그래서 저장 전에 숫자를 먼저 보여준다.
--
--   ⚠️ 아무것도 바꾸지 않는다 (읽기 전용).
--   ⚠️ 이 항목 하나만 기준. 자재비 우선공제(설치) · 출장비 · 추가비는 빠진
--      개략치다. 정확한 최종 금액은 저장 후 정산 카드에서 확인.
-- ============================================================================
CREATE OR REPLACE FUNCTION preview_task_item_type_change(
  p_actor             uuid,
  p_item_id           uuid,
  p_work_type_id      uuid,
  p_appliance_type_id uuid,
  p_qty               numeric,
  p_unit_price        int
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item           task_items%ROWTYPE;
  v_principal_code text;
  v_old_service    text;
  v_old_appliance  text;
  v_new_service    text;
  v_new_appliance  text;
  v_new_qty        numeric;
  v_new_up         int;
  v_old_calc       jsonb;
  v_new_calc       jsonb;
BEGIN
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '권한 없음');
  END IF;

  SELECT * INTO v_item FROM task_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '품목을 찾을 수 없습니다');
  END IF;

  v_new_qty := COALESCE(p_qty,        v_item.qty);
  v_new_up  := COALESCE(p_unit_price, v_item.unit_price);

  SELECT p.code INTO v_principal_code
  FROM tasks t LEFT JOIN principals p ON p.id = t.principal_id
  WHERE t.id = v_item.task_id;

  SELECT st.code INTO v_old_service
  FROM work_types wt JOIN service_types st ON st.id = wt.service_type_id
  WHERE wt.id = v_item.work_type_id;

  IF v_item.appliance_type_id IS NOT NULL THEN
    SELECT code INTO v_old_appliance FROM appliance_types WHERE id = v_item.appliance_type_id;
  END IF;

  SELECT st.code INTO v_new_service
  FROM work_types wt JOIN service_types st ON st.id = wt.service_type_id
  WHERE wt.id = p_work_type_id;

  IF p_appliance_type_id IS NOT NULL THEN
    SELECT code INTO v_new_appliance FROM appliance_types WHERE id = p_appliance_type_id;
  END IF;

  v_old_calc := calculate_commission(
    v_principal_code, v_old_service, v_old_appliance,
    (v_item.unit_price * v_item.qty)::int, 0, 0,
    CASE WHEN v_item.order_type IN ('첫대','추가') THEN v_item.order_type ELSE NULL END
  );

  IF v_new_service IS NOT NULL THEN
    v_new_calc := calculate_commission(
      v_principal_code, v_new_service, v_new_appliance,
      (v_new_up * v_new_qty)::int, 0, 0,
      CASE WHEN v_item.order_type IN ('첫대','추가') THEN v_item.order_type ELSE NULL END
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'principal_code', v_principal_code,
    'old', jsonb_build_object(
      'service',  v_old_service,
      'amount',   (v_item.unit_price * v_item.qty)::int,
      'ok',       COALESCE((v_old_calc->>'ok')::boolean, false),
      'engineer', (v_old_calc->>'engineer')::int,
      'company',  (v_old_calc->>'company')::int,
      'method',   v_old_calc->>'calc_method'
    ),
    'new', jsonb_build_object(
      'service',  v_new_service,
      'amount',   (v_new_up * v_new_qty)::int,
      'ok',       COALESCE((v_new_calc->>'ok')::boolean, false),
      'engineer', (v_new_calc->>'engineer')::int,
      'company',  (v_new_calc->>'company')::int,
      'method',   v_new_calc->>'calc_method'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION preview_task_item_type_change(uuid, uuid, uuid, uuid, numeric, int)
  TO anon, authenticated;


-- ============================================================================
-- 검증 — 위 [A] [B] [C] 를 실행한 뒤 이 블록만 따로 붙여넣기
-- ============================================================================
SELECT
  p.proname                                   AS 함수,
  pg_get_function_identity_arguments(p.oid)   AS 인자,
  CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE')
       THEN '✅ 권한 OK' ELSE '❌ 권한 없음' END AS 권한
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_change_task_item_type', 'admin_remove_task_item', 'preview_task_item_type_change')
ORDER BY p.proname;
