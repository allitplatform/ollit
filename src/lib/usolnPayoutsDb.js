// 2026-06-16 — 유솔N 기사 지급 이력 (append-only) RPC 래퍼.
//   Mig 135 (테이블 + RPC 4개) + Mig 136 (백필) 의존.
//
// RPC 시그니처:
//   ① mark_usoln_payout_by_month(p_work_month, p_round, p_actor)
//   ② mark_usoln_payout_by_item (p_task_item_id, p_round, p_amount, p_actor, p_memo)
//   ③ refund_usoln_payout       (p_task_item_id, p_round, p_amount, p_actor, p_memo)
//   ④ usoln_payouts_summary     (p_work_month, p_actor)
//
// 응답: { ok, ... } | { ok: false, error }.

import { supabase } from "./supabase.js";

async function callRpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[usolnPayoutsDb.${name}]`, error);
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  return data || { ok: false, error: "빈 응답" };
}

// ① 작업월 단위 일괄 지급 (회차 명시).
//   미지급 (engineer_settled_at NULL) + 회사 입금 완료 row 만 대상.
export async function markUsolnPayoutByMonth(workMonth, round, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수" };
  if (!round)     return { ok: false, error: "round 필수" };
  if (!actor)     return { ok: false, error: "actor 필수" };
  return callRpc("mark_usoln_payout_by_month", {
    p_work_month: workMonth,
    p_round:      round,
    p_actor:      actor,
  });
}

// ② 단건 지급 (추가 회차용 / 노일건 등). 금액 명시.
export async function markUsolnPayoutByItem({ taskItemId, round, amount, actor, memo }) {
  if (!taskItemId)        return { ok: false, error: "taskItemId 필수" };
  if (!round)             return { ok: false, error: "round 필수" };
  if (!amount || amount <= 0) return { ok: false, error: "amount 양수 필수" };
  if (!actor)             return { ok: false, error: "actor 필수" };
  return callRpc("mark_usoln_payout_by_item", {
    p_task_item_id: taskItemId,
    p_round:        round,
    p_amount:       Number(amount),
    p_actor:        actor,
    p_memo:         memo || null,
  });
}

// ③ 환불/회수. amount 는 양수로 전달, RPC 가 음수로 INSERT.
export async function refundUsolnPayout({ taskItemId, round, amount, actor, memo }) {
  if (!taskItemId)        return { ok: false, error: "taskItemId 필수" };
  if (!round)             return { ok: false, error: "round 필수" };
  if (!amount || amount <= 0) return { ok: false, error: "amount 양수 필수 (RPC 내부에서 음수 처리)" };
  if (!actor)             return { ok: false, error: "actor 필수" };
  return callRpc("refund_usoln_payout", {
    p_task_item_id: taskItemId,
    p_round:        round,
    p_amount:       Number(amount),
    p_actor:        actor,
    p_memo:         memo || null,
  });
}

// ④ 회차별 집계 (1차/2차/추가 SUM + 환불 + 순합계).
export async function getUsolnPayoutsSummary(workMonth, actor) {
  if (!workMonth) return { ok: false, error: "workMonth 필수" };
  if (!actor)     return { ok: false, error: "actor 필수" };
  return callRpc("usoln_payouts_summary", {
    p_work_month: workMonth,
    p_actor:      actor,
  });
}
