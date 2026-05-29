// 2026-05-29 — raw_orders audit (Migration 080) 어댑터.
//   CSV 업로드 / 시트 sync 발주 원본 영구 보관 + 검색.
//
// 사용처:
//   · src/lib/usolNTasksDb.js bulkInsertUsolNOrders — safeInsertRawOrder 자동 호출
//   · src/screens/admin/RawOrdersArchiveScreen.jsx — search / get / list
//
// RLS: anon SELECT/INSERT/UPDATE 허용 (DELETE 차단). PWA anon 키 그대로 사용.

import { supabase } from "./supabase.js";
import { currentUserId } from "./cancelRpc.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// ─── INSERT — 단건 (운영 차단 X / 실패 시 console.warn 만) ───
// 입력: { principalCode, source, externalOrderNo?, productOrderNo?, customerName?, phone?,
//        address?, rawPayload, taskId?, notes? }
// 응답: { ok, id? } | { ok: false, error }
//   ⚠ 호출처는 응답 무시해도 안전 — 운영 차단 X 가 의도.
export async function safeInsertRawOrder({
  principalCode,
  source,
  externalOrderNo = null,
  productOrderNo  = null,
  customerName    = null,
  phone           = null,
  address         = null,
  rawPayload,
  taskId          = null,
  notes           = null,
} = {}) {
  if (!principalCode) return { ok: false, error: "principalCode 누락" };
  if (!source)        return { ok: false, error: "source 누락" };
  if (!rawPayload)    return { ok: false, error: "rawPayload 누락" };

  try {
    const uploadedBy = currentUserId() || null;
    const { data, error } = await supabase
      .from("raw_orders")
      .insert({
        tenant_id:         TENANT_ID,
        principal_code:    principalCode,
        source:            source,
        external_order_no: externalOrderNo,
        product_order_no:  productOrderNo,
        customer_name:     customerName,
        phone:             phone,
        address:           address,
        raw_payload:       rawPayload,
        task_id:           taskId,
        uploaded_by:       uploadedBy,
        notes:             notes,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[rawOrdersDb.safeInsert] INSERT 실패 (운영 영향 X):", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    console.warn("[rawOrdersDb.safeInsert] 예외 (운영 영향 X):", e);
    return { ok: false, error: e?.message || "예외" };
  }
}

// ─── SEARCH — 운영자 archive 화면 ───
// 입력 (모두 옵셔널):
//   externalOrderNo (ilike %...%)
//   customerName    (ilike %...%)
//   phone           (eq)
//   principalCode   (eq)
//   startDate       (uploaded_at >= ISO)
//   endDate         (uploaded_at <= ISO)
//   limit           (기본 50)
// 응답: { ok, rows } | { ok: false, error }
export async function searchRawOrders({
  externalOrderNo = null,
  customerName    = null,
  phone           = null,
  principalCode   = null,
  startDate       = null,
  endDate         = null,
  limit           = 50,
} = {}) {
  let q = supabase
    .from("raw_orders")
    .select("*, task:tasks(id, task_no, status, customer_name)")
    .order("uploaded_at", { ascending: false })
    .limit(limit);

  if (externalOrderNo) q = q.ilike("external_order_no", `%${externalOrderNo}%`);
  if (customerName)    q = q.ilike("customer_name",     `%${customerName}%`);
  if (phone)           q = q.eq("phone", phone);
  if (principalCode)   q = q.eq("principal_code", principalCode);
  if (startDate)       q = q.gte("uploaded_at", startDate);
  if (endDate)         q = q.lte("uploaded_at", endDate);

  const { data, error } = await q;
  if (error) {
    console.error("[rawOrdersDb.search]", error);
    return { ok: false, error: error.message, rows: [] };
  }
  return { ok: true, rows: data || [] };
}

// ─── GET BY ID — 단건 상세 ───
export async function getRawOrderById(id) {
  if (!id) return { ok: false, error: "id 누락" };
  const { data, error } = await supabase
    .from("raw_orders")
    .select("*, task:tasks(id, task_no, status, customer_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[rawOrdersDb.getById]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, row: data };
}

// ─── LIST BY TASK ID — 한 task 의 원본 발주 (재업로드 이력 포함) ───
export async function listRawOrdersByTaskId(taskId) {
  if (!taskId) return { ok: false, error: "taskId 누락", rows: [] };
  const { data, error } = await supabase
    .from("raw_orders")
    .select("*")
    .eq("task_id", taskId)
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error("[rawOrdersDb.listByTask]", error);
    return { ok: false, error: error.message, rows: [] };
  }
  return { ok: true, rows: data || [] };
}
