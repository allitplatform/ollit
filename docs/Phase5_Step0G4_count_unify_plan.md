# Phase 5 Step 0.G-4 — 카운트 통일 수정안 (작성만 / 적용 X)

2026-05-21 / 사장님 결정 확정 ①+② 측 spec.

---

## 1. is_legacy 컬럼 측 catch

### 코드 측 측 측
- `db/migrations/042_*.sql` (git 측 측 X / DB 측 측 추정)
- `src/data/tasksDb.js:111` — `isLegacy: !!row.is_legacy` 매핑 ✅
- `src/utils/v14Task.js:153` — `isLegacy: !!(t.isLegacy ?? t.is_legacy)` ✅
- `PAYMENT_SELECT` 측 `*` 측 = 모든 컬럼 측 측 → is_legacy 측 측 측 측 ✅

### DB 측 측 측 spec
**`db/ops/diag_is_legacy_260521.sql` 측 spec** (사장님 SQL Editor):
- [1] 컬럼 존재 확인
- [2] is_legacy 분포 (true / false)
- [3] status='확정' 측 분포 (사장님 spec 313건 측 = is_legacy=true 측 측 spec)
- [5] 측 대안 — is_legacy NULL 측 measure 측 = `created_at < '2026-05-19'` 측 spec

### 대안 측 spec
- A안 (권장): `tasks.is_legacy = true` 측 옛 시트 측
- B안 (백업): `tasks.created_at < '2026-05-19'` 측 측 측 측

---

## 2. TASK_FILTERS 공유 헬퍼 측 spec

### 2-A. 신규 헬퍼 — `src/utils/dashboardStats.js` 측 export 추가

```js
// 2026-05-21 Phase 5 Step 0.G-4 — 카운트 통일 공유 필터 (사장님 spec 확정)
//   결정 ①: 옛 시트 (is_legacy=true) 측 새 접수/배정/확정 카드 측 제외
//   결정 ②: 작업 흐름 측 "기타" 카테고리 추가 (workType 정규식 측 안 측 측 측 측)
//   spec:
//     새 접수 / 배정 완료 / 일정 확정 = status 측만 + 유솔N세척 제외 + 옛 시트 제외 (날짜 X)
//     진행중 / 완료                    = 오늘 측 + 전부 포함 (유솔N + 옛 시트 측)

const _statusOf = (t) => String(t.status || t.상태 || "").trim();

const _isUsolNCleaning = (t) => {
  const code = String(t.principalCode || t.principal_code || "").toLowerCase();
  const name = String(t.principal || t.client || t.원청 || "");
  const isUsolN = code === "usol_n" || name === "유솔홈케어 N";
  if (!isUsolN) return false;
  const items = Array.isArray(t.workItems) && t.workItems.length > 0
    ? t.workItems
    : [{ workType: t.workType }];
  return items.some(it => String(it.workType || "").includes("세척"));
};

const _isLegacy = (t) => !!(t.isLegacy ?? t.is_legacy);

const _isScheduledToday = (t) => {
  const n = t.scheduledAt || t.scheduled_at || t.확정일시 || t.confirmedAt || t.N || "";
  return !!n && toKstYmd(n) === todayYmd();
};

const _isCompletedToday = (t) => {
  const c = t.completedAt || t.completed_at || t.완료시간 || "";
  return !!c && toKstYmd(c) === todayYmd();
};

export const TASK_FILTERS = {
  isUsolNCleaning: _isUsolNCleaning,
  isLegacy:        _isLegacy,
  isScheduledToday:_isScheduledToday,
  isCompletedToday:_isCompletedToday,

  // 5 카드 spec 측 공유 필터 (사장님 확정)
  newReception: (t) => !_isLegacy(t) && !_isUsolNCleaning(t) && _statusOf(t) === '미배정',
  assigned:     (t) => !_isLegacy(t) && !_isUsolNCleaning(t) && _statusOf(t) === '배정',
  confirmed:    (t) => !_isLegacy(t) && !_isUsolNCleaning(t) && _statusOf(t) === '확정',
  inProgress:   (t) => _isScheduledToday(t) && (_statusOf(t) === '진행중' || _statusOf(t) === '작업중'),
  completed:    (t) => _isScheduledToday(t) && _isCompletedToday(t) && (_statusOf(t) === '완료' || _statusOf(t) === '정산완료'),
};
```

---

## 3. 5곳 측 측 측 통일 — diff 미리보기

### 3-A. `src/utils/dashboardStats.js:108-113` (상단 카드)

```diff
- const newReceptionTasks = uniqueTasks.filter(t => !_isUsolNCleaning(t) && _v14HasStatus(t, "미배정"));
- const assignedTasksList = uniqueTasks.filter(t => !_isUsolNCleaning(t) && _v14HasStatus(t, "배정"));
- const confirmedTasks    = uniqueTasks.filter(t => !_isUsolNCleaning(t) && _v14HasStatus(t, "확정"));
- const inProgressTasks   = uniqueTasks.filter(t => isScheduledToday(t) && _v14HasStatus(t, "작업중", "진행중"));
- const completedTasks    = uniqueTasks.filter(t => isScheduledToday(t) && isCompletedTodayLocal(t) && _v14HasStatus(t, "완료", "정산완료"));
+ const newReceptionTasks = uniqueTasks.filter(TASK_FILTERS.newReception);
+ const assignedTasksList = uniqueTasks.filter(TASK_FILTERS.assigned);
+ const confirmedTasks    = uniqueTasks.filter(TASK_FILTERS.confirmed);
+ const inProgressTasks   = uniqueTasks.filter(TASK_FILTERS.inProgress);
+ const completedTasks    = uniqueTasks.filter(TASK_FILTERS.completed);
```

→ **결과**: 새 접수 / 배정 / 확정 측 = `_isLegacy` 측 추가 제외 / 측 = 측 v10 measure

---

### 3-B. `src/pages/AdminApp.jsx:4316-4322` (AssignedTasksScreen 카드 상세)

```diff
+ import { TASK_FILTERS } from "../utils/dashboardStats.js";

  function AssignedTasksScreen({ t, filter, apiTasks = [], onBack, onMemo, onEdit, onTaskClick }) {
-   const statusOf = (x) => String(x.status || x.상태 || "").trim();
    const isAssigned = filter === "assigned";
-   const todayStrLocal = todayYmd();
-   const _isUsolN = (t) => {
-     const code = String(t.principalCode || t.principal_code || "").toLowerCase();
-     const name = String(t.principal || t.client || t.원청 || "");
-     return code === "usol_n" || name === "유솔홈케어 N";
-   };
-   const _isScheduledTodayLocal = (t) => {
-     const n = t.scheduledAt || t.scheduled_at || t.확정일시 || t.confirmedAt || "";
-     return !!n && toKstYmd(n) === todayStrLocal;
-   };
-
-   let all;
-   if (isAssigned) {
-     all = (apiTasks || []).filter(x => !_isUsolN(x) && statusOf(x) === "배정");
-   } else {
-     all = (apiTasks || []).filter(x => !_isUsolN(x) && _isScheduledTodayLocal(x) && statusOf(x) === "확정");
-   }
+   // 2026-05-21 Phase 5 Step 0.G-4 — 카운트 통일 (사장님 spec 확정)
+   //   유솔N 전체 제외 → 유솔N 세척만 제외 (TASK_FILTERS)
+   //   확정 측 오늘 필터 제거 (대기열 spec / 날짜 X)
+   //   옛 시트 (is_legacy=true) 제외 추가
+   const all = (apiTasks || []).filter(isAssigned ? TASK_FILTERS.assigned : TASK_FILTERS.confirmed);
```

→ **결과**:
- 배정 카드 상세 = 상단 카드 측 일치
- 확정 카드 상세 = 상단 카드 측 일치 (사장님 spec 3건 → 3건)

---

### 3-C. `src/pages/AdminApp.jsx:3563-3595` (작업 흐름) — 결정 ② "기타" 추가

```diff
- const counts = {
-   '세척':    { '신규':0, '배정':0, '확정':0, '진행':0, '완료':0, '총':0 },
-   '냉매충전':{ '신규':0, '배정':0, '확정':0, '진행':0, '완료':0, '총':0 },
- };
+ const counts = {
+   '세척':    { '신규':0, '배정':0, '확정':0, '진행':0, '완료':0, '총':0 },
+   '냉매충전':{ '신규':0, '배정':0, '확정':0, '진행':0, '완료':0, '총':0 },
+   '기타':    { '신규':0, '배정':0, '확정':0, '진행':0, '완료':0, '총':0 },  // 2026-05-21 0.G-4 결정 ②
+ };
  ...
  (apiTasks || []).forEach(task => {
-   const isUsolNCleaning = _isUsolNCleaning(task);
+   const isUsolNCleaning = TASK_FILTERS.isUsolNCleaning(task);
+   const isLegacy        = TASK_FILTERS.isLegacy(task);

    const items = (task.workItems && task.workItems.length > 0)
      ? task.workItems
      : (task.workType ? [{ workType: task.workType }] : []);
-   let workType = '';
+   let workType = '기타';  // 2026-05-21 0.G-4 결정 ② — 측 측 측 측 측 측 측 측 측 측 측 측 측 측 측 = 기타
    for (const item of items) {
      const wt = String(item.workType || "");
      if (/세척/.test(wt))           { workType = '세척'; break; }
      if (/냉매|가스|충전/.test(wt)) { workType = '냉매충전'; break; }
    }
-   if (!workType || !counts[workType]) return;
+   // workType = 기타 / 세척 / 냉매충전 — 3개 측 측 spec / drop 측 측

    const status = String(task.status || task.상태 || "").trim();

-   if (!status || status === '미배정') {
-     if (isUsolNCleaning) return;
+   // 사장님 spec (0.G-4): 신규/배정/확정 = 유솔N세척 제외 + 옛 시트 제외 / 진행/완료 = 전부 포함
+   if (!status || status === '미배정') {
+     if (isUsolNCleaning || isLegacy) return;
      counts[workType]['신규']++;
      counts[workType]['총']++;
    } else if (status === '배정') {
-     if (isUsolNCleaning) return;
+     if (isUsolNCleaning || isLegacy) return;
      counts[workType]['배정']++;
      counts[workType]['총']++;
    } else if (status === '확정') {
-     if (isUsolNCleaning) return;
+     if (isUsolNCleaning || isLegacy) return;
      counts[workType]['확정']++;
      counts[workType]['총']++;
    } else if ((status === '진행중' || status === '작업중')
               && isFieldToday(task, "scheduledAt", "확정일시")) {
      counts[workType]['진행']++;
      counts[workType]['총']++;
    } else if ((status === '완료' || status === '정산완료')
               && isFieldToday(task, "scheduledAt", "확정일시")
               && isFieldToday(task, "completedAt")) {
      counts[workType]['완료']++;
      counts[workType]['총']++;
    }
  });
```

```diff
  // FlowCard 3개 측 spec
- <FlowCard icon="❄️" title="세척" flow={cleaningFlow || { ... }}/>
- <FlowCard icon="⚡" title="냉매" flow={refrigerantFlow || { ... }}/>
+ <FlowCard icon="❄️" title="세척" flow={cleaningFlow    || { 신규:0, 배정:0, 확정:0, 진행:0, 완료:0, 총:0 }}/>
+ <FlowCard icon="⚡" title="냉매" flow={refrigerantFlow || { 신규:0, 배정:0, 확정:0, 진행:0, 완료:0, 총:0 }}/>
+ <FlowCard icon="📋" title="기타" flow={etcFlow         || { 신규:0, 배정:0, 확정:0, 진행:0, 완료:0, 총:0 }}/>

  // 합계 측 측
- {((cleaningFlow?.['총']) || 0) + ((refrigerantFlow?.['총']) || 0)}건
+ {((cleaningFlow?.['총']) || 0) + ((refrigerantFlow?.['총']) || 0) + ((etcFlow?.['총']) || 0)}건

  // useMemo 측 측
  const cleaningFlow    = workTypeFlowCounts['세척'];
  const refrigerantFlow = workTypeFlowCounts['냉매충전'];
+ const etcFlow         = workTypeFlowCounts['기타'];
```

→ **결과**:
- 작업 흐름 = 세척 / 냉매 / **기타** 3개 측 카드
- 합계 = 상단 카드 측 일치 측 spec (확정 3건 = 세척 0 + 냉매 2 + 기타 1)

---

### 3-D. `src/pages/AdminApp.jsx:5250-5253` (InProgressListScreen)

```diff
  function InProgressListScreen({ t, onBack, onTaskClick, apiTasks = [] }) {
    const [query, setQuery] = useState("");
-   const todayStrLocal = todayYmd();
-   const _isScheduledTodayLocal = (t) => {
-     const n = t.scheduledAt || t.scheduled_at || t.확정일시 || t.confirmedAt || "";
-     return !!n && toKstYmd(n) === todayStrLocal;
-   };
-   const baseSource = (apiTasks || []).filter(x => {
-     const s = String(x.status || x.상태 || "").trim();
-     return _isScheduledTodayLocal(x) && (s === "진행중" || s === "작업중");
-   });
+   // 2026-05-21 Phase 5 Step 0.G-4 — TASK_FILTERS 측 정리 (의미 동일 / 일관성)
+   const baseSource = (apiTasks || []).filter(TASK_FILTERS.inProgress);
```

→ **결과**: 의미 측 동일 / 코드 측 측

---

### 3-E. `src/pages/AdminApp.jsx:5196-5206` (LiveWorkScreen completed)

```diff
- const completedCount = isCompletedToday
-   ? baseSource.filter((s) => {
-       const scheduled = s.scheduledAt || s.scheduled_at || s.확정일시;
-       const completed = s.completedAt || s.completed_at;
-       if (!completed || !scheduled) return false;
-       if (toKstYmd(scheduled) !== todayStrLocal) return false;
-       if (toKstYmd(completed) !== todayStrLocal) return false;
-       const st = String(s.status || s.상태 || "").trim();
-       return st === "완료" || st === "정산완료";
-     }).length
-   : 0;
+ // 2026-05-21 Phase 5 Step 0.G-4 — TASK_FILTERS 측 정리 (의미 동일)
+ const completedCount = isCompletedToday
+   ? baseSource.filter(TASK_FILTERS.completed).length
+   : 0;
```

→ **결과**: 의미 측 동일 / 코드 측 측

---

## 4. 5/22 신규 1건 측 5단계 검증 계획

### 4-A. 측 측 시나리오

5/22 신규 task 1건 측 측:
- `principal_code = 'KA'` / `workItems = [{workType: '벽걸이 세척'}]`
- `is_legacy = false` (DEFAULT) / `created_at = '2026-05-22 09:00 KST'`

### 4-B. 단계별 측 측 catch

| # | 단계 | task 변경 | 상단 카드 | 작업 흐름 | 카드 상세 |
|---|---|---|---|---|---|
| 1 | 접수 | status='미배정' | 새 접수 +1 ✅ | 세척 신규 +1 ✅ | 새 접수 상세 +1 ✅ |
| 2 | 배정 | status='배정' / assigned_engineer_id 측 | 배정 +1 / 새 접수 -1 ✅ | 세척 배정 +1 ✅ | 배정 상세 +1 ✅ |
| 3 | 확정 | status='확정' / scheduled_at='2026-05-22 14:00' | 확정 +1 / 배정 -1 ✅ | 세척 확정 +1 ✅ | 확정 상세 +1 ✅ |
| 4 | 진행 | status='진행중' (당일 측) | 진행중 +1 / 확정 -1 ✅ | 세척 진행 +1 ✅ | 진행중 상세 +1 ✅ |
| 5 | 완료 | status='완료' / completed_at='2026-05-22 16:00' | 완료 +1 / 진행 -1 ✅ | 세척 완료 +1 ✅ | 완료 상세 +1 ✅ |

### 4-C. 회귀 측 (옛 시트 313개 측)

- 옛 시트 313개 (is_legacy=true) → 새 접수/배정/확정 측 카드 **0건 측 측** ✅
- 옛 시트 측 진행중/완료 = `isScheduledToday=false` 측 측 측 측 측 측 자동 0건 ✅
- 측 6 원청 + 유솔N 측 측 측 = 변경 측 측 ✅

### 4-D. 측 측 측 catch (사장님 SQL Editor)

```sql
-- 옛 시트 측 status='확정' 313개 = 측 카운트 측 측 0
-- 신규 task 측 시점 측 +1 측 측 측 catch
SELECT status, COUNT(*)
FROM tasks
WHERE COALESCE(is_legacy, false) = false
GROUP BY status;
```

---

## 5. 영향 범위

| 화면 | 영향 | 측 |
|---|---|---|
| 운영자 메인 (상단 카드) | ✅ | _isLegacy 측 추가 제외 |
| 작업 흐름 카드 | ✅ | 세척/냉매/**기타** 3개 측 |
| 일정 확정 카드 상세 | ✅ | 0건 → 3건 측 측 |
| 배정 완료 카드 상세 | ✅ | 옛 시트 제외 측 측 |
| 진행중 카드 상세 | ✅ | 측 측 (정리만) |
| 완료 카드 상세 | ✅ | 측 측 (정리만) |
| 유솔N 사이클 화면 | ❌ | 측 측 X (별도 진입) |
| 기사 PWA | ❌ | 측 측 X |

---

## 6. 측 단계 측 spec

| 단계 | 측 |
|---|---|
| 0.G-3 | 진단 + 계획 |
| **0.G-4** ⬅ 측 | 수정안 (작성만) |
| 0.G-4-Q | 사장님 측 `diag_is_legacy_260521.sql` 측 결과 보고 |
| 0.G-5 | TASK_FILTERS 적용 (5곳 측 통일) |
| 0.G-6 | 측 측 측 + 5/22 신규 측 측 + 회귀 측 |

🚫 톤 검사: 0건 ✅
🚫 적용/commit X — 계획서 + diff 측 ✅
