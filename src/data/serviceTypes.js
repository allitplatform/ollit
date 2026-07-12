// V12-3 — 작업 종류 색깔 (Chip 패턴: 흰배경 + 컬러 보더 + 컬러 글자)
// 2026-05-20 Phase 5 Step 0.F-2 — 세척 #0EA5E9 통일 (workTypeColors V14 spec)
//   cleaning ❄️ 파랑 (#0EA5E9)
//   refrigerant ⚡ 노랑 (#FFB800)
//   visit     🚗 그레이 (#555)
//   extra     ➕ 주황 (#FF8F00)
export const SERVICE_TYPES = {
  cleaning: {
    id:          "cleaning",
    label:       "세척",
    icon:        "❄️",
    color:       "#0EA5E9",
    textColor:   "#0EA5E9",
    bgColor:     "var(--bg-secondary)",
    borderColor: "#0EA5E9",
  },
  refrigerant: {
    id:          "refrigerant",
    label:       "냉매",
    icon:        "⚡",
    color:       "#FFB800",
    textColor:   "#FFB800",
    bgColor:     "var(--bg-secondary)",
    borderColor: "#FFB800",
  },
  // 2026-06-28 — 설치 (Mig 124/125 활성화). 보라 톤.
  install: {
    id:          "install",
    label:       "설치",
    icon:        "🔧",
    color:       "#8B5CF6",
    textColor:   "#8B5CF6",
    bgColor:     "var(--bg-secondary)",
    borderColor: "#8B5CF6",
  },
  // 2026-06-28 — 누설 (Mig 122 활성화). 빨강 톤.
  // 2026-07-08 — 표시 라벨만 '누설/누수' (id / kind='leak' 매칭키 무손).
  leak: {
    id:          "leak",
    label:       "누설/누수",
    icon:        "💧",
    color:       "#DC2626",
    textColor:   "#DC2626",
    bgColor:     "var(--bg-secondary)",
    borderColor: "#DC2626",
  },
  visit: {
    id:          "visit",
    label:       "출장",
    icon:        "🚗",
    color:       "#555555",
    textColor:   "var(--text-secondary)",
    bgColor:     "var(--bg-secondary)",
    borderColor: "var(--border-strong, var(--border))",
  },
  extra: {
    id:          "extra",
    label:       "추가",
    icon:        "➕",
    color:       "#FF8F00",
    textColor:   "#FF8F00",
    bgColor:     "var(--bg-secondary)",
    borderColor: "#FF8F00",
  },
  // 2026-07-12 — 사장님 spec: 종목 미확정 상태 (예: 관리자 폼에서 '기타/기타' 저장,
  //   홈페이지 접수 종목 미상). 세척 폴백 대신 '미정' 배지 표시.
  undecided: {
    id:          "undecided",
    label:       "미정",
    icon:        "❔",
    color:       "#F59E0B",
    textColor:   "#F59E0B",
    bgColor:     "var(--bg-secondary)",
    borderColor: "#F59E0B",
  },
};

// 2026-07-12 — placeholder workType 판정 (미정/기타/미확정/빈값 등).
//   detectServiceType 폴백 정정 + 배너 판정 공용. 소문자 정규화.
const _PLACEHOLDER_WT_RE = /^(미정|기타|미확정|—|-|_|\?|없음|선택|선택안함|선택안됨)$/i;
function _isPlaceholderWorkType(s) {
  if (!s) return true;
  const v = String(s).trim();
  if (v === "") return true;
  return _PLACEHOLDER_WT_RE.test(v);
}

// 작업 분류 자동 감지
// 2026-05-26 C-1 — workType 정확일치 → isRefrigerant (DB "냉매점검(...)" 측 catch).
// 2026-06-28 — getServiceKind 사용 (설치/누설 5종 work_types.name 직접 매칭 포함).
import { getServiceKind } from "../utils/workTypeKind.js";

export function detectServiceType(task) {
  if (!task) return SERVICE_TYPES.cleaning;
  if (task.status === "visit_only") return SERVICE_TYPES.visit;
  if (task.orderType === "extra")   return SERVICE_TYPES.extra;

  // 2026-07-12 — 사장님 spec: 종목 미확정 → '세척' 폴백 대신 '미정' 배지.
  //   applianceUndecided 플래그 우선 검사 → workType placeholder / workItems[0].workType
  //   placeholder / 둘 다 빈값 → undecided.
  if (task.applianceUndecided === true) return SERVICE_TYPES.undecided;
  const firstWt = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems[0]?.workType
    : null;
  const rootWt  = task.workType;
  const hasReal = (firstWt && !_isPlaceholderWorkType(firstWt))
               || (rootWt  && !_isPlaceholderWorkType(rootWt));
  if (!hasReal) return SERVICE_TYPES.undecided;

  // serviceCode 우선 (DB) → workType startsWith → 5종 work_types.name 직접 매칭 (workTypeKind v2).
  const kind = getServiceKind(task);
  if (kind === "refrigerant") return SERVICE_TYPES.refrigerant;
  if (kind === "install")     return SERVICE_TYPES.install;
  if (kind === "leak")        return SERVICE_TYPES.leak;
  if (kind === "cleaning")    return SERVICE_TYPES.cleaning;

  // 옛 텍스트 fallback (workType / productName 자유 텍스트 케이스)
  const text = `${task.productName || ""} ${task.workType || ""}`.toLowerCase();
  if (text.includes("냉매") || text.includes("가스") || text.includes("충전")) {
    return SERVICE_TYPES.refrigerant;
  }
  if (text.includes("출장") && !text.includes("청소") && !text.includes("세척")) {
    return SERVICE_TYPES.visit;
  }
  // 2026-07-12 — 최종 fallback: '세척' 대신 '미정'.
  //   진짜 세척 작업이면 이미 kind='cleaning' 로 위에서 반환됐음.
  return SERVICE_TYPES.undecided;
}

export function getServiceTypeById(id) {
  return SERVICE_TYPES[id] || SERVICE_TYPES.cleaning;
}
