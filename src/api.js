// 올잇 API 헬퍼 v4 - 휴무 API 추가
const API_URL = 'https://script.google.com/macros/s/AKfycbxow-YEIiKCIf5nuEG1s0qb2N3JgXrpzDZnV03Dt57yIvXtC05jpq3XF2HVBjemI1Gl/exec';

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
  
  try {
    const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    const text = await response.text();
    if (!text || text.length === 0) return { ok: false, error: '서버 응답이 비어있습니다.' };
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.error('JSON 파싱 실패. 응답:', text.substring(0, 200));
      return { ok: false, error: '서버 응답이 JSON이 아닙니다.', rawResponse: text.substring(0, 200) };
    }
  } catch (err) {
    console.error('API error:', err);
    return { ok: false, error: err.message };
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

export async function login(userId, password) {
  return apiCall('login', { userId, password });
}

// V14 Phase 4-C — 폰번호 + 4자리 비번 로그인 (시트 사용자 시트 read)
// 입력: phone (11자리 숫자, 하이픈 박지 X) + password (4자리 숫자 / 또는 변경 박은 긴 비번)
// 응답: { ok, users: [{ userId, name, role, phone, passwordChanged, ... }, ...], error }
//   - users.length === 1 → 바로 로그인
//   - users.length > 1  → 역할 선택 모달 (Fix 3 박을 차례 / 다음 step)
//   - users.length === 0 또는 ok=false → 에러
export async function loginV14(phone, password) {
  return apiCall('loginV14', { phone, password });
}

// V14 Phase 4-E-1 — 강제 비밀번호 변경 (첫 로그인)
// 입력: userId / oldPw (현재 비번 = F열 일치 검사용) / newPw (4~16자)
// 응답: { ok, error }
//   - ok=true → F열 갱신 + G열(비번변경여부) true 갱신
//   - ok=false → 옛 비번 불일치 / 길이 위반 / userId 미존재 등
export async function changePasswordV14(userId, oldPw, newPw) {
  return apiCall('changePasswordV14', { userId, oldPw, newPw });
}

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
// =====================================

// 시트 수수료정책 read (V6 CLEAN 8열) → 정책 텍스트 + parsed
// principal: '올데이케어' / '에어컨프로 (KA)' / '쿨가이 (KB)' / '용인컴퍼니' / '유솔홈케어 H' / '유솔홈케어 N' / '크리크린'
// workType: '세척' / '냉매충전' / '출장비' / '추가선택(YS-N)' / '냉매점검(YS-N)'
// appliance: '벽걸이' / '1way' / '스탠드' / '4way' / '원형' / '투인원' / '시스템멀티' / '(공통)' / '송풍팬분해' / '실외기' / '피톤치드' / '기본' / '추가발생' / '출장비'
export async function getPolicy(principal, workType, appliance) {
  return apiCall('getPolicy', { principal, workType, appliance });
}

// 견적 × 정책 = 분배 (관리자만 catch / 기사 X)
// 반환: { fee: { principalFee, engineerAmount, companyProfit }, policy, parsed }
export async function calculateFee(principal, workType, appliance, quote) {
  return apiCall('calculateFee', { principal, workType, appliance, quote });
}

// 모든 정책 (Admin / Happycall 화면에서 한 번 catch)
export async function getAllPolicies() {
  return apiCall('getAllPolicies');
}

// =====================================
// V14 Step 5-3 — 설정_원청 양방향 sync (5-3-A)
// =====================================

// 시트 설정_원청 read (6열: 약자/id/회사명/구분/색/비고)
export async function getPrincipals() {
  return apiCall('getPrincipals', {});
}

// 시트 설정_원청 upsert (principalId 기준 update / 없으면 append)
// payload: { principalId, name, prefix, color, type, note }
// 응답: { ok, principalId, action: 'update'|'create' }
export async function savePrincipal(p) {
  return apiCall('savePrincipal', p);
}

// 시트 설정_원청 행 삭제
export async function deletePrincipal(principalId) {
  return apiCall('deletePrincipal', { principalId });
}

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
