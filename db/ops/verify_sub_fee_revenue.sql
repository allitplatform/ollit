-- ============================================================================
-- 협력사 수수료 반영 대조 - "기존 원청·직영 숫자 변화 0" 확인
-- 작성 2026-10-06 · 읽기 전용 (SELECT 만) · 구역마다 단독 실행 가능
--
-- 무엇을 확인하나
--   mig 229 는 누적 이월의 일정산 수입 조건을 track = 'A' 에서 track IN ('A','S') 로 넓혔습니다.
--   과거 달에 track S 작업이 없으면 결과는 달라지지 않습니다.
--   매출 리포트의 서버 집계(mig 175·176)는 바꾸지 않았습니다 (track A 만 집계 - 그대로).
--
-- 합격 기준
--   [1] 과거 달의 "협력사_수수료" = 0, "차이" = 0  (협력사 작업을 시작한 달만 값이 있음)
--   [2] 원청별 track A 합계 - mig 229 실행 전후로 같은 값 (실행 전에 한 번, 실행 후에 한 번 돌려 비교)
--   [3] track 별 건수 - S 는 협력사 작업만
-- ============================================================================

-- ----------------------------------------------------------------------------
-- [1] 월별 회사 수입: 기존(track A) vs 새 기준(track A + S)
-- ----------------------------------------------------------------------------
SELECT
  to_char(date_trunc('month', t.completed_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM')          AS 월,
  COALESCE(SUM(p.owner_amount) FILTER (WHERE p.track = 'A'), 0)                              AS 기존_일정산_수입,
  COALESCE(SUM(p.owner_amount) FILTER (WHERE p.track = 'S'), 0)                              AS 협력사_수수료,
  COALESCE(SUM(p.owner_amount) FILTER (WHERE p.track IN ('A', 'S')), 0)                      AS 새_기준_수입,
  COALESCE(SUM(p.owner_amount) FILTER (WHERE p.track IN ('A', 'S')), 0)
    - COALESCE(SUM(p.owner_amount) FILTER (WHERE p.track = 'A'), 0)                          AS 차이,
  COUNT(*) FILTER (WHERE p.track = 'S')                                                      AS 협력사_건수
FROM payments p
JOIN tasks t ON t.id = p.task_id
WHERE t.status = '완료'
  AND t.completed_at IS NOT NULL
  AND t.completed_at >= (now() - interval '6 months')
GROUP BY 1
ORDER BY 1;

-- ----------------------------------------------------------------------------
-- [2] 이번 달·지난달 원청별 track A 합계 (매출 리포트의 기존 칸 - 229 전후로 같아야 함)
-- ----------------------------------------------------------------------------
SELECT
  to_char(date_trunc('month', t.completed_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM') AS 월,
  pr.code                                   AS 원청,
  COUNT(*)                                  AS 건수,
  COALESCE(SUM(t.total_amount), 0)          AS 총액,
  COALESCE(SUM(p.engineer_amount), 0)       AS 기사,
  COALESCE(SUM(p.principal_amount), 0)      AS 원청몫,
  COALESCE(SUM(p.owner_amount), 0)          AS 회사
FROM payments p
JOIN tasks t            ON t.id = p.task_id AND p.track = 'A'
LEFT JOIN principals pr ON pr.id = t.principal_id
WHERE t.status IN ('완료', 'visit_only')
  AND t.completed_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') - interval '1 month'
GROUP BY 1, 2
ORDER BY 1, 2;

-- ----------------------------------------------------------------------------
-- [3] track 별 건수와 협력사 작업 일치 여부 (기대: S 건수 = 협력사 작업 중 정산된 건수)
-- ----------------------------------------------------------------------------
SELECT
  p.track,
  COUNT(*)                                                    AS 건수,
  COUNT(*) FILTER (WHERE t.subcontractor_id IS NOT NULL)      AS 그중_협력사_작업,
  COUNT(*) FILTER (WHERE t.subcontractor_id IS NULL)          AS 그중_직영_원청_작업
FROM payments p
JOIN tasks t ON t.id = p.task_id
GROUP BY p.track
ORDER BY p.track;
