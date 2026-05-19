// Phase 5 Step 0.C-4 — 변경 이력 audit log 어댑터
// 2026-05-19
// task_changes 테이블 (Migration 039) 측 SELECT / INSERT.
// 사용처:
//   · listTaskChanges(taskId) — AdminTaskDetailScreen 측 변경 이력 카드
//   · insertTaskChange(...)  — 6개 변경 액션 측 자동 기록 호출

import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// 특정 task 측 변경 이력 — 최신순
// 응답: { ok, changes: [...] }
export async function listTaskChanges(taskId) {
  if (!taskId) return { ok: false, error: "taskId X", changes: [] };
  const { data, error } = await supabase
    .from("task_changes")
    .select(
      "id, task_id, change_type, before_data, after_data, note, changed_by, changed_by_name, changed_at"
    )
    .eq("task_id", taskId)
    .order("changed_at", { ascending: false });
  if (error) {
    console.error("[taskChangesDb.list]", error);
    return { ok: false, error: error.message, changes: [] };
  }
  return { ok: true, changes: data || [] };
}

// 변경 이력 INSERT
// 입력:
//   taskId          (uuid)
//   changeType      ('schedule' / 'engineer' / 'items' / 'extra_fee' / 'cancel' / 'visit_only' / 'status')
//   before / after  (jsonb / 임의 객체)
//   note            (text / 운영자 사유)
//   changedBy       (uuid / null 가능)
//   changedByName   (text / 변경 시점 이름 snapshot)
// 응답: { ok, id }
export async function insertTaskChange({
  taskId, changeType,
  before = null, after = null,
  note = null,
  changedBy = null, changedByName = null,
}) {
  if (!taskId)     return { ok: false, error: "taskId X" };
  if (!changeType) return { ok: false, error: "changeType X" };

  const { data, error } = await supabase
    .from("task_changes")
    .insert({
      task_id:         taskId,
      tenant_id:       TENANT_ID,
      change_type:     changeType,
      before_data:     before,
      after_data:      after,
      note:            note,
      changed_by:      changedBy,
      changed_by_name: changedByName,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[taskChangesDb.insert]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id };
}
