import { useEffect } from "react";
import { OllitMark } from "./OllitMark.jsx";

// 앱 첫 렌더 1.5초 — 올잇 + 펄스
export function SplashScreen({ onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      backgroundColor: "#1A1512",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
      zIndex: 9999,
    }}>
      <OllitMark size={64}/>
      <div style={{ color: "#fff", fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
        올잇
      </div>
      <div style={{ color: "#888780", fontSize: 12 }}>
        현장과 사람을 잇는 운영 플랫폼
      </div>
    </div>
  );
}

export default SplashScreen;
