# 조사 보고 — 협력사 구조 + 종목 2단계 + 이전설치 출발/도착

작성 2026-10-06 · Step 0 산출물 · **읽기 전용 조사 (코드·DB 수정 없음)**
대상: `src/`, `api/`, `db/migrations/` (사본 폴더 `_backups/`, `_to_delete/`, `src-backup/`, `.before-*` 파일 제외)
한계: 운영 DB 는 조회하지 않았습니다. DB 관련 내용은 저장소의 마이그레이션 파일 기준이며, 실제 정책·행 존재 여부는 표시한 확인 조회문으로 검증이 필요합니다.
설계는 `docs/design_partner_category_move.md` 참조.

## 한눈에 보기

| # | 조사 항목 | 결과 |
|---|---|---|
| 1 | 원청 코드 문자열 고정 위치 | **213건 / 58개 파일** (+ `api/` 3건). 정산·수수료 94, 화면 표시 55, 접수 양식 23, 기타 23, 권한·조회 18. "usol_n 이 아니면 전부 일일정산"으로 떨어지는 분기가 여러 곳 → 협력사를 원청 표에 넣으면 안 됨 |
| 2 | 서비스 코드 고정 위치 | 정산 26, 접수 20, 화면 31, 배정 11, 문서 8, 기타 10, DB 연동 7. 종목 → 서비스 2단계 표(`categories` → `service_types`)는 DB 에 이미 있으나 `categories` 는 미사용. 서비스는 한글 이름으로 저장되고 트리거가 이름 일치로 연결 |
| 3 | RPC 를 거치지 않는 직접 쓰기 | **36건** (insert 12 / update 20 / delete 4) + 저장소 3건. 위험도 높음 25. `payments`·`engineer_rates`·`photos` 는 누구나 수정 가능한 정책이 마이그레이션에 있음 |
| 4 | 원청 화면의 필터 | 전부 브라우저가 정한 원청 id 로 조회. 서버의 소속 검증 없음 |
| 5 | 협력사 관리자 표현 | 기존 `partner + principal_id` 로는 부적합. 새 테이블 + 새 role 권장 (`partner` 는 이미 원청 담당자 뜻) |
| 6 | 발급 사업자 정보 | `engineer_business_info` 에 기사별 사업자 5칸이 **이미 있음**. 미등록 차단도 구현돼 있음. 발급 주체 선택 칸과 협력사 사업자 칸만 없음 |
| 7 | 주소·좌표 | `address`, `district` 만 있음. **좌표 칸 없음.** 동선은 구 중심점 추정. 내비 버튼 3종은 주소 검색 방식으로 이미 있음 |
| 8 | 작업 칸 추가 시 3곳 | 3곳 모두 확인. tasks 조회는 `*` 라 자동 포함, 칸을 나열한 조회 8곳은 별도 |

아래 1~3번은 항목별 상세 조사 원문입니다.

---

# 1. 원청 코드 문자열 고정 위치 (src/ + api/)

조사 기준: 패턴 `['"`](allday|KA|KB|yongin|usol_h|usol_n|crikrin)['"`]` 로 src/ 에서 213건, 58개 파일 (사전 집계와 일치). `.before-*` 사본과 `_stg*` 는 제외. 추가로 따옴표 없는 객체 키, `principal_code ===`, `principalCode`, `principalId ===`, `.code ===` 비교를 별도로 확인했다. api/ 는 3건이며 맨 아래에 별도로 적었다.

분류 판단은 줄 주변 코드를 읽고 한 것이다. 주석만 있는 줄은 `기타` 로 분류했다.

## 1. 요약

| 분류 | 건수(따옴표 매칭 기준) | 파일 수 |
|---|---|---|
| 정산·수수료 | 94 | 32 |
| 권한·조회필터 | 18 | 10 |
| 화면 표시 | 55 | 16 |
| 접수 양식 | 23 | 4 |
| 기타 (주석, 라우팅, 광고키 등) | 23 | 18 |
| 합계 | 213 | 58 (중복 파일 있음, 분류별 파일 수 합은 더 큼) |

별도 확인 결과 (따옴표 매칭에 안 잡힌 것)
- 따옴표 없는 객체 키: `commissionPoliciesDb.js` 25-26, 225-231, `engineerSkillsDb.js` 69-75, `AdminPcPrincipalPayout.jsx` 39-41, `PrincipalSettlementScreen.jsx` 13-17, `PrincipalApp.jsx` 92, 97 (PARTNER_PWA_CONFIG 키).
- 원청 한글명 문자열로 분기하는 곳 (코드 문자열이 아니라서 위 213건에 안 잡힘): `'유솔홈케어 N'` 비교가 `AdminApp.jsx` 5457-5458, `EngineerApp.jsx` 792, 1407-1408, `EngineerCalendarTab.jsx` 880, 987, `EngineerTaskDetailScreen.jsx` 1535, `EngineerSettlementDetailScreen.jsx` 288, `EngineerNewAssignmentListScreen.jsx` 140, `EngineerAcceptanceListScreen.jsx` 72, `dashboardStats.js` 54, `commissionPoliciesDb.js` 435, `NewReceptionPcForm.jsx` 189, 783. 원청 이름이 바뀌면 조용히 빠진다.
- `principalCode ===` 등 비교 중 위 213건에 없던 것은 모두 상수(`USOL_N_PID`, `USOLN_CODE`, `SELF_PRINCIPAL_CODE`, `USOL_N_PRINCIPAL_CODE`) 경유이며 아래 표에 해당 상수 선언 줄로 포함했다.

## 2. 분류별 표

### 2-1. 정산·수수료 (건별)

사실상 전부 `usol_n` 이 트랙 B(월정산, 네이버 85/15), 나머지가 트랙 A(일별 정산)라는 이분 구조다. 그 외 코드는 비교에서 빠지고 else 쪽(트랙 A 취급)으로 간다. 매핑 표는 표 단위로 한 행씩 적었다.

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/components/AdminTaskDetailScreen.jsx:377 | `usol_n` 이 아니면 작업 항목 카드(받은 돈 입력) 표시 | else 기본이 트랙 A |
| src/components/AdminTaskDetailScreen.jsx:378 | `usol_n` 이면 정산 사이클 카드 표시 | |
| src/components/AdminTaskDetailScreen.jsx:1246 | `usesReceivedTotalFlow` : `usol_n` 아니고 선결제 아님 | 받은 돈 흐름 결정 |
| src/components/AdminTaskDetailScreen.jsx:1262 | `isUsolNTrackB` : `usol_n` + 트랙 B 이면 견적 수정 차단 | |
| src/components/EngineerTaskDetailScreen.jsx:256 | `usesReceivedTotalFlow` 동일 분기 (기사 화면) | 212, 2399 는 같은 규칙의 주석 |
| src/components/EngineerTaskDetailScreen.jsx:2949 | `usol_n` 이거나 네이버페이면 금액 상세 숨기고 "프로 수익"만 표시 | |
| src/components/EngineerTaskCompletionScreens.jsx:1166 | `usesReceivedTotalFlow` 동일 분기 (완료 화면) | |
| src/components/EngineerSettlementDetailScreen.jsx:33 | `isUsolN()` : `usol_n` 이거나 네이버페이면 금액 내역 숨김 | |
| src/components/EngineerNewAssignDetailScreen.jsx:110 | `usol_n` 만 `compute_engineer_amount_per_item` RPC 호출 | |
| src/components/EngineerNewAssignDetailScreen.jsx:288 | `isUsolN` : 항목별 기사 금액 vs 상품가 표시 | 284 는 주석 |
| src/components/EngineerSettlementScreen.jsx:19, 77 | 정산 화면 "유솔 N" 탭 정의와 렌더 | |
| src/components/EngineerSettlementScreen.jsx:88 | 오늘 정산에서 `principalId !== "usol_n"` 제외 | |
| src/components/EngineerSettlementScreen.jsx:189 | 유솔N 뷰는 `principalId === "usol_n"` 건만 | |
| src/utils/marginCalculator.js:19 | `usol_n` 이면 85% 계산식, 그 외는 "5원청" 일반식 | 6번째 원청이 와도 일반식으로 감 |
| src/utils/usolNCommission.js:12 | `calcCompanyReceive` : `usol_n` 아니면 0 반환 | |
| src/utils/usolNCommission.js:18 | `calcEngineerEarning` : `usol_n` 아니면 0 반환 | |
| src/utils/remitFilter.js:121 | 현장추가금 보너스 대상 = `usol_n` 만 | 15, 103, 127 은 같은 규칙의 주석 |
| src/lib/commissionPoliciesDb.js:13-20 | `PRINCIPAL_ID_TO_CODE` 옛 id(aircon_pro, cool_son)를 DB 코드로 변환 | KA=aircon_pro, KB=cool_son 불일치 흡수 |
| src/lib/commissionPoliciesDb.js:24-30 | `PRINCIPAL_CODE_TO_ID` 역방향 | 코드 없으면 조회 실패 |
| src/lib/commissionPoliciesDb.js:306-314 | `PRINCIPAL_NAME_TO_CODE` 한글명을 DB 코드로 (수수료 계산 호출용) | `receptionForm.js` 와 이름은 같고 내용이 다름 (아래 참고) |
| src/lib/commissionPoliciesDb.js:435 | 유솔N 이면 수수료 계산을 건너뜀 (`usol_n_skip`) | 이름 문자열 비교도 병행 |
| src/lib/refrigerantAddonsDb.js:53 | 냉매 추가분 라우팅 : `usol_n` 이면 `usol_h` 로 보냄 | |
| src/lib/refrigerantAddonsDb.js:54 | 위와 같은 조건으로 원청명을 "유솔홈케어 H" 로 | |
| src/components/admin/RefrigerantAddonListScreen.jsx:155 | `isUsolN` : "usol_h 로 생성" vs "원청 그대로" | |
| src/pages/AdminApp.jsx:7450 | 일별 송금 대상에서 `usol_n` 제외 | |
| src/pages/AdminApp.jsx:7830 | `isPartnerRemit` : `usol_n` 이외 전부 일별 송금 버튼 대상 | 새 원청은 자동으로 일별 송금 대상이 됨 |
| src/pages/AdminPcPrincipalPayout.jsx:33 | 원청 지급 화면 대상 = KA, KB, yongin, usol_h, crikrin | 새 원청은 화면에 안 나옴 |
| src/pages/AdminPcPrincipalPayout.jsx:37-38 | 원청명 표시 맵 (KA, KB 는 코드 그대로 표시) | 39-41 은 따옴표 없는 키, 맵에 없는 코드는 코드 그대로 표시 |
| src/components/admin/SettlementHistoryContent.jsx:614 | `TARGET_PRINCIPAL_CODES = ["KA","crikrin"]` 지급 이력 대상 | 608 은 주석 |
| src/components/PrincipalSettlementScreen.jsx:20 | `FIVE_PRINCIPAL_IDS` 정산 정책 5개 (KB, usol_n 없음) | 옛 id 체계 (aircon_pro) |
| src/components/PrincipalSettlementScreen.jsx:148 | 일별 정산 탭이 `["KA","crikrin"]` 만 조회 | |
| src/components/PrincipalDetailScreen.jsx:245 | `usol_n` 이면 매출을 netAmount 로 | |
| src/components/PrincipalDetailScreen.jsx:250 | `usol_n` 이면 기사 수익을 유솔N 전용식으로 | |
| src/components/admin/CommissionCalculator.jsx:12-18 | 수수료 계산기 원청 선택지 7개 | |
| src/components/admin/CommissionCalculator.jsx:49 | 계산기 기본 원청 `KA` | |
| src/components/admin/CommissionCalculator.jsx:60 | KA + 냉매 + 1way 일 때만 수량 입력 표시 | KA 1way 첫대/추가 규칙 |
| src/components/admin/CommissionPolicyScreen.jsx:20-26 | 수수료 정책 화면 원청 선택지 7개 | |
| src/components/admin/FakeBaseEditor.jsx:26 | `isTarget` : KA 또는 KB 일 때만 가짜 단가 편집 노출 | 3 은 주석 |
| src/pages/PrincipalApp.jsx:126 | `isUsolFlow()` : `usol_n` 만 트랙 B 정산 상세 | |
| src/pages/PrincipalApp.jsx:668 | 정산 탭 : `usol_n` 단독이면 월정산 탭, 아니면 일별 탭 | else 기본이 일별 |
| src/pages/PrincipalApp.jsx:736 | 위와 같은 분기 (데스크톱 레이아웃) | |
| src/pages/PrincipalApp.jsx:2456 | `usol_h` + 냉매만 있는 건은 정산 정보 숨기고 "완료"만 | 유솔H 정책 |
| src/pages/PrincipalApp.jsx:2888 | `isStrictPartner` : KA, crikrin 은 견적금액만 표시 | KB, yongin 은 합산 금액 |
| src/lib/principalRemitDb.js:119 | 기본 조회 대상 `["usol_h","usol_n"]` | |
| src/lib/principalDashboardDb.js:195 | 정산대기 집계는 `usol_n` 포함 범위에서만 | |
| src/components/principal/PrincipalSettleTab.jsx:149 | `usol_n` 포함 시 주차 라이브 결과 사용 | |
| src/components/principal/PrincipalSettleTab.jsx:535 | `usol_n` 포함 시에만 진입 카드 표시 | |
| src/lib/usolRemitHistoryDb.js:38, 41 | 송금 이력 기본값 `principalCode = "usol_n"` | 38 은 주석 |
| src/components/principal/UsolRemitHistoryScreen.jsx:45 | 송금 이력 호출 시 `usol_n` 고정 | |
| src/components/usol_n/UsolNTracking.jsx:41 | 송금 조회 `["usol_h","usol_n"]` | |
| src/components/usol_n/UsolNToCompanySection.jsx:73 | 송금 조회 `["usol_n"]` | |
| src/components/usol_n/UsolNToCompanySection.jsx:386 | 송금 조회 `["usol_n"]` (두 번째 호출) | |
| src/components/usol_n/UsolNSettleScreen.jsx:54 | 정산 항목 조회 `["usol_n"]` | 12 는 주석 |
| src/pages/AdminPcDashboard.jsx:679 | 유솔N 정산 항목 조회 `["usol_n"]` | |
| src/pages/AdminPcDashboard.jsx:984 | `USOLN_CODE` 상수. 1173 에서 `isTrackB` 로 "월정산" 표시 결정 | 1173 은 따옴표 없는 비교 |
| src/components/admin/StatsHubScreen.jsx:31 | `USOLN_CODE` 상수. 165 에서 `isTrackB` 결정 | 165 는 따옴표 없는 비교 |
| src/pages/EngineerApp.jsx:3869 | 유솔 입금 카드가 `principals.code = 'usol_n'` 계좌를 조회 | 송금 계좌 |

### 2-2. 권한·조회필터 (건별)

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/lib/allPrincipalTasksDb.js:11 | `USOL_N_PRINCIPAL_CODE` 상수. 43 에서 "그 외 원청" id 목록 산출 | 43 은 따옴표 없는 비교 |
| src/lib/allPrincipalTasksDb.js:67 | `principalCodes` 기본 null = 6원청 (usol_n 제외) | 58 은 주석. 새 원청은 null 일 때 자동 포함 |
| src/utils/dashboardStats.js:54 | 유솔N 은 메인 냉매 건만 새 접수, 배정, 확정 카드에 포함 | else 로 그 외는 전부 포함 |
| src/pages/AdminPcDashboard.jsx:659 | 유솔N 패널은 `usol_n` 건만 필터 | |
| src/pages/PrincipalApp.jsx:566 | 유솔 통합계정(usol_h+usol_n) 판별 | |
| src/pages/PrincipalApp.jsx:568 | 통합계정 기본 선택 코드 = `usol_n` | |
| src/pages/PrincipalApp.jsx:605 | 마케팅 탭은 usol_h 또는 usol_n 계정에만 노출 | |
| src/pages/PrincipalApp.jsx:648, 762 | 일정 탭 노출 = usol_h 또는 usol_n 계정 | 두 곳에 같은 조건이 복제되어 있음 |
| src/components/principal/UsolHScheduleTab.jsx:244 | 일정 조회 코드를 usol_h, usol_n 으로 한정 | 242 는 주석 |
| src/components/UsolNScreen.jsx:158 | 유솔N 화면 헤더 집계는 `principalId === "usol_n"` 건 | |
| src/lib/usolNTasksDb.js:18 | `USOL_N_PRINCIPAL_CODE` 상수. 743 에서 `usol_n` 아니면 조치필요 아님 | 743 은 따옴표 있는 비교로 위 213건에 포함 |
| src/components/admin/MarketingScreen.jsx:28 | `SELF_PRINCIPAL_CODE = "allday"` 자체 유입 = allday 건만 집계 | 13 은 주석 |
| src/components/admin/MarketingScreenPc.jsx:18 | 위와 같은 상수 | |
| src/components/admin/MarketingScreenMobile.jsx:19 | 위와 같은 상수 | 128 은 주석 |

### 2-3. 화면 표시 (라벨, 색상, 순서, 탭, 마크)

연속된 같은 성격 줄은 묶었다.

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/lib/allPrincipalTasksDb.js:281-286 | `PRINCIPAL_CHIP_ORDER` 칩 라벨과 순서 | usol_n 없음. 전체 업무 화면 칩이 이것을 그대로 사용 |
| src/pages/AdminPcDashboard.jsx:976-982 | `PRINCIPAL_ORDER` 대시보드 원청별 행 순서와 이름 | 목록에 없는 코드는 행 자체가 안 생김 |
| src/components/admin/StatsHubScreen.jsx:23-29 | 통계 허브 원청 이름과 색 | 위와 같음 |
| src/components/admin/RawOrdersArchiveScreen.jsx:20-26 | 원본 주문 보관함 원청 필터 옵션 | 23행 KA 라벨이 "쿨가이" 로 잘못 붙어 있음 (KA 는 에어컨프로) |
| src/pages/PrincipalApp.jsx:871-872 | `showPendingSettle` : usol_n 일 때만 정산대기 라벨 표시 | |
| src/pages/PrincipalApp.jsx:1006-1007, 1088-1089 | 유솔H/유솔N 전환 토글 라벨 | |
| src/components/principal/PrincipalListTab.jsx:103 | `ChannelBadge` : usol_n 만 표시 | |
| src/components/principal/PrincipalListTab.jsx:153, 155 | 헤더(카운트) 표시 조건 `usol_h` 단독 | 일반 원청 UI 로 취급 |
| src/components/PrincipalListScreen.jsx:72 | `isUsolN` : 유솔N 행 표시 변형 | |
| src/pages/AdminApp.jsx:2445, 4289 | 유솔N 진입 버튼 연결 (4289 는 해피콜 모드에서 숨김) | |
| src/pages/AdminApp.jsx:2538 | 해피콜 모드 차단 화면 목록에 `usol_n` | 직접 라우팅 방어 |
| src/pages/AdminApp.jsx:3967 | `screen === "usol_n"` 화면 라우트 | |
| src/pages/AdminApp.jsx:5456, 5459 | 유솔N 세척 건에 N 마크 | 5457-5458 은 한글명 비교 |
| src/pages/AdminPcSidebar.jsx:79 | 사이드바 "유솔N 화면" 항목 | |
| src/pages/EngineerApp.jsx:792, 1406, 1409 | 유솔N 세척 건에 N 마크 | 한글명 비교 병행 |
| src/components/EngineerCalendarTab.jsx:880, 987 | 유솔N 세척 건에 N 마크 | |
| src/components/EngineerNewAssignmentListScreen.jsx:140 | 유솔N 세척 건에 N 마크 | |
| src/components/EngineerAcceptanceListScreen.jsx:72 | 유솔N 세척 건에 N 마크 | |
| src/components/EngineerTaskDetailScreen.jsx:1104 | usol_n 이 아닐 때만 영수증 발행 버튼 | 권한 성격도 있음 |
| src/components/EngineerTaskDetailScreen.jsx:1535 | 유솔N 세척 건에 N 마크 | |
| src/components/EngineerSettlementDetailScreen.jsx:288 | 유솔N 세척 건에 N 마크 | |
| src/pages/HappycallApp.jsx:229 | 해피콜 고객사 목록에 `yongin` id | 다른 id(olday, coolguy, creakclean, yusol)는 DB 코드와 다름 |

### 2-4. 접수 양식 (폼 필드, 파서, 작업번호)

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/utils/receptionForm.js:41-47 | `PRINCIPAL_NAME_TO_CODE` 접수 폼 원청 라벨을 DB 코드로 (시세표 조회, 정책 조회) | 이름은 `commissionPoliciesDb.js` 와 같으나 별칭 목록이 달라 두 벌 유지 중 |
| src/utils/receptionForm.js:613, 615 | 붙여넣기 파서에서 `KA`, `KB` 문자열을 폼 값으로 변환 | 원청 한글 별칭 사전 |
| src/utils/partnerPasteParser.js:782 | `parsePartnerPaste` : `ka`(소문자 비교), `crikrin` 만 파서 존재, 그 외는 빈 배열 | 5, 18, 19 는 주석 |
| src/components/admin/NewReceptionPcForm.jsx:237 | KA 또는 crikrin 일 때만 주문 텍스트 자동 파싱 | 189, 783 은 `"유솔홈케어 N"` 한글 비교 (수수료 미리보기 생략, 별도 입력 UI) |
| src/components/admin/NewReceptionPcForm.jsx:839 | `hasPartnerParser` 붙여넣기 영역 노출 | |
| src/components/principal/NewReceptionScreenLite.jsx:125 | KA + 냉매 + 1way 첫대/추가 단가 자동 분할 | 5, 16 은 주석 |
| src/components/principal/NewReceptionScreenLite.jsx:144 | 컴포넌트 기본 `principalCode = "usol_h"` | 안 넘기면 유솔H 로 동작 |
| src/components/principal/NewReceptionScreenLite.jsx:199 | `pasteSupported` : KA, crikrin 만 | |
| src/components/principal/NewReceptionScreenLite.jsx:234 | 가격 미기재 시 crikrin 만 시세표 자동 조회 | KA 는 0 유지 |
| src/components/principal/NewReceptionScreenLite.jsx:624, 1027 | KA 일 때만 붙여넣기 안내문 변경 | |
| src/components/principal/NewReceptionScreenLite.jsx:822, 1264, 1280 | KA 1way 수량 2 이상 안내 UI | |

### 2-5. 기타

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/pages/AdminApp.jsx:3979, 3981 | 유솔N 화면에서 task 를 상세로 넘길 때 `principal: "usol_n"` 주입 | 상세 화면 정산 사이클 섹션 분기용 |
| src/pages/MarketingPwaApp.jsx:1407 | 광고 키 환경변수 선택지 `allday` | 코드값이 원청 코드와 같은 문자열일 뿐 |
| src/lib/usolNTasksDb.js:854 | 유솔N 원본 주문 저장 시 `principalCode: "usol_n"` | 원본 주문 보관용 |
| src/pages/AdminApp.jsx, src/pages/PrincipalApp.jsx:555 등 | 주석 | |
| 주석만 있는 줄 | allPrincipalTasksDb.js:58, 223 / shared/tasks.js:585 / AdminPcDashboard.jsx:652 / engineerSkillsDb.js:8 / principalSettleDb.js:13, 39 / taskNoGenerator.js:129 / ApplianceSelectModal.jsx:14 / RefrigerantAddonListScreen.jsx:7 / MarketingScreen.jsx:13 / SettlementHistoryContent.jsx:608 / PrincipalListTab.jsx:147 / remitFilter.js:15, 103, 127 / EngineerTaskDetailScreen.jsx:212, 2399 / UsolNSettleScreen.jsx:12 | 동작 영향 없음 (규칙 문서 역할) |

### 2-6. api/ (src 밖, 3건)

| 파일:줄 | 분기 내용 | 분류 |
|---|---|---|
| api/ad-report.js:548 | 오늘 실접수 수를 `principals.code = 'allday'` 로 조회 | 권한·조회필터 (광고 보고서 분모) |
| api/sms/send.js:97 | `principal === "allday"` 일 때만 문자 앞에 "[올데이케어] " 붙임 | 화면 표시 (문자 문구) |
| api/sms/send.js:15 | 주석 | 기타 |

## 3. 새 원청/협력사를 추가할 때 반드시 손대야 하는 곳

기준: 목록에 없는 코드가 들어오면 else 로 조용히 떨어져 잘못 동작할 위험이 있는 곳 중심. 위험도 순.

### 가장 위험 (조용히 잘못된 금액 또는 송금 처리)
1. `src/pages/AdminApp.jsx:7830` `isPartnerRemit` : `usol_n` 이 아니면 전부 일별 송금 대상으로 처리된다. 월정산이어야 하는 새 원청이 일별 송금 버튼에 나타난다. 7450 도 같은 구조.
2. `src/utils/marginCalculator.js:19` : `usol_n` 이외 전부 "5원청 일반식". 새 원청의 마진이 일반식으로 계산된다.
3. `src/pages/PrincipalApp.jsx:126, 668, 736` : `usol_n` 단독만 월정산 UI, 그 외는 일일정산 UI. 새 원청 계정이 일일정산 화면으로 열린다.
4. `src/components/AdminTaskDetailScreen.jsx:377, 1246`, `EngineerTaskDetailScreen.jsx:256`, `EngineerTaskCompletionScreens.jsx:1166` : "받은 돈 합계 흐름"이 `usol_n` 아님이면 기본 켜짐. 같은 규칙이 4곳에 복제되어 있어 하나라도 빠지면 화면마다 달라진다.
5. `src/pages/PrincipalApp.jsx:2888` `isStrictPartner` : KA, crikrin 만 견적금액 표시, 나머지는 합산 금액 노출. 새 협력사에 노출 금액 규칙을 따로 정해야 한다.
6. `src/lib/allPrincipalTasksDb.js:67` : `principalCodes = null` 이면 usol_n 을 뺀 전체. 새 원청은 자동으로 운영자 전체 업무에 포함된다.

### 목록에 추가하지 않으면 화면에서 사라지는 곳
7. `src/lib/allPrincipalTasksDb.js:281-286` `PRINCIPAL_CHIP_ORDER` (전체 업무 칩), `src/pages/AdminPcDashboard.jsx:975-983` `PRINCIPAL_ORDER` (대시보드 원청별 행), `src/components/admin/StatsHubScreen.jsx:23-29`.
8. `src/pages/AdminPcPrincipalPayout.jsx:33-42` (원청 지급 화면 대상과 이름), `src/components/admin/SettlementHistoryContent.jsx:614`, `src/components/PrincipalSettlementScreen.jsx:12-20, 148` (옛 id 체계, KB 와 usol_n 이 이미 빠져 있음).
9. `src/components/admin/RawOrdersArchiveScreen.jsx:18-27` (KA 라벨이 "쿨가이" 로 잘못 되어 있어 먼저 수정 필요), `CommissionCalculator.jsx:12-18`, `CommissionPolicyScreen.jsx:20-26`.

### 코드 변환 표 (빠지면 정책 조회 실패)
10. `src/lib/commissionPoliciesDb.js` : `PRINCIPAL_ID_TO_CODE` 13-20, `PRINCIPAL_CODE_TO_ID` 24-30, `PRINCIPAL_LABEL` 225-231, `PRINCIPAL_NAME_TO_CODE` 306-314.
11. `src/utils/receptionForm.js:41-47` (접수 폼 이름 코드 표)와 `receptionForm.js:608-626` (붙여넣기 원청 별칭 사전). 두 파일의 `PRINCIPAL_NAME_TO_CODE` 가 이중으로 있으므로 같이 수정.
12. `src/lib/engineerSkillsDb.js:69-75` (기사 숙련도 표시 이름).

### 접수와 파서
13. `src/utils/partnerPasteParser.js:778-784` : 새 코드는 빈 배열 반환, 붙여넣기가 조용히 아무것도 안 함. 호출부 `NewReceptionPcForm.jsx:237, 839`, `NewReceptionScreenLite.jsx:199` 의 허용 목록도 같이.
14. `src/pages/PrincipalApp.jsx:91-102` `PARTNER_PWA_CONFIG` : 여기에 있어야 협력사 직접 입력 PWA 가 열린다. 없으면 유솔식 기존 흐름으로 떨어진다. `NewReceptionScreenLite.jsx:144` 기본값이 `usol_h` 이므로 `principalCode` 누락 시 유솔H 로 접수될 위험.

### 한글명 비교 (코드를 바꿔도 안 걸리는 곳)
15. `'유솔홈케어 N'` 문자열 비교 : `AdminApp.jsx:5457`, `EngineerApp.jsx:792, 1407`, `dashboardStats.js:54`, `commissionPoliciesDb.js:435`, `NewReceptionPcForm.jsx:189, 783` 등. 새 원청이 유솔N 과 같은 취급이 필요하면 이 한글명 비교도 같이 확인.

### 그 외
16. `src/components/admin/FakeBaseEditor.jsx:26` (KA, KB 만 가짜 단가 편집), `src/pages/PrincipalApp.jsx:605, 648, 762` (유솔 계정에만 마케팅, 일정 탭), `src/pages/HappycallApp.jsx:226-232` (해피콜 고객사 id 가 DB 코드와 다름), `api/sms/send.js:97` (문자 접두어는 allday 만).
17. DB 쪽: `principals` 행의 `code`, `task_no` prefix (`taskNoGenerator.js` 는 DB 조회 방식이라 코드 수정 불필요, prefix 값만 DB 에 있으면 됨). `compute_payment` 등 서버 함수의 `usol_n` 분기는 이번 조사 범위 밖이라 별도 확인 필요.


---

# 2. 서비스 코드 고정 위치

조사 범위: `src/`, `api/` (제외: `_backups/`, `_to_delete/`, `src-backup/`, `.before-` 사본, `_stg*`). 보조로 `db/migrations/`, `public/*.html` 랜딩, `docs/카테고리_확장_설계.md` 확인. 프로젝트 파일은 수정하지 않았다.

---

## 1. 요약

### 1-1. 확정된 서비스 코드 값

서비스 코드는 저장소 한 곳에서 정의되지 않고 **세 개의 서로 다른 집합**으로 나뉘어 쓰인다.

**(A) DB `service_types.code` — 작업(task_items) 단위 서비스 (정산의 기준)**

| 값 | 한글명(`service_types.name`) | 정의 위치 |
|---|---|---|
| `cleaning` | 세척 | mig 004_seed.sql:52 |
| `refrigerant` | 냉매충전 | mig 004_seed.sql:53 |
| `install` | 설치 | mig 004_seed.sql:54 (설치 5종 work_types 는 레포 밖 배포분) |
| `leak` | 누설 | mig 004_seed.sql:55 |
| `inspect` | 점검 | mig 004_seed.sql:56 (운영 DB 에서 삭제된 것으로 receptionForm.js:701 주석에 적혀 있음) |
| `repair` | 수리 | mig 004_seed.sql:57 (위와 같이 삭제됨) |
| `visit_fee` | 출장비 | mig 004_seed.sql:58 |
| `fan_disassembly` | 송풍팬분해 | mig 034_usol_n_addon_seeds.sql:8 |
| `outdoor_unit` | 실외기 청소 | mig 034:9 |
| `phytoncide` | 피톤치드 | mig 034:10 |
| `water_leak` | 누수 | mig 195_water_leak_service.sql:23 |

- `addon` 은 DB `service_types` 행이 아니다. compute_payment 안에서 `usol_n` + `refrigerant` 를 `'addon'` 으로 바꿔 읽는 **가상 코드**이며, `commission_policies.service_code='addon'` 정책 행과 `WORKTYPE_TO_SERVICE["추가선택(YS-N)"]` 로만 존재한다.
- **확인 필요(잠재 결함):** mig 195 가 `water_leak` 에 쓴 id `…444444444008` 이 mig 034 의 `fan_disassembly` id 와 **같다.** 두 INSERT 모두 `ON CONFLICT (id) DO NOTHING` 이므로, 034 가 먼저 실행된 DB 에서는 195 의 `water_leak` 행이 조용히 건너뛰어졌을 수 있다 (그러면 `work_types` 누수 행도 0건이고 sync 트리거가 "누수" 를 거부). 운영 DB 에서 `SELECT code,name FROM service_types WHERE code IN ('water_leak','fan_disassembly')` 로 확인 권장. 이 조사에서는 DB 를 조회하지 않았다.
- `relocation` / `move` 같은 코드는 **없다**. "이전설치", "신규설치", "철거", "실외기중고교체", "기계중고교체" 는 서비스 코드가 아니라 `install` 아래의 `work_types.name` 5종이다 (`src/utils/workTypeKind.js:31-33`, `src/utils/receptionForm.js:88`).

**(B) `inquiries.service_type` — 홈페이지 접수 단위 (CHECK 제약, mig 211:60-65)**

`refrigerant, cleaning, repair, install, unknown, leak, water_leak, hood, grave, move_in` (총 10개)

| 값 | 한글명 | 정의 위치 |
|---|---|---|
| `hood` | 주방후드 | mig 211, `src/lib/inquiriesDb.js:27`, `public/hood.html:344` |
| `grave` | 벌초·산소 | mig 211, `inquiriesDb.js:28`, `public/care.html:381` |
| `move_in` | 입주청소 | mig 211, `inquiriesDb.js:29`, `public/ipju.html:254` |
| `repair` | 수리·누설수리 | 옛 접수 행 표시용으로만 유지 (`LandingApp.jsx:21` 주석) |
| `unknown` | 잘 모르겠어요(방문진단) | `inquiriesDb.js:25` |

`hood`/`grave`/`move_in` 은 **접수함(inquiries)에만 있는 코드**다. `service_types` 에 행이 없고, 접수함에서 작업으로 전환할 때는 `inquiryWorkType()` 이 빈 값을 돌려준다 (`inquiriesDb.js:127-131`). 즉 작업(tasks) 쪽에는 아직 후드/입주청소/벌초 종목이 존재하지 않는다. 후드 설치는 `service_type='install'` 로 접수되어(`public/hood.html:344`) source 접두사(`hood_landing`)로만 구분된다.

**(C) 화면 분류용 kind (코드에서 계산되는 값, DB 컬럼 아님)**

`cleaning | refrigerant | install | leak | other` (`workTypeKind.js:93` SERVICE_KIND_ORDER) + `serviceTypes.js` 의 `visit | extra | undecided`. **`water_leak` 은 화면 kind 에서 `leak` 으로 합쳐진다** (`_kindFromServiceCode` 가 `water_leak` 을 모르면 null 을 돌려주고, workType 문자열 "누수" 접두사가 `leak` 으로 매핑: `workTypeKind.js:28`).

### 1-2. 분류별 건수 (아래 2장 표의 행 수 기준, 연속 줄 묶음 1행)

| 분류 | 행 수 |
|---|---|
| 정산·수수료 | 26 |
| 접수 양식 | 20 |
| 화면 표시 (라벨·아이콘·색) | 31 |
| 배정·추천 | 11 |
| 문서 발급 | 8 |
| 기타 | 10 |
| DB 측 연동 분기 (src 밖, 참고) | 7 |

원본 grep 기준 따옴표 영문 코드 리터럴만 약 264줄, 한글 종목명 비교(`=== "세척"`, `startsWith("누설")` 등) 약 84줄이 더 있고, 같은 파일 안의 연속 줄은 한 행으로 묶었다.

### 1-3. 질문 (a)~(d) 답

**(a) 서비스 코드 → 한글 라벨 매핑 중복 정의: 최소 11곳.**
1. `src/data/serviceTypes.js:7-72` SERVICE_TYPES (세척/냉매/설치/누설/누수/출장/추가/미정)
2. `src/utils/workTypeKind.js:85-88` SERVICE_KIND_META (세척/냉매/설치/누설/누수)
3. `src/utils/workTypeColors.js:40-75` COLORS_* (name/icon/color)
4. `src/components/ServiceTypeIcon.jsx:53-57,119-170` `_baseType` 와 SvgByType
5. `src/lib/inquiriesDb.js:19-30` SERVICE_LABEL (접수 코드 10개) + `:105-117` SERVICE_WORKTYPE
6. `src/lib/commissionPoliciesDb.js:319-329` WORKTYPE_TO_SERVICE + `:345-` SERVICE_LABEL
7. `src/components/principal/NewReceptionScreenLite.jsx:48-56` WORK_TYPE_TO_SERVICE (위 6번과 내용이 다름: 6번은 누수 없음, 7번은 점검/수리/추가선택 없음)
8. `src/lib/engineerSkillsDb.js:42-52` serviceCodeToWorkType / workTypeToServiceCode (cleaning/refrigerant 2종만)
9. `src/utils/receptionForm.js:54-62,107,114-118` WORK_TYPES_CONFIG, WORK_TYPES, WORK_TYPE_DISPLAY_LABEL
10. `src/pages/AdminPcTimelineScreen.jsx:36-45,1009-1012` KIND_COLOR + 라벨 삼항식, `AdminApp.jsx:7783-7791,8200-8210` 아이콘·색 삼항식, `EngineerCalendarScreen.jsx:301-306,642-647`, `AdminPcEngineerCalendarScreen.jsx:516`, `AdminPcEngineerMonthlyCalendarScreen.jsx:452,580` 각자 인라인 라벨
11. `src/components/principal/PrincipalListTab.jsx:57-76,119-123`, `UsolHScheduleTab.jsx:117-140`, `usol_n/UsolNAssignList.jsx:53-79` 가 각각 **자체 getServiceKind 사본** 을 따로 정의 (workTypeKind.js 와 별개)
12. 코드 목록 UI: `CommissionCalculator.jsx:22-27`, `CommissionPolicyScreen.jsx:31-37`, `CommissionPolicyInlineEditor.jsx:18-23`, `EngineerListScreen.jsx:128-129`, `EngineerRegionEditor.jsx:13-16`, `RegionEngineerSearch.jsx:14-17`, `RegionListScreen.jsx:558-559`
13. 동의서 문구 키: `RefrigerantConsentScreen.jsx:257-264`, `AdminTaskDetailScreen.jsx:2618-2623` (refrigerant/leak_repair/leak_sealant/water_leak)
라벨 자체도 서로 다르다 (같은 leak 이 "누설/누수", "누설", "누수/누설", "냉매 누설", "누설 (냉매)" 로 나온다).

**(b) 마스터 테이블 실사용 여부.**
- `categories`: **읽는 코드/RPC 없음.** 시드 1행(aircon, id `33333333-3333-3333-3333-333333333001`, mig 004:40)뿐이고 이후 마이그레이션에서 추가된 행도 없다. 코드는 이 UUID 를 상수로만 쓴다 (`src/data/tasksDb.js:13`, `src/lib/commissionPoliciesDb.js:95`, `src/lib/usolNTasksDb.js:989`). `tenant_categories` 도 시드 1행 + RLS 정책만 있고 읽는 곳이 없다.
- `service_types`: **핵심적으로 사용 중.** 시드 7행(mig 004) + 3행(mig 034) + `water_leak` 1행(mig 195). 읽는 곳: ① sync 트리거 `sync_category_data_to_task_items` v7 (mig 205:100-102, `name = workType` 으로 조회, 없으면 RAISE) ② compute_payment (mig 200:302-304 에서 `task_items → work_types → service_types.code` JOIN) ③ 프론트 중첩 select `work_types(service_types(code))` 다수 (`tasksDb.js:57-61` 등), `taskItemsEditDb.js:183`, `visitOnlyDb.js:87`, `usolNTasksDb.js:937`.
- `work_types`: **사용 중.** 시드 13행(mig 004) + 4행(mig 034) + `water_leak`×5기종 및 `leak` 누락분 백필(mig 195:33-40). 설치 5종은 레포 밖에서 추가된 것으로 보인다. 트리거가 `name LIKE '%기종%'` 로 매칭한다 (mig 205:115-119). 단가는 0(현장 결정) 이 많아 실제 금액 기준은 `commission_policies` 와 접수 시 입력한 견적이다.
- `appliance_types`: 사용 중 (시드 7행).
- `commission_policies`: 사용 중. `calculate_commission` 이 (principal_code, service_code, appliance_code, qty_condition) 로 조회. mig 195 가 leak 정책을 water_leak 으로 복제했다.

**(c) 서비스 구분의 저장 위치.**
- `tasks.category_id`: NOT NULL 이지만 **항상 aircon 상수**가 들어가며 (`tasksDb.js:322-324` 기본값) 어떤 코드도 이 값으로 분기하지 않는다. 서비스 구분에는 쓰이지 않는다.
- 실제 저장은 `tasks.category_data` JSONB 의 `workType`(한글명 = `service_types.name`) 과 `workItems[]` (`{workType, appliance, qty, quote, orderType, description}`) 이다. 같은 JSON 에 `consent.type`, `refrigerant_addon` 등도 들어간다.
- 서비스 코드(`service_code`)는 **tasks 에 컬럼으로 저장되지 않는다.** sync 트리거가 `workItems[].workType` 의 한글명을 `service_types.name` 으로 찾아 `task_items.work_type_id` 를 넣고, 코드는 `task_items → work_types → service_types.code` 를 따라가서 얻는다. 프론트는 `workItems[].serviceCode` 로 평탄화해서 쓴다 (`tasksDb.js:232`). 이름이 `service_types.name` 에 없으면 저장 자체가 거부된다 ("알 수 없는 작업 유형", mig 205:106-112).
- 접수함은 별도로 `inquiries.service_type` (영문 코드, CHECK 제약) 에 저장한다.

**(d) 최신 compute_payment = mig 200 (v29, 2026-07-29)** (calculate_commission v11 동반).
- 서비스 코드는 per-item 으로 `st.code AS service_code` (task_items → work_types → service_types LEFT JOIN) 에서 읽는다 (200:302).
- 분기:
  - `usol_n` + `refrigerant` → `'addon'` 으로 재해석 (200:323-324)
  - `visit_fee` → 출장만 작업으로 표시 (200:328)
  - `refrigerant` 아님 → `v_has_non_refrigerant` (200:332)
  - `calc_method='비율_견적금액'` 이고 `refrigerant|leak|water_leak` → 비율(ratio) 처리 (200:354)
  - `refrigerant|leak|water_leak` 아니거나 `usol_n_추가선택` → `v_pure_refrigerant=false` (200:358)
  - `cleaning` → 추가금/usol_n 15% 보너스 분기 (200:368,422)
  - `refrigerant` → 기사별 `users.refrigerant_rate`(기본 50) 적용 (200:406)
  - 작업 전체가 순수 냉매계(refrigerant/leak/water_leak)이고 기사 배정 → 작업 단위 기사 정산율 재계산 (200:479-)
  - **설치는 서비스 코드가 아니라 `calc_method='직영_75_25'` 로 판정**하고, 모든 활성 항목이 그 방식일 때만: 기사 = 자재비 + FLOOR((상품가+추가금−자재비)×rate), rate 는 2026-07-29 00:00 KST 이후 완료분 0.80, 이전 0.75 (200:246-270,463-473). 회사 몫은 나머지, 원청 0.
- 그 외 코드(`inspect`, `repair`, `fan_disassembly`, `outdoor_unit`, `phytoncide`)는 정책이 있으면 `calculate_commission` 결과를 그대로 쓰고 별도 분기는 없다. 정책 행이 없으면 `policy_not_found` 로 정산이 중단된다 (mig 198 헤더 설명).
- 주의: `compute_engineer_amount_per_item` 최신판은 mig 140(v6)이며 `refrigerant`/`cleaning` 만 알고 `leak`/`water_leak`/`install` 분기가 없다 (140:182,186,196,233).

### 1-4. `docs/카테고리_확장_설계.md` 요지 (5줄)
1. 목표는 새 카테고리(예: 도어락)를 데이터 추가만으로 넣는 것. 현실 목표는 데이터 90% + UI 분기 10%.
2. 구조: `categories`(단위·수량종류·config) → `service_types` → `appliance_types` → `work_types`(서비스×기종 단가) + `pricing_rules` + `tenant_categories` 로 흡수.
3. 카테고리마다 다른 5가지(단위, 가격 모델, 기사 자격, 사진 단계, 폼 특이 필드)를 `categories.config`(`pricing_kind`, `photo_steps`, `form_schema`) 와 `tasks.category_data` JSONB 로 처리.
4. 코드 분기는 카테고리별 폼 컴포넌트 매핑(`CATEGORY_FORMS`)과 가격 함수 `computeEstimate` 의 `pricing_kind` case 추가로 한정 (최악 약 35줄 + 5개 테이블 INSERT).
5. **현재 구현과의 차이:** 설계는 `categories` 를 읽어 UI 를 자동 구성하는 것인데, 실제로는 aircon 1행만 있고 코드는 상수 UUID 로만 쓴다. 서비스 구분은 `service_types` 한글명/코드 문자열이 프론트와 DB 함수 곳곳에 직접 고정되어 있어 설계의 "코드 변경 0" 은 아직 성립하지 않는다. 또 설계는 `service_types` 코드를 `clean`/`relocate`/`recharge` 로 가정했으나 실제 코드는 `cleaning`/`refrigerant`/`leak` 등으로 다르다.

---

## 2. 분류별 표

경로는 `src/...` 기준 (api 는 `api/...`). "비고" 에 water_leak/hood/grave/move_in 반영 여부를 적었다.

### 2-1. 정산·수수료 (건별)

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/lib/commissionPoliciesDb.js:97-130 | 신규 원청 기본 정책 자동 생성이 `cleaning` 6행 + `refrigerant` 6행만 만든다 (calc_method 비율_견적금액, fee_rate 0.20) | install/leak/water_leak/addon 정책은 자동 생성 안 됨 (새 서비스 추가 시 수동 INSERT 필요) |
| src/lib/commissionPoliciesDb.js:319-329 | `WORKTYPE_TO_SERVICE` 한글 종목 → service_code (세척/냉매충전/출장비/추가선택(YS-N)/냉매점검(YS-N)/설치/누설/점검/수리) | **"누수" 누락.** `calculateFeeCompat`(:369) 은 "알 수 없는 작업유형" 오류, 항목 계산(:480) 은 `\|\| item.workType` 로 "누수" 그대로 RPC 에 보내 policy_not_found 가능 |
| src/lib/commissionPoliciesDb.js:369-375, 480 | 위 매핑으로 `calculate_commission` RPC 의 serviceCode 결정 | hood/grave/move_in 없음 |
| src/components/principal/NewReceptionScreenLite.jsx:48-56 | `WORK_TYPE_TO_SERVICE` (export): 세척/냉매충전/출장비/누설/누수/설치 → quote_rates 키·정책 조회 키 | 빠지면 단가 0 (주석 :46). 추가선택/냉매점검(YS-N) 없음. 다른 파일 4곳이 import |
| src/components/principal/NewReceptionScreenLite.jsx:118-130 | `lookupRate`: KA + refrigerant + 1way 면 첫대/추가 단가를 나눠 계산 | 서비스 코드 `'refrigerant'` 고정 |
| src/components/principal/NewReceptionScreenLite.jsx:822,1264,1280 | KA + 냉매충전 + 1way + qty≥2 일 때 분할 단가 안내 UI | 한글 `"냉매충전"` 비교 |
| src/utils/receptionForm.js:128-175 (133,153,173) | KA 1way 냉매충전 수량 합계·자동 견적 계산 | 한글 `"냉매충전"` 비교 |
| src/components/ApplianceSelectModal.jsx:184 | 기종 선택 모달이 `WORK_TYPE_TO_SERVICE[workType]` 로 serviceCode 를 정해 단가 재조회 | 모달 종목 목록 `POPUP_WORK_TYPES`(:38) 도 5개 고정 |
| src/utils/revenueStats.js:43-46,104-125 | 매출 집계가 `pickServiceCode` 결과로 cleaning/refrigerant/install/leak 별 합계, 나머지는 other | **water_leak 는 other 로 집계** (leak 에 합쳐지지 않음). 서버 RPC 도 같은 구조 (mig 175/176) |
| src/utils/revenueStats.js:68-73 | `pickServiceCode`: 본작업 항목 또는 첫 항목의 serviceCode 사용 | 모든 매출 화면의 기준 함수 |
| src/utils/remitFilter.js:127-135 | usol_n + 현장추가금>0 + (cleaning 코드 또는 "세척" 포함) 이면 15% 보너스 입금 대상 | compute_payment `v_cleaning_principal_bonus` 분기를 프론트가 복제 (주석 :127) |
| src/lib/usolRemitHistoryDb.js:26-34 | usol_n 입금 이력에서 cleaning 코드 또는 이름에 "세척" 포함 항목만 센다 | 이름 기반 폴백 |
| src/data/tasksDb.js:104-108 | 유솔N 본작업 + `service_types.code==='refrigerant'` 를 `hasUsolNMainRefrigerant` 로 표시 | 대시보드 카운트 통일용 (`dashboardStats.js:45,155` 가 이 값을 사용) |
| src/utils/visitFeeDetect.js:18-60 | `service_types.code==='visit_fee'` / `work_types.code==='visit'` / 이름 "출장비" 로 출장 항목 판정 | 출장만 정산(visit_only) 판단 근거 |
| src/utils/visitFeeDetect.js:96-110 | `isRefrigerantItem`: 코드 `refrigerant` 또는 이름에 냉매/가스/충전 | 순수 냉매 작업 판정 (정산 정보 숨김 분기에 사용) |
| src/lib/usolNTasksDb.js:830-840 | CSV 업로드 시 한글 키워드 → 추가선택 work_types.code (냉매→refri_no_appliance 등) | usol_n 네이버 정산 전용 |
| src/lib/usolNTasksDb.js:940-950 | cleaning 서비스 id 를 `s.code==='cleaning'` 으로 찾는다 | usol_n CSV 업로드 |
| src/components/admin/CommissionCalculator.jsx:22-27,50,60 | 수수료 계산기 서비스 선택 4개(cleaning/refrigerant/addon/visit_fee), 초기값 refrigerant, KA + refrigerant + 1way 일 때 수량 입력 | install/leak/water_leak 선택 불가 |
| src/components/admin/CommissionPolicyScreen.jsx:31-37 | 정책 화면 서비스 필터 4개 | 위와 같음 (설치/누설/누수 정책은 화면에서 못 본다) |
| src/components/admin/CommissionPolicyInlineEditor.jsx:18-23,33 | 정책 인라인 편집 탭 4개 (세척/냉매충전/추가 옵션/출장비), 기본 cleaning | 위와 같음 |
| src/components/admin/FakeBaseEditor.jsx:52 | 가짜단가 편집이 `serviceCode:"cleaning"` 정책만 조회 | KA/KB 전용 |
| src/data/principals.js:574-590 | `createEmptyPolicy("cleaning", ...)` 정책 템플릿 (fake_split / naver_settlement) | 구형 정책 편집 흐름의 템플릿으로 보임 (사용처 확인 필요) |
| src/components/AdminTaskDetailScreen.jsx:1012-1020 | 정산 카드: 모든 항목이 `serviceCode==='install'` 또는 "설치" 포함이면 설치 자재비 UI 표시 | 설치 80/20 + 자재비 정산(mig 198/200) 화면 쪽 |
| src/components/EngineerTaskCompletionScreens.jsx:918-940 | 완료 화면: 모든 항목이 `refrigerant` 면 냉매 추가 토글 숨김(:923), 모두 `install` 이면 자재비 입력(:936) | 두 곳 모두 코드 + 한글 폴백 |
| src/components/EngineerEditScreen.jsx:80 | 기사 단가 행 종목 옵션 `["세척","냉매충전","냉매점검","출장비","추가선택"]` | 설치/누설/누수 없음 |
| src/components/EngineerTaskCompletionScreens.jsx 외 `usol_n` 세척 판정 | `(workType).includes('세척')` + usol_n 이면 15% 보너스 안내 표시: EngineerApp.jsx:792,1410, EngineerNewAssignmentListScreen.jsx:140, EngineerSettlementDetailScreen.jsx:288, EngineerTaskDetailScreen.jsx:1535, WorkItemRow.jsx:9, AdminApp.jsx:5460 | 한글 "세척" 포함 판정 7곳 (정산 안내 표시) |

### 2-2. 접수 양식

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/utils/receptionForm.js:54-62 | `WORK_TYPES_CONFIG`: 종목별 enabled / workflow(manual_with_recommendation 또는 auto_first_accept) / needsAppliance / priority(세척1, 설치2, 누설3, 누수4, 냉매충전99) | 새 종목은 여기 없으면 priority 100, workflow 기본값으로 동작 |
| src/utils/receptionForm.js:83-98 | `APPLIANCE_POOL`, `NULL_APPLIANCE_WORK_TYPES=["설치"]`: 종목별 기종 목록 (설치는 5종) | 누수 = 누설과 동일 5기종 |
| src/utils/receptionForm.js:107 | `WORK_TYPES` 배열: 접수 폼 종목 선택지 8개 (세척, 냉매충전, 누설, 누수, 설치, 출장비, 추가선택(YS-N), 냉매점검(YS-N)) | 저장·매칭 키라 `service_types.name` 과 일치해야 한다 (주석 :105-112) |
| src/utils/receptionForm.js:114-121 | `WORK_TYPE_DISPLAY_LABEL`: 누설→"누설 (냉매)", 누수→"누수 (물)" | 화면 라벨 겸용 |
| src/utils/receptionForm.js:291-306 | `getAppliancePool`: 냉매충전 공용 풀, 설치는 "올데이케어" 원청만 5종, 누설은 usol_n 이면 "(공통)" | 원청 이름 + 종목 한글 고정 |
| src/utils/receptionForm.js:681-725 | 붙여넣기 파서: 키워드(청소/세척/냉매/가스/충전/설치/누설/누수) → 종목. **"누수" 를 "누설" 로 바꿔 저장(:691)**, 물펌프·물새 계열도 "누설" 로 보냄(:711-716) | **water_leak 신설(07-28) 이후에도 파서는 누수를 누설로 저장** — 별칭 정리가 안 된 상태 |
| src/utils/receptionForm.js:733-775 | 파서 workItems 생성: 냉매충전은 기종 없이 별도 분기, 나머지는 기종 매칭 | 한글 "냉매충전" 고정 |
| src/utils/receptionForm.js:857 | 파서 토큰 정규식에 세척/청소/냉매충전/냉매점검/설치/누설/누수 | 새 종목 키워드 별도 추가 필요 |
| src/components/admin/NewReceptionPcForm.jsx:364,649,659,831 | PC 접수 폼: 냉매충전은 기종 오류 문구 별도, 설치는 "종류" 라벨, `requiresApplianceFor` 는 항상 true | 종목 목록은 `WORK_TYPES` 사용 (자동 반영) |
| src/components/TaskEditScreen.jsx:169,485,491 | 편집 화면: 냉매충전이면 기종 칸 숨김, 설치는 "종류" 라벨 | 한글 고정 |
| src/pages/AdminApp.jsx:2333,2457,2604,2709,3031 | `WORK_TYPES_CONFIG[workType].workflow` 로 접수 후 자동수락/수동추천 분기 | 새 종목은 config 에 없으면 수동추천이 기본 |
| src/pages/AdminApp.jsx:10778,10819,10886,11325-11328,11593 | 모바일/관리자 접수 폼: 설치는 appliance 를 description 으로 이동, 냉매충전 기종 오류 문구, 칸 라벨(추가선택→"추가 종류", 냉매점검→"케이스", 출장비/설치→"구분"), 냉매충전일 때 부가 UI | 한글 `workType ===` 비교 |
| src/components/ApplianceSelectModal.jsx:38,57-64,269 | 기종 선택 팝업이 5종(세척/냉매충전/누설/누수/설치)만 취급, kind 로 되돌려 정규 종목명 산출 | 새 종목은 팝업 목록에 추가해야 함 |
| src/utils/completeGuard.js:39-80 | 설치 종목이면 5종 중 하나가 선택돼야 완료 가능 (`getServiceKind(wt)!=="install"` 아니면 통과) | 설치 5종 한글명 고정 |
| src/components/principal/NewReceptionScreenLite.jsx:36 | `DEFAULT_WORK_TYPES=["세척","냉매충전","출장비"]` 원청용 간이 접수 폼 기본 종목 | 누설/누수/설치는 원청이 넘기는 props 로만 |
| src/pages/LandingApp.jsx:17-25,823 | 홈페이지 접수 폼 한글 라벨 → RPC 코드 (냉매충전/분해세척/냉매 누설/물 누수/에어컨 설치/잘 모르겠어요), 없으면 `'unknown'` | hood/grave/move_in 은 이 페이지가 아니라 `public/*.html` 이 직접 전송 |
| public/hood.html:344, public/care.html:381, public/ipju.html:254 | 랜딩 3종이 `p_service_type` 을 `'hood'`(후드 설치만 `'install'`) / `'grave'` / `'move_in'` 으로 고정 전송, 거부되면 `'unknown'` 으로 재전송 | src 밖이지만 서비스 코드 고정 위치 |
| src/lib/inquiriesDb.js:19-30,105-131 | 접수 코드 → 한글 `SERVICE_LABEL`, → 작업 종목 `SERVICE_WORKTYPE`(hood/grave/move_in 은 빈 값), `inquiryWorkType` 은 hood/ipju/grave source 면 빈 값 | 접수함 → 작업 전환 시 종목 프리필 |
| src/pages/AdminApp.jsx:4049-4054 | 접수함 → 접수 폼 전환: 메모에 입주청소/주방후드/벌초 라벨, workType 은 `inquiryWorkType()` | 종목 자동 선택 안 됨 (후드·입주청소) |
| api/ad-hub.js:409 | 광고 허브 전화 접수 보강: `PHONE_LEAD = { install: { workType: "설치", principalId: "…2001" } }`, `category_data.workType === "설치"` 비교(:433) | 접수 집계용 (서비스 코드 `install` 고정) |

### 2-3. 화면 표시 (라벨·아이콘·색)

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/utils/workTypeKind.js:19-35 | `_kindFromWorkType`: 이름 접두사(세척/냉매/설치/누설/누수) + 설치 5종 이름 → kind | 모든 화면 분류의 근원. 새 종목은 여기에 추가 안 하면 `other` |
| src/utils/workTypeKind.js:37-44 | `_kindFromServiceCode`: cleaning/refrigerant/install/leak 만 인식 | **water_leak, hood, grave, move_in 은 null** → 이름 폴백으로만 동작 |
| src/utils/workTypeKind.js:62-97 | `isCleaning`/`isRefrigerant`, `SERVICE_KIND_META` 라벨·색·아이콘, `SERVICE_KIND_ORDER` | 5종 고정 |
| src/data/serviceTypes.js:7-72 | `SERVICE_TYPES` 8개 (cleaning/refrigerant/install/leak/visit/extra/undecided) 라벨·아이콘·색 | water_leak 항목 없음 (leak 으로 표시) |
| src/data/serviceTypes.js:94-135 | `detectServiceType`: kind → SERVICE_TYPES 매핑, 냉매/가스/충전/출장 텍스트 폴백, 종목 미확정이면 undecided | 폴백 기본값 `getServiceTypeById` 는 cleaning |
| src/utils/workTypeColors.js:40-75 | `getWorkTypeColors`: kind 별 색 세트 (cleaning/refrigerant/install/leak), 나머지 기본 핑크 "기타" | 새 종목은 기본 핑크 |
| src/components/ServiceTypeIcon.jsx:50-60,119-170 | `_baseType` 한글 라벨 + SVG 아이콘을 `workType === "세척"/"냉매충전"/"설치"/"누설"/"점검"/"수리"` 로 분기 | "누수"/"누설/누수" 는 SVG 분기에 없어 아이콘이 null 일 수 있음 (확인 필요) |
| src/components/ServiceTypeBadge.jsx:12,34 | `detectServiceType` 결과로 배지 | 간접 사용 |
| src/components/principal/PrincipalListTab.jsx:57-76,119-123,757,1186 | **자체 사본** getServiceKind (코드/이름 → refrigerant/clean/install/leak/addon) + 아이콘 | water_leak 은 이름 "누설" 접두사 검사만 있어 `addon` 으로 빠질 수 있음 |
| src/components/principal/UsolHScheduleTab.jsx:117-140 | 위와 같은 자체 사본 | 위와 같음 |
| src/components/usol_n/UsolNAssignList.jsx:53-79,248 | 자체 사본: cleaning→main, refrigerant→addon, install, leak | 위와 같음 |
| src/pages/AdminApp.jsx:6093-6150 | 목록 카드 서비스 아이콘: `ACCEPTED=Set(cleaning,refrigerant,install,leak)` 에 속한 kind 만 표시 | |
| src/pages/AdminApp.jsx:6305-6332 | 통계 탭 `getByType`: 세척/냉매충전/누설/설치 별 필터 (`serviceCode===` 또는 이름 접두사) | **누수 탭 없음**, `startsWith("누설")` 만 있어 누수는 누설 탭에도 안 잡힘 |
| src/pages/AdminApp.jsx:7783-7791 | 상세 아이콘·색 삼항식 (냉매 #EF9F27, 누설 #DC2626, 설치 #8B5CF6, 세척 info) | 인라인 색상 복제 |
| src/pages/AdminApp.jsx:8199-8210 | 위와 비슷한 삼항식 + `isRef` | 인라인 중복 |
| src/pages/AdminPcTimelineScreen.jsx:36-60,969-1012 | `KIND_COLOR` 맵 + 라벨 삼항식(냉매/세척/설치/누설/누수) | visit 는 별도 처리 |
| src/pages/AdminPcEngineerCalendarScreen.jsx:507-516 | 달력 칸 제목 냉매/세척/기타 | install/leak 은 "기타" |
| src/pages/AdminPcEngineerMonthlyCalendarScreen.jsx:443-452,574-580 | 월간 달력 제목·아이콘 (냉매 ⚡, 세척 ❄, 그 외 •) | 위와 같음 |
| src/pages/AdminPcFlowScreen.jsx:201 | kind 로 흐름 화면 표시 | |
| src/components/admin/EngineerCalendarScreen.jsx:301-306,642-647 | 검색 결과/목록: cleaning→세척, refrigerant→냉매, 나머지 기타 | 색 상수 3개 |
| src/utils/engineerCalendarStats.js:68-75 | `classifyByService`: cleaning / refrigerant / other 3분류 집계 | 설치/누설/누수는 other |
| src/components/admin/RevenueDetailScreen.jsx:88,299 | 매출 상세 `taskKind` 필터 (all/cleaning/refrigerant/other) 와 `SERVICE_KIND_META` | |
| src/components/CalendarGrid.jsx:96-97 | 점 색: "세척" 포함→파랑, "냉매"/"충전" 포함→노랑, 기타 핑크 | 한글 포함 검사 |
| src/components/EngineerBadge.jsx:20,24,51 | 기사 배지 문맥 workType `'cleaning'`/`'refrigerant'` 분기 | 2종만 |
| src/pages/EngineerApp.jsx:1058-1059 | 기사 홈 건수: `isCleaning` / `isRefrigerant` 2종만 집계 | 설치·누설·누수 건수 누락 가능 |
| src/pages/EngineerApp.jsx:1689-1691, src/pages/HappycallApp.jsx:546-548 | 아이콘: 세척/분해세척→Snowflake, 냉매/가스→Zap, 설치/이전설치→Settings | 이름 포함 검사 |
| src/components/EngineerAcceptanceListScreen.jsx:70,73 | 냉매충전이면 "냉매" 로 줄여 표시, "세척" 포함 여부 | |
| src/pages/HappycallApp.jsx:238-300 | `BASE_PRICES`/`getPriceHint`: 세척/분해세척 등 한글 키 시세 힌트, 코드에서 `WORK_TYPES` 를 참조하나 정의가 없음 | 구형 화면으로 보임 (실행 경로면 오류 가능, 확인 필요) |
| src/lib/inquiriesDb.js:19-30 | 접수함 배지 한글 라벨 (hood→후드, grave→벌초·산소, move_in→입주청소 등) + source 접두사 판별 `isHoodSource/isIpjuSource/isGraveSource` | `AdminInquiriesScreen.jsx:129-144` 배지·색도 같은 접두사로 고정 |
| src/components/admin/AdminInquiriesScreen.jsx:129-144 | 유입 배지: leak_landing / grave_landing / ipju_landing / hood_landing 각각 라벨·색 고정 | 새 랜딩 추가 시 여기도 |
| src/components/ApplianceSelectModal.jsx:521-522 | `detectServiceType(task).id==="undecided"` 이면 기종 선택 필요 | |

### 2-4. 배정·추천 (기사 스킬, 지역 추천)

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/utils/engineerRecommendation.js:40-47 | `serviceKindToRecKey`: refrigerant/install/leak → "refrigerant" 풀, 나머지 모두 "cleaning" 풀 | **2분법.** 새 종목(후드 등)은 자동으로 "세척 기사" 풀로 추천된다 |
| src/utils/engineerRecommendation.js:67 | 스킬 매칭 정규화: 풀이 refrigerant 면 "냉매충전", 아니면 "세척" 으로 비교 | DB 스킬의 workType 은 세척/냉매충전 2종뿐 |
| src/utils/engineerRecommendation.js:308-320 | DB 직접 추천 `_pickServiceCode`: serviceCode 가 cleaning/refrigerant 면 그대로, install/leak 이면 refrigerant, 그 외 kind 폴백 | **water_leak 코드는 직접 매칭 안 되고 kind 폴백(leak→refrigerant)으로만 맞는다.** `engineer_principal_permissions.service_code` 2종 |
| src/lib/engineerSkillsDb.js:42-52 | 스킬 DB 코드 ↔ 한글 변환 (cleaning↔세척, refrigerant↔냉매충전) | 2종 고정, 그 외는 입력 값 그대로 |
| src/components/EngineerCoverageMap.jsx:102-103 | 지도 범례: 스킬 workType "세척" → clean, "냉매충전" → refri | |
| src/components/EngineerEditScreen.jsx:35-36,408-421 | 기사 편집: 세척/냉매충전 스킬 2칸, `updateWork("cleaning"\|"refrigerant")` | 새 종목 스킬 입력칸 없음 |
| src/components/EngineerListScreen.jsx:69-70,128-129 | 기사 목록 필터 `cleaning`/`refrigerant` 2종 | |
| src/components/EngineerRegionEditor.jsx:13-19 | 지역 편집 종목 탭 2종, 기본 cleaning | |
| src/components/RegionEngineerSearch.jsx:14-21,230 | 지역별 기사 검색 종목 탭 2종 | |
| src/components/RegionListScreen.jsx:61,470,558-559 | 지역 목록 `["cleaning","refrigerant"].forEach`, 탭 2종 | |
| src/pages/AdminApp.jsx:10130 | 배정 모달에서 `isRefrigerant(mainWorkType)` 이면 냉매 지역, 아니면 세척 지역 사용 | 2분법 |

### 2-5. 문서 발급 (동의서)

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/components/AdminTaskDetailScreen.jsx:393-406 | refrigerant 또는 leak 인데 동의서 없으면 경고 배너 ("누수/누설" 또는 "냉매충전" 문구) | water_leak 은 leak kind 로 합쳐져 동일 처리 |
| src/components/AdminTaskDetailScreen.jsx:2618-2630 | 동의서 유형 라벨 맵: refrigerant / leak_repair / leak_sealant / water_leak | 접수 서비스 코드가 아니라 **동의서 문구 키** |
| src/components/EngineerTaskDetailScreen.jsx:706 | 동의서 화면 `kind` = leak 이면 "leak" 아니면 "refrigerant" | 누수/누설 구분 없이 같은 화면 |
| src/components/EngineerTaskDetailScreen.jsx:1071,1155-1160 | 진행중/완료 소급 동의서 버튼, 확정 단계에서 작업 시작 차단 (`isRefrigerantWorkType \|\| kind==='leak'`) | 작업 시작 차단 규칙. 새 종목은 동의서 없이 시작됨 |
| src/components/EngineerTaskDetailScreen.jsx:1624-1626 | refrigerant/leak 만 고객 견적금액 블록 표시 | |
| src/pages/EngineerApp.jsx:1735 | 목록 카드 "동의서 ✗" 배지 (냉매/누설 + 진행중·완료 + 미서명) | |
| src/components/RefrigerantConsentScreen.jsx:73-89,257-264,382-406 | 동의서 문구 4종(refrigerant / leak_repair / leak_sealant / water_leak), 순서는 `kind==="leak"` 여부로 갈림 | 문구 선택 화면. 후드 등은 문구 없음 |
| src/data/tasksDb.js:1586,1590- | `saveConsentAdapter` 의 `type` 에 어떤 문구에 서명했는지 저장 | 주석에는 3종만 적혀 있으나 water_leak 도 들어간다 |

### 2-6. 기타

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| src/lib/cancelRpc.js:110-120 | 취소 건 운영자 수고비 `kind: 'visit_fee' \| 'none'` | 서비스 코드 `visit_fee` 와 이름만 같고 의미 다름 |
| src/pages/AdminApp.jsx:2964, 9134 | 위 취소 수고비 토스트·옵션 `"visit_fee"` | 위와 같음 |
| src/pages/AdminPcFlowScreen.jsx:211 | `cancelEngineerCompKind === "visit_fee"` | 위와 같음 |
| api/sms/send.js:14,163,248 | SMS `type:'visit_fee'` (출장비 안내) | 메시지 종류, 서비스 코드 아님 |
| api/ad-console.js:226-250 | 작업유형별 완료율·수익 분석, 우선순위 `{세척:1, 설치:2, 누설:3, 누수:4, 수리:5, 점검:5, 냉매충전:99}` 로 메인 종목 선택 | 한글 고정, receptionForm priority 와 별개 사본 |
| src/lib/inquiriesDb.js (기타 `unknown` 처리) | 접수 `unknown` → 라벨 "잘 모르겠어요(방문진단)" | |
| src/lib/usolNTasksDb.js:989, src/data/tasksDb.js:13,322-324, src/lib/commissionPoliciesDb.js:95 | `CATEGORY_ID_AIRCON` 상수 UUID 3곳 | categories 테이블 미사용의 증거 |
| src/api.js:155 | 주석: PWA workType "세척"/"냉매충전" ↔ service_code | 매핑 설명 주석뿐 |
| src/pages/AdminPcRevenuePanel.jsx:11 | 주석 (pickServiceCode 'visit_fee' → other) | |
| src/components/admin/UnmarkVisitOnlyDialog.jsx:36-72, src/lib/visitOnlyDb.js:86-101, src/lib/taskItemsEditDb.js:183-185, src/components/admin/TaskItemEditModals.jsx:553 | `service_types`/`work_types`/`appliance_types` 를 select 해 선택지를 만든다 (**DB 에서 읽는 정상 경로**) | 새 서비스가 DB 에만 들어가도 이 화면들은 자동 반영 |

### 2-7. DB 측 연동 분기 (src 밖, 참고)

| 파일:줄 | 분기 내용 | 비고 |
|---|---|---|
| db/migrations/200_install_80_20.sql:302-480 | compute_payment v29 서비스 분기 전체 (1-3장 (d) 참조) | 최신 |
| db/migrations/200:49-187 | calculate_commission v11: 정책 조회는 service_code 별, 코드 분기는 `p_service_code='cleaning'` 만 (비율_견적금액·정액에서 기사몫 계산 방식 차이) | 설치는 `'직영_75_25'` calc_method 분기 |
| db/migrations/140:182-267 | compute_engineer_amount_per_item v6 는 refrigerant/cleaning 만 처리 | leak/water_leak/install 미반영 (최신판) |
| db/migrations/205:96-146 | sync 트리거 v7: `service_types.name = workType` 조회 후 없으면 RAISE, `work_types.name LIKE '%기종%'` | 새 서비스는 service_types 행이 없으면 접수 저장이 거부된다 |
| db/migrations/175:139-158, 176:104-123 | 대시보드 요약 RPC: `service_code` 를 cleaning/refrigerant/install/leak 로 합산, 그 외 other | water_leak 은 other (프론트 `revenueStats.js` 와 동일 증상) |
| db/migrations/197, 211 | `create_inquiry` 허용 목록 + `inquiries_service_type_check` 에 10개 값 고정 | 새 접수 코드는 이 둘을 같이 확장해야 한다 |
| db/migrations/195:42-52 | water_leak 정책을 leak 정책 복제로 생성 | 새 서비스도 정책 행이 필요 |

---

## 3. 새 서비스(예: 주방후드 업소용/가정용/설치, 이전설치)를 추가할 때 반드시 손대야 하는 곳

먼저 결정할 것: **새 서비스를 `install`/`cleaning` 아래의 work_types 로 넣을지(코드 변경 최소), 새 `service_types` 코드로 만들지(코드 변경 다수).** 이전설치는 이미 `install` 의 work_types 5종 중 하나이므로 새 코드가 필요 없다.

**A. DB (먼저 배포. 빠지면 접수 저장 또는 정산이 실패)**
1. `service_types` 에 행 추가 (예: `hood`, 이름 "주방후드"). 이름이 접수 폼 `WORK_TYPES` 문자열과 정확히 일치해야 한다. 없으면 sync 트리거 v7 이 저장을 거부한다 (mig 205:106-112).
2. `work_types` 행 추가 (업소용/가정용/설치 등). 이름이 기종 문자열 `LIKE '%…%'` 로 매칭되므로 이름 규칙을 정한다. 기종이 없는 서비스는 `appliance_type_id NULL` (설치 5종 방식).
3. `commission_policies` 에 (원청 × 서비스 × 기종) 정책 행 추가. 없으면 `policy_not_found` 로 compute_payment 가 중단된다. 기본 원청 6개 모두에 필요하다 (mig 195 의 복제 방식 참고).
4. compute_payment: 비율형이면 `IN ('refrigerant','leak','water_leak')` 목록(200:354,358)에 코드를 넣을지, 고정형으로 둘지 결정. 새 정산 방식이면 `calculate_commission` 에 CASE 추가. 설치형 80/20 이면 `직영_75_25` calc_method 를 정책에 지정하면 기존 install 블록이 처리한다. `compute_engineer_amount_per_item`(v6) 도 같이 확인.
5. 매출 집계 RPC (mig 175/176 `get_admin_dashboard_summary`): 새 코드는 other 로 합산된다. 별도 버킷이 필요하면 수정.
6. 접수함 코드가 필요하면 `inquiries_service_type_check` 와 `create_inquiry` 허용 목록 (mig 197/211 방식).

**B. 프론트 필수 (빠지면 화면에서 "기타/미정" 으로 떨어지거나 접수·정산이 안 됨)**
1. `src/utils/receptionForm.js`: `WORK_TYPES`(:107), `WORK_TYPES_CONFIG`(:54), `APPLIANCE_POOL`/`getAppliancePool`(:85,291), 파서 `workTypeMap`/정규식(:681,857).
2. `src/utils/workTypeKind.js`: `_kindFromWorkType`, `_kindFromServiceCode`, `SERVICE_KIND_META`, `SERVICE_KIND_ORDER` (이 파일이 모든 화면 분류의 근원).
3. `src/components/principal/NewReceptionScreenLite.jsx:48` `WORK_TYPE_TO_SERVICE` 와 `src/lib/commissionPoliciesDb.js:319` `WORKTYPE_TO_SERVICE` (두 곳 모두. 현재 서로 내용이 다름).
4. `src/data/serviceTypes.js` SERVICE_TYPES + `detectServiceType`, `src/utils/workTypeColors.js`, `src/components/ServiceTypeIcon.jsx` (라벨·아이콘·색).
5. `src/components/ApplianceSelectModal.jsx:38` `POPUP_WORK_TYPES` (기종 선택이 필요한 종목이면).
6. 배정: `src/utils/engineerRecommendation.js:43,316` — 어느 기사 풀(세척/냉매)로 보낼지 정한다. 기본값은 세척 풀. 새 기사 스킬 종목이 필요하면 `engineerSkillsDb.js:42-52`, `EngineerEditScreen.jsx`, `EngineerListScreen.jsx`, `RegionListScreen.jsx`, `RegionEngineerSearch.jsx`, `EngineerRegionEditor.jsx` 와 DB `engineer_principal_permissions.service_code` 까지 확장.

**C. 매출·통계 (빠지면 집계에서 "기타" 로 합산)**
`src/utils/revenueStats.js:43-46,104-125`, `src/utils/engineerCalendarStats.js:68`, `src/pages/AdminApp.jsx:6093,6305-6332`, 달력 화면 3곳(`AdminPcEngineerCalendarScreen.jsx:516`, `AdminPcEngineerMonthlyCalendarScreen.jsx:452,580`, `EngineerCalendarScreen.jsx:301,642`), `AdminPcTimelineScreen.jsx:36-60,1009`, `api/ad-console.js:238`.

**D. 정책 편집 화면 (운영자가 정책을 볼 수 있게)**
`CommissionCalculator.jsx:22`, `CommissionPolicyScreen.jsx:31`, `CommissionPolicyInlineEditor.jsx:18`, `commissionPoliciesDb.js:97-130` (신규 원청 기본 정책 자동 생성).

**E. 해당될 때만**
- 동의서/시공확인서가 필요한 서비스: `RefrigerantConsentScreen.jsx`, `EngineerTaskDetailScreen.jsx:706,1071,1155`, `AdminTaskDetailScreen.jsx:393,2618`, `EngineerApp.jsx:1735`.
- 자체 getServiceKind 사본 3곳: `PrincipalListTab.jsx:57`, `UsolHScheduleTab.jsx:117`, `UsolNAssignList.jsx:53` (새 종목이 이들 목록에 나타나면 같이 수정).
- 홈페이지 접수: `src/pages/LandingApp.jsx:17`, `src/lib/inquiriesDb.js:19,105`, `AdminInquiriesScreen.jsx:129-144`, `public/*.html`, 접수함 → 작업 전환 `AdminApp.jsx:4049`.
- 파서가 "누수" 를 "누설" 로 바꾸는 별칭(`receptionForm.js:691`) 은 water_leak 신설 후에도 남아 있으므로, 같은 방식의 별칭이 새 종목 파싱에 영향을 주지 않는지 점검.

## 4. 가장 위험한 곳 (요약)
1. **sync 트리거 v7 (mig 205) 의 `service_types.name` 이름 매칭** — 프론트 한글 문자열과 DB 이름이 한 글자라도 다르면 접수 저장이 거부된다. 새 서비스의 필수 선행 조건.
2. **compute_payment v29 (mig 200) 의 `IN ('refrigerant','leak','water_leak')` 목록과 `policy_not_found` 중단** — 새 코드를 목록에 넣지 않거나 정책 행이 없으면 정산이 0 이거나 중단되고, `compute_engineer_amount_per_item` v6 는 leak/water_leak/install 을 아예 모른다.
3. **`engineerRecommendation.js:43` 의 2분법과 `workTypeKind.js` 의 5종 kind** — 목록에 없는 새 종목은 자동으로 "세척 기사" 풀 + "기타" 화면 + 매출 "other" 버킷으로 떨어진다. water_leak 은 이미 매출 집계(`revenueStats.js`, mig 175/176)와 `WORKTYPE_TO_SERVICE`("누수" 누락)에서 이 문제를 겪고 있다.


---

# 3. RPC 를 거치지 않는 직접 쓰기

조사 범위: `src/`, `api/` (제외: `_backups/`, `_to_delete/`, `src-backup/`, `.before-*` 사본, `_stg*.jsx`, `backup_*` 사본). 코드·DB 수정 없음. 모든 경로는 `C:\Users\butto\Desktop\ollit` 기준 상대경로.

## 1. 요약

### 건수
- `src/` 클라이언트 직접 테이블 쓰기: **36건** (insert 12 / update 20 / delete 4 / upsert 0). 단 `engineerRatesDb.js` 의 "upsert" 는 select 후 update/insert 로 분기하는 방식이라 update·insert 로 집계함.
- `src/` storage 버킷 쓰기: 3건 (upload 1, remove 2) - 별도 표.
- `api/` 서버(service role) 쓰기: `.from()` 체인 26건 (ad-hub.js 22, push/send.js 1, push/subscribe.js 3) + REST `fetch` POST 쓰기 다수(ad-manage.js, ad-autobid.js, click-log.js, rank-check.js). 전부 `낮음`.
- 36건 중 PrincipalApp(원청)·EngineerApp(기사)에서 도달 가능한 것이 다수이며, 같은 함수가 여러 앱에서 공유되는 경우가 많음.

### 위험도별 (src 36건)
| 위험도 | 건수 | 비고 |
|---|---|---|
| 높음 | 25 | 원청 또는 기사 앱에서 실행되는 경로 (tasks, task_items, payments, user_off_days, photos, raw_orders 등) |
| 중간 | 9 | 운영자 전용 화면 (principals, commission_policies, tenants, engineer_rates, tasks 푸시 후보) |
| 낮음 | 2 | task_changes(감사 로그), task_memos(메모) |

(`user_roles` 쓰기 1건은 호출 경로가 없는 죽은 코드라 중간으로 분류)

### 테이블별 (src)
| 테이블 | 건수 | 동작 |
|---|---|---|
| tasks | 7 | insert 2, update 5 |
| task_items | 7 | update 6, insert 1 |
| payments | 5 | update 5 |
| engineer_rates | 3 | update 1, insert 1, delete 1 |
| principals | 3 | update 1, insert 1, delete 1 |
| commission_policies | 2 | insert 1, update 1 |
| user_off_days | 2 | insert 1, delete 1 |
| photos | 2 | insert 1, delete 1 |
| user_roles | 1 | insert 1 (미사용 함수) |
| tenants | 1 | update 1 |
| raw_orders | 1 | insert 1 |
| task_changes | 1 | insert 1 |
| task_memos | 1 | insert 1 |

### 인증 / RLS 구조 (한 단락)
로그인은 **Supabase Auth 가 아니라 자체 세션**이다. `src/lib/auth.js` 의 `signInWithPhone` 이 `sign_in_with_phone` RPC(전화번호 + PIN, bcrypt, `db/migrations/007`, `057`, `058`)를 호출하고, 응답(`user_id`, `roles` 등)을 `localStorage("allit.user")` 에 저장한다. `src/lib/supabase.js` 의 클라이언트는 **anon key 만** 사용하며 `supabase.auth` 를 쓰지 않으므로 서버 입장에서 `auth.uid()` 는 항상 NULL 이다 (`src/lib/cancelRpc.js`, `engineerTaskRpc.js`, `bookkeepingDb.js` 주석에도 명시). 새로 만든 RPC 들(취소, 송금, 정산, 장부, 기사 일정변경 등)은 `SECURITY DEFINER` + `p_actor uuid` 인자로 호출자를 넘기고 함수 안에서 `_caller_is_admin(p_actor)` 또는 partner `principal_id` 일치를 검사하는 패턴이다 (`p_actor` 는 마이그레이션에서 672회 사용). 단 `p_actor` 는 클라이언트가 보내는 값이라, 다른 사람의 user_id 를 알면 위조 가능하다는 구조적 한계가 있다. 반면 이번 조사 대상인 직접 쓰기는 이 검증을 전혀 거치지 않고 anon 권한과 RLS 정책만으로 통과 여부가 결정된다.

### RLS 정책 현황 (db/migrations 기준)
저장소에 있는 마이그레이션만 보면 `003_rls_views_funcs.sql` 이 전 테이블에 RLS 를 켜고 정책을 `auth.uid()` / `current_user_has_role()` / `current_user_principal_id()` 기준으로 정의했다. 자체 세션에서는 `auth.uid()` 가 NULL 이므로 이 정책들은 anon 클라이언트에게 사실상 모두 거부다. 이후 anon 용 정책이 개별 테이블에만 추가되었다.

| 테이블 | 저장소 마이그레이션의 정책 | partner / principal_id 기준 정책 | 평가 |
|---|---|---|---|
| tasks | 003: owner/operator FOR ALL, engineer SELECT·UPDATE(assigned_engineer_id = auth.uid()), partner SELECT(principal_id = current_user_principal_id()) | SELECT 만 (auth.uid() 기반이라 anon 에게 무효) | **anon 용 INSERT/UPDATE 정책이 저장소에 없음.** 그런데 앱은 anon 으로 tasks 를 직접 SELECT·INSERT·UPDATE 하고 있어, 실DB 에는 저장소에 없는 정책이 있거나(대시보드에서 직접 추가) RLS 가 다르게 설정된 것으로 추정. `pg_policies` 확인 필요 |
| task_items | 003: task_id 가 같은 tenant 의 tasks 에 속하면 FOR ALL (role 검사 없음, `auth.uid()` 도 아닌 `current_tenant_id()` 기반) | 없음 | anon 에서는 `current_tenant_id()` 가 NULL 이라 거부되어야 하나 실제 앱 동작과 불일치 - 실DB 확인 필요 |
| payments | 003: owner/operator ALL, engineer·partner SELECT. `020`: anon SELECT. **`026`: `payments_anon_update` = FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)** | partner 는 SELECT 만 | **anon 이 모든 payments 행의 모든 컬럼을 UPDATE 가능** (행·컬럼 제한 없음) |
| engineers | 별도 테이블 없음 (users + user_roles + engineer_permissions/zones/work_durations). users: 같은 tenant SELECT, 본인 UPDATE(auth.uid()) | 없음 | anon 에서 users UPDATE 불가 (직접 쓰기 코드도 없음, RPC 로 처리: `102_admin_save_engineer_rpcs`, `103_admin_user_rpcs`) |
| engineer_rates | `012`: authenticated 는 tenant 기준 ALL, **anon 은 SELECT/INSERT/UPDATE/DELETE 전부 `true`** | 없음 | **anon 이 전 기사 단가표를 삽입·수정·삭제 가능** |
| user_roles | 003: 같은 tenant SELECT 만 | `current_user_principal_id()` 는 이 테이블의 partner/is_primary 로 계산 | 쓰기 정책 없음. 직접 insert 코드(`engineersDb.js:203`)는 호출 경로 없음. 역할 변경은 `admin_set_user_roles` RPC |
| customers | **저장소에 `customers` 테이블 정의·정책 없음** (194 마이그레이션 주석에서만 언급) | - | 해당 없음/확인 불가 |
| photos | `023`: **`photos_anon_all` FOR ALL TO anon, authenticated USING (true)** + `storage.objects` 의 `task-photos` 버킷도 anon ALL | 없음 | 누구나 어떤 작업의 사진도 삽입·삭제 가능 |
| raw_orders | `080`: anon SELECT / INSERT / UPDATE 모두 `true` | 없음 | anon 전면 허용 |
| task_changes | `039`: anon SELECT/INSERT (task 가 고정 tenant 에 속하면 통과) | 없음 | 감사 로그를 누구나 작성 가능 (위조 가능) |
| tenants | `037`: anon SELECT true. UPDATE 정책 없음 | 없음 | 직접 쓰기 코드(`companyAccountDb.js`)는 실DB 에서 막혀 있거나 별도 정책이 있을 것 |
| principals / commission_policies / user_off_days / task_memos | 003: tenant 기준 FOR ALL(principals, commission_policies) 또는 `auth.uid()` 기준(user_off_days). task_memos 는 저장소에 정책 정의 없음 | 없음 | anon 쓰기 정책이 저장소에 없는데 앱이 직접 씀 - 실DB 확인 필요 |
| principal_weekly_remittances / remit_items | `062`, `186`: anon SELECT 만 (쓰기는 RPC) | 없음 | 양호 |

핵심 결론: **저장소 마이그레이션만으로는 `tasks` / `task_items` 의 anon 쓰기가 어떻게 허용되는지 설명되지 않는다.** 코드 주석(`engineerTaskRpc.js`: "RLS engineer_update 측 통과 X → 0행 매칭", `tasksDb.js:594`: "0 rows affected - RLS 차단")을 보면 일부 직접 쓰기는 RLS 로 이미 막혀서 RPC 로 옮겨진 것이고, 나머지는 실DB 에 anon 정책이 있어 동작 중인 것으로 보인다. 실DB 의 `pg_policy` 를 직접 조회해야 위험 확정이 가능하다. 어느 쪽이든 **partner role 이든 기사든 principal_id / assigned_engineer_id 소속을 검증하는 정책은 anon 경로에 존재하지 않는다** (정책이 있어도 tenant 단위 또는 `true`).

## 2. 위험도별 표 (src 클라이언트 직접 쓰기)

"호출 앱" 표기: Admin=AdminApp(운영자), Eng=EngineerApp(기사), Prin=PrincipalApp(원청), HC=HappycallApp(해피콜), Land=LandingApp.
LandingApp 은 `supabase.rpc('create_inquiry')` 만 사용하며 직접 쓰기 없음.

### 2-1. 높음 (25건)

| 파일:줄 | 테이블 | 동작 | 함수 | 호출 앱 | 비고 |
|---|---|---|---|---|---|
| src/data/tasksDb.js:562 | tasks | insert | createTaskDb (← createTaskAdapter → NewReceptionScreenLite) | Prin, Admin | 원청이 접수 시 호출. `principal_id` 를 클라이언트가 지정하므로 다른 원청 명의로 작업 생성 가능 여부는 RLS 에 의존 |
| src/data/tasksDb.js:583 | tasks | update (임의 컬럼, `.eq("id")` 만) | updateTaskDb (← updateTaskAdapter) | Prin(작업 메모 `workMemo`), Admin, Eng(`apiUpdateTask`), HC, ApplianceSelectModal, TaskEditScreen | 소속 조건 없이 id 로만 갱신. 컬럼 화이트리스트 없음 (patch 객체가 그대로 들어감) |
| src/data/tasksDb.js:630 | tasks | update (status, started_at, completed_at) | updateTaskStatusDb (← updateTaskStatusAdapter) | HC, Admin, Eng(경로 있음) | 상태 전이 검증 없음 |
| src/data/tasksDb.js:1367 | task_items | update (received_amount) | setTaskItemReceivedAmount | Admin(AdminTaskDetailScreen), Eng(EngineerTaskDetailScreen) | 수령금액 -> DB 트리거로 payments 재계산 연쇄. `.eq("id", itemId)` 만 |
| src/data/tasksDb.js:1411 | task_items | update (received_amount, 반복) | setAllTaskItemReceivedAmounts | Eng(EngineerTaskDetailScreen) | 위와 동일, 루프 |
| src/data/tasksDb.js:1700 | tasks | update (assigned_engineer_id 선점) | acceptOfferAdapter | Eng | `assigned_engineer_id IS NULL` 조건만 있고 `userId` 는 클라이언트 값 |
| src/components/EngineerTaskDetailScreen.jsx:573 | task_items | update (is_canceled 등) | (부분 취소 저장 핸들러, 인라인) | Eng | 컴포넌트에서 직접 supabase 호출. 기사가 자기 작업인지 검증 없음 |
| src/components/EngineerTaskDetailScreen.jsx:582 | task_items | update (qty) | (같은 핸들러) | Eng | 수량 변경 -> 금액/정산 변동 |
| src/lib/paymentsDb.js:38 | payments | update (engineer_remitted_at) | reportEngineerRemit | Eng, Admin(AdminPcRemitInbox) | `.in("task_id", chunk)` 만. `026` 정책으로 anon 전면 UPDATE 허용 |
| src/lib/paymentsDb.js:64 | payments | update (usol_remitted_at) | reportUsolRemit | Eng(EngineerSettleTab) | 동일 |
| src/lib/paymentsDb.js:94 | payments | update (engineer_remit_confirmed_at/by) | confirmEngineerRemit | Admin(AdminPcRemitInbox) | 운영자 전용 UI 이나 anon UPDATE `true` 정책이라 기사·원청 클라이언트가 같은 호출을 직접 할 수 있음. 서버측 role 검증 없음 |
| src/lib/paymentsDb.js:152 | payments | update (engineer_remitted_at=null) | cancelEngineerRemit | Admin | 동일 |
| src/lib/paymentsDb.js:181 | payments | update (confirm 해제) | cancelConfirmRemit | Admin | 동일 |
| src/lib/usolNTasksDb.js:481 | task_items | update (정산 타임스탬프 필드 동적) | markTaskItemsField | Admin(UsolNToEngineerSection) | `fieldName` 을 인자로 받아 컬럼명을 동적 지정. 호출 UI 는 운영자 화면이나 함수 자체는 원청 번들에도 포함 |
| src/lib/usolNTasksDb.js:583 | task_items | update (naver_settled_at, net_amount) | markTaskItemsNaverSettledAndNet | Prin(UsolNCsvMatch), Admin | 원청 앱에서 정산 CSV 매칭 시 실행 |
| src/lib/usolNTasksDb.js:1015 | tasks | insert (배열 일괄) | bulkInsertUsolNOrders | Prin(UsolNOrders), Admin | 원청이 주문 CSV 업로드로 다건 작업 생성. `principal_id` 는 `getUsolNPrincipalId()` 로 클라이언트가 조회 |
| src/lib/usolNTasksDb.js:1136 | task_items | insert | bulkInsertUsolNOrders (내부) | Prin, Admin | 위와 같은 흐름 |
| src/lib/rawOrdersDb.js:40 | raw_orders | insert | safeInsertRawOrder (← bulkInsertUsolNOrders) | Prin, Admin | `080` 에서 anon INSERT/UPDATE `true` |
| src/lib/offDaysDb.js:137 | user_off_days | insert | addOffDay | Eng | `engineer` 인자(클라이언트 지정)로 기사 휴무 등록. 타 기사 명의로 가능 |
| src/lib/offDaysDb.js:155 | user_off_days | delete | deleteOffDay | Eng | `.eq("id", offId)` 만 - 타 기사 휴무 삭제 가능 |
| src/lib/photosDb.js:84 | photos | insert | uploadPhoto | Eng (EngineerTaskDetailScreen, RefrigerantConsentScreen) | `photos_anon_all` 정책(`023`). `taskId` 소속 검증 없음 |
| src/lib/photosDb.js:178 | photos | delete | deletePhoto | Eng(api.js 경유) | 위와 동일. 사진 id 만 알면 삭제 |
| src/lib/engineerRatesDb.js:114 | engineer_rates | update | upsertEngineerRateToDb | Admin(api.js/data/engineers.js) | 운영자 화면 전용이나 `012` 에서 anon ALL 허용, 정산 단가이므로 높음으로 표기 |
| src/lib/engineerRatesDb.js:135 | engineer_rates | insert | upsertEngineerRateToDb | Admin | 동일 |
| src/lib/engineerRatesDb.js:169 | engineer_rates | delete | deleteEngineerRateFromDb | Admin | 동일 |


### 2-2. 중간 (운영자 전용 화면, 9건)

| 파일:줄 | 테이블 | 동작 | 함수 | 호출 앱 | 비고 |
|---|---|---|---|---|---|
| src/data/tasksDb.js:606 | tasks | update (assigned_engineer_id, status) | assignEngineerDb (← assignEngineerAdapter) | Admin | 기사 배정. 호출은 AdminApp 만 확인 |
| src/pages/AdminApp.jsx:9422 | tasks | update (push_candidates) | (인라인, 푸시 후보 기록) | Admin | 운영자 전용 |
| src/lib/principalsDb.js:179 | principals | update | upsertPrincipalToDb | Admin (PrincipalEditScreen) | tenant_id, code 는 제외하고 갱신. `principals_tenant` 정책(tenant 기준 FOR ALL) |
| src/lib/principalsDb.js:191 | principals | insert | upsertPrincipalToDb | Admin | 신규 원청 등록 |
| src/lib/principalsDb.js:205 | principals | delete | deletePrincipalFromDb | Admin | 원청 삭제. `.eq("tenant_id")` + code 조건 |
| src/lib/commissionPoliciesDb.js:147 | commission_policies | insert | insertCommissionPolicies | Admin (NewPrincipalSetup) | 수수료 정책 |
| src/lib/commissionPoliciesDb.js:171 | commission_policies | update | updateCommissionPolicy | Admin (PrincipalEditScreen) | 정책 수정 |
| src/lib/companyAccountDb.js:98 | tenants | update (settings jsonb) | saveCompanyAccountToDb | Admin (CompanyAccountScreen) | 회사 입금계좌. 정책상 tenants UPDATE 가 anon 에게 열려 있는지 불명 |
| src/lib/engineersDb.js:203 | user_roles | insert | ensureEngineerRole | 없음 (정의만 있고 호출 없음) | 죽은 코드. 살아나면 anon 으로 역할 부여가 가능해지므로 삭제 권장 |

### 2-3. 낮음 (2건)

| 파일:줄 | 테이블 | 동작 | 함수 | 호출 앱 | 비고 |
|---|---|---|---|---|---|
| src/lib/taskChangesDb.js:52 | task_changes | insert | insertTaskChange | Admin, Eng, Prin, createTaskAdapter 내부 | 감사 로그. anon INSERT 허용(`039`)이라 위조 가능하나 금전 영향 없음. `changed_by`, `actor_role` 은 클라이언트 값 |
| src/lib/taskMemosDb.js:63 | task_memos | insert | saveMemoAsync | Admin, Eng (MemoAddScreen) | 메모 |

### 2-4. 서버 `api/` 쓰기 (service role, 낮음)

모두 `SUPABASE_SERVICE_ROLE_KEY` 사용. RLS 우회이므로 서버 자체 인증 코드가 유일한 방어선.

| 파일:줄 | 테이블 | 동작 | 함수/액션 | 호출 앱 | 비고 |
|---|---|---|---|---|---|
| api/push/subscribe.js:164 | push_subscriptions | upsert | 구독 등록 | 서버 api (모든 앱의 PWA 가 호출) | endpoint 기준 |
| api/push/subscribe.js:137, 197 | push_subscriptions | delete | 구독 해지/정리 | 서버 api | |
| api/push/send.js:300 | push_subscriptions | delete | 만료 구독 정리 | 서버 api | |
| api/ad-hub.js:160 | ad_daily_stats | upsert | cacheDays | 서버 api (광고 허브) | 광고 기능, 올잇 작업 데이터와 무관 |
| api/ad-hub.js:205 | ad_keyword_cache | upsert | keywordsCached | 서버 api | |
| api/ad-hub.js:288, 770, 795, 803, 818 | ad_change_log | insert | 자동입찰·IP 차단·수동 로그 | 서버 api | `actor_name` 은 본문 값 |
| api/ad-hub.js:290, 772 | ad_keyword_cache | delete | 캐시 비우기 | 서버 api | |
| api/ad-hub.js:295 | ad_autobid_runs | insert | runAutobid | 서버 api (크론/운영자) | |
| api/ad-hub.js:441, 519, 812 | ad_leads | upsert | syncAutoLeads / 광고주 토큰 입력 / 운영자 입력 | 서버 api | **519 는 광고주 `client_token` 으로 접근하는 공개 경로** (entered_by="client") |
| api/ad-hub.js:584, 616 | ad_autobid_policies | upsert | 자동입찰 정책 | 서버 api | `assertAdmin(actor)` 검사 있음 (388행) |
| api/ad-hub.js:712 | ad_advertisers | insert | 광고주 등록 | 서버 api | |
| api/ad-hub.js:726, 732, 739 | ad_advertisers | update | 수정/비활성/토큰 재발급 | 서버 api | |
| api/ad-hub.js:586, 621, 714 | ad_change_log | insert | 정책/등록 로그 | 서버 api | |
| api/ad-manage.js:336, 535, 747 | ad_autobid_log | insert (REST fetch) | 자동입찰 로그 | 서버 api | `.from()` 아닌 `/rest/v1` POST |
| api/ad-manage.js:582 | ad_kw_volume | upsert (REST) | 키워드 검색량 | 서버 api | |
| api/ad-manage.js:598, 843 | ad_daily_report | insert (REST) | 일일 리포트 | 서버 api | |
| api/ad-autobid.js:26 | ad_autobid_log | insert (REST) | 로그 | 서버 api | |
| api/click-log.js:16 | ad_click_log | insert (REST) | 클릭 로그 | 서버 api (랜딩에서 호출, 무인증) | 공개 엔드포인트 |
| api/rank-check.js:103 | ad_serp_rank | insert (REST) | 순위 | 서버 api | |

`api/ad-report.js`, `api/ad-console.js`, `api/sms/send.js` 는 조회·외부 호출 위주이며 테이블 쓰기 없음 (ad-console.js:388 은 RPC POST).

## 3. storage 버킷 쓰기

| 파일:줄 | 버킷 | 동작 | 함수 | 호출 앱 | 위험도 | 비고 |
|---|---|---|---|---|---|---|
| src/lib/photosDb.js:65 | task-photos | upload | uploadPhoto | Eng (EngineerTaskDetailScreen, RefrigerantConsentScreen, EngineerApp 완료 사진) | 높음 | `storage.objects` 정책 `photos_storage_anon_all` = bucket_id 만 확인 (`023`). 경로 `${taskId}/...` 의 taskId 소속 검증 없음. `upsert:false` |
| src/lib/photosDb.js:95 | task-photos | remove | uploadPhoto 내부 롤백 | Eng | 낮음 | photos insert 실패 시 방금 올린 파일 정리 |
| src/lib/photosDb.js:167 | task-photos | remove | deletePhoto | Eng (api.js 경유) | 높음 | `row.storage_path` 기준 삭제. 사진 id 만 알면 삭제 가능 |


## 4. 협력사 관리자 role 을 추가하면 뚫릴 수 있는 곳

전제: 협력사 관리자가 원청(partner) 화면 코드(PrincipalApp 과 `src/components/principal/*`, `usol_n/*`)를 그대로 재사용한다. 현재 구조에서 "내 원청의 데이터만" 이라는 경계는 **서버가 아니라 클라이언트 코드가 만든 필터**일 뿐이라, 협력사가 늘어나면 아래 경로로 타 협력사/원청 데이터를 읽고 쓸 수 있다.

1. **tasks 목록 필터가 클라이언트 측** - `src/data/tasksDb.js` 의 `loadTasksForRole(role, userId, principalCode, opts)` 가 `principalCode` 인자로 `.eq("principal_id", pid)` 를 걸 뿐, 서버는 anon 키로 tenant 전체 SELECT 를 허용하는 것으로 보인다 (`loadTasksDb` 는 `tenant_id` 만 필터). 협력사 관리자의 `principalCode` 를 바꾸거나 `null` 로 넘기면 전 협력사 작업이 조회된다. PrincipalApp 안의 `filterTasksForPrincipal` (`src/shared/tasks.js`) 도 클라이언트 필터.
2. **updateTaskDb (`tasksDb.js:583`)**: `.eq("id", id)` 만으로 갱신. 협력사 관리자가 `PrincipalApp` 의 작업 메모 저장(`updateTaskAdapter(task.id, {workMemo})`) 경로로 **타 협력사 task id** 를 넘기면 쓰기가 통과할 수 있다. patch 컬럼 화이트리스트가 없어 `status`, `principal_id`, `assigned_engineer_id`, 금액 컬럼까지 같은 함수로 바꿀 수 있다.
3. **createTaskDb / bulkInsertUsolNOrders (`tasksDb.js:562`, `usolNTasksDb.js:1015`, `1136`)**: `principal_id` 를 클라이언트가 채운다 (`getUsolNPrincipalId()`). 협력사 관리자가 다른 원청 id 로 작업·task_items 를 대량 생성 가능. `raw_orders` 도 anon INSERT `true`.
4. **task_items 쓰기 (`tasksDb.js:1367/1411`, `usolNTasksDb.js:481/583`, `EngineerTaskDetailScreen.jsx:573/582`)**: `.eq("id", itemId)` / `.in("id", ids)` 만. 타 협력사의 항목 id 를 알면 수령금액·수량·정산완료일·`net_amount`·취소 플래그를 고칠 수 있고, DB 트리거가 `compute_payment` 를 돌려 payments 까지 연쇄 변경된다.
5. **payments 쓰기 (`paymentsDb.js` 5곳)**: `026` 의 `payments_anon_update` 가 `USING (true) WITH CHECK (true)` 라 anon 에게 **전 행·전 컬럼 UPDATE** 허용. 협력사 관리자 화면에서 송금 확인(`confirmEngineerRemit`)·취소를 `taskIds` 만 바꿔 호출하면 타 협력사 건의 송금 확정/해제가 가능하다. 컬럼 제한도 없으므로 `.update` 대상이 아닌 금액 컬럼도 임의 변경 가능.
6. **engineer_rates (`engineerRatesDb.js`)**: `012` 에서 anon INSERT/UPDATE/DELETE 전부 `true`. 협력사 관리자가 기사 단가표(정산 기준)를 바꿀 수 있다 (tenant 전체 공통).
7. **photos / task-photos 버킷**: `photos_anon_all`, `photos_storage_anon_all`. 타 협력사 작업 사진 삭제·위조 업로드 가능.
8. **task_changes (`039`)**: anon INSERT 허용 + `changed_by`, `actor_role` 클라이언트 값 -> 협력사 관리자가 타 협력사 작업에 감사 로그를 위조 작성 가능.
9. **p_actor 위조 (RPC 쪽)**: partner 용 RPC(`partner_full_cancel`, `partner_partial_cancel_item`, 송금 RPC 등)는 `auth.uid()` 가 아니라 `p_actor` 로 호출자를 정하는 방식이라, 협력사 관리자가 다른 협력사 담당자의 `user_id` 를 `p_actor` 로 보내면 해당 원청 권한으로 동작한다. 새 role 을 추가할 때 RPC 마다 `_get_caller_partner_principal()` 류 검사를 협력사 관리자 role 에도 맞춰야 하고, `user_id` 는 `users_tenant_select` 로 읽히므로 id 노출이 쉽다.
10. **다중 원청 구조**: `current_user_principal_id()` (003) 는 `partner` + `is_primary=true` 한 행만 반환하고, `057` 에서 user_roles 가 다중 원청으로 확장되었다. 협력사 관리자(여러 원청 소속 가능)를 넣으면 기존 정책의 단일 principal 가정이 깨진다.
11. **principals / commission_policies / tenants 쓰기 (중간 항목)**: `principals_tenant`, `commission_policies_tenant` 는 tenant 단위 FOR ALL 이라 원청·협력사 구분이 없다. 현재는 운영자 화면에서만 호출되지만, 협력사 관리자가 `PrincipalEditScreen` 류 번들을 로드하거나 같은 anon 키로 REST 를 직접 호출하면 수수료 정책, 원청 계정 정보, 회사 입금계좌(`tenants.settings`)가 변경될 수 있다.
12. **번들 재사용 자체의 문제**: 모든 앱이 같은 anon 키와 같은 `src/lib/*Db.js` 를 번들에 포함하므로, UI 에서 버튼을 숨겨도 개발자 도구에서 함수 호출/REST 요청으로 동일 쓰기가 가능하다. UI 분리는 보안 경계가 아니다.

### 권장 확인 순서 (조치는 이번 범위 밖)
1. 실DB 에서 `SELECT * FROM pg_policies WHERE tablename IN ('tasks','task_items','payments','user_roles','users','principals','engineer_rates','task_memos','user_off_days','tenants','commission_policies');` 로 anon 쓰기 정책의 실제 존재 여부 확인.
2. `payments_anon_update` 와 `engineer_rates_anon_*` 를 최우선 폐기 대상으로 검토 (행·컬럼 제한이 전혀 없음).
3. tasks / task_items 직접 쓰기를 RPC(`p_actor` + 소속 검증)로 이전하고, 그 전에 협력사 관리자 role 추가를 보류.


---

# 4. PrincipalApp — 원청 필터가 클라이언트에서만 결정되는 곳

## 결론

**원청 화면의 조회는 전부 "클라이언트가 보낸 원청 ID 목록"으로 걸러집니다. 서버가 "이 로그인 사용자가 정말 그 원청 소속인가"를 확인하는 조회는 없습니다.**

- 원청 코드 목록의 출처: `src/pages/PrincipalApp.jsx:557-573` — `user.principals`(로그인 응답을 `localStorage("allit.user")` 에 저장한 값)에서 `principalCodes` / `effectiveCodes` 를 만듭니다.
- 이 값이 각 조회 함수로 넘어가 `principals` 테이블에서 id 로 바뀐 뒤 `.in("principal_id", pids)` 조건으로 들어갑니다. 조건 자체는 서버에서 실행되지만, **조건에 들어가는 값은 브라우저가 정합니다.**
- 로그인이 Supabase Auth 가 아닌 자체 세션(anon key)이라 서버에서 `auth.uid()` 가 항상 NULL → RLS 로 소속을 강제할 수 없는 구조입니다 (3번 조사 "인증 / RLS 구조" 참조).
- 따라서 브라우저 저장값을 고치거나 anon key 로 직접 요청하면 다른 원청 작업도 조회됩니다. 협력사 관리자 화면을 같은 방식으로 만들면 D2(자기 협력사 작업만 조회)를 지킬 수 없습니다.

## 위치 표

| 파일:줄 | 조회 대상 | 필터 방식 | 비고 |
|---|---|---|---|
| `src/pages/PrincipalApp.jsx:557-573` | (필터 값 생성) | `user.principals` → `effectiveCodes` | 모든 하위 탭의 필터 출처 |
| `src/pages/PrincipalApp.jsx:591` | 사이드바 요약 | `fetchPrincipalSidebarSummary({ principalCodes })` | |
| `src/data/tasksDb.js:729-791` (`loadTasksForRole`) | tasks 전체 + payments + task_items | `principalCode` 인자 → `.in("principal_id", …)` | 인자가 null 이면 **tenant 전체 작업**을 반환 (735행 분기) |
| `src/lib/principalDashboardDb.js:61, 138, 143, 149, 155, 207, 215, 222, 391` | tasks / task_items 집계 | `.in("principal_id", pids)` | pids 는 클라이언트 코드 목록에서 변환 |
| `src/lib/principalDashboardDb.js:329` | 목록 RPC | `p_principal_ids: pids` | RPC 가 호출자 소속을 검증하는지 Step 2 착수 전 확인 필요 |
| `src/lib/allPrincipalTasksDb.js:121, 250, 254, 259` | tasks | `.in("principal_id", pids)` | |
| `src/lib/partnerDailySettleDb.js:72, 142` | tasks, `principal_daily_remittances` | `.in("principal_id", pids)` | 원청 일일정산 탭 |
| `src/lib/principalRemitDb.js:65, 131` | `principal_weekly_remittances` | `.in("principal_id", pids)` | anon SELECT 정책(mig 062) |
| `src/lib/principalSettleDb.js:84` | task_items + tasks | `.in("tasks.principal_id", pids)` | |
| `src/pages/PrincipalApp.jsx:1959-1963` | 주차 입금 내역 | `task.principalCode` 로 조회 | |

### 기사·고객 조회

| 파일:줄 | 내용 |
|---|---|
| `src/data/tasksDb.js:679-682` (`_enrichAndMapTaskRows`) | `users` 에서 `id, code, name, phone` 을 id 목록으로 조회. 원청 조건 없음 — 기사 이름·전화번호가 원청 화면으로 내려감 |
| `src/lib/principalDashboardDb.js:88, 280, 440` / `allPrincipalTasksDb.js:193` / `principalSettleDb.js:107` | 같은 방식의 `users` 조회 |
| `src/components/principal/UsolHScheduleTab.jsx:960` | `users` 직접 조회 |
| 고객 | 별도 `customers` 테이블 없음. 고객 이름·전화·주소는 `tasks` 행 안에 있어 작업 조회와 같은 경로로 내려감 |

### 쓰기 쪽은 이미 서버 검증이 있는 것

원청의 취소·기본정보 수정·입금 보고는 `SECURITY DEFINER` + `p_actor` RPC 로 "자기 원청 작업만" 검사합니다 (`src/lib/taskBasicEditRpc.js:7`, `partner_full_cancel`, `mark_principal_daily_remit` 등). 협력사 관리자도 이 방식을 조회까지 넓혀서 적용해야 합니다.

---

# 5. `user_roles`(partner + principal_id) 로 "협력사 관리자"를 표현할 수 있는가

## 현재 구조

- `user_roles (user_id, role, is_primary, principal_id → principals.id)` — `db/migrations/001_init.sql:57-64`
- `role` 허용값: `owner / operator / engineer / partner / admin` (CHECK 제약)
- mig 057 에서 PK 를 없애고 부분 유니크 인덱스 2개로 교체: `(user_id, role) WHERE principal_id IS NULL`, `(user_id, role, principal_id) WHERE principal_id IS NOT NULL`
- 로그인 RPC `sign_in_with_phone`(mig 058)은 `roles[]` 와 `principals[]`(code/id/name)를 돌려주고, 앱은 role 을 화면으로 바꿉니다: `src/App.jsx:229-239` (`engineer` → 기사 앱, `admin` → 운영자 앱, `principal` → 원청 앱)

## 의견: **그대로는 표현하지 않는 편이 안전합니다. 새 테이블 + 새 role 을 권합니다.**

이유 세 가지입니다.

1. **이름이 이미 쓰이고 있습니다.** 코드와 DB 에서 `partner` 는 "원청 담당자"를 뜻합니다 (`role === "partner"`, `partner_full_cancel`, `PartnerDailySettleTab`, `partnerPasteParser` 등). 협력사 테이블을 `partners`, 컬럼을 `partner_id` 로 만들면 원청과 협력사가 같은 단어로 섞여 D1(별도 개념 분리)과 정반대가 됩니다.
2. **`principal_id` 는 원청 테이블을 가리킵니다.** 화이트코어를 `principals` 에 한 줄로 넣으면 원청 코드 분기 213건(1번 조사)에 그대로 걸립니다. 특히 "usol_n 이 아니면 전부 일별 송금 대상"으로 떨어지는 분기(`AdminApp.jsx:7830`, `marginCalculator.js:19`, `PrincipalApp.jsx:126/668/736`) 때문에 화이트코어가 원청 일일정산 화면에 나타나게 됩니다.
3. **방향이 반대입니다.** 원청은 작업의 출처(`tasks.principal_id`)이고 협력사는 작업의 수행처입니다. 화이트코어가 맡는 작업의 원청은 `allday` 그대로여야 정산(수수료 규칙표의 원청 × 협력사 × 서비스)이 성립합니다.

## 권장 구조

| 항목 | 내용 |
|---|---|
| 테이블 | `subcontractors` (id, tenant_id, code, name, 사업자 정보 5칸, 입금 계좌, active) — 화면 표기는 "협력사" |
| 기사 소속 | `users.subcontractor_id` (NULL = 올데이케어 직영 풀) |
| 작업 수행처 | `tasks.subcontractor_id` (NULL = 직영). 협력사 단위로 넘긴 뒤 직원 미지정 상태를 표현하려면 작업에도 필요 |
| 관리자 role | `user_roles.role` CHECK 에 `sub_manager` 추가 + `user_roles.subcontractor_id` 컬럼 추가. 유니크 인덱스는 `(user_id, role, subcontractor_id) WHERE subcontractor_id IS NOT NULL` 1개 추가 (기존 2개는 `principal_id IS NULL` 조건에 `AND subcontractor_id IS NULL` 보강 여부를 설계에서 결정) |
| 로그인 응답 | `sign_in_with_phone` 에 `subcontractor`(id/code/name) 추가. 기존 필드는 그대로 |
| 화면 분기 | `src/App.jsx:229` switch 에 `sub_manager` → 신규 협력사 관리자 화면 |

지시문의 `partners` / `partner_id` 라는 이름은 위 1번 이유로 `subcontractors` / `subcontractor_id` 로 바꾸는 것을 제안합니다. 이름만 다르고 D1~D3 내용은 그대로입니다. **이 이름은 사장님 확인이 필요한 항목입니다.**

---

# 6. 영수증·세금계산서·거래명세서 — 발급 사업자 정보 출처

## 현재 구조

| 항목 | 위치 | 내용 |
|---|---|---|
| 사업자 정보 테이블 | `db/migrations/141_engineer_business_info.sql:27-38` | `engineer_business_info (user_id, business_name, representative_name, business_no, business_address, tax_type)` — **기사별 사업자 정보 칸은 이미 있습니다** |
| 계좌 | 같은 파일 52행 | `users.bank_name`, `users.bank_account` |
| 읽기·저장 RPC | `src/lib/engineerBusinessInfoDb.js` | `SECURITY DEFINER` + `p_actor`, 본인 또는 운영자만 (`141…sql:130, 212`) |
| 입력 화면 | `src/components/EngineerBusinessInfoCard.jsx`, `EngineerMeTab.jsx:554-593`, `EngineerEditScreen.jsx:619, 676` | 기사 본인(내 정보 → 톱니) / 운영자 대리 입력 |
| 문서 발행 화면 | `src/components/admin/DocIssueScreen.jsx` | 기사 모드: 본인 사업자 자동 로드(548-559). 운영자 모드: 발행처 기사를 고르면 그 기사의 사업자 정보 로드(567-627) |
| 미등록 처리 | `DocIssueScreen.jsx:739` (발행 차단 알림), `1083-1115` (등록 안내) | **"비어 있으면 차단 + 안내"는 이미 구현돼 있음** |
| 문서 틀 | `src/components/admin/docs/InvoiceTemplate.jsx:326` 등 | `issuer` = `engineer_business_info` 행을 그대로 받음 |
| 발행 기록·채번 | `db/migrations/143_doc_issues.sql` (`issue_document` RPC, `doc_issues`, `doc_issue_counters`) | 문서번호는 **(사업자번호, 발행일)** 단위로 001 부터. 같은 사업자번호를 쓰는 기사끼리는 번호를 공유 (`src/lib/docIssuesDb.js:4-5`) |

## D8 에 필요한 것

- 없는 것: `invoice_issuer`(`self` / 협력사) 선택 칸, 협력사 사업자 정보 칸.
- 있는 것: 본인 사업자 정보 5칸, 미등록 차단.
- 채번이 사업자번호 기준이라, 직원 여러 명이 "소속 협력사 사업자"로 발행해도 문서번호가 자동으로 하나의 흐름으로 이어집니다. 채번 로직은 손댈 필요가 없습니다.
- 주의: `issue_document` 의 권한 검사는 "본인 또는 운영자"입니다(`143…sql:204`). 협력사 사업자 정보를 읽는 경로는 "그 협력사 소속 기사 본인"만 허용하도록 RPC 안에서 소속을 확인해야 합니다.

---

# 7. `tasks` 주소·좌표 칸과 동선 배차가 주소를 읽는 위치

## 칸 현황

| 칸 | 있음/없음 | 근거 |
|---|---|---|
| `address` (text) | 있음 | `001_init.sql:149` |
| `district` (text) — 앱에서는 `region` | 있음 | `001_init.sql:150`, 매핑 `tasksDb.js:121`, `334` |
| 상세주소 전용 칸 | 없음 | `address` 한 칸에 함께 저장. 표시용 조합은 `src/components/common/AddressLine.jsx` 의 `buildFullAddress` |
| `lat` / `lng` 등 좌표 | **없음** | 마이그레이션 전체에서 `ADD COLUMN` 을 검색해도 좌표 칸 없음 |
| 도착지 관련 칸 | 없음 | |
| `linked_task_id` | 없음 | |

## 동선 배차가 주소를 읽는 위치

현재 동선 계산은 **좌표가 아니라 "구(區) 이름 → 구 중심점" 추정**입니다 (`src/utils/assignRoute.js:13` 주석: 같은 구 = 0km, 동 단위 정밀도 아님).

| 파일:줄 | 내용 |
|---|---|
| `src/utils/assignRoute.js:112-121` `taskGuOf(region, address)` | 작업의 구 이름 결정 (region 우선, 없으면 주소 파싱) |
| `src/utils/assignRoute.js:148-173` `buildDaySchedule` | 기사의 하루 작업 블록 생성. **161행에서 `tk.region`, `tk.fullAddress || tk.address` 를 읽음** — 이전설치의 "다음 작업 출발점 = 도착지" 를 반영할 지점 |
| `src/utils/assignRoute.js:195-215` `routeVerdict` | 새 작업의 구와 기존 블록들의 구 사이 최단 거리로 판정 (5km 이하 = 좋음) |
| `src/utils/assignRoute.js:49-97` | 구 중심점: 외부 CDN GeoJSON + 별칭(영종 등) |
| `src/components/EngineerDayStrip.jsx:33-35` `computeEngineerDayInfo` | 위 함수들을 묶는 공용 부품 |
| `src/pages/AdminApp.jsx:5067, 9852, 9908` / `src/components/AllEngineersModal.jsx:48, 132` | 호출처 (배정 추천 카드, 전체 기사 모달) |
| `src/components/admin/MetroRouteMap.jsx:134-215` | 오늘 동선 지도 — 역시 구 중심점 |

## 추천 기사 지역 판정

| 파일:줄 | 내용 |
|---|---|
| `src/utils/engineerRecommendation.js:24` `resolveRegionCandidates(region, address)` | 지역 후보 (region + 주소 파싱) |
| `src/utils/engineerRecommendation.js:284, 321` | DB 기반 추천: `engineer_principal_permissions`(서비스별 main/sub) + `engineer_zones`(구 단위) |
| `src/pages/AdminApp.jsx:9352, 9785` | 호출처 — `task.region`, `task.fullAddress || task.address` 를 넘김 |

출발지 기준이라는 D10 은 **현재 동작 그대로**입니다 (기존 `address`/`district` 가 출발지가 되므로 추천 쪽은 수정 없음).

## 내비 버튼 현황

기사 작업 상세에 **이미 3종 버튼이 있습니다** — 좌표 없이 주소 검색 방식입니다.

| 파일:줄 | 현재 주소 형식 |
|---|---|
| `src/components/EngineerTaskDetailScreen.jsx:88-102` 네이버 | `nmap://search?query={주소}` → 웹 대체 |
| `src/components/EngineerTaskDetailScreen.jsx:104-119` 티맵 | `tmap://search?name={주소}` — 108행 주석: 과거 `route` 형식은 좌표가 없어 빈 검색이 되어 `search` 로 바꾼 이력 |
| `src/components/EngineerTaskDetailScreen.jsx:122-135` 카카오맵 | `kakaomap://search?q={주소}` → 웹 대체 |
| `src/pages/EngineerApp.jsx:859` | 카카오맵 검색 (목록 카드) |

→ 좌표가 있으면 지시문의 길안내(route) 형식, **좌표가 없으면 "주소 복사"만 두기보다 지금의 주소 검색 방식으로 대체**하는 편이 기사에게 유리합니다 (설계 문서 제안 사항).

---

# 8. 작업 칸 추가 시 수정해야 할 3곳 확인

| # | 위치 | 확인 결과 |
|---|---|---|
| 1 | `src/data/tasksDb.js:83` `rowToTask` | 있음. DB 행(snake) → 앱 객체(camel). 새 칸은 여기에 한 줄씩 추가 |
| 1-b | `src/data/tasksDb.js:32-63` `PAYMENT_SELECT` | tasks 쪽은 `*` 라서 **새 tasks 칸은 자동 포함**. 단 `payment:payments(...)` 와 `task_items(...)` 안쪽은 칸을 하나씩 나열 → `payments` 에 새 칸(예: 거래액, 협력사 수수료 표시용)을 만들면 여기 추가 필수 |
| 1-c | `src/data/tasksDb.js:310` `taskToRow` | 앱 → DB 방향. 저장할 새 칸은 여기도 추가 (333-334행이 address/region 예시) |
| 2 | `src/utils/v14Task.js:50` `v14NormalizeTask` | 있음. 172행부터 반환 객체. **나열된 칸만 통과**하므로 누락 시 기사·원청 화면에서 값이 사라짐 |
| 3 | `src/pages/AdminApp.jsx:545` `_v14NormalizeTask` | 있음. 운영자 앱 전용 사본. 같은 방식 |

## 3곳 외에 함께 고쳐야 하는 곳 (tasks 칸을 직접 나열하는 select)

`*` 를 쓰지 않고 칸 이름을 나열한 조회는 새 칸이 자동으로 따라오지 않습니다.

| 파일:줄 | 용도 |
|---|---|
| `src/lib/allPrincipalTasksDb.js:107` | 원청 전체 작업 |
| `src/lib/principalSettleDb.js:79` | 원청 정산 |
| `src/lib/usolNTasksDb.js:56, 177` | 유솔N 목록 |
| `src/lib/usolNWeeklyData.js:265, 590, 761, 909` | 유솔N 주차 |
| `src/lib/refrigerantAddonsDb.js:17` | 냉매 추가선택 |
| `src/lib/partnerDailySettleDb.js:59` | 원청 일일정산 |
| `src/lib/principalDashboardDb.js` (목록·집계) | 원청 대시보드 |
| `src/pages/EngineerApp.jsx:239-245` | 기사 앱 안의 별도 매핑 — `materialCost` 가 여기에도 따로 매핑돼 있음 |

이전설치(도착지 칸)는 올데이케어 직영/협력사 작업에서만 쓰므로 유솔N·원청 전용 조회는 건드리지 않아도 됩니다. 기사 앱과 운영자 앱이 쓰는 경로(`PAYMENT_SELECT` = `*`)는 자동 포함되고, **3곳 매핑 + `EngineerApp.jsx:239` 부근**만 맞추면 됩니다.
