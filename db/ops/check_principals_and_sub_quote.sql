-- ============================================================================
-- [조회 전용] 원청 코드 확인 + 협력사 작업의 견적·받은 금액 보관 상태
-- 작성 2026-10-07 · 실행은 사장님 · 아무것도 바꾸지 않습니다 (SELECT 뿐)
--
-- 마지막 표
--   "1 원청"        : 원청 전부 - code · 이름 · 작업번호 머리글자(있으면) · 사용 여부. 쿨가이가 어느 code 인지 확인.
--   "2 수수료 규칙" : 협력사 수수료 규칙(fee_rules) 현재 줄
--   "3 협력사 작업" : 협력사로 넘긴 작업 최근 20건 - 견적(product_price) · 받은 공급가(supply_amount) · 받은 합계
--                     · 지금 저장된 분배(협력사 보유 / 원청 / 올데이케어) · 작업 항목 단가 합계
--                     견적 칸과 항목 단가 합계가 같은지, 완료 뒤에도 견적이 남아 있는지 보려는 것.
-- ============================================================================
SELECT * FROM (
  SELECT '1 원청' AS 구분,
         p.code AS 대상,
         p.name AS 이름,
         COALESCE(to_jsonb(p) ->> 'prefix', to_jsonb(p) ->> 'task_prefix', to_jsonb(p) ->> 'task_no_prefix', '-') AS 값1,
         CASE WHEN COALESCE((to_jsonb(p) ->> 'active')::boolean, (to_jsonb(p) ->> 'is_active')::boolean, true) THEN '사용' ELSE '중지' END AS 값2,
         'id ' || p.id::text AS 내용,
         NULL::timestamptz AS 정렬
    FROM principals p
  UNION ALL
  SELECT '2 수수료 규칙',
         COALESCE((SELECT s.name FROM subcontractors s WHERE s.id = f.subcontractor_id), '?'),
         '원청 ' || COALESCE(f.principal_code, '(모두)') || ' · 서비스 ' || COALESCE(f.service_code, '(모두)'),
         f.fee_type || ' ' || COALESCE((f.fee_rate * 100)::text || '%', f.fee_amount::text || '원'),
         '기준 ' || f.fee_base || ' · ' || CASE WHEN f.active THEN '사용' ELSE '중지' END,
         '적용 시작 ' || f.effective_from::text || COALESCE(' · ' || f.memo, ''),
         f.created_at
    FROM fee_rules f
  UNION ALL
  SELECT * FROM (
    SELECT '3 협력사 작업',
           t.task_no,
           COALESCE(t.customer_name, '') || ' · ' || t.status || ' · 원청 ' || COALESCE((SELECT pr.code FROM principals pr WHERE pr.id = t.principal_id), '-'),
           '견적 ' || COALESCE(t.product_price, 0) || ' / 항목 단가 합계 ' ||
             COALESCE((SELECT SUM(ti.qty * ti.unit_price)::int FROM task_items ti WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)), 0),
           '받은 공급가 ' || COALESCE(t.supply_amount, 0) || ' / 받은 합계 ' || COALESCE(t.received_total, 0),
           COALESCE((SELECT '분배: 협력사 ' || p.engineer_amount || ' / 원청 ' || p.principal_amount || ' / 올데이케어 ' || p.owner_amount
                       FROM payments p WHERE p.task_id = t.id AND p.track = 'S' LIMIT 1), '분배 없음(미완료)'),
           t.received_at
      FROM tasks t
     WHERE t.subcontractor_id IS NOT NULL
     ORDER BY t.received_at DESC NULLS LAST
     LIMIT 20
  ) q
) r
ORDER BY 1, 7 DESC NULLS LAST, 2;
