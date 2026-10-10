-- ============================================================================
-- 협력사 미완료 작업의 예상 정산 다시 계산 - 블록 (79)(80)
-- 선행: mig 264, 265, 266, 267 실행
--
-- 쓰는 법
--   1) 그대로 실행 = 미리 보기. 실제 계산 함수로 다시 계산해 본 뒤 전부 되돌립니다 (아무것도 바뀌지 않음).
--   2) 아래 [실행 플래그] 줄의 false 를 true 로 바꿔 다시 실행 = 다시 계산.
--   ※ 파일 전체를 한 번에 실행해 주세요.
--
-- 대상 (전부 만족. 종목은 가리지 않음)
--   · 협력사가 지정돼 있음
--   · 아직 완료되지 않음 (완료 · 정산완료 · 취소 · 취소요청 · 출장비만 정산 제외)
--   · 정산 계산이 이미 있음 (직영 식으로 남아 있든 협력사 식이든 전부 - 블록 80 에서 넓힘)
--   100건을 넘으면 실행하지 않고 멈춘다.
--
-- 결과 표 (하나)
--   맨 위 2줄 = 요약: 모드 / 대상 n건
--   작업마다 한 줄: 작업번호 · 고객 · 상태 · 종목 · 품목 · 견적 · 계산 종류 전 → 후
--                   · 협력사 몫(예상) · 수수료 전 → 후 · 원청 몫 · 올데이케어 몫 · 비고
--   협력사 몫(예상) = 공급가 - 수수료. 공급가 = 받은 금액을 입력한 작업은 입력한 공급가, 입력 전이면 견적 (mig 267 과 같은 기준)
--   값이 그대로인 작업도 표에 나온다 (수수료 전 → 후 가 같은 줄).
--   올데이케어 몫 = 수수료 - 원청 몫
--   비고: 견적이 0 이면 "현장 견적 입력 필요", 계산이 안 된 작업은 사유
--   기대 (블록 79)
--     A-261010-001 · A-261008-007 (289,000)      -> 협력사 몫 200000 / 수수료 91954 → 89000 / 올데이케어 89000
--     A-261008-006 (198,000 x 2줄 = 396,000)     -> 협력사 몫 257400 / 수수료 126000 → 138600
--     A-261008-005 (견적 0)                       -> 전부 0, 비고 "현장 견적 입력 필요"
-- ============================================================================

BEGIN;

-- [실행 플래그] false = 미리 보기 / true = 다시 계산
CREATE TEMP TABLE _so_flag ON COMMIT DROP AS SELECT false AS do_run;

CREATE TEMP TABLE _so_tgt ON COMMIT DROP AS
SELECT t.id, t.task_no, t.customer_name, t.status,
       COALESCE((SELECT c.name FROM categories c WHERE c.id = t.category_id), '-') AS category,
       (SELECT string_agg(COALESCE(wt.name, '?') || ' x' || COALESCE(ti.qty, 1), ' + ' ORDER BY ti.unit_price DESC NULLS LAST)
          FROM task_items ti LEFT JOIN work_types wt ON wt.id = ti.work_type_id
         WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)) AS items,
       COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0) + COALESCE(t.travel_fee, 0) AS quote,
       (SELECT string_agg(p.track || ':' || COALESCE(p.calc_method, '-'), ', ') FROM payments p WHERE p.task_id = t.id) AS calc_before,
       (SELECT p.owner_amount FROM payments p WHERE p.task_id = t.id ORDER BY (p.track = 'S') DESC LIMIT 1) AS fee_before,
       COALESCE(t.supply_amount, 0) AS supply_in
FROM tasks t
WHERE t.subcontractor_id IS NOT NULL
  AND t.status NOT IN ('완료', '정산완료', '취소', '취소요청', 'visit_only')
  AND EXISTS (SELECT 1 FROM payments p WHERE p.task_id = t.id);

CREATE TEMP TABLE _so_after (task_id uuid, calc_after text, eng int, fee int, kb int, total int, err text) ON COMMIT DROP;

DO $$
DECLARE
  v_run   boolean;
  v_n     int;
  v_after jsonb := '[]'::jsonb;
  v_errs  jsonb := '{}'::jsonb;
  r       RECORD;
BEGIN
  SELECT do_run INTO v_run FROM _so_flag;
  SELECT count(*) INTO v_n FROM _so_tgt;
  IF v_n > 100 THEN
    RAISE EXCEPTION '대상이 % 건입니다 (100건 초과). 실행하지 않았습니다.', v_n;
  END IF;

  BEGIN
    FOR r IN
      SELECT g.id FROM _so_tgt g JOIN tasks t ON t.id = g.id
       WHERE t.subcontractor_id IS NOT NULL
         AND t.status NOT IN ('완료', '정산완료', '취소', '취소요청', 'visit_only')
    LOOP
      -- 한 작업이 계산되지 않아도(예: 수수료 규칙 없음) 나머지는 계속한다. 사유는 표의 비고에 나온다.
      BEGIN
        PERFORM compute_payment(r.id);
      EXCEPTION WHEN OTHERS THEN
        v_errs := v_errs || jsonb_build_object(r.id::text, SQLERRM);
      END;
    END LOOP;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', g.id,
             'calc', (SELECT string_agg(p.track || ':' || COALESCE(p.calc_method, '-'), ', ') FROM payments p WHERE p.task_id = g.id),
             'eng', (SELECT p.engineer_amount FROM payments p WHERE p.task_id = g.id ORDER BY (p.track = 'S') DESC LIMIT 1),
             'fee', (SELECT p.owner_amount    FROM payments p WHERE p.task_id = g.id ORDER BY (p.track = 'S') DESC LIMIT 1),
             'kb',  (SELECT COALESCE(p.sub_principal_share, 0) FROM payments p WHERE p.task_id = g.id ORDER BY (p.track = 'S') DESC LIMIT 1),
             'total', (SELECT p.product_price FROM payments p WHERE p.task_id = g.id ORDER BY (p.track = 'S') DESC LIMIT 1),
             'err', v_errs ->> g.id::text)), '[]'::jsonb)
      INTO v_after
      FROM _so_tgt g;

    -- 미리 보기: 여기까지 한 계산을 전부 되돌린다 (v_after 값만 남는다)
    IF NOT v_run THEN
      RAISE EXCEPTION 'preview rollback' USING ERRCODE = 'P0079';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0079' THEN
    NULL;
  END;

  INSERT INTO _so_after (task_id, calc_after, eng, fee, kb, total, err)
  SELECT (e ->> 'id')::uuid, e ->> 'calc', (e ->> 'eng')::int, (e ->> 'fee')::int, (e ->> 'kb')::int, (e ->> 'total')::int, e ->> 'err'
    FROM jsonb_array_elements(v_after) e;
END $$;

DROP TABLE IF EXISTS _so_result;
CREATE TEMP TABLE _so_result AS
SELECT 1 AS ord, NULL::text AS k,
       CASE WHEN (SELECT do_run FROM _so_flag) THEN '▶ 실행함 (다시 계산)' ELSE '▶ 미리 보기 (바꾼 것 없음)' END AS c1,
       NULL::text AS c2, NULL::text AS c3, NULL::text AS c4, NULL::text AS c5, NULL::int AS c6, NULL::text AS c7,
       NULL::int AS c8, NULL::text AS c9, NULL::int AS c10, NULL::int AS c11, NULL::text AS c12
UNION ALL
SELECT 2, NULL, '대상 ' || (SELECT count(*) FROM _so_tgt) || '건 · 수수료가 바뀌는 작업 '
          || (SELECT count(*) FROM _so_tgt g JOIN _so_after a ON a.task_id = g.id WHERE g.fee_before IS DISTINCT FROM a.fee)
          || '건 · 계산 안 된 작업 ' || (SELECT count(*) FROM _so_after WHERE err IS NOT NULL) || '건',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
UNION ALL
SELECT 10, g.task_no, g.task_no, g.customer_name, g.status, g.category, g.items, g.quote,
       COALESCE(g.calc_before, '-') || ' → ' || COALESCE(a.calc_after, '-'),
       -- 협력사 몫(예상) = 공급가 - 수수료. 공급가: 입력한 값이 있으면 그 값, 없으면 계산에 쓰인 합계(= 견적)
       (CASE WHEN g.supply_in > 0 THEN g.supply_in ELSE COALESCE(a.total, 0) END) - a.fee,
       COALESCE(g.fee_before::text, '-') || ' → ' || COALESCE(a.fee::text, '-'),
       a.kb, a.fee - a.kb,
       NULLIF(concat_ws(' · ',
         CASE WHEN g.quote <= 0 THEN '현장 견적 입력 필요' END,
         CASE WHEN a.err IS NOT NULL THEN '계산 안 됨: ' || a.err END,
         CASE WHEN a.fee - a.kb < 0 THEN '올데이케어 몫 음수' END), '')
FROM _so_tgt g JOIN _so_after a ON a.task_id = g.id;

COMMIT;

SELECT c1 AS "작업번호", c2 AS "고객", c3 AS "상태", c4 AS "종목", c5 AS "품목", c6 AS "견적",
       c7 AS "계산 종류 전 → 후", c8 AS "협력사 몫(예상)", c9 AS "수수료 전 → 후", c10 AS "원청 몫", c11 AS "올데이케어 몫", c12 AS "비고"
FROM _so_result ORDER BY ord, k;
