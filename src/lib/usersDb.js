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
import { currentUserId } from "./cancelRpc.js";
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

// 2026-06-07 — PWA → DB 역매핑 (admin_set_user_roles 호출 시 사용)
const PWA_ROLE_TO_DB = {
  owner:     "owner",
  admin:     "admin",
  engineer:  "engineer",
  happycall: "operator",
  principal: "partner",
};

// 2026-06-07 — RPC 미배포 에러 패턴 (Mig 098/102/103 동일)
function _isRpcMissingError(msg) {
  const s = String(msg || "").toLowerCase();
  return s.includes("could not find") || s.includes("does not exist") || s.includes("pgrst202");
}

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

// ============================================================
// 2026-06-07 — Migration 103 RPC 호출 헬퍼 3종
// ============================================================

// ① 계정 수정 / 신규 / 활성 토글
//   payload 예: { name, phone, email, region, is_active, default_role:'operator' }
//   code 있으면 UPDATE, 없으면 INSERT (default_role 기준 prefix 자동 부여).
export async function upsertUserToDb({ code, patch }) {
  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요 (actor 없음)" };
  if (!patch || typeof patch !== "object") {
    return { ok: false, error: "patch 누락" };
  }

  const { data, error } = await supabase.rpc("admin_upsert_user", {
    p_code:  code || null,
    p_patch: patch,
    p_actor: actor,
  });

  if (error) {
    console.error("[usersDb.upsert:rpc]", error);
    if (_isRpcMissingError(error.message)) {
      return { ok: false, error: "RPC 미배포 — 사장님 SQL 실행 필요 (Migration 103)" };
    }
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "저장 실패" };
  }
  if (data && data.action === "update" && (data.rows_affected ?? 0) === 0) {
    return { ok: false, error: "0행 매칭 — 저장 실패 (권한/조건 재확인)" };
  }
  return {
    ok: true,
    action: data?.action || "update",
    userId: data?.user_id,
    code:   data?.code,
  };
}

// ② 역할 SET 변경 (PWA role 배열 → DB role 변환 후 호출)
//   pwaRoles 예: ["admin","engineer"] / ["happycall"]
export async function setUserRolesToDb({ userId, pwaRoles }) {
  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요 (actor 없음)" };
  if (!userId) return { ok: false, error: "userId 누락" };
  if (!Array.isArray(pwaRoles) || pwaRoles.length === 0) {
    return { ok: false, error: "roles 비어있음 — 최소 1개 필요" };
  }

  // PWA → DB role 변환 (happycall → operator, principal → partner)
  const dbRoles = [];
  for (const r of pwaRoles) {
    const dbRole = PWA_ROLE_TO_DB[r];
    if (!dbRole) return { ok: false, error: `알 수 없는 role: ${r}` };
    if (dbRole === "partner") {
      return { ok: false, error: "원청(partner) 역할은 별도 처리 (principal_id 필요)" };
    }
    if (!dbRoles.includes(dbRole)) dbRoles.push(dbRole);
  }

  const { data, error } = await supabase.rpc("admin_set_user_roles", {
    p_user_id: userId,
    p_roles:   dbRoles,
    p_actor:   actor,
  });

  if (error) {
    console.error("[usersDb.setRoles:rpc]", error);
    if (_isRpcMissingError(error.message)) {
      return { ok: false, error: "RPC 미배포 — 사장님 SQL 실행 필요 (Migration 103)" };
    }
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "역할 변경 실패" };
  }
  return {
    ok: true,
    rolesSet:     data?.roles_set     ?? 0,
    rolesRemoved: data?.roles_removed ?? 0,
  };
}

// ③ 운영자 비번 리셋
export async function resetUserPasswordToDb({ userId, newPassword }) {
  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요 (actor 없음)" };
  if (!userId) return { ok: false, error: "userId 누락" };
  if (!newPassword || String(newPassword).length < 4) {
    return { ok: false, error: "비밀번호는 4자 이상" };
  }

  const { data, error } = await supabase.rpc("admin_reset_user_password", {
    p_user_id:      userId,
    p_new_password: String(newPassword),
    p_actor:        actor,
  });

  if (error) {
    console.error("[usersDb.resetPassword:rpc]", error);
    if (_isRpcMissingError(error.message)) {
      return { ok: false, error: "RPC 미배포 — 사장님 SQL 실행 필요 (Migration 103)" };
    }
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "비번 리셋 실패" };
  }
  if ((data?.rows_affected ?? 0) === 0) {
    return { ok: false, error: "0행 매칭 — 비번 리셋 실패" };
  }
  return { ok: true, mustChangePassword: true };
}
