-- ============================================================================
-- Migration 072 — 백필 — 기존 qty=0 항목을 is_canceled=true 로 정정
-- 작성: 2026-05-25
-- 상태: 초안 (사장님 검토 대기 — 적용 X)
-- ============================================================================
-- 배경:
--   070 적용 전까지 부분완료는 task_items.qty=0 으로 취소 품목을 표현.
--   070 적용 후 spec — 'qty 원본 보존 + is_canceled=true'.
--   기존 데이터를 새 모델로 정정.
--
-- 현재 백필 대상 (2026-05-25 진단 결과):
--   · qty=0 행: 1건 (YS-260517-079 / 안효정 / 4way)
--   · 다른 원청 정상 task 측 영향 0
--
-- 백필 처리:
--   1) task_items.qty=0 행 → is_canceled=true / canceled_reason='backfill_qty0'
--   2) qty 원본 복구 — partial_memo "주문 N→실제 0" 측 N 측 회귀.
--      memo 측 파싱 불가 시 qty=1 기본값 (안효정 case: "4way 주문1→실제0" → qty=1).
--      ⚠️ 자동 파싱 위험 — 사장님이 안효정 task 측 qty 원본 직접 확인 후 적용 spec.
--   3) customer_paid_amount / net_amount: 070 BEFORE 트리거가 metadata 백업 +
--      0 강제 자동 수행. 백필 시 트리거 자동 발화.
--   4) tasks.product_price: 070 AFTER 트리거가 자동 재합산 — 결과적으로 변동 0
--      (qty=0 시점에도 이미 SUM 0 기여, qty=1 + is_canceled=true 도 subtotal 0).
--      단 백필 직전 시점의 product_price 는 옛 값(예: 188,498) 유지 — UPDATE 트리거
--      가 SUM(미취소 subtotal) = 69,412 로 재설정.
--   5) 검증 후 compute_payment(task_id) 명시 호출 — payments 재계산.
--
-- 의존:
--   - 070 적용 완료 (컬럼 + 트리거 존재)
--   - 071 적용 완료 (compute_payment v15 측 미취소 필터)
--
-- 안전:
--   - 트랜잭션 — ROLLBACK 가능
--   - WHERE qty = 0 + 사장님이 확인한 task_no 측 매칭 (오타로 다른 행 catch X)
--   - 본 마이그 측 직접 변경 = task_items 행 1건 (안효정 4way). 다른 행 X.
--
-- 실행 spec (070 + 071 적용 + 안효정 task qty 원본 확인 후):
-- ============================================================================

BEGIN;

-- ============================================
-- [백필 1] 안효정 4way item — qty=0 → qty=1 + is_canceled=true
-- ============================================
-- 사전 확인:
--   SELECT ti.id, ti.qty, ti.unit_price, ti.subtotal, ti.customer_paid_amount, ti.net_amount,
--          wt.code AS work_code, at.name AS appliance_name
--   FROM task_items ti
--   LEFT JOIN work_types wt ON wt.id = ti.work_type_id
--   LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
--   WHERE ti.task_id = (SELECT id FROM tasks WHERE task_no='YS-260517-079');
-- 기대 1 row: work=clean_4way / appliance=4way / qty=0 / unit_price=119086 /
--   subtotal=0 / customer_paid_amount=126100 / net_amount=119086.

UPDATE task_items
SET
  qty             = 1,                    -- 원본 의뢰 수량 복구
  is_canceled     = true,
  canceled_reason = 'backfill_qty0',
  canceled_at     = (SELECT updated_at FROM tasks WHERE task_no='YS-260517-079')
WHERE task_id = (SELECT id FROM tasks WHERE task_no='YS-260517-079')
  AND qty       = 0
  AND unit_price = 119086;   -- 4way 단가 식별자 (오정정 가드)
-- 기대: 1 row updated. trigger task_items_partial_sync_before_trg 자동 발화 →
--   customer_paid_amount=0 / net_amount=0 / metadata._pre_cancel_paid=126100 /
--   metadata._pre_cancel_net=119086.
-- trigger task_items_resync_task_total_trg 자동 발화 → tasks.product_price = 69412.

-- ============================================
-- [백필 2] payments 재계산 — 071 v15 로직 측 미취소만 합산
-- ============================================
SELECT compute_payment(id)
FROM tasks
WHERE task_no = 'YS-260517-079';
-- 기대: payments 측 product_price/engineer_amount 동일 (이미 v14 측 정확). 단 v15 의
--   로직 측 명시적 미취소 필터 효과로 데이터 정합성 확보.

-- ============================================
-- [검증 — COMMIT 전]
-- ============================================
-- A. task_items 측 확인:
-- SELECT id, qty, is_canceled, canceled_reason, subtotal,
--        customer_paid_amount, net_amount, metadata
-- FROM task_items
-- WHERE task_id = (SELECT id FROM tasks WHERE task_no='YS-260517-079');
-- 기대 2 row:
--   · 벽걸이 (clean_wall): qty=1 / is_canceled=false / subtotal=69412 /
--     customer_paid=73500 / net=69412
--   · 4way   (clean_4way): qty=1 / is_canceled=true / subtotal=0 /
--     customer_paid=0 / net=0 / metadata._pre_cancel_paid=126100 / _pre_cancel_net=119086
--
-- B. tasks 측 확인:
-- SELECT task_no, status, product_price, total_amount, partial_reason, partial_memo
-- FROM tasks WHERE task_no='YS-260517-079';
-- 기대: product_price=69412 / total_amount=69412 / partial_reason=device_bad 유지.
--
-- C. payments 측 확인:
-- SELECT product_price, engineer_amount, principal_amount, owner_amount, calc_method, track
-- FROM payments WHERE task_id = (SELECT id FROM tasks WHERE task_no='YS-260517-079');
-- 기대: product_price=69412 / engineer_amount=44000 / track=B (변경 0 — 이미 정확).
--
-- 검증 통과 → COMMIT
-- 검증 실패 → ROLLBACK
COMMIT;

-- ============================================
-- 회귀 검증 (별도 실행 — 측 6 원청 정상 task 영향 0 확인)
-- ============================================
-- SELECT COUNT(*) FILTER (WHERE is_canceled = true) AS canceled_items,
--        COUNT(*)                                   AS total_items
-- FROM task_items;
-- 기대: canceled_items=1 / total_items 측 변동 0.
