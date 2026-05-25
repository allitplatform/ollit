-- ============================================================================
-- Migration 073 — Round 2 원청·운영자 직접 취소 RPC + 수고비 모델
-- 작성: 2026-05-25
-- 상태: 초안 (사장님 검토 대기 — 적용 X)
-- ============================================================================
-- 의존:
--   - Round 1 (069b/070/071/072) 적용 완료
--   - task_items.is_canceled / canceled_reason / canceled_at (070)
--   - tasks.partial_reason / partial_memo (068)
--   - compute_payment v15 (071) — 본 마이그 측 v16 으로 패치
--
-- 내용:
--   [1] tasks 컬럼 추가 — cancel_engineer_comp_kind (visit_fee/none) / cancel_engineer_comp_amount
--   [2] compute_payment v16 — status='취소' + kind 지정 시 engineer_amount 분기
--   [3] RPC 5개:
--       · partner_full_cancel(p_task_id, p_reason)        — 원청 전체 취소 (기본 kind=none)
--       · partner_partial_cancel_item(p_item_id, p_reason) — 원청 단건 부분취소
--       · admin_full_cancel(p_task_id, p_reason)           — 운영자 전체 취소 (기본 kind=none)
--       · admin_partial_cancel_item(p_item_id, p_reason)   — 운영자 단건 부분취소
--       · admin_set_cancel_compensation(p_task_id, p_kind) — 운영자가 작업상세 컨트롤로 수고비 토글
--
-- 수고비 모델 (사장님 spec 단순화):
--   · 모든 취소 RPC 가 cancel_engineer_comp_kind='none', amount=0 자동 세팅 (기본 '없음').
--   · 운영자가 AdminApp 작업상세 컨트롤에서 'visit_fee' 로 토글 가능 (admin_set_cancel_compensation).
--   · 'full' (전액) 옵션 없음 — 사장님 spec: 출장비만 / 없음 두 가지.
--   · 'visit_fee' amount = COALESCE(task.travel_fee, 30000).
--
-- 권한 가드 (RPC 본문):
--   · partner RPC: auth.uid() → user_roles partner + principal_id 일치 검증.
--     RLS가 tenant 단위라 RPC 본문이 다른 원청 건 거부 필수.
--   · admin RPC: owner/operator 역할만.
--   · 모두 SECURITY DEFINER + GRANT EXECUTE TO authenticated.
--
-- 회귀 방지:
--   · 기존 어댑터 (requestCancelAdapter / approveCancelAdapter / rejectCancelAdapter) 동작 무변경.
--     본 RPC는 신규 즉시 취소 흐름 — 별도 category_data 키 (cancelActor / cancelAt).
--   · 071 v15 본체 그대로 + v16 = 마지막 INSERT 직전 분기 한 블록만 추가.
--
-- 실행: 사장님 OK 후 Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run.
-- 검증·롤백: 본 파일 하단 + docs/Round2_cancel_spec.md 참조.
-- ============================================================================

BEGIN;

-- ============================================================================
-- [1] tasks 컬럼 추가 — 수고비 kind + amount
-- ============================================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS cancel_engineer_comp_kind   text,
  ADD COLUMN IF NOT EXISTS cancel_engineer_comp_amount int;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_cancel_comp_kind_check'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_cancel_comp_kind_check
      CHECK (cancel_engineer_comp_kind IS NULL
          OR cancel_engineer_comp_kind IN ('visit_fee', 'none'));
  END IF;
END $$;

COMMENT ON COLUMN tasks.cancel_engineer_comp_kind IS
  '취소 건 기사 수고비 kind. NULL=비-취소 task / visit_fee=출장비만 (task.travel_fee 또는 30k) / none=없음(0). 취소 RPC가 기본 none 세팅, 운영자가 작업상세 컨트롤에서 visit_fee 로 토글 가능.';
COMMENT ON COLUMN tasks.cancel_engineer_comp_amount IS
  '취소 건 기사 수고비 금액 (원). kind 측 visit_fee 시 task.travel_fee 또는 30000, none 시 0.';

-- ============================================================================
-- [2] compute_payment v16 — status='취소' + kind 지정 시 engineer_amount 우선
-- ============================================================================
-- v15(071) 본체 그대로 + 마지막 INSERT 직전에 분기 한 블록 추가.
-- v15 본체 측 변경 0 (FOR LOOP / owner 계산 / track 결정 등 모두 동일).
CREATE OR REPLACE FUNCTION compute_payment(p_task_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task              tasks%ROWTYPE;
  v_principal_code    text;
  v_total_qty         int;
  v_fallback_unit     int;
  v_item              RECORD;
  v_qty               int;
  v_unit_price        int;
  v_service_code      text;
  v_appliance_code    text;
  v_calc_result       jsonb;
  v_calc_method       text;
  v_is_ratio          boolean;
  v_is_fixed          boolean;
  v_eng               int;
  v_prin              int;
  v_mult              int;
  v_item_extra        int;
  v_extra_applied     boolean := false;
  v_total_engineer    int := 0;
  v_total_principal   int := 0;
  v_total_owner       int := 0;
  v_principal_applied boolean := false;
  v_last_calc_method  text;
  v_last_policy_key   text;
  v_payment_id        uuid;
  v_cleaning_extra_applied   boolean := false;
  v_cleaning_engineer_bonus  int := 0;
  v_cleaning_principal_bonus int := 0;
  v_track                CHAR(1) := 'A';
  v_has_non_refrigerant  boolean := false;
  v_total_settle         int := 0;
  v_engineer_rate int;
  v_total_calc    int;
  -- v16 (Migration 073): 취소-완료 건 수고비 분기용
  v_canceled_active boolean := false;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 조회 실패 — 작업 없음: %', p_task_id;
  END IF;

  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code 조회 실패 — principal_id=%', v_task.principal_id;
  END IF;

  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  -- v16: 전 품목 취소(취소-완료 건) → FOR LOOP 측 합산 X. 수고비 분기로 진행.
  v_canceled_active := (v_task.status = '취소' AND v_task.cancel_engineer_comp_kind IS NOT NULL);

  IF v_total_qty = 0 AND NOT v_canceled_active THEN
    RAISE EXCEPTION 'task_items 없음 (전 품목 취소 또는 미생성): task_id=%', p_task_id;
  END IF;

  IF v_total_qty > 0 THEN
    v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

    FOR v_item IN
      SELECT
        ti.qty, ti.unit_price, ti.order_type,
        st.code AS service_code,
        at.code AS appliance_code
      FROM task_items ti
      LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
      LEFT JOIN service_types st   ON st.id = wt.service_type_id
      LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
      WHERE ti.task_id = p_task_id
        AND NOT COALESCE(ti.is_canceled, false)
    LOOP
      v_qty := COALESCE(v_item.qty, 1)::int;
      v_unit_price := CASE
        WHEN COALESCE(v_item.unit_price, 0) > 0 AND v_item.unit_price <> COALESCE(v_task.product_price, 0)
        THEN v_item.unit_price
        ELSE v_fallback_unit
      END;
      v_service_code := v_item.service_code;
      v_appliance_code := v_item.appliance_code;

      IF v_principal_code = 'usol_n'
         AND v_item.order_type = '추가선택'
         AND COALESCE(v_service_code, '') = 'refrigerant' THEN
        v_service_code := 'addon';
        v_appliance_code := '냉매점검';
      END IF;

      IF COALESCE(v_service_code, '') != 'refrigerant' THEN
        v_has_non_refrigerant := true;
      END IF;

      v_calc_result := calculate_commission(
        v_principal_code, v_service_code, v_appliance_code,
        v_unit_price, 0, 0, NULL
      );
      IF NOT (v_calc_result ->> 'ok')::boolean THEN
        RAISE EXCEPTION 'calculate_commission 실패: %', v_calc_result;
      END IF;

      v_calc_method := v_calc_result ->> 'calc_method';
      v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
      v_is_fixed := v_calc_method = '정액';

      IF v_calc_method = '비율_견적금액' AND v_service_code = 'refrigerant' THEN
        v_is_ratio := true;
      END IF;

      IF v_service_code = 'cleaning' THEN
        v_item_extra := 0;
        IF NOT v_cleaning_extra_applied THEN
          IF v_principal_code = 'usol_n' THEN
            v_cleaning_principal_bonus := FLOOR(COALESCE(v_task.extra_fee, 0) * 0.15)::int;
            v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0) - v_cleaning_principal_bonus;
          ELSE
            v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0);
            v_cleaning_principal_bonus := 0;
          END IF;
          v_cleaning_extra_applied := true;
          v_extra_applied := true;
        END IF;
      ELSE
        v_item_extra := CASE
          WHEN v_is_ratio AND NOT v_extra_applied THEN COALESCE(v_task.extra_fee, 0)
          ELSE 0
        END;
      END IF;

      IF v_is_ratio AND (v_qty > 1 OR v_item_extra > 0) THEN
        v_calc_result := calculate_commission(
          v_principal_code, v_service_code, v_appliance_code,
          v_unit_price * v_qty, v_item_extra, 0, NULL
        );
        IF NOT (v_calc_result ->> 'ok')::boolean THEN
          RAISE EXCEPTION 'calculate_commission 재호출 실패: %', v_calc_result;
        END IF;
        IF v_item_extra > 0 THEN v_extra_applied := true; END IF;
      END IF;

      v_eng := (v_calc_result ->> 'engineer')::int;
      v_prin := (v_calc_result ->> 'principal')::int;
      v_mult := CASE WHEN v_is_ratio THEN 1 ELSE v_qty END;

      IF v_service_code = 'refrigerant'
         AND v_calc_method != 'usol_n_추가선택'
         AND v_task.assigned_engineer_id IS NOT NULL THEN
        SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate
        FROM users WHERE id = v_task.assigned_engineer_id;
        v_total_calc := (v_calc_result ->> 'total')::int;
        IF v_engineer_rate >= 100 THEN
          v_eng := v_total_calc - v_prin;
        ELSE
          v_eng := (v_total_calc * v_engineer_rate / 100)::int;
        END IF;
      END IF;

      v_total_engineer := v_total_engineer + (v_eng * v_mult);

      IF v_is_fixed THEN
        IF NOT v_principal_applied THEN
          v_total_principal := v_total_principal + v_prin;
          v_principal_applied := true;
        END IF;
      ELSE
        v_total_principal := v_total_principal + (v_prin * v_mult);
      END IF;

      v_last_calc_method := v_calc_method;
      v_last_policy_key  := v_calc_result ->> 'policy_key';
    END LOOP;

    v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
    v_total_principal := v_total_principal + v_cleaning_principal_bonus;
    v_total_engineer  := v_total_engineer  + COALESCE(v_task.travel_fee, 0);

    IF v_principal_code = 'usol_n' THEN
      SELECT COALESCE(SUM(ti.subtotal), 0)::int INTO v_total_settle
      FROM task_items ti WHERE ti.task_id = p_task_id;
      v_total_owner := v_total_settle
                     + COALESCE(v_task.extra_fee, 0)
                     + COALESCE(v_task.travel_fee, 0)
                     - v_total_engineer
                     - v_total_principal;
    ELSE
      v_total_owner := COALESCE(v_task.product_price, 0)
                     + COALESCE(v_task.extra_fee, 0)
                     + COALESCE(v_task.travel_fee, 0)
                     - v_total_engineer
                     - v_total_principal;
    END IF;

    IF v_principal_code = 'usol_n' AND v_has_non_refrigerant THEN
      v_track := 'B';
    ELSE
      v_track := 'A';
    END IF;
  END IF;

  -- v16: 취소-완료 + 수고비 지정 시 — engineer/principal/owner 덮어쓰기.
  --   trigger 가 어디서 발화돼도 동일 결과. payments.is_balanced 측 0=0 유지.
  IF v_canceled_active THEN
    v_total_engineer  := COALESCE(v_task.cancel_engineer_comp_amount, 0);
    v_total_principal := 0;
    v_total_owner     := 0 - v_total_engineer;
    v_last_calc_method := COALESCE(v_last_calc_method, '취소_수고비');
    v_last_policy_key  := COALESCE(v_last_policy_key, 'cancel_compensation');
    -- track 결정 X — 옛 값 유지 또는 'A' 기본
    IF v_track IS NULL THEN v_track := 'A'; END IF;
  END IF;

  DELETE FROM payments WHERE task_id = p_task_id;
  INSERT INTO payments (
    task_id, computed_by,
    policy_key, calc_method,
    product_price, extra_fee, travel_fee, naver_fee,
    engineer_amount, principal_amount, owner_amount,
    status,
    track
  ) VALUES (
    p_task_id, auth.uid(),
    v_last_policy_key, v_last_calc_method,
    CASE
      WHEN v_canceled_active THEN 0
      WHEN v_principal_code = 'usol_n' THEN v_total_settle
      ELSE COALESCE(v_task.product_price, 0)
    END,
    CASE WHEN v_canceled_active THEN 0 ELSE COALESCE(v_task.extra_fee, 0) END,
    CASE WHEN v_canceled_active THEN 0 ELSE COALESCE(v_task.travel_fee, 0) END,
    0,
    v_total_engineer, v_total_principal, v_total_owner,
    '미정산',
    v_track
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION compute_payment(uuid) IS
  'v16 (Migration 073) — status=취소 + cancel_engineer_comp_kind 지정 시 수고비 모델로 engineer/principal/owner 덮어쓰기. 측 v15(071) 본체 무손상.';

-- ============================================================================
-- [3] 공통 헬퍼 — 호출자 partner 역할 + principal_id 조회
-- ============================================================================
CREATE OR REPLACE FUNCTION _get_caller_partner_principal()
RETURNS TABLE (principal_id uuid, principal_code text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.code
  FROM user_roles ur
  JOIN principals p ON p.id = ur.principal_id
  WHERE ur.user_id = auth.uid() AND ur.role = 'partner'
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION _caller_is_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'operator')
  );
END;
$$;

-- ============================================================================
-- [4-A] partner_full_cancel — 원청 전체 취소 (기본 수고비 none)
-- ============================================================================
CREATE OR REPLACE FUNCTION partner_full_cancel(p_task_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_caller_pid uuid;
  v_caller_pcode text;
  v_was_completed boolean;
  v_items_canceled int;
BEGIN
  IF p_task_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락'); END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;
  IF v_task.status = '취소' THEN RETURN jsonb_build_object('ok', false, 'error', '이미 취소된 작업입니다'); END IF;

  -- 권한 가드 — partner 역할 + principal_id 일치
  SELECT principal_id, principal_code
    INTO v_caller_pid, v_caller_pcode
  FROM _get_caller_partner_principal();
  IF v_caller_pid IS NULL THEN RAISE EXCEPTION '권한 없음 — partner 역할 필요'; END IF;
  IF v_caller_pid <> v_task.principal_id THEN
    RAISE EXCEPTION '권한 없음 — 자기 원청 task 만 취소 가능 (caller=%, task=%)', v_caller_pcode, v_task.principal_id;
  END IF;

  v_was_completed := v_task.status IN ('완료', 'visit_only');

  UPDATE tasks SET
    status = '취소',
    category_data = COALESCE(category_data, '{}'::jsonb) || jsonb_build_object(
      'cancelReason', p_reason,
      'previousStatus', v_task.status,
      'cancelActor', 'partner',
      'cancelActorUserId', auth.uid(),
      'cancelActorPrincipalCode', v_caller_pcode,
      'cancelAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'wasCompleted', v_was_completed
    ),
    -- 기본 수고비 = '없음' (kind=none, amount=0). 운영자가 작업상세 컨트롤에서 visit_fee 로 토글 가능.
    cancel_engineer_comp_kind   = 'none',
    cancel_engineer_comp_amount = 0,
    updated_at = now()
  WHERE id = p_task_id;

  -- task_items 전부 is_canceled=true (070 트리거 자동 발화)
  UPDATE task_items SET
    is_canceled = true,
    canceled_reason = p_reason,
    canceled_at = now()
  WHERE task_id = p_task_id
    AND COALESCE(is_canceled, false) = false;

  GET DIAGNOSTICS v_items_canceled = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'items_canceled', v_items_canceled,
    'was_completed', v_was_completed,
    'comp_kind', 'none'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION partner_full_cancel(uuid, text) TO authenticated;

-- ============================================================================
-- [4-B] partner_partial_cancel_item — 원청 단건 부분취소
-- ============================================================================
CREATE OR REPLACE FUNCTION partner_partial_cancel_item(p_item_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item task_items%ROWTYPE;
  v_task tasks%ROWTYPE;
  v_caller_pid uuid;
  v_caller_pcode text;
BEGIN
  IF p_item_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'item_id 누락'); END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  SELECT * INTO v_item FROM task_items WHERE id = p_item_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '품목을 찾을 수 없습니다'); END IF;
  IF COALESCE(v_item.is_canceled, false) THEN RETURN jsonb_build_object('ok', true, 'note', '이미 취소된 품목입니다'); END IF;

  SELECT * INTO v_task FROM tasks WHERE id = v_item.task_id;
  IF v_task.status = '취소' THEN RETURN jsonb_build_object('ok', false, 'error', '이미 전체 취소된 작업입니다'); END IF;

  SELECT principal_id, principal_code INTO v_caller_pid, v_caller_pcode
  FROM _get_caller_partner_principal();
  IF v_caller_pid IS NULL THEN RAISE EXCEPTION '권한 없음 — partner 역할 필요'; END IF;
  IF v_caller_pid <> v_task.principal_id THEN
    RAISE EXCEPTION '권한 없음 — 자기 원청 task 만 취소 가능';
  END IF;

  UPDATE task_items SET
    is_canceled = true,
    canceled_reason = p_reason,
    canceled_at = now()
  WHERE id = p_item_id;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'task_id', v_item.task_id);
END;
$$;

GRANT EXECUTE ON FUNCTION partner_partial_cancel_item(uuid, text) TO authenticated;

-- ============================================================================
-- [4-C] admin_full_cancel — 운영자 전체취소 (기본 수고비 none, 사후 컨트롤로 visit_fee 토글)
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_full_cancel(p_task_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_was_completed boolean;
  v_items_canceled int;
BEGIN
  IF p_task_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락'); END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  IF NOT _caller_is_admin() THEN RAISE EXCEPTION '권한 없음 — operator/owner 필요'; END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;
  IF v_task.status = '취소' THEN RETURN jsonb_build_object('ok', false, 'error', '이미 취소된 작업입니다'); END IF;

  v_was_completed := v_task.status IN ('완료', 'visit_only');

  UPDATE tasks SET
    status = '취소',
    category_data = COALESCE(category_data, '{}'::jsonb) || jsonb_build_object(
      'cancelReason', p_reason,
      'previousStatus', v_task.status,
      'cancelActor', 'operator',
      'cancelActorUserId', auth.uid(),
      'cancelActorPrincipalCode', NULL,
      'cancelAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'wasCompleted', v_was_completed
    ),
    -- 기본 수고비 = '없음'. 운영자가 작업상세 컨트롤에서 visit_fee 로 토글 가능.
    cancel_engineer_comp_kind   = 'none',
    cancel_engineer_comp_amount = 0,
    updated_at = now()
  WHERE id = p_task_id;

  UPDATE task_items SET
    is_canceled = true,
    canceled_reason = p_reason,
    canceled_at = now()
  WHERE task_id = p_task_id
    AND COALESCE(is_canceled, false) = false;
  GET DIAGNOSTICS v_items_canceled = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'items_canceled', v_items_canceled,
    'was_completed', v_was_completed,
    'comp_kind', 'none'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_full_cancel(uuid, text) TO authenticated;

-- ============================================================================
-- [4-D] admin_partial_cancel_item — 운영자 단건 부분취소
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_partial_cancel_item(p_item_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item task_items%ROWTYPE;
  v_task tasks%ROWTYPE;
BEGIN
  IF p_item_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'item_id 누락'); END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  IF NOT _caller_is_admin() THEN RAISE EXCEPTION '권한 없음 — operator/owner 필요'; END IF;

  SELECT * INTO v_item FROM task_items WHERE id = p_item_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '품목을 찾을 수 없습니다'); END IF;
  IF COALESCE(v_item.is_canceled, false) THEN RETURN jsonb_build_object('ok', true, 'note', '이미 취소된 품목입니다'); END IF;

  SELECT * INTO v_task FROM tasks WHERE id = v_item.task_id;
  IF v_task.status = '취소' THEN RETURN jsonb_build_object('ok', false, 'error', '이미 전체 취소된 작업입니다'); END IF;

  UPDATE task_items SET
    is_canceled = true,
    canceled_reason = p_reason,
    canceled_at = now()
  WHERE id = p_item_id;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'task_id', v_item.task_id);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_partial_cancel_item(uuid, text) TO authenticated;

-- ============================================================================
-- [4-E] admin_set_cancel_compensation — 미정 건 사후 수고비 지정
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_set_cancel_compensation(p_task_id uuid, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_comp_amount int;
BEGIN
  IF p_task_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락'); END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('visit_fee', 'none') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'kind 측 visit_fee / none 중 하나');
  END IF;

  IF NOT _caller_is_admin() THEN RAISE EXCEPTION '권한 없음 — operator/owner 필요'; END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;
  IF v_task.status <> '취소' THEN
    RETURN jsonb_build_object('ok', false, 'error', '취소된 작업만 수고비 지정 가능');
  END IF;

  v_comp_amount := CASE p_kind
    WHEN 'visit_fee' THEN COALESCE(v_task.travel_fee, 30000)
    WHEN 'none'      THEN 0
  END;

  UPDATE tasks SET
    cancel_engineer_comp_kind = p_kind,
    cancel_engineer_comp_amount = v_comp_amount,
    updated_at = now()
  WHERE id = p_task_id;

  -- 명시 compute_payment 호출 — v16 분기 반영
  PERFORM compute_payment(p_task_id);

  RETURN jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'kind', p_kind,
    'engineer_amount', v_comp_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_cancel_compensation(uuid, text) TO authenticated;

COMMIT;

-- ============================================================================
-- 검증 SQL (적용 후 별도 실행)
-- ============================================================================
--
-- A. RPC 5개 등록 + SECURITY DEFINER + GRANT 확인
-- SELECT proname, prosecdef AS sec_def,
--        has_function_privilege(
--          'authenticated',
--          (proname || '(' || pg_get_function_identity_arguments(oid) || ')'),
--          'EXECUTE'
--        ) AS auth_can_exec
-- FROM pg_proc
-- WHERE proname IN (
--   'partner_full_cancel', 'partner_partial_cancel_item',
--   'admin_full_cancel', 'admin_partial_cancel_item',
--   'admin_set_cancel_compensation'
-- )
-- ORDER BY proname;
-- 기대: 5 row / sec_def=true / auth_can_exec=true.
--
-- B. tasks 컬럼 + CHECK 제약 확인
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name='tasks' AND column_name LIKE 'cancel_engineer_comp%';
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint WHERE conname='tasks_cancel_comp_kind_check';
--
-- C. compute_payment v16 표기
-- SELECT obj_description((SELECT oid FROM pg_proc WHERE proname='compute_payment' LIMIT 1));
-- 기대: 'v16 (Migration 073)' 포함.
--
-- D. 시뮬 — 운영자(예: 최수연 계정) 직접 취소 + 사후 수고비 토글
-- 본 시뮬은 authenticated 운영자 세션에서 실행해야 _caller_is_admin() 통과.
-- service_role 세션은 auth.uid()=NULL 측 권한 가드 통과 X.
--
-- (가) admin_full_cancel — 기본 kind='none' 으로 취소
-- SELECT admin_full_cancel(
--   (SELECT id FROM tasks WHERE task_no='<test-task-no>'),
--   '시뮬 — 운영자 직접 취소'
-- );
-- 기대: { ok: true, comp_kind: 'none' }
-- 검증:
--   SELECT status, cancel_engineer_comp_kind, cancel_engineer_comp_amount,
--          category_data->>'cancelActor' AS actor
--   FROM tasks WHERE task_no='<test-task-no>';
--   → status='취소' / kind='none' / amount=0 / actor='operator'
--
--   SELECT engineer_amount, principal_amount, owner_amount, is_balanced
--   FROM payments WHERE task_id=(SELECT id FROM tasks WHERE task_no='<test-task-no>');
--   → 0 / 0 / 0 / true
--
-- (나) admin_set_cancel_compensation — visit_fee 로 토글
-- SELECT admin_set_cancel_compensation(
--   (SELECT id FROM tasks WHERE task_no='<test-task-no>'),
--   'visit_fee'
-- );
-- 기대: { ok: true, kind: 'visit_fee', engineer_amount: <task.travel_fee 또는 30000> }
-- 검증:
--   SELECT engineer_amount, owner_amount, is_balanced
--   FROM payments WHERE task_id=(SELECT id FROM tasks WHERE task_no='<test-task-no>');
--   → engineer_amount=30000(또는 travel_fee) / owner_amount=-30000 / is_balanced=true (0=0)
--
-- (다) 다시 none 으로 토글 — admin_set_cancel_compensation kind='none'
-- 기대: engineer_amount=0 / owner_amount=0.
--
-- E. 원청 측 자기 외 원청 task 호출 시 거부 (RAISE EXCEPTION)
-- — service_role 측 시뮬 불가. PWA 측 authenticated partner 로그인 후 검증.
--
-- ============================================================================
-- 롤백
-- ============================================================================
-- BEGIN;
--   DROP FUNCTION IF EXISTS admin_set_cancel_compensation(uuid, text);
--   DROP FUNCTION IF EXISTS admin_partial_cancel_item(uuid, text);
--   DROP FUNCTION IF EXISTS admin_full_cancel(uuid, text);
--   DROP FUNCTION IF EXISTS partner_partial_cancel_item(uuid, text);
--   DROP FUNCTION IF EXISTS partner_full_cancel(uuid, text);
--   DROP FUNCTION IF EXISTS _caller_is_admin();
--   DROP FUNCTION IF EXISTS _get_caller_partner_principal();
--
--   -- compute_payment v15 본문 측 복원 (Migration 071 본문 그대로 CREATE OR REPLACE)
--   -- db/migrations/071_compute_payment_v15_is_canceled.sql 의 CREATE OR REPLACE 블록 통째 붙여넣기.
--
--   ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_cancel_comp_kind_check;
--   ALTER TABLE tasks
--     DROP COLUMN IF EXISTS cancel_engineer_comp_kind,
--     DROP COLUMN IF EXISTS cancel_engineer_comp_amount;
-- COMMIT;
