# Round 2 spec — 원청·운영자 직접 취소 (전체·부분)

**작성**: 2026-05-25
**상태**: spec 문서 (코드·적용 X)
**의존**: Round 1 (069b/070/071/072) 적용 완료

---

## 결정 사항 (사장님 확정)

| 항목 | 결정 |
|---|---|
| 취소 가능 상태 | **전 상태** (미배정·배정·확정·진행중·완료) 즉시 |
| 운영자 승인 | 없음 — 원청도 즉시 반영 |
| 확인 다이얼로그 | 필수 — 사유 입력 + 확인 |
| 완료 건 다이얼로그 | 경고 문구 추가 — "완료된 작업 — 취소 시 정산 0 (기사 수고비는 작업상세 컨트롤로 별도 조정)" |
| 전체취소 동작 | `tasks.status='취소'` + `task_items` 전부 `is_canceled=true` → 070 트리거 자동 |
| 부분취소 동작 | 단건 `is_canceled=true` (070 BEFORE 트리거가 customer_paid/net=0 + metadata 백업) |
| 운영자 부분취소 | AdminApp에 추가 |
| 기사 흐름 | 현행 유지 (TaskPartialScreen은 Round 1 (a) 이미 정정) |
| **완료 건 취소 시 기사 수고비** | **신규 spec — 아래 [6. 수고비 모델] 참조** |

---

## 1. RPC 목록 (4개)

모두 `SECURITY DEFINER`. 권한 가드는 RPC 본문에서 검증.

### 1-A. `partner_full_cancel(p_task_id uuid, p_reason text)`

**입력**
- `p_task_id` — 취소할 task UUID
- `p_reason` — 취소 사유 (빈 문자열 거부)

**출력**: `jsonb`
- `{ ok: true, task_id, items_canceled: int }` 성공
- `{ ok: false, error: text }` 실패

**권한 가드 (필수 — RLS가 tenant 단위라 RPC가 막아야)**
- 호출자 `auth.uid()` → user_roles에서 `role='partner' AND principal_id` 조회
- task의 `principal_id`와 일치 확인
- **불일치 시 즉시 RAISE EXCEPTION (다른 원청 건 조작 차단)**
- partner 역할 행이 없으면 거부 (operator/owner는 별도 RPC 사용)

**동작 (한 트랜잭션)**
1. task 존재 확인 + principal_code 일치 검증
2. `category_data` 머지:
   ```
   {
     cancelReason: p_reason,
     previousStatus: 직전 tasks.status,
     cancelActor: 'partner',
     cancelActorUserId: auth.uid(),
     cancelActorPrincipalCode: 호출자 principal_code,
     cancelAt: now() ISO,
     wasCompleted: (직전 status IN ('완료', 'visit_only'))
   }
   ```
   기존 키 (consent, partial 등) 보존.
3. `UPDATE tasks SET status='취소', category_data=...`
4. `UPDATE task_items SET is_canceled=true, canceled_reason=p_reason, canceled_at=now() WHERE task_id=p_task_id AND is_canceled=false`
   - 070 BEFORE 트리거가 customer_paid·net 0 + metadata 백업 자동
   - 070 AFTER 트리거가 tasks.product_price=0 자동 동기
   - task_items_compute_trg(028)이 compute_payment v15(071) 호출 → payments engineer=0 / principal=0 자동

**효과 검증**
- 변경 직후 payments.engineer_amount = travel_fee (없으면 0). 본작업·세척·냉매 측 모두 0.

---

### 1-B. `partner_partial_cancel_item(p_item_id uuid, p_reason text)`

**입력**
- `p_item_id` — 취소할 task_items UUID (단건)
- `p_reason` — 사유

**출력**: `jsonb` — `{ ok, item_id, task_id }` / `{ ok: false, error }`

**권한 가드**
- task_items의 task_id → tasks.principal_id 조회
- 호출자 partner principal_id와 일치 검증
- 불일치 시 거부

**동작**
- `UPDATE task_items SET is_canceled=true, canceled_reason=p_reason, canceled_at=now() WHERE id=p_item_id`
- 070 트리거 자동 (BEFORE 백업 + AFTER product_price 재합산 + 028 compute_payment 재호출)

**상태 가드**
- 이미 `is_canceled=true`면 idempotent (다시 true로 → 070 BEFORE 트리거가 was_canceled 같음 분기, 동작 X) — 안전
- task.status='취소'면 거부? — 사장님 spec: 전체취소된 task에 부분취소 의미 없음. 거부 권장.

---

### 1-C. `admin_full_cancel(p_task_id uuid, p_reason text)`

**입력**: partner_full_cancel과 동일 (2 인자)

**권한 가드**
- 호출자 user_roles에서 `role IN ('owner', 'operator')` 확인
- 없으면 거부

**동작**: 1-A와 동일 — 단 category_data:
```
cancelActor: 'operator',
cancelActorUserId: auth.uid(),
cancelActorPrincipalCode: null,
```
- 기본 `cancel_engineer_comp_kind='none'` / `amount=0` 자동 세팅.
- 사후 `admin_set_cancel_compensation` 으로 visit_fee 토글.

---

### 1-D. `admin_partial_cancel_item(p_item_id uuid, p_reason text)`

**권한 가드**: owner/operator 역할만

**동작**: 1-B와 동일 (category_data 측 actor='operator')

---

### 공통 사양
- `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
- `GRANT EXECUTE TO authenticated` (anon 거부)
- 호출 흐름:
  ```
  PWA → supabase.rpc('partner_full_cancel', { p_task_id, p_reason })
  ```
- 실패 시 RAISE EXCEPTION → 호출처 catch → 토스트 표시

---

## 2. category_data 측 남길 키

전체취소 시:
```jsonc
{
  // 기존 키 보존 (consent, partial, visitOnly 등)
  cancelReason: "고객 직접 연락 — 일정 안 맞음",
  previousStatus: "확정",
  cancelActor: "partner",          // 'partner' | 'operator' | 'engineer'
  cancelActorUserId: "<uuid>",
  cancelActorPrincipalCode: "usol_n", // partner 일 때만, 운영자는 null
  cancelAt: "2026-05-25T10:30:00.000Z",
  wasCompleted: false               // 직전 status가 '완료'/'visit_only' 였으면 true
}
```

부분취소는 `category_data` 미변경 — task_items.canceled_reason / canceled_at 에 기록.

기존 어댑터(`requestCancelAdapter` 측 cancelRequestedAt, `approveCancelAdapter` 측 cancelApprovedAt) 흐름은 **그대로 유지** — 기사 측 취소요청 → 운영자 승인 흐름은 별도. 본 Round 2는 신규 즉시 취소 흐름 추가.

운영 측 구분:
- 기사 발의: `category_data.cancelRequestedAt` / `cancelApprovedAt` 존재
- 본 신규 즉시: `cancelActor` 키 존재
- 두 가지가 충돌하지 않도록 키 분리

---

## 3. PrincipalApp UI

### 위치
`src/pages/PrincipalApp.jsx` `TaskDetail` 컴포넌트 — 작업 메모 박스 아래, `happycallMemo` 박스 위.

### 액션 박스
```
┌────────────────────────────────┐
│ ⛔ 작업 전체 취소                │  (빨간, 100% 폭)
├────────────────────────────────┤
│ ◐ 품목별 취소                   │  (회색, 100% 폭)
└────────────────────────────────┘
```
- 두 버튼 모두 모든 status에서 표시 (사장님 spec — 전 상태 가능).
- `status === '취소'` 인 task는 액션 박스 자체 미렌더링 (이미 취소).

### 전체 취소 다이얼로그
```
┌─────────────────────────────────┐
│ 작업 전체 취소                   │
│                                 │
│ 정말 취소하시겠습니까?           │
│                                 │
│ [⚠️ 완료된 작업 경고]            │  ← wasCompleted 시만
│ 이 작업은 이미 완료 상태입니다.   │
│ 취소 시 정산 0원으로 처리됩니다. │
│                                 │
│ 사유 (필수)                     │
│ ┌───────────────────────────┐   │
│ │ ...                       │   │
│ └───────────────────────────┘   │
│                                 │
│ [닫기]   [✓ 취소 처리]          │
└─────────────────────────────────┘
```

### 품목별 취소 다이얼로그
```
┌─────────────────────────────────┐
│ 품목별 취소                      │
│                                 │
│ ☐ 세척_벽걸이 ×1 (₩69,412)      │
│ ☑ 세척_4way ×1 (₩119,086)       │
│ [이미 취소된 항목은 회색·체크X]  │
│                                 │
│ 사유 (필수)                     │
│ ┌───────────────────────────┐   │
│ │ ...                       │   │
│ └───────────────────────────┘   │
│                                 │
│ [닫기]   [✓ 선택 항목 취소]     │
└─────────────────────────────────┘
```
- 체크된 항목 각각에 `partner_partial_cancel_item` 순차 호출 (또는 배치 RPC — Round 3 검토)
- 이미 `isCanceled=true` 항목은 체크 비활성화 + "이미 취소됨" 라벨

### 로직
```js
async function handleFullCancel(reason) {
  const res = await supabase.rpc('partner_full_cancel', {
    p_task_id: task.id,
    p_reason: reason,
  });
  if (res.error) { 토스트 실패; return; }
  // refetch + 토스트 성공
}

async function handlePartialCancel(itemIds, reason) {
  for (const id of itemIds) {
    const res = await supabase.rpc('partner_partial_cancel_item', {
      p_item_id: id, p_reason: reason,
    });
    if (res.error) { 부분 실패 토스트; }
  }
  refetch();
}
```

---

## 4. AdminApp UI

### 위치
`src/pages/AdminApp.jsx` `TaskDetail` (line 6872 부근) 기존 액션 박스.

### 변경
1. **조건 변경**: `task.state !== "done"` 가드 제거 → **모든 상태에서 표시**.
2. **버튼 추가**: 기존 `⚫ 작업 취소` 위에 `◐ 부분 취소` 추가.
3. **완료 건 경고**: 기존 `TaskCancelDialog`에 wasCompleted 분기 — 완료 상태 task일 때 경고 문구 노출.

### 액션 박스 (after)
```
{state === 'active' || state === 'moving' 시 출장비만}
{모든 상태에서:}
  ◐ 부분 취소
  ⚫ 작업 취소
```

### onCancelTask 콜백 정정
- 기존 `onCancelTask(reasonId, memo)` — `approveCancelAdapter` 또는 직접 status='취소' UPDATE 추정
- 신규: `admin_full_cancel(task_id, reason)` RPC 호출로 일원화

### 부분취소 다이얼로그
- PrincipalApp 부분취소 다이얼로그와 동일 컴포넌트 재사용 권장 — 별도 `src/components/PartialCancelDialog.jsx` 신설.
- 운영자 측은 `admin_partial_cancel_item` 호출.

---

## 5. 마이그·적용 순서·검증·롤백

### 마이그 파일 1개
`db/migrations/073_cancel_rpcs.sql` — RPC 4개 일괄.

### 마이그 본문 골격
```sql
BEGIN;

-- 1-A. partner_full_cancel
CREATE OR REPLACE FUNCTION partner_full_cancel(p_task_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_caller_principal_id uuid;
  v_caller_principal_code text;
  v_was_completed boolean;
  v_items_canceled int;
BEGIN
  -- 입력 검증
  IF p_task_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_id 누락'); END IF;
  IF COALESCE(TRIM(p_reason), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', '사유 누락'); END IF;

  -- task 조회
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', '작업 없음'); END IF;

  -- 이미 취소된 task 거부
  IF v_task.status = '취소' THEN RETURN jsonb_build_object('ok', false, 'error', '이미 취소된 작업'); END IF;

  -- 권한 가드: 호출자 partner 역할 + principal_id 일치
  SELECT ur.principal_id, p.code
    INTO v_caller_principal_id, v_caller_principal_code
  FROM user_roles ur
  JOIN principals p ON p.id = ur.principal_id
  WHERE ur.user_id = auth.uid() AND ur.role = 'partner'
  LIMIT 1;

  IF v_caller_principal_id IS NULL THEN
    RAISE EXCEPTION '권한 없음 — partner 역할 필요';
  END IF;

  IF v_caller_principal_id <> v_task.principal_id THEN
    RAISE EXCEPTION '권한 없음 — 자기 원청 task 만 취소 가능';
  END IF;

  v_was_completed := v_task.status IN ('완료', 'visit_only');

  -- category_data 머지
  UPDATE tasks SET
    status = '취소',
    category_data = COALESCE(category_data, '{}'::jsonb) || jsonb_build_object(
      'cancelReason', p_reason,
      'previousStatus', v_task.status,
      'cancelActor', 'partner',
      'cancelActorUserId', auth.uid(),
      'cancelActorPrincipalCode', v_caller_principal_code,
      'cancelAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'wasCompleted', v_was_completed
    ),
    updated_at = now()
  WHERE id = p_task_id;

  -- 모든 미취소 item을 is_canceled=true (070 트리거 자동 발화)
  UPDATE task_items SET
    is_canceled = true,
    canceled_reason = p_reason,
    canceled_at = now()
  WHERE task_id = p_task_id
    AND COALESCE(is_canceled, false) = false;

  GET DIAGNOSTICS v_items_canceled = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'task_id', p_task_id, 'items_canceled', v_items_canceled);
END;
$$;
GRANT EXECUTE ON FUNCTION partner_full_cancel(uuid, text) TO authenticated;

-- 1-B. partner_partial_cancel_item — 유사 구조
-- 1-C. admin_full_cancel       — 권한 가드만 owner/operator 역할
-- 1-D. admin_partial_cancel_item — 동일 패턴

COMMIT;
```

### 적용 순서
1. **마이그 073** 적용 (Supabase SQL Editor) — 1단계
2. 검증 SELECT (RPC 4개 등록 + GRANT)
3. **UI 코드 적용** — 별도 commit:
   - PrincipalApp TaskDetail 액션 박스 + 다이얼로그
   - AdminApp 기존 액션 박스 변경 + 부분취소 다이얼로그
   - 신규 `PartialCancelDialog` 컴포넌트
4. `git push origin main` (Vercel 배포)

### 검증 SQL (마이그 073 적용 후)
```sql
-- A. RPC 4개 등록 확인
SELECT proname, prosecdef AS security_definer
FROM pg_proc
WHERE proname IN ('partner_full_cancel', 'partner_partial_cancel_item', 'admin_full_cancel', 'admin_partial_cancel_item', 'admin_set_cancel_compensation')
ORDER BY proname;
-- 기대: 5 row / 모두 prosecdef = true

-- B. GRANT 확인
SELECT routine_name,
       has_function_privilege('authenticated',
         routine_name || '(' || pg_get_function_identity_arguments((routine_schema || '.' || routine_name)::regproc) || ')',
         'EXECUTE') AS auth_can_execute
FROM information_schema.routines
WHERE routine_name IN ('partner_full_cancel', 'partner_partial_cancel_item', 'admin_full_cancel', 'admin_partial_cancel_item', 'admin_set_cancel_compensation');
-- 기대: 5 row / 모두 true

-- C. 시뮬레이션 — 테스트 task 측 (BEGIN/ROLLBACK)
BEGIN;
  -- partner 시뮬: usol_n 측 임의 task 1건 측
  -- (RPC 직접 호출은 service_role 측 권한 가드가 작동 안 함 — anon/authenticated 측 PWA 측 검증 권장)
  -- 그래서 본 시뮬은 직접 UPDATE 측 task_items.is_canceled=true 시도 + 070 트리거 효과 확인.
ROLLBACK;
```

### 회귀 검증
- 기존 어댑터 (`requestCancelAdapter` / `approveCancelAdapter` / `rejectCancelAdapter`) 동작 무변경.
- task_items.is_canceled 본 RPC 외 경로(EngineerTaskDetailScreen partial onConfirm)에서 UPDATE — 그대로 작동.
- 070/071/072 동작 무변경.

### 롤백
```sql
BEGIN;
DROP FUNCTION IF EXISTS partner_full_cancel(uuid, text);
DROP FUNCTION IF EXISTS partner_partial_cancel_item(uuid, text);
DROP FUNCTION IF EXISTS admin_full_cancel(uuid, text);
DROP FUNCTION IF EXISTS admin_partial_cancel_item(uuid, text);
COMMIT;
```
UI 코드 롤백은 `git revert` 또는 별도 commit.

---

## 6. 수고비 모델 (★ 신규 — 단순화)

### 개념
취소된 task의 배정기사에게 운영자가 별도 수고비 지정. 사장님 spec — **2가지 옵션만**:

| kind | 의미 | 금액 |
|---|---|---|
| `visit_fee` | 출장비만 — 방문 인정 | `COALESCE(task.travel_fee, 30000)` |
| `none` | 없음 — 수고비 0 | 0 |

기본값 = **`none`**. 모든 취소 RPC가 자동으로 `kind='none'` / `amount=0` 세팅.

### 흐름 (단순)
| 호출자 | 취소 시점 | 사후 컨트롤 |
|---|---|---|
| 원청 (PrincipalApp) | 즉시 — kind='none' 자동 | 원청은 컨트롤 권한·정보 없음 |
| 운영자 (AdminApp) | 즉시 — kind='none' 자동 | 작업상세 컨트롤에서 visit_fee/none 토글 가능 |

**미정(NULL) 상태 없음**. **'⚠️ 미정 배너' 없음**. **다이얼로그에서 kind 선택 없음** — 다이얼로그는 사유만 입력. 운영자는 작업상세에서 조용한 컨트롤(라디오 버튼 또는 토글)로 수고비 조정.

### 설계 — 자동 0과 충돌 회피

**핵심 문제**: 070 트리거가 task_items.is_canceled=true → tasks.product_price=0 → compute_payment_trg → compute_payment v15가 payments.engineer_amount=0. 이후 운영자가 visit_fee로 토글해도, 어딘가에서 다시 트리거가 발화되면 0으로 덮어쓰일 위험.

**해결**: `tasks`에 수고비 컬럼 2개 추가 + `compute_payment` v16 분기

```
tasks.cancel_engineer_comp_kind   text NULL  CHECK (kind IS NULL OR kind IN ('visit_fee','none'))
tasks.cancel_engineer_comp_amount int  NULL
```

**compute_payment v16 분기 (071 v15 본체 + 한 블록 추가)**:
```sql
-- (마지막 INSERT 직전)
IF v_task.status = '취소' AND v_task.cancel_engineer_comp_kind IS NOT NULL THEN
  v_total_engineer  := COALESCE(v_task.cancel_engineer_comp_amount, 0);
  v_total_principal := 0;
  v_total_owner     := 0 - v_total_engineer;  -- 회사가 기사에게 줄 돈
END IF;
```

→ compute_payment가 어디서 발화돼도 status='취소' + kind 지정 시 일관 결과.

### is_balanced + owner_amount 음수 해석

`payments.is_balanced` GENERATED 식: `engineer + principal + owner = product + extra + travel`
- 취소 task: product=0 (070), extra=0, travel=0
- visit_fee 시: engineer = amount, principal = 0, owner = -amount → 합 0 = 0 ✅ is_balanced=true 유지
- none 시: engineer = 0, principal = 0, owner = 0 ✅

**owner_amount 음수 = 회사가 기사에게 줄 돈** (visit_fee 시). AdminApp 작업상세 측 "기사 수고비 ₩X · 출장비만" 명시.

### RPC 추가 — 5번째

`admin_set_cancel_compensation(p_task_id uuid, p_kind text)`
- 권한: owner/operator
- 입력 검증: `p_kind IN ('visit_fee', 'none')`
- 동작:
  - task 조회 — `status='취소'` 확인
  - kind에 따라 amount 결정:
    - `visit_fee`: COALESCE(task.travel_fee, 30000)
    - `none`: 0
  - `tasks.cancel_engineer_comp_kind = kind, cancel_engineer_comp_amount = amount`
  - `compute_payment(p_task_id)` 명시 호출 → v16이 status='취소' + kind 분기로 engineer_amount 반영
- 출력: `{ ok, engineer_amount, kind }`

### 원본 금액 보존
- task_items: 070 metadata `_pre_cancel_paid` / `_pre_cancel_net` 자동 (Round 1, 부분취소 복원용 — 그대로 유지)
- tasks: 별도 백업 없음 (전액 옵션 삭제로 불필요)

### 와이어프레임 — 운영자 작업상세 (취소 task) 조용한 컨트롤
```
┌────────────────────────────────────────┐
│ ... (작업 정보 / 정산 / 메모 등)        │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │ 기사 수고비 (취소 작업)            │  │
│ │ 배정: 김동효 프로                  │  │
│ │                                  │  │
│ │ ◯ 출장비만 (₩30,000)              │  │
│ │ ● 없음 (₩0)                      │  │
│ └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```
- 배정기사 없으면 컨트롤 자체 hide 또는 비활성 + "배정기사 없음" 표시
- 라디오 변경 즉시 `admin_set_cancel_compensation` 호출

### 와이어프레임 — 취소 다이얼로그 (원청·운영자 공통)
```
┌────────────────────────────────────────┐
│ 작업 전체 취소                          │
│                                        │
│ 정말 취소하시겠습니까?                  │
│                                        │
│ [⚠️ 완료된 작업 경고]                   │  ← wasCompleted 시만
│ 이 작업은 이미 완료 상태입니다.          │
│ 취소 시 정산 0원으로 처리됩니다.        │
│ (기사 수고비는 작업상세에서 별도 조정)   │
│                                        │
│ 사유 (필수)                            │
│ ┌───────────────────────┐              │
│ └───────────────────────┘              │
│                                        │
│ [닫기]   [✓ 취소 처리]                 │
└────────────────────────────────────────┘
```

---

## 결정 포인트 — 사장님 사전 확정 사항 정리

| 항목 | 결정 |
|---|---|
| 운영자 승인 단계 | **제거** — 원청 즉시 취소 |
| 정산 처리 | **옵션 B 자동** — task_items 전부 is_canceled=true → 070 트리거가 payments 0 |
| 취소 가능 상태 | **전 상태** (완료·visit_only 포함) |
| 완료 건 경고 | 다이얼로그에 명시 + category_data.wasCompleted 플래그 |
| 원본 금액 보존 | 070 metadata `_pre_cancel_paid` / `_pre_cancel_net` 자동 — 운영자 사후 확인용 |
| 기사 흐름 | 현행 유지 (Round 1 (a) 정정 후) |

---

## 미해결 / 후속 검토

1. **취소 거절·복구 흐름**: 본 RPC는 즉시 취소 → 거절 개념 없음. 만약 실수로 취소 시 운영자가 수동으로 status 복원 가능? 별도 `admin_uncancel(task_id, reason)` RPC 필요 시 Round 3.
2. **알림(push)**: 원청이 취소 시 기사·운영자에게 알림? `notify_lifecycle_push_trg`(Mig 015) 측 status='취소' 트리거 동작 점검 후 추가 spec 필요 시.
3. **부분취소 배치 RPC**: 현 spec은 item별 순차 호출. 다건 한 트랜잭션 RPC (`partner_partial_cancel_items(p_task_id, p_item_ids[], p_reason)`) 도 가능 — UX 토스트 일관성·롤백 단위 측 유리.
4. **AdminApp 기존 cancelTask 콜백**: 현재 `approveCancelAdapter` 또는 직접 status UPDATE 추정 — Round 2 진입 시 본 RPC로 일원화 검토.

---

검토 후 코드·마이그 구현으로 진입.
