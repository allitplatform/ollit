// Step 6-1 (1단계) — iOS 홈 화면 추가 안내
// iOS Safari + standalone X 일 때 한 번 박음. localStorage에 dismissed 저장.

import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "../utils/pushNotification.js";

const DISMISS_KEY = "ollit_a2hs_dismissed";

export function IOSAddToHomeScreen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = (() => {
      try { return localStorage.getItem(DISMISS_KEY) === "true"; }
      catch (e) { return false; }
    })();
    if (dismissed) return;
    if (!isIOS()) return;
    if (isStandalone()) return;
    // 약간의 지연 후 표시 (페이지 안정화)
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setOpen(false);
  }

  function handleDismissForever() {
    try { localStorage.setItem(DISMISS_KEY, "true"); } catch (e) { /* */ }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 10000,
        padding: "20px 16px calc(20px + env(safe-area-inset-bottom))",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 420,
        background: "#1C1C1E",
        border: "1px solid #2A2A2A",
        borderRadius: 18,
        padding: 22,
        color: "#FAF8F5",
        fontFamily: "'Pretendard', -apple-system, sans-serif",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700,
          marginBottom: 10, letterSpacing: "-0.2px",
        }}>
          📲 홈 화면에 추가
        </div>
        <div style={{
          fontSize: 13, color: "#BBB",
          lineHeight: 1.7, marginBottom: 16,
        }}>
          푸시 알림을 받으려면 홈 화면에 추가가 필요합니다.
          <br/>
          Safari 하단의 <b style={{ color: "#FAF8F5" }}>공유</b> 버튼 →
          <b style={{ color: "#FAF8F5" }}> 홈 화면에 추가</b>를 누른 뒤,
          홈 화면 아이콘으로 다시 열어주세요.
        </div>

        <div style={{
          background: "#0E0E10",
          border: "1px solid #2A2A2A",
          borderRadius: 12, padding: 12,
          fontSize: 12, color: "#999",
          marginBottom: 16, lineHeight: 1.6,
        }}>
          ① Safari 하단 가운데 <b style={{ color: "#FAF8F5" }}>⬆️ 공유</b>
          <br/>
          ② 목록에서 <b style={{ color: "#FAF8F5" }}>홈 화면에 추가</b>
          <br/>
          ③ 우측 상단 <b style={{ color: "#FAF8F5" }}>추가</b>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleDismissForever} style={{
            flex: 1,
            background: "transparent",
            border: "1px solid #2A2A2A",
            color: "#BBB",
            padding: "12px 14px",
            borderRadius: 12,
            fontSize: 13, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            다시 보지 않기
          </button>
          <button onClick={handleClose} style={{
            flex: 1,
            background: "#FF1B8D",
            border: "none",
            color: "#fff",
            padding: "12px 14px",
            borderRadius: 12,
            fontSize: 13, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export default IOSAddToHomeScreen;
