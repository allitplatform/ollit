# Apps Script — 사장님 운영 시트 도구

## 파일

| 파일 | 용도 |
|---|---|
| `v14_week1_reset.gs` | V14 Week 1 (1A 설정_원청 7개 + 1C 작업번호 형식 + 1D 데이터 폐기) |
| `v14_week1_policy_v6.gs` | V14 Week 1 1B CLEAN (수수료정책 V6 / 8열 / 90 row 박기) |
| `v14_week1_api_backend.gs` | V14 Week 1 1C/1E (api-backend merge / 정책 catch + 동적 계산) |
| `v14_week1_engineers.gs` | V14 Week 1 — 설정_기사 6열 v1 (지역/직급) |
| `v14_week1_engineers_import.gs` | V14 Week 1 — 설정_기사 6열 v2 (세척·냉매 지역) + 코드 → 시트 20명 import |

## 사용 (V14 Week 1 처음 박을 때)

1. **백업 사전 확인** — 사장님 운영 스프레드시트 = 어떤 시트인지 catch.
2. **Apps Script 에디터 열기** — 사장님 시트에서 `확장 → Apps Script`.
3. **`v14_week1_reset.gs` 내용 붙여넣기** — 새 파일 만들고 그대로 복사.
4. **`resetSheet_OllitV14_Week1_DryRun` 실행** — 변경 사항 알림창 → 캡처해서 사장님께 전달.
5. **사장님 승인** — DryRun 결과 OK 받고 진행.
6. **`resetSheet_OllitV14_Week1_Apply` 실행** — 백업 자동 + 변경 박힘.
7. **`_demo_generateTaskNumber` 실행** — 작업번호 형식 7개 원청 모두 검증.
8. **결과 캡처** — Logger 보고 + 시트 캡처.

## 안전 장치

- `Apply` 실행 전 자동으로 `_백업_시트명_YYYYMMDD_HHmmss` 사본 생성.
- 30일 지난 백업은 `cleanupOldBackups_OllitV14`로 정리.
- 모든 함수 = Logger.log + 알림창 보고 (실패 시 추적 가능).

## V14 헌법 v6 — 7개 원청 (코드 박혀있음)

| 약자 | id | 회사명 | 구분 | 색 |
|---|---|---|---|---|
| O | allday | 올데이케어 | 직영 | #FF1B8D |
| A | aircon_pro | 에어컨프로 (KA) | 직영 | #06B6D4 |
| K | coolguy | 쿨가이 (KB) | 직영 | #0891B2 |
| Y | yongin | 용인컴퍼니 | 직영 | #888780 |
| YS | usol_h | 유솔홈케어 H | 위탁 | #10B981 |
| YS-N | usol_n | 유솔홈케어 N | 위탁 | #03C75A |
| CK | crikrin | 크리크린 | 위탁 | #7F77DD |

## 작업번호 형식 (1C)

- 약자 + YYMMDD + `-` + 3자리 순번
- 예: `O260507-001`, `A260507-001`, `YS-N260507-001`
- 일별 순번 (날짜 바뀌면 001부터 리셋)
- `generateTaskNumber(principalId, dateStr)` 호출 = 작업DB 1열 카운트 → 다음 순번

## 1B 수수료정책 V6 CLEAN (`v14_week1_policy_v6.gs`)

기존 폐기 → V6 CLEAN 8열 박기. ~90 row.

**시트 구조 (8열)** ★ V6 CLEAN — 9열에서 정리:
원청 | 작업유형 | 기종 | 평균판매가 | 기사단가 | 가짜단가 | **정책** | 비고

폐기 컬럼: `원청수수료` / `회사이익` (정책 텍스트로 대체 / 동적 계산은 1E API)
신규 컬럼: `정책` (텍스트 catch — 코드가 시트 read해서 견적 × 정책 = 동적)

**Row 분포 (90 = 49 + 28 + 7 + 3 + 3)**:
- 세척: 7 원청 × 7 기종 = 49 row
- 냉매충전: 7 원청 × 4 기종 = 28 row (YS-N은 "특수 (3 케이스)" 정책)
- 출장비: 7 원청 = 7 row (모두 30K / 기사 100%)
- 유솔N 추가선택: 3 row (송풍팬분해 / 실외기 / 피톤치드)
- 유솔N 냉매점검: 3 row (기본 / 추가발생 / 출장비)

**정책 텍스트 (코드가 read해서 동적 계산)**:

세척:
- O 올데이: `직영 (0)`
- A 에어컨프로 (KA): `차감후 50% (가짜단가)`
- K 쿨가이 (KB): `차감후 50% (가짜단가)`
- Y 용인: `정액 10K`
- YS 유솔H: `비율 15%`
- YS-N 유솔N: `비율 15% / 기사 ×1.10`
- CK 크리크린: `비율 20%`

냉매충전:
- O: `직영 (50/50)` / A: `비율 10% / 기사 50%` / K: `비율 35% / 기사 50%`
- Y: `정액 10K / 기사 50%` / YS: `정액 10K / 기사 50%`
- YS-N: `특수 (3 케이스 / 별도 row)` / CK: `비율 20% / 기사 50%`

출장비: `기사 100%`
추가선택(YS-N): `기사 85% / 원청 15%`
냉매점검(YS-N):
- 기본: `유솔 100% (네이버 1만원)`
- 추가발생: `기사 50% / 회사 50% (원청 X)`
- 출장비: `기사 100% (작업 불가 시)`

**빈 셀 정책** (V6 CLEAN — 정상 빈은 silent / 사장님 catch만 옅은 빨강):
- silent (정상): 가짜단가 (KA/KB 외) / 냉매·추가선택·냉매점검 추가발생의 기사단가 / 추가선택·냉매점검 추가발생의 평균판매가
- 옅은 빨강 (사장님 catch): 시스템멀티 기사단가·가짜단가 / YS-N 4 기종 정상 row의 기사단가는 silent (정책 "특수" 박힘)

**작업유형별 옅은 배경**:
- 세척 = 옅은 핑크 / 냉매 = 옅은 노랑 / 출장비 = 회색 / 유솔N (추가선택·냉매점검) = 옅은 그린

**사용**:
1. Apps Script 같은 파일 (`v14_week1_policy_v6`) 열기 → 코드 다 지우고 새 코드 박기
2. `createPolicyV6_DryRun` 실행 → 알림창 캡처
3. 사장님 승인 후 `createPolicyV6_Apply` 실행
4. 자동 백업 (`_백업_수수료정책_YYYYMMDD_HHmmss` — 두 번째 백업, 첫 백업 그대로 유지)

## 1C/1E api-backend.gs (`v14_week1_api_backend.gs`)

**기존 api-backend.gs에 merge하는 V14 부분**. 시트 변경 X (코드만 변경 / 검증).

**변경 함수 (덮어쓰기)**:
- `generateTaskId(principalName, dateInput)` — 약자+YYMMDD-순번 / 7개 원청 매핑
- `createTask(taskData)` (선택) — generateTaskId 호출만 V14 형식 / 작업DB 29열 layout 보존
- `doPost(e)` — 신규 action 3개 분기 추가 (case 만 박기)

**신규 함수 (그대로 추가)**:
- `getPolicyForTask(principal, workType, applianceOrLabel)` — 수수료정책 8열 read
- `parsePolicy(policyText)` — 정책 텍스트 → 구조화 (13가지 type)
- `calculateFee(quote, parsedPolicy, engUnitPrice, fakeUnitPrice)` — 견적 × 정책 = 분배
- `getAllPolicies()` — 모든 정책 catch (Admin/Happycall용)

**신규 API actions** (doPost case 추가):
- `getPolicy` → `{ policy, parsed }`
- `calculateFee` → `{ policy, parsed, fee }`
- `getAllPolicies` → `{ policies, count }`
- `createTask` → `{ taskId }` (기존 그대로 유지 가능)

**유지 함수 (변경 X)**:
- `handleLogin` (시뮬 5명 / Week 1 끝까지)
- `parseKakao` (별도 / 6번대 진행)

**검증**:
1. `testGenerateTaskId_AllPrincipals` 실행 → 7개 원청 형식 검증 (Logger 캡처)
2. `testCalculateFee_AllPrincipals` 실행 → 13 케이스 분배 검증 (Logger 캡처)

**사용**:
1. 사장님 시트 → 확장 → Apps Script → api-backend 파일 열기
2. 본 파일에서 변경 함수 = 기존 위에 덮어쓰기 / 신규 함수 = 그대로 추가
3. `testGenerateTaskId_AllPrincipals` ▶ → Logger 캡처
4. `testCalculateFee_AllPrincipals` ▶ → Logger 캡처
5. 두 캡처 사장님께 전달

## 설정_기사 V14 6열 마이그레이션 (`v14_week1_engineers.gs`)

옛 기사 시트 (설정_기사 / 기사 / Engineers) → V14 6열 박기.

**V14 6열**:
기사ID | 이름 | 연락처 | 지역 | 직급 | 활성

**박는 흐름**:
1. 옛 시트 catch (시트명 다양성 — 설정_기사 / 기사 / Engineers)
2. 옛 데이터 catch (이름 / 전화 / 이메일 — 첫 3열)
3. 옛 시트 백업 (rename: `_백업_설정_기사_YYYYMMDD_HHmmss`)
4. V14 6열 새 시트 박기 (핑크 헤더 #FF1B8D)
5. 옛 데이터 → V14 형식 (이름 → 기사ID + 이름 / 지역·직급 빈 / 활성=true)
6. 컬럼 너비 + 활성 컬럼 데이터 검증 (TRUE/FALSE)

**사용**:
1. Apps Script 에디터에 `v14_week1_engineers.gs` 박기
2. `setupSheet_설정기사_V14` 실행
3. 옛 시트 = 백업으로 rename / 새 V14 시트 박힘
4. Logger 캡처: 마이그레이션 N명 박힘 catch
5. 사장님 catch 박을 차례: 지역 / 직급 박기 (현재 빈)

**박지 X (사장님 catch 박을 차례)**:
- 기사ID 자동 (현재 = 이름 / 동명이인 시 charge X)
- 지역 / 직급 (V14 헌법 박힌 거 / 사장님 박을 차례)
- DryRun 패턴 X (백업 = rename으로 1번에 박힘 / 옛 시트는 백업 시트로 보존)

---

**동적 계산 검증 — 견적 100K / 벽걸이 (사장님 spec 기대값)**:

| 원청 | 작업 | 정책 | 원청 | 기사 | 회사 |
|---|---|---|---|---|---|
| 올데이 | 세척 | 직영(0) | 0 | 40K | 60K |
| KA | 세척 | 차감후50%(가짜) | 25K | 40K | 35K |
| KB | 세척 | 차감후50%(가짜) | 25K | 40K | 35K |
| 용인 | 세척 | 정액10K | 10K | 40K | 50K |
| 유솔H | 세척 | 비율15% | 15K | 40K | 45K |
| 유솔N | 세척 | 비율15%×1.10 | 15K | 44K | 41K |
| 크리크린 | 세척 | 비율20% | 20K | 40K | 40K |
| 올데이 | 냉매 | 직영(50/50) | 0 | 50K | 50K |
| KA | 냉매 | 비율10%/기사50% | 10K | 50K | 40K |
| KB | 냉매 | 비율35%/기사50% | 35K | 50K | 15K |
| 용인 | 냉매 | 정액10K/기사50% | 10K | 50K | 40K |
| 유솔H | 냉매 | 정액10K/기사50% | 10K | 50K | 40K |
| 유솔N | 냉매 | 특수 | (throws — 별도 row) | | |
| 크리크린 | 냉매 | 비율20%/기사50% | 20K | 50K | 30K |
