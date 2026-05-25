-- ============================================================================
-- Migration 074 — Round 2 취소 RPC 호출자 식별 정정 (auth.uid → p_actor)
-- 작성: 2026-05-25
-- 상태: 초안 (사장님 검토 + 적용 대기)
-- ============================================================================
-- 배경:
--   073 RPC 5개 + 헬퍼 2개 모두 auth.uid() 사용 → PWA(자체 인증 + anon 키)에서
--   auth.uid() = NULL → '권한 없음' RAISE EXCEPTION 으로 거부됨.
--   원청 P003 유솔홈케어 대표가 partner_full_cancel 호출 시 '권한 없음 — partner
--   역할 필요' 거부 — 사장님 보고.
--
-- 패턴 통일:
--   다른 RPC (mark_principal_remitted / undo_principal_remit / confirm_principal_remit
--   / change_password / sign_in_with_phone) 와 동일 — 클라이언트가 localStorage("allit.user")
--   에서 user_id 읽어 p_user_id 명시 전달. 본 라운드 인자명은 p_actor 로 통일.
--
-- 변경:
--   [1] 헬퍼 2개 시그니처 변경 — DROP + CREATE
--       · _get_caller_partner_principal() → _get_caller_partner_principal(p_actor uuid)
--       · _caller_is_admin()              → _caller_is_admin(p_actor uuid)
--   [2] RPC 5개 시그니처 변경 — DROP + CREATE + GRANT TO anon, authenticated
--       · partner_full_cancel(p_task_id, p_reason, p_actor)
--       · partner_partial_cancel_item(p_item_id, p_reason, p_actor)
--       · admin_full_cancel(p_task_id, p_reason, p_actor)
--       · admin_partial_cancel_item(p_item_id, p_reason, p_actor)
--       · admin_set_cancel_compensation(p_task_id, p_kind, p_actor)
--   [3] GRANT EXECUTE TO anon, authenticated — PWA 가 anon 키로 호출하므로 anon 필수.
--
-- 본문 변경:
--   · auth.uid() → p_actor  (헬퍼·RPC 모두)
--   · p_actor IS NULL 시 RAISE EXCEPTION '미로그인 — actor 필요'.
--   · category_data.cancelActorUserId = p_actor.
--   · 기타 본문(070 트리거 자동 연쇄, compute_payment v16 분기, 수고비 토글 흐름) 무손상.
--
-- 회귀:
--   · 옛 시그니처 호출처는 src/lib/cancelRpc.js 한 곳뿐 — 본 마이그와 동시에 클라이언트 정정.
--   · 070/071/072/073 의 다른 변경(컬럼 / compute_payment v16) 무손상.
--
-- 실행: 사장님 OK 후 Supabase SQL Editor → 통째 붙여넣기 → Run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- [1] 옛 함수 DROP (의존 순서 — RPC → 헬퍼)
-- ============================================================================
DROP FUNCTION IF EXISTS admin_set_cancel_compensation(uuid, text);
DROP FUNCTION IF EXISTS admin_partial_cancel_item(uuid, text);
DROP FUNCTION IF EXISTS admin_full_cancel(uuid, text);
DROP FUNCTION IF EXISTS partner_partial_cancel_item(uuid, text);
DROP FUNCTION IF EXISTS partner_full_cancel(uuid, text);
DROP FUNCTION IF EXISTS _caller_is_admin();
DROP FUNCTION IF EXISTS _get_caller_partner_principal();

-- ============================================================================
-- [2] 헬퍼 2개 재작성 — p_actor uuid 인자
-- ============================================================================
CREATE OR REPLACE FUNCTION _get_caller_partner_principal(p_actor uuid)
RETURNS TABLE (principal_id uuid, principal_code text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL THEN
    RETURN;  -- 빈 결과 — 호출처가 NULL 검사
  END IF;
  RETURN QUERY
  SELECT p.id, p.code
  FROM user_roles ur
  JOIN principals p ON p.id = ur.principal_id
  WHERE ur.user_id = p_actor AND ur.role = 'partner'
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION _caller_is_admin(p_actor uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL THEN RETURN false; END IF;
  -- 'admin' 포함 — 대표 계정(A004 최수연 등) 통과.
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor
      AND role IN ('owner', 'operator', 'admin')
  );
END;
$$;

-- ============================================================================
-- [3-A] partner_full_cancel — 원청 전체 취소 (기본 수고비 none)
-- ============================================================================
CREATE OR REPLACE FUNCTION partner_full_cancel(p_task_id uuid, p_reason text, p_actor uuid)
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
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요'); END IF;
  IF p_task_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락'); END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;
  IF v_task.status = '취소' THEN RETURN jsonb_build_object('ok', false, 'error', '이미 취소된 작업입니다'); END IF;

  -- 권한 가드 — p_actor 측 partner 역할 + principal_id 일치
  SELECT principal_id, principal_code
    INTO v_caller_pid, v_caller_pcode
  FROM _get_caller_partner_principal(p_actor);
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
      'cancelActorUserId', p_actor,
      'cancelActorPrincipalCode', v_caller_pcode,
      'cancelAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'wasCompleted', v_was_completed
    ),
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

GRANT EXECUTE ON FUNCTION partner_full_cancel(uuid, text, uuid) TO anon, authenticated;

-- ============================================================================
-- [3-B] partner_partial_cancel_item — 원청 단건 부분취소
-- ============================================================================
CREATE OR REPLACE FUNCTION partner_partial_cancel_item(p_item_id uuid, p_reason text, p_actor uuid)
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
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요'); END IF;
  IF p_item_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'item_id 누락'); END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  SELECT * INTO v_item FROM task_items WHERE id = p_item_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '품목을 찾을 수 없습니다'); END IF;
  IF COALESCE(v_item.is_canceled, false) THEN RETURN jsonb_build_object('ok', true, 'note', '이미 취소된 품목입니다'); END IF;

  SELECT * INTO v_task FROM tasks WHERE id = v_item.task_id;
  IF v_task.status = '취소' THEN RETURN jsonb_build_object('ok', false, 'error', '이미 전체 취소된 작업입니다'); END IF;

  SELECT principal_id, principal_code INTO v_caller_pid, v_caller_pcode
  FROM _get_caller_partner_principal(p_actor);
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

GRANT EXECUTE ON FUNCTION partner_partial_cancel_item(uuid, text, uuid) TO anon, authenticated;

-- ============================================================================
-- [3-C] admin_full_cancel — 운영자 전체 취소 (기본 수고비 none)
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_full_cancel(p_task_id uuid, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_was_completed boolean;
  v_items_canceled int;
BEGIN
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요'); END IF;
  IF p_task_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락'); END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  IF NOT _caller_is_admin(p_actor) THEN RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요'; END IF;

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
      'cancelActorUserId', p_actor,
      'cancelActorPrincipalCode', NULL,
      'cancelAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'wasCompleted', v_was_completed
    ),
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

GRANT EXECUTE ON FUNCTION admin_full_cancel(uuid, text, uuid) TO anon, authenticated;

-- ============================================================================
-- [3-D] admin_partial_cancel_item — 운영자 단건 부분취소
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_partial_cancel_item(p_item_id uuid, p_reason text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item task_items%ROWTYPE;
  v_task tasks%ROWTYPE;
BEGIN
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요'); END IF;
  IF p_item_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'item_id 누락'); END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  IF NOT _caller_is_admin(p_actor) THEN RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요'; END IF;

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

GRANT EXECUTE ON FUNCTION admin_partial_cancel_item(uuid, text, uuid) TO anon, authenticated;

-- ============================================================================
-- [3-E] admin_set_cancel_compensation — 운영자 수고비 토글 (visit_fee / none)
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_set_cancel_compensation(p_task_id uuid, p_kind text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_comp_amount int;
BEGIN
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요'); END IF;
  IF p_task_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락'); END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('visit_fee', 'none') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'kind 측 visit_fee / none 중 하나');
  END IF;

  IF NOT _caller_is_admin(p_actor) THEN RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요'; END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;
  IF v_task.status <> '취소' THEN
    RETURN jsonb_build_object('ok', false, 'error', '취소된 작업만 수고비 지정 가능');
  END IF;

  -- α 패치(073): travel_fee=0 도 30000 fallback.
  v_comp_amount := CASE p_kind
    WHEN 'visit_fee' THEN COALESCE(NULLIF(v_task.travel_fee, 0), 30000)
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

GRANT EXECUTE ON FUNCTION admin_set_cancel_compensation(uuid, text, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 SQL (적용 후 별도 실행)
-- ============================================================================
--
-- A. RPC 5개 + 헬퍼 2개 등록 + 새 시그니처 확인
-- SELECT proname, pg_get_function_identity_arguments(oid) AS args,
--        prosecdef AS sec_def
-- FROM pg_proc
-- WHERE proname IN (
--   '_get_caller_partner_principal', '_caller_is_admin',
--   'partner_full_cancel', 'partner_partial_cancel_item',
--   'admin_full_cancel', 'admin_partial_cancel_item',
--   'admin_set_cancel_compensation'
-- )
-- ORDER BY proname;
-- 기대: 7 row / args 측 마지막 인자 'p_actor uuid' (헬퍼는 '_actor uuid').
--
-- B. GRANT 측 anon + authenticated 둘 다 EXECUTE 권한 확인
-- SELECT
--   p.proname,
--   r.rolname,
--   has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_exec
-- FROM pg_proc p
-- CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
-- WHERE p.proname IN (
--   'partner_full_cancel', 'partner_partial_cancel_item',
--   'admin_full_cancel', 'admin_partial_cancel_item',
--   'admin_set_cancel_compensation'
-- )
-- ORDER BY p.proname, r.rolname;
-- 기대: 5 RPC × 2 role = 10 row / can_exec=true 모두.
--
-- C. 시뮬 — 운영자 A004 최수연 (대표, admin) 측 admin_full_cancel
-- 본 시뮬은 anon 세션 측 가능 (auth.uid 안 씀). BEGIN/ROLLBACK 으로 실 데이터 무영향.
--
-- BEGIN;
--
-- SELECT 'BEFORE' AS phase, status, cancel_engineer_comp_kind
-- FROM tasks WHERE id='7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid;
--
-- SELECT admin_full_cancel(
--   '7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid,
--   '시뮬 — 074 검증',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid  -- A004 최수연 user_id
-- ) AS result;
-- 기대: { ok: true, comp_kind: 'none' }
--
-- SELECT '(가) tasks' AS phase, status, cancel_engineer_comp_kind, cancel_engineer_comp_amount,
--        category_data->>'cancelActor' AS actor,
--        category_data->>'cancelActorUserId' AS actor_uid
-- FROM tasks WHERE id='7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid;
-- 기대: status=취소 / kind=none / amount=0 / actor='operator' /
--       actor_uid='77777777-7777-7777-7777-aaaaaaaa0004'.
--
-- SELECT '(가) payments' AS phase, engineer_amount, principal_amount, owner_amount, is_balanced
-- FROM payments WHERE task_id='7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid;
-- 기대: 0 / 0 / 0 / true.
--
-- -- visit_fee 토글
-- SELECT admin_set_cancel_compensation(
--   '7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid,
--   'visit_fee',
--   '77777777-7777-7777-7777-aaaaaaaa0004'::uuid
-- ) AS result;
-- 기대: { ok: true, kind: 'visit_fee', engineer_amount: 30000 }.
--
-- SELECT '(나) payments' AS phase, engineer_amount, owner_amount, is_balanced
-- FROM payments WHERE task_id='7aa8001c-98e1-4e79-b3b6-eb31cb1f4dd6'::uuid;
-- 기대: 30000 / -30000 / true.
--
-- ROLLBACK;
--
-- D. 시뮬 — 원청 P003 유솔홈케어 대표 측 partner_full_cancel (anon 세션 가능)
-- BEGIN;
-- -- 자기 원청(usol_h 또는 usol_n)의 임의 task 한 건 선택해야 함. 아래는 placeholder.
-- -- SELECT partner_full_cancel(
-- --   '<usol_h 또는 usol_n task UUID>'::uuid,
-- --   '시뮬 — 원청 직접 취소',
-- --   '77777777-7777-7777-7777-cccccccc0003'::uuid  -- P003 유솔홈케어 대표 user_id
-- -- );
-- -- 기대: { ok: true, comp_kind: 'none' }.
-- ROLLBACK;
--
-- E. 권한 가드 — 다른 원청 task 호출 시 RAISE EXCEPTION
-- -- P003 (usol_h/usol_n) 측 KA task 호출 시:
-- --   '권한 없음 — 자기 원청 task 만 취소 가능' RAISE.
--
-- F. p_actor=NULL 가드
-- SELECT partner_full_cancel('7aa8001c-...'::uuid, '시뮬', NULL);
-- 기대: { ok: false, error: '미로그인 — actor 필요' }.
--
-- ============================================================================
-- 롤백 (적용 후 문제 발생 시)
-- ============================================================================
-- BEGIN;
--   DROP FUNCTION IF EXISTS admin_set_cancel_compensation(uuid, text, uuid);
--   DROP FUNCTION IF EXISTS admin_partial_cancel_item(uuid, text, uuid);
--   DROP FUNCTION IF EXISTS admin_full_cancel(uuid, text, uuid);
--   DROP FUNCTION IF EXISTS partner_partial_cancel_item(uuid, text, uuid);
--   DROP FUNCTION IF EXISTS partner_full_cancel(uuid, text, uuid);
--   DROP FUNCTION IF EXISTS _caller_is_admin(uuid);
--   DROP FUNCTION IF EXISTS _get_caller_partner_principal(uuid);
--
--   -- 073 본문 측 CREATE OR REPLACE 블록 통째 붙여넣기 — 옛 시그니처 + auth.uid() 복원.
--   -- 단 옛 시그니처 RPC 는 anon 키 측 호출 불가 — 옛 상태(취소 거부) 그대로.
--   -- 본 롤백은 본 마이그 이전 상태(취소 깨짐) 측 복귀 — 권장 X.
-- COMMIT;
