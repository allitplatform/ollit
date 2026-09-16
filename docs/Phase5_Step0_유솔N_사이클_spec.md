# Phase 5 Step 0 — 유솔N 사이클 안정화 spec

**작성일**: 2026-05-19
**범위**: 유솔N 워크스페이스 (UsolNScreen 5탭) DB 전환 + 진입점 정리
**예상 작업량**: 3~4시간
**상태**: ⏳ Stage 0.A 진단 완료 / 사장님 OK 대기

> ⚠️ **잠금 영역** (메모리 #4 / 시안 lock)
> - 운영자 PWA 메인 탭 (`overview / live / engineers / settlement`) 디자인 건드림 X
> - DashboardScreen 핵심 영역 디자인 건드림 X
> - 본 작업 = **유솔N 영역만** (UsolNScreen + 5 sub 컴포넌트 + 진입점)
> - 옛 spec 가설 (새 메인 탭 신설 / 별도 화면 생성) — **폐기**

---

## Stage 0.A 진단 결과 — 5 sub 컴포넌트 현황

### 데이터 출처 (전부 localStorage 측)

| 컴포넌트 | 데이터 source | 의존 |
|---|---|---|
| `UsolNOrders` | `loadTasks()` (localStorage) + 시드 | `xlsx` ✅ / `csvOrderRowToTask` / `findTaskByProductOrderId` |
| `UsolNInProgress` | `loadTasks()` + `loadEngineers()` | `EngineerBadge` |
| `UsolNCsvMatch` | `loadTasks()` | `xlsx` ✅ / `autoMatchSettlementCsv` / `confirmMatching` |
| `UsolNTracking` | `loadTasks()` + `getLongPendingTasks(13)` | `formatDateOnly` |
| `UsolNEngineerSettlement` | `loadTasks()` + `loadEngineers()` | `usolNCommission` / `EngineerBadge` |

### ✅ 이미 잘 만들어진 영역 (재사용)
- 5탭 컨테이너 + 그라데이션 헤더 (#03C75A) + 권한 분기
- **xlsx 라이브러리 이미 설치** — `import * as XLSX from "xlsx"` 사용 중 (Q3-2 라이브러리 추가 불필요)
- 접수 CSV 업로드 흐름 (UsolNOrders) — 중복 제거 / 미리보기 / 일괄 등록
- 정산 CSV 매칭 흐름 (UsolNCsvMatch) — 자동 분류 (우리 매칭 / 다른 회사 / 미매칭)
- 4단계 자금 흐름 모두 시각화:
  - 0단계 접수 ↔ UsolNOrders
  - 1단계 매칭 ↔ UsolNInProgress
  - 2단계 추적 ↔ UsolNCsvMatch + UsolNTracking (주간 입금 이력)
  - 3단계 정산 ↔ UsolNEngineerSettlement (월 15일 일괄)

### ❌ DB 전환 시 필요한 매핑 (모두 어댑터 필요)

**1. status 코드 변환** — DB(한글) ↔ 화면(영문)
| DB `tasks.status` | 화면 status |
|---|---|
| `미배정` | `received` (UsolNOrders) |
| `약속대기` | `assigned` |
| `확정` | `confirmed` |
| `진행중` | `in_progress` |
| `완료` | `completed` |
| `취소` | (UsolN 화면 X) |

→ `partial / visit_only / received` 등은 DB CHECK 제약에 없음. 추가 마이그? 또는 `category_data jsonb`에 sub_status 저장?

**2. principalId 매핑** — DB는 uuid, 화면은 `"usol_n"` 코드 비교
- 현재: `t.principalId === "usol_n"` (코드 직접 비교)
- DB: `tasks.principal_id` = principals.id (uuid)
- 어댑터: `principals` 테이블에서 `code='usol_n'` → id 캐싱 후 비교

**3. 화면 측 필드 vs DB 컬럼 격차**
| 화면 필드 | DB 측 위치 |
|---|---|
| `task.netAmount` | DB 컬럼 X — `task_items` 합산 또는 `category_data` jsonb? |
| `task.companyReceivedAt` | DB 컬럼 X — payments 측? `category_data` 측? |
| `task.naverSettledAt` | DB 컬럼 X — payments.status / category_data 측? |
| `task.engineerSettledAt` | DB 컬럼 X — payments.settled_at? |
| `task.orderType` (basic/extra) | DB 컬럼 X — task_items 측 work_type 분류? |
| `task.productOrderId` | DB 컬럼 X — `task_no` 또는 `category_data.productOrderId`? |
| `task.workItems` | `task_items` 별도 테이블 (JOIN 필요) |

→ Fix #31에서 1,143건 마이그 시 어떤 컬럼/jsonb 측에 들어갔는지 검증 필요 (Stage 0.B 시작 전 확인)

**4. 정산 분배 (`usolNCommission`)** — 클라이언트 측 계산
- 현재: `calcCompanyReceive / calcEngineerEarning / calcCompanyMargin` (15%/85% 등)
- DB: `compute_payment` v10 trigger (032) — usol_n도 trigger 적용돼 있나? 검증 필요

---

## 사장님 spec — 추가 작업 1 (개요 박스, 10분)

### 위치
DashboardScreen의 **OverviewTab** 안 — `[개요탭][오늘의 작업흐름(텍스트)] 사이`
- 코드 위치: `AdminApp.jsx:3423` `function OverviewTab(...)` 안
- 디자인 영역: 단순 박스 (라벨 "유솔N" + 화살표 →) — 기존 OverviewTab 박스 패턴 따라가기

### 동작
- 클릭 → `setScreen("usol_n")` (기존 라우트 활용, 화면 신규 생성 X)
- DashboardScreen → onClickUsolN prop (또는 기존 onClick 패턴 재사용) → AdminApp 측에서 setScreen 호출

### 설정 측 제거
- `SettingsScreen.jsx:249~252` 측 USOL_N_ENTRY 박스 — **제거**
- `showUsolNEntry` 호출처 / USOL_N_ENTRY 변수 자체는 남기되 SettingsScreen 렌더링만 제거
- 진입은 개요 박스만 (단일 경로)

---

## 성능 spec (사장님 렉 우려 해소)

### 1. 페이지네이션
- 1,143건 + 매주 신규 → 한 번에 fetch 시 메모리 부담
- 클라이언트 측 50건/page (탭별로 적용 — 접수/진행/추적/정산 각각)
- 매칭 탭은 매번 새 CSV 측 행 수 다름 (페이지네이션 X / 가상 스크롤 검토)

### 2. React state 캐싱
- 5탭이 매번 `loadTasks()` 재호출 있음 (현재 localStorage 측 catch 가벼움)
- DB 전환 후: UsolNScreen 측 1회 fetch → useContext 또는 prop drilling → sub 컴포넌트 공유
- 탭 전환 시 재fetch 0 (단, 화면 백그라운드 → 포어그라운드 시 갱신 spec)

### 3. realtime subscription 최소화
- 5탭 전부 realtime X — UsolNOrders / UsolNInProgress 둘만 subscribe (운영자 다중 사용 시 신규 접수 / 상태 변경 catch)
- UsolNTracking / UsolNEngineerSettlement / UsolNCsvMatch — 진입 시 fetch만 (수동 새로고침 가능)

### 4. Supabase 인덱스 활용
- 검증 필요: `tasks(principal_id, status)` 인덱스 존재? — 001_init.sql 확인 spec
- `payments(task_id, computed_at DESC)` 인덱스 ✅ 존재 (001:236)
- usol_n 1,143건 필터링 성능 위해 partial index 추가 검토 (`WHERE principal_id = <usol_n-uuid>`)

---

## 결정 spec 확정 영역 (사장님 메시지 측 OK 받음)

| 항목 | 결정 |
|---|---|
| Q1 — 화면 위치 | **옵션 3** = 기존 UsolNScreen 강화 (새 탭 X / 새 화면 X) |
| Q3-2 — XLSX 라이브러리 | **불필요** (이미 설치돼 사용 중) |
| Q4 — 현금 입력 | **제외** (현금은 다른 원청 / 유솔N 사이클 무관) |
| Q8 — 단계 분할 | OK — 0.A/0.B/0.C/0.D 진행 |
| 성능 spec | 페이지네이션 50/page + state 캐싱 + realtime 최소화 + 인덱스 활용 |
| 추가 작업 1 | 개요 박스 신설 + 설정 측 박스 제거 (10분) |

---

## 미확정 영역 (Stage 0.B 진입 전 사장님 결정)

### Q-i — status 코드 매핑 spec
DB CHECK는 `미배정/약속대기/확정/진행중/완료/취소` 6개. 화면은 `received/assigned/confirmed/in_progress/completed/partial/visit_only` 7개. 격차:
- `received` ↔ `미배정` 매핑? 또는 별도 sub_status?
- `partial / visit_only` — DB CHECK에 X → 어디 둘지?
  - 옵션 A: DB CHECK 확장 (마이그 + RLS 영향)
  - 옵션 B: `category_data.sub_status` jsonb에 저장 (마이그 0)
  - 옵션 C: `completed`의 sub 상태로 처리 (work_memo 측)

### Q-ii — 누락 필드 저장 spec
화면 측 `netAmount / companyReceivedAt / naverSettledAt / engineerSettledAt / orderType / productOrderId` — Fix #31 마이그 시 어디 들어갔는지?
- → Stage 0.B 첫 작업으로 Supabase 측 usol_n 1행 SELECT → 실제 컬럼/jsonb 검증
- 사장님이 결정 줄 수 있는 영역: 누락 시 추가 마이그 OK?

### Q-iii — 단계 0.B / 0.C / 0.D 정확한 분할
| Stage | spec |
|---|---|
| 0.B | 추가 작업 1 (개요 박스 10분) + UsolNOrders/UsolNInProgress DB 전환 (50분) |
| 0.C | UsolNCsvMatch (정산 CSV) + UsolNTracking DB 전환 |
| 0.D | UsolNEngineerSettlement DB 전환 + 성능 spec 4종 검증 + 통합 테스트 |

---

## 진행 절차

1. **현재 단계 — 사장님 OK 받기**:
   - Q-i (status 매핑) 결정
   - Q-ii (마이그 추가 가능 여부) 결정
   - Q-iii (단계 분할) OK
2. Stage 0.B 시작 (백업 + Supabase 측 usol_n 1행 SELECT 검증 + 개요 박스 추가 + UsolNOrders/UsolNInProgress 전환)
3. 각 stage 끝에 사장님 검증 → OK 후 다음 진입
4. Step 0 완료 시 Step 1 (매칭 강화) → Step 2 (추적) → Step 3 (정산) spec 작성

---

## 보존 영역 ✅
- a7b5658 (유솔 송금 + Hero sub 제거)
- 5ea7e0f (weekEarning / monthEarning 계산)
- ab53037 (회사 계좌 DB fetch + RLS anon SELECT)
- 운영자 PWA 메인 탭 + DashboardScreen 핵심 디자인 (시안 lock)
