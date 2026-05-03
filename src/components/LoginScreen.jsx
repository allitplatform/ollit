// 올잇 로그인 화면 — 시안 단순화 버전 (Step 5-3-6)
// REGISTERED_USERS 단일 source of truth 활용 (id/pw/name/role 호환)
// onLogin(user) 시그니처는 App.jsx의 currentUser (role 영어 키 분기)와 호환
import { useState } from "react";
import { OllitMark } from "./OllitMark.jsx";
import { REGISTERED_USERS } from "../shared/users.js";

const SHORT_ROLE = {
  engineer:  "기사",
  happycall: "해피콜",
  admin:     "대표",
  principal: "원청",
};

export function LoginScreen({ onLogin }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

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

  return (
    <div style={{
      minHeight: "100vh", background: "#1A1512",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "60px 0 30px", color: "#fff",
      fontFamily: "-apple-system, 'Spoqa Han Sans Neo', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 380, padding: "0 32px" }}>

        {/* 로고 + 태그라인 */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 14, marginBottom: 48,
        }}>
          <OllitMark size={88}/>
          <div style={{
            color: "#FAF8F5", fontSize: 28,
            fontWeight: 800, letterSpacing: 2, marginTop: 8,
          }}>올잇</div>
          <div style={{ color: "#8A7B6F", fontSize: 12 }}>
            현장과 사람을 잇는 운영 플랫폼
          </div>
        </div>

        {/* 폼 */}
        <input
          type="text" placeholder="아이디"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />
        <div style={{ height: 12 }}/>
        <input
          type="password" placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />
        {error && (
          <div style={{
            marginTop: 10, padding: "8px 12px",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.30)",
            borderRadius: 8, color: "#FF3D5A",
            fontSize: 12, textAlign: "center",
          }}>{error}</div>
        )}
        <div style={{ height: 18 }}/>
        <button onClick={handleLogin} style={loginBtnStyle}>로그인</button>

        <div style={{ textAlign: "center", marginTop: 14 }}>
          <span style={{ fontSize: 11, color: "#888780", cursor: "pointer" }}>
            비밀번호 찾기
          </span>
        </div>

        {/* 빠른 로그인 (개발용) */}
        <div style={{ marginTop: 32 }}>
          <div style={{
            display: "flex", alignItems: "center",
            gap: 8, marginBottom: 14,
          }}>
            <div style={{ flex: 1, height: 1, background: "#2A2420" }}/>
            <span style={{ fontSize: 10, color: "#555" }}>개발용 · 빠른 로그인</span>
            <div style={{ flex: 1, height: 1, background: "#2A2420" }}/>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr", gap: 6,
          }}>
            {REGISTERED_USERS.map((a, i) => (
              <div
                key={a.userId}
                onClick={() => onLogin(a)}
                style={{
                  padding: "9px 8px", background: "#221C18",
                  border: "1px solid #2A2420", borderRadius: 7,
                  textAlign: "center", fontSize: 11,
                  color: "#888780", cursor: "pointer",
                  gridColumn: i === REGISTERED_USERS.length - 1 && REGISTERED_USERS.length % 2 === 1 ? "span 2" : "span 1",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#2A2420"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#221C18"; }}
              >
                {a.roleIcon} {a.name} · {SHORT_ROLE[a.role] || a.role}
              </div>
            ))}
          </div>
        </div>

        <div style={{
          textAlign: "center", padding: "30px 16px 0",
          fontSize: 9, color: "#444", letterSpacing: 0.5,
        }}>
          v1.0 · Phase 1A
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "#221C18",
  border: "1px solid #2A2420", borderRadius: 10,
  padding: "14px 16px", color: "#fff",
  fontSize: 14, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

const loginBtnStyle = {
  width: "100%", background: "#FF1B8D",
  border: "none", borderRadius: 10, padding: 14,
  color: "#fff", fontSize: 14, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};

export default LoginScreen;
