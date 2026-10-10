-- ============================================================================
-- 검증 (읽기만 합니다. 아무것도 바꾸지 않습니다) - 블록 (77)(78) 업소용 후드 정액 · 보장
-- 선행: mig 264, 265, 267 실행
-- 결과는 표 하나입니다: 경우 · 기대 · 실제 · 맞음 · 올데이케어 몫 음수 아님
--   기대 / 실제 = "화이트코어(또는 직영 기사) 몫 / 쿨가이 몫 / 올데이케어 몫"
--   계산은 compute_payment 가 실제로 부르는 함수(_hood_fixed_calc)를 그대로 부릅니다.
--   수수료율 35% · 쿨가이 몫 율 35% 를 넣었습니다. 직영 줄은 협력사 보장 없이(협력사 = 없음) 계산합니다.
--   규칙 시작일은 2026-10-01 (mig 265). 그 전 날짜는 옛 식입니다.
-- ============================================================================
WITH wc AS (SELECT id FROM subcontractors WHERE code = 'whitecore' LIMIT 1),
cases AS (
  SELECT * FROM (VALUES
    (1, '협력사 · 289,000 견적대로 (쿨가이)', true,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 'KB', 0.35::numeric, 289000, DATE '2026-10-10', 200000, 85000, 4000),
    (2, '협력사 · 198,000 견적대로 (쿨가이)', true,
        '[{"code":"hood_commercial_s","qty":1,"unit_price":198000}]'::jsonb, 198000, 'KB', 0.35::numeric, 198000, DATE '2026-10-10', 128700, 65000, 4300),
    (3, '협력사 · 289,000 + 자바라 30,000 (쿨가이)', true,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000},{"code":"hood_option_duct","qty":1,"unit_price":30000}]'::jsonb, 319000, 'KB', 0.35::numeric, 319000, DATE '2026-10-10', 219500, 95500, 4000),
    (4, '협력사 · 289,000 을 250,000 으로 할인 (쿨가이) - 보장 없음', true,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 250000, 'KB', 0.35::numeric, 289000, DATE '2026-10-10', 162500, 85000, 2500),
    (5, '협력사 · 289,000 견적 · 500,000 받음 (공급가 454,545, 쿨가이)', true,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 454545, 'KB', 0.35::numeric, 289000, DATE '2026-10-10', 295454, 85000, 74091),
    (6, '협력사 · 쿨가이 아닌 작업 289,000', true,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 'A', NULL::numeric, 289000, DATE '2026-10-10', 200000, 0, 89000),
    (7, '협력사 · 10/9 완료 289,000 (쿨가이) - 시작일을 당겨 새 규칙', true,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 'KB', 0.35::numeric, 289000, DATE '2026-10-09', 200000, 85000, 4000),
    (8, '협력사 · 289,000 x 2대 578,000 (쿨가이)', true,
        '[{"code":"hood_commercial_m","qty":2,"unit_price":289000}]'::jsonb, 578000, 'KB', 0.35::numeric, 578000, DATE '2026-10-10', 400000, 170000, 8000),
    (9, '협력사 · 10/7 완료 289,000 견적 · 500,000 받음 (K-261007-002 와 같은 모양)', true,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 454545, 'KB', 0.35::numeric, 289000, DATE '2026-10-07', 295454, 85000, 74091),
    (11, '직영 기사 · 289,000 견적대로 (쿨가이)', false,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 'KB', 0.35::numeric, 289000, DATE '2026-10-10', 187850, 85000, 16150),
    (12, '직영 기사 · 198,000 견적대로 (쿨가이)', false,
        '[{"code":"hood_commercial_s","qty":1,"unit_price":198000}]'::jsonb, 198000, 'KB', 0.35::numeric, 198000, DATE '2026-10-10', 128700, 65000, 4300),
    (13, '직영 기사 · 시작일 전(9/30) 완료 289,000 (쿨가이) - 옛 식', false,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 'KB', 0.35::numeric, 289000, DATE '2026-09-30', 187850, 101150, 0),
    (14, '직영 기사 · 쿨가이 아닌 작업 289,000 - 원청 몫 0', false,
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 'A', NULL::numeric, 289000, DATE '2026-10-10', 187850, 0, 101150),
    (15, '직영 기사 · 가정용 기본형 100,000 (쿨가이) - 정액 없는 줄은 견적 x 35%', false,
        '[{"code":"hood_home_basic","qty":1,"unit_price":100000}]'::jsonb, 100000, 'KB', 0.35::numeric, 100000, DATE '2026-10-10', 65000, 35000, 0)
  ) v(n, label, is_sub, lines, supply, pcode, prate, quote, d, exp_wc, exp_kb, exp_ad)
),
calc AS (
  SELECT c.*,
         _hood_fixed_calc(c.lines, c.supply, ROUND(c.supply * 0.35)::int,
                          CASE WHEN c.is_sub THEN 0.35 END,
                          CASE WHEN c.is_sub THEN (SELECT id FROM wc) END,
                          c.pcode, c.prate, c.quote, c.d) AS r
  FROM cases c
),
src AS (
  SELECT prosrc,
         (length(prosrc) - length(replace(prosrc, '_hood_fixed_calc(', ''))) / length('_hood_fixed_calc(') AS calls
  FROM pg_proc WHERE proname = 'compute_payment'
),
rws AS (
  SELECT n AS ord, label,
         exp_wc || ' / ' || exp_kb || ' / ' || exp_ad AS exp_txt,
         (r ->> 'sub_share') || ' / ' || (r ->> 'kb_any') || ' / ' || ((r ->> 'fee')::int - (r ->> 'kb_any')::int) AS act_txt,
         ((r ->> 'sub_share')::int = exp_wc AND (r ->> 'kb_any')::int = exp_kb
           AND (r ->> 'fee')::int - (r ->> 'kb_any')::int = exp_ad) AS ok,
         ((r ->> 'fee')::int - (r ->> 'kb_any')::int >= 0) AS not_negative
  FROM calc
  UNION ALL
  SELECT 90, 'compute_payment 가 계산 함수를 부르는 곳 = 2 (협력사 분기 1 + 직영 주방후드 분기 1)', '2', calls::text, (calls = 2), true FROM src
  UNION ALL
  SELECT 91, '규칙 3줄 · 시작일 2026-10-01', '2 / 1 / 2026-10-01',
         (SELECT count(*) FILTER (WHERE kind = 'principal_fixed') || ' / ' || count(*) FILTER (WHERE kind = 'sub_guarantee') || ' / ' || max(effective_from) FROM hood_fixed_rules WHERE active),
         (SELECT count(*) FILTER (WHERE kind = 'principal_fixed') = 2 AND count(*) FILTER (WHERE kind = 'sub_guarantee') = 1
                 AND min(effective_from) = DATE '2026-10-01' AND max(effective_from) = DATE '2026-10-01' FROM hood_fixed_rules WHERE active),
         true
  UNION ALL
  SELECT 92, 'compute_payment 가 예상 공급가 함수를 씀 (mig 267)', 'true',
         (position('_sub_supply_estimate(' IN prosrc) > 0)::text, (position('_sub_supply_estimate(' IN prosrc) > 0), true FROM src
  UNION ALL
  -- 블록 (80): 예상 공급가 함수 -> 계산 함수까지 이어서 확인 (받은 금액 합계 칸이 견적으로 채워져 있어도 공급가 = 견적)
  SELECT 20 + e.n, e.label, e.exp_txt,
         (e.r ->> 'sub_share') || ' / ' || (e.r ->> 'kb_any') || ' / ' || ((e.r ->> 'fee')::int - (e.r ->> 'kb_any')::int),
         ((e.r ->> 'sub_share') || ' / ' || (e.r ->> 'kb_any') || ' / ' || ((e.r ->> 'fee')::int - (e.r ->> 'kb_any')::int)) = e.exp_txt,
         ((e.r ->> 'fee')::int - (e.r ->> 'kb_any')::int >= 0)
  FROM (
    SELECT v.n, v.label, v.exp_txt,
           _hood_fixed_calc(v.lines, est.s, ROUND(est.s * 0.35)::int, 0.35, (SELECT id FROM wc), 'A', NULL, v.total, DATE '2026-10-10') AS r
    FROM (VALUES
      (1, '미완료 협력사 289,000 (받은 금액 입력 전 · 합계 칸은 견적으로 채워짐)',
          '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, '확정', NULL::timestamptz, '200000 / 0 / 89000'),
      (2, '미완료 협력사 198,000 x 2줄 = 396,000 (받은 금액 입력 전)',
          '[{"code":"hood_commercial_s","qty":1,"unit_price":198000},{"code":"hood_commercial_s","qty":1,"unit_price":198000}]'::jsonb, 396000, '배정', NULL::timestamptz, '257400 / 0 / 138600'),
      (3, '받은 금액 입력 없이 10/12 에 완료 처리된 협력사 289,000 - / 1.1 로 가지 않음',
          '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, '완료', '2026-10-12 12:00:00+09'::timestamptz, '200000 / 0 / 89000')
    ) v(n, label, lines, total, status, done_at, exp_txt)
    CROSS JOIN LATERAL (SELECT _sub_supply_estimate(NULL, v.total, v.status, v.done_at) AS s) est
  ) e
  UNION ALL
  SELECT 24, '예상 공급가: 받은 금액을 입력한 작업은 입력한 공급가 그대로', '454545',
         _sub_supply_estimate(454545, 500000, '완료', '2026-10-08 12:00:00+09')::text,
         _sub_supply_estimate(454545, 500000, '완료', '2026-10-08 12:00:00+09') = 454545, true
  UNION ALL
  SELECT 25, '예상 공급가: 옛 완료 작업(10/10 전 완료 · 공급가 칸 비어 있음)은 전처럼 합계 / 1.1', '454545',
         _sub_supply_estimate(NULL, 500000, '완료', '2026-10-08 12:00:00+09')::text,
         _sub_supply_estimate(NULL, 500000, '완료', '2026-10-08 12:00:00+09') = 454545, true
)
SELECT label AS "경우", exp_txt AS "기대 (수행 몫 / 쿨가이 / 올데이케어)", act_txt AS "실제", ok AS "맞음", not_negative AS "올데이케어 몫 음수 아님"
FROM (
  SELECT * FROM rws
  UNION ALL
  SELECT 999, '전체', '전부 true', CASE WHEN bool_and(ok AND not_negative) THEN '전부 true' ELSE '틀린 줄 있음' END,
         bool_and(ok), bool_and(not_negative)
  FROM rws
) z ORDER BY ord;
