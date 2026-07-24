// 2026-06-26 — task_messages (운영자 → 기사 작업별 메시지) 클라이언트 wrapper.
//   Mig 150 RPC 3종:
//     · admin_send_task_message              (운영자 INSERT + 푸시)
//     · list_engineer_task_messages          (기사 자기 메시지 SELECT)
//     · mark_engineer_task_message_read      (기사 read_at)
//   RLS 직접 SELECT/INSERT/UPDATE 차단 — 모든 동작 RPC 만.

import { supabase } from "./supabase.js";

// 운영자 → 기사 메시지 전송. server-side 트리거 자동 푸시 (pg_net + Vault).
//   응답: { ok, id, createdAt, taskNo } | { ok:false, error }
export async function sendTaskMessage({ taskId, toUserId, body, actorId }) {
  if (!actorId)              return { ok: false, error: "actorId 누락 — 로그인 운영자 user_id 필요" };
  if (!taskId)               return { ok: false, error: "taskId 누락" };
  if (!toUserId)             return { ok: false, error: "수신 기사 UUID 누락 (assignedEngineerId)" };
  if (!body || !String(body).trim()) return { ok: false, error: "메시지 본문 필수" };
  const { data, error } = await supabase.rpc("admin_send_task_message", {
    p_task_id: taskId,
    p_to_user: toUserId,
    p_body:    String(body).trim(),
    p_actor:   actorId,
  });
  if (error) {
    console.error("[taskMessagesDb.send]", error);
    return { ok: false, error: error.message || "전송 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "전송 실패" };
  }
  return { ok: true, id: data?.id, createdAt: data?.created_at, taskNo: data?.task_no };
}

// 기사 자기 메시지 목록 — list_engineer_task_messages RPC.
//   응답: { ok, items: [{ id, task_id, task_no, customer_name, from_user, body, created_at, read_at }] }
export async function listEngineerTaskMessages({ userId, limit = 100 } = {}) {
  if (!userId) return { ok: false, error: "userId 누락 — 로그인 기사 user_id 필요", items: [] };
  const { data, error } = await supabase.rpc("list_engineer_task_messages", {
    p_user_id: userId,
    p_limit:   limit,
  });
  if (error) {
    console.error("[taskMessagesDb.list]", error);
    return { ok: false, error: error.message || "목록 실패", items: [] };
  }
  return { ok: true, items: Array.isArray(data) ? data : [] };
}

// 메시지 read_at 설정 — 기사가 열어볼 때.
export async function markTaskMessageRead({ id, userId }) {
  if (!id || !userId) return { ok: false, error: "id / userId 누락" };
  const { data, error } = await supabase.rpc("mark_engineer_task_message_read", {
    p_id:      id,
    p_user_id: userId,
  });
  if (error) {
    console.error("[taskMessagesDb.markRead]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, rowsAffected: data?.rows_affected ?? 0 };
}

// ============================================================
// 2026-07-24 — 메시지 창구 v2 (Mig 188, 양방향 스레드)
//   설계: claude/올잇_설계확정_기사메시지창구_2026-07-24.md
// ============================================================

export const MESSAGE_KINDS = ["general", "assign", "schedule", "complete", "settle"];
export const MESSAGE_KIND_KO = {
  general:  "일반",
  assign:   "배정",
  schedule: "일정",
  complete: "완료",
  settle:   "정산",
};
export const MESSAGE_KIND_ICON = {
  general: "💬", assign: "🧭", schedule: "📅", complete: "✅", settle: "💰",
};

async function _rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[taskMessagesDb.${name}]`, error);
    return { ok: false, error: error.message || "요청 실패" };
  }
  return { ok: true, data };
}

// 기사 발신 (taskId 없으면 일반 스레드)
export async function engineerSendMessage({ actorId, taskId = null, kind = "general", body }) {
  if (!actorId) return { ok: false, error: "actorId 누락" };
  if (!body || !String(body).trim()) return { ok: false, error: "메시지 본문 필수" };
  const r = await _rpc("engineer_send_message", {
    p_actor: actorId, p_task_id: taskId, p_kind: kind, p_body: String(body).trim(),
  });
  if (!r.ok) return r;
  if (r.data && r.data.ok === false) return { ok: false, error: r.data.error || "전송 실패" };
  return { ok: true, id: r.data?.id };
}

// 운영자 발신 v2 (task 무관 + kind)
export async function adminSendMessage({ actorId, engineerUserId, taskId = null, kind = "general", body }) {
  if (!actorId) return { ok: false, error: "actorId 누락" };
  if (!engineerUserId) return { ok: false, error: "수신 기사 누락" };
  if (!body || !String(body).trim()) return { ok: false, error: "메시지 본문 필수" };
  const r = await _rpc("admin_send_message", {
    p_actor: actorId, p_engineer_user: engineerUserId,
    p_task_id: taskId, p_kind: kind, p_body: String(body).trim(),
  });
  if (!r.ok) return r;
  if (r.data && r.data.ok === false) return { ok: false, error: r.data.error || "전송 실패" };
  return { ok: true, id: r.data?.id };
}

// 스레드 목록 — 운영자
export async function adminListMessageThreads({ actorId }) {
  if (!actorId) return { ok: false, error: "actorId 누락", items: [] };
  const r = await _rpc("admin_list_message_threads", { p_actor: actorId });
  if (!r.ok) return { ...r, items: [] };
  return { ok: true, items: Array.isArray(r.data) ? r.data : [] };
}

// 스레드 목록 — 기사
export async function listEngineerMessageThreads({ actorId }) {
  if (!actorId) return { ok: false, error: "actorId 누락", items: [] };
  const r = await _rpc("list_engineer_message_threads", { p_actor: actorId });
  if (!r.ok) return { ...r, items: [] };
  return { ok: true, items: Array.isArray(r.data) ? r.data : [] };
}

// 채팅 화면 메시지 (양방향 시간순)
export async function listThreadMessages({ actorId, engineerUserId, taskId = null }) {
  if (!actorId || !engineerUserId) return { ok: false, error: "actor/engineer 누락", items: [] };
  const r = await _rpc("list_thread_messages", {
    p_actor: actorId, p_engineer_user: engineerUserId, p_task_id: taskId,
  });
  if (!r.ok) return { ...r, items: [] };
  return { ok: true, items: Array.isArray(r.data) ? r.data : [] };
}

// 스레드 읽음 처리 (자기 수신분만)
export async function markThreadRead({ actorId, engineerUserId, taskId = null }) {
  if (!actorId || !engineerUserId) return { ok: false, error: "actor/engineer 누락" };
  const r = await _rpc("mark_thread_read", {
    p_actor: actorId, p_engineer_user: engineerUserId, p_task_id: taskId,
  });
  if (!r.ok) return r;
  return { ok: true, marked: r.data?.marked ?? 0 };
}

// 운영자 안읽음 총계 (개요 카드 배지)
export async function adminMessagesUnreadCount({ actorId }) {
  if (!actorId) return { ok: true, count: 0 };
  const r = await _rpc("admin_messages_unread_count", { p_actor: actorId });
  if (!r.ok) return { ok: false, count: 0 };
  return { ok: true, count: Number(r.data?.count) || 0 };
}

// 스레드 소프트 삭제 — 운영자 전용 (휴지통, Mig 188b)
export async function adminDeleteMessageThread({ actorId, engineerUserId, taskId = null }) {
  if (!actorId || !engineerUserId) return { ok: false, error: "actor/engineer 누락" };
  const r = await _rpc("admin_delete_message_thread", {
    p_actor: actorId, p_engineer_user: engineerUserId, p_task_id: taskId,
  });
  if (!r.ok) return r;
  if (r.data && r.data.ok === false) return { ok: false, error: r.data.error || "삭제 실패" };
  return { ok: true, deleted: r.data?.deleted ?? 0 };
}
