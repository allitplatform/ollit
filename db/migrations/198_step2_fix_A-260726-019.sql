-- STEP 2 - after Mig 198 is committed.
-- Set the material cost for A-260726-019, then recompute.
-- Owner confirmed 2026-07-28: material cost for this install = 1,300,000

UPDATE tasks SET material_cost = 1300000
 WHERE task_no = 'A-260726-019';

SELECT compute_payment(id) FROM tasks WHERE task_no = 'A-260726-019';

UPDATE payments SET compute_error = NULL
 WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'A-260726-019');

SELECT t.task_no,
       t.material_cost    AS 재료값,
       t.product_price + t.extra_fee + t.travel_fee AS 총금액,
       p.engineer_amount  AS 기사몫,
       p.owner_amount     AS 회사몫,
       p.principal_amount AS 원청몫,
       p.calc_method      AS 계산방식,
       p.compute_error    AS 오류,
       p.is_balanced      AS 정합
FROM tasks t
JOIN payments p ON p.task_id = t.id
WHERE t.task_no = 'A-260726-019';
