-- ============================================================================
-- Migration 215 - 묶음 3 최소분 (1/4): 수수료 규칙표 + track 'S' + 공급가액 칸 + 주방후드 서비스
-- 작성 2026-10-06 · 선행: 212~214
--
-- 내용
--   [1] fee_rules                협력사 수수료 규칙표 (tenant_id 포함)
--   [2] payments.track CHECK     ('A','B') -> ('A','B','S')   S = 협력사 수수료
--   [3] tasks.supply_amount      협력사 직원이 완료 때 입력하는 공급가액(부가세 제외)
--   [4] 주방후드 종목 + 서비스 3종 (id 고정 없이 code 기준)
--   [5] 화이트코어 규칙: 공급가액의 35%, 원 단위 반올림, 서비스 구분 없이 전부
--       (출장비만 받은 건도 같은 규칙)
--   [6] 협력사 경계 확인 트리거 (tenant 불일치 차단)
--
-- 기존 데이터 영향
--   · payments: 제약만 넓어짐 (기존 행 변경 없음, 기존 값 A/B 는 그대로 유효)
--   · tasks: 새 칸 NULL 로 시작
--   · service_types / work_types / categories: 행 추가만 (기존 행 변경 없음)
--   이 파일만으로는 정산 결과가 바뀌지 않습니다 (계산 함수는 216 에서).
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 수수료 규칙표
--   규칙 찾는 순서 (216 의 협력사 분기): 같은 협력사의 규칙 중
--     원청·서비스가 모두 맞는 것 > 하나만 맞는 것 > 둘 다 비어 있는(전체) 것,
--     그 안에서 적용 시작일이 가장 최근인 것.
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  subcontractor_id  uuid NOT NULL REFERENCES subcontractors(id),
  principal_code    text,                       -- NULL = 모든 원청
  service_code      text,                       -- NULL = 모든 서비스
  fee_type          text NOT NULL CHECK (fee_type IN ('rate', 'fixed')),
  fee_rate          numeric CHECK (fee_rate IS NULL OR (fee_rate >= 0 AND fee_rate <= 1)),
  fee_amount        int     CHECK (fee_amount IS NULL OR fee_amount >= 0),
  fee_base          text NOT NULL DEFAULT 'supply' CHECK (fee_base IN ('supply', 'gross')),
  effective_from    date NOT NULL DEFAULT CURRENT_DATE,
  active            boolean NOT NULL DEFAULT true,
  memo              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK ((fee_type = 'rate' AND fee_rate IS NOT NULL) OR (fee_type = 'fixed' AND fee_amount IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS fee_rules_lookup ON fee_rules (tenant_id, subcontractor_id, active, effective_from DESC);

COMMENT ON TABLE fee_rules IS
  '협력사 수수료 규칙. fee_base: supply = 공급가액(부가세 제외) 기준 / gross = 고객 결제 합계 기준. 금액은 원 단위 반올림.';

ALTER TABLE fee_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE fee_rules FROM anon, authenticated;

-- ============================================================
-- [2] payments.track 제약 교체 (이름을 추측하지 않고 찾아서 교체)
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
     WHERE cl.relname = 'payments'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%track%'
  LOOP
    EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE payments ADD CONSTRAINT payments_track_check CHECK (track IN ('A', 'B', 'S'));
END $$;

COMMENT ON COLUMN payments.track IS
  '자금 흐름. A=일일정산(기사->회사), B=월정산(회사->기사, 유솔N), S=협력사 수수료(협력사->회사, 협력사 x 작업일 단위).';

-- ============================================================
-- [3] 공급가액 칸
-- ============================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS supply_amount int;
COMMENT ON COLUMN tasks.supply_amount IS
  '협력사 작업의 공급가액(부가세 제외). 협력사 직원이 완료 때 입력. 합계(공급가 + 부가세 10%)는 received_total 에 저장.';

-- ============================================================
-- [4] 주방후드 종목 + 서비스 3종 (code 기준, id 고정 없음)
--   · 서비스 이름은 접수 화면이 보내는 글자와 정확히 같아야 합니다
--     (저장 트리거가 service_types.name 으로 찾음).
--   · 기종 구분이 없는 서비스라 작업 행은 "(공통)" 1개씩.
-- ============================================================
INSERT INTO categories (code, name, unit, qty_kind, active)
VALUES ('hood', '주방후드', '대', 'integer', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_types (category_id, code, name)
SELECT c.id, v.code, v.name
  FROM categories c
 CROSS JOIN (VALUES
   ('hood_commercial', '주방후드(업소용)'),
   ('hood_home',       '주방후드(가정용)'),
   ('hood_install',    '후드설치')
 ) AS v(code, name)
 WHERE c.code = 'hood'
ON CONFLICT (category_id, code) DO NOTHING;

INSERT INTO work_types (service_type_id, appliance_type_id, code, name, default_unit_price)
SELECT st.id, NULL, st.code, st.name || '_(공통)', 0
  FROM service_types st
 WHERE st.code IN ('hood_commercial', 'hood_home', 'hood_install')
   AND NOT EXISTS (SELECT 1 FROM work_types wt WHERE wt.service_type_id = st.id AND wt.code = st.code);

-- ============================================================
-- [5] 화이트코어 규칙 - 공급가액 x 35% (서비스·원청 구분 없이 전부)
-- ============================================================
INSERT INTO fee_rules (tenant_id, subcontractor_id, principal_code, service_code,
                       fee_type, fee_rate, fee_base, effective_from, memo)
SELECT s.tenant_id, s.id, NULL, NULL, 'rate', 0.35, 'supply', DATE '2026-10-01',
       '화이트코어: 공급가액의 35% (원 단위 반올림). 출장비만 받은 건도 동일. 2026-10-06 사장님 확정.'
  FROM subcontractors s
 WHERE s.code = 'whitecore'
   AND NOT EXISTS (SELECT 1 FROM fee_rules f WHERE f.subcontractor_id = s.id);

-- ============================================================
-- [6] 협력사 경계 확인 (tenant)
--   협력사 RPC 는 subcontractor_id 로 거릅니다. 아래 두 트리거가
--   "작업·사용자의 협력사는 반드시 같은 tenant" 를 DB 에서 보장하므로,
--   subcontractor_id 로 거른 결과에 다른 tenant 의 행이 섞일 수 없습니다.
-- ============================================================
CREATE OR REPLACE FUNCTION trg_check_subcontractor_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_tenant uuid;
BEGIN
  IF NEW.subcontractor_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT tenant_id INTO v_sub_tenant FROM subcontractors WHERE id = NEW.subcontractor_id;
  IF v_sub_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION '협력사와 소속 회사(tenant)가 다릅니다. 저장을 중단합니다.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_zz_check_subcontractor_tenant ON tasks;
CREATE TRIGGER tasks_zz_check_subcontractor_tenant
  BEFORE INSERT OR UPDATE OF subcontractor_id, assigned_engineer_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION trg_check_subcontractor_tenant();

DROP TRIGGER IF EXISTS users_check_subcontractor_tenant ON users;
CREATE TRIGGER users_check_subcontractor_tenant
  BEFORE INSERT OR UPDATE OF subcontractor_id ON users
  FOR EACH ROW EXECUTE FUNCTION trg_check_subcontractor_tenant();

COMMIT;

-- ============================================================================
-- 검증
-- ============================================================================
-- 1) 규칙 - 기대: 화이트코어 / rate / 0.35 / supply
SELECT s.name, f.fee_type, f.fee_rate, f.fee_base, f.principal_code, f.service_code, f.effective_from
  FROM fee_rules f JOIN subcontractors s ON s.id = f.subcontractor_id;

-- 2) track 제약 - 기대: A, B, S 가 들어 있는 정의 1행
SELECT conname, pg_get_constraintdef(con.oid)
  FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
 WHERE cl.relname = 'payments' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%track%';

-- 3) 주방후드 서비스 - 기대: 3행, 각 작업행 1
SELECT st.code, st.name, (SELECT COUNT(*) FROM work_types wt WHERE wt.service_type_id = st.id) AS 작업행
  FROM service_types st WHERE st.code LIKE 'hood%' ORDER BY st.code;

-- 4) 기존 payments 무변경 - 기대: S 0건
SELECT track, COUNT(*) FROM payments GROUP BY track ORDER BY track;
