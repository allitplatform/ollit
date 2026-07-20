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
import { currentUserId } from "./cancelRpc.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// 2026-06-07 — RPC 미배포 에러 패턴 (Mig 098 동일).
function _isRpcMissingError(msg) {
  const s = String(msg || "").toLowerCase();
  return s.includes("could not find") || s.includes("does not exist") || s.includes("pgrst202");
}

// 2026-06-07 — engineer 객체 → admin_upsert_engineer 의 p_patch jsonb.
// 2026-06-07 v2 — 빈 문자열 필드는 patch 제외 (email/region/bank_account/holder 등
//   unique 제약 컬럼이 ""로 전송되면 idx_users_tenant_email 충돌). RPC도 NULLIF
//   방어하지만 클라 단계에서 차단 = 1차 가드.
function _toUpsertPatch(eng) {
  const patch = {};
  const setStr = (key, value) => {
    if (value == null) return;
    const s = String(value);
    if (s === "") return;
    patch[key] = s;
  };
  setStr("name",           eng.name);
  setStr("phone",          eng.phone);
  setStr("email",          eng.email);
  setStr("bank_name",      eng.bankName);
  setStr("bank_account",   eng.accountNumber);
  setStr("account_holder", eng.accountHolder);
  setStr("region",         eng.region);
  if (typeof eng.active === "boolean") patch.is_active = eng.active;
  else if (eng.status) patch.is_active = (eng.status === "active");
  const rateRaw = eng.cm_refrigerant_rate;
  if (rateRaw != null && rateRaw !== "") {
    const n = typeof rateRaw === "number" ? rateRaw : Number(rateRaw);
    if (Number.isFinite(n) && n > 0) patch.refrigerant_rate = n;
  }
  return patch;
}

// status 양방향
function statusToDbActive(status) {
  // "active" → true / "off" → false
  return status === "active";
}

function dbActiveToStatus(isActive) {
  return isActive ? "active" : "off";
}

// DB row → 시트 호환 shape (loadEngineers + adaptSheetEngineerToSeed 호환)
// engineerId / id 둘 다 채움 (시트 측 양쪽 키 lookup 패턴)
// 2026-06-26 — userId 추가: DB users.id (UUID). 기존 id/engineerId 는 code (E016) 라서
//   tasks.assigned_engineer_id (UUID FK) 와 직접 비교 불가. AllTasksScreen 기사명 검색에서
//   apiEngineers.filter(...).map(e => e.userId) 로 UUID 배열 산출 → IN OR 조건에 사용.
function rowToSheetShape(row, allRoles) {
  return {
    userId:              row.id   || "",   // UUID — DB users.id (FK 비교용)
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

  const row = {
    tenant_id:        TENANT_ID,
    code,
    name:             eng.name  || "",
    phone:            eng.phone || "",
    email:            eng.email || null,
    is_active:        isActive,
    bank_name:        eng.bankName      || null,
    bank_account:     eng.accountNumber || null,
    account_holder:   eng.accountHolder || null,
  };

  // 2026-05-31 — Bug 1 fix — refrigerant_rate 측 유효 값만 row 포함.
  //   옛 spec: typeof === "number" 측 strict → string ("100") 측 fallback 50 강제 → DB 측 reset.
  //   새 spec: number 또는 string 측 parse 시도, 유효 값만 set.
  //             undefined / null / "" 측 omit → UPDATE 측 기존 DB 값 보존 (sync path 측 측정 안전망).
  //   INSERT 측 omit 시 DB 컬럼 default 적용.
  const rateRaw = eng.cm_refrigerant_rate;
  if (rateRaw != null && rateRaw !== "") {
    const n = typeof rateRaw === "number" ? rateRaw : Number(rateRaw);
    if (Number.isFinite(n) && n > 0) {
      row.refrigerant_rate = n;
    }
  }

  return row;
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

// engineer 역할 보장 — partial unique index 회피 (SELECT → 없으면 INSERT).
// 배경: Migration 057 이 user_roles PK 를 partial unique index 2개로 교체:
//   ① (user_id, role) WHERE principal_id IS NULL
//   ② (user_id, role, principal_id) WHERE principal_id IS NOT NULL
// Supabase JS 의 onConflict: 'user_id,role' 단순 옵션은 partial predicate 미지정 →
// PG 가 "no unique or exclusion constraint matching" 으로 거부.
// 우회: principal_id IS NULL 조건으로 SELECT → 있으면 skip, 없으면 INSERT (principal_id=NULL).
// 057 멀티 원청 구조 보존 (partner+principal_id 행은 별도 경로 ②).
async function ensureEngineerRole(userId) {
  const { data: found, error: selErr } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "engineer")
    .is("principal_id", null)
    .maybeSingle();
  if (selErr) return { ok: false, error: selErr.message };
  if (found) return { ok: true, skipped: true };
  const { error: insErr } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "engineer", is_primary: true, principal_id: null });
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true, skipped: false };
}

// 2026-06-07 — Migration 102 admin_upsert_engineer RPC 호출로 전환.
//   배경: anon UPDATE on users 가 RLS(`users_self_update id=auth.uid()`) 측 0행 silent fail.
//   해결: SECURITY DEFINER RPC + _caller_is_admin(p_actor) 검증.
//   응답: { ok, action: 'create'|'update', engineerId } | { ok: false, error }
export async function upsertEngineerToDb(eng) {
  if (!eng) return { ok: false, error: "eng 없음" };

  // code 보장 — 비어있으면 next_engineer_code() RPC 호출 (옛 안전망 그대로).
  let code = eng.engineerId || eng.id || "";
  if (!code) {
    const { data: nextCode, error: rpcErr } = await supabase.rpc("next_engineer_code");
    if (rpcErr || !nextCode) {
      console.error("[engineersDb.upsert:next_engineer_code]", rpcErr);
      return { ok: false, error: `기사 번호 부여 실패: ${rpcErr?.message || "응답 없음"}` };
    }
    code = nextCode;
  }

  const actor = currentUserId();
  if (!actor) {
    return { ok: false, error: "로그인 필요 (actor 없음)" };
  }

  const patch = _toUpsertPatch(eng);
  const { data, error } = await supabase.rpc("admin_upsert_engineer", {
    p_code:  code,
    p_patch: patch,
    p_actor: actor,
  });

  if (error) {
    console.error("[engineersDb.upsert:rpc]", error);
    if (_isRpcMissingError(error.message)) {
      return { ok: false, error: "RPC 미배포 — 사장님 SQL 실행 필요 (Migration 102)" };
    }
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "저장 실패" };
  }
  // rows_affected 0 감지 — silent fail 방지
  if (data && data.action === "update" && (data.rows_affected ?? 0) === 0) {
    return { ok: false, error: "0행 매칭 — 저장 실패 (권한/조건 재확인)" };
  }
  return {
    ok: true,
    action: data?.action || "update",
    engineerId: data?.code || code,
  };
}

// 삭제 — 2026-07-20 Migration 183 admin_delete_engineer RPC 전환.
//   옛: anon 직접 DELETE → users에 anon DELETE 정책 없음 → RLS 0행 silent fail
//       ("삭제 완료" 토스트 후 새로고침하면 기사가 그대로 살아있던 버그).
//   새: SECURITY DEFINER RPC + _caller_is_admin (Mig 102 저장 3종과 동일 패턴).
//       작업 이력 있는 기사는 hard delete 대신 is_active=false 비활성 처리
//       → action: 'deleted' | 'deactivated' 로 구분 반환 (호출처 토스트 분기).
export async function deleteEngineerFromDb(engineerCode) {
  if (!engineerCode) return { ok: false, error: "engineerCode 없음" };
  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요 (actor 없음)" };

  const { data, error } = await supabase.rpc("admin_delete_engineer", {
    p_code:  engineerCode,
    p_actor: actor,
  });

  if (error) {
    console.error("[engineersDb.deleteEngineerFromDb:rpc]", error);
    if (_isRpcMissingError(error.message)) {
      return { ok: false, error: "RPC 미배포 — 사장님 SQL 실행 필요 (Migration 183)" };
    }
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "삭제 실패" };
  }
  return { ok: true, action: data?.action || "deleted", reason: data?.reason || "" };
}
