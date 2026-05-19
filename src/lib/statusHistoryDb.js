// Phase 5 Step 0.C-3-c — 상태 변경 이력 DB 어댑터
// 2026-05-19
// status_history 테이블 — task_id별 status 변경 타임라인.
// 옛 작업 데이터 0건 spec 사장님 확인 OK / 새 작업부터 누적.
// RLS: status_history_tenant 정책 측 current_tenant_id() 의존 — anon 측 차단 가능.
//   결과 0건 fallback "변경 이력 X" 안내 spec.

import { supabase } from "./supabase.js";

// 특정 task 측 status 변경 이력 — 시간순 ascending
// 응답: { ok: true, history: [...] } / 각 entry = { id, changed_at, changed_by, from_status, to_status, note }
export async function listStatusHistory(taskId) {
  if (!taskId) return { ok: false, error: "taskId X", history: [] };
  const { data, error } = await supabase
    .from("status_history")
    .select("id, task_id, changed_at, changed_by, from_status, to_status, note")
    .eq("task_id", taskId)
    .order("changed_at", { ascending: true });
  if (error) {
    console.error("[statusHistoryDb.list]", error);
    return { ok: false, error: error.message, history: [] };
  }
  return { ok: true, history: data || [] };
}
