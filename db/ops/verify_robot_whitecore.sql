-- ============================================================================
-- 검증 (읽기만 합니다. 아무것도 바꾸지 않습니다) - 블록 (83) 화이트코어 로봇청소기 받은 총금액 x 35%
-- 선행: mig 270 실행
-- 결과는 표 하나입니다: 경우 · 기대 · 실제 · 맞음
--   계산은 compute_payment 가 실제로 부르는 함수를 그대로 부릅니다
--     로봇청소기 = _robot_split (협력사 · 직영 같은 함수), 주방후드 = _hood_fixed_calc
--   비율은 DB 에 들어간 규칙에서 읽습니다 (규칙이 없으면 맞음 = false).
--   넘기기 확인은 넘기기 함수(mig 260)와 같은 조건(맡는 종목 표)을 종목 코드로 확인합니다.
-- ============================================================================
WITH wc AS (SELECT id FROM subcontractors WHERE code = 'whitecore' LIMIT 1),
wc_rule AS (
  SELECT f.fee_type, f.fee_rate, f.fee_amount, f.fee_base FROM fee_rules f, wc
   WHERE f.subcontractor_id = wc.id AND f.service_code = 'robot' AND f.principal_code IS NULL AND f.active
   ORDER BY f.effective_from DESC LIMIT 1
),
own_rule AS (
  SELECT fee_type, fee_rate, fee_amount FROM fee_rules
   WHERE subcontractor_id IS NULL AND service_code = 'robot' AND active
   ORDER BY effective_from DESC LIMIT 1
),
cases AS (
  SELECT * FROM (VALUES
    (1, '화이트코어 · 본체 + 도크스테이션 99,000',              99000,  64350, 34650),
    (2, '화이트코어 · 본체만 69,000',                            69000,  44850, 24150),
    (3, '화이트코어 · 99,000 + 현장 추가 20,000 = 119,000 받음', 119000, 77350, 41650)
  ) v(n, label, total, exp_wc, exp_fee)
),
can_take AS (
  -- 넘기기 확인 (mig 260 과 같은 조건): 맡는 종목 표에 화이트코어 줄이 있고 그 종목이 들어 있어야 통과
  SELECT c.code,
         (NOT EXISTS (SELECT 1 FROM subcontractor_categories sc WHERE sc.subcontractor_id = (SELECT id FROM wc))
          OR EXISTS (SELECT 1 FROM subcontractor_categories sc
                      WHERE sc.subcontractor_id = (SELECT id FROM wc) AND sc.category_id = c.id)) AS pass
    FROM categories c WHERE c.code IN ('robot', 'aircon', 'hood')
),
src AS (SELECT prosrc FROM pg_proc WHERE proname = 'compute_payment'),
rws AS (
  SELECT c.n AS ord, c.label,
         '화이트코어 ' || c.exp_wc || ' / 수수료 ' || c.exp_fee AS exp_txt,
         COALESCE('화이트코어 ' || (x ->> 'engineer') || ' / 수수료 ' || (x ->> 'fee'), '규칙 없음') AS act_txt,
         COALESCE((x ->> 'engineer')::int = c.exp_wc AND (x ->> 'fee')::int = c.exp_fee, false) AS ok
  FROM cases c
  LEFT JOIN wc_rule r ON true
  LEFT JOIN LATERAL (SELECT _robot_split(c.total, r.fee_type, r.fee_rate, r.fee_amount) AS x WHERE r.fee_type IS NOT NULL) s ON true
  UNION ALL
  SELECT 10, '화이트코어 x 로봇청소기 규칙: 받은 총금액 기준 35%', 'rate / 0.35 / gross',
         COALESCE((SELECT fee_type || ' / ' || fee_rate || ' / ' || fee_base FROM wc_rule), '없음'),
         COALESCE((SELECT fee_type = 'rate' AND fee_rate = 0.35 AND fee_base = 'gross' FROM wc_rule), false)
  UNION ALL
  SELECT 20, '넘기기: 로봇청소기 -> 화이트코어 통과', '통과',
         CASE WHEN (SELECT pass FROM can_take WHERE code = 'robot') THEN '통과' ELSE '거부' END,
         COALESCE((SELECT pass FROM can_take WHERE code = 'robot'), false)
  UNION ALL
  SELECT 21, '넘기기: 에어컨 세척 -> 화이트코어 거부', '거부',
         CASE WHEN (SELECT pass FROM can_take WHERE code = 'aircon') THEN '통과' ELSE '거부' END,
         COALESCE(NOT (SELECT pass FROM can_take WHERE code = 'aircon'), false)
  UNION ALL
  SELECT 22, '넘기기: 주방후드 -> 화이트코어 통과 (그대로)', '통과',
         CASE WHEN (SELECT pass FROM can_take WHERE code = 'hood') THEN '통과' ELSE '거부' END,
         COALESCE((SELECT pass FROM can_take WHERE code = 'hood'), false)
  UNION ALL
  SELECT 23, '넘기기 함수에 맡는 종목 확인이 그대로 있음 (mig 260)', 'true',
         (SELECT (position('Mig 260: 맡는 종목이 아니면' IN prosrc) > 0)::text FROM pg_proc WHERE proname = 'admin_assign_task_to_subcontractor'),
         COALESCE((SELECT position('Mig 260: 맡는 종목이 아니면' IN prosrc) > 0 FROM pg_proc WHERE proname = 'admin_assign_task_to_subcontractor'), false)
  UNION ALL
  -- 주방후드는 그대로: 협력사 289,000 (쿨가이 아닌 작업) -> 화이트코어 200,000 / 올데이케어 89,000
  SELECT 30, '주방후드 그대로: 화이트코어 289,000 견적대로', '화이트코어 200000 / 수수료 89000',
         '화이트코어 ' || (x ->> 'sub_share') || ' / 수수료 ' || (x ->> 'fee'),
         ((x ->> 'sub_share')::int = 200000 AND (x ->> 'fee')::int = 89000)
  FROM (SELECT _hood_fixed_calc('[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 101150, 0.35,
                                (SELECT id FROM wc), 'A', NULL::numeric, 289000, DATE '2026-10-24') AS x) h
  UNION ALL
  SELECT 31, '직영 로봇청소기 그대로: 99,000', '기사 64350 / 회사 34650',
         COALESCE('기사 ' || (x ->> 'engineer') || ' / 회사 ' || (x ->> 'fee'), '규칙 없음'),
         COALESCE((x ->> 'engineer')::int = 64350 AND (x ->> 'fee')::int = 34650, false)
  FROM (SELECT _robot_split(99000, r.fee_type, r.fee_rate, r.fee_amount) AS x FROM own_rule r) d
  UNION ALL
  SELECT 32, '직영 로봇청소기 규칙 그대로 1줄', '1', (SELECT count(*)::text FROM own_rule), (SELECT count(*) = 1 FROM own_rule)
  UNION ALL
  -- compute_payment: 새 조각 1곳 + 직영 로봇청소기 분기 · 주방후드 분기 · 후드 정액(2곳) · 예상 공급가 그대로
  SELECT 40, 'compute_payment: 협력사 로봇청소기 조각 1곳 · 다른 분기 그대로', 'true',
         ((length(prosrc) - length(replace(prosrc, 'Mig 270 - 협력사 로봇청소기 분기', ''))) / length('Mig 270 - 협력사 로봇청소기 분기') = 1
          AND (length(prosrc) - length(replace(prosrc, 'Mig 268 - 직영 로봇청소기 분기', ''))) / length('Mig 268 - 직영 로봇청소기 분기') = 1
          AND (length(prosrc) - length(replace(prosrc, '_hood_fixed_calc(', ''))) / length('_hood_fixed_calc(') = 2
          AND (length(prosrc) - length(replace(prosrc, '_robot_split(', ''))) / length('_robot_split(') = 2
          AND position('Mig 256 - 직영 주방후드 분기' IN prosrc) > 0
          AND position('_sub_supply_estimate(' IN prosrc) > 0)::text,
         ((length(prosrc) - length(replace(prosrc, 'Mig 270 - 협력사 로봇청소기 분기', ''))) / length('Mig 270 - 협력사 로봇청소기 분기') = 1
          AND (length(prosrc) - length(replace(prosrc, 'Mig 268 - 직영 로봇청소기 분기', ''))) / length('Mig 268 - 직영 로봇청소기 분기') = 1
          AND (length(prosrc) - length(replace(prosrc, '_hood_fixed_calc(', ''))) / length('_hood_fixed_calc(') = 2
          AND (length(prosrc) - length(replace(prosrc, '_robot_split(', ''))) / length('_robot_split(') = 2
          AND position('Mig 256 - 직영 주방후드 분기' IN prosrc) > 0
          AND position('_sub_supply_estimate(' IN prosrc) > 0)
  FROM src
)
SELECT label AS "경우", exp_txt AS "기대", act_txt AS "실제", ok AS "맞음"
FROM (
  SELECT * FROM rws
  UNION ALL
  SELECT 999, '전체', '전부 true', CASE WHEN bool_and(COALESCE(ok, false)) THEN '전부 true' ELSE '틀린 줄 있음' END, bool_and(COALESCE(ok, false)) FROM rws
) z ORDER BY ord;
