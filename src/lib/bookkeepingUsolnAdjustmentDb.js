// 2026-06-14 — 유솔N 월정산 수동 보정 DB 모듈 (Mig 127 테이블 + Mig 128 RPC 3개).
//
// 사장님 spec:
//   유솔N 월정산 자동(track B owner_amount, 전월 작업분)에 더해 수동 보정 입력.
//   1 row per (tenant, work_month). 음수 허용 (차감 보정용).
//   upsert 패턴 (carryover/distribution 동일).
//
// 응답: { ok, ... } | { ok: false, error }.

import { supabase } from "./supabase.js";

async function callRpc(name, args, fallback = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[bookkeepingUsolnAdjustmentDb.${name}]`, error);
    return { ok: false, error: error.message || "RPC 호출 실패", ...fallback };
  }
  return data || { ok: false, error: "빈 응답", ...fallback };
}

// ============================================================
// 조회 (없으면 row=null)
// ============================================================
export async function getUsolnAdjustment(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", row: null };
  if (!actor)     return { ok: false, error: "actor 필수", row: null };
  return callRpc("bookkeeping_get_usoln_adjustment", {
    p_work_month: workMonth,
    p_actor:      actor,
  }, { row: null });
}

// ============================================================
// 저장 (upsert)
// ============================================================
export async function setUsolnAdjustment({ workMonth, amount, memo, actor } = {}) {
  if (!workMonth) return { ok: false, error: "workMonth 필수" };
  if (amount == null) return { ok: false, error: "amount 필수" };
  const amt = Number(amount);
  if (!Number.isFinite(amt)) return { ok: false, error: "amount 숫자 필요" };
  if (!actor) return { ok: false, error: "actor 필수" };

  return callRpc("bookkeeping_set_usoln_adjustment", {
    p_work_month: workMonth,
    p_amount:     Math.round(amt),
    p_memo:       memo || "",
    p_actor:      actor,
  });
}

// ============================================================
// 삭제
// ============================================================
export async function deleteUsolnAdjustment(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수" };
  if (!actor)     return { ok: false, error: "actor 필수" };
  return callRpc("bookkeeping_delete_usoln_adjustment", {
    p_work_month: workMonth,
    p_actor:      actor,
  });
}
