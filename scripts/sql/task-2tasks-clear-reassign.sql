-- 2 task — reassignRequest 키만 제거 (Supabase SQL Editor 측 실행)
-- 2026-05-26
--
-- 대상:
--   · YS-260517-096 (안솔미)  — 재배정 완료, status='미배정', 김영수 배정 / reassignRequest stuck
--   · YS-260516-044 (박길현)  — 재배정 완료, status='미배정', 김영수 배정 / reassignRequest stuck
--
-- 배경:
--   사장님 브라우저 측 catch 옛 코드 (74789e4 측 catch) 측 catch 재배정 → DB 측 catch reassignRequest 측 catch.
--   74789e4 측 catch hard reload 측 catch 측 catch 측 — 측 catch 측 stuck 측 catch 단건 정리.
--
-- 미처리 (★ 측 측 측 X):
--   · YS-260424-114 (영등포 벽걸이) — 기사 재배정 요청 측 catch 측 catch 미처리
--   · YS-260516-134 (조헌준)       — 기사 재배정 요청 측 catch 측 catch 미처리
--
-- 실행 순서: 1 → 2 → 3 (각 SELECT 측 catch 측 catch UPDATE 측 catch 측 catch 측 측 측)

-- ============================================================
-- 1) 정정 전 — 현재 category_data 상태 확인
-- ============================================================
SELECT task_no, customer_name, status, category_data
FROM tasks WHERE task_no IN ('YS-260517-096','YS-260516-044');
-- 기대: 2 row, category_data 측 catch reassignRequest 키 측 catch


-- ============================================================
-- 2) reassignRequest 키만 제거 (다른 키는 보존)
-- ============================================================
UPDATE tasks SET category_data = category_data - 'reassignRequest'
WHERE task_no IN ('YS-260517-096','YS-260516-044');
-- 기대: 2 rows updated


-- ============================================================
-- 3) 정정 후 검증
-- ============================================================
SELECT task_no, customer_name, status, category_data
FROM tasks WHERE task_no IN ('YS-260517-096','YS-260516-044');
-- 기대: category_data 측 catch reassignRequest 키 측 X (측 catch 측 catch 키 — workItems/quote 등 — 보존)
