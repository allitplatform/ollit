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

// 통계 카운트 — DB 측 count:exact head 4개 Promise.all (1 RTT).
//   사장님 spec (2026-06-11 SQL 실측 정합):
//     전체     = 모든 status (무필터).
//     활성     = 배정 + 확정 + 진행중 (미배정 제외 — 원청 시각 "지금 처리할 일감").
//     완료     = status='완료' 단독 (visit_only 분리).
//     취소     = 취소 + 취소요청 + visit_only (현장취소 + 출장만 = 취소 계열 합).
//   합 검증: 활성 + 완료 + 취소 + 미배정 = 전체.
//   응답 키 = { total, inProgress, completed, canceled } — 호환 위해 옛 키 유지.
//   2026-06-11 — 옛 .range() 페이지 루프 + 클라 group 폐기. row 본문 0 fetch.
export async function fetchPrincipalStatusCounts({ principalCodes = [] } = {}) {
  if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
    return { ok: false, error: "principalCodes X", counts: null };
  }
  const pids = await resolvePids(principalCodes);
  if (pids.length === 0) return { ok: false, error: "principal_id X", counts: null };

  const [cTotal, cActive, cDone, cCanceled] = await Promise.all([
    // 전체 = 모든 status 합 (filter 없음).
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids),
    // 활성 = 배정 + 확정 + 진행중 (미배정 제외).
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids)
      .in("status", ["배정", "확정", "진행중"]),
    // 완료 = '완료' 단독 (visit_only 별도).
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids)
      .eq("status", "완료"),
    // 취소 = 취소 + 취소요청 + visit_only (현장취소+출장만 합산).
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids)
      .in("status", ["취소", "취소요청", "visit_only"]),
  ]);

  if (cTotal.error || cActive.error || cDone.error || cCanceled.error) {
    console.error("[principalDashboardDb.counts]",
      cTotal.error || cActive.error || cDone.error || cCanceled.error);
    return { ok: false, error: "count 조회 실패", counts: null };
  }

  return {
    ok: true,
    counts: {
      total:      cTotal.count    || 0,
      inProgress: cActive.count   || 0,   // 호환 키 — UI 라벨 "활성".
      completed:  cDone.count     || 0,
      canceled:   cCanceled.count || 0,
    },
  };
}

// ============================================================================
// 2026-06-11 — PC 사이드바 하단 요약 3개 (DB count:exact head 3개 Promise.all).
//   오늘접수   = received_at KST 오늘 count (tasks).
//   오늘작업   = scheduled_at KST 오늘 count (tasks).
//   정산대기   = task_items 측 subtotal>0 + JOIN tasks.status='완료'
//                + naver_settled_at NULL + principal_id IN usol_n.
//                usol_n 한정 (PrincipalSettleTab summary.pendingCount 정의 정합).
//                principalCodes 측 usol_n 미포함 시 0 반환.
//   응답: { ok, counts: { todayReceived, todayScheduled, pendingSettle } }.
// ============================================================================
export async function fetchPrincipalSidebarSummary({ principalCodes = [] } = {}) {
  const EMPTY = { todayReceived: 0, todayScheduled: 0, pendingSettle: 0 };
  if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
    return { ok: false, counts: EMPTY };
  }
  const pids = await resolvePids(principalCodes);
  if (pids.length === 0) return { ok: false, counts: EMPTY };

  const { startISO, endISO } = todayKstRangeUtc();
  const isUsolNScope = principalCodes.includes("usol_n");

  // 정산대기 — usol_n 한정. task_items JOIN tasks 측 inner.
  //   PostgREST 측 .eq("tasks.status", ...) + .in("tasks.principal_id", ...) 측 inner JOIN 필요.
  //   .is("naver_settled_at", null) → task_items 측 컬럼 (naver_settled_at).
  //   .gt("subtotal", 0) → 부분취소 0원 제외 (PrincipalSettleTab spec 정합).
  const pendingQuery = isUsolNScope
    ? supabase.from("task_items")
        .select("id, tasks!inner(status, principal_id)", { count: "exact", head: true })
        .gt("subtotal", 0)
        .is("naver_settled_at", null)
        .eq("tasks.status", "완료")
        .in("tasks.principal_id", pids)
    : Promise.resolve({ count: 0, error: null });

  const [cReceived, cScheduled, cPending] = await Promise.all([
    // 오늘접수 = received_at KST 오늘.
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids)
      .gte("received_at", startISO)
      .lt("received_at", endISO),
    // 오늘작업 = scheduled_at KST 오늘.
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .in("principal_id", pids)
      .gte("scheduled_at", startISO)
      .lt("scheduled_at", endISO),
    pendingQuery,
  ]);

  if (cReceived.error || cScheduled.error || cPending.error) {
    console.error("[principalDashboardDb.sidebar]",
      cReceived.error || cScheduled.error || cPending.error);
    return { ok: false, counts: EMPTY };
  }

  return {
    ok: true,
    counts: {
      todayReceived:  cReceived.count  || 0,
      todayScheduled: cScheduled.count || 0,
      pendingSettle:  cPending.count   || 0,
    },
  };
}

// ============================================================================
// 2026-06-11 — 검색 전용 RPC 경로 (Migration 111).
//   사장님 spec — 4개 OR ILIKE: customer_name / address / users.name / task_items.product_order_id.
//   PostgREST .or 측 left JOIN nested 측 불가 → search_principal_tasks RPC.
//   응답 task_id 배열 + total_count → 두 번째 tasks .in("id", ids) full fetch.
//   .in 측 정렬 풀림 → RPC 측 id 순서대로 클라 재정렬.
// ============================================================================
async function fetchByTaskIdsOrdered(ids, principalMap = null, userMap = null) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: true, tasks: [] };
  }
  const { data, error } = await supabase
    .from("tasks")
    .select(TODAY_SELECT)
    .in("id", ids);
  if (error) {
    console.error("[fetchByTaskIdsOrdered]", error);
    return { ok: false, error: error.message, tasks: [] };
  }

  // principals / users in-memory JOIN (다른 fetch 패턴 동일).
  const principalIds = [...new Set((data || []).map(r => r.principal_id).filter(Boolean))];
  const userIds      = [...new Set((data || []).map(r => r.assigned_engineer_id).filter(Boolean))];

  let pMap = principalMap || new Map();
  if (!principalMap && principalIds.length > 0) {
    const { data: pData } = await supabase
      .from("principals")
      .select("id, code, name, color, prefix")
      .in("id", principalIds);
    pMap = new Map((pData || []).map(p => [p.id, p]));
  }

  let uMap = userMap || new Map();
  if (!userMap && userIds.length > 0) {
    const { data: uData } = await supabase
      .from("users")
      .select("id, code, name, phone")
      .in("id", userIds);
    uMap = new Map((uData || []).map(u => [u.id, u]));
  }

  const byId = new Map();
  for (const row of data || []) {
    const task = rowToTask(row);
    if (!task) continue;
    if (row.principal_id) {
      const p = pMap.get(row.principal_id);
      if (p) {
        task.principal     = p.name || "";
        task.principalCode = p.code || "";
      }
    }
    if (row.assigned_engineer_id) {
      const u = uMap.get(row.assigned_engineer_id);
      if (u) {
        task.assignedEngineer = u.name || "";
        task.engineer         = u.name || "";
      }
    }
    const normalized = v14NormalizeTask(task);
    if (normalized) byId.set(row.id, normalized);
  }

  // RPC 가 준 id 순서 보존.
  const ordered = ids.map(id => byId.get(id)).filter(Boolean);
  return { ok: true, tasks: ordered };
}

export async function searchPrincipalTasksRpc({
  principalCodes = [],
  activeOnly = false,
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

  const { data, error } = await supabase.rpc("search_principal_tasks", {
    p_principal_ids: pids,
    p_active_only:   !!activeOnly,
    p_search:        String(search || "").trim(),
    p_limit:         pageSize,
    p_offset:        offset,
  });
  if (error) {
    console.error("[searchPrincipalTasksRpc]", error);
    return { ok: false, error: error.message, tasks: [], total: 0, hasMore: false };
  }

  const rows  = Array.isArray(data) ? data : [];
  const ids   = rows.map(r => r.task_id).filter(Boolean);
  const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

  const fetched = await fetchByTaskIdsOrdered(ids);
  return {
    ok: fetched.ok,
    tasks: fetched.tasks,
    total,
    hasMore: offset + ids.length < total,
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
