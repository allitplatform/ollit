// 2026-05-27 — 6원청 (usol_n 제외) tasks fetch 어댑터
// 운영자 PWA "전체 작업" 화면 전용. UsolN 화면과 분리 — usol_n 은 fetchUsolNTasks 그대로 사용.
//
// 사용:
//   const { tasks, total } = await fetchAllPrincipalTasks({ statusIn: ["배정"], limit: 1000 });
//
// fetchUsolNTasks 의 in-memory JOIN 패턴 그대로 (users / principals 별도 fetch 후 row 에 attach).

import { supabase } from "./supabase.js";

const USOL_N_PRINCIPAL_CODE = "usol_n";

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
} = {}) {
  const cache = await getPrincipalCache();
  if (!cache) {
    return { ok: false, error: "principals 캐시 실패", tasks: [], total: 0, principals: null };
  }
  const { otherIds, byId } = cache;
  if (otherIds.length === 0) {
    return { ok: true, tasks: [], total: 0, principals: cache };
  }

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
      { count: "exact" }
    )
    .in("principal_id", otherIds)
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (Array.isArray(statusIn) && statusIn.length > 0) {
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

  // users in-memory JOIN — 기사 이름/코드/전화 (fetchUsolNTasks 와 동일 패턴)
  const engineerIds = [...new Set((data || []).map(r => r.assigned_engineer_id).filter(Boolean))];
  let userMap = new Map();
  if (engineerIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, code, name, phone")
      .in("id", engineerIds);
    userMap = new Map((users || []).map(u => [u.id, u]));
  }

  const enriched = (data || []).map(row => {
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

  return { ok: true, tasks: enriched, total: count || 0, principals: cache };
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
