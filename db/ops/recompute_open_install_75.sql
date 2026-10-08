-- ============================================================================
-- 미완료 설치 작업만 다시 계산 (설치 기사 몫 75%) - 블록 (73)
-- 선행: mig 261 실행
--
-- 쓰는 법
--   1) 그대로 실행 = 미리 보기 (아무것도 바꾸지 않음). 결과 표를 확인.
--   2) 아래 [실행 플래그] 줄의 false 를 true 로 바꿔 다시 실행 = 다시 계산.
--   ※ 파일 전체를 한 번에 실행해 주세요 (일부만 골라 실행하면 임시 표가 없어 오류가 납니다).
--
-- 대상 (전부 만족해야 함)
--   · 상태가 미배정 · 배정 · 확정 · 진행중            · 완료 시각이 비어 있음
--   · 협력사 작업이 아님 (직영)                        · 정산 계산 방식이 설치(직영_75_25)
--   · 취소되지 않은 항목이 전부 설치 종목 (섞인 작업 제외)
--   완료 · 정산완료 · 취소 · 협력사 · 섞인 작업은 건드리지 않는다.
--   대상이 30건을 넘으면 실행하지 않고 멈춘다 (오류로 끝나고 아무것도 바뀌지 않음).
--
-- 결과 표 (하나)
--   맨 위 3줄 = 요약: 모드 / 대상(다시 계산) 건수 / "10/8 완료인데 80%로 계산된 작업 n건"
--   그 아래 = 작업마다 한 줄: 작업번호 · 상태 · 견적 · 전 기사 몫 · 새 기사 몫(계산) · 차이 · 지금 저장된 기사 몫 · 맞음
--   "새 기사 몫(계산)" = 자재비 + (견적 + 추가금 - 자재비) x 지금 비율 + 출장비 기사 몫 (원 미만 버림)
--   미리 보기: "지금 저장된 기사 몫" = "전 기사 몫" (아직 안 바뀜), 맞음 = false 가 정상.
--   실행 뒤:   "지금 저장된 기사 몫" = "새 기사 몫(계산)", 맞음 = true 여야 한다.
-- ============================================================================

BEGIN;

-- [실행 플래그] false = 미리 보기 / true = 다시 계산
CREATE TEMP TABLE _recompute_flag ON COMMIT DROP AS SELECT false AS do_run;

CREATE TEMP TABLE _recompute_tgt ON COMMIT DROP AS
SELECT t.id, t.task_no, t.status,
       COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0) AS quote,
       p.engineer_amount AS before_eng,
       a1.m
       + FLOOR(GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0) - a1.m, 0) * install_engineer_rate(now()))::int
       + FLOOR(COALESCE(t.travel_fee, 0) * 0.6)::int AS new_eng
FROM tasks t
JOIN payments p ON p.task_id = t.id
CROSS JOIN LATERAL (
  SELECT LEAST(GREATEST(COALESCE(t.material_cost, 0), 0),
               GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0), 0)) AS m
) a1
WHERE t.status IN ('미배정', '배정', '확정', '진행중')
  AND t.completed_at IS NULL
  AND t.subcontractor_id IS NULL
  AND p.calc_method = '직영_75_25'
  AND EXISTS (
    SELECT 1 FROM task_items ti
    WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false))
  AND NOT EXISTS (
    SELECT 1 FROM task_items ti
    LEFT JOIN work_types wt    ON wt.id = ti.work_type_id
    LEFT JOIN service_types st ON st.id = wt.service_type_id
    WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)
      AND st.code IS DISTINCT FROM 'install');

DO $$
DECLARE
  v_run boolean;
  v_n   int;
  r     RECORD;
BEGIN
  SELECT do_run INTO v_run FROM _recompute_flag;
  SELECT count(*) INTO v_n FROM _recompute_tgt;
  IF NOT v_run THEN RETURN; END IF;
  IF v_n > 30 THEN
    RAISE EXCEPTION '대상이 % 건입니다 (30건 초과). 실행하지 않았습니다.', v_n;
  END IF;
  FOR r IN
    -- 실행 직전에 조건을 한 번 더 확인한다 (그 사이 완료 · 취소 · 협력사로 넘어간 작업 제외)
    SELECT g.id FROM _recompute_tgt g JOIN tasks t ON t.id = g.id
    WHERE t.status IN ('미배정', '배정', '확정', '진행중')
      AND t.completed_at IS NULL AND t.subcontractor_id IS NULL
  LOOP
    PERFORM compute_payment(r.id);
  END LOOP;
END $$;

-- 결과를 보통 표로 옮겨 둔다 (임시 표는 COMMIT 때 사라지므로, 마지막 SELECT 가 읽을 표)
DROP TABLE IF EXISTS _recompute_result;
CREATE TEMP TABLE _recompute_result AS
SELECT 1 AS ord, NULL::text AS k,
       CASE WHEN (SELECT do_run FROM _recompute_flag) THEN '▶ 실행함 (다시 계산)' ELSE '▶ 미리 보기 (바꾼 것 없음)' END AS c1,
       NULL::text AS c2, NULL::int AS c3, NULL::int AS c4, NULL::int AS c5, NULL::int AS c6, NULL::int AS c7, NULL::boolean AS c8
UNION ALL
SELECT 2, NULL,
       CASE WHEN (SELECT do_run FROM _recompute_flag) THEN '다시 계산 ' ELSE '대상 ' END || (SELECT count(*) FROM _recompute_tgt) || '건',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL
UNION ALL
SELECT 3, NULL,
       '10/8 완료인데 80%로 계산된 작업 ' || (
         SELECT count(*) FROM tasks t JOIN payments p ON p.task_id = t.id
         CROSS JOIN LATERAL (
           SELECT LEAST(GREATEST(COALESCE(t.material_cost, 0), 0),
                        GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0), 0)) AS m) a1
         WHERE p.calc_method = '직영_75_25' AND t.subcontractor_id IS NULL
           AND t.status IN ('완료', '정산완료')
           AND t.completed_at >= '2026-10-08 00:00:00 Asia/Seoul'::timestamptz
           AND p.engineer_amount IS DISTINCT FROM (
                 a1.m + FLOOR(GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0) - a1.m, 0) * install_engineer_rate(t.completed_at))::int
                 + FLOOR(COALESCE(t.travel_fee, 0) * 0.6)::int)
       ) || '건',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL
UNION ALL
SELECT 10, g.task_no, g.task_no, g.status, g.quote, g.before_eng, g.new_eng, g.new_eng - g.before_eng,
       p.engineer_amount, (p.engineer_amount = g.new_eng)
FROM _recompute_tgt g JOIN payments p ON p.task_id = g.id;

COMMIT;

SELECT c1 AS "작업번호", c2 AS "상태", c3 AS "견적(+추가금)", c4 AS "전 기사 몫", c5 AS "새 기사 몫(계산)",
       c6 AS "차이", c7 AS "지금 저장된 기사 몫", c8 AS "맞음"
FROM _recompute_result ORDER BY ord, k;
