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

// 2026-06-03 — Phase 2b-1: 분배 측측 (read-only RPC).
//   Migration 088 측측 preview_refrigerant_split 호출.
//   사장님 측측 SQL 측측 측측 측측 (PGRST202 측측) → graceful: ok=false 측측 (크래시 X).
//
// 한글 기종 → appliance_types.code 매핑 (Phase 1 측측 저장 측측 한글).
const APPLIANCE_KR_TO_CODE = {
  "벽걸이":   "wall",
  "스탠드":   "stand",
  "1way":     "1way",
  "4way":     "4way",
  "투인원":   "2in1",
  "2way":     "2way",
  "원형":     "round",
  "시스템멀티": "multi",
};

export function applianceCodeFromKr(kr) {
  if (!kr) return null;
  return APPLIANCE_KR_TO_CODE[String(kr).trim()] || null;
}

// 2026-06-03 — Phase 2b-2: 측측 측측 RPC.
//   Migration 089 측측 create_refrigerant_task_from_addon 측측.
//   사장님 측측 SQL 측측 측측 측측 (PGRST202) 측측 graceful: { ok:false, error }.
//   측측 측측 측측 측측 측측 (멱등 가드 측측 트랜잭션 측측 측측 측측 measure 측측).
export async function createRefrigerantTaskFromAddon(sourceTaskId) {
  if (!sourceTaskId) return { ok: false, error: "missing_source_task_id" };
  try {
    const { data, error } = await supabase.rpc("create_refrigerant_task_from_addon", {
      p_source_task_id: sourceTaskId,
    });
    if (error) {
      console.warn("[refrigerantAddonsDb.create] RPC error:", error.message);
      return { ok: false, error: error.message || "rpc_error" };
    }
    if (!data || data.ok === false) {
      return { ok: false, error: data?.error || "create_failed" };
    }
    return {
      ok:             true,
      new_task_id:    data.new_task_id,
      task_no:        data.task_no,
      principal_code: data.principal_code,
      engineer:       Number(data.engineer) || 0,
      principal:      Number(data.principal) || 0,
      company:        Number(data.company) || 0,
      track:          data.track || "A",
      consent_copied: !!data.consent_copied,
    };
  } catch (e) {
    console.warn("[refrigerantAddonsDb.create] 예외:", e?.message);
    return { ok: false, error: e?.message || "exception" };
  }
}

// 분배 측측 RPC.
//   principalCode  — 라우팅된 원청 (사용자 측측 usol_n→usol_h).
//   applianceKr    — refrigerant_addon.appliance (한글).
//   amount         — refrigerant_addon.amount.
//   engineerId     — 배정 기사 UUID (NULL 측측 rate=50 fallback).
// 반환: { ok, engineer, principal, company, total, calc_method, refrigerant_rate } 또는 { ok:false, error }.
export async function previewRefrigerantSplit({ principalCode, applianceKr, amount, engineerId }) {
  if (!principalCode || !applianceKr || !amount || amount <= 0) {
    return { ok: false, error: "invalid_args" };
  }
  const applianceCode = applianceCodeFromKr(applianceKr);
  if (!applianceCode) {
    return { ok: false, error: "appliance_map_missing" };
  }
  try {
    const { data, error } = await supabase.rpc("preview_refrigerant_split", {
      p_principal_code: principalCode,
      p_appliance_code: applianceCode,
      p_amount:         Number(amount),
      p_engineer_id:    engineerId || null,
    });
    if (error) {
      // PGRST202 = function not found 등. graceful fallback.
      console.warn("[refrigerantAddonsDb.previewSplit] RPC error:", error.message);
      return { ok: false, error: error.message || "rpc_error" };
    }
    if (!data || data.ok === false) {
      return { ok: false, error: data?.error || "preview_failed" };
    }
    return {
      ok:               true,
      engineer:         Number(data.engineer) || 0,
      principal:        Number(data.principal) || 0,
      company:          Number(data.company) || 0,
      total:            Number(data.total) || 0,
      calc_method:      data.calc_method || null,
      refrigerant_rate: Number(data.refrigerant_rate) || 0,
    };
  } catch (e) {
    console.warn("[refrigerantAddonsDb.previewSplit] 예외:", e?.message);
    return { ok: false, error: e?.message || "exception" };
  }
}
