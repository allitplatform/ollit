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
};

// 작업 분류 자동 감지
// 2026-05-26 C-1 — workType 정확일치 → isRefrigerant (DB "냉매점검(...)" 측 catch).
import { isRefrigerant } from "../utils/workTypeKind.js";

export function detectServiceType(task) {
  if (!task) return SERVICE_TYPES.cleaning;
  if (task.status === "visit_only") return SERVICE_TYPES.visit;
  if (task.orderType === "extra")   return SERVICE_TYPES.extra;
  if (isRefrigerant(task))          return SERVICE_TYPES.refrigerant;

  const text = `${task.productName || ""} ${task.workType || ""}`.toLowerCase();
  if (text.includes("냉매") || text.includes("가스") || text.includes("충전")) {
    return SERVICE_TYPES.refrigerant;
  }
  if (text.includes("출장") && !text.includes("청소") && !text.includes("세척")) {
    return SERVICE_TYPES.visit;
  }
  return SERVICE_TYPES.cleaning;
}

export function getServiceTypeById(id) {
  return SERVICE_TYPES[id] || SERVICE_TYPES.cleaning;
}
