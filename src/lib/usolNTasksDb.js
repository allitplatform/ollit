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

    // 2) 중복 체크 — external_order_no 측 기존 row
    const orderIds = orders.map(o => String(o.orderId || "")).filter(Boolean);
    const { data: existing, error: dupErr } = await supabase
      .from("tasks")
      .select("external_order_no")
      .in("external_order_no", orderIds);
    if (dupErr) {
      console.error("[bulkInsertUsolNOrders:dup]", dupErr);
      return { ok: false, error: dupErr.message, inserted: 0, skipped: 0, warnings: [], errors: [] };
    }
    const existingSet = new Set((existing || []).map(r => r.external_order_no));
    const fresh = orders.filter(o => !existingSet.has(String(o.orderId)));
    const skipped = orders.length - fresh.length;

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

    // 5) 각 order 측 tasks + task_items INSERT
    const warnings = [];
    const errors = [];
    let inserted = 0;

    for (let i = 0; i < fresh.length; i++) {
      const order = fresh[i];
      const taskNo = taskNos[i];
      const settlementSum = Number(order.settlementAmount || order.totalAmount || 0);

      // [a] tasks INSERT
      // 2026-05-23 진단용 — INSERT 시도 row 측 별도 변수 측 측 측 측 측 측 dump
      const taskInsertRow = {
        tenant_id: "11111111-1111-1111-1111-111111111111",
        category_id: "33333333-3333-3333-3333-333333333001",
        task_no: taskNo,
        principal_id: principalId,
        customer_name: order.customerName || "—",
        phone:         order.phone || "",
        address:       order.address || "",
        district:      order.region || "",
        channel:       "네이버",
        request_note:  `네이버 주문 ${order.orderId}`,
        status:        "미배정",
        product_price: settlementSum,
        extra_fee:     0,
        travel_fee:    0,
        external_order_no: String(order.orderId),
        // 2026-05-23 — normalizeTimestamp — Excel cellDates:true 측 Date 측, 측 측 ISO 측 측 측 안전망
        external_received_at: normalizeTimestamp(order.paymentDate),
        // category_data 측 빈 객체 (Migration 017 trigger 측 workItems 측 없으면 task_items 자동 생성 X)
        category_data: {},
      };
      const { data: taskRow, error: taskErr } = await supabase
        .from("tasks")
        .insert(taskInsertRow)
        .select("id, task_no")
        .single();

      if (taskErr || !taskRow) {
        // 2026-05-23 진단용 — 사장님 측 toast / console 측 정확한 원인 catch 가능하도록 측 측 출력
        console.error("[usolN tasks INSERT 실패]",
          JSON.stringify(taskErr), "| orderId:", order.orderId,
          "| 시도한 row:", JSON.stringify(taskInsertRow));
        errors.push({
          orderId: order.orderId,
          error: taskErr?.message || "task insert 실패",
          code: taskErr?.code || null,
          details: taskErr?.details || null,
          hint: taskErr?.hint || null,
          paymentDate: order.paymentDate,
          paymentDateType: typeof order.paymentDate,
        });
        continue;
      }

      // [b] task_items INSERT (각 appliance 측 row)
      const itemRows = [];
      for (const app of (order.appliances || [])) {
        // order_type 측 이상값 측 경고
        if (!app.orderType) {
          warnings.push({
            orderId: order.orderId,
            taskNo,
            serviceTypeRaw: app.serviceTypeRaw || "(없음)",
            note: "서비스종류 측 \"에어컨청소\" / \"추가선택\" 외 이상값 — 운영자 확인 필요",
          });
          // 이상값 측 task_items 측 INSERT 안 함 (운영자 측 검토 후 수동 추가)
          continue;
        }

        let workTypeId = null;
        let applianceTypeId = null;

        if (app.orderType === "본작업") {
          // cleaning + appliance 측 매핑
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
          // 옵션 측 키워드 측 addon work_type 매핑 (appliance 측 NULL)
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

        itemRows.push({
          task_id: taskRow.id,
          work_type_id: workTypeId,
          appliance_type_id: applianceTypeId,
          qty: app.count || 1,
          unit_price: app.amount || 0,
          order_type: app.orderType,
          product_order_id: app.productOrderId || null,
          metadata: app.productOrderId
            ? { external_item_no: String(app.productOrderId) }
            : {},
        });
      }

      if (itemRows.length > 0) {
        const { error: itemErr } = await supabase.from("task_items").insert(itemRows);
        if (itemErr) {
          console.error("[bulkInsertUsolNOrders:itemInsert]", itemErr, order.orderId);
          errors.push({ orderId: order.orderId, error: `task_items 측 ${itemErr.message}` });
          // task 측 INSERT 된 후 items 측 실패 — task 측 별도 정리 안 함 (운영자 측 확인)
          continue;
        }
      }

      inserted++;
    }

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
