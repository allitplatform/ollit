// V14 Phase 4-E-1 — 강제 비밀번호 변경 화면 (첫 로그인)
// passwordChanged === false 사용자 → 본 화면 진입 차단
// 디자인: LoginScreen 스타일 (다크 고정 / 핑크 accent)
import { useState } from "react";
import { OllitMark } from "./OllitMark.jsx";
import { changePasswordV14 } from "../api.js";

const DARK = {
  pageBg:     "#0A0A0A",
  titleColor: "#FFFFFF",
  subColor:   "#888",
  inputBg:    "#1C1C1E",
  inputBd:    "#2A2A2A",
  inputColor: "#FFFFFF",
  divider:    "#2A2A2A",
  footer:     "#555",
};

export function PasswordChangeScreen({ user, onComplete }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const validate = () => {
    if (!oldPw) return "현재 비밀번호를 입력해주세요";
    if (!newPw) return "새 비밀번호를 입력해주세요";
    if (newPw.length < 4 || newPw.length > 16) return "새 비밀번호는 4~16자여야 합니다";
    if (newPw === oldPw) return "새 비밀번호가 현재 비밀번호와 같습니다";
    if (newPw !== confirmPw) return "새 비밀번호 확인이 일치하지 않습니다";
    return null;
  };

  const handleSubmit = async () => {
    setError("");
    const v = validate();
    if (v) { setError(v); return; }
    setBusy(true);
    try {
      const res = await changePasswordV14(user.userId, oldPw, newPw);
      if (!res || res.ok === false) {
        setError(res?.error || "비밀번호 변경 실패");
        return;
      }
      onComplete({ ...user, passwordChanged: true });
    } catch (e) {
      setError(e?.message || "비밀번호 변경 실패 (네트워크)");
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !busy) handleSubmit();
  };

  return (
    <div
      data-theme-locked="dark"
      style={{
        minHeight: "100vh", background: DARK.pageBg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        padding: "56px 0 30px", color: DARK.titleColor,
        fontFamily: "-apple-system, 'Pretendard', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, padding: "0 32px" }}>

        {/* Hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <OllitMark size={100}/>
          <div style={{
            color: DARK.titleColor, fontSize: 26,
            fontWeight: 800, letterSpacing: 1,
            marginTop: 24, lineHeight: 1.2, textAlign: "center",
          }}>
            비밀번호 변경
          </div>
          <div style={{
            color: DARK.subColor, fontSize: 13,
            letterSpacing: 0.3, marginTop: 10, textAlign: "center", lineHeight: 1.5,
          }}>
            첫 로그인이에요.<br/>
            안전을 위해 비밀번호를 변경해주세요.
          </div>
          {user?.name && (
            <div style={{
              marginTop: 14, fontSize: 13, color: DARK.subColor,
            }}>
              <span style={{ color: "#FF1B8D", fontWeight: 700 }}>{user.name}</span>님 계정
            </div>
          )}
        </div>

        {/* 입력 폼 */}
        <div style={{ marginTop: 32 }}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="현재 비밀번호 (초기 = 폰 뒷 4자리)"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={16}
            style={{
              width: "100%", background: DARK.inputBg,
              border: `1px solid ${DARK.inputBd}`, borderRadius: 12,
              padding: "17px 18px", color: DARK.inputColor,
              fontSize: 16, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box",
              fontWeight: 500,
            }}
          />
          <div style={{ height: 12 }}/>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="새 비밀번호 (4~16자)"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={16}
            style={{
              width: "100%", background: DARK.inputBg,
              border: `1px solid ${DARK.inputBd}`, borderRadius: 12,
              padding: "17px 18px", color: DARK.inputColor,
              fontSize: 16, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box",
              fontWeight: 500,
            }}
          />
          <div style={{ height: 12 }}/>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="새 비밀번호 확인"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={16}
            style={{
              width: "100%", background: DARK.inputBg,
              border: `1px solid ${DARK.inputBd}`, borderRadius: 12,
              padding: "17px 18px", color: DARK.inputColor,
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
          <button
            onClick={handleSubmit}
            disabled={busy}
            style={{
              width: "100%", background: busy ? "#7A1450" : "#FF1B8D",
              border: "none", borderRadius: 14, padding: 18,
              color: "#fff", fontSize: 17, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "변경 중..." : "비밀번호 변경"}
          </button>
        </div>

        <div style={{
          textAlign: "center", padding: "30px 16px 0",
          fontSize: 11, color: DARK.footer, letterSpacing: 0.5,
        }}>
          v1.0 · Phase 1A
        </div>
      </div>
    </div>
  );
}
