// V14 v6 — 단가/수수료 wrapper (7개 원청 + KA/KB + 유솔N 3분리)
// task 객체 → calcCleaning / calcRefrigerant / calcEstimateSplit / calcAgFullAdHalf / calcAdditional

import {
  calcCleaning,
  calcRefrigerant,
  calcEstimateSplit,
  calcEstimateRemainderSplit,
  calcTotalSplit,
  calcAgFullAdHalf,
  calcAdditional,
} from "./commissionCalc.js";
import { loadPrincipals } from "../data/principals.js";
import { VISIT_FEE } from "../data/visitFee.js";

// ============================================================
// Step 3 — 기사 캐시 (localStorage 백업으로 앱 간 sync)
// ============================================================
// AdminApp 등이 apiGetEngineers fetch 후 setEngineersCache(list) 호출 → 모든 앱 공유
// 다른 앱은 캐시에서 lookup. 캐시 비어있으면 기본 50% fallback.
const ENGINEERS_CACHE_KEY = "ollit_engineers_cache_v1";
const DEFAULT_REFRIGERANT_RATE = 50;

let _engineersCacheMem = null; // in-memory cache (lazy load)

function _loadEngineersFromStorage() {
  try {
    const raw = localStorage.getItem(ENGINEERS_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* localStorage 접근 실패 시 무시 */ }
  return [];
}

function _ensureCacheLoaded() {
  if (_engineersCacheMem == null) _engineersCacheMem = _loadEngineersFromStorage();
}

// AdminApp 등 fetch 후 호출 — 메모리 + localStorage 둘 다 박음
export function setEngineersCache(list) {
  if (!Array.isArray(list)) return;
  _engineersCacheMem = list;
  try {
    localStorage.setItem(ENGINEERS_CACHE_KEY, JSON.stringify(list));
  } catch (e) { /* 저장 실패 시 메모리만 사용 */ }
}

export function getEngineersCache() {
  _ensureCacheLoaded();
  return _engineersCacheMem || [];
}

// 기사 식별자(id 또는 이름)로 cm_refrigerant_rate 추출 — 빈 / 없음 시 기본 50
// 시트 칼럼: cm_refrigerant_rate (정수 50/60/100). 한글 키 cm_냉매비율도 fallback
export function getEngineerRefrigerantRate(engineerIdOrName) {
  if (engineerIdOrName == null || engineerIdOrName === "") return DEFAULT_REFRIGERANT_RATE;
  _ensureCacheLoaded();
  if (!_engineersCacheMem || _engineersCacheMem.length === 0) return DEFAULT_REFRIGERANT_RATE;
  const target = String(engineerIdOrName).trim();
  const eng = _engineersCacheMem.find(e =>
    e.engineerId === target || e.id === target ||
    e.기사ID    === target || e.name  === target ||
    e.이름     === target
  );
  if (!eng) return DEFAULT_REFRIGERANT_RATE;
  const raw = eng.cm_refrigerant_rate ?? eng.cm_냉매비율 ?? eng.refrigerant_rate;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_REFRIGERANT_RATE;
  return n;
}

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
  // Step 3 — 기사별 비율 (cm_refrigerant_rate): 50 / 60 / 100 (잔여 전액)
  // 미배정/캐시 비어있음 = 기본 50 (getEngineerRefrigerantRate fallback)
  if (code === "refrigerant") {
    const refrigType   = principal.commissionPolicy?.refrigerant?.type;
    const engineerKey  = task.assignedEngineerId || task.assignedEngineer || null;
    const engineerRate = getEngineerRefrigerantRate(engineerKey);

    // 견적_잔여_분배 — KA: 견적 × 35% 원청 / 풀 × engineerRate 기사
    if (refrigType === "estimate_remainder_split") {
      return calcEstimateRemainderSplit({
        policy: principal.commissionPolicy.refrigerant,
        estimate: task.estimateTotal || 0,
        extra: (task.addonFee || 0) + (task.extraFee || 0),
        engineerRate,
      });
    }

    // 총금액_분배 — KB (Step 4): 총금액 × 35% 원청 / 총금액 × engineerRate 기사 / 나머지 회사
    if (refrigType === "total_split") {
      return calcTotalSplit({
        policy: principal.commissionPolicy.refrigerant,
        estimate: task.estimateTotal || 0,
        extra: (task.addonFee || 0) + (task.extraFee || 0),
        engineerRate,
      });
    }

    // 예상금액비율 (legacy / 옛 KB) — 견적 × 원청% / 견적 × 기사% / 추가 50:50
    if (refrigType === "estimate_split") {
      return calcEstimateSplit({
        policy: principal.commissionPolicy.refrigerant,
        estimate: task.estimateTotal || 0,
        extra: (task.addonFee || 0) + (task.extraFee || 0),
        engineerRate,
      });
    }
    // 일반 standard (올데이/용인/유솔H/크리크린)
    const policy = principal.commissionPolicy?.refrigerant;
    if (!policy) {
      // 정책 없음 (유솔N 등): 기본 50% / 기사별 비율 적용 X (사장님 결재 — 유솔N 제외)
      const eng = Math.round(total * 0.5);
      return { total, engineer: eng, principal: 0, company: total - eng, isNegative: false };
    }
    return calcRefrigerant({
      policy,
      estimate: task.estimateTotal || 0,
      extra: (task.addonFee || 0) + (task.extraFee || 0),
      engineerId: task.assignedEngineerId,
      engineerRate,
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
