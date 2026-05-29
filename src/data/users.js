// Step 9 — 사용자 / 권한 매트릭스
// 5역할 (대표 / 관리자 / 해피콜 / 기사 / 원청) + 권한 체크
// Step 5-7 — 시트 설정_사용자 read 캐시 (F-2 / 양방향 X / 시트 직접 편집)

const STORAGE_KEY        = "ollit_users_v1";
const USERS_CACHE_KEY    = "ollit_users_cache_v1";  // Step 5-7 시트 fetch 캐시

export const ROLES = {
  owner:     { name: "대표 / 운영자", color: "#FF1B8D", desc: "전체 권한" },
  admin:     { name: "관리자",        color: "#1A1512", desc: "배정 / 정산" },
  happycall: { name: "해피콜",        color: "#888780", desc: "접수 / 일정 조율" },
  engineer:  { name: "기사",          color: "#00875A", desc: "자기 작업만" },
  principal: { name: "원청",          color: "#FF1B8D", desc: "자기 원청 작업만" },
};

const SEED_USERS = [
  { id: "u_owner",      loginId: "lee.ceo",     name: "이대표",  role: "owner",     active: true },
  { id: "u_admin",      loginId: "park.admin",  name: "박관리",  role: "admin",     active: true },
  { id: "u_happycall1", loginId: "kim.jihye",   name: "김지혜",  role: "happycall", active: true },
  { id: "u_happycall2", loginId: "lee.minah",   name: "이미나",  role: "happycall", active: true },
  { id: "u_eng_main",   loginId: "kim.donghyo", name: "김동효",  role: "engineer",  active: true,
    engineerId: "kim_donghyo" },
  { id: "u_eng_temp",   loginId: "lee.jaehyun", name: "이재현",  role: "engineer",  active: true,
    engineerId: "lee_jaehyun" },
  { id: "u_prin_cool",  loginId: "kim.coolguy", name: "김쿨가이", role: "principal", active: true,
    principalId: "aircon_pro" },
];

// 권한 매트릭스
export const PERMISSIONS = {
  // 메뉴 / 화면 접근
  "menu.dashboard":     ["owner", "admin", "happycall"],
  "menu.new_order":     ["owner", "admin", "happycall"],
  "menu.in_progress":   ["owner", "admin", "happycall", "engineer", "principal"],
  "menu.settlement":    ["owner", "admin"],
  "menu.engineers":     ["owner", "admin"],
  "menu.principals":    ["owner", "admin"],
  "menu.rates":         ["owner"],
  "menu.regions":       ["owner", "admin"],
  "menu.users":         ["owner", "admin"],   // Step 5-7-A — admin 추가 (관리자 = 사용자 관리 가능)
  "menu.notifications": ["owner", "admin"],
  "menu.backup":        ["owner", "admin"],   // Step 5-7-A — admin 추가 (관리자 = 시트 백업 가능)
  "menu.company_account": ["owner", "admin"], // Step 5-8 F-4 — 회사 계좌 변경 (운영자/관리자만)
  // 액션
  "task.assign":        ["owner", "admin"],
  "task.cancel":        ["owner", "admin", "happycall"],
  "task.complete":      ["owner", "admin", "engineer"],
  "task.edit_price":    ["owner", "admin"],
};

// ============================================================
// Step 5-7 — 시트 설정_사용자 캐시 (read만)
// ============================================================
// AdminApp fetchUsers 호출 후 박힘. UserListScreen 등 자동 병합 결과 사용.
export function setUsersCache(list) {
  if (!Array.isArray(list)) return;
  try {
    localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(list));
  } catch (e) { /* */ }
}

export function getUsersCache() {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* */ }
  return [];
}

// 2026-05-29 — UUID → user 객체 lookup helper.
//   cancel 정보 표시 측 cancelActorName 결정용 (cancelActorUserId 가 auth.uid() UUID).
//   AdminApp fetchUsers (mount 1회) 가 listUsersFromDb → setUsersCache. DB row 는 id=UUID.
//   없으면 null. 화면 측 user?.name fallback 처리.
export function getUserById(userId) {
  if (!userId) return null;
  const list = getUsersCache();
  return list.find(u => u.id === userId) || null;
}

// 시트 행 → 코드 모델 (옛 SEED 형식)
// 시트 매핑: A 사용자ID / B 이름 / C 역할 / D 폰 / E 활성 (다양한 키 호환)
function _adaptSheetUserToSeed(sheetU) {
  if (!sheetU) return null;
  const id      = String(sheetU.userId || sheetU.사용자ID || sheetU.id || "").trim();
  const name    = String(sheetU.name || sheetU.이름 || "").trim();
  const role    = String(sheetU.role || sheetU.역할 || "").trim() || "engineer";
  const phone   = String(sheetU.phone || sheetU.폰번호 || sheetU.연락처 || "").trim();
  const loginId = String(sheetU.loginId || sheetU.로그인ID || phone || id).trim();
  const activeRaw = sheetU.active ?? sheetU.활성 ?? true;
  const active = activeRaw === false || String(activeRaw).toLowerCase() === "false" ? false : true;
  if (!id && !name) return null;
  // 역할 한글 → 영문 매핑 (시트가 한글이면)
  const roleMap = { "대표": "owner", "관리자": "admin", "해피콜": "happycall", "기사": "engineer", "원청": "principal" };
  const roleNormalized = roleMap[role] || role;
  return {
    id,
    loginId,
    name,
    role: roleNormalized,
    phone,
    active,
    engineerId:  sheetU.engineerId  || sheetU.기사ID || "",
    principalId: sheetU.principalId || sheetU.원청ID || "",
    _fromSheet: true,
  };
}

// loadUsers — 옛 SEED + 시트 캐시 자동 병합 (Step 5-1 패턴)
// 매칭: id 우선 / loginId fallback / 이름 fallback
// 옛 SEED 우선 (REGISTERED_USERS 시범 7계정 보존) — 시트는 시트 전용 행만 추가
export function loadUsers() {
  // 1) 옛 SEED localStorage
  let oldList = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) oldList = parsed;
    }
  } catch (e) { console.error(e); }
  if (oldList.length === 0) {
    saveUsers(SEED_USERS);
    oldList = SEED_USERS;
  }

  // 2) 시트 캐시
  const sheetList = getUsersCache();
  if (!sheetList || sheetList.length === 0) return oldList;  // 시트 데이터 없음 → 옛 동작 그대로

  // 3) 매칭 인덱스
  const oldById      = new Map();
  const oldByLoginId = new Map();
  const oldByName    = new Map();
  oldList.forEach(u => {
    if (u.id)      oldById.set(u.id, u);
    if (u.loginId) oldByLoginId.set(u.loginId, u);
    if (u.name)    oldByName.set(u.name, u);
  });

  // 4) 시트 기반 병합 — 옛 SEED 우선 (시범 7계정 보존)
  const merged = [];
  const usedOldIds = new Set();
  for (const s of sheetList) {
    const adapted = _adaptSheetUserToSeed(s);
    if (!adapted) continue;
    const oldMatch = oldById.get(adapted.id)
                  || oldByLoginId.get(adapted.loginId)
                  || oldByName.get(adapted.name);
    if (oldMatch) {
      // 옛 SEED 우선 (REGISTERED_USERS 호환 / 시범 7계정 보존)
      // 시트 우선: phone / active (사장님이 시트에서 갱신 가능한 필드)
      merged.push({
        ...adapted,
        ...oldMatch,
        phone:  adapted.phone  || oldMatch.phone,
        active: adapted.active !== undefined ? adapted.active : oldMatch.active,
        _fromSheet: false,
      });
      usedOldIds.add(oldMatch.id);
    } else {
      // 시트 신규 (옛 SEED에 없음 — 대부분 E001~E029 / A001 등)
      merged.push(adapted);
    }
  }

  // 5) 옛 SEED에만 있는 항목 (시트에 없는) 보존
  for (const o of oldList) {
    if (!usedOldIds.has(o.id)) merged.push({ ...o, _onlyOld: true });
  }

  return merged;
}

export function saveUsers(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) { console.error(e); return false; }
}

export function generateUserId(loginId) {
  const ts = Date.now().toString(36);
  const safe = (loginId || "user").replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 12);
  return `u_${safe}_${ts}`;
}

export function createEmptyUser() {
  return {
    id: "",
    loginId: "",
    name: "",
    role: "happycall",
    active: true,
    engineerId: "",
    principalId: "",
  };
}

// 현재 로그인한 사용자 — App.jsx의 currentUser와 매핑
// App에서 받은 user 객체 (REGISTERED_USERS 형식 = { userId, name, role, ... })를
// users.js의 ROLES 키와 매칭
export function getCurrentUser(appUser) {
  if (!appUser) return null;
  // App.jsx의 user.role 값은 영어 키 (engineer/happycall/admin/principal)
  // admin → owner로 매핑 (이대표 = 대표 / 운영자)
  // 다른 admin은 'admin' 역할 유지 (Phase 2)
  let role = appUser.role;
  if (role === "admin" && appUser.userId === "lee.ceo") role = "owner";
  return {
    ...appUser,
    role,
  };
}

// 권한 체크
export function hasPermission(user, permission) {
  if (!user) return false;
  const allowedRoles = PERMISSIONS[permission] || [];
  return allowedRoles.includes(user.role);
}

// 여러 권한 중 하나라도 있는지
export function hasAnyPermission(user, permissions) {
  return permissions.some(p => hasPermission(user, p));
}
