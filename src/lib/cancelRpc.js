// Round 2 — 취소 RPC 5개 호출 헬퍼 (Migration 074 — p_actor 명시 전달)
// 2026-05-25
//
// PWA는 자체 인증(sign_in_with_phone RPC + localStorage("allit.user")) + anon 키.
// supabase.auth 미사용 → auth.uid() = NULL. 마이그 074 측 RPC가 p_actor uuid 인자로 호출자 식별.
//   다른 RPC(mark_principal_remitted / undo_principal_remit / change_password 등)와 동일 패턴.
//
// ⚠️ 옛 어댑터(requestCancelAdapter / approveCancelAdapter / rejectCancelAdapter) 와
//   다른 흐름. 본 헬퍼는 신규 즉시 취소·수고비 모델 전용. 섞지 말 것.

import { supabase } from "./supabase.js";

// localStorage("allit.user") 의 user_id — sign_in_with_phone RPC 응답 저장값.
// principalRemitDb.currentUserId() 측 동일 패턴. engineerTaskRpc 측 재사용 위해 export.
export function currentUserId() {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("allit.user") : null;
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.user_id || null;
  } catch {
    return null;
  }
}

export function normalizeRpcResp(resp) {
  if (resp.error) return { ok: false, error: resp.error.message || "RPC 호출 실패" };
  const data = resp.data;
  if (data && data.ok === false) return { ok: false, error: data.error || "RPC 거부" };
  return { ok: true, data };
}
// 옛 이름 호환 (모듈 내부 사용)
const normalize = normalizeRpcResp;

// 원청 전체 취소 — 자기 원청 task 만 허용. 기본 수고비 'none'.
export async function partnerFullCancel(taskId, reason) {
  const actorId = currentUserId();
  if (!actorId) return { ok: false, error: "로그인 필요" };
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!reason || !String(reason).trim()) return { ok: false, error: "사유 없음" };
  const r = await supabase.rpc("partner_full_cancel", {
    p_task_id: taskId,
    p_reason:  String(reason).trim(),
    p_actor:   actorId,
  });
  return normalize(r);
}

// 원청 단건 부분취소
export async function partnerPartialCancelItem(itemId, reason) {
  const actorId = currentUserId();
  if (!actorId) return { ok: false, error: "로그인 필요" };
  if (!itemId) return { ok: false, error: "itemId 없음" };
  if (!reason || !String(reason).trim()) return { ok: false, error: "사유 없음" };
  const r = await supabase.rpc("partner_partial_cancel_item", {
    p_item_id: itemId,
    p_reason:  String(reason).trim(),
    p_actor:   actorId,
  });
  return normalize(r);
}

// 운영자 전체 취소 — 기본 수고비 'none'.
export async function adminFullCancel(taskId, reason) {
  const actorId = currentUserId();
  if (!actorId) return { ok: false, error: "로그인 필요" };
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!reason || !String(reason).trim()) return { ok: false, error: "사유 없음" };
  const r = await supabase.rpc("admin_full_cancel", {
    p_task_id: taskId,
    p_reason:  String(reason).trim(),
    p_actor:   actorId,
  });
  return normalize(r);
}

// 운영자 단건 부분취소
export async function adminPartialCancelItem(itemId, reason) {
  const actorId = currentUserId();
  if (!actorId) return { ok: false, error: "로그인 필요" };
  if (!itemId) return { ok: false, error: "itemId 없음" };
  if (!reason || !String(reason).trim()) return { ok: false, error: "사유 없음" };
  const r = await supabase.rpc("admin_partial_cancel_item", {
    p_item_id: itemId,
    p_reason:  String(reason).trim(),
    p_actor:   actorId,
  });
  return normalize(r);
}

// 운영자 수고비 토글 — 취소된 task 에만. kind: 'visit_fee' | 'none'.
export async function adminSetCancelCompensation(taskId, kind) {
  const actorId = currentUserId();
  if (!actorId) return { ok: false, error: "로그인 필요" };
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!kind || !["visit_fee", "none"].includes(kind)) {
    return { ok: false, error: "kind 측 visit_fee / none 중 하나" };
  }
  const r = await supabase.rpc("admin_set_cancel_compensation", {
    p_task_id: taskId,
    p_kind:    kind,
    p_actor:   actorId,
  });
  return normalize(r);
}
