// V11-1 — 작업(Task) 통합 storage + 헬퍼
// AdminApp의 시드(TASKS_TODAY/ASSIGNED_TASKS/NEW_RECEPTIONS)는 V11-2에서 통합 예정.
// V11-1 단계에서는 localStorage에 저장된 외부 작업(예: CSV 임포트)만 보관.
//
// Phase 2 — Supabase tasks 테이블로 옮길 때 동일 인터페이스 유지.

const STORAGE_KEY = "ollit_tasks_v1";

// ── storage ─────────────────────────────────────
export function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTasks(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
    return true;
  } catch (e) {
    console.error("[tasks.saveTasks]", e);
    return false;
  }
}

export function appendTask(task) {
  if (!task) return null;
  const list = loadTasks();
  list.push(task);
  saveTasks(list);
  return task;
}

export function updateTask(id, patch) {
  if (!id || !patch) return null;
  const list = loadTasks();
  const idx = list.findIndex(t => t.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  saveTasks(list);
  return list[idx];
}

export function generateTaskId(prefix = "task") {
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${ts}_${r}`;
}

// ── 헬퍼 (V11-1) ────────────────────────────────
// productOrderId로 작업 찾기 — 자동 분류의 핵심
export function findTaskByProductOrderId(productOrderId, tasksArg) {
  if (!productOrderId) return null;
  const list = tasksArg || loadTasks();
  return list.find(t => t.productOrderId === productOrderId) || null;
}

// 같은 주문번호 묶음 (한 고객이 여러 상품 주문)
export function findTasksByOrderNumber(orderNumber, tasksArg) {
  if (!orderNumber) return [];
  const list = tasksArg || loadTasks();
  return list.filter(t => t.orderNumber === orderNumber);
}

// 유솔 N 작업만
export function getUsolNTasks(tasksArg) {
  const list = tasksArg || loadTasks();
  return list.filter(t => t.principalId === "usol_n");
}

// 유솔 N 작업의 3시점 상태
// pending_settlement (🟡) → pending_deposit (🟠) → completed (✅)
export function getUsolNStatus(task) {
  if (!task) return null;
  if (!task.naverSettledAt)    return "pending_settlement";
  if (!task.companyReceivedAt) return "pending_deposit";
  return "completed";
}

// 작업 완료 후 N일 이상 지났는데 유솔 정산이 아직인 작업 (기본 13일)
export function getLongPendingTasks(daysThreshold = 13, tasksArg) {
  const usolNTasks = getUsolNTasks(tasksArg);
  const now = Date.now();
  const ms = daysThreshold * 24 * 60 * 60 * 1000;
  return usolNTasks.filter(t => {
    if (t.naverSettledAt) return false;
    if (!t.completedAt)   return false;
    const completedMs = new Date(t.completedAt).getTime();
    return (now - completedMs) >= ms;
  });
}

// V11-1 새 필드 기본값 — 시드/임포트가 일관되게 채우도록 사용
export function makeEmptyTask(overrides = {}) {
  return {
    id: generateTaskId(),
    // 식별
    taskCode: "",
    productOrderId: null,
    orderNumber: null,
    orderType: null,        // 'basic' | 'extra'
    productName: null,
    optionInfo: null,
    // 작업
    workType: "",
    appliance: "",
    qty: 1,
    workItems: null,
    // 고객 (수취인 우선)
    customer: "",
    phone: "",
    address: "",
    region: "",
    request: "",
    buyerName: null,
    buyerPhone: null,
    // 일정
    schedule: "",
    time: "",
    workDate: null,
    // 금액 (일반)
    estimateTotal: 0,
    addonFee: 0,
    engineerEarning: 0,
    companyMargin: 0,
    principalFee: 0,
    // 금액 (유솔 N)
    grossAmount: 0,
    npayFee: 0,
    salesLinkFee: 0,
    netAmount: 0,
    // 시점 — 일반
    receivedAt: null,
    completedAt: null,
    engineerPaidAt: null,    // 기사 → 회사 입금 (5원청)
    // 시점 — 유솔 N (3시점)
    paidAt: null,            // 네이버 결제일
    naverSettledAt: null,    // 네이버 정산완료일
    companyReceivedAt: null, // 회사 받은 날 (월요일)
    engineerSettledAt: null, // 기사에게 입금한 날 (15일)
    settlementStatus: null,
    settlementBaseDate: null,
    // 배정
    principal: "",
    principalId: "",
    engineer: "",
    engineerId: "",
    state: "waiting",
    status: "received",
    // CSV 메타
    importCsvType: null,     // 'usol_n_order' | 'usol_n_settlement' | 'manual'
    csvImportedAt: null,
    ...overrides,
  };
}
