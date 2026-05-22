// Phase 2 — Supabase tasks CRUD (점진 교체용 신규 모듈)
// 옛 src/data/tasks.js (localStorage)는 그대로 두고, 신규 흐름은 여기서 처리.
// 외부 인터페이스(rowToTask 결과)는 옛 v14NormalizeTask 결과와 호환되게 camelCase로 반환.

import { supabase } from "../lib/supabase.js";

// Phase 1 MVP 단일 테넌트 (allit). 멀티 테넌트 확장 시 user.tenant_id 사용.
export const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// Phase 1 MVP 단일 카테고리 (aircon). tasks.category_id NOT NULL — task.categoryId 누락 시 fallback.
export const CATEGORY_ID_AIRCON = "33333333-3333-3333-3333-333333333001";

// ============================================================
// normalize — Supabase row ↔ 클라이언트 task
// ============================================================

// 2026-05-16 Phase 4 통합 2-C — payments JOIN select string (6곳 공통 사용)
// payments 측 task_id UNIQUE 없어 PostgREST 응답이 array → rowToTask가 [0] 추출
// 2026-05-19 Phase 5 Step 0.C-16 — task_items + work_types + appliance_types 측 inline JOIN
//   사장님 catch: 박소영 측 work_type 표시 X — category_data.workItems 측 NULL + task_items 측 별도 데이터.
//   task_items 측 name 측 fetch → rowToTask 측 workItems fallback 매핑 spec.
const PAYMENT_SELECT = `
  *,
  payment:payments(
    calc_method,
    policy_key,
    engineer_amount,
    principal_amount,
    owner_amount,
    is_balanced,
    status,
    computed_at,
    track,
    engineer_remitted_at,
    engineer_remit_confirmed_at,
    engineer_remit_confirmed_by
  ),
  task_items (
    id, qty, unit_price, subtotal,
    order_type,
    work_types (
      id, name,
      service_types ( id, code )
    ),
    appliance_types ( id, name )
  )
`;

// Supabase row → 클라이언트 task (camelCase / v14NormalizeTask 호환)
export function rowToTask(row) {
  if (!row) return null;
  // Phase 4-2 fix — category_data jsonb 평탄화 (workType/workItems 등 별도 추출)
  // 화면 필터 (NewReceptionScreen.getByType / v14NormalizeTask) 호환
  const cat = row.category_data || {};
  // 2026-05-16 Phase 4 통합 2-C — payments JOIN 적용 spec (one-to-many 관계지만 1 task = 1 payment)
  const paymentRaw = Array.isArray(row.payment) ? row.payment[0] : row.payment;
  const payment = paymentRaw || null;
  // 2026-05-21 Phase 5 Step 0.G-6-B/C — task 레벨 boolean (유솔N 본작업 + 냉매 판정)
  //   카운트 통일 spec — _isUsolNMainRefrigerant 측 spec 측
  //   category_data.workItems 측 serviceCode/orderType 측 측 X 측 = task_items 측 직접 catch
  const hasUsolNMainRefrigerant = Array.isArray(row.task_items) && row.task_items.some(it =>
    it.order_type === '본작업' &&
    it.work_types?.service_types?.code === 'refrigerant'
  );
  return {
    // 식별
    id:           row.id,
    taskCode:     row.task_no,
    taskNo:       row.task_no,
    tenantId:     row.tenant_id,
    categoryId:   row.category_id,
    principalId:  row.principal_id,

    // 고객
    customer:     row.customer_name,
    phone:        row.phone,
    address:      row.address,
    region:       row.district,

    // 채널 / 요청
    channel:      row.channel,
    request:      row.request_note,
    requestNote:  row.request_note,
    isUrgent:     row.is_urgent,

    // 상태
    status:       row.status,

    // 해피콜
    happycallStatus:       row.happycall_status,
    happycallMemo:         row.happycall_memo,
    happycallInternalNote: row.happycall_internal_note,
    happycallAt:           row.happycall_at,

    // 배정
    recommendedEngineerId: row.recommended_engineer_id,
    assignedEngineerId:    row.assigned_engineer_id,
    engineerId:            row.assigned_engineer_id,
    assignmentType:        row.assignment_type,

    // 일정
    requestedDate: row.requested_date,
    requestedTime: row.requested_time,
    scheduledAt:   row.scheduled_at,
    startedAt:     row.started_at,
    completedAt:   row.completed_at,
    // 2026-05-15 — Migration 013 status 변경 시점 (trigger 자동 기록 / 이력 화면 표시)
    assignedAt:            row.assigned_at,
    scheduledConfirmedAt:  row.scheduled_confirmed_at,
    workMemo:      row.work_memo,

    // 금액
    productPrice:  row.product_price,
    travelFee:     row.travel_fee,
    extraFee:      row.extra_fee,
    extraReason:   row.extra_reason,
    extraFeeAt:    row.extra_fee_at,
    totalAmount:   row.total_amount,
    estimateTotal: row.product_price,

    // 2026-05-19 Phase 5 Step 0.C-13 — is_legacy (Migration 042) — 옛 시트 데이터 측 marker
    isLegacy:      !!row.is_legacy,

    // 2026-05-21 Phase 5 Step 0.G-6-B/C — task 레벨 boolean (유솔N 본작업 + 냉매)
    //   _isUsolNMainRefrigerant 측 spec / category_data.workItems 측 측 측 X 측 = task_items 직접 catch
    hasUsolNMainRefrigerant,

    // 메타
    categoryData:  cat,
    // 2026-05-22 — 냉매 동의서 (category_data.consent jsonb 평탄화)
    //   { customerName, signatureUrl, signedAt } — 없으면 null
    consent:       cat.consent || null,
    // Phase 4-2 fix — category_data 평탄화 (시트 호환 / 화면 필터 통과)
    // 2026-05-19 Phase 5 Step 0.C-16 — task_items 측 fallback 매핑 (category_data.workItems 측 NULL 측 catch)
    // 2026-05-21 Phase 5 Step 0.G-5-A — serviceCode / orderType 측 측 추가
    //   카운트 통일 spec — "유솔N 본작업(order_type='본작업') + 냉매(service='refrigerant') 측만 포함"
    //   category_data.workItems 측 → 그대로 사용 / task_items fallback 측 → 두 필드 추가 매핑
    workItems:     Array.isArray(cat.workItems) && cat.workItems.length > 0
                     ? cat.workItems
                     : (Array.isArray(row.task_items) ? row.task_items.map(it => ({
                         workType:    it.work_types && it.work_types.name,
                         serviceCode: it.work_types?.service_types?.code || null,
                         orderType:   it.order_type || null,
                         appliance:   it.appliance_types && it.appliance_types.name,
                         qty:         Number(it.qty) || 1,
                         unitPrice:   Number(it.unit_price) || 0,
                       })) : []),
    workType:      cat.workType  || (Array.isArray(row.task_items) && row.task_items[0]?.work_types?.name) || "",
    appliance:     cat.appliance || (Array.isArray(row.task_items) && row.task_items[0]?.appliance_types?.name) || "",
    qty:           Number(cat.qty) || (Array.isArray(row.task_items) && Number(row.task_items[0]?.qty)) || 1,
    quote:         cat.quote      || 0,
    scheduleType:  cat.scheduleType || "",
    receivedAt:    row.received_at,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,

    // 002a — 외부 연동
    calendarEventId:     row.calendar_event_id,
    externalOrderNo:     row.external_order_no,
    externalPrincipalNo: row.external_principal_no,
    externalReceivedAt:  row.external_received_at,

    // Phase 4 후속 — 자동 배정 푸시 후보 (jsonb 배열 / 이름 또는 code 형태)
    pushCandidates: Array.isArray(row.push_candidates) ? row.push_candidates : [],

    // 2026-05-16 Phase 4 통합 2-C — payments JOIN 적용 (compute_payment v7 spec)
    payment,
    engineer_amount:  payment?.engineer_amount  || 0,
    principal_amount: payment?.principal_amount || 0,
    owner_amount:     payment?.owner_amount     || 0,
    calc_method:      payment?.calc_method      || null,
    payment_status:   payment?.status           || null,
    is_balanced:      payment?.is_balanced      ?? null,

    // 2026-05-18 Fix #29 — Migration 031/032: 자금 흐름 트랙 (compute_payment v10 자동 결정).
    // 'A'=일일정산(기사→회사), 'B'=월정산(회사→기사). isTrackARemittance가 task.track으로 판별.
    track:            payment?.track            ?? 'A',

    // 2026-05-17 Migration 025 — 기사 → 회사 송금 흐름
    engineerRemittedAt:       payment?.engineer_remitted_at        || null,
    engineerRemitConfirmedAt: payment?.engineer_remit_confirmed_at || null,
    engineerRemitConfirmedBy: payment?.engineer_remit_confirmed_by || null,

    _source: "supabase",
  };
}

// 클라이언트 task → Supabase row (snake_case)
// partial=true 측 부분 update — undefined 필드는 무시.
export function taskToRow(task, partial = false) {
  if (!task) return null;
  const row = {};

  // 식별
  if (task.id !== undefined) row.id = task.id;
  if (!partial) row.tenant_id = task.tenantId || TENANT_ID;
  else if (task.tenantId !== undefined) row.tenant_id = task.tenantId;

  if (task.taskNo !== undefined || task.taskCode !== undefined) {
    row.task_no = task.taskNo || task.taskCode;
  }
  // category_id 는 NOT NULL — insert 시 task.categoryId 누락이면 Phase 1 MVP 기본값 (aircon) fallback
  if (task.categoryId !== undefined) row.category_id = task.categoryId;
  else if (!partial)                 row.category_id = CATEGORY_ID_AIRCON;
  if (task.principalId !== undefined) row.principal_id = task.principalId;

  // 고객
  if (task.customer !== undefined) row.customer_name = task.customer;
  if (task.phone    !== undefined) row.phone         = task.phone;
  if (task.address  !== undefined) row.address       = task.address;
  if (task.region   !== undefined) row.district      = task.region;

  // 채널 / 요청
  if (task.channel     !== undefined) row.channel      = task.channel;
  if (task.requestNote !== undefined) row.request_note = task.requestNote;
  else if (task.request !== undefined) row.request_note = task.request;
  if (task.isUrgent !== undefined) row.is_urgent = !!task.isUrgent;

  // 상태
  if (task.status !== undefined) row.status = task.status;

  // 해피콜
  if (task.happycallStatus       !== undefined) row.happycall_status        = task.happycallStatus;
  if (task.happycallMemo         !== undefined) row.happycall_memo          = task.happycallMemo;
  if (task.happycallInternalNote !== undefined) row.happycall_internal_note = task.happycallInternalNote;
  if (task.happycallAt           !== undefined) row.happycall_at            = task.happycallAt;

  // 배정
  if (task.recommendedEngineerId !== undefined) row.recommended_engineer_id = task.recommendedEngineerId;
  if (task.assignedEngineerId    !== undefined) row.assigned_engineer_id    = task.assignedEngineerId;
  else if (task.engineerId       !== undefined) row.assigned_engineer_id    = task.engineerId;
  if (task.assignmentType        !== undefined) row.assignment_type         = task.assignmentType;

  // 일정
  if (task.requestedDate !== undefined) row.requested_date = task.requestedDate;
  if (task.requestedTime !== undefined) row.requested_time = task.requestedTime;
  if (task.scheduledAt   !== undefined) row.scheduled_at   = task.scheduledAt;
  if (task.startedAt     !== undefined) row.started_at     = task.startedAt;
  if (task.completedAt   !== undefined) row.completed_at   = task.completedAt;
  if (task.workMemo      !== undefined) row.work_memo      = task.workMemo;

  // 금액 (total_amount 은 GENERATED 라 row에 직접 설정 X)
  if (task.productPrice !== undefined) row.product_price = task.productPrice;
  if (task.travelFee    !== undefined) row.travel_fee    = task.travelFee;
  if (task.extraFee     !== undefined) row.extra_fee     = task.extraFee;
  if (task.extraReason  !== undefined) row.extra_reason  = task.extraReason;
  if (task.extraFeeAt   !== undefined) row.extra_fee_at  = task.extraFeeAt;

  if (task.categoryData !== undefined) row.category_data = task.categoryData;

  // 002a — 외부 연동
  if (task.calendarEventId     !== undefined) row.calendar_event_id      = task.calendarEventId;
  if (task.externalOrderNo     !== undefined) row.external_order_no      = task.externalOrderNo;
  if (task.externalPrincipalNo !== undefined) row.external_principal_no  = task.externalPrincipalNo;
  if (task.externalReceivedAt  !== undefined) row.external_received_at   = task.externalReceivedAt;

  // [DEBUG remit-row] extraFee 매핑 확인
  if (task.extraFee !== undefined || row.extra_fee !== undefined) {
    console.log('[remit-row debug]', {
      task_extraFee: task.extraFee,
      task_extraFee_typeof: typeof task.extraFee,
      row_extra_fee: row.extra_fee,
      row_keys: Object.keys(row),
    });
  }

  return row;
}

// ============================================================
// 조회 (READ)
// ============================================================

// 전체 작업 (필터 옵션 — status / engineerId / limit)
export async function loadTasksDb({ status, engineerId, limit = 200 } = {}) {
  let query = supabase
    .from("tasks")
    .select(PAYMENT_SELECT)
    .eq("tenant_id", TENANT_ID)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (status)     query = query.eq("status", status);
  if (engineerId) query = query.eq("assigned_engineer_id", engineerId);

  const { data, error } = await query;
  if (error) {
    console.error("[tasksDb.loadTasksDb]", error);
    return [];
  }
  return (data || []).map(rowToTask);
}

// id 단건 조회
export async function getTaskByIdDb(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from("tasks")
    .select(PAYMENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[tasksDb.getTaskByIdDb]", error);
    return null;
  }
  return rowToTask(data);
}

// task_no 단건 조회 (tenant 필터 적용)
export async function getTaskByTaskNoDb(taskNo) {
  if (!taskNo) return null;
  const { data, error } = await supabase
    .from("tasks")
    .select(PAYMENT_SELECT)
    .eq("tenant_id", TENANT_ID)
    .eq("task_no", taskNo)
    .maybeSingle();
  if (error) {
    console.error("[tasksDb.getTaskByTaskNoDb]", error);
    return null;
  }
  return rowToTask(data);
}

// 특정 기사 작업 조회 — scheduled_at 빠른 순
export async function listTasksByEngineerDb(engineerId) {
  if (!engineerId) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select(PAYMENT_SELECT)
    .eq("tenant_id", TENANT_ID)
    .eq("assigned_engineer_id", engineerId)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) {
    console.error("[tasksDb.listTasksByEngineerDb]", error);
    return [];
  }
  return (data || []).map(rowToTask);
}

// 상태별 카운트 — { 미배정: N, 확정: N, ... }
export async function countTasksByStatusDb() {
  const { data, error } = await supabase
    .from("tasks")
    .select("status")
    .eq("tenant_id", TENANT_ID);
  if (error) {
    console.error("[tasksDb.countTasksByStatusDb]", error);
    return {};
  }
  const counts = {};
  for (const row of data || []) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  return counts;
}

// 검색 — 고객명 / 전화 / 주소 부분일치 + 원청 / 지역 필터
export async function searchTasksDb({ query, principalId, region, limit = 50 } = {}) {
  let q = supabase
    .from("tasks")
    .select(PAYMENT_SELECT)
    .eq("tenant_id", TENANT_ID)
    .order("received_at", { ascending: false })
    .limit(limit);

  if (query) {
    const safe = String(query).replace(/[%,]/g, "");
    q = q.or(
      `customer_name.ilike.%${safe}%,phone.ilike.%${safe}%,address.ilike.%${safe}%,task_no.ilike.%${safe}%`
    );
  }
  if (principalId) q = q.eq("principal_id", principalId);
  if (region)      q = q.eq("district", region);

  const { data, error } = await q;
  if (error) {
    console.error("[tasksDb.searchTasksDb]", error);
    return [];
  }
  return (data || []).map(rowToTask);
}

// ============================================================
// 변경 (WRITE)
// ============================================================

// 신규 작업 추가 — 응답: { ok, data, error }
export async function createTaskDb(task) {
  if (!task) return { ok: false, error: "task 필수" };
  const row = taskToRow(task);
  console.log('[createTaskDb INSERT row]', JSON.stringify(row, null, 2));

  const { data, error } = await supabase
    .from("tasks")
    .insert(row)
    .select()
    .single();
  if (error) {
    console.error("[tasksDb.createTaskDb]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: rowToTask(data) };
}

// 작업 부분 업데이트 — partial update (undefined 필드 무시)
export async function updateTaskDb(id, updates) {
  if (!id || !updates) return { ok: false, error: "id / updates 필수" };
  const row = taskToRow(updates, true);
  // immutable 필드 제거 (혹시 들어왔으면)
  delete row.id;
  delete row.tenant_id;
  delete row.created_at;

  const { data, error } = await supabase
    .from("tasks")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();   // 2026-05-16 — single → maybeSingle (PATCH 406 PGRST116 fix)
  if (error) {
    console.error("[tasksDb.updateTaskDb]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data ? rowToTask(data) : null };
}

// 기사 배정 — status="배정" + assigned_engineer_id 설정
export async function assignEngineerDb(taskId, engineerId, { status = "배정" } = {}) {
  if (!taskId || !engineerId) return { ok: false, error: "taskId / engineerId 필수" };

  const { data, error } = await supabase
    .from("tasks")
    .update({
      assigned_engineer_id: engineerId,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select()
    .single();
  if (error) {
    console.error("[tasksDb.assignEngineerDb]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: rowToTask(data) };
}

// 상태 변경 단독 헬퍼 (시작/완료 등)
export async function updateTaskStatusDb(taskId, status, { startedAt, completedAt } = {}) {
  if (!taskId || !status) return { ok: false, error: "taskId / status 필수" };
  const patch = { status, updated_at: new Date().toISOString() };
  if (startedAt   !== undefined) patch.started_at   = startedAt;
  if (completedAt !== undefined) patch.completed_at = completedAt;

  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", taskId)
    .select()
    .single();
  if (error) {
    console.error("[tasksDb.updateTaskStatusDb]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: rowToTask(data) };
}

// ============================================================
// Phase 4-1 — 시트 getTasks 어댑터 (시그니처 호환)
// ============================================================
// 옛 api.js 측 getTasks(role, userId, principalCode) 시그니처 호환.
// 호출처 (AdminApp / EngineerApp / HappycallApp / PrincipalApp) 4곳 응답 처리:
//   - res.ok === false 분기 + v14FindTaskList(res)의 'tasks' 키 매칭
// 응답 shape: { ok: true, tasks: [...] } | { ok: false, error, tasks: [] }
//
// role별 처리:
//   - admin / happycall — 모든 작업 반환 (호출처에서 추가 필터 없음)
//   - engineer — 모든 작업 반환 (호출처 측 filterTasksForEngineerV14 활용)
//   - principal — 모든 작업 반환 (호출처 측 clientName 측 fuzzy 매칭 활용)
//
// principal name / assigned engineer name 추가:
//   tasks 측 principal_id (UUID) / assigned_engineer_id (UUID) 만 있어서
//   별도 fetch 후 in-memory join (PostgREST embed PGRST201 회피).
export async function loadTasksForRole(role, userId, principalCode) {
  try {
    // [1] 작업 전체
    const { data: rows, error } = await supabase
      .from("tasks")
      .select(PAYMENT_SELECT)
      .eq("tenant_id", TENANT_ID)
      .order("received_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[tasksDb.loadTasksForRole:tasks]", error);
      return { ok: false, error: error.message, tasks: [] };
    }

    if (!rows || rows.length === 0) {
      return { ok: true, tasks: [] };
    }

    // [2] principals lookup (in-memory join)
    const principalIds = [...new Set(rows.map(r => r.principal_id).filter(Boolean))];
    let principalMap = new Map();
    if (principalIds.length > 0) {
      const { data: pData, error: pErr } = await supabase
        .from("principals")
        .select("id, code, name, color, prefix")
        .in("id", principalIds);
      if (pErr) {
        console.error("[tasksDb.loadTasksForRole:principals]", pErr);
      } else {
        principalMap = new Map((pData || []).map(p => [p.id, p]));
      }
    }

    // [3] users (배정 기사) lookup
    const userIds = [...new Set(rows.map(r => r.assigned_engineer_id).filter(Boolean))];
    let userMap = new Map();
    if (userIds.length > 0) {
      const { data: uData, error: uErr } = await supabase
        .from("users")
        .select("id, code, name, phone")
        .in("id", userIds);
      if (uErr) {
        console.error("[tasksDb.loadTasksForRole:users]", uErr);
      } else {
        userMap = new Map((uData || []).map(u => [u.id, u]));
      }
    }

    // [4] rowToTask + 시트 호환 필드 추가 (principal name / assignedEngineer name 등)
    const tasks = rows.map(row => {
      const task = rowToTask(row);
      if (row.principal_id) {
        const p = principalMap.get(row.principal_id);
        if (p) {
          task.principal       = p.name || "";
          task.principalCode   = p.code || "";
          task.principalColor  = p.color || "";
          task.principalPrefix = p.prefix || "";
        }
      }
      if (row.assigned_engineer_id) {
        const u = userMap.get(row.assigned_engineer_id);
        if (u) {
          task.assignedEngineer = u.name || "";
          task.engineer         = u.name || "";
          task.engineerPhone    = u.phone || "";
          task.engineerCode     = u.code || "";
        }
      }
      return task;
    });

    return { ok: true, tasks };
  } catch (e) {
    console.error("[tasksDb.loadTasksForRole]", e);
    return { ok: false, error: e.message || '조회 실패', tasks: [] };
  }
}

// Phase 4-1 — 시트 getTaskDetail 어댑터 (호출처 0건이지만 시그니처 호환 보존)
// 응답: { ok: true, task } | { ok: false, error }
export async function getTaskDetailForId(taskId) {
  const task = await getTaskByIdDb(taskId);
  if (!task) return { ok: false, error: "작업 없음" };
  return { ok: true, task };
}

// ============================================================
// Phase 4-2 — 시트 createTask / updateTask / updateTaskStatus 어댑터
// ============================================================
import { generateTaskNo } from "../lib/taskNoGenerator.js";

// principals lookup 캐시 (name / code → id)
let _principalsCache = null;
let _principalsCacheAt = 0;
async function _getPrincipalsCache() {
  if (_principalsCache && Date.now() - _principalsCacheAt < 60000) {
    return _principalsCache;
  }
  const { data, error } = await supabase
    .from("principals")
    .select("id, code, name, prefix")
    .eq("tenant_id", TENANT_ID);
  if (error) {
    console.error("[tasksDb._getPrincipalsCache]", error);
    return [];
  }
  _principalsCache = data || [];
  _principalsCacheAt = Date.now();
  return _principalsCache;
}

// principal 이름 또는 code → id (UUID) 변환
async function _resolvePrincipalId({ principal, principalCode, principalId } = {}) {
  if (principalId) return principalId;
  const list = await _getPrincipalsCache();
  if (principalCode) {
    const m = list.find(p => p.code === principalCode);
    if (m) return m.id;
  }
  if (principal) {
    const m = list.find(p => p.name === principal || p.code === principal);
    if (m) return m.id;
  }
  return null;
}

// principal 이름 → code 변환
async function _resolvePrincipalCode(principalName) {
  if (!principalName) return null;
  const list = await _getPrincipalsCache();
  const m = list.find(p => p.name === principalName || p.code === principalName);
  return m ? m.code : null;
}

// ============================================================
// createTaskAdapter — 시트 createTask(taskData) 어댑터
// ============================================================
// 입력: taskData (옛 시트 호환 shape)
//   { principal, channel, customer, phone, address, region,
//     workType, appliance, qty, workItems, quote, estimateTotal,
//     scheduledDate, scheduledTime, memo, status, ... }
//
// 처리:
//   1) principal 이름 → principal_id (UUID) 변환
//   2) 작업번호 자동 생성 (generateTaskNo)
//   3) tasks 측 INSERT (category_data jsonb에 workItems 포함)
//
// 응답: { ok: true, taskId, task_no, task } | { ok: false, error, timeout? }
// 호환: 호출처 res.ok / res.taskId / res.task_no 사용
export async function createTaskAdapter(taskData) {
  if (!taskData) return { ok: false, error: "taskData 없음" };

  try {
    // [1] principal 변환
    const principalCode = taskData.principalCode || await _resolvePrincipalCode(taskData.principal);
    const principalId = await _resolvePrincipalId({
      principal: taskData.principal,
      principalCode,
      principalId: taskData.principalId,
    });
    if (!principalId) {
      return { ok: false, error: `원청 매핑 실패: ${taskData.principal || taskData.principalCode}` };
    }

    // [2] 작업번호 자동 생성
    const tnRes = await generateTaskNo({ principalCode });
    if (!tnRes.ok) {
      return { ok: false, error: `작업번호 생성 실패: ${tnRes.error}` };
    }
    const taskNo = tnRes.taskNo;

    // [3] scheduled_at ISO 조합 (호출처가 scheduledDate + scheduledTime 별도 전달 경우)
    let scheduledAtIso = taskData.scheduledAt || null;
    if (!scheduledAtIso && taskData.scheduledDate && taskData.scheduledTime) {
      // 2026-05-16 fix — KST timezone 명시
      scheduledAtIso = `${taskData.scheduledDate}T${taskData.scheduledTime}:00+09:00`;
    }

    // [4] category_data jsonb 구성 (workItems / 메타)
    const categoryData = {
      ...(taskData.workItems ? { workItems: taskData.workItems } : {}),
      ...(taskData.workType  ? { workType:  taskData.workType  } : {}),
      ...(taskData.appliance ? { appliance: taskData.appliance } : {}),
      ...(taskData.qty       ? { qty:       taskData.qty       } : {}),
      ...(taskData.quote     ? { quote:     taskData.quote     } : {}),
      ...(taskData.scheduleType ? { scheduleType: taskData.scheduleType } : {}),
    };

    // [5] tasks row INSERT
    const taskRow = {
      taskNo,
      principalId,
      customer:      taskData.customer  || "",
      phone:         taskData.phone     || "",
      address:       taskData.address   || "",
      region:        taskData.region    || taskData.district || "",
      channel:       taskData.channel   || "",
      requestNote:   taskData.memo      || taskData.request || taskData.requestNote || "",
      status:        taskData.status    || "미배정",
      productPrice:  Number(taskData.estimateTotal || taskData.quote || taskData.productPrice || 0),
      extraFee:      Number(taskData.extraFee  || 0),
      travelFee:     Number(taskData.travelFee || 0),
      requestedDate: taskData.scheduledDate || taskData.requestedDate || null,
      requestedTime: taskData.scheduledTime || taskData.requestedTime || null,
      scheduledAt:   scheduledAtIso,
      categoryData,
    };

    const res = await createTaskDb(taskRow);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }

    return {
      ok: true,
      taskId: res.data?.id,
      task_no: res.data?.taskCode,
      taskNo: res.data?.taskCode,
      task: res.data,
    };
  } catch (e) {
    console.error("[tasksDb.createTaskAdapter]", e);
    return { ok: false, error: e.message || "생성 실패" };
  }
}

// ============================================================
// updateTaskAdapter — 시트 updateTask(taskId, updates) 어댑터
// ============================================================
// 입력: taskId, updates (camelCase / 한국어 키 호환)
//   updates 예: { status, scheduledAt, memo, assignedEngineer, cancelReason, ... }
//
// 처리:
//   · assignedEngineer (이름) → assigned_engineer_id (UUID) 변환은 별도 Phase
//     (현재 어댑터는 직접 ID만 처리 — Phase 4-3 배정 단계에서 이름→ID 변환 예정)
//   · memo / 작업메모 → workMemo 또는 requestNote
//
// 응답: { ok: true, task } | { ok: false, error }
export async function updateTaskAdapter(taskId, updates) {
  if (!taskId || !updates) return { ok: false, error: "taskId / updates 없음" };

  // 시트 호환 키 정규화
  const normalized = { ...updates };
  if (normalized.작업메모 !== undefined && normalized.memo === undefined) {
    normalized.memo = normalized.작업메모;
  }
  if (normalized.memo !== undefined && normalized.workMemo === undefined) {
    normalized.workMemo = normalized.memo;
  }
  if (normalized.확정일시 !== undefined && normalized.scheduledAt === undefined) {
    normalized.scheduledAt = normalized.확정일시;
  }

  try {
    const res = await updateTaskDb(taskId, normalized);
    return res;
  } catch (e) {
    console.error("[tasksDb.updateTaskAdapter]", e);
    return { ok: false, error: e.message || "수정 실패" };
  }
}

// ============================================================
// updateTaskStatusAdapter — 시트 updateTaskStatus(taskId, status, updates) 어댑터
// ============================================================
// 응답: { ok: true, task } | { ok: false, error }
export async function updateTaskStatusAdapter(taskId, status, updates = {}) {
  if (!taskId || !status) return { ok: false, error: "taskId / status 없음" };
  try {
    // updates에 startedAt / completedAt 포함 가능
    const opts = {};
    if (updates.startedAt   !== undefined) opts.startedAt   = updates.startedAt;
    if (updates.completedAt !== undefined) opts.completedAt = updates.completedAt;
    const res = await updateTaskStatusDb(taskId, status, opts);

    // 추가 필드 있으면 별도 updateTaskDb 호출
    const extraKeys = Object.keys(updates).filter(k => k !== "startedAt" && k !== "completedAt");
    if (res.ok && extraKeys.length > 0) {
      const extra = {};
      for (const k of extraKeys) extra[k] = updates[k];
      await updateTaskDb(taskId, extra);
    }
    return res;
  } catch (e) {
    console.error("[tasksDb.updateTaskStatusAdapter]", e);
    return { ok: false, error: e.message || "상태 변경 실패" };
  }
}

// ============================================================
// Phase 4-3 — 취소 흐름 어댑터 3개
// ============================================================
// 시트 GAS (requestCancel / approveCancel / rejectCancel) 대체.
//
// 흐름:
//   [배정/확정 진행 중]
//     ↓ 기사 측 취소 요청 (사유 입력)
//   status='취소요청' + category_data.cancelReason=사유 + category_data.previousStatus=이전 status
//     ↓ 운영자 측 V14AdminModal
//     ├─ ✓ 확인 → status='취소' + category_data.cancelApproveReason=확인 사유
//     └─ ✗ 거절 → previousStatus 복원 + category_data.cancelRejectReason=거절 사유
//
// 응답:
//   requestCancelAdapter — { ok: true, task } | { ok: false, error }
//   approveCancelAdapter — { ok: true, task } | { ok: false, error }
//   rejectCancelAdapter  — { ok: true, task, oldStatus } | { ok: false, error }
//
// DB 의존:
//   · status enum에 '취소요청' 등록돼 있어야 (대표님 SQL 실행 완료)
//   · category_data jsonb 활용 (마이그 0개)

// 기사 측 취소 요청 — status='취소요청' + previousStatus 저장
export async function requestCancelAdapter(taskId, reason) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  const reasonText = String(reason || "").trim();
  if (!reasonText) return { ok: false, error: "취소 사유 없음" };

  try {
    // [1] 현재 task 조회 (이전 status 추출용)
    const current = await getTaskByIdDb(taskId);
    if (!current) return { ok: false, error: "작업 없음" };

    const previousStatus = current.status || "배정";

    // [2] category_data 업데이트 (cancelReason + previousStatus)
    const nextCategoryData = {
      ...(current.categoryData || {}),
      cancelReason:   reasonText,
      previousStatus,
      cancelRequestedAt: new Date().toISOString(),
    };

    // [3] updateTaskDb 호출
    const res = await updateTaskDb(taskId, {
      status:       "취소요청",
      categoryData: nextCategoryData,
    });
    if (!res.ok) return res;
    return { ok: true, task: res.data };
  } catch (e) {
    console.error("[tasksDb.requestCancelAdapter]", e);
    return { ok: false, error: e.message || "취소 요청 실패" };
  }
}

// 운영자 측 취소 확인 — status='취소' + cancelApproveReason 저장
export async function approveCancelAdapter(taskId, reason) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  const reasonText = String(reason || "운영자 확인").trim();

  try {
    // [1] 현재 task 조회 (category_data 보존)
    const current = await getTaskByIdDb(taskId);
    if (!current) return { ok: false, error: "작업 없음" };

    // [2] category_data 업데이트 (cancelApproveReason + 시각)
    const nextCategoryData = {
      ...(current.categoryData || {}),
      cancelApproveReason: reasonText,
      cancelApprovedAt:    new Date().toISOString(),
    };

    // [3] updateTaskDb 호출
    const res = await updateTaskDb(taskId, {
      status:       "취소",
      categoryData: nextCategoryData,
    });
    if (!res.ok) return res;
    return { ok: true, task: res.data };
  } catch (e) {
    console.error("[tasksDb.approveCancelAdapter]", e);
    return { ok: false, error: e.message || "취소 확인 실패" };
  }
}

// ============================================================
// Phase 4-4 — 배정 흐름 어댑터 + users 캐시
// ============================================================

// users 캐시 (engineer 역할 측 중심 / 1분 TTL)
let _usersCache = null;
let _usersCacheAt = 0;
async function _getUsersCache() {
  if (_usersCache && Date.now() - _usersCacheAt < 60000) {
    return _usersCache;
  }
  const { data, error } = await supabase
    .from("users")
    .select("id, code, name, phone")
    .eq("tenant_id", TENANT_ID);
  if (error) {
    console.error("[tasksDb._getUsersCache]", error);
    return [];
  }
  _usersCache = data || [];
  _usersCacheAt = Date.now();
  return _usersCache;
}

// 이름 또는 code → users.id (UUID) 변환
// 동명이인 시 첫 매칭 사용 (engineer 역할 측 중복 가능성 낮음)
async function _resolveUserIdByName(nameOrCode) {
  if (!nameOrCode) return null;
  const key = String(nameOrCode).trim();
  if (!key) return null;
  const list = await _getUsersCache();
  // code 우선 매칭 (E001 형식)
  const byCode = list.find(u => u.code === key);
  if (byCode) return byCode.id;
  // name 매칭 (한글 이름)
  const byName = list.find(u => u.name === key);
  if (byName) return byName.id;
  return null;
}

// 운영자 측 기사 배정 — 시트 assignEngineer(taskId, engineerName) 어댑터
// engineerName 이름 또는 code 형태 → users.id (UUID) 변환 후 assignEngineerDb 호출
// 응답: { ok: true, taskId, task } | { ok: false, error }
export async function assignEngineerAdapter(taskId, engineerName, options = {}) {
  if (!taskId)        return { ok: false, error: "taskId 없음" };
  if (!engineerName)  return { ok: false, error: "engineerName 없음" };

  try {
    const userId = await _resolveUserIdByName(engineerName);
    if (!userId) {
      return { ok: false, error: `기사 매핑 실패 (${engineerName})` };
    }

    const status = options.status || "배정";
    const res = await assignEngineerDb(taskId, userId, { status });
    if (!res.ok) return res;
    return { ok: true, taskId: res.data?.id, task: res.data };
  } catch (e) {
    console.error("[tasksDb.assignEngineerAdapter]", e);
    return { ok: false, error: e.message || "배정 실패" };
  }
}

// ============================================================
// Phase 4-5 — 작업 시작 / 완료 / 금액 변경 어댑터
// ============================================================

// 기사 측 작업 시작 — status='진행중' + startedAt 기록
// 응답: { ok: true, task } | { ok: false, error }
export async function startTaskAdapter(taskId) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  return updateTaskStatusAdapter(taskId, "진행중", {
    startedAt: new Date().toISOString(),
  });
}

// 기사 측 작업 완료 — status='완료' + completedAt 기록
// (사진 업로드는 호출처에서 photosDb.uploadPhoto 별도 호출)
// 응답: { ok: true, task } | { ok: false, error }
export async function completeTaskAdapter(taskId) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  const res = await updateTaskStatusAdapter(taskId, "완료", {
    completedAt: new Date().toISOString(),
  });

  // 2026-05-16 — Phase 4 B-2: 작업 완료 시 정산 자동 계산 (이중 안전망 frontend layer)
  // DB trigger도 등록돼 있어 둘 다 발화. compute_payment는 idempotent (DELETE + INSERT)
  if (res.ok) {
    try {
      const { error } = await supabase.rpc('compute_payment', { p_task_id: taskId });
      if (error) {
        console.warn('[completeTaskAdapter] compute_payment 실패 (작업 완료는 통과):', error.message);
      }
    } catch (e) {
      console.warn('[completeTaskAdapter] compute_payment 예외 (작업 완료는 통과):', e.message);
    }
  }

  return res;
}

// 기사 측 금액 변경 — productPrice / extraFee / extraReason 업데이트
// 시그니처 호환: (taskId, newPrice, addAmount, reason)
// 응답: { ok: true, task } | { ok: false, error }
export async function changePriceAdapter(taskId, newPrice, addAmount, reason) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  const updates = {
    extraFeeAt: new Date().toISOString(),
  };
  if (newPrice  !== undefined && newPrice  !== null) updates.productPrice = Number(newPrice)  || 0;
  if (addAmount !== undefined && addAmount !== null) updates.extraFee     = Number(addAmount) || 0;
  if (reason)                                        updates.extraReason  = String(reason);
  const res = await updateTaskAdapter(taskId, updates);

  // 2026-05-17 — extra_fee 변경 시 payments 선행 재계산.
  // trigger_compute_payment는 status='완료'에서만 발화하므로 진행중 단계 변경분은 stale.
  // 완료 확인 화면이 표시할 engineer_amount가 정확하도록 여기서 미리 호출. idempotent.
  if (res.ok) {
    try {
      const { error } = await supabase.rpc('compute_payment', { p_task_id: taskId });
      if (error) {
        console.warn('[changePriceAdapter] compute_payment 실패 (금액 변경은 통과):', error.message);
      }
    } catch (e) {
      console.warn('[changePriceAdapter] compute_payment 예외 (금액 변경은 통과):', e.message);
    }
  }

  return res;
}

// ============================================================
// 2026-05-22 — 냉매 동의서 저장 (Phase 1)
// ============================================================
// 현재 category_data 측 consent 키만 머지 — 다른 키(cancelReason 등) 보존.
// requestCancelAdapter 패턴 동일 차용 (current 조회 → spread → 저장).
//
// 입력: taskId, { customerName, signatureUrl }
// 출력: { ok: true, task } | { ok: false, error }
export async function saveConsentAdapter(taskId, { customerName, signatureUrl }) {
  if (!taskId)        return { ok: false, error: "taskId 없음" };
  if (!customerName)  return { ok: false, error: "고객 성함 없음" };
  if (!signatureUrl)  return { ok: false, error: "서명 없음" };

  try {
    const current = await getTaskByIdDb(taskId);
    if (!current) return { ok: false, error: "작업 없음" };

    const nextCategoryData = {
      ...(current.categoryData || {}),
      consent: {
        customerName: String(customerName).trim(),
        signatureUrl,
        signedAt: new Date().toISOString(),
      },
    };

    const res = await updateTaskDb(taskId, { categoryData: nextCategoryData });
    if (!res.ok) return res;
    return { ok: true, task: res.data };
  } catch (e) {
    console.error("[tasksDb.saveConsentAdapter]", e);
    return { ok: false, error: e.message || "동의서 저장 실패" };
  }
}

// 기사 측 자동 배정 수락 — 시트 acceptOffer(taskId, engineerName) 어댑터
// race condition 처리: assigned_engineer_id IS NULL 조건부 UPDATE
// 이미 다른 기사 배정돼 있으면 "이미 다른 기사가 수락" 에러 반환 (선착순)
// 응답: { ok: true, taskId, task } | { ok: false, error: "이미 다른 기사가 수락" 등 }
export async function acceptOfferAdapter(taskId, engineerName) {
  if (!taskId)       return { ok: false, error: "taskId 없음" };
  if (!engineerName) return { ok: false, error: "engineerName 없음" };

  try {
    const userId = await _resolveUserIdByName(engineerName);
    if (!userId) {
      return { ok: false, error: `기사 매핑 실패 (${engineerName})` };
    }

    // 조건부 UPDATE — assigned_engineer_id IS NULL 조건만 통과 (race condition 처리)
    const { data, error } = await supabase
      .from("tasks")
      .update({
        assigned_engineer_id: userId,
        status: "배정",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .is("assigned_engineer_id", null)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[tasksDb.acceptOfferAdapter]", error);
      return { ok: false, error: error.message };
    }
    // data가 null이면 조건 불일치 (이미 다른 기사 배정됨 또는 task 없음)
    if (!data) {
      // 추가 확인: task 존재 여부 (에러 메시지 정확하게)
      const existing = await getTaskByIdDb(taskId);
      if (!existing) {
        return { ok: false, error: "작업 없음" };
      }
      return { ok: false, error: "이미 다른 기사가 수락했습니다" };
    }

    return { ok: true, taskId: data.id, task: rowToTask(data) };
  } catch (e) {
    console.error("[tasksDb.acceptOfferAdapter]", e);
    return { ok: false, error: e.message || "수락 실패" };
  }
}

// 운영자 측 취소 거절 — previousStatus 복원 + cancelRejectReason 저장
// 응답에 oldStatus 포함 (호출처 측 Optimistic Update 활용)
export async function rejectCancelAdapter(taskId, rejectReason) {
  if (!taskId) return { ok: false, error: "taskId 없음" };
  const reasonText = String(rejectReason || "").trim();
  if (!reasonText) return { ok: false, error: "거절 사유 없음" };

  try {
    // [1] 현재 task 조회 (previousStatus 추출)
    const current = await getTaskByIdDb(taskId);
    if (!current) return { ok: false, error: "작업 없음" };

    const oldStatus = current.categoryData?.previousStatus || "미배정";

    // [2] category_data 업데이트 (cancelRejectReason + 시각 / previousStatus 제거)
    const nextCategoryData = { ...(current.categoryData || {}) };
    delete nextCategoryData.previousStatus;
    nextCategoryData.cancelRejectReason = reasonText;
    nextCategoryData.cancelRejectedAt   = new Date().toISOString();

    // [3] updateTaskDb 호출 (status를 previousStatus로 복원)
    const res = await updateTaskDb(taskId, {
      status:       oldStatus,
      categoryData: nextCategoryData,
    });
    if (!res.ok) return res;
    return { ok: true, task: res.data, oldStatus };
  } catch (e) {
    console.error("[tasksDb.rejectCancelAdapter]", e);
    return { ok: false, error: e.message || "취소 거절 실패" };
  }
}
