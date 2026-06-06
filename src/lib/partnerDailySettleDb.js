// 2026-06-06 — KA/crikrin 일정산 데이터 layer.
//   원청 PWA 일정산 화면 + 운영자 일정산 탭 둘 다 사용.
//
// fetchPartnerDailySettle({ principalCodes, monthsBack }):
//   - tasks 측 (status IN '완료'/'취소'/'visit_only') + payments JOIN.
//   - completed_at(KST) 기준 일별 그룹. 취소/출장만 → 그룹은 같이 들어가나 amount=0.
//   - principal_daily_remittances (Mig 100) 조회 → 일별 입금완료 상태.
//   - Supabase 1000행 캡 페이지 loop.
//
// mark/undo RPC wrappers — 운영자(owner/admin/operator)만 호출 가능 (RPC 측 검증).

import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// principal code → id
async function resolvePrincipals(codes) {
  const { data } = await supabase.from("principals").select("id, code").in("code", codes);
  return data || [];
}

// KST YYYY-MM-DD
export function toKstYmd(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

export function ymdKstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// principal 일별 정산 데이터 fetch
//   응답: { ok, days: [...], remits: [...], principalsMap: { id: code } }
export async function fetchPartnerDailySettle({ principalCodes = [], monthsBack = 3 } = {}) {
  if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
    return { ok: false, error: "principalCodes 없음", days: [], remits: [], principalsMap: {} };
  }
  const principals = await resolvePrincipals(principalCodes);
  if (!principals.length) {
    return { ok: false, error: "principal id 매핑 실패", days: [], remits: [], principalsMap: {} };
  }
  const pids = principals.map(p => p.id);
  const principalsMap = Object.fromEntries(principals.map(p => [p.id, p.code]));

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  cutoff.setHours(0, 0, 0, 0);

  const SELECT = `
    id, task_no, customer_name, status,
    principal_id, scheduled_at, completed_at, received_at,
    task_items (qty, appliance_types (name), work_types (name)),
    payment:payments (principal_amount, status, computed_at)
  `;

  const PAGE = 1000;
  const MAX_PAGES = 20;
  let rows = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const offset = p * PAGE;
    const { data, error } = await supabase.from("tasks")
      .select(SELECT)
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids)
      .in("status", ["완료", "취소", "visit_only"])
      .gte("received_at", cutoff.toISOString())
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error("[partnerDailySettleDb.fetch]", error);
      return { ok: false, error: error.message, days: [], remits: [], principalsMap };
    }
    if (!data || data.length === 0) break;
    rows = rows.concat(data);
    if (data.length < PAGE) break;
  }

  // 일별 그룹 (KST)
  //   grouping date 우선순위: completed_at > scheduled_at > received_at
  //   취소/visit_only 측 amount=0 (compute_payment 측 status='취소' 시 0). 카운트는 포함.
  const dayMap = new Map();
  for (const row of rows) {
    const groupingISO = row.completed_at || row.scheduled_at || row.received_at;
    const ymd = toKstYmd(groupingISO);
    if (!ymd) continue;
    const key = `${row.principal_id}|${ymd}`;
    if (!dayMap.has(key)) {
      dayMap.set(key, {
        key, ymd,
        principal_id: row.principal_id,
        principal_code: principalsMap[row.principal_id] || "",
        count: 0, completedCount: 0, cancelCount: 0,
        total: 0,
        tasks: [],
      });
    }
    const g = dayMap.get(key);
    const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment;
    const principalAmount = Number(payment?.principal_amount) || 0;
    const isCanceled = (row.status === "취소" || row.status === "visit_only");
    g.count += 1;
    if (isCanceled) g.cancelCount += 1;
    else g.completedCount += 1;
    g.total += isCanceled ? 0 : principalAmount;
    // 작업 줄 요약
    const items = row.task_items || [];
    const summary = items.length > 0
      ? items.map(it => `${it.appliance_types?.name || "(기종?)"}×${it.qty || 1}`).join(" + ")
      : "";
    g.tasks.push({
      task_id: row.id,
      task_no: row.task_no,
      customer: row.customer_name || "",
      summary,
      principal_amount: principalAmount,
      status: row.status,
      isCanceled,
    });
  }
  const days = [...dayMap.values()].sort((a, b) => b.ymd.localeCompare(a.ymd));

  // 입금완료 상태 (principal_daily_remittances)
  const { data: remits } = await supabase
    .from("principal_daily_remittances")
    .select("principal_id, settle_date, remitted_amount, remitted_at, remitted_by, note")
    .in("principal_id", pids);

  return { ok: true, days, remits: remits || [], principalsMap };
}

// 운영자 mark/undo RPC wrappers (owner/admin/operator 만 통과 — RPC 측 검증)
export async function markPartnerDailyRemit({ principalId, settleDate, amount, actor }) {
  if (!principalId || !settleDate || actor == null) {
    return { ok: false, error: "필수 인자 누락" };
  }
  const { data, error } = await supabase.rpc("mark_principal_daily_remit", {
    p_principal_id: principalId,
    p_settle_date:  settleDate,
    p_amount:       Math.max(0, Number(amount) || 0),
    p_actor:        actor,
  });
  if (error) {
    console.error("[markPartnerDailyRemit] rpc:", error);
    return { ok: false, error: error.message || "rpc_error" };
  }
  return data || { ok: false, error: "empty_response" };
}

export async function undoPartnerDailyRemit({ principalId, settleDate, actor }) {
  if (!principalId || !settleDate || actor == null) {
    return { ok: false, error: "필수 인자 누락" };
  }
  const { data, error } = await supabase.rpc("undo_principal_daily_remit", {
    p_principal_id: principalId,
    p_settle_date:  settleDate,
    p_actor:        actor,
  });
  if (error) {
    console.error("[undoPartnerDailyRemit] rpc:", error);
    return { ok: false, error: error.message || "rpc_error" };
  }
  return data || { ok: false, error: "empty_response" };
}

export function describeDailyRemitError(code) {
  switch (code) {
    case "role_not_allowed":   return "운영자(owner/admin/operator) 만 변경할 수 있어요.";
    case "principal_not_found": return "원청 정보를 찾을 수 없어요.";
    case "amount_invalid":     return "금액이 올바르지 않아요.";
    case "settle_date_required": return "날짜가 비어 있어요.";
    case "rpc_error":          return "서버 오류가 발생했어요.";
    default:                    return code || "처리 실패";
  }
}
