// 2026-05-27 — 6원청 (usol_n 제외) tasks fetch 어댑터
// 운영자 PWA "전체 작업" 화면 전용. UsolN 화면과 분리 — usol_n 은 fetchUsolNTasks 그대로 사용.
//
// 사용:
//   const { tasks, total } = await fetchAllPrincipalTasks({ statusIn: ["배정"], limit: 1000 });
//
// fetchUsolNTasks 의 in-memory JOIN 패턴 그대로 (users / principals 별도 fetch 후 row 에 attach).

import { supabase } from "./supabase.js";

const USOL_N_PRINCIPAL_CODE = "usol_n";

// KST 오늘 UTC 범위 — { startISO, endISO } (KST 00:00 ~ 다음날 00:00 KST = UTC ISO).
//   .slice(0,10) / startsWith 같은 UTC 문자열 비교 금지 (사장님 spec).
//   Asia/Seoul 명시 + Date 측 +09:00 offset 측 측 정확.
function kstTodayRangeUtc() {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const start = new Date(`${ymd}T00:00:00+09:00`);
  const end   = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

let _principalCache = null; // { byId: Map, byCode: Map, otherIds: string[] }

// principals 1회 lookup + usol_n 제외한 6개 ID 캐시
async function getPrincipalCache() {
  if (_principalCache) return _principalCache;
  const { data, error } = await supabase
    .from("principals")
    .select("id, code, name");
  if (error || !Array.isArray(data)) {
    console.error("[allPrincipalTasksDb.getPrincipalCache]", error);
    return null;
  }
  const byId = new Map(data.map(p => [p.id, p]));
  const byCode = new Map(data.map(p => [p.code, p]));
  const otherIds = data
    .filter(p => p.code !== USOL_N_PRINCIPAL_CODE)
    .map(p => p.id);
  _principalCache = { byId, byCode, otherIds };
  return _principalCache;
}

// 6원청 tasks fetch — task_items + work_types + appliance_types inline JOIN
// 옵션:
//   statusIn:   string[] (예: ["배정","확정"] / null = 전체)
//   searchTerm: string (고객명 / 작업번호 / 주소 / 기사명 — 기사명은 클라 필터)
//   limit:      number (기본 1000)
//   offset:     number (기본 0)
//
// 응답: { ok, tasks, total, principals } | { ok: false, error, tasks: [], total: 0 }
//   각 task 에 추가 속성:
//     · principalCode  : "allday" / "KA" / ...
//     · principalName  : "올데이케어" / ...
//     · assignedEngineer / assignedEngineerCode / engineerPhone (배정 기사 in-memory JOIN)
export async function fetchAllPrincipalTasks({
  statusIn   = null,
  searchTerm = "",
  limit      = 1000,
  offset     = 0,
  quickFilter = null,        // 2026-06-06 — 'todayCreated' | 'todayCompleted' | 'confirmed' | null
  principalCodes = null,     // 2026-06-06 — null = 6원청 default (운영자) / ['KA'] = 원청 측 자기 task 만
} = {}) {
  const cache = await getPrincipalCache();
  if (!cache) {
    return { ok: false, error: "principals 캐시 실패", tasks: [], total: 0, principals: null };
  }
  const { byCode, otherIds, byId } = cache;
  // principalCodes 측 측 → 측 측 측 측 측. 측 → 6원청 default.
  let pids;
  if (Array.isArray(principalCodes) && principalCodes.length > 0) {
    pids = principalCodes.map(code => byCode.get(code)?.id).filter(Boolean);
  } else {
    pids = otherIds;
  }
  if (pids.length === 0) {
    return { ok: true, tasks: [], total: 0, principals: cache };
  }

  // 2026-05-31 — Supabase JS max_rows=1000 cap 측 페이지네이션 loop 측 전체 fetch.
  //   증상: 6원청 합 1192+건 측 단일 fetch (옛: .range(0, limit-1)) 측 1000건만 반환 → 192건+ 누락.
  //         → 운영자 "전체 작업" 화면 측 원청 칩 카운트 / 검색 결과 측 부정확.
  //   처방: PAGE_SIZE=1000 측 loop, limit (사용자 측 max) 측 도달하거나 page 측 < PAGE_SIZE 측 break.
  //         count:"exact" 측 첫 페이지 측만 (이후 페이지 측 estimated — 비용 절감).
  //         안정 정렬 측 id ASC secondary key 추가 (received_at 측 ties 측 페이지 측 순서 보장).
  //   안전: MAX_PAGES=50 (≈50,000 row 측 상한) — 무한 loop 차단. Phase 1 MVP 측 충분.
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 50;
  const accumulated = [];
  let totalCount = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const remaining = limit - accumulated.length;
    if (remaining <= 0) break;  // 사용자 측 limit 도달
    const thisPageSize = Math.min(PAGE_SIZE, remaining);
    const pageOffset = offset + page * PAGE_SIZE;

    let q = supabase
      .from("tasks")
      .select(
        `id, task_no, customer_name, phone, address, district,
         status, assignment_type,
         product_price, extra_fee, travel_fee, total_amount,
         category_data, principal_id,
         recommended_engineer_id, assigned_engineer_id,
         requested_date, scheduled_at, started_at, completed_at, received_at,
         work_memo,
         task_items (
           id, qty, unit_price, subtotal, description, order_type,
           work_types ( id, name ),
           appliance_types ( id, name )
         )`,
        { count: page === 0 ? "exact" : "estimated" }
      )
      .in("principal_id", pids)
      .order("received_at", { ascending: false })
      .order("id", { ascending: true })  // 페이지 측 안정 정렬 측 secondary key
      .range(pageOffset, pageOffset + thisPageSize - 1);

    // 2026-06-06 — quickFilter: AllTasksScreen 상단 카운트 박스 3개 측 측. statusIn 보다 우선.
    //   · todayCreated   : created_at KST 오늘 (status 무관)
    //   · todayCompleted : status='완료' AND completed_at KST 오늘
    //   · confirmed      : status='확정' (날짜 무관)
    if (quickFilter === "todayCreated") {
      const { startISO, endISO } = kstTodayRangeUtc();
      q = q.gte("created_at", startISO).lt("created_at", endISO);
    } else if (quickFilter === "todayCompleted") {
      const { startISO, endISO } = kstTodayRangeUtc();
      q = q.eq("status", "완료")
           .gte("completed_at", startISO).lt("completed_at", endISO);
    } else if (quickFilter === "confirmed") {
      q = q.eq("status", "확정");
    } else if (Array.isArray(statusIn) && statusIn.length > 0) {
      q = q.in("status", statusIn);
    }

    // 검색어 — task 본체 4개 필드 or ilike (기사명은 클라이언트 필터)
    const kw = (searchTerm || "").trim();
    if (kw) {
      const esc = kw.replace(/[%_]/g, "\\$&");
      q = q.or(
        `customer_name.ilike.%${esc}%,task_no.ilike.%${esc}%,address.ilike.%${esc}%,phone.ilike.%${esc}%`
      );
    }

    const { data, count, error } = await q;
    if (error) {
      console.error("[allPrincipalTasksDb.fetch]", error);
      return { ok: false, error: error.message, tasks: [], total: 0, principals: cache };
    }
    if (page === 0) totalCount = count || 0;
    if (!data || data.length === 0) break;
    accumulated.push(...data);
    if (data.length < thisPageSize) break;  // 마지막 페이지 측 break
  }

  // users in-memory JOIN — 누적된 모든 row 측 (한 번에)
  const engineerIds = [...new Set(accumulated.map(r => r.assigned_engineer_id).filter(Boolean))];
  let userMap = new Map();
  if (engineerIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, code, name, phone")
      .in("id", engineerIds);
    userMap = new Map((users || []).map(u => [u.id, u]));
  }

  const enriched = accumulated.map(row => {
    const p = byId.get(row.principal_id);
    const out = {
      ...row,
      principalCode: p?.code || "",
      principalName: p?.name || "",
    };
    if (row.assigned_engineer_id) {
      const u = userMap.get(row.assigned_engineer_id);
      if (u) {
        out.assignedEngineer     = u.name || "";
        out.assignedEngineerCode = u.code || "";
        out.engineerPhone        = u.phone || "";
      }
    }
    return out;
  });

  return { ok: true, tasks: enriched, total: totalCount, principals: cache };
}

// 2026-06-06 — 상단 카운트 박스 3개 측 DB count:exact head fetch.
//   호출처:
//     · AllTasksScreen (운영자)  — principalCodes 측 measure → 6원청 (usol_n 제외) 전부.
//     · PrincipalListTab (원청) — principalCodes 측 ['KA'] 또는 ['crikrin'] 측 측.
//   클라 fetch-all 후 reduce 금지 (1000행 캡).
//   응답: { ok, counts: { todayCreated, todayCompleted, confirmed } }
export async function fetchAllPrincipalCounts({ principalCodes = null } = {}) {
  const cache = await getPrincipalCache();
  if (!cache) {
    return { ok: false, error: "principals 캐시 실패", counts: { todayCreated: 0, todayCompleted: 0, confirmed: 0 } };
  }
  // principalCodes 측 measure → 6원청 (usol_n 제외, 운영자 default).
  //   측 → 측 code 측 측 id 측 매핑 (KA/crikrin 등).
  let pids;
  if (Array.isArray(principalCodes) && principalCodes.length > 0) {
    pids = principalCodes
      .map(code => cache.byCode.get(code)?.id)
      .filter(Boolean);
  } else {
    pids = cache.otherIds;   // 운영자 default
  }
  if (pids.length === 0) {
    return { ok: false, error: "principal id 매핑 실패", counts: { todayCreated: 0, todayCompleted: 0, confirmed: 0 } };
  }

  const { startISO, endISO } = kstTodayRangeUtc();

  const [c1, c2, c3] = await Promise.all([
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .in("principal_id", pids)
      .gte("created_at", startISO).lt("created_at", endISO),
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .in("principal_id", pids)
      .eq("status", "완료")
      .gte("completed_at", startISO).lt("completed_at", endISO),
    supabase.from("tasks")
      .select("id", { count: "exact", head: true })
      .in("principal_id", pids)
      .eq("status", "확정"),
  ]);

  if (c1.error || c2.error || c3.error) {
    console.error("[allPrincipalTasksDb.counts]", c1.error || c2.error || c3.error);
    return { ok: false, error: "count 조회 실패", counts: { todayCreated: 0, todayCompleted: 0, confirmed: 0 } };
  }

  return {
    ok: true,
    counts: {
      todayCreated:   c1.count || 0,
      todayCompleted: c2.count || 0,
      confirmed:      c3.count || 0,
    },
  };
}

// 6원청 코드 목록 (UI 칩 표시 / 기본 정렬용)
// 화면에서 import 해서 칩 라벨/순서 결정에 사용.
export const PRINCIPAL_CHIP_ORDER = [
  { code: "allday",   label: "올데이" },
  { code: "KA",       label: "에어컨프로" },
  { code: "KB",       label: "쿨가이" },
  { code: "yongin",   label: "용인" },
  { code: "usol_h",   label: "유솔H" },
  { code: "crikrin",  label: "크리크린" },
];
