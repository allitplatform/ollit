-- ============================================================================
-- 냉매 100% 기사 출장비 면제(mig 180) 누락 - 영향 작업 조회
-- 작성 2026-10-06 · 읽기 전용 (SELECT 만, 아무것도 바꾸지 않습니다)
--
-- 배경
--   2026-07-15 결정(mig 180): 냉매 100%(직영) 기사는 출장비 수수료 면제 = 출장비 전액 기사 몫.
--   2026-07-28 mig 196 부터 compute_payment 에서 이 면제가 빠져, 출장비의 60% 만 기사 몫으로 계산됨.
--
-- 대상 조건
--   · 상태 '완료' (방문출장 visit_only 는 다른 함수가 처리하고 면제가 살아 있어 제외)
--   · 출장비 > 0
--   · 완료일 2026-07-15 이후 (출장비 60/40 규칙 적용 건)
--   · 정산 계산 시각이 2026-07-28 이후 (면제가 빠진 함수로 계산된 건)
--   · 배정 기사의 냉매 비율이 "지금" 100 이상
--
-- 금액
--   면제_적용시_기사 = 저장_기사 + (출장비 - FLOOR(출장비 x 0.6))
--   면제_적용시_회사 = 저장_회사 - 같은 금액
--   차액             = 출장비 - FLOOR(출장비 x 0.6)   (예: 출장비 40,000 -> 16,000)
--
-- 한계
--   · 기사의 냉매 비율은 현재 값입니다. 작업 당시 100 이 아니었다가 나중에 바뀐 기사는
--     대상이 아닌데도 나올 수 있습니다 -> "비율" 열을 보고 판단해 주세요.
--   · mig 196 을 실행한 정확한 시각을 모르므로 계산 시각 기준을 7/28 00:00 으로 잡았습니다.
--     7/28 당일 건은 "계산시각" 열을 보고 판단해 주세요.
--   · 정확한 재계산 값은 복구(216d) 드라이런에서 다시 확인합니다.
--
-- Supabase SQL Editor 는 마지막 결과만 보여주므로 [1] [2] [3] 을 하나씩 실행해 주세요.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- [1] 영향 작업 목록
-- ----------------------------------------------------------------------------
SELECT
  t.task_no                                                        AS 작업번호,
  pr.code                                                          AS 원청,
  u.name                                                           AS 기사,
  u.refrigerant_rate                                               AS 비율,
  to_char(t.completed_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS 완료,
  to_char(p.computed_at  AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS 계산시각,
  t.travel_fee                                                     AS 출장비,
  p.engineer_amount                                                AS 저장_기사,
  p.owner_amount                                                   AS 저장_회사,
  p.engineer_amount + (t.travel_fee - FLOOR(t.travel_fee * 0.6)::int)                AS 면제_적용시_기사,
  GREATEST(p.owner_amount - (t.travel_fee - FLOOR(t.travel_fee * 0.6)::int), 0)      AS 면제_적용시_회사,
  (t.travel_fee - FLOOR(t.travel_fee * 0.6)::int)                  AS 차액,
  p.calc_method                                                    AS 계산방식,
  CASE WHEN p.engineer_remit_confirmed_at IS NOT NULL THEN '입금확인됨'
       WHEN p.engineer_remitted_at        IS NOT NULL THEN '보고됨'
       ELSE '미보고' END                                           AS 송금상태
FROM tasks t
JOIN payments p        ON p.task_id = t.id
JOIN users u           ON u.id = t.assigned_engineer_id
LEFT JOIN principals pr ON pr.id = t.principal_id
WHERE t.status = '완료'
  AND COALESCE(t.travel_fee, 0) > 0
  AND t.completed_at >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz
  AND p.computed_at  >= '2026-07-28 00:00:00 Asia/Seoul'::timestamptz
  AND COALESCE(u.refrigerant_rate, 50) >= 100
  AND p.track = 'A'
ORDER BY t.completed_at;

-- ----------------------------------------------------------------------------
-- [2] 기사별 합계
-- ----------------------------------------------------------------------------
SELECT
  u.name                                                          AS 기사,
  COUNT(*)                                                        AS 건수,
  SUM(t.travel_fee)                                               AS 출장비_합,
  SUM(t.travel_fee - FLOOR(t.travel_fee * 0.6)::int)              AS 차액_합
FROM tasks t
JOIN payments p ON p.task_id = t.id
JOIN users u    ON u.id = t.assigned_engineer_id
WHERE t.status = '완료'
  AND COALESCE(t.travel_fee, 0) > 0
  AND t.completed_at >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz
  AND p.computed_at  >= '2026-07-28 00:00:00 Asia/Seoul'::timestamptz
  AND COALESCE(u.refrigerant_rate, 50) >= 100
  AND p.track = 'A'
GROUP BY u.name
ORDER BY 4 DESC;

-- ----------------------------------------------------------------------------
-- [3] 참고 - 냉매 100% 기사 목록 (대상 기사가 맞는지 확인용)
-- ----------------------------------------------------------------------------
SELECT code, name, refrigerant_rate, is_active
  FROM users
 WHERE COALESCE(refrigerant_rate, 50) >= 100
 ORDER BY code;
