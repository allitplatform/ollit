// 2026-06-13 — 가계부 DB 모듈 (Mig 114 bookkeeping_* 테이블 3개).
//
// 테이블:
//   · bookkeeping_expenses      — 운영비 (다중 행 / 월)
//   · bookkeeping_carryover     — 이월   (1 행 / 월, UNIQUE work_month)
//   · bookkeeping_distributions — 분배   (1 행 / (월, 대표))
//
// 권한: RLS owner/admin/operator 만 통과 (Mig 114 정책). A004 admin role 통과.
//   직접 supabase.from(...) CRUD — 별도 RPC 없음.
//
// tenant_id 모듈 상수 (Phase 1 단일 테넌트, 다른 db 모듈과 동일).
// created_by = actor (= user.user_id).
//
// 응답 형식: { ok, ... } | { ok: false, error }.

import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// 카테고리 enum (Mig 114 CHECK 일치)
export const EXPENSE_CATEGORIES = ["rent", "ad", "tax", "meal", "program", "etc"];
export const EXPENSE_CATEGORY_KO = {
  rent:    "임대료",
  ad:      "광고비",
  tax:     "세금",
  meal:    "식비",
  program: "프로그램비",
  etc:     "기타",
};

// ============================================================
// 운영비 (expenses)
// ============================================================

// workMonth = "YYYY-MM"
export async function listExpenses(workMonth) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", rows: [] };
  const { data, error } = await supabase
    .from("bookkeeping_expenses")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("work_month", workMonth)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[bookkeepingDb.listExpenses]", error);
    return { ok: false, error: error.message, rows: [] };
  }
  return { ok: true, rows: data || [] };
}

export async function addExpense({ workMonth, category, amount, expenseDate, memo, actor } = {}) {
  if (!workMonth || !category || amount == null || !expenseDate) {
    return { ok: false, error: "workMonth/category/amount/expenseDate 필수" };
  }
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return { ok: false, error: `잘못된 카테고리: ${category}` };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return { ok: false, error: "금액은 0 이상 숫자" };
  }
  if (!actor) return { ok: false, error: "actor (user_id) 필수" };

  const row = {
    tenant_id:    TENANT_ID,
    work_month:   workMonth,
    category,
    amount:       Math.round(amt),
    expense_date: expenseDate,
    memo:         memo || null,
    created_by:   actor,
  };
  const { data, error } = await supabase
    .from("bookkeeping_expenses")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[bookkeepingDb.addExpense]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id };
}

export async function updateExpense({ id, category, amount, expenseDate, memo } = {}) {
  if (!id) return { ok: false, error: "id 필수" };
  if (category && !EXPENSE_CATEGORIES.includes(category)) {
    return { ok: false, error: `잘못된 카테고리: ${category}` };
  }
  const patch = { updated_at: new Date().toISOString() };
  if (category    !== undefined) patch.category = category;
  if (amount      !== undefined) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return { ok: false, error: "금액은 0 이상 숫자" };
    patch.amount = Math.round(amt);
  }
  if (expenseDate !== undefined) patch.expense_date = expenseDate;
  if (memo        !== undefined) patch.memo = memo || null;

  const { error } = await supabase
    .from("bookkeeping_expenses")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[bookkeepingDb.updateExpense]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteExpense(id) {
  if (!id) return { ok: false, error: "id 필수" };
  const { error } = await supabase
    .from("bookkeeping_expenses")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[bookkeepingDb.deleteExpense]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ============================================================
// 이월 (carryover) — 월별 1 행, UNIQUE(tenant_id, work_month) upsert
// ============================================================

export async function getCarryover(workMonth) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", row: null };
  const { data, error } = await supabase
    .from("bookkeeping_carryover")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("work_month", workMonth)
    .maybeSingle();
  if (error) {
    console.error("[bookkeepingDb.getCarryover]", error);
    return { ok: false, error: error.message, row: null };
  }
  return { ok: true, row: data || null };
}

export async function setCarryover({ workMonth, amount, memo, actor } = {}) {
  if (!workMonth || amount == null) return { ok: false, error: "workMonth/amount 필수" };
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) return { ok: false, error: "금액은 0 이상 숫자" };
  if (!actor) return { ok: false, error: "actor 필수" };

  const row = {
    tenant_id:  TENANT_ID,
    work_month: workMonth,
    amount:     Math.round(amt),
    memo:       memo || null,
    created_by: actor,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("bookkeeping_carryover")
    .upsert(row, { onConflict: "tenant_id,work_month" })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[bookkeepingDb.setCarryover]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id };
}

// ============================================================
// 분배 (distributions) — (월, 대표) UNIQUE upsert
// ============================================================

export async function listDistributions(workMonth) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", rows: [] };
  const { data, error } = await supabase
    .from("bookkeeping_distributions")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("work_month", workMonth)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[bookkeepingDb.listDistributions]", error);
    return { ok: false, error: error.message, rows: [] };
  }
  return { ok: true, rows: data || [] };
}

export async function setDistribution({ workMonth, repUserId, amount, memo, actor } = {}) {
  if (!workMonth || !repUserId || amount == null) {
    return { ok: false, error: "workMonth/repUserId/amount 필수" };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) return { ok: false, error: "금액은 0 이상 숫자" };
  if (!actor) return { ok: false, error: "actor 필수" };

  const row = {
    tenant_id:              TENANT_ID,
    work_month:             workMonth,
    representative_user_id: repUserId,
    amount:                 Math.round(amt),
    memo:                   memo || null,
    created_by:             actor,
    updated_at:             new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("bookkeeping_distributions")
    .upsert(row, { onConflict: "tenant_id,work_month,representative_user_id" })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[bookkeepingDb.setDistribution]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id };
}

export async function deleteDistribution({ workMonth, repUserId } = {}) {
  if (!workMonth || !repUserId) return { ok: false, error: "workMonth/repUserId 필수" };
  const { error } = await supabase
    .from("bookkeeping_distributions")
    .delete()
    .eq("tenant_id", TENANT_ID)
    .eq("work_month", workMonth)
    .eq("representative_user_id", repUserId);
  if (error) {
    console.error("[bookkeepingDb.deleteDistribution]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
