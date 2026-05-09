// Step 7 풀버전 — 원청 마스터 + 정책 type 정의
// type: standard | fake_split (쿨가이) | naver_settlement (유솔 N)

const STORAGE_KEY = "ollit_principals_v1";

const SEED_PRINCIPALS = [
  // 1. 올데이케어 (직영)
  {
    id: "allday",
    name: "올데이케어",
    nickname: "자체영업",
    color: "#FF1B8D",
    prefix: "A-",
    status: "active",
    vatPolicy: "included",
    contact: { manager: "", phone: "", email: "" },
    note: "직영 / 원청 수수료 0",
    commissionPolicy: {
      cleaning: {
        type: "standard",
        principal: { type: "none", base: "total", value: 0 },
      },
      refrigerant: {
        type: "standard",
        principal: { type: "none", base: "total", value: 0 },
        engineer:  { type: "rate", base: "total", value: 50, overrides: [] },
      },
    },
  },

  // 2. 에어컨프로 (KA, 쿨가이 아버지) — fake_split + 냉매 10%
  {
    id: "aircon_pro",
    name: "에어컨프로",
    nickname: "쿨가이(KA)",
    color: "#06B6D4",
    prefix: "A-",
    status: "active",
    vatPolicy: "included",
    contact: { manager: "", phone: "", email: "" },
    note: "KA(아버지) · 세척 = 차감후비율 50% · 냉매 = 견적_잔여_분배 35%/50%",
    commissionPolicy: {
      cleaning: {
        type: "fake_split",
        fakeRates: {
          "벽걸이": 50000, "스탠드": 70000, "투인원": 110000,
          "1way": 60000, "4way": 80000, "원형": 90000,
        },
        splitRate: 50,  // (총 - 가짜) × 50% = 원청
      },
      refrigerant: {
        // 견적_잔여_분배 — 견적 × 35% 원청 / (견적 - 원청 + 추가) × 50% 기사·회사
        type: "estimate_remainder_split",
        principalRate: 35,
        engineerRate:  50,
      },
    },
  },

  // 2b. 쿨가이 (KB, 쿨가이 아들) — fake_split + 냉매 35%
  {
    id: "cool_son",
    name: "쿨가이",
    nickname: "쿨가이(KB)",
    color: "#0891B2",
    prefix: "K-",
    status: "active",
    vatPolicy: "included",
    contact: { manager: "", phone: "", email: "" },
    note: "KB(아들) · 세척 = 차감후비율 50% · 냉매 = 총금액_분배 35%/50% (Step 4)",
    commissionPolicy: {
      cleaning: {
        type: "fake_split",
        fakeRates: {
          "벽걸이": 50000, "스탠드": 70000, "투인원": 110000,
          "1way": 60000, "4way": 80000, "원형": 90000,
        },
        splitRate: 50,
      },
      refrigerant: {
        // 총금액_분배 — 총금액(견적+추가) × 35% 원청 / × engineerRate 기사 / 나머지 회사
        type: "total_split",
        principalRate: 35,
        engineerRate:  50,
      },
    },
  },

  // 3. 용인컴퍼니 (정액)
  {
    id: "yongin",
    name: "용인컴퍼니",
    nickname: "용인",
    color: "#888780",
    prefix: "A-",
    status: "active",
    vatPolicy: "included",
    contact: { manager: "", phone: "", email: "" },
    note: "원청 정액 10,000원",
    commissionPolicy: {
      cleaning: {
        type: "standard",
        principal: { type: "fixed", base: "total", value: 10000 },
      },
      refrigerant: {
        type: "standard",
        principal: { type: "fixed", base: "total", value: 10000 },
        engineer:  { type: "rate",  base: "total", value: 50, overrides: [] },
      },
    },
  },

  // 4. 유솔홈케어 H (현금)
  {
    id: "usol_h",
    name: "유솔홈케어 H",
    nickname: "유솔현금",
    color: "#10B981",
    prefix: "YS-",
    status: "active",
    vatPolicy: "included",
    contact: { manager: "", phone: "", email: "" },
    note: "현금 결제 / 세척 총금액 × 15% / 냉매 정액 10K + 기사 50%",
    commissionPolicy: {
      cleaning: {
        type: "standard",
        principal: { type: "rate", base: "total", value: 15 },
      },
      refrigerant: {
        type: "standard",
        principal: { type: "fixed", base: "total", value: 10000 },
        engineer:  { type: "rate", base: "total", value: 50, overrides: [] },
      },
    },
  },

  // 5. 유솔홈케어 N (네이버) — naver_settlement
  {
    id: "usol_n",
    name: "유솔홈케어 N",
    nickname: "유솔네이버",
    color: "#03C75A",
    prefix: "YS-N-",
    status: "active",
    vatPolicy: "excluded",
    contact: { manager: "", phone: "", email: "" },
    note: "네이버 결제 / 본작업 15% / 추가선택 85/15 / 냉매점검 100원청+추가50:50",
    commissionPolicy: {
      cleaning: {
        type: "naver_settlement",
        principal: { type: "rate", base: "settlement", value: 15 },
        additionalsPolicy: {
          principalRate: 15,
          engineerRate:  85,
        },
        inspectPolicy: {
          type: "ag_full_ad_half",  // 냉매점검: 기본 100% 원청 / 추가 50:50 / 출장 100% 기사
        },
      },
      refrigerant: null,
    },
  },

  // 6. 크리크린
  {
    id: "crikrin",
    name: "크리크린",
    nickname: "",
    color: "#7F77DD",
    prefix: "CK-",
    status: "active",
    vatPolicy: "included",
    contact: { manager: "", phone: "", email: "" },
    note: "냉매 = 견적 × 20% / 세척 = 총 × 20%",
    commissionPolicy: {
      cleaning: {
        type: "standard",
        principal: { type: "rate", base: "total", value: 20 },
      },
      refrigerant: {
        type: "standard",
        principal: { type: "rate", base: "estimate", value: 20 },
        engineer:  { type: "rate", base: "total",    value: 50, overrides: [] },
      },
    },
  },
];

export const COMMISSION_TYPES = {
  none:  { name: "없음",   suffix: "" },
  rate:  { name: "정률",   suffix: "%" },
  fixed: { name: "정액",   suffix: "원" },
};

export const COMMISSION_BASE = {
  estimate:   { name: "견적금액",     desc: "현장추가금 X" },
  total:      { name: "총금액",       desc: "견적 + 현장추가" },
  settlement: { name: "정산예정금액", desc: "네이버 수수료 차감 후" },
};

export const POLICY_TYPES = {
  standard:          { name: "표준",     desc: "원청 수수료 + 기사 단가표 적용" },
  fake_split:        { name: "쿨가이형", desc: "(총 - 가짜 단가) × split%" },
  naver_settlement:  { name: "네이버형", desc: "정산예정금액 기준 + 추가선택 별도" },
};

export const STATUS_OPTIONS = {
  active: { name: "활동중", color: "#00875A" },
  off:    { name: "중단",   color: "#888780" },
};

// 부가세 정책 (Step 7 V2)
export const VAT_OPTIONS = {
  included: { name: "포함", desc: "기사 단가 그대로" },
  excluded: { name: "별도", desc: "기사 단가 × 1.10" },
};

export const PRINCIPAL_COLORS = [
  "#FF1B8D", "#06B6D4", "#A855F7", "#10B981",
  "#F59E0B", "#7F77DD", "#00875A", "#FF3D5A",
  "#EC4899", "#3B82F6",
];

export function loadPrincipals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // V2 마이그레이션 — vatPolicy 누락 시 기본값 채움 (유솔 N만 excluded)
      // V3 마이그레이션 — KA 냉매 옛 정책(estimate_split 10%) → estimate_remainder_split 35%/50%
      // V4 마이그레이션 — KB 냉매 옛 정책(estimate_split 35%) → total_split 35%/50%
      return parsed.map(p => {
        let next = {
          ...p,
          vatPolicy: p.vatPolicy || (p.id === "usol_n" ? "excluded" : "included"),
        };
        const refrig = next.commissionPolicy?.refrigerant;
        // KA 마이그레이션 (V3)
        if (
          next.id === "aircon_pro" &&
          refrig?.type === "estimate_split" &&
          (refrig.principal?.value ?? 0) === 10
        ) {
          next = {
            ...next,
            commissionPolicy: {
              ...next.commissionPolicy,
              refrigerant: {
                type: "estimate_remainder_split",
                principalRate: 35,
                engineerRate:  50,
              },
            },
          };
        }
        // KB 마이그레이션 (V4)
        const refrigKB = next.commissionPolicy?.refrigerant;
        if (
          next.id === "cool_son" &&
          refrigKB?.type === "estimate_split" &&
          (refrigKB.principal?.value ?? 0) === 35
        ) {
          next = {
            ...next,
            commissionPolicy: {
              ...next.commissionPolicy,
              refrigerant: {
                type: "total_split",
                principalRate: 35,
                engineerRate:  50,
              },
            },
          };
        }
        return next;
      });
    }
  } catch (e) { console.error(e); }
  savePrincipals(SEED_PRINCIPALS);
  return SEED_PRINCIPALS;
}

export function savePrincipals(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) { console.error(e); return false; }
}

export function generatePrincipalId(name) {
  const ts = Date.now().toString(36);
  const safe = (name || "principal").replace(/\s+/g, "_").toLowerCase().slice(0, 12);
  return `${safe}_${ts}`;
}

export function autoPrefix(name) {
  if (!name) return "";
  if (/[A-Za-z]/.test(name[0])) {
    return name.slice(0, 2).toUpperCase() + "-";
  }
  return name[0] + "-";
}

export function createEmptyPrincipal() {
  return {
    id: "",
    name: "", nickname: "", color: "#FF1B8D", prefix: "",
    status: "active",
    vatPolicy: "included",
    contact: { manager: "", phone: "", email: "" },
    note: "",
    commissionPolicy: { cleaning: null, refrigerant: null },
  };
}

// 정책 type별 빈 객체
export function createEmptyPolicy(workType, policyType = "standard") {
  if (workType === "cleaning") {
    if (policyType === "fake_split") {
      return {
        type: "fake_split",
        fakeRates: { "벽걸이": 50000, "스탠드": 70000, "투인원": 110000, "1way": 60000, "4way": 80000, "원형": 90000 },
        splitRate: 50,
      };
    }
    if (policyType === "naver_settlement") {
      return {
        type: "naver_settlement",
        principal: { type: "rate", base: "settlement", value: 15 },
        additionalsPolicy: { principalRate: 15, engineerRate: 85 },
      };
    }
    return {
      type: "standard",
      principal: { type: "none", base: "total", value: 0 },
    };
  }
  // refrigerant
  if (policyType === "estimate_remainder_split") {
    return {
      type: "estimate_remainder_split",
      principalRate: 35,
      engineerRate:  50,
    };
  }
  if (policyType === "total_split") {
    return {
      type: "total_split",
      principalRate: 35,
      engineerRate:  50,
    };
  }
  if (policyType === "estimate_split") {
    return {
      type: "estimate_split",
      principal: { type: "rate", base: "estimate", value: 35 },
      engineer:  { type: "rate", base: "estimate", value: 50, overrides: [] },
    };
  }
  return {
    type: "standard",
    principal: { type: "none", base: "total", value: 0 },
    engineer:  { type: "rate", base: "total", value: 50, overrides: [] },
  };
}

// 유솔 N 찾기 (CSV 업로드 진입점용)
export function findUsolN() {
  const list = loadPrincipals();
  return list.find(p => p.id === "usol_n") || null;
}
