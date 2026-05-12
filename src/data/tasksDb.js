// Phase 2 — Supabase tasks CRUD (점진 교체용 신규 모듈)
// 옛 src/data/tasks.js (localStorage)는 그대로 두고, 신규 흐름은 여기서 박음.
// 외부 인터페이스(rowToTask 결과)는 옛 v14NormalizeTask 결과와 호환되게 camelCase 박음.

import { supabase } from "../lib/supabase.js";

// Phase 1 MVP 단일 테넌트 (allit). 멀티 테넌트 박을 영역에서 user.tenant_id 측 박음.
export const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// ============================================================
// normalize — Supabase row ↔ 클라이언트 task
// ============================================================

// Supabase row → 클라이언트 task (camelCase / v14NormalizeTask 호환)
export function rowToTask(row) {
  if (!row) return null;
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
    workMemo:      row.work_memo,

    // 금액
    productPrice:  row.product_price,
    travelFee:     row.travel_fee,
    extraFee:      row.extra_fee,
    extraReason:   row.extra_reason,
    extraFeeAt:    row.extra_fee_at,
    totalAmount:   row.total_amount,
    estimateTotal: row.total_amount,

    // 메타
    categoryData:  row.category_data || {},
    receivedAt:    row.received_at,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,

    // 002a — 외부 연동
    calendarEventId:     row.calendar_event_id,
    externalOrderNo:     row.external_order_no,
    externalPrincipalNo: row.external_principal_no,
    externalReceivedAt:  row.external_received_at,

    _source: "supabase",
  };
}

// 클라이언트 task → Supabase row (snake_case)
// partial=true 측 박은 영역 update — undefined 박은 영역 무시.
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
  if (task.categoryId !== undefined)  row.category_id  = task.categoryId;
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

  // 금액 (total_amount 은 GENERATED 라 박지 X)
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

  return row;
}

// ============================================================
// 조회 (READ)
// ============================================================

// 전체 작업 (필터 옵션 — status / engineerId / limit)
export async function loadTasksDb({ status, engineerId, limit = 200 } = {}) {
  let query = supabase
    .from("tasks")
    .select("*")
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

// id 박은 영역 단건
export async function getTaskByIdDb(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[tasksDb.getTaskByIdDb]", error);
    return null;
  }
  return rowToTask(data);
}

// task_no 박은 영역 단건 (tenant 측 박음)
export async function getTaskByTaskNoDb(taskNo) {
  if (!taskNo) return null;
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("task_no", taskNo)
    .maybeSingle();
  if (error) {
    console.error("[tasksDb.getTaskByTaskNoDb]", error);
    return null;
  }
  return rowToTask(data);
}

// 특정 기사 박은 영역 작업 — scheduled_at 빠른 순
export async function listTasksByEngineerDb(engineerId) {
  if (!engineerId) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
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
    .select("*")
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

// 신규 작업 박음 — 응답: { ok, data, error }
export async function createTaskDb(task) {
  if (!task) return { ok: false, error: "task 필수" };
  const row = taskToRow(task);

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

// 작업 박은 영역 박음 — partial update (undefined 박은 영역 무시)
export async function updateTaskDb(id, updates) {
  if (!id || !updates) return { ok: false, error: "id / updates 필수" };
  const row = taskToRow(updates, true);
  // immutable 필드 제거 (혹시 박혔으면)
  delete row.id;
  delete row.tenant_id;
  delete row.created_at;

  const { data, error } = await supabase
    .from("tasks")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[tasksDb.updateTaskDb]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: rowToTask(data) };
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
