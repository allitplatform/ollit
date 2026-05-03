// Step 9 — 사용자 / 권한 매트릭스
// 5역할 (대표 / 관리자 / 해피콜 / 기사 / 원청) + 권한 체크

const STORAGE_KEY = "ollit_users_v1";

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
  "menu.users":         ["owner"],
  "menu.notifications": ["owner", "admin"],
  "menu.backup":        ["owner"],
  // 액션
  "task.assign":        ["owner", "admin"],
  "task.cancel":        ["owner", "admin", "happycall"],
  "task.complete":      ["owner", "admin", "engineer"],
  "task.edit_price":    ["owner", "admin"],
};

export function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error(e); }
  saveUsers(SEED_USERS);
  return SEED_USERS;
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
