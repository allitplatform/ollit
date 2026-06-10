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
