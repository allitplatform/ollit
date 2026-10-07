-- ============================================================================
-- Migration 259 - 이전설치: 설치(도착) 주소 칸
-- 작성 2026-10-07 · 근거: 10/6 설계 D10 / 2-E
--
-- 사장님 요구 (2026-10-07, 블록 57)
--   이전설치는 주소 2개(철거 주소 / 설치 주소), 견적 2개(철거비 / 설치비).
--
-- 내용 (칸 2개 추가만. 함수 · 트리거 · 기존 데이터는 건드리지 않습니다)
--   tasks.dest_address  설치(도착) 주소. 기존 tasks.address 는 철거(출발) 주소로 쓴다.
--   tasks.dest_detail   설치 주소 메모 (층 · 엘리베이터 · 실외기 위치)
--
-- 견적 2개는 새 금액 칸을 만들지 않는다: 작업 항목 두 줄("철거" / "이전설치")의 단가로 나눈다. 견적 = 두 줄 합.
-- 설치 기사 몫(80%)은 작업 전체 금액(product_price + extra_fee - 자재비)으로 계산하므로 (mig 200),
-- 항목을 둘로 나눠도 결과가 같다. 아래 검증 2 로 확인할 수 있다.
--
-- 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS dest_address text,
  ADD COLUMN IF NOT EXISTS dest_detail  text;

COMMENT ON COLUMN tasks.dest_address IS '이전설치: 설치(도착) 주소. tasks.address 는 철거(출발) 주소.';
COMMENT ON COLUMN tasks.dest_detail  IS '이전설치: 설치 주소 메모 (층 · 엘리베이터 · 실외기 위치).';

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 칸 - 기대: 2행
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'tasks' AND column_name IN ('dest_address', 'dest_detail') ORDER BY 1;

-- 2) (나중에, 두 줄로 접수한 이전설치가 완료된 뒤) 기사 몫이 "작업 전체 금액 기준 80%" 와 같은가
--    기대: 모든 행의 "같음" = true. 지금은 해당 작업이 없어 0행이 정상입니다.
SELECT t.task_no,
       COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0)                          AS "받은 금액",
       COALESCE(t.material_cost, 0)                                                     AS "자재비",
       p.engineer_amount                                                                AS "저장된 기사 몫",
       LEAST(GREATEST(COALESCE(t.material_cost, 0), 0), COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0))
         + FLOOR(GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0)
                          - LEAST(GREATEST(COALESCE(t.material_cost, 0), 0), COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0)), 0) * 0.80)::int
                                                                                        AS "한 줄일 때 기사 몫",
       p.engineer_amount =
         LEAST(GREATEST(COALESCE(t.material_cost, 0), 0), COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0))
         + FLOOR(GREATEST(COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0)
                          - LEAST(GREATEST(COALESCE(t.material_cost, 0), 0), COALESCE(t.product_price, 0) + COALESCE(t.extra_fee, 0)), 0) * 0.80)::int
                                                                                        AS "같음"
  FROM tasks t
  JOIN payments p ON p.task_id = t.id
 WHERE t.dest_address IS NOT NULL
   AND t.status = '완료'
   AND t.subcontractor_id IS NULL
   AND (SELECT COUNT(*) FROM task_items ti WHERE ti.task_id = t.id AND NOT COALESCE(ti.is_canceled, false)) >= 2
 ORDER BY t.completed_at DESC
 LIMIT 50;
