-- ============================================================================
-- KA-260808-004 - 정산·변경 이력 조회 (드라이런에서 저장값과 계산값이 달랐던 1건)
-- 작성 2026-10-06 · 읽기 전용 (SELECT 만)
--
-- Supabase SQL Editor 는 마지막 결과만 보여주므로 [1]~[4] 를 하나씩 실행해 주세요.
-- 결과 4개를 보내 주시면 원인(금액 수정 후 재계산 누락 / 수동 조정 / 규칙 차이)을 판단하겠습니다.
-- ============================================================================

-- [1] 작업 + 저장된 정산
SELECT
  t.task_no, t.status, pr.code AS 원청, u.name AS 기사, u.refrigerant_rate AS 기사_냉매비율,
  t.product_price AS 견적, t.extra_fee AS 추가금, t.travel_fee AS 출장비,
  t.received_total AS 받은금액, t.material_cost AS 자재비, t.payment_method AS 결제방식,
  to_char(t.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS 완료,
  to_char(t.updated_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS 작업_수정,
  p.engineer_amount AS 저장_기사, p.principal_amount AS 저장_원청, p.owner_amount AS 저장_회사,
  p.calc_method, p.policy_key, p.track, p.compute_error,
  to_char(p.computed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS 정산_계산시각,
  p.engineer_remitted_at, p.engineer_remit_confirmed_at
FROM tasks t
LEFT JOIN payments p    ON p.task_id = t.id
LEFT JOIN principals pr ON pr.id = t.principal_id
LEFT JOIN users u       ON u.id = t.assigned_engineer_id
WHERE t.task_no = 'KA-260808-004';

-- [2] 작업 항목
SELECT
  st.code AS 서비스, wt.name AS 작업, at.name AS 기종,
  ti.qty, ti.unit_price, ti.subtotal, ti.order_type, ti.received_amount,
  ti.is_canceled, ti.canceled_reason,
  to_char(ti.canceled_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS 취소시각
FROM task_items ti
JOIN tasks t                 ON t.id = ti.task_id
LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
LEFT JOIN service_types st   ON st.id = wt.service_type_id
LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
WHERE t.task_no = 'KA-260808-004'
ORDER BY ti.order_type NULLS LAST;

-- [3] 변경 이력 (누가·언제·무엇을)
SELECT
  to_char(c.changed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS 시각,
  c.change_type, c.changed_by_name, c.changed_by_role, c.note,
  c.before_data, c.after_data
FROM task_changes c
JOIN tasks t ON t.id = c.task_id
WHERE t.task_no = 'KA-260808-004'
ORDER BY c.changed_at;

-- [4] 지금 함수로 다시 계산하면 나오는 값 (저장하지 않음 - mig 216a 의 드라이런 함수 사용)
SELECT
  compute_payment_v29_dryrun(t.id) AS 현재_함수_계산값
FROM tasks t
WHERE t.task_no = 'KA-260808-004';
