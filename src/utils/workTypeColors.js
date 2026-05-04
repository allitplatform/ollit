// V14 — 작업 종류별 색 시스템 (전역 헬퍼)
// 세척 = 파랑 / 냉매 = 노랑 / 그 외(설치/점검/수리/기타) = 핑크
// label = 텍스트 라벨 색 (다크 라이트 분리) / box = 옅은 박스 / sub = 부가 글자
// buttonText = 채우기 버튼 위 글자 색 (냉매 노랑 위는 검정)

const COLORS_CLEANING = {
  main:  "#0EA5E9",
  box:   { light: "#BAE6FD", dark: "#0C2D40" },
  sub:   { light: "#0369A1", dark: "#38BDF8" },
  label: { light: "#0EA5E9", dark: "#38BDF8" },
  icon:  "❄",
  name:  "세척",
  buttonText: "#fff",
};

const COLORS_REFRIGERANT = {
  main:  "#FFB800",
  box:   { light: "#FFE699", dark: "#FFE699" },
  sub:   { light: "#997000", dark: "#FFD66B" },
  label: { light: "#B07E00", dark: "#FFD66B" },
  icon:  "⚡",
  name:  "냉매",
  buttonText: "#1A1A1A",
};

const COLORS_DEFAULT = {
  main:  "#FF1B8D",
  box:   { light: "#FFB8D6", dark: "#2D0F1E" },
  sub:   { light: "#C13A78", dark: "#FF8FBE" },
  label: { light: "#FF1B8D", dark: "#FF4DA6" },
  icon:  "🔧",
  name:  "기타",
  buttonText: "#fff",
};

export function getWorkTypeColors(workType) {
  if (!workType) return COLORS_DEFAULT;
  const type = String(workType).toLowerCase();
  if (type.includes("세척")) return COLORS_CLEANING;
  if (type.includes("냉매") || type.includes("충전")) return COLORS_REFRIGERANT;
  return COLORS_DEFAULT;
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

// 작업 종류별 라벨 색 (점·라벨용 — 다크 모드에서 약간 밝아짐)
export function getWorkTypeLabelColor(workType, isDark = isDarkMode()) {
  const c = getWorkTypeColors(workType);
  return isDark ? c.label.dark : c.label.light;
}
