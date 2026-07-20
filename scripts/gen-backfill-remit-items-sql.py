"""Generate backfill SQL files for 7/6 · 7/13 confirmed remits.

Reads two excel files:
  · 유솔N_주정산_7월 1주차 (1).xlsx  → 7/6 확정 (115건, 당주 only)
  · 유솔N_주정산_7월 2주차 (1).xlsx  → 7/13 확정 (53건, 당주 14 + 이월 39)

Emits:
  · db/migrations/ad-hoc_2026-07-20_backfill_remit_items_7_6.sql
  · db/migrations/ad-hoc_2026-07-20_backfill_remit_items_7_13.sql

Each SQL:
  1. Resolves remit_id from principals(code='usol_n') + week_start
  2. VALUES 절로 엑셀 items 인라인
  3. LEFT JOIN task_items ON product_order_id → 매칭
  4. INSERT INTO principal_weekly_remit_items (매칭된 것만)
  5. UPDATE snapshot_item_count = 엑셀 원본 건수
  6. UPDATE task_items.company_received_at (매칭된 것만, IS NULL 조건)
  7. RAISE NOTICE 로 matched/missing 카운트 리포트
  8. Transaction wrap (BEGIN ... COMMIT) — 문제 시 ROLLBACK

Snapshot 값 정책:
  · subtotal        = 엑셀 정산원금 (확정 시점 값 고정)
  · net_amount      = NULL (엑셀에 없음)
  · company_receive_amount = ROUND(subtotal × 0.85) — Mig 185 동일 산식
  · naver_settled_at = task_items.naver_settled_at (원본 timestamptz · 드릴인 정렬용)
  · captured_at     = 그 remit 의 confirmed_at (확정 시점 스냅샷 의미)
"""
import glob
import os
import re
import sys
import openpyxl

DOWNLOADS = os.path.expanduser("~/Downloads")
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(REPO_ROOT, "db", "migrations")

TARGETS = [
    {
        "label": "7_6",
        "pattern": "유솔N_주정산_7월 1주차 (1).xlsx",
        "week_start": "2026-06-29",
        "week_end":   "2026-07-05",
        "expected_count": 115,
        "expected_company_receive": 8_187_023,
        "expected_carryover_count": 0,
    },
    {
        "label": "7_13",
        "pattern": "유솔N_주정산_7월 2주차 (1).xlsx",
        "week_start": "2026-07-06",
        "week_end":   "2026-07-12",
        "expected_count": 53,
        "expected_company_receive": 2_865_597,
        "expected_carryover_count": 39,
    },
]

CARRYOVER_RE = re.compile(r"이전 미정산 \((\d+)/(\d+)~\d+/\d+\)")

def parse_row(row):
    """Return dict from 건별 상세 row (9 cols). settled_date not used — pulled from task_items."""
    kind = row[0]
    product_order_id = str(row[2]).strip() if row[2] is not None else None
    buyer_name = str(row[3]).strip() if row[3] is not None else ""
    subtotal = int(row[6]) if row[6] is not None else None

    if not product_order_id or subtotal is None:
        return None

    is_carryover = False
    carry_monday = None
    if kind != "당주 정산":
        m = CARRYOVER_RE.match(str(kind))
        if not m:
            raise ValueError(f"unrecognized 구분: {kind!r}")
        month, day = int(m.group(1)), int(m.group(2))
        carry_monday = f"2026-{month:02d}-{day:02d}"
        is_carryover = True

    return {
        "product_order_id": product_order_id,
        "buyer_name": buyer_name,
        "subtotal": subtotal,
        "is_carryover": is_carryover,
        "carry_monday": carry_monday,
    }

def load_excel(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    if "건별 상세" not in wb.sheetnames:
        raise ValueError(f"sheet '건별 상세' not found in {path}. sheets={wb.sheetnames}")
    ws = wb["건별 상세"]
    rows = []
    for r in range(2, ws.max_row + 1):
        row = [ws.cell(row=r, column=c).value for c in range(1, ws.max_column + 1)]
        parsed = parse_row(row)
        if parsed:
            rows.append(parsed)
    return rows

def format_values_row(item):
    poid = item["product_order_id"].replace("'", "''")
    buyer = item["buyer_name"].replace("'", "''")
    carry_sql = f"'{item['carry_monday']}'::date" if item["carry_monday"] else "NULL::date"
    return (
        f"    ('{poid}', '{buyer}', {item['subtotal']}, "
        f"{'true' if item['is_carryover'] else 'false'}, "
        f"{carry_sql})"
    )

def emit_sql(target, items):
    label = target["label"]
    week_start = target["week_start"]
    week_end = target["week_end"]
    expected_count = target["expected_count"]
    expected_recv = target["expected_company_receive"]
    expected_carry = target["expected_carryover_count"]

    actual_count = len(items)
    actual_carry = sum(1 for it in items if it["is_carryover"])
    actual_recv = sum(round(it["subtotal"] * 0.85) for it in items)

    values_lines = ",\n".join(format_values_row(it) for it in items)

    sql = f"""-- ad-hoc_2026-07-20_backfill_remit_items_{label}.sql
-- 2026-07-20 — 자동 생성 (scripts/gen-backfill-remit-items-sql.py)
--
-- 소급 대상: {label} 확정 주차 (usol_n, week_start={week_start}, week_end={week_end})
-- 엑셀 소스: {target['pattern']}
--
-- 엑셀 파싱 결과:
--   · 총 건수: {actual_count} (기대: {expected_count})
--   · 이월 건수: {actual_carry} (기대: {expected_carry})
--   · Σ ROUND(subtotal × 0.85): {actual_recv:,} (기대: {expected_recv:,})
--
-- 처리 (임시 테이블 방식):
--   1. remit_id 조회 (usol_n · week_start · confirmed)
--   2. _excel_rows 임시 테이블에 엑셀 items INSERT
--   3. _matched 임시 테이블 = LEFT JOIN task_items (매칭 성공/실패 함께 보존)
--   4. 매칭 실패 리포트 — FOR 루프로 poid · buyer · subtotal RAISE NOTICE 각 행 출력
--   5. principal_weekly_remit_items INSERT (매칭 성공만)
--   6. snapshot_item_count = {actual_count} UPDATE (매칭 실패해도 사장님 값 유지)
--   7. company_received_at 스탬프 (스냅샷 items 중 NULL만)
--   8. 최종 요약 리포트
--
-- 실행:
--   BEGIN;
--   \\i ad-hoc_2026-07-20_backfill_remit_items_{label}.sql
--   -- 리포트 확인 후 COMMIT (문제 시 ROLLBACK)
--   COMMIT;

BEGIN;

DO $$
DECLARE
  v_pid            uuid;
  v_remit_id       uuid;
  v_confirmed_at   timestamptz;
  v_snapshot_count int;
  v_stamped_count  int;
  v_missing_count  int;
  r RECORD;
BEGIN
  SELECT id INTO v_pid FROM principals WHERE code = 'usol_n';
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'principal usol_n 없음';
  END IF;

  SELECT id, confirmed_at INTO v_remit_id, v_confirmed_at
    FROM principal_weekly_remittances
   WHERE principal_id = v_pid
     AND week_start = DATE '{week_start}'
     AND confirmed_at IS NOT NULL;
  IF v_remit_id IS NULL THEN
    RAISE EXCEPTION '{week_start} 확정 remit row 없음 (미확정 or 없음)';
  END IF;

  -- (2) 엑셀 items → 임시 테이블
  CREATE TEMP TABLE _excel_rows (
    product_order_id text,
    buyer_name       text,
    subtotal         int,
    is_carryover     boolean,
    carry_monday     date
  ) ON COMMIT DROP;

  INSERT INTO _excel_rows (product_order_id, buyer_name, subtotal, is_carryover, carry_monday)
  VALUES
{values_lines};

  -- (3) 매칭 — LEFT JOIN 결과 임시 보존 (매칭 실패도 포함)
  CREATE TEMP TABLE _matched ON COMMIT DROP AS
  SELECT
    e.product_order_id,
    e.buyer_name,
    e.subtotal,
    e.is_carryover,
    e.carry_monday,
    ti.id                     AS task_item_id,
    ti.tenant_id,
    ti.naver_settled_at,
    ti.company_received_at,
    t.customer_name           AS db_customer_name,
    t.principal_id,
    t.status                  AS task_status,
    ti.is_canceled            AS ti_canceled
  FROM _excel_rows e
  LEFT JOIN task_items ti ON ti.product_order_id = e.product_order_id::text
  LEFT JOIN tasks       t ON t.id = ti.task_id;

  -- (4) 매칭 실패 상세 리포트 — 각 행 poid · buyer · subtotal · task_status · 스탬프 여부 · 사유
  --     사장님 개별 처리 판단용 (취소분 vs 주문번호 변경분 구분).
  FOR r IN
    SELECT product_order_id, buyer_name, subtotal,
           task_item_id, principal_id, task_status, ti_canceled, company_received_at,
           CASE
             WHEN task_item_id IS NULL          THEN 'task_items 없음 (주문번호 변경 or 삭제)'
             WHEN principal_id != v_pid          THEN 'principal 불일치 (다른 원청)'
             WHEN task_status = '취소'           THEN 'tasks.status=취소 (확정 후 취소)'
             WHEN COALESCE(ti_canceled, false)   THEN 'task_items.is_canceled=true'
             ELSE '기타'
           END AS reason
      FROM _matched
     WHERE task_item_id IS NULL OR principal_id != v_pid
        OR task_status = '취소' OR COALESCE(ti_canceled, false)
     ORDER BY product_order_id
  LOOP
    RAISE NOTICE '[missing] poid=% buyer=% subtotal=% task_status=% stamped=% reason=%',
      r.product_order_id,
      r.buyer_name,
      r.subtotal,
      COALESCE(r.task_status, '(N/A)'),
      CASE WHEN r.company_received_at IS NULL THEN 'NO' ELSE r.company_received_at::text END,
      r.reason;
  END LOOP;

  SELECT count(*) INTO v_missing_count FROM _matched
   WHERE task_item_id IS NULL OR principal_id != v_pid
      OR task_status = '취소' OR COALESCE(ti_canceled, false);

  -- (5) 스냅샷 INSERT (매칭 성공 + usol_n 소속 + 취소 아닌 것만)
  WITH inserted AS (
    INSERT INTO principal_weekly_remit_items (
      tenant_id, remit_id, task_item_id,
      subtotal, net_amount, company_receive_amount,
      is_carryover, carryover_source_monday,
      naver_settled_at, captured_at
    )
    SELECT
      m.tenant_id, v_remit_id, m.task_item_id,
      m.subtotal, NULL,
      ROUND(m.subtotal::numeric * 0.85)::int,
      m.is_carryover, m.carry_monday,
      m.naver_settled_at, v_confirmed_at
    FROM _matched m
    WHERE m.task_item_id IS NOT NULL
      AND m.principal_id = v_pid
      AND m.task_status != '취소'
      AND COALESCE(m.ti_canceled, false) = false
    ON CONFLICT (remit_id, task_item_id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_snapshot_count FROM inserted;

  -- (6) 요약 스냅샷: 엑셀 원본 건수 (매칭 실패해도 사장님 값 유지)
  UPDATE principal_weekly_remittances
     SET snapshot_item_count = {actual_count}
   WHERE id = v_remit_id;

  -- (7) company_received_at 스탬프 (스냅샷 items, NULL 만)
  WITH stamped AS (
    UPDATE task_items ti
       SET company_received_at = v_confirmed_at
     WHERE ti.id IN (
       SELECT ri.task_item_id FROM principal_weekly_remit_items ri
        WHERE ri.remit_id = v_remit_id
     )
       AND ti.company_received_at IS NULL
    RETURNING ti.id
  )
  SELECT count(*) INTO v_stamped_count FROM stamped;

  RAISE NOTICE '[backfill {label}] remit_id=% snapshot_inserted=% missing=% stamped=% snapshot_item_count={actual_count}',
    v_remit_id, v_snapshot_count, v_missing_count, v_stamped_count;
END $$;

-- ============================================================================
-- 검증 SQL (COMMIT 전 실행)
-- ============================================================================
--
-- [1] 스냅샷 대조
-- SELECT
--   count(*) AS cnt,
--   sum(company_receive_amount) AS sum_recv,
--   sum(CASE WHEN is_carryover THEN 1 ELSE 0 END) AS carry_cnt
--   FROM principal_weekly_remit_items
--  WHERE remit_id = (
--    SELECT id FROM principal_weekly_remittances
--     WHERE principal_id = (SELECT id FROM principals WHERE code='usol_n')
--       AND week_start = DATE '{week_start}'
--  );
-- 기대: cnt=? sum_recv={expected_recv:,} carry_cnt={expected_carry}
--
-- [2] snapshot_item_count 확인
-- SELECT snapshot_item_count FROM principal_weekly_remittances
--  WHERE principal_id = (SELECT id FROM principals WHERE code='usol_n')
--    AND week_start = DATE '{week_start}';
-- 기대: {actual_count}
--
-- [3] 스탬프 확인 — 이월 소멸 검증 (다음 미확정 주차 이월 재계산)
-- WITH usoln AS (SELECT id AS pid FROM principals WHERE code='usol_n')
-- SELECT count(*), sum(ti.subtotal)
--   FROM task_items ti JOIN tasks t ON ti.task_id = t.id
--  WHERE t.principal_id = (SELECT pid FROM usoln)
--    AND t.status = '완료'
--    AND ti.naver_settled_at IS NOT NULL
--    AND ti.company_received_at IS NULL
--    AND (ti.naver_settled_at AT TIME ZONE 'Asia/Seoul')::date <= DATE '{week_end}'
--    AND COALESCE(ti.is_canceled, false) = false
--    AND ti.subtotal > 0
--    AND EXISTS (SELECT 1 FROM payments p WHERE p.task_id = t.id AND p.track = 'B');
-- 기대: 매칭 실패분 (v_missing_count) 근접. 0 이면 완전 소멸.

-- 이상 없으면:
COMMIT;
-- 문제 시:
-- ROLLBACK;
"""
    out_path = os.path.join(OUT_DIR, f"ad-hoc_2026-07-20_backfill_remit_items_{label}.sql")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(sql)
    return out_path, actual_count, actual_carry, actual_recv

def main():
    for target in TARGETS:
        matches = glob.glob(os.path.join(DOWNLOADS, target["pattern"]))
        if not matches:
            print(f"[skip] {target['label']}: file not found ({target['pattern']})", file=sys.stderr)
            continue
        path = matches[0]
        items = load_excel(path)
        out_path, cnt, carry, recv = emit_sql(target, items)
        exp_cnt = target["expected_count"]
        exp_carry = target["expected_carryover_count"]
        exp_recv = target["expected_company_receive"]
        status = "OK" if (cnt == exp_cnt and carry == exp_carry) else "MISMATCH"
        recv_status = "OK" if recv == exp_recv else f"DIFF({recv - exp_recv:+d})"
        print(f"[{status}] {target['label']}: count={cnt}/{exp_cnt} carry={carry}/{exp_carry} recv={recv:,}/{exp_recv:,} {recv_status}")
        print(f"        emitted: {out_path}")

if __name__ == "__main__":
    main()
