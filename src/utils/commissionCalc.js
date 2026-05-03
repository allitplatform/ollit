// Step 7 V2 — 수수료 계산 (vatPolicy 자동 적용)
import { getEngineerRate, getCoolguyFakeRate } from "../data/standardRates.js";

// ===== 세척 =====
// type: standard | fake_split | naver_settlement
// principal 객체에서 vatPolicy 추출
export function calcCleaning(opts) {
  const {
    policy,
    principal: principalData,   // 원청 객체 (vatPolicy 포함)
    appliances = [],            // [{ type: '벽걸이', count: 1 }]
    total = 0,                  // 총금액 또는 정산예정금액
    additionals = [],           // [{ name, amount }] — 네이버형만
  } = opts || {};

  if (!policy) {
    return { error: "정책 없음", total, principal: 0, engineer: 0, company: 0, isNegative: false };
  }

  const vatPolicy = principalData?.vatPolicy || "included";

  // 기사 단가 (부가세 자동 적용)
  const engineerFromRates = appliances.reduce((sum, a) =>
    sum + getEngineerRate(a.type, vatPolicy) * (a.count || 1)
  , 0);

  let principal = 0;
  let engineer  = engineerFromRates;

  if (policy.type === "fake_split") {
    // 쿨가이형 — 가짜 단가 사용 (부가세 X / 가짜는 그대로)
    const fakeTotal = appliances.reduce((sum, a) =>
      sum + getCoolguyFakeRate(a.type) * (a.count || 1)
    , 0);
    principal = Math.max(0, (total - fakeTotal) * (policy.splitRate || 0) / 100);

  } else if (policy.type === "naver_settlement") {
    // 유솔 N — 정산예정금액 기준
    if (policy.principal?.type === "rate") {
      principal = total * (policy.principal.value || 0) / 100;
    } else if (policy.principal?.type === "fixed") {
      principal = policy.principal.value || 0;
    }
    // 추가선택 (별도 분배)
    const addP = policy.additionalsPolicy || { principalRate: 0, engineerRate: 0 };
    let addPrincipal = 0;
    let addEngineer  = 0;
    additionals.forEach(a => {
      const amt = a.amount || 0;
      addPrincipal += amt * (addP.principalRate || 0) / 100;
      addEngineer  += amt * (addP.engineerRate  || 0) / 100;
    });
    principal += addPrincipal;
    engineer  += addEngineer;

  } else {
    // standard
    if (policy.principal?.type === "rate") {
      principal = total * (policy.principal.value || 0) / 100;
    } else if (policy.principal?.type === "fixed") {
      principal = policy.principal.value || 0;
    }
  }

  const company = total - principal - engineer;

  return {
    total: Math.round(total),
    principal: Math.round(principal),
    engineer: Math.round(engineer),
    company: Math.round(company),
    vatPolicy,
    isNegative: company < 0,
  };
}

// ===== 냉매 =====
export function calcRefrigerant(opts) {
  const { policy, estimate = 0, extra = 0, engineerId } = opts || {};

  if (!policy) {
    return { error: "정책 없음", total: estimate + extra, principal: 0, engineer: 0, company: 0, isNegative: false };
  }

  const total = estimate + extra;

  let principal = 0;
  if (policy.principal?.type === "rate") {
    const base = policy.principal.base === "estimate" ? estimate : total;
    principal = base * (policy.principal.value || 0) / 100;
  } else if (policy.principal?.type === "fixed") {
    principal = policy.principal.value || 0;
  }

  let engineerRate = policy.engineer?.value || 0;
  const override = policy.engineer?.overrides?.find(o => o.engineerId === engineerId);
  if (override) engineerRate = override.value;

  let engineer = 0;
  if (policy.engineer?.type === "rate") {
    const base = policy.engineer.base === "estimate" ? estimate : total;
    engineer = base * engineerRate / 100;
  } else if (policy.engineer?.type === "fixed") {
    engineer = engineerRate;
  }

  const company = total - principal - engineer;

  return {
    total: Math.round(total),
    principal: Math.round(principal),
    engineer: Math.round(engineer),
    company: Math.round(company),
    isNegative: company < 0,
  };
}

// 호환용 alias (legacy)
export function calculateCommission(opts) {
  return calcRefrigerant(opts);
}
