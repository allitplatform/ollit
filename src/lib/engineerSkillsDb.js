// Phase 3-9 — 기사 역량 DB 접근 모듈
// Supabase `engineer_principal_permissions` (epp, 36행) + `engineer_zones` (ez, 70행) 직접 사용.
// 시트 호출 폐기.
//
// 매핑:
//   · PWA engineerId ("E001"~) ↔ users.code → users.id (UUID FK)
//   · PWA principal "(전체)"/"전체"/"" ↔ DB principal_code NULL
//   · PWA principal "올데이케어"/"KA"/... ↔ DB principal_code text 그대로
//   · PWA workType "세척" ↔ DB service_code "cleaning"
//   · PWA workType "냉매충전" ↔ DB service_code "refrigerant"
//   · PWA grade "메인" ↔ DB level "main"
//   · PWA grade "백업" ↔ DB level "sub"
//   · PWA grade "안 함" → epp 행 DELETE (호출처 deleteEngineerSkillWithSync 사용)
//   · PWA zones "강남구, 서초구" (콤마 string) ↔ DB engineer_zones 분리 행 (user_id, district)
//   · PWA appliances → DB 컬럼 없음 (localStorage만 유지)
//
// upsert 키 (3중): (user_id, principal_code, service_code)
//   · principal_code NULL 처리: `.is("principal_code", null)` 사용
//
// zones 처리 (D7 결정):
//   · 저장 시 user_id 모든 ez DELETE → 새 zones INSERT (전체 교체)
//   · 즉 user 단위 단일 zone 세트 — 마지막 저장한 workType의 zones가 user 전체 zones
//
// 시그니처 호환: 옛 api.js (getEngineerSkills / saveEngineerSkill / deleteEngineerSkill) 대체.
// 외부 호출처 (data/engineers.js, AdminApp.jsx)는 import만 변경 / 응답 형태 유지.

import { supabase } from "./supabase.js";
import { currentUserId } from "./cancelRpc.js";

// 2026-06-07 — RPC 미배포 에러 패턴 (Mig 098/102 동일).
function _isRpcMissingError(msg) {
  const s = String(msg || "").toLowerCase();
  return s.includes("could not find") || s.includes("does not exist") || s.includes("pgrst202");
}

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// ============================================================
// 변환 헬퍼
// ============================================================

function serviceCodeToWorkType(sc) {
  if (sc === "cleaning")    return "세척";
  if (sc === "refrigerant") return "냉매충전";
  return sc || "";
}

function workTypeToServiceCode(wt) {
  if (wt === "세척")     return "cleaning";
  if (wt === "냉매충전") return "refrigerant";
  return wt || "";
}

function levelToGrade(lv) {
  if (lv === "main") return "메인";
  if (lv === "sub")  return "백업";
  return "";
}

function gradeToLevel(g) {
  if (g === "메인") return "main";
  if (g === "백업") return "sub";
  return null;
}

// 2026-05-14 — principal code → 한글명 매핑
// TODO: DB principals 테이블 측 박은 영역 동기화 박을 차례 (현재 하드코딩)
const PRINCIPAL_CODE_TO_NAME = {
  allday:  "올데이케어",
  KA:      "에어컨프로 (KA)",
  KB:      "쿨가이 (KB)",
  yongin:  "용인컴퍼니",
  usol_h:  "유솔홈케어",
  usol_n:  "유솔홈케어 N",
  crikrin: "크리크린",
  cesco:   "세스코",
};

function principalCodeToText(pc) {
  if (pc === null || pc === undefined || pc === "") return "(전체)";
  return PRINCIPAL_CODE_TO_NAME[pc] || pc;
}

function principalTextToCode(p) {
  if (!p || p === "(전체)" || p === "전체") return null;
  // 한글명 박힌 영역 → code 변환 (역방향)
  const code = Object.keys(PRINCIPAL_CODE_TO_NAME).find(k => PRINCIPAL_CODE_TO_NAME[k] === String(p).trim());
  return code || String(p).trim();
}

// users.code → users.id (UUID) 변환 (Phase 3-8 동일 패턴)
async function _resolveUserId(engineerCode) {
  const code = String(engineerCode || "").trim();
  if (!code) return { ok: false, error: "engineerCode 누락" };
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("code", code)
    .maybeSingle();
  if (error) {
    return { ok: false, error: `users 조회 실패: ${error.message}` };
  }
  if (!data) {
    return { ok: false, error: `기사 매핑 실패 (${code} 사용자 없음)` };
  }
  return { ok: true, userId: data.id };
}

// principal_code NULL 처리 — Supabase query에 적용
function _applyPrincipalCondition(query, principalCode) {
  if (principalCode === null) {
    return query.is("principal_code", null);
  }
  return query.eq("principal_code", principalCode);
}

// ============================================================
// 조회 (READ) — epp + ez JOIN → 시트 호환 shape
// 응답: { ok: true, skills: [...] } | { ok: false, error, skills: [] }
// ============================================================
export async function listEngineerSkillsFromDb() {
  // [1] epp 전체 + users(code) JOIN
  // Phase 3-9 fix — PGRST201 회피: FK 이름 명시 (스키마 캐시 / 다중 FK 후보 대응)
  const { data: eppRows, error: eppErr } = await supabase
    .from("engineer_principal_permissions")
    .select("id, user_id, principal_code, service_code, level, active, users!engineer_principal_permissions_user_id_fkey(code)")
    .eq("active", true);

  if (eppErr) {
    console.error("[engineerSkillsDb.list:epp]", eppErr);
    return { ok: false, error: eppErr.message, skills: [] };
  }

  // [2] ez 전체 (active=true만)
  const { data: ezRows, error: ezErr } = await supabase
    .from("engineer_zones")
    .select("user_id, district, active")
    .eq("active", true);

  if (ezErr) {
    console.error("[engineerSkillsDb.list:ez]", ezErr);
    return { ok: false, error: ezErr.message, skills: [] };
  }

  // [3] user_id별 zones 그룹화
  const zonesByUser = new Map();
  for (const z of ezRows || []) {
    if (!zonesByUser.has(z.user_id)) zonesByUser.set(z.user_id, []);
    zonesByUser.get(z.user_id).push(z.district);
  }

  // [4] epp 행 → 시트 호환 shape (각 epp row에 user의 zones 추가)
  //
  // 2026-05-29 — (user_id, service_code) 그룹화 + principal_code=NULL normalize.
  //   옛: 모든 epp row 그대로 매핑 → 같은 user 의 NULL + 원청별 row 각각 별 skill 로 노출.
  //        EngineerEditScreen `isAllPrincipal` 매칭은 "(전체)" 만 잡아 원청별 row 결손 표시.
  //   새: user × service 그룹마다 1개 skill — NULL row 우선 / 없으면 가장 높은 level row.
  //        principal 항상 "(전체)" (NULL normalize) — 폼 spec 정합.
  //        SQL 정리 (ad-hoc 2026-05-29) 후엔 NULL row 만 남아 그룹별 1개 자연 — 정리 전 호환 안전망.
  const byKey = new Map();   // key = `${user_id}|${service_code}` → 최적 row
  for (const row of eppRows || []) {
    const key = `${row.user_id}|${row.service_code}`;
    const prev = byKey.get(key);
    // 우선순위: principal_code = NULL > 더 높은 level > 작은 id
    const isBetter = !prev
      || (row.principal_code === null && prev.principal_code !== null)
      || (row.principal_code === prev.principal_code && (row.level || 0) > (prev.level || 0))
      || (row.principal_code === prev.principal_code && row.level === prev.level && row.id < prev.id);
    if (isBetter) byKey.set(key, row);
  }

  const skills = Array.from(byKey.values()).map(row => {
    const userZones = zonesByUser.get(row.user_id) || [];
    return {
      engineerId:      row.users?.code || "",
      principal:       "(전체)",                 // 원청 무관 normalize
      workType:        serviceCodeToWorkType(row.service_code),
      grade:           levelToGrade(row.level),
      zones:           userZones.join(", "),
      zonesArray:      userZones.slice(),
      appliances:      "",                       // DB 없음 — localStorage만 유지
      appliancesArray: [],
      note:            "",
    };
  });

  return { ok: true, skills };
}

// ============================================================
// 변경 (UPSERT) — Migration 102 admin_save_engineer_skill RPC 호출
// 2026-06-07 — RLS silent fail 회피. SECURITY DEFINER + _caller_is_admin(p_actor).
//   payload: { engineerId, principal, workType, zones, grade, appliances?, note? }
//   응답: { ok, action: 'upsert' } | { ok: false, error }
// ============================================================
export async function upsertEngineerSkillToDb(payload) {
  if (!payload || !payload.engineerId || !payload.workType) {
    return { ok: false, error: "필수 키 누락 (engineerId / workType)" };
  }

  // [1] engineerCode → user_id
  const u = await _resolveUserId(payload.engineerId);
  if (!u.ok) return { ok: false, error: u.error };
  const userId = u.userId;

  // [2] 변환
  const serviceCode = workTypeToServiceCode(payload.workType);
  const level       = gradeToLevel(payload.grade);

  if (!serviceCode) {
    return { ok: false, error: `workType 변환 실패: ${payload.workType}` };
  }
  if (level === null) {
    return { ok: false, error: `grade가 main/sub가 아님: ${payload.grade} (삭제 경로 사용 필요)` };
  }

  // zones 정규화 (string "강남구, 서초구" 또는 배열) → text[] for RPC
  const zonesRaw = payload.zones;
  let zonesList = [];
  if (Array.isArray(zonesRaw)) {
    zonesList = zonesRaw.map(z => String(z).trim()).filter(Boolean);
  } else if (typeof zonesRaw === "string") {
    zonesList = zonesRaw.split(",").map(z => z.trim()).filter(Boolean);
  }

  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요 (actor 없음)" };

  const { data, error } = await supabase.rpc("admin_save_engineer_skill", {
    p_user_id:      userId,
    p_service_code: serviceCode,
    p_level:        level,
    p_zones:        zonesList,
    p_actor:        actor,
  });

  if (error) {
    console.error("[engineerSkillsDb.upsert:rpc]", error);
    if (_isRpcMissingError(error.message)) {
      return { ok: false, error: "RPC 미배포 — 사장님 SQL 실행 필요 (Migration 102)" };
    }
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "저장 실패" };
  }
  return { ok: true, action: data?.action || "upsert" };
}

// ============================================================
// 삭제 (DELETE) — epp 행만 hard DELETE (ez는 보존)
// payload: { engineerId, principal, workType }
// 응답: { ok } | { ok: false, error }
//
// D8 결정: zones는 다른 skill (다른 service_code) 측에서도 사용 가능 →
//          skill 삭제 시 ez는 건드리지 않음.
// ============================================================
export async function deleteEngineerSkillFromDb(payload) {
  if (!payload || !payload.engineerId || !payload.workType) {
    return { ok: false, error: "필수 키 누락 (engineerId / workType)" };
  }

  const u = await _resolveUserId(payload.engineerId);
  if (!u.ok) return { ok: false, error: u.error };
  const userId = u.userId;

  const serviceCode = workTypeToServiceCode(payload.workType);
  if (!serviceCode) {
    return { ok: false, error: `workType 변환 실패: ${payload.workType}` };
  }

  // 2026-06-07 — Migration 102 admin_delete_engineer_skill RPC.
  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요 (actor 없음)" };

  const { data, error } = await supabase.rpc("admin_delete_engineer_skill", {
    p_user_id:      userId,
    p_service_code: serviceCode,
    p_actor:        actor,
  });
  if (error) {
    console.error("[engineerSkillsDb.delete:rpc]", error);
    if (_isRpcMissingError(error.message)) {
      return { ok: false, error: "RPC 미배포 — 사장님 SQL 실행 필요 (Migration 102)" };
    }
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "삭제 실패" };
  }
  return { ok: true };
}
