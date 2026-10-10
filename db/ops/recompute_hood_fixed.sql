-- ============================================================================
-- 주방후드 협력사 작업 다시 계산 (쿨가이 정액 · 화이트코어 보장) - 블록 (77)
-- 선행: mig 264 실행, db/ops/verify_hood_fixed.sql 에서 "전체" 줄이 true
--
-- 쓰는 법
--   1) 그대로 실행 = 미리 보기. 실제로 다시 계산해 본 뒤 전부 되돌립니다 (아무것도 바뀌지 않음).
--   2) 아래 [실행 플래그] 줄의 false 를 true 로 바꿔 다시 실행 = 다시 계산.
--   ※ 파일 전체를 한 번에 실행해 주세요.
--
-- 대상 (전부 만족)
--   · 협력사로 넘긴 작업 (직영 기사 작업은 대상이 아님)        · 종목이 주방후드
--   · 취소 · 취소요청 · 출장비만 정산이 아님                    · 협력사 정산 계산이 이미 있는 작업
--   · 아직 완료되지 않았거나, 2026-10-10 00:00 이후에 완료됨
--   그 가운데 "보낸 적 있음" 인 작업은 표에 보여 주기만 하고 다시 계산하지 않는다:
--     · 화이트코어가 수수료를 보냈다고 알렸거나(보고) 올데이케어가 받음 확인한 날짜에 들어 있는 작업
--     · 쿨가이에 [송금 완료] 한 줄에 들어 있는 작업
--   다시 계산할 작업이 100건을 넘으면 실행하지 않고 멈춘다.
--
-- 결과 표 (하나)
--   맨 위 2줄 = 요약: 모드 / 다시 계산 n건 · 보낸 적 있어 건너뜀 n건
--   그 아래 작업마다 한 줄:
--     작업번호 · 원청 · 품목 · 받은 금액 · 화이트코어 몫 전 → 후 · 쿨가이 몫 전 → 후 · 올데이케어 몫(후) · 음수 · 보낸 적 있음
--   화이트코어 몫 = 공급가 - 수수료,  올데이케어 몫 = 수수료 - 쿨가이 몫
--   "음수" 는 전부 false 여야 한다. "보낸 적 있음" = true 인 줄은 전 = 후 (건드리지 않음).
--   미리 보기와 실행 뒤의 "후" 값은 같아야 한다.
-- ============================================================================

BEGIN;

-- [실행 플래그] false = 미리 보기 / true = 다시 계산
CREATE TEMP TABLE _hf_flag ON COMMIT DROP AS SELECT false AS do_run;

CREATE TEMP TABLE _hf_tgt ON COMMIT DROP AS
SELECT t.id, t.task_no, t.status,
       COALESCE(pr.name, '-') AS principal,
       (SELECT string_agg(COALESCE(wt.name, '?') || ' x' || COALESCE(ti.qty, 1), ' + ' ORDER BY ti.unit_price DESC NULLS LAST)
          FROM task_items ti LEFT JOIN work_types wt ON wt.id = ti.work_type_id
         WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)) AS items,
       COALESCE(NULLIF(t.received_total, 0), p.product_price, 0) AS received,
       COALESCE(NULLIF(t.supply_amount, 0), ROUND(COALESCE(NULLIF(t.received_total, 0), p.product_price, 0) / 1.1)::int) AS supply,
       p.owner_amount AS fee_before,
       COALESCE(p.sub_principal_share, 0) AS kb_before,
       (EXISTS (SELECT 1 FROM subcontractor_settlement_lines l
                  JOIN subcontractor_daily_settlements d
                    ON d.subcontractor_id = l.subcontractor_id AND d.settle_date = l.settle_date
                 WHERE l.task_id = t.id AND (d.reported_at IS NOT NULL OR d.confirmed_at IS NOT NULL))
        OR EXISTS (SELECT 1 FROM principal_remit_lines pl JOIN principal_remits rm ON rm.id = pl.remit_id
                    WHERE pl.task_id = t.id AND rm.paid_at IS NOT NULL)) AS sent
FROM tasks t
JOIN payments p ON p.task_id = t.id AND p.track = 'S'
LEFT JOIN principals pr ON pr.id = t.principal_id
WHERE t.subcontractor_id IS NOT NULL
  AND t.category_id = (SELECT id FROM categories WHERE code = 'hood' LIMIT 1)
  AND t.status NOT IN ('취소', '취소요청', 'visit_only')
  AND (t.status NOT IN ('완료', '정산완료')
       OR t.completed_at >= '2026-10-10 00:00:00 Asia/Seoul'::timestamptz);

CREATE TEMP TABLE _hf_after (task_id uuid, fee_after int, kb_after int) ON COMMIT DROP;

DO $$
DECLARE
  v_run   boolean;
  v_n     int;
  v_after jsonb;
  r       RECORD;
BEGIN
  SELECT do_run INTO v_run FROM _hf_flag;
  SELECT count(*) INTO v_n FROM _hf_tgt WHERE NOT sent;
  IF v_n > 100 THEN
    RAISE EXCEPTION '다시 계산할 작업이 % 건입니다 (100건 초과). 실행하지 않았습니다.', v_n;
  END IF;

  BEGIN
    FOR r IN
      -- 실행 직전에 한 번 더 확인 (그 사이 취소 · 직영으로 회수된 작업 제외)
      SELECT g.id FROM _hf_tgt g JOIN tasks t ON t.id = g.id
       WHERE NOT g.sent AND t.subcontractor_id IS NOT NULL AND t.status NOT IN ('취소', '취소요청', 'visit_only')
    LOOP
      PERFORM compute_payment(r.id);
    END LOOP;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', g.id, 'fee', p.owner_amount, 'kb', COALESCE(p.sub_principal_share, 0))), '[]'::jsonb)
      INTO v_after
      FROM _hf_tgt g JOIN payments p ON p.task_id = g.id AND p.track = 'S';

    -- 미리 보기: 여기까지 한 계산을 전부 되돌린다 (v_after 값만 남는다)
    IF NOT v_run THEN
      RAISE EXCEPTION 'preview rollback' USING ERRCODE = 'P0077';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0077' THEN
    NULL;
  END;

  INSERT INTO _hf_after (task_id, fee_after, kb_after)
  SELECT (e ->> 'id')::uuid, (e ->> 'fee')::int, (e ->> 'kb')::int FROM jsonb_array_elements(v_after) e;
END $$;

DROP TABLE IF EXISTS _hf_result;
CREATE TEMP TABLE _hf_result AS
SELECT 1 AS ord, NULL::text AS k,
       CASE WHEN (SELECT do_run FROM _hf_flag) THEN '▶ 실행함 (다시 계산)' ELSE '▶ 미리 보기 (바꾼 것 없음)' END AS c1,
       NULL::text AS c2, NULL::text AS c3, NULL::int AS c4, NULL::text AS c5, NULL::text AS c6, NULL::int AS c7, NULL::boolean AS c8, NULL::boolean AS c9
UNION ALL
SELECT 2, NULL,
       '다시 계산 ' || (SELECT count(*) FROM _hf_tgt WHERE NOT sent) || '건 · 보낸 적 있어 건너뜀 ' || (SELECT count(*) FROM _hf_tgt WHERE sent) || '건',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
UNION ALL
SELECT 10, g.task_no, g.task_no, g.principal, g.items, g.received,
       (g.supply - g.fee_before) || ' → ' || (g.supply - a.fee_after),
       g.kb_before || ' → ' || a.kb_after,
       a.fee_after - a.kb_after,
       (a.fee_after - a.kb_after < 0),
       g.sent
FROM _hf_tgt g JOIN _hf_after a ON a.task_id = g.id;

COMMIT;

SELECT c1 AS "작업번호", c2 AS "원청", c3 AS "품목", c4 AS "받은 금액",
       c5 AS "화이트코어 몫 전 → 후", c6 AS "쿨가이 몫 전 → 후", c7 AS "올데이케어 몫(후)", c8 AS "음수", c9 AS "보낸 적 있음"
FROM _hf_result ORDER BY ord, k;
