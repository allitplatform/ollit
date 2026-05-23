// 유솔 포털 "내 작업" 탭 — 뷰 A 전용 가벼운 fetch
// 2026-05-23
// 사장님 결정:
//   · 뷰 A (첫 화면) = 오늘 작업 + 통계 카운트만 fetch (전체 885건 X)
//   · 뷰 B = 전체 작업 fetch (기존 getTasks 흐름 그대로 재사용)
//
// 측 catch loadTasksForRole의 in-memory JOIN 패턴(principals / users) 차용 —
// nested embed는 anon RLS 측 측 X.
import { supabase } from "./supabase.js";
import { rowToTask } from "../data/tasksDb.js";
import { v14NormalizeTask } from "../utils/v14Task.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// principal code → id 매핑 캐시
const _pidCache = new Map();
async function resolvePids(codes) {
  const need = codes.filter(c => !_pidCache.has(c));
  if (need.length > 0) {
    const { data } = await supabase.from("principals").select("id, code").in("code", need);
    for (const p of (data || [])) _pidCache.set(p.code, p.id);
  }
  return codes.map(c => _pidCache.get(c)).filter(Boolean);
}

// 오늘 (KST) scheduled_at 범위를 UTC ISO로 변환
function todayKstRangeUtc() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  // KST = UTC+9 → KST 00:00 = UTC 전날 15:00
  const start = new Date(Date.UTC(y, m, d, -9, 0, 0, 0));     // 오늘 00:00 KST
  const end   = new Date(Date.UTC(y, m, d + 1, -9, 0, 0, 0)); // 내일 00:00 KST
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

const TODAY_SELECT = `
  *,
  task_items (
    id, qty, unit_price, subtotal, order_type,
    work_types ( id, name, service_types ( id, code ) ),
    appliance_types ( id, name )
  )
`;

// 오늘(KST) 서비스예정 작업 — 가벼운 쿼리
export async function fetchPrincipalTodayTasks({ principalCodes = [] } = {}) {
  if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
    return { ok: false, error: "principalCodes X", tasks: [] };
  }
  const pids = await resolvePids(principalCodes);
  if (pids.length === 0) return { ok: false, error: "principal_id X", tasks: [] };

  const { startISO, endISO } = todayKstRangeUtc();

  const { data: rows, error } = await supabase
    .from("tasks")
    .select(TODAY_SELECT)
    .eq("tenant_id", TENANT_ID)
    .in("principal_id", pids)
    .gte("scheduled_at", startISO)
    .lt("scheduled_at",  endISO)
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("[principalDashboardDb.today]", error);
    return { ok: false, error: error.message, tasks: [] };
  }
  if (!rows || rows.length === 0) return { ok: true, tasks: [] };

  // in-memory JOIN — principals / users (loadTasksForRole 패턴)
  const principalIds = [...new Set(rows.map(r => r.principal_id).filter(Boolean))];
  const userIds      = [...new Set(rows.map(r => r.assigned_engineer_id).filter(Boolean))];

  let principalMap = new Map();
  if (principalIds.length > 0) {
    const { data } = await supabase
      .from("principals")
      .select("id, code, name, color, prefix")
      .in("id", principalIds);
    principalMap = new Map((data || []).map(p => [p.id, p]));
  }

  let userMap = new Map();
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("users")
      .select("id, code, name, phone")
      .in("id", userIds);
    userMap = new Map((data || []).map(u => [u.id, u]));
  }

  const tasks = rows.map(row => {
    const task = rowToTask(row);
    if (!task) return null;
    if (row.principal_id) {
      const p = principalMap.get(row.principal_id);
      if (p) {
        task.principal     = p.name || "";
        task.principalCode = p.code || "";
      }
    }
    if (row.assigned_engineer_id) {
      const u = userMap.get(row.assigned_engineer_id);
      if (u) {
        task.assignedEngineer = u.name || "";
        task.engineer         = u.name || "";
      }
    }
    return v14NormalizeTask(task);
  }).filter(Boolean);

  return { ok: true, tasks };
}

// 통계 카운트 — status 컬럼만 fetch, client-side group
//   row 본문 없이 status만 받음 — 가벼운 쿼리 (885건 측 catch).
//   취소 제외한 카운트 측 반환.
export async function fetchPrincipalStatusCounts({ principalCodes = [] } = {}) {
  if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
    return { ok: false, error: "principalCodes X", counts: null };
  }
  const pids = await resolvePids(principalCodes);
  if (pids.length === 0) return { ok: false, error: "principal_id X", counts: null };

  const { data, error } = await supabase
    .from("tasks")
    .select("status")
    .eq("tenant_id", TENANT_ID)
    .in("principal_id", pids);

  if (error) {
    console.error("[principalDashboardDb.counts]", error);
    return { ok: false, error: error.message, counts: null };
  }

  const dist = {};
  for (const r of (data || [])) dist[r.status] = (dist[r.status] || 0) + 1;

  // 사장님 spec — 전체 / 진행중 / 완료
  //   전체     = 취소 제외 합
  //   진행중   = 미배정 + 배정 + 확정 + 진행중
  //   완료     = 완료 + visit_only
  const total      = (data || []).filter(r => r.status !== "취소").length;
  const inProgress =
    (dist["미배정"] || 0) + (dist["배정"] || 0) +
    (dist["확정"] || 0)   + (dist["진행중"] || 0);
  const completed  = (dist["완료"] || 0) + (dist["visit_only"] || 0);

  return {
    ok: true,
    counts: { total, inProgress, completed, raw: dist },
  };
}
