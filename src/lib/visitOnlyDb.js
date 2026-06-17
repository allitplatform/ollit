// 2026-06-17 — visit_only 되돌리기 (Mig 138 unmark_visit_only RPC) + 스냅샷 조회.
//
// 스냅샷 위치: task_changes 테이블 (Mig 137 보강 — change_type='visit_only',
//   before_data = { task, task_items, payments }, after_data.type='mark').
//
// RPC 응답 형태:
//   자동 모드: { ok, task_id, source:'auto', new_status, item_count, payment_id }
//   수동 모드: { ok, task_id, source:'manual', new_status, item_count, payment_id }
//   실패: { ok:false, error, hint?, ... }

import { supabase } from "./supabase.js";

// ── 스냅샷 조회 (task_changes 최근 visit_only mark) ──
//   반환: { ok, snapshot | null, error? }
//     snapshot = { task: {...}, task_items: [...], payments: [...] } | null
export async function fetchVisitOnlySnapshot(taskId) {
  if (!taskId) return { ok: false, error: "taskId 필수", snapshot: null };
  const { data, error } = await supabase
    .from("task_changes")
    .select("before_data, changed_at, after_data")
    .eq("task_id", taskId)
    .eq("change_type", "visit_only")
    .not("before_data", "is", null)
    .order("changed_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[visitOnlyDb.fetchSnapshot]", error);
    return { ok: false, error: error.message, snapshot: null };
  }
  // after_data.type === 'mark' 인 최근 행만 (unmark 행과 구분).
  const markRow = (data || []).find(r => (r.after_data?.type || "") === "mark");
  return { ok: true, snapshot: markRow?.before_data || null };
}

// ── 자동 모드 (스냅샷 사용) ──
export async function unmarkVisitOnlyAuto(taskId, actor) {
  if (!taskId) return { ok: false, error: "taskId 필수" };
  if (!actor)  return { ok: false, error: "actor 필수" };
  const { data, error } = await supabase.rpc("unmark_visit_only", {
    p_task_id: taskId,
    p_actor:   actor,
    p_manual:  null,
  });
  if (error) {
    console.error("[visitOnlyDb.unmarkAuto:rpc]", error);
    return { ok: false, error: error.message };
  }
  if (data && data.ok === false) return data;
  return { ok: true, ...data };
}

// ── 수동 모드 (운영자 입력) ──
//   manual = {
//     task: { product_price, extra_fee?, travel_fee?, payment_method?, status? },
//     task_items: [ { work_type_id, appliance_type_id?, qty, unit_price,
//                     order_type?, product_order_id? } ]
//   }
export async function unmarkVisitOnlyManual(taskId, actor, manual) {
  if (!taskId)  return { ok: false, error: "taskId 필수" };
  if (!actor)   return { ok: false, error: "actor 필수" };
  if (!manual)  return { ok: false, error: "manual 필수" };
  const { data, error } = await supabase.rpc("unmark_visit_only", {
    p_task_id: taskId,
    p_actor:   actor,
    p_manual:  manual,
  });
  if (error) {
    console.error("[visitOnlyDb.unmarkManual:rpc]", error);
    return { ok: false, error: error.message };
  }
  if (data && data.ok === false) return data;
  return { ok: true, ...data };
}

// ── 기종 / 작업유형 lookup helpers (수동 모드 폼용) ──
//   work_types: id, code, name, service_type_id, appliance_type_id, default_unit_price
//   appliance_types: id, code, name, category_id
//   service_types: id, code, name

export async function fetchWorkTypesForUnmark() {
  const [
    { data: wts,  error: wtsErr },
    { data: sts,  error: stsErr },
    { data: ats,  error: atsErr },
  ] = await Promise.all([
    supabase.from("work_types").select("id, code, name, service_type_id, appliance_type_id, default_unit_price"),
    supabase.from("service_types").select("id, code, name"),
    supabase.from("appliance_types").select("id, code, name"),
  ]);
  if (wtsErr || stsErr || atsErr) {
    return {
      ok: false,
      error: (wtsErr || stsErr || atsErr).message,
      work_types: [], service_types: [], appliance_types: [],
    };
  }
  return {
    ok: true,
    work_types: wts || [],
    service_types: sts || [],
    appliance_types: ats || [],
  };
}
