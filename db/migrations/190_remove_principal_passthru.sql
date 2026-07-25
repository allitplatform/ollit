-- Migration 190 — 원청 수수료 pass-through 중복 입금 제거 (2026-07-25)
--
-- 배경:
--   Mig 186 ②에서 "기사 송금엔 회사몫만 IN 기록된다"고 판단하고
--   원청지급 OUT 발생 시 같은 금액을 IN(auto_principal_passthru)으로
--   자동 생성하는 트리거를 넣었음.
--
-- 재검증 결과 (2026-07-25, 사장님 지적):
--   Mig 156 confirm_engineer_remit_with_cashflow 의 입금액은
--     send_amount = (product_price + extra_fee + travel_fee) - engineer_amount
--                 = principal_amount + owner_amount
--   즉 기사 송금 IN 에 원청 수수료가 이미 포함돼 있음.
--
--   실측 (2026-07-24 하루):
--     통장기록_기사송금IN = 1,400,000
--     회사몫만            = 1,036,000
--     회사몫+원청수수료   = 1,400,000   ← 일치. 중복 확정.
--
--   원청별 '기사송금 없이 원청지급만 발생한 건'(진짜 구멍) = 전 원청 0원.
--     유솔홈케어 H 0 / 크리크린 0 / 올데이케어 0 / 용인컴퍼니 0 / 에어컨프로(KA) 0
--   → 예외로 남길 원청 없음. 트리거 전면 제거.
--
--   누적 중복 입금: 53건 11,251,000원 (2026-06-29 ~ 2026-07-24)
--
-- 잔액 영향:
--   삭제 전 시스템 잔액 44,569,823
--   삭제 후 시스템 잔액 33,318,823
--   실제 은행 잔액      43,749,448 (2026-07-25 확인)
--   → 차액 10,430,625 는 원인 미상. Mig 186 ⑤ 보정 2,995,994 와 합치면
--     실제로 설명되지 않는 금액은 누계 13,426,619.
--     "원청 수수료 누락"이라는 잘못된 이름 대신 원인 미상 보정으로 기록하고
--     원인 추적은 별도 과제로 남김.

BEGIN;

-- [1] 가짜 입금 자동 생성 트리거 제거
DROP TRIGGER  IF EXISTS bk_principal_passthru ON bookkeeping_cashflow;
DROP FUNCTION IF EXISTS bookkeeping_principal_passthru();

-- [2] 기존 중복 입금 53건 삭제
DELETE FROM bookkeeping_cashflow WHERE source = 'auto_principal_passthru';

-- [3] 은행 실계좌 정합 보정 (2026-07-25 우리은행 43,749,448 기준)
INSERT INTO bookkeeping_cashflow (
  tenant_id, direction, amount, flow_date, memo, created_by, source
) VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'in', 10430625, '2026-07-25',
  '통장 정합 보정 · 원인 미상 (구 원청수수료 중복분 정리, Mig 190)',
  '77777777-7777-7777-7777-aaaaaaaa0004'::uuid,
  'manual'
);

COMMIT;

-- 검증: 43,749,448 이 나와야 함
SELECT 19700106 + COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0) AS balance
FROM bookkeeping_cashflow;

-- 검증: 트리거·잔여 행 0
SELECT COUNT(*) AS passthru_남은건수 FROM bookkeeping_cashflow WHERE source='auto_principal_passthru';
SELECT COUNT(*) AS 트리거_남음 FROM pg_trigger WHERE tgname='bk_principal_passthru';
