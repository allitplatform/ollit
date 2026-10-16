-- ============================================================================
-- 검증 (읽기만 합니다. 아무것도 바꾸지 않습니다) - 블록 (81) 로봇청소기 회사 35% / 기사 65%
-- 선행: mig 268 실행
-- 결과는 표 하나입니다: 경우 · 기대 · 실제 · 맞음
--   계산은 compute_payment 의 로봇청소기 분기가 실제로 부르는 함수(_robot_split)를 그대로 부릅니다.
--   비율은 DB 에 들어간 직영 x 로봇청소기 규칙에서 읽습니다 (규칙이 없으면 맞음 = false).
-- ============================================================================
WITH rule AS (
  SELECT fee_type, fee_rate, fee_amount, fee_base FROM fee_rules
   WHERE subcontractor_id IS NULL AND service_code = 'robot' AND active
   ORDER BY effective_from DESC LIMIT 1
),
cases AS (
  SELECT * FROM (VALUES
    (1, '본체 + 도크스테이션 99,000',                     99000,  64350, 34650),
    (2, '본체만 69,000',                                   69000,  44850, 24150),
    (3, '99,000 + 현장 추가 20,000 = 119,000 받음',        119000, 77350, 41650),
    (4, '출장비만 30,000 (방문 후 고객 사정 취소)',        30000,  19500, 10500),
    (5, '견적 0 (금액 미정)',                               0,      0,     0)
  ) v(n, label, total, exp_eng, exp_fee)
),
src AS (SELECT prosrc FROM pg_proc WHERE proname = 'compute_payment'),
rws AS (
  SELECT c.n AS ord, '로봇청소기 · ' || c.label AS label,
         '기사 ' || c.exp_eng || ' / 회사 ' || c.exp_fee AS exp_txt,
         COALESCE('기사 ' || (x ->> 'engineer') || ' / 회사 ' || (x ->> 'fee'), '규칙 없음') AS act_txt,
         ((x ->> 'engineer')::int = c.exp_eng AND (x ->> 'fee')::int = c.exp_fee) AS ok
  FROM cases c
  LEFT JOIN rule r ON true
  LEFT JOIN LATERAL (SELECT _robot_split(c.total, r.fee_type, r.fee_rate, r.fee_amount) AS x WHERE r.fee_type IS NOT NULL) s ON true
  UNION ALL
  SELECT 20, '직영 x 로봇청소기 규칙: 받은 총금액 기준 35%', 'rate / 0.35 / gross',
         COALESCE((SELECT fee_type || ' / ' || fee_rate || ' / ' || fee_base FROM rule), '없음'),
         COALESCE((SELECT fee_type = 'rate' AND fee_rate = 0.35 AND fee_base = 'gross' FROM rule), false)
  UNION ALL
  SELECT 21, '종목 · 품목 3줄 (본체+도크 99,000 / 본체만 69,000 / 출장비 0)', 'robot_body 69000 · robot_dock 99000 · robot_visit 0',
         (SELECT string_agg(wt.code || ' ' || wt.default_unit_price, ' · ' ORDER BY wt.code)
            FROM work_types wt JOIN service_types st ON st.id = wt.service_type_id JOIN categories c ON c.id = st.category_id
           WHERE c.code = 'robot' AND wt.code LIKE 'robot\_%'),
         (SELECT string_agg(wt.code || ' ' || wt.default_unit_price, ' · ' ORDER BY wt.code)
            FROM work_types wt JOIN service_types st ON st.id = wt.service_type_id JOIN categories c ON c.id = st.category_id
           WHERE c.code = 'robot' AND wt.code LIKE 'robot\_%') = 'robot_body 69000 · robot_dock 99000 · robot_visit 0'
  UNION ALL
  -- 다른 종목은 그대로: 로봇청소기 분기가 compute_payment 안에 한 번만 있고, 주방후드 분기 · 설치 비율 · 후드 정액 함수 호출이 그대로 있다
  SELECT 30, 'compute_payment: 로봇청소기 분기 1곳 · 주방후드 분기 · 후드 정액(2곳) · 설치 비율 그대로', 'true',
         ((length(prosrc) - length(replace(prosrc, 'Mig 268 - 직영 로봇청소기 분기', ''))) / length('Mig 268 - 직영 로봇청소기 분기') = 1
          AND (length(prosrc) - length(replace(prosrc, '_hood_fixed_calc(', ''))) / length('_hood_fixed_calc(') = 2
          AND position('Mig 256 - 직영 주방후드 분기' IN prosrc) > 0
          AND position('install_engineer_rate(' IN prosrc) > 0
          AND position('_sub_supply_estimate(' IN prosrc) > 0)::text,
         ((length(prosrc) - length(replace(prosrc, 'Mig 268 - 직영 로봇청소기 분기', ''))) / length('Mig 268 - 직영 로봇청소기 분기') = 1
          AND (length(prosrc) - length(replace(prosrc, '_hood_fixed_calc(', ''))) / length('_hood_fixed_calc(') = 2
          AND position('Mig 256 - 직영 주방후드 분기' IN prosrc) > 0
          AND position('install_engineer_rate(' IN prosrc) > 0
          AND position('_sub_supply_estimate(' IN prosrc) > 0)
  FROM src
  UNION ALL
  SELECT 31, '주방후드 값 그대로: 협력사 289,000 견적대로 (쿨가이)', '200000 / 85000 / 4000',
         (x ->> 'sub_share') || ' / ' || (x ->> 'kb_any') || ' / ' || ((x ->> 'fee')::int - (x ->> 'kb_any')::int),
         (x ->> 'sub_share') || ' / ' || (x ->> 'kb_any') || ' / ' || ((x ->> 'fee')::int - (x ->> 'kb_any')::int) = '200000 / 85000 / 4000'
  FROM (SELECT _hood_fixed_calc('[{"code":"hood_commercial_m","qty":1,"unit_price":289000}]'::jsonb, 289000, 101150, 0.35,
                                (SELECT id FROM subcontractors WHERE code = 'whitecore' LIMIT 1), 'KB', 0.35, 289000, DATE '2026-10-16') AS x) h
  UNION ALL
  SELECT 32, '설치 비율 그대로: 10/16 완료 기사 75%', '0.75', install_engineer_rate('2026-10-16 12:00:00+09')::text,
         install_engineer_rate('2026-10-16 12:00:00+09') = 0.75
)
SELECT label AS "경우", exp_txt AS "기대", act_txt AS "실제", ok AS "맞음"
FROM (
  SELECT * FROM rws
  UNION ALL
  SELECT 999, '전체', '전부 true', CASE WHEN bool_and(COALESCE(ok, false)) THEN '전부 true' ELSE '틀린 줄 있음' END, bool_and(COALESCE(ok, false)) FROM rws
) z ORDER BY ord;
