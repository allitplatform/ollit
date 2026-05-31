// Phase 5 Step 0.B — 유솔N tasks DB 어댑터
// 2026-05-19
// 기존 src/data/tasks.js (localStorage) 측 흐름을 DB 측으로 전환하는 fetch 함수.
// tasks + task_items JOIN, 정산 사이클 색상 상태 helper 포함.
//
// 사용:
//   const { tasks, total } = await fetchUsolNTasks({ statusIn: ["미배정"], limit: 50, offset: 0 });
//   const color = getItemSettlementColor(item); // ⚪ 🟡 🟠 🟢
//
// 성능 spec:
//   - principal_id 캐싱 (1회 lookup 후 모듈 변수)
//   - page 50건 + count: "exact" (전체 카운트 받기)
//   - select() 측 task_items 측 inline JOIN (별도 호출 0)

import { supabase } from "./supabase.js";
import { generateTaskNosBulk } from "./taskNoGenerator.js";

const USOL_N_PRINCIPAL_CODE = "usol_n";
let _usolNPrincipalId = null;

// 1회 lookup 캐싱 (Phase 5 성능 spec — 매번 fetch 시 principal id resolve X)
export async function getUsolNPrincipalId() {
  if (_usolNPrincipalId) return _usolNPrincipalId;
  const { data, error } = await supabase
    .from("principals")
    .select("id")
    .eq("code", USOL_N_PRINCIPAL_CODE)
    .maybeSingle();
  if (error || !data) {
    console.error("[usolNTasksDb.getPrincipalId]", error);
    return null;
  }
  _usolNPrincipalId = data.id;
  return _usolNPrincipalId;
}

// usol_n tasks fetch — task_items + work_types + appliance_types inline JOIN
// 옵션:
//   statusIn:   string[] (예: ["미배정"] / ["약속대기", "확정", "진행중"] / ["완료"])
//   searchTerm: string (customer_name / task_no / address / phone 측 ilike or)
//   limit:      number (기본 50)
//   offset:     number (기본 0)
//
// 응답:
//   { ok: true, tasks: [...], total: number, principalId }
//   { ok: false, error, tasks: [], total: 0 }
export async function fetchUsolNTasks({ statusIn = null, searchTerm = "", limit = 50, offset = 0 } = {}) {
  const pid = await getUsolNPrincipalId();
  if (!pid) {
    return { ok: false, error: "usol_n principal 조회 실패", tasks: [], total: 0, principalId: null };
  }

  let q = supabase
    .from("tasks")
    .select(
      `id, task_no, customer_name, phone, address, district,
       status, assignment_type,
       product_price, extra_fee, travel_fee, total_amount,
       category_data,
       recommended_engineer_id, assigned_engineer_id,
       requested_date, scheduled_at, started_at, completed_at, received_at,
       work_memo,
       task_items (
         id, qty, unit_price, subtotal, description,
         naver_settled_at, cash_settled_at,
         naver_received_at, cash_received_at, company_received_at,
         engineer_settled_at,
         net_amount, product_order_id, order_type,
         work_types ( id, name ),
         appliance_types ( id, name )
       )`,
      { count: "exact" }
    )
    .eq("principal_id", pid)
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (Array.isArray(statusIn) && statusIn.length > 0) {
    q = q.in("status", statusIn);
  }

  // 검색어 — task 본체 4개 필드 측 or ilike
  // (work_type_name 측 nested 검색은 별도 stage 예정 — 일관된 페이지네이션 확보 우선)
  const kw = (searchTerm || "").trim();
  if (kw) {
    const esc = kw.replace(/[%_]/g, "\\$&");
    q = q.or(
      `customer_name.ilike.%${esc}%,task_no.ilike.%${esc}%,address.ilike.%${esc}%,phone.ilike.%${esc}%`
    );
  }

  const { data, count, error } = await q;
  if (error) {
    console.error("[usolNTasksDb.fetch]", error);
    return { ok: false, error: error.message, tasks: [], total: 0, principalId: pid };
  }

  // 2026-05-26 — users in-memory JOIN (assigned_engineer_id → assignedEngineer name).
  //   PostgREST nested embed 측 catch task_items 측 catch + tasks 측 catch 같이 측 catch X 측 catch X (PGRST201).
  //   loadTasksForRole 패턴 측 catch — task_id 측 catch 측 catch 측 catch 측 catch fetch 측 in-memory join.
  //   UsolNAssignList / UsolNInProgress 측 catch 측 catch 카드 측 catch 측 catch name 측 catch.
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
    if (!row.assigned_engineer_id) return row;
    const u = userMap.get(row.assigned_engineer_id);
    if (!u) return row;
    return {
      ...row,
      assignedEngineer:     u.name || "",
      assignedEngineerCode: u.code || "",
      engineerPhone:        u.phone || "",
    };
  });

  return { ok: true, tasks: enriched, total: count || 0, principalId: pid };
}

// ============================================================
// 2026-05-28 — fetchUsolNTasksPage (keyset 페이징)
// ============================================================
// 배경: UsolNInProgress 전체 탭 1092건 중 92건이 Supabase Max rows 1000 한도에 잘림.
//       옛 fetchUsolNTasks (offset/limit + count:exact) 는 한 번에 전체 받기 전제.
//       페이지 단위 fetch + keyset 커서 로 정밀 연속 페이지.
//       카운트는 별도 RPC usol_n_counts_by_status() 사용 (검색·기사 필터 정합).
//
// 시그니처:
//   cursor:        keyset 커서 — 분기 ↓
//                    · 전체 칩(statusIn=null): { sort_terminal:0|1, received_at:ISO, id:uuid }
//                    · 특정 칩(statusIn=[...]):              { received_at:ISO, id:uuid }
//                  첫 페이지는 null.
//   pageSize:      number (기본 50)
//   statusIn:      string[] | null  특정 status 필터 (예: ["완료"]). null = 전체.
//   searchTerm:    string  4필드(customer_name/task_no/address/phone) ILIKE 키워드
//   engineerCodes: string[]  기사 code 배열 — 클라가 REGISTERED_USERS 변환 후 전달.
//                            assigned_engineer_id IN (위 codes → users.id 매핑) 으로 조회.
//
// 검색 OR 동작 (옛 클라 5필드 includes 와 정합):
//   (searchTerm 4필드 ILIKE OR engineerCodes 매칭) — 둘 중 하나라도 매칭되면 결과.
//
// 정렬 (2026-05-28 sort_terminal 도입):
//   · 전체 칩 (statusIn=null):
//       sort_terminal ASC, received_at DESC, id DESC
//       → 활성(0) 위 / 완료·취소(1) 아래. 인덱스 idx_tasks_sort_terminal_order 사용.
//   · 특정 칩 (단일 status):
//       received_at DESC, id DESC
//       → 같은 sort_terminal 이라 정렬 동일. 옛 2-tuple 유지.
//
// 응답:
//   { ok: true, tasks: [...], nextCursor: cursor|null, hasMore: boolean }
//   { ok: false, error, tasks: [], nextCursor: null, hasMore: false }
export async function fetchUsolNTasksPage({
  cursor = null,
  pageSize = 50,
  statusIn = null,
  searchTerm = "",
  engineerCodes = [],
} = {}) {
  const pid = await getUsolNPrincipalId();
  if (!pid) {
    return { ok: false, error: "usol_n principal 조회 실패", tasks: [], nextCursor: null, hasMore: false };
  }

  // 전체 칩 여부 — 정렬·커서·nextCursor 분기 키.
  const isAllChip = !Array.isArray(statusIn) || statusIn.length === 0;

  let q = supabase
    .from("tasks")
    .select(
      `id, task_no, customer_name, phone, address, district,
       status, sort_terminal, assignment_type,
       product_price, extra_fee, travel_fee, total_amount,
       category_data,
       recommended_engineer_id, assigned_engineer_id,
       requested_date, scheduled_at, started_at, completed_at, received_at,
       work_memo,
       task_items (
         id, qty, unit_price, subtotal, description,
         naver_settled_at, cash_settled_at,
         naver_received_at, cash_received_at, company_received_at,
         engineer_settled_at,
         net_amount, product_order_id, order_type,
         work_types ( id, name ),
         appliance_types ( id, name )
       )`
    )
    .eq("principal_id", pid);

  // 정렬 — 전체 칩만 sort_terminal ASC 추가. 특정 칩은 옛 2-order 그대로.
  if (isAllChip) {
    q = q.order("sort_terminal", { ascending: true });
  }
  q = q.order("received_at", { ascending: false })
       .order("id", { ascending: false })
       .limit(pageSize);

  // keyset 커서 분기:
  //   전체 칩 (3-tuple) — (sort_terminal ASC, received_at DESC, id DESC) < cursor
  //     · sort_terminal > cs                                  → 다음 페이지 (더 뒤 그룹)
  //     · sort_terminal = cs AND received_at < cr             → 같은 그룹 내 다음
  //     · sort_terminal = cs AND received_at = cr AND id < ci → tiebreaker
  //   특정 칩 (2-tuple) — (received_at DESC, id DESC) < cursor
  if (cursor) {
    if (isAllChip && cursor.sort_terminal != null && cursor.received_at && cursor.id) {
      const cs  = Number(cursor.sort_terminal);
      const cra = String(cursor.received_at);
      const cid = String(cursor.id);
      q = q.or(
        `sort_terminal.gt.${cs},` +
        `and(sort_terminal.eq.${cs},received_at.lt.${cra}),` +
        `and(sort_terminal.eq.${cs},received_at.eq.${cra},id.lt.${cid})`
      );
    } else if (!isAllChip && cursor.received_at && cursor.id) {
      const cra = String(cursor.received_at);
      const cid = String(cursor.id);
      q = q.or(
        `received_at.lt.${cra},and(received_at.eq.${cra},id.lt.${cid})`
      );
    }
  }

  // status 필터
  if (Array.isArray(statusIn) && statusIn.length > 0) {
    q = q.in("status", statusIn);
  }

  // 검색 — searchTerm 4필드 ILIKE OR engineerCodes 매칭
  const kw = (searchTerm || "").trim();
  const hasSearch = !!kw;
  const hasEng = Array.isArray(engineerCodes) && engineerCodes.length > 0;

  if (hasSearch || hasEng) {
    let engIds = [];
    if (hasEng) {
      const { data: engUsers, error: engErr } = await supabase
        .from("users")
        .select("id")
        .in("code", engineerCodes);
      if (engErr) {
        console.error("[usolNTasksDb.page:engLookup]", engErr);
        // 기사 lookup 실패 시 keyword 만으로 진행 (정합 우선)
      } else {
        engIds = (engUsers || []).map(u => u.id).filter(Boolean);
      }
    }

    const orParts = [];
    if (hasSearch) {
      const esc = kw.replace(/[%_]/g, "\\$&");
      orParts.push(`customer_name.ilike.%${esc}%`);
      orParts.push(`task_no.ilike.%${esc}%`);
      orParts.push(`address.ilike.%${esc}%`);
      orParts.push(`phone.ilike.%${esc}%`);
    }
    if (hasEng && engIds.length > 0) {
      orParts.push(`assigned_engineer_id.in.(${engIds.join(",")})`);
    }

    // hasEng 인데 engIds 0건 + hasSearch 도 없으면 — 매칭 0건 보장 (검색 결과 빈 페이지)
    // hasEng 인데 engIds 0건 + hasSearch 있으면 — 키워드만으로 진행 (orParts 에 4필드)
    if (orParts.length > 0) {
      q = q.or(orParts.join(","));
    } else if (hasEng) {
      // 기사명 입력했는데 매칭 user 0건 → 결과 0건 보장 (불가능 조건)
      q = q.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error("[usolNTasksDb.page]", error);
    return { ok: false, error: error.message, tasks: [], nextCursor: null, hasMore: false };
  }

  // users in-memory JOIN (옛 fetch 와 동일 — assignedEngineer 표시용)
  const rows = data || [];
  const engineerIds = [...new Set(rows.map(r => r.assigned_engineer_id).filter(Boolean))];
  let userMap = new Map();
  if (engineerIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, code, name, phone")
      .in("id", engineerIds);
    userMap = new Map((users || []).map(u => [u.id, u]));
  }
  const enriched = rows.map(row => {
    if (!row.assigned_engineer_id) return row;
    const u = userMap.get(row.assigned_engineer_id);
    if (!u) return row;
    return {
      ...row,
      assignedEngineer:     u.name || "",
      assignedEngineerCode: u.code || "",
      engineerPhone:        u.phone || "",
    };
  });

  // nextCursor + hasMore — pageSize 와 정확히 같으면 다음 페이지 후보
  // 전체 칩이면 3-tuple, 특정 칩이면 2-tuple.
  const hasMore = enriched.length === pageSize;
  const last = enriched[enriched.length - 1];
  let nextCursor = null;
  if (hasMore && last && last.received_at && last.id) {
    if (isAllChip) {
      nextCursor = {
        sort_terminal: last.sort_terminal ?? 0,
        received_at:   last.received_at,
        id:            last.id,
      };
    } else {
      nextCursor = { received_at: last.received_at, id: last.id };
    }
  }

  return { ok: true, tasks: enriched, nextCursor, hasMore };
}

// 정산 사이클 색상 상태 (사장님 spec)
// ⚪ 대기 (아직 정산 진행 X)
// 🟡 네이버 결제 완료 (naver_settled_at IS NOT NULL)
// 🟠 회사 입금 완료 (company_received_at IS NOT NULL)
// 🟢 기사 정산 완료 (engineer_settled_at IS NOT NULL)
export function getItemSettlementColor(item) {
  if (!item) return { dot: "⚪", color: "var(--text-tertiary, var(--text-secondary))", label: "대기" };
  if (item.engineer_settled_at) return { dot: "🟢", color: "#1D9E75", label: "기사 정산 완료" };
  if (item.company_received_at) return { dot: "🟠", color: "#F59E0B", label: "회사 입금 완료" };
  if (item.naver_settled_at)    return { dot: "🟡", color: "#FACC15", label: "네이버 결제 완료" };
  return { dot: "⚪", color: "var(--text-tertiary, var(--text-secondary))", label: "대기" };
}

// task 전체 색상 (모든 items 가운데 가장 낮은 단계 = 그룹 미완 표시)
// items 0건 시 ⚪ 대기
export function getTaskSettlementColor(task) {
  const items = (task && task.task_items) || [];
  if (items.length === 0) return getItemSettlementColor(null);
  // 가장 낮은 단계 = 미완 작업
  let lowest = 3; // 0=대기, 1=네이버, 2=회사, 3=기사 정산 완료
  for (const it of items) {
    let stage = 0;
    if (it.naver_settled_at)    stage = 1;
    if (it.company_received_at) stage = 2;
    if (it.engineer_settled_at) stage = 3;
    if (stage < lowest) lowest = stage;
  }
  if (lowest === 3) return { dot: "🟢", color: "#1D9E75", label: "기사 정산 완료" };
  if (lowest === 2) return { dot: "🟠", color: "#F59E0B", label: "회사 입금 완료" };
  if (lowest === 1) return { dot: "🟡", color: "#FACC15", label: "네이버 결제 완료" };
  return { dot: "⚪", color: "var(--text-tertiary, var(--text-secondary))", label: "대기" };
}

// 특정 task 측 task_items 측 — AdminTaskDetailScreen 측 유솔N 정산 사이클 섹션
// 응답: { ok, items: [...] }
export async function fetchTaskItemsByTaskId(taskId) {
  if (!taskId) return { ok: false, error: "taskId X", items: [] };
  const { data, error } = await supabase
    .from("task_items")
    .select(
      `id, qty, unit_price, subtotal, description,
       naver_settled_at, cash_settled_at,
       naver_received_at, cash_received_at, company_received_at,
       engineer_settled_at,
       net_amount, product_order_id, order_type,
       work_types ( id, name ),
       appliance_types ( id, name )`
    )
    .eq("task_id", taskId)
    .order("id");
  if (error) {
    console.error("[usolNTasksDb.fetchByTaskId]", error);
    return { ok: false, error: error.message, items: [] };
  }
  return { ok: true, items: data || [] };
}

// task_items 측 product_order_id IN 매칭 — UsolNCsvMatch 정산 CSV 매칭
// 응답: { ok, items: [...] } / 각 item = task_items 행 + nested work_types / appliance_types / tasks
export async function fetchUsolNTaskItemsByOrderIds(productOrderIds) {
  if (!Array.isArray(productOrderIds) || productOrderIds.length === 0) {
    return { ok: true, items: [] };
  }
  const pid = await getUsolNPrincipalId();
  if (!pid) return { ok: false, error: "usol_n principal X", items: [] };

  const { data, error } = await supabase
    .from("task_items")
    .select(
      `id, task_id, product_order_id, order_type, qty, unit_price, subtotal,
       naver_settled_at, cash_settled_at,
       naver_received_at, cash_received_at, company_received_at,
       engineer_settled_at, net_amount,
       work_types ( id, name ),
       appliance_types ( id, name ),
       tasks!inner ( id, task_no, customer_name, principal_id, status, completed_at )`
    )
    .in("product_order_id", productOrderIds)
    .eq("tasks.principal_id", pid);

  if (error) {
    console.error("[usolNTasksDb.fetchByOrderIds]", error);
    return { ok: false, error: error.message, items: [] };
  }
  return { ok: true, items: data || [] };
}

// 일괄 UPDATE — 정산 사이클 측 시각 컬럼 (Migration 041 측 신규 컬럼 포함)
// 입력: itemIds (uuid[]), fieldName (allowed 6개), timestamp (ISO / null = now)
// 응답: { ok, count, timestamp }
// 참고: company_received_at = MAX(naver_received_at, cash_received_at) DB 측 자동 계산
//   직접 UPDATE 측 가능 — 옛 호환 spec.
export async function markTaskItemsField(itemIds, fieldName, timestamp = null) {
  const allowedFields = [
    "naver_settled_at", "cash_settled_at",
    "naver_received_at", "cash_received_at", "company_received_at",
    "engineer_settled_at",
  ];
  if (!allowedFields.includes(fieldName)) {
    return { ok: false, error: `field 측 X: ${fieldName}` };
  }
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return { ok: false, error: "itemIds 측 X" };
  }
  const ts = timestamp || new Date().toISOString();
  const { error } = await supabase
    .from("task_items")
    .update({ [fieldName]: ts })
    .in("id", itemIds);
  if (error) {
    console.error("[usolNTasksDb.markField]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, count: itemIds.length, timestamp: ts };
}

// 완료된 usol_n task_items 측 — UsolNTracking 주간 입금 이력 + UsolNEngineerSettlement
// 옵션:
//   monthsBack (기본 3개월)
//   engineerUserId (선택) — 측 set 시 DB-level 측 tasks.assigned_engineer_id 필터 추가.
//                            기사 PWA 본인 정산 화면 측 Supabase 1000 row 캡 측정 측측 안전망.
//                            UsolNTracking / UsolNEngineerSettlement (운영자 측, 전 기사 필요) 측 미전달.
//
// 2026-05-29 — users in-memory JOIN 추가 (fetchUsolNTasksPage 와 동일 패턴).
//   기사정산 탭 이름 표시 결손 해결 (옛 localStorage engineers 매칭 mismatch 우회).
//   각 item.tasks 에 assignedEngineer (이름) / assignedEngineerCode / engineerPhone 추가.
//   기존 필드 (id, task_no, customer_name, principal_id, status, completed_at,
//   assigned_engineer_id) 전부 보존 — 추가 필드만 (옛 호출처 EngineerApp / UsolNTracking 안전).
//
// 2026-05-31 — engineerUserId 옵션 추가 (1000-row cap 사고 차단).
//   증상: 완료 task_items 1214건 측 — Supabase JS default limit=1000 측 잘림.
//         기사 측 in-memory filter (EngineerApp.jsx:4532) 측 이미 잘린 데이터 측 작동.
//         → 옛 정산건 (예: 김동효 이현정 — 1174번째) 측 사라짐.
//   처방: engineerUserId set 시 DB 측 필터 → 그 기사 측 ~80건 측만 fetch → cap 측측 무관.
export async function fetchUsolNCompletedTaskItems({ monthsBack = 3, engineerUserId } = {}) {
  const pid = await getUsolNPrincipalId();
  if (!pid) return { ok: false, error: "usol_n principal X", items: [] };

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  cutoff.setHours(0, 0, 0, 0);

  // 2026-05-31 — Supabase JS default limit=1000 측 페이지네이션 측 전 row fetch.
  //   증상 (사장님 측정): 운영 측 완료 task_items 1214건 — engineerUserId 측 호출처
  //   (UsolNTracking / UsolNEngineerSettlement) 측 ~214건 누락 → 6/15 정산 금액 영향.
  //   처방: .range(offset, offset+999) loop 측 size<1000 측 break. 안정 정렬 측 id secondary key.
  //   안전 cap: MAX_PAGES=50 (≈50,000 row) — 무한 loop 차단.
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 50;
  const items = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabase
      .from("task_items")
      .select(
        `id, task_id, product_order_id, order_type, qty, unit_price, subtotal,
         naver_settled_at, cash_settled_at,
         naver_received_at, cash_received_at, company_received_at,
         engineer_settled_at, net_amount,
         work_types ( id, name ),
         appliance_types ( id, name ),
         tasks!inner ( id, task_no, customer_name, principal_id, status,
                       completed_at, assigned_engineer_id )`
      )
      .eq("tasks.principal_id", pid)
      .eq("tasks.status", "완료")
      .gte("tasks.completed_at", cutoff.toISOString());

    // 2026-05-31 — engineerUserId set 시 DB-level 필터 (1000-row cap 측정 측측 안전망)
    if (engineerUserId) {
      query = query.eq("tasks.assigned_engineer_id", engineerUserId);
    }

    const offset = page * PAGE_SIZE;
    const { data, error } = await query
      .order("naver_settled_at", { ascending: false })
      .order("id", { ascending: true })  // 페이지 측 안정 정렬 측 secondary key
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[usolNTasksDb.fetchCompleted]", error);
      return { ok: false, error: error.message, items: [] };
    }
    if (!data || data.length === 0) break;
    items.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  // users in-memory JOIN — 기사 18~30명, Max rows 1000 무관.
  const engineerIds = [...new Set(
    items.map(it => it.tasks && it.tasks.assigned_engineer_id).filter(Boolean)
  )];
  let userMap = new Map();
  if (engineerIds.length > 0) {
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("id, code, name, phone")
      .in("id", engineerIds);
    if (uErr) {
      console.error("[usolNTasksDb.fetchCompleted:users]", uErr);
      // users lookup 실패 시 items 그대로 반환 (옛 동작 유지 — 정산 계산 무영향)
      return { ok: true, items };
    }
    userMap = new Map((users || []).map(u => [u.id, u]));
  }

  const enriched = items.map(it => {
    if (!it.tasks || !it.tasks.assigned_engineer_id) return it;
    const u = userMap.get(it.tasks.assigned_engineer_id);
    if (!u) return it;
    return {
      ...it,
      tasks: {
        ...it.tasks,
        assignedEngineer:     u.name  || "",
        assignedEngineerCode: u.code  || "",
        engineerPhone:        u.phone || "",
      },
    };
  });

  return { ok: true, items: enriched };
}

// ============================================================
// 2026-05-26 — "배정 측 catch 측 catch" 단일 판정 헬퍼
// ============================================================
// 사장님 spec — 운영자 액션 필요 task:
//   (principal_id=usol_n) AND (
//     status IN ('미배정','약속대기','배정')
//     OR (category_data.reassignRequest 측 catch AND status NOT IN ('취소','완료','visit_only'))
//   )
//
// 사용처: UsolNAssignList (skipPrincipalCheck=true — fetch 측 catch usol_n 측 catch)
//        AdminApp 유솔N 진입 카드 (skipPrincipalCheck=false — apiTasks 전체 측 catch)
//
// task object — DB row (snake_case) 또는 _v14NormalizeTask 결과 (camel) 둘 다 측 catch.
export function isUsolNActionNeeded(task, { skipPrincipalCheck = false } = {}) {
  if (!task) return false;
  if (!skipPrincipalCheck) {
    const code = task.principalCode || task.principal_code;
    if (code !== "usol_n") return false;
  }
  const status = task.status;
  if (status === "취소" || status === "완료" || status === "visit_only") return false;
  if (status === "미배정" || status === "약속대기" || status === "배정") return true;
  // status='확정' 또는 '진행중' — reassignRequest 측 catch 측 catch 측 catch.
  const cat = task.category_data || task.categoryData || {};
  if (cat?.reassignRequest?.requestedAt) return true;
  return false;
}

// 작업 종류 칩 라벨 — appliance_name 우선 (가장 간결 + 중복 제거)
// 예: "벽걸이" (appliance 있음) / "피톤치드" (추가선택 / appliance X)
// 사장님 spec — work_types "세척_벽걸이" + appliance "벽걸이" 측 중복 catch 방지
export function getItemChipLabel(item) {
  if (!item) return "—";
  const wt = item.work_types && item.work_types.name;
  const at = item.appliance_types && item.appliance_types.name;
  if (at) return at;  // appliance 우선 → 가장 간결
  if (wt) return wt;  // appliance X → work_type fallback (추가선택 등)
  if (item.description) return item.description;
  if (item.order_type)  return item.order_type;
  return "항목";
}

// ============================================================
// 2026-05-23 — 네이버 CSV 일괄 INSERT (사장님 spec: 시트 → DB 마이그)
// ============================================================
// 흐름:
//   1) usol_n principal_id 조회
//   2) external_order_no 측 기존 row 측 조회 → 중복 skip
//   3) appliance / work_type 매핑 캐시 (한 번만 lookup)
//   4) 각 order 측:
//      · tasks INSERT (status='미배정', external_order_no=orderId)
//      · task_items INSERT (각 appliance 측 row 추가)
//        - order_type = item.orderType ("본작업" / "추가선택" / null)
//        - work_type_id = lookup (cleaning + appliance 또는 추가선택 측 별도)
//        - appliance_type_id = lookup
//        - qty / unit_price = item 측 값
//        - product_order_id = item.productOrderId
//        - metadata = { external_item_no: productOrderId }
//   5) 이상값 (orderType=null) 측 별도 warnings 분류
//
// 응답: { ok, inserted, skipped, warnings, errors }
//   · inserted: 정상 INSERT 측 task 수
//   · skipped:  중복 orderId 측 skip 수
//   · warnings: 이상값 측 항목 (운영자 확인 필요)
//   · errors:   INSERT 실패 측 (네트워크 / RLS 등)

// 한글 → appliance_types.code 매핑 (시드 Migration 004 + 사장님 DB 확인 2026-05-23)
//   2way 측 시드 측 존재 (clean_2way work_type id: 66666666-6666-6666-6666-666666660002)
const APPLIANCE_KR_TO_CODE = {
  "벽걸이":     "wall",
  "1way":       "1way",
  "2way":       "2way",
  "스탠드":     "stand",
  "4way":       "4way",
  "원형":       "round",
  "투인원":     "2in1",
  "시스템멀티": "multi",
};

// 2026-05-23 — timestamptz 측 안전 변환
//   Excel cellDates:true 측 Date 객체 측, 단 일부 환경 측 — 측 측 측 측 측 측 측 측 안전망.
//   · Date 객체 → toISOString()
//   · 유효한 ISO/SQL 측 측 측 → 그대로 (Postgres 측 측 측 측 측)
//   · 숫자 (Excel serial, 예: 45123.42) → null (잘못된 측 측 X)
//   · 빈 값 / 잘못된 측 → null
function normalizeTimestamp(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString();
  }
  if (typeof v === "number") {
    // Excel serial 측 측 측 X (cellDates:true 측 측 측). 측 측 측 측 null 측 안전 측.
    return null;
  }
  const s = String(v).trim();
  if (!s) return null;
  // 측 측 측 측 측 측 — Postgres 측 측 측 측 측 측 측 측 측 측 측 측.
  // 단 — Date 측 parse 측 측 측 — 측 measurement 측 측 측 측 측 측.
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// 추가선택 측 service_types.code → work_types.code (Migration 034)
// 옵션정보 / 서비스구분 측 키워드 → 추가선택 work_type 매핑
// 2026-05-23 — 사장님 실제 시트 검증 측 4종 catch:
//   · 냉매점검(서울 경기북부만 가능) 96건 → refri_no_appliance (Migration 034)
//   · 송풍팬분해/층고 92건 → fan_disassembly
//   · 실외기 34건 → outdoor_unit
//   · 순수 천연 피톤치드 분사 24건 → phytoncide
const ADDON_KR_TO_WT_CODE = {
  "냉매":     "refri_no_appliance",  // "냉매점검(서울 경기북부만 가능)" catch
  "송풍팬":   "fan_disassembly",
  "층고":     "fan_disassembly",
  "실외기":   "outdoor_unit",
  "피톤치드": "phytoncide",
};

// 신규 함수 — CSV 업로드 일괄 처리
// 2026-05-29 — Migration 080: 발주 원본 audit (raw_orders). 운영 차단 X 안전 wrapper.
async function _safeAuditRawOrders({ rows, sourceLabel = "csv_upload" }) {
  // 동적 import — 순환 의존 가드 + lazy load (CSV 흐름 안 탈 때 영향 0)
  try {
    const mod = await import("./rawOrdersDb.js");
    for (const r of rows) {
      // 각 INSERT 실패해도 다음 row 계속. safeInsertRawOrder 자체가 try/catch.
      await mod.safeInsertRawOrder({
        principalCode:    "usol_n",
        source:           sourceLabel,
        externalOrderNo:  r.externalOrderNo,
        productOrderNo:   r.productOrderNo,
        customerName:     r.customerName,
        phone:            r.phone,
        address:          r.address,
        rawPayload:       r.rawPayload,
        taskId:           r.taskId || null,
        notes:            r.notes  || null,
      });
    }
  } catch (e) {
    console.warn("[bulkInsertUsolNOrders:rawAudit] 모듈 로드 실패 (운영 영향 X):", e);
  }
}

export async function bulkInsertUsolNOrders(orders) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return { ok: false, error: "orders 없음", inserted: 0, skipped: 0, warnings: [], errors: [] };
  }

  try {
    // 1) usol_n principal_id
    const principalId = await getUsolNPrincipalId();
    if (!principalId) {
      return { ok: false, error: "usol_n principal 조회 실패", inserted: 0, skipped: 0, warnings: [], errors: [] };
    }

    // 2) 중복 체크 — external_order_no 측 기존 row (usol_n 한정)
    //   2026-05-26 fix:
    //     · principal_id 필터 추가 — 다른 원청에 같은 상품주문번호 있어도 usol_n 신규 작업 오판 X
    //     · orderIds 500개씩 청크 분할 — Supabase 기본 1000행 cap 우회
    const orderIds = orders.map(o => String(o.orderId || "")).filter(Boolean);
    const CHUNK = 500;
    const existingSet = new Set();
    for (let i = 0; i < orderIds.length; i += CHUNK) {
      const chunk = orderIds.slice(i, i + CHUNK);
      const { data: existing, error: dupErr } = await supabase
        .from("tasks")
        .select("external_order_no")
        .eq("principal_id", principalId)
        // 2026-05-29 — 옛 취소 작업이 같은 orderId 재주문을 막던 사고 차단.
        //   사고: 임다혜 YS-N-260529-021 / YS-N-260526-034 (status='취소') 의 external_order_no 가
        //   신규 CSV 와 매칭 → "중복 제외 2건, 등록 0건". DB UNIQUE 제약 없음 → 신규 row 공존 안전.
        .neq("status", "취소")
        .in("external_order_no", chunk);
      if (dupErr) {
        console.error("[bulkInsertUsolNOrders:dup]", dupErr);
        return { ok: false, error: dupErr.message, inserted: 0, skipped: 0, warnings: [], errors: [] };
      }
      for (const r of (existing || [])) existingSet.add(r.external_order_no);
    }
    const fresh = orders.filter(o => !existingSet.has(String(o.orderId)));
    const skipped = orders.length - fresh.length;

    // 2026-05-29 — Migration 080 raw_orders audit: 중복 케이스도 원본 보존 (task_id=NULL).
    //   존재 흐름 가드 (existingSet) 측 status='취소' 제외 후에도 중복 = 옛 비-취소 작업.
    //   notes='중복_기존작업' 으로 표시 — archive 화면 측 검색 가능.
    if (skipped > 0) {
      const dupOrders = orders.filter(o => existingSet.has(String(o.orderId)));
      const dupRows = dupOrders.map(o => ({
        externalOrderNo: String(o.orderId || ""),
        productOrderNo:  null,
        customerName:    o.customerName || null,
        phone:           o.phone || null,
        address:         o.address || null,
        rawPayload:      o,
        taskId:          null,
        notes:           "중복_기존작업",
      }));
      // 비동기 / 운영 차단 X — await 안 함 (CSV 흐름 차단 방지)
      _safeAuditRawOrders({ rows: dupRows, sourceLabel: "csv_upload" });
    }

    if (fresh.length === 0) {
      return { ok: true, inserted: 0, skipped, warnings: [], errors: [] };
    }

    // 3) work_types / appliance_types / service_types 캐시 lookup (한 번만)
    const [wtRes, atRes, stRes] = await Promise.all([
      supabase.from("work_types").select("id, code, service_type_id, appliance_type_id"),
      supabase.from("appliance_types").select("id, code, name"),
      supabase.from("service_types").select("id, code, name"),
    ]);
    if (wtRes.error || atRes.error || stRes.error) {
      const e = wtRes.error || atRes.error || stRes.error;
      console.error("[bulkInsertUsolNOrders:lookup]", e);
      return { ok: false, error: e.message, inserted: 0, skipped, warnings: [], errors: [] };
    }
    const workTypes = wtRes.data || [];
    const applianceByCode = new Map((atRes.data || []).map(a => [a.code, a.id]));
    const cleaningServiceId = (stRes.data || []).find(s => s.code === "cleaning")?.id;

    // 헬퍼: 본작업 측 work_type_id (cleaning + appliance)
    function findCleaningWorkTypeId(applianceCode) {
      if (!cleaningServiceId || !applianceCode) return null;
      const applianceId = applianceByCode.get(applianceCode);
      if (!applianceId) return null;
      const wt = workTypes.find(w =>
        w.service_type_id === cleaningServiceId && w.appliance_type_id === applianceId
      );
      return wt?.id || null;
    }
    // 헬퍼: 추가선택 측 work_type_id (옵션 키워드 → addon work_type code)
    function findAddonWorkTypeId(optionText) {
      if (!optionText) return null;
      const t = String(optionText);
      for (const [kr, code] of Object.entries(ADDON_KR_TO_WT_CODE)) {
        if (t.includes(kr)) {
          const wt = workTypes.find(w => w.code === code);
          return wt?.id || null;
        }
      }
      return null;
    }

    // 4) task_no 일괄 측 — 회사 규칙 {prefix}{YYMMDD}-{seq} (taskNoGenerator)
    //    측 시작 측 1회 catch → race condition X / 측 시점 i 측 시점 i 측 시점 i
    const tnRes = await generateTaskNosBulk(USOL_N_PRINCIPAL_CODE, fresh.length);
    if (!tnRes.ok) {
      console.error("[bulkInsertUsolNOrders:taskNo]", tnRes.error);
      return { ok: false, error: `task_no 측 측 실패: ${tnRes.error}`, inserted: 0, skipped, warnings: [], errors: [] };
    }
    const taskNos = tnRes.taskNos;  // ["YS-N-260523-001", ...]

    // 5) tasks 일괄 INSERT (2026-05-26 — 순차 await → bulk 측 변경)
    //   · 각 fresh order 측 row 1건 생성 → fresh.length 행을 한 번에 .insert(array)
    //   · 반환된 id 사용해 task_items 도 한 번에 bulk insert
    //   · Supabase .insert(array) 측 all-or-nothing — fail 시 전체 롤백, 모든 order 측 errors 측 catch
    const warnings = [];
    const errors = [];

    const taskRows = fresh.map((order, i) => ({
      tenant_id: "11111111-1111-1111-1111-111111111111",
      category_id: "33333333-3333-3333-3333-333333333001",
      task_no: taskNos[i],
      principal_id: principalId,
      customer_name: order.customerName || "—",
      phone:         order.phone || "",
      address:       order.address || "",
      district:      order.region || "",
      channel:       "네이버",
      // 2026-05-27 Migration 077 — 네이버 발주 CSV는 항상 네이버 결제 흐름
      payment_method: "naver_pay",
      request_note:  `네이버 주문 ${order.orderId}`,
      status:        "미배정",
      product_price: Number(order.settlementAmount || order.totalAmount || 0),
      extra_fee:     0,
      travel_fee:    0,
      external_order_no: String(order.orderId),
      external_received_at: normalizeTimestamp(order.paymentDate),
      category_data: {},
    }));

    const { data: insertedTasks, error: tasksErr } = await supabase
      .from("tasks")
      .insert(taskRows)
      .select("id, task_no, external_order_no");

    if (tasksErr || !Array.isArray(insertedTasks)) {
      console.error("[bulkInsertUsolNOrders:tasks bulk]", tasksErr);
      // 전체 롤백 — fresh 모든 order 측 errors 측 catch
      return {
        ok: false,
        error: tasksErr?.message || "tasks 일괄 INSERT 실패",
        inserted: 0,
        skipped,
        warnings: [],
        errors: fresh.map((o, i) => ({
          orderId: o.orderId,
          taskNo: taskNos[i],
          error: tasksErr?.message || "tasks bulk INSERT 실패",
          code: tasksErr?.code || null,
          details: tasksErr?.details || null,
          hint: tasksErr?.hint || null,
        })),
      };
    }

    // 5-a) external_order_no → 새 task.id 매핑 (task_items insert 시 task_id 측 catch)
    const taskIdByExt = new Map();
    const taskNoByExt = new Map();
    for (const t of insertedTasks) {
      taskIdByExt.set(t.external_order_no, t.id);
      taskNoByExt.set(t.external_order_no, t.task_no);
    }
    const inserted = insertedTasks.length;

    // 5-b) task_items rows 측 catch — fresh 측 catch appliance 측 catch
    //      warnings 분류 측 catch 기존 로직 그대로 (이상값 / 매핑 실패 → task_items insert 측 catch X)
    const itemRows = [];
    for (const order of fresh) {
      const extKey = String(order.orderId);
      const taskId = taskIdByExt.get(extKey);
      const taskNo = taskNoByExt.get(extKey);
      if (!taskId) {
        // bulk return 측 catch external_order_no 매핑 실패 — 측 measurement (insertedTasks 측 catch 측 catch)
        errors.push({ orderId: order.orderId, error: "task id 매핑 실패 (insert 결과 측 catch)" });
        continue;
      }
      for (const app of (order.appliances || [])) {
        // order_type 이상값 → 경고
        if (!app.orderType) {
          warnings.push({
            orderId: order.orderId,
            taskNo,
            serviceTypeRaw: app.serviceTypeRaw || "(없음)",
            note: "서비스종류 측 \"에어컨청소\" / \"추가선택\" 외 이상값 — 운영자 확인 필요",
          });
          continue;
        }

        let workTypeId = null;
        let applianceTypeId = null;

        if (app.orderType === "본작업") {
          const applianceCode = APPLIANCE_KR_TO_CODE[app.type] || null;
          if (!applianceCode) {
            warnings.push({
              orderId: order.orderId, taskNo,
              serviceTypeRaw: app.serviceTypeRaw,
              note: `기종 측 매핑 실패 (${app.type || "X"})`,
            });
            continue;
          }
          applianceTypeId = applianceByCode.get(applianceCode);
          workTypeId = findCleaningWorkTypeId(applianceCode);
        } else if (app.orderType === "추가선택") {
          workTypeId = findAddonWorkTypeId(app.serviceTypeRaw) || findAddonWorkTypeId(app.type);
          if (!workTypeId) {
            warnings.push({
              orderId: order.orderId, taskNo,
              serviceTypeRaw: app.serviceTypeRaw,
              note: "추가선택 측 키워드 매핑 실패 (송풍팬/실외기/피톤치드 측 외)",
            });
            continue;
          }
        }

        if (!workTypeId) {
          warnings.push({ orderId: order.orderId, taskNo, note: "work_type 측 매핑 실패" });
          continue;
        }

        // 2026-05-27 — CSV "정산예정금액" 동적 판정 (이중곱 방지).
        //   배경: 5/25 시점부터 CSV "정산예정금액"이 행 합계(qty×단가)로 들어옴.
        //         그 값을 그대로 unit_price에 넣으면 GENERATED subtotal=qty×unit_price 이중곱.
        //   판정: settlement > (customerPaid / qty) × 1.1 → 합계로 간주 → ÷qty 로 단가 환산.
        //   회귀: 옛 정상 데이터(평균 비율 0.93)는 settlement ≤ perUnitPaid → 분기 안 탐 → 그대로.
        //   판정 불가(qty<2 또는 customerPaid 없음) → 보수적으로 settlement 그대로.
        const _qty         = app.count || 1;
        const _settlement  = app.settlement || 0;
        const _perUnitPaid = (app.customerPaid && _qty) ? app.customerPaid / _qty : null;
        let _unitPrice = _settlement;
        if (_qty >= 2 && _perUnitPaid && _settlement > _perUnitPaid * 1.1) {
          _unitPrice = Math.round(_settlement / _qty);
        }

        itemRows.push({
          task_id: taskId,
          work_type_id: workTypeId,
          appliance_type_id: applianceTypeId,
          qty: _qty,
          unit_price: _unitPrice,
          customer_paid_amount: app.customerPaid || null,
          order_type: app.orderType,
          product_order_id: app.productOrderId || null,
          metadata: app.productOrderId
            ? { external_item_no: String(app.productOrderId) }
            : {},
        });
      }
    }

    // 5-c) task_items 일괄 INSERT
    if (itemRows.length > 0) {
      const { error: itemsErr } = await supabase.from("task_items").insert(itemRows);
      if (itemsErr) {
        console.error("[bulkInsertUsolNOrders:items bulk]", itemsErr);
        // tasks 측 catch 성공 → task_items 측 catch 측 catch — task 측 catch 측 측 정리 X (운영자 확인)
        errors.push({
          orderId: "(all task_items)",
          error: `task_items 일괄 INSERT 실패: ${itemsErr.message}`,
          code: itemsErr.code || null,
          details: itemsErr.details || null,
          hint: itemsErr.hint || null,
        });
      }
    }

    // 5-d) 2026-05-29 — Migration 080 raw_orders audit: 신규 INSERT 원본 보존 (task_id 연결).
    //   각 fresh order 측 raw_orders row 1건. task_items 실패와 무관 (task 성공만으로 raw 보존).
    //   운영 차단 X — 비동기 / 실패 시 console.warn 만.
    const freshRawRows = fresh.map(order => {
      const extKey = String(order.orderId);
      return {
        externalOrderNo: extKey,
        productOrderNo:  null,
        customerName:    order.customerName || null,
        phone:           order.phone || null,
        address:         order.address || null,
        rawPayload:      order,
        taskId:          taskIdByExt.get(extKey) || null,
        notes:           null,
      };
    });
    _safeAuditRawOrders({ rows: freshRawRows, sourceLabel: "csv_upload" });

    // 2026-05-23 진단용 — 함수 끝 측 errors / warnings 측 전체 출력 (사장님 측 console 측 확인)
    console.warn("[usolN bulk INSERT 결과]",
      "inserted:", inserted, "| skipped:", skipped,
      "| errors:", errors.length, "| warnings:", warnings.length);
    if (errors.length > 0) {
      console.error("[usolN errors 전체]", JSON.stringify(errors, null, 2));
    }
    if (warnings.length > 0) {
      console.warn("[usolN warnings 측 3건]", JSON.stringify(warnings.slice(0, 3), null, 2));
    }

    return { ok: true, inserted, skipped, warnings, errors };
  } catch (e) {
    console.error("[bulkInsertUsolNOrders]", e);
    return { ok: false, error: e.message || "일괄 INSERT 예외", inserted: 0, skipped: 0, warnings: [], errors: [{ error: e.message, stack: e.stack }] };
  }
}
