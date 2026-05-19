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
         naver_settled_at, company_received_at, engineer_settled_at,
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
  return { ok: true, tasks: data || [], total: count || 0, principalId: pid };
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
       naver_settled_at, company_received_at, engineer_settled_at,
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
       naver_settled_at, company_received_at, engineer_settled_at, net_amount,
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

// 일괄 UPDATE — naver_settled_at / company_received_at / engineer_settled_at
// 입력: itemIds (uuid[]), fieldName (allowed 3개), timestamp (ISO / null = now)
// 응답: { ok, count, timestamp }
export async function markTaskItemsField(itemIds, fieldName, timestamp = null) {
  const allowedFields = ["naver_settled_at", "company_received_at", "engineer_settled_at"];
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
// 옵션: monthsBack (기본 3개월)
export async function fetchUsolNCompletedTaskItems({ monthsBack = 3 } = {}) {
  const pid = await getUsolNPrincipalId();
  if (!pid) return { ok: false, error: "usol_n principal X", items: [] };

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("task_items")
    .select(
      `id, task_id, product_order_id, order_type, qty, unit_price, subtotal,
       naver_settled_at, company_received_at, engineer_settled_at, net_amount,
       work_types ( id, name ),
       appliance_types ( id, name ),
       tasks!inner ( id, task_no, customer_name, principal_id, status,
                     completed_at, assigned_engineer_id )`
    )
    .eq("tasks.principal_id", pid)
    .eq("tasks.status", "완료")
    .gte("tasks.completed_at", cutoff.toISOString())
    .order("naver_settled_at", { ascending: false });

  if (error) {
    console.error("[usolNTasksDb.fetchCompleted]", error);
    return { ok: false, error: error.message, items: [] };
  }
  return { ok: true, items: data || [] };
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
