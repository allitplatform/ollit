# Round 1 부분취소 모델 — 적용 가이드

**작성**: 2026-05-25
**대상**: 069b → 070 → 071 → 072 (4단계)
**환경**: Supabase 콘솔 → SQL Editor
**실행자**: 사장님 (Claude Code는 결과 보고 받고 다음 판단)

---

## 개요

| # | 마이그레이션 | 한줄 요약 |
|---|---|---|
| 1 | `069b_sync_workitems_changed_only.sql` | sync 트리거 — workItems 변경 시만 발화 (가드 강화) |
| 2 | `070_task_items_cancel_flag.sql` | task_items.is_canceled 컬럼 + subtotal 재정의 + 동기 트리거 2개 |
| 3 | `071_compute_payment_v15_is_canceled.sql` | compute_payment v15 + per_item v2 (미취소만 합산) |
| 4 | `072_backfill_partial_cancel.sql` | 안효정 1건 백필 (qty=1 + is_canceled=true) |

각 단계: **파일 통째 붙여넣기 → Run → 검증 SELECT 복붙 → 기대 결과 확인 → 다음 단계**.

검증 실패 시: 본 가이드 하단의 ROLLBACK 절차 참조.

---

## 단계 1 — 069b 적용

### 적용
파일: `db/migrations/069b_sync_workitems_changed_only.sql`
→ 전체 복사 → SQL Editor 붙여넣기 → **Run**

### 검증 SELECT
```sql
-- 검증 1-A: 함수 코멘트에 '069b' 표기 확인
SELECT proname, obj_description(oid, 'pg_proc') AS comment
FROM pg_proc
WHERE proname = 'sync_category_data_to_task_items';

-- 검증 1-B: 트리거 정의 그대로인지 확인 (069 시점과 동일해야)
SELECT trigger_name, event_manipulation, action_timing, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'sync_task_items_trg'
ORDER BY event_manipulation;
```

### 기대 결과
- **1-A**: 1 row. `comment` 컬럼에 `069b 가드 강화` 문자열 포함.
- **1-B**: 2 row (INSERT, UPDATE) 또는 1 row (BEFORE INSERT/UPDATE 통합 형식). `event_object_table = tasks`.

---

## 단계 2 — 070 적용

### 적용
파일: `db/migrations/070_task_items_cancel_flag.sql`
→ 전체 복사 → SQL Editor 붙여넣기 → **Run**

### 검증 SELECT
```sql
-- 검증 2-A: task_items 신규 컬럼 4개 확인 (is_canceled / canceled_reason / canceled_at / subtotal)
SELECT column_name, data_type, is_nullable, column_default, is_generated
FROM information_schema.columns
WHERE table_name = 'task_items'
  AND column_name IN ('is_canceled', 'canceled_reason', 'canceled_at', 'subtotal')
ORDER BY column_name;

-- 검증 2-B: 새 트리거 2개 등록 확인
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname IN ('task_items_partial_sync_before_trg', 'task_items_resync_task_total_trg')
ORDER BY tgname;

-- 검증 2-C: subtotal CASE 식 동작 확인 (안효정 task 측 4way qty=0 항목 subtotal=0)
SELECT ti.id, ti.qty, ti.unit_price, ti.subtotal, ti.is_canceled
FROM task_items ti
JOIN tasks t ON t.id = ti.task_id
WHERE t.task_no = 'YS-260517-079'
ORDER BY ti.id;
```

### 기대 결과
- **2-A**: 4 row.
  - `is_canceled` : boolean / NO / `false` / NEVER
  - `canceled_reason` : text / YES / NULL / NEVER
  - `canceled_at` : timestamp with time zone / YES / NULL / NEVER
  - `subtotal` : integer / YES / NULL / **ALWAYS**
- **2-B**: 2 row. `tgenabled = O` (enabled).
- **2-C**: 2 row. 4way 항목 → qty=0 / subtotal=0 / is_canceled=false (백필 전).
  벽걸이 항목 → qty=1 / subtotal=69412 / is_canceled=false.

---

## 단계 3 — 071 적용

### 적용
파일: `db/migrations/071_compute_payment_v15_is_canceled.sql`
→ 전체 복사 → SQL Editor 붙여넣기 → **Run**

### 검증 SELECT
```sql
-- 검증 3-A: 함수 코멘트 v15 / v2 표기 확인
SELECT proname, obj_description(oid, 'pg_proc') AS comment
FROM pg_proc
WHERE proname IN ('compute_payment', 'compute_engineer_amount_per_item')
ORDER BY proname;

-- 검증 3-B: 측 6 원청 회귀 0 확인 (랜덤 20건 — 재계산 전후 비교)
--   사전 스냅샷 → compute_payment 재호출 → 사후 비교.
--   본 검증은 사장님이 한 번에 통째 실행 가능 (CTE 측 묶음).
WITH sample AS (
  SELECT t.id
  FROM tasks t
  JOIN payments p ON p.task_id = t.id
  WHERE NOT EXISTS (
    SELECT 1 FROM task_items ti
    WHERE ti.task_id = t.id AND COALESCE(ti.is_canceled, false)
  )
  ORDER BY random()
  LIMIT 20
),
before_snap AS (
  SELECT task_id,
    engineer_amount  AS eng_b,
    principal_amount AS prin_b,
    owner_amount     AS own_b
  FROM payments
  WHERE task_id IN (SELECT id FROM sample)
),
recompute AS (
  SELECT compute_payment(id) AS pid FROM sample
),
after_snap AS (
  SELECT task_id,
    engineer_amount  AS eng_a,
    principal_amount AS prin_a,
    owner_amount     AS own_a
  FROM payments
  WHERE task_id IN (SELECT id FROM sample)
)
SELECT
  s.id,
  b.eng_b, a.eng_a,   (a.eng_a  - b.eng_b)  AS eng_diff,
  b.prin_b, a.prin_a, (a.prin_a - b.prin_b) AS prin_diff,
  b.own_b, a.own_a,   (a.own_a  - b.own_b)  AS own_diff
FROM sample s
LEFT JOIN before_snap b ON b.task_id = s.id
LEFT JOIN after_snap  a ON a.task_id = s.id;
```

### 기대 결과
- **3-A**: 2 row.
  - `compute_payment` comment 측 `v15 (Migration 071)` 문자열 포함.
  - `compute_engineer_amount_per_item` comment 측 `v2 (Migration 071)` 문자열 포함.
- **3-B**: 20 row. `eng_diff` / `prin_diff` / `own_diff` 모두 **0** (회귀 0).
  · 만약 0 아닌 row 있으면 그 task_id 보고. is_canceled 행 0건이라 v14·v15 동일이어야 함.

---

## 단계 4 — 072 적용 (안효정 백필)

### 적용
파일: `db/migrations/072_backfill_partial_cancel.sql`
→ 전체 복사 → SQL Editor 붙여넣기 → **Run**

⚠️ 072는 BEGIN ... COMMIT 트랜잭션이라 검증 SELECT는 COMMIT 후 별도 실행.
COMMIT 전에 검증하려면 072 본문 측 `COMMIT;` 을 `ROLLBACK; -- COMMIT;` 으로 임시 교체 후 Run → 결과 확인 → 통과 시 다시 COMMIT 로 바꿔 재실행.

### 검증 SELECT
```sql
-- 검증 4-A: 안효정 task_items 측 4way is_canceled=true / customer_paid·net=0 / metadata 백업
SELECT
  at.name AS appliance,
  ti.qty,
  ti.unit_price,
  ti.subtotal,
  ti.is_canceled,
  ti.canceled_reason,
  ti.customer_paid_amount,
  ti.net_amount,
  ti.metadata
FROM task_items ti
LEFT JOIN appliance_types at ON at.id = ti.appliance_type_id
JOIN tasks t ON t.id = ti.task_id
WHERE t.task_no = 'YS-260517-079'
ORDER BY ti.id;

-- 검증 4-B: 안효정 tasks 측 product_price·total_amount 재합산 확인
SELECT task_no, status, product_price, total_amount, partial_reason, partial_memo
FROM tasks
WHERE task_no = 'YS-260517-079';

-- 검증 4-C: 안효정 payments 측 재계산 확인
SELECT product_price, engineer_amount, principal_amount, owner_amount,
       calc_method, track, status
FROM payments
WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'YS-260517-079');

-- 검증 4-D: 운영 전체 회귀 — qty=0 행이 더 이상 없거나 모두 is_canceled=true
SELECT
  COUNT(*) FILTER (WHERE qty = 0)                         AS qty0_total,
  COUNT(*) FILTER (WHERE qty = 0 AND is_canceled = false) AS qty0_unmarked,
  COUNT(*) FILTER (WHERE is_canceled = true)              AS canceled_total
FROM task_items;
```

### 기대 결과
- **4-A**: 2 row.
  - 벽걸이: qty=1 / subtotal=69412 / is_canceled=**false** / customer_paid_amount=73500 / net_amount=69412.
  - 4way: qty=**1** (복구!) / subtotal=**0** (CASE 효과) / is_canceled=**true** / canceled_reason=`backfill_qty0` / customer_paid_amount=**0** / net_amount=**0** / metadata 측 `_pre_cancel_paid`=126100, `_pre_cancel_net`=119086.
- **4-B**: 1 row. product_price=**69412** / total_amount=**69412** (GENERATED) / partial_reason=`device_bad` / partial_memo 유지.
- **4-C**: 1 row. product_price=**69412** / engineer_amount=**44000** / principal_amount=**10412** / owner_amount=**15000** / calc_method=`usol_n_본작업` / track=`B`.
- **4-D**: 1 row. `qty0_total`=0 (안효정 4way 복구로 0) / `qty0_unmarked`=0 / `canceled_total`=1.

---

## 4단계 모두 통과 시
Claude Code에게 결과 보고 → 069b/070/071/072 + 진단 스크립트 git 커밋 + 프론트 Round 1 잔여 (TaskPartialScreen / 3곳 매핑 / 작업상세 취소 배지) 착수.

⚠️ **시간 압박**: 마이그 적용 직후 곧바로 프론트 진행. 그 사이 새 부분완료가 옛 qty=0 경로로 들어가면 같은 '반쪽 반영'이 잠깐 재현됩니다.

---

## ROLLBACK 절차 (단계별)

검증 실패 1건이라도 발생 시 즉시 중단 후 다음 절차.

### 069b 롤백 — 069 본문 재적용
파일 `db/migrations/069_sync_task_items_trg_safe.sql` 의 `CREATE OR REPLACE FUNCTION sync_category_data_to_task_items()` 본문(BEGIN ... COMMIT 블록)을 복사 → Run.
→ 함수 본문 069 상태로 원복. 트리거 정의 무수정.

### 070 롤백
070은 BEGIN ... COMMIT 트랜잭션이라 Run 즉시 COMMIT됨. 사후 롤백 SQL:
```sql
BEGIN;

-- (1) 새 트리거 제거
DROP TRIGGER IF EXISTS task_items_resync_task_total_trg ON task_items;
DROP TRIGGER IF EXISTS task_items_partial_sync_before_trg ON task_items;
DROP FUNCTION IF EXISTS trigger_task_items_resync_task_total();
DROP FUNCTION IF EXISTS trigger_task_items_partial_sync_before();

-- (2) subtotal CASE 식 → 옛 식 복원
ALTER TABLE task_items DROP COLUMN IF EXISTS subtotal;
ALTER TABLE task_items
  ADD COLUMN subtotal int GENERATED ALWAYS AS ((qty * unit_price)::int) STORED;

-- (3) is_canceled / canceled_reason / canceled_at 제거
ALTER TABLE task_items
  DROP COLUMN IF EXISTS is_canceled,
  DROP COLUMN IF EXISTS canceled_reason,
  DROP COLUMN IF EXISTS canceled_at;

COMMIT;
```

### 071 롤백 — 050 / 065 본문 재적용
- `db/migrations/050_refrigerant_rate_apply.sql` 의 `CREATE OR REPLACE FUNCTION compute_payment ...` 블록 복사 → Run.
- `db/migrations/065_compute_engineer_amount_per_item.sql` 의 `CREATE OR REPLACE FUNCTION compute_engineer_amount_per_item ...` 블록 복사 → Run.
→ 두 함수 v14 / v1 상태로 원복.

### 072 롤백 — 안효정 task 원복
```sql
BEGIN;

UPDATE task_items
SET
  qty             = 0,
  is_canceled     = false,
  canceled_reason = NULL,
  canceled_at     = NULL,
  customer_paid_amount = 126100,
  net_amount           = 119086,
  metadata = (metadata - '_pre_cancel_paid' - '_pre_cancel_net')
WHERE task_id = (SELECT id FROM tasks WHERE task_no = 'YS-260517-079')
  AND unit_price = 119086;

-- product_price 옛 값 복원 (resync 트리거 발화하지만 가드 통과로 변경 발생)
UPDATE tasks SET product_price = 188498 WHERE task_no = 'YS-260517-079';

-- payments 재계산
SELECT compute_payment(id) FROM tasks WHERE task_no = 'YS-260517-079';

-- 검증
SELECT product_price, total_amount FROM tasks WHERE task_no = 'YS-260517-079';
-- 기대: 188498 / 188498

COMMIT;
```

---

## 진행 신호 표

각 단계 실행 후 Claude에게 보고할 양식:

```
단계 N (069b / 070 / 071 / 072):
  · 적용: OK / 실패 (오류 메시지: ...)
  · 검증 N-A: PASS / FAIL (...)
  · 검증 N-B: PASS / FAIL (...)
  · 다음 단계 진행 / 중단·롤백 요청
```

4단계 모두 통과 보고 → Claude가 git 커밋 + 프론트 Round 1 잔여 착수.
