-- ============================================================================
-- compute_payment v30 드라이런 - 216b 실행 전 필수
-- 작성 2026-10-06 · 선행: 215, 216a
--
-- 아무것도 저장하지 않습니다 (계산만).
-- Supabase SQL Editor 는 마지막 결과만 보여주므로 [1] [2] [3] 을 하나씩 따로 실행해 주세요.
--
-- 합격 기준
--   [1] v30 vs v29  = 0행           <- 216b 실행 조건 (새 함수가 기존 계산을 바꾸지 않음)
--   [2] v30 vs 저장값                <- 참고. 차이가 있어도 [1] 이 0행이면 새 함수 탓이 아님
--                                      (과거 규칙으로 계산된 뒤 재계산되지 않은 옛 건)
--   [3] 대상 500건의 구성            <- 원청·서비스가 고르게 들어 있는지 확인
-- ============================================================================

-- 계산 중 오류가 나는 작업도 표에 남기기 위한 포장 함수 (드라이런 전용, 저장 없음)
CREATE OR REPLACE FUNCTION _dry_compute(p_fn text, p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v jsonb;
BEGIN
  EXECUTE format('SELECT %I($1)', p_fn) INTO v USING p_task_id;
  RETURN v;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- [1] v30 vs v29 - 기대: 0행  ★ 216b 실행 조건
-- ----------------------------------------------------------------------------
WITH target AS (
  SELECT t.id, t.task_no
    FROM tasks t
   WHERE (t.status IN ('완료', 'visit_only') AND t.completed_at IS NOT NULL)
      OR t.status = '취소'
   ORDER BY COALESCE(t.completed_at, t.updated_at) DESC
   LIMIT 500
), calc AS (
  SELECT g.task_no,
         _dry_compute('compute_payment_v29_dryrun', g.id) AS v29,
         _dry_compute('compute_payment_v30_dryrun', g.id) AS v30
    FROM target g
)
SELECT task_no, v29, v30
  FROM calc
 WHERE v29 IS DISTINCT FROM v30
 ORDER BY task_no;

-- ----------------------------------------------------------------------------
-- [2] v30 vs 저장된 payments - 참고용
-- ----------------------------------------------------------------------------
WITH target AS (
  SELECT t.id, t.task_no, t.completed_at
    FROM tasks t
   WHERE t.status IN ('완료', 'visit_only')
     AND t.completed_at IS NOT NULL
   ORDER BY t.completed_at DESC
   LIMIT 500
), calc AS (
  SELECT g.task_no, g.completed_at,
         _dry_compute('compute_payment_v30_dryrun', g.id) AS v30,
         p.engineer_amount, p.principal_amount, p.owner_amount, p.track, p.calc_method
    FROM target g
    LEFT JOIN payments p ON p.task_id = g.id
)
SELECT task_no,
       to_char(completed_at AT TIME ZONE 'Asia/Seoul', 'MM-DD') AS 완료일,
       engineer_amount  AS 저장_기사,  (v30 ->> 'engineer')::int  AS 계산_기사,
       principal_amount AS 저장_원청,  (v30 ->> 'principal')::int AS 계산_원청,
       owner_amount     AS 저장_회사,  (v30 ->> 'owner')::int     AS 계산_회사,
       track            AS 저장_track, v30 ->> 'track'            AS 계산_track,
       v30 ->> 'error'  AS 계산_오류
  FROM calc
 WHERE (v30 ? 'error')
    OR engineer_amount  IS DISTINCT FROM (v30 ->> 'engineer')::int
    OR principal_amount IS DISTINCT FROM (v30 ->> 'principal')::int
    OR owner_amount     IS DISTINCT FROM (v30 ->> 'owner')::int
    OR track::text      IS DISTINCT FROM (v30 ->> 'track')
 ORDER BY completed_at DESC;

-- ----------------------------------------------------------------------------
-- [3] 대상 500건의 구성 (원청 x 계산 방식)
-- ----------------------------------------------------------------------------
WITH target AS (
  SELECT t.id, t.principal_id
    FROM tasks t
   WHERE t.status IN ('완료', 'visit_only')
     AND t.completed_at IS NOT NULL
   ORDER BY t.completed_at DESC
   LIMIT 500
)
SELECT pr.code AS 원청, p.calc_method AS 계산방식, p.track, COUNT(*) AS 건수
  FROM target g
  LEFT JOIN principals pr ON pr.id = g.principal_id
  LEFT JOIN payments p    ON p.task_id = g.id
 GROUP BY 1, 2, 3
 ORDER BY 1, 4 DESC;
