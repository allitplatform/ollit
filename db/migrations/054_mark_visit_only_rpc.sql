-- ============================================
-- Migration 054 — mark_visit_only RPC (출장비만 처리 원자적 흐름)
-- 작성일  : 2026-05-22
-- 범위    : 신규 RPC mark_visit_only(p_task_id, p_reason, p_memo)
--           · task_items 재구성 (기존 DELETE → visit_fee row 1건 INSERT)
--           · tasks UPDATE (status='visit_only', 정산 컬럼 정정)
--           · payments 직접 INSERT (engineer 30000 / principal 0 / owner 0)
--
-- 배경:
--   옛 흐름 측 4 곳 깨진 곳:
--     1) status 'visit_only' enum 누락 → Migration 053 측 해결
--     2) extra_fee=30000 들어가지만 product_price/travel_fee 그대로 → 본 작업 정산
--     3) task_items 측 본 작업 row 그대로 → compute_payment 측 본 작업 정산
--     4) trigger_compute_payment 측 status='완료'만 발화 → visit_only 측 payments 미생성
--   본 RPC 측 한 트랜잭션 측 4 곳 모두 정상화.
--
-- 정산 산식 (사장님 확정):
--   출장비 = 30,000원 · 기사 100% · 회사 0 · 원청 0
--   product_price=0, extra_fee=0, travel_fee=30000
--   payments: engineer_amount=30000, principal_amount=0, owner_amount=0
--   calc_method='출장비_30K', track='A' (일일정산 / 기사→회사)
--
-- 의존:
--   · Migration 053 (tasks.status 측 'visit_only' enum 추가) 선행
--   · seed visit_fee work_type (Migration 004, code='visit', service_type='visit_fee')
--   · seed common_visit_fee commission_policy (Migration 009, calc_method='출장비_30K')
--
-- 회귀 방지:
--   · trigger_compute_payment 함수 측 변경 X (완료 측만 발화 유지)
--   · calculate_commission 함수 측 변경 X (다른 service 측 정산 무손상)
--   · compute_payment 함수 측 호출 X — RPC 측 payments 직접 INSERT (policy fallback 함정 회피)
--   · 다른 status 측 흐름 무손상
--
-- 호출 spec:
--   클라이언트 측: supabase.rpc('mark_visit_only', {
--     p_task_id: <uuid>, p_reason: <text>, p_memo: <text>
--   })
--   응답: { ok: true, task_id } | { ok: false, error }
--
-- 실행:
--   · Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   · 한 번만 실행 (CREATE OR REPLACE 측 재실행 안전)
--   · 사장님 spec: Migration 053 → 054 순서
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

  -- 2) visit work_type 조회 (seed Migration 004)
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
  --    appliance_type_id NULL — 출장비 work_type 측 seed 일치
  INSERT INTO task_items (task_id, work_type_id, appliance_type_id, qty, unit_price)
  VALUES (p_task_id, v_visit_wt_id, NULL, 1, 30000);

  -- 5) tasks UPDATE — status / 정산 컬럼 정정 / category_data.visitOnly 머지
  UPDATE tasks SET
    status        = 'visit_only',
    product_price = 0,
    extra_fee     = 0,
    travel_fee    = 30000,
    completed_at  = NOW(),
    category_data = COALESCE(category_data, '{}'::jsonb)
                    || jsonb_build_object('visitOnly',
                         jsonb_build_object(
                           'reason',   COALESCE(p_reason, ''),
                           'memo',     COALESCE(p_memo, ''),
                           'markedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                         )),
    updated_at    = NOW()
  WHERE id = p_task_id;

  -- 6) payments 직접 INSERT (compute_payment 우회 — visit_fee policy 측 principal='common' 측 fallback 함정 회피)
  --    기존 row 있을 수 있어 DELETE 선행 (idempotent)
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
  '출장비만 처리 — task_items 재구성 + tasks UPDATE + payments 직접 INSERT (Migration 054)';

COMMIT;

-- ============================================
-- 검증 SQL (사장님 실행 후 확인)
-- ============================================
-- 1) RPC 등록 확인:
-- SELECT proname, obj_description(p.oid, 'pg_proc') AS note
-- FROM pg_proc p WHERE p.proname = 'mark_visit_only';
-- → 기대: '출장비만 처리 — task_items 재구성 + tasks UPDATE + payments 직접 INSERT (Migration 054)'
--
-- 2) 시드 visit work_type 존재 확인 (선행 의존):
-- SELECT wt.id, wt.code, wt.name, st.code AS service_code
-- FROM work_types wt
-- JOIN service_types st ON st.id = wt.service_type_id
-- WHERE wt.code = 'visit';
-- → 기대 1 row: code='visit', service_code='visit_fee', name='출장비'
--
-- 3) 시드 commission_policy 존재 확인 (참조용 / 함수는 호출 X):
-- SELECT policy_key, calc_method, engineer_base
-- FROM commission_policies
-- WHERE policy_key = 'common_visit_fee';
-- → 기대 1 row: calc_method='출장비_30K', engineer_base=30000
--
-- 4) 1건 실제 호출 검증 (테스트 작업 1건 측):
-- SELECT mark_visit_only(
--   '<task uuid>'::uuid,
--   'customer_absent',
--   '고객 부재 — 재방문 협의 중'
-- );
-- → 기대: {"ok": true, "task_id": "..."}
--
-- 5) 호출 후 payments 측 정상 row:
-- SELECT engineer_amount, principal_amount, owner_amount, calc_method, track
-- FROM payments
-- WHERE task_id = '<task uuid>';
-- → 기대: 30000 / 0 / 0 / 출장비_30K / A
--
-- 6) task_items 측 visit_fee row 단독 확인:
-- SELECT ti.qty, ti.unit_price, wt.code, wt.name
-- FROM task_items ti
-- JOIN work_types wt ON wt.id = ti.work_type_id
-- WHERE ti.task_id = '<task uuid>';
-- → 기대 1 row: qty=1, unit_price=30000, code='visit', name='출장비'
