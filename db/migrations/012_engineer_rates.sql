-- ============================================
-- Migration 012 — engineer_rates 신규 테이블 (Phase 3-8)
-- 작성일  : 2026-05-13
-- 범위    : 기사별 작업유형 × 기종 단가 저장 (시트 설정_기사단가 → DB 전환)
-- 출처    : Phase 3-8 — 시트 호출 폐기, DB 직접 사용
--
-- 매핑:
--   · PWA engineerId ("E001"~) ↔ users.code → users.id (uuid FK)
--   · PWA workType    (한글 "세척" / "냉매충전" / "냉매점검" / "출장비" / "추가선택")
--   · PWA applianceType (한글/영문 "벽걸이" / "스탠드" / "1way" / "4way" /
--                                  "원형" / "투인원" / "시스템멀티" / "천장형")
--   · rate (정수 원 / 0 이상)
--   · note (선택 텍스트)
--
-- upsert 키 (3중): (tenant_id, user_id, work_type, appliance_code)
-- 삭제 정책: hard DELETE (active 컬럼 없음 — 시트 호환 + 단순화)
--
-- 보호:
--   · 기존 데이터 영향 0 — 신규 테이블, 빈 상태로 시작
--   · 작업 / 푸시 / 휴무 / 정책 / 원청 / 사용자 / 로그인 / 기사 / 회사 계좌 변경 X
--
-- 실행:
--   · Supabase 콘솔 → SQL Editor → 통째 붙여넣기 → Run
--   · 안전장치: BEGIN/COMMIT — 부분 실패 시 ROLLBACK
--
-- 후속 단계 (대표님 SQL 실행 후):
--   1. src/lib/engineerRatesDb.js 신규 작성
--   2. src/data/engineers.js 내부 교체 (어댑터 본문 2곳)
--   3. src/pages/AdminApp.jsx fetchEngineerRates 한 줄 교체
--   4. src/api.js 시트 함수 3개 삭제
--   5. 빌드 + 커밋 + 푸시
-- ============================================

BEGIN;

-- ============================================
-- [1] 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS engineer_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_type       text NOT NULL,
  appliance_code  text NOT NULL,
  rate            integer NOT NULL CHECK (rate >= 0),
  note            text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (tenant_id, user_id, work_type, appliance_code)
);

-- 기사별 조회 인덱스 (loadEngineerRatesByEngineer 측 user_id 필터)
CREATE INDEX IF NOT EXISTS engineer_rates_by_user
  ON engineer_rates (tenant_id, user_id);

-- ============================================
-- [2] RLS 활성화
-- ============================================
ALTER TABLE engineer_rates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- [3] RLS 정책 5개 (tenant 격리 1개 + anon 4개)
--
-- 보완: PWA는 Supabase anon key로 직접 접근하므로 anon 역할 명시 정책 필수.
-- tenant 격리만 정의하면 PWA에서 작동하지 않음 (이전 Phase에서 검증된 패턴).
-- 정책 재정의 안전: DROP IF EXISTS → CREATE.
-- ============================================

-- (1) tenant 격리 — authenticated 역할 (서버 환경 / RPC 호출 측)
DROP POLICY IF EXISTS engineer_rates_tenant ON engineer_rates;
CREATE POLICY engineer_rates_tenant ON engineer_rates
  FOR ALL
  TO authenticated
  USING (tenant_id = current_tenant_id());

-- (2) anon SELECT — PWA 조회
DROP POLICY IF EXISTS engineer_rates_anon_select ON engineer_rates;
CREATE POLICY engineer_rates_anon_select ON engineer_rates
  FOR SELECT
  TO anon
  USING (true);

-- (3) anon INSERT — PWA 신규 단가 행 추가
DROP POLICY IF EXISTS engineer_rates_anon_insert ON engineer_rates;
CREATE POLICY engineer_rates_anon_insert ON engineer_rates
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- (4) anon UPDATE — PWA 단가 값 갱신 (upsert update 경로)
DROP POLICY IF EXISTS engineer_rates_anon_update ON engineer_rates;
CREATE POLICY engineer_rates_anon_update ON engineer_rates
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- (5) anon DELETE — PWA 단가 행 삭제
DROP POLICY IF EXISTS engineer_rates_anon_delete ON engineer_rates;
CREATE POLICY engineer_rates_anon_delete ON engineer_rates
  FOR DELETE
  TO anon
  USING (true);

COMMIT;

-- ============================================
-- [4] 검증 쿼리 (실행 후 결과 확인용)
-- ============================================

-- (a) 정책 5개 확인 (기대: 5행)
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'engineer_rates'
ORDER BY policyname;

-- (b) 컬럼 구조 확인 (기대: 9개 컬럼)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'engineer_rates'
ORDER BY ordinal_position;

-- (c) 인덱스 확인 (기대: 3개 — PK / UNIQUE / engineer_rates_by_user)
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'engineer_rates'
ORDER BY indexname;

-- (d) row count (기대: 0)
SELECT count(*) AS row_count FROM engineer_rates;

-- ============================================
-- 예상 결과:
--   (a) pg_policies — 5행
--       · engineer_rates_anon_delete  | DELETE | {anon}
--       · engineer_rates_anon_insert  | INSERT | {anon}
--       · engineer_rates_anon_select  | SELECT | {anon}
--       · engineer_rates_anon_update  | UPDATE | {anon}
--       · engineer_rates_tenant       | ALL    | {authenticated}
--
--   (b) 컬럼 9개
--       · id              | uuid                     | NO  | gen_random_uuid()
--       · tenant_id       | uuid                     | NO  |
--       · user_id         | uuid                     | NO  |
--       · work_type       | text                     | NO  |
--       · appliance_code  | text                     | NO  |
--       · rate            | integer                  | NO  |
--       · note            | text                     | YES |
--       · created_at      | timestamp with time zone | YES | now()
--       · updated_at      | timestamp with time zone | YES | now()
--
--   (c) 인덱스 3개
--       · engineer_rates_pkey                              (PRIMARY KEY)
--       · engineer_rates_tenant_id_user_id_work_type_...   (UNIQUE)
--       · engineer_rates_by_user                           (CREATE INDEX)
--
--   (d) row_count = 0
-- ============================================
