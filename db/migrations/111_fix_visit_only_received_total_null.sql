-- ============================================
-- Migration 111 — mark_visit_only RPC: received_total = NULL 도 set (트리거 override 차단)
-- 작성일 : 2026-06-16
-- 실행   : Supabase 콘솔 → SQL Editor → 통째 → Run (CREATE OR REPLACE = idempotent)
-- ============================================
--
-- 사고 분석 (2026-06-16):
--   A-260615-005 (allday, visit_only) 가 travel_fee=30000 AND extra_fee=30000 으로 중복 stamp.
--   사장님 진단으로 17건 중 7건이 동일 패턴. 백필은 별도 완료 (Mig 099 STEP 4 불필요).
--
-- Root cause:
--   1. 기사 PWA "출장비만" 버튼 → EngineerTaskDetailScreen.jsx:1154 `persistAndNavigate("visitOnly")` 호출
--   2. persistAndNavigate 3-way 분기 (per-item / received_total / legacy) 중 어느 경로든
--      tasks.received_total 또는 task_items.received_amount 가 DB 에 30000 으로 set 됨
--   3. setSubScreen("visitOnly") → TaskVisitOnlyScreen → onConfirm → markVisitOnlyAdapter (RPC)
--   4. RPC (Mig 054/099) 가 UPDATE tasks SET product_price=0, extra_fee=0, travel_fee=30000 실행
--   5. BEFORE trg_tasks_sync_extra_fee (Mig 083) 트리거 발화 — UPDATE OF received_total, product_price 발화 조건
--      · 가드 (usol_n / prepaid) 통과 (allday 등 비-usol_n)
--      · NEW.received_total IS NOT NULL (위 2단계에서 set 됨)
--      · NEW.extra_fee := GREATEST(NEW.received_total - NEW.product_price, 0)
--        = GREATEST(30000 - 0, 0) = 30000
--   6. RPC 의 extra_fee=0 이 트리거에 의해 30000 으로 덮임
--   7. total_amount (GENERATED) = 0 + 30000 + 30000 = 60000  ★ 사고
--
-- Fix (옵션 A — 좁고 안전):
--   RPC UPDATE 본문에 `received_total = NULL` 한 줄 추가.
--   트리거의 IF NEW.received_total IS NOT NULL 가드 조건이 빠져나가 NEW.extra_fee 덮어쓰기 skip.
--
-- 회귀:
--   · received_total 의미: "고객 결제 총액" — visit_only 는 작업 안 함 + 출장비만 받음.
--     business: customer 가 30000 지불 — 이는 travel_fee=30000 으로 표현. received_total NULL 정합.
--   · 다른 흐름 (status='완료' 등) — RPC 호출 안 함, 영향 0.
--   · 정산 계산 (compute_payment) — visit_only 는 RPC 가 payments 직접 INSERT (compute_payment 우회).
--     received_total 변경이 정산에 영향 X.
--   · usol_n / prepaid 가드 — 동일 (트리거 안 타는 케이스).
--
-- 대안 (불채택):
--   · 옵션 B: 트리거가 travel_fee 차감 — extra_fee = received_total - product_price - travel_fee.
--     개념상 더 정확하나 모든 비-usol_n 작업에 영향. 부수 효과 검증 부담.
--   · 옵션 C: 트리거가 status='visit_only' 시 skip — BEFORE 트리거에서 status 비교 가능하나
--     RPC 호출 순서 의존성 측 risk.
--
-- 의존:
--   · Mig 054 (mark_visit_only 원본)
--   · Mig 083 (tasks.received_total 컬럼 + BEFORE 트리거 trg_tasks_sync_extra_fee)
--   · Mig 099 (CREATE OR REPLACE 재발행 본)
--
-- 회귀 보호:
--   · CREATE OR REPLACE — 재실행 안전
--   · 트리거 함수 / 다른 RPC / compute_payment — 0 변경
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION mark_visit_only(
  p_task_id  uuid,
  p_reason   text,
  p_memo     text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task        tasks%ROWTYPE;
  v_visit_wt_id uuid;
BEGIN
  -- 1) task 존재 확인
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  -- 2) visit work_type 조회 (seed Mig 004)
  SELECT id INTO v_visit_wt_id
    FROM work_types
    WHERE code = 'visit'
    LIMIT 1;
  IF v_visit_wt_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'visit work_type 시드 누락');
  END IF;

  -- 3) 기존 task_items 제거 (본 작업 정산 흔적 정리)
  DELETE FROM task_items WHERE task_id = p_task_id;

  -- 4) visit_fee row 신규 (qty=1, 단가=30000)
  INSERT INTO task_items (task_id, work_type_id, appliance_type_id, qty, unit_price)
  VALUES (p_task_id, v_visit_wt_id, NULL, 1, 30000);

  -- 5) tasks UPDATE — 정산 컬럼 정정 + received_total=NULL (트리거 override 차단)
  --    received_total IS NOT NULL → 트리거가 extra_fee = received_total - product_price 로 덮어쓰는 사고 차단.
  --    NULL 로 set 하면 트리거 가드 IF NEW.received_total IS NOT NULL 통과 → extra_fee=0 보존.
  UPDATE tasks SET
    status         = 'visit_only',
    product_price  = 0,
    extra_fee      = 0,
    travel_fee     = 30000,
    received_total = NULL,         -- ★ 2026-06-16 신규: 트리거 override 차단
    completed_at   = NOW(),
    category_data  = COALESCE(category_data, '{}'::jsonb)
                     || jsonb_build_object('visitOnly',
                          jsonb_build_object(
                            'reason',   COALESCE(p_reason, ''),
                            'memo',     COALESCE(p_memo, ''),
                            'markedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                          )),
    updated_at     = NOW()
  WHERE id = p_task_id;

  -- 6) payments 직접 INSERT (compute_payment 우회 — visit_fee policy fallback 함정 회피)
  DELETE FROM payments WHERE task_id = p_task_id;

  INSERT INTO payments (
    task_id, computed_by,
    policy_key, calc_method,
    product_price, extra_fee, travel_fee, naver_fee,
    engineer_amount, principal_amount, owner_amount,
    status, track
  ) VALUES (
    p_task_id, auth.uid(),
    'common_visit_fee', '출장비_30K',
    0, 0, 30000, 0,
    30000, 0, 0,
    '미정산', 'A'
  );

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id);
END;
$$;

COMMENT ON FUNCTION mark_visit_only(uuid, text, text) IS
  '출장비만 처리 — task_items 재구성 + tasks UPDATE + payments 직접 INSERT. '
  'Mig 111 (2026-06-16): received_total=NULL 추가 — BEFORE trg_tasks_sync_extra_fee 의 '
  'extra_fee 덮어쓰기 차단 (17건 중 7건 중복 stamp 사고 정정).';

COMMIT;

-- ============================================
-- 검증 SQL (사장님 별도 실행 — 결과 확인)
-- ============================================

-- 1) RPC 적용 확인 — 함수 COMMENT 에 "Mig 111" 들어있는지
-- SELECT proname, obj_description(p.oid, 'pg_proc') AS note
-- FROM pg_proc p WHERE p.proname = 'mark_visit_only';
-- → 기대: '... Mig 111 (2026-06-16): received_total=NULL ... 차단 ...'

-- 2) 신규 visit_only 처리 단계별 검증 (테스트 1건):
--    A. test task 1건 골라서 사전 상태:
-- SELECT task_no, status, product_price, extra_fee, travel_fee, received_total, total_amount
-- FROM tasks WHERE id = '<test_task_uuid>';
--
--    B. RPC 호출:
-- SELECT mark_visit_only('<test_task_uuid>'::uuid, 'customer_absent', '테스트');
--
--    C. 직후 상태:
-- SELECT task_no, status, product_price, extra_fee, travel_fee, received_total, total_amount,
--        category_data->'visitOnly' AS visit_only_meta
-- FROM tasks WHERE id = '<test_task_uuid>';
-- → 기대: status='visit_only', product=0, extra=0, travel=30000, received_total=NULL, total=30000

-- 3) 전체 visit_only 분포 (Mig 099 STEP 1-A 와 동일 — 사후 모니터링용):
-- SELECT
--   COUNT(*) FILTER (WHERE extra_fee = 0 AND travel_fee = 30000 AND product_price = 0) AS clean,
--   COUNT(*) FILTER (WHERE extra_fee = 30000 AND travel_fee = 30000)                  AS dup_30k_residual,
--   COUNT(*) FILTER (WHERE extra_fee > 30000)                                          AS extra_beyond,
--   COUNT(*) AS total
-- FROM tasks
-- WHERE status = 'visit_only'
--   AND tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
-- → 기대 (백필 + Mig 111 후): clean = total, dup_30k_residual = 0.

-- ============================================
-- 롤백 (위급 시):
--   Mig 099 본문 그대로 재실행 → received_total=NULL 라인 없는 RPC 로 복귀.
--   CREATE OR REPLACE = idempotent.
-- ============================================
