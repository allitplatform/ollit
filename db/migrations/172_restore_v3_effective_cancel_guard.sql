-- ============================================================================
-- Migration 172 — admin_restore_canceled_task v3 + sync 트리거 session flag
-- 작성 : 2026-07-11
-- 의존 :
--   · 017 (sync_task_items_trg 등록)
--   · 086 (sync_category_data_to_task_items depth 가드)
--   · 157 (admin_restore_canceled_task v1)
--   · 171 (v2 옵션 B — 취소 표식 클리어)
--
-- 문제 (사장님 리포트, A-260711-014):
--   · status='확정' + category_data.cancelReason 잔존 → 배지 '취소'.
--   · '취소 복구' 버튼 클릭 → RPC v2 가드 (v_task.status <> '취소') 로 거부:
--       "복구 불가 (current=확정)".
--   · 두 기준 어긋남: 배지 = isEffectivelyCanceled (cancelReason 기반)
--                    복구 = status='취소' 기반.
--
-- 원인 (배경):
--   · Mig 171 이전 SQL (status='취소' backfill) 로 cancelReason 잔존 건 재취소.
--   · 사장님 복구 후 status 는 바뀌었지만 옛 spec (Mig 157 v1 옵션 A) 은
--     cancel 표식 미클리어 → 잔존.
--   · 결과: status='확정' + cancelReason='...' 라는 불일치 상태 누적.
--
-- 옵션 C 채택 (사장님, 2026-07-11):
--   · 복구 가드 기준을 status → isEffectivelyCanceled(≈ cancelReason 존재) 로 변경.
--   · cancelReason 잔존 건은 status 무관 복구 (= 표식 클리어) 가능.
--   · Mig 171 의 옵션 B (표식 전부 클리어 + sync flag) 는 그대로 유지.
--
-- 자동 표적 :
--   status='확정' + cancelReason 잔존 → 복구 버튼 = 표식 클리어 (status 그대로).
--   status='취소' + cancelReason 있음 → 정상 복구 (target=previousStatus).
--
-- v3 변경 요약:
--   [1] 가드: v_task.status <> '취소' → EXIT
--       →  (v_task.status <> '취소' AND cancelReason IS NULL) → EXIT.
--   [2] target_status fallback 정정:
--       · status 가 이미 '취소' 가 아니면 target = current status (변경 없음).
--       · status='취소' 인 경우만 previousStatus / wasCompleted fallback 적용.
--   [3] task_items 복구: is_canceled 있는 경우만 UPDATE (기존과 동일 — 없으면 v_items_restored=0).
--
-- 회귀 방지:
--   · sync_task_items_trg 정의는 Mig 171 v2 그대로 (session flag 가드 유지).
--     본 Mig 은 sync 함수 재정의 안 함 → 171 이 이미 실행됐다면 그대로 사용.
--     171 미실행 상태에서 본 Mig 만 실행하면 sync 우회 실패 → task_items 재INSERT 로 손상.
--     ★ 사장님: 171 → 172 순서 지켜 실행. 171 재실행 무해 (CREATE OR REPLACE).
-- ============================================================================

BEGIN;

-- ── admin_restore_canceled_task v3 ──────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_restore_canceled_task(
  p_task_id   uuid,
  p_actor     uuid,
  p_to_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task                  tasks%ROWTYPE;
  v_prev_status           text;
  v_was_completed         boolean;
  v_target_status         text;
  v_cancel_reason         text;
  v_status_was_cancel     boolean;
  v_items_restored        int := 0;
  v_legacy_missing_backup int := 0;
  v_payment               payments%ROWTYPE;
  v_remitted              boolean;
  v_new_category_data     jsonb;
  v_new_work_items        jsonb;
BEGIN
  -- ── 입력 검증 ──────────────────────────────────────────────────────────
  IF p_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '미로그인 — actor 필요');
  END IF;
  IF p_task_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락');
  END IF;

  -- ── 권한 ──────────────────────────────────────────────────────────────
  IF NOT _caller_is_admin(p_actor) THEN
    RAISE EXCEPTION '권한 없음 — operator/owner/admin 필요';
  END IF;

  -- ── task 조회 ────────────────────────────────────────────────────────
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  v_cancel_reason     := v_task.category_data->>'cancelReason';
  v_status_was_cancel := (v_task.status = '취소');

  -- ── v3 가드: 취소 상태 또는 취소 표식 잔존 시에만 허용 ────────────────
  IF NOT v_status_was_cancel AND v_cancel_reason IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', '취소 상태도 아니며 취소 표식도 없음 (current=' || v_task.status || ')'
    );
  END IF;

  -- ── 복귀 target 결정 ─────────────────────────────────────────────────
  --   status='취소' → previousStatus / wasCompleted fallback / p_to_status 최우선.
  --   status='취소' 아님 (표식만 잔존) → 현재 status 유지 (표식 클리어 목적).
  v_prev_status   := v_task.category_data->>'previousStatus';
  v_was_completed := COALESCE((v_task.category_data->>'wasCompleted')::boolean, false);

  IF v_status_was_cancel THEN
    v_target_status := COALESCE(
      NULLIF(TRIM(COALESCE(p_to_status, '')), ''),
      NULLIF(v_prev_status, ''),
      CASE WHEN v_was_completed THEN '완료' ELSE '확정' END
    );
  ELSE
    v_target_status := COALESCE(
      NULLIF(TRIM(COALESCE(p_to_status, '')), ''),
      v_task.status
    );
  END IF;

  IF v_target_status NOT IN ('완료', '확정', '진행', '배정') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', '복귀 가능 상태가 아님 (' || v_target_status || ') — {완료/확정/진행/배정} 중 하나'
    );
  END IF;

  -- ── 송금 상태 측정 (warning) ────────────────────────────────────────
  SELECT
    (engineer_remitted_at IS NOT NULL OR engineer_remit_confirmed_at IS NOT NULL)
  INTO v_remitted
  FROM payments WHERE task_id = p_task_id;
  v_remitted := COALESCE(v_remitted, false);

  -- ── session flag ON — sync_task_items_trg 우회 ──────────────────────
  PERFORM set_config('app.skip_sync_trigger', 'true', true);

  -- ── [4] task_items 복귀 (canceled 인 항목만) ─────────────────────────
  UPDATE task_items SET
    is_canceled     = false,
    canceled_reason = NULL,
    canceled_at     = NULL
  WHERE task_id = p_task_id
    AND COALESCE(is_canceled, false) = true;

  GET DIAGNOSTICS v_items_restored = ROW_COUNT;

  SELECT COUNT(*) INTO v_legacy_missing_backup
  FROM task_items
  WHERE task_id = p_task_id
    AND COALESCE(is_canceled, false) = false
    AND COALESCE(customer_paid_amount, 0) = 0
    AND NOT (COALESCE(metadata, '{}'::jsonb) ? '_pre_cancel_paid');

  -- ── [5a] category_data 취소 표식 클리어 (workItems 내부 표식 포함) ──
  IF v_task.category_data ? 'workItems'
     AND jsonb_typeof(v_task.category_data->'workItems') = 'array' THEN
    SELECT COALESCE(jsonb_agg(
      (elem - 'isCanceled' - 'canceledReason' - 'canceledAt')
    ), '[]'::jsonb)
    INTO v_new_work_items
    FROM jsonb_array_elements(v_task.category_data->'workItems') AS elem;
  ELSE
    v_new_work_items := NULL;
  END IF;

  v_new_category_data := COALESCE(v_task.category_data, '{}'::jsonb)
    - 'cancelReason'
    - 'cancelActor'
    - 'cancelActorUserId'
    - 'cancelActorPrincipalCode'
    - 'cancelAt'
    - 'previousStatus'
    - 'wasCompleted';

  IF v_new_work_items IS NOT NULL THEN
    v_new_category_data := jsonb_set(v_new_category_data, '{workItems}', v_new_work_items, true);
  END IF;

  -- ── [5b] tasks UPDATE ───────────────────────────────────────────────
  UPDATE tasks SET
    status                      = v_target_status,
    cancel_engineer_comp_kind   = NULL,
    cancel_engineer_comp_amount = NULL,
    category_data               = v_new_category_data,
    completed_at = CASE
      WHEN v_target_status = '완료' THEN COALESCE(completed_at, scheduled_at, now())
      ELSE completed_at
    END,
    updated_at = now()
  WHERE id = p_task_id;

  -- ── [6] compute_payment 명시 재호출 ─────────────────────────────────
  BEGIN
    PERFORM compute_payment(p_task_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[admin_restore_canceled_task v3] compute_payment 실패 — task_id=%, err=%', p_task_id, SQLERRM;
  END;

  -- ── [9] 결과 반환 ────────────────────────────────────────────────────
  SELECT * INTO v_payment FROM payments WHERE task_id = p_task_id;

  RETURN jsonb_build_object(
    'ok',                    true,
    'task_id',               p_task_id,
    'restored_to',           v_target_status,
    'previous_status',       v_prev_status,
    'status_was_cancel',     v_status_was_cancel,
    'items_restored',        v_items_restored,
    'cancel_marks_cleared',  true,
    'engineer_amount',       COALESCE(v_payment.engineer_amount, 0),
    'principal_amount',      COALESCE(v_payment.principal_amount, 0),
    'owner_amount',          COALESCE(v_payment.owner_amount, 0),
    'is_balanced',           COALESCE(v_payment.is_balanced, false),
    'remitted',              v_remitted,
    'legacy_backup_missing', v_legacy_missing_backup
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_restore_canceled_task(uuid, uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION admin_restore_canceled_task(uuid, uuid, text) IS
  '취소된 task 복구 v3 (Mig 172). 가드 기준: status=''취소'' OR cancelReason 잔존. '
  '취소 표식 전부 클리어 (Mig 171 v2 옵션 B 유지). '
  'status 가 이미 취소 아니면 target = 현재 status (표식 클리어만).';

COMMIT;
