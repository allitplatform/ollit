-- ============================================================================
-- Migration 211b - 묶음 0 (2/2): payments / engineer_rates 전체 수정 허용 정책 닫기
-- 작성 2026-10-06
--
-- ★ 실행 조건 (전부 충족한 뒤에만) - 날짜가 아니라 "기사 전원 새 버전" 기준
--   1) 211a, 211c 실행 완료
--   2) 묶음 0 코드 push + 배포 완료
--   3) PWA 실화면 확인: 기사 "입금 완료 보고" / "유솔 입금 보고" / 운영자 "기사 단가 저장·삭제"
--   4) db/ops/check_engineer_app_versions.sql 의 [1] 요약에서 "확인_필요" = 0
--      (0 이 아니면 [2] 목록의 해당 기사에게 앱을 한 번 닫았다 열어 달라고 요청 후 재조회)
--
--   이유: 앱은 "다음에 열 때" 새 버전이 적용됩니다(자동 새로고침 없음). 옛 버전이
--   남아 있는 폰에서는 이 파일 실행 뒤 입금 보고가 "성공처럼 보이지만 저장되지
--   않습니다" (정책이 없으면 UPDATE 가 오류 없이 0행으로 끝남).
--
-- 닫는 정책
--   payments        : payments_anon_update              (mig 026 - 전 행·전 칸 UPDATE 허용)
--   engineer_rates  : engineer_rates_anon_insert/update/delete (mig 012)
-- 남기는 정책
--   payments_anon_select, engineer_rates_anon_select   (조회는 지금처럼 동작)
--
-- 영향 없는 것
--   compute_payment, 취소·출장비·항목 수정, 운영자 입금 확인 등 서버 함수는 전부
--   SECURITY DEFINER 라 정책과 무관하게 동작합니다 (저장소 마이그레이션 기준 12개 확인).
-- ============================================================================

-- ============================================================
-- [0] 실행 전 확인 - 지금 걸려 있는 정책 목록 (결과를 보관해 주세요)
--     저장소에 없는 정책이 운영 DB 에 직접 추가돼 있을 수 있습니다.
--     아래 [1] 에서 지우는 4개 외에 cmd 가 INSERT/UPDATE/DELETE/ALL 이고
--     roles 에 anon 이 들어간 줄이 더 보이면, 실행을 멈추고 알려 주세요.
-- ============================================================
SELECT tablename, policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('payments', 'engineer_rates')
 ORDER BY tablename, policyname;

-- ============================================================
-- [1] 정책 닫기
-- ============================================================
BEGIN;

DROP POLICY IF EXISTS payments_anon_update       ON payments;

DROP POLICY IF EXISTS engineer_rates_anon_insert ON engineer_rates;
DROP POLICY IF EXISTS engineer_rates_anon_update ON engineer_rates;
DROP POLICY IF EXISTS engineer_rates_anon_delete ON engineer_rates;

COMMIT;

-- ============================================================
-- [2] 실행 후 확인
-- ============================================================
-- 2-1) 남은 정책 - 기대: anon 에게는 SELECT 만 남음
SELECT tablename, policyname, cmd, roles
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('payments', 'engineer_rates')
 ORDER BY tablename, policyname;

-- 2-2) RLS 가 켜져 있는지 - 기대: 두 표 모두 true
SELECT relname, relrowsecurity
  FROM pg_class
 WHERE relname IN ('payments', 'engineer_rates') AND relkind = 'r';

-- 2-3) 실화면 확인 (PWA)
--   · 기사: 오늘 입금 완료 보고 -> 새로고침 후 "보고됨" 유지
--   · 운영자: 입금 확인 / 확인 취소
--   · 운영자: 기사 단가 1건 수정 -> 새로고침 후 값 유지
--   · 작업 완료 1건 -> 정산 금액 정상 계산

-- ============================================================
-- [되돌리기] 문제가 생기면 아래 주석을 풀어 실행 (원래 정책 그대로 복구)
-- ============================================================
-- BEGIN;
-- CREATE POLICY payments_anon_update ON payments
--   FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY engineer_rates_anon_insert ON engineer_rates
--   FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY engineer_rates_anon_update ON engineer_rates
--   FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY engineer_rates_anon_delete ON engineer_rates
--   FOR DELETE TO anon USING (true);
-- COMMIT;
