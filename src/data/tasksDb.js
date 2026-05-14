// Phase 2 — Supabase tasks CRUD (점진 교체용 신규 모듈)
// 옛 src/data/tasks.js (localStorage)는 그대로 두고, 신규 흐름은 여기서 박음.
// 외부 인터페이스(rowToTask 결과)는 옛 v14NormalizeTask 결과와 호환되게 camelCase 박음.

import { supabase } from "../lib/supabase.js";

// Phase 1 MVP 단일 테넌트 (allit). 멀티 테넌트 박을 영역에서 user.tenant_id 측 박음.
export const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// Phase 1 MVP 단일 카테고리 (aircon). tasks.category_id NOT NULL — task.categoryId 박지 X 박힌 영역 측 fallback.
export const CATEGORY_ID_AIRCON = "33333333-3333-3333-3333-333333333001";

// ============================================================
// normalize — Supabase row ↔ 클라이언트 task
// ============================================================

// Supabase row → 클라이언트 task (camelCase / v14NormalizeTask 호환)
export function rowToTask(row) {
  if (!row) return null;
  // Phase 4-2 fix — category_data jsonb 평탄화 (workType/workItems 등 별도 추출)
  // 화면 필터 (NewReceptionScreen.getByType / v14NormalizeTask) 호환
  const cat = row.category_data || {};
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
    categoryData:  cat,
    // Phase 4-2 fix — category_data 평탄화 (시트 호환 / 화면 필터 통과)
    workItems:     Array.isArray(cat.workItems) ? cat.workItems : [],
    workType:      cat.workType  || "",
    appliance:     cat.appliance || "",
    qty:           Number(cat.qty) || 1,
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
  // category_id 는 NOT NULL — insert 측 task.categoryId 박지 X 박혔으면 Phase 1 MVP 박은 영역 (aircon) fallback
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
// principal name / assigned engineer name 박음:
//   tasks 측 principal_id (UUID) / assigned_engineer_id (UUID) 만 박혀있어서
//   별도 fetch 후 in-memory join (PostgREST embed PGRST201 회피).
export async function loadTasksForRole(role, userId, principalCode) {
  try {
    // [1] 작업 전체
    const { data: rows, error } = await supabase
      .from("tasks")
      .select("*")
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

    // [4] rowToTask + 시트 호환 필드 박음 (principal name / assignedEngineer name 등)
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
//   2) 작업번호 자동 박음 (generateTaskNo)
//   3) tasks 측 INSERT (category_data jsonb에 workItems 박음)
//
// 응답: { ok: true, taskId, task_no, task } | { ok: false, error, timeout? }
// 호환: 호출처 res.ok / res.taskId / res.task_no 사용
export async function createTaskAdapter(taskData) {
  if (!taskData) return { ok: false, error: "taskData 박지 X" };

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

    // [2] 작업번호 자동 박음
    const tnRes = await generateTaskNo({ principalCode });
    if (!tnRes.ok) {
      return { ok: false, error: `작업번호 생성 실패: ${tnRes.error}` };
    }
    const taskNo = tnRes.taskNo;

    // [3] scheduled_at ISO 박음 (호출처가 scheduledDate + scheduledTime 별도 박는 경우)
    let scheduledAtIso = taskData.scheduledAt || null;
    if (!scheduledAtIso && taskData.scheduledDate && taskData.scheduledTime) {
      scheduledAtIso = `${taskData.scheduledDate}T${taskData.scheduledTime}:00`;
    }

    // [4] category_data jsonb 박음 (workItems / 메타)
    const categoryData = {
      ...(taskData.workItems ? { workItems: taskData.workItems } : {}),
      ...(taskData.workType  ? { workType:  taskData.workType  } : {}),
      ...(taskData.appliance ? { appliance: taskData.appliance } : {}),
      ...(taskData.qty       ? { qty:       taskData.qty       } : {}),
      ...(taskData.quote     ? { quote:     taskData.quote     } : {}),
      ...(taskData.scheduleType ? { scheduleType: taskData.scheduleType } : {}),
    };

    // [5] tasks row 박음
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
//     (현재 어댑터는 직접 ID만 catch — Phase 4-3 배정 단계에서 박을 차례)
//   · memo / 작업메모 → workMemo 또는 requestNote
//
// 응답: { ok: true, task } | { ok: false, error }
export async function updateTaskAdapter(taskId, updates) {
  if (!taskId || !updates) return { ok: false, error: "taskId / updates 박지 X" };

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
  if (!taskId || !status) return { ok: false, error: "taskId / status 박지 X" };
  try {
    // updates 측 startedAt / completedAt 박힐 수 있음
    const opts = {};
    if (updates.startedAt   !== undefined) opts.startedAt   = updates.startedAt;
    if (updates.completedAt !== undefined) opts.completedAt = updates.completedAt;
    const res = await updateTaskStatusDb(taskId, status, opts);

    // 추가 필드 박혔으면 별도 updateTaskDb 호출
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
