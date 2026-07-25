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

// 2026-06-19 — 운영자 재배정 (기사 + 일정 동시) — Mig 145 admin_reassign_task.
//   권한: owner/admin/operator. 잠금 동일 (진행중/완료/취소/visit_only/정산완료).
//   푸시 자동 발화 (notify_lifecycle_push 시나리오 8):
//     · NEW 기사 → '🔄 새 작업 배정 (재배정)'
//     · OLD 기사 → '📅 일정 조정 안내' (Mig 145 spec 정정)
//     · 운영자  → '🔄 프로 재배정'
//   응답: { ok:true, task_id, old_engineer_id, new_engineer_id,
//           old_scheduled_at, new_scheduled_at } | { ok:false, error }
export async function adminReassignTask(taskId, engineerId, scheduledAtIso) {
  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요" };
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!engineerId) return { ok: false, error: "engineerId 없음" };
  if (!scheduledAtIso) return { ok: false, error: "일정 시각 없음" };
  const r = await supabase.rpc("admin_reassign_task", {
    p_task_id:      taskId,
    p_engineer_id:  engineerId,
    p_scheduled_at: scheduledAtIso,
    p_actor:        actor,
  });
  return normalizeRpcResp(r);
}

// 2026-07-25 — 기사 재배정 요청 플래그 해제 — Mig 192 clear_reassign_request.
//   category_data - 'reassignRequest' 단일 UPDATE (읽고-쓰기 race 없음, 다른 키 보존).
//   호출 시점: 운영자가 재배정 요청을 처리했을 때
//     · 타임라인 lane 이동 (기사 교체)
//     · [기사 변경] 화면에서 기사 선택 — 같은 기사 재선택 포함 (= 요청 반려, 그대로 진행)
//   응답: { ok:true, task_id, cleared } | { ok:false, error }
export async function clearReassignRequest(taskId) {
  const actor = currentUserId();
  if (!actor) return { ok: false, error: "로그인 필요" };
  if (!taskId) return { ok: false, error: "taskId 없음" };
  const r = await supabase.rpc("clear_reassign_request", {
    p_task_id: taskId,
    p_actor:   actor,
  });
  return normalizeRpcResp(r);
}
