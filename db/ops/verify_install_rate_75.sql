-- ============================================================================
-- 검증 (읽기만 합니다. 아무것도 바꾸지 않습니다) - 블록 (72)(73) 설치 기사 몫 75%
-- 결과는 표 하나입니다: 구분 · 대상 · 기대 · 실제 · 맞음
--   [A] 날짜별 비율 5줄 / [B] 계산 3줄 / [C] 최근 설치 완료 20건 가운데 차이가 있는 줄만 / 맨 아래 "전체"
-- ============================================================================
WITH a AS (
  SELECT n, label, expected, install_engineer_rate(at) AS actual
  FROM (VALUES
    (1, '7/28 23:59 완료', 0.75, '2026-07-28 23:59:59 Asia/Seoul'::timestamptz),
    (2, '7/29 00:00 완료', 0.80, '2026-07-29 00:00:00 Asia/Seoul'::timestamptz),
    (3, '10/7 23:59 완료', 0.80, '2026-10-07 23:59:59 Asia/Seoul'::timestamptz),
    (4, '10/8 00:00 완료', 0.75, '2026-10-08 00:00:00 Asia/Seoul'::timestamptz),
    (5, '지금',            0.75, now())
  ) v(n, label, expected, at)
),
b AS (
  SELECT n, label, exp_eng, exp_co,
         material + FLOOR((quote - material) * install_engineer_rate(done_at))::int AS eng,
         quote - (material + FLOOR((quote - material) * install_engineer_rate(done_at))::int) AS co
  FROM (VALUES
    (1, '견적 200,000 · 자재비 0 · 완료 10/8',      200000, 0,     '2026-10-08 10:00:00 Asia/Seoul'::timestamptz, 150000, 50000),
    (2, '견적 200,000 · 자재비 0 · 완료 10/7',      200000, 0,     '2026-10-07 10:00:00 Asia/Seoul'::timestamptz, 160000, 40000),
    (3, '견적 230,000 · 자재비 30,000 · 완료 10/8', 230000, 30000, '2026-10-08 10:00:00 Asia/Seoul'::timestamptz, 180000, 50000)
  ) v(n, label, quote, material, done_at, exp_eng, exp_co)
),
c AS (
  -- 최근 설치 완료(직영 · 설치 계산) 20건: 저장된 기사 몫 vs 새 함수로 계산한 값 (출장비 기사 몫 포함)
  SELECT t.task_no, (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS done_kst,
         p.engineer_amount AS stored, x.expected
  FROM tasks t
  JOIN payments p ON p.task_id = t.id
  CROSS JOIN LATERAL (
    SELECT LEAST(GREATEST(COALESCE(t.material_cost, 0), 0),
                 GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0), 0)) AS m
  ) a1
  CROSS JOIN LATERAL (
    SELECT a1.m
         + FLOOR(GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0) - a1.m, 0) * install_engineer_rate(t.completed_at))::int
         + CASE WHEN t.completed_at >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz
                THEN FLOOR(COALESCE(t.travel_fee, 0) * 0.6)::int ELSE COALESCE(t.travel_fee, 0) END AS expected
  ) x
  WHERE p.calc_method = '직영_75_25'
    AND t.status IN ('완료', '정산완료')
    AND t.completed_at IS NOT NULL
    AND t.subcontractor_id IS NULL
  ORDER BY t.completed_at DESC
  LIMIT 20
),
rws AS (
  SELECT 100 + n AS ord, '[A] 날짜별 비율' AS grp, label AS target,
         expected::text AS exp_txt, actual::text AS act_txt, (expected = actual) AS ok
  FROM a
  UNION ALL
  SELECT 200 + n, '[B] 계산', label,
         '기사 ' || exp_eng || ' / 회사 ' || exp_co, '기사 ' || eng || ' / 회사 ' || co,
         (exp_eng = eng AND exp_co = co)
  FROM b
  UNION ALL
  SELECT 300 + (row_number() OVER (ORDER BY done_kst DESC))::int, '[C] 설치 완료 · 차이 있음',
         task_no || ' (완료 ' || done_kst || ')', expected::text, stored::text, false
  FROM c WHERE stored IS DISTINCT FROM expected
  UNION ALL
  SELECT 399, '[C] 최근 설치 완료 ' || (SELECT count(*) FROM c) || '건', '차이 0건 ✓', '차이 0', '차이 0', true
  WHERE NOT EXISTS (SELECT 1 FROM c WHERE stored IS DISTINCT FROM expected)
)
SELECT grp AS "구분", target AS "대상", exp_txt AS "기대", act_txt AS "실제", ok AS "맞음" FROM (
  SELECT * FROM rws
  UNION ALL
  SELECT 999, '전체', '모든 줄', '전부 true',
         CASE WHEN bool_and(ok) THEN '전부 true' ELSE '틀린 줄 있음' END, bool_and(ok)
  FROM rws
) z ORDER BY ord;
