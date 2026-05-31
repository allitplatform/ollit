// 유솔 포털 정산 탭 — 항목(task_item) 단위 정산 데이터 fetch
// 2026-05-23
//
// spec (사장님 확정):
//   · 단위: task_item (네이버 상품주문번호 단위 정산)
//   · 묶음: naver_settled_at 기준 ISO 주 (월~일)
//   · 금액: subtotal
//   · 단계: 대기 → 네이버 결제완료 → 회사 입금완료
//   · 냉매 제외 필터 없음 (추가선택 냉매점검도 일반 항목으로 포함)
//
// 사용:
//   const { items } = await fetchPrincipalSettleItems({
//     principalCodes: ["usol_h", "usol_n"], monthsBack: 3,
//   });
import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// principalCodes → principal_id[] 매핑 (캐시)
const _principalIdCache = new Map();
async function resolvePrincipalIds(codes) {
  const need = codes.filter(c => !_principalIdCache.has(c));
  if (need.length > 0) {
    const { data, error } = await supabase
      .from("principals")
      .select("id, code")
      .in("code", need);
    if (error) {
      console.error("[principalSettleDb.resolveIds]", error);
      return [];
    }
    for (const p of (data || [])) _principalIdCache.set(p.code, p.id);
  }
  return codes.map(c => _principalIdCache.get(c)).filter(Boolean);
}

// 정산 항목 fetch — task_items + tasks JOIN
// 옵션:
//   principalCodes: string[] (예: ["usol_h","usol_n"])
//   monthsBack:     number   (기본 3 — 최근 3개월 received_at)
// 응답:
//   { ok, items: [...] } / 각 item = task_items 행 + customer_name·task_no·status·principal_id 첨부
export async function fetchPrincipalSettleItems({ principalCodes = [], monthsBack = 3 } = {}) {
  if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
    return { ok: false, error: "principalCodes 누락", items: [] };
  }
  const pids = await resolvePrincipalIds(principalCodes);
  if (pids.length === 0) {
    return { ok: false, error: "principal id 매핑 실패", items: [] };
  }

  // cutoff (받음 시점 기준 — 너무 옛 데이터 제외)
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  cutoff.setHours(0, 0, 0, 0);

  // 2026-05-31 — Supabase JS max_rows=1000 cap 측 페이지네이션 loop 측 전체 fetch.
  //   증상: .limit(5000) 단일 fetch 측 server 측 1000건만 반환 → PrincipalSettleTab 측
  //         회사 입금 금액 합산 (line 158, 450, 553 측 companyAmountOf 측 .reduce) 측 누락.
  //   처방: PAGE_SIZE=1000 측 loop, MAX_PAGES=50 (≈50,000 row safety cap).
  //   안정 정렬 측 secondary key 측 id (received_at ties 측 페이지 측 측측 측측).
  //   호출처 시그니처 / 응답 schema 측 변경 X (회귀 0).
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 50;
  const accumulated = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("task_items")
      .select(
        `id, task_id, qty, unit_price, subtotal, description,
         naver_settled_at, naver_received_at,
         cash_settled_at, cash_received_at,
         company_received_at, engineer_settled_at,
         net_amount, product_order_id, order_type,
         work_types ( id, name ),
         appliance_types ( id, name ),
         tasks!inner ( id, task_no, customer_name, address, district,
                       principal_id, status, received_at, scheduled_at, completed_at )`
      )
      .eq("tasks.tenant_id", TENANT_ID)
      .in("tasks.principal_id", pids)
      .gte("tasks.received_at", cutoff.toISOString())
      .order("naver_settled_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })  // 페이지 측 안정 정렬 측 secondary key
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[principalSettleDb.fetch]", error);
      return { ok: false, error: error.message, items: [] };
    }
    if (!data || data.length === 0) break;
    accumulated.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  // 평탄화 — tasks nested → 항목 측 직접 필드로 복사
  const flat = accumulated.map(it => {
    const t = it.tasks || {};
    return {
      ...it,
      customer_name: t.customer_name || "",
      task_no:       t.task_no || "",
      address:       t.address || "",
      district:      t.district || "",
      principal_id:  t.principal_id,
      task_status:   t.status,
      received_at:   t.received_at,
      scheduled_at:  t.scheduled_at,
      completed_at:  t.completed_at,
    };
  });

  return { ok: true, items: flat };
}

// 항목 정산 단계 — 3단계 (대기/네이버/회사). engineer는 원청 측 표시 X.
//   ⚪ 대기      = naver_settled_at NULL
//   🟡 네이버    = naver_settled_at NOT NULL, company_received_at NULL
//   🟠 회사      = company_received_at NOT NULL
export const SETTLE_STAGES = [
  { key: "wait",    label: "대기",         dot: "⚪", color: "var(--text-tertiary, #9CA3AF)", field: null },
  { key: "naver",   label: "네이버 결제완료", dot: "🟡", color: "#FACC15", field: "naver_settled_at" },
  { key: "company", label: "회사 입금완료",  dot: "🟠", color: "#F59E0B", field: "company_received_at" },
];

export function getSettleStageKey(item) {
  if (!item) return "wait";
  if (item.company_received_at) return "company";
  if (item.naver_settled_at) return "naver";
  return "wait";
}

// ISO 주 (월~일) — 항목의 naver_settled_at이 속한 주 계산
//   naver_settled_at NULL → null 반환 (대기 항목)
// 반환: { key: "2026-W21", year, week, monday: Date, sunday: Date, monthDay: "5/19~25" }
export function getNaverSettleWeek(item) {
  const ts = item?.naver_settled_at;
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return computeIsoWeek(d);
}

function computeIsoWeek(date) {
  // ISO 주 산정 — 월요일 시작, 첫 주는 그 해 첫 목요일 포함 주
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;          // 일=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);  // 그 주의 목요일
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();

  // 그 주 월요일·일요일 (KST 기준 표시용 — 로컬 Date 사용)
  const orig = new Date(date);
  const localDay = orig.getDay() || 7;
  const monday = new Date(orig);
  monday.setDate(orig.getDate() - (localDay - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const monthDay = `${monday.getMonth() + 1}/${monday.getDate()}~${sunday.getMonth() + 1}/${sunday.getDate()}`;

  return {
    key: `${year}-W${String(week).padStart(2, "0")}`,
    year, week, monday, sunday, monthDay,
  };
}

// TaskDetail "상품주문별 정산" 측 catch — 측 task_id 측 task_items 별도 fetch
//   PAYMENT_SELECT 측 catch 측 catch product_order_id / net_amount / naver_settled_at 측 catch
//   기본 list view 측 catch X 측 — TaskDetail mount 측 catch 별도 fetch.
export async function fetchTaskItemsForDetail(taskId) {
  if (!taskId) return { ok: false, error: "taskId 누락", items: [] };
  const { data, error } = await supabase
    .from("task_items")
    .select(
      `id, qty, unit_price, subtotal, description, order_type,
       net_amount, customer_paid_amount, product_order_id,
       naver_settled_at, naver_received_at, company_received_at,
       is_canceled, canceled_reason, canceled_at,
       work_types ( id, code, name, service_types ( id, code ) ),
       appliance_types ( id, name )`
    )
    .eq("task_id", taskId)
    .order("id");
  if (error) {
    console.error("[principalSettleDb.fetchItemsForDetail]", error);
    return { ok: false, error: error.message, items: [] };
  }
  return { ok: true, items: data || [] };
}

// 항목 칩 라벨 — appliance > work_type > description > order_type
export function getItemLabel(item) {
  if (!item) return "—";
  const at = item.appliance_types?.name;
  const wt = item.work_types?.name;
  if (at) return at;
  if (wt) return wt;
  if (item.description) return item.description;
  return item.order_type || "—";
}
