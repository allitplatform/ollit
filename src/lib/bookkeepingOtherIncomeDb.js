// 2026-06-14 — 가계부 기타 수입 DB 모듈 (Mig 124 테이블 + Mig 125 RPC 4개).
//
// 사장님 spec:
//   가계부 수익이 일정산(track A) + 유솔N(track B)만 자동 계산 → 손익 과소.
//   세스코 수수료·개인건 등 수동 수입 입력. 운영비와 대칭 구조.
//
// 권한: PWA anon + custom auth → RLS 통과 X. 모든 호출 SECURITY DEFINER RPC 경유.
//   p_actor uuid + role IN (owner/admin/operator) 검증.
//
// ⚠️ work_month 와 income_date 의 YYYY-MM 강제 일치 (RPC + DB CHECK 양쪽).
//   불일치 시 error: 'income_date month must match work_month'.

import { supabase } from "./supabase.js";

// 카테고리 enum (Mig 124 CHECK 일치)
export const OTHER_INCOME_CATEGORIES = ["commission", "personal", "etc"];
export const OTHER_INCOME_CATEGORY_KO = {
  commission: "수수료",
  personal:   "개인건",
  etc:        "기타",
};

// 공통 RPC 헬퍼 (다른 가계부 모듈 동일)
async function callRpc(name, args, fallback = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[bookkeepingOtherIncomeDb.${name}]`, error);
    return { ok: false, error: error.message || "RPC 호출 실패", ...fallback };
  }
  return data || { ok: false, error: "빈 응답", ...fallback };
}

// ============================================================
// 목록
// ============================================================
export async function listOtherIncome(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", rows: [] };
  if (!actor)     return { ok: false, error: "actor 필수", rows: [] };
  return callRpc("bookkeeping_list_other_income", {
    p_work_month: workMonth,
    p_actor:      actor,
  }, { rows: [] });
}

// ============================================================
// 추가
// ============================================================
export async function addOtherIncome({ workMonth, category, amount, incomeDate, memo, actor } = {}) {
  if (!workMonth || !category || amount == null || !incomeDate) {
    return { ok: false, error: "workMonth/category/amount/incomeDate 필수" };
  }
  if (!OTHER_INCOME_CATEGORIES.includes(category)) {
    return { ok: false, error: `잘못된 카테고리: ${category}` };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return { ok: false, error: "금액은 0 이상 숫자" };
  }
  if (!actor) return { ok: false, error: "actor 필수" };
  // 클라 측 사전 검증 (RPC에서도 다시 검사)
  if (String(incomeDate).slice(0, 7) !== workMonth) {
    return { ok: false, error: "income_date 월이 work_month 와 일치해야 함" };
  }

  return callRpc("bookkeeping_add_other_income", {
    p_work_month:  workMonth,
    p_category:    category,
    p_amount:      Math.round(amt),
    p_income_date: incomeDate,
    p_memo:        memo || "",
    p_actor:       actor,
  });
}

// ============================================================
// 수정
// ============================================================
export async function updateOtherIncome({ id, category, amount, incomeDate, memo, actor } = {}) {
  if (!id) return { ok: false, error: "id 필수" };
  if (!category || !OTHER_INCOME_CATEGORIES.includes(category)) {
    return { ok: false, error: `카테고리 필수/유효 필요: ${category}` };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return { ok: false, error: "금액은 0 이상 숫자" };
  }
  if (!incomeDate) return { ok: false, error: "incomeDate 필수" };
  if (!actor)      return { ok: false, error: "actor 필수" };

  return callRpc("bookkeeping_update_other_income", {
    p_id:          id,
    p_category:    category,
    p_amount:      Math.round(amt),
    p_income_date: incomeDate,
    p_memo:        memo || "",
    p_actor:       actor,
  });
}

// ============================================================
// 삭제
// ============================================================
export async function deleteOtherIncome(id, actor) {
  if (!id)    return { ok: false, error: "id 필수" };
  if (!actor) return { ok: false, error: "actor 필수" };
  return callRpc("bookkeeping_delete_other_income", {
    p_id:    id,
    p_actor: actor,
  });
}
