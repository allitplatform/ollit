-- ============================================
-- Migration 077 — tasks.payment_method 컬럼 (결제 방식)
-- 작성일  : 2026-05-27 (실제 운영 DB 적용일)
-- 파일 산출 : 2026-05-29 (사장님이 콘솔에서 직접 ALTER 적용한 흔적을
--             db/migrations 컨벤션으로 회복)
-- 범위    : tasks 테이블 payment_method text 컬럼 추가 (idempotent)
--
-- 사장님 spec:
--   결제 흐름 분류 (운영자/원청이 새 접수 등록 시 선택, 선택 사항 = NULL 허용)
--     · naver_pay — 네이버결제 (사이클 카드 표시 트리거)
--     · cash      — 현금 (현장결제, 안전 정보)
--     · card      — 카드 (현장결제, 안전 정보)
--     · transfer  — 계좌이체 (현장결제, 안전 정보)
--     · prepaid   — 선결제 (2026-05-29 추가)
--     · NULL      — 미선택 (옛 작업 자동 fallback)
--
-- 사용처 (코드 측):
--   · src/data/paymentMethods.js — PAYMENT_METHOD_OPTIONS + PAYMENT_METHOD_LABELS
--   · src/pages/AdminApp.jsx NewReceptionFormScreen — 입력 칩 (5개)
--   · src/components/principal/NewReceptionScreenLite.jsx — 유솔H 입력 칩
--   · src/data/tasksDb.js rowToTask / taskToRow / createTaskAdapter — 매핑 (3곳 트랩)
--   · src/utils/v14Task.js v14NormalizeTask — 평탄화
--   · src/components/usol_n/UsolNSettlementCycleCard.jsx — 'naver_pay' 사이클 가드
--   · src/components/AdminTaskDetailScreen.jsx WorkInfoCard — 라벨 노출
--   · src/components/EngineerNewAssignDetailScreen.jsx — 라벨 노출 (수락 전 안전)
--   · src/components/EngineerTaskDetailScreen.jsx CustomerInfo — 라벨 노출
--
-- 안전:
--   · ADD COLUMN IF NOT EXISTS — 재실행 안전 (운영 DB는 이미 적용 완료 상태)
--   · NULL 허용 — 옛 작업 자동 fallback (회귀 0)
--   · 제약 없음 — 코드 측 PAYMENT_METHOD_OPTIONS 화이트리스트로 검증
--
-- 재실행 :
--   Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run.
--   기존 컬럼 보존, COMMENT 만 갱신.
-- ============================================

BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS payment_method text;

COMMENT ON COLUMN tasks.payment_method IS
  '결제 방식 (naver_pay/cash/card/transfer/prepaid). NULL 허용 = 미선택. '
  'naver_pay 는 UsolNSettlementCycleCard 사이클 표시 트리거. '
  '그 외는 현장결제/선결제 안전 정보로 운영자/기사 PWA 측 라벨 노출.';

COMMIT;

-- ============================================
-- 검증 SQL (별도 실행)
-- ============================================
-- 1) 컬럼 존재 확인:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name='tasks' AND column_name='payment_method';
-- 기대: 1 row. data_type=text, is_nullable=YES.
--
-- 2) COMMENT 확인:
-- SELECT col_description('tasks'::regclass,
--                        (SELECT ordinal_position
--                           FROM information_schema.columns
--                          WHERE table_name='tasks' AND column_name='payment_method'));
-- 기대: 위 본문 텍스트.
--
-- 3) 분포 확인 (운영 데이터):
-- SELECT COALESCE(payment_method, 'NULL') AS pm, COUNT(*) AS cnt
--   FROM tasks GROUP BY 1 ORDER BY cnt DESC;
-- 기대: NULL 다수 (옛 작업) + naver_pay (네이버 발주 CSV bulk insert) + 운영자 선택값 소수.
