import { getCategoryMeta } from "../lib/serviceCatalog.js";
// workType 종류 판정 공용 헬퍼 (2026-05-26)
//
// 배경: DB work_types.name 은 "세척_1way", "세척_벽걸이", "냉매점검(서울 경기북부만 가능)" 등
//       세분화. 옛 코드 측 catch task.workType === "세척" / "냉매충전" 정확일치 측 catch
//       → 세분화 측 catch 측 catch 측 X (e72b189 측 catch 측 catch 측 catch 측 catch).
//
// 사용처: EngineerApp 측 catch 카운트, TaskCard 아이콘, ServiceTypeIcon, serviceTypes 측 catch 측 catch.
//        engineer skill 측 catch / 폼 state 측 catch — 측 catch ("세척"/"냉매충전" 고정).
//
// API:
//   getServiceKind(input) → 'cleaning' | 'refrigerant' | 'install' | 'leak' | 'other'
//     input: task object / workItem / workType 문자열 모두 측 catch.
//   isCleaning(input)    → bool
//   isRefrigerant(input) → bool

// 측 catch workType 문자열 측 catch kind 판정 (startsWith 측 catch + 측 catch 키워드).
function _kindFromWorkType(wt) {
  const s = String(wt || "").trim();
  if (!s) return "other";
  // 옛 시트 "세척_1way", "세척_벽걸이", 측 신규 "세척" 측 catch
  if (s.startsWith("세척")) return "cleaning";
  // "냉매충전", "냉매점검(...)", 측 catch
  if (s.startsWith("냉매")) return "refrigerant";
  if (s.startsWith("설치")) return "install";
  if (s.startsWith("누설")) return "leak";
  // 2026-07-09 — "누수" 단독 저장 케이스 방어 (storage key 는 "누설" 이 정석이지만
  //   옛 데이터 / 예외 입력 대비). 표시 라벨 "누설/누수" 와 무관 — 매칭 keyword 확장.
  if (s.startsWith("누수")) return "leak";
  // 2026-06-28 — 설치 5종 work_types.name 직접 매칭 (Mig 124/125 활성화 결과).
  //   "신규설치" / "이전설치" / "철거" / "실외기중고교체" / "기계중고교체" → install kind.
  //   task_items.work_types.name 이 5종 중 하나면 startsWith 매칭 안 되어 "other" 떨어지는 사고 차단.
  if (s === "신규설치" || s === "이전설치" || s === "철거"
      || s === "실외기중고교체" || s === "기계중고교체") return "install";
  return "other";
}

// 측 catch — service_types.code 측 catch.
function _kindFromServiceCode(code) {
  if (code === "cleaning")    return "cleaning";
  if (code === "refrigerant") return "refrigerant";
  if (code === "install")     return "install";
  if (code === "leak")        return "leak";
  return null;  // null = 측 catch 측 catch (caller 측 catch workType fallback)
}

// 메인 API — task / workItem / 문자열 측 catch 측 catch.
//   1순위: serviceCode (service_types.code — DB 측 catch)
//   2순위: workType 문자열 startsWith (fallback)
export function getServiceKind(input) {
  if (!input) return "other";

  // 1) 문자열 — workType prop 측 catch 측 catch (ServiceTypeIcon 측 catch)
  if (typeof input === "string") {
    return _kindFromWorkType(input);
  }

  // 2) task 또는 workItem — main item 측 catch
  const main = Array.isArray(input.workItems) && input.workItems.length > 0
    ? input.workItems[0]
    : input;
  if (!main) return "other";

  // serviceCode (camel 또는 snake)
  const code = main.serviceCode || main.service_code;
  const fromCode = _kindFromServiceCode(code);
  if (fromCode) return fromCode;

  // workType fallback (camel 또는 snake)
  return _kindFromWorkType(main.workType || main.work_type || "");
}

export function isCleaning(input) {
  return getServiceKind(input) === "cleaning";
}

export function isRefrigerant(input) {
  return getServiceKind(input) === "refrigerant";
}

// 2026-07-20 — 5종 통일 뱃지·필터 소스.
//   각 화면이 자체 SERVICE_KIND / kind 배열을 재선언하다가 이분법·삼항 잔재가 남는 사고 방지.
//   RevenueDetailScreen / PaymentHistoryScreen / 미래 매출 화면 등 공유.
//   색상은 workTypeColors.js COLORS_* 팔레트와 정렬.
export const SERVICE_KIND_META = {
  cleaning:    { key: "cleaning",    label: "세척",       color: "#0EA5E9", icon: "❄" },
  refrigerant: { key: "refrigerant", label: "냉매",       color: "#FFB800", icon: "⚡" },
  install:     { key: "install",     label: "설치",       color: "#8B5CF6", icon: "🔧" },
  leak:        { key: "leak",        label: "냉매 누설·물 누수",  color: "#DC2626", icon: "💧" },
  other:       { key: "other",       label: "기타",       color: "#9CA3AF", icon: "•" },
};

// 순서 표기·필터 chip 렌더용.
export const SERVICE_KIND_ORDER = ["cleaning", "refrigerant", "install", "leak", "other"];

// 2026-10-06 — 누설 계열의 표시 이름: "냉매 누설" / "물 누수". 구분이 안 되면 "냉매 누설·물 누수".
//   input: 작업 종류 문자열, workItem, task 모두 가능.
export function leakDisplayLabel(input) {
  const main = typeof input === "string"
    ? { workType: input }
    : (Array.isArray(input?.workItems) && input.workItems.length > 0 ? input.workItems[0] : (input || {}));
  const code = main.serviceCode || main.service_code || "";
  const wt = String(main.workType || main.work_type || "");
  if (code === "water_leak" || wt.startsWith("누수")) return "물 누수";
  if (code === "leak" || wt.startsWith("누설")) return "냉매 누설";
  return "냉매 누설·물 누수";
}

// 2026-10-06 — 주방후드 작업인지 (업소용 / 가정용 / 후드설치). 문자열·workItem·task 모두 가능.
export function isHoodWork(input) {
  const main = typeof input === "string"
    ? { workType: input }
    : (Array.isArray(input?.workItems) && input.workItems.length > 0 ? input.workItems[0] : (input || {}));
  const code = String(main.serviceCode || main.service_code || "");
  const wt = String(main.workType || main.work_type || "");
  return code.startsWith("hood") || wt.startsWith("주방후드") || wt.startsWith("후드설치") || wt.startsWith("후드옵션");
}

// task / workItem / 문자열 → META 하나.
export function getServiceKindMeta(input) {
  const meta = SERVICE_KIND_META[getServiceKind(input)] || SERVICE_KIND_META.other;
  // 2026-10-06 — 이름은 작업 종류 그대로, 색·아이콘은 종목 기준표(serviceCatalog)에서.
  //   (SERVICE_KIND_META 의 색은 매출 통계의 "작업 종류별" 구분에만 쓴다.)
  const cat = getCategoryMeta(input);
  const paint = { color: cat.color, icon: cat.icon };
  if (meta.key === "other" && isHoodWork(input)) return { ...meta, label: "주방후드", ...paint };
  if (meta.key === "other" && cat.key !== "etc") return { ...meta, label: cat.label, ...paint };
  if (meta.key === "leak") return { ...meta, label: leakDisplayLabel(input), ...paint };
  return { ...meta, ...paint };
}

// 2026-10-06 — 카드의 "· 기종 ×수량" 글자. 기종이 없는 종목(주방후드·출장비 등)은 기종이 "(공통)" 으로
//   저장돼 있어 "(공통) ×1" 이 그대로 보였다 → 그런 종목은 빈 글자를 돌려준다.
export function isCommonAppliance(appliance) {
  const a = String(appliance || "").trim();
  return !a || a === "(공통)";
}
export function applianceQtyText(task, prefix = "· ") {
  if (!task || isCommonAppliance(task.appliance)) return "";
  return `${prefix}${task.appliance}${task.qty ? ` ×${task.qty}` : ""}`;
}
