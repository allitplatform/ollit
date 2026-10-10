-- ============================================================================
-- 확인 (읽기만 합니다) - 아직 완료되지 않은 주방후드 작업이 왜 "다시 계산" 대상이 아니었는지 - 블록 (78)
--   db/ops/recompute_hood_fixed.sql 의 대상 조건을 작업마다 true / false 로 보여 줍니다.
--   결과 표 하나. 명태골(안양 만안구, 10/12) 줄을 찾아 어느 칸이 false 인지 보면 됩니다.
--
-- 칸
--   작업번호 · 고객 · 상태 · 원청 · 협력사 · 품목(이름) · 품목 코드
--   협력사 작업 / 종목이 주방후드 / 취소 · 출장비만 아님 / 협력사 정산 계산 있음 = recompute_hood_fixed 의 대상 조건 4개
--   대상 = 4개가 모두 true
--   규칙 걸리는 코드 = 품목 코드 가운데 hood_commercial_m / hood_commercial_s 가 있는지 (없으면 정액 · 보장이 걸리지 않음)
-- ============================================================================
SELECT t.task_no AS "작업번호",
       t.customer_name AS "고객",
       t.status AS "상태",
       COALESCE(pr.name, '-') AS "원청",
       COALESCE(s.name, '(직영)') AS "협력사",
       (SELECT string_agg(COALESCE(wt.name, '?') || ' x' || COALESCE(ti.qty, 1) || ' @' || COALESCE(ti.unit_price, 0), ' + ')
          FROM task_items ti LEFT JOIN work_types wt ON wt.id = ti.work_type_id
         WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)) AS "품목",
       (SELECT string_agg(COALESCE(wt.code, '(코드 없음)'), ' + ')
          FROM task_items ti LEFT JOIN work_types wt ON wt.id = ti.work_type_id
         WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)) AS "품목 코드",
       (t.subcontractor_id IS NOT NULL) AS "협력사 작업",
       (t.category_id IS NOT DISTINCT FROM (SELECT id FROM categories WHERE code = 'hood' LIMIT 1)) AS "종목이 주방후드",
       (t.status NOT IN ('취소', '취소요청', 'visit_only')) AS "취소 · 출장비만 아님",
       EXISTS (SELECT 1 FROM payments p WHERE p.task_id = t.id AND p.track = 'S') AS "협력사 정산 계산 있음",
       (t.subcontractor_id IS NOT NULL
        AND t.category_id IS NOT DISTINCT FROM (SELECT id FROM categories WHERE code = 'hood' LIMIT 1)
        AND t.status NOT IN ('취소', '취소요청', 'visit_only')
        AND EXISTS (SELECT 1 FROM payments p WHERE p.task_id = t.id AND p.track = 'S')) AS "대상",
       EXISTS (SELECT 1 FROM task_items ti JOIN work_types wt ON wt.id = ti.work_type_id
                WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)
                  AND wt.code IN ('hood_commercial_m', 'hood_commercial_s')) AS "규칙 걸리는 코드",
       (SELECT string_agg(p.track || ':' || COALESCE(p.calc_method, '-'), ', ') FROM payments p WHERE p.task_id = t.id) AS "정산 계산(있는 것)"
FROM tasks t
LEFT JOIN principals pr ON pr.id = t.principal_id
LEFT JOIN subcontractors s ON s.id = t.subcontractor_id
WHERE t.status NOT IN ('완료', '정산완료', '취소')
  AND (t.category_id IS NOT DISTINCT FROM (SELECT id FROM categories WHERE code = 'hood' LIMIT 1)
       OR EXISTS (SELECT 1 FROM task_items ti
                    JOIN work_types wt ON wt.id = ti.work_type_id
                    JOIN service_types st ON st.id = wt.service_type_id
                    JOIN categories c ON c.id = st.category_id
                   WHERE ti.task_id = t.id AND c.code = 'hood'))
ORDER BY t.created_at DESC
LIMIT 50;
