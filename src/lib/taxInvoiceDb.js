// 2026-06-01 Phase B (B2) — 기사 세금계산서 발행/확인 상태 lib 래퍼.
//
// 데이터 모델 (engineer_tax_invoices):
//   engineer_id  uuid  (FK users.id)
//   ym           text  ("YYYY-MM" — KST 기준 정산월)
//   marked_at    timestamptz       (기사가 "발행함" 누른 시각, NULL = 미발행)
//   confirmed_at timestamptz       (운영자가 확인한 시각, NULL = 미확인)
//   confirmed_by uuid              (확인 actor)
//   UNIQUE (engineer_id, ym)
//
// 상태:
//   미발행      = row 없음 OR marked_at NULL
//   발행함·미확인 = marked_at NOT NULL, confirmed_at NULL
//   확인됨      = confirmed_at NOT NULL
//
// 돈 처리 아님 — 상태 기록만. engineer_settled_at / 정산 계산 건드리지 않음.

import { supabase } from "./supabase.js";

// 기사가 "발행함" 마킹 — idempotent UPSERT.
// 응답: { ok, data | error }
export async function markTaxInvoice({ engineerId, ym }) {
  if (!engineerId || !ym) {
    return { ok: false, error: "engineerId 또는 ym 누락" };
  }
  const { data, error } = await supabase.rpc("mark_tax_invoice", {
    p_engineer_id: engineerId,
    p_ym: ym,
  });
  if (error) {
    console.error("[taxInvoiceDb.mark]", error);
    return { ok: false, error: error.message || "발행 마킹 실패" };
  }
  return { ok: true, data };
}

// 단건 select (기사앱 박스 상태 표시용).
// 응답: { ok, invoice | error } — invoice null 이면 미발행.
export async function fetchTaxInvoice({ engineerId, ym }) {
  if (!engineerId || !ym) {
    return { ok: false, error: "engineerId 또는 ym 누락", invoice: null };
  }
  const { data, error } = await supabase
    .from("engineer_tax_invoices")
    .select("engineer_id, ym, marked_at, confirmed_at, confirmed_by")
    .eq("engineer_id", engineerId)
    .eq("ym", ym)
    .maybeSingle();
  if (error) {
    console.error("[taxInvoiceDb.fetch]", error);
    return { ok: false, error: error.message || "조회 실패", invoice: null };
  }
  return { ok: true, invoice: data || null };
}

// B3 미리 — 운영자 측 확인/취소 + ym 전체 조회.

export async function confirmTaxInvoice({ engineerId, ym, actor }) {
  if (!engineerId || !ym) {
    return { ok: false, error: "engineerId 또는 ym 누락" };
  }
  const { data, error } = await supabase.rpc("confirm_tax_invoice", {
    p_engineer_id: engineerId,
    p_ym: ym,
    p_actor: actor || null,
  });
  if (error) {
    console.error("[taxInvoiceDb.confirm]", error);
    return { ok: false, error: error.message || "확인 처리 실패" };
  }
  return { ok: true, data };
}

export async function unconfirmTaxInvoice({ engineerId, ym }) {
  if (!engineerId || !ym) {
    return { ok: false, error: "engineerId 또는 ym 누락" };
  }
  const { data, error } = await supabase.rpc("unconfirm_tax_invoice", {
    p_engineer_id: engineerId,
    p_ym: ym,
  });
  if (error) {
    console.error("[taxInvoiceDb.unconfirm]", error);
    return { ok: false, error: error.message || "확인 취소 실패" };
  }
  return { ok: true, data };
}

export async function fetchTaxInvoicesByYm({ ym }) {
  if (!ym) {
    return { ok: false, error: "ym 누락", invoices: [] };
  }
  const { data, error } = await supabase
    .from("engineer_tax_invoices")
    .select("engineer_id, ym, marked_at, confirmed_at, confirmed_by")
    .eq("ym", ym);
  if (error) {
    console.error("[taxInvoiceDb.fetchByYm]", error);
    return { ok: false, error: error.message || "조회 실패", invoices: [] };
  }
  return { ok: true, invoices: data || [] };
}
