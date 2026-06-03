// 2026-06-03 — Phase 2a: 냉매충전 미처리 측측 fetch (read-only).
//   측측 Phase 1 측측 tasks.category_data.refrigerant_addon = { appliance, amount, processed:false }
//   측측 저장. Phase 2a 화면 측측 측측 측측 — 측 측 측측 측측 측측 측측.
//
// Schema:
//   tasks.category_data jsonb (Migration 001)
//   refrigerant_addon 측측 keys: appliance, amount, processed
//
// 측측 측측:
//   completed_at 측측 정렬 (측측 측측 측 — 측측 측측).
//   잘림 측측: tenant_id 측측 측측 측측 측측 측측 측측 측측 (RLS 측측).
import { supabase } from "./supabase.js";

export async function fetchUnprocessedRefriAddons() {
  const { data, error } = await supabase
    .from("tasks")
    .select(`id, task_no, customer_name, district, completed_at,
             assigned_engineer_id, principal_id, status, category_data,
             assigned_engineer:users!assigned_engineer_id ( name, code ),
             principal_rel:principals!principal_id ( code, name )`)
    .not("category_data->refrigerant_addon", "is", null)
    .eq("category_data->refrigerant_addon->>processed", "false")
    .order("completed_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("[refrigerantAddonsDb.fetchUnprocessed]", error);
    return { ok: false, error: error.message, items: [] };
  }

  // 평탄화 — refrigerant_addon 측측 측측 측측 측측 측측 + 라우팅 판정 측측.
  const items = (data || []).map(row => {
    const addon = (row.category_data && row.category_data.refrigerant_addon) || {};
    const principalCode = row.principal_rel?.code || "";
    return {
      id:                 row.id,
      task_no:            row.task_no,
      customer_name:      row.customer_name,
      district:           row.district,
      completed_at:       row.completed_at,
      status:             row.status,
      engineer_id:        row.assigned_engineer_id,
      engineer_name:      row.assigned_engineer?.name || null,
      engineer_code:      row.assigned_engineer?.code || null,
      principal_id:       row.principal_id,
      principal_code:     principalCode,
      principal_name:     row.principal_rel?.name || "",
      // refrigerant_addon 평탄화
      addon_appliance:    addon.appliance || "",
      addon_amount:       Number(addon.amount) || 0,
      addon_processed:    !!addon.processed,
      // 라우팅 측측 (Phase 2b 측측, 측측 측측 화면 표시 측측측 측측).
      //   usol_n → usol_h / 측측 → 측측 측측 그대로.
      routed_principal_code: principalCode === "usol_n" ? "usol_h" : principalCode,
      routed_principal_name: principalCode === "usol_n" ? "유솔홈케어 H" : (row.principal_rel?.name || ""),
    };
  });

  return { ok: true, items };
}
