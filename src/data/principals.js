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

  // 2. 에어컨프로 (쿨가이) — fake_split
  {
    id: "aircon_pro",
    name: "에어컨프로",
    nickname: "쿨가이",
    color: "#06B6D4",
    prefix: "A-",
    status: "active",
    vatPolicy: "included",
    contact: { manager: "", phone: "", email: "" },
    note: "세척 = 가짜 단가표 적용 (쿨가이형) · 냉매 = 표준 10%",
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
        type: "standard",
        principal: { type: "rate", base: "total", value: 10 },
        engineer:  { type: "rate", base: "total", value: 50, overrides: [] },
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
    note: "현금 결제 / 세척 총금액 × 15%",
    commissionPolicy: {
      cleaning: {
        type: "standard",
        principal: { type: "rate", base: "total", value: 15 },
      },
      refrigerant: {
        type: "standard",
        principal: { type: "none", base: "total", value: 0 },
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
    note: "네이버 결제 / CSV 업로드 / 정산예정금액 × 15% / 부가세 별도 (기사 단가 ×1.10)",
    commissionPolicy: {
      cleaning: {
        type: "naver_settlement",
        principal: { type: "rate", base: "settlement", value: 15 },
        additionalsPolicy: {
          principalRate: 15,   // 유솔 15%
          engineerRate:  85,   // 기사 85%
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
      // V2 마이그레이션 — vatPolicy 박힌 거 X 면 기본값 박기 (유솔 N만 excluded)
      return parsed.map(p => ({
        ...p,
        vatPolicy: p.vatPolicy || (p.id === "usol_n" ? "excluded" : "included"),
      }));
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
