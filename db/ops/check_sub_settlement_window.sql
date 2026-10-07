-- ============================================================================
-- [조회 전용] 협력사 정산 기록 한눈에 보기 (기간)
-- 작성 2026-10-07 · 실행은 사장님 · 아무것도 바꾸지 않습니다 (SELECT 뿐)
--
-- 쓰는 법: 아래 [입력] 의 협력사 코드 · 시작일 · 끝일을 바꿔 전체 실행. 기본 = 화이트코어, 2026-10-06 ~ 2026-10-08.
--
-- 마지막 표 (구분 순서대로)
--   "1 작업"          : 그 기간에 완료된 그 협력사 작업 - 완료 시각 · 담당 · 공급가 · 수수료 · 원청 몫
--   "2 기사 보고"     : 기사 -> 협력사 [보냄]/[받음] 기록 (subcontractor_staff_remits)
--                       값1 = 보고 당시 자체 금액(calc_own) / 지금 다시 계산한 금액
--                       내용 = "보고 뒤에 완료된 작업만 있음" 이면 그 보고가 가리키던 작업이 지금은 없는 것 (지운 시험 작업의 흔적)
--   "3 일일 정산"     : 협력사 -> 올데이케어 날짜별 정산 (subcontractor_daily_settlements) + 그 날짜의 줄 수
--   "4 정산 줄"       : 날짜별 줄 (base = 그날 작업 / adjust = 잠금 뒤 조정). origin 이 있으면 이월돼 온 줄
--   "5 원청 송금 줄"  : 원청에 보낼 돈 (principal_remits) + 작업 줄 수
-- ============================================================================
WITH input AS (
  -- ▼▼▼ [입력] 협력사 코드 / 시작일 / 끝일 ▼▼▼
  SELECT 'whitecore'::text AS sub_code, DATE '2026-10-06' AS d1, DATE '2026-10-08' AS d2
  -- ▲▲▲
),
s AS (SELECT sc.id, sc.name, i.d1, i.d2 FROM subcontractors sc JOIN input i ON sc.code = i.sub_code)
SELECT * FROM (
  SELECT '1 작업' AS 구분,
         (t.completed_at AT TIME ZONE 'Asia/Seoul')::date AS 날짜,
         t.task_no AS 대상,
         '공급가 ' || COALESCE(t.supply_amount, 0) AS 값1,
         '수수료 ' || COALESCE((SELECT SUM(p.owner_amount) FROM payments p WHERE p.task_id = t.id AND p.track = 'S'), 0)
           || ' / 원청 몫 ' || COALESCE((SELECT SUM(p.sub_principal_share) FROM payments p WHERE p.task_id = t.id AND p.track = 'S'), 0) AS 값2,
         t.status || ' · ' || COALESCE(t.customer_name, '') || ' · 담당 ' || COALESCE((SELECT u.name FROM users u WHERE u.id = t.assigned_engineer_id), '-')
           || ' · 완료 ' || to_char(t.completed_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS 내용
    FROM tasks t JOIN s ON t.subcontractor_id = s.id
   WHERE t.completed_at IS NOT NULL
     AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN s.d1 AND s.d2
  UNION ALL
  SELECT '2 기사 보고', r.settle_date,
         COALESCE((SELECT u.name FROM users u WHERE u.id = r.engineer_id), '?'),
         '보고 당시 ' || r.calc_own || ' / 지금 ' || (SELECT o.own FROM _sub_staff_own(r.subcontractor_id, r.engineer_id, r.settle_date) o),
         '보낸 금액 ' || r.amount || ' (지난 변동분 ' || r.adjust_in || ')',
         CASE WHEN r.carried_to IS NOT NULL THEN '이월 -> ' || r.carried_to::text
              WHEN r.received_at IS NOT NULL THEN '받음 ' || to_char(r.received_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI')
              ELSE '보냄 (받음 확인 전)' END
           || ' · 보고 ' || to_char(r.reported_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI')
           || CASE
                WHEN NOT EXISTS (SELECT 1 FROM tasks t WHERE t.subcontractor_id = r.subcontractor_id AND t.assigned_engineer_id = r.engineer_id
                                    AND t.status = '완료' AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date = r.settle_date)
                  THEN ' · ⚠ 이 날짜에 그 기사의 완료 작업이 없음'
                WHEN NOT EXISTS (SELECT 1 FROM tasks t WHERE t.subcontractor_id = r.subcontractor_id AND t.assigned_engineer_id = r.engineer_id
                                    AND t.status = '완료' AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date = r.settle_date
                                    AND t.completed_at <= r.reported_at)
                  THEN ' · ⚠ 보고 뒤에 완료된 작업만 있음 (보고가 가리키던 작업이 지금은 없음)'
                ELSE '' END
    FROM subcontractor_staff_remits r JOIN s ON r.subcontractor_id = s.id
   WHERE r.settle_date BETWEEN s.d1 AND s.d2
  UNION ALL
  SELECT '3 일일 정산', d.settle_date, s.name,
         '계산 수수료 ' || d.calc_fee || ' / ' || d.task_count || '건',
         '보고 ' || COALESCE(d.reported_amount::text, '-'),
         CASE WHEN d.confirmed_at IS NOT NULL THEN '입금 확인됨' WHEN d.reported_at IS NOT NULL THEN '송금 보고됨' ELSE '잠김' END
           || ' · 줄 ' || (SELECT COUNT(*) FROM subcontractor_settlement_lines l WHERE l.subcontractor_id = d.subcontractor_id AND l.settle_date = d.settle_date) || '개'
           || COALESCE(' · ' || d.note, '')
    FROM subcontractor_daily_settlements d JOIN s ON d.subcontractor_id = s.id
   WHERE d.settle_date BETWEEN s.d1 AND s.d2
  UNION ALL
  SELECT '4 정산 줄', l.settle_date,
         COALESCE((SELECT t.task_no FROM tasks t WHERE t.id = l.task_id), l.task_id::text),
         l.kind || ' · 수수료 ' || l.fee,
         '받은 금액 ' || l.received || ' / 공급가 ' || l.supply,
         COALESCE('원래 날짜 ' || l.origin_date::text || ' · ', '') || COALESCE(l.memo, '')
    FROM subcontractor_settlement_lines l JOIN s ON l.subcontractor_id = s.id
   WHERE l.settle_date BETWEEN s.d1 AND s.d2
  UNION ALL
  SELECT '5 원청 송금 줄', pr.settle_date,
         COALESCE((SELECT p.code FROM principals p WHERE p.id = pr.principal_id), '?'),
         '보낼 금액 ' || pr.amount || ' (넘겨받음 ' || pr.carried_in || ')',
         '작업 줄 ' || (SELECT COUNT(*) FROM principal_remit_lines pl WHERE pl.remit_id = pr.id) || '개',
         CASE WHEN pr.paid_at IS NOT NULL THEN '송금 완료' WHEN pr.absorbed_into IS NOT NULL THEN '다음 줄로 넘어감' ELSE '미송금' END
    FROM principal_remits pr JOIN s ON pr.subcontractor_id = s.id
   WHERE pr.settle_date BETWEEN s.d1 AND s.d2
) r
ORDER BY 1, 2, 3;
