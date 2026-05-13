// Phase 3-4 — 사용자 마스터 DB 접근 모듈
// Supabase `users` + `user_roles` JOIN → 시트 호환 shape 반환.
// 옛 시트 호출 (getUsers) 폐기 / 옛 SEED 7명은 loadUsers 측 그대로 병합 유지.
//
// 다중 역할 처리:
//   · DB 측 한 사용자가 여러 user_roles 행을 가질 수 있음 (예: E022 = admin + engineer).
//   · PWA UserListScreen 측 단일 `role` 필드 + 필터 박힘 →
//     우선순위 단일 role + 모든 역할 roles[] 배열 양쪽 제공.
//   · 우선순위 (앞 우선): owner > admin > happycall > principal > engineer
//
// 역할 이름 매핑 (DB CHECK ↔ PWA ROLES):
//   · operator → happycall
//   · partner  → principal
//   · 나머지 동일 (owner / admin / engineer)

import { supabase } from "./supabase.js";
import { PRINCIPAL_CODE_TO_ID } from "./commissionPoliciesDb.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// DB role → PWA role 매핑
const DB_ROLE_TO_PWA = {
  owner:    "owner",
  admin:    "admin",
  engineer: "engineer",
  operator: "happycall",
  partner:  "principal",
};

// 단일 표시 role 우선순위 (앞이 높음)
const ROLE_PRIORITY = ["owner", "admin", "happycall", "principal", "engineer"];

function pickPrimaryRole(pwaRoles) {
  for (const r of ROLE_PRIORITY) {
    if (pwaRoles.includes(r)) return r;
  }
  return pwaRoles[0] || "engineer";
}

// ============================================================
// 조회 (READ) — 시트 호환 shape 반환
// ============================================================

// 모든 사용자 + 역할 조회
// 응답: { ok: true, users: [...] } | { ok: false, error, users: [] }
// 각 user shape (loadUsers + _adaptSheetUserToSeed 호환):
//   { userId, id, loginId, name, phone, role, roles, active, engineerId, principalId, _fromSheet }
export async function listUsersFromDb() {
  // [1] users 조회
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, code, name, phone, email, is_active")
    .eq("tenant_id", TENANT_ID)
    .order("code", { ascending: true });

  if (uErr) {
    console.error("[usersDb.list:users]", uErr);
    return { ok: false, error: uErr.message, users: [] };
  }
  if (!users || users.length === 0) {
    return { ok: true, users: [] };
  }

  // [2] user_roles + principals.code (nested select / FK 관계)
  const userIds = users.map(u => u.id);
  const { data: roleRows, error: rErr } = await supabase
    .from("user_roles")
    .select("user_id, role, is_primary, principal_id, principals(code)")
    .in("user_id", userIds);

  if (rErr) {
    console.error("[usersDb.list:roles]", rErr);
    return { ok: false, error: rErr.message, users: [] };
  }

  // [3] JS 측 JOIN — user_id 기준 그룹화
  const rolesByUser = new Map();
  for (const r of roleRows || []) {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
    rolesByUser.get(r.user_id).push(r);
  }

  // [4] 시트 호환 shape 변환
  const result = users.map(u => {
    const userRoles = rolesByUser.get(u.id) || [];
    const pwaRoles = userRoles
      .map(r => DB_ROLE_TO_PWA[r.role] || r.role)
      .filter(Boolean);
    const role = pickPrimaryRole(pwaRoles);

    // partner 역할 박힌 사용자만 principalId 박음 (PWA SEED id로 변환)
    let principalId = "";
    const partnerRow = userRoles.find(r => r.role === "partner");
    if (partnerRow && partnerRow.principals && partnerRow.principals.code) {
      const dbCode = partnerRow.principals.code;
      principalId = PRINCIPAL_CODE_TO_ID[dbCode] || dbCode;
    }

    // engineer 역할 박힌 사용자만 engineerId 박음
    const engineerId = pwaRoles.includes("engineer") ? (u.code || "") : "";

    return {
      userId:     u.code || "",
      id:         u.code || "",
      loginId:    u.code || "",
      name:       u.name || "",
      phone:      u.phone || "",
      email:      u.email || "",
      role,
      roles:      pwaRoles,   // 다중 역할 정보 (UserListScreen 필터 확장 가능)
      active:     !!u.is_active,
      engineerId,
      principalId,
      _fromSheet: true,
    };
  });

  return { ok: true, users: result };
}
