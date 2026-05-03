// V11-1 — 유솔 N 수수료 계산
// 회사 = 정산예정금액(netAmount) × 85% / 유솔 = 15%
// 기본 작업: 기사는 단가표대로 / 회사 = 회사받음 - 단가표 (마진)
// 추가선택: 기사 100% (회사 마진 0)
import { loadRates } from "../data/standardRates.js";
import { findTasksByOrderNumber } from "../data/tasks.js";

const COMPANY_COMMISSION_RATE = 0.85;

// 한 작업의 회사 받을 돈 (유솔 → 회사)
export function calcCompanyReceive(task) {
  if (!task || task.principalId !== "usol_n") return 0;
  return Math.floor((task.netAmount || 0) * COMPANY_COMMISSION_RATE);
}

// 한 작업의 기사 정산 금액 (회사 → 기사, 매월 15일)
export function calcEngineerEarning(task) {
  if (!task || task.principalId !== "usol_n") return 0;

  const companyReceive = calcCompanyReceive(task);

  if (task.orderType === "extra") {
    // 추가선택 = 기사 100%
    return companyReceive;
  }
  // 기본 작업 = 단가표대로
  return getBasicEngineerRate(task);
}

// 한 작업의 회사 마진
export function calcCompanyMargin(task) {
  return calcCompanyReceive(task) - calcEngineerEarning(task);
}

// 기본 작업 단가표 합계 (workItems 또는 appliance 기준)
function getBasicEngineerRate(task) {
  const rates = loadRates();
  const cleaning = rates.cleaning || {};

  const items = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems
    : (task.appliance ? [{ type: task.appliance, count: task.qty || 1 }] : []);

  return items.reduce((sum, it) => {
    const type  = it.type || it.appliance;
    const count = it.count || it.qty || 1;
    const rate  = cleaning[type] || 0;
    return sum + rate * count;
  }, 0);
}

// 같은 주문번호 묶음 합계 (한 고객 = 한 주문번호 안에 기본+추가가 같이 옴)
export function calcGroupTotal(orderNumber, tasksArg) {
  const tasks = findTasksByOrderNumber(orderNumber, tasksArg);

  return tasks.reduce((acc, t) => {
    const cReceive = calcCompanyReceive(t);
    const eEarning = calcEngineerEarning(t);
    return {
      grossAmount:     acc.grossAmount     + (t.grossAmount || 0),
      netAmount:       acc.netAmount       + (t.netAmount || 0),
      companyReceive:  acc.companyReceive  + cReceive,
      engineerEarning: acc.engineerEarning + eEarning,
      margin:          acc.margin          + (cReceive - eEarning),
      basicCount:      acc.basicCount      + (t.orderType === "basic" ? 1 : 0),
      extraCount:      acc.extraCount      + (t.orderType === "extra" ? 1 : 0),
      taskCount:       acc.taskCount + 1,
    };
  }, {
    grossAmount: 0, netAmount: 0,
    companyReceive: 0, engineerEarning: 0, margin: 0,
    basicCount: 0, extraCount: 0, taskCount: 0,
  });
}

// 상수 노출 (UI 표기용)
export const USOL_N_COMPANY_RATE = COMPANY_COMMISSION_RATE;
export const USOL_N_USOL_RATE    = 1 - COMPANY_COMMISSION_RATE;
