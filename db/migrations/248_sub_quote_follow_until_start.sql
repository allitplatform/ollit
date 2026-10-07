-- ============================================================================
-- Migration 248 - 보관 견적 따라가기 범위: "완료 전까지" -> "작업 시작 전까지"
-- 작성 2026-10-07 · 선행: 244, 246
--
-- 사장님 결정 (2026-10-07)
--   · 작업 시작(started_at) 전의 견적 변경 = 진짜 견적 변경 -> 보관 견적(tasks.sub_quote_supply)이 따라간다.
--   · 작업 시작 뒤에 운영자가 넣는 항목 = 현장 추가분 -> 따라가지 않는다 (그 금액의 수수료는 올데이케어 몫).
--   · [견적 수정] 으로 고친 값은 언제나 유지 (지금과 같음).
--
-- 바꾸는 것: mig 246 의 트리거 함수 한 개 (조건만). 트리거 자체 · 이미 저장된 값은 건드리지 않습니다.
-- 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION trg_tasks_sub_quote_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subcontractor_id IS NULL OR NEW.sub_quote_edited_at IS NOT NULL THEN
    RETURN NEW;                       -- 협력사 작업이 아니거나, 운영자가 직접 고친 값이 있으면 그대로 둔다
  END IF;
  -- 협력사로 넘기는 순간
  IF TG_OP = 'INSERT' OR OLD.subcontractor_id IS DISTINCT FROM NEW.subcontractor_id THEN
    NEW.sub_quote_supply := COALESCE(NEW.product_price, 0);
    RETURN NEW;
  END IF;
  -- 넘긴 뒤 접수 견적이 바뀜 -> 작업을 시작하기 전까지만 따라간다.
  --   시작한 뒤(진행 중 · 완료 등)에 바뀐 금액은 현장 추가분이므로 보관 견적은 그대로 둔다.
  IF NEW.product_price IS DISTINCT FROM OLD.product_price
     AND OLD.started_at IS NULL AND NEW.started_at IS NULL
     AND COALESCE(OLD.status, '') NOT IN ('진행중', '완료', '정산완료', 'visit_only', '취소')
     AND COALESCE(NEW.status, '') NOT IN ('진행중', '완료', '정산완료', 'visit_only', '취소') THEN
    NEW.sub_quote_supply := COALESCE(NEW.product_price, 0);
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

-- 검증 - 기대: 1행, 시작_전까지만 = true
SELECT proname AS 함수, position('started_at' IN prosrc) > 0 AS 시작_전까지만
  FROM pg_proc WHERE proname = 'trg_tasks_sub_quote_snapshot';
