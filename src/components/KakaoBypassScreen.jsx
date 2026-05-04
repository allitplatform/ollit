// V14 — 카톡 인앱 브라우저 안내 화면
// 자동 우회 실패 시 표시 / 주소 복사 + 다시 시도 / 50대 친화

import { useState } from "react";
import { tryBypassKakao, isIOS, isAndroid } from "../lib/kakaoBypass.js";

export function KakaoBypassScreen() {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const ios = isIOS();
  const android = isAndroid();

  function handleCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  }

  function handleRetry() {
    tryBypassKakao();
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 24px 40px",
      textAlign: "center",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* ∞ 다크 박스 아이콘 */}
      <svg width="120" height="120" viewBox="0 0 100 100" style={{ marginBottom: 22 }}>
        <rect width="100" height="100" rx="20" fill="#1A1512"/>
        <circle cx="27" cy="50" r="23" fill="none" stroke="#FF1B8D" strokeWidth="6"/>
        <circle cx="73" cy="50" r="23" fill="none" stroke="#FF1B8D" strokeWidth="6"/>
        <circle cx="50" cy="50" r="10" fill="#FF1B8D"/>
      </svg>

      <div style={{
        fontSize: 24, fontWeight: 800, marginBottom: 10,
        letterSpacing: -0.5,
      }}>
        외부 브라우저로 열어 주세요
      </div>
      <div style={{
        fontSize: 16, color: "var(--text-secondary)",
        lineHeight: 1.6, marginBottom: 28,
        maxWidth: 320,
      }}>
        카카오톡 안에서는<br/>
        올잇이 정상 동작하지 않습니다.<br/>
        <strong style={{ color: "var(--text-primary)" }}>{ios ? "Safari" : android ? "Chrome" : "외부 브라우저"}</strong>로 열어 주세요.
      </div>

      {/* 안내 카드 */}
      <div style={{
        width: "100%", maxWidth: 360,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        textAlign: "left",
        marginBottom: 18,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 800,
          color: "var(--text-secondary)",
          letterSpacing: 0.3,
          textTransform: "uppercase",
          marginBottom: 12,
        }}>
          {ios ? "아이폰 (Safari)" : android ? "안드로이드 (Chrome)" : "외부 브라우저"}
        </div>
        <Step num="1" text={<>아래 <Bold>"외부 브라우저로 열기"</Bold> 누르기</>}/>
        <Step num="2" text={<>안 열리면 <Bold>주소 복사</Bold> 후 직접 붙여넣기</>}/>
      </div>

      {/* 메인 액션 — 다시 시도 */}
      <button onClick={handleRetry} style={{
        width: "100%", maxWidth: 360,
        padding: 18,
        background: "#FF1B8D", border: "none",
        borderRadius: 12, color: "#fff",
        fontSize: 17, fontWeight: 800,
        cursor: "pointer", fontFamily: "inherit",
        marginBottom: 8,
      }}>
        ↗️ 외부 브라우저로 열기
      </button>

      {/* 보조 액션 — 주소 복사 */}
      <button onClick={handleCopy} style={{
        width: "100%", maxWidth: 360,
        padding: 16,
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 12,
        color: "var(--text-primary)",
        fontSize: 15, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        {copied ? "✓ 복사됨" : "📋 주소 복사"}
      </button>

      {/* URL 미리보기 */}
      <div style={{
        marginTop: 16, padding: "10px 14px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 12, color: "var(--text-secondary)",
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        maxWidth: 360, width: "100%",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {url}
      </div>
    </div>
  );
}

function Step({ num, text }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      gap: 12, marginBottom: 10,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "#FF1B8D",
        color: "#fff",
        fontSize: 14, fontWeight: 800,
        display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {num}
      </span>
      <span style={{
        fontSize: 15, color: "var(--text-primary)",
        fontWeight: 600, lineHeight: 1.5,
      }}>
        {text}
      </span>
    </div>
  );
}

function Bold({ children }) {
  return <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{children}</span>;
}

export default KakaoBypassScreen;
