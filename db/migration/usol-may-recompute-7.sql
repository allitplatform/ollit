-- Fix #31 - payments 7건 누락 task 재계산 SQL
-- 작성일: 2026-05-19
-- 선행: Migration 035 (commission_policies 신규 정책) + Migration 036 (compute_payment v11) 실행 완료
-- 실행: Supabase SQL Editor 통째 복붙 후 Run. 7 task에 payments row 생성.

-- ============================================
-- [1] payments 없는 task 식별 + 재계산 (자동)
-- ============================================
SELECT
  t.task_no,
  compute_payment(t.id) AS payment_id,
  t.status
FROM tasks t
LEFT JOIN payments p ON p.task_id = t.id
WHERE t.task_no LIKE 'YS-%' AND p.id IS NULL;

-- ============================================
-- 검증 SQL (별도 실행)
-- ============================================

-- (a) payments 총 카운트 (기대: 769)
-- SELECT COUNT(*) AS total_payments FROM payments p
-- JOIN tasks t ON t.id = p.task_id WHERE t.task_no LIKE 'YS-%';

-- (b) payments 없는 task 0건 확인 (기대: 0 row)
-- SELECT t.task_no, t.status FROM tasks t
-- LEFT JOIN payments p ON p.task_id = t.id
-- WHERE t.task_no LIKE 'YS-%' AND p.id IS NULL;

-- (c) 트랙 분포 재확인 (기대: A 7, B 762)
-- SELECT track, COUNT(*) FROM payments p
-- JOIN tasks t ON t.id = p.task_id WHERE t.task_no LIKE 'YS-%'
-- GROUP BY track ORDER BY track;

-- (d) 추가선택 옵션 정산 검증 (기대: engineer_amount > 0 인 task 다수)
-- SELECT t.task_no, p.engineer_amount, p.principal_amount, p.owner_amount,
--        p.calc_method, p.track
-- FROM tasks t JOIN payments p ON p.task_id = t.id
-- WHERE t.task_no LIKE 'YS-%' AND p.calc_method LIKE 'usol_n_%'
-- LIMIT 10;
