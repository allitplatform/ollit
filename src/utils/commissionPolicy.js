// 2026-05-10 — 수수료 정책 (Hybrid 구조)
// 비밀 영역(KA/KB 가짜단가)은 GAS 측에서 받아옴
// 일반 영역은 이 파일에서 lookup + 계산

// ===== 정책 데이터 =====
// 단가는 원/한국 / 비밀 정책은 SECRET (GAS 측 응답 필요)

export const COMMISSION_POLICY = {
  // ---------- 세척 ----------
  "올데이케어": {
    "세척": {
      "벽걸이":      { sale: 60000,  engineerRate: 40000, type: "직영" },
      "1way":        { sale: 80000,  engineerRate: 50000, type: "직영" },
      "스탠드":      { sale: 110000, engineerRate: 60000, type: "직영" },
      "4way":        { sale: 130000, engineerRate: 70000, type: "직영" },
      "원형":        { sale: 110000, engineerRate: 80000, type: "직영" },
      "투인원":      { sale: 160000, engineerRate: 100000, type: "직영" },
      "시스템멀티":  { sale: 100000, engineerRate: 0, type: "직영" },
    },
    "냉매충전": {
      "벽걸이": { sale: 80000, type: "직영_50_50" },
      "스탠드": { sale: 90000, type: "직영_50_50" },
      "1way":   { sale: 90000, type: "직영_50_50" },
      "4way":   { sale: 100000, type: "직영_50_50" },
      "투인원": { sale: 100000, type: "직영_50_50" },
    },
  },

  "에어컨프로 (KA)": {
    "세척": "SECRET",  // ⚠️ GAS 측 lookup
    "냉매충전": {
      "벽걸이": { sale: 70000, type: "잔여분배_KA" },
      "스탠드": { sale: 80000, type: "잔여분배_KA" },
      "4way":   { sale: 100000, type: "잔여분배_KA" },
      "투인원": { sale: 100000, type: "잔여분배_KA" },
      "1way":   { sale: 90000, type: "잔여분배_KA" },
    },
  },

  "쿨가이 (KB)": {
    "세척": "SECRET",  // ⚠️ GAS 측 lookup
    "냉매충전": {
      "벽걸이": { sale: 80000, type: "총금액분배_KB" },
      "스탠드": { sale: 90000, type: "총금액분배_KB" },
      "1way":   { sale: 90000, type: "총금액분배_KB" },
      "4way":   { sale: 100000, type: "총금액분배_KB" },
      "투인원": { sale: 100000, type: "총금액분배_KB" },
    },
  },

  "용인컴퍼니": {
    "세척": {
      "벽걸이":     { sale: 60000,  engineerRate: 40000, type: "정액10K" },
      "1way":       { sale: 80000,  engineerRate: 50000, type: "정액10K" },
      "스탠드":     { sale: 110000, engineerRate: 60000, type: "정액10K" },
      "4way":       { sale: 130000, engineerRate: 70000, type: "정액10K" },
      "원형":       { sale: 110000, engineerRate: 80000, type: "정액10K" },
      "투인원":     { sale: 160000, engineerRate: 100000, type: "정액10K" },
      "시스템멀티": { sale: 100000, engineerRate: 0, type: "정액10K" },
    },
    "냉매충전": {
      "벽걸이": { sale: 80000, type: "정액10K_기사50" },
      "스탠드": { sale: 90000, type: "정액10K_기사50" },
      "4way":   { sale: 100000, type: "정액10K_기사50" },
      "투인원": { sale: 100000, type: "정액10K_기사50" },
      "1way":   { sale: 90000, type: "정액10K_기사50" },
    },
  },

  "유솔홈케어 H": {
    "세척": {
      "벽걸이":     { sale: 60000,  engineerRate: 40000, type: "비율15" },
      "1way":       { sale: 80000,  engineerRate: 50000, type: "비율15" },
      "스탠드":     { sale: 110000, engineerRate: 60000, type: "비율15" },
      "4way":       { sale: 130000, engineerRate: 70000, type: "비율15" },
      "원형":       { sale: 110000, engineerRate: 80000, type: "비율15" },
      "투인원":     { sale: 160000, engineerRate: 100000, type: "비율15" },
      "시스템멀티": { sale: 100000, engineerRate: 0, type: "비율15" },
    },
    "냉매충전": {
      "벽걸이": { sale: 80000, type: "정액10K_기사50" },
      "스탠드": { sale: 90000, type: "정액10K_기사50" },
      "1way":   { sale: 90000, type: "정액10K_기사50" },
      "4way":   { sale: 100000, type: "정액10K_기사50" },
      "투인원": { sale: 100000, type: "정액10K_기사50" },
    },
  },

  "유솔홈케어 N": {
    "세척": {
      // 기사단가 × 1.10 (부가세 별도)
      "벽걸이":     { sale: 60000,  engineerRate: 40000, type: "비율15_기사110" },
      "1way":       { sale: 80000,  engineerRate: 50000, type: "비율15_기사110" },
      "스탠드":     { sale: 110000, engineerRate: 60000, type: "비율15_기사110" },
      "4way":       { sale: 130000, engineerRate: 70000, type: "비율15_기사110" },
      "원형":       { sale: 110000, engineerRate: 80000, type: "비율15_기사110" },
      "투인원":     { sale: 160000, engineerRate: 100000, type: "비율15_기사110" },
      "시스템멀티": { sale: 100000, engineerRate: 0, type: "비율15_기사110" },
    },
    "냉매충전": {
      // 특수 (3 케이스 / 별도 계산)
      "벽걸이": { sale: 80000, type: "YSN_특수" },
      "스탠드": { sale: 90000, type: "YSN_특수" },
      "1way":   { sale: 90000, type: "YSN_특수" },
      "4way":   { sale: 100000, type: "YSN_특수" },
      "투인원": { sale: 100000, type: "YSN_특수" },
    },
  },

  "크리크린": {
    "세척": {
      "벽걸이":     { sale: 60000,  engineerRate: 40000, type: "비율20" },
      "1way":       { sale: 80000,  engineerRate: 50000, type: "비율20" },
      "스탠드":     { sale: 110000, engineerRate: 60000, type: "비율20" },
      "4way":       { sale: 130000, engineerRate: 70000, type: "비율20" },
      "원형":       { sale: 110000, engineerRate: 80000, type: "비율20" },
      "투인원":     { sale: 160000, engineerRate: 100000, type: "비율20" },
      "시스템멀티": { sale: 100000, engineerRate: 0, type: "비율20" },
    },
    "냉매충전": {
      "벽걸이": { sale: 80000, type: "비율20_기사50" },
      "스탠드": { sale: 90000, type: "비율20_기사50" },
      "1way":   { sale: 90000, type: "비율20_기사50" },
      "4way":   { sale: 100000, type: "비율20_기사50" },
      "투인원": { sale: 100000, type: "비율20_기사50" },
    },
  },
};

// 출장비 — 모든 원청 공통
export const VISIT_FEE = 30000;  // 작업 진행 X 시 / 기사 100%

// YS-N 추가선택 — 기사 85% / 원청 15% / 회사 0%
export const YSN_EXTRA_RATE = { engineer: 0.85, principal: 0.15, company: 0 };

// ===== 원청명 정규화 =====
// 시트의 원청명이 약식일 수 있어 이름 매핑
const PRINCIPAL_NORMALIZE = {
  "올데이": "올데이케어",
  "올데이케어": "올데이케어",
  "KA": "에어컨프로 (KA)",
  "에어컨프로": "에어컨프로 (KA)",
  "에어컨프로 (KA)": "에어컨프로 (KA)",
  "KB": "쿨가이 (KB)",
  "쿨가이": "쿨가이 (KB)",
  "쿨가이 (KB)": "쿨가이 (KB)",
  "용인": "용인컴퍼니",
  "용인컴퍼니": "용인컴퍼니",
  "유솔H": "유솔홈케어 H",
  "유솔홈케어 H": "유솔홈케어 H",
  "유솔홈케어H": "유솔홈케어 H",
  "유솔N": "유솔홈케어 N",
  "유솔홈케어 N": "유솔홈케어 N",
  "유솔홈케어N": "유솔홈케어 N",
  "크리크린": "크리크린",
};

// 기종 정규화
const APPLIANCE_NORMALIZE = {
  "벽걸이": "벽걸이",
  "1way": "1way",
  "스탠드": "스탠드",
  "4way": "4way",
  "원형": "원형",
  "투인원": "투인원",
  "시스템멀티": "시스템멀티",
  "시스템": "시스템멀티",
  "멀티": "시스템멀티",
};

// 작업유형 정규화
const WORKTYPE_NORMALIZE = {
  "세척": "세척",
  "냉매": "냉매충전",
  "냉매충전": "냉매충전",
  "출장": "출장비",
  "출장비": "출장비",
};

// ===== 핵심 계산 함수 =====
/**
 * 정산 계산
 * @param {object} task - { principal, workType, appliance, estimateTotal, addonFee, visitOnly, isYsnExtra, ysnSubType }
 * @returns {object} { engineerEarning, principalFee, companyMargin, isSecret, source }
 */
export function calcCommission(task) {
  if (!task) return zeroResult("invalid_task");

  const principal = PRINCIPAL_NORMALIZE[task.principal] || task.principal;
  const workType  = WORKTYPE_NORMALIZE[task.workType]   || task.workType;
  const appliance = APPLIANCE_NORMALIZE[task.appliance] || task.appliance;
  const estimate  = Number(task.estimateTotal) || 0;
  const addon     = Number(task.addonFee) || 0;
  const total     = estimate + addon;

  // 출장비만 (작업 진행 X)
  if (task.visitOnly) {
    return { engineerEarning: VISIT_FEE, principalFee: 0, companyMargin: 0, isSecret: false, source: "visit_fee" };
  }

  // YS-N 추가선택
  if (task.isYsnExtra) {
    return {
      engineerEarning: Math.round(total * YSN_EXTRA_RATE.engineer),
      principalFee:    Math.round(total * YSN_EXTRA_RATE.principal),
      companyMargin:   0,
      isSecret: false,
      source: "ysn_extra",
    };
  }

  // 정책 lookup
  const policyForPrincipal = COMMISSION_POLICY[principal];
  if (!policyForPrincipal) return zeroResult("principal_not_found:" + principal);

  const policyForWork = policyForPrincipal[workType];
  if (!policyForWork) return zeroResult("worktype_not_found:" + principal + "/" + workType);

  // 비밀 영역 (KA/KB 세척) — GAS 측 응답 사용
  if (policyForWork === "SECRET") {
    return zeroResult("secret_needs_gas:" + principal + "/" + workType);
  }

  const policy = policyForWork[appliance];
  if (!policy) return zeroResult("appliance_not_found:" + principal + "/" + workType + "/" + appliance);

  // 정책 type 별 계산
  const fn = POLICY_CALCULATORS[policy.type];
  if (!fn) return zeroResult("calculator_not_found:" + policy.type);

  return fn({ policy, estimate, addon, total });
}

// ===== 정책 type 별 계산기 =====
const POLICY_CALCULATORS = {
  // 직영 (0) — 기사 = 기사단가 / 회사 = 견적 - 기사단가
  "직영": ({ policy, estimate }) => ({
    engineerEarning: policy.engineerRate || 0,
    principalFee:    0,
    companyMargin:   estimate - (policy.engineerRate || 0),
    isSecret: false,
    source: "직영",
  }),

  // 직영 (50/50) — 기사 50% / 회사 50%
  "직영_50_50": ({ estimate }) => ({
    engineerEarning: Math.round(estimate * 0.5),
    principalFee:    0,
    companyMargin:   Math.round(estimate * 0.5),
    isSecret: false,
    source: "직영_50_50",
  }),

  // 정액 10K — 원청 정액 10000 / 기사 = 기사단가 / 회사 = 나머지
  "정액10K": ({ policy, estimate }) => ({
    engineerEarning: policy.engineerRate || 0,
    principalFee:    10000,
    companyMargin:   estimate - (policy.engineerRate || 0) - 10000,
    isSecret: false,
    source: "정액10K",
  }),

  // 정액 10K / 기사 50% (냉매충전)
  "정액10K_기사50": ({ estimate }) => ({
    engineerEarning: Math.round(estimate * 0.5),
    principalFee:    10000,
    companyMargin:   estimate - Math.round(estimate * 0.5) - 10000,
    isSecret: false,
    source: "정액10K_기사50",
  }),

  // 비율 15% — 원청 = 견적 × 15% / 기사 = 기사단가
  "비율15": ({ policy, estimate }) => {
    const principalFee = Math.round(estimate * 0.15);
    return {
      engineerEarning: policy.engineerRate || 0,
      principalFee,
      companyMargin:   estimate - (policy.engineerRate || 0) - principalFee,
      isSecret: false,
      source: "비율15",
    };
  },

  // 비율 15% / 기사단가 × 1.10 (유솔N 세척)
  "비율15_기사110": ({ policy, estimate }) => {
    const engineer = Math.round((policy.engineerRate || 0) * 1.10);
    const principalFee = Math.round(estimate * 0.15);
    return {
      engineerEarning: engineer,
      principalFee,
      companyMargin:   estimate - engineer - principalFee,
      isSecret: false,
      source: "비율15_기사110",
    };
  },

  // 비율 20% — 크리크린 세척
  "비율20": ({ policy, estimate }) => {
    const principalFee = Math.round(estimate * 0.20);
    return {
      engineerEarning: policy.engineerRate || 0,
      principalFee,
      companyMargin:   estimate - (policy.engineerRate || 0) - principalFee,
      isSecret: false,
      source: "비율20",
    };
  },

  // 비율 20% / 기사 50% (크리크린 냉매)
  "비율20_기사50": ({ estimate }) => {
    const engineer = Math.round(estimate * 0.50);
    const principalFee = Math.round(estimate * 0.20);
    return {
      engineerEarning: engineer,
      principalFee,
      companyMargin:   estimate - engineer - principalFee,
      isSecret: false,
      source: "비율20_기사50",
    };
  },

  // 잔여분배 KA (냉매) — 원청 = 견적 × 35% / 잔여 풀(견적-원청+추가) × 50% = 기사
  "잔여분배_KA": ({ estimate, addon, total }) => {
    const principalFee = Math.round(estimate * 0.35);
    const pool = total - principalFee;
    const engineer = Math.round(pool * 0.50);
    return {
      engineerEarning: engineer,
      principalFee,
      companyMargin:   total - engineer - principalFee,
      isSecret: false,
      source: "잔여분배_KA",
    };
  },

  // 총금액분배 KB (냉매) — 원청 35% / 기사 50% / 회사 15%
  "총금액분배_KB": ({ total }) => ({
    engineerEarning: Math.round(total * 0.50),
    principalFee:    Math.round(total * 0.35),
    companyMargin:   Math.round(total * 0.15),
    isSecret: false,
    source: "총금액분배_KB",
  }),

  // YS-N 특수 (기본/추가/출장 분리) — 기본: 기사 0 / 회사 0 (네이버 결제) / 추가: 기사 50% 회사 50% / 출장: 기사 100%
  "YSN_특수": ({ estimate }) => ({
    // 기본 케이스 — 추가/출장 케이스는 task에 ysnSubType 박혀있을 때 별도 처리
    engineerEarning: 0,
    principalFee:    estimate, // 네이버 결제 기본 점검비
    companyMargin:   0,
    isSecret: false,
    source: "YSN_특수_기본",
  }),
};

// 빈 결과
function zeroResult(reason) {
  return {
    engineerEarning: 0,
    principalFee: 0,
    companyMargin: 0,
    isSecret: false,
    source: "zero",
    reason
  };
}

// ===== 디버그 / 추적 =====
// 사용처: console.log(commissionDebug(task))
export function commissionDebug(task) {
  const result = calcCommission(task);
  return {
    input: {
      principal: task.principal,
      workType: task.workType,
      appliance: task.appliance,
      estimate: task.estimateTotal,
      addon: task.addonFee
    },
    output: result,
  };
}
