-- ============================================================================
-- ad-hoc 2026-07-12 — 010-3220-2238 인천 연수구 KA 냉매 접수 저장 확인
-- 사장님 리포트:
--   Mig 173 부작용 (NOT NULL 위반) 로 접수 저장 자체가 실패.
--   저장됐는지 여부 확인 필요. 미저장이면 UI 재접수.
-- ============================================================================


-- ── [A] phone 매칭 — 오늘/어제 접수 ────────────────────────────────
SELECT
  t.task_no,
  t.customer_name,
  t.phone,
  t.address,
  t.status,
  pr.code AS principal_code,
  t.created_at,
  t.product_price
FROM tasks t
LEFT JOIN principals pr ON pr.id = t.principal_id
WHERE (
  REPLACE(t.phone, '-', '') = '01032202238'
  OR t.phone LIKE '%3220-2238%'
)
  AND t.created_at > now() - interval '2 days'
ORDER BY t.created_at DESC;
-- 기대: 있으면 저장 성공 (역설적 — 접수 실패 리포트인데 tasks row 존재 시
--       → 저장은 성공했으나 task_items 못 만들어 반쪽 상태 가능).
--       없으면 완전 미저장 → UI 재접수 필요.


-- ── [B] 반쪽 상태 확인 — 위 결과에 tasks 있으면 task_items 도 있는지 ─
SELECT
  t.task_no,
  t.status,
  COUNT(ti.id) AS item_count,
  string_agg(
    COALESCE(st.code, 'NULL') || '/' || COALESCE(at.code, 'NULL') || '×' || ti.qty,
    ', '
  ) AS items
FROM tasks t
LEFT JOIN task_items ti ON ti.task_id = t.id
LEFT JOIN work_types wt ON wt.id = ti.work_type_id
LEFT JOIN service_types st ON st.id = wt.service_type_id
LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
WHERE (
  REPLACE(t.phone, '-', '') = '01032202238'
  OR t.phone LIKE '%3220-2238%'
)
  AND t.created_at > now() - interval '2 days'
GROUP BY t.id, t.task_no, t.status
ORDER BY t.created_at DESC;
-- 기대: item_count=1 (1way ×2 한 줄) 이면 정상. 0 이면 task_items 미생성 (반쪽).


-- ── [C] 인천 연수구 최근 접수 (phone 잘못 있을 시 대비 광역 스캔) ────
SELECT
  t.task_no,
  t.customer_name,
  t.phone,
  t.address,
  t.region,
  t.status,
  t.created_at
FROM tasks t
WHERE (t.address ILIKE '%연수구%' OR t.region ILIKE '%연수%')
  AND t.created_at > now() - interval '2 days'
ORDER BY t.created_at DESC;


-- ============================================================================
-- 판단:
--   [A] 결과 있음 + [B] item_count > 0 → 정상 저장. 재접수 X.
--     · UI 새로고침하면 나옴.
--   [A] 결과 있음 + [B] item_count = 0 → 반쪽 저장 (tasks 만, task_items 없음).
--     · 이 tasks row 삭제 후 UI 재접수 권장. 삭제 SQL:
--         DELETE FROM tasks WHERE task_no = '<task_no>';
--   [A] 결과 없음 → 완전 미저장. UI 재접수 필요.
--     · Mig 174 실행 + policy backfill 실행 후 재접수하면 정상.
-- ============================================================================
