// 2026-06-17 — 새 접수 폼 공유 헬퍼/상수.
//   원본: src/pages/AdminApp.jsx (라인 232~432) — 모바일/PC 폼 공유 위해 추출.
//   기존 동작 0 변경. 함수/상수 시그니처 동일 (= 옛 code 와 1:1).
//
// 사용처:
//   - 모바일 NewReceptionFormScreen (AdminApp.jsx 9077~)
//   - PC 새 접수 폼 (신규)
//   - 카드/리스트 표시 (formatWorkItems, mergeKaOneway 등)
//   - 작업번호 / 정렬 / 워크플로우 판정 (determineMainWorkType, determineWorkflow)
//
// 의존: src/utils/workTypeKind.js (isRefrigerant).

import { isRefrigerant } from "./workTypeKind.js";

// ============================================
// 상수 — 운영 7개 원청 / 작업유형 / KA 1way 차등 단가 / 기종 풀
// ============================================

// V14 헌법 v6 — 운영 7개 원청 (api-backend.gs V14_PRINCIPAL_CODES 와 동기화 / KA·KB 분리).
export const PRINCIPALS = [
  { id: "올데이케어",      label: "올데이케어",       color: "#FF1B8D", code: "O"    },
  { id: "에어컨프로 (KA)", label: "에어컨프로 (KA)",  color: "#06B6D4", code: "A"    },
  { id: "쿨가이 (KB)",     label: "쿨가이 (KB)",      color: "#0891B2", code: "K"    },
  { id: "용인컴퍼니",      label: "용인",              color: "#888780", code: "Y"    },
  { id: "유솔홈케어 H",    label: "유솔홈케어 H",      color: "#10B981", code: "YS"   },
  { id: "유솔홈케어 N",    label: "유솔홈케어 N",      color: "#03C75A", code: "YS-N" },
  { id: "크리크린",        label: "크리크린",          color: "#7F77DD", code: "CK"   },
];

// 원청 라벨 색 — V14 헌법 + 옛 호환 (시뮬 점진 폐기).
export const PRINCIPAL_COLORS = {
  ...Object.fromEntries(PRINCIPALS.map(p => [p.id, p.color])),
  // 옛 시뮬 호환 (점진 폐기)
  "에어컨프로": "#06B6D4",
  "쿨가이":    "#0891B2",
};

// 원청 라벨(=form.principal value) → DB principals.code 매핑.
//   접수 폼 quote_rates fetch 와 정책 조회에 사용.
export const PRINCIPAL_NAME_TO_CODE = {
  "올데이케어":      "allday",
  "에어컨프로 (KA)": "KA",
  "쿨가이 (KB)":     "KB",
  "용인컴퍼니":      "yongin",
  "유솔홈케어 H":    "usol_h",
  "유솔홈케어 N":    "usol_n",
  "크리크린":        "crikrin",
};

// Step 5-3 — 작업 종류 단일 진실 소스 (편집 친화).
//   enabled: Phase 1 활성 (세척/냉매충전) / 나머지 disabled (Phase 2 시안 미정).
//   workflow: manual_with_recommendation = 수동 추천 / auto_first_accept = 자동 첫 응답.
//   priority: 메인 = 가장 복잡한 작업 (1=세척 ... 99=냉매충전).
export const WORK_TYPES_CONFIG = {
  "세척":     { enabled: true,  workflow: "manual_with_recommendation", needsAppliance: true,  priority: 1  },
  "냉매충전": { enabled: true,  workflow: "auto_first_accept",          needsAppliance: false, priority: 99 },
  "설치":     { enabled: false, workflow: "manual_with_recommendation", needsAppliance: true,  priority: 2  },
  "누설":     { enabled: false, workflow: "manual_with_recommendation", needsAppliance: true,  priority: 3  },
  "수리":     { enabled: false, workflow: "manual_with_recommendation", needsAppliance: true,  priority: 4  },
  "점검":     { enabled: false, workflow: "manual_with_recommendation", needsAppliance: true,  priority: 5  },
};

// V14 Step 2-B-2 — KA 1way 차등 단가 (동일 집 추가).
//   UI: 사용자가 "1way" + qty 입력 → 견적 자동 계산.
//   저장: workItems 가 "1way 첫 대" / "1way 추가" 두 행으로 분리 (시트 매칭).
//   표시: 카드/리스트는 두 행을 다시 합쳐 "1way × N" 으로 노출.
export const KA_PRINCIPAL_NAME       = "에어컨프로 (KA)";
export const KA_1WAY_FIRST_PRICE     = 90000;
export const KA_1WAY_ADDITIONAL_PRICE = 70000;

// 작업유형별 기종 풀 (V14 헌법 / 정책 시트와 일치).
//   냉매충전은 원청별 분기 — getAppliancePool() 사용 (KA 도 표시는 동일 "1way").
export const APPLIANCE_POOL = {
  "세척":           ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원", "시스템멀티"],
  "출장비":         ["(공통)"],
  "추가선택(YS-N)": ["송풍팬분해", "실외기", "피톤치드"],
  "냉매점검(YS-N)": ["기본", "추가발생", "출장비"],
};

// 냉매충전 기종 풀 (모든 원청 동일 UI 라벨, KA 차등 단가는 자동 처리).
export const REFRIGERANT_APPLIANCE_POOL = ["벽걸이", "스탠드", "4way", "투인원", "1way"];

// 작업유형 5종 (UI 노출 순서).
export const WORK_TYPES = ["세척", "냉매충전", "출장비", "추가선택(YS-N)", "냉매점검(YS-N)"];

// ============================================
// 헬퍼 — KA 1way 분할/합침 / 정렬 / 표시
// ============================================

// KA + 냉매충전 + 1way qty 합계 → 자동 견적.
//   첫 대 90,000 + 추가 (qty-1) × 70,000.
export function calcKaOnewayEstimate(workItems) {
  if (!Array.isArray(workItems)) return null;
  const onewayQtySum = workItems.reduce((sum, w) => {
    if (w.workType === "냉매충전" && w.appliance === "1way") return sum + (w.qty || 1);
    return sum;
  }, 0);
  if (onewayQtySum <= 0) return null;
  return KA_1WAY_FIRST_PRICE + Math.max(0, onewayQtySum - 1) * KA_1WAY_ADDITIONAL_PRICE;
}

// KA 작업 저장 직전 — "1way" + qty=N 항목을 "1way 첫 대" 1 + "1way 추가" (N-1) 로 분리.
//   KA 외 원청 / 다른 기종 / 1way 가 아닌 항목은 그대로.
export function splitWorkItemsForKa1way(items, principalName) {
  if (principalName !== KA_PRINCIPAL_NAME || !Array.isArray(items)) return items;
  const out = [];
  for (const item of items) {
    if (item.workType === "냉매충전" && item.appliance === "1way") {
      const qty = item.qty || 1;
      out.push({ ...item, appliance: "1way 첫 대", qty: 1 });
      if (qty > 1) {
        out.push({ ...item, appliance: "1way 추가", qty: qty - 1 });
      }
    } else {
      out.push(item);
    }
  }
  return out;
}

// 카드/리스트 표시용 — 분리 저장된 KA 1way 행을 단일 "1way × N" 으로 합쳐 보여줌.
//   "1way 첫 대" + "1way 추가" 행이 둘 다 있을 때만 합침. 다른 항목은 그대로.
export function mergeKaOneway(items) {
  if (!Array.isArray(items)) return items;
  const hasFirst = items.some(w => w.workType === "냉매충전" && w.appliance === "1way 첫 대");
  if (!hasFirst) return items;
  const merged = [];
  let mergedQty = 0;
  let mergedTemplate = null;
  for (const item of items) {
    if (item.workType === "냉매충전" &&
        (item.appliance === "1way 첫 대" || item.appliance === "1way 추가")) {
      mergedQty += (item.qty || 1);
      if (!mergedTemplate) mergedTemplate = item;
    } else {
      merged.push(item);
    }
  }
  if (mergedTemplate) {
    merged.push({ ...mergedTemplate, appliance: "1way", qty: mergedQty });
  }
  return merged;
}

// workItems 우선순위 정렬 (priority 작은 게 앞 = 메인 후보 1순위).
export function sortWorkItemsByPriority(workItems) {
  if (!Array.isArray(workItems)) return [];
  return [...workItems].sort((a, b) =>
    (WORK_TYPES_CONFIG[a.workType]?.priority || 100) - (WORK_TYPES_CONFIG[b.workType]?.priority || 100)
  );
}

// 가장 복잡한(priority 작은) 작업유형 — 메인 항목 판정.
export function determineMainWorkType(workItems) {
  const sorted = sortWorkItemsByPriority(workItems);
  return sorted[0]?.workType || null;
}

// 메인 항목 → 워크플로우 라우팅 (manual/auto).
export function determineWorkflow(workItems) {
  const main = determineMainWorkType(workItems);
  return WORK_TYPES_CONFIG[main]?.workflow || "manual_with_recommendation";
}

// 2026-05-26 C-2 — workType 정확일치 → isRefrigerant (item 단위).
//   사용처: AdminApp.jsx hasRefrigerant: hasRefrigerantItem(items) — ⚡ 표시용 (UI).
//   금액 계산엔 사용 X — 안전 표시용.
export function hasRefrigerantItem(workItems) {
  return Array.isArray(workItems) && workItems.some(it => isRefrigerant(it));
}

// 단일 작업 항목 포맷 (냉매충전은 기종 X / 가격 동일).
export function formatWorkItem(item) {
  if (!item) return "";
  if (item.workType === "냉매충전") {
    return `냉매충전 ×${item.qty || 1}`;
  }
  return `${item.workType} · ${item.appliance || "기종 미정"} ×${item.qty || 1}`;
}

// V14 2B-1 fix — 작업 항목 = 기종만 (작업유형은 별도 칩/알약 표시).
//   단일: "벽걸이 ×1" / multi: "벽걸이 ×1, 4way ×1" / 냉매충전: "냉매충전 ×1" (기종 없을 때 fallback).
//   Step 2-B-2 — KA "1way 첫 대" + "1way 추가" 분리 저장 → 표시는 "1way × N" 합쳐서.
export function formatWorkItemsAppliance(workItems) {
  const items = mergeKaOneway(workItems);
  if (!items || items.length === 0) return "";
  return items.map(item => {
    const qty = item.qty || 1;
    const appliance = item.appliance && String(item.appliance).trim();
    if (appliance) return `${appliance} ×${qty}`;
    return `${item.workType || "—"} ×${qty}`;
  }).join(", ");
}

// Step 5-1d — workItems 카드/알림 표시 (작업 종류별 그룹화).
//   규칙:
//   - 1건            → "세척 · 벽걸이 ×2" / "냉매충전 ×1"
//   - 같은 종류 복수 → "세척 · 벽걸이 ×2 외 1건"
//   - 다른 종류 추가 → "세척 · 벽걸이 ×2 (+ 냉매충전 ×1)"
//   - 혼합           → "세척 · 벽걸이 ×2 (+ 냉매충전 ×1, 점검 ×1)"
export function formatWorkItems(workItems) {
  const items = mergeKaOneway(workItems);
  if (!items || items.length === 0) return "";
  if (items.length === 1) return formatWorkItem(items[0]);
  const sorted = sortWorkItemsByPriority(items);
  const main = sorted[0];
  const mainText = formatWorkItem(main);

  const others = sorted.slice(1);
  const grouped = {};
  let sameTypeCount = 0;
  for (const item of others) {
    if (item.workType === main.workType) {
      sameTypeCount += 1;
    } else {
      grouped[item.workType] = (grouped[item.workType] || 0) + (item.qty || 1);
    }
  }
  const extraTypes = Object.entries(grouped).map(([wt, qty]) => `${wt} ×${qty}`).join(", ");
  if (extraTypes && sameTypeCount > 0) return `${mainText} 외 ${sameTypeCount}건 (+ ${extraTypes})`;
  if (extraTypes)                     return `${mainText} (+ ${extraTypes})`;
  return `${mainText} 외 ${sameTypeCount}건`;
}

// 작업유형 + 원청 → 기종 풀 (UI 노출).
//   냉매충전: 모든 원청 동일 풀 (KA 차등은 저장 시 자동 분리).
//   기타: APPLIANCE_POOL 매핑.
export function getAppliancePool(workType, _principalName) {
  if (workType === "냉매충전") return REFRIGERANT_APPLIANCE_POOL;
  return APPLIANCE_POOL[workType] || [];
}
