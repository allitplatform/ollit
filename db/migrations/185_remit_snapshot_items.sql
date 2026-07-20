-- 185_remit_snapshot_items.sql
-- 2026-07-20 v2 — 필터·산식 정정 (사장님 지시)
--
-- v1 → v2 정정:
--   [정정1] 필터: `<= week_end` 단일 조건 → 당주/이월 명시 분리 UNION.
--     · 당주: date_trunc('week', settled_kst_date) = week_start           (스탬프 무관)
--     · 이월: date_trunc('week', settled_kst_date) < week_start
--             AND company_received_at IS NULL                             (미회수만)
--     · 프론트 fetchWeekItemsByMonday + fetchCarryoverC2Items 정확 미러링.
--     · v1 `<= week_end` 는 이전 주차 스탬프 누락분을 삼킴 (과잉 매칭) — 폐기.
--   [정정2] company_receive_amount:
--     · v1: `subtotal − ROUND(prin_excl × subtotal / task_sub)` (회사 실수령)
--     · v2: `ROUND(subtotal × 0.85)` (유솔 청구서 실입금)
--     · 근거: 7/13 통장 실입금 2,865,597 = 엑셀 요약 실입금(85%) 정확 일치.
--     · v1 산식은 트랙 B 회사 실수령이고 청구 실입금과 다름 → 대조 불가.
--
-- 배경:
--   Mig 184 는 confirm 시 company_received_at 만 스탬프 → 이월 소멸 O.
--   그러나 카드 집계는 company_received_at IS NULL 기준 라이브 계산 → 스탬프한
--   items 가 확정 주차 카드에서도 빠져 금액 축소 (실측: 7/13 2,865,597 → 864,369).
--   근본 원인: 카드 집계와 이월 소멸이 같은 상태 컬럼 공유해 서로 간섭.
--
-- 해결:
--   확정 주차 = 청구 스냅샷 저장·조회, 미확정 주차 = 라이브 (분리).
--   company_received_at 스탬프는 이월 소멸용으로만 유지 (카드 집계와 분리).
--
-- 산출물:
--   [1] ALTER — principal_weekly_remittances.snapshot_item_count 컬럼 추가
--   [2] CREATE — principal_weekly_remit_items 테이블
--   [3] CREATE INDEX + RLS
--   [4] CREATE OR REPLACE FUNCTION confirm_principal_remittance
--       · 스냅샷 INSERT + snapshot_item_count 세팅 + company_received_at 스탬프 + confirmed_at
--       · 단일 트랜잭션 (원자성)
--       · Mig 184 폐기 — 본 함수가 재정의로 덮어씀
--
-- 시그니처 무변경 → 클라이언트 호출처 (principalRemitDb.js) 수정 불필요.
-- unconfirm 경로: 지원 X (미지원 유지).

-- ============================================================================
-- [1] 요약 스냅샷 컬럼
-- ============================================================================
ALTER TABLE principal_weekly_remittances
  ADD COLUMN IF NOT EXISTS snapshot_item_count int;

COMMENT ON COLUMN principal_weekly_remittances.snapshot_item_count IS
  '확정 시점 청구 건수 스냅샷. NULL = 미확정 or 옛 확정(스냅샷 이전).';

-- ============================================================================
-- [2] 건별 스냅샷 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS principal_weekly_remit_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id),
  remit_id                 uuid NOT NULL REFERENCES principal_weekly_remittances(id) ON DELETE CASCADE,
  task_item_id             uuid NOT NULL REFERENCES task_items(id),

  -- 금액 스냅샷 (확정 시점 값 고정)
  subtotal                 int  NOT NULL,          -- 유솔 정산원금 (task_items.subtotal)
  net_amount               int,                    -- 네이버 정산원금 (task_items.net_amount) · 엑셀 소급 시 NULL
  company_receive_amount   int  NOT NULL,          -- 유솔 청구 실입금 = ROUND(subtotal × 0.85)

  -- 이월 구분
  is_carryover             boolean NOT NULL DEFAULT false,
  carryover_source_monday  date,                   -- 이월 시 원 정산주 KST 월요일. 당주 = NULL

  -- 원본 시각 스냅샷 (드릴인 표기용)
  naver_settled_at         timestamptz NOT NULL,

  captured_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT remit_items_unique UNIQUE (remit_id, task_item_id),
  CONSTRAINT remit_items_carryover_source_valid CHECK (
    (is_carryover = false AND carryover_source_monday IS NULL) OR
    (is_carryover = true  AND carryover_source_monday IS NOT NULL)
  )
);

COMMENT ON TABLE principal_weekly_remit_items IS
  '원청 주차 정산 확정 시점 건별 청구 스냅샷. remit_id 로 그 주차 카드/드릴인 소스.';
COMMENT ON COLUMN principal_weekly_remit_items.company_receive_amount IS
  'ROUND(subtotal × 0.85) — 유솔이 회사에 실제로 입금하는 금액 (수수료 15% 차감 후).';

CREATE INDEX IF NOT EXISTS idx_remit_items_by_remit ON principal_weekly_remit_items(remit_id);
CREATE INDEX IF NOT EXISTS idx_remit_items_by_item  ON principal_weekly_remit_items(task_item_id);

-- ============================================================================
-- [3] RLS
-- ============================================================================
ALTER TABLE principal_weekly_remit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS remit_items_partner_select ON principal_weekly_remit_items;
CREATE POLICY remit_items_partner_select ON principal_weekly_remit_items
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND current_user_has_role('partner')
    AND EXISTS (
      SELECT 1 FROM principal_weekly_remittances r
       WHERE r.id = principal_weekly_remit_items.remit_id
         AND r.principal_id = ANY(current_user_principal_ids())
    )
  );

DROP POLICY IF EXISTS remit_items_admin_all ON principal_weekly_remit_items;
CREATE POLICY remit_items_admin_all ON principal_weekly_remit_items
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND (
      current_user_has_role('owner')
      OR current_user_has_role('operator')
      OR current_user_has_role('admin')
    )
  );

-- ============================================================================
-- [4] confirm_principal_remittance — 스냅샷 + 스탬프 + 확정 (원자)
-- ============================================================================
CREATE OR REPLACE FUNCTION confirm_principal_remittance(
  p_user_id uuid,
  p_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row             principal_weekly_remittances;
  v_is_admin        boolean;
  v_confirmed_at    timestamptz;
  v_snapshot_count  int;
  v_stamped_count   int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role IN ('owner', 'operator', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_row FROM principal_weekly_remittances WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_row.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_confirmed');
  END IF;

  v_confirmed_at := now();

  -- ────────────────────────────────────────────────────────────────
  -- (A) 청구 items 조회 → 스냅샷 INSERT
  --
  -- 필터 (당주 ∪ 이월) — 프론트 정확 미러링:
  --   · 당주 = date_trunc('week', settled_kst_date) = week_start          (스탬프 무관)
  --   · 이월 = date_trunc('week', settled_kst_date) < week_start
  --           AND company_received_at IS NULL                             (미회수만)
  --
  -- 공통 조건:
  --   · tasks.principal_id = v_row.principal_id
  --   · tasks.status = '완료'
  --   · naver_settled_at IS NOT NULL
  --   · NOT is_canceled AND subtotal > 0
  --   · EXISTS payments.track = 'B'
  --
  -- 산식:
  --   · company_receive_amount = ROUND(subtotal × 0.85) — 유솔 청구 실입금
  -- ────────────────────────────────────────────────────────────────
  WITH candidates AS (
    SELECT
      ti.id                                                              AS task_item_id,
      ti.task_id,
      ti.subtotal,
      ti.net_amount,
      ti.naver_settled_at,
      ti.company_received_at,
      (ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date              AS settled_kst_date,
      date_trunc(
        'week',
        ((ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date)::timestamp
      )::date                                                            AS settled_monday
    FROM task_items ti
    JOIN tasks t ON ti.task_id = t.id
    WHERE t.principal_id = v_row.principal_id
      AND t.status = '완료'
      AND ti.naver_settled_at IS NOT NULL
      AND COALESCE(ti.is_canceled, false) = false
      AND ti.subtotal > 0
      AND EXISTS (SELECT 1 FROM payments p
                   WHERE p.task_id = t.id AND p.track = 'B')
  ),
  in_scope AS (
    SELECT
      c.*,
      CASE
        WHEN c.settled_monday = v_row.week_start THEN false               -- 당주
        WHEN c.settled_monday < v_row.week_start THEN true                -- 이월
        ELSE NULL                                                          -- 미래 (제외)
      END AS is_carryover_flag
    FROM candidates c
    WHERE
      -- 당주: 스탬프 무관
      c.settled_monday = v_row.week_start
      OR
      -- 이월: 미회수만
      (c.settled_monday < v_row.week_start AND c.company_received_at IS NULL)
  ),
  inserted AS (
    INSERT INTO principal_weekly_remit_items (
      tenant_id, remit_id, task_item_id,
      subtotal, net_amount, company_receive_amount,
      is_carryover, carryover_source_monday,
      naver_settled_at, captured_at
    )
    SELECT
      v_row.tenant_id, v_row.id, s.task_item_id,
      s.subtotal, s.net_amount,
      ROUND(s.subtotal::numeric * 0.85)::int                              AS company_receive_amount,
      s.is_carryover_flag,
      CASE WHEN s.is_carryover_flag THEN s.settled_monday ELSE NULL END   AS carryover_source_monday,
      s.naver_settled_at, v_confirmed_at
    FROM in_scope s
    ON CONFLICT (remit_id, task_item_id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_snapshot_count FROM inserted;

  -- ────────────────────────────────────────────────────────────────
  -- (B) company_received_at 스탬프 (이월 소멸)
  -- 대상 = 스냅샷 대상 AND company_received_at IS NULL
  -- (당주에 이미 스탬프된 것 재덮어쓰기 방지)
  -- ────────────────────────────────────────────────────────────────
  WITH stamped AS (
    UPDATE task_items ti
       SET company_received_at = v_confirmed_at
      FROM tasks t
     WHERE ti.task_id = t.id
       AND t.principal_id = v_row.principal_id
       AND t.status = '완료'
       AND ti.naver_settled_at IS NOT NULL
       AND ti.company_received_at IS NULL
       AND COALESCE(ti.is_canceled, false) = false
       AND ti.subtotal > 0
       AND EXISTS (SELECT 1 FROM payments p
                    WHERE p.task_id = t.id AND p.track = 'B')
       AND (
         -- 당주 (미회수) 또는 이월 (미회수)
         date_trunc('week', ((ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date)::timestamp)::date
           <= v_row.week_start
       )
    RETURNING ti.id
  )
  SELECT count(*) INTO v_stamped_count FROM stamped;

  -- ────────────────────────────────────────────────────────────────
  -- (C) remit row 확정 + snapshot_item_count 세팅
  -- ────────────────────────────────────────────────────────────────
  UPDATE principal_weekly_remittances
     SET confirmed_at        = v_confirmed_at,
         confirmed_by        = p_user_id,
         snapshot_item_count = v_snapshot_count,
         updated_at          = v_confirmed_at
   WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_id,
    'confirmed_at', v_confirmed_at,
    'snapshot_count', v_snapshot_count,
    'stamped_count',  v_stamped_count
  );
END;
$$;

-- ============================================================================
-- 검증 SQL — 사장님 콘솔 실행
-- ============================================================================
--
-- [1] 스키마 확인
-- \d principal_weekly_remit_items
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'principal_weekly_remittances' AND column_name = 'snapshot_item_count';
--
-- [2] 함수 body 확인 (v2 반영)
-- SELECT prosrc FROM pg_proc WHERE proname = 'confirm_principal_remittance';
--
-- [3] Mig 185 적용 전 → ad-hoc_2026-07-20_dryrun_confirm_7_13.sql 로 시뮬 (53건/2,865,597 대조).
--
-- [4] Mig 185 적용 + 신규 미확정 주차 confirm 시험 (7/20 이후)
-- SELECT confirm_principal_remittance(
--   (SELECT id FROM users WHERE code='A004'),
--   (SELECT id FROM principal_weekly_remittances
--    WHERE principal_id = (SELECT id FROM principals WHERE code='usol_n')
--      AND confirmed_at IS NULL
--    ORDER BY week_start DESC LIMIT 1)
-- );
-- 기대: { ok:true, snapshot_count:N, stamped_count:N }
--
-- ============================================================================
-- Mig 184 폐기 안내
-- ============================================================================
-- Mig 184 미실행. 본 Mig 185 가 재정의로 덮어써 폐기.
-- db/migrations/184_confirm_remit_stamps_items.sql 파일은 별도 정리 (선택).
