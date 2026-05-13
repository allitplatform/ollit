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
// V14 Step 5-4 — 설정_기사단가 양방향 sync (P4 신규 모델)
// =====================================
// 시트 5열: A 기사ID / B 작업유형 / C 기종 / D 단가 / E 비고
// upsert 키 (3중): engineerId + workType + applianceType

// 시트 read — 모든 행 catch
export async function getEngineerRates() {
  return apiCall('getEngineerRates', {});
}

// 시트 행 upsert
// payload: { engineerId, workType, applianceType, rate, note }
// 응답: { ok, action: 'create'|'update', engineerId, workType, applianceType }
export async function saveEngineerRate(payload) {
  return apiCall('saveEngineerRate', payload);
}

// 시트 행 삭제
// payload: { engineerId, workType, applianceType }
export async function deleteEngineerRate(payload) {
  return apiCall('deleteEngineerRate', payload);
}

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
// V14 Step 5-8 — 회사 계좌 양방향 sync
// =====================================
// 시트 설정_회사 (key-value): 회사_계좌번호 / 회사_은행명 / 회사_예금주 / 회사_계좌_변경일
// 권한 (운영자/관리자만 변경) — GAS 측에서 검증

// 시트 read — 회사 계좌 1건 catch
// 응답: { ok, account: { bankName, accountNumber, accountHolder, changedAt } } 또는 직접 객체
export async function getCompanyAccount() {
  return apiCall('getCompanyAccount', {});
}

// 시트 회사 계좌 갱신 (단일 행 / 변경일 자동 박힘)
// payload: { bankName, accountNumber, accountHolder, changedAt? }
// 응답: { ok, action: 'update' }
export async function saveCompanyAccount(payload) {
  return apiCall('saveCompanyAccount', payload);
}

// =====================================
// V14 Step 5-7 — 설정_사용자 read 캐시 (F-2)
// =====================================
// 시트 ~40행: A001~A004 대표 / H001~H004 관리자 / E001~E029 기사 / P001~P003 원청
// 양방향 X — 시트 직접 편집 / 코드는 read만
// 비번 칼럼 GAS 측에서 skip (보안)
export async function getUsers() {
  return apiCall('getUsers', {});
}

// =====================================
// V14 Week 2 2B-3 — 기사 / 추천 / 배정 API
// =====================================

// 시트 설정_기사 V2 read (5+ 열) — 모든 기사 catch
export async function getEngineers() {
  return apiCall('getEngineers', {});
}

// Step 5-2 — 시트 설정_기사 upsert (engineerId 기준 update / 없으면 append)
// payload: { engineerId, name, phone, email, active(boolean), cm_refrigerant_rate(50/60/100) }
// 응답: { ok, engineerId, action: 'update'|'create' } (engineerId가 자동 부여 시 새 ID 반환)
export async function saveEngineer(eng) {
  return apiCall('saveEngineer', eng);
}

// Step 5-2 — 시트 설정_기사 행 삭제
export async function deleteEngineer(engineerId) {
  return apiCall('deleteEngineer', { engineerId });
}

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
// 휴무 API ⭐ NEW
// =====================================

// 한 기사의 모든 휴무 조회
export async function getOffDays(engineer) {
  return apiCall('getOffDays', { engineer });
}

// 특정 날짜의 모든 기사 휴무 (해피콜 추천 시)
export async function getOffDaysByDate(date) {
  return apiCall('getOffDaysByDate', { date });
}

// 휴무 추가
export async function addOffDay({ engineer, type, date, startTime, endTime, memo }) {
  return apiCall('addOffDay', { engineer, type, date, startTime, endTime, memo });
}

// 휴무 삭제
export async function deleteOffDay(offId) {
  return apiCall('deleteOffDay', { offId });
}
