// V14 — PWA 자동 안내 모달
// iOS/Android/인앱 분기 + 50대 친화 + 24시간 dismiss + standalone X
// 로그인 화면 로고(OllitMark) + 검정 #1A1A1A 박스 (브랜드 일관성)

import { useEffect, useState } from "react";
import { OllitMark } from "./OllitMark.jsx";
import { isInAppBrowser, isKakaoInApp, isIOS, isAndroid } from "../lib/kakaoBypass.js";

const STORAGE_KEY = "ollit_pwa_prompt_dismissed_at";
const DISMISS_HOURS = 24;
const SHOW_DELAY_MS = 1500;

function isStandalone() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator && window.navigator.standalone === true) return true;
  return false;
}

function isDismissed() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return false;
    const hoursAgo = (Date.now() - Number(v)) / (1000 * 60 * 60);
    return hoursAgo < DISMISS_HOURS;
  } catch (e) { return false; }
}

function markDismissed() {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
}

function detectMode() {
  // 카톡은 KakaoBypassScreen이 우선 처리 → 카톡 외 인앱은 'inApp'
  if (isInAppBrowser() && !isKakaoInApp()) return "inApp";
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  return "other";
}

export function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [mode] = useState(() => detectMode());

  useEffect(() => {
    if (isStandalone()) return;
    if (isDismissed()) return;
    const t = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    markDismissed();
    setShow(false);
  }

  if (!show) return null;
  if (mode === "other") return null; // PC/기타는 안내 X

  const isInApp = mode === "inApp";

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
        fontFamily: "'Pretendard', -apple-system, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: "28px 22px 20px",
          width: "100%",
          maxWidth: 380,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 48px rgba(0,0,0,0.35)",
        }}
      >
        {/* 헤더 — 로고 + 타이틀 */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            width: 76, height: 76,
            background: "#1A1A1A",
            borderRadius: 18,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
            boxShadow: "0 8px 24px rgba(255,27,141,0.25)",
          }}>
            <OllitMark size={56}/>
          </div>
          <div style={{
            fontSize: 22, fontWeight: 700,
            color: "#1A1A1A", marginBottom: 6,
            letterSpacing: "-0.4px",
          }}>
            올잇 앱 설치
          </div>
          <div style={{
            fontSize: 14, color: "#555", fontWeight: 600,
            lineHeight: 1.5,
          }}>
            {isInApp
              ? "외부 브라우저로 열어주세요"
              : "홈 화면에 추가하면 더 편해요"}
          </div>
        </div>

        {/* 환경별 안내 */}
        {isInApp     && <InAppBrowserGuide/>}
        {mode === "ios"     && <IOSGuide/>}
        {mode === "android" && <AndroidGuide/>}

        {/* 닫기 버튼 (50대 친화 큰 버튼) */}
        <button
          onClick={handleClose}
          style={{
            width: "100%",
            background: "#fff",
            border: "1.5px solid #EFE9E0",
            color: "#555",
            padding: 16,
            borderRadius: 12,
            fontSize: 15, fontWeight: 700,
            cursor: "pointer",
            marginTop: 14,
            fontFamily: "inherit",
          }}
        >
          나중에
        </button>
      </div>
    </div>
  );
}

// 인앱 브라우저 안내 (네이버/FB/Instagram/Line/Daum)
function InAppBrowserGuide() {
  return (
    <div style={{
      background: "#FFF5F5",
      border: "1px solid #FFD5D5",
      borderRadius: 14,
      padding: 16,
      fontSize: 14, color: "#1A1A1A", fontWeight: 600,
    }}>
      <div style={{ marginBottom: 10, fontWeight: 700 }}>
        📲 카톡/네이버 안에서는 설치할 수 없어요
      </div>
      <div style={{ fontSize: 13, color: "#555", fontWeight: 600, lineHeight: 1.7 }}>
        화면 <b>우측 상단 ⋮</b>(또는 ···) 누르고<br/>
        <b style={{ color: "#FF1B8D" }}>"외부 브라우저로 열기"</b> 또는<br/>
        <b style={{ color: "#FF1B8D" }}>"Safari로 열기"</b> 누르세요
      </div>
    </div>
  );
}

// iOS Safari 안내 (1, 2, 3 단계)
function IOSGuide() {
  return (
    <div>
      <Step number={1} title="아래 공유 버튼 누르기">
        <div style={{
          background: "#fff",
          padding: "8px 12px",
          borderRadius: 9,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13, color: "#555", fontWeight: 600,
        }}>
          <span style={{ fontSize: 18 }}>📤</span>
          <span>화면 아래쪽</span>
        </div>
      </Step>

      <Step number={2} title='"홈 화면에 추가" 누르기'>
        <div style={{
          background: "#fff",
          padding: "8px 12px",
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13, color: "#1A1A1A", fontWeight: 600,
        }}>
          <span>홈 화면에 추가</span>
          <span style={{ fontSize: 16 }}>➕</span>
        </div>
      </Step>

      <Step number={3} title="[추가] 누르기" last>
        <div style={{
          background: "#fff",
          padding: "8px 12px",
          borderRadius: 9,
          fontSize: 13, color: "#555", fontWeight: 600,
          textAlign: "center",
        }}>
          홈 화면에 핑크 "올잇" 아이콘 catch
        </div>
      </Step>
    </div>
  );
}

// Android Chrome 안내 (1, 2 단계)
function AndroidGuide() {
  return (
    <div>
      <Step number={1} title="우측 상단 점 3개 누르기">
        <div style={{
          background: "#fff",
          padding: "8px 12px",
          borderRadius: 9,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13, color: "#555", fontWeight: 600,
        }}>
          <span style={{ fontSize: 18 }}>⋮</span>
          <span>화면 우측 상단</span>
        </div>
      </Step>

      <Step number={2} title='"홈 화면에 추가" 누르기' last>
        <div style={{
          background: "#fff",
          padding: "8px 12px",
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13, color: "#1A1A1A", fontWeight: 600,
        }}>
          <span>홈 화면에 추가</span>
          <span style={{ fontSize: 16 }}>➕</span>
        </div>
      </Step>
    </div>
  );
}

// 단계 컴포넌트 (50대 친화 큰 숫자 + 큰 글자)
function Step({ number, title, children, last }) {
  return (
    <div style={{
      background: "#F5F2ED",
      borderRadius: 14,
      padding: 16,
      marginBottom: last ? 0 : 10,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <div style={{
        width: 36, height: 36,
        background: "#FF1B8D",
        color: "#fff",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 17, fontWeight: 700,
        flexShrink: 0,
      }}>
        {number}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700,
          color: "#1A1A1A", marginBottom: 6,
        }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

export default PWAInstallPrompt;
