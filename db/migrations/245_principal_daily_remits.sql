-- ============================================================================
-- Migration 245 - 원청(쿨가이)에 보낼 돈: 날짜별 줄 · 송금 완료 · 가계부 출금
-- 작성 2026-10-07 · 선행: 225, 229, 244
--
-- 사장님 확정 (2026-10-07)
--   · 쿨가이에 매일 송금. 기준 = 그날 화이트코어에게서 [받음 확인](입금 확인)한 작업분만.
--     (돈을 받기 전에 먼저 내보내지 않는다)
--   · 잠금 뒤 금액이 바뀐 조정분은, 그 조정 줄이 속한 날짜의 쿨가이 몫에 넣는다.
--   · 보낼 금액이 0 이하라 [받음 확인] 이 없는 날의 몫은 다음 [받음 확인] 날짜로 넘어간다.
--
-- 동작
--   화이트코어 일일 정산(subcontractor_daily_settlements)의 입금 확인 시각(confirmed_at)이 찍히면
--   -> 그 협력사에서 "이미 입금 확인된 날짜에 속한 작업" 전부를 다시 훑어,
--      작업마다 (지금의 원청 몫) - (지금까지 줄로 만든 원청 몫) = 차이 를 구한다.
--   -> 차이가 0 이 아닌 작업들을 모아 그 날짜의 "원청에 보낼 돈" 1줄(원청별)을 만든다.
--      · 새로 확인된 날짜의 작업은 차이 = 원청 몫 전체.
--      · 완료 뒤 취소 · 견적 수정 · 금액 수정으로 몫이 달라진 작업은 차이만큼 (+/-) 다음 확인 날짜에 반영된다.
--      · 이월된 날짜의 줄은 정산 함수(mig 228)가 보고일로 옮겨 잠그므로, 그 보고일의 입금 확인 때 함께 잡힌다.
--   -> 합계가 0 이하인 줄은 보낼 것이 없는 줄(넘김)로 남고, 다음 줄에 더해진다.
--   입금 확인을 되돌리면 그 날짜의 줄을 없앤다. 이미 [송금 완료] 한 줄이 있으면 되돌리기를 막는다.
--
-- 내용
--   [1] principal_remits / principal_remit_lines        날짜별 줄 · 작업별 내역
--   [2] _principal_remit_build / trg_sub_daily_principal_remit   입금 확인 · 되돌리기에 맞춰 줄을 만들고 없앤다
--   [3] admin_list_principal_remits                      운영자 전용 목록
--   [4] admin_mark_principal_remit_paid                  [송금 완료] / 되돌리기 + 가계부 출금(source = principal_fee)
--
-- 화이트코어 정산 함수(225·227·228·229·233)는 건드리지 않습니다 (표에 트리거만 추가).
-- 기존 데이터 영향 없음. 다시 실행해도 안전합니다.
-- ============================================================================

BEGIN;

-- ============================================================
-- [1] 표
-- ============================================================
CREATE TABLE IF NOT EXISTS principal_remits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  principal_id     uuid NOT NULL REFERENCES principals(id),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id),
  settle_date      date NOT NULL,                 -- 화이트코어 정산 날짜 (입금 확인한 날짜 줄)
  amount           int  NOT NULL DEFAULT 0,       -- 보낼 금액 (작업별 차이 합계 + 넘겨받은 금액). 0 이하 = 보낼 것 없음
  carried_in       int  NOT NULL DEFAULT 0,       -- 앞의 "보낼 것 없는 줄" 에서 넘겨받은 금액
  absorbed_into    uuid REFERENCES principal_remits(id) ON DELETE SET NULL,   -- 이 줄(0 이하)이 넘어간 다음 줄
  paid_at          timestamptz,
  paid_by          uuid REFERENCES users(id),
  paid_by_name     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (principal_id, subcontractor_id, settle_date)
);
CREATE TABLE IF NOT EXISTS principal_remit_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remit_id    uuid NOT NULL REFERENCES principal_remits(id) ON DELETE CASCADE,
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  delta       int  NOT NULL,                      -- 이번에 반영한 차이 (+ 더 보냄 / - 덜 보냄)
  share_after int  NOT NULL,                      -- 반영 뒤 그 작업의 원청 몫
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS principal_remit_lines_by_task ON principal_remit_lines (task_id);
CREATE INDEX IF NOT EXISTS principal_remits_by_date ON principal_remits (settle_date DESC);

ALTER TABLE principal_remits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE principal_remit_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE principal_remits      FROM anon, authenticated;
REVOKE ALL ON TABLE principal_remit_lines FROM anon, authenticated;

-- ============================================================
-- [2] 줄 만들기 / 없애기
-- ============================================================
CREATE OR REPLACE FUNCTION _principal_remit_build(p_sub uuid, p_date date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_remit  uuid;
  v_carry  int;
  r        record;
BEGIN
  SELECT tenant_id INTO v_tenant FROM subcontractors WHERE id = p_sub;

  -- 원청별로: 입금 확인된 날짜에 속한 작업들의 (지금 몫 - 이미 줄로 만든 몫)
  FOR r IN
    SELECT x.principal_id,
           jsonb_agg(jsonb_build_object('task_id', x.task_id, 'delta', x.delta, 'share', x.share)) AS items,
           SUM(x.delta)::int AS total
      FROM (
        SELECT t.principal_id, t.id AS task_id,
               COALESCE((SELECT p.sub_principal_share FROM payments p WHERE p.task_id = t.id AND p.track = 'S' LIMIT 1), 0) AS share,
               COALESCE((SELECT p.sub_principal_share FROM payments p WHERE p.task_id = t.id AND p.track = 'S' LIMIT 1), 0)
                 - COALESCE((SELECT SUM(pl.delta) FROM principal_remit_lines pl WHERE pl.task_id = t.id), 0)::int AS delta
          FROM tasks t
         WHERE t.principal_id IS NOT NULL
           AND t.id IN (
             SELECT l.task_id
               FROM subcontractor_settlement_lines l
               JOIN subcontractor_daily_settlements d
                 ON d.subcontractor_id = l.subcontractor_id AND d.settle_date = l.settle_date
              WHERE l.subcontractor_id = p_sub AND d.confirmed_at IS NOT NULL)
      ) x
     WHERE x.delta <> 0
     GROUP BY x.principal_id
  LOOP
    INSERT INTO principal_remits (tenant_id, principal_id, subcontractor_id, settle_date, amount)
    VALUES (v_tenant, r.principal_id, p_sub, p_date, 0)
    ON CONFLICT (principal_id, subcontractor_id, settle_date) DO NOTHING;
    SELECT id INTO v_remit FROM principal_remits
     WHERE principal_id = r.principal_id AND subcontractor_id = p_sub AND settle_date = p_date;
    -- 이미 [송금 완료] 한 줄에는 더하지 않는다 (다음 입금 확인 때 차이로 다시 잡힌다)
    CONTINUE WHEN (SELECT paid_at IS NOT NULL FROM principal_remits WHERE id = v_remit);

    INSERT INTO principal_remit_lines (remit_id, task_id, delta, share_after)
    SELECT v_remit, (i ->> 'task_id')::uuid, (i ->> 'delta')::int, (i ->> 'share')::int
      FROM jsonb_array_elements(r.items) i;

    -- 앞에 남아 있는 "보낼 것 없는 줄"(0 이하, 아직 넘기지 않은 것)을 이 줄로 넘겨받는다
    SELECT COALESCE(SUM(pr.amount), 0)::int INTO v_carry
      FROM principal_remits pr
     WHERE pr.principal_id = r.principal_id AND pr.subcontractor_id = p_sub
       AND pr.id <> v_remit AND pr.amount <= 0 AND pr.paid_at IS NULL AND pr.absorbed_into IS NULL
       AND pr.settle_date < p_date;
    UPDATE principal_remits pr SET absorbed_into = v_remit
     WHERE pr.principal_id = r.principal_id AND pr.subcontractor_id = p_sub
       AND pr.id <> v_remit AND pr.amount <= 0 AND pr.paid_at IS NULL AND pr.absorbed_into IS NULL
       AND pr.settle_date < p_date;

    UPDATE principal_remits pr
       SET carried_in = pr.carried_in + v_carry,
           amount = (SELECT COALESCE(SUM(pl.delta), 0)::int FROM principal_remit_lines pl WHERE pl.remit_id = pr.id)
                    + pr.carried_in + v_carry
     WHERE pr.id = v_remit;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION _principal_remit_build(uuid, date) FROM PUBLIC, anon, authenticated;

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
      RAISE EXCEPTION '이 날짜(%)는 원청(쿨가이) 송금 완료로 처리돼 있습니다. 먼저 [쿨가이 송금 완료] 를 되돌린 뒤 다시 시도해 주세요.', v_date;
    END IF;
    -- 이 줄이 넘겨받았던 앞 줄들은 다시 "넘기지 않은 줄" 로 (ON DELETE SET NULL)
    DELETE FROM principal_remits pr WHERE pr.subcontractor_id = v_sub AND pr.settle_date = v_date;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sub_daily_principal_remit ON subcontractor_daily_settlements;
CREATE TRIGGER sub_daily_principal_remit
  AFTER INSERT OR UPDATE OF confirmed_at OR DELETE ON subcontractor_daily_settlements
  FOR EACH ROW EXECUTE FUNCTION trg_sub_daily_principal_remit();

-- ============================================================
-- [3] 운영자: 목록 (최근 90일 + 아직 안 보낸 줄 전부)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_list_principal_remits(p_actor uuid, p_token text)
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
    SELECT jsonb_agg(q.j ORDER BY q.settle_date DESC, q.created_at DESC)
      FROM (
        SELECT pr.settle_date, pr.created_at,
               jsonb_build_object(
                 'id', pr.id, 'date', pr.settle_date, 'amount', pr.amount, 'carried_in', pr.carried_in,
                 'principal_code', p.code, 'principal_name', p.name,
                 'subcontractor_id', pr.subcontractor_id, 'subcontractor_name', s.name,
                 'paid_at', pr.paid_at, 'paid_by', pr.paid_by_name,
                 'absorbed', pr.absorbed_into IS NOT NULL,
                 'lines', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                             'task_id', t.id, 'task_no', t.task_no, 'customer_name', t.customer_name,
                             'delta', pl.delta, 'share_after', pl.share_after,
                             'fee', (SELECT pm.owner_amount FROM payments pm WHERE pm.task_id = t.id AND pm.track = 'S' LIMIT 1),
                             'quote', t.sub_quote_supply, 'quote_edited', t.sub_quote_edited_at IS NOT NULL)
                             ORDER BY t.task_no)
                      FROM principal_remit_lines pl JOIN tasks t ON t.id = pl.task_id
                     WHERE pl.remit_id = pr.id), '[]'::jsonb)) AS j
          FROM principal_remits pr
          JOIN principals p     ON p.id = pr.principal_id
          JOIN subcontractors s ON s.id = pr.subcontractor_id
         WHERE pr.settle_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 90
            OR (pr.paid_at IS NULL AND pr.absorbed_into IS NULL AND pr.amount <> 0)
      ) q), '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION admin_list_principal_remits(uuid, text) TO anon, authenticated;

-- ============================================================
-- [4] 운영자: [송금 완료] / 되돌리기 + 가계부 출금
-- ============================================================
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
              '원청 몫 송금 · ' || COALESCE(v_pn, '') || ' · ' || to_char(v_r.settle_date, 'MM/DD') || ' 입금 확인분',
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
-- 검증 - 기대: 표 2 + 함수 4 + 트리거 1 = 7행
-- ============================================================================
SELECT '표' AS 종류, table_name AS 이름 FROM information_schema.tables
 WHERE table_name IN ('principal_remits', 'principal_remit_lines')
UNION ALL
SELECT '함수', proname FROM pg_proc
 WHERE proname IN ('_principal_remit_build', 'trg_sub_daily_principal_remit', 'admin_list_principal_remits', 'admin_mark_principal_remit_paid')
UNION ALL
SELECT '트리거', tgname FROM pg_trigger WHERE tgname = 'sub_daily_principal_remit' AND NOT tgisinternal
 ORDER BY 1, 2;
