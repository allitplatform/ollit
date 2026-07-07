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
  "설치":     { enabled: true,  workflow: "manual_with_recommendation", needsAppliance: true,  priority: 2  },
  "누설":     { enabled: true,  workflow: "manual_with_recommendation", needsAppliance: true,  priority: 3  },
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
//   누설: 6원청 5기종 (벽걸이/스탠드/1way/투인원/4way) — 정책 동일.
//         usol_n 누설 = appliance NULL (냉매점검) — getAppliancePool 에서 분기.
//   설치: allday 원청만 정책 존재 (appliance NULL = install+null 1행 정책).
//         5종 (신규설치/이전설치/철거/실외기중고교체/기계중고교체) 표시·선택·기록용.
//         appliance_types 에 그 5종 없음 → sync 트리거가 appliance_type_id NULL 매핑 →
//         정책 install+null 매칭 → 분배 75/25.
//         5종 이름은 workItem.description 으로 저장 → Mig 154 sync v5 가 task_items.description 에 옮김.
// 2026-06-28 — 설치 5종 표시·선택 복원. 매칭은 NULL, 기록은 description.
export const APPLIANCE_POOL = {
  "세척":           ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원", "시스템멀티"],
  "누설":           ["벽걸이", "스탠드", "1way", "투인원", "4way"],
  "설치":           ["신규설치", "이전설치", "철거", "실외기중고교체", "기계중고교체"],
  "출장비":         ["(공통)"],
  "추가선택(YS-N)": ["송풍팬분해", "실외기", "피톤치드"],
  "냉매점검(YS-N)": ["기본", "추가발생", "출장비"],
};

// 2026-06-28 — 매칭 시 appliance NULL 처리해야 하는 작업유형.
//   설치 5종 (신규설치 등) 은 appliance_types 에 없는 표시용 이름.
//   → 정책 매칭/sync 트리거가 NULL 처리. UI 는 그대로 5종 표시.
//   호출처: fee preview (calculateCommissionMultiRpc) 직전 변환.
export const NULL_APPLIANCE_WORK_TYPES = ["설치"];

// 냉매충전 기종 풀 (모든 원청 동일 UI 라벨, KA 차등 단가는 자동 처리).
export const REFRIGERANT_APPLIANCE_POOL = ["벽걸이", "스탠드", "4way", "투인원", "1way"];

// 작업유형 7종 (UI 노출 순서).
//   2026-06-25 누설/설치 활성화 — 누설은 냉매와 동일 정산, 설치는 75/25.
export const WORK_TYPES = ["세척", "냉매충전", "누설", "설치", "출장비", "추가선택(YS-N)", "냉매점검(YS-N)"];

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

// KA 작업 저장 직전 — "1way" + qty=N 항목을 두 행으로 분리.
//   2026-06-17 정정 (KA 1way policy_not_found 사고):
//     · appliance 그대로 "1way" 유지 (옛: "1way 첫 대"/"1way 추가" 라벨로 변경 — sync 트리거가
//       appliance_types EXACT 매칭 실패 → appliance_type_id NULL → calculate_commission
//       'policy_not_found').
//     · orderType '첫대'/'추가' 명시 — Mig 093 sync v4 가 task_items.order_type 에 옮김 →
//       Mig 094 compute_payment v18 이 p_qty_condition 으로 calculate_commission 매칭.
//   원청앱 NewReceptionScreenLite (line 388~406) 정상 구현과 동일 패턴.
//   KA 외 원청 / 다른 기종 / 1way 가 아닌 항목은 그대로.
export function splitWorkItemsForKa1way(items, principalName) {
  if (principalName !== KA_PRINCIPAL_NAME || !Array.isArray(items)) return items;
  const out = [];
  for (const item of items) {
    if (item.workType === "냉매충전" && item.appliance === "1way") {
      const qty = item.qty || 1;
      out.push({ ...item, appliance: "1way", qty: 1, orderType: "첫대" });
      if (qty > 1) {
        out.push({ ...item, appliance: "1way", qty: qty - 1, orderType: "추가" });
      }
    } else {
      out.push(item);
    }
  }
  return out;
}

// 카드/리스트 표시용 — 분리 저장된 KA 1way 행을 단일 "1way × N" 으로 합쳐 보여줌.
//   2026-06-17 정정 — 두 shape 동시 인식:
//     · 옛 (legacy):  appliance="1way 첫 대" / "1way 추가"  (split fix 이전 저장 데이터)
//     · 새 (current): appliance="1way" + orderType IN ('첫대','추가') (split fix 이후)
//   단일 "1way" + orderType 없는 행은 합치지 않음 (그냥 1대 행이므로 표시 그대로).
//   결과 row 의 appliance 는 항상 "1way" / orderType 제거 (표시용 단일 항목).
function isKa1waySplitRow(w) {
  if (!w || w.workType !== "냉매충전") return false;
  // legacy 라벨 — split fix 이전
  if (w.appliance === "1way 첫 대" || w.appliance === "1way 추가") return true;
  // current — appliance="1way" + orderType 마커
  const ot = w.orderType || w.order_type;
  if (w.appliance === "1way" && (ot === "첫대" || ot === "추가")) return true;
  return false;
}

export function mergeKaOneway(items) {
  if (!Array.isArray(items)) return items;
  if (!items.some(isKa1waySplitRow)) return items;  // split 마커 없으면 그대로
  const merged = [];
  let mergedQty = 0;
  let mergedTemplate = null;
  for (const item of items) {
    if (isKa1waySplitRow(item)) {
      mergedQty += (item.qty || 1);
      if (!mergedTemplate) mergedTemplate = item;
    } else {
      merged.push(item);
    }
  }
  if (mergedTemplate) {
    // 표시용 단일 항목: appliance "1way" + orderType 키 제거.
    const { orderType: _ot, order_type: _otSnake, ...rest } = mergedTemplate;
    merged.push({ ...rest, appliance: "1way", qty: mergedQty });
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
//   설치: allday 원청만 5종 노출 (정책은 install+null 1행, 5종은 표시·기록용).
//         다른 원청 = [] (정책 없음 → 폼에서 "정책 없음" 안내).
//   누설: 6원청 5기종. 단 usol_n = "(공통)" 1 옵션 (냉매점검 — appliance NULL 정책).
//   기타: APPLIANCE_POOL 매핑.
// 2026-06-28 — 설치 5종 복원. 매칭 NULL, 기록 description.
export function getAppliancePool(workType, principalName) {
  if (workType === "냉매충전") return REFRIGERANT_APPLIANCE_POOL;

  if (workType === "설치") {
    // 정책 = allday + install + appliance NULL 1행. 5종은 표시·선택·description 기록용.
    return principalName === "올데이케어" ? APPLIANCE_POOL["설치"] : [];
  }

  if (workType === "누설") {
    // usol_n 누설 = appliance NULL (냉매점검 정책). 그 외 6원청 = 5기종.
    if (principalName === "유솔홈케어 N") return ["(공통)"];
    return APPLIANCE_POOL["누설"];
  }

  return APPLIANCE_POOL[workType] || [];
}

// ============================================
// 카톡 텍스트 자동 파싱 (2026-06-17 추출 from AdminApp.jsx)
//   원본: AdminApp.jsx line 276~677. 모바일 NewReceptionFormScreen + PC NewReceptionPcForm 공유.
//   parseKakaoText(text) → { matched, unmatched, phone, customer, address,
//     requestDate, requestTime, principal, estimatedPrice, applianceItems,
//     detectedWorkTypes, workItems, memo, priceNeedsConfirm, priceRawValue }
//   parseKaText(text, phoneMatch) → KA 자유 텍스트 (라벨 X / 전화 앵커 / "가.충" 패턴)
//   formatPhone(raw) → "010-0000-0000" 형식
// ============================================

// 자동 하이픈 (공용).
// 2026-07-04 — 안심번호(0503, 4-4-5, 13자리) 지원. 하드캡 11→13, 자릿수 분기 추가.
//   · 11자리 (010 등)     → XXX-XXXX-XXXX  (3-4-4)  ★ 기존 동작 완전 동일.
//   · 13자리 (0503 안심)  → XXXX-XXXX-XXXXX (4-4-5) ← 신규.
//   · 그 외 길이           → 하이픈 없이 숫자 그대로 (부분 입력 / 미확인 계열).
// ⚠️ 서류발행 (DocIssueScreen) 도 이 함수 공유. 11자리 결과 불변이 회귀 안전선.
export function formatPhone(raw) {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 13);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 13) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return digits;
}

// 한국 휴대폰 + 안심번호 매치 regex — 모듈 최상위에서 재사용 (parseKakaoText + 서류발행 자동분석).
//   +82 국가코드 / 공백 / 점 / 하이픈 변형 허용. 첫 매치만 반환 (g 플래그 없음).
// 2026-07-04 — 안심번호(050X) 계열 포함 확장. 뒷자리 4~5 허용 (13자리 안심 마지막 5).
// 2026-07-07 — 앞뒤 경계 lookbehind/lookahead 추가.
//   dot 금액 안쪽 매치 사고 방지: 이전 정규식은
//     "스탠드가스110.000\n01052452615\n전화먼저하세요"
//   에서 phone 이 "10.000\n01052" 로 오염됨 (110 안의 10, . 000, \n, 실제
//   phone 앞 5자리 순서로 삼킴). \s 에 개행이 포함돼 cross-line 오염.
//   경계 정의:
//     (?<![\d.])  앞이 digit 또는 dot 이면 매치 시작 X (dot 금액 뒷자리 배제)
//     (?!\d)      뒤가 digit 이면 매치 종료 X (phone 뒷자리 잘림 방지)
//   점 표기 번호 (010.1234.5678) 는 자체 패턴이 통째로 매치하므로 무손상.
//   Node 검증 (통과):
//     '스탠드가스110.000\n01052452615...' → '01052452615'  ★ 사고 재현 케이스 fix
//     '010.1234.5678'                       → '010.1234.5678' (점 표기 유지)
//     '0503-1234-56789' / '010-1234-5678' / '01012345678' 그대로.
export const KO_PHONE_REGEX = /(?<![\d.])(?:\+?82[\s-]?)?(?:0?1[0-9]|050\d)[\s.-]?\d{3,4}[\s.-]?\d{4,5}(?!\d)/;

// 2026-05-21 — KA 자유 텍스트 파서 (라벨 X / 전화 앵커 + "가.충" 패턴).
//   입력 예: "공릉동공릉아파트 603동1505호\n벽걸이 .가.충. 70.000\n01039291303"
//   출력: parseKakaoText 와 동일 형식 (handleAutoFill 매핑 그대로).
export function parseKaText(text, phoneMatch) {
  const result = { matched: [], unmatched: [] };

  // 전화번호 표준화 (formatPhone 사용)
  let pDigits = phoneMatch[0].replace(/^\+?82\s?-?\s?/, "").replace(/\D/g, "");
  if (pDigits.startsWith("10") || pDigits.startsWith("11") || pDigits.startsWith("16") || pDigits.startsWith("17") || pDigits.startsWith("18") || pDigits.startsWith("19")) {
    pDigits = "0" + pDigits;
  }
  result.phone = formatPhone(pDigits);
  result.matched.push("연락처");

  // 전화 기준으로 앞/뒤 분리
  const phoneIdx = text.indexOf(phoneMatch[0]);
  const before = text.slice(0, phoneIdx).replace(/\s+$/, "");
  const after  = text.slice(phoneIdx + phoneMatch[0].length).trim();

  // 줄 단위 split (빈 줄 제거)
  const lines = before.split(/\n+/).map(s => s.trim()).filter(Boolean);

  // "가.충" / "가 . 충" / "가충" — 종류 라인 마커
  const gachungRegex = /가\s*\.?\s*충/;
  const itemLineIdx = lines.findIndex(l => gachungRegex.test(l));

  if (itemLineIdx >= 0) {
    const itemLine = lines[itemLineIdx];
    const addressLines = lines.slice(0, itemLineIdx);

    // 주소 = 종류 라인 위 줄들 합침 (1~3줄 가변)
    if (addressLines.length > 0) {
      result.address = addressLines.join(" ").replace(/\s+/g, " ").trim();
      result.matched.push("주소");
    }

    // 기종 — 1way 등. KA 1way 분할은 splitWorkItemsForKa1way 가 자동 처리.
    const APPLIANCE_KR = ["벽걸이", "1way", "스탠드", "4way", "원형", "투인원"];
    let appliance = null;
    for (const kr of APPLIANCE_KR) {
      if (itemLine.includes(kr)) { appliance = kr; break; }
    }
    // 2026-06-17 — shorthand fallback (partnerPasteParser SHORTHAND_PATTERNS 와 정합).
    //   "벽.가.충" / ".가.충" 같이 단축 약어 사용 케이스. 단어 경계 (앞: 시작/공백/구두점, 뒤: 끝/공백/구두점).
    //   FULL label 매칭 실패 시에만 발화 → 기존 케이스 변화 0.
    if (!appliance) {
      const SHORTHAND_KA = [
        { re: /(?:^|[\s.,])벽(?=[\s.,]|$)/,    label: "벽걸이" },
        { re: /(?:^|[\s.,])스(?=[\s.,]|$)/,    label: "스탠드" },
        { re: /(?:^|[\s.,])천(?=[\s.,]|장|$)/, label: "1way"   },
        { re: /(?:^|[\s.,])투(?=[\s.,]|$)/,    label: "투인원" },
      ];
      for (const ap of SHORTHAND_KA) {
        if (ap.re.test(itemLine)) { appliance = ap.label; break; }
      }
    }

    // 금액 — "가.충" 다음 위치 가격. 전화번호 제외.
    //   "70.000" / "100.000" → 70000 / 100000 (점 천단위 패턴 우선)
    //   "70000" 그대로 = 4자리 이상 숫자
    const priceLine = itemLine.replace(gachungRegex, " ");
    const dotPriceMatch = priceLine.match(/(\d{1,3}(?:\.\d{3})+)/);
    const plainPriceMatch = priceLine.match(/(\d{4,})/);
    if (dotPriceMatch) {
      result.estimatedPrice = parseInt(dotPriceMatch[1].replace(/\./g, ""), 10);
      result.matched.push("금액");
    } else if (plainPriceMatch) {
      result.estimatedPrice = parseInt(plainPriceMatch[1], 10);
      result.matched.push("금액");
    }

    // workItems = 냉매충전 + 기종 + qty=1 default
    if (appliance) {
      result.workItems = [{ workType: "냉매충전", appliance, qty: 1 }];
      result.applianceItems = [{ appliance, qty: 1 }];
      result.detectedWorkTypes = ["냉매충전"];
      result.matched.push("기종");
      result.matched.push("작업 종류 1건");
    }
  }

  // 원청 = KA 고정 (패턴 매칭됐으니 자동)
  result.principal = "에어컨프로 (KA)";
  result.matched.push("원청(KA)");

  // 메모 = 전화 다음 줄들
  if (after) {
    result.memo = after;
    result.matched.push("메모");
  }

  return result;
}

// 일반 카톡 텍스트 파서 — 라벨/자유 텍스트 혼합 처리.
//   원청, 이름, 연락처, 주소, 작업유형, 기종, 일정, 금액 자동 추출.
export function parseKakaoText(text) {
  const result = { matched: [], unmatched: [] };
  if (!text || !text.trim()) return result;

  // 1. 연락처 (다양한 형식: +82 / 국가코드 / 공백 / 점 / 하이픈)
  //    regex 는 모듈 최상위 KO_PHONE_REGEX 사용 (서류발행 자동분석과 공용).
  const phoneMatch = text.match(KO_PHONE_REGEX);

  // KA 자유 텍스트 패턴 ("가.충" + 전화) → parseKaText 위임
  if (phoneMatch && /가\s*\.?\s*충/.test(text)) {
    return parseKaText(text, phoneMatch);
  }
  if (phoneMatch) {
    let p = phoneMatch[0].replace(/^\+?82\s?-?\s?/, "").replace(/\D/g, "");
    if (p.startsWith("10") || p.startsWith("11") || p.startsWith("16") || p.startsWith("17") || p.startsWith("18") || p.startsWith("19")) {
      p = "0" + p;
    }
    result.phone = formatPhone(p);
    result.matched.push("연락처");
  }

  // 2. 금액 (만원 단위 + 원 단위 + 콤마 형식 처리)
  const priceRegex1 = /(\d+)\s*만\s*원?/;          // "16만원" / "17만"
  const priceRegex2 = /가격은?\s*(\d{1,3})\b/;     // "가격은 17"
  const priceRegex3 = /(?:견적|금액|가격)\s*[:：]?\s*(\d{1,3}(?:,\d{3})+|\d{4,})\s*원?/;
  const priceRegex4 = /(\d{1,3}(?:,\d{3})+)\s*원/;
  let priceMatch = text.match(priceRegex1);
  if (priceMatch) {
    result.estimatedPrice = parseInt(priceMatch[1]) * 10000;
    result.matched.push("금액");
  } else if ((priceMatch = text.match(priceRegex3))) {
    result.estimatedPrice = parseInt(priceMatch[1].replace(/,/g, ""), 10);
    result.matched.push("금액");
  } else if ((priceMatch = text.match(priceRegex4))) {
    result.estimatedPrice = parseInt(priceMatch[1].replace(/,/g, ""), 10);
    result.matched.push("금액");
  } else {
    priceMatch = text.match(priceRegex2);
    if (priceMatch) {
      const n = parseInt(priceMatch[1]);
      result.estimatedPrice = n * 10000;
      result.priceNeedsConfirm = true;
      result.priceRawValue = n;
      result.matched.push("금액 (확인 필요)");
    }
  }

  // 3. 주소
  //   0순위: "주소:" 라벨 (콜론 후 줄 끝까지)
  const addrColonRegex = /주소\s*[:：]\s*([^\n]+)/;
  const addrColonMatch = text.match(addrColonRegex);
  if (addrColonMatch) {
    result.address = addrColonMatch[1].replace(/[\s,!.?]+$/, "").trim();
    result.matched.push("주소");
  } else {
    //   1순위: 시 키워드 + 그 줄 끝까지
    const cityRegex = /(서울|경기|인천|부산|대구|광주|대전|울산|세종|제주)[^\n]+/;
    const cityMatch = text.match(cityRegex);
    if (cityMatch) {
      result.address = cityMatch[0].replace(/[\s,!.?]+$/, "").trim();
      result.matched.push("주소");
    } else {
      //   2순위: 동/구/로/길 키워드
      const kwRegex = /(?:^|[\s:：])([가-힣]{2,}(?:동|구|로|길)[\s\d\-,]*\d+(?:\s*[가-힣]+\d*호?)?)/m;
      const kwMatch = text.match(kwRegex);
      if (kwMatch) {
        result.address = kwMatch[1].replace(/[\s,!.?]+$/, "").trim();
        result.matched.push("주소");
      } else {
        //   3순위: 짧은 구/시 단독
        const shortRegex = /(?:^|[\s:：])([가-힣]{2,4}(?:구|시))(?:\s|$|[,.!?])/m;
        const shortMatch = text.match(shortRegex);
        if (shortMatch) {
          result.address = shortMatch[1].trim();
          result.matched.push("주소");
        }
      }
    }
  }

  // 4. 이름 (콜론 패턴 + 라벨 blacklist)
  const NAME_LABEL_BLACKLIST = new Set([
    "원청", "주소", "연락처", "전화", "핸드폰", "휴대폰",
    "기종", "견적", "금액", "가격", "수량",
    "작업", "유형", "작업유형",
    "일정", "시간", "날짜", "희망",
    "메모", "비고", "요청", "사유",
    "고객", "성함", "성명", "이름",
    "확정", "예약", "구분",
  ]);
  const nameRegex1 = /(?:이름|고객|성함|성명)\s*[:：]\s*([가-힣]{2,5})/;
  const nameRegex2 = /^([가-힣]{2,5})\s*[:：]/m;
  let nameMatch = text.match(nameRegex1);
  if (!nameMatch) {
    const m2 = text.match(nameRegex2);
    if (m2 && !NAME_LABEL_BLACKLIST.has(m2[1])) {
      nameMatch = m2;
    }
  }
  if (nameMatch) {
    result.customer = nameMatch[1];
    result.matched.push("이름");
  }

  // 5. 원청 (form dropdown value 매칭)
  const principalMap = {
    "올데이케어": "올데이케어",
    "올데이":     "올데이케어",
    "에어컨프로": "에어컨프로 (KA)",
    "에어컨 프로": "에어컨프로 (KA)",
    "KA":         "에어컨프로 (KA)",
    "쿨가이":     "쿨가이 (KB)",
    "KB":         "쿨가이 (KB)",
    "용인컴퍼니": "용인컴퍼니",
    "용인":       "용인컴퍼니",
    "유솔홈케어 H": "유솔홈케어 H",
    "유솔홈케어H":  "유솔홈케어 H",
    "유솔 H":     "유솔홈케어 H",
    "유솔홈케어 N": "유솔홈케어 N",
    "유솔홈케어N":  "유솔홈케어 N",
    "유솔 N":     "유솔홈케어 N",
    "유솔":       "유솔홈케어 H",
    "크리크린":   "크리크린",
  };
  const principalColonRegex = /원청\s*[:：\-]\s*([가-힣A-Za-z\s]+?)(?:\n|$|,|\/)/;
  const principalColonMatch = text.match(principalColonRegex);
  let principalDetected = null;
  if (principalColonMatch) {
    const raw = principalColonMatch[1].trim();
    for (const [keyword, id] of Object.entries(principalMap).sort((a, b) => b[0].length - a[0].length)) {
      if (raw.indexOf(keyword) !== -1) {
        principalDetected = id;
        break;
      }
    }
    if (principalDetected) {
      result.principal = principalDetected;
      result.matched.push("원청");
    }
  } else {
    for (const [keyword, id] of Object.entries(principalMap).sort((a, b) => b[0].length - a[0].length)) {
      if (text.indexOf(keyword) !== -1) {
        result.principal = id;
        result.matched.push("원청");
        break;
      }
    }
  }

  // 6. 기종 + 수량 (V14 헌법 7 기종 + 옛 호환)
  const applianceItems = [];
  const itemRegex = /(벽걸이|1way|스탠드|4way|원형|투인원|시스템멀티|시스템\s?멀티|시스템|천장형|이동식)\s*(?:[×x]\s*)?(\d+)?\s*대?/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(text)) !== null) {
    const appliance = itemMatch[1].replace(/\s+/g, "");
    if (!applianceItems.some(x => x.appliance === appliance)) {
      applianceItems.push({ appliance, qty: parseInt(itemMatch[2]) || 1 });
    }
  }
  if (applianceItems.length > 0) {
    result.applianceItems = applianceItems;
    result.matched.push(`기종 ${applianceItems.length}건`);
  }

  // 작업 종류 (키워드 매핑 — 복수 인식)
  // 2026-07-05 — "누수" 별칭 추가. 사장님 spec: 누수=누설 동일 처리 (신규 service_code 만들지 않음).
  //   기존 leak work_type 그대로 사용 → compute_payment v22 IN ('refrigerant','leak') 정합 유지.
  const workTypeMap = {
    "세척": "세척",
    "청소": "세척",
    "냉매": "냉매충전",
    "가스": "냉매충전",
    "충전": "냉매충전",
    "설치": "설치",
    "누설": "누설",
    "누수": "누설",   // 별칭 — service_types.name = '누설' 로 저장돼 leak service 매칭.
    "점검": "점검",
    "수리": "수리",
  };
  const detectedWorkTypes = [];
  const seenWT = new Set();
  for (const [keyword, workType] of Object.entries(workTypeMap)) {
    if (text.includes(keyword) && !seenWT.has(workType)) {
      detectedWorkTypes.push(workType);
      seenWT.add(workType);
    }
  }
  if (detectedWorkTypes.length > 0) {
    result.detectedWorkTypes = detectedWorkTypes;
    result.matched.push(`작업 종류 ${detectedWorkTypes.length}건`);
  }

  // workItems 매트릭스 (냉매충전은 기종 X로 별도 분기)
  result.workItems = [];
  const aps = applianceItems;
  const hasRefrigerant = detectedWorkTypes.includes("냉매충전");
  const otherWTs = detectedWorkTypes.filter(w => w !== "냉매충전");

  // 1) 냉매충전 — 기종 있으면 각 기종별, 없으면 수량만
  if (hasRefrigerant) {
    if (aps.length > 0) {
      for (const a of aps) {
        result.workItems.push({ workType: "냉매충전", appliance: a.appliance, qty: a.qty });
      }
    } else {
      const refrigerantQtyRegex = /(?:냉매(?:충전|가스)?|가스(?:충전)?|충전)\s*(\d+)\s*대?/;
      const qtyMatch = text.match(refrigerantQtyRegex);
      const refrigerantQty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
      result.workItems.push({ workType: "냉매충전", appliance: "", qty: refrigerantQty });
    }
  }

  // 2) 나머지 작업 종류 (세척 등) — 기종과 매칭
  if (otherWTs.length === 1 && aps.length > 0) {
    if (!hasRefrigerant) {
      for (const a of aps) result.workItems.push({ workType: otherWTs[0], appliance: a.appliance, qty: a.qty });
    } else {
      for (const a of aps) result.workItems.push({ workType: otherWTs[0], appliance: a.appliance, qty: a.qty });
    }
  } else if (otherWTs.length > 1 && aps.length === 1) {
    for (const wt of otherWTs) result.workItems.push({ workType: wt, appliance: aps[0].appliance, qty: aps[0].qty });
  } else if (otherWTs.length > 1 && aps.length > 1) {
    for (const a of aps) result.workItems.push({ workType: otherWTs[0], appliance: a.appliance, qty: a.qty });
    result.workItemsNeedReview = true;
  } else if (otherWTs.length > 0 && aps.length === 0) {
    result.matched.push(`${otherWTs.join(", ")} 인식 (기종 직접 선택)`);
  } else if (otherWTs.length === 0 && aps.length > 0 && !hasRefrigerant) {
    result.matched.push("기종 인식 (작업 직접 선택)");
  }

  // 7. 일정 (M월 D일 + H:MM / H시 MM분)
  const dateTimeRegex = /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:[^\d]{0,8})?(\d{1,2})\s*[:시]\s*(\d{0,2})/;
  const dateRegex2 = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
  const timeRegex = /(\d{1,2})\s*시\s*(\d{0,2})\s*분?/;

  const dateTimeMatch = text.match(dateTimeRegex);
  const today = new Date();
  const yyyy = today.getFullYear();
  if (dateTimeMatch) {
    const mm = String(dateTimeMatch[1]).padStart(2, "0");
    const dd = String(dateTimeMatch[2]).padStart(2, "0");
    const h  = String(dateTimeMatch[3]).padStart(2, "0");
    const min = (dateTimeMatch[4] || "00").padStart(2, "0");
    result.requestDate = `${yyyy}-${mm}-${dd}`;
    result.requestTime = `${h}:${min}`;
    result.matched.push("일정");
  } else {
    const altDate = text.match(dateRegex2);
    if (altDate) {
      const mm = String(altDate[1]).padStart(2, "0");
      const dd = String(altDate[2]).padStart(2, "0");
      result.requestDate = `${yyyy}-${mm}-${dd}`;
      result.matched.push("일정 (날짜만)");
    }
    const timeMatch = text.match(timeRegex);
    if (timeMatch) {
      const h = String(timeMatch[1]).padStart(2, "0");
      const min = (timeMatch[2] || "00").padStart(2, "0");
      result.requestTime = `${h}:${min}`;
      if (!result.matched.includes("일정 (날짜만)")) result.matched.push("시간");
    }
  }

  return result;
}
