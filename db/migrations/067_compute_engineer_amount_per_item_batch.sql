-- ============================================================================
-- Migration 067 — compute_engineer_amount_per_item_batch RPC 신설
-- 작성: 2026-05-24
-- 범위: 신규 RPC 1개 — task_id 배열을 받아 item별 engineer_amount를 jsonb로 반환
-- ============================================================================
-- 배경:
--   기사 PWA 유솔N 정산 화면 — 본인의 완료 task 약 100건의 task_item별 기사 몫 필요.
--   기존 Migration 065 RPC compute_engineer_amount_per_item(p_task_id uuid)는 task 1개씩만 받음.
--   100 task = 100 RPC 호출 → network round-trip 100회 → 느림.
--
-- 신규 spec:
--   p_task_ids uuid[]를 받아 FOREACH로 기존 RPC를 호출 + 결과를 합쳐 jsonb array로 반환.
--   각 element에 task_id를 추가해 호출처가 task_id로 그룹핑 가능.
--
-- 반환 형식:
--   [
--     { "task_id": uuid, "task_item_id": uuid, "engineer_amount": int },
--     ...
--   ]
--
-- 의존:
--   - Migration 065 (compute_engineer_amount_per_item) — 본 RPC가 호출하는 핵심 함수
--   - Migration 050 (compute_payment v14, calculate_commission)
--
-- 안전:
--   - LANGUAGE plpgsql STABLE — read-only (DML 없음)
--   - SECURITY DEFINER — anon/authenticated 측 RPC 호출 허용
--   - 각 task 실패 시 — RAISE NOTICE 후 다음 task로 (= 일부 실패가 측 catch 차단 X)
--   - 기존 RPC 무손상 — 신규 함수만 추가
--   - 측 6 원청 동일 동작 (compute_engineer_amount_per_item이 calc_method 측 catch)
--
-- 재실행:
--   - CREATE OR REPLACE FUNCTION — idempotent
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_engineer_amount_per_item_batch(p_task_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tid    uuid;
  v_one    jsonb;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_task_ids IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOREACH v_tid IN ARRAY p_task_ids LOOP
    BEGIN
      v_one := compute_engineer_amount_per_item(v_tid);
      IF v_one IS NOT NULL AND jsonb_array_length(v_one) > 0 THEN
        -- 각 element에 task_id 추가
        SELECT v_result || jsonb_agg(e || jsonb_build_object('task_id', v_tid))
        INTO   v_result
        FROM   jsonb_array_elements(v_one) e;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- 한 task 실패가 측 catch 차단하지 않음 (예: task 없음 / policy 매핑 실패)
      RAISE NOTICE '[batch] task % failed: %', v_tid, SQLERRM;
    END;
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_engineer_amount_per_item_batch(uuid[]) TO anon, authenticated;

COMMENT ON FUNCTION compute_engineer_amount_per_item_batch(uuid[]) IS
  'task_id 배열 측 catch 측 catch item별 engineer_amount를 jsonb array로 측 catch. 측 catch RPC compute_engineer_amount_per_item을 FOREACH 측 catch 호출. read-only. [{task_id, task_item_id, engineer_amount}, ...].';

-- ============================================================================
-- 검증 SQL (별도 실행)
-- ============================================================================
-- 1) RPC 등록 확인:
-- SELECT proname, obj_description(oid, 'pg_proc') AS comment
-- FROM pg_proc WHERE proname = 'compute_engineer_amount_per_item_batch';
--
-- 2) 빈 배열 처리:
-- SELECT compute_engineer_amount_per_item_batch(NULL);            -- []
-- SELECT compute_engineer_amount_per_item_batch(ARRAY[]::uuid[]); -- []
--
-- 3) 정승민 단일 task 검증 (예상: 스탠드 66,000 + 벽걸이 44,000 = 110,000):
-- SELECT compute_engineer_amount_per_item_batch(
--   ARRAY[(SELECT id FROM tasks WHERE task_no = 'YS-260420-168')]
-- );
--
-- 4) 황예원 + 정승민 batch (예상: 본작업+추가선택 + 스탠드+벽걸이 = 4 items):
-- SELECT compute_engineer_amount_per_item_batch(
--   ARRAY[
--     (SELECT id FROM tasks WHERE task_no = 'YS-260420-168'),
--     (SELECT id FROM tasks WHERE task_no = 'YS-260504-037')
--   ]
-- );
-- → jsonb array 4 elements. 각각 task_id / task_item_id / engineer_amount 측 catch.
--
-- 5) 측 6 원청 임의 표본 (회귀 — SUM = payments.engineer_amount 일치 확인):
-- WITH sample AS (
--   SELECT id FROM tasks
--   WHERE principal_id IN (SELECT id FROM principals WHERE code IN ('allday','KA','KB','yongin','usol_h','crikrin'))
--     AND EXISTS (SELECT 1 FROM payments WHERE task_id = tasks.id)
--   ORDER BY random() LIMIT 5
-- )
-- SELECT t.task_no,
--        (SELECT SUM((x->>'engineer_amount')::int)
--         FROM jsonb_array_elements(
--           compute_engineer_amount_per_item_batch(ARRAY[t.id])
--         ) x) AS sum_item_eng,
--        p.engineer_amount AS payments_eng
-- FROM tasks t
-- JOIN sample s ON s.id = t.id
-- JOIN payments p ON p.task_id = t.id;
