// 2026-06-14 — 유솔N 정산 현황판 DB 모듈 (Mig 130 RPC 3개).
//
// 사장님 spec:
//   기존 task_items 4단계 시스템(Mig 038) 재활용.
//   신규 = engineer_settled_at 작업월 일괄 stamp + 집계.
//
// 응답: { ok, ... } | { ok: false, error }.

import { supabase } from "./supabase.js";

async function callRpc(name, args, fallback = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[usolnSettleBoardDb.${name}]`, error);
    return { ok: false, error: error.message || "RPC 호출 실패", ...fallback };
  }
  return data || { ok: false, error: "빈 응답", ...fallback };
}

// ============================================================
// 집계 — 시작월(2026-04) ~ 현재월(KST) 작업월별 4단계 + 마진 + 보정값
// ============================================================
//   반환 shape:
//   {
//     ok, start_month, months: [
//       {
//         wm, item_count, received_count, pending_count, task_count,
//         passthrough_total, passthrough_received, passthrough_pending,
//         engineer_total, engineer_paid, engineer_pending,
//         margin, adjustment_amount, adjustment_memo
//       }
//     ]
//   }
export async function getUsolnSettleBoardSummary(actor) {
  if (!actor) return { ok: false, error: "actor 필수", months: [] };
  return callRpc("usoln_settle_board_summary", { p_actor: actor }, { months: [] });
}

// ============================================================
// 작업월별 engineer_settled_at 일괄 stamp (기사 정산 완료 처리)
// ============================================================
//   반환: { ok, work_month, stamped_count }
export async function markUsolnEngineerSettledByMonth(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수" };
  if (!actor)     return { ok: false, error: "actor 필수" };
  return callRpc("mark_usoln_engineer_settled_by_month", {
    p_work_month: workMonth,
    p_actor:      actor,
  });
}

// ============================================================
// 작업월별 engineer_settled_at 일괄 unstamp (되돌리기)
// ============================================================
//   반환: { ok, work_month, unstamped_count }
export async function unmarkUsolnEngineerSettledByMonth(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수" };
  if (!actor)     return { ok: false, error: "actor 필수" };
  return callRpc("unmark_usoln_engineer_settled_by_month", {
    p_work_month: workMonth,
    p_actor:      actor,
  });
}
