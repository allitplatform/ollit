// 2026-06-03 — 매출 통계 helper (대시보드 "매출 현황" 블록 측측).
//   드리프트 측측 측측 dataset 측측 — computeDashboardStats 측측 측측 측측:
//     · isTrackARemittance(t) — 트랙 A + 완료/visit_only (= 유솔N 세척/추가선택 측측 측측)
//     · toKstYmd(completed) 측측 KST 측측 측측
//     · total = task.totalAmount (GENERATED = product_price + extra_fee + travel_fee)
//     · margin = owner_amount / engineer = engineer_amount / principal = principal_amount
//   compute_payment v16 측측 engineer + principal + owner = totalAmount 측측 보장.
//
// 종류별 (cleaning/refrigerant):
//   task.workItems 측 본작업(orderType='본작업') 측측 측측 serviceCode 측측 task-level 측측.
//   단일 service task 측측 (= 측측 측측측 측측) — 측측 측측 측측.

import { toKstYmd } from "./dateLabel.js";
import { isTrackARemittance } from "./remitFilter.js";
import { canSeeField } from "../data/permissions.js";

const EMPTY = {
  total: 0, engineer: 0, principal: 0, owner: 0,
  byService: { cleaning: 0, refrigerant: 0, other: 0 },
  // 2026-06-12 — 종류별 세부 (PC 매출 패널용). byService(금액만)는 옛 컴포넌트 호환 유지.
  byServiceDetail: {
    cleaning:    { total: 0, count: 0, owner: 0 },
    refrigerant: { total: 0, count: 0, owner: 0 },
    other:       { total: 0, count: 0, owner: 0 },
  },
  count: 0,
};

// task 측측 측측 service code (= 측측 본작업 또는 첫 측측 측측).
function pickServiceCode(task) {
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  if (items.length === 0) return null;
  const main = items.find(it => (it.orderType || it.order_type) === "본작업") || items[0];
  return main?.serviceCode || main?.service_code || null;
}

// 핵심 helper — 측측 측측측 측측 (startYmd ~ endYmd, KST). startYmd <= endYmd 측측.
//   apiTasks 측측 측측 측측 — computeDashboardStats 측측 측측 일치.
export function computeRevenueByYmRange(apiTasks, startYmd, endYmd, user) {
  if (!canSeeField(user, "task.total_amount")) return { ...EMPTY };
  if (!startYmd || !endYmd) return { ...EMPTY };

  const list = (apiTasks || []).filter(t => {
    if (!isTrackARemittance(t)) return false;
    const completed = t.completedAt || t.completed_at || t.completedDate || t.완료시간 || t.completedTime;
    if (!completed) return false;
    const ymd = toKstYmd(completed);
    if (!ymd) return false;
    return ymd >= startYmd && ymd <= endYmd;
  });

  let total = 0, engineer = 0, principal = 0, owner = 0;
  let cleaning = 0, refrigerant = 0, other = 0;
  // 2026-06-12 — 종류별 세부 (count / owner) 누적 — PC 매출 패널용.
  let cleaningCount = 0, refrigerantCount = 0, otherCount = 0;
  let cleaningOwner = 0, refrigerantOwner = 0, otherOwner = 0;
  for (const t of list) {
    const amt   = Number(t.totalAmount || t.총금액 || t.estimateTotal || 0);
    const ownAmt = Number(t.owner_amount || 0);
    total     += amt;
    engineer  += Number(t.engineer_amount || 0);
    principal += Number(t.principal_amount || 0);
    owner     += ownAmt;

    const code = pickServiceCode(t);
    if (code === "cleaning") {
      cleaning      += amt;
      cleaningCount += 1;
      cleaningOwner += ownAmt;
    } else if (code === "refrigerant") {
      refrigerant      += amt;
      refrigerantCount += 1;
      refrigerantOwner += ownAmt;
    } else {
      other      += amt;
      otherCount += 1;
      otherOwner += ownAmt;
    }
  }

  return {
    total, engineer, principal, owner,
    byService: { cleaning, refrigerant, other },
    byServiceDetail: {
      cleaning:    { total: cleaning,    count: cleaningCount,    owner: cleaningOwner },
      refrigerant: { total: refrigerant, count: refrigerantCount, owner: refrigerantOwner },
      other:       { total: other,       count: otherCount,       owner: otherOwner },
    },
    count: list.length,
  };
}

// "YYYY-MM-DD" → 같은 day 측측 측측측 동일일 (= 측측 측측 측측 측측 last day 측측 clamp).
//   예: 3/31 → 2월 28일 (또는 29일, 윤년).
export function getPrevMonthSameDay(todayYmdStr) {
  const [y, m, d] = todayYmdStr.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  // JS Date(year, month, 0) = previous month's last day. month는 1-based로 들어와 그대로 사용 측측 = 측측 측측 last day.
  const prevLastDay = new Date(prevY, prevM, 0).getDate();
  const useD = Math.min(d, prevLastDay);
  return `${prevY}-${String(prevM).padStart(2, "0")}-${String(useD).padStart(2, "0")}`;
}

// "YYYY-MM-DD" → 그 달 1일 (KST).
export function getMonthStart(ymdStr) {
  return ymdStr.slice(0, 7) + "-01";
}

// "YYYY-MM-DD" → 지난달 1일 (KST).
export function getPrevMonthStart(todayYmdStr) {
  const [y, m] = todayYmdStr.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return `${prevY}-${String(prevM).padStart(2, "0")}-01`;
}

// (year, month) → 그 달 측측 측측 (YYYY-MM-DD).
export function getMonthRange(year, month) {
  const mm = String(month).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const lastDay = new Date(year, month, 0).getDate(); // JS month 1-based → last day of prev = current month last day
  const end = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

// 측측 dataset filter (computeRevenueByYmRange 측측 측측 측측 — 측측 측측 측측 측측).
function _filterTrackADoneInRange(apiTasks, startYmd, endYmd) {
  return (apiTasks || []).filter(t => {
    if (!isTrackARemittance(t)) return false;
    const completed = t.completedAt || t.completed_at || t.completedDate || t.완료시간 || t.completedTime;
    if (!completed) return false;
    const ymd = toKstYmd(completed);
    if (!ymd) return false;
    return ymd >= startYmd && ymd <= endYmd;
  });
}

// 원청별 측측 — 측측 dataset 측측 principal_code 측측 측측 측측.
//   측측 측측: principal_code 측측 측측 매출 측측측 정렬.
//   측측 측측: code / name / count / total / owner.
export function computeRevenueByPrincipal(apiTasks, startYmd, endYmd, user) {
  if (!canSeeField(user, "task.total_amount")) return [];
  const list = _filterTrackADoneInRange(apiTasks, startYmd, endYmd);
  const map = new Map();
  for (const t of list) {
    const code = String(t.principalCode || t.principal_code || "").trim();
    const name = String(t.principal || t.client || t.principalName || "").trim();
    const key = code || `(${name || "측측"})`;
    if (!map.has(key)) {
      map.set(key, { code, name: name || code || "(측측)", count: 0, total: 0, owner: 0 });
    }
    const row = map.get(key);
    row.count += 1;
    row.total += Number(t.totalAmount || t.총금액 || t.estimateTotal || 0);
    row.owner += Number(t.owner_amount || 0);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

// 기사별 그룹 — 동일 dataset (isTrackARemittance + completed_at in range) 기준 assigned_engineer 묶음.
//   기본 정렬: engineer (engineer_amount) 내림차순.
//   반환 필드: id / name / count / engineer / total / owner.
//
// 2026-06-13 — total / owner 추가. 같은 task 의 totalAmount / owner_amount 합산 (새 계산 X).
//   PC 매출 리포트 기사별 표(매출/회사 마진/비중) 용도. 기존 호출처는 name/count/engineer 만
//   참조하므로 무영향. 정렬 기준도 그대로 (호출 측에서 필요 시 owner 기준 재정렬).
export function computeRevenueByEngineer(apiTasks, startYmd, endYmd, user) {
  if (!canSeeField(user, "task.total_amount")) return [];
  const list = _filterTrackADoneInRange(apiTasks, startYmd, endYmd);
  const map = new Map();
  for (const t of list) {
    const id   = t.assignedEngineerId || t.assigned_engineer_id || t.engineerId || null;
    const name = String(t.assignedEngineer || t.engineer || "").trim();
    const key = id || name || "(미배정)";
    if (!map.has(key)) {
      map.set(key, { id, name: name || "(미배정)", count: 0, engineer: 0, total: 0, owner: 0 });
    }
    const row = map.get(key);
    row.count    += 1;
    row.engineer += Number(t.engineer_amount || 0);
    row.total    += Number(t.totalAmount || t.총금액 || t.estimateTotal || 0);
    row.owner    += Number(t.owner_amount || 0);
  }
  return [...map.values()].sort((a, b) => b.engineer - a.engineer);
}
