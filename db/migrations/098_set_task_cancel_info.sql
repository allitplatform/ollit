-- ============================================================================
-- Migration 098 — set_task_cancel_info RPC
-- 2026-06-07
--
-- 배경:
--   취소 작업의 cancelActor / cancelReason / cancelActorUserId / cancelActorPrincipalCode
--   를 운영자가 직접 입력·수정할 수 있는 RPC. 옛 시트 sync 취소(category_data 빈 값) +
--   기사 PWA 취소요청 승인(Mig 074 admin_full_cancel이 actor='operator'로 덮어씀) 둘
--   모두 정정 가능하게 함.
--
-- 인자:
--   p_task_id    uuid  — 대상 task (status='취소' 여야 함)
--   p_actor_kind text  — 'operator' | 'partner' | 'engineer' | 'customer'
--   p_reason     text  — 사유 (비어 있으면 거부)
--   p_actor      uuid  — 호출자 user_id (운영자 인증)
--
-- 보조 필드 자동 계산:
--   actor_kind='operator' → cancelActorUserId = p_actor, principalCode = NULL
--   actor_kind='partner'  → cancelActorUserId = NULL,    principalCode = task의 principal code
--   actor_kind='engineer' → cancelActorUserId = task.assigned_engineer_id, principalCode = NULL
--   actor_kind='customer' → cancelActorUserId = NULL,    principalCode = NULL
--
-- 보존:
--   category_data 의 다른 키 (paymentTrack, items, refrigerant, reassignRequest, …)
--   정산·배정 등 다른 컬럼은 절대 건드리지 않음. MERGE 만 수행.
--   cancelAt 은 이미 값이 있으면 보존, 없으면 now() 로 설정. updated_at 만 갱신.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION set_task_cancel_info(
  p_task_id    uuid,
  p_actor_kind text,
  p_reason     text,
  p_actor      uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task            tasks%ROWTYPE;
  v_reason_clean    text;
  v_actor_user_id   uuid;
  v_principal_code  text;
  v_existing_at     text;
  v_at_value        text;
BEGIN
  -- ── 입력 검증 ─────────────────────────────────────────────────────────
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF p_task_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락');
  END IF;
  IF p_actor_kind IS NULL OR p_actor_kind NOT IN ('operator','partner','engineer','customer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actor_kind 는 operator/partner/engineer/customer 중 하나');
  END IF;

  v_reason_clean := TRIM(COALESCE(p_reason, ''));
  IF v_reason_clean = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '사유 누락');
  END IF;

  -- ── 권한 — 운영자 (admin/owner/operator) 만 ────────────────────────────
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  -- ── 대상 task 확인 ────────────────────────────────────────────────────
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;
  IF v_task.status <> '취소' THEN
    RETURN jsonb_build_object('ok', false, 'error', '취소 상태인 작업만 가능');
  END IF;

  -- ── 보조 필드 계산 ────────────────────────────────────────────────────
  IF p_actor_kind = 'operator' THEN
    v_actor_user_id  := p_actor;
    v_principal_code := NULL;
  ELSIF p_actor_kind = 'partner' THEN
    v_actor_user_id := NULL;
    SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  ELSIF p_actor_kind = 'engineer' THEN
    v_actor_user_id  := v_task.assigned_engineer_id;
    v_principal_code := NULL;
  ELSE  -- customer
    v_actor_user_id  := NULL;
    v_principal_code := NULL;
  END IF;

  -- cancelAt 보존 (이미 있으면 그대로, 없으면 now)
  v_existing_at := v_task.category_data->>'cancelAt';
  IF v_existing_at IS NOT NULL AND v_existing_at <> '' THEN
    v_at_value := v_existing_at;
  ELSE
    v_at_value := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  END IF;

  -- ── MERGE — 다른 키 보존, cancel* 만 덮어쓰기 ──────────────────────────
  UPDATE tasks SET
    category_data = COALESCE(category_data, '{}'::jsonb) || jsonb_build_object(
      'cancelActor',              p_actor_kind,
      'cancelActorUserId',        v_actor_user_id,
      'cancelActorPrincipalCode', v_principal_code,
      'cancelReason',             v_reason_clean,
      'cancelAt',                 v_at_value
    ),
    updated_at = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'ok',                       true,
    'task_id',                  p_task_id,
    'cancelActor',              p_actor_kind,
    'cancelActorUserId',        v_actor_user_id,
    'cancelActorPrincipalCode', v_principal_code,
    'cancelAt',                 v_at_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION set_task_cancel_info(uuid, text, text, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 SQL — 실행 후 확인용
-- ============================================================================
-- 1) 함수 존재 확인
--   SELECT proname, pg_get_function_arguments(oid) AS args
--   FROM pg_proc WHERE proname = 'set_task_cancel_info';
--
-- 2) 권한 미충족 케이스 (운영자 아닌 actor) — 거부
--   SELECT set_task_cancel_info('<task_id>', 'engineer', '테스트', '<non-admin-uuid>');
--   → 권한 없음 예외
--
-- 3) actor_kind 잘못된 값 — 거부
--   SELECT set_task_cancel_info('<task_id>', 'foo', '테스트', '<admin-uuid>');
--   → { ok:false, error:'actor_kind 는 ...' }
--
-- 4) 정상 케이스 — 운영자가 기사 취소로 표시
--   SELECT set_task_cancel_info(
--     '<cancel-task-id>',
--     'engineer',
--     '고객 일정 변경 요청',
--     '<admin-uuid>'
--   );
--   → { ok:true, cancelActor:'engineer', cancelActorUserId:'<assigned_engineer_id>', ... }
--
-- 5) 결과 확인
--   SELECT category_data->>'cancelActor', category_data->>'cancelReason',
--          category_data->>'cancelActorUserId', category_data->>'cancelAt'
--   FROM tasks WHERE id = '<cancel-task-id>';
