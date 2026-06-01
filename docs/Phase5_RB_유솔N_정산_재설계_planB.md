# Phase 5 R-B — usol_n 정산 탭 재설계 (시트 졸업)

**작성**: 2026-06-01 / **승인 대기**: 사장님 Q1·Q2 답변 후 본 구현 착수

---

## 🎯 목표
시트 졸업. 운영자 화면에서 `유솔→회사` / `회사→기사` / `회사 순이익` 자동 확인.
5월+ = 앱 데이터 자동, 4월 = 일회성 고정값.

---

## 🔒 잠긴 결정 (Say-once)

| # | 결정 |
|---|---|
| **D1** | ① **유솔→회사** = 받은 현금 기준, 주차(월~일) 단위 |
| **D2** | **4월 작업분** = 자동 계산 X. 상수 `APR_SETTLED_FIXED = 35_048_310` (6/1자 일괄 마감, 일회성). 화면 한 줄. |
| **D3** | **5월+ 작업분** = `Σ(net_amount × 0.85)` (정산완료된 task_item, KST 변환된 `naver_settled_at` 주차). |
| **D4** | ② **회사→기사** = `compute_engineer_amount_per_item_batch` RPC 합산 (정책 인코딩됨). net_amount 직접 분배 금지. |
| **D5** | **1차** (매월 15일) / **2차** (매월 말일). 현재 전액 1차, 2차 ₩0. |
| **D6** | ★ **회사 순이익(ym)** = `(그 달 작업 전체 실입금) − (그 달 기사 총 지급)`<br>· 작업 전체 = `naver_settled_at` NULL 포함 (작업월 = task.completed_at KST 기준)<br>· 실입금 = `net_amount × 0.85`<br>· "받은 돈 − 기사 지급" 사과/오렌지 비교 금지 |
| **D7** | 기사 PWA 노출 절대 X: 회사 순이익 / 원청 수수료 / 판매가. 운영자 화면 전용. |
| **D8** | UTC↔KST: 모든 날짜 비교/그룹핑 `toKstYmd()`. `.slice(0,10)` 금지. |
| **D9** | 색 — `#D4537E` (5월/1차/핵심), 회색 계열 (4월/2차/보조). |
| **D10** | 시안 `usoln_yusol_to_company_apr_may_split` "5월 흐름 = 받음 − 기사 − 회사수익" 줄 **삭제** (순이익은 ② 쪽 D6 공식). |
| **D11** | 상품주문번호 매칭 = `Math.floor(id/10)` (이미 적용). 취소 task 제외 (이미 적용). |

---

## ✅ Q1 — 결정 (2026-06-01)

**현금 주문 = 일정산 트랙 → ① 유솔→회사 & 회사 순이익에서 제외.**
네이버 정산분만 집계.

식별 룰 (잠정):
- 네이버 트랙 = `product_order_id IS NOT NULL` (Naver 매칭된 task_item)
- 일정산 트랙 = `product_order_id IS NULL` (현금 / 냉매 등)
- (정확한 식별 룰은 진단 SQL 결과 검토 후 확정)

영향:
- ① 주차별 합계 = naver 트랙만 (`naver_settled_at` 그 주, `product_order_id` 있음).
- D6 순이익 작업 전체 실입금 = naver 트랙 task_item 만 (NULL `naver_settled_at` 포함).

---

## 🔍 Q2 — 진단 SQL 결과 검토 후 결정

A/B/C 옵션 묻지 말고 데이터부터 본다.

### 진단 SQL (Supabase SQL Editor 직접 실행)

```sql
-- 5월 KST 완료 usol_n tasks 의 task_items net_amount 분포
WITH may_tasks AS (
  SELECT id, task_no
  FROM tasks
  WHERE tenant_id    = '11111111-1111-1111-1111-111111111111'
    AND principal_id = '22222222-2222-2222-2222-222222222006'
    AND status       = '완료'
    AND completed_at >= '2026-04-30 15:00:00+00'   -- KST 2026-05-01 00:00
    AND completed_at <  '2026-05-31 15:00:00+00'   -- KST 2026-06-01 00:00
),
labeled AS (
  SELECT ti.id, ti.net_amount, ti.is_canceled, ti.product_order_id,
         CASE
           WHEN t.task_no LIKE 'YS-N-260%' THEN '신 (YS-N-260xxx)'
           WHEN t.task_no LIKE 'YS-260%'   THEN '구 (YS-260xxx)'
           ELSE '기타'
         END AS fmt,
         CASE
           WHEN ti.net_amount IS NULL THEN 'NULL'
           WHEN ti.net_amount = 0     THEN 'ZERO'
           ELSE 'POSITIVE'
         END AS net_status
  FROM task_items ti
  JOIN may_tasks t ON t.id = ti.task_id
)
SELECT fmt,
       net_status,
       COUNT(*)                                       AS cnt,
       COALESCE(SUM(net_amount), 0)                   AS sum_net,
       ROUND(COALESCE(SUM(net_amount), 0) * 0.85)     AS sum_x085,
       COUNT(*) FILTER (WHERE product_order_id IS NOT NULL) AS naver_cnt,
       COUNT(*) FILTER (WHERE product_order_id IS NULL)     AS cash_cnt,
       COUNT(*) FILTER (WHERE is_canceled = true)           AS canceled_cnt
FROM labeled
GROUP BY fmt, net_status
ORDER BY fmt, net_status;
```

추가 — Naver/일정산 트랙 분리 합계:
```sql
WITH may_tasks AS (
  SELECT id, task_no FROM tasks
  WHERE tenant_id    = '11111111-1111-1111-1111-111111111111'
    AND principal_id = '22222222-2222-2222-2222-222222222006'
    AND status       = '완료'
    AND completed_at >= '2026-04-30 15:00:00+00'
    AND completed_at <  '2026-05-31 15:00:00+00'
)
SELECT
  CASE WHEN ti.product_order_id IS NOT NULL THEN 'naver' ELSE 'cash' END AS track,
  COUNT(*)                                            AS cnt,
  COALESCE(SUM(ti.net_amount), 0)                     AS sum_net,
  ROUND(COALESCE(SUM(ti.net_amount), 0) * 0.85)       AS sum_x085
FROM task_items ti
JOIN may_tasks t ON t.id = ti.task_id
WHERE ti.is_canceled IS NOT TRUE
GROUP BY track
ORDER BY track;
```

→ 두 쿼리 결과 paste 측 Q2 룰 확정 + ① 주차별 / D6 순이익 합산식 최종화.

---

## 📋 구현 작업 순서

| 측 | 측측 | Q1/Q2 측측? |
|---|---|---|
| **S0** | 측측 측측 (측 측측) + Q1/Q2 측측 측측 | — |
| **S1** | **별건 — `unmark_tax_invoice` RPC 측측측** (lib 측측 + UI 측측 측측) | X (측측 측측) |
| **S2** | ② UsolNToEngineerSection 측측측 — 회사 순이익 측측 추가 (D6) | **Q1/Q2 측측 측측** |
| **S3** | ① UsolNToCompanySection 측측측 — 4월/5월 split + 주차 카드 (시안 측측) | **Q1 측측 측측** |
| **S4** | 측측 측측 (§7) — 사장님 측측 측측 |

---

## 🚧 측측 측측 측측

- **C1**: 측측 측측 측측 측측 측측 측측 (운영자 측측, 코드 측 변경 X).
- **C2**: `unmark_tax_invoice` RPC 측측 측측 측측 측측 (lib wrapper 측측 측측 측측 X) — 사장님 측측 측측.

---

## 🚫 박-검사

측 측측 측측 측측측 `박` 측측 grep — 0건 (자가 검토).
