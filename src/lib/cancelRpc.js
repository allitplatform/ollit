// Round 2 — 취소 RPC 5개 호출 헬퍼 (Migration 073)
// 2026-05-25
//
// ⚠️ 옛 어댑터(requestCancelAdapter / approveCancelAdapter / rejectCancelAdapter)와
//   다른 흐름. 본 헬퍼들은 신규 즉시 취소·수고비 모델 전용. 섞지 말 것.
//
// RPC 본문 권한 가드:
//   · partner_*  — auth.uid() user_roles partner + principal_id 일치
//   · admin_*    — auth.uid() user_roles owner/operator/admin

import { supabase } from "./supabase.js";

// 공통 응답 정규화
function normalize(resp) {
  if (resp.error) return { ok: false, error: resp.error.message || "RPC 호출 실패" };
  const data = resp.data;
  if (data && data.ok === false) return { ok: false, error: data.error || "RPC 거부" };
  return { ok: true, data };
}

// 원청 전체 취소 — 자기 원청 task 만 허용. 기본 수고비 'none'.
export async function partnerFullCancel(taskId, reason) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!reason || !String(reason).trim()) return { ok: false, error: "사유 없음" };
  const r = await supabase.rpc("partner_full_cancel", {
    p_task_id: taskId,
    p_reason:  String(reason).trim(),
  });
  return normalize(r);
}

// 원청 단건 부분취소
export async function partnerPartialCancelItem(itemId, reason) {
  if (!itemId) return { ok: false, error: "itemId 없음" };
  if (!reason || !String(reason).trim()) return { ok: false, error: "사유 없음" };
  const r = await supabase.rpc("partner_partial_cancel_item", {
    p_item_id: itemId,
    p_reason:  String(reason).trim(),
  });
  return normalize(r);
}

// 운영자 전체 취소 — 기본 수고비 'none'.
export async function adminFullCancel(taskId, reason) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!reason || !String(reason).trim()) return { ok: false, error: "사유 없음" };
  const r = await supabase.rpc("admin_full_cancel", {
    p_task_id: taskId,
    p_reason:  String(reason).trim(),
  });
  return normalize(r);
}

// 운영자 단건 부분취소
export async function adminPartialCancelItem(itemId, reason) {
  if (!itemId) return { ok: false, error: "itemId 없음" };
  if (!reason || !String(reason).trim()) return { ok: false, error: "사유 없음" };
  const r = await supabase.rpc("admin_partial_cancel_item", {
    p_item_id: itemId,
    p_reason:  String(reason).trim(),
  });
  return normalize(r);
}

// 운영자 수고비 토글 — 취소된 task 에만. kind: 'visit_fee' | 'none'.
export async function adminSetCancelCompensation(taskId, kind) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!kind || !["visit_fee", "none"].includes(kind)) {
    return { ok: false, error: "kind 측 visit_fee / none 중 하나" };
  }
  const r = await supabase.rpc("admin_set_cancel_compensation", {
    p_task_id: taskId,
    p_kind:    kind,
  });
  return normalize(r);
}
