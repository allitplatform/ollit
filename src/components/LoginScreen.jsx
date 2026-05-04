// V14 — 로그인 화면 (Hero 키움 + 빠른 로그인 접힘 토글)
// 50대 친화 입력 필드 / 운영 빌드에서 빠른 로그인 자체 숨김
import { useState } from "react";
import { OllitMark } from "./OllitMark.jsx";
import { REGISTERED_USERS } from "../shared/users.js";
import { useIsDark } from "../hooks/useIsDark.js";

const SHORT_ROLE = {
  engineer:  "기사",
  happycall: "해피콜",
  admin:     "대표",
  principal: "원청",
};

export function LoginScreen({ onLogin }) {
  const isDark = useIsDark();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [showQuickLogin, setShowQuickLogin] = useState(false);

  const isDev = (typeof import.meta !== "undefined" && import.meta.env)
    ? (import.meta.env.DEV || import.meta.env.MODE === "development")
    : false;

  const handleLogin = () => {
    setError("");
    const account = REGISTERED_USERS.find(a => a.userId === id && a.password === pw);
    if (account) {
      onLogin(account);
    } else {
      setError("아이디 또는 비밀번호가 틀렸습니다");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  // V14 토큰 (라이트/다크 분기)
  const pageBg     = isDark ? "#0A0A0A" : "#FAFAFA";
  const titleColor = isDark ? "#FFFFFF" : "#1A1A1A";
  const subColor   = isDark ? "#888"    : "#666";
  const inputBg    = isDark ? "#1C1C1E" : "#FFFFFF";
  const inputBd    = isDark ? "#2A2A2A" : "#E5E0D6";
  const inputColor = isDark ? "#FFFFFF" : "#1A1A1A";
  const dividerBg  = isDark ? "#2A2A2A" : "#EFE9E0";
  const toggleBd   = isDark ? "#2A2A2A" : "#E5E0D6";
  const toggleText = isDark ? "#888"    : "#666";
  const footerColor= isDark ? "#555"    : "#B0B0B0";

  return (
    <div style={{
      minHeight: "100vh", background: pageBg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start",
      padding: "56px 0 30px", color: titleColor,
      fontFamily: "-apple-system, 'Spoqa Han Sans Neo', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 380, padding: "0 32px" }}>

        {/* Hero — 로고 + 타이틀 + 부제 */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center",
        }}>
          <OllitMark size={140}/>
          <div style={{
            color: titleColor, fontSize: 44,
            fontWeight: 800, letterSpacing: 2,
            marginTop: 36, lineHeight: 1,
          }}>
            올잇
          </div>
          <div style={{
            color: subColor, fontSize: 14,
            letterSpacing: 0.3, marginTop: 10,
          }}>
            현장과 사람을 잇는 운영 플랫폼
          </div>
        </div>

        {/* 입력 폼 */}
        <div style={{ marginTop: 44 }}>
          <input
            type="text" placeholder="아이디"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%", background: inputBg,
              border: `1px solid ${inputBd}`, borderRadius: 12,
              padding: "17px 18px", color: inputColor,
              fontSize: 16, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box",
              fontWeight: 500,
            }}
          />
          <div style={{ height: 12 }}/>
          <input
            type="password" placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%", background: inputBg,
              border: `1px solid ${inputBd}`, borderRadius: 12,
              padding: "17px 18px", color: inputColor,
              fontSize: 16, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box",
              fontWeight: 500,
            }}
          />
          {error && (
            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: "rgba(255, 59, 92, 0.10)",
              border: "1px solid rgba(255, 59, 92, 0.30)",
              borderRadius: 10, color: "#FF3B5C",
              fontSize: 13, textAlign: "center",
              fontWeight: 500,
            }}>{error}</div>
          )}
          <div style={{ height: 18 }}/>
          <button onClick={handleLogin} style={{
            width: "100%", background: "#FF1B8D",
            border: "none", borderRadius: 14, padding: 18,
            color: "#fff", fontSize: 17, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            로그인
          </button>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <span style={{
              fontSize: 13, color: subColor,
              cursor: "pointer", fontWeight: 500,
            }}>
              비밀번호 찾기
            </span>
          </div>
        </div>

        {/* 빠른 로그인 (개발 빌드만 / 접힘 토글) */}
        {isDev && (
          <div style={{ marginTop: 32 }}>
            <div style={{
              height: 0.5, background: dividerBg,
              marginBottom: 16,
            }}/>

            <button
              onClick={() => setShowQuickLogin(v => !v)}
              style={{
                width: "100%", background: "transparent",
                border: `1px solid ${toggleBd}`,
                color: toggleText, padding: 13,
                borderRadius: 12, fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>⚙️</span>
              개발용 · 빠른 로그인
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                {showQuickLogin ? "△" : "▽"}
              </span>
            </button>

            {showQuickLogin && (
              <div style={{
                marginTop: 12,
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
              }}>
                {REGISTERED_USERS.map((a, i) => (
                  <div
                    key={a.userId}
                    onClick={() => onLogin(a)}
                    style={{
                      padding: "11px 10px", background: inputBg,
                      border: `1px solid ${inputBd}`, borderRadius: 10,
                      textAlign: "center", fontSize: 12,
                      color: subColor, cursor: "pointer",
                      fontWeight: 500,
                      gridColumn: i === REGISTERED_USERS.length - 1 && REGISTERED_USERS.length % 2 === 1 ? "span 2" : "span 1",
                    }}
                  >
                    {a.roleIcon} {a.name} · {SHORT_ROLE[a.role] || a.role}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{
          textAlign: "center", padding: "30px 16px 0",
          fontSize: 11, color: footerColor, letterSpacing: 0.5,
        }}>
          v1.0 · Phase 1A
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
