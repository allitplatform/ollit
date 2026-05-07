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
// V14 Week 2 2B-3 — 기사 / 추천 / 배정 API
// =====================================

// 시트 설정_기사 V2 read (5+ 열) — 모든 기사 catch
export async function getEngineers() {
  return apiCall('getEngineers', {});
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
