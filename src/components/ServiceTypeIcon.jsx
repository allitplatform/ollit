// src/components/ServiceTypeIcon.jsx
// theme context / CSS variable 의존 없는 강제 인라인 버전

import { useEffect, useState } from "react";
import { getServiceKind } from "../utils/workTypeKind.js";

// V14 — 라이트·다크 동일 색 (시안 파랑 + 노랑)
const COLOR_MAP = {
  light: {
    "세척":     "#0EA5E9",   // 시원한 파랑 (V14)
    "냉매충전": "#FFB800",   // 노랑 (V14)
    "설치":     "#888888",
    "누설":     "#888888",
    "점검":     "#888888",
    "수리":     "#888888",
  },
  dark: {
    "세척":     "#0EA5E9",
    "냉매충전": "#FFB800",
    "설치":     "#888888",
    "누설":     "#888888",
    "점검":     "#888888",
    "수리":     "#888888",
  },
};

// 테마 모드 가져오기 (document에서 직접 읽음 / context 의존 X)
function getThemeMode() {
  if (typeof document === "undefined") return "dark";

  // 1. data-theme 속성 (가장 흔한 방법)
  const dataTheme = document.documentElement.dataset.theme;
  if (dataTheme === "light" || dataTheme === "dark") return dataTheme;

  // 2. class 이름 (대안)
  if (document.documentElement.classList.contains("light")) return "light";
  if (document.documentElement.classList.contains("dark")) return "dark";

  // 3. body 배경색 (마지막 수단)
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  // 어두운 배경이면 dark
  if (bodyBg.includes("rgb(26") || bodyBg.includes("rgb(34") || bodyBg.includes("rgb(0"))
    return "dark";

  return "light";  // 기본 라이트
}

// 2026-05-26 C-1 — workType 정규화 (getServiceKind 측 catch + 옛 split 측 catch).
//   getServiceKind 측 catch 측 catch case ("세척_1way", "냉매점검(서울 경기북부만 가능)" 측) 측 catch.
//   설치/누설/점검/수리 측 catch — 옛 split 측 catch fallback.
function _baseType(workType) {
  const kind = getServiceKind(workType);
  if (kind === "cleaning")    return "세척";
  if (kind === "refrigerant") return "냉매충전";
  if (kind === "install")     return "설치";
  // 2026-07-08 — 표시 라벨만 '누설/누수' (kind='leak' 매칭·저장 무손).
  if (kind === "leak")        return "누설/누수";
  // 측 catch (점검/수리 등) — 옛 split fallback
  const s = String(workType || "").trim();
  if (!s) return "";
  const idx = s.indexOf("_");
  return idx > 0 ? s.slice(0, idx) : s;
}

function ServiceTypeIcon({ workType, count = null, size = 14, showLabel = true }) {
  const [mode, setMode] = useState(getThemeMode());

  // 테마 변경 감지 (DOM 속성 변화)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMode(getThemeMode());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => observer.disconnect();
  }, []);

  const baseType = _baseType(workType);
  const isActive = count === null || count > 0;
  const colors = COLOR_MAP[mode] || COLOR_MAP.light;
  const color = isActive ? (colors[baseType] || "#888888") : "#888888";

  const labelMap = { "냉매충전": "냉매" };
  const label = labelMap[baseType] || baseType;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
    }}>
      <SvgByType workType={baseType} size={size} color={color}/>
      {showLabel && (
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: color,
        }}>
          {label}
        </span>
      )}
    </span>
  );
}

// SVG 그리기
function SvgByType({ workType, size, color }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    style: { display: "block" },
  };

  if (workType === "세척") {
    return (
      <svg {...props} fill="none" stroke={color} strokeWidth="3"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5l-5 5-5-5M17 19l-5-5-5 5M2 12h20M5 7l5 5-5 5M19 7l-5 5 5 5"/>
      </svg>
    );
  }

  if (workType === "냉매충전") {
    return (
      <svg {...props} fill={color} stroke={color} strokeWidth="2"
           strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    );
  }

  if (workType === "설치") {
    return (
      <svg {...props} fill="none" stroke={color} strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    );
  }

  if (workType === "누설") {
    return (
      <svg {...props} fill="none" stroke={color} strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    );
  }

  if (workType === "점검") {
    return (
      <svg {...props} fill="none" stroke={color} strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    );
  }

  if (workType === "수리") {
    return (
      <svg {...props} fill="none" stroke={color} strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    );
  }

  return null;
}

export { ServiceTypeIcon };
export default ServiceTypeIcon;
