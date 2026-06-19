// 2026-06-19 — 운영자용 task 변경 RPC 헬퍼.
//
// 배경: PWA anon + 자체인증 → auth.uid()=NULL → tasks RLS 통과 X.
// 패턴: 같은 폴더의 engineerTaskRpc.js / cancelRpc.js 와 동일.
//   SECURITY DEFINER RPC + p_actor 명시 전달 + RPC 내부 _caller_is_admin 검증.
//
// 함수 1개 (Mig 144):
//   · adminRescheduleTask(taskId, scheduledAtIso) — 운영자 일정 변경
//
// 잠금 상태(RPC 거부 + 클라 가드): 진행중 / 완료 / 취소 / visit_only / 정산완료.

import { supabase } from "./supabase.js";
import { currentUserId, normalizeRpcResp } from "./cancelRpc.js";

// 운영자 일정 변경 — Mig 144 admin_reschedule_task.
//   권한: owner/admin/operator (RPC 측 _caller_is_admin 검증).
//   응답: { ok:true, task_id, scheduled_at, old_scheduled_at } | { ok:false, error }
export async function adminRescheduleTask(taskId, scheduledAtIso) {
  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요" };
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!scheduledAtIso) return { ok: false, error: "일정 시각 없음" };
  const r = await supabase.rpc("admin_reschedule_task", {
    p_task_id:      taskId,
    p_scheduled_at: scheduledAtIso,
    p_actor:        actor,
  });
  return normalizeRpcResp(r);
}
