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
