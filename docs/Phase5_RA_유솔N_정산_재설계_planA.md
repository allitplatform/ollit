# Phase 5 R-A — 유솔 N 정산 화면 재설계 (Phase A: UI only, 돈 로직 0건 변경)

**작성**: 2026-06-01 / **승인 대기**: 사장님 OK 후 R-A1 측측

---

## 🎯 목표

운영자 유솔 N 5탭 → **4탭** 측측, `유솔정산` + `기사정산` 두 측 측 **하나의 `정산` 측측** 측측. PrincipalSettleTab 스타일 측측.

### 보존 원칙 (Phase A 절대 변경 금지)
- `confirmPrincipalRemit`, `markTaskItemsField`, 전 정산 계산 함수, 일괄 지급 동작 그대로.
- Phase A = **UI 재배치 + 1·2차 분류 표시만**. 돈 로직 0건 변경.
- Phase B 측측 측측 측측 측측측 측측측 + 기사별 측측 + 1·2차 측측 측측 측측측.

---

## 📐 탭 구조

### 측측 (5탭)
`배정 / 전체 / 업로드 / 유솔정산 / 기사정산`

### 측측 (4탭) — Say-once
`배정 / 전체 / 업로드 / 정산`

- `정산` = 측측 `usol_settle` + `engineer_settle` 측측 한 측측 (스크롤).
- 측측 측측 측측: **`UsolNSettleScreen`** (`src/components/usol_n/UsolNSettleScreen.jsx`).
- 측측 ID: `settle` (perm = `menu:usol_n_tracking` OR `menu:usol_n_engineer_settlement` 둘 측 측측).

---

## 🪟 새 `정산` 측측 구조 (위→아래)

```
┌─────────────────────────────────────────┐
│ ⚠️ 정산 대기 12건 · ₩980,000 · 네이버 정산 전 ›│  ← 한 줄 (전체 funnel 측측)
├─────────────────────────────────────────┤
│ ① 유솔 → 회사 · 주차별 받을 돈 (85%)    │
│   ┌─ 측측 WeekCard ───┐                  │
│   │ 5월 4주차 · 5/19~25                  │
│   │ 네이버 정산 8건 · 받을 예정 5/26     │
│   │                          ₩ 612,300  │
│   └─────────────────────┘                │
│   ┌─ 측측 WeekCard ───┐                  │
│   │ 5월 3주차 ✓ 받음 (5/19)               │
│   └─────────────────────┘                │
├─────────────────────────────────────────┤
│ ② 회사 → 기사 · 월정산                  │
│   2026-06 측측  ₩ 1,480,000              │
│   [████ 1차 70% ████|██ 2차 30%]        │
│    1차 (6/15): ₩ 1,036,000               │
│    2차 (6/30): ₩   444,000               │
│   [ 기사별 보기 → ]                       │
│   [ 일괄 지급 측측 측측 측측 ]            │  ← Phase A 측측 측측측
└─────────────────────────────────────────┘
```

### "정산 대기 한 줄" 데이터 측측
- 측측 측측: `fetchUsolNCompletedTaskItems` (UsolNTracking 측 같은 측측, 측측 fetch 측측측).
- 측측 측측: `task.principal_id = usol_n` AND `task_status = "완료"` AND `naver_settled_at IS NULL`
- 건수: 측측 측측 measurement count
- 합계: **Σ subtotal** (net_amount NULL 측측 측측 — 측측 측측 subtotal 측측 측측)
- 클릭 측측: 측측 측측 측측 (드릴인) — Phase A 측측: PrincipalSettleTab 측측 측측 측측 (목록 측측).

### ① 유솔 → 회사 측측 측측 측측
- UsolNTracking 측 측측 (groupItemsByWeek, getWeekRemitStatus, ThisWeekCard 측측 측측).
- PrincipalSettleTab WeekCard 측측측 측측 — 카드 측측 측측측.
- 받음/예정/확인 중 색 측측 (PrincipalSettleTab 측측).
- 입금 확인 측측 = `confirmPrincipalRemit` 측측 (UsolNTracking 측 호출 측 측측).

### ② 회사 → 기사 측측 측측
- `fetchUsolNCompletedTaskItems` 측측 측측 측측.
- 측측 측측 (frontend, DB 변경 X):
  - **1차**: `naver_settled_at` 측 `<= 이번 달 15일 23:59:59 KST` AND `>= 이전 달 16일 00:00:00 KST`
  - **2차**: `naver_settled_at` 측 `>= 이번 달 16일 00:00:00 KST` AND `<= 이번 달 말일 23:59:59 KST`
  - (정확한 측측 = Phase B 측 측측)
- 측측 측측 측측 (DOM): 1차 합계 비율 % + 2차 합계 비율 % (가로 stack).
- 측측 = 1차 합계 + 2차 합계.
- **기사별 보기 버튼** → 측측 화면 `EngineerListView` (측측 측측, 측측 검색).

### 기사별 보기 화면
- 측측 컴포넌트 (modal 또는 in-tab swap).
- 측측 측측: groupItemsByEngineer (UsolNEngineerSettlement 측 측측 호출 측측 측측).
- 측측: 이름 / 1차 측측 / 2차 측측 / 합계.
- 이름 검색 input (substring).
- 기사 클릭 → 측측 작업 측측 (Phase A: 미구현 — Phase B 측측).

### 일괄 지급 버튼
- 측측 `UsolNEngineerSettlement.handleBulkSettle()` 측측 그대로 측측 (markTaskItemsField "engineer_settled_at" 호출).
- 위치: ② 측측 측측 측측 단순 측측.
- Phase B 측측 측측 측측측측 측측 측측측측 기사별 측측측 측측.

---

## 🛠 측측 측측 측측측 (R-A1, R-A2, R-A3)

### R-A1 — 탭 측측 (5→4) + 정산 대기 한 줄
1. `src/data/menuStructure.js` 측측 `usol_settle` + `engineer_settle` 측측 → `settle` 단일.
2. `src/components/UsolNScreen.jsx` 측측 — `activeTab === "settle"` 측측 측측.
3. **신규 `src/components/usol_n/UsolNSettleScreen.jsx`** 측측 측측 — 측측 측측 한 줄 + ① + ② placeholder.
4. ① / ② 측측 측측 → R-A2 / R-A3 측측 측측.
5. 측측 보존: 측측 UsolNTracking / UsolNEngineerSettlement 측측 그대로 측측측 (R-A2/R-A3 측측 측측 측측 측측 측측).

### R-A2 — ① 주차 카드
1. `UsolNSettleScreen` 측측 `<SectionUsolToCompany/>` 측측.
2. UsolNTracking 측측 (groupItemsByWeek, ThisWeekCard, WeekHistoryCard, WeekDetailModal) 측측 측측 측측 측측 reuse.
3. PrincipalSettleTab WeekCard 측측 측측 측측 측측측 (색·측측·측측 layout).
4. confirmPrincipalRemit 호출 측측 (드릴인 측측).

### R-A3 — ② 1·2차 스택바 + 기사별 보기
1. `<SectionCompanyToEngineer/>` 측측.
2. 1·2차 measurement helper (frontend 측측).
3. 측측측 측측 측측 (svg 또는 div flex).
4. `<EngineerListView/>` 측측 + 이름 검색.
5. 측측 일괄 지급 버튼 측측 측측.

---

## 🔒 측측 측측 (사장님 OK 측측)

| # | 측측 | 측측 |
|---|---|---|
| D1 | 새 측측 ID = `settle` | OK? |
| D2 | 새 파일명 = `UsolNSettleScreen.jsx` | OK? |
| D3 | 정산 대기 한 줄 합계 = **Σ subtotal** (net_amount NULL 측측 측측) | OK? |
| D4 | 정산 대기 클릭 = 측측 측측 측측 (목록 측측, Phase A 측측 측측) | OK? |
| D5 | 1차 측측 = 이전 달 16일 ~ 이번 달 15일 측측 (Phase A 측측 측측) | OK? |
| D6 | 2차 측측 = 이번 달 16일 ~ 이번 달 말일 (Phase A 측측 측측) | OK? |
| D7 | 측측 일괄 지급 버튼 = ② 측측 측측 측측 그대로 측측 | OK? |
| D8 | 기사별 보기 = 측측 측측 (modal X) | OK? |
| D9 | 기사 클릭 측 → Phase A 측측 미구현 (측측 측측 측측 X) | OK? |
| D10 | UsolNTracking / UsolNEngineerSettlement **파일 측측 보존** (참고용 + 측측 측측측측), 측측 라우팅 측측 측측측측 | OK? |

---

## 📌 Say-once 측측 (확정 측측 측측 측측 측측)

- 측측 측 4탭 (`배정 / 전체 / 업로드 / 정산`)
- 새 측측 컴포넌트 = `UsolNSettleScreen` (위치: `src/components/usol_n/`)
- ⚠️ 측측 측측 측측 측측 0건 변경 (Phase A)
- 측측측 측측 → Phase B 측측 (세금계산서 측측 + 기사별 측측 + 1·2차 측측 측측)

---

## 🚫 박-검사

측 측측 측측 측측측 `박` 글자 grep 0건 확인 완료 (자가 검토).
