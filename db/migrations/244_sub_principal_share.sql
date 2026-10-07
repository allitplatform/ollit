-- ============================================================================
-- Migration 244 - 협력사 작업의 원청 몫(쿨가이) + 견적 보관 칸 + 주방후드 단가표
-- 작성 2026-10-07 · 선행: 215, 216c, 219, 226, 241
--
-- 사장님 확정 (2026-10-07)
--   · 화이트코어 몫 · 화이트코어가 올데이케어에 보내는 수수료(35%)는 원청과 무관하게 그대로.
--   · 원청이 쿨가이(KB)일 때만 그 수수료 안에서 쿨가이 몫을 따로 적는다.
--       쿨가이 몫 = LEAST(견적 공급가 x 35%, 수수료)      올데이케어 실제 몫 = 수수료 - 쿨가이 몫
--   · 저장 방식 "나안": payments.owner_amount 는 지금처럼 수수료 전액. 쿨가이 몫은 새 칸
--     payments.sub_principal_share 에만 적는다. 화이트코어 송금 흐름 함수(225·231·234·238·221)는 건드리지 않는다.
--   · 견적 = 협력사로 넘기는 순간의 견적 금액을 따로 보관 (tasks.sub_quote_supply). 운영자가 고칠 수 있다.
--   · 주방후드 단가표를 작업 종류로 넣는다. 기존 "(공통)" 줄은 지우지 않는다 (과거 작업 연결 유지).
--
-- 내용
--   [0] 확인 가드     원청 code 'KB' 의 이름에 "쿨가이" 가 없으면 멈춘다 (아무것도 바꾸지 않음)
--   [1] 칸 추가       fee_rules.principal_rate / principal_base,  payments.sub_principal_share / sub_principal_note,
--                     tasks.sub_quote_supply / sub_quote_edited_at / sub_quote_edited_by
--   [2] 규칙          화이트코어 x KB 전용 줄: 수수료 35%(공급가) + 원청 몫 35%(견적)
--   [3] 견적 보관     협력사로 넘기는 순간 견적을 채우는 트리거 + 기존 협력사 작업 채우기 + 운영자 수정 함수
--   [4] 단가표        주방후드 작업 종류 9줄 (업소용 3 · 가정용 3 · 옵션 3)
--   [5] 계산          compute_payment v30.2 - 협력사 분기에 원청 몫 4곳만 추가
--                     (저장소의 mig 216c 본문에서 자동으로 만들었고, 추가한 조각을 되돌리면 216c 와 글자 하나까지 같습니다)
--   [6] 조회          admin_get_sub_splits (운영자 전용) - 작업별 견적 · 수수료 · 쿨가이 몫 · 올데이케어 몫
--
-- 기존 데이터 영향
--   · 이미 완료된 협력사 작업의 분배(협력사 보유분 · 수수료)는 바뀌지 않습니다. 원청 몫 칸은 0 으로 시작합니다.
--   · 원청이 KB 인 협력사 작업이 이미 완료돼 있다면, 다시 계산되기 전까지 원청 몫이 0 입니다
--     (맨 아래 검증 "3 다시 계산이 필요한 작업" 에 나옵니다. 0건이면 할 일 없음).
-- 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [0] 확인 가드 - KB 가 쿨가이인지
-- ============================================================
DO $$
DECLARE
  v_name text;
BEGIN
  SELECT name INTO v_name FROM principals WHERE code = 'KB';
  IF v_name IS NULL THEN
    RAISE EXCEPTION '원청 code KB 가 없습니다. 쿨가이의 code 를 확인해 주세요 (db/ops/check_principals_and_sub_quote.sql). 아무것도 바꾸지 않았습니다.';
  END IF;
  IF position('쿨가이' IN v_name) = 0 THEN
    RAISE EXCEPTION '원청 code KB 의 이름이 "%" 입니다 ("쿨가이" 가 들어 있지 않음). 쿨가이의 code 를 확인해 주세요. 아무것도 바꾸지 않았습니다.', v_name;
  END IF;
END $$;

-- ============================================================
-- [1] 칸 추가
-- ============================================================
ALTER TABLE fee_rules
  ADD COLUMN IF NOT EXISTS principal_rate numeric CHECK (principal_rate IS NULL OR (principal_rate >= 0 AND principal_rate <= 1)),
  ADD COLUMN IF NOT EXISTS principal_base text    CHECK (principal_base IS NULL OR principal_base IN ('quote'));
COMMENT ON COLUMN fee_rules.principal_rate IS
  '원청 몫 율. 값이 있으면 수수료 가운데 원청 몫 = LEAST(기준금액 x 율, 수수료). NULL = 원청 몫 없음.';
COMMENT ON COLUMN fee_rules.principal_base IS
  '원청 몫 기준금액. quote = 견적 공급가(tasks.sub_quote_supply).';

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS sub_principal_share int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sub_principal_note  text;
COMMENT ON COLUMN payments.sub_principal_share IS
  '협력사 작업(track S)의 수수료(owner_amount) 가운데 원청에 줄 금액. 분배 합계 검사에는 들어가지 않는다 (owner_amount 안에 포함된 금액).';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sub_quote_supply    int,
  ADD COLUMN IF NOT EXISTS sub_quote_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS sub_quote_edited_by uuid REFERENCES users(id);
COMMENT ON COLUMN tasks.sub_quote_supply IS
  '협력사 작업의 견적 공급가(부가세 제외). 협력사로 넘기는 순간의 견적을 보관한다. 이후 항목이 바뀌어도 따라가지 않는다. 운영자가 고치면 sub_quote_edited_at 에 표시.';

-- 원청 몫 계산식 (한 곳에서만 정의 - 계산 함수와 검증이 같이 쓴다)
CREATE OR REPLACE FUNCTION _sub_principal_share(p_quote int, p_fee int, p_rate numeric)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_rate IS NULL OR COALESCE(p_fee, 0) <= 0 THEN 0
    WHEN COALESCE(p_quote, 0) <= 0 THEN GREATEST(p_fee, 0)                      -- 견적 없음 -> 수수료 전액 (덜 주는 실수 방지)
    ELSE GREATEST(LEAST(ROUND(p_quote * p_rate)::int, p_fee), 0)
  END;
$$;

-- ============================================================
-- [2] 규칙 - 화이트코어 x 쿨가이(KB): 수수료 35%(공급가) + 원청 몫 35%(견적)
--     (기존 "모든 원청" 줄은 그대로. 규칙 찾기는 더 구체적인 줄이 먼저다.)
-- ============================================================
INSERT INTO fee_rules (tenant_id, subcontractor_id, principal_code, service_code,
                       fee_type, fee_rate, fee_base, principal_rate, principal_base, effective_from, memo)
SELECT s.tenant_id, s.id, 'KB', NULL, 'rate', 0.35, 'supply', 0.35, 'quote', DATE '2026-10-01',
       '화이트코어 x 쿨가이(KB): 수수료 = 공급가액의 35%. 그 가운데 쿨가이 몫 = 견적 공급가의 35% (수수료를 넘지 않음). 2026-10-07 사장님 확정.'
  FROM subcontractors s
 WHERE s.code = 'whitecore'
   AND NOT EXISTS (SELECT 1 FROM fee_rules f WHERE f.subcontractor_id = s.id AND f.principal_code = 'KB');

-- ============================================================
-- [3] 견적 보관
-- ============================================================
-- 협력사로 넘기는 순간(협력사가 새로 지정될 때) 견적을 채운다.
--   운영자가 고친 값(sub_quote_edited_at 있음)은 회수 후 다시 넘겨도 유지한다.
CREATE OR REPLACE FUNCTION trg_tasks_sub_quote_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subcontractor_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.subcontractor_id IS DISTINCT FROM NEW.subcontractor_id)
     AND NEW.sub_quote_edited_at IS NULL THEN
    NEW.sub_quote_supply := COALESCE(NEW.product_price, 0);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tasks_sub_quote_snapshot ON tasks;
CREATE TRIGGER tasks_sub_quote_snapshot
  BEFORE INSERT OR UPDATE OF subcontractor_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION trg_tasks_sub_quote_snapshot();

-- 이미 협력사로 넘어가 있는 작업: 지금의 견적으로 한 번 채운다 (비어 있는 것만)
UPDATE tasks SET sub_quote_supply = COALESCE(product_price, 0)
 WHERE subcontractor_id IS NOT NULL AND sub_quote_supply IS NULL;

-- 운영자: 견적 고치기 (예외용). 고친 사람 · 시각 · 이전 값이 이력에 남고, 분배가 있으면 다시 계산한다.
CREATE OR REPLACE FUNCTION admin_set_sub_quote(
  p_actor uuid, p_token text, p_task_id uuid, p_amount int, p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task   tasks%ROWTYPE;
  v_reason text := LEFT(btrim(COALESCE(p_reason, '')), 300);
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', '견적 금액을 0 이상으로 입력해 주세요.');
  END IF;
  IF v_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '고치는 사유를 입력해 주세요.');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF v_task.subcontractor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사로 넘긴 작업이 아닙니다.');
  END IF;

  UPDATE tasks SET sub_quote_supply = p_amount, sub_quote_edited_at = now(), sub_quote_edited_by = p_actor, updated_at = now()
   WHERE id = p_task_id;

  PERFORM _sub_log_change(p_task_id, 'engineer', p_actor, 'admin',
    '협력사 견적 수정: ' || COALESCE(v_task.sub_quote_supply, 0) || ' -> ' || p_amount || ' (' || v_reason || ')',
    jsonb_build_object('subQuoteSupply', v_task.sub_quote_supply),
    jsonb_build_object('subQuoteSupply', p_amount));

  -- 이미 분배가 계산된 작업이면 다시 계산 (수수료는 그대로, 원청 몫만 달라진다)
  IF EXISTS (SELECT 1 FROM payments p WHERE p.task_id = p_task_id AND p.track = 'S') THEN
    PERFORM compute_payment(p_task_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'sub_quote_supply', p_amount);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_set_sub_quote(uuid, text, uuid, int, text) TO anon, authenticated;

-- ============================================================
-- [4] 주방후드 단가표 (부가세 별도 = 공급가). 0원 = 접수할 때 직접 입력.
--     작업 종류 이름은 "서비스 이름_줄 이름" - 접수 화면이 보내는 줄 이름으로 찾는다.
--     기존 "(공통)" 줄은 그대로 둔다 (과거 작업이 가리키고 있음. 접수 화면에서는 더 이상 고르지 않는다).
-- ============================================================
INSERT INTO service_types (category_id, code, name)
SELECT c.id, 'hood_option', '후드옵션' FROM categories c WHERE c.code = 'hood'
ON CONFLICT (category_id, code) DO NOTHING;
UPDATE service_types SET selectable = true, sort_order = 4 WHERE code = 'hood_option';

INSERT INTO work_types (service_type_id, appliance_type_id, code, name, default_unit_price)
SELECT st.id, NULL, v.code, st.name || '_' || v.label, v.price
  FROM (VALUES
    ('hood_commercial', 'hood_commercial_s',     '1,000mm 이하',            198000),
    ('hood_commercial', 'hood_commercial_m',     '1,000~2,000mm(2구)',      289000),
    ('hood_commercial', 'hood_commercial_l',     '2,000mm 초과(현장 확인)',      0),
    ('hood_home',       'hood_home_basic',       '기본형',                  100000),
    ('hood_home',       'hood_home_double',      '2구 더블',                120000),
    ('hood_home',       'hood_home_premium',     '고급형',                  150000),
    ('hood_option',     'hood_option_steam',     '화구 스팀 세척',               0),
    ('hood_option',     'hood_option_duct',      '자바라',                   30000),
    ('hood_option',     'hood_option_fire',      '소방후드',                 10000)
  ) AS v(service, code, label, price)
  JOIN service_types st ON st.code = v.service
 WHERE NOT EXISTS (SELECT 1 FROM work_types wt WHERE wt.service_type_id = st.id AND wt.code = v.code);

-- ============================================================
-- [5] 계산 - compute_payment v30.2 (mig 216c 본문 + 원청 몫 4곳)
-- ============================================================
CREATE OR REPLACE FUNCTION compute_payment(p_task_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task              tasks%ROWTYPE;
  v_principal_code    text;
  v_total_qty         int;
  v_fallback_unit     int;
  v_item              RECORD;
  v_qty               int;
  v_unit_price        int;
  v_service_code      text;
  v_appliance_code    text;
  v_calc_result       jsonb;
  v_calc_method       text;
  v_is_ratio          boolean;
  v_is_fixed          boolean;
  v_eng               int;
  v_prin              int;
  v_mult              int;
  v_item_extra        int;
  v_extra_applied     boolean := false;
  v_total_engineer    int := 0;
  v_total_principal   int := 0;
  v_total_owner       int := 0;
  v_principal_applied boolean := false;
  v_last_calc_method  text;
  v_last_policy_key   text;
  v_payment_id        uuid;
  v_cleaning_extra_applied   boolean := false;
  v_cleaning_engineer_bonus  int := 0;
  v_cleaning_principal_bonus int := 0;
  v_track                CHAR(1) := 'A';
  v_has_non_refrigerant  boolean := false;
  v_total_settle         int := 0;
  v_engineer_rate int;
  v_total_calc    int;
  v_canceled_active boolean := false;
  v_use_phase_c   boolean := false;
  v_row_subtotal  int;
  v_row_received  int;
  v_row_extra     int;
  v_phase_c_eng_extra  int;
  v_phase_c_prin_extra int;
  v_qty_cond      text;
  v_pure_refrigerant     boolean := true;
  v_any_active_item      boolean := false;
  v_engineer_rate_task   int;
  v_row_product_price    int;
  v_is_visit_only        boolean := false;
  v_new_travel_rule      boolean := false;
  v_travel_eng           int := 0;
  v_install_only         boolean := true;
  v_material             int := 0;
  v_install_base         int := 0;
  -- Mig 200 (2026-07-29) - install engineer share, date-gated.
  v_install_rate         numeric := 0.75;
  -- Mig 216 (v30) - 협력사 분기용 변수. 아래 v29 본문에서는 쓰지 않는다.
  v_sub_rule             fee_rules%ROWTYPE;
  v_sub_service          text;
  v_sub_total            int := 0;
  v_sub_supply           int := 0;
  v_sub_base             int := 0;
  v_sub_fee              int := 0;
  v_sub_eng              int := 0;
  -- Mig 244 (v30.2) - 원청 몫 (협력사 수수료 가운데 원청에 줄 금액). owner_amount 에는 넣지 않는다.
  v_sub_share            int := 0;
  v_sub_share_note       text;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task not found: %', p_task_id;
  END IF;

  -- ==========================================================================
  -- Mig 216c (v30.1) - 협력사 작업 분기. tasks.subcontractor_id 가 있을 때만 들어온다.
  --   이 블록 밖(아래)은 v29 본문 그대로다. 직영·원청 작업은 이 블록을 건너뛴다.
  --   수수료 = fee_rules 의 규칙 (율이면 기준금액 x 율, 원 단위 반올림 / 정액이면 그 금액)
  --   기준금액: fee_base = supply -> 공급가액(tasks.supply_amount), gross -> 고객 결제 합계
  --   저장: owner_amount = 수수료, engineer_amount = 합계 - 수수료(협력사 보유분), track = 'S'
  -- ==========================================================================
  IF v_task.subcontractor_id IS NOT NULL THEN
    SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;

    SELECT st.code INTO v_sub_service
      FROM task_items ti
      LEFT JOIN work_types wt    ON wt.id = ti.work_type_id
      LEFT JOIN service_types st ON st.id = wt.service_type_id
     WHERE ti.task_id = p_task_id
       AND NOT COALESCE(ti.is_canceled, false)
     ORDER BY (ti.order_type = '본작업') DESC NULLS LAST, ti.unit_price DESC NULLS LAST
     LIMIT 1;

    SELECT * INTO v_sub_rule
      FROM fee_rules f
     WHERE f.tenant_id        = v_task.tenant_id
       AND f.subcontractor_id = v_task.subcontractor_id
       AND f.active
       AND f.effective_from <= (COALESCE(v_task.completed_at, now()) AT TIME ZONE 'Asia/Seoul')::date
       AND (f.principal_code IS NULL OR f.principal_code = v_principal_code)
       AND (f.service_code   IS NULL OR f.service_code   = v_sub_service)
     ORDER BY (f.principal_code IS NOT NULL)::int + (f.service_code IS NOT NULL)::int DESC,
              f.effective_from DESC
     LIMIT 1;

    IF v_sub_rule.id IS NULL THEN
      RAISE EXCEPTION '협력사 수수료 규칙이 없습니다 (task %, 협력사 %)', p_task_id, v_task.subcontractor_id;
    END IF;

    -- 고객 결제 합계 = 직원이 입력한 실제 금액(received_total = 공급가 + 부가세).
    --   접수 견적(product_price)은 보존만 하고 정산에는 쓰지 않는다 (2026-10-06 사장님 결정).
    --   실제 금액이 아직 없을 때만 견적 + 추가금 + 출장비로 대신한다.
    v_sub_total := COALESCE(NULLIF(v_task.received_total, 0),
                            COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0) + COALESCE(v_task.travel_fee, 0));
    -- 공급가액: 직원 입력값. 없으면 합계에서 부가세 10% 를 뺀 값으로 추정.
    v_sub_supply := COALESCE(NULLIF(v_task.supply_amount, 0), ROUND(v_sub_total / 1.1)::int);
    v_sub_base   := CASE WHEN v_sub_rule.fee_base = 'gross' THEN v_sub_total ELSE v_sub_supply END;

    IF v_task.status = '취소' THEN
      v_sub_fee := 0;
      v_sub_eng := 0;
    ELSE
      v_sub_fee := CASE
        WHEN v_sub_rule.fee_type = 'rate' THEN ROUND(v_sub_base * v_sub_rule.fee_rate)::int
        ELSE COALESCE(v_sub_rule.fee_amount, 0)
      END;
      v_sub_fee := LEAST(GREATEST(v_sub_fee, 0), GREATEST(v_sub_total, 0));
      v_sub_eng := GREATEST(v_sub_total - v_sub_fee, 0);
    END IF;

    -- Mig 244 (v30.2) - 원청 몫. 규칙에 principal_rate 가 있을 때만 (지금은 쿨가이 KB).
    --   원청 몫 = LEAST(견적 공급가 x 율, 수수료). 견적이 없으면 수수료 전액 + 표시(no_quote).
    --   owner_amount(= 협력사가 올데이케어에 보낼 수수료 전액)는 그대로 둔다 - 올데이케어 실제 몫은 owner - 원청 몫.
    IF v_task.status <> '취소' AND v_sub_rule.principal_rate IS NOT NULL THEN
      v_sub_share := _sub_principal_share(v_task.sub_quote_supply, v_sub_fee, v_sub_rule.principal_rate);
      IF COALESCE(v_task.sub_quote_supply, 0) <= 0 THEN
        v_sub_share_note := 'no_quote';
      END IF;
    END IF;

    UPDATE payments SET
      computed_at      = now(),
      computed_by      = auth.uid(),
      policy_key       = 'fee_rule:' || v_sub_rule.id::text,
      calc_method      = '협력사_수수료',
      product_price    = v_sub_total,
      extra_fee        = 0,
      travel_fee       = 0,
      naver_fee        = 0,
      engineer_amount  = v_sub_eng,
      principal_amount = 0,
      owner_amount     = v_sub_fee,
      sub_principal_share = v_sub_share,
      sub_principal_note  = v_sub_share_note,
      track            = 'S'
    WHERE task_id = p_task_id
      AND track   = 'S'
    RETURNING id INTO v_payment_id;

    IF v_payment_id IS NULL THEN
      DELETE FROM payments WHERE task_id = p_task_id;
      INSERT INTO payments (
        task_id, computed_by, policy_key, calc_method,
        product_price, extra_fee, travel_fee, naver_fee,
        engineer_amount, principal_amount, owner_amount,
        sub_principal_share, sub_principal_note,
        status, track
      ) VALUES (
        p_task_id, auth.uid(), 'fee_rule:' || v_sub_rule.id::text, '협력사_수수료',
        v_sub_total, 0, 0, 0,
        v_sub_eng, 0, v_sub_fee,
        v_sub_share, v_sub_share_note,
        '미정산', 'S'
      )
      RETURNING id INTO v_payment_id;
    END IF;

    RETURN v_payment_id;
  END IF;
  -- ===================== v30 분기 끝 - 이하 v29 본문 그대로 =====================

  v_new_travel_rule := COALESCE(v_task.completed_at, now())
                       >= '2026-07-15 00:00:00 Asia/Seoul'::timestamptz;
  v_travel_eng := CASE WHEN v_new_travel_rule
                       THEN FLOOR(COALESCE(v_task.travel_fee, 0) * 0.6)::int
                       ELSE COALESCE(v_task.travel_fee, 0) END;

  -- Mig 200 - 2026-07-29 00:00 KST onward: engineer 80% (was 75%).
  --   Older completions keep 75% so past settlements do not move when a task
  --   is recomputed for an unrelated reason (same policy as Mig 177 / Mig 198).
  v_install_rate := CASE
    WHEN COALESCE(v_task.completed_at, now())
         >= '2026-07-29 00:00:00 Asia/Seoul'::timestamptz THEN 0.80
    ELSE 0.75
  END;

  SELECT code INTO v_principal_code FROM principals WHERE id = v_task.principal_id;
  IF v_principal_code IS NULL THEN
    RAISE EXCEPTION 'principal_code not found: %', v_task.principal_id;
  END IF;

  SELECT COALESCE(SUM(qty), 0)::int INTO v_total_qty
  FROM task_items
  WHERE task_id = p_task_id
    AND NOT COALESCE(is_canceled, false);

  v_canceled_active := (v_task.status = '취소');

  IF v_total_qty = 0 AND NOT v_canceled_active THEN
    RAISE EXCEPTION 'no active task_items: %', p_task_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM task_items
    WHERE task_id = p_task_id
      AND NOT COALESCE(is_canceled, false)
      AND received_amount IS NOT NULL
  ) INTO v_use_phase_c;

  IF v_total_qty > 0 THEN
    v_fallback_unit := FLOOR(COALESCE(v_task.product_price, 0)::numeric / v_total_qty)::int;

    FOR v_item IN
      SELECT
        ti.qty,
        ti.unit_price,
        ti.order_type,
        ti.received_amount,
        ti.subtotal,
        st.code AS service_code,
        at.code AS appliance_code
      FROM task_items ti
      LEFT JOIN work_types wt      ON wt.id = ti.work_type_id
      LEFT JOIN service_types st   ON st.id = wt.service_type_id
      LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
      WHERE ti.task_id = p_task_id
        AND NOT COALESCE(ti.is_canceled, false)
    LOOP
      v_any_active_item := true;
      v_qty := COALESCE(v_item.qty, 1)::int;
      v_unit_price := CASE
        WHEN COALESCE(v_item.unit_price, 0) > 0 AND v_item.unit_price <> COALESCE(v_task.product_price, 0)
        THEN v_item.unit_price
        ELSE v_fallback_unit
      END;
      v_service_code := v_item.service_code;
      v_appliance_code := v_item.appliance_code;

      IF v_principal_code = 'usol_n'
         AND v_item.order_type = '추가선택'
         AND COALESCE(v_service_code, '') = 'refrigerant' THEN
        v_service_code := 'addon';
        v_appliance_code := '냉매점검';
      END IF;

      IF v_service_code = 'visit_fee' THEN
        v_is_visit_only := true;
      END IF;

      IF COALESCE(v_service_code, '') != 'refrigerant' THEN
        v_has_non_refrigerant := true;
      END IF;

      v_qty_cond := CASE
        WHEN v_item.order_type IN ('첫대', '추가') THEN v_item.order_type
        ELSE NULL
      END;

      v_calc_result := calculate_commission(
        v_principal_code, v_service_code, v_appliance_code,
        v_unit_price, 0, 0, v_qty_cond
      );

      IF NOT (v_calc_result ->> 'ok')::boolean THEN
        RAISE EXCEPTION 'calculate_commission failed: %', v_calc_result;
      END IF;

      v_calc_method := v_calc_result ->> 'calc_method';
      v_is_ratio := v_calc_method IN ('직영_50_50', '차감후비율_50', '비율_총금액');
      v_is_fixed := v_calc_method = '정액';

      IF v_calc_method = '비율_견적금액' AND v_service_code IN ('refrigerant', 'leak', 'water_leak') THEN
        v_is_ratio := true;
      END IF;

      IF v_service_code NOT IN ('refrigerant', 'leak', 'water_leak') OR v_calc_method = 'usol_n_추가선택' THEN
        v_pure_refrigerant := false;
      END IF;

      IF v_use_phase_c THEN
        v_row_subtotal := v_qty * v_unit_price;
        v_row_received := COALESCE(v_item.received_amount, v_row_subtotal);
        v_row_extra    := GREATEST(v_row_received - v_row_subtotal, 0);
        v_item_extra   := v_row_extra;
      ELSE
        IF v_service_code = 'cleaning' THEN
          v_item_extra := 0;
          IF NOT v_cleaning_extra_applied THEN
            IF v_principal_code = 'usol_n' THEN
              v_cleaning_principal_bonus := FLOOR(COALESCE(v_task.extra_fee, 0) * 0.15)::int;
              v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0) - v_cleaning_principal_bonus;
            ELSE
              v_cleaning_engineer_bonus  := COALESCE(v_task.extra_fee, 0);
              v_cleaning_principal_bonus := 0;
            END IF;
            v_cleaning_extra_applied := true;
            v_extra_applied := true;
          END IF;
        ELSE
          v_item_extra := CASE
            WHEN v_is_ratio AND NOT v_extra_applied THEN COALESCE(v_task.extra_fee, 0)
            ELSE 0
          END;
        END IF;
      END IF;

      IF v_is_ratio AND (v_qty > 1 OR v_item_extra > 0) THEN
        v_calc_result := calculate_commission(
          v_principal_code, v_service_code, v_appliance_code,
          v_unit_price * v_qty, v_item_extra, 0, v_qty_cond
        );
        IF NOT (v_calc_result ->> 'ok')::boolean THEN
          RAISE EXCEPTION 'calculate_commission recall failed: %', v_calc_result;
        END IF;
        IF NOT v_use_phase_c AND v_item_extra > 0 THEN
          v_extra_applied := true;
        END IF;
      END IF;

      v_eng := (v_calc_result ->> 'engineer')::int;
      v_prin := (v_calc_result ->> 'principal')::int;
      v_mult := CASE WHEN v_is_ratio THEN 1 ELSE v_qty END;

      IF v_service_code = 'refrigerant'
         AND v_calc_method != 'usol_n_추가선택'
         AND v_task.assigned_engineer_id IS NOT NULL THEN
        SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate
        FROM users WHERE id = v_task.assigned_engineer_id;

        v_total_calc := (v_calc_result ->> 'total')::int;

        IF v_engineer_rate >= 100 THEN
          v_eng := v_total_calc - v_prin;
        END IF;
      END IF;

      v_total_engineer := v_total_engineer + (v_eng * v_mult);

      IF v_use_phase_c
         AND v_service_code = 'cleaning'
         AND v_item_extra > 0
         AND v_calc_method IN ('직영_0', '비율_견적금액', '정액') THEN
        IF v_principal_code = 'usol_n' THEN
          v_phase_c_prin_extra := FLOOR(v_item_extra * 0.15)::int;
          v_phase_c_eng_extra  := v_item_extra - v_phase_c_prin_extra;
          v_total_engineer  := v_total_engineer  + v_phase_c_eng_extra;
          v_total_principal := v_total_principal + v_phase_c_prin_extra;
        ELSE
          v_total_engineer := v_total_engineer + v_item_extra;
        END IF;
      END IF;

      IF v_is_fixed THEN
        IF NOT v_principal_applied THEN
          v_total_principal := v_total_principal + v_prin;
          v_principal_applied := true;
        END IF;
      ELSE
        v_total_principal := v_total_principal + (v_prin * v_mult);
      END IF;

      IF v_calc_method IS DISTINCT FROM '직영_75_25' THEN
        v_install_only := false;
      END IF;

      v_last_calc_method := v_calc_method;
      v_last_policy_key  := v_calc_result ->> 'policy_key';
    END LOOP;

    IF NOT v_use_phase_c THEN
      v_total_engineer  := v_total_engineer  + v_cleaning_engineer_bonus;
      v_total_principal := v_total_principal + v_cleaning_principal_bonus;
    END IF;

    -- ========================================================================
    -- Mig 198 (material cost) + Mig 200 (rate 0.75 -> 0.80, date-gated).
    --   base     = product_price + extra_fee - material_cost
    --   engineer = material_cost + FLOOR(base * v_install_rate)
    --   company  = the rest (owner formula below). principal = 0.
    -- ========================================================================
    IF v_any_active_item AND v_install_only AND v_last_calc_method = '직영_75_25' THEN
      v_material := LEAST(
        GREATEST(COALESCE(v_task.material_cost, 0), 0),
        GREATEST(COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0), 0)
      );
      v_install_base := GREATEST(
        COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0) - v_material, 0
      );
      v_total_engineer  := v_material + FLOOR(v_install_base * v_install_rate)::int;
      v_total_principal := 0;
    END IF;

    IF NOT v_is_visit_only THEN
      v_total_engineer := v_total_engineer + v_travel_eng;
    END IF;

    IF v_any_active_item AND v_pure_refrigerant
       AND v_task.assigned_engineer_id IS NOT NULL THEN
      SELECT COALESCE(refrigerant_rate, 50) INTO v_engineer_rate_task
      FROM users WHERE id = v_task.assigned_engineer_id;

      IF v_engineer_rate_task >= 100 THEN
        v_total_engineer := COALESCE(v_task.product_price, 0)
                          + COALESCE(v_task.extra_fee, 0)
                          - v_total_principal
                          + v_travel_eng;
      ELSE
        v_total_engineer := FLOOR(
          (COALESCE(v_task.product_price, 0) + COALESCE(v_task.extra_fee, 0))::numeric
          * v_engineer_rate_task / 100
        )::int + v_travel_eng;
      END IF;
    END IF;

    IF v_is_visit_only AND v_new_travel_rule THEN
      v_total_engineer := FLOOR(v_total_engineer * 0.6)::int;
    END IF;

    IF v_principal_code = 'usol_n' THEN
      SELECT COALESCE(SUM(ti.subtotal), 0)::int INTO v_total_settle
      FROM task_items ti WHERE ti.task_id = p_task_id;

      v_total_owner := v_total_settle
                     + COALESCE(v_task.extra_fee, 0)
                     + (CASE WHEN v_is_visit_only THEN 0 ELSE COALESCE(v_task.travel_fee, 0) END)
                     - v_total_engineer
                     - v_total_principal;
    ELSE
      v_total_owner := COALESCE(v_task.product_price, 0)
                     + COALESCE(v_task.extra_fee, 0)
                     + (CASE WHEN v_is_visit_only AND NOT v_new_travel_rule THEN 0
                             ELSE COALESCE(v_task.travel_fee, 0) END)
                     - v_total_engineer
                     - v_total_principal;
    END IF;

    v_total_owner := GREATEST(v_total_owner, 0);

    IF v_principal_code = 'usol_n' AND v_has_non_refrigerant THEN
      v_track := 'B';
    ELSE
      v_track := 'A';
    END IF;
  END IF;

  IF v_canceled_active THEN
    v_total_engineer  := COALESCE(v_task.cancel_engineer_comp_amount, 0);
    v_total_principal := 0;
    v_total_owner     := 0 - v_total_engineer;
    v_last_calc_method := COALESCE(v_last_calc_method, '취소_수고비');
    v_last_policy_key  := COALESCE(v_last_policy_key, 'cancel_compensation');
    IF v_track IS NULL THEN v_track := 'A'; END IF;
  END IF;

  v_row_product_price := CASE
    WHEN v_principal_code = 'usol_n' THEN v_total_settle
    ELSE COALESCE(v_task.product_price, 0)
  END;

  v_payment_id := NULL;

  UPDATE payments SET
    computed_at      = now(),
    computed_by      = auth.uid(),
    policy_key       = v_last_policy_key,
    calc_method      = v_last_calc_method,
    product_price    = v_row_product_price,
    extra_fee        = COALESCE(v_task.extra_fee, 0),
    travel_fee       = COALESCE(v_task.travel_fee, 0),
    naver_fee        = 0,
    engineer_amount  = v_total_engineer,
    principal_amount = v_total_principal,
    owner_amount     = v_total_owner,
    track            = v_track
  WHERE task_id = p_task_id
    AND track   = v_track
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    DELETE FROM payments WHERE task_id = p_task_id;

    INSERT INTO payments (
      task_id, computed_by,
      policy_key, calc_method,
      product_price, extra_fee, travel_fee, naver_fee,
      engineer_amount, principal_amount, owner_amount,
      status,
      track
    ) VALUES (
      p_task_id, auth.uid(),
      v_last_policy_key, v_last_calc_method,
      v_row_product_price,
      COALESCE(v_task.extra_fee, 0),
      COALESCE(v_task.travel_fee, 0),
      0,
      v_total_engineer, v_total_principal, v_total_owner,
      '미정산',
      v_track
    )
    RETURNING id INTO v_payment_id;
  END IF;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_payment(uuid) TO anon, authenticated;


COMMENT ON FUNCTION compute_payment(uuid) IS
  'v30.2 (Migration 244, 2026-10-07) - v30.1 + 협력사 작업의 원청 몫(payments.sub_principal_share). owner_amount 는 수수료 전액 그대로. 직영·원청 경로는 v29 그대로.';

-- ============================================================
-- [6] 조회 - 작업별 견적 · 수수료 · 원청 몫 (운영자 전용)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_get_sub_splits(p_actor uuid, p_token text, p_task_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'rows', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'task_id', t.id,
             'principal_code', pr.code,
             'principal_name', pr.name,
             'quote', t.sub_quote_supply,
             'quote_edited_at', t.sub_quote_edited_at,
             'quote_edited_by', (SELECT u.name FROM users u WHERE u.id = t.sub_quote_edited_by),
             'product_price', t.product_price,
             'supply', t.supply_amount,
             'fee', p.owner_amount,
             'share', COALESCE(p.sub_principal_share, 0),
             'note', p.sub_principal_note,
             -- 이 작업에 원청 몫 규칙이 걸리는지 (분배가 아직 없어도 화면에서 안내할 수 있게)
             'has_rule', EXISTS (SELECT 1 FROM fee_rules f
                                  WHERE f.subcontractor_id = t.subcontractor_id AND f.active
                                    AND f.principal_code = pr.code AND f.principal_rate IS NOT NULL)))
      FROM tasks t
      LEFT JOIN principals pr ON pr.id = t.principal_id
      LEFT JOIN payments p    ON p.task_id = t.id AND p.track = 'S'
     WHERE t.id = ANY (p_task_ids) AND t.subcontractor_id IS NOT NULL), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_sub_splits(uuid, text, uuid[]) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 - 마지막 표 한 장
--   "1 계산 확인" : 사장님 표 3줄. 화이트코어 97,500 / 65,000 / 52,000 · 수수료 52,500 / 35,000 / 28,000
--                   · 쿨가이 35,000 / 35,000 / 28,000 · 올데이케어 17,500 / 0 / 0 이 그대로 나와야 합니다.
--                   넷째 줄(견적 없음)은 쿨가이 = 수수료 전액.
--   "2 설치 확인" : 칸 7개 · 규칙 1줄(KB) · 단가표 9줄 · 트리거 1개 · 함수
--   "3 다시 계산이 필요한 작업" : 원청이 KB 인데 이미 완료돼 원청 몫이 0 인 협력사 작업. 0건이면 할 일 없음.
--                                 있으면 작업번호를 Claude 에게 알려 주세요 (다시 계산 SQL 을 따로 드립니다).
-- ============================================================================
SELECT * FROM (
  SELECT '1 계산 확인' AS 구분,
         '견적 ' || to_char(x.quote, 'FM999,999,999') || ' / 받은 공급가 ' || to_char(x.supply, 'FM999,999,999') AS 대상,
         '화이트코어 ' || to_char(x.supply - ROUND(x.supply * 0.35)::int, 'FM999,999,999') AS 값1,
         '수수료 ' || to_char(ROUND(x.supply * 0.35)::int, 'FM999,999,999') AS 값2,
         '쿨가이 ' || to_char(_sub_principal_share(NULLIF(x.quote, 0), ROUND(x.supply * 0.35)::int, 0.35), 'FM999,999,999') AS 값3,
         '올데이케어 ' || to_char(ROUND(x.supply * 0.35)::int - _sub_principal_share(NULLIF(x.quote, 0), ROUND(x.supply * 0.35)::int, 0.35), 'FM999,999,999') AS 값4,
         x.ord AS 순서
    FROM (VALUES (1, 100000, 150000), (2, 100000, 100000), (3, 100000, 80000), (4, 0, 100000)) AS x(ord, quote, supply)
  UNION ALL
  SELECT '2 설치 확인', '새 칸 (기대 7)', COUNT(*)::text, NULL, NULL, NULL, 10
    FROM information_schema.columns
   WHERE (table_name = 'fee_rules' AND column_name IN ('principal_rate', 'principal_base'))
      OR (table_name = 'payments'  AND column_name IN ('sub_principal_share', 'sub_principal_note'))
      OR (table_name = 'tasks'     AND column_name IN ('sub_quote_supply', 'sub_quote_edited_at', 'sub_quote_edited_by'))
  UNION ALL
  SELECT '2 설치 확인', '쿨가이(KB) 규칙 (기대 1)', COUNT(*)::text,
         MAX('수수료 ' || (f.fee_rate * 100)::text || '% · 원청 몫 ' || (f.principal_rate * 100)::text || '%'), NULL, NULL, 11
    FROM fee_rules f WHERE f.principal_code = 'KB' AND f.principal_rate IS NOT NULL
  UNION ALL
  SELECT '2 설치 확인', '주방후드 단가표 줄 (기대 9)', COUNT(*)::text, NULL, NULL, NULL, 12
    FROM work_types wt WHERE wt.code LIKE 'hood\_commercial\_%' OR wt.code LIKE 'hood\_home\_%' OR wt.code LIKE 'hood\_option\_%'
  UNION ALL
  SELECT '2 설치 확인', '견적 보관 트리거 (기대 1)', COUNT(*)::text, NULL, NULL, NULL, 13
    FROM pg_trigger WHERE tgname = 'tasks_sub_quote_snapshot' AND NOT tgisinternal
  UNION ALL
  SELECT '2 설치 확인', '계산 함수 판', LEFT(obj_description('compute_payment(uuid)'::regprocedure, 'pg_proc'), 30), NULL, NULL, NULL, 14
  UNION ALL
  SELECT '3 다시 계산이 필요한 작업', COALESCE(string_agg(t.task_no, ', '), '(없음)'), COUNT(*)::text || '건', NULL, NULL, NULL, 20
    FROM tasks t
    JOIN principals pr ON pr.id = t.principal_id AND pr.code = 'KB'
    JOIN payments p    ON p.task_id = t.id AND p.track = 'S'
   WHERE t.subcontractor_id IS NOT NULL AND t.status = '완료'
     AND COALESCE(p.sub_principal_share, 0) = 0 AND COALESCE(p.owner_amount, 0) > 0
) r
ORDER BY 순서;
