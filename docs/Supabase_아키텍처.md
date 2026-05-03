# Supabase 아키텍처 — Multi-Tenant Multi-Category

**작성일**: 2026-04-30
**상태**: 초안 v1 (비전 v2 기반)
**전제**: `올잇_비전_v2.md` 의 4원칙
**관련**: `카테고리_확장_설계.md`, `로드맵_v2.md`

---

## 왜 Supabase?

### 요구사항 vs 후보

| 요구 | Supabase | GAS+Sheets | Firebase | 자체 서버 |
|---|---|---|---|---|
| Multi-tenant 격리 | ✅ Postgres RLS native | ⚠️ 시트별 분리 어려움 | ⚠️ 보안규칙 복잡 | 직접 구현 |
| Multi-category | ✅ 정형 + JSONB | ❌ 컬럼 fixed | ✅ NoSQL | 직접 구현 |
| 외부 의존 0 | ✅ 자체 호스팅 가능 | ❌ Google 강결합 | ❌ Google 강결합 | ✅ |
| 사장님 운영 단순함 | ✅ 콘솔 GUI | ✅ 시트 직관 | ⚠️ 콘솔 학습 필요 | ❌ 운영 부담 |
| 기사 20명 동시 | ✅ Postgres | ⚠️ Lock | ✅ | ✅ |
| 1000건/년 → 만건/년 | ✅ | ⚠️ 시트 50k 한도 | ✅ | ✅ |
| 인증/권한 내장 | ✅ Supabase Auth | ❌ 직접 | ✅ Firebase Auth | ❌ |
| 실시간 (선택) | ✅ Realtime | ❌ | ✅ | 직접 |
| 비용 | 무료 시작, $25/월부터 | 무료 (Google 계정 한도) | 무료 시작, 사용량 따라 | 인프라 비용 |
| 사장님 학습 곡선 | 중 (SQL 약간) | 낮 (시트 그대로) | 높 (NoSQL) | 매우 높 |

### 종합 추천: **Supabase**

- 비전 v2 4원칙 모두 자연스럽게 충족
- Postgres = 가장 검증된 RDB, SQL 지식이 평생 자산
- 콘솔 GUI 충실 → 사장님이 데이터 직접 보고 수정 가능 (시트만큼은 아니지만 충분)
- Auth + Storage(사진) + Realtime + Edge Functions 한 데서 해결 → 외부 의존 0

### 단점/주의

- 사장님 SQL 약간 학습 필요 (단순 쿼리 수준)
- 시트만큼 직관적이지 않음 (단, Supabase Studio가 시트와 비슷한 인터페이스 제공)
- 마이그레이션 비용 — GAS+Sheets에서 옮기는 일회성 작업

---

## 핵심 도메인 모델

```
tenant (회사)
  ├─ user (운영자/원청/기사/관리자)
  ├─ category (이 회사가 다루는 카테고리들)
  │    ├─ service_type (청소/설치/...)
  │    │    └─ work_type (벽걸이 청소/...)
  │    ├─ appliance_type (벽걸이/스탠드/...)
  │    └─ pricing_rule
  ├─ engineer
  │    └─ engineer_category (자격)
  ├─ task (작업)
  │    ├─ task_item (라인 아이템)
  │    ├─ schedule
  │    ├─ photo
  │    ├─ payment
  │    └─ status_history
  └─ ...
```

---

## 테이블 정의 (초안)

### 1. 테넌시 / 사용자

```sql
-- 회사 (입주 단위)
CREATE TABLE tenants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,    -- 'allit', 'cool-guy', ...
  name         text NOT NULL,           -- '올잇', '쿨가이', ...
  plan         text NOT NULL DEFAULT 'free',
  created_at   timestamptz DEFAULT now(),
  settings     jsonb DEFAULT '{}'::jsonb -- 회사별 설정 (브랜드 컬러, 알림 정책 등)
);

-- 사용자 (Supabase Auth users 와 연결)
CREATE TABLE app_users (
  id           uuid PRIMARY KEY,        -- = auth.users.id
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  email        text NOT NULL,
  display_name text,
  role         text NOT NULL CHECK (role IN ('owner','operator','principal','engineer','admin')),
  -- principal 인 경우 어떤 원청을 대변하는지
  principal_id uuid REFERENCES principals(id),
  -- engineer 인 경우 기사 프로필 연결
  engineer_id  uuid REFERENCES engineers(id),
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- 원청 (회사가 받아오는 위탁사)
CREATE TABLE principals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  code         text NOT NULL,           -- 'K', 'A', 'YS' (작업번호 prefix)
  name         text NOT NULL,           -- '쿨가이', '올데이케어' ...
  type         text CHECK (type IN ('direct','external')),  -- 직영/외부
  external_source text,                 -- 외부일 때 어디서 동기화 (시트 ID 등)
  commission_rate numeric DEFAULT 50,   -- 기본 수수료율 %
  UNIQUE (tenant_id, code)
);
```

### 2. 카테고리 트리 (소스)

```sql
-- 카테고리 (에어컨/청소기/대리석/...)
-- 글로벌 + 테넌트별 커스텀 가능
CREATE TABLE categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id),  -- NULL이면 모든 회사 공유
  code         text NOT NULL,                -- 'aircon', 'vacuum', 'marble'
  name         text NOT NULL,                -- '에어컨', '청소기', '대리석'
  unit         text NOT NULL DEFAULT '대',   -- '대', '㎡', '시간'
  qty_kind     text NOT NULL DEFAULT 'integer', -- 'integer' | 'decimal'
  active       boolean DEFAULT true,
  -- 카테고리별 설정 JSON
  --   form_schema:    폼 필드 정의
  --   photo_steps:    ['before', 'after'] 또는 ['전','중','후']
  --   pricing_kind:   'unit_price_table' | 'area_x_rate' | 'flat'
  config       jsonb DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, code)
);

-- 서비스 종류 (카테고리 안의 큰 분류)
-- 에어컨 카테고리 = [청소, 설치, 철거, 이전, 냉매충전, 점검]
CREATE TABLE service_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL REFERENCES categories(id),
  code         text NOT NULL,
  name         text NOT NULL,
  sort_order   int DEFAULT 0,
  active       boolean DEFAULT true,
  UNIQUE (category_id, code)
);

-- 기종 / 모델 (적용 대상 객체)
-- 에어컨 = [벽걸이, 스탠드, 시스템, 천장형, ...]
-- 대리석 = (없음 또는 [천연, 인조])
CREATE TABLE appliance_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL REFERENCES categories(id),
  code         text NOT NULL,
  name         text NOT NULL,
  sort_order   int DEFAULT 0,
  active       boolean DEFAULT true,
  UNIQUE (category_id, code)
);

-- 작업 종류 (서비스 × 기종) — 단가 표
-- "벽걸이 청소", "스탠드 설치" ...
CREATE TABLE work_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id uuid NOT NULL REFERENCES service_types(id),
  appliance_type_id uuid REFERENCES appliance_types(id), -- NULL 가능 (기종 무관)
  code            text NOT NULL,
  name            text NOT NULL,
  default_unit_price int NOT NULL DEFAULT 0,  -- 기본 단가 (원)
  duration_min    int DEFAULT 60,             -- 예상 소요 (분)
  sort_order      int DEFAULT 0,
  active          boolean DEFAULT true,
  UNIQUE (service_type_id, appliance_type_id, code)
);
```

### 3. 가격 정책 (테넌트별 오버라이드)

```sql
-- 회사별 단가 오버라이드 (work_types 기본값을 회사가 자기 가격으로 덮음)
CREATE TABLE pricing_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  work_type_id   uuid NOT NULL REFERENCES work_types(id),
  unit_price     int NOT NULL,
  travel_fee     int DEFAULT 0,
  -- 추가 옵션 (대리석 면적 단가 등 카테고리별 변형)
  config         jsonb DEFAULT '{}'::jsonb,
  effective_from date DEFAULT CURRENT_DATE,
  effective_to   date,
  UNIQUE (tenant_id, work_type_id, effective_from)
);
```

### 4. 기사

```sql
CREATE TABLE engineers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  code          text NOT NULL,                 -- 'E001', 'E002' (회사 안에서 유일)
  name          text NOT NULL,
  phone         text,
  active        boolean DEFAULT true,
  default_commission_rate numeric DEFAULT 40,
  UNIQUE (tenant_id, code)
);

-- 기사가 처리 가능한 카테고리 (자격)
CREATE TABLE engineer_categories (
  engineer_id   uuid REFERENCES engineers(id),
  category_id   uuid REFERENCES categories(id),
  cert_info     text,                          -- 자격증 정보
  PRIMARY KEY (engineer_id, category_id)
);
```

### 5. 작업 / 라인 아이템 / 일정

```sql
-- 작업 (한 건의 서비스 요청 — 카테고리 무관 그릇)
CREATE TABLE tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  category_id     uuid NOT NULL REFERENCES categories(id),
  task_no         text NOT NULL,             -- '260430-K-001' 시트 호환 번호 (display)
  principal_id    uuid REFERENCES principals(id),
  customer_name   text NOT NULL,
  phone           text NOT NULL,
  address         text,
  full_address    text,
  region          text,                       -- 자동 추출
  channel         text,                       -- '카톡','전화','네이버',...
  status          text NOT NULL DEFAULT '미배정',  -- 미배정/약속대기/확정/진행중/완료/취소
  is_urgent       boolean DEFAULT false,
  urgent_reason   text,
  request_note    text,                       -- 고객 요청
  happycall_status text,                      -- uncontacted/contacted/assigned
  happycall_memo  text,
  recommended_engineer_id uuid REFERENCES engineers(id),
  assigned_engineer_id    uuid REFERENCES engineers(id),
  requested_date  date,
  requested_time  text,                       -- 오전/오후/낮/저녁
  scheduled_at    timestamptz,                -- 일정 확정 시점
  started_at      timestamptz,
  completed_at    timestamptz,
  estimate_total  int,                        -- 견적 합계
  product_price   int,
  travel_fee      int,
  extra_fee       int,
  extra_reason    text,
  total_amount    int GENERATED ALWAYS AS (
    COALESCE(product_price,0) + COALESCE(extra_fee,0)
  ) STORED,
  commission_rate numeric,
  commission      int,                        -- 원청 수수료
  engineer_net    int,                        -- 기사 순익
  work_memo       text,
  remarks         text,
  settlement_status text DEFAULT '대기',
  -- 카테고리 특화 필드 (대리석 면적, 청소기 모델명 등)
  category_data   jsonb DEFAULT '{}'::jsonb,
  received_at     timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (tenant_id, task_no)
);

-- 작업 라인 아이템 (한 작업 안의 항목들)
-- 예: 작업 #1 = [벽걸이 청소 1대 5만, 스탠드 청소 1대 8만]
CREATE TABLE task_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  work_type_id    uuid REFERENCES work_types(id),
  appliance_type_id uuid REFERENCES appliance_types(id),
  qty             numeric NOT NULL DEFAULT 1, -- 정수(대) 또는 실수(㎡)
  unit_price      int NOT NULL,
  subtotal        int GENERATED ALWAYS AS ((qty * unit_price)::int) STORED,
  description     text,
  sort_order      int DEFAULT 0
);

-- 일정 변경 이력
CREATE TABLE schedule_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  changed_at      timestamptz DEFAULT now(),
  changed_by      uuid REFERENCES app_users(id),
  from_scheduled_at timestamptz,
  to_scheduled_at   timestamptz,
  reason          text
);

-- 상태 변경 이력
CREATE TABLE status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  changed_at      timestamptz DEFAULT now(),
  changed_by      uuid REFERENCES app_users(id),
  from_status     text,
  to_status       text,
  note            text
);
```

### 6. 사진

```sql
CREATE TABLE photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step            text NOT NULL,            -- 'before' | 'after' | '전' | '중' | '후' (카테고리별)
  storage_path    text NOT NULL,            -- Supabase Storage 경로
  url             text,                     -- public url (생성 가능)
  uploaded_by     uuid REFERENCES app_users(id),
  uploaded_at     timestamptz DEFAULT now()
);
```

### 7. 메시지/알림 로그

```sql
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  task_id         uuid REFERENCES tasks(id),
  channel         text NOT NULL,            -- 'kakao','sms','email','telegram','app_push'
  recipient       text NOT NULL,
  template_code   text,                     -- 템플릿 식별자
  payload         jsonb,
  sent_at         timestamptz DEFAULT now(),
  status          text DEFAULT 'sent',      -- sent/delivered/failed
  error           text
);
```

### 8. 휴무 (현재 시뮬에 이미 있음)

```sql
CREATE TABLE engineer_off_days (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id     uuid NOT NULL REFERENCES engineers(id),
  off_date        date NOT NULL,
  type            text NOT NULL,            -- 'full' | 'partial'
  start_time      time,
  end_time        time,
  memo            text,
  created_at      timestamptz DEFAULT now()
);
```

---

## RLS (Row Level Security) — 멀티테넌시의 핵심

Supabase가 PostgreSQL RLS를 활용해 자동 격리:

```sql
-- 모든 테넌트 격리 테이블에 적용
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 사용자는 자기 회사 데이터만 볼 수 있음
CREATE POLICY tenant_isolation_select ON tasks
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM app_users WHERE id = auth.uid()
  ));

-- 권한별 추가 제약
-- 원청은 자기 principal_id 작업만
CREATE POLICY principal_only ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_users u
      WHERE u.id = auth.uid()
        AND u.role = 'principal'
        AND u.principal_id = tasks.principal_id
    )
  );

-- 기사는 자기 배정 작업만
CREATE POLICY engineer_only ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app_users u
      WHERE u.id = auth.uid()
        AND u.role = 'engineer'
        AND u.engineer_id = tasks.assigned_engineer_id
    )
  );
```

**의미**: 프론트가 실수로 모든 데이터 SELECT 해도 RLS가 자기 회사 + 자기 권한 안의 row만 반환. 보안의 마지막 방어선이 DB에 있음.

---

## 카테고리별 커스터마이즈 어디까지?

### 데이터 수준 (코드 변경 X) — 90%

새 카테고리 "도어락" 추가:
1. `categories` 행 추가 (`code='doorlock', name='도어락', unit='대', config={...}`)
2. `service_types` 행 (`설치, 교체, 수리`)
3. `appliance_types` 행 (`디지털, 기계식, 스마트`)
4. `work_types` 행 (`디지털 설치, 기계식 교체, ...`) + 단가
5. `pricing_rules` (회사별 단가 오버라이드)
6. (선택) `categories.config.form_schema` JSONB로 폼 정의

→ **PWA 코드 변경 0**, UI에 도어락이 자동 노출.

### 코드 수준 (가능하면 피하되 필요 시) — 10%

피할 수 없는 분기:
- **단위 입력 UI**: 에어컨 "1대" vs 대리석 "12.5㎡" — 정수/실수 입력 컴포넌트 분기
- **사진 단계**: 일부 카테고리(대리석)는 3단계 — 카메라 화면 컴포넌트 분기
- **가격 모델**: 면적 × 단가 vs 단가 × 수량 — 견적 화면 분기

**해결 패턴**:
```jsx
// 카테고리별 컴포넌트 맵
const CATEGORY_FORMS = {
  aircon: AirconForm,
  vacuum: VacuumForm,
  marble: MarbleForm,
  doorlock: DoorlockForm,
};
const FormComponent = CATEGORY_FORMS[category.code] ?? GenericForm;
```

새 카테고리 = 새 컴포넌트 1개 (또는 GenericForm으로 충분하면 0).

---

## 마이그레이션 경로 (시뮬 GAS → Supabase)

### 옵션 A — 점진 (권장하지 않음)
- 시뮬 GAS 8-A 결선 → 안정화 → Supabase로 마이그레이션
- 단점: 시뮬 작업 throwaway, 두 번 일

### 옵션 B — 직진 (권장) ★
- 8-A 여기서 멈춤 → Supabase 도입 → MVP (1회사, 1카테고리)
- v3 단계 (`로드맵_v2.md` 참조)
- 단점: Supabase 학습 부담 즉시

### 옵션 C — 병행
- 시뮬 GAS는 PWA 검증용, Supabase는 v3 신규 트랙
- 단점: 자원 분산

### 데이터 이전 (필요 시)

시뮬 시트 데이터 → Supabase:
- `getTasks` 응답 JSON 받음
- `sheetToPwa` 어댑터로 PWA 모델 변환
- Supabase `tasks` INSERT (sheet `taskId` → `task_no`)
- 한 번 돌리는 일회성 스크립트

운영 시트(50열) → Supabase:
- 컬럼 매핑표 작성 (`시트_vs_운영DB_갭.md` 채워진 후)
- 일회성 마이그레이션 스크립트
- 외부 시트 동기화 트리거는 Supabase Edge Function으로 이전

---

## 인증 / 권한

Supabase Auth 활용:

| 역할 | 가능한 행위 | RLS 정책 |
|---|---|---|
| owner (회사 사장님) | 자기 회사 모든 것 | tenant_id = 본인 |
| operator (해피콜) | 자기 회사 모든 작업 R/W | tenant_id = 본인 |
| principal (원청 대표) | 자기 principal_id 작업만 | + principal_id 필터 |
| engineer (기사) | 자기 배정 작업만 R/W일부 | + assigned_engineer_id 필터 |
| admin (운영팀 - 올잇) | 모든 tenant 모니터링 | super-admin 정책 |

JWT 토큰의 `auth.uid()`로 RLS 자동 적용.

---

## 비용 추산

Supabase 무료 티어:
- 500MB DB
- 1GB Storage (사진)
- 2GB Bandwidth/월
- 50,000 MAU

쿨가이 1회사 운영 (1000건/년):
- 1년 row 수: 약 1000행 × 평균 5KB = 5MB → 무료 티어 충분
- 사진 1000건 × 4장 평균 × 500KB = 2GB → 무료 초과, Pro 플랜 ($25/월)

**MVP 단계는 무료 / 1회사 본격 운영부터 $25/월 / N회사 입주 시 Pro 또는 Team**

---

## 다음 액션

1. 본 문서 검토 → 사장님 의견
2. `카테고리_확장_설계.md` 검토 (소스 추가 매뉴얼)
3. **결정 V1** (시뮬 GAS 마무리 vs 직진 Supabase) 사장님 답
4. 결정 답이 직진이면 → v3 MVP 슬라이스 계획 (`로드맵_v2.md` 참조)

---

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-04-30 | 초안 v1 작성 (비전 v2 기반) |
