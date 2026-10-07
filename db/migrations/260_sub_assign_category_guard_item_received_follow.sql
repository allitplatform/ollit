-- ============================================================================
-- Migration 260 - 넘기기 종목 확인 + 항목 금액 수정 때 받은 돈 기본값 따라가기
-- 작성 2026-10-07 · 선행: 189, 226, 235
--
-- 사장님 결정 (2026-10-07, 블록 59)
--   9. 협력사로 넘기기: 그 협력사가 맡는 종목(subcontractor_categories)이 아니면 서버에서도 거부한다.
--      이미 넘어간 작업을 직영으로 회수하는 것은 종목과 무관하게 허용.
--   11. 운영자가 항목 금액을 고쳤을 때, 받은 돈을 아직 사람이 입력하지 않은 상태면 받은 돈 기본값도 새 금액을 따라간다.
--       사람이 받은 돈을 직접 입력한 뒤에는 건드리지 않는다.
--
-- 내용
--   [1] admin_assign_task_to_subcontractor (원문 mig 226 감싸기 함수 + 조각 1곳. 조각을 빼면 원문과 같음을 검사했습니다)
--       맡는 종목 표에 그 협력사 줄이 하나도 없으면(아직 정하지 않은 협력사) 전처럼 통과시킨다.
--   [2] admin_update_task_item 이름 변경 + 감싸기 (안쪽 원본 = mig 189 본문 그대로)
--       "사람이 입력하지 않은 상태" 판정: 받은 돈이 비어 있거나, 고치기 전 항목 금액(수량 x 단가)과 똑같을 때.
--       그리고 작업이 아직 끝나지 않았을 때(완료 · 정산완료 · 출장만 · 취소 가 아님)만 따라간다.
--
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 넘기기: 맡는 종목 확인
-- ============================================================
CREATE OR REPLACE FUNCTION admin_assign_task_to_subcontractor(
  p_actor uuid, p_token text, p_task_id uuid, p_subcontractor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_before uuid;
  v_res    jsonb;
  v_name   text;
BEGIN
  SELECT subcontractor_id INTO v_before FROM tasks WHERE id = p_task_id;
  -- Mig 260: 맡는 종목이 아니면 넘기지 않는다 (회수 = p_subcontractor_id NULL 은 그대로 통과)
  IF p_subcontractor_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM subcontractor_categories sc WHERE sc.subcontractor_id = p_subcontractor_id)
     AND NOT EXISTS (SELECT 1 FROM tasks t
                       JOIN subcontractor_categories sc ON sc.category_id = t.category_id AND sc.subcontractor_id = p_subcontractor_id
                      WHERE t.id = p_task_id) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      COALESCE((SELECT name FROM subcontractors WHERE id = p_subcontractor_id), '이 협력사') || '에서 맡지 않는 종목입니다. (맡는 종목: '
      || COALESCE((SELECT string_agg(c.name, ', ' ORDER BY c.name)
                     FROM subcontractor_categories sc JOIN categories c ON c.id = sc.category_id
                    WHERE sc.subcontractor_id = p_subcontractor_id), '없음') || ')');
  END IF;
  v_res := _impl_admin_assign_task_to_subcontractor(p_actor, p_token, p_task_id, p_subcontractor_id);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    SELECT name INTO v_name FROM subcontractors WHERE id = COALESCE(p_subcontractor_id, v_before);
    PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'admin',
      CASE WHEN p_subcontractor_id IS NULL THEN '직영으로 회수' || COALESCE(' (' || v_name || ')', '')
           ELSE '협력사로 넘김: ' || COALESCE(v_name, '') END,
      jsonb_build_object('subcontractor_id', v_before),
      jsonb_build_object('subcontractor_id', p_subcontractor_id));
  END IF;
  RETURN v_res;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_assign_task_to_subcontractor(uuid, text, uuid, uuid) TO anon, authenticated;

-- ============================================================
-- [2] 항목 금액 수정: 받은 돈 기본값 따라가기
-- ============================================================
DO $$
BEGIN
  IF to_regprocedure('_impl_admin_update_task_item(uuid, uuid, numeric, int, text)') IS NULL THEN
    ALTER FUNCTION admin_update_task_item(uuid, uuid, numeric, int, text) RENAME TO _impl_admin_update_task_item;
  END IF;
END $$;
REVOKE ALL ON FUNCTION _impl_admin_update_task_item(uuid, uuid, numeric, int, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION admin_update_task_item(
  p_actor      uuid,
  p_item_id    uuid,
  p_qty        numeric,
  p_unit_price int,
  p_note       text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id   uuid;
  v_status    text;
  v_old_sub   int;
  v_old_recv  int;
  v_new_sub   int;
  v_res       jsonb;
  v_follow    boolean := false;
BEGIN
  SELECT ti.task_id, t.status, ROUND(COALESCE(ti.qty, 1) * COALESCE(ti.unit_price, 0))::int, ti.received_amount
    INTO v_task_id, v_status, v_old_sub, v_old_recv
    FROM task_items ti JOIN tasks t ON t.id = ti.task_id
   WHERE ti.id = p_item_id;

  v_res := _impl_admin_update_task_item(p_actor, p_item_id, p_qty, p_unit_price, p_note);
  IF v_task_id IS NULL OR NOT COALESCE((v_res ->> 'ok')::boolean, false) THEN
    RETURN v_res;
  END IF;

  -- 받은 돈을 사람이 따로 입력하지 않은 상태(비어 있거나 고치기 전 금액과 같음) + 아직 끝나지 않은 작업
  IF v_old_recv IS NOT NULL AND v_old_recv = v_old_sub
     AND COALESCE(v_status, '') NOT IN ('완료', '정산완료', 'visit_only', '취소') THEN
    SELECT ROUND(COALESCE(ti.qty, 1) * COALESCE(ti.unit_price, 0))::int INTO v_new_sub
      FROM task_items ti WHERE ti.id = p_item_id;
    IF v_new_sub IS DISTINCT FROM v_old_recv THEN
      BEGIN
        UPDATE task_items SET received_amount = v_new_sub WHERE id = p_item_id;
        v_follow := true;
      EXCEPTION WHEN OTHERS THEN
        RETURN v_res || jsonb_build_object('received_follow_error', SQLERRM);
      END;
    END IF;
  END IF;

  RETURN v_res || jsonb_build_object('received_followed', v_follow);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_update_task_item(uuid, uuid, numeric, int, text) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 기대: 3행 (안쪽 원본 2개 + 넘기기 함수의 has_260 = true)
SELECT proname, prosrc LIKE '%Mig 260%' AS has_260
  FROM pg_proc
 WHERE proname IN ('admin_assign_task_to_subcontractor', '_impl_admin_update_task_item', 'admin_update_task_item')
 ORDER BY 1;

-- 2) 협력사별 맡는 종목 - 기대: 화이트코어 = 주방후드
SELECT s.name AS "협력사", c.code AS "종목 코드", c.name AS "종목"
  FROM subcontractor_categories sc
  JOIN subcontractors s ON s.id = sc.subcontractor_id
  JOIN categories c     ON c.id = sc.category_id
 ORDER BY 1, 2;
