-- ============================================================================
-- 검증 (읽기만 합니다. 아무것도 바꾸지 않습니다) - 블록 (77)(78) 업소용 후드 정액 · 보장
-- 선행: mig 264, 265 실행
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
  SELECT 92, '협력사 작업 완료 전 예상 공급가 = 견적 그대로 (mig 265 조각이 들어 있음)', 'true',
         (position('Mig 265 - 받은 금액이 아직 없으면' IN prosrc) > 0)::text, (position('Mig 265 - 받은 금액이 아직 없으면' IN prosrc) > 0), true FROM src
)
SELECT label AS "경우", exp_txt AS "기대 (수행 몫 / 쿨가이 / 올데이케어)", act_txt AS "실제", ok AS "맞음", not_negative AS "올데이케어 몫 음수 아님"
FROM (
  SELECT * FROM rws
  UNION ALL
  SELECT 999, '전체', '전부 true', CASE WHEN bool_and(ok AND not_negative) THEN '전부 true' ELSE '틀린 줄 있음' END,
         bool_and(ok), bool_and(not_negative)
  FROM rws
) z ORDER BY ord;
