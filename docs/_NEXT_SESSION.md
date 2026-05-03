# 다음 세션 시작점 — Day 1 (Supabase 부팅)

**작성일**: 2026-04-30 EOD (큰 결정 14건 통합본)
**상태**: ✅ Day 0 완료. 큰 결정 14건 그릇/Phase1에 반영. **Day 1 진입 가능.**

---

## 한눈에

> "그릇 다 그렸음. 14건 결정 통합 끝. 다음은 Supabase 부팅."

---

## ✅ Day 0 + Day 2 정정 7건 + PWA 화면 사양 완료 (2026-05-01)

**Day 0 (2026-04-30)**: `그릇_아키텍처.md` v3 → v4 / `Phase1_MVP_계획.md` / `정산_운영_매뉴얼.md` / `유솔_네이버_상세.md` 신규

**Day 2 정정 (2026-05-01)** — 데이터 0건 상태에서 깨끗한 재시작:
- SQL 파일: `001_init.sql` 정정 + `002_drop_all.sql` 신규
- DB: 21 → 23 테이블 (work_durations + preferences 추가)
- `그릇_아키텍처.md` v4 → **v5.1** (engineer_work_durations PK 정정 + payments 7-status + paid_at/confirmed_at)
- `정산_정책_분석.md` v3 → **v4** (KA 가스 10/50/40 + KB 가스 35/50/15)
- `정산_운영_매뉴얼.md` v2 → **v3** (정산 워크플로 양방향 확인 + 유솔 Phase 2 메모)

**Phase 1 PWA 화면 사양 박음** (Phase1_MVP_계획.md "PWA 화면 명세"):
- A. 신규 등록 폼 (대표/관리자 > 프로 관리)
- B. 설정 관리 화면 (프로 클릭)
- C. 추천기사 화면 (시안 5-V3 ✅ 확정)
- D. 기사 정산 화면 (양방향 확인 4단계)
- E. 원청 정산 화면 (한 클릭)
- F. 기사 본인 정산 (입금 확인)
- G. 관리자 대시보드 (메인)

**디자인 시안**: 다음 세션부터 화면별로 **Claude(데스크톱)와 협업**. 본 트랙은 사양/스키마만.

---

## ✅ Day 2 SQL 실행 완료 (2026-05-01 EOD)

Supabase SQL Editor 결과: **"Success. No rows returned"** × 2 (DROP + INIT). 한글 정상. **23 테이블 생성 완료**.

확인된 변경:
- `engineer_permissions.level` (main/sub) 컬럼 ✓
- `engineer_work_durations` 신규 (복합 PK) ✓
- `user_preferences` 신규 ✓
- `payments.status` 7가지 (`미정산/사장님입금/기사확인/정산완료/보류/분쟁/지연`) ✓
- `payments.paid_at` / `confirmed_at` 시각 컬럼 ✓
- `tasks.assignment_type` 3가지 (`manual/auto_first_accept/manual_with_recommendation`) ✓

---

## ✅ 시안 5개 확정 (2026-05-01 EOD)

| 시안 | 화면 | 위치 | 상태 |
|---|---|---|---|
| **시안 4-V4** (A) | AdminApp 대시보드 | 대표/관리자 메인 (개요 탭) | ✅ 사양 박힘, 디자인 미작성 |
| **시안 1** (B) | 실시간 작업 현황 | 대시보드 ⚡ 실시간 클릭 | ✅ 사양 박힘 |
| **C** | 기사 오늘 일정 | 실시간 카드 → 기사 클릭 | ✅ 사양 박힘 |
| **시안 5-V3** (D) | 추천기사 카드 + 오늘 일정 | 작업 관리 → 추천기사 | ✅ 사양 + 디자인 확정 |
| **시안 3-V5** (E) | 새 접수 리스트 | 대시보드 새 접수 N건 클릭 | ✅ 사양 박힘 (작업 종류별 그룹) |

**시안 4-V4 (A) — AdminApp 대시보드 핵심**:
- 인사말 + 작업 통계 3구역 (새접수/진행중/완료)
- 돈 흐름 **4구역** (매출/마진/기사정산/원청수수료)
- 긴급 알림 + [배정] 버튼
- 새 접수 종류별 (세척/냉매충전)
- 실시간 작업 현황 (컴팩트 1줄, 클릭→이동)
- 하단 탭 (개요/작업/기사/활동)

**시안 3-V5 (E) — 새 접수 리스트 핵심**:
- 작업 종류별 그룹 (세척 / 가스 충전 분리)
- 카드 = 원청 라벨 색 + 이름 + 시간 + 지역/기종/일정
- 액션: 📞 전화 / 📝 메모 / ✏️ 수정 / [기사 배정 →]
- 가스는 자동 진행 상태 표시 (🟡 푸시 중 / 🟢 자동 배정 완료)

**원청 라벨 색** (확정):
- 올데이 `#FF1B8D` / KA `#06B6D4` / **KB `#FFB800` (임시)** / 용인 `#A855F7` / 유솔 H `#10B981`

---

## 사장님 운영 원칙 (영구 박음)

1. **"두 번 일 안 하기"** — 시스템 원칙 (그릇 처음부터 크게)
2. **"두 번 말하지 않기"** ⭐⭐ — 소통 원칙 (한 번 결정 = 메모리·문서·시안에 박혀야)
3. 단순화 우선 (오버엔지니어링 X)
4. 처음부터 1번 (정확하게)
5. 운영자 + 사업가 시각
6. 색이 많으면 별로 (톤 통일)
7. 이미지만 정하는 거 아님 — 시스템 전체 확정 단계
8. 전체 구조 알아야 대화 편하다 (시스템 디자이너 시각)

---

## 다음 세션 우선순위 (사장님 결정)

| 옵션 | 작업 | 산출물 |
|---|---|---|
| **A** | 정산 화면 시안 협업 (D 기사정산 / E 원청정산 / F 본인정산) | 시안 도면 + Phase1 사양 보강 |
| **B** | 프로 관리 화면 시안 (A 신규등록 / B 설정관리) | 시안 도면 |
| **C** | 마감 모드 화면 | 시안 + 사양 |
| **D** | Day 3 (RLS + view + compute_payment 함수) | `db/migrations/003_rls_views_funcs.sql` |

### 다음 세션 시작 메시지 (사장님이 보낼 것)

```
"오늘은 [정산 화면 / 프로 관리 / 마감 모드 / Day 3] 진행"
또는
"docs/PWA_전체_구조.md 10절 빠른 참조 박스 보여줘"
```

---

---

## 📌 큰 결정 14건 (Day 1 진입 직전 통합)

### 결정 1 — UI 호칭 변경 (DB는 영문 그대로)

| DB role | UI 호칭 |
|---|---|
| owner | **대표님** |
| operator | **관리자** |
| engineer | **프로님** (개인사업자 존중) |
| partner | (회사명) |

### 결정 2 — 인증 = 전화 + 4자리 PIN

택시앱 스타일. 첫 로그인 시 PIN 변경 강제. 30일 기억 토큰. PIN reset = owner/operator 권한. SMS X / 이메일 X.

### 결정 3 — `users` 통합 + N 역할 + 다중 폰 master

- `engineers` / `app_users` 폐기 → 단일 `users` 테이블
- `user_roles` (M:N) — 한 사람이 owner+operator+engineer 동시 가능
- `master_user_id` — 한 사람의 보조 폰(가스폰 등)을 main에 묶음

### 결정 4 — 명단 28행 (아래 별도 섹션)

### 결정 5 — 다중 역할 화면 = 기본 + 상단 토글

대표 4명 PWA: 기본 = 대표 대시보드, 상단 [대표] [관리자] [프로] 토글.

### 결정 6 — 쿨가이 A/B = 별개 principal (KA/KB)

- KA = 쿨가이 (아버지) / KB = 쿨가이 (아들) — 별개 사업체
- 정책은 Day 5 정확화 (Day 1-4는 단일 'K' 가짜로 진행 가능)

### 결정 7 — 가스 자동 배정 = Phase 1 진입 ★

- 권한 (`engineer_permissions`) + 지역 (`engineer_zones`) 매칭
- 일괄 푸시 → 선착순 수락 (`task_assignments`)
- 5분 미수락 → owner 수동 배정 알림

### 결정 8 — 프로 권한+지역 시드 (이미지 1·2 기반)

KA/KB 가스 매칭. 빈 zone = 사장님 수동 배정. 명단 섹션 참조.

### 결정 9 — 정정 사항

- A001 조동욱 전화: `010944471547` → `01094471547`
- E016: 유근학 → **류근학**
- 조동석 / 최수연 = 같은 사람 두 폰 (master 통합)

### 결정 10~14 (이전 세션 결정 — 그대로 유지)

- 결정 10: Multi-Tenant SaaS / Multi-Category / 외부 의존 0
- 결정 11: Supabase 직진 (시뮬 GAS 중단)
- 결정 12: 첫 회사 = 올데이케어
- 결정 13: 8가지 calc_method + 정보 비대칭 패턴
- 결정 14: 유솔 N 자동화 = Phase 2 (수동 입력 MVP)

---

## 📋 명단 28행 (Day 4 시드용)

### 대표 4명 (모두 owner — 공동대표)

| code | 이름 | 전화 | 이메일 | master |
|---|---|---|---|---|
| A001 | 조동욱 | 010-9447-1547 | cooldog1547@gmail.com | self |
| A002 | 구현서 | 010-7372-3524 | guhyunseo3524@gmail.com | self |
| A003 | 조동석 | 010-4785-6910 | alldaycare0823@gmail.com | self |
| A004 | 최수연 | 010-4887-4002 | allit.platform@gmail.com | self |

### 관리자 4명 (operator role)

| code | 이름 | 전화 | master | 비고 |
|---|---|---|---|---|
| H001 | 조동석 | 010-4937-2007 | A003 | 회사폰 (다른 폰, master 통합) |
| H002 | 최수연 | 010-3626-4002 | A004 | 회사폰 (다른 폰, master 통합) |
| H003 | 조동욱 | 010-9447-1547 | A001 | 같은 폰, role 추가만 |
| H004 | 구현서 | 010-7372-3524 | A002 | 같은 폰, role 추가만 |

> **주의**: H003/H004는 A001/A002와 같은 phone — 별도 user row가 아니라 `user_roles`에 operator role 추가만. H001/H002는 별도 user row (master_user_id로 통합).

### 프로 22명 + 가스 분리 5행 + 신규 2명

| code | 이름 | 전화 | 이메일 | master | label |
|---|---|---|---|---|---|
| E001 | 강병익 | 010-9089-1726 | kbi111@naver.com | self | main |
| E002 | 구현서 | 010-7372-3524 | (A002 동일) | A002 | main (role 추가) |
| E003 | 권창용 | 010-7277-5157 | cysexy1@gmail.com | self | main |
| E004 | 김경호 | 010-2414-5974 | garbrielban@gmail.com | self | main |
| E005 | 김동효 | 010-9238-0412 | wotj1004@gmail.com | self | main |
| E006 | 김병철 | 010-9836-9839 | bctinting@gmail.com | self | main |
| E007 | 김영수 | 010-2635-5772 | vocal75@gmail.com | self | main |
| E008 | 김윤섭 | 010-2063-4980 | yseop1028@gmail.com | self | main |
| E009 | 김재현 | 010-2983-8814 | jhjhkjh11@gmail.com | self | main |
| E010 | 김태승 | 010-8683-9711 | kimtae00823@gmail.com | self | main |
| E010-G | 김태승 | 010-8185-9700 | (E010 동일) | E010 | **gas** ★ |
| E011 | 김현동 | 010-5057-2312 | zzoccolet1@gmail.com | self | main |
| E012 | 문성목 | 010-9397-8940 | anstjdahr93@gmail.com | self | main |
| E013 | 손동식 | 010-9213-7040 | sik100201@gmail.com | self | main |
| E014 | 안승웅 | 010-5399-3651 | 943943m@gmail.com | self | main |
| E015 | 양승문 | 010-4686-0294 | seungmoon112@gmail.com | self | main |
| E015-G | 양승문 | 010-3749-0294 | (E015 동일) | E015 | **gas** ★ |
| E016 | **류근학** | 010-4233-8586 | ykhgkr2345@gmail.com | self | main |
| E017 | 이상준 | 010-2909-5934 | joon811112@gmail.com | self | main |
| E017-G | 이상준 | 010-4729-8079 | (E017 동일) | E017 | **gas** ★ |
| E018 | 임종일 | 010-3035-3766 | dla7877@gmail.com | self | main |
| E019 | 전현진 | 010-7764-4402 | newjhj4402@gmail.com | self | main |
| E020 | 정상현 | 010-2273-0976 | star5030000@gmail.com | self | main |
| E021 | 정훈 | 010-2143-9620 | akhoons01@gmail.com | self | main |
| E022 | 조동욱 | 010-9447-1547 | (A001 동일) | A001 | main (role 추가) |
| E023 | **변기현** ⭐NEW | 010-6351-8818 | (정리 중) | self | main |
| E024 | **신경일** ⭐NEW | 010-7144-4291 | (정리 중) | self | main |

### Partner 1명

| code | 회사명 | 이메일 | 계좌 |
|---|---|---|---|
| M001 | 유솔홈케어 | wkdeend@naver.com | 카카오뱅크 3333-05-4717341 (최유경) |

→ 김쿨가이는 partner 역할 user 1명 (KA에 매핑) + 김쿨가이 아들도 partner (KB) 매핑 가능 — Day 5 정확화.

### 가스 권한 + 지역 시드 (이미지 1·2 기반)

**KA (쿨가이 아버지) 매칭 가스 프로**:
- E010-G 김태승: 마포구, 서대문구
- E015-G 양승문: 은평구
- E008 김윤섭: 용산구, 중구
- E017-G 이상준: 종로구, 성북구
- E020 정상현: 강북구, 도봉구, 노원구
- E007 김영수: 동대문구, 중랑구
- E014 안승웅: 성동구, 광진구
- E023 변기현: 금천구, 관악구
- E021 정훈: 서초구, 강남구
- E001 강병익: 동작구, 영등포구
- E005 김동효: 송파구, 강동구
- E019 전현진: 강서구, 양천구, 구로구

**KB (쿨가이 아들) 매칭 가스 프로**:
- E024 신경일: 은평구, 고양시
- E003 권창용: 종로구, 중구
- E011 김현동: 도봉구, 노원구
- E009 김재현: 성동구, 광진구
- E016 류근학: 서초구
- E006 김병철: 강남구
- E018 임종일: 송파구
- E004 김경호: 동작구, 영등포구

**시스템**: 이미지 1·2는 시드 데이터 — 운영 중 사장님이 PWA에서 권한/지역 변경 가능.

---

## 사전 준비 상태

- [x] Supabase 가입 완료
- [ ] 정책 시트 export — `Downloads/수수료정책.csv` 준비
  - [ ] 유솔홈케어 → H/N 채널별 분리 (Day 5)
  - [ ] KA/KB 정책 정확화 (Day 5)
- [x] 명단 28행 위 섹션에 통합 정리 완료
  - [x] 정정 반영 (조동욱 전화, 류근학 이름, 조동석/최수연 master)
- [ ] 일반 작업 권한 (E023 변기현, E024 신경일) Day 5에 정확화

---

## Day 1-5 작업 흐름

### Day 1 — Supabase 부팅

```
[사장님]
─ Supabase 새 프로젝트 생성 (region: Seoul / Tokyo)
─ DB URL + anon key + service role key 확보 → 다음 메시지에 알려줌
[Claude]
─ PWA 환경 변수 (.env) 설정
─ @supabase/supabase-js 설치
─ src/lib/supabase.js 클라이언트 모듈
```

### Day 2 — 핵심 스키마 마이그레이션

`그릇_아키텍처.md` v4 SQL 그대로:
- tenants / users / user_roles / principals
- categories / service_types / appliance_types / work_types
- tasks / task_items
- commission_policies / payments
- engineer_permissions / engineer_zones / task_assignments ★ 신규
- photos / user_off_days
- task_disputes / task_dispute_messages / status_history

### Day 3 — RLS + view + 함수

- RLS 정책 (user_roles 기반)
- partner-safe view (`tasks_partner_view`, `payments_partner_view`)
- `compute_payment` 함수 (8 calc_method)
- 인증 세팅 (옵션 A/B 결정)
- 라이브 격리 검증

### Day 4 — 시드 + 사용자 등록

- olleh tenant + 에어컨 카테고리 + 6 principal (KA/KB 분리)
- service_types / appliance_types / work_types
- **users 28행 + user_roles** (대표 4명 = owner+operator+engineer 3 role)
- engineer_permissions + engineer_zones (이미지 시드)

### Day 5 — 정책 시드 + 검증

- commission_policies 40+ 행 import (사장님 시트 export)
  - 유솔 H/N 분리 (시점에 정확화)
  - KA / KB 정책 (Day 5에 정확화 — 단일 K로 시드 후 분리?)
- compute_payment 13 검증 케이스 통과 확인
- Week 1 끝 → Week 2 (접수~배정) 시작 준비

---

## ⚠️ Windows 환경 노트

**한글 SQL 파일 클립보드 복사 시**:
- ❌ `cat 파일.sql | clip` — Windows `clip.exe`가 stdin을 CP949로 변환해서 한글 깨짐
- ✅ PowerShell: `Get-Content -Raw -Encoding UTF8 파일.sql | Set-Clipboard`
- ✅ 또는 메모장 직접 열어서 Ctrl+A → Ctrl+C
- 모든 SQL 파일은 UTF-8 + BOM 저장 (메모장 호환)

상세: `db/migrations/README.md`

---

## 참고 문서

| 문서 | 용도 |
|---|---|
| `올잇_비전_v2.md` | 큰 비전 |
| `Phase별_로드맵.md` | Phase 1-4 큰 그림 |
| **`Phase1_MVP_계획.md`** | Week 1-4 일정 |
| **`그릇_아키텍처.md` v4** | DB 스키마 마이그레이션 소스 |
| **`정산_정책_분석.md` v3** | compute_payment + 13 검증 케이스 |
| `정산_운영_매뉴얼.md` | 운영 직원용 8가지 풀이 + 유솔 정산 타이밍 |
| `유솔_네이버_상세.md` | 자금 흐름 + 시트 컬럼 + Phase 2 자동화 |
| `카테고리_확장_설계.md` | Phase 4 미래용 |
| `결정사항_추적.md` | 결정 이력 |
| `시트_vs_운영DB_갭.md` | Phase 2 운영 시트 마이그 검토용 |

---

## 보존된 자산 (시뮬 작업)

- `src/shared/taskAdapter.js` (Phase 1 직접 사용 X, 학습용)
- `src/pages/PrincipalApp.jsx` (parser v2)
- 백업 4개
- `__test_adapter.mjs`
- 시뮬 시트 row `260430-K-001`

→ Day 1 시작 시 정리 결정.

---

## Day 1 첫 메시지 예시

```
"Supabase 프로젝트 만들었어. URL: ___, anon key: ___, service role key: ___"
```

→ 받으면 .env 세팅 + 클라이언트 모듈 만들고 Day 2 진입.
