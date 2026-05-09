// V14 — 내 정보 탭 (사장님 spec 마지막 화면)
// 5섹션: 프로필 카드 / 운영팀 문의 / 설정 / 정보 / 로그아웃
// 다크모드 + 글자 크기 = 전역 적용 / 통계 X / 비밀번호 변경 = 다음 단계
// Step 5-8 F-5 — 계좌 카드 추가 (내 계좌 / 회사 계좌 / 원청 계좌)

import { useState, useEffect, useMemo } from "react";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { useIsDark } from "../hooks/useIsDark.js";
import { loadCompanyAccount } from "../data/companyAccount.js";
import { loadPrincipals } from "../data/principals.js";

const APP_VERSION = "v1.0 · Phase 1A";

// V14 — 카카오 채널 URL (사장님 채널 받으면 박는다)
const KAKAO_CHANNEL_URL = ""; // ⚠️ 사장님 카톡 채널/오픈채팅 URL

function loadFontSize() {
  try {
    const v = localStorage.getItem("ollit_font_size");
    if (v === "small" || v === "medium" || v === "large") return v;
  } catch (e) {}
  return "medium";
}

// V14 — body에 zoom CSS 변수가 적용되도록 data-font-size 속성만 박는다
// (인라인 px가 많은 코드에서도 즉시 비례 변경. CSS는 src/index.css 참고)
function applyFontSize(size) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-font-size", size);
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
  onChangeAccount,  // Step 5-8 F-5 — 내 계좌 편집 진입
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

  function handleHelp()    { alert("준비 중입니다."); }
  function handleTerms()   { alert("준비 중입니다."); }
  function handlePassword(){ if (onChangePassword) onChangePassword(); else alert("준비 중입니다. 운영팀에 문의해주세요."); }
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
  const role = eng.role || "프로";
  const company = eng.companyName || eng.company || "올데이케어";

  // Step 5-8 F-5 — 회사 계좌 / 원청 계좌 (시트 양방향 sync 결과)
  const companyAccount = useMemo(() => loadCompanyAccount(), []);
  const principalAccounts = useMemo(() => {
    const list = loadPrincipals();
    return list
      .filter(p => p.status !== "off")
      .map(p => ({
        id:   p.id,
        name: p.name,
        bankName:      p.bankName      || "",
        accountNumber: p.accountNumber || "",
        accountHolder: p.accountHolder || "",
      }));
  }, []);
  const [selectedPrincipalId, setSelectedPrincipalId] = useState(
    principalAccounts[0]?.id || ""
  );
  const selectedPrincipalAccount = principalAccounts.find(p => p.id === selectedPrincipalId) || null;

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
              color: "#391B1B",
              padding: 14,
              borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#391B1B" aria-hidden="true">
                <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.74 5.16 4.36 6.55-.18.61-.65 2.18-.74 2.51-.12.4.15.4.31.29.13-.09 2.04-1.39 2.85-1.95.4.06.81.1 1.22.1 5.52 0 10-3.48 10-7.79S17.52 3 12 3z"/>
              </svg>
              카톡 문의
            </button>
          </div>
        </div>

        {/* Step 5-8 F-5 — 계좌 카드 (내 계좌 / 회사 송금 / 원청 계좌) */}
        <div style={{ ...cardStyle, padding: "6px 0" }}>
          <SectionHeader isDark={isDark}>💳 계좌</SectionHeader>

          {/* 내 계좌 */}
          <AccountBlock
            isDark={isDark}
            label="내 계좌"
            sub="본인만 변경 가능"
            holder={eng.accountHolder || ""}
            bank={eng.bankName || ""}
            number={eng.accountNumber || ""}
            actionLabel="편집"
            onAction={onChangeAccount}
          />

          {/* 회사 송금 계좌 (조회) */}
          <AccountBlock
            isDark={isDark}
            label="회사 송금 계좌"
            sub={companyAccount.changedAt ? `최근 변경 ${companyAccount.changedAt}` : "운영자 변경"}
            holder={companyAccount.accountHolder || ""}
            bank={companyAccount.bankName || ""}
            number={companyAccount.accountNumber || ""}
          />

          {/* 원청 계좌 (조회 / 원청별 select) */}
          <div style={{ padding: "12px 18px" }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: isDark ? "#FAF8F5" : "#1A1A1A",
              marginBottom: 4,
            }}>
              원청 계좌
            </div>
            <div style={{
              fontSize: 11, color: isDark ? "#999" : "#6B6359",
              marginBottom: 10,
            }}>
              원청별 입금 계좌 (조회만)
            </div>
            <select
              value={selectedPrincipalId}
              onChange={(e) => setSelectedPrincipalId(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px",
                background: isDark ? "#0E0E10" : "#FAF8F5",
                border: `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
                borderRadius: 10,
                color: isDark ? "#FAF8F5" : "#1A1A1A",
                fontSize: 13, fontFamily: "inherit",
                outline: "none", marginBottom: 10,
                boxSizing: "border-box",
              }}
            >
              {principalAccounts.length === 0 && <option value="">원청 없음</option>}
              {principalAccounts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedPrincipalAccount ? (
              <div style={{
                background: isDark ? "#0E0E10" : "#FAF8F5",
                border: `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
                borderRadius: 10, padding: 12,
                fontSize: 12, lineHeight: 1.7,
              }}>
                <div style={{ fontWeight: 700, color: isDark ? "#FAF8F5" : "#1A1A1A" }}>
                  {selectedPrincipalAccount.accountHolder || selectedPrincipalAccount.name || "—"} · {selectedPrincipalAccount.bankName || "—"}
                </div>
                <div style={{
                  color: isDark ? "#999" : "#6B6359",
                  fontFamily: "monospace", letterSpacing: 0.3,
                }}>
                  {selectedPrincipalAccount.accountNumber || "계좌 정보가 없습니다"}
                </div>
              </div>
            ) : null}
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

// Step 5-8 F-5 — 계좌 한 블록 (예금주 · 은행 / 번호 / 부가 액션)
function AccountBlock({ isDark, label, sub, holder, bank, number, actionLabel, onAction }) {
  const empty = !holder && !bank && !number;
  return (
    <div style={{
      padding: "12px 18px",
      borderBottom: `0.5px solid ${isDark ? "#2A2A2A" : "#F5F2ED"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: isDark ? "#FAF8F5" : "#1A1A1A",
            marginBottom: 4,
          }}>
            {label}
          </div>
          {sub && (
            <div style={{
              fontSize: 11, color: isDark ? "#999" : "#6B6359",
              marginBottom: 8,
            }}>
              {sub}
            </div>
          )}
          {empty ? (
            <div style={{ fontSize: 12, color: isDark ? "#777" : "#9A9A9A", fontStyle: "italic" }}>
              계좌 정보가 없습니다
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: isDark ? "#FAF8F5" : "#1A1A1A",
              }}>
                {holder || "—"} · {bank || "—"}
              </div>
              <div style={{
                fontSize: 12, color: isDark ? "#999" : "#6B6359",
                fontFamily: "monospace", letterSpacing: 0.3, marginTop: 2,
              }}>
                {number || "—"}
              </div>
            </>
          )}
        </div>
        {onAction && (
          <button onClick={onAction} style={{
            background: "transparent",
            border: `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
            color: isDark ? "#FF4DA6" : "#FF1B8D",
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            flexShrink: 0,
          }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default EngineerMeTab;
