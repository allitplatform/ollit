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

export async function getTasks(role, userId, principalCode) {
  return apiCall('getTasks', { role, userId, principalCode });
}

export async function getTaskDetail(taskId) {
  return apiCall('getTaskDetail', { taskId });
}

export async function createTask(taskData) {
  return apiCall('createTask', { task: taskData });
}

export async function updateTaskStatus(taskId, status, updates = {}) {
  return apiCall('updateTaskStatus', { taskId, status, updates });
}

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
// V14 Step 5-5 — 설정_기사역량 read 캐시 (5-5-A)
// =====================================
// 시트 5열: A 기사ID / B 원청 / C 작업유형 / D 지역 (콤마/"전국") / E 등급
export async function getEngineerSkills() {
  return apiCall('getEngineerSkills', {});
}

// V14 Step 5-5-C Phase 2 — 설정_기사역량 양방향 sync
// payload: { engineerId, principal, workType, zones (콤마 string), grade, note? }
// upsert 키 (3중): engineerId + principal + workType
// 응답: { ok, action: 'create'|'update', engineerId, principal, workType }
export async function saveEngineerSkill(payload) {
  return apiCall('saveEngineerSkill', payload);
}

// 시트 행 삭제
// payload: { engineerId, principal, workType }
export async function deleteEngineerSkill(payload) {
  return apiCall('deleteEngineerSkill', payload);
}

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

// V14 속도 박기 — 추천 기사 cache (5분 TTL / in-memory Map)
const _recommendCache = new Map();
const _CACHE_TTL_MS = 5 * 60 * 1000; // 5분

function _getCached(key) {
  const entry = _recommendCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > _CACHE_TTL_MS) {
    _recommendCache.delete(key);
    return null;
  }
  return entry.value;
}

function _setCached(key, value) {
  _recommendCache.set(key, { ts: Date.now(), value });
}

// 배정 박힌 후 cache 박지 X (다음 호출 시 새로 catch / 배정 박힌 기사 빼기)
export function invalidateRecommendCache() {
  _recommendCache.clear();
}

// 추천 기사 (지역 + 작업유형 + 원청 매칭 / 시트 calc)
// workType: '세척' / '냉매충전' / 등
// principal: '올데이케어' / '에어컨프로 (KA)' / 등
// region: '강남구' / '서초구' / 등
// V14 속도 박기 — 5분 cache (같은 지역/원청 호출 시 즉시 박힘)
export async function getRecommendedEngineers(workType, principal, region) {
  const key = `${workType}|${principal}|${region}`;
  const cached = _getCached(key);
  if (cached) {
    console.log('[V14 cache] hit:', key);
    return cached;
  }
  console.log('[V14 cache] miss:', key);
  const result = await apiCall('getRecommendedEngineers', { workType, principal, region });
  if (result && result.ok !== false) {
    _setCached(key, result);
  }
  return result;
}

// 기사 배정 (시트 Q 배정기사 + R 상태=확정 박힘)
export async function assignEngineer(taskId, engineerName) {
  return apiCall('assignEngineer', { taskId, engineerName });
}

// 2026-05-11 7단계 — 기사 측 수락 (흐름 B / 냉매 자동 추천)
// GAS 측 acceptOffer: P열 추천기사 catch → 본인 박혀있고 Q열 빈 값이면 Q열 박음 + status="배정" + 다른 추천 측 P열 정리
// 응답: { ok: true, taskId } | { ok: false, error: "이미 다른 기사가 수락" 등 }
export async function acceptOffer(taskId, engineerName) {
  if (!taskId || !engineerName) {
    return { ok: false, error: 'taskId / engineerName 박지 X' };
  }
  return apiCall('acceptOffer', { taskId, engineerName });
}

// 작업 다양한 컬럼 update (상태 변경 / 일정 변경 / 메모 / 등)
// updates = { status, scheduledDate, scheduledTime, memo, ... }
export async function updateTask(taskId, updates) {
  return apiCall('updateTask', { taskId, ...updates });
}

// =====================================
// V14 큰 흐름 — 취소 / 변경 / 작업 (7 API)
// =====================================

// === 취소 흐름 (3) ===
// 기사 → 취소 요청 (시트 R='취소요청' / 메모 박힘)
export async function requestCancel(taskId, reason) {
  return apiCall('requestCancel', { taskId, reason });
}
// 운영자 → 취소 확인 (시트 R='취소' / 취소DB 이동)
export async function approveCancel(taskId, reason) {
  return apiCall('approveCancel', { taskId, reason });
}
// 운영자 → 취소 거절 (시트 R 옛 상태 복구 / 거절 사유 박힘)
export async function rejectCancel(taskId, rejectReason) {
  return apiCall('rejectCancel', { taskId, rejectReason });
}

// === 변경 흐름 (2 / changeSchedule = 옛 updateTask catch) ===
// 기사 → 금액 변경 (V열 견적합계 + AC열 추가금 + AD열 추가사유)
export async function changePrice(taskId, newPrice, addAmount, reason) {
  return apiCall('changePrice', { taskId, newPrice, addAmount, reason });
}
// 운영자 → 작업 종류 변경 (작업요약 + 총수량 + 견적합계)
export async function changeWorkType(taskId, newWorkType, newAppliance, newQty, newPrice) {
  return apiCall('changeWorkType', { taskId, newWorkType, newAppliance, newQty, newPrice });
}

// === 작업 흐름 (2) ===
// 기사 → 작업 시작 (시트 W열 + R='작업중')
export async function startTask(taskId) {
  return apiCall('startTask', { taskId });
}
// 기사 → 작업 완료 + 사진 업로드 (시트 Y + AB / Drive 폴더 박힘)
// photoBase64Array: ['data:image/jpeg;base64,...', ...] 1~3장
export async function completeTask(taskId, photoBase64Array) {
  return apiCall('completeTask', { taskId, photos: photoBase64Array });
}

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
