// Step 7 풀버전 — 원청 마스터 + 정책 type 정의
// type: standard | fake_split (쿨가이) | naver_settlement (유솔 N)
// Step 5-3 — 시트 설정_원청 양방향 sync + 시트 캐시 자동 병합 (Step 5-1 패턴)

import {
  savePrincipal as apiSavePrincipal,
  deletePrincipal as apiDeletePrincipal,
} from "../api.js";

const STORAGE_KEY = "ollit_principals_v1";
// Step 5-3 — 시트 설정_원청 fetch 캐시 (앱 간 sync용)
const PRINCIPALS_CACHE_KEY = "ollit_principals_cache_v1";

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

// 옛 SEED localStorage read + 마이그레이션 (V2/V3/V4)
function _loadOldPrincipals() {
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
  return null;
}

export function loadPrincipals() {
  // 1) 옛 SEED localStorage (마이그레이션 적용)
  let oldList = _loadOldPrincipals();
  if (!oldList || oldList.length === 0) {
    savePrincipals(SEED_PRINCIPALS);
    oldList = SEED_PRINCIPALS;
  }

  // 2) 시트 캐시 (Step 5-3 setPrincipalsCache로 박힘)
  const sheetList = getPrincipalsCache();
  if (!sheetList || sheetList.length === 0) return oldList;  // 시트 데이터 없음 → 옛 동작 그대로

  // 3) 매칭 인덱스 (옛 SEED — id 우선 / 이름 fallback)
  const oldById   = new Map();
  const oldByName = new Map();
  oldList.forEach(o => {
    if (o.id)   oldById.set(o.id, o);
    if (o.name) oldByName.set(o.name, o);
  });

  // 4) 시트 기반 병합 (Step 5-1 패턴)
  // Step 5-3 hotfix — alias 매핑 추가 (cool_son ↔ coolguy 등)
  const merged = [];
  const usedOldIds = new Set();
  for (const s of sheetList) {
    const adapted = adaptSheetPrincipalToSeed(s);
    if (!adapted) continue;
    // 매칭: id 우선 → alias 매핑 → 이름 fallback (정확 매칭)
    const aliasOldId = SHEET_TO_OLD_ID_ALIAS[adapted.id];
    const oldMatch = oldById.get(adapted.id)
                  || (aliasOldId && oldById.get(aliasOldId))
                  || oldByName.get(adapted.name);
    if (oldMatch) {
      // 옛 SEED 우선 (id / commissionPolicy / vatPolicy / contact / nickname 보존)
      // 시트 우선: name / prefix / color / type / note (사장님이 시트에서 갱신 가능한 필드)
      // id는 옛 측 그대로 — 기존 task.principalId / 코드 비교문 호환 (GAS sync 시점에만 시트 id로 변환)
      merged.push({
        ...adapted,
        ...oldMatch,
        name:   adapted.name   || oldMatch.name,
        prefix: adapted.prefix || oldMatch.prefix,
        color:  adapted.color  || oldMatch.color,
        type:   adapted.type   || oldMatch.type,
        note:   adapted.note   || oldMatch.note,
        commissionPolicy: oldMatch.commissionPolicy || adapted.commissionPolicy,
        _fromSheet: false,
      });
      usedOldIds.add(oldMatch.id);
    } else {
      merged.push(adapted);
    }
  }

  // 5) 옛 SEED에만 있는 항목 (시트에 없는) 보존
  for (const o of oldList) {
    if (!usedOldIds.has(o.id)) merged.push({ ...o, _onlyOld: true });
  }

  return merged;
}

export function savePrincipals(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) { console.error(e); return false; }
}

// ============================================================
// Step 5-3 — 시트 설정_원청 양방향 sync + 캐시 자동 병합
// ============================================================
// 시트 6열 매핑: A 약자(prefix) / B id(principalId) / C 회사명(name) /
//                D 구분(type:직영/위탁) / E 색(color) / F 비고(note)
// 다른 필드 (nickname / vatPolicy / contact / commissionPolicy) — localStorage 전용 (이번 sync X)

// AdminApp 등 fetch 후 호출 — 메모리/localStorage 박음
export function setPrincipalsCache(list) {
  if (!Array.isArray(list)) return;
  try {
    localStorage.setItem(PRINCIPALS_CACHE_KEY, JSON.stringify(list));
  } catch (e) { /* 저장 실패 시 무시 */ }
}

export function getPrincipalsCache() {
  try {
    const raw = localStorage.getItem(PRINCIPALS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* */ }
  return [];
}

// Step 5-3 hotfix — 시트 id ↔ 옛 SEED id 매핑 (id 다른 케이스 catch)
// KB만 mismatch — 시트 "coolguy" / 옛 SEED "cool_son". 다른 6곳은 동일.
// 코드 측 task.principalId / principal.id는 옛 SEED id 그대로 사용 (호환성),
// GAS sync 시점에만 시트 id로 변환.
const SHEET_TO_OLD_ID_ALIAS = {
  coolguy: "cool_son",
};
const OLD_TO_SHEET_ID_ALIAS = {
  cool_son: "coolguy",
};

// 시트 측 한 행 → 옛 SEED 모델 (6열만 매핑, 나머지는 옛 SEED 또는 default)
// Step 5-3 hotfix — commissionPolicy를 안전 standard default로 박음
// 매칭 실패 시에도 type 접근 사용처 (PrincipalEditScreen / commissionCalc / feePolicy)에서 TypeError 방지
function adaptSheetPrincipalToSeed(sheetP) {
  if (!sheetP) return null;
  const id     = sheetP.id || sheetP.principalId || sheetP.B || "";
  const name   = sheetP.name || sheetP.회사명 || sheetP.C || "";
  const prefix = sheetP.prefix || sheetP.약자 || sheetP.A || "";
  const color  = sheetP.color || sheetP.색 || sheetP.E || "#888780";
  const type   = sheetP.type || sheetP.구분 || sheetP.D || "위탁";
  const note   = sheetP.note || sheetP.비고 || sheetP.F || "";
  if (!id && !name) return null;
  return {
    id: id || generatePrincipalId(name),
    name,
    nickname: "",
    color,
    prefix,
    type,
    status: "active",
    vatPolicy: "included",
    contact: { manager: "", phone: "", email: "" },
    note,
    commissionPolicy: {
      cleaning: {
        type: "standard",
        principal: { type: "none", base: "total", value: 0 },
      },
      refrigerant: {
        type: "standard",
        principal: { type: "none", base: "total", value: 0 },
        engineer:  { type: "rate",  base: "total", value: 50, overrides: [] },
      },
    },
    _fromSheet: true,
  };
}

// status → 시트 활성? (시트엔 활성 칼럼 X — 구분(D)이 따로). 단순히 status 그대로 박지 X
// 코드 → 시트 sync payload (6열만)
// Step 5-3 hotfix — 옛 측 id를 시트 측으로 변환 (cool_son → coolguy 등)
function _toPrincipalSyncPayload(p) {
  const sheetId = OLD_TO_SHEET_ID_ALIAS[p.id] || p.id;
  return {
    principalId: sheetId,
    name:        p.name || "",
    prefix:      p.prefix || "",
    color:       p.color || "",
    type:        p.type || "위탁",
    note:        p.note || "",
  };
}

// upsert: localStorage 즉시 + GAS 비동기 sync
export async function savePrincipalWithSync(p) {
  const list = loadPrincipals();
  const existing = list.find(x => x.id === p.id);
  const next = existing
    ? list.map(x => x.id === p.id ? p : x)
    : [p, ...list];
  savePrincipals(next);

  try {
    const res = await apiSavePrincipal(_toPrincipalSyncPayload(p));
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "시트 sync 실패");
    }
    if (res.principalId && res.principalId !== p.id) {
      const updated = next.map(x => x.id === p.id ? { ...x, id: res.principalId } : x);
      savePrincipals(updated);
      return { ok: true, action: res.action, principalId: res.principalId };
    }
    return { ok: true, action: res.action || "update", principalId: res.principalId || p.id };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
}

export async function deletePrincipalWithSync(principalId) {
  if (!principalId) return { ok: false, error: "principalId 없음", localOk: false };
  const list = loadPrincipals();
  savePrincipals(list.filter(x => x.id !== principalId));
  // Step 5-3 hotfix — 옛 측 id를 시트 측으로 변환
  const sheetId = OLD_TO_SHEET_ID_ALIAS[principalId] || principalId;
  try {
    const res = await apiDeletePrincipal(sheetId);
    if (!res || res.ok === false) {
      throw new Error((res && res.error) || "시트 sync 실패");
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || "네트워크 오류", localOk: true };
  }
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
