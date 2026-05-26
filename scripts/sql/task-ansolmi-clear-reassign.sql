-- 안솔미 task — reassignRequest 키만 제거 (Supabase SQL Editor 측 실행)
-- 2026-05-26
--
-- 배경:
--   · task_no: YS-260517-096 (안솔미)
--   · 사장님 측 catch 실제 재배정 측 catch 1건 — 측 V14 재배정 path 측 catch 측 catch (f61c79a 측 catch 측 catch).
--   · 측 측 측 catch 측 catch 측 catch fix (74789e4) 측 catch — 측 catch DB 측 catch reassignRequest 키 측 catch.
--   · 단건 정리 측 catch.
--
-- 측 3건 (영등포 벽걸이 / 박길현 / 조헌준) — 기사 재배정 요청만 있고 미처리.
--   목록에 떠 있는 게 정상 — 측 측 측 X.
--
-- 실행 순서: 1 → 2 → 3 (각 SELECT 측 catch 측 catch UPDATE 측 catch 측 catch 측 측 측)

-- ============================================================
-- 1) 정정 전 — 현재 category_data 상태 확인
-- ============================================================
SELECT task_no, customer_name, status, category_data
FROM tasks WHERE task_no = 'YS-260517-096';
-- 기대: category_data 측 catch reassignRequest 키 측 catch


-- ============================================================
-- 2) reassignRequest 키만 제거 (다른 키는 보존)
-- ============================================================
-- jsonb 측 catch '-' 연산자 측 catch 측 catch 측 catch — 측 catch 측 catch 키 (workItems, quote, consent 등) 측 catch.
UPDATE tasks SET category_data = category_data - 'reassignRequest'
WHERE task_no = 'YS-260517-096';
-- 기대: 1 row updated


-- ============================================================
-- 3) 정정 후 검증
-- ============================================================
SELECT task_no, customer_name, status, category_data
FROM tasks WHERE task_no = 'YS-260517-096';
-- 기대: category_data 측 catch reassignRequest 키 측 X (측 catch 측 catch 키 보존)
