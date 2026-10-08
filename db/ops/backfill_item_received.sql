-- ============================================================================
-- 완료 작업의 빈 "항목 받은 돈" 채우기 - 블록 (76)
-- 선행: mig 263 실행
--
-- 쓰는 법
--   1) 그대로 실행 = 미리 보기 (아무것도 바꾸지 않음). 결과 표를 확인.
--   2) 아래 [실행 플래그] 줄의 do_run 을 true 로 바꿔 다시 실행 = 채우기.
--   ※ 파일 전체를 한 번에 실행해 주세요 (일부만 골라 실행하면 임시 표가 없어 오류가 납니다).
--
-- 대상 (전부 만족해야 함)
--   · 상태가 완료 또는 정산완료              · 받은 금액(합계) > 0
--   · 취소되지 않은 항목이 딱 1개            · 그 항목의 받은 돈이 비어 있음
--   · 유솔N · 선결제 작업이 아님 (이 작업들은 항목 받은 돈 칸을 쓰지 않음)
--   · 협력사 작업만 (include_direct = false 일 때). 직영 작업까지 넣으려면 include_direct 를 true 로.
--   넣는 값 = 그 작업의 받은 금액(합계). 합계 · 공급가 · 정산 금액은 건드리지 않는다.
--
-- 안전장치
--   · 채우는 동안 task_items 의 자동 계산(트리거)을 잠깐 꺼서 합계 · 견적 · 정산이 다시 계산되지 않게 한다.
--     끝나면 다시 켠다. 중간에 오류가 나면 전부 되돌아가고 자동 계산도 켜진 상태로 남는다.
--   · 채운 뒤 정산 금액(payments)이 한 건이라도 달라졌으면 오류로 끝나고 아무것도 바뀌지 않는다.
--   · 대상이 500건을 넘으면 실행하지 않고 멈춘다.
--
-- 결과 표 (하나)
--   맨 위 = 요약: 모드 / 대상 건수 / 항목이 여러 개라 넣지 않은 건수 / (협력사만일 때) 같은 조건의 직영 건수
--   그 아래 = 작업마다 한 줄: 작업번호 · 구분 · 받은 금액 · 넣을 값 · 지금 항목 값 · 정산 금액 바뀜
--   미리 보기: "지금 항목 값" 이 비어 있음. 실행 뒤: "지금 항목 값" = "넣을 값".
--   "정산 금액 바뀜" 은 전부 false 여야 한다.
-- ============================================================================

BEGIN;

-- [실행 플래그] do_run: false = 미리 보기 / true = 채우기 · include_direct: false = 협력사 작업만 / true = 직영 포함
CREATE TEMP TABLE _bf_flag ON COMMIT DROP AS SELECT false AS do_run, false AS include_direct;

-- 조건에 맞는 작업 전부 (협력사 · 직영, 항목 1개 · 여러 개 모두) - 요약 줄 계산용
CREATE TEMP TABLE _bf_all ON COMMIT DROP AS
SELECT t.id, t.task_no, t.received_total,
       (t.subcontractor_id IS NOT NULL) AS is_sub,
       x.n_live, x.n_filled, x.only_item
FROM tasks t
LEFT JOIN principals pr ON pr.id = t.principal_id
JOIN LATERAL (
  SELECT count(*)                                              AS n_live,
         count(*) FILTER (WHERE ti.received_amount IS NOT NULL) AS n_filled,
         (array_agg(ti.id))[1]                                  AS only_item
    FROM task_items ti
   WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)
) x ON true
WHERE t.status IN ('완료', '정산완료')
  AND COALESCE(t.received_total, 0) > 0
  AND pr.code IS DISTINCT FROM 'usol_n'
  AND t.payment_method IS DISTINCT FROM 'prepaid'
  AND x.n_live >= 1
  AND x.n_filled = 0;

-- 이번에 채울 대상
CREATE TEMP TABLE _bf_tgt ON COMMIT DROP AS
SELECT a.id, a.task_no, a.received_total, a.is_sub, a.only_item
FROM _bf_all a
WHERE a.n_live = 1
  AND (a.is_sub OR (SELECT include_direct FROM _bf_flag));

-- 정산 금액 기록 (채우기 전)
CREATE TEMP TABLE _bf_pay_before ON COMMIT DROP AS
SELECT g.id, md5(COALESCE(string_agg(p::text, '|' ORDER BY p.id), '')) AS h
FROM _bf_tgt g LEFT JOIN payments p ON p.task_id = g.id
GROUP BY g.id;

DO $$
DECLARE
  v_run boolean;
  v_n   int;
  v_bad int;
BEGIN
  SELECT do_run INTO v_run FROM _bf_flag;
  SELECT count(*) INTO v_n FROM _bf_tgt;
  IF NOT v_run OR v_n = 0 THEN RETURN; END IF;
  IF v_n > 500 THEN
    RAISE EXCEPTION '대상이 % 건입니다 (500건 초과). 실행하지 않았습니다.', v_n;
  END IF;

  ALTER TABLE task_items DISABLE TRIGGER USER;

  -- 실행 직전에 조건을 한 번 더 확인한다 (그 사이 값이 들어온 줄 · 취소된 줄 제외)
  UPDATE task_items ti
     SET received_amount = g.received_total
    FROM _bf_tgt g
   WHERE ti.id = g.only_item
     AND ti.received_amount IS NULL
     AND NOT COALESCE(ti.is_canceled, false);

  ALTER TABLE task_items ENABLE TRIGGER USER;

  SELECT count(*) INTO v_bad
  FROM _bf_pay_before b
  JOIN LATERAL (
    SELECT md5(COALESCE(string_agg(p::text, '|' ORDER BY p.id), '')) AS h
      FROM payments p WHERE p.task_id = b.id
  ) a ON true
  WHERE a.h IS DISTINCT FROM b.h;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '정산 금액이 달라진 작업이 % 건 있습니다. 아무것도 바꾸지 않았습니다.', v_bad;
  END IF;
END $$;

-- 결과를 보통 표로 옮겨 둔다 (임시 표는 COMMIT 때 사라지므로, 마지막 SELECT 가 읽을 표)
DROP TABLE IF EXISTS _bf_result;
CREATE TEMP TABLE _bf_result AS
SELECT 1 AS ord, NULL::text AS k,
       CASE WHEN (SELECT do_run FROM _bf_flag) THEN '▶ 실행함 (채움)' ELSE '▶ 미리 보기 (바꾼 것 없음)' END AS c1,
       NULL::text AS c2, NULL::int AS c3, NULL::int AS c4, NULL::int AS c5, NULL::boolean AS c6
UNION ALL
SELECT 2, NULL,
       CASE WHEN (SELECT do_run FROM _bf_flag) THEN '채움 ' ELSE '대상 ' END || (SELECT count(*) FROM _bf_tgt) || '건'
       || CASE WHEN (SELECT include_direct FROM _bf_flag) THEN ' (협력사 + 직영)' ELSE ' (협력사 작업만)' END,
       NULL, NULL, NULL, NULL, NULL
UNION ALL
SELECT 3, NULL,
       '항목이 여러 개라 넣지 않음 ' || (
         SELECT count(*) FROM _bf_all a
          WHERE a.n_live >= 2 AND (a.is_sub OR (SELECT include_direct FROM _bf_flag))) || '건',
       NULL, NULL, NULL, NULL, NULL
UNION ALL
SELECT 4, NULL,
       '같은 조건의 직영 작업 ' || (SELECT count(*) FROM _bf_all a WHERE NOT a.is_sub AND a.n_live = 1) || '건 (이번에는 넣지 않음)',
       NULL, NULL, NULL, NULL, NULL
WHERE NOT (SELECT include_direct FROM _bf_flag)
UNION ALL
SELECT 10, g.task_no, g.task_no,
       CASE WHEN g.is_sub THEN '협력사' ELSE '직영' END,
       g.received_total, g.received_total, ti.received_amount,
       (a.h IS DISTINCT FROM b.h)
FROM _bf_tgt g
JOIN task_items ti      ON ti.id = g.only_item
JOIN _bf_pay_before b   ON b.id = g.id
JOIN LATERAL (
  SELECT md5(COALESCE(string_agg(p::text, '|' ORDER BY p.id), '')) AS h
    FROM payments p WHERE p.task_id = g.id
) a ON true;

COMMIT;

SELECT c1 AS "작업번호", c2 AS "구분", c3 AS "받은 금액", c4 AS "넣을 값", c5 AS "지금 항목 값", c6 AS "정산 금액 바뀜"
FROM _bf_result ORDER BY ord, k;
