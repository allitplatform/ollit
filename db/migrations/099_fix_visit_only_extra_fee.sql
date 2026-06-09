-- 099_fix_visit_only_extra_fee.sql
-- 2026-06-09 — visit_only task 의 extra_fee=30000 이중 stamp 사고 정정.
--
-- 증상:
--   매출 현황 대시보드 "기타" 버킷이 출장비 1건당 30k 가 아닌 60k 로 부풀려 표시.
--   진단: 일부 visit_only task 에 tasks.extra_fee=30000 AND tasks.travel_fee=30000 (둘 다 30k)
--         → total_amount = product_price(0) + extra_fee(30000) + travel_fee(30000) = 60000.
--   실제 출장비는 30k 1회. 본금액이 두 필드에 중복 stamp 된 상태.
--
-- 원인 (가설):
--   Mig 054 (2026-05-22) 가 mark_visit_only RPC 본문에서 extra_fee=0 으로 정의했으나,
--   운영 DB 측 RPC 가 옛 버전 또는 미적용 상태일 가능성.
--   또는 Mig 054 이전 옛 클라 흐름 (EngineerTaskDetailScreen.handleVisitOnly:
--   onUpdate({extraFee:30000})) 으로 만들어진 잔존 task 가 있음.
--
-- 정책 (Mig 054 + Mig 048 기준):
--   출장비 30,000원 = travel_fee 만에 stamp. extra_fee = 0.
--   travel_fee 는 Mig 048 측 기사 100% — visit_only 측 정합 (출장비 = 기사 100%).
--   extra_fee 는 정책상 cleaning_extra 등 별도 분기 사용 — visit_only 측 0.
--
-- 실행 순서 (사장님 직접):
--   [STEP 1] 진단 SELECT → 현재 visit_only task 의 extra/travel/total 상태 + 진짜 추가금 섞인 건 식별
--   [STEP 2] 결과 검토 — 의심 행 (extra_fee > 30000 또는 travel_fee != 30000) 수동 처리 필요
--   [STEP 3] mark_visit_only RPC 재정의 (CREATE OR REPLACE — 신규 visit_only 정합 보장)
--   [STEP 4] 백필 UPDATE — extra_fee=30000 AND travel_fee=30000 AND product_price=0 인 task → extra_fee=0
--   [STEP 5] 백필 verify SELECT — total_amount 가 30000 으로 정정됐는지 확인
--
-- 무손상:
--   냉매 외 task 의 extra_fee (현장 추가금) — 0 영향. visit_only task 만 정정.
--   payments / compute_payment / 다른 RPC — 0 영향.

-- ============================================
-- [STEP 1] 진단 SELECT (사장님 별도 실행 — 결과 캡처 후 검토)
-- ============================================
-- 1-A) 전체 visit_only task 의 금액 상태 분포
--
-- SELECT
--   t.id, t.task_no, t.customer_name,
--   (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS completed_kst,
--   t.product_price, t.extra_fee, t.travel_fee, t.total_amount,
--   CASE
--     WHEN t.extra_fee = 30000 AND t.travel_fee = 30000 AND t.product_price = 0
--       THEN 'DUPLICATE_30K (백필 대상)'
--     WHEN t.extra_fee = 0     AND t.travel_fee = 30000 AND t.product_price = 0
--       THEN 'CLEAN (Mig 054 정합)'
--     WHEN t.extra_fee > 30000
--       THEN 'EXTRA_BEYOND_30K (수동 검토 — 진짜 추가금 섞임)'
--     ELSE 'OTHER (수동 검토)'
--   END AS classification
-- FROM tasks t
-- WHERE t.status = 'visit_only'
--   AND t.tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
-- ORDER BY t.completed_at DESC NULLS LAST;
--
-- 기대 분포:
--   DUPLICATE_30K — Mig 054 미적용 또는 옛 흐름 측 만든 task. 백필 대상.
--   CLEAN — Mig 054 정합 task. 손대지 않음.
--   EXTRA_BEYOND_30K — 진짜 현장 추가금 섞임. 사장님 수동 검토.
--   OTHER — 비정상. 사장님 수동 검토.

-- 1-B) 백필 안전성 검증 — DUPLICATE_30K 분류의 정확한 건수 + 총 금액 변동 예상
--
-- SELECT
--   COUNT(*) AS task_cnt,
--   SUM(t.total_amount) AS sum_total_before,
--   SUM(t.product_price + 0 + t.travel_fee) AS sum_total_after_backfill,
--   SUM(t.total_amount) - SUM(t.product_price + 0 + t.travel_fee) AS sum_delta
-- FROM tasks t
-- WHERE t.status = 'visit_only'
--   AND t.tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
--   AND t.extra_fee = 30000
--   AND t.travel_fee = 30000
--   AND t.product_price = 0;
--
-- 기대: sum_delta = task_cnt × 30000. 매출 부풀림 총액과 일치해야.

-- ============================================
-- [STEP 3] mark_visit_only RPC 재정의 (Mig 054 본문 동일 — CREATE OR REPLACE)
--   목적: 신규 visit_only 호출 측 extra_fee=0, travel_fee=30000 정합 보장.
--   변경 0 — 본문 그대로 (운영 DB 측 RPC 동기화 목적).
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
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업 없음');
  END IF;

  SELECT id INTO v_visit_wt_id
    FROM work_types
    WHERE code = 'visit'
    LIMIT 1;
  IF v_visit_wt_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'visit work_type 시드 누락');
  END IF;

  DELETE FROM task_items WHERE task_id = p_task_id;

  INSERT INTO task_items (task_id, work_type_id, appliance_type_id, qty, unit_price)
  VALUES (p_task_id, v_visit_wt_id, NULL, 1, 30000);

  UPDATE tasks SET
    status        = 'visit_only',
    product_price = 0,
    extra_fee     = 0,          -- ★ 핵심: extra_fee 는 0. 본금액은 travel_fee 만에 stamp.
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
  '출장비만 처리 — task_items 재구성 + tasks UPDATE + payments 직접 INSERT (Mig 054 / 099 재적용)';

COMMIT;

-- ============================================
-- [STEP 4] 백필 UPDATE — DUPLICATE_30K 분류 task 의 extra_fee 정정
--   ⚠ 사장님 STEP 1-A 결과 검토 후 별도 실행. 본 SQL 은 commented 상태.
--   조건: status='visit_only' AND extra_fee=30000 AND travel_fee=30000 AND product_price=0
--   변경: extra_fee = 0. total_amount (GENERATED) 자동 30000 으로 정정.
--   payments 측 product_price/extra_fee 동기화 — 본 백필 후 별도 (대부분 payments 측 이미 정합).
-- ============================================
--
-- BEGIN;
--
-- UPDATE tasks
-- SET extra_fee  = 0,
--     updated_at = NOW()
-- WHERE status   = 'visit_only'
--   AND tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
--   AND extra_fee = 30000
--   AND travel_fee = 30000
--   AND product_price = 0;
--
-- -- payments 측 extra_fee 동기화 (해당 task 들만 — 안전)
-- UPDATE payments p
-- SET extra_fee = 0
-- FROM tasks t
-- WHERE p.task_id = t.id
--   AND t.status = 'visit_only'
--   AND t.tenant_id = '11111111-1111-1111-1111-111111111111'::uuid
--   AND t.extra_fee = 0
--   AND t.travel_fee = 30000
--   AND p.extra_fee = 30000;
--
-- COMMIT;

-- ============================================
-- [STEP 5] 백필 verify SELECT (백필 후 실행)
-- ============================================
--
-- SELECT
--   COUNT(*) AS visit_total_cnt,
--   COUNT(*) FILTER (WHERE total_amount = 30000) AS clean_cnt,
--   COUNT(*) FILTER (WHERE total_amount != 30000) AS dirty_cnt,
--   SUM(total_amount) FILTER (WHERE total_amount = 30000) AS clean_sum,
--   SUM(total_amount) FILTER (WHERE total_amount != 30000) AS dirty_sum
-- FROM tasks
-- WHERE status = 'visit_only'
--   AND tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
--
-- 기대: clean_cnt = visit_total_cnt - (EXTRA_BEYOND_30K 등 수동 검토 행). dirty_cnt = 수동 검토 행만 남음.

-- ============================================
-- 롤백 (위급 시):
--   원본 tasks.extra_fee 복구 — Mig 099 적용 전 백업 필요 시 사장님 별도 SQL.
--   본 마이그 측 자동 롤백 안 함. 백필 직전 사장님 직접 백업 권장:
--     CREATE TABLE backup_visit_only_fix_260609 AS
--     SELECT id, extra_fee, travel_fee, total_amount FROM tasks WHERE status='visit_only';
-- ============================================
