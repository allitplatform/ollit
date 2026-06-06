// 2026-06-06 — 역할 매핑 + 전환 헬퍼.
//   LoginScreen + App.jsx 가 함께 쓰는 공용 모듈.
//   로그인 시 RPC 응답 → buildAppUser → currentUser. 전환 시 currentUser.role swap.

// DB role → app role (App.jsx renderScreen switch 측 사용)
export const DB_TO_APP_ROLE = {
  owner:    "admin",
  admin:    "admin",
  engineer: "engineer",
  operator: "happycall",
  partner:  "principal",
};

// RPC 응답 user → 정규화된 app user (역할 1개 활성).
//   roles[] 전체는 ...rpcUser spread 측 보존 — 전환 시 사용.
export function buildAppUser(rpcUser, dbRole) {
  const appRole = DB_TO_APP_ROLE[dbRole] || dbRole;
  return {
    ...rpcUser,
    userId: rpcUser.code || rpcUser.user_id,
    role:   appRole,
    dbRole,
    name:   rpcUser.name,
    phone:  rpcUser.phone,
    engineerId: rpcUser.code && String(rpcUser.code).startsWith("E") ? rpcUser.code : undefined,
    principals: Array.isArray(rpcUser.principals) ? rpcUser.principals : [],
  };
}

// 같은 user 측 dbRole 만 swap (전환 핸들러용).
//   roles[] / user_id / principals 등은 그대로 유지.
export function switchActiveRole(user, newDbRole) {
  if (!user) return user;
  const appRole = DB_TO_APP_ROLE[newDbRole] || newDbRole;
  return { ...user, role: appRole, dbRole: newDbRole };
}

// engineer + admin 둘 다 가진 user 만 토글 노출 (★ 조동욱 E022 / 구현서 E002).
//   partner / 단일 role / operator+engineer 같은 다른 조합은 false.
export function canSwitchEngineerAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.includes("engineer") && roles.includes("admin");
}
