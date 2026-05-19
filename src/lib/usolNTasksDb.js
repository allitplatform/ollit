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

// usol_n tasks fetch — task_items 측 inline JOIN
// 옵션:
//   statusIn: string[] (예: ["미배정"] / ["약속대기", "확정", "진행중"] / ["완료"])
//   limit:    number (기본 50)
//   offset:   number (기본 0)
//
// 응답:
//   { ok: true, tasks: [...], total: number, principalId }
//   { ok: false, error, tasks: [], total: 0 }
export async function fetchUsolNTasks({ statusIn = null, limit = 50, offset = 0 } = {}) {
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
         id, work_type_id, appliance_type_id, qty, unit_price, subtotal, description,
         naver_settled_at, company_received_at, engineer_settled_at,
         net_amount, product_order_id, order_type
       )`,
      { count: "exact" }
    )
    .eq("principal_id", pid)
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (Array.isArray(statusIn) && statusIn.length > 0) {
    q = q.in("status", statusIn);
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

// 작업 종류 칩 라벨 (work_type_id resolve는 별도 / 일단 description / order_type 우선)
// description 있으면 사용, 없으면 order_type fallback
export function getItemChipLabel(item) {
  if (!item) return "—";
  if (item.description) return item.description;
  if (item.order_type)  return item.order_type;
  return "항목";
}
