// Phase 3-6 — 기사 마스터 DB 접근 모듈
// Supabase `users` + `user_roles` (role='engineer') 직접 사용. 시트 호출 폐기.
// 함수 시그니처는 옛 api.js 측 호환 — engineers.js (saveEngineerWithSync / deleteEngineerWithSync) 내부 교체만.
//
// 핵심 매핑:
//   · DB users.code (E001 / E002 ...) ↔ PWA engineer.id (동일 값)
//   · DB users.is_active (boolean) ↔ PWA engineer.status ("active" / "off")
//   · DB users.refrigerant_rate (int) ↔ PWA engineer.cm_refrigerant_rate
//   · DB users.bank_name / bank_account / account_holder ↔ PWA bankName / accountNumber / accountHolder
//   · DB users.region ↔ PWA engineer.region (참고용)
//
// 보호:
//   · zones / appliances / workTypes / careerLevel / note — PWA localStorage 전용 (D8 = C)
//     · DB engineer_zones / engineer_permissions 는 Phase 5 작업 배정 시점에 별도 처리
//   · _findInPoliciesCache 측 시트 호환 shape (Phase 3-1) 그대로 활용 (D3 = B)

import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// status 양방향
function statusToDbActive(status) {
  // "active" → true / "off" / "quit" → false
  return status === "active";
}

function dbActiveToStatus(isActive) {
  return isActive ? "active" : "off";
}

// DB row → 시트 호환 shape (loadEngineers + adaptSheetEngineerToSeed 호환)
// engineerId / id 둘 다 채움 (시트 측 양쪽 키 lookup 패턴)
function rowToSheetShape(row, allRoles) {
  return {
    engineerId:          row.code || "",
    id:                  row.code || "",
    name:                row.name || "",
    phone:               row.phone || "",
    email:               row.email || "",
    active:              !!row.is_active,
    status:              dbActiveToStatus(row.is_active),
    cm_refrigerant_rate: row.refrigerant_rate ?? 50,
    bankName:            row.bank_name      || "",
    accountNumber:       row.bank_account   || "",
    accountHolder:       row.account_holder || "",
    region:              row.region         || "",
    roles:               allRoles || ["engineer"],  // 다중 역할 정보 (Phase 3-4 패턴)
    _fromSheet: true,
  };
}

// PWA engineer 객체 → DB users row payload
function syncPayloadToRow(eng) {
  const code = eng.engineerId || eng.id || "";
  // active(boolean) / status("active"/"off") 둘 다 catch
  let isActive;
  if (typeof eng.active === "boolean") isActive = eng.active;
  else                                 isActive = statusToDbActive(eng.status || "active");

  return {
    tenant_id:        TENANT_ID,
    code,
    name:             eng.name  || "",
    phone:            eng.phone || "",
    email:            eng.email || null,
    is_active:        isActive,
    refrigerant_rate: typeof eng.cm_refrigerant_rate === "number" ? eng.cm_refrigerant_rate : 50,
    bank_name:        eng.bankName      || null,
    bank_account:     eng.accountNumber || null,
    account_holder:   eng.accountHolder || null,
  };
}

// ============================================================
// 조회 (READ) — 시트 호환 shape 반환
// ============================================================

// engineer 역할 사용자 전체 (다중 역할 가진 E022 / E002 포함)
// 응답: { ok: true, engineers: [...] } | { ok: false, error, engineers: [] }
export async function listEngineersFromDb() {
  // [1] engineer 역할 가진 user_id 목록
  const { data: roleRows, error: rErr } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "engineer");

  if (rErr) {
    console.error("[engineersDb.list:roles]", rErr);
    return { ok: false, error: rErr.message, engineers: [] };
  }
  const engineerUserIds = (roleRows || []).map(r => r.user_id);
  if (engineerUserIds.length === 0) {
    return { ok: true, engineers: [] };
  }

  // [2] users 조회 (engineer 역할만)
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, code, name, phone, email, is_active, refrigerant_rate, bank_name, bank_account, account_holder, region")
    .eq("tenant_id", TENANT_ID)
    .in("id", engineerUserIds)
    .order("code", { ascending: true });

  if (uErr) {
    console.error("[engineersDb.list:users]", uErr);
    return { ok: false, error: uErr.message, engineers: [] };
  }

  // [3] 모든 역할 catch (다중 역할 정보) — E022 / E002 측 admin + engineer 표현
  const { data: allRoleRows } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", engineerUserIds);

  const rolesByUser = new Map();
  for (const r of allRoleRows || []) {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
    rolesByUser.get(r.user_id).push(r.role);
  }

  const engineers = (users || []).map(u => rowToSheetShape(u, rolesByUser.get(u.id)));
  return { ok: true, engineers };
}

// ============================================================
// 변경 (WRITE)
// ============================================================

// upsert — code 기준 존재 여부 catch 후 update 또는 insert
// 응답: { ok, action: 'create'|'update', engineerId } | { ok: false, error }
export async function upsertEngineerToDb(eng) {
  if (!eng || !(eng.engineerId || eng.id)) {
    return { ok: false, error: "engineerId 없음" };
  }
  const row = syncPayloadToRow(eng);
  if (!row.code) return { ok: false, error: "code 없음" };

  // code 기준 존재 여부
  const { data: existing, error: selErr } = await supabase
    .from("users")
    .select("id, code")
    .eq("tenant_id", TENANT_ID)
    .eq("code", row.code)
    .maybeSingle();

  if (selErr) {
    console.error("[engineersDb.upsert:select]", selErr);
    return { ok: false, error: selErr.message };
  }

  if (existing) {
    // update — id / tenant_id / code 불변
    const updateRow = { ...row };
    delete updateRow.tenant_id;
    delete updateRow.code;
    const { error: updErr } = await supabase
      .from("users")
      .update(updateRow)
      .eq("id", existing.id);
    if (updErr) {
      console.error("[engineersDb.upsert:update]", updErr);
      return { ok: false, error: updErr.message };
    }
    return { ok: true, action: "update", engineerId: row.code };
  }

  // insert — 새 user + engineer 역할 같이 추가
  const { data: inserted, error: insErr } = await supabase
    .from("users")
    .insert(row)
    .select("id, code")
    .single();

  if (insErr) {
    console.error("[engineersDb.upsert:insert]", insErr);
    return { ok: false, error: insErr.message };
  }

  // engineer 역할 추가 (이미 있으면 upsert로 무시)
  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert(
      { user_id: inserted.id, role: "engineer", is_primary: true },
      { onConflict: "user_id,role" }
    );

  if (roleErr) {
    console.error("[engineersDb.upsert:role]", roleErr);
    return { ok: false, error: `사용자 생성 OK / 역할 부여 실패: ${roleErr.message}` };
  }

  return { ok: true, action: "create", engineerId: row.code };
}

// 삭제 — code 기준 hard DELETE (user_roles 측 ON DELETE CASCADE)
// 작업 history FK 충돌 시 에러 반환 → 호출처 (deleteEngineerWithSync) 측 localOk:true 반환.
// Phase 3-3 (원청)과 동일 패턴.
export async function deleteEngineerFromDb(engineerCode) {
  if (!engineerCode) return { ok: false, error: "engineerCode 없음" };
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("tenant_id", TENANT_ID)
    .eq("code", engineerCode);

  if (error) {
    console.error("[engineersDb.deleteEngineerFromDb]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
