// V14 — 작업 종류별 색 시스템 (전역 헬퍼)
// 세척 = 파랑 / 냉매 = 노랑 / 그 외(설치/점검/수리/기타) = 핑크

const DEFAULT_COLORS = {
  main: "#FF1B8D",
  box:  { light: "#FFB8D6", dark: "#2D0F1E" },
  sub:  { light: "#C13A78", dark: "#FF8FBE" },
  icon: "🔧",
  label: "기타",
};

const CLEANING_COLORS = {
  main: "#0EA5E9",
  box:  { light: "#BAE6FD", dark: "#0C2D40" },
  sub:  { light: "#0369A1", dark: "#38BDF8" },
  icon: "❄",
  label: "세척",
};

const REFRIG_COLORS = {
  main: "#FFB800",
  box:  { light: "#FFE699", dark: "#2A2010" },
  sub:  { light: "#997000", dark: "#FFD66B" },
  icon: "⚡",
  label: "냉매",
};

export function getWorkTypeColors(workType) {
  if (!workType) return DEFAULT_COLORS;
  const type = String(workType).toLowerCase();
  if (type.includes("세척")) return CLEANING_COLORS;
  if (type.includes("냉매") || type.includes("충전")) return REFRIG_COLORS;
  return DEFAULT_COLORS;
}

// 다크 모드 감지 (DOM 직접 읽음)
export function isDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dark";
}

// 작업 종류별 박스 배경 (라이트/다크 분기)
export function getWorkTypeBoxBg(workType, isDark = isDarkMode()) {
  const c = getWorkTypeColors(workType);
  return isDark ? c.box.dark : c.box.light;
}

// 작업 종류별 부가 글자 색
export function getWorkTypeSubColor(workType, isDark = isDarkMode()) {
  const c = getWorkTypeColors(workType);
  return isDark ? c.sub.dark : c.sub.light;
}
