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
