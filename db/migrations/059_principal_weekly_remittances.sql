-- 059_principal_weekly_remittances.sql
-- 2026-05-23 — 원청 → 회사 주간 정산 입금 워크플로 (Phase 1+2)
-- 사장님 spec:
--   · 매주 월요일 = 주정산일. 전주(월~일) 네이버 정산분을 원청이 회사로 입금.
--   · 원청이 정산 탭에서 "입금했습니다" → 회사가 AdminApp에서 "입금 확인" → 완료.
--   · 주차 카드 상태 3단계: 입금 예정 / 입금 확인 중 / 입금완료.
--   · 통합계정(P003 = usol_h + usol_n) 지원 — current_user_principal_ids() 배열 헬퍼.
--   · 직접 UPDATE 차단 — RPC 3개(mark/confirm/undo)로만 변경. (Migration 060)

-- ============================================
-- [1] 다중 principal 헬퍼 함수
-- ============================================
-- current_user_principal_id() (Migration 003)는 is_primary=true 1개만 반환 → 통합계정 부적합.
-- current_user_principal_ids() = partner role의 모든 principal_id 배열 반환.

CREATE OR REPLACE FUNCTION current_user_principal_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT principal_id), ARRAY[]::uuid[])
  FROM user_roles
  WHERE user_id = auth.uid()
    AND role = 'partner'
    AND principal_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION current_user_principal_ids() TO anon, authenticated;

COMMENT ON FUNCTION current_user_principal_ids() IS
  '현재 사용자의 partner role principal_id 배열 — 통합계정(P003 등) 지원.';

-- ============================================
-- [2] 테이블 — 주차 단위 정산 입금 보고/확인
-- ============================================
CREATE TABLE IF NOT EXISTS principal_weekly_remittances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  principal_id    uuid NOT NULL REFERENCES principals(id),
  week_start      date NOT NULL,                  -- 그 주 월요일 (KST)
  week_end        date NOT NULL,                  -- 그 주 일요일 (KST)
  remitted_amount int  NOT NULL,                  -- 보고 시점 항목 subtotal 합 스냅샷
  remitted_at     timestamptz NOT NULL DEFAULT now(),
  remitted_by     uuid REFERENCES users(id),
  confirmed_at    timestamptz,                    -- 회사 확인 시각 (NULL = 미확인)
  confirmed_by    uuid REFERENCES users(id),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT principal_weekly_remit_unique UNIQUE (principal_id, week_start),
  CONSTRAINT principal_weekly_remit_week_valid CHECK (week_end >= week_start),
  CONSTRAINT principal_weekly_remit_amount_nonneg CHECK (remitted_amount >= 0)
);

-- ============================================
-- [3] 인덱스
-- ============================================
CREATE INDEX IF NOT EXISTS idx_principal_remit_by_principal
  ON principal_weekly_remittances(principal_id, week_start DESC);

-- 운영자 "확인 대기" 빠른 조회
CREATE INDEX IF NOT EXISTS idx_principal_remit_pending_confirm
  ON principal_weekly_remittances(remitted_at)
  WHERE confirmed_at IS NULL;

-- ============================================
-- [4] RLS — 직접 UPDATE/INSERT/DELETE는 RPC로만 (정책은 SELECT 위주)
-- ============================================
ALTER TABLE principal_weekly_remittances ENABLE ROW LEVEL SECURITY;

-- partner — 자기 principal_id 측 측 SELECT 가능 (PrincipalSettleTab fetch)
CREATE POLICY principal_remit_partner_select ON principal_weekly_remittances
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND current_user_has_role('partner')
    AND principal_id = ANY(current_user_principal_ids())
  );

-- owner / operator — 모든 row ALL (UsolNTracking fetch + RPC bypass용)
CREATE POLICY principal_remit_owner_operator_all ON principal_weekly_remittances
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND (current_user_has_role('owner') OR current_user_has_role('operator'))
  );

-- 참고: RPC는 모두 SECURITY DEFINER로 정책 우회. partner의 INSERT/UPDATE/DELETE는
-- RPC 경유만 허용 (테이블 직접 변경 X).

-- ============================================
-- [5] 컬럼 코멘트
-- ============================================
COMMENT ON TABLE principal_weekly_remittances IS
  '원청 → 회사 주간 정산 입금 보고/확인. 측 주차에 1 row (principal_id, week_start UNIQUE).';
COMMENT ON COLUMN principal_weekly_remittances.week_start      IS '그 주 월요일 (KST date)';
COMMENT ON COLUMN principal_weekly_remittances.week_end        IS '그 주 일요일 (KST date)';
COMMENT ON COLUMN principal_weekly_remittances.remitted_amount IS '보고 시점 항목 subtotal 합 스냅샷 (원)';
COMMENT ON COLUMN principal_weekly_remittances.remitted_at     IS '원청 "입금했습니다" 클릭 시각';
COMMENT ON COLUMN principal_weekly_remittances.remitted_by     IS '보고한 원청 사용자 (users.id)';
COMMENT ON COLUMN principal_weekly_remittances.confirmed_at    IS '회사 "입금 확인" 클릭 시각 (NULL=미확인)';
COMMENT ON COLUMN principal_weekly_remittances.confirmed_by    IS '확인한 운영자 (users.id)';

-- ============================================
-- 검증 SQL — 실행 후 확인
-- ============================================
-- SELECT table_name FROM information_schema.tables WHERE table_name='principal_weekly_remittances';
-- SELECT policyname FROM pg_policies WHERE tablename='principal_weekly_remittances';
-- SELECT current_user_principal_ids();  -- 로그인 컨텍스트 측 측 측
