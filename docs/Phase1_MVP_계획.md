# Phase 1 — MVP 계획 (정정본)

**작성일**: 2026-04-30
**기간**: 2~4주
**원칙**: **그릇 크게, MVP 좁게**
**상태**: ✅ 14개 결정 답변 완료 → 실행 가능

---

## 한 문장

> 올데이케어 한 회사가, 에어컨 한 카테고리로, 접수→배정→작업→완료→**자동 정산** 한 사이클이 끊김없이 돈다.

---

## UI 호칭 (DB는 영문 그대로)

| DB role | UI 호칭 |
|---|---|
| owner | **대표님** |
| operator | **관리자** |
| engineer | **프로님** (개인사업자 존중) |
| partner | (회사명, 예: 김쿨가이님) |
| admin | 운영팀 |

DB 컬럼명/변수명/role enum은 영문 그대로 (`users`, `user_roles`, `owner`/`operator`/`engineer`/...). PWA UI 텍스트만 한글.

---

## 범위

| 항목 | 범위 |
|---|---|
| 회사 (tenant) | 올데이케어 1개 |
| 카테고리 | 에어컨 1개 |
| 사용자 | **27 user + 1 partner (총 28행)** — 4 owner + 4 operator + 22 engineer (다중 역할 통합 시 일부 중복) + 1 김쿨가이 |
| 원청 (principal) | **6개** (O 올데이케어 / KA 쿨가이 아버지 / KB 쿨가이 아들 / Y 용인 / H 유솔현금 / N 유솔네이버) — **세스코 제외** |
| 정산 자동화 | **8가지 계산방식 모두** + 정보 비대칭 패턴 보존 (단, 유솔 N 네이버 = **수동 입력**, 자동화는 Phase 2 / KA·KB 정책 = Day 5 정확화) |
| 인증 | **전화 + 4자리 PIN** (택시앱 스타일, 30일 토큰) |
| 가스 자동 배정 | ★ **Phase 1 진입** — 권한+지역 매칭 → 일괄 푸시 → 선착순 수락 |
| 백엔드 | Supabase (multi-tenant 그릇 처음부터) |
| 외부 의존 | **0** (캘린더 X, 텔레그램 X, SMS X) |

---

## 핵심 워크플로

```
1. 접수      partner(김쿨가이) 또는 operator(해피콜)이 PWA 입력
2. 배정      operator가 일정 + 기사 매칭
3. 작업      engineer가 모바일에서 시작/진행/사진/완료
4. 자동 정산  완료 시 compute_payment() 자동 호출 → payments row
5. 검증/지급  매월 owner(사장님)가 status='paid' 처리
```

---

## 결정 답변 반영표

### Phase 1 필수 결정 6개 (이전 11개 중)

| # | 결정 | 답 |
|---|---|---|
| 3 | `assignedEngineerId` 시트 컬럼 | ✅ DB 컬럼 추가 |
| 4 | `status` 표준 enum | ✅ **5단계** — 미배정 → 약속대기 → 확정 → 진행중 → 완료 |
| 5 | `totalAmount` 책임 | ✅ Generated column (= product + extra + travel) |
| 6 | 사진 | ✅ Supabase Storage + `photos` 테이블 |
| 9 | 해피콜 필드 | ✅ **3필드** — `happycall_status` + `happycall_memo`(외부) + `happycall_internal_note`(내부) |
| 10 | 정산 3필드 | ✅ `payments` 별도 테이블 (3 분배 + 검증) |

### 정산 8개 질문 (모두 답)

→ `정산_정책_분석.md` v2 + `정산_운영_매뉴얼.md` 참조

요약: **8가지** 계산방식 SQL 함수 (`compute_payment`) 한 곳에 분기 (수량 자동 곱 + `비율_총액기준` 신규) / 추가금 50/50 (예상금액비율은 원청 0%) / 출장비 기사 100% / 유솔 채널 분리 / 세스코 제외.

---

## 필수 기능 체크리스트

### 인증/사용자
- [ ] Supabase Auth (이메일 + 비밀번호)
- [ ] 5 role: owner / operator / engineer / partner / admin
- [ ] 역할별 화면 라우팅 + RLS 격리

### 접수
- [ ] partner(김쿨가이) 신규 의뢰 폼 — 자기 principal_id 자동 매핑
- [ ] operator 신규 접수 폼 (모든 principal 선택 가능)
- [ ] parseKakao v2 텍스트 붙여넣기 → 자동 입력 (기존 그대로)

### 배정 (operator)
- [ ] 미배정 작업 리스트
- [ ] 일정 + 기사 매칭 UI
- [ ] 휴무 자체 처리 (`engineer_off_days`, 외부 캘린더 X)
- [ ] 동시간대 중복 방지

### 작업 (engineer)
- [ ] 자기 배정 작업만 노출 (RLS)
- [ ] 시작/완료 토글
- [ ] before/after 사진 업로드 (Supabase Storage)
- [ ] `work_memo` 입력

### 완료 → 자동 정산
- [ ] 완료 토글 → `compute_payment()` 자동 호출
- [ ] `payments` row 생성 (engineer/principal/owner 3분배 + 검증)
- [ ] 정책 룩업 실패 시 → "수동 입력 모드" UI (세스코 등 정책 없는 경우)

### 정산 화면
- [ ] partner 화면: 자기 `principal_amount` + 월별 합계 + 분쟁 메모
- [ ] owner 화면 (사장님): 전체 분배 (engineer/principal/owner 3개) + `is_balanced` 검증 표시
- [ ] engineer 화면: 자기 `engineer_amount` 만

### 운영 (owner)
- [ ] AdminApp 연결 (전체 모니터링)
- [ ] 사용자 추가/삭제 (사장님이 직접)
- [ ] 작업 강제 수정/취소 + status_history 자동

### 분쟁
- [ ] partner가 분쟁 발생 → `task_disputes` row + 메시지
- [ ] owner/operator가 응답 → 양방향 보임

### 비기능
- [ ] 모바일 우선 (기사가 현장)
- [ ] 한국어 UI

---

## PWA 화면 명세 ★ v5

### 워크플로우 분리 (`assignment_type`)

| 작업 종류 | `assignment_type` | 흐름 |
|---|---|---|
| 가스 (`gas_charging`) | `auto_first_accept` | 권한 + 지역 매칭 → 일괄 푸시 → **선착순 수락** → 5분 미수락 시 owner 알림 |
| 세척 / 점검 / 설치 | `manual_with_recommendation` | **해피콜 X**, 시스템이 같은 지역 프로 정렬 추천 → 사장님이 화면 보고 **수동 배정** |
| 그 외 (긴급/특수) | `manual` | 사장님 직접 선택 |

### 추천 화면 시안 5-V3

**추천 카드** (단순):
```
[김태승  main · 야간OK]                      [배정]
📍 마포구, 서대문구  ·  오늘 3건 (신규 +1)
```
- 카드 전체 클릭 = "오늘 일정" 화면으로 이동
- [배정] 버튼 클릭 = 즉시 배정

**오늘 일정 화면** (단순 조회):
```
09:00~10:30   정수민·점검             강남 역삼
11:30~13:00   박지영·세척             강남 역삼
14:00~16:30   김미경·냉매충전          송파 잠실
```
- 시간(핑크) | 이름·작업(흰색) | 지역(회색)
- **내일 일정 X** (오늘만)
- **자동 추천/매칭 X** — 사장님이 보고 판단

**정렬**:
- 1순위: 같은 지역 매칭 (자동 위로)
- 인접 지역 = 중간
- 멀리 있는 프로 = 흐리게 (opacity ↓)

**디자인** (`디자인_토큰.md` 베이스):
- 다크 모드 (시안 5-V3 = `#0F0F12` 살짝 더 어둠)
- 핑크 액센트 (`#EC4899`)
- 둥근 카드 12-16px
- 큰 액션 버튼

### 프로 관리 화면

위치: 대표/관리자 화면 > **프로 관리** 메뉴

#### A. 신규 등록 폼 (`[+ 신규 등록]`)

| 입력 필드 | 매핑 |
|---|---|
| 코드 (자동 E025…) | `users.code` |
| 이름 | `users.name` |
| 전화번호 (UNIQUE) | `users.phone` |
| 이메일 (선택) | `users.email` |
| 임시 PIN (자동 1111 또는 입력) | `users.pin_hash` (해시) + `users.must_change_pin=true` |
| master_user_id (다른 폰 통합) | `users.master_user_id` |
| 권한 체크박스 + level (main/sub) | `engineer_permissions(service_code, level)` |
| 담당 지역 (다중 선택) | `engineer_zones(district)` |
| 작업시간 (기종별, 분 단위) | `engineer_work_durations(service_code, appliance_code, duration_min)` |
| 운영 시간 + 야간/새벽/주말 토글 | `user_preferences` |
| 활성 여부 | `users.is_active` |

[등록] → 위 6 테이블 동시 INSERT (트랜잭션).

#### B. 설정 관리 화면 (프로 카드 클릭)

기존 프로 정보 수정 — 운영 중 자주 발생.

| 토글/입력 | 매핑 |
|---|---|
| 권한 (서비스별 main/sub) | `engineer_permissions` UPDATE |
| 담당 지역 변경 | `engineer_zones` UPDATE/DELETE/INSERT |
| 기종별 작업시간 조정 | `engineer_work_durations` UPDATE |
| 운영 시간 + 야간/새벽/주말 | `user_preferences` UPDATE |
| 활성 토글 | `users.is_active` |

권한: `owner` / `operator` 만 수정. `engineer` 본인은 자기 정보 조회만.

### C. 추천기사 화면 (시안 5-V3 ✅ 확정)

**위치**: 작업 관리 > 작업 상세 > 추천기사

위 "추천 화면 시안 5-V3" 섹션 그대로 (카드 + 오늘 일정 + 정렬 + 디자인). 메뉴 위치만 명시.

### D. 기사 정산 화면 (양방향 확인) ★ v5.1

**위치**: 대표/관리자 > 정산 관리 > **기사 정산**

**흐름** — `payments.status` 4단계로 양방향 확인:
```
미정산
  ↓ 사장님 [입금 완료] 클릭
사장님입금  (paid_at = now)
  ↓ 기사 [입금 확인] 클릭 (자기 정산 화면 F)
기사확인    (confirmed_at = now)
  ↓ 사장님 [정산 완료] 클릭
정산완료    (settled_at = now)
```

**화면 구성**:
- 기사별 합계 카드 (이번달 / 지난달 / 미정산 합계)
- 작업별 상세 리스트 (작업번호 / 일자 / 단가 / `engineer_amount` / status / 시각)
- 각 row 우측 [입금 완료] 또는 [정산 완료] 버튼 (status 따라 동적)
- 분쟁/보류 토글 (status='분쟁' 또는 '보류' 전환)

### E. 원청 정산 화면 (한 클릭) ★ v5.1

**위치**: 대표/관리자 > 정산 관리 > **원청 정산**

**원청별 흐름**:
| 원청 | 흐름 | 비고 |
|---|---|---|
| KA / KB / 세스코 | 사장님 [입금 완료] 한 번 클릭 → **자동 `정산완료`** (paid_at + settled_at 동시) | 양방향 확인 X (원청은 confirm 버튼 없음) |
| 유솔 (H/N) | "**Phase 2 예정**" 표시 (작업 데이터만 동기화, 정산 자동화는 추후) | `유솔_네이버_상세.md` |
| 올데이케어 (O) | 정산 화면에 노출 X (직영, 자체 영업 — 정산 대상 아님) | `principal_amount = 0` 또는 작업 자체에 정산 안 거침 |

### F. 기사 본인 정산 화면

**위치**: 프로 화면 > **내 정산**

**화면 구성**:
- 본인 작업별 정산 내역 (RLS로 자기 `assigned_engineer_id` 만)
- 각 row의 status가 `사장님입금` 이면 [**입금 확인**] 버튼 노출
- 클릭 → `confirmed_at = now`, `status = '기사확인'` (D 화면에서 사장님이 [정산 완료] 누를 차례)
- 합계 (이번달 받을 / 받은) 카드

### G. 관리자 대시보드 (메인) ★ v5.1

**위치**: 대표/관리자 화면 진입 시 기본 (로그인 후 첫 화면)

**위젯**:
- 오늘 마감 작업 (status `진행중`/`확정`)
- **기사 정산 미완료** 알림 (status `미정산`/`사장님입금`/`기사확인` count)
- **원청 정산 미완료** 알림 (KA/KB/세스코 미정산 count)
- 통계: 오늘 매출 / 회사 마진 / 기사 정산 합계

---

## 디자인 시안 협업

**디자인 시안은 다음 세션부터 화면별로 Claude(데스크톱)와 협업 진행**:
- A~G 화면별 시안 → 데스크톱 Claude
- 본 문서는 사양만 (필드 / 흐름 / 매핑)
- 디자인 컨셉: 다크 모드(`#0F0F12`) + 핑크 액센트(`#EC4899`) + 둥근 카드(12-16px) + 큰 액션 버튼
- 베이스: `디자인_토큰.md` (시안 5-V3 색상은 살짝 더 어두움)

---

## 슬라이스 일정 (4주)

### Week 1 — 그릇 깔기

| 일 | 작업 |
|---|---|
| 1 | Supabase 프로젝트 생성, Auth 설정, 클라이언트 모듈 |
| 2 | 핵심 테이블 마이그레이션 (`그릇_아키텍처.md` SQL 실행) |
| 3 | RLS 정책 + partner-safe view |
| 4 | 시드 데이터: 4 원청 + 에어컨 카테고리 + 26 사용자 |
| 5 | 정책 시드: 사장님 시트 → `commission_policies` 40+ 행 import + `compute_payment()` 함수 |

### Week 2 — 접수 ~ 배정

| 일 | 작업 |
|---|---|
| 1-2 | partner / operator 신규 접수 → Supabase INSERT |
| 3 | parseKakao v2 결선 |
| 4 | operator 미배정 리스트 + 배정 UI |
| 5 | 휴무 (engineer_off_days), 중복 체크 |

### Week 3 — 작업 ~ 정산 자동

| 일 | 작업 |
|---|---|
| 1 | engineer 배정 작업 리스트 |
| 2 | 시작/완료 + status_history |
| 3-4 | 사진 (Storage) before/after |
| 5 | **완료 트리거 → compute_payment 자동 → payments 검증** |

### Week 4 — 정산 화면 + AdminApp + 안정화

| 일 | 작업 |
|---|---|
| 1 | partner 화면 (자기 정산 + 월별) |
| 2 | owner 화면 (전체 분배 + is_balanced 검증) |
| 3 | engineer 정산 화면 + AdminApp |
| 4 | 분쟁 워크플로 + 버그 잡기 |
| 5 | 출시 준비 |

**예비**: +1주

---

## 출시 가능 기준

- [ ] 26명 모두 로그인
- [ ] 4 원청 정책 모두 자동 분배 + `is_balanced=true`
- [ ] 접수 → 배정 → 작업 → 완료 → 정산까지 1 사이클 끊김없음
- [ ] partner가 다른 principal 작업 안 보임 (RLS)
- [ ] partner가 `engineer_actual_ad` 안 보임 (view)
- [ ] 모바일 OK, 사진 업로드 OK
- [ ] 정책 없는 케이스 → 수동 입력 모드 작동

---

## Phase 2로 미루는 것

| 항목 | 미루는 이유 |
|---|---|
| 구글 캘린더 1+20 | 외부 의존 0 원칙 |
| 텔레그램/카카오 자동 발송 | API 부담, 우선 수동 |
| **유솔 N 네이버 자동화** | MVP는 수동 입력 (`payments.naver_fee`). 운영 1-2주 데이터 보고 시트 import + `compute_payment` 'N' 분기 (`유솔_네이버_상세.md`) |
| 운영 시트(50열) 마이그 | Phase 1 검증 후 |
| 다른 회사 입주 | 그릇은 준비 |
| 다른 카테고리 | 동일 |
| ~~세스코~~ | **계약 종료, 영구 제외** |
| 오프라인 모드 | 항상 온라인 |

**Phase 1 진입 (이전 계획에서 끌어올림)**:
- ✅ **가스 자동 배정 (선착순)** — 권한+지역 매칭 + `task_assignments` 테이블. `engineer_permissions` / `engineer_zones` 시드 (이미지 1·2 기반) Day 4-5에 입력.

---

## 리스크 / 대응

| 리스크 | 대응 |
|---|---|
| Supabase 학습 비용 | Week 1 셋업에 3-5일 |
| 26명 동시 + RLS 충돌 | Week 1 끝 라이브 검증 |
| 사진 1GB 무료 한도 | Week 3 측정 후 Pro $25/월 |
| 정책 시트 → DB import 정확성 | Week 1 마지막 — 시트 행 vs DB row 1:1 검증 |
| 세스코 잔여 작업 | 이번달 내 작업은 수동 처리, Phase 1 시스템 미진입 |

---

## 다음 액션

→ `_NEXT_SESSION.md` (Supabase 셋업 가이드) 참조
