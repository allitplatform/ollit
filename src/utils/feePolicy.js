// V14 — 단가/수수료 wrapper (task 객체 → 정확한 수수료)
// commissionCalc.js 기반 + 한글↔영문 매핑 + 점검 추가 (+10,000) + 출장비 처리

import { calcCleaning, calcRefrigerant } from "./commissionCalc.js";
import { loadPrincipals } from "../data/principals.js";
import { VISIT_FEE } from "../data/visitFee.js";

// 작업 종류 ID 통일 — 한글/영문 → 'cleaning' | 'refrigerant' | 'visit' | 'extra' | 'cleaning_inspect'
export function getServiceCode(task) {
  if (!task) return "cleaning";
  if (task.status === "visit_only" || task.orderType === "visit") return "visit";
  if (task.orderType === "extra") return "extra";

  const text = `${task.workType || ""} ${task.appliance || ""}`.toLowerCase();
  if (text.includes("냉매") || text.includes("충전") || text.includes("가스")) return "refrigerant";
  // 세척+점검 복합 (사장님 spec: 세척 단가 + 점검 +10,000)
  if (text.includes("세척") && text.includes("점검")) return "cleaning_inspect";
  if (text.includes("세척") || text.includes("청소"))                          return "cleaning";
  return "cleaning"; // fallback
}

// task의 client(=원청 이름)로 principals 객체 찾기
function findPrincipalByClient(client, principalsList) {
  if (!client) return null;
  const list = principalsList || loadPrincipals();
  return list.find(p =>
    p.name === client || p.nickname === client || p.id === client
  ) || null;
}

// 점검 추가비 (사장님 spec: 작업당 +10,000 / 1회)
const INSPECT_BONUS = 10000;

/**
 * task 객체 → { total, engineer, principal, company, vatPolicy, isNegative }
 * - 세척: calcCleaning
 * - 냉매: calcRefrigerant
 * - 세척+점검: calcCleaning + 점검 +10,000 (engineer)
 * - 출장만: VISIT_FEE (기사 100%)
 * - 점검/설치 단독 (Phase 1 disabled): 옛 70% 유지 (fallback)
 */
export function calcTaskEarning(task, principalsList) {
  if (!task) return { total: 0, engineer: 0, principal: 0, company: 0, isNegative: false };

  const code = getServiceCode(task);

  // 출장만
  if (code === "visit") {
    return {
      total: VISIT_FEE.amount,
      engineer: VISIT_FEE.amount,
      principal: 0,
      company: 0,
      vatPolicy: "included",
      isNegative: false,
    };
  }

  const principal = findPrincipalByClient(task.client, principalsList);
  const total = (task.estimateTotal || 0) + (task.addonFee || 0) + (task.extraFee || 0);

  // 원청 매칭 X — fallback (옛 70%)
  if (!principal) {
    const fallbackEngineer = Math.round((task.engineerNet ?? task.engineerEarning ?? total * 0.7) || 0);
    return {
      total,
      engineer: fallbackEngineer,
      principal: 0,
      company: total - fallbackEngineer,
      vatPolicy: "included",
      isNegative: false,
    };
  }

  // 냉매충전
  if (code === "refrigerant") {
    const policy = principal.commissionPolicy?.refrigerant;
    if (!policy) {
      // 정책 X — fallback
      const eng = Math.round(total * 0.5);
      return { total, engineer: eng, principal: 0, company: total - eng, vatPolicy: principal.vatPolicy || "included", isNegative: false };
    }
    return calcRefrigerant({
      policy,
      estimate: task.estimateTotal || 0,
      extra: (task.addonFee || 0) + (task.extraFee || 0),
      engineerId: task.assignedEngineerId,
    });
  }

  // 세척 / 세척+점검
  if (code === "cleaning" || code === "cleaning_inspect") {
    const policy = principal.commissionPolicy?.cleaning;
    if (!policy) {
      const eng = Math.round(total * 0.7);
      return { total, engineer: eng, principal: 0, company: total - eng, vatPolicy: principal.vatPolicy || "included", isNegative: false };
    }
    const appliances = [{ type: task.appliance || "벽걸이", count: task.qty || 1 }];
    const result = calcCleaning({
      policy,
      principal,
      appliances,
      total,
      additionals: task.additionals || [],
    });
    // 세척+점검 = engineer에 +10,000 (작업당 1회)
    if (code === "cleaning_inspect") {
      const bonus = INSPECT_BONUS;
      return {
        ...result,
        engineer: result.engineer + bonus,
        company: result.company - bonus,
        isNegative: (result.company - bonus) < 0,
      };
    }
    return result;
  }

  // 점검 / 설치 단독 (Phase 1 disabled — fallback)
  const eng = Math.round(total * 0.7);
  return {
    total,
    engineer: eng,
    principal: 0,
    company: total - eng,
    vatPolicy: principal.vatPolicy || "included",
    isNegative: false,
  };
}

// 표시용 — 회사 송금액 (= total - engineer)
export function calcCompanyTransfer(task, principalsList) {
  const r = calcTaskEarning(task, principalsList);
  return Math.max(0, r.total - r.engineer);
}

// 표시용 — 수수료 비율 % (참고용. 기사 화면에서는 노출 X 권장)
export function calcCommissionRate(task, principalsList) {
  const r = calcTaskEarning(task, principalsList);
  if (!r.total) return 0;
  return Math.round(((r.total - r.engineer) / r.total) * 100);
}
