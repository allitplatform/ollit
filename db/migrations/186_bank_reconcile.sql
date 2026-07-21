-- Migration 186 — 통장(bookkeeping_cashflow) 은행 실계좌 정합 (2026-07-21 저녁, 우리은행 잔액 42,118,374 기준).
-- 은행 거래내역(6/29~7/21, 443건) 전수 대조 결과 반영. 사장님 확인 완료 항목만 기록.
--
-- ① 유솔 주차정산 이중 기록 삭제 (자동+수동 실입금 중복 → 자동분 제거, 약 2,013만)
-- ② 원청 수수료 pass-through 구멍 수리:
--    기사 송금엔 [회사몫+원청수수료]가 포함되는데 시스템은 회사몫만 IN 기록 → 원청지급 OUT만 쌓여 매일 30~50만 누수.
--    → 원청지급 OUT 생길 때 같은 금액 IN(auto_principal_passthru) 자동 생성 트리거 + 기존 46건 백필 (9,937,000)
-- ③ 올잇 정산 외 수익 IN: 쿨가이 직접수금 15건(5,330,000) + 스마트스토어 12건(364,150)
-- ④ 미기록 지출 OUT: 세스코 기사지급 4건(542,000), 원청 수수료 대납(조동욱·농협구현서 경유) 11건(4,375,000),
--    쿨가이수수료·출장비·기타 5건(979,801)
-- ⑤ 잔여 보정 IN 2,995,994 (기준일 이전 미수금·유솔외 기사 잡입금 등 — 단건 귀속 불가분)
-- 결과: 시스템 잔고 = 42,118,374 (은행 7/21 18:10 실측과 일치)

BEGIN;

-- ① 유솔 이중 삭제
DELETE FROM bookkeeping_cashflow WHERE source='auto_usoln_remit' AND amount=12088930 AND flow_date='2026-06-30';
DELETE FROM bookkeeping_cashflow WHERE source='manual_usoln_refund' AND amount=209374 AND flow_date='2026-06-30';
DELETE FROM bookkeeping_cashflow WHERE source IS NULL AND amount=8248068 AND flow_date='2026-07-06';

-- ② 원청 수수료 pass-through 트리거
CREATE OR REPLACE FUNCTION bookkeeping_principal_passthru() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.source='auto_principal_payout' THEN
    INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
    VALUES (NEW.tenant_id, 'in', NEW.amount, NEW.flow_date,
            '기사 송금 내 원청 수수료 · ' || COALESCE(NEW.memo,''), NEW.created_by, 'auto_principal_passthru', NEW.id);
  ELSIF TG_OP='DELETE' AND OLD.source='auto_principal_payout' THEN
    DELETE FROM bookkeeping_cashflow WHERE source='auto_principal_passthru' AND source_ref=OLD.id;
  ELSIF TG_OP='UPDATE' AND NEW.source='auto_principal_payout' THEN
    UPDATE bookkeeping_cashflow SET amount=NEW.amount, flow_date=NEW.flow_date
     WHERE source='auto_principal_passthru' AND source_ref=NEW.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS bk_principal_passthru ON bookkeeping_cashflow;
CREATE TRIGGER bk_principal_passthru
AFTER INSERT OR UPDATE OR DELETE ON bookkeeping_cashflow
FOR EACH ROW WHEN (pg_trigger_depth() < 2) EXECUTE FUNCTION bookkeeping_principal_passthru();

-- ② 백필: 기존 원청지급 46건 → 동일 금액 IN
INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
SELECT tenant_id, 'in', amount, flow_date,
       '기사 송금 내 원청 수수료 · ' || COALESCE(memo,''), created_by, 'auto_principal_passthru', id
FROM bookkeeping_cashflow c
WHERE c.source='auto_principal_payout'
  AND NOT EXISTS (SELECT 1 FROM bookkeeping_cashflow p WHERE p.source='auto_principal_passthru' AND p.source_ref=c.id);

-- ③ 수익 IN (쿨가이 직접수금 + 스마트스토어)
INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source) VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 70000, '2026-06-29', '쿨가이 직접수금 · 손동식', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 50000, '2026-07-01', '쿨가이 직접수금 · 손동식', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 220000, '2026-07-01', '쿨가이 직접수금 · (주)우림알텍', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 594000, '2026-07-01', '쿨가이 직접수금 · 지오엑스포', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 550000, '2026-07-01', '쿨가이 직접수금 · 현대삼선교', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 198000, '2026-07-03', '쿨가이 직접수금 · 삼산수지', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 220000, '2026-07-04', '쿨가이 직접수금 · (주)컴아웃앤플레이', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 308000, '2026-07-12', '쿨가이 직접수금 · 디딤 워크라운', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 495000, '2026-07-15', '쿨가이 직접수금 · 동양윈스텍(주)', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 1518000, '2026-07-15', '쿨가이 직접수금 · 기러기둥지(주)', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 180000, '2026-07-15', '쿨가이 직접수금 · 김형대', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 121000, '2026-07-16', '쿨가이 직접수금 · 석플란트치과병원', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 25000, '2026-07-16', '쿨가이 직접수금 · 김영남(서일빌임대)', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 253000, '2026-07-20', '쿨가이 직접수금 · 양지산업개발(주)', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 528000, '2026-07-20', '쿨가이 직접수금 · 에이치에스엠(주)', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 37348, '2026-06-29', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 18674, '2026-06-30', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 18674, '2026-07-01', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 18674, '2026-07-02', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 37348, '2026-07-03', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 74696, '2026-07-06', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 18674, '2026-07-13', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 9338, '2026-07-14', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 9338, '2026-07-15', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 9337, '2026-07-16', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 84037, '2026-07-20', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 28012, '2026-07-21', '스마트스토어 정산', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual');

-- ④ 미기록 지출 OUT
INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source) VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 220000, '2026-06-29', '세스코 기사지급 · 임종일', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 176000, '2026-06-29', '세스코 기사지급 · 전현진', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 66000, '2026-06-29', '세스코 기사지급 · 정상현', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 80000, '2026-07-03', '세스코 기사지급 · 정훈 환불', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 700000, '2026-07-01', '쿨가이 원청 수수료 대납 · 농협 구현서 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 640000, '2026-07-02', '쿨가이 원청 수수료 대납 · 조동욱 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 180000, '2026-07-03', '쿨가이 원청 수수료 대납 · 조동욱 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 200000, '2026-07-04', '쿨가이 원청 수수료 대납 · 농협 구현서 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 35000, '2026-07-06', '쿨가이 원청 수수료 대납 · 조동욱 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 280000, '2026-07-13', '쿨가이 원청 수수료 대납 · 조동욱 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 450000, '2026-07-15', '쿨가이 원청 수수료 대납 · 조동욱 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 180000, '2026-07-15', '쿨가이 원청 수수료 대납 · 농협 구현서 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 1000000, '2026-07-16', '쿨가이 원청 수수료 대납 · 농협 구현서 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 230000, '2026-07-20', '쿨가이 원청 수수료 대납 · 조동욱 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 480000, '2026-07-20', '쿨가이 원청 수수료 대납 · 조동욱 경유', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 315000, '2026-07-08', '쿨가이 수수료', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 40000, '2026-07-14', '김현수 기사 출장비 전달', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 134801, '2026-07-14', '손서정현승우', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 380000, '2026-07-19', '기러기둥지 지급', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'out', 110000, '2026-07-19', '석플란트치과 지급', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual');

-- ⑤ 잔여 보정 (기준일 이전 미수금·유솔외 기사 잡입금 등)
INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source) VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'in', 2995994, '2026-07-21', '통장 정합 보정 · 기준일 이전 미수금 등 (은행 42,118,374 맞춤)', '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'manual');

COMMIT;

-- 검증: 기준 19,700,106 + Σin − Σout = 42,118,374 이어야 함
SELECT 19700106 + COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) AS balance
FROM bookkeeping_cashflow;