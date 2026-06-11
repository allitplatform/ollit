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

// 통계 카운트 — DB 측 count:exact head 3개 Promise.all (1 RTT).
//   사장님 spec (2026-06-11 갱신):
//     전체     = 모든 status (취소 / visit_only / 취소요청 전부 포함).
//                옛 spec "취소 제외" 폐기 — 헤더 카운트 1207 사고 (실제 1342) catch.
//     진행중   = 미배정 + 배정 + 확정 + 진행중 → .in('status', [...]).
//     완료     = 완료 + visit_only            → .in('status', [...]).
//   2026-06-11 — 옛 .range() 페이지 루프 + 클라 group 폐기. row 본문 0 fetch.
//     fetchAllPrincipalCounts 측 동일 패턴 재사용. max_rows cap 무관.
export async function fetchPrincipalStatusCounts({ principalCodes = [] } = {}) {
  if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
    return { ok: false, error: "principalCodes X", counts: null };
  }
  const pids = await resolvePids(principalCodes);
  if (pids.length === 0) return { ok: false, error: "principal_id X", counts: null };

  const [cTotal, cInProg, cDone] = await Promise.all([
    // 2026-06-11 — .neq("status", "취소") 제거. 전체 = 모든 status 합.
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids),
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids)
      .in("status", ["미배정", "배정", "확정", "진행중"]),
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids)
      .in("status", ["완료", "visit_only"]),
  ]);

  if (cTotal.error || cInProg.error || cDone.error) {
    console.error("[principalDashboardDb.counts]",
      cTotal.error || cInProg.error || cDone.error);
    return { ok: false, error: "count 조회 실패", counts: null };
  }

  return {
    ok: true,
    counts: {
      total:      cTotal.count  || 0,
      inProgress: cInProg.count || 0,
      completed:  cDone.count   || 0,
    },
  };
}

// ============================================================================
// 2026-06-11 — PC 내 작업 표 측 서버 페이지네이션 fetch.
//   원청 PWA "전체" 탭 측 1,342건 fetch 측 Supabase 1000행 캡 임박.
//   서버 페이지 (range) + DB ORDER BY (status_order, scheduled_at) 측 캡 회피 + 속도.
//
//   activeOnly = true (default)  → status IN ('배정','확정','진행중') = 활성만.
//   activeOnly = false           → 전체 status (검색 측 사용).
//   search = "" → ilike 미적용. 값 있으면 customer_name/district/address/task_no 측 OR ilike.
//
//   응답: { ok, tasks: TaskV14[], total: <전체건수>, hasMore: boolean }.
//     hasMore = offset + tasks.length < total.
//
//   의존: Migration 110 (tasks.status_order STORED generated column).
//     SQL 측 실행 전 측 .order("status_order") 측 column 미존재 에러 (42703).
//
//   호출처: PrincipalListTab (PC view='all' 또는 검색 측).
// ============================================================================
const ACTIVE_STATUSES = ["배정", "확정", "진행중"];

export async function fetchPrincipalListPaged({
  principalCodes = [],
  activeOnly = true,
  search = "",
  pageSize = 100,
  offset = 0,
} = {}) {
  if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
    return { ok: false, error: "principalCodes X", tasks: [], total: 0, hasMore: false };
  }
  const pids = await resolvePids(principalCodes);
  if (pids.length === 0) {
    return { ok: false, error: "principal_id X", tasks: [], total: 0, hasMore: false };
  }

  let q = supabase
    .from("tasks")
    .select(TODAY_SELECT, { count: "exact" })
    .eq("tenant_id", TENANT_ID)
    .in("principal_id", pids);

  if (activeOnly) {
    q = q.in("status", ACTIVE_STATUSES);
  }

  const term = String(search || "").trim();
  if (term) {
    // ilike OR — PostgREST 측 customer_name / district / address / task_no 동시 검색.
    //   사용자 입력 측 % , 측 sanitize (PostgREST 측 ", () . " 구분자 위험).
    const safe = term.replace(/[%,()*]/g, " ");
    if (safe) {
      q = q.or(
        `customer_name.ilike.%${safe}%,` +
        `district.ilike.%${safe}%,` +
        `address.ilike.%${safe}%,` +
        `task_no.ilike.%${safe}%`
      );
    }
  }

  // DB ORDER BY — status_order (Migration 110 generated column) → scheduled_at DESC.
  q = q.order("status_order", { ascending: true })
       .order("scheduled_at", { ascending: false, nullsFirst: false });

  q = q.range(offset, offset + pageSize - 1);

  const { data, error, count } = await q;
  if (error) {
    console.error("[fetchPrincipalListPaged]", error);
    return { ok: false, error: error.message, tasks: [], total: 0, hasMore: false };
  }

  // in-memory JOIN — principals / users (loadTasksForRole 패턴 동일).
  const principalIds = [...new Set((data || []).map(r => r.principal_id).filter(Boolean))];
  const userIds      = [...new Set((data || []).map(r => r.assigned_engineer_id).filter(Boolean))];

  let principalMap = new Map();
  if (principalIds.length > 0) {
    const { data: pData } = await supabase
      .from("principals")
      .select("id, code, name, color, prefix")
      .in("id", principalIds);
    principalMap = new Map((pData || []).map(p => [p.id, p]));
  }

  let userMap = new Map();
  if (userIds.length > 0) {
    const { data: uData } = await supabase
      .from("users")
      .select("id, code, name, phone")
      .in("id", userIds);
    userMap = new Map((uData || []).map(u => [u.id, u]));
  }

  const tasks = (data || []).map(row => {
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

  const total = count || 0;
  return {
    ok: true,
    tasks,
    total,
    hasMore: offset + tasks.length < total,
  };
}
