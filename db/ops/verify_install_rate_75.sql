-- ============================================================================
-- 검증 (읽기만 합니다. 아무것도 바꾸지 않습니다) - mig 261 실행 뒤에 돌려 주세요
-- 블록 (72) 설치 기사 몫 75%
-- ============================================================================

-- [A] 날짜별 비율 - 기대: 0.75 / 0.80 / 0.80 / 0.75 / 0.75
SELECT label, install_engineer_rate(at) AS engineer_rate
FROM (VALUES
  ('1) 7/28 23:59',  '2026-07-28 23:59:59 Asia/Seoul'::timestamptz),
  ('2) 7/29 00:00',  '2026-07-29 00:00:00 Asia/Seoul'::timestamptz),
  ('3) 10/7 23:59',  '2026-10-07 23:59:59 Asia/Seoul'::timestamptz),
  ('4) 10/8 00:00',  '2026-10-08 00:00:00 Asia/Seoul'::timestamptz),
  ('5) 지금',         now())
) v(label, at) ORDER BY label;

-- [B] 식 계산 (compute_payment 의 설치 식을 그대로 옮긴 것) - 기대:
--   1) 견적 200,000 · 자재비 0 · 완료 10/8      -> 기사 150,000 / 회사 50,000
--   2) 견적 200,000 · 자재비 0 · 완료 10/7      -> 기사 160,000 / 회사 40,000
--   3) 견적 230,000 · 자재비 30,000 · 완료 10/8 -> 기사 180,000 / 회사 50,000
SELECT label, quote, material,
       material + FLOOR((quote - material) * install_engineer_rate(done_at))::int           AS engineer,
       quote - (material + FLOOR((quote - material) * install_engineer_rate(done_at))::int) AS company
FROM (VALUES
  ('1) 20만 · 자재 0 · 10/8',   200000, 0,     '2026-10-08 10:00:00 Asia/Seoul'::timestamptz),
  ('2) 20만 · 자재 0 · 10/7',   200000, 0,     '2026-10-07 10:00:00 Asia/Seoul'::timestamptz),
  ('3) 23만 · 자재 3만 · 10/8', 230000, 30000, '2026-10-08 10:00:00 Asia/Seoul'::timestamptz)
) v(label, quote, material, done_at) ORDER BY label;

-- [C] 최근 설치 완료 작업 20건: 저장된 기사 몫 vs 새 함수로 다시 계산했을 때의 기사 몫 (계산만, 저장 안 함)
--   기대: 10/7 까지 완료된 작업은 diff = 0.
--   10/8 이후 완료된 작업이 있고 261 실행 전에 계산됐다면 diff 가 나올 수 있다 (80% 로 계산된 것) -> 그 줄은 알려 주세요.
--   출장비 기사 몫(7/15 이후 60%)까지 넣어 맞췄습니다. 출장비만 정산 작업은 뺐습니다.
SELECT t.task_no,
       (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS done_kst,
       COALESCE(t.product_price, 0) AS quote, COALESCE(t.extra_fee, 0) AS extra, COALESCE(t.material_cost, 0) AS material,
       install_engineer_rate(t.completed_at) AS rate,
       p.engineer_amount AS stored,
       x.expected,
       p.engineer_amount - x.expected AS diff
FROM tasks t
JOIN payments p ON p.task_id = t.id
CROSS JOIN LATERAL (
  SELECT LEAST(GREATEST(COALESCE(t.material_cost, 0), 0),
               GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0), 0)) AS m
) a
CROSS JOIN LATERAL (
  SELECT a.m
       + FLOOR(GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0) - a.m, 0) * install_engineer_rate(t.completed_at))::int
       + CASE WHEN t.completed_at >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz
              THEN FLOOR(COALESCE(t.travel_fee, 0) * 0.6)::int ELSE COALESCE(t.travel_fee, 0) END AS expected
) x
WHERE p.calc_method = '직영_75_25'
  AND t.status IN ('완료', '정산완료')
  AND t.completed_at IS NOT NULL
  AND t.subcontractor_id IS NULL
ORDER BY t.completed_at DESC
LIMIT 20;

-- [D] 아직 완료되지 않은 설치 작업 (다음에 계산될 때 75% 로 바뀔 작업) - 참고용 건수
SELECT t.status, count(*) AS n
FROM tasks t JOIN payments p ON p.task_id = t.id
WHERE p.calc_method = '직영_75_25' AND t.completed_at IS NULL AND t.status NOT IN ('취소')
GROUP BY t.status ORDER BY n DESC;
