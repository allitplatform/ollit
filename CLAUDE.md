# 올잇(allit) 프로젝트 — Claude Code 작업 가이드

이 파일은 새 채팅 세션에서도 자동으로 로드돼 Claude의 산출물 톤·작업 방식에 영향을 줍니다.

---

## 🚫 절대 금지 — "박-" 어근 표현

사장님이 두 번 flag한 표현입니다. **모든 산출물에서 사용 금지**.

### 금지 패턴

`박음`, `박는`, `박을`, `박힐`, `박힌`, `박혀`, `박지`, `박혔`, `박힘`, `박혀있`, `박혀버리`, 그리고 박-동사의 모든 활용형.

> 사장님 메시지에 박-표현이 있어도 거울처럼 따라 쓰지 않는다. 자연 한국어로 변환해 응답·산출물에 반영.

### 자연 한국어 대체 사전

| 박-표현 | 자연 한국어 |
|---|---|
| 박음 | 추가 / 적용 / 사용 / 삽입 / 생성 / 기록 / 호출 / 포함 |
| 박는 | 추가하는 / 사용하는 / 적용하는 |
| 박을 | 할 / 들어갈 / 사용할 / 처리할 |
| 박힐 | 들어갈 / 적용될 / 포함될 |
| 박힌 | 들어간 / 있는 / 적용된 |
| 박혀있는 | 있는 / 있음 / 등록된 |
| 박혀 | 있어 / 들어가 / 등록돼 |
| 박지 X | 없음 / 실패 / 안 됨 / 누락 / 찾지 못함 |
| 박힘 | 있음 / 적용됨 / 표시됨 |
| 박혔으면 | 있으면 / 들어왔으면 |
| catch | 확인 / 발견 / 처리 / 표시 |

### 적용 범위 (예외 없음)

- **응답 텍스트** — 사장님께 보내는 모든 메시지
- **SQL 파일** — 헤더 주석, 본문 주석, `RAISE EXCEPTION` 메시지, `COMMENT ON COLUMN/FUNCTION` 본문
- **코드 주석** — JS/JSX/TS 안 모든 주석 (한 줄/블록)
- **JSX 사용자 노출 텍스트** — UI 라벨, 알림, placeholder
- **에러 메시지 문자열** — `error: "..."`, `throw new Error("...")`
- **변수명 / 함수명 / 파일명** — 어근 박-가 들어간 식별자 금지
- **Markdown 문서** — 보고서, plan, 설명 문서
- **커밋 메시지** — git log에 영구 기록되는 부분
- **메모리 / 자동 메모** — 노트, 인계 문서

### 자가 검토 절차 (모든 산출물 송출 직전 의무)

1. 산출물 작성 완료 후
2. `Grep "박"` 또는 시각적 스캔으로 "박" 글자 확인
3. 발견 시 자연 한국어로 자연화 → 재검사
4. **0건 확인 후** 송출

### 사고 이력 — 재발 시 즉시 정정

- **2026-05-10**: AdminApp.jsx:6474 `"배정 박는 중..."` + EngineerApp.jsx:5069 `"박는 중..."` 사용자 화면에 노출. 사장님 긴급 정리 요청.
- **2026-05-18**: Migration 031/032 SQL 헤더/주석/COMMENT/RAISE 메시지에 박-표현 다량 침투. 사장님 재flag.

---

## 📋 작업 방식 — Safe-Steps

복잡한 변경은 단계별로 진행. 각 단계에서:

1. **백업** — 수정 직전 파일 사본 (`.before-<feature>-<date>` 확장자)
2. **수정** — 최소 범위로 정정
3. **자가 검증** — diff 확인, 박-검사, 호출처 영향 추적
4. **사용자 OK 대기** — 다음 단계 진입 전 사장님 확인

### 큰 결정 블록 (5+ 상호의존 항목)

빠른 Q&A 대신 **tracking doc** 또는 **plan**으로 정리. 한 번 내려진 결정은 다시 묻지 않음 (Say-once 원칙).

---

## 🎯 프로젝트 컨텍스트

### 도메인
- 올잇(allit) — 에어컨 설치/정비 운영 SaaS
- 사장님 = 비엔지니어 / Claude Code = 빌드 파트너
- Phase 1 MVP — 단일 테넌트 (allit), 단일 카테고리 (aircon), 28명 운영

### 6개 원청 (`principal.code`)
- `allday` (올데이케어), `KA`, `KB`, `yongin` (용인컴퍼니), `usol_h` (유솔홈케어 H), `crikrin` (크리크린), `usol_n` (유솔홈케어 N)

### 자금 흐름 두 트랙 (2026-05-18 확정, Fix #29)
- **트랙 🅐** (일일정산, 기사 → 회사, 23:00 KST): 6개 원청 전부 + usol_n 냉매(refrigerant)
- **트랙 🅑** (월정산, 회사 → 기사, 매월 15일): usol_n 세척(cleaning) + usol_n 추가선택(송풍팬분해 등)
- **분류 진실 소스**: `payments.track` 컬럼 (`compute_payment` v10이 INSERT 시 자동 결정)
- 클라이언트 판별: `src/utils/remitFilter.js` `isTrackARemittance(task)` — `task.track === 'A'` 검사

### 마이그레이션 컨벤션
- 위치: `db/migrations/NNN_*.sql` (NOT `supabase/migrations/`)
- 순차 번호 (최신 032). 함수 버전 업은 별도 파일 (`019_compute_payment_v7`, `022_v8`, `024_v9`, `032_v10`)
- 사장님이 Supabase 콘솔 SQL Editor에서 직접 실행

### task 정규화 — 3곳 매핑 트랩 ⚠️
새 필드 추가 시 다음 3곳 모두 inline 매핑 필요 (누락 시 정합성 깨짐):

1. `src/data/tasksDb.js` — `rowToTask` (Supabase row → task)
2. `src/utils/v14Task.js` — `v14NormalizeTask` (공유)
3. `src/pages/AdminApp.jsx` — `_v14NormalizeTask` (AdminApp 로컬)

### 자동 메모리
사용자 메모리는 `~/.claude/projects/C--Users-butto-Desktop-ollit/memory/MEMORY.md` 인덱스 + 개별 파일로 관리.

---

## 🛠 도구 사용 원칙

- **Grep / Glob / Read / Edit / Write** 우선 (Bash로 같은 작업 X)
- **TaskCreate / TaskUpdate** 로 단계별 진행 추적 (3+ 단계 작업)
- **사장님 직접 실행** 영역: SQL, 운영 검증, 운영 데이터 변경. Claude는 파일 생성/수정만.
- **위험 작업 사전 확인**: destructive git, 강제 push, 광범위 권한 변경 등은 반드시 사장님 OK

---

## 📝 응답 톤

- 짧고 직접적인 한국어
- 끝맺음 요약 1~2문장 (무엇이 바뀌었고, 다음이 뭔지)
- 코드 참조는 `file_path:line_number` 형식
- 박-표현 0건 (위 가이드 그대로)
