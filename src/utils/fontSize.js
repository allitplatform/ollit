// 2026-06-04 — 폰트 크기 공용 헬퍼.
//   EngineerMeTab + PrincipalApp InfoTab 둘 다 사용.
//   localStorage 'ollit_font_size' + document.documentElement[data-font-size] 적용.
//   인라인 px가 많은 코드에서도 비례 변경되도록 CSS 변수 zoom (src/index.css 참고).

const STORAGE_KEY = "ollit_font_size";
const VALID = ["small", "medium", "large"];

export function loadFontSize() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (VALID.includes(v)) return v;
  } catch (e) { /* ignore */ }
  return "medium";
}

export function applyFontSize(size) {
  const safe = VALID.includes(size) ? size : "medium";
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-font-size", safe);
  }
  try { localStorage.setItem(STORAGE_KEY, safe); } catch (e) { /* ignore */ }
}

export const FONT_SIZE_OPTIONS = VALID;
