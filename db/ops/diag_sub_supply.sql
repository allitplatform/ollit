-- ============================================================================
-- 확인 (읽기만 합니다) - 협력사 미완료 작업의 "받은 금액 합계 · 공급가" 칸 상태 - 블록 (80)
--   왜 예상 수수료가 "견적 / 1.1" 기준으로 계산됐는지 확인하는 표입니다. 결과 표 하나.
--
-- 칸
--   작업번호 · 고객 · 상태
--   견적(작업)            = 작업의 견적 + 추가금 + 출장비
--   항목 견적 합          = 취소 안 된 항목의 수량 x 단가 합
--   받은 금액 합계 칸     = tasks.received_total
--   합계 = 항목 견적 합   = true 면 "사람이 입력한 값이 아니라 항목 저장 때 견적 합으로 자동으로 채워진 값"
--   항목에 받은 돈 적힌 줄 = 항목 줄 가운데 받은 돈이 적힌 줄 수 (0 이면 아무도 입력하지 않음)
--   공급가 칸             = tasks.supply_amount (협력사 쪽 받은 금액 입력 함수만 채운다. 비어 있으면 입력 전)
--   부가세 포함 칸         = tasks.vat_included
--   받은 금액 입력함       = 공급가 칸 > 0
--   저장된 수수료 · 계산에 쓰인 합계 = 지금 payments 값
--   수수료 ÷ 합계          = 0.35 면 견적 기준, 0.318 근처면 "견적 / 1.1" 기준으로 계산된 것
--
-- 읽는 법 (블록 80 의 추정이 맞다면)
--   A-261008-007 · A-261010-001 · A-261008-006 줄에서
--   "합계 = 항목 견적 합" = true · "항목에 받은 돈 적힌 줄" = 0 · "공급가 칸" 비어 있음 · "받은 금액 입력함" = false
--   -> 받은 금액을 입력한 적이 없는데 합계 칸이 견적으로 채워져 있어서, mig 265 가 "옛 작업(/ 1.1)" 쪽으로 계산한 것.
--   받은 금액 입력 시각을 따로 적는 칸은 없습니다 (공급가 칸이 채워졌는지로만 알 수 있습니다).
-- ============================================================================
SELECT t.task_no AS "작업번호",
       t.customer_name AS "고객",
       t.status AS "상태",
       COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0) + COALESCE(t.travel_fee, 0) AS "견적(작업)",
       i.quote_sum AS "항목 견적 합",
       t.received_total AS "받은 금액 합계 칸",
       (t.received_total IS NOT DISTINCT FROM i.quote_sum) AS "합계 = 항목 견적 합",
       i.received_lines AS "항목에 받은 돈 적힌 줄",
       t.supply_amount AS "공급가 칸",
       t.vat_included AS "부가세 포함 칸",
       (COALESCE(t.supply_amount, 0) > 0) AS "받은 금액 입력함",
       p.owner_amount AS "저장된 수수료",
       p.product_price AS "계산에 쓰인 합계",
       CASE WHEN COALESCE(p.product_price, 0) > 0 THEN ROUND(p.owner_amount::numeric / p.product_price, 3) END AS "수수료 ÷ 합계",
       p.track || ':' || COALESCE(p.calc_method, '-') AS "계산 종류"
FROM tasks t
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(COALESCE(ti.qty, 1) * COALESCE(ti.unit_price, 0)), 0)::int AS quote_sum,
         count(*) FILTER (WHERE ti.received_amount IS NOT NULL)::int AS received_lines
    FROM task_items ti
   WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)
) i ON true
LEFT JOIN LATERAL (
  SELECT * FROM payments p WHERE p.task_id = t.id ORDER BY (p.track = 'S') DESC LIMIT 1
) p ON true
WHERE t.subcontractor_id IS NOT NULL
  AND t.status NOT IN ('완료', '정산완료', '취소', '취소요청', 'visit_only')
ORDER BY t.created_at DESC
LIMIT 50;
