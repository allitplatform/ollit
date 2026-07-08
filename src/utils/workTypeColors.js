// V14 — 작업 종류별 색 시스템 (전역 헬퍼)
// 세척 = 파랑 / 냉매 = 노랑 / 설치 = 보라 / 누설 = 빨강 / 그 외 = 핑크 fallback
// label = 텍스트 라벨 색 (다크 라이트 분리) / box = 옅은 박스 / sub = 부가 글자
// buttonText = 채우기 버튼 위 글자 색 (냉매 노랑 위는 검정)

import { getServiceKind } from "./workTypeKind.js";

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

// 2026-06-28 — 설치 색 (보라 톤). Mig 124/125 활성화 후 표시 라벨 누락 사고 보완.
const COLORS_INSTALL = {
  main:  "#8B5CF6",
  box:   { light: "#DDD6FE", dark: "#2D1B4E" },
  sub:   { light: "#6D28D9", dark: "#A78BFA" },
  label: { light: "#7C3AED", dark: "#A78BFA" },
  icon:  "🔧",
  name:  "설치",
  buttonText: "#fff",
};

// 2026-06-28 — 누설 색 (빨강 톤). Mig 122 누설=냉매동일정산 활성화 보완.
// 2026-07-08 — name 은 표시 라벨. 매칭 키 (getServiceKind → 'leak') 무손.
const COLORS_LEAK = {
  main:  "#DC2626",
  box:   { light: "#FECACA", dark: "#3F1212" },
  sub:   { light: "#991B1B", dark: "#F87171" },
  label: { light: "#DC2626", dark: "#F87171" },
  icon:  "💧",
  name:  "누설/누수",
  buttonText: "#fff",
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

// 2026-06-28 — getServiceKind 사용 (workType 문자열 + workItem 객체 모두 catch).
//   서비스 kind 기반 분기 — 5종 (신규설치/이전설치/철거/실외기중고교체/기계중고교체) 도
//   _kindFromWorkType 직접 매칭으로 install kind 반환 → COLORS_INSTALL.
export function getWorkTypeColors(workType) {
  if (!workType) return COLORS_DEFAULT;
  const kind = getServiceKind(workType);
  if (kind === "cleaning")    return COLORS_CLEANING;
  if (kind === "refrigerant") return COLORS_REFRIGERANT;
  if (kind === "install")     return COLORS_INSTALL;
  if (kind === "leak")        return COLORS_LEAK;
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
