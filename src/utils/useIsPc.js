// PC 반응형 breakpoint 훅 — 1024px 이상이면 PC 셸.
//   PrincipalApp PC 1차에서 도입. 다른 화면에도 재사용 가능.
import { useState, useEffect } from "react";

export const PC_BREAKPOINT_PX = 1024;

export function useIsPc(threshold = PC_BREAKPOINT_PX) {
  const [isPc, setIsPc] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= threshold : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(`(min-width: ${threshold}px)`);
    const handler = (e) => setIsPc(e.matches);
    setIsPc(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [threshold]);
  return isPc;
}

// 2026-06-12 — 임의 min-width 매칭 헬퍼. useIsPc 와 동일 패턴, threshold 자유.
//   AdminApp PC 대시보드 반응형 (1280px 2단↔1단 전환) 등에 사용.
export function useMinWidth(thresholdPx) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= thresholdPx : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(`(min-width: ${thresholdPx}px)`);
    const handler = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [thresholdPx]);
  return matches;
}
