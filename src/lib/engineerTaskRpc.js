// 기사 PWA 전용 RPC 헬퍼 (Migration 076 — reschedule / 취소요청)
// 2026-05-25
//
// 배경: PWA 가 anon 키 + 자체 인증(sign_in_with_phone) — auth.uid()=NULL.
//   tasks RLS engineer_update 측 통과 X → 옛 updateTaskAdapter / requestCancelAdapter
//   호출 시 0행 매칭. 본 RPC 가 p_actor 명시 전달 + SECURITY DEFINER 로 우회.
//
// 사용:
//   · rescheduleEngineerTask(taskId, scheduledAtIso) — 일정 변경
//   · requestEngineerCancel(taskId, reason)          — 취소 요청

import { supabase } from "./supabase.js";
import { currentUserId, normalizeRpcResp } from "./cancelRpc.js";

// 기사 일정 변경 — tasks.scheduled_at UPDATE. 종착 상태(완료/취소/visit_only) 거부.
// 2026-05-27 — 변경 사유(reason) 파라미터 추가. RPC 본체(Mig 076 갱신)가
//   category_data.rescheduleReason 에 머지. reason 비면 RPC 가 무시 (옛 호출 호환).
export async function rescheduleEngineerTask(taskId, scheduledAtIso, reason = null) {
  const actorId = currentUserId();
  if (!actorId) return { ok: false, error: "로그인 필요" };
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!scheduledAtIso) return { ok: false, error: "일정 시각 없음" };
  const r = await supabase.rpc("reschedule_engineer_task", {
    p_task_id:      taskId,
    p_scheduled_at: scheduledAtIso,
    p_actor:        actorId,
    p_reason:       reason || null,
  });
  return normalizeRpcResp(r);
}

// 기사 측 취소 요청 — status='취소요청' 마킹.
//   category_data 필드명 = 옛 requestCancelAdapter 와 동일 (AdminApp 승인 화면 호환).
export async function requestEngineerCancel(taskId, reason) {
  const actorId = currentUserId();
  if (!actorId) return { ok: false, error: "로그인 필요" };
  if (!taskId) return { ok: false, error: "taskId 없음" };
  if (!reason || !String(reason).trim()) return { ok: false, error: "사유 없음" };
  const r = await supabase.rpc("request_engineer_cancel", {
    p_task_id: taskId,
    p_reason:  String(reason).trim(),
    p_actor:   actorId,
  });
  return normalizeRpcResp(r);
}
