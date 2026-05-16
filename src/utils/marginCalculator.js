// V11-6 — 작업별 회사 마진 계산
// 5원청: revenue - engineerEarning - principalFee
// 유솔 N: V11-1 헬퍼 사용 (calcCompanyReceive/Engineer/Margin)
import { loadPrincipals } from "../data/principals.js";
import {
  calcCompanyReceive,
  calcEngineerEarning,
  calcCompanyMargin,
} from "./usolNCommission.js";

// 작업 1건 → { revenue, engineerEarning, margin, principalName, principalColor }
export function analyzeTaskMargin(task, principalMap) {
  const principal = principalMap[task.principalId] || null;

  let revenue = 0;
  let engineerEarning = 0;
  let margin = 0;

  if (task.principalId === "usol_n") {
    revenue         = calcCompanyReceive(task);  // 회사가 받는 돈 (정산금 × 85%)
    engineerEarning = calcEngineerEarning(task) || 0;
    margin          = calcCompanyMargin(task)   || 0;
  } else {
    // 5원청 — 시드 호환 (totalAmount 또는 estimateTotal+addonFee)
    revenue         = task.totalAmount
      ?? ((task.estimateTotal || 0) + (task.addonFee || 0));
    engineerEarning = task.engineer_amount || 0;
    const principalFee = task.principal_amount || 0;
    margin          = revenue - engineerEarning - principalFee;
  }

  return {
    task,
    revenue,
    engineerEarning,
    margin,
    principalName:  principal?.name  || (task.principal || "—"),
    principalColor: principal?.color || "#888780",
  };
}

// 작업 배열 → 합계 + 작업별 + 원청별 분석
export function calculateMarginByTask(tasks) {
  const principals = (() => { try { return loadPrincipals(); } catch { return []; } })();
  const principalMap = {};
  principals.forEach(p => { principalMap[p.id] = p; });

  const byTask = (tasks || []).map(t => analyzeTaskMargin(t, principalMap));

  // 마진 큰 순으로 정렬
  byTask.sort((a, b) => b.margin - a.margin);

  const totalRevenue         = byTask.reduce((s, it) => s + it.revenue,         0);
  const totalEngineerEarning = byTask.reduce((s, it) => s + it.engineerEarning, 0);
  const totalMargin          = byTask.reduce((s, it) => s + it.margin,          0);

  // 원청별 합계
  const byPrincipal = {};
  byTask.forEach(it => {
    const pid = it.task.principalId || "unknown";
    if (!byPrincipal[pid]) {
      byPrincipal[pid] = {
        principalId:    pid,
        principalName:  it.principalName,
        principalColor: it.principalColor,
        taskCount:      0,
        totalRevenue:   0,
        totalEngineerEarning: 0,
        totalMargin:    0,
      };
    }
    byPrincipal[pid].taskCount      += 1;
    byPrincipal[pid].totalRevenue   += it.revenue;
    byPrincipal[pid].totalEngineerEarning += it.engineerEarning;
    byPrincipal[pid].totalMargin    += it.margin;
  });

  return {
    totalRevenue,
    totalEngineerEarning,
    totalMargin,
    byTask,
    byPrincipal: Object.values(byPrincipal).sort((a, b) => b.totalMargin - a.totalMargin),
  };
}

// 기간별 (today / week / month)
export function calculateMarginByPeriod(tasks, period = "today") {
  const now = new Date();
  let startMs;

  if (period === "today") {
    startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  } else if (period === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    startMs = d.getTime();
  } else if (period === "month") {
    startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  } else {
    startMs = 0;
  }

  const filtered = (tasks || []).filter(t => {
    if (!t.completedAt) return false;
    return new Date(t.completedAt).getTime() >= startMs;
  });

  return calculateMarginByTask(filtered);
}
