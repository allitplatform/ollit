// 2026-06-13 — 가계부 DB 모듈 (Mig 114 테이블 + Mig 115 RPC 9개).
//
// 아키텍처:
//   PWA = anon key + sign_in_with_phone (auth.uid()=NULL) → table RLS 차단.
//   → 모든 호출 SECURITY DEFINER RPC 경유 (p_actor uuid + role 검증).
//   다른 모듈 패턴(update_principal_account / mark_principal_daily_remit) 동일.
//
// 호출 측은 actor (= user.user_id) 반드시 전달. 권한: owner / admin / operator.
// 응답: { ok, ... } | { ok: false, error }.

import { supabase } from "./supabase.js";

// 카테고리 enum (Mig 116 — program 제거, labor 추가).
//   순서: 임대료 / 광고비 / 세금 / 식비 / 인건비 / 기타.
//   DB CHECK + RPC validation 도 동일 (Mig 116).
export const EXPENSE_CATEGORIES = ["rent", "ad", "tax", "meal", "labor", "etc"];
export const EXPENSE_CATEGORY_KO = {
  rent:  "임대료",
  ad:    "광고비",
  tax:   "세금",
  meal:  "식비",
  labor: "인건비",
  etc:   "기타",
};

// 공통 — RPC 응답 정리. supabase.rpc 응답 { data, error }.
//   error 면 { ok: false, error: msg }. 없으면 data 그대로 반환.
async function callRpc(name, args, fallback = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[bookkeepingDb.${name}]`, error);
    return { ok: false, error: error.message || "RPC 호출 실패", ...fallback };
  }
  // RPC 반환 jsonb 가 그대로 data 에 들어옴.
  return data || { ok: false, error: "빈 응답", ...fallback };
}

// ============================================================
// 운영비 (expenses)
// ============================================================

// workMonth = "YYYY-MM"
export async function listExpenses(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", rows: [] };
  if (!actor)     return { ok: false, error: "actor 필수", rows: [] };
  return callRpc("bookkeeping_list_expenses", {
    p_work_month: workMonth,
    p_actor:      actor,
  }, { rows: [] });
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
  if (!actor) return { ok: false, error: "actor 필수" };

  return callRpc("bookkeeping_add_expense", {
    p_work_month:   workMonth,
    p_category:     category,
    p_amount:       Math.round(amt),
    p_expense_date: expenseDate,
    p_memo:         memo || "",
    p_actor:        actor,
  });
}

export async function updateExpense({ id, category, amount, expenseDate, memo, actor } = {}) {
  if (!id) return { ok: false, error: "id 필수" };
  if (!category || !EXPENSE_CATEGORIES.includes(category)) {
    return { ok: false, error: `카테고리 필수/유효 필요: ${category}` };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return { ok: false, error: "금액은 0 이상 숫자" };
  }
  if (!expenseDate) return { ok: false, error: "expenseDate 필수" };
  if (!actor)       return { ok: false, error: "actor 필수" };

  return callRpc("bookkeeping_update_expense", {
    p_id:           id,
    p_category:     category,
    p_amount:       Math.round(amt),
    p_expense_date: expenseDate,
    p_memo:         memo || "",
    p_actor:        actor,
  });
}

export async function deleteExpense(id, actor) {
  if (!id)    return { ok: false, error: "id 필수" };
  if (!actor) return { ok: false, error: "actor 필수" };
  return callRpc("bookkeeping_delete_expense", {
    p_id:    id,
    p_actor: actor,
  });
}

// ============================================================
// 이월 (carryover) — 1 행 / 월, RPC upsert
// ============================================================

export async function getCarryover(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", row: null };
  if (!actor)     return { ok: false, error: "actor 필수", row: null };
  return callRpc("bookkeeping_get_carryover", {
    p_work_month: workMonth,
    p_actor:      actor,
  }, { row: null });
}

export async function setCarryover({ workMonth, amount, memo, actor } = {}) {
  if (!workMonth || amount == null) return { ok: false, error: "workMonth/amount 필수" };
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) return { ok: false, error: "금액은 0 이상 숫자" };
  if (!actor) return { ok: false, error: "actor 필수" };

  return callRpc("bookkeeping_set_carryover", {
    p_work_month: workMonth,
    p_amount:     Math.round(amt),
    p_memo:       memo || "",
    p_actor:      actor,
  });
}

// ============================================================
// 분배 (distributions) — (월, 대표) upsert
// ============================================================

export async function listDistributions(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", rows: [] };
  if (!actor)     return { ok: false, error: "actor 필수", rows: [] };
  return callRpc("bookkeeping_list_distributions", {
    p_work_month: workMonth,
    p_actor:      actor,
  }, { rows: [] });
}

export async function setDistribution({ workMonth, repUserId, amount, memo, actor } = {}) {
  if (!workMonth || !repUserId || amount == null) {
    return { ok: false, error: "workMonth/repUserId/amount 필수" };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) return { ok: false, error: "금액은 0 이상 숫자" };
  if (!actor) return { ok: false, error: "actor 필수" };

  return callRpc("bookkeeping_set_distribution", {
    p_work_month:  workMonth,
    p_rep_user_id: repUserId,
    p_amount:      Math.round(amt),
    p_memo:        memo || "",
    p_actor:       actor,
  });
}

export async function deleteDistribution({ workMonth, repUserId, actor } = {}) {
  if (!workMonth || !repUserId) return { ok: false, error: "workMonth/repUserId 필수" };
  if (!actor)                    return { ok: false, error: "actor 필수" };
  return callRpc("bookkeeping_delete_distribution", {
    p_work_month:  workMonth,
    p_rep_user_id: repUserId,
    p_actor:       actor,
  });
}

// ============================================================
// 유솔N 월정산 회사 마진 (Mig 121 RPC v5)
// ============================================================
//   가계부 수입에 합산되는 track B 분 — 매출 리포트(track A) 와 배타라 중복 X.
//   응답: { ok, amount: number } | { ok: false, error }
export async function getUsolNTrackBMargin(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", amount: 0 };
  if (!actor)     return { ok: false, error: "actor 필수", amount: 0 };
  return callRpc("bookkeeping_get_usoln_track_b_margin", {
    p_work_month: workMonth,
    p_actor:      actor,
  }, { amount: 0 });
}

// ============================================================
// 누적 이월 (Mig 126)
// ============================================================
//   시작월(2026-04) 부터 work_month 까지 (그 달 포함) 월별 합산.
//   당월 차이 = (일정산 + 유솔N 전월 + 기타) − 운영비 − 분배.
//   응답: {
//     ok, work_month, start_month,
//     monthly: [{ wm, track_a, usoln, other, expense, distribution, net, monthly_diff, cumulative }],
//     cumulative_carryover: number
//   }
export async function getCumulativeCarryover(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", monthly: [], cumulative_carryover: 0 };
  if (!actor)     return { ok: false, error: "actor 필수", monthly: [], cumulative_carryover: 0 };
  return callRpc("bookkeeping_cumulative_carryover", {
    p_work_month: workMonth,
    p_actor:      actor,
  }, { monthly: [], cumulative_carryover: 0 });
}
