-- ============================================
-- Migration 003 — RLS + Views + Functions
-- 작성일  : 2026-05-12 (Day 3)
-- 출처    : docs/Supabase_아키텍처.md / 시트_vs_운영DB_갭.md
-- 범위    : RLS 정책 + partner-safe view + compute_payment 함수
-- 전제    : 001_init.sql 적용 박힘 (23 테이블 박혀있어야 함)
-- 실행    : Supabase 콘솔 → SQL Editor → New query → 통째 붙여넣기 → Run
-- 안전장치: BEGIN/COMMIT — 부분 실패 시 자동 ROLLBACK
-- ============================================

BEGIN;

-- ============================================
-- [0] 헬퍼 — 현재 사용자 tenant_id catch
-- ============================================
-- auth.uid() 측 박힌 user_id → users.tenant_id 박음
-- Supabase Auth 측 박힌 user_id = users.id 일치 박는 가정 (004 seed 측 박을 영역)

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_user_has_role(role_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = role_name
  );
$$;

CREATE OR REPLACE FUNCTION current_user_principal_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT principal_id FROM user_roles
  WHERE user_id = auth.uid() AND role = 'partner' AND is_primary = true
  LIMIT 1;
$$;

-- ============================================
-- [1] RLS — 모든 테이블 측 활성
-- ============================================

ALTER TABLE tenants                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE principals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE appliance_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_types              ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_policies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_off_days           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_disputes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dispute_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineer_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineer_work_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineer_zones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments        ENABLE ROW LEVEL SECURITY;

-- ============================================
-- [2] tenant 격리 정책 — 모든 테이블 측 박음
-- ============================================
-- 기본 원칙: 자신의 tenant 박힌 영역만 catch

-- tenants — 자기 tenant 만
CREATE POLICY tenants_self ON tenants FOR SELECT
  USING (id = current_tenant_id());

-- principals
CREATE POLICY principals_tenant ON principals FOR ALL
  USING (tenant_id = current_tenant_id());

-- users (자기 tenant + 자기 자신 catch)
CREATE POLICY users_tenant_select ON users FOR SELECT
  USING (tenant_id = current_tenant_id());
CREATE POLICY users_self_update ON users FOR UPDATE
  USING (id = auth.uid());

-- user_roles
CREATE POLICY user_roles_tenant ON user_roles FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE tenant_id = current_tenant_id()));

-- 카테고리 메타 (전체 공개 / read-only — 모든 tenant 박힘)
CREATE POLICY categories_public ON categories FOR SELECT USING (true);
CREATE POLICY service_types_public ON service_types FOR SELECT USING (true);
CREATE POLICY appliance_types_public ON appliance_types FOR SELECT USING (true);
CREATE POLICY work_types_public ON work_types FOR SELECT USING (true);

-- tenant_categories (자기 tenant 박힌 영역)
CREATE POLICY tenant_categories_self ON tenant_categories FOR ALL
  USING (tenant_id = current_tenant_id());

-- commission_policies (자기 tenant 박힘)
CREATE POLICY commission_policies_tenant ON commission_policies FOR ALL
  USING (tenant_id = current_tenant_id());

-- ============================================
-- [3] tasks — Role별 정책
-- ============================================
-- owner / operator: 모든 작업 catch
-- engineer: 자기 배정 또는 추천 박힌 작업만
-- partner: 자기 원청 작업만

CREATE POLICY tasks_owner_operator_all ON tasks FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND (current_user_has_role('owner') OR current_user_has_role('operator'))
  );

CREATE POLICY tasks_engineer_assigned ON tasks FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND current_user_has_role('engineer')
    AND (
      assigned_engineer_id = auth.uid()
      OR recommended_engineer_id = auth.uid()
    )
  );

CREATE POLICY tasks_partner_own ON tasks FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND current_user_has_role('partner')
    AND principal_id = current_user_principal_id()
  );

-- engineer 측 자기 작업 측 update (status / 시작 / 완료 / 사진 등)
CREATE POLICY tasks_engineer_update ON tasks FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND current_user_has_role('engineer')
    AND assigned_engineer_id = auth.uid()
  );

-- ============================================
-- [4] task_items / payments / photos — task 측 권한 inherit
-- ============================================

CREATE POLICY task_items_inherit ON task_items FOR ALL
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE tenant_id = current_tenant_id()
    )
  );

-- payments — engineer 측 자기 정산만 / owner+operator 측 모두 / partner 측 자기 원청만
CREATE POLICY payments_owner_operator ON payments FOR ALL
  USING (
    task_id IN (SELECT id FROM tasks WHERE tenant_id = current_tenant_id())
    AND (current_user_has_role('owner') OR current_user_has_role('operator'))
  );

CREATE POLICY payments_engineer_own ON payments FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE tenant_id = current_tenant_id() AND assigned_engineer_id = auth.uid()
    )
  );

CREATE POLICY payments_partner_own ON payments FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE tenant_id = current_tenant_id() AND principal_id = current_user_principal_id()
    )
  );

CREATE POLICY photos_inherit ON photos FOR ALL
  USING (
    task_id IN (SELECT id FROM tasks WHERE tenant_id = current_tenant_id())
  );

-- ============================================
-- [5] 운영 측 보조 테이블 — tenant 격리
-- ============================================

CREATE POLICY user_off_days_self ON user_off_days FOR ALL
  USING (user_id = auth.uid() OR current_user_has_role('owner') OR current_user_has_role('operator'));

CREATE POLICY engineer_permissions_tenant ON engineer_permissions FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE tenant_id = current_tenant_id()));

CREATE POLICY engineer_work_durations_tenant ON engineer_work_durations FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE tenant_id = current_tenant_id()));

CREATE POLICY user_preferences_self ON user_preferences FOR ALL
  USING (user_id = auth.uid() OR current_user_has_role('owner') OR current_user_has_role('operator'));

CREATE POLICY engineer_zones_tenant ON engineer_zones FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE tenant_id = current_tenant_id()));

CREATE POLICY task_assignments_tenant ON task_assignments FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_tenant_id()));

CREATE POLICY status_history_tenant ON status_history FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_tenant_id()));

CREATE POLICY task_disputes_tenant ON task_disputes FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = current_tenant_id()));

CREATE POLICY task_dispute_messages_tenant ON task_dispute_messages FOR ALL
  USING (dispute_id IN (SELECT id FROM task_disputes
    WHERE task_id IN (SELECT id FROM tasks WHERE tenant_id = current_tenant_id())));

-- ============================================
-- [6] partner-safe VIEW — 원청 측 catch 박을 컬럼 제한
-- ============================================
-- 원청 측: 자기 원청 작업 catch / 기사 개인정보 catch X / 정산 상세 catch X

CREATE OR REPLACE VIEW tasks_partner_view AS
SELECT
  t.id,
  t.tenant_id,
  t.task_no,
  t.principal_id,
  t.customer_name,
  t.address,
  t.district,
  t.channel,
  t.is_urgent,
  t.status,
  -- 기사 이름만 catch / 전화 / id 측 catch X
  (SELECT name FROM users WHERE id = t.assigned_engineer_id) AS assigned_engineer_name,
  t.requested_date,
  t.requested_time,
  t.scheduled_at,
  t.started_at,
  t.completed_at,
  t.product_price,
  t.travel_fee,
  t.total_amount,
  t.received_at,
  t.created_at
FROM tasks t
WHERE current_user_has_role('partner')
  AND t.principal_id = current_user_principal_id()
  AND t.tenant_id = current_tenant_id();

COMMENT ON VIEW tasks_partner_view IS
  '원청 측 안전 view — 기사 개인정보 / 정산 상세 / 분쟁 catch X';

-- ============================================
-- [7] compute_payment 함수 — commission_policies + tasks → payments 자동 계산
-- ============================================
-- 8 calc_method 박힘:
--   1. 비율             — engineer = product * rate
--   2. 차감후비율       — engineer = (product - 부가세) * rate
--   3. 금액             — engineer = 정액
--   4. 수량비율         — engineer = product * rate * qty_factor
--   5. AG전체_AD반반    — engineer = naver_full + extra/2 (네이버 전체 + 추가금 반반)
--   6. 예상금액비율     — engineer = estimated * rate
--   7. 비율_총액기준    — engineer = total_amount * rate
--   8. 추가선택         — 수동 박음 (계산 X / payments 측 직접 박음)

CREATE OR REPLACE FUNCTION compute_payment(p_task_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_task           tasks%ROWTYPE;
  v_principal_code text;
  v_first_item     task_items%ROWTYPE;
  v_service_code   text;
  v_appliance_code text;
  v_policy         commission_policies%ROWTYPE;
  v_engineer       int := 0;
  v_principal_amt  int := 0;
  v_owner          int := 0;
  v_payment_id     uuid;
  v_total          int;
  v_rate           numeric;
BEGIN
  -- 1) task 박음
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task 박지 X: %', p_task_id;
  END IF;

  -- 2) principal_code 박음
  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;

  -- 3) 첫 task_item 박음 (멀티 아이템 측 첫 행 기준)
  SELECT * INTO v_first_item FROM task_items WHERE task_id = p_task_id LIMIT 1;

  SELECT code INTO v_service_code FROM service_types WHERE id IN (
    SELECT service_type_id FROM work_types WHERE id = v_first_item.work_type_id
  );
  SELECT code INTO v_appliance_code FROM appliance_types WHERE id = v_first_item.appliance_type_id;

  -- 4) 정책 lookup
  SELECT * INTO v_policy FROM commission_policies
  WHERE tenant_id = v_task.tenant_id
    AND principal_code = v_principal_code
    AND service_code = v_service_code
    AND (appliance_code = v_appliance_code OR appliance_code IS NULL)
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  ORDER BY appliance_code NULLS LAST, effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commission_policy 박지 X: principal=% service=% appliance=%',
      v_principal_code, v_service_code, v_appliance_code;
  END IF;

  v_total := COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0) + COALESCE(v_task.travel_fee, 0);
  v_rate := COALESCE(v_policy.engineer_ad_rate, 0);

  -- 5) calc_method 측 분기
  CASE v_policy.calc_method
    WHEN '비율' THEN
      v_engineer := (v_task.product_price * v_rate)::int;
    WHEN '차감후비율' THEN
      -- 부가세 차감 (10%) 후 비율
      v_engineer := ((v_task.product_price / 1.1) * v_rate)::int;
    WHEN '금액' THEN
      v_engineer := COALESCE(v_policy.engineer_base, 0);
    WHEN '수량비율' THEN
      v_engineer := (v_task.product_price * v_rate * COALESCE(v_first_item.qty, 1))::int;
    WHEN 'AG전체_AD반반' THEN
      -- 네이버정산금 전체 + 현장추가금 반반
      v_engineer := v_task.product_price + (v_task.extra_fee / 2);
    WHEN '예상금액비율' THEN
      v_engineer := (v_task.product_price * v_rate)::int;
    WHEN '비율_총액기준' THEN
      v_engineer := (v_total * v_rate)::int;
    WHEN '추가선택' THEN
      v_engineer := COALESCE(v_policy.engineer_actual_ad, 0);
    ELSE
      RAISE EXCEPTION 'unknown calc_method: %', v_policy.calc_method;
  END CASE;

  -- 원청 수수료 / 회사 마진 (단순 계산 — 운영 측 정책 박는 영역 별도 적용 가능)
  -- v_principal_amt = product * principal_fee_rate (현재는 0 박음)
  v_owner := v_total - v_engineer - v_principal_amt;

  -- 6) payments 측 박음 (UPSERT 패턴)
  DELETE FROM payments WHERE task_id = p_task_id;
  INSERT INTO payments (
    task_id, computed_by,
    policy_key, calc_method,
    product_price, extra_fee, travel_fee, naver_fee,
    engineer_amount, principal_amount, owner_amount,
    status
  ) VALUES (
    p_task_id, auth.uid(),
    v_policy.policy_key, v_policy.calc_method,
    v_task.product_price, v_task.extra_fee, v_task.travel_fee, 0,
    v_engineer, v_principal_amt, v_owner,
    '미정산'
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION compute_payment IS
  'task 측 정산 자동 계산 / commission_policies lookup → payments 박음 (8 calc_method 측 분기)';

-- ============================================
-- [8] task 측 status 변경 시 자동 trigger — status_history 박음
-- ============================================

CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO status_history (task_id, changed_by, from_status, to_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_status_change ON tasks;
CREATE TRIGGER tasks_status_change
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_status_change();

COMMIT;

-- ============================================
-- 끝 — RLS 23개 + 정책 ~25개 + view 1개 + 함수 4개 + trigger 1개
-- 다음: 004_seed.sql (시드 데이터)
-- ============================================
