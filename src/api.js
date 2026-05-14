// 올잇 API 헬퍼 v4 - 휴무 API 추가
// 2026-05-10 — apiCall 타임아웃 60초 (createTask GAS 측 push 발송 sync 영역 catch)
// 옛 25초는 createTask 응답 지연 (30~40초) 시 timeout → 사용자 재클릭 → 2건 박힘
const API_URL = 'https://script.google.com/macros/s/AKfycbxow-YEIiKCIf5nuEG1s0qb2N3JgXrpzDZnV03Dt57yIvXtC05jpq3XF2HVBjemI1Gl/exec';
const API_TIMEOUT_MS = 60000;

async function apiCall(action, params = {}) {
  if (!API_URL) {
    return { ok: false, error: 'API URL이 설정되지 않았어요.' };
  }

  const url = new URL(API_URL);
  url.searchParams.append('action', action);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
      url.searchParams.append(k, value);
    }
  });

  // AbortController로 타임아웃 처리
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text || text.length === 0) return { ok: false, error: '서버 응답이 비어있습니다.' };
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.error('JSON 파싱 실패. 응답:', text.substring(0, 200));
      return { ok: false, error: '서버 응답이 JSON이 아닙니다.', rawResponse: text.substring(0, 200) };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('API 타임아웃:', action);
      return { ok: false, error: '서버 응답 지연 (60초 초과). 시트에 이미 등록되었을 수 있으니 새로고침 후 확인해주세요.', timeout: true };
    }
    console.error('API error:', err);
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

// =====================================
// 기존 API
// =====================================

export async function ping() {
  return apiCall('ping');
}

export async function getSystemInfo() {
  return apiCall('systemInfo');
}

// =====================================
// 로그인 / 비밀번호 변경
// Phase 3-2 (2026-05-13) — 시트 로그인 함수 폐기.
//   - login / loginV14 / changePasswordV14 삭제됨 (호출처 0건 확인 후 정리).
//   - 대체: src/lib/auth.js
//     · signInWithPhone(phone, password) — sign_in_with_phone RPC
//     · changePassword(userId, oldPassword, newPassword) — change_password RPC
//   - 실 사용 화면: src/components/LoginScreen.jsx, src/components/PasswordChangeScreen.jsx
// =====================================

// =====================================
// 작업 조회 (Phase 4-1)
// =====================================
// Phase 4-1 (2026-05-14) — 시트 작업 조회 호출 폐기.
//   - getTasks / getTaskDetail 삭제됨.
//   - 대체: src/data/tasksDb.js
//     · loadTasksForRole(role, userId, principalCode) — 시그니처 호환 어댑터
//       · 응답 { ok: true, tasks: [...] } / role별 필터링은 호출처 활용
//       · principals + users in-memory join (principal name / engineer name 박음)
//     · getTaskDetailForId(taskId) — getTaskByIdDb 래퍼
//   - 호출처: AdminApp / EngineerApp / HappycallApp / PrincipalApp 4곳
//   - DB 측 tenants_tasks 정책 활용 (anon SELECT 박힘)
// =====================================

// =====================================
// 작업 생성 + 수정 (Phase 4-2)
// =====================================
// Phase 4-2 (2026-05-14) — 시트 작업 생성/수정 호출 폐기.
//   - createTask / updateTask / updateTaskStatus 삭제됨.
//   - 대체: src/data/tasksDb.js
//     · createTaskAdapter(taskData) — principal name → id 변환 + 작업번호 자동
//       · 응답 { ok: true, taskId, task_no, task }
//     · updateTaskAdapter(taskId, updates) — 한국어/camelCase 키 호환
//     · updateTaskStatusAdapter(taskId, status, updates) — startedAt/completedAt 별도 처리
//   - 작업번호 생성: src/lib/taskNoGenerator.js
//     · generateTaskNo({ principalCode | principalName })
//     · 패턴: {prefix}{YYMMDD}-{seq} (예: A-260514-001)
//     · prefix는 DB principals.prefix lookup
// =====================================

export async function parseKakao(text) {
  return apiCall('parseKakao', { text });
}

// =====================================
// V14 Week 1 1E — 정책 catch + 동적 계산 API
// Phase 3-1 (2026-05-13) — 시트 정책 호출 폐기.
//   - getPolicy / calculateFee / getAllPolicies 삭제됨.
//   - 대체: src/lib/commissionPoliciesDb.js
//     · listCommissionPolicies / calculateCommissionRpc (DB RPC 직접 호출)
//     · calculateFeeCompat / listPoliciesSheetShape (옛 형태 호환 어댑터)
// =====================================

// =====================================
// 설정_원청
// Phase 3-3 (2026-05-13) — 시트 원청 호출 폐기.
//   - getPrincipals / savePrincipal / deletePrincipal 삭제됨.
//   - 대체: src/lib/principalsDb.js
//     · listPrincipalsFromDb / upsertPrincipalToDb / deletePrincipalFromDb
//   - DB 컬럼 확장: db/migrations/010_principals_extra_columns.sql
//     (prefix / color / bank_name / account_number / account_holder)
// =====================================

// =====================================
// 기사 단가
// Phase 3-8 (2026-05-13) — 시트 기사단가 호출 폐기.
//   - getEngineerRates / saveEngineerRate / deleteEngineerRate 삭제됨.
//   - 대체: src/lib/engineerRatesDb.js
//     · listEngineerRatesFromDb() — engineer_rates 전체 조회 (users JOIN으로 code 포함)
//     · upsertEngineerRateToDb(payload) — 3중 키 (user_id, work_type, appliance_code) upsert
//     · deleteEngineerRateFromDb(payload) — 3중 키 hard DELETE
//   - 저장소: engineer_rates 테이블 (db/migrations/012_engineer_rates.sql)
//   - 매핑: PWA engineerId("E001") → users.code → users.id (UUID FK)
//   - RLS: tenant 격리 + anon 4개 정책 (SELECT/INSERT/UPDATE/DELETE)
//   - data/engineers.js 측 saveEngineerRateWithSync / deleteEngineerRateWithSync 내부만 교체
//   - AdminApp.jsx 측 fetchEngineerRates 내부 한 줄 교체
//     (시그니처 / 응답 형태 동일 — EngineerEditScreen 변경 0)
// =====================================

// =====================================
// 기사 역량
// Phase 3-9 (2026-05-13) — 시트 기사역량 호출 폐기.
//   - getEngineerSkills / saveEngineerSkill / deleteEngineerSkill 삭제됨.
//   - 대체: src/lib/engineerSkillsDb.js
//     · listEngineerSkillsFromDb() — epp + ez JOIN → 시트 호환 shape (users.code 포함)
//     · upsertEngineerSkillToDb(payload) — epp 3중 키 upsert + ez user_id 단위 전체 교체
//     · deleteEngineerSkillFromDb(payload) — epp 3중 키 hard DELETE (ez는 보존)
//   - 저장소: engineer_principal_permissions (36행) + engineer_zones (70행)
//   - 매핑:
//     · PWA engineerId("E001") → users.code → users.id (UUID FK)
//     · PWA principal "(전체)"/"전체"/"" ↔ DB principal_code NULL
//     · PWA workType "세척"/"냉매충전" ↔ DB service_code "cleaning"/"refrigerant"
//     · PWA grade "메인"/"백업" ↔ DB level "main"/"sub"
//     · PWA grade "안 함" → 호출처에서 deleteEngineerSkillWithSync로 분기
//     · PWA zones 콤마 string ↔ DB engineer_zones 분리 행 (user 단위 단일 세트)
//     · PWA appliances → DB 컬럼 없음 (localStorage만 유지)
//   - RLS: epp / ez 모두 anon SELECT/INSERT/UPDATE/DELETE 정책 박혀있음 (사전 확인 완료)
//   - data/engineers.js 측 saveEngineerSkillWithSync / deleteEngineerSkillWithSync 내부만 교체
//   - AdminApp.jsx 측 fetchEngineerSkills 내부 한 줄 교체
//     (시그니처 / 응답 형태 동일 — EngineerEditScreen 변경 0)
// =====================================

// =====================================
// 회사 계좌
// Phase 3-7 (2026-05-13) — 시트 회사 계좌 호출 폐기.
//   - getCompanyAccount / saveCompanyAccount 삭제됨.
//   - 대체: src/lib/companyAccountDb.js
//     · getCompanyAccountFromDb() — tenants.settings.company_account 조회
//     · saveCompanyAccountToDb(payload) — tenants.settings jsonb 부분 갱신
//   - 저장소: tenants.settings.company_account (jsonb / 단일 행)
//   - 마이그레이션 0개 (settings jsonb 컬럼 기존 활용) / 추가 RLS 0개 (tenants 기존 정책)
//   - data/companyAccount.js 측 fetchCompanyAccount / saveCompanyAccountWithSync 내부만 교체
//     (시그니처 / 응답 형태 동일 — CompanyAccountScreen / EngineerSettleTab 변경 0)
// =====================================

// =====================================
// 설정_사용자
// Phase 3-4 (2026-05-13) — 시트 사용자 호출 폐기.
//   - getUsers 삭제됨 (호출처 1건 → DB 측 교체 완료).
//   - 대체: src/lib/usersDb.js
//     · listUsersFromDb() — users + user_roles JOIN, 시트 호환 shape 반환
//   - 다중 역할 처리: 우선순위 단일 role + roles[] 배열
//   - 역할 이름 매핑: operator → happycall / partner → principal
// =====================================

// =====================================
// 기사 마스터
// Phase 3-6 (2026-05-13) — 시트 기사 호출 폐기.
//   - getEngineers / saveEngineer / deleteEngineer 삭제됨.
//   - 대체: src/lib/engineersDb.js
//     · listEngineersFromDb() — users + user_roles(engineer) JOIN
//     · upsertEngineerToDb(eng) — code 기준 upsert + 신규 시 engineer 역할 자동 부여
//     · deleteEngineerFromDb(code) — hard DELETE (user_roles 측 CASCADE)
//   - data/engineers.js 측 saveEngineerWithSync / deleteEngineerWithSync 내부만 교체
//     (시그니처 / 응답 형태 동일 — 10곳 호출처 변경 X)
//   - DB 필드: code / name / phone / email / is_active / refrigerant_rate /
//             bank_name / bank_account / account_holder / region
//   - PWA 전용 (localStorage 유지): workTypes / zones / appliances / careerLevel / note
// =====================================

// =====================================
// 추천 / 배정 API
// =====================================
// Phase 3-10 (2026-05-14) — 시트 추천 호출 폐기.
//   - getRecommendedEngineers 함수 + 5분 TTL in-memory 캐시 (Map / _getCached / _setCached) 모두 삭제됨.
//   - 대체: src/utils/engineerRecommendation.js
//     · recommendEngineers(task, options) — V11-10 PWA 클라이언트 추천 (점수 100, threshold 50, tier 4단계)
//     · recommendEngineersGroupedAdapter(workType, principal, region) — 옛 GAS 시그니처 호환 어댑터
//       (regionMatch별 main/sub/capable 분류 + engineer 객체 평탄화)
//   - 입력 데이터: Phase 3-3~3-9 DB 데이터 종합 활용 (users / engineer.skills / tasks / regions)
//   - 캐시 제거 근거: loadEngineers/loadTasks가 이미 빠름 (localStorage/DB 캐시) → 5분 TTL 무의미
//   - invalidateRecommendCache 함수는 호출처 (AdminApp.jsx 2곳) 보존을 위해 no-op 유지
// =====================================

// Phase 3-10 — no-op 유지 (호출처 변경 0). 캐시 자체는 폐기됨.
export function invalidateRecommendCache() {
  // 추천 캐시 폐기됨 (Phase 3-10). 호출처 시그니처 보존용 no-op.
}

// =====================================
// 배정 흐름 (Phase 4-4)
// =====================================
// Phase 4-4 (2026-05-14) — 시트 배정 호출 폐기.
//   - assignEngineer / acceptOffer 삭제됨.
//   - 대체: src/data/tasksDb.js
//     · assignEngineerAdapter(taskId, engineerName, options)
//       - 이름/code → users.id (UUID) 변환 후 assignEngineerDb 호출
//       - status 기본값 '배정' (Phase 3-9 분리 운영 일관)
//     · acceptOfferAdapter(taskId, engineerName)
//       - assigned_engineer_id IS NULL 조건부 UPDATE
//       - race condition catch: "이미 다른 기사가 수락" 에러 분리
//     · _getUsersCache / _resolveUserIdByName 헬퍼 (Phase 4-2 _getPrincipalsCache 패턴)

// Phase 4-2 — updateTask 시트 호출 폐기. updateTaskAdapter 사용 (tasksDb.js).

// =====================================
// V14 큰 흐름 — 취소 / 변경 / 작업 (7 API)
// =====================================

// === 취소 흐름 (Phase 4-3) ===
// Phase 4-3 (2026-05-14) — 시트 취소 호출 폐기.
//   - requestCancel / approveCancel / rejectCancel 삭제됨.
//   - 대체: src/data/tasksDb.js
//     · requestCancelAdapter(taskId, reason) — status='취소요청' + previousStatus 저장
//     · approveCancelAdapter(taskId, reason) — status='취소' + cancelApproveReason 저장
//     · rejectCancelAdapter(taskId, rejectReason) — previousStatus 복원 + cancelRejectReason 저장
//       · 응답에 oldStatus 박음 (호출처 Optimistic Update 활용)
//   - DB enum '취소요청' 추가 (대표님 SQL 실행 완료)
//   - 취소 사유: category_data jsonb 활용 (마이그 0개)
//     · cancelReason / previousStatus / cancelRequestedAt
//     · cancelApproveReason / cancelApprovedAt
//     · cancelRejectReason  / cancelRejectedAt

// === 작업 시작 / 완료 / 금액 변경 (Phase 4-5) ===
// Phase 4-5 (2026-05-14) — 시트 작업 흐름 호출 폐기.
//   - startTask / completeTask / changePrice 삭제됨.
//   - changeWorkType 삭제됨 (호출처 0건 — dead code).
//   - 대체:
//     · src/data/tasksDb.js
//       - startTaskAdapter(taskId) — status='진행중' + startedAt
//       - completeTaskAdapter(taskId) — status='완료' + completedAt
//       - changePriceAdapter(taskId, newPrice, addAmount, reason)
//         → productPrice / extraFee / extraReason 박음
//     · src/lib/photosDb.js
//       - uploadPhoto(taskId, file, step, uploadedBy) — Storage 업로드 + photos row
//       - listPhotosByTask(taskId) — public URL 박은 후 응답
//       - deletePhoto(photoId) — Storage + photos row 삭제
//   - Storage 버킷: task-photos (공개) + RLS anon 정책 (대표님 SQL 실행 완료)
//   - photos 테이블 RLS anon 정책 (대표님 SQL 실행 완료)

// =====================================
// 휴무
// Phase 3-5 (2026-05-13) — 시트 휴무 호출 폐기.
//   - getOffDays / getOffDaysByDate / addOffDay / deleteOffDay 삭제됨.
//     · getOffDaysByDate 호출처 0건 → 신규 모듈에 만들지 않음.
//   - 대체: src/lib/offDaysDb.js
//     · getOffDays(engineer) / addOffDay({...}) / deleteOffDay(offId)
//   - DB user_off_days 테이블 직접 사용
//   - engineerName → user_id 매핑은 모듈 내부 Map 캐시
// =====================================
