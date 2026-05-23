-- 060_principal_remit_rpcs.sql
-- 2026-05-23 — 주간 정산 입금 워크플로 RPC 3개
-- 설계:
--   · SECURITY DEFINER + RPC 내부에서 role/principal 검사
--   · partner는 자기 principal_id만, owner/operator는 ALL
--   · confirmed_at NOT NULL row는 변경 차단 (보고 측 측 catch)

-- ============================================
-- [1] mark_principal_remitted — 원청 "입금했습니다" 보고
-- ============================================
-- 같은 (principal_id, week_start) row가 이미 있으면 UPSERT (단 confirmed_at NULL일 때만).
-- 반환: jsonb { ok, id?, error? }

CREATE OR REPLACE FUNCTION mark_principal_remitted(
  p_principal_id uuid,
  p_week_start   date,
  p_week_end     date,
  p_amount       int,
  p_note         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_id     uuid;
  v_user   uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  v_is_admin := current_user_has_role('owner') OR current_user_has_role('operator');

  -- 권한 — partner OR owner/operator
  IF NOT (current_user_has_role('partner') OR v_is_admin) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- partner는 자기 principal_id만 (admin은 전체 허용)
  IF NOT v_is_admin THEN
    IF NOT (p_principal_id = ANY(current_user_principal_ids())) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'principal_not_authorized');
    END IF;
  END IF;

  -- 입력 검증
  IF p_week_end < p_week_start THEN
    RETURN jsonb_build_object('ok', false, 'error', 'week_range_invalid');
  END IF;
  IF p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_negative');
  END IF;

  -- tenant_id (principal 측 측)
  SELECT tenant_id INTO v_tenant FROM principals WHERE id = p_principal_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'principal_not_found');
  END IF;

  -- UPSERT — confirmed_at NULL일 때만 갱신, 이미 확인된 row는 차단
  INSERT INTO principal_weekly_remittances
    (tenant_id, principal_id, week_start, week_end,
     remitted_amount, remitted_at, remitted_by, note)
  VALUES
    (v_tenant, p_principal_id, p_week_start, p_week_end,
     p_amount, now(), v_user, p_note)
  ON CONFLICT (principal_id, week_start) DO UPDATE
    SET week_end        = EXCLUDED.week_end,
        remitted_amount = EXCLUDED.remitted_amount,
        remitted_at     = EXCLUDED.remitted_at,
        remitted_by     = EXCLUDED.remitted_by,
        note            = EXCLUDED.note,
        updated_at      = now()
    WHERE principal_weekly_remittances.confirmed_at IS NULL
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- ON CONFLICT 측 WHERE confirmed_at IS NULL 측 catch — 이미 확인된 row
    RETURN jsonb_build_object('ok', false, 'error', 'already_confirmed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_principal_remitted(uuid, date, date, int, text) TO authenticated;

-- ============================================
-- [2] confirm_principal_remittance — 회사 "입금 확인"
-- ============================================
CREATE OR REPLACE FUNCTION confirm_principal_remittance(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row  principal_weekly_remittances;
BEGIN
  IF NOT (current_user_has_role('owner') OR current_user_has_role('operator')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_row FROM principal_weekly_remittances WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_row.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_confirmed');
  END IF;

  UPDATE principal_weekly_remittances
     SET confirmed_at = now(),
         confirmed_by = v_user,
         updated_at   = now()
   WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_principal_remittance(uuid) TO authenticated;

-- ============================================
-- [3] undo_principal_remit — 원청 "보고 취소" (confirmed_at NULL 측 측)
-- ============================================
CREATE OR REPLACE FUNCTION undo_principal_remit(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row principal_weekly_remittances;
BEGIN
  SELECT * INTO v_row FROM principal_weekly_remittances WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_row.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_confirmed');
  END IF;

  -- 권한 — partner는 자기 principal_id, admin은 전체
  IF NOT (
    (current_user_has_role('partner')  AND v_row.principal_id = ANY(current_user_principal_ids()))
    OR current_user_has_role('owner')
    OR current_user_has_role('operator')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM principal_weekly_remittances WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION undo_principal_remit(uuid) TO authenticated;

-- ============================================
-- 검증 SQL — 실행 후 확인
-- ============================================
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('mark_principal_remitted','confirm_principal_remittance','undo_principal_remit');
-- → 3 row 기대
