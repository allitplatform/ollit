// V14 — 내 정보 탭 (사장님 spec 마지막 화면)
// 5섹션: 프로필 카드 / 운영팀 문의 / 설정 / 정보 / 로그아웃
// 다크모드 + 글자 크기 = 전역 적용 / 통계 X / 비밀번호 변경 = 다음 단계

import { useState, useEffect } from "react";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { useIsDark } from "../hooks/useIsDark.js";

const APP_VERSION = "v1.0 · Phase 1A";
const FONT_SCALE = { small: 0.9, medium: 1.0, large: 1.1 };

// V14 — 카카오 채널 URL (사장님 채널 받으면 박는다)
const KAKAO_CHANNEL_URL = ""; // ⚠️ 사장님 카톡 채널/오픈채팅 URL

function loadFontSize() {
  try {
    const v = localStorage.getItem("ollit_font_size");
    if (v === "small" || v === "medium" || v === "large") return v;
  } catch (e) {}
  return "medium";
}

function applyFontSize(size) {
  const scale = FONT_SCALE[size] || 1.0;
  if (typeof document !== "undefined") {
    document.documentElement.style.fontSize = `${16 * scale}px`;
  }
  try { localStorage.setItem("ollit_font_size", size); } catch (e) {}
}

function loadPush() {
  try {
    const v = localStorage.getItem("ollit_push");
    if (v === "false") return false;
  } catch (e) {}
  return true;
}

export function EngineerMeTab({
  engineer,
  theme = "dark",
  onChangeTheme,
  onContactOps,
  onMessageOps,
  onChangePassword,
  onLogout,
  onTabChange,
  unreadCount = 0,
}) {
  const isDark = useIsDark();
  const eng = engineer || {};

  // 사장님 spec 다크 토글 = 이진 (light/dark). 'auto'는 토글에서 제외.
  const darkOn = theme === "dark" || (theme === "auto" && isDark);
  const [push, setPush] = useState(() => loadPush());
  const [fontSize, setFontSize] = useState(() => loadFontSize());

  useEffect(() => { applyFontSize(fontSize); }, [fontSize]);

  function handleDarkToggle(value) {
    if (onChangeTheme) onChangeTheme(value ? "dark" : "light");
  }

  function handlePushToggle(value) {
    setPush(value);
    try { localStorage.setItem("ollit_push", String(value)); } catch (e) {}
  }

  function handleLogoutClick() {
    if (typeof window !== "undefined" && window.confirm("로그아웃 하시겠습니까?")) {
      onLogout && onLogout();
    }
  }

  function handleHelp()    { alert("도움말은 다음 단계에서 추가됩니다."); }
  function handleTerms()   { alert("이용약관은 다음 단계에서 추가됩니다."); }
  function handlePassword(){ if (onChangePassword) onChangePassword(); else alert("비밀번호 변경은 다음 단계에서 추가됩니다."); }
  function handleKakao()   {
    if (KAKAO_CHANNEL_URL) {
      window.open(KAKAO_CHANNEL_URL, "_blank");
    } else {
      alert("카톡 채널 준비 중입니다. 운영팀에 전화 부탁드립니다.");
    }
  }

  // 카드 공통 스타일
  const cardStyle = {
    background: isDark ? "#1C1C1E" : "#FFFFFF",
    border: `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
    borderRadius: 18,
    marginBottom: 14,
  };

  const initial = (eng.name || "?").charAt(0);
  const role = eng.role || "기사";
  const company = eng.companyName || eng.company || "올데이케어";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      paddingBottom: 80,
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px" }}>
          👤 내 정보
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* 프로필 카드 */}
        <div style={{
          ...cardStyle,
          padding: "22px 18px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: "50%",
            background: "#FFB8D6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 28, color: "#FF1B8D", fontWeight: 700 }}>
              {initial}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 20, fontWeight: 700,
              color: isDark ? "#FAF8F5" : "#1A1A1A",
              letterSpacing: "-0.3px",
              marginBottom: 4,
            }}>
              {eng.name || "—"}
            </div>
            <div style={{
              fontSize: 13,
              color: isDark ? "#C8C8C8" : "#555",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}>
              <span style={{
                background: isDark ? "#2D0F1E" : "#FFE5F2",
                color: isDark ? "#FF4DA6" : "#FF1B8D",
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 700,
              }}>
                {role}
              </span>
              <span>{company}</span>
            </div>
          </div>
        </div>

        {/* 운영팀 문의 카드 */}
        <div style={{ ...cardStyle, padding: "16px 18px" }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: isDark ? "#FAF8F5" : "#1A1A1A",
            marginBottom: 14,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            💬 운영팀 문의
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={onContactOps} style={{
              background: "#34C759",
              color: "#fff",
              border: "none",
              padding: 14,
              borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              📞 전화
            </button>
            <button onClick={handleKakao} style={{
              background: "#FEE500",
              border: "none",
              color: "#191919",
              padding: 14,
              borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <span style={{ fontSize: 16 }}>💛</span> 카톡 문의
            </button>
          </div>
        </div>

        {/* 설정 카드 */}
        <div style={{ ...cardStyle, padding: "6px 0" }}>
          <SectionHeader isDark={isDark}>설정</SectionHeader>
          <SettingRow icon="🌙" label="다크 모드" isDark={isDark}
            rightSlot={<Toggle on={darkOn} onChange={handleDarkToggle}/>}/>
          <SettingRow icon="🔔" label="푸시 알림" isDark={isDark}
            rightSlot={<Toggle on={push} onChange={handlePushToggle}/>}/>
          <SettingRow icon="🔠" label="글자 크기" isDark={isDark}
            rightSlot={
              <div style={{ display: "flex", gap: 4 }}>
                <FontSizeButton label="작게" size="small"  current={fontSize} onChange={setFontSize} isDark={isDark}/>
                <FontSizeButton label="기본" size="medium" current={fontSize} onChange={setFontSize} isDark={isDark}/>
                <FontSizeButton label="크게" size="large"  current={fontSize} onChange={setFontSize} isDark={isDark}/>
              </div>
            }/>
          <SettingRow icon="🔒" label="비밀번호 변경" isDark={isDark} onClick={handlePassword}
            rightSlot={<Chevron isDark={isDark}/>} isLast/>
        </div>

        {/* 정보 카드 */}
        <div style={{ ...cardStyle, padding: "6px 0" }}>
          <SectionHeader isDark={isDark}>정보</SectionHeader>
          <SettingRow icon="📖" label="도움말"   isDark={isDark} onClick={handleHelp}
            rightSlot={<Chevron isDark={isDark}/>}/>
          <SettingRow icon="📜" label="이용 약관" isDark={isDark} onClick={handleTerms}
            rightSlot={<Chevron isDark={isDark}/>}/>
          <SettingRow icon="ℹ️" label="버전" isDark={isDark}
            rightSlot={
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: isDark ? "#999" : "#6B6359",
              }}>
                {APP_VERSION}
              </span>
            } isLast/>
        </div>

        {/* 로그아웃 */}
        <button onClick={handleLogoutClick} style={{
          width: "100%",
          background: isDark ? "transparent" : "#FFFFFF",
          border: "1.5px solid #FF3B5C",
          color: isDark ? "#FF6B85" : "#FF3B5C",
          padding: 16,
          borderRadius: 14,
          fontSize: 15, fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          marginTop: 4,
        }}>
          🚪 로그아웃
        </button>
      </div>

      <EngineerBottomNav active="me" onChange={onTabChange} unreadCount={unreadCount}/>
    </div>
  );
}

function SectionHeader({ isDark, children }) {
  return (
    <div style={{
      fontSize: 11,
      color: isDark ? "#999" : "#6B6359",
      fontWeight: 700,
      letterSpacing: 0.3,
      padding: "12px 18px 6px",
    }}>
      {children}
    </div>
  );
}

function SettingRow({ icon, label, rightSlot, onClick, isLast, isDark }) {
  return (
    <div onClick={onClick} style={{
      padding: "14px 18px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: isLast ? "none" : `0.5px solid ${isDark ? "#2A2A2A" : "#F5F2ED"}`,
      cursor: onClick ? "pointer" : "default",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{
          fontSize: 14,
          color: isDark ? "#FAF8F5" : "#1A1A1A",
          fontWeight: 600,
        }}>
          {label}
        </span>
      </div>
      <div style={{ flexShrink: 0 }}>{rightSlot}</div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 44, height: 26,
      background: on ? "#FF1B8D" : "#E5E0D6",
      borderRadius: 999,
      padding: 2,
      display: "flex",
      justifyContent: on ? "flex-end" : "flex-start",
      boxSizing: "border-box",
      cursor: "pointer",
      transition: "background 0.2s",
    }}>
      <div style={{
        width: 22, height: 22,
        background: "#fff",
        borderRadius: "50%",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }}/>
    </div>
  );
}

function FontSizeButton({ label, size, current, onChange, isDark }) {
  const isActive = current === size;
  const fontSize = size === "small" ? 12 : size === "large" ? 14 : 13;
  return (
    <button onClick={() => onChange(size)} style={{
      background: isActive ? "#FF1B8D" : (isDark ? "transparent" : "#fff"),
      border: isActive ? "1px solid #FF1B8D" : `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
      color: isActive ? "#fff" : (isDark ? "#999" : "#555"),
      padding: "5px 11px",
      borderRadius: 8,
      fontSize: fontSize,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
    }}>
      {label}
    </button>
  );
}

function Chevron({ isDark }) {
  return (
    <span style={{ color: isDark ? "#555" : "#B0A99E", fontSize: 16 }}>›</span>
  );
}

export default EngineerMeTab;
