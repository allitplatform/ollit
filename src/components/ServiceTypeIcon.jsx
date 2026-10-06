// src/components/ServiceTypeIcon.jsx
// theme context / CSS variable 의존 없는 강제 인라인 버전

import { useEffect, useState } from "react";
import { getServiceKind, leakDisplayLabel, isHoodWork } from "../utils/workTypeKind.js";
import { getCategoryMeta } from "../lib/serviceCatalog.js";

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
  if (kind === "leak")        return leakDisplayLabel(workType);
  if (isHoodWork(workType))   return "주방후드";
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
  // 2026-10-06 — 색·아이콘은 종목 기준표에서 (에어컨 ❄ / 주방후드 🔥 …). 이름은 작업 종류 그대로.
  void mode;
  const cat = getCategoryMeta(workType);
  const color = isActive ? cat.color : "#888888";

  const labelMap = { "냉매충전": "냉매" };
  const label = labelMap[baseType] || baseType;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
    }}>
      <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1, opacity: isActive ? 1 : 0.5 }}>{cat.icon}</span>
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

export { ServiceTypeIcon };
export default ServiceTypeIcon;
