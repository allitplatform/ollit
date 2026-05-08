// V14 — 로그인 화면 (항상 다크 고정 / 시스템 설정 무관)
// 첫 인상 / 브랜드 일관성: 다크 배경 + 핑크 로고 + 흰 타이틀
// 인증 후 메인 앱부터는 시스템 테마 정상 적용
// V14 Phase 4-C — 폰번호 + 4자리 비번 로그인 박힘 (시트 기반 / loginV14 API)
import { useState } from "react";
import { OllitMark } from "./OllitMark.jsx";
import { REGISTERED_USERS } from "../shared/users.js";
import { loginV14 } from "../api.js";

const SHORT_ROLE = {
  engineer:  "기사",
  happycall: "해피콜",
  admin:     "대표",
  principal: "원청",
};

// V14 다크 고정 색 토큰 (시스템 무관)
const DARK = {
  pageBg:     "#0A0A0A",
  titleColor: "#FFFFFF",
  subColor:   "#888",
  inputBg:    "#1C1C1E",
  inputBd:    "#2A2A2A",
  inputColor: "#FFFFFF",
  divider:    "#2A2A2A",
  toggleBd:   "#2A2A2A",
  toggleText: "#888",
  cardBg:     "#1C1C1E",
  cardBd:     "#2A2A2A",
  footer:     "#555",
};

export function LoginScreen({ onLogin }) {
  // V14 Phase 4-C — id → phone 박힘 (11자리 숫자만 / 하이픈 박지 X)
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // V14 — 개발 + 베타 단계: production에서도 빠른 로그인 항상 표시 + 기본 펼침
  const [showQuickLogin, setShowQuickLogin] = useState(true);

  // V14 Phase 4-C — 폰번호 정규화: 숫자만 + 11자리 max
  const normalizePhone = (val) => String(val || "").replace(/\D/g, "").slice(0, 11);

  const handleLogin = async () => {
    setError("");
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length !== 11) {
      setError("폰번호 11자리를 입력해주세요");
      return;
    }
    if (!pw) {
      setError("비밀번호를 입력해주세요");
      return;
    }
    setBusy(true);
    try {
      const res = await loginV14(cleanPhone, pw);
      if (!res || res.ok === false) {
        setError(res?.error || "로그인 실패");
        return;
      }
      const users = res.users || [];
      if (users.length === 0) {
        setError("일치하는 사용자가 없습니다");
        return;
      }
      if (users.length === 1) {
        onLogin(users[0]);
        return;
      }
      // V14 Phase 4-C — users.length > 1 박힌 catch는 Fix 3 (역할 선택 모달) 박을 차례 / 다음 step
      setError(`매칭된 역할 ${users.length}개. 다음 step에서 선택 모달 박힘`);
    } catch (e) {
      setError(e?.message || "로그인 실패 (네트워크)");
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !busy) handleLogin();
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

        {/* Hero — 로고 + 타이틀 + 부제 */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center",
        }}>
          <OllitMark size={140}/>
          <div style={{
            color: DARK.titleColor, fontSize: 44,
            fontWeight: 800, letterSpacing: 2,
            marginTop: 36, lineHeight: 1,
          }}>
            올잇
          </div>
          <div style={{
            color: DARK.subColor, fontSize: 14,
            letterSpacing: 0.3, marginTop: 10,
          }}>
            현장과 사람을 잇는 운영 플랫폼
          </div>
        </div>

        {/* 입력 폼 — V14 Phase 4-C: 폰번호 + 비번 박힘 */}
        <div style={{ marginTop: 44 }}>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="폰번호 (숫자 11자리)"
            value={phone}
            onChange={(e) => setPhone(normalizePhone(e.target.value))}
            onKeyDown={handleKeyDown}
            maxLength={11}
            style={{
              width: "100%", background: DARK.inputBg,
              border: `1px solid ${DARK.inputBd}`, borderRadius: 12,
              padding: "17px 18px", color: DARK.inputColor,
              fontSize: 16, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box",
              fontWeight: 500, letterSpacing: 1,
            }}
          />
          <div style={{ height: 12 }}/>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="비밀번호 (초기 = 폰번호 뒷 4자리)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
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
            onClick={handleLogin}
            disabled={busy}
            style={{
              width: "100%", background: busy ? "#7A1450" : "#FF1B8D",
              border: "none", borderRadius: 14, padding: 18,
              color: "#fff", fontSize: 17, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "로그인 중..." : "로그인"}
          </button>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <span style={{
              fontSize: 13, color: DARK.subColor,
              cursor: "pointer", fontWeight: 500,
            }}>
              비밀번호 찾기
            </span>
          </div>
        </div>

        {/* V14 — 빠른 로그인 (베타 단계 항상 표시 / 접힘 토글) */}
        {true && (
          <div style={{ marginTop: 32 }}>
            <div style={{
              height: 0.5, background: DARK.divider,
              marginBottom: 16,
            }}/>

            <button
              onClick={() => setShowQuickLogin(v => !v)}
              style={{
                width: "100%", background: "transparent",
                border: `1px solid ${DARK.toggleBd}`,
                color: DARK.toggleText, padding: 13,
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
                      padding: "11px 10px", background: DARK.cardBg,
                      border: `1px solid ${DARK.cardBd}`, borderRadius: 10,
                      textAlign: "center", fontSize: 12,
                      color: DARK.subColor, cursor: "pointer",
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
          fontSize: 11, color: DARK.footer, letterSpacing: 0.5,
        }}>
          v1.0 · Phase 1A
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
