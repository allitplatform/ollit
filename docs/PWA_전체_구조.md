# 올잇 PWA — 전체 구조 (통합본)

**작성일**: 2026-05-01
**목적**: Claude(데스크톱)와 시안 협업 시 부분 X 전체 시스템 차원 대화. 사장님이 두 번 말 안 하게 모든 결정사항 한 문서.
**입력**: `src/pages/*.jsx` (5 페이지) + 11개 docs (비전/Phase1/그릇/정산/원청별/디자인 등) 통합
**원칙**: 한국 운영 / 다크 모드 / 모바일 우선 / 단순화 / 한 번 결정 = 박힘

---

## 1. 4 역할 (실제는 5 role) 매트릭스

DB enum 5 role / UI 호칭 한글:

| DB role | UI 호칭 | 누구 | 보는 페이지 | Phase 1 | 사용자 수 |
|---|---|---|---|---|---|
| `owner` | **대표님** | 회사 사장님 (이대표 + 공동대표 3) | AdminApp + 모든 페이지 (super) | ✓ | 4명 (A001~A004) |
| `operator` | **관리자** | 해피콜 직원 (운영팀) | HappycallApp + AdminApp 일부 | ✓ | 4명 (H001~H004, 일부는 A와 같은 사람) |
| `engineer` | **프로님** | 기사 (개인사업자) | EngineerApp | ✓ | 22명 (E001~E024 + 가스폰 분리 3) |
| `partner` | (회사명) | 외부 거래처 (김쿨가이/유솔 등) | PrincipalApp | ✓ (유솔만) / ⚠️ KA/KB partner 결정 필요 | 1명 (M001 유솔) + KA/KB (?) |
| `admin` | 운영팀 (SaaS) | 시스템 관리자 | 모든 tenant cross-cut | Phase 3 | — |

**총 사용자**: 28행 (`_NEXT_SESSION.md` 명단). KA/KB partner는 사장님 결정 대기 (`원청별_워크플로우.md` 결정 #1).

### 1-1. 다중 역할 패턴 (대표 4명)

대표 4명은 owner + operator + engineer 3 role 동시 보유. PWA 상단 토글 `[대표] [관리자] [프로]` (보유 role만 노출).

---

## 2. 5 페이지 × 모든 화면 트리

### 2-1. LoginScreen (892줄) — 모든 사용자 진입

```
LoginScreen
  └ step: "login"            → 전화번호 + PIN 입력
  └ step: "forgotPassword"   → PIN reset 요청
  └ step: "changePassword"   → 첫 로그인 PIN 변경 강제
  └ step: "success"          → 역할 라우팅 → 해당 페이지
```

**구현**: `useState("login")` step 분기. inline render (모달 X).
**인증**: 전화 + 4자리 PIN (택시앱 스타일, 30일 토큰).

### 2-2. HappycallApp (2193줄) — operator (관리자)

```
HappycallApp (screen state 기반, 탭 X)
  ├ HappycallMainScreen     → 메인 — ActionAlert + 탭(전체/미배정/배정대기/완료) + TaskCard 리스트
  │    └ TaskCard           → 액션: [📞 전화] [👤 배정]
  ├ NewReceptionScreen      → 새 접수 (카톡 paste / 직접 입력)
  ├ HappycallEditScreen     → 작업 수정
  ├ AssignEngineerScreen    → 기사 배정 — EngineerTimelineCard (지역/거리/일정) ★ 추천 시각화
  └ MemoEditScreen          → 해피콜 메모 편집 (※ Phase 1에선 해피콜 X — 이 화면 사실상 안 씀)
```

**핵심 데이터**: `ENGINEERS` (5명 mock), `CLIENTS` (6 — 시뮬: 올데이/쿨가이/용인/크리크린/유솔/망고), `BASE_PRICES`, `CLIENT_RATIO`.

**Phase 1 결정**: 해피콜 ❌ → `MemoEditScreen` 비활성. `NewReceptionScreen`은 새 접수 시안 3-V2로 재설계.

### 2-3. EngineerApp (3237줄 ★ 가장 큼) — engineer (프로님)

```
EngineerApp (BottomTabBar 4 탭)
  ├ Tab "today" — MainScreen
  │    ├ ActionAlert (긴급/오늘 작업 시작 등)
  │    ├ findNextTask → CompactTaskCard 리스트 (오늘 일정)
  │    └ CalendarScreen (옵션 진입) → DayDetailScreen
  ├ Tab "settle" — SettlementScreen
  │    └ JobSettlementCard 리스트 (작업별 정산 — F. 본인 정산)
  ├ Tab "noti" — NotificationsScreen
  │    └ NotificationItem (읽음/삭제)
  └ Tab "profile" — ProfileScreen
       └ ProfileMenuItem / ProfileStat (직급/매출/평점)

내부 화면 (탭 안에서 전환):
  ├ TaskDetailScreen        → 작업 상세 (시작/완료/사진/메모)
  ├ CompletionReportScreen  → 완료 보고 (사진 + extra_fee 입력)
  ├ CalendarScreen          → 월/주 캘린더
  └ DayDetailScreen         → 날짜별 작업 + 휴무 등록
```

**커스텀 컴포넌트**: `CustomDatePicker`, `CustomTimePicker`, `Section`, `InfoBox`, `Row`, `PhotoUploadBox`, `SmallMetric`.

### 2-4. PrincipalApp (1416줄) — partner (거래처)

```
PrincipalApp (BottomNav 4 탭)
  ├ Tab "list"   — ListTab
  │    └ TaskCard 리스트 (자기 principal_id 만 RLS로 필터)
  ├ Tab "new"    — NewTab
  │    └ parseKakao v2 자동 입력 (정형/막무가내 SAMPLES 토글) → 6 필드 폼 → 등록
  ├ Tab "settle" — SettleTab
  │    └ 자기 정산 (원청수수료만) — 월별 합계 + 작업별 상세
  └ Tab "info"   — InfoTab

내부 화면:
  ├ TaskDetail              → 작업 상세 (자기 의뢰만 — partner-safe view)
  └ SubmittedScreen         → 등록 완료 화면
```

**parseKakao v2** (이미 구현 완료): 8 case calc_method 파싱 + 막무가내 메시지 폴백 + 폰 last 4 fallback.

### 2-5. AdminApp (731줄, **`useTasks` 미연결**) — owner (대표님)

```
AdminApp (현재 구조 — 시안 4-V4로 재설계 예정)
  └ AdminDashboard
       ├ Tab "overview" — OverviewTab    (BigMetric 4구역: 매출/마진/기사정산/원청수수료)
       ├ Tab "tasks"    — TasksTab       (실시간 작업 — 시안 1: 컴팩트/탭 분류)
       ├ Tab "engineers" — EngineersTab  (기사 리스트 + 직급/매출/utilization)
       └ Tab "activity" — ActivityTab    (RECENT_ACTIVITIES 타임라인)
```

**Phase 1 G 대시보드 (시안 4-V4)** = 위 4 탭 + 다음 추가:
- 정산 마감 알림 (실시간 X — 마감 시점만)
- 새 접수 그룹 (원청별 — 시안 3-V2)
- 추천기사 진입 (시안 5-V3)

⚠️ 작업: `useTasks` Hook 연결 → 모든 mock 데이터를 `useTasks().tasks` 로 교체.

---

## 3. 화면 이동 흐름 (전체 다이어그램)

### 3-1. 로그인 → 역할 라우팅 (App.jsx)

```
[전원 ON]
   ↓
LoginScreen "login"
   ↓ 전화 + PIN OK
   ↓ (must_change_pin=true) → "changePassword" → "success"
   ↓ "success"
   ↓ user.role 분기
   ├─ owner → AdminApp (메인 = "overview" 탭)
   ├─ operator → HappycallApp (메인 = HappycallMainScreen)
   ├─ engineer → EngineerApp (메인 = "today" 탭)
   ├─ partner → PrincipalApp (메인 = "list" 탭)
   └─ admin (Phase 3) → cross-tenant 모니터링
```

### 3-2. 작업 한 건의 라이프사이클 (역할 × 화면 횡단)

```
[새 접수 발생]
   ↓
operator: HappycallApp.NewReceptionScreen
   또는 partner: PrincipalApp.NewTab (parseKakao)
   또는 시트 import (유솔)
   ↓ tasks.status = '미배정'
   ↓
[배정 단계]
   ↓ (가스 = 자동 / 세척·점검·설치 = 수동)
   ↓
가스: task_assignments 일괄 INSERT → 기사 푸시 → 첫 수락
   또는
세척: operator 또는 owner: HappycallApp.AssignEngineerScreen → EngineerTimelineCard 추천 → 수동 배정
   ↓ tasks.status = '확정' / '약속대기'
   ↓ tasks.assigned_engineer_id = user_id
   ↓
[작업 진행]
   ↓
engineer: EngineerApp.MainScreen → CompactTaskCard 클릭 → TaskDetailScreen
   ↓ [시작] 클릭 → tasks.status = '진행중', started_at = now
   ↓
[완료 보고]
   ↓
engineer: EngineerApp.CompletionReportScreen → 사진 업로드 + extra_fee 입력 → [완료]
   ↓ tasks.status = '완료', completed_at = now
   ↓ trigger: compute_payment() 자동 호출 → payments row 생성 (status='미정산')
   ↓
[정산]
   ↓
owner: AdminApp.정산관리.기사정산 → [입금 완료] 클릭 → payments.status='사장님입금', paid_at=now
   ↓
engineer: EngineerApp.SettlementScreen → JobSettlementCard → [입금 확인] → confirmed_at=now, status='기사확인'
   ↓
owner: AdminApp.기사정산 → [정산 완료] → settled_at=now, status='정산완료'
   ↓ (원청은 단방향: owner 한 번 클릭 → 즉시 '정산완료')
```

### 3-3. 핵심 이동 5가지

1. **Login → 역할 라우팅** (App.jsx switch)
2. **Main → Detail** (각 페이지 inline state, 모달 X)
3. **Detail → Edit/Action** (예: TaskDetail → CompletionReport)
4. **Detail → Back** (← 뒤로 버튼 → 이전 state 복원)
5. **Tab 전환** (BottomNav 4탭 — 모든 페이지 일관)

---

## 4. 6 원청 워크플로우 (요약)

상세는 `원청별_워크플로우.md`. 한 줄 요약:

| 원청 | 접수 | 배정 | 결제 | 정산 |
|---|---|---|---|---|
| **올데이케어** | 자체 영업 → operator 입력 | 가스 auto / 그 외 manual | 현장/회사 자체 | 정액 0 (마진 100%) |
| **쿨가이 KA** | partner 또는 카톡 | 동일 | KA 회사 통해 | 예상금액비율 **10/50/40** |
| **쿨가이 KB** | partner 또는 카톡 | 동일 | KB 회사 통해 | 예상금액비율 **35/50/15** |
| **용인컴퍼니** | 외주 카톡 → operator | 동일 | 용인 회사 통해 | 정액 1만 |
| **유솔 H** (현금) | **외부 시트 자동 동기화** | manual_with_recommendation | 유솔 직수령 | 비율 15% |
| **유솔 N** (네이버) | 동일 | 동일 | 네이버 → 유솔 → 사장님 → 기사 | 수량비율 15% (단가-naver_fee) — Phase 2 자동화 |
| ~~세스코~~ | 계약 종료 | — | — | Phase 1 제외 |

**해피콜 = 모든 원청 ❌** (사장님 확정 결정).

**가스 vs 세척 워크플로 분리**:
- 가스 (`gas_charging`) = `auto_first_accept` (선착순)
- 세척·설치·점검 등 = `manual_with_recommendation` (시스템 추천 → 사장님 수동)

---

## 5. 시스템 워크플로우 — 5 단계

| 단계 | 역할 | 화면 | tasks.status | 트리거 |
|---|---|---|---|---|
| **1. 접수** | partner / operator | PrincipalApp.NewTab / HappycallApp.NewReceptionScreen / 시트 import | `미배정` | INSERT tasks row |
| **2. 배정** | (자동 가스) 시스템 + engineer / (수동) operator+owner | task_assignments / HappycallApp.AssignEngineerScreen | `미배정` → `약속대기`/`확정` | task_assignments INSERT + tasks.assigned_engineer_id 업데이트 |
| **3. 작업** | engineer | EngineerApp.TaskDetailScreen | `확정` → `진행중` | started_at, [시작] 클릭 |
| **4. 완료** | engineer | EngineerApp.CompletionReportScreen | `진행중` → `완료` | completed_at, 사진 upload, compute_payment 자동 |
| **5. 정산** | owner ↔ engineer (양방향) / owner → 원청 (한 클릭) | AdminApp.정산관리 / EngineerApp.SettlementScreen / PrincipalApp.SettleTab | (payments.status 4단계) | paid_at → confirmed_at → settled_at |

---

## 6. 데이터 흐름

### 6-1. tasks.status (6 enum)

```
미배정 → 약속대기 → 확정 → 진행중 → 완료
                        ↘ 취소 (어디서든)
```

| 변경 트리거 | 누가 | 어디서 |
|---|---|---|
| INSERT (`미배정`) | partner/operator | NewTab/NewReceptionScreen |
| → 약속대기 | 가스: 시스템 자동 / 세척: operator | task_assignments 매칭 후 |
| → 확정 | operator/owner | AssignEngineerScreen 배정 시 |
| → 진행중 | engineer | TaskDetailScreen [시작] |
| → 완료 | engineer | CompletionReportScreen [완료] |
| → 취소 | operator/owner | (어디서든) |

### 6-2. payments.status (7 enum) — 양방향 확인 흐름

```
미정산 → 사장님입금 → 기사확인 → 정산완료
            ↘ 보류    ↘ 분쟁    ↘ 지연
```

| 변경 트리거 | 누가 | 어디서 |
|---|---|---|
| INSERT (`미정산`) | 시스템 (compute_payment) | tasks.status='완료' 트리거 |
| → 사장님입금 | owner | AdminApp.기사정산 [입금 완료] (paid_at) |
| → 기사확인 | engineer | EngineerApp.SettlementScreen [입금 확인] (confirmed_at) |
| → 정산완료 | owner | AdminApp.기사정산 [정산 완료] (settled_at) |
| 원청 정산 (한 클릭) | owner | AdminApp.원청정산 → paid_at + settled_at 동시 (`기사확인` 건너뜀) |

### 6-3. task_assignments.status (4 enum) — 가스 자동 배정

```
대기 → 수락 → (자동) 다른 row '마감'
     ↘ 거절
```

### 6-4. 알림 — Phase 1 인앱 / Phase 2 텔레그램

| 상황 | 받는 사람 | 채널 (Phase 1) | 채널 (Phase 2) |
|---|---|---|---|
| 가스 작업 신규 (선착순 후보) | 매칭된 engineer 다수 | 인앱 푸시 | 텔레그램 |
| 작업 배정 확정 | engineer (assigned) | 인앱 | 텔레그램 |
| 정산 입금 완료 | engineer | 인앱 (D 화면 ↔ F 화면) | 텔레그램 |
| 5분 미수락 (가스) | owner | 인앱 알림 | 텔레그램 |
| 분쟁 발생 | owner / partner | 인앱 | 텔레그램 |

---

## 7. 디자인 시스템 (요약)

상세는 `디자인_시스템.md`.

### 7-1. 색상 (다크, 코드 표준)

```
배경     bg #1A1512   /   bgElevated #221C18   /   bgInset #13100E
브랜드   accent #FF1B8D   (라이트 #E91860)
상태     success #34D399  /  danger #EF4444  /  warning #FBBF24

원청 라벨  올데이 #FF1B8D / 쿨가이 KA #06B6D4 / KB ?(Day 5) / 용인 #A855F7 / 유솔 #10B981
직급      수습 #888780 / 주임 #378ADD / 대리 #1D9E75 / 과장 #E91860 / 부장 #BA7517
```

### 7-2. 시안 5-V3 (신규 화면 톤)

```
배경 #0F0F12 (코드보다 cooler dark)
accent #EC4899
radius 12-16
```

→ 신규 화면 (A~G + 새 접수)은 시안 5-V3 톤. 기존 5 페이지는 점진 마이그(Phase 2 클린업).

### 7-3. 컴포넌트 표준

| 종류 | 패턴 |
|---|---|
| 카드 | `bgElevated` + border 1px + radius 12 + padding 14-16 |
| 메인 버튼 | radius 12, padding 16, fontSize 14, weight 700, accent bg |
| 상태 배지 | radius 100, padding 4 9, fontSize 10-11, weight 700-800 |
| 입력 | radius 10, padding 12 14, border 1.5px (focus accent) |
| 헤더 | sticky top, blur, height 30-40 |
| BottomNav | fixed bottom, max-width 420, 4 탭 |

### 7-4. 레이아웃 표준

- 모바일 우선 maxWidth 420 (PC도 같은 너비)
- 외부 shell `#0A0A0A` (폰 베젤)
- 페이지 padding 20 / 카드 사이 gap 8-12
- 인터랙션 `.clickable` (active opacity 0.7 + scale 0.98) / `.fade-in` 0.4s slideUp

### 7-5. 4 역할별 색상 차이 — 없음

DB role은 5 enum 영문, UI 호칭은 한글. 페이지마다 같은 THEMES 사용. **역할별 색상 X** (역할 라벨은 헤더 작은 텍스트 1행에만).

---

## 8. 미완성 / 추가 필요

### 8-1. Phase 1 안에서 해결할 것

| 항목 | 위치 | 상태 |
|---|---|---|
| **AdminApp `useTasks` 연결** | AdminApp.jsx | mock 데이터 → context 교체 (G 대시보드 작업) |
| AdminApp 시안 4-V4 재설계 | docs (시안만) → 코드 | 디자인 시안 후 React 구현 |
| 새 접수 시안 3-V2 (원청별 그룹) | HappycallApp.NewReceptionScreen 또는 신규 | 시안 + 코드 |
| 실시간 작업 시안 1 (컴팩트/탭) | AdminApp.TasksTab | 시안 + 코드 |
| 추천기사 시안 5-V3 ✅ 확정 | HappycallApp.AssignEngineerScreen 또는 신규 | 시안 확정, 코드 미작성 |
| 프로 관리 화면 A (신규 등록) | AdminApp 안 | 미작성 |
| 프로 관리 화면 B (설정 관리) | AdminApp 안 | 미작성 |
| 기사 정산 D (양방향 확인) | AdminApp.정산관리.기사정산 | 미작성 |
| 원청 정산 E (한 클릭) | AdminApp.정산관리.원청정산 | 미작성 |
| 본인 정산 F | EngineerApp.SettlementScreen — 일부 있음, [입금 확인] 버튼 추가 필요 | 일부 작성 |
| 해피콜 메모 화면 비활성 | HappycallApp.MemoEditScreen | Phase 1 = 해피콜 ❌이라 사용 X |

### 8-2. KA/KB / partner 결정 (사장님 검토)

`원청별_워크플로우.md` 7절 — 7개 결정 필요:
1. KA/KB partner user 처리 방식
2. 용인컴퍼니 partner 화면 줄지
3. 유솔 partner 사용 여부
4. 가스 자동 배정 후 일정 협의 누가
5. KA/KB 작업 종류 한정 여부
6. 유솔 추가선택 카탈로그
7. 망고클린/크리크린 시뮬 데이터 폐기 여부

### 8-3. Phase 2 미루기

- 유솔 N 네이버 자동화 (`compute_payment` `p_naver_fee` 분기)
- 텔레그램 알림 (Phase 1은 인앱만)
- 정산 통계 / 월별 리포트
- 분쟁 자동화
- 운영 시트(50열) 마이그레이션
- THEMES 통일 (5 페이지 자체 복붙 → shared/themes.js import)
- 시안 5-V3 톤 통합 (#0F0F12 + #EC4899) — 기존 페이지에도 적용

### 8-4. Phase 3

- Multi-tenant (다른 회사 입주)
- Multi-category (청소기 / 대리석 / 도어락 / ...)
- 운영 시트(50열) 통합
- admin role (cross-tenant)

---

## 9. 시안 라벨링 (Claude 데스크톱 협업)

| 시안 | 화면 | 사양 위치 | 상태 |
|---|---|---|---|
| **시안 1** | 실시간 작업 (AdminApp.TasksTab) | 사장님 명시 — 컴팩트, 탭 분류 | 디자인 미작성 |
| **시안 3-V2** | 새 접수 (원청별 그룹) | `원청별_워크플로우.md` 5절 | 디자인 미작성 |
| **시안 4-V4** | AdminApp 메인 대시보드 | 사장님 명시 — 4구역(매출/마진/기사정산/원청수수료) + 마감 시점만 정산 | 디자인 미작성 |
| **시안 5-V3** | 추천기사 카드 + 오늘 일정 | `Phase1_MVP_계획.md` "추천 화면 시안 5-V3" | ✅ 확정 |

각 시안은 데스크톱 Claude와 협업 — **본 트랙(Code)은 사양/스키마 진실 소스**, 시안에서 사양 충돌 발견되면 본 docs 정정 → 시안 갱신.

---

## 10. 한 페이지 정리 (사장님 빠른 참조)

```
┌── 5 페이지 ─────────────────────────────────────┐
│ Login (892줄)      → 역할별 라우팅                │
│ Happycall (2193)   → operator: 접수/배정          │
│ Engineer (3237)    → engineer: 일정/작업/정산     │
│ Principal (1416)   → partner: 자기 의뢰          │
│ Admin (731, 미연결) → owner: 대시보드/정산 (시안4-V4)│
└─────────────────────────────────────────────────┘

┌── 5 워크플로 단계 ─────────────────────────────┐
│ 접수 → 배정 → 작업 → 완료 → 정산                 │
│                                                  │
│ 가스: auto_first_accept (선착순)                 │
│ 세척: manual_with_recommendation (추천+수동)     │
│ 해피콜: ❌ (모든 원청)                            │
└─────────────────────────────────────────────────┘

┌── 6 원청 ──────────────────────────────────────┐
│ O 올데이 (자체)        / KA 쿨가이 (가스 10/50/40)│
│ KB 쿨가이 (35/50/15)  / Y 용인 (정액 1만)        │
│ H 유솔 현금 / N 유솔 네이버 (Phase 2 자동화)      │
│ ~~C 세스코~~ 계약 종료                            │
└─────────────────────────────────────────────────┘

┌── 정산 흐름 ────────────────────────────────────┐
│ payments.status:                                 │
│  미정산 → 사장님입금 → 기사확인 → 정산완료         │
│        (paid_at)   (confirmed_at) (settled_at)   │
│ 원청 정산 = 한 클릭 (즉시 정산완료)               │
└─────────────────────────────────────────────────┘

┌── 디자인 ──────────────────────────────────────┐
│ 코드 표준: #1A1512 + #FF1B8D                     │
│ 시안 5-V3: #0F0F12 + #EC4899                     │
│ 카드 radius 12 / 카드 bg bgElevated / accent 1곳 │
│ Spoqa 한글 / JetBrains Mono 숫자 / Tailwind ❌  │
└─────────────────────────────────────────────────┘
```

---

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-01 | 초안 — 5 페이지 분석 + 11 docs 통합 + 5 단계 워크플로 + 시안 라벨링 |
