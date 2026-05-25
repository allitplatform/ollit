// 유솔앱 — 기사 입금 내역 화면 fetch (Phase 0 / anon SELECT only)
// 2026-05-26
//
// 사장님 spec:
//   · 필터: principal_id=usol_n + status='완료' + extra_fee>0 + cleaning 한정
//           (기사 PWA isTrackC 와 동일 기준)
//   · 기간: 이번 달 (KST 기준 completed_at 월 비교)
//   · 권한: anon SELECT 만 — 새 RPC X (진단 확정)
//   · embed: payments + task_items + assignee(users)

import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// KST 측 month 측 ISO range (UTC) — completed_at 측 KST 월 비교용.
function thisMonthKstRangeUtc(monthOffset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + monthOffset;
  // KST = UTC+9 → KST 00:00 = UTC 전날 15:00. UTC 측 -9시간.
  const start = new Date(Date.UTC(y, m,     1,  -9, 0, 0, 0));    // 이번 달 1일 00:00 KST
  const end   = new Date(Date.UTC(y, m + 1, 1,  -9, 0, 0, 0));    // 다음 달 1일 00:00 KST
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

// cleaning 측 service_types.code === 'cleaning' 또는 work_type name 측 '세척' 포함
function hasCleaningItem(taskItems) {
  if (!Array.isArray(taskItems)) return false;
  return taskItems.some(it => {
    const code = it?.work_types?.service_types?.code;
    if (code === "cleaning") return true;
    const wt = String(it?.work_types?.name || "");
    return wt.includes("세척");
  });
}

// 기사 입금 내역 fetch
//   입력: { principalCode = 'usol_n', monthOffset = 0 (이번 달) }
//   반환: { ok, items: [{ taskId, taskNo, customer, extraFee, fifteenPct, completedAt,
//                         engineerId, engineerCode, engineerName, usolRemittedAt, principalAmount }] }
export async function fetchUsolRemitHistory({ principalCode = "usol_n", monthOffset = 0 } = {}) {
  // 1) principal_id 조회
  const { data: pRow, error: pErr } = await supabase
    .from("principals")
    .select("id, code")
    .eq("code", principalCode)
    .maybeSingle();
  if (pErr || !pRow) {
    return { ok: false, error: pErr?.message || "principal 없음", items: [] };
  }
  const principalId = pRow.id;

  // 2) KST 측 이번 달 range
  const { startISO, endISO } = thisMonthKstRangeUtc(monthOffset);

  // 3) tasks + payments + task_items + assignee embed
  const { data: rows, error } = await supabase
    .from("tasks")
    .select(`
      id, task_no, customer_name, extra_fee, completed_at, assigned_engineer_id,
      payments ( usol_remitted_at, principal_amount, track ),
      task_items ( work_types ( name, service_types ( code ) ) ),
      assignee:users!tasks_assigned_engineer_id_fkey ( id, code, name )
    `)
    .eq("tenant_id", TENANT_ID)
    .eq("principal_id", principalId)
    .eq("status", "완료")
    .gt("extra_fee", 0)
    .gte("completed_at", startISO)
    .lt ("completed_at", endISO)
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("[usolRemitHistoryDb.fetch]", error);
    return { ok: false, error: error.message, items: [] };
  }

  // 4) cleaning 한정 + 평탄화
  const items = (rows || [])
    .filter(r => hasCleaningItem(r.task_items))
    .map(r => {
      const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
      const a = Array.isArray(r.assignee) ? r.assignee[0] : r.assignee;
      const extraFee = Number(r.extra_fee) || 0;
      return {
        taskId:          r.id,
        taskNo:          r.task_no,
        customer:        r.customer_name || "",
        extraFee,
        fifteenPct:      Math.floor(extraFee * 0.15),
        completedAt:     r.completed_at,
        engineerId:      r.assigned_engineer_id || null,
        engineerCode:    a?.code || "",
        engineerName:    a?.name || "(미배정)",
        usolRemittedAt:  p?.usol_remitted_at || null,
        principalAmount: Number(p?.principal_amount) || 0,
      };
    });

  return { ok: true, items };
}

// client-side group by engineer
//   반환: [{ engineerId, engineerCode, engineerName, total15Pct, items: [...], allRemitted }]
//   정렬: 입금 대기(allRemitted=false) 먼저, 완료(true) 아래로. 그 안에서 합계 큰 순.
export function groupByEngineer(items) {
  const map = new Map();
  for (const it of items) {
    const key = it.engineerId || "__noengineer__";
    if (!map.has(key)) {
      map.set(key, {
        engineerId:   it.engineerId,
        engineerCode: it.engineerCode,
        engineerName: it.engineerName,
        items:        [],
        total15Pct:   0,
        allRemitted:  true,
      });
    }
    const g = map.get(key);
    g.items.push(it);
    g.total15Pct += it.fifteenPct;
    if (!it.usolRemittedAt) g.allRemitted = false;
  }
  const arr = [...map.values()];
  arr.sort((a, b) => {
    if (a.allRemitted !== b.allRemitted) return a.allRemitted ? 1 : -1; // 대기 먼저
    return b.total15Pct - a.total15Pct;
  });
  return arr;
}

// 요약 — 대기/완료 합계
export function summarize(items) {
  let pending = 0, done = 0;
  for (const it of items) {
    if (it.usolRemittedAt) done += it.fifteenPct;
    else pending += it.fifteenPct;
  }
  return { pending, done, total: pending + done, count: items.length };
}
