// Step 8+9 V4 — 테마 CSS 변수
// 다크/라이트 토글 시 document.documentElement에 CSS 변수 적용
// 컴포넌트는 var(--name) 사용

export const DARK_THEME = {
  "--bg-primary":       "#1A1512",
  "--bg-secondary":     "#221C18",
  "--bg-tertiary":      "#2A2420",
  "--bg-quaternary":    "#322A24",
  "--bg-inset":         "#0F0B0A",
  "--border-strong":    "#3A322C",
  "--text-primary":     "#FAF8F5",
  "--text-secondary":   "#888780",
  "--text-tertiary":    "#555",
  "--accent":           "#FF1B8D",
  "--accent-bg":        "rgba(255,27,141,0.10)",
  "--border":           "#2A2420",
  "--input-bg":         "#221C18",
  // V13-FINAL2-fix3 — 작업 종류 색
  "--work-clean":       "#00BCD4",
  "--work-refrig":      "#FFB300",
  "--work-install":     "#888888",
  "--work-disabled":    "#888888",
  // V12-2 — 색 시스템 통일 (밝게)
  "--success":          "#00875A",
  "--success-bg":       "rgba(0,135,90,0.12)",
  "--warning":          "#FF8F00",
  "--danger":           "#FF3D5A",
  // status alias
  "--status-success":   "#00875A",
  "--status-warning":   "#FF8F00",
  "--status-info":      "#00BCD4",
  "--status-danger":    "#FF3D5A",
  "--accent-soft":      "rgba(255,27,141,0.10)",
  // V12-2 — 작업 종류 색
  "--service-cleaning":    "#00BCD4",
  "--service-refrigerant": "#FFB300",
  "--service-visit":       "#888888",
  "--service-extra":       "#FF8F00",
  // 기사 직급 색깔 (V11-11 — 핑크 단순화: 베테랑만 강조)
  "--engineer-rookie":  "#888780",
  "--engineer-career":  "#888780",
  "--engineer-expert":  "#FF1B8D",
  // V11-8 — 유솔 N 전용 (다크)
  "--usol-n-content-bg":      "#221C18",
  "--usol-n-card-bg":         "#2A2420",
  "--usol-n-border":          "#3A322C",
  "--usol-n-shadow":          "none",
  "--usol-n-shadow-hover":    "0 4px 12px rgba(0,0,0,0.3)",
  "--usol-n-highlight-shadow":"0 4px 12px rgba(3,199,90,0.20)",
};

export const LIGHT_THEME = {
  // V13-FINAL2-fix5 — 거의 백색 페이지 + 흰 카드 + 진한 보더
  "--bg-primary":       "#FAFAFA",
  "--bg-secondary":     "#FFFFFF",
  "--bg-tertiary":      "#FFFFFF",
  "--bg-quaternary":    "#F0F0F0",
  "--bg-inset":         "#F0F0F0",
  "--input-bg":         "#FFFFFF",
  "--text-primary":     "#1A1512",
  "--text-secondary":   "#6E6E6E",
  "--text-tertiary":    "#9B9892",
  "--accent":           "#FF1B8D",
  "--accent-bg":        "rgba(255,27,141,0.06)",
  "--border":           "rgba(0,0,0,0.10)",
  "--border-strong":    "rgba(0,0,0,0.18)",
  // V13-FINAL2-fix4 — 작업 종류 색 (라이트 — 진한 톤)
  "--work-clean":       "#0097A7",
  "--work-refrig":      "#F57C00",
  "--work-install":     "#888888",
  "--work-disabled":    "#888888",
  // V12-2 — 색 시스템 통일 (라이트와 다크 동일 / 밝게)
  "--success":          "#00875A",
  "--success-bg":       "rgba(0,135,90,0.08)",
  "--warning":          "#FF8F00",
  "--danger":           "#FF3D5A",
  "--status-success":   "#00875A",
  "--status-warning":   "#FF8F00",
  "--status-info":      "#00BCD4",
  "--status-danger":    "#FF3D5A",
  "--accent-soft":      "rgba(255,27,141,0.08)",
  // V12-2 — 작업 종류 색
  "--service-cleaning":    "#00BCD4",
  "--service-refrigerant": "#FFB300",
  "--service-visit":       "#555555",
  "--service-extra":       "#FF8F00",
  // 기사 직급 (V11-11 — 핑크 단순화)
  "--engineer-rookie":  "#999",
  "--engineer-career":  "#666",
  "--engineer-expert":  "#FF1B8D",
  // V11-8 — 유솔 N 전용 (라이트)
  "--usol-n-content-bg":      "#FAF8F5",
  "--usol-n-card-bg":         "#FFFFFF",
  "--usol-n-border":          "#EBE7DF",
  "--usol-n-shadow":          "0 1px 3px rgba(0,0,0,0.04)",
  "--usol-n-shadow-hover":    "0 4px 8px rgba(0,0,0,0.08)",
  "--usol-n-highlight-shadow":"0 4px 12px rgba(3,199,90,0.12)",
};

// 테마 적용 — CSS 변수 + body 배경 + colorScheme + storage
export function applyTheme(theme) {
  const colors = theme === "light" ? LIGHT_THEME : DARK_THEME;
  Object.entries(colors).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.body.style.background = colors["--bg-primary"];
  document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("ollit_theme", theme); } catch (e) {}
}

export function loadTheme() {
  try { return localStorage.getItem("ollit_theme") || "dark"; }
  catch (e) { return "dark"; }
}
