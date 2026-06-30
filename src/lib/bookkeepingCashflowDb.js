// 2026-06-13 — 통장(현금흐름) DB 모듈 (Mig 122 RPC 7개).
//
// 테이블:
//   · bookkeeping_cashflow          — 입출금 거래 (direction in/out)
//   · bookkeeping_cashflow_baseline — 기준 잔고 (1행, UNIQUE tenant_id)
//
// 권한: PWA anon + custom auth → RLS 통과 X. 모든 호출 SECURITY DEFINER RPC 경유.
//   p_actor uuid + role IN (owner/admin/operator) 검증. 가계부 패턴 동일.
//
// 응답 형식: { ok, ... } | { ok: false, error }.

import { supabase } from "./supabase.js";

// 공통 RPC 호출 헬퍼 (가계부 callRpc 와 동일 패턴)
async function callRpc(name, args, fallback = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[bookkeepingCashflowDb.${name}]`, error);
    return { ok: false, error: error.message || "RPC 호출 실패", ...fallback };
  }
  return data || { ok: false, error: "빈 응답", ...fallback };
}

// 거래 direction enum (Mig 122 CHECK 일치)
export const CASHFLOW_DIRECTIONS = ["in", "out"];
export const CASHFLOW_DIRECTION_KO = {
  in:  "들어온 돈",
  out: "나간 돈",
};

// ============================================================
// 거래 (cashflow)
// ============================================================

// workMonth = "YYYY-MM"
export async function listCashflow(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수", rows: [] };
  if (!actor)     return { ok: false, error: "actor 필수", rows: [] };
  return callRpc("bookkeeping_cashflow_list", {
    p_work_month: workMonth,
    p_actor:      actor,
  }, { rows: [] });
}

export async function addCashflow({ direction, amount, flowDate, memo, actor } = {}) {
  if (!direction || amount == null || !flowDate) {
    return { ok: false, error: "direction/amount/flowDate 필수" };
  }
  if (!CASHFLOW_DIRECTIONS.includes(direction)) {
    return { ok: false, error: `잘못된 direction: ${direction}` };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return { ok: false, error: "금액은 0 이상 숫자" };
  }
  if (!actor) return { ok: false, error: "actor 필수" };

  return callRpc("bookkeeping_cashflow_add", {
    p_direction: direction,
    p_amount:    Math.round(amt),
    p_flow_date: flowDate,
    p_memo:      memo || "",
    p_actor:     actor,
  });
}

export async function updateCashflow({ id, direction, amount, flowDate, memo, actor } = {}) {
  if (!id) return { ok: false, error: "id 필수" };
  if (!direction || !CASHFLOW_DIRECTIONS.includes(direction)) {
    return { ok: false, error: `direction 필수/유효 필요: ${direction}` };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return { ok: false, error: "금액은 0 이상 숫자" };
  }
  if (!flowDate) return { ok: false, error: "flowDate 필수" };
  if (!actor)    return { ok: false, error: "actor 필수" };

  return callRpc("bookkeeping_cashflow_update", {
    p_id:        id,
    p_direction: direction,
    p_amount:    Math.round(amt),
    p_flow_date: flowDate,
    p_memo:      memo || "",
    p_actor:     actor,
  });
}

export async function deleteCashflow(id, actor) {
  if (!id)    return { ok: false, error: "id 필수" };
  if (!actor) return { ok: false, error: "actor 필수" };
  return callRpc("bookkeeping_cashflow_delete", {
    p_id:    id,
    p_actor: actor,
  });
}

// ============================================================
// 기준 잔고 (baseline) — 1 row / tenant
// ============================================================

export async function getCashflowBaseline(actor) {
  if (!actor) return { ok: false, error: "actor 필수", row: null };
  return callRpc("bookkeeping_cashflow_baseline_get", {
    p_actor: actor,
  }, { row: null });
}

// upsert (1행만 존재). baseline_amount 음수 허용.
export async function setCashflowBaseline({ baselineDate, baselineAmount, memo, actor } = {}) {
  if (!baselineDate)            return { ok: false, error: "baselineDate 필수" };
  if (baselineAmount == null)   return { ok: false, error: "baselineAmount 필수" };
  if (!actor)                   return { ok: false, error: "actor 필수" };

  const amt = Number(baselineAmount);
  if (!Number.isFinite(amt)) return { ok: false, error: "baselineAmount 숫자 필수" };

  return callRpc("bookkeeping_cashflow_baseline_set", {
    p_baseline_date:   baselineDate,
    p_baseline_amount: Math.round(amt),
    p_memo:            memo || "",
    p_actor:           actor,
  });
}

// ============================================================
// 월 요약 (summary) — month_in/month_out/current_balance
// ============================================================

export async function getCashflowSummary(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수" };
  if (!actor)     return { ok: false, error: "actor 필수" };
  return callRpc("bookkeeping_cashflow_summary", {
    p_work_month: workMonth,
    p_actor:      actor,
  }, { month_in: 0, month_out: 0, current_balance: 0, baseline_amount: 0, total_in: 0, total_out: 0 });
}

// ============================================================
// 일 단위 마감 잔고 + 그날 in/out (Mig 158 bookkeeping_cashflow_day_close)
//   workDate = "YYYY-MM-DD" (KST 기준 date)
//   반환: { ok, flow_date, baseline_date, baseline_amount, day_in, day_out, day_close_balance }
// ============================================================
export async function getCashflowDayClose(workDate, actor) {
  if (!workDate) return { ok: false, error: "workDate 필수" };
  if (!actor)    return { ok: false, error: "actor 필수" };
  return callRpc("bookkeeping_cashflow_day_close", {
    p_date:  workDate,
    p_actor: actor,
  }, { day_in: 0, day_out: 0, day_close_balance: 0, baseline_amount: 0 });
}

// ============================================================
// task_no 일괄 조회 — cashflow source_ref(task_id) UUID 배열 → { uuid: task_no } map
//   auto_engineer_remit 행의 task_no 표시용. 통장 화면 전용 헬퍼.
// ============================================================
export async function fetchTaskNoMap(taskIds) {
  const ids = (taskIds || []).filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("tasks")
    .select("id, task_no")
    .in("id", ids);
  if (error) {
    console.error("[bookkeepingCashflowDb.fetchTaskNoMap]", error);
    return {};
  }
  const map = {};
  for (const r of (data || [])) {
    if (r?.id) map[r.id] = r.task_no || null;
  }
  return map;
}
