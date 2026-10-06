-- ============================================================================
-- Migration 235 - 협력사 기사: 정보 수정 · 상세 보기 · 가능 종목
-- 작성 2026-10-06 · 선행: 214, 226, 230, 231
--
-- 사장님 결정 (2026-10-06)
--   · 협력사 관리자가 소속 기사의 이름 · 담당 지역 · 가능 종목 · 메모를 수정 (전화번호는 로그인 아이디라 운영자만)
--   · 기사 상세: 기사가 직접 입력한 정산 계좌 · 사업자 정보를 관리자 · 운영자가 보기만
--       계좌번호는 기본 가림(앞 3 · 뒤 4자리), [전체 보기] 를 누르면 표시하고 조회 기록을 남김
--   · 기사별 가능 종목(category 단위). 기본값 = 그 협력사가 맡는 종목 전부
--   · 협력사 단위 "맡는 종목" 은 운영자만 설정
--   · 배정 시트: 그 종목을 못 하는 기사는 추천에서 빠지고 맨 아래 회색 (강제 배정은 확인 후 가능)
--
-- 저장 위치: 별도 표를 씁니다. 직영 기사용 engineer_principal_permissions 는 건드리지 않으므로
--            직영 추천 · 자동배정에는 영향이 없습니다 (협력사 기사 제외 조건도 그대로).
--
-- 내용
--   [1] 표 4개: subcontractor_categories / subcontractor_staff_profiles /
--               subcontractor_staff_categories / subcontractor_staff_changes(처리 이력 · 조회 기록)
--   [2] _sub_staff_can_do                      그 기사가 그 종목을 할 수 있는지 (내부)
--   [3] sub_staff_directory                    기사 목록 (관리자: 자기 협력사 / 운영자: 지정한 협력사)
--       sub_get_staff_detail                   기사 상세 (계좌번호는 가려서)
--       sub_reveal_staff_account               계좌번호 전체 보기 + 조회 기록
--       sub_update_staff                       이름 · 지역 · 가능 종목 · 메모 수정 + 처리 이력
--       admin_set_subcontractor_categories     협력사가 맡는 종목 설정 (운영자만)
--       list_subcontractor_categories          접수 폼 수행 추천용 (운영자만)
--   [4] sub_list_staff_for_task (mig 230) 에 'can_do' 한 줄 추가
--       저장소의 mig 230 본문에서 자동으로 만들었고, 끼운 한 줄을 빼면 230 과 완전히 같습니다.
--
-- 기존 데이터 영향
--   · 화이트코어의 맡는 종목으로 주방후드(hood) 1줄을 넣습니다. 기사별 설정은 비어 있음 = 전부 가능.
--   · 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 표
-- ============================================================
CREATE TABLE IF NOT EXISTS subcontractor_categories (
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  category_id      uuid NOT NULL REFERENCES categories(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subcontractor_id, category_id)
);

CREATE TABLE IF NOT EXISTS subcontractor_staff_profiles (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id),
  memo             text,
  categories_set   boolean NOT NULL DEFAULT false,   -- false = 따로 정하지 않음(협력사가 맡는 종목 전부 가능)
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS subcontractor_staff_categories (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id),
  PRIMARY KEY (user_id, category_id)
);

CREATE TABLE IF NOT EXISTS subcontractor_staff_changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action           text NOT NULL,              -- update / view_account
  before_data      jsonb,
  after_data       jsonb,
  actor_id         uuid REFERENCES users(id),
  actor_name       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sub_staff_changes_by_user ON subcontractor_staff_changes (user_id, created_at DESC);

ALTER TABLE subcontractor_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_staff_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_staff_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_staff_changes    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE subcontractor_categories       FROM anon, authenticated;
REVOKE ALL ON TABLE subcontractor_staff_profiles   FROM anon, authenticated;
REVOKE ALL ON TABLE subcontractor_staff_categories FROM anon, authenticated;
REVOKE ALL ON TABLE subcontractor_staff_changes    FROM anon, authenticated;

-- 화이트코어가 맡는 종목: 주방후드 (code 기준, id 고정 없음)
INSERT INTO subcontractor_categories (subcontractor_id, category_id)
SELECT s.id, c.id FROM subcontractors s JOIN categories c ON c.code = 'hood'
 WHERE s.code = 'whitecore'
ON CONFLICT DO NOTHING;

-- ============================================================
-- [2] 내부: 가능 종목
-- ============================================================
-- 그 협력사가 맡는 종목 [{code, name}]
CREATE OR REPLACE FUNCTION _sub_category_list(p_sub uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name) ORDER BY c.name), '[]'::jsonb)
    FROM subcontractor_categories sc JOIN categories c ON c.id = sc.category_id
   WHERE sc.subcontractor_id = p_sub;
$$;
REVOKE ALL ON FUNCTION _sub_category_list(uuid) FROM PUBLIC, anon, authenticated;

-- 그 기사의 가능 종목 코드 목록 (따로 정하지 않았으면 협력사가 맡는 종목 전부)
CREATE OR REPLACE FUNCTION _sub_staff_category_codes(p_user uuid, p_sub uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE((SELECT p.categories_set FROM subcontractor_staff_profiles p WHERE p.user_id = p_user), false)
      THEN COALESCE((SELECT jsonb_agg(c.code ORDER BY c.name)
                       FROM subcontractor_staff_categories x JOIN categories c ON c.id = x.category_id
                      WHERE x.user_id = p_user), '[]'::jsonb)
    ELSE COALESCE((SELECT jsonb_agg(c.code ORDER BY c.name)
                     FROM subcontractor_categories sc JOIN categories c ON c.id = sc.category_id
                    WHERE sc.subcontractor_id = p_sub), '[]'::jsonb)
  END;
$$;
REVOKE ALL ON FUNCTION _sub_staff_category_codes(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 그 기사가 그 종목을 할 수 있는지
--   · 작업에 종목이 없으면 가능
--   · 기사별로 정했으면 그 목록에 있어야 가능
--   · 정하지 않았으면: 협력사가 맡는 종목이 하나도 없으면 가능, 있으면 그 안에 있어야 가능
CREATE OR REPLACE FUNCTION _sub_staff_can_do(p_user uuid, p_sub uuid, p_category uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN p_category IS NULL THEN true
    WHEN COALESCE((SELECT p.categories_set FROM subcontractor_staff_profiles p WHERE p.user_id = p_user), false)
      THEN EXISTS (SELECT 1 FROM subcontractor_staff_categories x WHERE x.user_id = p_user AND x.category_id = p_category)
    WHEN NOT EXISTS (SELECT 1 FROM subcontractor_categories sc WHERE sc.subcontractor_id = p_sub) THEN true
    ELSE EXISTS (SELECT 1 FROM subcontractor_categories sc WHERE sc.subcontractor_id = p_sub AND sc.category_id = p_category)
  END;
$$;
REVOKE ALL ON FUNCTION _sub_staff_can_do(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 내부: 호출자가 볼 수 있는 협력사 id (관리자 = 자기 협력사, 운영자 = 지정한 협력사). 못 보면 NULL.
CREATE OR REPLACE FUNCTION _sub_scope(p_actor uuid, p_subcontractor_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub  uuid;
  v_role text;
BEGIN
  IF p_subcontractor_id IS NOT NULL AND _caller_is_admin(p_actor) THEN
    RETURN (SELECT id FROM subcontractors WHERE id = p_subcontractor_id);
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NOT NULL AND v_role = 'manager' THEN
    RETURN v_sub;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION _sub_scope(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- [3] 기사 목록 (비활성 포함)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_staff_directory(p_actor uuid, p_token text, p_subcontractor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_sub uuid;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_sub := _sub_scope(p_actor, p_subcontractor_id);
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자 또는 운영자만 사용할 수 있습니다.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'subcontractor_id', v_sub,
    'sub_categories', _sub_category_list(v_sub),
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', u.id, 'code', u.code, 'name', u.name, 'phone', u.phone, 'sub_role', u.sub_role,
               'is_active', u.is_active, 'region', u.region,
               'zones', COALESCE((SELECT jsonb_agg(z.district ORDER BY z.district)
                                    FROM engineer_zones z
                                   WHERE z.user_id = u.id AND COALESCE(z.active, true)), '[]'::jsonb),
               'open_tasks', (SELECT COUNT(*) FROM tasks t
                               WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                                 AND t.status NOT IN ('완료', '취소', 'visit_only', '정산완료')),
               'categories', _sub_staff_category_codes(u.id, v_sub),
               'categories_set', COALESCE((SELECT p.categories_set FROM subcontractor_staff_profiles p WHERE p.user_id = u.id), false),
               'memo', (SELECT p.memo FROM subcontractor_staff_profiles p WHERE p.user_id = u.id),
               'account_set', COALESCE(NULLIF(btrim(COALESCE(to_jsonb(u) ->> 'bank_account', '')), ''), '') <> '',
               'business_set', EXISTS (SELECT 1 FROM engineer_business_info b
                                        WHERE b.user_id = u.id AND COALESCE(btrim(b.business_no), '') <> '')
             ) ORDER BY u.is_active DESC, u.name)
        FROM users u
       WHERE u.subcontractor_id = v_sub
    ), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_staff_directory(uuid, text, uuid) TO anon, authenticated;

-- ============================================================
-- [3] 기사 상세 (계좌번호는 가려서)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_get_staff_detail(p_actor uuid, p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_u     users%ROWTYPE;
  v_sub   uuid;
  v_j     jsonb;
  v_acct  text;
  v_dig   text;
  v_mask  text;
  v_b     engineer_business_info%ROWTYPE;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT * INTO v_u FROM users WHERE id = p_user_id;
  IF NOT FOUND OR v_u.subcontractor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '기사를 찾지 못했습니다.');
  END IF;
  v_sub := _sub_scope(p_actor, v_u.subcontractor_id);
  IF v_sub IS NULL OR v_sub <> v_u.subcontractor_id THEN
    -- 다른 곳의 기사는 "있는지 없는지"도 알려 주지 않음
    RETURN jsonb_build_object('ok', false, 'error', '기사를 찾지 못했습니다.');
  END IF;

  v_j    := to_jsonb(v_u);
  v_acct := btrim(COALESCE(v_j ->> 'bank_account', ''));
  v_dig  := regexp_replace(v_acct, '[^0-9]', '', 'g');
  v_mask := CASE WHEN v_acct = '' THEN NULL
                 WHEN length(v_dig) <= 7 THEN repeat('*', GREATEST(length(v_dig), 4))
                 ELSE left(v_dig, 3) || repeat('*', length(v_dig) - 7) || right(v_dig, 4) END;
  SELECT * INTO v_b FROM engineer_business_info WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'staff', jsonb_build_object(
      'id', v_u.id, 'code', v_u.code, 'name', v_u.name, 'phone', v_u.phone, 'sub_role', v_u.sub_role,
      'is_active', v_u.is_active, 'region', v_u.region,
      'zones', COALESCE((SELECT jsonb_agg(z.district ORDER BY z.district) FROM engineer_zones z
                          WHERE z.user_id = v_u.id AND COALESCE(z.active, true)), '[]'::jsonb),
      'categories', _sub_staff_category_codes(v_u.id, v_sub),
      'categories_set', COALESCE((SELECT p.categories_set FROM subcontractor_staff_profiles p WHERE p.user_id = v_u.id), false),
      'memo', (SELECT p.memo FROM subcontractor_staff_profiles p WHERE p.user_id = v_u.id)),
    'sub_categories', _sub_category_list(v_sub),
    'account', CASE WHEN v_acct = '' THEN NULL ELSE jsonb_build_object(
                 'bank', NULLIF(btrim(COALESCE(v_j ->> 'bank_name', '')), ''),
                 'holder', NULLIF(btrim(COALESCE(v_j ->> 'account_holder', '')), ''),
                 'number_masked', v_mask) END,
    'business', CASE WHEN v_b.user_id IS NULL OR COALESCE(btrim(v_b.business_no), '') = '' THEN NULL ELSE jsonb_build_object(
                 'business_name', v_b.business_name, 'representative_name', v_b.representative_name,
                 'business_no', v_b.business_no, 'business_address', v_b.business_address, 'tax_type', v_b.tax_type) END,
    'changes', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x ->> 'created_at') DESC) FROM (
        SELECT jsonb_build_object('action', c.action, 'actor', c.actor_name, 'created_at', c.created_at,
                                  'before', c.before_data, 'after', c.after_data) AS x
          FROM subcontractor_staff_changes c WHERE c.user_id = v_u.id
         ORDER BY c.created_at DESC LIMIT 20) q), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION sub_get_staff_detail(uuid, text, uuid) TO anon, authenticated;

-- 계좌번호 전체 보기 + 조회 기록
CREATE OR REPLACE FUNCTION sub_reveal_staff_account(p_actor uuid, p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_u    users%ROWTYPE;
  v_sub  uuid;
  v_acct text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT * INTO v_u FROM users WHERE id = p_user_id;
  IF NOT FOUND OR v_u.subcontractor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '기사를 찾지 못했습니다.');
  END IF;
  v_sub := _sub_scope(p_actor, v_u.subcontractor_id);
  IF v_sub IS NULL OR v_sub <> v_u.subcontractor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', '기사를 찾지 못했습니다.');
  END IF;
  v_acct := btrim(COALESCE(to_jsonb(v_u) ->> 'bank_account', ''));
  IF v_acct = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '기사가 아직 계좌를 입력하지 않았습니다.');
  END IF;

  -- 조회 기록은 반드시 남긴다 (남기지 못하면 번호도 보여 주지 않음)
  INSERT INTO subcontractor_staff_changes (subcontractor_id, user_id, action, actor_id, actor_name)
  VALUES (v_sub, p_user_id, 'view_account', p_actor, (SELECT name FROM users WHERE id = p_actor));

  RETURN jsonb_build_object('ok', true, 'number', v_acct);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_reveal_staff_account(uuid, text, uuid) TO anon, authenticated;

-- ============================================================
-- [3] 기사 정보 수정 (협력사 관리자만) - 이름 · 지역 · 가능 종목 · 메모
--   p_category_codes: NULL = 가능 종목은 건드리지 않음 / 배열 = 그 목록으로 정함
-- ============================================================
CREATE OR REPLACE FUNCTION sub_update_staff(
  p_actor uuid, p_token text, p_user_id uuid,
  p_name text, p_region text, p_zones text[], p_category_codes text[], p_memo text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub    uuid;
  v_role   text;
  v_u      users%ROWTYPE;
  v_name   text := btrim(COALESCE(p_name, ''));
  v_zones  text[];
  v_before jsonb;
  v_after  jsonb;
  v_bad    text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);
  IF v_sub IS NULL OR v_role <> 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사 관리자만 사용할 수 있습니다.');
  END IF;
  SELECT * INTO v_u FROM users WHERE id = p_user_id AND subcontractor_id = v_sub FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '소속 기사를 찾지 못했습니다.');
  END IF;
  IF v_name = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '이름을 입력해 주세요.');
  END IF;

  -- 가능 종목은 그 협력사가 맡는 종목 안에서만
  IF p_category_codes IS NOT NULL THEN
    SELECT string_agg(x, ', ') INTO v_bad
      FROM unnest(p_category_codes) x
     WHERE NOT EXISTS (SELECT 1 FROM subcontractor_categories sc JOIN categories c ON c.id = sc.category_id
                        WHERE sc.subcontractor_id = v_sub AND c.code = x);
    IF v_bad IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', '협력사가 맡지 않는 종목입니다: ' || v_bad);
    END IF;
  END IF;

  v_before := jsonb_build_object(
    'name', v_u.name, 'region', v_u.region,
    'zones', COALESCE((SELECT jsonb_agg(z.district ORDER BY z.district) FROM engineer_zones z
                        WHERE z.user_id = p_user_id AND COALESCE(z.active, true)), '[]'::jsonb),
    'categories', _sub_staff_category_codes(p_user_id, v_sub),
    'memo', (SELECT p.memo FROM subcontractor_staff_profiles p WHERE p.user_id = p_user_id));

  SELECT COALESCE(array_agg(DISTINCT btrim(x)), ARRAY[]::text[]) INTO v_zones
    FROM unnest(COALESCE(p_zones, ARRAY[]::text[])) x
   WHERE btrim(COALESCE(x, '')) <> '';

  UPDATE users SET name = v_name, region = NULLIF(btrim(COALESCE(p_region, '')), '') WHERE id = p_user_id;
  DELETE FROM engineer_zones WHERE user_id = p_user_id AND NOT (district = ANY (v_zones));
  INSERT INTO engineer_zones (user_id, district, active)
  SELECT p_user_id, x, true FROM unnest(v_zones) x
  ON CONFLICT (user_id, district) DO UPDATE SET active = true;

  INSERT INTO subcontractor_staff_profiles (user_id, subcontractor_id, memo, categories_set, updated_at, updated_by)
  VALUES (p_user_id, v_sub, NULLIF(LEFT(btrim(COALESCE(p_memo, '')), 1000), ''), p_category_codes IS NOT NULL, now(), p_actor)
  ON CONFLICT (user_id) DO UPDATE
    SET subcontractor_id = v_sub,
        memo             = EXCLUDED.memo,
        categories_set   = CASE WHEN p_category_codes IS NOT NULL THEN true ELSE subcontractor_staff_profiles.categories_set END,
        updated_at       = now(),
        updated_by       = p_actor;

  IF p_category_codes IS NOT NULL THEN
    DELETE FROM subcontractor_staff_categories WHERE user_id = p_user_id;
    INSERT INTO subcontractor_staff_categories (user_id, category_id)
    SELECT p_user_id, c.id FROM categories c WHERE c.code = ANY (p_category_codes)
    ON CONFLICT DO NOTHING;
  END IF;

  v_after := jsonb_build_object(
    'name', v_name, 'region', NULLIF(btrim(COALESCE(p_region, '')), ''),
    'zones', to_jsonb(v_zones),
    'categories', _sub_staff_category_codes(p_user_id, v_sub),
    'memo', NULLIF(LEFT(btrim(COALESCE(p_memo, '')), 1000), ''));

  IF v_before IS DISTINCT FROM v_after THEN
    INSERT INTO subcontractor_staff_changes (subcontractor_id, user_id, action, before_data, after_data, actor_id, actor_name)
    VALUES (v_sub, p_user_id, 'update', v_before, v_after, p_actor, (SELECT name FROM users WHERE id = p_actor));
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_user_id);
END;
$$;
GRANT EXECUTE ON FUNCTION sub_update_staff(uuid, text, uuid, text, text, text[], text[], text) TO anon, authenticated;

-- ============================================================
-- [3] 협력사가 맡는 종목 (운영자만 설정)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_set_subcontractor_categories(
  p_actor uuid, p_token text, p_subcontractor_id uuid, p_category_codes text[]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bad text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  IF NOT _caller_is_admin(p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'error', '운영자만 사용할 수 있습니다.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subcontractors WHERE id = p_subcontractor_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', '협력사를 찾지 못했습니다.');
  END IF;
  SELECT string_agg(x, ', ') INTO v_bad
    FROM unnest(COALESCE(p_category_codes, ARRAY[]::text[])) x
   WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.code = x);
  IF v_bad IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '없는 종목입니다: ' || v_bad);
  END IF;

  DELETE FROM subcontractor_categories sc
   WHERE sc.subcontractor_id = p_subcontractor_id
     AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = sc.category_id AND c.code = ANY (COALESCE(p_category_codes, ARRAY[]::text[])));
  INSERT INTO subcontractor_categories (subcontractor_id, category_id)
  SELECT p_subcontractor_id, c.id FROM categories c WHERE c.code = ANY (COALESCE(p_category_codes, ARRAY[]::text[]))
  ON CONFLICT DO NOTHING;
  -- 맡지 않게 된 종목은 기사별 설정에서도 뺀다
  DELETE FROM subcontractor_staff_categories x
   USING users u
   WHERE u.id = x.user_id AND u.subcontractor_id = p_subcontractor_id
     AND NOT EXISTS (SELECT 1 FROM subcontractor_categories sc
                      WHERE sc.subcontractor_id = p_subcontractor_id AND sc.category_id = x.category_id);

  RETURN jsonb_build_object('ok', true, 'sub_categories', _sub_category_list(p_subcontractor_id));
END;
$$;
GRANT EXECUTE ON FUNCTION admin_set_subcontractor_categories(uuid, text, uuid, text[]) TO anon, authenticated;

-- 운영자: 협력사별 맡는 종목 + 고를 수 있는 종목 전체 (접수 폼 추천 · 협력사 관리 화면)
CREATE OR REPLACE FUNCTION list_subcontractor_categories(p_actor uuid, p_token text)
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
  RETURN jsonb_build_object(
    'ok', true,
    'all', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name) ORDER BY c.name)
                       FROM categories c WHERE COALESCE(c.active, true)), '[]'::jsonb),
    'by_sub', COALESCE((SELECT jsonb_agg(jsonb_build_object('subcontractor_id', sc.subcontractor_id, 'code', c.code, 'name', c.name))
                          FROM subcontractor_categories sc JOIN categories c ON c.id = sc.category_id), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION list_subcontractor_categories(uuid, text) TO anon, authenticated;

-- ============================================================
-- [4] 배정 시트 목록에 'can_do' 추가 (mig 230 의 sub_list_staff_for_task)
-- ============================================================
CREATE OR REPLACE FUNCTION sub_list_staff_for_task(p_actor uuid, p_token text, p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub      uuid;
  v_role     text;
  v_admin    boolean;
  v_task     tasks%ROWTYPE;
  v_today    date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_day      date;
  v_district text;
  v_addr     text;
BEGIN
  IF NOT _session_check_strict(p_actor, p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', '다시 로그인해 주세요.');
  END IF;
  v_admin := _caller_is_admin(p_actor);
  SELECT sub_id, sub_role INTO v_sub, v_role FROM _caller_subcontractor(p_actor);

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND OR v_task.subcontractor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
  END IF;
  IF NOT v_admin THEN
    IF v_sub IS NULL OR v_role <> 'manager' OR v_task.subcontractor_id IS DISTINCT FROM v_sub THEN
      -- 다른 곳의 작업은 "있는지 없는지"도 알려 주지 않음
      RETURN jsonb_build_object('ok', false, 'error', '작업을 찾지 못했습니다.');
    END IF;
  END IF;
  v_sub := v_task.subcontractor_id;

  v_day      := COALESCE((v_task.scheduled_at AT TIME ZONE 'Asia/Seoul')::date, v_task.requested_date, v_today);
  v_district := NULLIF(btrim(COALESCE(v_task.district, '')), '');
  v_addr     := COALESCE(v_task.address, '');

  RETURN jsonb_build_object(
    'ok', true,
    'task', jsonb_build_object('id', v_task.id, 'district', v_district, 'day', v_day, 'today', v_today,
                               'assigned_engineer_id', v_task.assigned_engineer_id),
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', u.id, 'code', u.code, 'name', u.name, 'phone', u.phone, 'sub_role', u.sub_role,
               'region', u.region,
               'can_do', _sub_staff_can_do(u.id, v_sub, v_task.category_id),   -- Mig 235: 이 작업 종목을 할 수 있는지
               'zones', COALESCE((SELECT jsonb_agg(z.district ORDER BY z.district)
                                    FROM engineer_zones z
                                   WHERE z.user_id = u.id AND COALESCE(z.active, true)), '[]'::jsonb),
               -- 작업 지역이 담당 지역에 들어가는지 (구 이름 끝 일치 또는 주소에 포함)
               'zone_match', EXISTS (
                   SELECT 1 FROM engineer_zones z
                    WHERE z.user_id = u.id AND COALESCE(z.active, true)
                      AND btrim(z.district) <> ''
                      AND (   (v_district IS NOT NULL AND v_district LIKE '%' || btrim(z.district))
                           OR position(btrim(z.district) IN v_addr) > 0)),
               'today_tasks', (SELECT COUNT(*) FROM tasks t
                                WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                                  AND t.status <> '취소'
                                  AND COALESCE((t.scheduled_at AT TIME ZONE 'Asia/Seoul')::date, t.requested_date) = v_today),
               'day_tasks', (SELECT COUNT(*) FROM tasks t
                              WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                                AND t.status <> '취소' AND t.id <> v_task.id
                                AND COALESCE((t.scheduled_at AT TIME ZONE 'Asia/Seoul')::date, t.requested_date) = v_day),
               'in_progress', (SELECT COUNT(*) FROM tasks t
                                WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                                  AND t.status = '진행중'),
               'next_at', (SELECT MIN(t.scheduled_at) FROM tasks t
                            WHERE t.assigned_engineer_id = u.id AND t.subcontractor_id = v_sub
                              AND t.status NOT IN ('완료', '취소', 'visit_only', '정산완료')
                              AND t.scheduled_at >= now()),
               -- 작업일 휴무: 종일(시작 시각 없음)이면 off = true, 시간 휴무는 글자로만 표시
               'off', EXISTS (SELECT 1 FROM user_off_days o
                               WHERE o.user_id = u.id AND o.off_date = v_day AND o.start_time IS NULL),
               'off_part', (SELECT string_agg(to_char(o.start_time, 'HH24:MI') || '~' || COALESCE(to_char(o.end_time, 'HH24:MI'), ''), ', '
                                              ORDER BY o.start_time)
                              FROM user_off_days o
                             WHERE o.user_id = u.id AND o.off_date = v_day AND o.start_time IS NOT NULL)
             ) ORDER BY u.name)
        FROM users u
       WHERE u.subcontractor_id = v_sub
         AND u.is_active = true
    ), '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION sub_list_staff_for_task(uuid, text, uuid) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 함수 - 기대: 10행
SELECT proname FROM pg_proc
 WHERE proname IN ('_sub_category_list', '_sub_staff_category_codes', '_sub_staff_can_do', '_sub_scope',
                   'sub_staff_directory', 'sub_get_staff_detail', 'sub_reveal_staff_account', 'sub_update_staff',
                   'admin_set_subcontractor_categories', 'list_subcontractor_categories')
 ORDER BY 1;

-- 2) 배정 시트 함수에 반영됐는지 - 기대: true
SELECT pg_get_functiondef(p.oid) LIKE '%can_do%' AS 반영됨
  FROM pg_proc p WHERE p.proname = 'sub_list_staff_for_task' LIMIT 1;

-- 3) 협력사가 맡는 종목 - 기대: 화이트코어 / hood / 주방후드
SELECT s.name, c.code, c.name AS 종목
  FROM subcontractor_categories sc
  JOIN subcontractors s ON s.id = sc.subcontractor_id
  JOIN categories c ON c.id = sc.category_id
 ORDER BY 1, 2;
