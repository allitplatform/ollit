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

// 추천 기사 (지역 + 작업유형 + 원청 매칭 / 시트 calc)
// workType: '세척' / '냉매충전' / 등
// principal: '올데이케어' / '에어컨프로 (KA)' / 등
// region: '강남구' / '서초구' / 등
export async function getRecommendedEngineers(workType, principal, region) {
  return apiCall('getRecommendedEngineers', { workType, principal, region });
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
