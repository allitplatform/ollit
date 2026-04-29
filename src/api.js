// 올잇 API 헬퍼 v3 - URL 직접 박음 (.env 안 씀)
// 작동 우선!

const API_URL = 'https://script.google.com/macros/s/AKfycbxow-YEIiKCIf5nuEG1s0qb2N3JgXrpzDZnV03Dt57yIvXtC05jpq3XF2HVBjemI1Gl/exec';

// 공통 호출 함수 (모든 API GET)
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
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
    });
    
    const text = await response.text();
    
    if (!text || text.length === 0) {
      return { ok: false, error: '서버 응답이 비어있습니다.' };
    }
    
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

// 1. 핑
export async function ping() {
  return apiCall('ping');
}

// 2. 시스템 정보
export async function getSystemInfo() {
  return apiCall('systemInfo');
}

// 3. 로그인
export async function login(userId, password) {
  return apiCall('login', { userId, password });
}

// 4. 작업 목록
export async function getTasks(role, userId, principalCode) {
  return apiCall('getTasks', { role, userId, principalCode });
}

// 5. 작업 상세
export async function getTaskDetail(taskId) {
  return apiCall('getTaskDetail', { taskId });
}

// 6. 새 작업 등록
export async function createTask(taskData) {
  return apiCall('createTask', { task: taskData });
}

// 7. 작업 상태 업데이트
export async function updateTaskStatus(taskId, status, updates = {}) {
  return apiCall('updateTaskStatus', { taskId, status, updates });
}

// 8. 카톡 파싱
export async function parseKakao(text) {
  return apiCall('parseKakao', { text });
}
