-- ============================================================================
-- Migration 214 - 묶음 1 (3/3): 협력사 관리자 / 운영자용 함수
-- 작성 2026-10-06 · 선행: 211a, 212, 213
--
-- 원칙 (D2)
--   · 전부 SECURITY DEFINER. subcontractors 표는 직접 접근이 막혀 있습니다.
--   · 호출자의 소속은 브라우저가 보낸 값을 믿지 않고 users 에서 다시 읽습니다.
--   · 세션 확인은 유예 없는 _session_check_strict (211a) - 세션 값이 없으면 거부.
--     -> 이 함수들을 쓰는 화면은 211a 이후 로그인한 계정에서만 동작합니다.
--
-- 내용
--   공용     _caller_subcontractor          호출자 소속 조회
--            list_subcontractor_names       이름표 (id/code/name 만 - 민감 정보 없음)
--   운영자   admin_list_subcontractors      협력사 목록 + 사업자 정보 + 인원 수
--            admin_upsert_subcontractor     협력사 등록·수정
--            admin_set_user_subcontractor   사용자 소속·구분 지정 (해제 포함)
--            admin_assign_task_to_subcontractor  작업을 협력사로 넘기기 / 직영으로 회수
--   협력사   sub_list_staff                 자기 협력사 직원 목록
--   관리자   sub_list_tasks                 자기 협력사 작업 목록
--            sub_assign_task                자기 직원에게 배정 / 배정 해제
--
-- 기존 데이터 영향: 없음 (새 함수만 추가).
-- ============================================================================

BEGIN;

-- ============================================================
-- 공용 1) 호출자 소속 - 활성 사용자 + 활성 협력사일 때만 값 반환
-- ============================================================
CREATE OR REPLACE FUNCTION _caller_subcontractor(p_actor uuid)
RETURNS TABLE (sub_id uuid, sub_role text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT u.subcontractor_id, u.sub_role
    FROM users u
    JOIN subcontractors s ON s.id = u.subcontractor_id AND s.active = true
   WHERE u.id = p_actor
     AND u.is_active = true;
$$;

-- ============================================================
-- 공용 2) 이름표 - 작업 목록에 "화이트코어 · 직원명" 을 표시하기 위한 최소 정보
-- ============================================================
CREATE OR REPLACE FUNCTION list_subcontractor_names()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name, 'active', active) ORDER BY name),
    '[]'::jsonb)
  FROM subcontractors
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
$$;

GRANT EXECUTE ON FUNCTION list_subcontractor_names() TO anon, authenticated;

-- ============================================================
-- 운영자 1) 협력사 목록 (사업자 정보 포함)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_list_subcontractors(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'subcontractors', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', s.id, 'code', s.code, 'name', s.name, 'phone', s.phone,
             'business_name', s.business_name, 'representative_name', s.representative_name,
             'business_no', s.business_no, 'business_address', s.business_address,
             'tax_type', s.tax_type, 'memo', s.memo, 'active', s.active,
             'manager_count', (SELECT COUNT(*) FROM users u WHERE u.subcontractor_id = s.id AND u.sub_role = 'manager' AND u.is_active),
             'staff_count',   (SELECT COUNT(*) FROM users u WHERE u.subcontractor_id = s.id AND u.sub_role = 'staff'   AND u.is_active)
           ) ORDER BY s.name)
      FROM subcontractors s
     WHERE s.tenant_id = '11111111-1111-1111-1111-111111111111'
  ), '[]'::jsonb));
END;
$$;

-- ============================================================
-- 운영자 2) 협력사 등록·수정
--   p_id NULL = 새로 등록 (code, name 필수). 값이 있으면 p_patch 에 들어온 칸만 수정.
-- ============================================================
CREATE OR REPLACE FUNCTION admin_upsert_subcontractor(
  p_actor uuid,
  p_token text,
  p_id    uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := '11111111-1111-1111-1111-111111111111';
  v_id     uuid;
  v_bizno  text := NULLIF(TRIM(COALESCE(p_patch ->> 'business_no', '')), '');
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF v_bizno IS NOT NULL AND v_bizno !~ '^\d{3}-\d{2}-\d{5}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', '사업자번호 형식이 맞지 않습니다 (000-00-00000).');
  END IF;

  IF p_id IS NULL THEN
    IF COALESCE(TRIM(p_patch ->> 'code'), '') = '' OR COALESCE(TRIM(p_patch ->> 'name'), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', '협력사 코드와 이름은 필수입니다.');
    END IF;
    IF EXISTS (SELECT 1 FROM subcontractors WHERE tenant_id = v_tenant AND code = TRIM(p_patch ->> 'code')) THEN
      RETURN jsonb_build_object('ok', false, 'error', '이미 있는 협력사 코드입니다.');
    END IF;
    INSERT INTO subcontractors (tenant_id, code, name, phone, business_name, representative_name,
                                business_no, business_address, tax_type, memo)
    VALUES (v_tenant, TRIM(p_patch ->> 'code'), TRIM(p_patch ->> 'name'), p_patch ->> 'phone',
            p_patch ->> 'business_name', p_patch ->> 'representative_name',
            v_bizno, p_patch ->> 'business_address', p_patch ->> 'tax_type', p_patch ->> 'memo')
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'action', 'create');
  END IF;

  UPDATE subcontractors SET
    name                = CASE WHEN p_patch ? 'name'                THEN COALESCE(NULLIF(TRIM(p_patch ->> 'name'), ''), name) ELSE name END,
    phone               = CASE WHEN p_patch ? 'phone'               THEN p_patch ->> 'phone'               ELSE phone END,
    business_name       = CASE WHEN p_patch ? 'business_name'       THEN p_patch ->> 'business_name'       ELSE business_name END,
    representative_name = CASE WHEN p_patch ? 'representative_name' THEN p_patch ->> 'representative_name' ELSE representative_name END,
    business_no         = CASE WHEN p_patch ? 'business_no'         THEN v_bizno                           ELSE business_no END,
    business_address    = CASE WHEN p_patch ? 'business_address'    THEN p_patch ->> 'business_address'    ELSE business_address END,
    tax_type            = CASE WHEN p_patch ? 'tax_type'            THEN p_patch ->> 'tax_type'            ELSE tax_type END,
    memo                = CASE WHEN p_patch ? 'memo'                THEN p_patch ->> 'memo'                ELSE memo END,
    active              = CASE WHEN p_patch ? 'active'              THEN (p_patch ->> 'active')::boolean   ELSE active END,
    updated_at          = now()
  WHERE id = p_id AND tenant_id = v_tenant
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사를 찾지 못했습니다.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'action', 'update');
END;
$$;

-- ============================================================
-- 운영자 3) 사용자 소속 지정
--   p_subcontractor_id NULL = 소속 해제(직영). p_sub_role = 'manager' | 'staff'.
--   소속을 바꿔도 이미 배정된 진행 중 작업의 수행처는 자동으로 바뀌지 않으므로
--   그 건수를 open_tasks 로 돌려줍니다 (화면에서 안내).
-- ============================================================
CREATE OR REPLACE FUNCTION admin_set_user_subcontractor(
  p_actor            uuid,
  p_token            text,
  p_user_id          uuid,
  p_subcontractor_id uuid,
  p_sub_role         text DEFAULT 'staff'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := '11111111-1111-1111-1111-111111111111';
  v_open   int;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND tenant_id = v_tenant) THEN
    RETURN jsonb_build_object('ok', false, 'error', '사용자를 찾지 못했습니다.');
  END IF;
  -- 운영자 계정을 협력사 소속으로 두지 않음 (권한 혼선 방지)
  IF p_subcontractor_id IS NOT NULL AND _caller_is_admin(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자 계정은 협력사 소속으로 지정할 수 없습니다.');
  END IF;

  IF p_subcontractor_id IS NULL THEN
    UPDATE users SET subcontractor_id = NULL, sub_role = NULL WHERE id = p_user_id;
  ELSE
    IF p_sub_role NOT IN ('manager', 'staff') THEN
      RETURN jsonb_build_object('ok', false, 'error', '구분은 관리자 또는 직원이어야 합니다.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM subcontractors WHERE id = p_subcontractor_id AND tenant_id = v_tenant) THEN
      RETURN jsonb_build_object('ok', false, 'error', '협력사를 찾지 못했습니다.');
    END IF;
    UPDATE users SET subcontractor_id = p_subcontractor_id, sub_role = p_sub_role WHERE id = p_user_id;
  END IF;

  SELECT COUNT(*) INTO v_open
    FROM tasks
   WHERE assigned_engineer_id = p_user_id
     AND status NOT IN ('완료', '취소', 'visit_only', '정산완료')
     AND subcontractor_id IS DISTINCT FROM p_subcontractor_id;

  RETURN jsonb_build_object('ok', true, 'open_tasks', v_open);
END;
$$;

-- ============================================================
-- 운영자 4) 작업을 협력사로 넘기기 / 직영으로 회수
--   p_subcontractor_id 값 있음 = 그 협력사로 넘김. 현재 배정 기사가 그 협력사 직원이
--                                아니면 배정을 풀고 '미배정' 으로 둡니다 (협력사 관리자가 직원 지정).
--   p_subcontractor_id NULL    = 직영으로 회수. 협력사 직원이 배정돼 있었다면 배정을 풉니다.
-- ============================================================
CREATE OR REPLACE FUNCTION admin_assign_task_to_subcontractor(
  p_actor            uuid,
  p_token            text,
  p_task_id          uuid,
  p_subcontractor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task         tasks%ROWTYPE;
  v_engineer_sub uuid;
  v_keep         boolean := false;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.status IN ('완료', '취소', 'visit_only', '정산완료') THEN
    RETURN jsonb_build_object('ok', false, 'error', '끝난 작업은 넘길 수 없습니다.');
  END IF;
  IF p_subcontractor_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM subcontractors WHERE id = p_subcontractor_id AND active = true) THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사를 찾지 못했습니다.');
  END IF;

  IF v_task.assigned_engineer_id IS NOT NULL THEN
    SELECT subcontractor_id INTO v_engineer_sub FROM users WHERE id = v_task.assigned_engineer_id;
    v_keep := (v_engineer_sub IS NOT DISTINCT FROM p_subcontractor_id);
  END IF;

  IF v_keep THEN
    UPDATE tasks SET subcontractor_id = p_subcontractor_id, updated_at = now()
     WHERE id = p_task_id;
  ELSE
    UPDATE tasks SET
      subcontractor_id     = p_subcontractor_id,
      assigned_engineer_id = NULL,
      status               = '미배정',
      push_candidates      = '[]'::jsonb,
      updated_at           = now()
    WHERE id = p_task_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id,
                            'subcontractor_id', p_subcontractor_id, 'engineer_kept', v_keep);
END;
$$;

-- ============================================================
-- 협력사 관리자 1) 자기 협력사 직원 목록
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_staff(p_actor uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'staff', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', u.id, 'code', u.code, 'name', u.name, 'phone', u.phone, 'sub_role', u.sub_role,
             'open_tasks', (SELECT COUNT(*) FROM tasks t
                             WHERE t.assigned_engineer_id = u.id
                               AND t.subcontractor_id = v_sub
                               AND t.status NOT IN ('완료', '취소', 'visit_only', '정산완료'))
           ) ORDER BY u.name)
      FROM users u
     WHERE u.subcontractor_id = v_sub
       AND u.is_active = true
  ), '[]'::jsonb));
END;
$$;

-- ============================================================
-- 협력사 관리자 2) 자기 협력사 작업 목록
--   · 끝나지 않은 작업은 전부
--   · 끝난 작업은 p_from ~ p_to (완료일, 한국 시간) 범위만. 기본 = 최근 31일.
--   고객 연락처·주소는 현장 수행에 필요하므로 포함합니다. 원청 정보, 올데이케어의
--   다른 작업, 다른 협력사 작업은 나오지 않습니다.
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_tasks(
  p_actor uuid,
  p_token text,
  p_from  date DEFAULT NULL,
  p_to    date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_from date := COALESCE(p_from, ((now() AT TIME ZONE 'Asia/Seoul')::date - 31));
  v_to   date := COALESCE(p_to,   (now() AT TIME ZONE 'Asia/Seoul')::date);
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'tasks', COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.sort_at DESC NULLS LAST)
    FROM (
      SELECT
        t.id, t.task_no, t.status,
        t.customer_name, t.phone, t.address, t.district,
        t.requested_date, t.requested_time, t.scheduled_at,
        t.started_at, t.completed_at,
        t.request_note, t.work_memo,
        t.category_data ->> 'workType' AS work_type,
        t.category_data -> 'workItems' AS work_items,
        t.product_price, t.received_total,
        t.assigned_engineer_id,
        u.name  AS engineer_name,
        u.phone AS engineer_phone,
        COALESCE(t.scheduled_at, t.requested_date::timestamptz, t.received_at) AS sort_at
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_engineer_id
      WHERE t.subcontractor_id = v_sub
        AND (
          t.status NOT IN ('완료', '취소', 'visit_only', '정산완료')
          OR (t.completed_at IS NOT NULL
              AND (t.completed_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN v_from AND v_to)
        )
    ) x
  ), '[]'::jsonb));
END;
$$;

-- ============================================================
-- 협력사 관리자 3) 자기 직원에게 배정 / 배정 해제
--   p_engineer_id NULL = 배정 해제 (직원 미정으로 되돌림).
--   작업도 직원도 자기 협력사 것이어야 합니다.
-- ============================================================
CREATE OR REPLACE FUNCTION sub_assign_task(
  p_actor       uuid,
  p_token       text,
  p_task_id     uuid,
  p_engineer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
  v_task tasks%ROWTYPE;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.subcontractor_id IS DISTINCT FROM v_sub THEN
    -- 다른 곳의 작업은 "있는지 없는지"도 알려 주지 않음
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.status IN ('완료', '취소', 'visit_only', '정산완료', '취소요청') THEN
    RETURN jsonb_build_object('ok', false, 'error', '이 상태의 작업은 배정을 바꿀 수 없습니다.');
  END IF;
  IF v_task.status = '진행중' THEN
    RETURN jsonb_build_object('ok', false, 'error', '진행 중인 작업은 배정을 바꿀 수 없습니다.');
  END IF;

  IF p_engineer_id IS NULL THEN
    UPDATE tasks SET assigned_engineer_id = NULL, status = '미배정', updated_at = now()
     WHERE id = p_task_id;
    RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'engineer_id', NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users
     WHERE id = p_engineer_id AND subcontractor_id = v_sub AND is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', '소속 직원에게만 배정할 수 있습니다.');
  END IF;

  UPDATE tasks SET
    assigned_engineer_id = p_engineer_id,
    status               = CASE WHEN status = '미배정' THEN '배정' ELSE status END,
    updated_at           = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'engineer_id', p_engineer_id);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_subcontractors(uuid, text)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_subcontractor(uuid, text, uuid, jsonb)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_subcontractor(uuid, text, uuid, uuid, text)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_assign_task_to_subcontractor(uuid, text, uuid, uuid)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sub_list_staff(uuid, text)                                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sub_list_tasks(uuid, text, date, date)                         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sub_assign_task(uuid, text, uuid, uuid)                        TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 9개 - 기대: 9행
SELECT proname FROM pg_proc
 WHERE proname IN ('_caller_subcontractor','list_subcontractor_names','admin_list_subcontractors',
                   'admin_upsert_subcontractor','admin_set_user_subcontractor',
                   'admin_assign_task_to_subcontractor','sub_list_staff','sub_list_tasks','sub_assign_task')
 ORDER BY proname;

-- 2) 이름표 - 기대: 화이트코어 1건
SELECT list_subcontractor_names();

-- 3) 세션 값 없이 호출하면 거부되는지 - 기대: {"ok": false, "error": "다시 로그인해 주세요."}
SELECT sub_list_tasks('00000000-0000-0000-0000-000000000000'::uuid, NULL);
