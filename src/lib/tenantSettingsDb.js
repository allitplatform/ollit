// 2026-06-07 — tenants 레벨 설정값 접근 (Migration 104 — ops_phone).
//
// 읽기: tenants anon SELECT (Mig 037) 직접 사용.
// 쓰기: admin_set_tenant_ops_phone RPC (Mig 104) + _caller_is_admin(p_actor).

import { supabase } from "./supabase.js";
import { currentUserId } from "./cancelRpc.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function _isRpcMissingError(msg) {
  const s = String(msg || "").toLowerCase();
  return s.includes("could not find") || s.includes("does not exist") || s.includes("pgrst202");
}

// 운영팀 전화번호 — 단일 tenant 가정 (Phase 1 MVP).
//   ops_phone NULL 또는 빈 값 → null 반환. 호출처가 "버튼 숨김" 처리.
//   컬럼이 아직 배포 안 됐을 수도 있어 selErr 가드.
export async function getOpsPhone() {
  const { data, error } = await supabase
    .from("tenants")
    .select("ops_phone")
    .eq("id", TENANT_ID)
    .maybeSingle();
  if (error) {
    console.warn("[tenantSettingsDb.getOpsPhone]", error.message);
    return { ok: false, error: error.message, phone: null };
  }
  const phone = data?.ops_phone || null;
  return { ok: true, phone };
}

// 운영자 변경 — RPC 호출. 0행/RPC 미배포 가드.
export async function setOpsPhone(phone) {
  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요 (actor 없음)" };

  const { data, error } = await supabase.rpc("admin_set_tenant_ops_phone", {
    p_phone: phone == null ? "" : String(phone),
    p_actor: actor,
  });
  if (error) {
    console.error("[tenantSettingsDb.setOpsPhone:rpc]", error);
    if (_isRpcMissingError(error.message)) {
      return { ok: false, error: "RPC 미배포 — 사장님 SQL 실행 필요 (Migration 104)" };
    }
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "저장 실패" };
  }
  if ((data?.rows_affected ?? 0) === 0) {
    return { ok: false, error: "0행 매칭 — 저장 실패" };
  }
  return { ok: true, phone: data?.ops_phone || null };
}
