-- ============================================
-- Migration 053 — tasks.status CHECK enum 측 'visit_only' 추가
-- 작성일  : 2026-05-22
-- 범위    : tasks_status_check constraint 재정의 (총 9 status)
--
-- 사장님 확정 status 9개:
--   미배정 / 약속대기 / 배정 / 취소요청 / 확정 / 진행중 / 완료 / 취소 / visit_only
--
-- 배경:
--   Migration 001 초기 = 6개 (미배정 / 약속대기 / 확정 / 진행중 / 완료 / 취소)
--   이후 사장님이 콘솔에서 ALTER 측 '배정' + '취소요청' 추가 (총 8개)
--   본 마이그레이션 측 + 'visit_only' = 총 9개
--
-- 의존:
--   · Phase 2 출장비 정상화 (Migration 054 mark_visit_only RPC) 선행 사전 조건
--
-- 안전:
--   · DROP CONSTRAINT IF EXISTS → 재실행 안전 (idempotent)
--   · 기존 row status 모두 9개 안에 포함되므로 위반 0건
--
-- 회귀 방지:
--   · 다른 컬럼 / 제약 / 인덱스 무영향
--   · 기존 status 값 변경 X — 'visit_only' 단순 신규 허용
--
-- 실행:
--   · Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
-- ============================================

BEGIN;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (
  status IN (
    '미배정',
    '약속대기',
    '배정',
    '취소요청',
    '확정',
    '진행중',
    '완료',
    '취소',
    'visit_only'
  )
);

COMMIT;

-- ============================================
-- 검증 SQL — 적용 후 확인
-- ============================================
-- 1) constraint 등록 확인:
-- SELECT pg_get_constraintdef(con.oid) AS def
-- FROM pg_constraint con
-- JOIN pg_class cl ON cl.oid = con.conrelid
-- WHERE cl.relname='tasks' AND con.contype='c' AND conname='tasks_status_check';
--
-- 기대 (9 값 포함):
-- CHECK (status = ANY (ARRAY['미배정'::text, '약속대기'::text, '배정'::text,
--                            '취소요청'::text, '확정'::text, '진행중'::text,
--                            '완료'::text, '취소'::text, 'visit_only'::text]))
--
-- 2) 기존 데이터 분포 (모두 9개 안에 들어와야):
-- SELECT status, COUNT(*) AS cnt FROM tasks GROUP BY status ORDER BY status;
