-- ============================================================================
-- Migration 247 - 화이트코어 작업 관련 화면에서 원청 이름 감추기 (원청 구분은 작업코드로만)
-- 작성 2026-10-07 · 선행: 221, 245
--
-- 사장님 지시 (2026-10-07)
--   · 협력사(화이트코어) 쪽에는 원청 이름이 데이터로도 내려가지 않게.
--   · 운영자 쪽 3자 분배 표시는 원청 이름 대신 "원청" 고정 문구. 어느 원청인지는 작업코드(K-…)로 구분.
--
-- 내용 (셋 다 저장소 원문에서 자동으로 만들었고, 바꾼 조각을 되돌리면 원문과 글자 하나까지 같습니다)
--   [1] sub_get_task_detail (mig 221)
--         · principal_rel(원청 code · name) -> 항상 NULL
--         · 작업 행에서 principal_id · sub_quote_supply · sub_quote_edited_at · sub_quote_edited_by 칸을 빼고 내려 준다
--   [2] trg_sub_daily_principal_remit (mig 245) - 되돌리기 막는 안내 문구의 원청 이름 -> "원청"
--   [3] admin_mark_principal_remit_paid (mig 245) - 가계부 출금 메모 -> "원청 송금 (10/7 입금 확인분)"
--
-- 협력사에 원청 정보를 내려 주던 곳 (조사 결과)
--   · sub_get_task_detail 의 principal_rel (code · name)            -> 이번에 제거
--   · sub_get_task_detail 의 작업 행(principal_id · 보관 견적 칸)     -> 이번에 제외
--   · sub_list_tasks(214) · sub_search_tasks(237) · sub_query_tasks(238) · 협력사 푸시(220·239·240·242) : 원청 정보 없음 (확인만)
--   · 작업코드(task_no)는 그대로 내려간다.
--
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- (이미 기록된 가계부 출금 줄의 메모는 바꾸지 않습니다. 아직 [송금 완료] 를 누른 적이 없으면 해당 없음.)
-- ============================================================================

BEGIN;

-- [1]
CREATE OR REPLACE FUNCTION sub_get_task_detail(
  p_actor   uuid,
  p_token   text,
  p_task_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_task tasks%ROWTYPE;
  v_row  jsonb;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND OR v_task.subcontractor_id IS DISTINCT FROM v_sub THEN
    -- 다른 곳의 작업은 "있는지 없는지"도 알려 주지 않음
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;

  -- Mig 247: 원청 정보는 협력사에 내려 주지 않는다 (원청 id · 원청 몫 계산용 견적 칸 제외, 원청 code·name 제거)
  v_row := (to_jsonb(v_task) - 'principal_id' - 'sub_quote_supply' - 'sub_quote_edited_at' - 'sub_quote_edited_by')
    || jsonb_build_object(
      'assigned_engineer', (
        SELECT jsonb_build_object('name', u.name, 'code', u.code, 'phone', u.phone)
          FROM users u WHERE u.id = v_task.assigned_engineer_id),
      'principal_rel', NULL,
      'payment', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'calc_method', p.calc_method, 'policy_key', p.policy_key,
                 'engineer_amount', p.engineer_amount, 'principal_amount', p.principal_amount,
                 'owner_amount', p.owner_amount, 'is_balanced', p.is_balanced,
                 'status', p.status, 'computed_at', p.computed_at, 'track', p.track,
                 'compute_error', p.compute_error,
                 'engineer_remitted_at', p.engineer_remitted_at,
                 'engineer_remit_confirmed_at', p.engineer_remit_confirmed_at,
                 'engineer_remit_confirmed_by', p.engineer_remit_confirmed_by,
                 'usol_remitted_at', NULL) ORDER BY p.computed_at DESC)
          FROM payments p WHERE p.task_id = v_task.id), '[]'::jsonb),
      'task_items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', ti.id, 'qty', ti.qty, 'unit_price', ti.unit_price, 'subtotal', ti.subtotal,
                 'order_type', ti.order_type, 'product_order_id', ti.product_order_id,
                 'is_canceled', ti.is_canceled, 'canceled_reason', ti.canceled_reason, 'canceled_at', ti.canceled_at,
                 'received_amount', ti.received_amount,
                 'work_types', CASE WHEN wt.id IS NULL THEN NULL ELSE jsonb_build_object(
                     'id', wt.id, 'name', wt.name,
                     'service_types', CASE WHEN st.id IS NULL THEN NULL
                                           ELSE jsonb_build_object('id', st.id, 'code', st.code) END) END,
                 'appliance_types', CASE WHEN at.id IS NULL THEN NULL
                                         ELSE jsonb_build_object('id', at.id, 'name', at.name) END))
          FROM task_items ti
          LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
          LEFT JOIN service_types st   ON st.id = wt.service_type_id
          LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
         WHERE ti.task_id = v_task.id), '[]'::jsonb)
    );

  RETURN jsonb_build_object('ok', true, 'task', v_row);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_get_task_detail(uuid, text, uuid) TO anon, authenticated;

-- [2]
CREATE OR REPLACE FUNCTION trg_sub_daily_principal_remit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub  uuid := COALESCE(NEW.subcontractor_id, OLD.subcontractor_id);
  v_date date := COALESCE(NEW.settle_date, OLD.settle_date);
BEGIN
  -- 입금 확인이 찍힘 -> 줄 만들기 (실패해도 입금 확인 자체는 되돌리지 않는다)
  IF TG_OP <> 'DELETE' AND NEW.confirmed_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.confirmed_at IS NULL) THEN
    BEGIN
      PERFORM _principal_remit_build(v_sub, v_date);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[principal remit] 줄 만들기 실패 - 입금 확인은 계속: %', SQLERRM;
    END;
    RETURN NEW;
  END IF;

  -- 입금 확인을 되돌림 (또는 정산 일자 삭제) -> 그 날짜의 줄을 없앤다. 이미 송금 완료한 줄이 있으면 막는다.
  IF (TG_OP = 'DELETE' AND OLD.confirmed_at IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND OLD.confirmed_at IS NOT NULL AND NEW.confirmed_at IS NULL) THEN
    IF EXISTS (SELECT 1 FROM principal_remits pr
                WHERE pr.subcontractor_id = v_sub AND pr.settle_date = v_date AND pr.paid_at IS NOT NULL) THEN
      RAISE EXCEPTION '이 날짜(%)는 원청 송금 완료로 처리돼 있습니다. 먼저 [원청 송금 완료] 를 되돌린 뒤 다시 시도해 주세요.', v_date;
    END IF;
    -- 이 줄이 넘겨받았던 앞 줄들은 다시 "넘기지 않은 줄" 로 (ON DELETE SET NULL)
    DELETE FROM principal_remits pr WHERE pr.subcontractor_id = v_sub AND pr.settle_date = v_date;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- [3]
CREATE OR REPLACE FUNCTION admin_mark_principal_remit_paid(p_actor uuid, p_token text, p_remit_id uuid, p_paid boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r    principal_remits%ROWTYPE;
  v_name text;
  v_pn   text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;

  SELECT * INTO v_r FROM principal_remits WHERE id = p_remit_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '줄을 찾지 못했습니다.');
  END IF;
  SELECT name INTO v_name FROM users      WHERE id = p_actor;
  SELECT name INTO v_pn   FROM principals WHERE id = v_r.principal_id;

  IF COALESCE(p_paid, true) THEN
    IF v_r.paid_at IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'already', true);
    END IF;
    IF v_r.absorbed_into IS NOT NULL OR v_r.amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', '보낼 금액이 없는 줄입니다.');
    END IF;
    UPDATE principal_remits SET paid_at = now(), paid_by = p_actor, paid_by_name = COALESCE(v_name, '') WHERE id = p_remit_id;
    BEGIN
      INSERT INTO bookkeeping_cashflow (tenant_id, direction, amount, flow_date, memo, created_by, source, source_ref)
      VALUES (v_r.tenant_id, 'out', v_r.amount, (now() AT TIME ZONE 'Asia/Seoul')::date,
              '원청 송금 (' || to_char(v_r.settle_date, 'FMMM/FMDD') || ' 입금 확인분)',
              p_actor, 'principal_fee', v_r.id)
      ON CONFLICT (source, source_ref) WHERE source IS NOT NULL DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', true, 'cashflow_error', SQLERRM);
    END;
  ELSE
    IF v_r.paid_at IS NULL THEN
      RETURN jsonb_build_object('ok', true, 'already', true);
    END IF;
    UPDATE principal_remits SET paid_at = NULL, paid_by = NULL, paid_by_name = NULL WHERE id = p_remit_id;
    BEGIN
      DELETE FROM bookkeeping_cashflow WHERE source = 'principal_fee' AND source_ref = v_r.id;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', true, 'cashflow_error', SQLERRM);
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_remit_id);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_mark_principal_remit_paid(uuid, text, uuid, boolean) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 - 기대: 3행 모두 "이름_없음" = true
-- ============================================================================
SELECT proname AS 함수,
       CASE proname
         WHEN 'sub_get_task_detail' THEN position('p.name' IN prosrc) = 0
         ELSE position('쿨가이' IN prosrc) = 0
       END AS 이름_없음
  FROM pg_proc
 WHERE proname IN ('sub_get_task_detail', 'trg_sub_daily_principal_remit', 'admin_mark_principal_remit_paid')
 ORDER BY 1;
