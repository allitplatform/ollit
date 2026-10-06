# 설계 보고 — 협력사 구조 + 종목 2단계 + 이전설치 출발/도착

작성 2026-10-06 · Step 1 산출물 · **실행 전 단계 — 사장님 OK 후 Step 2 진행**
근거: `docs/audit_partner_category_move.md` (Step 0 조사)

---

## 0. 먼저 확인이 필요한 것 (조사에서 나온, 지시문과 다른 점)

지시문 D1~D10 결정은 그대로 따릅니다. 다만 조사 결과 **만드는 방법**을 바꿔야 하는 곳이 7군데 있습니다.

| # | 조사 결과 | 설계 반영 | 사장님 확인 |
|---|---|---|---|
| F1 | `partner` 라는 단어가 이미 **원청 담당자**를 뜻합니다 (role 값, `partner_full_cancel`, `PartnerDailySettleTab` 등) | 협력사 테이블·칸 이름을 `subcontractors` / `subcontractor_id`, 관리자 role 을 `sub_manager` 로. 화면 글자는 "협력사" 그대로 | **Q1** |
| F2 | 종목 → 서비스 2단계는 **DB 에 이미 있습니다**: `categories` → `service_types` → `work_types`. 정산 함수도 `service_types.code` 를 읽습니다 | `service_categories` 새 테이블을 만들지 않고 기존 `categories` 에 종목 행을 추가 | **Q3** (누수 표시 위치) |
| F3 | 수수료 표도 **이미 있습니다**: `commission_policies` (원청 × 서비스 × 기종). 다만 협력사 칸이 없고 `calculate_commission` 의 계산 방식 이름에 묶여 있음 | 지시문대로 `fee_rules` 를 따로 만들고 협력사 작업만 읽음. 기존 표·함수는 그대로 | — |
| F4 | 로그인이 Supabase Auth 가 아니라서 `p_actor` 는 **브라우저가 보내는 값**입니다. 남의 user_id 를 넣으면 통과합니다. 그리고 `tasks` 는 지금도 anon 키로 전체 조회가 됩니다 | 협력사용 RPC 는 `p_actor` 소속 검증 + **로그인 때 발급한 세션 값 확인**을 추가하는 안(B)을 권장 | **Q5** |
| F5 | `api/` 서버 함수가 지금 정확히 12개입니다 (`_removed_*.bak` 2개는 과거에 줄인 흔적). Vercel 무료 플랜 한도가 12개 | `api/geo/geocode.js` 를 새 파일로 추가하면 13개. 플랜 확인 또는 기존 함수에 합치기 | **Q4** |
| F6 | 예약 실행(정해진 시각에 도는 작업)이 DB 에 없습니다. 지금 푸시는 전부 "행이 바뀔 때" 발송 | "다음 날 정오 미입금 푸시"는 예약 실행 수단이 새로 필요 (Supabase `pg_cron` 또는 Vercel Cron) | **Q7** |
| F7 | 기사 앱 내비 버튼 3종은 **이미 있습니다** (주소 검색 방식). 완료 시 "받은 돈" 입력 화면도 이미 있습니다 | 새로 만들지 않고 기존 부품을 확장. 좌표가 없을 때는 "주소 복사"만 두지 않고 지금의 주소 검색 버튼으로 대체 | — |

추가로 조사 3번에서 **협력사와 무관하게 지금도 열려 있는 구멍**이 나왔습니다 (`payments` 를 누구나 수정 가능, `engineer_rates` 누구나 수정·삭제 가능 등). 이번 작업 범위는 아니지만 외부 회사 직원 계정이 생기기 전에 닫는 것을 권합니다 → 6장.

---

## 1. 마이그레이션 초안 목록

현재 최신 번호 211. 아래는 212 부터. 모든 파일은 `db/migrations/` 에 저장하고 사장님이 SQL Editor 에서 실행합니다.

| 번호 | 파일 | 내용 | 기존 데이터 영향 |
|---|---|---|---|
| 212 | `212_subcontractors.sql` | ① `subcontractors` 테이블 (code, name, 사업자 5칸, 입금 계좌, active) ② `users.subcontractor_id` (NULL = 직영) ③ `tasks.subcontractor_id` (NULL = 직영) ④ `user_roles.role` CHECK 에 `sub_manager` 추가, `user_roles.subcontractor_id` 추가 + 유니크 인덱스 1개 ⑤ `sign_in_with_phone` 응답에 `subcontractor` 추가 ⑥ 화이트코어 1행 등록 | 새 칸은 전부 NULL 로 시작. CHECK 는 허용값이 늘어날 뿐. 로그인 응답은 기존 필드 그대로 + 1개 추가 → **기존 행 변경 0** |
| 213 | `213_task_subcontractor_sync.sql` | `tasks` BEFORE 트리거: 배정 기사가 바뀌면 그 기사의 소속을 `tasks.subcontractor_id` 에 맞춤 (직영 기사 → NULL, 협력사 직원 → 그 협력사) | 기존 기사는 전원 소속 NULL → 트리거가 값을 바꾸지 않음. 기존 배정 코드(`assignEngineerDb`)는 수정 없이 그대로 동작 |
| 214 | `214_sub_manager_rpcs.sql` | 협력사 관리자·직원용 RPC (전부 `SECURITY DEFINER` + 소속 검증): `sub_list_tasks`, `sub_list_staff`, `sub_assign_task`(자기 직원에게만), `sub_staff_list_tasks`(직원 본인 작업). 운영자용: `admin_assign_task_to_subcontractor`, `admin_set_engineer_subcontractor`, `admin_list_subcontractors` | 새 함수만 추가 |
| 215 | `215_service_categories.sql` | `categories` 에 종목 추가(주방후드·입주청소·벌초), `service_types` 추가(주방후드 › 업소용/가정용/설치, 입주청소, 벌초), 서비스별 `work_types` 행. 이전설치는 기존 설치 밑 작업 이름 그대로(4장). 누수는 Q3 결정에 따라 표시용 칸 1개 추가 여부 결정 | 행 추가만 (`ON CONFLICT DO NOTHING`). 기존 `service_types`·`work_types`·`tasks.category_id` 값 변경 없음 |
| 216 | `216_fee_rules.sql` | `fee_rules` (principal_code, subcontractor_id NULL 허용, service_code NULL 허용, fee_type `rate`/`fixed`, fee_rate, fee_amount, effective_from) + 운영자 저장 RPC + 화이트코어 규칙 등록 | 새 테이블 |
| 217 | `217_compute_payment_v30.sql` | ① `payments.track` CHECK 에 `'S'`(협력사 수수료) 추가 ② `compute_payment` v30 = **v29 본문 그대로** + 맨 앞에 협력사 분기 1개 ③ 드라이런 함수 `compute_payment_v30_dryrun` | `tasks.subcontractor_id IS NULL` 인 작업은 v29 와 한 글자도 다르지 않은 경로. **기존 payments 행 UPDATE 없음** (2장 상세) |
| 218 | `218_subcontractor_daily_fees.sql` | `subcontractor_daily_fees` (협력사 × 작업일, 보고 시각·보고자, 확인 시각·확인자, 확인 시점 금액 사본) + RPC: `sub_report_fee_deposit`, `admin_confirm_sub_fee`, `admin_undo_sub_fee`, `list_sub_daily_fees` + 확인 시 가계부 수입 자동 기록 | 새 테이블. 가계부는 확인 버튼을 누를 때만 1행 추가 |
| 219 | `219_invoice_issuer.sql` | `engineer_business_info.invoice_issuer` (`self` 기본 / `sub`) + 발급 사업자 조회 RPC `get_issuer_info` (본인 것 또는 **자기 소속** 협력사 것만) + `issue_document` 가 이 값으로 사업자번호 선택 | 기존 행은 기본값 `self` → 지금과 동일하게 발급 |
| 220 | `220_task_destination.sql` | `tasks` 에 `lat`, `lng`, `dest_address`, `dest_detail`, `dest_lat`, `dest_lng`, `linked_task_id` | 전부 NULL 로 시작. 기존 작업은 좌표 없이 지금처럼 동작 |
| 221 | `221_dashboard_summary_sub_fee.sql` | 서버 매출 집계 `get_admin_dashboard_summary(_range)` 에 협력사 수수료·거래액 칸 추가 | 기존 반환 칸의 값은 그대로 (5장에서 검증) |
| 222 | `222_sub_fee_overdue_push.sql` | 미입금 판정 + 운영자 푸시 (Q7 결정 후 방식 확정) | 새 함수·예약만 |

### 순서와 묶음

- **묶음 1 (협력사 뼈대)**: 212 → 213 → 214 → 코드 push (운영자 배정 화면 + 협력사 관리자 화면 뼈대)
- **묶음 2 (종목)**: 215 → 코드 push (접수 양식 2단계)
- **묶음 3 (돈)**: 216 → 217 드라이런 확인 → 217 본 적용 → 218 → 221 → 코드 push
- **묶음 4 (발급)**: 219 → 코드 push
- **묶음 5 (이전설치)**: 220 → 서버 함수 배포 확인 → 코드 push
- **묶음 6 (경보)**: 222

묶음 1·2·4·5 는 서로 독립이라 순서를 바꿔도 됩니다. 묶음 3 은 묶음 1 뒤에만 가능합니다.

---

## 2. 정산 설계 (D4·D5·D7) — 기존 계산을 건드리지 않는 방법

### 2-1. 지금 구조 (조사 결과)

- `compute_payment(p_task_id)` v29 (mig 200)가 작업의 각 항목마다 `calculate_commission(원청코드, 서비스코드, 기종, …)` 을 불러 `commission_policies` 표에서 계산 방식을 읽습니다.
- 표에 행이 없으면 오류를 내고, 오류는 `payments.compute_error` 에 남습니다 (mig 173).
- 결과는 `payments` 1행: `engineer_amount` / `principal_amount` / `owner_amount` / `track`.
- 화면은 `track === 'A'` 인 완료 작업만 "기사 송금 대상"이자 "매출"로 봅니다 (`src/utils/remitFilter.js:47-56`, `src/utils/revenueStats.js:82`).

### 2-2. v30 — 맨 앞에 분기 하나

```
compute_payment(p_task_id):
  작업 읽기
  IF 작업.subcontractor_id IS NOT NULL THEN
      → 협력사 경로 (아래) 로 계산하고 payments 저장 후 RETURN
  END IF
  … 이하 v29 본문 그대로 (한 줄도 수정하지 않음) …
```

**협력사 경로**

| 값 | 계산 |
|---|---|
| 고객 결제액 | `tasks.received_total` (직원이 완료 때 입력한 실제 금액, D7-1). 비어 있으면 견적 + 추가금 |
| 규칙 찾기 | `fee_rules` 에서 (원청코드, 협력사, 서비스코드)가 맞는 행 중 `effective_from` 이 완료일 이전인 가장 최근 것. 정확히 맞는 행 → 서비스 무관 행(service_code NULL) 순 |
| 올데이케어 수수료 | `rate` 면 `FLOOR(고객 결제액 × 율)`, `fixed` 면 정액 (고객 결제액을 넘지 않게) |
| 협력사 몫 | 고객 결제액 − 수수료 |
| 저장 | `owner_amount` = 수수료, `engineer_amount` = 협력사 몫, `principal_amount` = 0, `track` = `'S'`, `calc_method` = `'협력사_수수료'`, `policy_key` = 규칙 id |
| 규칙이 없을 때 | 조용히 0 으로 두지 않고 `compute_error` 에 "수수료 규칙 없음" 기록 → 운영자 화면 경고 (기존 mig 173 표시 재사용) |

### 2-3. 왜 `track = 'S'` 인가

기존 화면은 전부 "`track` 이 A 인가"로 묻습니다. 협력사 작업을 S 로 두면 **코드를 고치지 않아도** 아래가 자동으로 성립합니다.

- 기사 개인 송금 확인 화면에서 제외 (2-H "기존 기사 송금 확인에서 협력사 작업 제외")
- 기사 앱 송금 보고 대상에서 제외 (2-G "중복 청구 방지")
- 기존 매출 합계에 섞이지 않음 → 협력사 수수료는 **별도 칸으로 더해서** 표시 (D7-2)

`'B'` 와 비교하는 곳은 `AdminTaskDetailScreen.jsx:1262` 한 곳뿐이고 `usol_n` 조건이 함께 있어 영향이 없습니다. 값이 없을 때 `'A'` 로 보는 안전망(`tasksDb.js:286`, `v14Task.js:264`)은 payments 행이 아예 없을 때만 작동합니다.

### 2-4. 받은 금액과 추가금 트리거

`tasks.received_total` 을 넣으면 기존 트리거(mig 083)가 `extra_fee = 받은 금액 − 견적` 으로 맞춥니다. 받은 금액이 견적보다 적으면 `extra_fee` 는 0 으로 멈추므로, 협력사 경로는 `extra_fee` 가 아니라 **`received_total` 을 직접** 읽습니다. 이 트리거는 수정하지 않습니다.

### 2-5. 일자별 수수료 정산 (D7)

- 단위: 협력사 × 작업일(완료일, 한국 시간).
- **금액은 저장하지 않고 그날 완료 작업의 `payments.owner_amount` 합으로 매번 계산**합니다 (D7-1: 신고액이 아니라 올잇 계산). 운영자가 `입금 확인`을 누르는 순간의 건수·거래액·수수료를 사본으로 남겨, 나중에 작업이 수정돼도 확인 당시 금액을 볼 수 있게 합니다 (유솔N 주차 확정과 같은 방식, mig 185).
- 상태 4단계 (기사 송금의 4상태 판정 `AdminApp.jsx:7582-7596` 과 같은 틀, 표는 분리):

| 상태 | 조건 |
|---|---|
| 입금 대기 | 완료 작업 있음, 보고 없음, 기한 전 |
| 보고 | 협력사 관리자가 `입금했습니다` 누름 |
| 확인 완료 | 운영자가 `입금 확인` 누름 |
| 미입금 | 작업일 다음 날 12:00 까지 확인 완료가 아님 |

- 확인 후에 그날 작업이 추가 완료되거나 금액이 바뀌면 사본과 현재 합이 달라집니다 → 그 날짜 행에 "확인 후 변동 ₩N" 표시 (자동으로 상태를 되돌리지는 않음).

---

## 3. 화면 변경 목록

### 3-1. 운영자 (AdminApp / PC)

| 화면 | 변경 | 주요 파일 |
|---|---|---|
| 배정 추천 | 협력사가 맡는 종목의 작업이면 상단에 `협력사로 넘기기` (협력사 선택 → 직원 미지정 상태) + 협력사 직원 직접 지정도 가능. 직영 기사 추천 목록에는 협력사 직원을 섞지 않음 | `AdminApp.jsx` 9350·9785 부근, `AllEngineersModal.jsx`, `engineerRecommendation.js` |
| 작업 목록·상세 | 담당 표기 `화이트코어 · 직원명` (직원 미지정이면 `화이트코어 · 직원 미정`). 상세에 분배 내역 3줄: 고객 결제 / 올데이케어 수수료 / 협력사 몫 | `AdminTaskDetailScreen.jsx`, 3곳 매핑 |
| 홈 대시보드 | `협력사 작업 오늘 N건` 카드. "예정일 지남" 경보는 기존 계산(`AdminApp.jsx:4410-4425`, `AdminPcDashboard.jsx:117`)이 전체 작업 대상이라 협력사 작업이 자동 포함 → 행에 협력사 이름만 추가 | 좌동 |
| 정산 탭 › **협력사 수수료** (신규) | 상단 카드 4개(오늘 완료 / 고객 결제 합계 / 오늘 받을 수수료 / 미입금 누적) + 작업일별 행(건수·고객 결제·수수료·상태) + 펼치면 작업별 직원·결제액·사진 + 보고된 날짜에 `입금 확인` | 신규 `SubFeeSettleScreen.jsx`, `src/lib/subFeeDb.js` |
| 기사 송금 확인 | 코드 수정 없음 (track S 로 자동 제외). 제외되는지 검증만 | — |
| 매출 리포트·가계부 | "회사 수입" = 기존 owner 합 + 협력사 수수료. "협력사 거래액"은 참고 칸으로 따로. 서버 집계(mig 221)와 클라이언트 집계(`revenueStats.js`)를 **같이** 고쳐야 숫자가 어긋나지 않음 | `revenueStats.js`, `RevenueOverviewBlock.jsx`, `AdminPcRevenuePanel.jsx`, `AdminPcRevenueReport.jsx`, `AdminPcBookkeeping.jsx`, `AdminMobileBookkeeping.jsx` |
| 기사 관리 | 기사 편집에 `소속 협력사` 선택 (없음 = 직영) | `EngineerEditScreen.jsx` |
| 협력사 관리 (신규, 작게) | 협력사 목록·사업자 정보·관리자 계정 지정·수수료 규칙 입력 | 신규 |
| 접수 양식 | 종목 먼저 고르고 → 그 종목의 서비스 선택. 이전설치를 고르면 도착지 주소·상세 칸 노출 | `NewReceptionPcForm.jsx`, `receptionForm.js` |
| 서류 발행 | 발행처 기사를 고르면 그 기사 설정(`self`/`sub`)에 따라 사업자 표시. 어떤 사업자로 나가는지 화면에 명시 | `DocIssueScreen.jsx` |

### 3-2. 협력사 관리자 (신규 화면)

`src/App.jsx:229` 분기에 `sub_manager` → `SubManagerApp` 추가. 원청 화면(`PrincipalApp`) 코드는 **재사용하지 않습니다** — 원청 화면의 조회는 전부 브라우저가 정한 필터라서(조사 4번), 가져다 쓰면 D2 가 지켜지지 않습니다. 새 화면은 214·218 의 RPC 만 호출합니다.

| 탭 | 내용 |
|---|---|
| 작업 | 오늘 / 예정 / 완료. 큰 글씨 카드: 고객명·주소·시간·담당 직원. 직원 미정 건이 맨 위 |
| 배정 | 카드를 누르면 자기 직원 목록 → 한 번 눌러 지정·변경 |
| 수수료 입금 | 날짜별 행: 건수 · 고객 결제 합계 · **입금할 수수료** · 상태. 올데이케어 계좌 표시 + `입금했습니다` 버튼 하나 |
| 정산 내역 | 지난 날짜 목록 + 날짜를 누르면 작업별 내역 |

글자 크기·버튼 수는 기존 원청 PWA 수준으로 맞춥니다 (한 화면에 주 버튼 1개).

### 3-3. 기사 앱 (협력사 직원)

| 항목 | 변경 | 주요 파일 |
|---|---|---|
| 작업 목록 | 협력사 소속 기사는 **자기 협력사 작업 중 본인 배정분**만. 지금 기사 앱은 "열린 작업 전체"를 받아 수락 대기 목록을 만드는데(`tasksDb.js:771`), 협력사 직원은 이 경로 대신 `sub_staff_list_tasks` RPC 사용. 반대로 직영 기사 목록에는 협력사 작업이 나오지 않게 조건 추가 | `EngineerApp.jsx`, `tasksDb.js` |
| 완료 처리 | 실제 받은 금액 입력 **필수**, 0원 이하 차단. 입력 화면은 이미 있으므로(`EngineerTaskCompletionScreens.jsx`) 필수 검사만 추가. 서버 쪽에서도 협력사 작업은 받은 금액 없이 완료 상태가 되지 않게 213 트리거에서 차단 | 좌동 |
| 송금 보고 | 소속이 있는 기사는 개인 송금 보고 화면·배지 숨김 (track S 로 대상 0건이 되지만 메뉴 자체도 숨김) | `EngineerApp.jsx`, `EngineerSettlementScreen.jsx` |
| 내 정보 | `영수증 발급 사업자`: 본인 사업자 / 소속 협력사 사업자. 본인 사업자 정보가 비어 있는데 `본인`이면 발급 차단 + 안내 (차단·안내는 기존 것 재사용, `DocIssueScreen.jsx:739, 1083`) | `EngineerBusinessInfoCard.jsx` |
| 작업 카드 (이전설치) | `출발(철거)` / `도착(설치)` 두 블록. 블록마다 카카오맵·티맵·네이버지도 + 주소 복사. 좌표 있으면 길안내 형식, 없으면 지금의 주소 검색 형식 | `EngineerTaskDetailScreen.jsx:88-135` 의 세 함수를 "주소·좌표를 받는" 형태로 일반화 |

### 3-4. 이전설치 동선 (D10)

- 저장: 접수·수정 저장 직후 서버 함수가 주소 → 좌표 변환, `lat/lng`, `dest_lat/dest_lng` 기록. 변환 실패해도 저장은 성공 (좌표만 비어 있음).
- 추천 지역: 수정 없음. 기존 `address`/`district` 가 출발지입니다.
- 동선: `assignRoute.js:148` `buildDaySchedule` 이 만드는 하루 블록에 "끝나는 위치"를 추가합니다. 일반 작업은 시작 위치와 같고, 이전설치는 도착지입니다. `routeVerdict` 는 빈 시간대마다 **앞 작업의 끝 위치**와 **뒤 작업의 시작 위치**를 기준으로 거리를 봅니다. 좌표가 있으면 좌표, 없으면 지금처럼 구 중심점.
- 철거일 ≠ 설치일: 작업 2건 + `linked_task_id`. 철거 건은 `address` = 출발지, 설치 건은 `address` = 도착지로 저장 → 각 건의 추천·동선은 기존 로직 그대로. 상세 화면에 "연결된 작업" 한 줄.
- 3곳 매핑: 새 칸 7개를 `rowToTask` / `v14NormalizeTask` / `_v14NormalizeTask` + `taskToRow` + `EngineerApp.jsx:239` 부근에 동시 추가. tasks 조회는 `*` 라서 select 문자열 추가는 필요 없고, payments 쪽에 칸을 늘리지 않으므로 `PAYMENT_SELECT` 도 그대로입니다.

---

## 4. 종목 2단계 (D9)

### 4-1. 지금 구조 (조사 2번)

- `categories` 는 에어컨 1행뿐이고 **읽는 코드가 없습니다** (id 가 상수로 고정). `tasks.category_id` 는 전 작업이 에어컨이라 구분에 쓰이지 않습니다.
- 서비스는 작업에 **한글 이름**으로 저장됩니다 (`tasks.category_data.workType`, `workItems[].workType`). 저장 시 트리거(mig 205)가 이 이름을 `service_types.name` 과 **정확히 같은 글자**로 찾아 `task_items` 를 만들고, 이름이 없으면 저장을 거부합니다.
- `hood` / `grave` / `move_in` 은 접수 문의(`inquiries`)에만 있고 `service_types` 행이 없습니다 → 지금은 이 종목으로 작업을 저장할 수 없습니다.
- 이전설치는 별도 서비스 코드가 아니라 **설치(`install`) 밑의 작업 이름**입니다. 설치 정산은 코드가 아니라 계산 방식 `직영_75_25` 로 판정됩니다.
- 새 종목이 추가되면 손대지 않은 화면에서는 "기타"로 떨어집니다: 추천 기사 풀은 세척/냉매 2분법(`engineerRecommendation.js:43`), 화면 종류는 5종(`workTypeKind.js`), 매출은 other.

### 4-2. 설계

| 종목 (`categories`) | 서비스 (`service_types.code`) | 상태 |
|---|---|---|
| 에어컨 `aircon` | cleaning / refrigerant / install / leak / … | 기존 그대로 |
| 에어컨 | 이전설치 | **서비스 코드를 새로 만들지 않음.** 지금처럼 설치 밑의 작업 이름으로 두고, 화면에서만 에어컨 › 이전설치 로 따로 보이게 함 → 설치 정산(80/20)이 그대로 유지됨. 이전설치 여부는 "도착지 주소가 있는가"로 판정 |
| 주방후드 `hood` | 업소용 / 가정용 / 설치 | 신규 종목 + 서비스 3행 |
| 입주청소 `move_in` | 입주청소 | 신규 종목 + 서비스 1행 |
| 벌초 `grave` | 벌초 | 신규 종목 + 서비스 1행 |
| 누수 | water_leak | **지금은 에어컨 종목 밑에 등록돼 있음** (mig 195). 행을 옮기면 "기존 데이터 변경 없음"에 어긋나므로, 표시용 칸(`service_types.display_category_id`)만 추가해 화면에서 누수 종목으로 보이게 하는 안 → Q3 |

- 접수 문의(`inquiries.service_type`)는 이미 `hood` / `grave` / `move_in` 을 받습니다 (mig 211). 문의 → 작업 전환 때 같은 코드의 종목으로 연결합니다.
- 새 종목 작업은 `tasks.category_id` 에 새 종목 id 가 들어갑니다. 에어컨 id 가 코드에 고정된 곳(`tasksDb.js:13`, `commissionPoliciesDb.js`, `usolNTasksDb.js`)은 접수 저장 경로만 종목을 받도록 고칩니다.
- 215 에는 새 서비스마다 `work_types` 행까지 넣어야 저장 트리거를 통과합니다. 접수 화면이 보내는 한글 이름과 `service_types.name` 이 한 글자라도 다르면 저장이 거부되므로, 이름 표를 한 곳(공용 상수)에서만 읽게 합니다.
- 협력사 작업은 2장의 분기가 `commission_policies` 조회보다 먼저 실행되므로 주방후드용 정책 행이 없어도 계산이 멈추지 않습니다. 반대로 **직영 기사가 주방후드 작업을 맡으면** 정책 행이 없어 계산 오류가 납니다 → 215 적용 시점에는 주방후드를 협력사 전용으로 두고, 직영 처리가 필요해지면 그때 정책 행을 추가합니다.
- 추천 기사 풀: 새 종목은 세척/냉매 풀로 떨어지지 않게, 협력사가 맡는 종목이면 협력사 직원만 후보로 보여 줍니다.
- 매출 리포트 서비스별 칸: 새 종목은 우선 "기타"에 합산되고, 협력사 작업은 별도 칸(2장)이라 기존 칸에 섞이지 않습니다.
- **적용 전 확인 1건**: mig 195 의 누수 서비스 id 가 mig 034 의 송풍팬분해 id 와 같은 값으로 적혀 있습니다. 둘 다 "이미 있으면 건너뜀" 방식이라 운영 DB 에 누수 서비스 행이 실제로 있는지 확인이 필요합니다 → `SELECT id, code, name FROM service_types ORDER BY code;` 결과를 한 번 보여 주시면 됩니다.
- 서비스 코드가 코드에 직접 들어가 있는 위치와 "새 서비스 추가 시 손대야 하는 곳"은 조사 문서 2번 표를 작업 목록으로 씁니다.

---

## 5. 기존 원청 정산이 바뀌지 않는다는 검증 방법

### 5-1. 구조상 보장

1. v30 은 v29 본문을 복사한 뒤 **맨 앞 분기만** 추가합니다. 적용 전에 두 SQL 파일을 줄 단위로 비교해 추가된 구간 외 차이 0줄을 확인하고, 그 비교 결과를 보고에 첨부합니다.
2. 새 분기의 조건은 `tasks.subcontractor_id IS NOT NULL` 하나입니다. 212 적용 직후 이 값은 전 작업 NULL 입니다.
3. `calculate_commission`, `commission_policies`, 기존 트리거(mig 083·173·174)는 수정하지 않습니다.
4. 기존 작업에 대한 재계산 UPDATE 를 실행하지 않습니다.

### 5-2. 드라이런 (217 본 적용 전, 사장님이 SQL Editor 에서 실행)

`compute_payment_v30_dryrun(task_id)` — 계산만 하고 **저장하지 않는** 함수 (기존 `177_dryrun.sql` 방식).

```
검증 A (필수, 합격선 = 차이 0건)
  최근 완료 500건에 대해
    v30 드라이런 결과  vs  지금 저장된 payments (기사 몫 / 원청 몫 / 회사 몫 / track / calc_method)
  → 차이 나는 작업 번호 목록 출력

검증 B (A 에서 차이가 나올 때 원인 구분용)
  같은 500건에 대해
    v30 드라이런  vs  v29 드라이런(현재 함수를 같은 방식으로 저장 없이 실행)
  → 여기서 0건이면 새 함수 때문이 아니라 "저장된 값이 과거 규칙으로 계산된 뒤 재계산되지 않은 건"
```

검증 B 를 두는 이유: v29 안에는 날짜로 갈리는 규칙이 있고(출장비 7/15, 설치 7/29) 금액 수정 후 재계산이 안 된 옛 건이 있을 수 있어, 저장값과의 차이가 곧 v30 의 문제는 아닙니다. **A 가 0건이면 바로 통과, A 에 차이가 있으면 B 가 0건이고 차이 건을 사장님이 확인한 뒤에만 적용**합니다.

원청별 건수도 함께 출력해 500건 안에 7개 원청과 세척·냉매·설치·누수·출장비·취소 건이 모두 들어 있는지 확인합니다. 빠진 유형은 그 유형만 최근 20건씩 추가로 돌립니다.

### 5-3. 적용 후 확인

| 확인 | 방법 | 합격선 |
|---|---|---|
| payments 무변경 | 217 적용 전후로 `payments` 전체의 (행 수, 세 금액 합계, track 별 건수) 스냅샷 비교 | 완전 일치 |
| 매출 숫자 | 적용 전 이번 달·지난달 매출 리포트 화면 숫자(총액/기사/원청/회사, 서비스별)를 캡처 → 221 + 코드 push 후 같은 화면 | 기존 칸 숫자 변화 0, 협력사 칸은 0 |
| 서버·클라이언트 집계 일치 | 같은 기간을 `get_admin_dashboard_summary_range` 와 `computeRevenueByYmRange` 로 계산 | 일치 |
| 기사 송금 화면 | 적용 전후 오늘·어제 송금 대상 건수·금액 | 변화 0 |
| 원청 화면 | 원청 계정(KA, 유솔 통합)으로 로그인해 목록·정산 탭 건수 | 변화 0, 협력사 작업 미노출 |

### 5-4. 협력사 경로 자체 검증

화이트코어 시험 작업 3건(율 규칙 / 정액 규칙 / 받은 금액이 견적보다 적은 경우)을 만들어 완료 → 분배 3줄, 일자별 수수료 합, 보고 → 확인 → 가계부 수입 1행, 기사 송금 화면 미노출을 PWA 실화면에서 확인. 시험 작업은 확인 후 취소 처리합니다.

---

## 6. 보안 — 이번 범위와 범위 밖

**이번에 지키는 것 (D2)**
- 협력사 관리자·직원의 조회·배정·보고는 전부 214·218 의 RPC. 함수 안에서 호출자의 `subcontractor_id` 를 DB 에서 다시 읽어 대상 작업·직원과 대조합니다. 브라우저가 보낸 협력사 id 는 믿지 않습니다.
- 안 B (권장): 로그인 성공 시 임의 세션 값을 발급해 DB 에 해시로 저장하고, 새 RPC 는 `p_actor` 와 세션 값을 함께 받아 일치할 때만 동작. `p_actor` 만 바꿔 넣는 위조가 막힙니다. 기존 RPC·기존 앱은 건드리지 않습니다.

**이번 범위로 막지 못하는 것 (알고 가야 하는 것)**
- `tasks` 는 anon 키로 직접 조회가 되는 상태로 보입니다(실제 DB 정책 확인 필요). 모든 앱이 같은 키를 쓰므로, 개발 도구를 다룰 줄 아는 사람은 화면과 무관하게 작업 전체를 읽을 수 있습니다. 이를 닫으려면 운영자·기사·원청 앱의 조회를 전부 RPC 로 옮겨야 해서 별도 작업입니다.
- 지금도 열려 있는 쓰기 구멍 (조사 3번): `payments` 전 행 수정 가능(mig 026 정책), `engineer_rates` 수정·삭제 가능(mig 012), `photos`·사진 저장소 전면 허용(mig 023), `tasks`/`task_items` 직접 수정.

**제안**: 외부 회사 계정을 만들기 전에 `payments` 와 `engineer_rates` 두 정책만이라도 먼저 정리 (별도 지시문). 실제 정책 확인용 조회문은 조사 문서 3번 끝에 있습니다.

---

## 7. 사장님께 여쭙는 것

| # | 질문 | 제 제안 |
|---|---|---|
| Q1 | 협력사 테이블·칸 이름을 `subcontractors` / `subcontractor_id` / role `sub_manager` 로 해도 될까요? (`partner` 는 이미 원청 담당자 뜻) | 예 |
| Q2 | 화이트코어 수수료: 율인가요 정액인가요? 정액이면 **건당**인가요 **대(수량)당**인가요? 기준 금액은 고객이 낸 전체(추가금·출장비 포함)인가요? | 율 × 받은 금액 전체가 가장 단순 |
| Q3 | 누수를 화면에서 에어컨 밑이 아닌 별도 종목으로 보이게 할까요? (DB 행은 그대로, 표시만) | 예 |
| Q4 | Vercel 플랜이 무료(함수 12개 한도)인가요? 그렇다면 좌표 변환을 기존 서버 함수 하나에 합치겠습니다 | 플랜 확인 후 결정 |
| Q5 | 협력사용 RPC 에 세션 값 확인(안 B)을 넣을까요? 로그인 RPC 수정 + 새 표 1개가 추가됩니다 | 예 |
| Q6 | 화이트코어 직원에게 직영 작업(에어컨 등)도 보이거나 배정될 수 있어야 하나요? | 아니오 — 자기 협력사 작업만 |
| Q7 | 정오 미입금 푸시용 예약 실행: Supabase `pg_cron` 을 켜도 될까요? (대시보드에서 확장 1회 활성화) | 예. 안 되면 Vercel Cron |
| Q8 | 협력사 관리자가 현장 직원을 겸하나요? | 겸하면 role 2개(`sub_manager` + `engineer`) 부여, 기존 역할 전환 버튼 사용 |
| Q9 | 철거일과 설치일이 달라 2건이 될 때 금액은 어느 건에 넣나요? | 설치 건에 전액, 철거 건은 0원 |
| Q10 | 한 작업에 서비스가 섞인 경우(예: 후드 업소용 + 설치) 수수료 규칙은 대표 서비스 하나로 적용해도 될까요? | 예 — 대표 항목 기준 |

사전 준비(지시문 그대로): 카카오 REST API 키 → Vercel env `KAKAO_REST_API_KEY`, 화이트코어 직원 명단(이름·전화·사업자 여부).

---

## 8. 다음 단계

사장님 OK + Q1~Q10 답을 받으면 **묶음 1 (212 → 213 → 214)** SQL 파일부터 작성합니다. 각 묶음은 "SQL 저장 → 사장님 실행 → 코드 push → PWA 실화면 확인" 순서를 지키고, 묶음 3 은 5-2 드라이런 결과를 보고드린 뒤에만 본 적용합니다.

---

## 9. 2026-10-06 갱신 — 사장님 결정 반영

이 장이 위 본문과 다르면 이 장이 우선합니다. 상세는 `docs/precheck_bundle0_1.md`.

| 항목 | 결정 | 본문에서 바뀌는 곳 |
|---|---|---|
| Q1 | `subcontractors` / `subcontractor_id` / `sub_manager`, 화면 글자는 "협력사" | 확정 |
| 협력사 관리자 저장 위치 | `user_roles` 가 아니라 `users.sub_role` (`manager`/`staff`). 기존 권한 저장 함수가 role 행을 지우고 다시 쓰기 때문 | 1장 212 행의 ④ (user_roles CHECK·인덱스 변경) 삭제 |
| Q5 | 세션 확인 추가, 공용 함수 `_session_check` / `_session_check_strict` | 묶음 0 의 211a |
| Q6 | 협력사 직원은 자기 협력사 작업만. 추천·자동배정·배정 푸시 후보에서 협력사 소속 기사 제외 | 213 (서버), 묶음 1 코드 |
| 묶음 0 신설 | `payments`·`engineer_rates` 전체 수정 허용 정책 닫기 (211a → 코드 → 211b) | 1장 순서 맨 앞 |
| 좌표·geocode | 보류. 도착지 주소 + 기존 주소 검색 내비 버튼 재사용 | 220 에서 `lat`/`lng`/`dest_lat`/`dest_lng` 제외, `api/geo/geocode.js` 없음, Q4 해소. 동선은 지금처럼 구 중심점 기준(도착지 구) |
| 미입금 푸시 | 보류. 화면을 열 때 계산해 빨강 표시 | 222 삭제, Q7 해소 |
| 수수료 | 화이트코어 × 주방후드 = 고객 결제 총액의 35%. 출장비만 받은 건도 35% | 216·217. Q2 해소 |
| 수수료 기준 | VAT 포함 / 공급가는 확정 후 반영. `fee_rules.fee_base` (`gross`/`supply`) 로 둘 다 계산 가능하게 | 216 |
| 결제금액 안내 문자 | 작업 완료 시 고객에게 발송 (발신명 올데이케어) | 묶음 3. `api/sms/send.js` push·배포 확인 후 SQL |
| 주방후드 | `categories` 에 주방후드, `service_types` 에 업소용/가정용/후드설치. id 고정 없이 code 기준 | 215 |
| 서비스 id | 누수 실제 id 확인됨(충돌 없음). mig 195 파일만 code 기준으로 정정. 이후 전부 code 기준 | 4장 "적용 전 확인 1건" 해소 |
| `payments.track` | CHECK `('A','B')` 있음 → 217 에서 `'S'` 추가. `'S'` 가 A 로 섞이는 track 비교는 0건, track 을 안 보는 표시 6곳은 묶음 1·3 수정 목록에 포함 | 2-3 |
| 누적 이월 | `bookkeeping_cumulative_carryover` 가 A·B 수입만 더함 → 묶음 3 에서 협력사 수수료 수입 추가 | 221 에 포함 |

### 9-1. 추가 결정 (2026-10-06, 2차)

| 항목 | 결정 | 반영 묶음 |
|---|---|---|
| 211c | 사용자 권한 함수 3개(계정 추가·수정 / 역할 변경 / 비밀번호 초기화)에 세션 확인 필수. 묶음 1 코드보다 먼저 | 묶음 0 에 포함 |
| 실행 순서 | 211a → 211c → 코드 push → PWA 확인 → 212·213·214 → (기사 전원 새 버전 확인 후) 211b | — |
| 211b 조건 | 날짜가 아니라 "기사 전원 새 버전". 조회문 `db/ops/check_engineer_app_versions.sql` | 묶음 0 |
| 화이트코어 수수료 (확정) | **공급가액의 35%.** 직원이 완료 시 공급가액을 직접 입력. 수수료 = 입력 공급가 × 35%, 원 단위 반올림. 출장비만 받은 건도 동일. 위 9장의 "고객 결제 총액의 35%" 와 "기준 확정 후 반영" 을 대체 | 묶음 3 (216·217) |
| 입력 화면 | 칸 이름 "공급가액 (부가세 제외)". 입력 즉시 아래에 부가세·합계 자동 표시(직원 확인용) | 묶음 3 기사 앱 |
| 저장 칸 | `tasks` 에 공급가액 칸 추가(예: `supply_amount`). 합계(공급가 + 부가세 10%)는 기존 `received_total` 에 저장해 고객 결제액·거래액 표시와 맞춤. 3곳 매핑 대상 | 묶음 3 |
| `fee_rules` | '공급가 기준' 구분 칸(`fee_base`: `supply` / `gross`). 화이트코어 = `supply` | 216 |
| 완료 문자 | 고객 완료 문자에 공급가와 합계 둘 다 표시 (발신명 올데이케어). `api/sms/send.js` push·배포 확인 후 SQL | 묶음 3 |
| 기사 앱 수익 카드 3곳 | 협력사 소속 기사는 숨김 (`EngineerApp.jsx:987-989, 4644`, `EngineerSettlementScreen.jsx`, `dashboardStats.js:248`) | **묶음 1 코드** |
| 원청별 표 2곳 | `allday` 행과 협력사 행 분리 (`AdminPcDashboard.jsx:1156-1180`, `StatsHubScreen.jsx:147-178`) | **묶음 1 코드** |
| 기사별 회사 기여 | 협력사 직원 제외 (`AllEngineersModal.jsx:74-86`) | **묶음 1 코드** |
