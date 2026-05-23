// 원청 → 회사 주간 정산 입금 워크플로 어댑터
// 2026-05-23 — Migration 059 (table) + 060 (RPC) 측 측 클라이언트 함수
//
// 흐름:
//   · 원청 PrincipalSettleTab: markPrincipalRemitted (보고) / undoPrincipalRemit (취소)
//   · 회사 UsolNTracking:      confirmPrincipalRemit (확인) / fetchPendingPrincipalRemits
import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// 자체 users 인증(anon key only) 측 supabase.auth 측 측 X →
// auth.uid() = NULL. RPC 측 권한 검사 측 measurement 측 catch user_id 측 catch.
//   localStorage("allit.user") 측 catch sign_in_with_phone RPC 응답 측 저장.
function currentUserId() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("allit.user") : null;
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.user_id || null;
  } catch {
    return null;
  }
}

// principalCodes → principal_id[] 매핑 (모듈 캐시)
const _principalIdCache = new Map();
async function resolvePrincipalIds(codes) {
  const need = codes.filter(c => !_principalIdCache.has(c));
  if (need.length > 0) {
    const { data, error } = await supabase
      .from("principals")
      .select("id, code")
      .in("code", need);
    if (error) {
      console.error("[principalRemitDb.resolveIds]", error);
      return [];
    }
    for (const p of (data || [])) _principalIdCache.set(p.code, p.id);
  }
  return codes.map(c => _principalIdCache.get(c)).filter(Boolean);
}

// ============================================
// 원청 측 — PrincipalSettleTab
// ============================================

// 주차별 입금 보고 fetch (자기 principal_id 측 측 RLS)
export async function fetchPrincipalWeeklyRemittances({ principalCodes = [], monthsBack = 3 } = {}) {
  if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
    return { ok: false, error: "principalCodes 누락", remits: [] };
  }
  const pids = await resolvePrincipalIds(principalCodes);
  if (pids.length === 0) {
    return { ok: false, error: "principal_id 매핑 실패", remits: [] };
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("principal_weekly_remittances")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .in("principal_id", pids)
    .gte("week_start", cutoff.toISOString().slice(0, 10))
    .order("week_start", { ascending: false });

  if (error) {
    console.error("[principalRemitDb.fetch]", error);
    return { ok: false, error: error.message, remits: [] };
  }
  return { ok: true, remits: data || [] };
}

// 보고 — mark_principal_remitted RPC
//   입력: { principalCode, weekStart: "YYYY-MM-DD", weekEnd, amount, note? }
//   반환: { ok, id?, error? }
export async function markPrincipalRemitted({ principalCode, weekStart, weekEnd, amount, note = null }) {
  const userId = currentUserId();
  if (!userId) return { ok: false, error: "not_logged_in" };
  const pids = await resolvePrincipalIds([principalCode]);
  if (pids.length === 0) return { ok: false, error: "principal_id 매핑 실패" };
  const { data, error } = await supabase.rpc("mark_principal_remitted", {
    p_user_id:      userId,
    p_principal_id: pids[0],
    p_week_start:   weekStart,
    p_week_end:     weekEnd,
    p_amount:       amount,
    p_note:         note,
  });
  if (error) {
    console.error("[principalRemitDb.mark]", error);
    return { ok: false, error: error.message };
  }
  return data || { ok: false, error: "rpc_empty" };
}

// 보고 취소 — undo_principal_remit RPC (confirmed_at NULL 측 측)
export async function undoPrincipalRemit({ remitId }) {
  const userId = currentUserId();
  if (!userId) return { ok: false, error: "not_logged_in" };
  const { data, error } = await supabase.rpc("undo_principal_remit", {
    p_user_id: userId,
    p_id:      remitId,
  });
  if (error) {
    console.error("[principalRemitDb.undo]", error);
    return { ok: false, error: error.message };
  }
  return data || { ok: false, error: "rpc_empty" };
}

// ============================================
// 회사 측 — UsolNTracking
// ============================================

// 확인 대기 + 확인 완료 fetch (owner/operator RLS)
export async function fetchPrincipalRemitsForAdmin({ principalCodes = ["usol_h", "usol_n"], monthsBack = 3 } = {}) {
  const pids = await resolvePrincipalIds(principalCodes);
  if (pids.length === 0) return { ok: false, error: "principal_id 매핑 실패", remits: [] };

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("principal_weekly_remittances")
    .select("*, principals(code, name), remitted_by_user:users!principal_weekly_remittances_remitted_by_fkey(name)")
    .eq("tenant_id", TENANT_ID)
    .in("principal_id", pids)
    .gte("week_start", cutoff.toISOString().slice(0, 10))
    .order("week_start", { ascending: false });

  if (error) {
    console.error("[principalRemitDb.fetchAdmin]", error);
    return { ok: false, error: error.message, remits: [] };
  }
  return { ok: true, remits: data || [] };
}

// 확인 — confirm_principal_remittance RPC
export async function confirmPrincipalRemit({ remitId }) {
  const userId = currentUserId();
  if (!userId) return { ok: false, error: "not_logged_in" };
  const { data, error } = await supabase.rpc("confirm_principal_remittance", {
    p_user_id: userId,
    p_id:      remitId,
  });
  if (error) {
    console.error("[principalRemitDb.confirm]", error);
    return { ok: false, error: error.message };
  }
  return data || { ok: false, error: "rpc_empty" };
}
