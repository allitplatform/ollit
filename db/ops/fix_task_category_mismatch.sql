-- ============================================================================
-- 작업 종목 보정 - tasks.category_id 를 작업 항목(서비스)의 종목으로 맞춤
-- 작성 2026-10-07 · 실행은 사장님 · 먼저 db/ops/check_task_category_mismatch.sql 결과를 확인한 뒤에
--
-- 대상 (기본: 좁게)
--   · 항목의 종목이 "한 가지" 로 정해지고, 그 값이 지금 저장된 종목과 다른 작업
--   · [입력 B] 범위 = 'sub'  : 협력사로 넘긴 작업 + [입력 C] 에 적은 작업번호만 (기본값 - 급한 것만)
--                범위 = 'all'  : 어긋난 작업 전부 (조회 결과를 Claude 와 확인한 뒤에만)
--   · 종목이 섞인("혼합") 작업, 항목으로 종목을 알 수 없는 작업은 건드리지 않습니다.
--
-- 바꾸는 것: tasks.category_id 한 칸뿐. 금액 · 정산 · 상태 · 항목은 건드리지 않습니다.
--   바꾸기 전 값은 _backup_261007_task_category 표에 남깁니다 (앱에서는 읽을 수 없게 잠금).
--   되돌리기: UPDATE tasks t SET category_id = b.old_category_id FROM _backup_261007_task_category b WHERE b.task_id = t.id;
--
-- 쓰는 법 - 파일 전체를 한 번에 실행합니다.
--   1) [입력 A] 실행 = false -> 마지막 표가 "미리 보기" (아무것도 바꾸지 않음)
--   2) 결과 확인
--   3) [입력 A] 실행 = true  -> 보정하고, 마지막 표가 "9 확인"
--
-- 안전장치: 바꿀 작업이 [입력 D] 상한(기본 50건)을 넘으면 아무것도 바꾸지 않고 멈춥니다.
-- ============================================================================

DROP TABLE IF EXISTS _result;

BEGIN;

CREATE TEMP TABLE _in (run boolean, scope text, max_rows int) ON COMMIT DROP;
CREATE TEMP TABLE _in_task (task_no text) ON COMMIT DROP;
CREATE TEMP TABLE _out (grp text, target text, now_cat text, want_cat text, note text) ON COMMIT DROP;

-- ▼▼▼ [입력 A·B·D] 실행 여부 / 범위('sub' 또는 'all') / 상한 건수 ▼▼▼
INSERT INTO _in VALUES (false, 'sub', 50);
-- ▲▲▲
-- ▼▼▼ [입력 C] 범위가 'sub' 여도 함께 고칠 작업번호 (협력사로 넘기기 전인 작업 등). 여러 줄 가능 ▼▼▼
INSERT INTO _in_task VALUES ('A-261007-001');
-- ▲▲▲

DO $$
DECLARE
  v_run   boolean;
  v_scope text;
  v_max   int;
  v_n     int;
BEGIN
  SELECT run, lower(btrim(scope)), max_rows INTO v_run, v_scope, v_max FROM _in LIMIT 1;
  IF v_scope NOT IN ('sub', 'all') THEN
    RAISE EXCEPTION '[입력 B] 범위는 sub 또는 all 이어야 합니다 (지금: %).', v_scope;
  END IF;

  CREATE TEMP TABLE _target ON COMMIT DROP AS
  WITH item_cat AS (
    SELECT ti.task_id, st.category_id
      FROM task_items ti
      JOIN work_types wt    ON wt.id = ti.work_type_id
      JOIN service_types st ON st.id = wt.service_type_id
     WHERE NOT COALESCE(st.is_common, false)
    UNION ALL
    SELECT t.id, st.category_id
      FROM tasks t
     CROSS JOIN LATERAL jsonb_array_elements(
             CASE WHEN jsonb_typeof(t.category_data -> 'workItems') = 'array' THEN t.category_data -> 'workItems' ELSE '[]'::jsonb END) AS w
      JOIN service_types st
        ON true
       AND st.name = split_part(CASE WHEN jsonb_typeof(w) = 'string' THEN w #>> '{}'
                                     ELSE COALESCE(w ->> 'workType', w ->> 'name', '') END, '_', 1)
       AND NOT COALESCE(st.is_common, false)
     WHERE NOT EXISTS (SELECT 1 FROM task_items ti WHERE ti.task_id = t.id)
  ),
  expect AS (
    SELECT task_id, COUNT(DISTINCT category_id) AS n_cat, MIN(category_id::text)::uuid AS category_id
      FROM item_cat GROUP BY task_id
  )
  SELECT t.id AS task_id, t.task_no, t.status, t.customer_name, t.category_id AS old_category_id, e.category_id AS new_category_id
    FROM tasks t JOIN expect e ON e.task_id = t.id
   WHERE e.n_cat = 1
     AND e.category_id IS NOT NULL
     AND t.category_id IS DISTINCT FROM e.category_id
     AND (v_scope = 'all'
          OR t.subcontractor_id IS NOT NULL
          OR t.task_no IN (SELECT btrim(task_no) FROM _in_task));

  SELECT COUNT(*) INTO v_n FROM _target;

  INSERT INTO _out
  SELECT '1 바꿀 작업', x.task_no,
         COALESCE((SELECT c.name FROM categories c WHERE c.id = x.old_category_id), '(없음)'),
         (SELECT c.name FROM categories c WHERE c.id = x.new_category_id),
         x.status || ' · ' || COALESCE(x.customer_name, '')
    FROM _target x;

  IF NOT COALESCE(v_run, false) THEN
    INSERT INTO _out VALUES ('9 안내', '미리 보기', NULL, NULL,
      v_n || '건을 바꿀 예정입니다 (범위 ' || v_scope || '). 아무것도 바꾸지 않았습니다. 보정하려면 [입력 A] 를 true 로.');
    RETURN;
  END IF;

  IF v_n = 0 THEN
    RAISE EXCEPTION '바꿀 작업이 없습니다. 아무것도 하지 않았습니다.';
  END IF;
  IF v_n > v_max THEN
    RAISE EXCEPTION '바꿀 작업이 %건으로 상한(%건)을 넘습니다. 조회 결과를 확인한 뒤 [입력 D] 를 올려 주세요. 아무것도 바꾸지 않았습니다.', v_n, v_max;
  END IF;

  CREATE TABLE IF NOT EXISTS _backup_261007_task_category (
    task_id uuid, task_no text, old_category_id uuid, new_category_id uuid, changed_at timestamptz DEFAULT now());
  ALTER TABLE _backup_261007_task_category ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE _backup_261007_task_category FROM anon, authenticated;
  INSERT INTO _backup_261007_task_category (task_id, task_no, old_category_id, new_category_id)
  SELECT task_id, task_no, old_category_id, new_category_id FROM _target;

  UPDATE tasks t SET category_id = x.new_category_id
    FROM _target x WHERE x.task_id = t.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO _out VALUES ('9 확인', '바꾼 작업', NULL, NULL, v_n || '건 · 이전 값: _backup_261007_task_category');
END $$;

CREATE TEMP TABLE _result ON COMMIT PRESERVE ROWS AS
SELECT grp AS 구분, target AS 대상, now_cat AS 현재_종목, want_cat AS 바꿀_종목, note AS 내용 FROM _out;

COMMIT;

SELECT * FROM _result ORDER BY 1, 2;
