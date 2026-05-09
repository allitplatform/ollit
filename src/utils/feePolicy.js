// V14 v6 — 단가/수수료 wrapper (7개 원청 + KA/KB + 유솔N 3분리)
// task 객체 → calcCleaning / calcRefrigerant / calcEstimateSplit / calcAgFullAdHalf / calcAdditional

import {
  calcCleaning,
  calcRefrigerant,
  calcEstimateSplit,
  calcEstimateRemainderSplit,
  calcAgFullAdHalf,
  calcAdditional,
} from "./commissionCalc.js";
import { loadPrincipals } from "../data/principals.js";
import { VISIT_FEE } from "../data/visitFee.js";

// 작업 종류 ID 통일
// 'cleaning' | 'cleaning_inspect' (세척+점검) | 'refrigerant' | 'visit'
// 'usolN_extra' (유솔N 추가선택 송풍팬/실외기/피톤치드) | 'usolN_inspect' (유솔N 냉매점검)
export function getServiceCode(task) {
  if (!task) return "cleaning";
  if (task.status === "visit_only" || task.orderType === "visit") return "visit";

  const text = `${task.workType || ""} ${task.appliance || ""}`.toLowerCase();

  // 유솔N 분기 (orderType 우선)
  if (task.orderType === "extra_select") return "usolN_extra";
  if (task.orderType === "inspect")      return "usolN_inspect";

  if (text.includes("냉매점검") || text.includes("점검냉매")) return "usolN_inspect";
  if (text.includes("송풍팬") || text.includes("실외기") || text.includes("피톤")) return "usolN_extra";

  if (text.includes("냉매") || text.includes("충전") || text.includes("가스")) return "refrigerant";
  if (text.includes("세척") && text.includes("점검")) return "cleaning_inspect";
  if (text.includes("세척") || text.includes("청소")) return "cleaning";
  return "cleaning";
}

function findPrincipalByClient(client, principalsList) {
  if (!client) return null;
  const list = principalsList || loadPrincipals();
  return list.find(p =>
    p.name === client || p.nickname === client || p.id === client
  ) || null;
}

const INSPECT_BONUS = 10000; // 세척+점검 = 점검 +10,000

/**
 * task 객체 → { total, engineer, principal, company, isNegative }
 * 사장님 정책 v6:
 * - 올데이 직영 / 에어컨프로 KA / 쿨가이 KB / 용인 정액 / 유솔H 15% / 유솔N (3분리) / 크리크린 20%
 */
export function calcTaskEarning(task, principalsList) {
  if (!task) return { total: 0, engineer: 0, principal: 0, company: 0, isNegative: false };

  const code = getServiceCode(task);

  // 출장만 (기사 100%)
  if (code === "visit") {
    return {
      total: VISIT_FEE.amount,
      engineer: VISIT_FEE.amount,
      principal: 0,
      company: 0,
      isNegative: false,
    };
  }

  const principal = findPrincipalByClient(task.client, principalsList);
  const total = (task.estimateTotal || 0) + (task.addonFee || 0) + (task.extraFee || 0);

  if (!principal) {
    const fallbackEngineer = Math.round((task.engineerNet ?? task.engineerEarning ?? total * 0.7) || 0);
    return {
      total,
      engineer: fallbackEngineer,
      principal: 0,
      company: total - fallbackEngineer,
      isNegative: false,
    };
  }

  // ── 유솔N 3분리 ──
  if (principal.id === "usol_n") {
    if (code === "usolN_extra") {
      // 추가선택 (송풍팬/실외기/피톤치드): 기사 85% / 원청 15% / 회사 0%
      return calcAdditional({ unitPrice: task.estimateTotal || 0, qty: task.qty || 1 });
    }
    if (code === "usolN_inspect") {
      // 냉매점검: 기본 100% 원청 / 추가 50:50 / 출장 100% 기사
      return calcAgFullAdHalf({
        unitPrice: task.estimateTotal || 10000,
        qty: task.qty || 1,
        extra: task.addonFee || 0,
        travel: task.travelFee || 0,
      });
    }
    // 본작업 (세척): naver_settlement 정책
    const policy = principal.commissionPolicy?.cleaning;
    if (!policy) {
      const eng = Math.round(total * 0.85);
      return { total, engineer: eng, principal: total - eng, company: 0, isNegative: false };
    }
    return calcCleaning({
      policy, principal,
      appliances: [{ type: task.appliance || "벽걸이", count: task.qty || 1 }],
      total,
      additionals: task.additionals || [],
    });
  }

  // ── 냉매충전 ──
  if (code === "refrigerant") {
    const refrigType = principal.commissionPolicy?.refrigerant?.type;

    // 견적_잔여_분배 — KA: 견적 × 35% 원청 / (잔여 + 추가) × 50% 기사·회사
    if (refrigType === "estimate_remainder_split") {
      return calcEstimateRemainderSplit({
        policy: principal.commissionPolicy.refrigerant,
        estimate: task.estimateTotal || 0,
        extra: (task.addonFee || 0) + (task.extraFee || 0),
      });
    }

    // 예상금액비율 — KB: 견적 × 35% 원청 / 견적 × 50% 기사 / 추가 50:50
    if (refrigType === "estimate_split") {
      return calcEstimateSplit({
        policy: principal.commissionPolicy.refrigerant,
        estimate: task.estimateTotal || 0,
        extra: (task.addonFee || 0) + (task.extraFee || 0),
      });
    }
    // 일반 standard (올데이/용인/유솔H/크리크린)
    const policy = principal.commissionPolicy?.refrigerant;
    if (!policy) {
      const eng = Math.round(total * 0.5);
      return { total, engineer: eng, principal: 0, company: total - eng, isNegative: false };
    }
    return calcRefrigerant({
      policy,
      estimate: task.estimateTotal || 0,
      extra: (task.addonFee || 0) + (task.extraFee || 0),
      engineerId: task.assignedEngineerId,
    });
  }

  // ── 세척 / 세척+점검 ──
  if (code === "cleaning" || code === "cleaning_inspect") {
    const policy = principal.commissionPolicy?.cleaning;
    if (!policy) {
      const eng = Math.round(total * 0.7);
      return { total, engineer: eng, principal: 0, company: total - eng, isNegative: false };
    }
    const appliances = [{ type: task.appliance || "벽걸이", count: task.qty || 1 }];
    const result = calcCleaning({
      policy, principal, appliances, total,
      additionals: task.additionals || [],
    });
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

  // ── 점검/설치 단독 (Phase 1 disabled) — fallback 70% ──
  const eng = Math.round(total * 0.7);
  return {
    total,
    engineer: eng,
    principal: 0,
    company: total - eng,
    isNegative: false,
  };
}

// 표시용 — 회사 송금액 (= total - engineer). 유솔N은 "받을 돈"이라 별도.
export function calcCompanyTransfer(task, principalsList) {
  const r = calcTaskEarning(task, principalsList);
  return Math.max(0, r.total - r.engineer);
}

// 사장님 Q6: 기사 PWA에서는 사용 X (운영자 PWA 전용)
export function calcCommissionRate(task, principalsList) {
  const r = calcTaskEarning(task, principalsList);
  if (!r.total) return 0;
  return Math.round(((r.total - r.engineer) / r.total) * 100);
}

// 유솔N 작업 여부 (회사 송금 vs 받을 돈 분리용)
export function isUsolN(task, principalsList) {
  const principal = findPrincipalByClient(task?.client, principalsList);
  return principal?.id === "usol_n";
}
