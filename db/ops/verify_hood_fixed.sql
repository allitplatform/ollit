-- ============================================================================
-- 검증 (읽기만 합니다. 아무것도 바꾸지 않습니다) - 블록 (77) 업소용 후드 정액 · 보장
-- 선행: mig 264 실행
-- 결과는 표 하나입니다: 경우 · 기대 · 실제 · 맞음 · 올데이케어 몫 음수 아님
--   기대 / 실제 = "화이트코어 몫 / 쿨가이 몫 / 올데이케어 몫"
--   계산은 compute_payment 가 실제로 부르는 함수(_hood_fixed_calc)를 그대로 부릅니다.
--   수수료율 35% · 쿨가이 몫 율 35% (화이트코어 x 쿨가이 규칙과 같은 값) 를 넣었습니다.
-- ============================================================================
WITH wc AS (SELECT id FROM subcontractors WHERE code = 'whitecore' LIMIT 1),
cases AS (
  SELECT * FROM (VALUES
    (1, '업소용 1,000~2,000mm 289,000 견적대로 (쿨가이)',
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 'KB', 0.35::numeric, 289000, DATE '2026-10-10', 200000, 85000, 4000),
    (2, '업소용 1,000mm 이하 198,000 견적대로 (쿨가이)',
        '[{"code":"hood_commercial_s","qty":1,"unit_price":198000}]'::jsonb, 198000, 'KB', 0.35::numeric, 198000, DATE '2026-10-10', 128700, 65000, 4300),
    (3, '289,000 + 자바라 30,000 (쿨가이)',
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000},{"code":"hood_option_duct","qty":1,"unit_price":30000}]'::jsonb, 319000, 'KB', 0.35::numeric, 319000, DATE '2026-10-10', 219500, 95500, 4000),
    (4, '289,000 을 250,000 으로 할인 (쿨가이) - 보장 없음',
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 250000, 'KB', 0.35::numeric, 289000, DATE '2026-10-10', 162500, 85000, 2500),
    (5, '289,000 견적 · 500,000 받음 (공급가 454,545, 쿨가이)',
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 454545, 'KB', 0.35::numeric, 289000, DATE '2026-10-10', 295454, 85000, 74091),
    (6, '쿨가이 아닌 화이트코어 작업 289,000',
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 'A', NULL::numeric, 289000, DATE '2026-10-10', 200000, 0, 89000),
    (7, '10/9 완료 (옛 규칙) 289,000 (쿨가이)',
        '[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 'KB', 0.35::numeric, 289000, DATE '2026-10-09', 187850, 101150, 0),
    (8, '업소용 1,000~2,000mm 2대 578,000 (쿨가이)',
        '[{"code":"hood_commercial_m","qty":2,"unit_price":289000}]'::jsonb, 578000, 'KB', 0.35::numeric, 578000, DATE '2026-10-10', 400000, 170000, 8000)
  ) v(n, label, lines, supply, pcode, prate, quote, d, exp_wc, exp_kb, exp_ad)
),
calc AS (
  SELECT c.*,
         _hood_fixed_calc(c.lines, c.supply, ROUND(c.supply * 0.35)::int, 0.35, (SELECT id FROM wc), c.pcode, c.prate, c.quote, c.d) AS r
  FROM cases c
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
  -- 직영 기사 주방후드는 그대로: compute_payment 가 계산 함수를 부르는 곳이 협력사 분기 한 곳뿐이고, 직영 주방후드 분기보다 앞에 있다
  SELECT 90, '직영 기사 주방후드 분기는 손대지 않음', 'true',
         (position('_hood_fixed_calc(' IN prosrc) > 0
          AND position('_hood_fixed_calc(' IN prosrc) < position('Mig 256 - 직영 주방후드 분기' IN prosrc)
          AND position('_hood_fixed_calc(' IN substr(prosrc, position('Mig 256 - 직영 주방후드 분기' IN prosrc))) = 0)::text,
         (position('_hood_fixed_calc(' IN prosrc) > 0
          AND position('_hood_fixed_calc(' IN prosrc) < position('Mig 256 - 직영 주방후드 분기' IN prosrc)
          AND position('_hood_fixed_calc(' IN substr(prosrc, position('Mig 256 - 직영 주방후드 분기' IN prosrc))) = 0),
         true
  FROM pg_proc WHERE proname = 'compute_payment'
  UNION ALL
  SELECT 91, '규칙 3줄이 들어 있음 (쿨가이 정액 2 + 화이트코어 보장 1)', '2 / 1',
         (SELECT count(*) FILTER (WHERE kind = 'principal_fixed') || ' / ' || count(*) FILTER (WHERE kind = 'sub_guarantee') FROM hood_fixed_rules WHERE active),
         (SELECT count(*) FILTER (WHERE kind = 'principal_fixed') = 2 AND count(*) FILTER (WHERE kind = 'sub_guarantee') = 1 FROM hood_fixed_rules WHERE active),
         true
)
SELECT label AS "경우", exp_txt AS "기대 (화이트코어 / 쿨가이 / 올데이케어)", act_txt AS "실제", ok AS "맞음", not_negative AS "올데이케어 몫 음수 아님"
FROM (
  SELECT * FROM rws
  UNION ALL
  SELECT 999, '전체', '전부 true', CASE WHEN bool_and(ok AND not_negative) THEN '전부 true' ELSE '틀린 줄 있음' END,
         bool_and(ok), bool_and(not_negative)
  FROM rws
) z ORDER BY ord;
