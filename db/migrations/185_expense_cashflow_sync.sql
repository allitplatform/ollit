-- Migration 185 — 운영비(bookkeeping_expenses) → 통장(bookkeeping_cashflow) 자동 연동 (2026-07-21).
-- ⚠️ DB에는 2026-07-21 이미 적용됨 (사장님 콘솔 실행, Success 확인). 재실행 금지 아님(멱등)이지만 불필요.
--
-- 배경 (사장님 발견): 운영비 입력이 통장에 자동 반영 안 됨 → 통장 잔고가 실제 은행과 지속 괴리.
-- 내용:
--   ① 7/21 통짜 보정(26,378,165) 삭제 + 옛 수동 미러 삭제 (있을 경우)
--   ② 트리거: 운영비 INSERT/UPDATE/DELETE → 통장 OUT 자동 미러 (source='auto_expense', source_ref=expense id)
--      · 컷오프 2026-06-30 이전 지출은 미러 안 함 (6/29 기준잔액에 이미 반영 — 이중 차감 방지)
--   ③ 백필: 6/30 이후 운영비 → 미러 없는 것만 INSERT
-- 결과 검증: current_balance 52,924,955 (운영비 15,093,584 날짜별 반영) 확인됨.

DELETE FROM bookkeeping_cashflow
WHERE flow_date='2026-07-21' AND direction='out' AND amount=26378165 AND source='manual';

DELETE FROM bookkeeping_cashflow WHERE source='manual_expense_mirror';

CREATE OR REPLACE FUNCTION bookkeeping_expense_cashflow_sync() RETURNS TRIGGER AS $$
DECLARE
  v_memo text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM bookkeeping_cashflow WHERE source='auto_expense' AND source_ref=OLD.id;
    RETURN OLD;
  END IF;

  v_memo := '운영비 · ' ||
    CASE NEW.category
      WHEN 'rent' THEN '임대료' WHEN 'ad' THEN '광고비' WHEN 'tax' THEN '세금'
      WHEN 'meal' THEN '식비' WHEN 'labor' THEN '인건비' ELSE '기타'
    END || COALESCE(' · ' || NULLIF(NEW.memo,''), '');

  IF TG_OP = 'INSERT' THEN
    IF NEW.expense_date >= '2026-06-30' THEN
      INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
      VALUES (NEW.tenant_id, 'out', NEW.amount, NEW.expense_date, v_memo,
              '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'auto_expense', NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  UPDATE bookkeeping_cashflow
     SET amount=NEW.amount, flow_date=NEW.expense_date, memo=v_memo, updated_at=now()
   WHERE source='auto_expense' AND source_ref=NEW.id;
  IF NOT FOUND AND NEW.expense_date >= '2026-06-30' THEN
    INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
    VALUES (NEW.tenant_id, 'out', NEW.amount, NEW.expense_date, v_memo,
            '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'auto_expense', NEW.id);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS bk_expense_cashflow_sync ON bookkeeping_expenses;
CREATE TRIGGER bk_expense_cashflow_sync
AFTER INSERT OR UPDATE OR DELETE ON bookkeeping_expenses
FOR EACH ROW EXECUTE FUNCTION bookkeeping_expense_cashflow_sync();

INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
SELECT e.tenant_id, 'out', e.amount, e.expense_date,
       '운영비 · ' ||
       CASE e.category
         WHEN 'rent' THEN '임대료' WHEN 'ad' THEN '광고비' WHEN 'tax' THEN '세금'
         WHEN 'meal' THEN '식비' WHEN 'labor' THEN '인건비' ELSE '기타'
       END || COALESCE(' · ' || NULLIF(e.memo,''), ''),
       '77777777-7777-7777-7777-aaaaaaaa0004'::uuid, 'auto_expense', e.id
FROM bookkeeping_expenses e
WHERE e.expense_date >= '2026-06-30'
  AND NOT EXISTS (
    SELECT 1 FROM bookkeeping_cashflow c
    WHERE c.source='auto_expense' AND c.source_ref=e.id
  );
