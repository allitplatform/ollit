-- ============================================================================
-- ad-hoc 2026-07-11 — 김종순 반쪽 전환 정리 (A-260711-033 ↔ inquiry 링크)
-- 사장님 리포트:
--   · task A-260711-033 생성됨 (phone 010-8326-5366).
--   · inquiry 는 여전히 status='contacted' + task_id=NULL.
--   · fire-and-forget catch 안 mark_inquiry_converted 호출 실패 → 조용히 넘어감.
--
-- 실행 흐름:
--   [A] 진단 — 김종순 inquiry / task / 중복 확인.
--   [B] 수동 링크 UPDATE (사장님 확인 후 주석 해제).
--   [C] 중복 정리 (있으면).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- [A-1] 김종순 inquiry — phone 010-8326-5366
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  id,
  status,
  task_id,
  name,
  phone,
  service_type,
  created_at,
  converted_at
FROM inquiries
WHERE phone IN ('01083265366','010-8326-5366')
   OR REPLACE(phone, '-', '') = '01083265366'
ORDER BY created_at DESC;


-- ─────────────────────────────────────────────────────────────────────────
-- [A-2] task A-260711-033 — 실제 id / customer / status 확인
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  id,
  task_no,
  customer_name,
  phone,
  status,
  assigned_engineer_id,
  created_at
FROM tasks
WHERE task_no = 'A-260711-033';


-- ─────────────────────────────────────────────────────────────────────────
-- [A-3] 같은 phone 으로 최근 3일 안 여러 task 생성됐는지 (중복 감지)
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  task_no,
  customer_name,
  phone,
  status,
  created_at,
  assigned_engineer_id
FROM tasks
WHERE (
  phone IN ('01083265366','010-8326-5366')
  OR REPLACE(phone, '-', '') = '01083265366'
)
  AND created_at > now() - interval '5 days'
ORDER BY created_at DESC;


-- ─────────────────────────────────────────────────────────────────────────
-- [A-4] 광역 스캔 — 최근 7일 안 반쪽 전환 (task 있는데 inquiry.task_id=NULL) 후보
--        전화번호 정규화 매칭 — inquiry.phone (숫자만) == task.phone (숫자만).
-- ─────────────────────────────────────────────────────────────────────────
WITH i AS (
  SELECT id AS inquiry_id, name, phone AS iphone,
         REGEXP_REPLACE(phone, '[^0-9]', '', 'g') AS iphone_digits,
         status, task_id, created_at
  FROM inquiries
  WHERE task_id IS NULL
    AND status IN ('new','contacted')
    AND created_at > now() - interval '7 days'
),
t AS (
  SELECT id AS task_id, task_no, customer_name, phone AS tphone,
         REGEXP_REPLACE(phone, '[^0-9]', '', 'g') AS tphone_digits,
         status, created_at
  FROM tasks
  WHERE created_at > now() - interval '7 days'
)
SELECT
  i.inquiry_id,
  i.name        AS inquiry_name,
  i.iphone      AS inquiry_phone,
  i.status      AS inquiry_status,
  i.created_at  AS inquiry_created,
  t.task_id,
  t.task_no,
  t.customer_name AS task_customer,
  t.status      AS task_status,
  t.created_at  AS task_created
FROM i
JOIN t ON i.iphone_digits = t.tphone_digits
ORDER BY i.created_at DESC;
-- 기대: 반쪽 전환 후보 리스트. 김종순 case 포함될 것.


-- ─────────────────────────────────────────────────────────────────────────
-- [B] 수동 링크 UPDATE — 사장님 [A-1] / [A-2] 결과 확인 후 주석 해제
-- ⚠️ inquiry_id 와 task_id 를 실제 값으로 정확히 대체할 것.
-- ─────────────────────────────────────────────────────────────────────────

/*
BEGIN;

-- 김종순 inquiry 마킹 — task_id 는 A-260711-033 의 UUID (SELECT id ... 로 확인).
UPDATE inquiries
SET status       = 'converted',
    task_id      = (SELECT id FROM tasks WHERE task_no = 'A-260711-033'),
    converted_at = now()
WHERE id = '<김종순 inquiry_id UUID>';

-- 확인
SELECT id, status, task_id, converted_at
FROM inquiries
WHERE id = '<김종순 inquiry_id UUID>';
-- 기대: status='converted' / task_id = A-260711-033 UUID / converted_at 방금.

-- COMMIT;   ← 확인 후 이 줄 주석 해제 + ROLLBACK 처리 후 재실행.
ROLLBACK;   -- 안전 기본값.
*/


-- ─────────────────────────────────────────────────────────────────────────
-- [C] 중복 task 처리 — [A-3] 결과에 여러 건 있으면
-- ─────────────────────────────────────────────────────────────────────────
-- 원칙:
--   · 최신 (created_at 가장 큰) 1건만 살리고 나머지는 취소 처리 (사장님 판단).
--   · 자동 삭제 X — 사장님이 각 task 상세 열어 확인 후 개별 취소.
--
-- 참고 조회 (배정된 것 우선 살림 판단용):
-- SELECT task_no, status, assigned_engineer_id, created_at,
--        (SELECT name FROM users WHERE id = t.assigned_engineer_id) AS engineer_name
-- FROM tasks t
-- WHERE REPLACE(phone, '-', '') = '01083265366'
--   AND created_at > now() - interval '5 days'
-- ORDER BY created_at DESC;


-- ============================================================================
-- 사장님 실행 순서:
--   1. [A-1] ~ [A-4] SELECT 실행 → 결과 저에게 리포트.
--      · 특히 [A-1] inquiry_id UUID, [A-3] 중복 여부, [A-4] 다른 반쪽 전환 후보.
--   2. inquiry_id 확정 후 [B] 블록 안 UUID 대체 → COMMIT.
--   3. [C] 중복 있으면 각 task 상세 열어 취소 처리.
-- ============================================================================
