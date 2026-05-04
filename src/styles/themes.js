// V14 — 색 시스템 통합 (2026-05-04)
// 메인 8색: 핫핑크 / 네이버그린 / 시안블루(세척) / 노랑(냉매) / 주황 / 빨강 / 통화초록 / 보라
// 다크/라이트 토글 시 document.documentElement에 CSS 변수 적용. 컴포넌트는 var(--name) 사용.

export const DARK_THEME = {
  // ── 베이스 (V14 정제 매핑표)
  "--bg-primary":       "#0A0A0A",
  "--bg-secondary":     "#1C1C1E",
  "--bg-tertiary":      "#2A2420",
  "--bg-quaternary":    "#322A24",
  "--bg-inset":         "#0F0B0A",
  "--text-primary":     "#FAF8F5",
  "--text-secondary":   "#B0B0B0",
  "--text-tertiary":    "#888",
  "--border":           "rgba(255,255,255,0.10)",
  "--border-strong":    "rgba(255,255,255,0.18)",
  "--input-bg":         "#1C1C1E",
  "--input-border":     "#3A3A3A",

  // ── 메인 8색 (V14 / 라이트·다크 동일)
  "--accent":           "#FF1B8D",   // 핫핑크 — 메인/진행중/CTA
  "--accent-bg":        "rgba(255,27,141,0.10)",
  "--accent-soft":      "rgba(255,27,141,0.10)",
  "--naver-green":      "#03C75A",   // 유솔N
  "--service-cleaning": "#0EA5E9",   // ❄️ 세척 — 시원한 파랑
  "--service-refrigerant": "#FFB800",// ⚡ 냉매충전 — 노랑
  "--orange":           "#FF8A3D",   // 정산/회사송금/일정변경
  "--danger":           "#FF3B5C",   // 비상/취소/미입금/수수료
  "--call-green":       "#34C759",   // 통화 (아이폰 표준)
  "--ops-purple":       "#7B61FF",   // 운영팀 메모

  // ── 작업 종류 alias (legacy 호환)
  "--work-clean":       "#0EA5E9",
  "--work-refrig":      "#FFB800",
  "--work-install":     "#888888",
  "--work-disabled":    "#888888",
  "--service-visit":    "#888888",
  "--service-extra":    "#FF8A3D",

  // ── 상태/유틸 alias
  "--success":          "#03C75A",
  "--success-bg":       "rgba(3,199,90,0.12)",
  "--warning":          "#FFB800",
  "--status-success":   "#03C75A",
  "--status-warning":   "#FFB800",
  "--status-info":      "#0EA5E9",
  "--status-danger":    "#FF3B5C",

  // ── 기사 직급 (legacy)
  "--engineer-rookie":  "#888780",
  "--engineer-career":  "#888780",
  "--engineer-expert":  "#FF1B8D",

  // ── 유솔N 전용 (다크) — V14 단색
  "--usol-n-content-bg":      "#221C18",
  "--usol-n-card-bg":         "#2A2420",
  "--usol-n-border":          "#3A322C",
  "--usol-n-shadow":          "none",
  "--usol-n-shadow-hover":    "none",
  "--usol-n-highlight-shadow":"none",

  // ── V14 정제 (배너 / progress / 카드 / 텍스트 톤)
  "--card-bg":              "#1C1C1E",
  "--card-arrow":           "#555555",
  "--banner-yellow-bg":     "#FFE699",
  "--banner-yellow-text":   "#FFD66B",
  "--banner-pink-bg":       "#FFB8D6",
  "--banner-pink-text":     "#FF8FBE",
  "--refrig-text":          "#FFD66B",
  "--cleaning-text":        "#38BDF8",
  "--progress-bg":          "rgba(255,255,255,0.08)",
  // ── V14 새 배정 화면
  "--request-bg":           "#2A2010",   // 노랑 요청사항 박스
  "--request-text":         "#FFD66B",
  "--request-sub":          "#FFC04D",
  "--time-summary-bg":      "#2D0F1E",
  "--time-summary-accent":  "#FF4DA6",
  "--accent-strong":        "#FF4DA6",   // 다크 핫핑크 강조
  "--cancel-text":          "#FF6B85",
  "--ops-text":             "#9B85FF",
  "--ops-memo-bg":          "#1F1B33",
  "--ops-memo-header":      "#B8A6FF",
  "--ops-memo-body":        "#9B85FF",
  "--extra-fee-bg":         "#2D1F0F",
  "--extra-fee-border":     "#5C3D00",
  "--extra-fee-header":     "#FFB07A",
  "--extra-fee-text":       "#FFB07A",
};

export const LIGHT_THEME = {
  // ── 베이스 (V14 정제 매핑표)
  "--bg-primary":       "#F5F2ED",
  "--bg-secondary":     "#FFFFFF",
  "--bg-tertiary":      "#FFFFFF",
  "--bg-quaternary":    "#F0F0F0",
  "--bg-inset":         "#F5F5F5",
  "--text-primary":     "#1A1A1A",
  "--text-secondary":   "#666666",
  "--text-tertiary":    "#888",
  "--border":           "rgba(0,0,0,0.10)",
  "--border-strong":    "rgba(0,0,0,0.18)",
  "--input-bg":         "#FFFFFF",
  "--input-border":     "#E5E0D6",

  // ── 메인 8색 (V14 / 라이트·다크 동일)
  "--accent":           "#FF1B8D",
  "--accent-bg":        "rgba(255,27,141,0.06)",
  "--accent-soft":      "rgba(255,27,141,0.06)",
  "--naver-green":      "#03C75A",
  "--service-cleaning": "#0EA5E9",
  "--service-refrigerant": "#FFB800",
  "--orange":           "#FF8A3D",
  "--danger":           "#FF3B5C",
  "--call-green":       "#34C759",
  "--ops-purple":       "#7B61FF",

  // ── 작업 종류 alias (legacy 호환)
  "--work-clean":       "#0EA5E9",
  "--work-refrig":      "#FFB800",
  "--work-install":     "#888888",
  "--work-disabled":    "#888888",
  "--service-visit":    "#555555",
  "--service-extra":    "#FF8A3D",

  // ── 상태/유틸 alias
  "--success":          "#03C75A",
  "--success-bg":       "rgba(3,199,90,0.08)",
  "--warning":          "#FFB800",
  "--status-success":   "#03C75A",
  "--status-warning":   "#FFB800",
  "--status-info":      "#0EA5E9",
  "--status-danger":    "#FF3B5C",

  // ── 기사 직급 (legacy)
  "--engineer-rookie":  "#999",
  "--engineer-career":  "#666",
  "--engineer-expert":  "#FF1B8D",

  // ── 유솔N 전용 (라이트) — V14 단색
  "--usol-n-content-bg":      "#FAFAFA",
  "--usol-n-card-bg":         "#FFFFFF",
  "--usol-n-border":          "rgba(0,0,0,0.10)",
  "--usol-n-shadow":          "none",
  "--usol-n-shadow-hover":    "none",
  "--usol-n-highlight-shadow":"none",

  // ── V14 정제 (배너 / progress / 카드 / 텍스트 톤)
  "--card-bg":              "#FFFFFF",
  "--card-arrow":           "#C8C8C8",
  "--banner-yellow-bg":     "#FFE699",
  "--banner-yellow-text":   "#997000",
  "--banner-pink-bg":       "#FFB8D6",
  "--banner-pink-text":     "#C13A78",
  "--refrig-text":          "#B07E00",
  "--cleaning-text":        "#0EA5E9",
  "--progress-bg":          "#F2F2F2",
  // ── V14 새 배정 화면
  "--request-bg":           "#FFF7E0",   // 노랑 요청사항 박스
  "--request-text":         "#7A4F00",
  "--request-sub":          "#997000",
  "--time-summary-bg":      "#FFF5FA",
  "--time-summary-accent":  "#FF1B8D",
  "--accent-strong":        "#FF1B8D",
  "--cancel-text":          "#FF3B5C",
  "--ops-text":             "#7B61FF",
  "--ops-memo-bg":          "#F0EDFF",
  "--ops-memo-header":      "#4A3AAB",
  "--ops-memo-body":        "#5E4DCB",
  "--extra-fee-bg":         "#FFF3E5",
  "--extra-fee-border":     "#FFCC99",
  "--extra-fee-header":     "#7A3D00",
  "--extra-fee-text":       "#C25E00",
};

// V14 — 화면 모드 (light / dark / auto)
// auto = 시스템 prefers-color-scheme 따라감, matchMedia로 변경 자동 감지

let autoListener = null;

function getSystemPref() {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyResolved(resolvedTheme) {
  const colors = resolvedTheme === "light" ? LIGHT_THEME : DARK_THEME;
  Object.entries(colors).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.body.style.background = colors["--bg-primary"];
  document.documentElement.style.colorScheme = resolvedTheme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = resolvedTheme;
}

// 테마 적용 — CSS 변수 + body 배경 + colorScheme + storage + 시스템 변경 감지
export function applyTheme(theme) {
  // 옛 listener 해제
  if (autoListener && typeof window !== "undefined" && window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").removeEventListener("change", autoListener);
    autoListener = null;
  }

  if (theme === "auto") {
    applyResolved(getSystemPref());
    if (typeof window !== "undefined" && window.matchMedia) {
      autoListener = (e) => applyResolved(e.matches ? "light" : "dark");
      window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", autoListener);
    }
  } else {
    applyResolved(theme === "light" ? "light" : "dark");
  }

  try { localStorage.setItem("ollit_theme", theme); } catch (e) {}
}

export function loadTheme() {
  try {
    const v = localStorage.getItem("ollit_theme");
    if (v === "light" || v === "dark" || v === "auto") return v;
    return "dark";
  } catch (e) { return "dark"; }
}
