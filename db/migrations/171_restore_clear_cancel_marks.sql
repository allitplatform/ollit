-- ============================================================================
-- Migration 171 — 취소 복구 시 취소 표식 전부 클리어 (isEffectivelyCanceled 반영)
-- 작성 : 2026-07-11
-- 의존 :
--   · 017 (sync_task_items_trg 등록)
--   · 086 (sync_category_data_to_task_items depth 가드)
--   · 157 (admin_restore_canceled_task v1)
--   · 074 (partner_cancel / operator_full_cancel — cancel 표식 저장 지점)
--
-- 문제:
--   Mig 157 v1 옵션 A → category_data 잔존 (cancelReason 유지).
--   Client isEffectivelyCanceled(task) 판정 로직:
--     · status='취소' → true
--     · workItems 전부 isCanceled → true
--     · **cancelReason || cancelAt → true**    ← 이 지점 잔존 때문에
--   복구된 작업도 계속 "취소" 로 판정 → 배지·작업항목 취소 표시 안 풀림.
--
-- 옵션 B 채택 (사장님, 2026-07-11):
--   복구 시 취소 표식 전부 클리어:
--     · category_data 에서 cancelReason, cancelActor, cancelActorUserId,
--       cancelActorPrincipalCode, cancelAt, previousStatus, wasCompleted 제거.
--     · status = previousStatus (or p_to_status / fallback).
--     · tasks 컬럼 cancel_engineer_comp_kind / cancel_engineer_comp_amount NULL.
--   → isEffectivelyCanceled = false → 배지·작업항목 취소 표시 자동 해제.
--
-- sync_task_items_trg 회피:
--   category_data UPDATE 를 하면 sync_task_items_trg 발화 → task_items DELETE + 재INSERT.
--   재INSERT 는 customer_paid_amount / metadata._pre_cancel_paid 백업 미보존
--   → 완료 후 취소된 작업 복구 시 정산 재계산 소스 손상.
--
--   해결:
--   · session-local flag `app.skip_sync_trigger`='true' 를 RPC 진입 시 SET LOCAL.
--   · sync_category_data_to_task_items 진입 즉시 flag 체크 → RETURN.
--   · SET LOCAL 은 transaction commit/rollback 시 자동 해제.
--
-- 트리거 발화 (v2):
--   [4] task_items UPDATE (is_canceled=false)      — 기존과 동일.
--   [5] tasks UPDATE (category_data 포함) — v2:
--       · sync_task_items_trg 발화하지만 session flag 로 즉시 RETURN.
--       · compute_payment_trg 발화 → compute_payment 자동 호출.
--       · tasks_status_change → status_history 자동 INSERT.
--   [6] compute_payment 명시 재호출 (안전망).
--
-- 회귀 방지:
--   · session flag 는 이 RPC transaction 안에서만 유효 → 다른 UPDATE 경로 영향 없음.
--   · flag 초기값 없음 → current_setting(..., true) 는 '' 반환 → 기존 sync 로직 통과.
-- ============================================================================

BEGIN;

-- ── [1] sync 트리거 함수 갱신 — session flag 가드 추가 ────────────────────
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
  -- ★ 2026-07-11 Mig 171 — session flag 가드 (admin_restore_canceled_task v2 진입 시).
  --   RPC 내부에서 category_data UPDATE 하되 task_items 는 이미 손수 복원한 상태 유지.
  IF current_setting('app.skip_sync_trigger', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- ★ Mig 086 — 재귀 가드.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- UPDATE 시 기존 task_items 삭제 (재생성)
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM task_items WHERE task_id = NEW.id;
  END IF;

  -- category_data.workItems 없으면 skip
  IF NEW.category_data IS NULL OR NOT (NEW.category_data ? 'workItems') THEN
    RETURN NEW;
  END IF;

  -- 총수량 계산 (평균 분배 기준)
  SELECT COALESCE(SUM((it->>'qty')::numeric), 0)
    INTO v_total_qty
    FROM jsonb_array_elements(NEW.category_data->'workItems') AS it;

  -- 평균 단가 (0 나눗셈 가드)
  IF v_total_qty > 0 THEN
    v_avg_unit := FLOOR(COALESCE(NEW.product_price, 0)::numeric / v_total_qty)::int;
  ELSE
    v_avg_unit := 0;
  END IF;

  -- workItems 순회
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
  'category_data.workItems → task_items 동기화. '
  'v2 (Mig 171) — session flag app.skip_sync_trigger 가드 추가 '
  '(admin_restore_canceled_task 등 손수 복원 경로 보호).';


-- ── [2] admin_restore_canceled_task v2 — 취소 표식 전부 클리어 ────────────
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

  -- ── task 조회 + 상태 검증 ─────────────────────────────────────────────
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;
  IF v_task.status <> '취소' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', '취소 상태 작업만 복구 가능 (current=' || v_task.status || ')'
    );
  END IF;

  -- ── 복귀 target 결정 (읽기만) ────────────────────────────────────────
  v_prev_status   := v_task.category_data->>'previousStatus';
  v_was_completed := COALESCE((v_task.category_data->>'wasCompleted')::boolean, false);

  v_target_status := COALESCE(
    NULLIF(TRIM(COALESCE(p_to_status, '')), ''),
    NULLIF(v_prev_status, ''),
    CASE WHEN v_was_completed THEN '완료' ELSE '확정' END
  );

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

  -- ── session flag ON — sync_task_items_trg 우회 (task_items 손수 복원 보호) ──
  PERFORM set_config('app.skip_sync_trigger', 'true', true);

  -- ── [4] task_items 복귀 (트리거 자동 연쇄) ───────────────────────────
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

  -- ── [5a] category_data 취소 표식 클리어 (workItems 내부 isCanceled 도 정리) ──
  --   workItems 배열 안 각 항목의 isCanceled/canceledReason/canceledAt 도 지움
  --   (rowToTask 는 task_items 우선이지만 category_data.workItems 도 잔존 표식 정리).
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

  -- ── [5b] tasks UPDATE (status + cancel_* + completed_at + category_data) ──
  --   sync_task_items_trg 발화하지만 session flag 로 즉시 RETURN → task_items 보존.
  --   compute_payment_trg 발화 → compute_payment 자동 호출.
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

  -- ── [6] compute_payment 명시 재호출 (안전망) ─────────────────────────
  BEGIN
    PERFORM compute_payment(p_task_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[admin_restore_canceled_task v2] compute_payment 실패 — task_id=%, err=%', p_task_id, SQLERRM;
  END;

  -- ── [9] 결과 반환 ────────────────────────────────────────────────────
  SELECT * INTO v_payment FROM payments WHERE task_id = p_task_id;

  RETURN jsonb_build_object(
    'ok',                    true,
    'task_id',               p_task_id,
    'restored_to',           v_target_status,
    'previous_status',       v_prev_status,
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
  '취소된 task 복구 v2 (Mig 171). 옵션 B — 취소 표식 전부 클리어 '
  '(cancelReason/cancelActor/cancelActorUserId/cancelActorPrincipalCode/cancelAt/previousStatus/wasCompleted). '
  'session flag app.skip_sync_trigger 로 sync_task_items_trg 우회 → task_items 손수 복원 보호. '
  'previousStatus 우선 / wasCompleted fallback / 명시 p_to_status 최우선.';

COMMIT;

-- ============================================================================
-- 검증 SQL (별도 실행)
-- ============================================================================
--
-- A. 함수 v2 등록 확인
-- SELECT proname, obj_description(oid, 'pg_proc') AS comment
-- FROM pg_proc
-- WHERE proname IN ('admin_restore_canceled_task', 'sync_category_data_to_task_items');
-- 기대: comment 에 'v2' / 'Mig 171' 문구.
--
-- B. sync 가드 확인 — session flag 없이 UPDATE 하면 기존 동작
-- BEGIN;
-- UPDATE tasks SET category_data = category_data || '{"_probe":"171"}'::jsonb
-- WHERE id = '<some-task-id>'::uuid;
-- SELECT COUNT(*) FROM task_items WHERE task_id = '<some-task-id>'::uuid;
-- 기대: 여전히 sync trigger 발화 (기존 spec 유지, flag 없으므로).
-- ROLLBACK;
--
-- C. RPC 왕복 테스트 — 취소 → 복구 → 취소 → 복구
-- BEGIN;
-- SELECT admin_full_cancel('<task-id>'::uuid, '<admin-uuid>'::uuid, '테스트');
-- SELECT status, category_data ? 'cancelReason' AS has_cr FROM tasks WHERE id = '<task-id>'::uuid;
-- 기대: status='취소', has_cr=true.
--
-- SELECT admin_restore_canceled_task('<task-id>'::uuid, '<admin-uuid>'::uuid);
-- SELECT status, category_data ? 'cancelReason' AS has_cr,
--        category_data ? 'previousStatus' AS has_ps,
--        category_data ? 'cancelActor' AS has_ca
-- FROM tasks WHERE id = '<task-id>'::uuid;
-- 기대: status=이전 상태 / has_cr=false / has_ps=false / has_ca=false.
-- ROLLBACK;
--
-- D. workItems isCanceled 정리 확인
-- SELECT jsonb_pretty(category_data->'workItems') FROM tasks WHERE id = '<restored-task-id>'::uuid;
-- 기대: 각 항목에 isCanceled/canceledReason/canceledAt 키 없음.
--
-- ============================================================================
-- 롤백
-- ============================================================================
-- BEGIN;
--   -- 157 로 되돌리려면 그 파일 재실행. sync 함수도 086 재실행 필요.
-- COMMIT;
