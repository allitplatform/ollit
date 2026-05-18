-- ============================================
-- Migration 031 — payments.track 컬럼 추가 (자금 흐름 트랙 분류)
-- 작성일  : 2026-05-18
-- 범위    : payments 테이블 track CHAR(1) 컬럼 + 인덱스 + 백필
--
-- 사장님 spec (2026-05-18 확정):
--
--   트랙 🅐 (일일정산, 기사 → 회사, 23:00 KST 마감):
--     · 6개 원청: allday / KA / KB / yongin / usol_h / crikrin
--     · usol_n 냉매 (네이버 1만원 100% 유솔, 현장 추가금만 기사→회사 50:50)
--
--   트랙 🅑 (월정산, 회사 → 기사, 매월 15일):
--     · usol_n 세척 (cleaning)
--     · usol_n 추가선택 (송풍팬분해/층고, 피톤치드, 실외기 등 — 별도 SKU)
--
-- 분류 로직:
--   IF principal_code = 'usol_n' AND task에 refrigerant 외 service_code 존재 → 🅑
--   ELSE → 🅐
--
-- 보수적으로 has_non_refrigerant 플래그 사용 (한 task = 한 service_code가 일반적이지만 안전망).
--
-- ──────────────────────────────────────────────
-- Fix #29 배경:
-- 기존 src/utils/remitFilter.js의 USOL_N_TRACK_B_METHODS 분류가 망가져 있었음.
--   · 검사 대상: calc_method = 'usol_n_본작업' / 'usol_n_추가선택'
--   · 하지만 이 calc_method 값들은 DB에 한 번도 저장된 적 없음
--   · 실제 calc_method 값: 직영_0, 직영_50_50, 비율_견적금액, 비율_총금액, 비율_판매가, 정액
--   · 결과: 모든 usol_n 작업이 트랙 🅐로 잘못 분류
--   · 다행히 usol_n 작업 0건이라 운영 영향 없음 (지금이 정정 적기)
--
-- 정정안: payments에 track 컬럼 추가 → compute_payment가 INSERT 시 자동 결정 →
--          remitFilter.js는 task.track === 'A' 단순 검사.
-- ──────────────────────────────────────────────
--
-- 다음 단계:
--   - Migration 032 — compute_payment v10 (track 자동 계산 + INSERT)
--   - src/utils/remitFilter.js 정정 (calc_method → track 기반)
--   - 정규화 3곳 inline (tasksDb.rowToTask / v14Task.v14NormalizeTask / AdminApp._v14NormalizeTask)
--
-- 안전 장치:
--   - DEFAULT 'A' + NOT NULL → 기존 코드 호환 (track 모르는 INSERT는 'A')
--   - CHECK 제약 → 'A'/'B' 외 값 차단
--   - 백필 UPDATE — usol_n 작업 0건이라 변경 없을 예정 (안전망)
--
-- 회귀 방지:
--   - track 컬럼만 추가 → 기존 컬럼/제약/인덱스 무손상
--   - DEFAULT 'A' → 기존 row 자동 'A' 적용
--   - 기존 SELECT/UPDATE 쿼리 모두 무영향 (새 컬럼 무시)
--
-- 실행:
--   - Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   - 한 번만 실행하면 됨 (ADD COLUMN IF NOT EXISTS + 백필 idempotent)
-- ============================================

-- ============================================
-- [1] track 컬럼 추가
-- ============================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS track CHAR(1) NOT NULL DEFAULT 'A'
    CHECK (track IN ('A', 'B'));

-- ============================================
-- [2] 컬럼 설명
-- ============================================
COMMENT ON COLUMN payments.track IS
  '자금 흐름 트랙. A=일일정산(기사→회사 23:00 KST), B=월정산(회사→기사 매월 15일). '
  '조건: principal_code=usol_n AND task에 refrigerant 외 service_code 존재 → B, 그 외 → A. '
  'compute_payment v10이 INSERT 시 자동 결정.';

-- ============================================
-- [3] 인덱스 생성 (성능)
-- ============================================
-- 운영자 정산 탭 / 기사 회사 송금 내역 — 트랙 🅐 필터 빠른 조회용
CREATE INDEX IF NOT EXISTS idx_payments_track ON payments(track);

-- ============================================
-- [4] 기존 데이터 백필 — usol_n 트랙 🅑 row 'B' 적용
-- ============================================
-- usol_n 작업 0건이라 변경 없을 예정 (안전망).
-- 조건: principal.code = 'usol_n' AND task에 service_code != 'refrigerant' 존재
UPDATE payments p
SET track = 'B'
FROM tasks t
JOIN principals pr ON pr.id = t.principal_id
WHERE p.task_id = t.id
  AND pr.code = 'usol_n'
  AND EXISTS (
    SELECT 1
    FROM task_items ti
    LEFT JOIN work_types wt ON wt.id = ti.work_type_id
    LEFT JOIN service_types st ON st.id = wt.service_type_id
    WHERE ti.task_id = t.id
      AND COALESCE(st.code, '') != 'refrigerant'
  );

-- ============================================
-- [5] 백필 결과 확인 (마지막 SELECT — Supabase Editor 결과창에서 즉시 확인)
-- ============================================
SELECT
  track,
  COUNT(*) AS cnt
FROM payments
GROUP BY track
ORDER BY track;

-- ============================================
-- (선택) 추가 검증 SQL
-- ============================================
-- 1. track 컬럼 추가 확인:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name='payments' AND column_name='track';
--
-- 기대 1 row:
--   · column_name='track', data_type='character', is_nullable='NO', column_default='''A''::bpchar'
--
-- 2. CHECK 제약 추가 확인:
-- SELECT con.conname, pg_get_constraintdef(con.oid) AS def
-- FROM pg_constraint con
-- JOIN pg_class cl ON cl.oid = con.conrelid
-- WHERE cl.relname = 'payments'
--   AND con.contype = 'c'
--   AND pg_get_constraintdef(con.oid) LIKE '%track%';
--
-- 기대: CHECK (track = ANY (ARRAY['A'::bpchar, 'B'::bpchar]))
--
-- 3. 인덱스 생성 확인:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename='payments' AND indexname='idx_payments_track';
--
-- 기대 1 row: idx_payments_track
--
-- 4. 'B' 적용 row 확인 (usol_n 작업 0건이라 0 row 정상):
-- SELECT p.id, p.task_id, p.track, pr.code AS principal_code
-- FROM payments p
-- JOIN tasks t ON t.id = p.task_id
-- JOIN principals pr ON pr.id = t.principal_id
-- WHERE p.track = 'B'
-- LIMIT 10;
