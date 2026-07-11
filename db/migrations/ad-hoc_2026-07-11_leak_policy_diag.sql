-- ============================================================================
-- ad-hoc 2026-07-11 — 누설 정책 진단 + KA leak 1way NULL 사고 (A-260711-032)
-- 사장님 리포트:
--   완료 작업 A-260711-032, 작업금액 250,000, 종목=누설/누수, 기종=1way ×2,
--   원청=KA, 기사=김병철. payments 분배 (기사/원청/회사) 전부 NULL.
--
-- 원인 추정:
--   · commission_policies 에 (KA, leak, 1way) row 없음.
--   · calculate_commission → policy_not_found → compute_payment → RAISE EXCEPTION.
--   · task_items_compute_trg / compute_payment_trg 안 EXCEPTION WHEN OTHERS 로 swallow.
--   · payments row 아예 생성 안 됨 → UI '분배 없음'.
--
-- 실행 흐름:
--   [A] 진단 SELECT — 현재 leak 정책 + 실패 task 확인.
--   [B] 사장님 결과 리포트 → 정책 INSERT SQL 조율 (기종 무관 vs per-기종).
--   [C] INSERT + 재계산 (별 파일).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- [A-1] 현재 존재하는 leak 정책 (원청·기종·계산방법)
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  principal_code,
  service_code,
  appliance_code,
  calc_method,
  engineer_base,
  fee_rate,
  principal_fee,
  policy_key,
  qty_condition
FROM commission_policies
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND service_code = 'leak'
ORDER BY principal_code, appliance_code;
-- 기대: 있으면 원청별 몇 row, 없으면 0 row.
-- 없다면 → leak 정책 seed 전무 → 어떤 leak task 든 payment 사고.


-- ─────────────────────────────────────────────────────────────────────────
-- [A-2] 실패 task 상세 — A-260711-032 및 관련
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  t.task_no,
  t.status,
  t.product_price,
  t.extra_fee,
  t.travel_fee,
  pr.code   AS principal_code,
  u.name    AS engineer_name,
  u.refrigerant_rate,
  COALESCE(p.engineer_amount,  0) AS engineer_amount,
  COALESCE(p.principal_amount, 0) AS principal_amount,
  COALESCE(p.owner_amount,     0) AS owner_amount,
  p.calc_method,
  p.policy_key,
  p.track
FROM tasks t
LEFT JOIN principals pr ON pr.id = t.principal_id
LEFT JOIN users u       ON u.id  = t.assigned_engineer_id
LEFT JOIN payments p    ON p.task_id = t.id
WHERE t.task_no = 'A-260711-032';


-- ─────────────────────────────────────────────────────────────────────────
-- [A-3] task_items — 종목·기종 code 확인 (compute_payment 조회 값)
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  ti.id,
  ti.qty,
  ti.unit_price,
  ti.subtotal,
  ti.is_canceled,
  st.code AS service_code,
  st.name AS service_name,
  at.code AS appliance_code,
  at.name AS appliance_name,
  wt.name AS work_type_name
FROM task_items ti
LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
LEFT JOIN service_types st   ON st.id = wt.service_type_id
LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
WHERE ti.task_id = (SELECT id FROM tasks WHERE task_no = 'A-260711-032');
-- 기대: service_code='leak' (또는 'refrigerant'?) / appliance_code='1way' (또는 다른 값?).
-- 사장님: 여기 반환값 그대로 저에게 알려주세요. calculate_commission 조회 key.


-- ─────────────────────────────────────────────────────────────────────────
-- [A-4] appliance_types.code 실제 값 (Mig 004 seed vs 라이브)
-- ─────────────────────────────────────────────────────────────────────────
SELECT code, name
FROM appliance_types
ORDER BY code;
-- 기대: code = 'wall'/'1way'/'stand'/... OR '벽걸이'/'1way'/'스탠드'/...
-- 사장님: 이 결과도 저에게 알려주세요. compute_payment 조회 key 확정용.


-- ─────────────────────────────────────────────────────────────────────────
-- [A-5] 스캔 — 완료 상태인데 payments NULL 인 작업 (leak 등 정책없는 조합)
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  t.task_no,
  t.status,
  t.completed_at::date AS completed_date,
  pr.code AS principal_code,
  t.product_price,
  u.name  AS engineer_name,
  CASE WHEN p.id IS NULL THEN 'NO_PAYMENT' ELSE 'HAS_PAYMENT' END AS payment_state,
  p.engineer_amount,
  p.principal_amount,
  p.owner_amount
FROM tasks t
LEFT JOIN principals pr ON pr.id = t.principal_id
LEFT JOIN users u       ON u.id  = t.assigned_engineer_id
LEFT JOIN payments p    ON p.task_id = t.id
WHERE t.status = '완료'
  AND (
    p.id IS NULL                                               -- payments row 자체 없음
    OR (p.engineer_amount IS NULL AND p.principal_amount IS NULL)  -- 있어도 amount 전부 NULL
  )
ORDER BY t.completed_at DESC
LIMIT 100;
-- 사장님: 이 결과의 건수 저에게 알려주세요. 스캔 대상 규모 파악.


-- ─────────────────────────────────────────────────────────────────────────
-- [A-6] 참고 — KA refrigerant 정책 (leak 정책 만들 때 rate 참조용)
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  principal_code,
  service_code,
  appliance_code,
  calc_method,
  engineer_base,
  fee_rate,
  qty_condition,
  policy_key
FROM commission_policies
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND principal_code = 'KA'
  AND service_code = 'refrigerant'
ORDER BY appliance_code, qty_condition NULLS FIRST;
-- 참고: leak 정책을 refrigerant 와 동일 rate/base 로 seed 하는 경우 사용.


-- ============================================================================
-- 사장님 다음 단계:
--   [A-1] ~ [A-6] 결과 저에게 요약 (핵심: leak 정책 존재 여부, task_item 의 실제
--   service_code / appliance_code, 스캔 건수).
--   → 이후 실제 INSERT SQL (별도 파일) + Mig 173 (compute error 가시화) 진행.
-- ============================================================================
