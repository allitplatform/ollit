# 묶음 0·1 착수 전 확인 보고

작성 2026-10-06 · 대상: `src/`, `api/`, `db/migrations/` (사본 제외) · 운영 DB 는 조회하지 않음(사장님이 주신 서비스 id 확인 결과만 반영)

---

## 1. track 비교 전수조사 — `'S'` 가 `'A'` 로 섞이는 곳

### 1-1. track 값을 직접 비교하는 곳 (전부)

| 위치 | 비교 방식 | `'S'` 일 때 | 판정 |
|---|---|---|---|
| `src/utils/remitFilter.js:54-55` `isTrackARemittance` | `track === "A"` (값 없으면 `"A"`) | 제외 | 안전 |
| `src/components/admin/SettlementHistoryContent.jsx:680-681` | `p?.track \|\| "A"` 후 `=== "A"` | 제외 | 안전 (KA·crikrin 원청만 조회) |
| `src/components/AdminTaskDetailScreen.jsx:1262` | `usol_n` 이고 `=== "B"` | 해당 없음 | 안전 |
| `src/lib/usolNWeeklyData.js:303, 629, 796` | `.eq("track","B")` | 제외 | 안전 |
| `src/lib/refrigerantAddonsDb.js:176` | `data.track \|\| "A"` (표시용) | 해당 없음 | 안전 |
| SQL `get_admin_dashboard_summary` (mig 175:119), `_range` (mig 176:84) | `p.track = 'A'` | 제외 | 안전 — 묶음 3 에서 수수료 칸을 **추가**해야 화면에 나옴 |
| SQL `bookkeeping_cumulative_carryover` (mig 129:116, 129) | `= 'A'` 수입 / `= 'B'` 수입 | **둘 다 제외** | ⚠ 누적 이월에 협력사 수수료가 빠짐 → 묶음 3 에서 S 수입 추가 필요 |
| SQL 유솔N 계열 (mig 123, 130, 155, 184, 185) | `= 'B'` | 제외 | 안전 |
| SQL 항목 수정 계열 (mig 189, 201) | `usol_n` 이고 `= 'B'` 면 차단 | 해당 없음 | 안전 |
| SQL `compute_payment` (mig 200) / 취소 (mig 073:288) | `v_track IS NULL` 이면 `'A'` | 해당 없음 | 안전 |

**`!== 'B'`, `<> 'B'`, `else` 로 "B 가 아니면 일일정산" 처리하는 곳은 `src/`·`api/`·SQL 모두 0건입니다.** track 을 보는 곳은 전부 `= 'A'` 또는 `= 'B'` 명시 비교입니다.

안전망 3곳 (`tasksDb.js:286`, `v14Task.js:264`, `AdminApp.jsx:704`): 값이 **없을 때만** `'A'` 로 채웁니다. `'S'` 는 값이 있으므로 그대로 통과합니다. payments 행이 아직 없는 작업(완료 전)은 `'A'` 로 보이지만 완료 상태가 아니라 집계 대상이 아닙니다.

### 1-2. track 을 안 보고 다른 기준으로 "일일정산"을 판정하는 곳 ← 여기서 섞입니다

| # | 위치 | 판정 기준 | 협력사 작업이 들어오면 | 조치 (묶음) |
|---|---|---|---|---|
| M1 | `src/pages/AdminPcDashboard.jsx:1156-1161, 1173, 1180` 오늘 원청별 표 | 원청 코드 ≠ `usol_n` 이면 회사 몫 합산 | `allday` 행의 완료 건수·회사 몫에 섞임 (금액은 수수료라 틀리진 않으나 직영과 구분 안 됨) | 협력사 작업은 별도 행으로 분리 (묶음 3) |
| M2 | `src/components/admin/StatsHubScreen.jsx:147-153, 165, 178` 기간 통계 | 같음 | 같음 | 같음 (묶음 3) |
| M3 | `src/components/AllEngineersModal.jsx:74-86` 기사별 최근 30일 회사 기여 | 완료 상태면 전부 | 협력사 직원 줄이 생기고 평균에 수수료가 들어감 | 협력사 소속 기사 제외 — Q6 추천 제외와 같은 수정 (묶음 1 코드) |
| M4 | `src/pages/EngineerApp.jsx:987-989, 4644` 기사 앱 오늘·주·월 수익 | 완료 상태면 `engineer_amount` 합 | 협력사 직원 화면에 **협력사 몫 전체가 "내 수익"** 으로 표시 | 소속 기사는 수익 카드를 "오늘 받은 금액"으로 교체 (묶음 3, 2-G) |
| M5 | `src/components/EngineerSettlementScreen.jsx:84-93, 140-147` | 완료 + 원청 ≠ `usol_n` | 같음 | 같음 (묶음 3) |
| M6 | `src/utils/dashboardStats.js:248-250` 기사 오늘 수익 | 완료 상태 | 같음 | 같음 (묶음 3) |
| M7 | `src/pages/AdminApp.jsx:7444-7452, 7830` 원청 일별 입금 카드 | 원청 코드 ≠ `usol_n` | 입력 목록이 `isRemittanceTarget`(track A) 기준이라 **섞이지 않음** | 없음 (묶음 3 때 화면 확인만) |
| M8 | `src/lib/partnerDailySettleDb.js:59-100` 원청 일일정산 | 원청 id | 화이트코어 작업의 원청은 `allday` 라 원청 계정 화면에는 나오지 않음 | 없음 |

정리: **`'S'` 가 기사 송금 대상이나 매출 합계(`isTrackARemittance` 경로)로 섞이는 곳은 없습니다.** 섞이는 곳은 track 을 보지 않는 M1~M6 이고, 모두 표시 문제입니다(정산 금액 계산에는 영향 없음). M3 은 묶음 1, 나머지는 묶음 3 수정 목록에 넣습니다.

---

## 2. `payments.track` CHECK 제약

**있습니다.** `db/migrations/031_add_payments_track.sql:59-60`

```sql
ADD COLUMN IF NOT EXISTS track CHAR(1) NOT NULL DEFAULT 'A'
  CHECK (track IN ('A', 'B'));
```

- 칸 정의에 붙은 제약이라 이름은 자동 생성(`payments_track_check` 로 예상). 이후 마이그레이션에서 바꾼 적 없음.
- `'S'` 를 그대로 저장하면 제약 위반으로 실패합니다 → 묶음 3 의 217 에서 제약을 `('A','B','S')` 로 교체합니다. 이름을 추측하지 않고 `pg_constraint` 에서 찾아서 교체하도록 작성합니다.
- 인덱스 `idx_payments_track` 는 그대로 사용 가능.

---

## 3. 묶음 0 — `payments`(mig 026)·`engineer_rates`(mig 012) 정책 닫기

### 3-1. 지금 상태

| 표 | 정책 | 내용 |
|---|---|---|
| payments | `payments_anon_update` (mig 026) | 누구나 전 행·전 칸 UPDATE |
| payments | `payments_anon_select` (mig 020) | 조회 — 유지 |
| engineer_rates | `engineer_rates_anon_insert / update / delete` (mig 012) | 누구나 추가·수정·삭제 |
| engineer_rates | `engineer_rates_anon_select` | 조회 — 유지 |

### 3-2. 이 정책에 기대는 코드

| 위치 | 동작 | 호출처 | 조치 |
|---|---|---|---|
| `src/lib/paymentsDb.js` `reportEngineerRemit` | 기사 입금 보고 | `EngineerApp.jsx:5363`, `PaymentHistoryScreen.jsx:15` | RPC `engineer_report_remit` 로 교체 |
| `src/lib/paymentsDb.js` `reportUsolRemit` | 유솔 입금 보고 | `EngineerApp.jsx:5336` | RPC `engineer_report_usol_remit` 로 교체 |
| `src/lib/engineerRatesDb.js` `upsertEngineerRateToDb` | 단가 저장 | `src/data/engineers.js:820` | RPC `admin_upsert_engineer_rate` 로 교체 |
| `src/lib/engineerRatesDb.js` `deleteEngineerRateFromDb` | 단가 삭제 | `src/data/engineers.js:841` | RPC `admin_delete_engineer_rate` 로 교체 |
| `paymentsDb.js` `confirmEngineerRemit` / `cancelEngineerRemit` / `cancelConfirmRemit` | 직접 UPDATE | **호출처 없음** (mig 156 RPC 로 이미 전환됨) | 그대로 둠. 정책을 닫으면 동작하지 않는 죽은 코드 — 정리는 별도 |

서버 쪽: `payments` 를 고치는 SQL 함수 12개(`compute_payment`, 트리거 2개, 취소·출장비·항목 수정, 입금 확인 등)는 전부 `SECURITY DEFINER` 라 정책을 닫아도 영향이 없습니다. `engineer_rates` 를 고치는 SQL 함수는 없습니다.

### 3-3. 작성한 것

| 파일 | 내용 | 실행해도 되는 시점 |
|---|---|---|
| `db/migrations/211a_session_and_guard_rpcs.sql` | 세션 표 + 공용 확인 함수 + 로그인 응답에 세션 값 + 대체 RPC 4개. **추가만 함** — 실행해도 기존 앱 동작 그대로 | 지금 |
| 코드 3개 (`src/lib/auth.js`, `paymentsDb.js`, `engineerRatesDb.js`) | 직접 쓰기 4곳을 RPC 호출로 교체. 화면 코드는 수정 없음 | 211a 실행 뒤 push |
| `db/migrations/211b_close_open_write_policies.sql` | 정책 4개 삭제 + 실행 전후 확인 조회 + 되돌리기 구문 | **배포 2~3일 뒤** |

수정 전 사본: `src/lib/*.before-guard-rpc-261006` (git 제외 대상).

### 3-4. 주의 — 211b 를 서두르면 안 되는 이유

앱은 새 버전이 "다음에 열 때" 적용됩니다(`public/service-worker.js:13` — 자동 새로고침 없음). 옛 버전이 남은 폰에서 211b 이후 입금 보고를 누르면 **오류 없이 "성공"으로 보이지만 저장되지 않습니다** (정책이 없으면 UPDATE 가 0행으로 조용히 끝남). 그래서 211b 는 배포 후 기사 전원이 앱을 한 번 닫았다 연 뒤에 실행해야 합니다.

### 3-5. 동작이 달라지는 점 (의도된 것)

- 입금 보고는 **본인에게 배정된 작업만** 됩니다 (운영자는 전체 가능). 이전에는 작업 id 만 알면 누구 것이든 됐습니다.
- 운영자가 이미 `입금 확인` 한 건은 기사가 다시 보고해도 시각이 바뀌지 않습니다.
- 단가표 저장·삭제는 운영자 계정만 됩니다.

### 3-6. 이번에 닫지 않는 것 (조사 3번에서 나온 나머지)

`tasks`·`task_items` 직접 수정, `photos`·사진 저장소 전면 허용, `raw_orders`, `task_changes`. 기사·원청 앱의 핵심 흐름이 여기에 기대고 있어 RPC 전환 범위가 큽니다. 협력사 화면은 이 경로를 쓰지 않도록 새 RPC 로만 만들고, 기존 구멍은 별도 묶음으로 제안드립니다.

---

## 4. 세션 확인 — 기존 운영자 RPC 적용 목록과 순서 (Q5)

### 4-1. 공용 함수 (211a)

| 함수 | 용도 |
|---|---|
| `_session_check(p_actor, p_token)` | 유예 모드 지원. 세션 값이 없으면 통과(스위치가 꺼져 있을 때), 있으면 반드시 본인 것이어야 통과 |
| `_session_check_strict(p_actor, p_token)` | 항상 필수. 협력사 RPC 용 |
| `_session_required()` | 스위치 — `tenants.settings.session_required` (기본 꺼짐). SQL 한 줄로 전체 강제 전환 |

적용 방법은 RPC 마다 같습니다: 인자 끝에 `p_token text DEFAULT NULL` 추가 + 본문 맨 앞에 확인 3줄. 인자가 늘면 함수 서명이 바뀌므로 **옛 서명을 지우지 않고 새 서명을 추가**했다가, 앱 전환이 끝난 뒤 옛 서명을 지웁니다(옛 앱 버전이 깨지지 않게).

### 4-2. 적용 순서

| 단계 | 대상 (저장소 기준 RPC) | 수 | 이유 |
|---|---|---|---|
| 0 (완료) | `engineer_report_remit`, `engineer_report_usol_remit`, `admin_upsert_engineer_rate`, `admin_delete_engineer_rate` | 4 | 묶음 0 신규 — 처음부터 적용 |
| 1 | 협력사 RPC 전부 (`sub_*`, `admin_*_subcontractor*`) | 묶음 1·3 | 신규 — `_strict` 로 시작 |
| 2 **사용자 권한** | `admin_set_user_roles`, `admin_upsert_user`, `admin_reset_user_password`, `admin_upsert_engineer`, `admin_delete_engineer`, `change_password` | 6 | 여기가 뚫리면 다른 모든 확인이 무의미 (스스로 운영자 role 부여 가능) |
| 3 **계좌** | `update_principal_account`, `admin_set_tenant_ops_phone`, `upsert_engineer_business_info`, `get_engineer_business_info`, `issue_document` | 5 | 입금 계좌·사업자 정보 변조 방지 |
| 4 **정산 확정** | `confirm_engineer_remit_with_cashflow`, `cancel_confirm_engineer_remit_with_cashflow`, `confirm_principal_remittance`, `mark_principal_remitted`, `undo_principal_remit`, `mark_principal_daily_remit`, `undo_principal_daily_remit`, `mark_usoln_payout_by_item`, `mark_usoln_payout_by_month`, `refund_usoln_payout`, `mark_usoln_engineer_settled_by_month`, `unmark_usoln_engineer_settled_by_month` | 12 | 돈이 움직인 기록 |
| 5 **정산 금액** | `admin_update_task_item`, `admin_insert_task_item`, `admin_remove_task_item`, `admin_change_task_item_type`, `set_material_cost`, `admin_set_cancel_compensation`, `admin_full_cancel`, `admin_partial_cancel_item`, `admin_restore_canceled_task`, `unmark_visit_only` | 10 | 정산 결과를 바꾸는 수정 |
| 6 **가계부** | `bookkeeping_*` 쓰기 14개 (`add/update/delete_expense`, `cashflow_add/update/delete/day_close/baseline_set`, `set/delete_distribution`, `set_carryover`, `add/update/delete_other_income`, `set/delete_usoln_adjustment`) | 14~16 | 운영자 전용 화면 |
| 7 | 나머지 (메시지·공지·문의·일정 변경 등) | 약 30 | 위험 낮음 |
| 마지막 | 스위치 켜기 (`session_required = true`) + 세션 값 없는 기기는 앱이 로그인 화면으로 보내기 | — | 2~6 단계와 전원 재로그인 후 |

단계 2~6 은 협력사 작업과 독립이라 묶음 사이에 끼워 넣을 수 있습니다.

**단계 2 는 외부 계정 발급 전 필수로 권합니다.** `db/migrations/103_admin_user_rpcs.sql` 을 읽어 확인한 결과, `admin_set_user_roles`(223행) · `admin_upsert_user`(59행) · `admin_reset_user_password`(310행)의 호출자 검사는 `_caller_is_admin(p_actor)` 하나뿐입니다. `p_actor` 는 브라우저가 보내는 값이고 사용자 id 는 `users` 조회로 읽을 수 있으므로, 운영자의 id 를 넣어 호출하면 **운영자 비밀번호 재설정까지 가능한 구조**입니다. 지금도 열려 있는 문제이며, 세션 확인을 붙이면 닫힙니다. 묶음 1 실행과 병행해 단계 2 SQL(215 이전 번호로 211c)을 먼저 드리는 것을 제안합니다.

### 4-3. 협력사 관리자 role 을 저장하는 위치 (설계 변경 1건)

`admin_set_user_roles` 는 저장 때 "원청 연결이 없는 role 행을 전부 지우고 다시 넣습니다"(103:262). `user_roles` 에 `sub_manager` 행을 두면 운영자가 그 사용자 권한을 편집하는 순간 지워지므로, **협력사 소속과 관리자 여부는 `users.subcontractor_id` + `users.sub_role`(`manager`/`staff`)에 둡니다.** `user_roles` 의 제약·인덱스·기존 권한 함수는 건드리지 않습니다. 로그인 응답의 `roles` 에는 `sub_manager` 가 들어가므로 앱 화면 분기는 Q1 에서 정한 이름 그대로입니다.

---

## 5. 서비스 id `…444444444008` 사용처

| 위치 | 용도 | 의도 | 조치 |
|---|---|---|---|
| `db/migrations/034_usol_n_addon_seeds.sql:8` | `service_types` 송풍팬분해 행의 id | 송풍팬분해 | 정상 — 그대로 |
| `db/migrations/034_usol_n_addon_seeds.sql:14` | `work_types` 송풍팬분해/층고 의 서비스 연결 | 송풍팬분해 | 정상 — 그대로 |
| `db/migrations/195_water_leak_service.sql:23` | `service_types` 누수 행의 id | **누수** | **파일 정정 완료** (아래) |
| `src/`, `api/`, `scripts/` | — | — | 사용처 0건 |

- **누수 의도로 이 id 를 쓴 곳은 mig 195 한 줄뿐**입니다. 195 의 나머지 부분(작업 행 생성, 정책 복제)과 mig 196 은 처음부터 `code = 'water_leak'` 로 찾기 때문에 영향이 없었습니다.
- 정정 내용: id 를 적지 않고 `categories.code = 'aircon'` 조회 + `ON CONFLICT (category_id, code) DO NOTHING` 방식으로 변경, 정정 사유와 실제 id 를 주석에 기록. **운영 DB 에는 실행하지 않습니다.** 원본은 `195_water_leak_service.sql.before-idfix-261006`.
- 앞으로 서비스 추가·참조는 code 기준으로만 작성합니다 (215 포함).

---

## 6. 반영한 결정 (설계 문서 갱신 대상)

| 결정 | 반영 위치 |
|---|---|
| Q1 `subcontractors` / `subcontractor_id` / `sub_manager` | 212~214 |
| Q5 세션 확인 + 재사용 가능한 공용 함수 | 211a (완료), 4장 순서표 |
| Q6 협력사 직원은 자기 협력사 작업만 + 추천·자동배정·배정 푸시 후보에서 제외 | 213 (서버에서 푸시 후보 걸러냄) + 묶음 1 코드 |
| 좌표·geocode 보류 | 220 에서 좌표 칸 제외. 도착지 주소 + 기존 주소 검색 버튼 재사용 |
| 미입금 푸시 보류 | 222 삭제. 화면을 열 때 계산해 빨강 표시 |
| 화이트코어 × 주방후드 = 고객 결제 총액의 35%, 출장비만 받은 건도 35% | 216 규칙 행 + 217 협력사 분기 (받은 금액 전체 × 율, 출장비 건 예외 없음) |
| 기준(VAT 포함 / 공급가)은 확정 후 반영, 둘 다 계산 가능하게 | 216 `fee_rules.fee_base` (`gross` / `supply`) 칸. `supply` 는 받은 금액 ÷ 1.1 기준 |
| 완료 시 고객에게 결제금액 안내 문자 (발신명 올데이케어) | 묶음 3 — `api/sms/send.js` 먼저 push·배포 확인 후 SQL 실행 |
| 주방후드 종목 + 업소용/가정용/후드설치 (code 기준) | 215 |
