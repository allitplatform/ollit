// 넓은 PC 반응형 breakpoint 훅 — 1280px 이상 (PC 안 더 넓은 분기).
//   useIsPc 패턴 동일 (matchMedia + addEventListener).
//   사용처: 원청 PC 내 작업 표 측 지역 컬럼 = 도로명 전체 주소 표시.
import { useState, useEffect } from "react";

export const WIDE_BREAKPOINT_PX = 1280;

export function useIsWide(threshold = WIDE_BREAKPOINT_PX) {
  const [isWide, setIsWide] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= threshold : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(`(min-width: ${threshold}px)`);
    const handler = (e) => setIsWide(e.matches);
    setIsWide(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [threshold]);
  return isWide;
}
