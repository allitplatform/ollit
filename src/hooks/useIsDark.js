// V14 — 다크 모드 감지 hook (다크/라이트 토글 시 즉시 재렌더)
import { useEffect, useState } from "react";

function detect() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dark";
}

export function useIsDark() {
  const [isDark, setIsDark] = useState(() => detect());
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(detect()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);
  return isDark;
}
