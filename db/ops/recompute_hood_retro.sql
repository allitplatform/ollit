-- ============================================================================
-- 주방후드 작업 전부를 새 규칙으로 정정 (쿨가이 정액 · 화이트코어 보장 · 직영 기사 작업의 쿨가이 정액) - 블록 (78)
-- 선행: mig 264, 265 실행 + db/ops/verify_hood_fixed.sql "전체" 줄이 true
--
-- 쓰는 법
--   1) 그대로 실행 = 미리 보기. 실제 계산 함수로 다시 계산해 본 뒤 전부 되돌립니다 (아무것도 바뀌지 않음).
--   2) 아래 [실행 플래그] 줄의 false 를 true 로 바꿔 다시 실행 = 정정.
--   ※ 파일 전체를 한 번에 실행해 주세요.
--
-- 대상
--   · 종목이 주방후드인 작업 전부 (협력사가 한 것 + 직영 기사가 한 것, 완료 포함)
--   · 취소 · 취소요청 · 출장비만 정산은 제외
--   · 정산 계산이 이미 있는 작업만 (아직 한 번도 계산되지 않은 작업은 완료 때 새 규칙으로 계산된다)
--   200건을 넘으면 실행하지 않고 멈춘다.
--
-- 이미 주고받은 작업 (화이트코어 수수료 보고 · 받음 확인 / 쿨가이 [송금 완료])
--   정산 값은 새로 계산하고, 이미 보낸 줄은 고치지 않는다. 차액은 기존 장치가 줄로 만든다:
--   · 화이트코어 수수료가 달라지면 -> 다음 열린 정산일에 "추가분 / 차감분" 줄 (mig 225 · 252 의 장치, 자동)
--   · 쿨가이 몫이 달라지면 -> 직영 기사 작업은 곧바로 송금 줄에 차이가 잡히고,
--                             협력사 작업은 다음에 화이트코어 수수료 [받음 확인] 을 할 때 송금 줄에 차이(+ / -)가 잡힌다 (mig 245 의 장치)
--
-- 결과 표 (하나)
--   맨 위 요약 5줄: 모드 / 대상 · 값이 바뀌는 작업 수 / 화이트코어 차액 줄 수 · 합 / 쿨가이 차액 합 / 가장 이른 후드 완료일
--   그 아래 작업마다 한 줄:
--     작업번호 · 완료일 · 수행 · 원청 · 품목 · 받은 금액 · 수행 몫 전 → 후 · 쿨가이 몫 전 → 후 · 올데이케어 몫 전 → 후
--     · 이미 주고받음 · 화이트코어 차액 줄 · 쿨가이 차액 · 음수
--   수행 몫: 협력사 = 공급가 - 수수료 (받은 금액이 아직 없으면 견적 - 수수료) / 직영 = 기사 몫
--   올데이케어 몫 = 수수료 - 쿨가이 몫.  "음수" 는 전부 false 여야 한다.
--   화이트코어 차액 줄 = 이번 계산으로 실제 만들어진(만들어질) 추가분 · 차감분 줄 금액
--   쿨가이 차액 = 이미 송금 줄에 올라간 금액과 새 쿨가이 몫의 차이 (다음 송금에서 더하거나 뺄 금액). 송금 줄에 오른 적 없으면 0.
-- ============================================================================

BEGIN;

-- [실행 플래그] false = 미리 보기 / true = 정정
CREATE TEMP TABLE _hr_flag ON COMMIT DROP AS SELECT false AS do_run;

CREATE TEMP TABLE _hr_tgt ON COMMIT DROP AS
SELECT t.id, t.task_no, t.status,
       (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS done_kst,
       (t.subcontractor_id IS NOT NULL) AS is_sub,
       CASE WHEN t.subcontractor_id IS NOT NULL
            THEN COALESCE((SELECT s.name FROM subcontractors s WHERE s.id = t.subcontractor_id), '협력사')
            ELSE '직영' END AS performer,
       COALESCE(pr.name, '-') AS principal,
       (SELECT string_agg(COALESCE(wt.name, '?') || ' x' || COALESCE(ti.qty, 1), ' + ' ORDER BY ti.unit_price DESC NULLS LAST)
          FROM task_items ti LEFT JOIN work_types wt ON wt.id = ti.work_type_id
         WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)) AS items,
       COALESCE(t.received_total, 0) AS received,
       COALESCE(t.supply_amount, 0) AS supply,
       p.engineer_amount AS eng_before,
       p.owner_amount AS fee_before,
       COALESCE(p.sub_principal_share, 0) AS kb_before,
       COALESCE((SELECT SUM(l.fee) FROM subcontractor_settlement_lines l WHERE l.task_id = t.id), 0)::int AS settle_before,
       (SELECT count(*) FROM principal_remit_lines pl WHERE pl.task_id = t.id)::int AS remit_cnt_before,
       COALESCE((SELECT SUM(pl.delta) FROM principal_remit_lines pl WHERE pl.task_id = t.id), 0)::int AS remit_before,
       (EXISTS (SELECT 1 FROM subcontractor_settlement_lines l
                  JOIN subcontractor_daily_settlements d
                    ON d.subcontractor_id = l.subcontractor_id AND d.settle_date = l.settle_date
                 WHERE l.task_id = t.id AND (d.reported_at IS NOT NULL OR d.confirmed_at IS NOT NULL))
        OR EXISTS (SELECT 1 FROM subcontractor_fee_extra_lines el WHERE el.task_id = t.id)
        OR EXISTS (SELECT 1 FROM principal_remit_lines pl JOIN principal_remits rm ON rm.id = pl.remit_id
                    WHERE pl.task_id = t.id AND rm.paid_at IS NOT NULL)) AS sent
FROM tasks t
JOIN payments p ON p.task_id = t.id AND (p.track = 'S' OR t.subcontractor_id IS NULL)
LEFT JOIN principals pr ON pr.id = t.principal_id
WHERE t.category_id = (SELECT id FROM categories WHERE code = 'hood' LIMIT 1)
  AND t.status NOT IN ('취소', '취소요청', 'visit_only');

CREATE TEMP TABLE _hr_after (task_id uuid, eng_after int, fee_after int, kb_after int, settle_after int, remit_after int) ON COMMIT DROP;

DO $$
DECLARE
  v_run   boolean;
  v_n     int;
  v_after jsonb;
  r       RECORD;
BEGIN
  SELECT do_run INTO v_run FROM _hr_flag;
  SELECT count(*) INTO v_n FROM _hr_tgt;
  IF v_n > 200 THEN
    RAISE EXCEPTION '대상이 % 건입니다 (200건 초과). 실행하지 않았습니다.', v_n;
  END IF;

  BEGIN
    FOR r IN
      SELECT g.id FROM _hr_tgt g JOIN tasks t ON t.id = g.id
       WHERE t.status NOT IN ('취소', '취소요청', 'visit_only')
    LOOP
      PERFORM compute_payment(r.id);
    END LOOP;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', g.id, 'eng', p.engineer_amount, 'fee', p.owner_amount, 'kb', COALESCE(p.sub_principal_share, 0),
             'settle', COALESCE((SELECT SUM(l.fee) FROM subcontractor_settlement_lines l WHERE l.task_id = g.id), 0),
             'remit',  COALESCE((SELECT SUM(pl.delta) FROM principal_remit_lines pl WHERE pl.task_id = g.id), 0))), '[]'::jsonb)
      INTO v_after
      FROM _hr_tgt g
      JOIN tasks t ON t.id = g.id
      JOIN payments p ON p.task_id = g.id AND (p.track = 'S' OR t.subcontractor_id IS NULL);

    -- 미리 보기: 여기까지 한 계산(정산 값 · 차액 줄)을 전부 되돌린다 (v_after 값만 남는다)
    IF NOT v_run THEN
      RAISE EXCEPTION 'preview rollback' USING ERRCODE = 'P0078';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0078' THEN
    NULL;
  END;

  INSERT INTO _hr_after (task_id, eng_after, fee_after, kb_after, settle_after, remit_after)
  SELECT (e ->> 'id')::uuid, (e ->> 'eng')::int, (e ->> 'fee')::int, (e ->> 'kb')::int, (e ->> 'settle')::int, (e ->> 'remit')::int
    FROM jsonb_array_elements(v_after) e;
END $$;

DROP TABLE IF EXISTS _hr_rows;
CREATE TEMP TABLE _hr_rows AS
SELECT g.*, a.eng_after, a.fee_after, a.kb_after,
       -- 수행 몫: 협력사 = 공급가 - 수수료 (받은 금액이 없으면 저장된 협력사 보유분) / 직영 = 기사 몫
       CASE WHEN g.is_sub AND g.supply > 0 THEN g.supply - g.fee_before ELSE g.eng_before END AS perf_before,
       CASE WHEN g.is_sub AND g.supply > 0 THEN g.supply - a.fee_after  ELSE a.eng_after  END AS perf_after,
       (a.settle_after - g.settle_before) AS wc_line,
       -- 쿨가이 차액: 직영 = 이번에 실제로 송금 줄에 잡힌 차이 / 협력사 = 송금 줄에 오른 적이 있으면 (새 몫 - 이미 오른 금액)
       CASE WHEN NOT g.is_sub THEN a.remit_after - g.remit_before
            WHEN g.remit_cnt_before > 0 THEN a.kb_after - g.remit_before
            ELSE 0 END AS kb_diff
FROM _hr_tgt g JOIN _hr_after a ON a.task_id = g.id;

DROP TABLE IF EXISTS _hr_result;
CREATE TEMP TABLE _hr_result AS
SELECT 1 AS ord, NULL::text AS k,
       CASE WHEN (SELECT do_run FROM _hr_flag) THEN '▶ 실행함 (정정)' ELSE '▶ 미리 보기 (바꾼 것 없음)' END AS c1,
       NULL::text AS c2, NULL::text AS c3, NULL::text AS c4, NULL::text AS c5, NULL::int AS c6,
       NULL::text AS c7, NULL::text AS c8, NULL::text AS c9, NULL::boolean AS c10, NULL::int AS c11, NULL::int AS c12, NULL::boolean AS c13
UNION ALL
SELECT 2, NULL, '대상 ' || count(*) || '건 · 값이 바뀌는 작업 '
          || count(*) FILTER (WHERE fee_before IS DISTINCT FROM fee_after OR kb_before IS DISTINCT FROM kb_after OR eng_before IS DISTINCT FROM eng_after) || '건',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL FROM _hr_rows
UNION ALL
SELECT 3, NULL, '화이트코어 차액 줄 ' || count(*) FILTER (WHERE wc_line <> 0) || '개 · 합 ' || COALESCE(SUM(wc_line), 0),
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL FROM _hr_rows
UNION ALL
SELECT 4, NULL, '쿨가이 차액 ' || count(*) FILTER (WHERE kb_diff <> 0) || '건 · 합 ' || COALESCE(SUM(kb_diff), 0) || ' (음수 = 다음 송금에서 뺄 금액)',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL FROM _hr_rows
UNION ALL
SELECT 5, NULL, '가장 이른 후드 완료일 ' || COALESCE(min(done_kst)::text, '없음')
          || CASE WHEN min(done_kst) < DATE '2026-10-01' THEN ' ← 2026-10-01 보다 이릅니다. 그 작업은 옛 규칙 그대로입니다 (알려 주세요)' ELSE ' (규칙 시작일 2026-10-01 이후 ✓)' END,
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL FROM _hr_rows
UNION ALL
SELECT 10, COALESCE(done_kst::text, '9999') || task_no, task_no, COALESCE(done_kst::text, '완료 전 (' || status || ')'), performer, principal, items, received,
       perf_before || ' → ' || perf_after,
       kb_before || ' → ' || kb_after,
       (fee_before - kb_before) || ' → ' || (fee_after - kb_after),
       sent, wc_line, kb_diff, (fee_after - kb_after < 0)
FROM _hr_rows;

COMMIT;

SELECT c1 AS "작업번호", c2 AS "완료일", c3 AS "수행", c4 AS "원청", c5 AS "품목", c6 AS "받은 금액",
       c7 AS "수행 몫 전 → 후", c8 AS "쿨가이 몫 전 → 후", c9 AS "올데이케어 몫 전 → 후",
       c10 AS "이미 주고받음", c11 AS "화이트코어 차액 줄", c12 AS "쿨가이 차액", c13 AS "음수"
FROM _hr_result ORDER BY ord, k;
