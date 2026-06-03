// 2026-06-03 — 기사별 달력 측측 helper (운영자 PWA).
//   사장님 시안 1번 — 월 격자 + 일정 점 (세척 파랑 / 냉매 주황).
//   날짜 버킷: scheduled_at → toKstYmd (KST 측측).
//   종류: workItems[].serviceCode (cleaning / refrigerant).
import { toKstYmd } from "./dateLabel.js";

// task → 측측 service code (= 측측 본작업 측측 측측 측측).
function pickServiceCode(task) {
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  if (items.length === 0) return null;
  const main = items.find(it => (it.orderType || it.order_type) === "본작업") || items[0];
  return main?.serviceCode || main?.service_code || null;
}

// 기사 매칭 — engineerKey 측측 (id 측측 name).
//   apiTasks 측 task.assignedEngineerId 측측 측측 측측 task.engineer (name).
//   apiEngineers 측측 측측 id/name 측측 측측 측측 측측.
function taskMatchesEngineer(task, engineer) {
  if (!engineer) return false;
  // ID 측측 (가장 측측측)
  const taskEngId = task.assignedEngineerId || task.assigned_engineer_id || task.engineerId;
  if (taskEngId && engineer.id && taskEngId === engineer.id) return true;
  // 이름 측측 (fallback)
  const taskEngName = task.assignedEngineer || task.engineer || "";
  if (taskEngName && engineer.name && taskEngName === engineer.name) return true;
  return false;
}

// 2026-06-03 Phase B — 측측 task → 측측 기사 찾기 (apiEngineers 측측).
//   apiTasks 측 측측 측측 (id 측측 name) 측측 측측 측측 측측 측측 측측 측측 측측.
export function findEngineerForTask(task, apiEngineers = []) {
  if (!task) return null;
  const taskEngId = task.assignedEngineerId || task.assigned_engineer_id || task.engineerId;
  if (taskEngId) {
    const byId = apiEngineers.find(e => e.id === taskEngId);
    if (byId) return byId;
  }
  const taskEngName = task.assignedEngineer || task.engineer || "";
  if (taskEngName) {
    const byName = apiEngineers.find(e => e.name === taskEngName);
    if (byName) return byName;
  }
  return null;
}

// 측측 측측 측측 task → { 'YYYY-MM-DD': [task, ...] } 측측 측측.
//   filter: 기사 측측 + scheduled_at 측측 + 측측 측측 측측.
export function bucketTasksByDate(apiTasks, engineer, year, month) {
  if (!engineer) return {};
  const mm = String(month).padStart(2, "0");
  const monthPrefix = `${year}-${mm}-`;
  const out = {};
  for (const t of (apiTasks || [])) {
    if (!taskMatchesEngineer(t, engineer)) continue;
    // status='취소' 측측 측측 측측측 측측측 측측 (= 시각화 영향 측측).
    if (t.status === "취소") continue;
    const sched = t.scheduledAt || t.scheduled_at || t.확정일시 || t.confirmedAt;
    if (!sched) continue;
    const ymd = toKstYmd(sched);
    if (!ymd || !ymd.startsWith(monthPrefix)) continue;
    if (!out[ymd]) out[ymd] = [];
    out[ymd].push(t);
  }
  return out;
}

// 측측 측측 task[] → service code 측측 (cleaning / refrigerant / other).
export function classifyByService(tasks) {
  const byCode = { cleaning: 0, refrigerant: 0, other: 0 };
  for (const t of (tasks || [])) {
    const code = pickServiceCode(t);
    if (code === "cleaning")          byCode.cleaning    += 1;
    else if (code === "refrigerant")  byCode.refrigerant += 1;
    else                              byCode.other       += 1;
  }
  return byCode;
}

// 측측 task의 service 측측 (= 측측 row 측측 측측 측측).
export function getTaskService(task) {
  return pickServiceCode(task) || "other";
}

// 월 격자 측측 — 측측 측측 (Sun 0 ~ Sat 6) + 측측 측측.
//   주차 측측 7개 (Sun~Sat) 측측 측측 (KST 측측 측측).
export function getMonthGrid(year, month) {
  // JS month: 0-indexed. year/month 측측 1-indexed.
  const firstDay = new Date(year, month - 1, 1);
  const startDow = firstDay.getDay(); // 0=Sun, 6=Sat
  const daysInMonth = new Date(year, month, 0).getDate(); // 측측 측측 last day

  const cells = [];
  // 측측 측측 빈 cell (= 측측 측측측 측측 측측 측측 측측 측 측측 X).
  for (let i = 0; i < startDow; i++) cells.push(null);
  // 측측 measure measure cells.
  const mm = String(month).padStart(2, "0");
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${mm}-${String(d).padStart(2, "0")}`;
    cells.push({ ymd, day: d });
  }
  // 측측 측측 6주측 측측 (= 42개) 측측 빈 cell 측측.
  while (cells.length < 42) cells.push(null);
  // 6주 보장 (= cells.length === 42).
  return cells;
}
