// V14 — 로그인 화면 (항상 다크 고정 / 시스템 설정 무관)
// 첫 인상 / 브랜드 일관성: 다크 배경 + 핑크 로고 + 흰 타이틀
// 인증 후 메인 앱부터는 시스템 테마 정상 적용
// Phase 2 — Supabase Custom RPC (sign_in_with_phone) 박은 영역 / loginV14 박은 영역 박은 영역
import { useState } from "react";
import { OllitMark } from "./OllitMark.jsx";
// 2026-05-20 Phase 5 Step 0.D-A2 — REGISTERED_USERS 측 import 제거 (빠른 로그인 section 완전 제거)
// (REGISTERED_USERS 측 EngineerMeTab.jsx 측 별도 사용 — shared/users.js 측 정의 유지)
import { signInWithPhone } from "../lib/auth.js";

// DB role → app role 매핑 (App.jsx switch 박은 영역 박은 영역)
const DB_TO_APP_ROLE = {
  owner:    "admin",
  admin:    "admin",
  engineer: "engineer",
  operator: "happycall",
  partner:  "principal",
};

const SHORT_ROLE = {
  engineer:  "프로",
  happycall: "관리자",
  admin:     "대표",
  principal: "원청",
};

// V14 Phase 4-C Fix 3 — 역할 한글 라벨 (사장님 결정 5/8: 대표/관리자/프로/원청)
const ROLE_LABELS = {
  admin:     "대표",
  happycall: "관리자",
  engineer:  "프로",
  principal: "원청",
};

// V14 Phase 4-C Fix 3 — 역할별 아바타 색상 (시각 구분)
const ROLE_COLORS = {
  admin:     "#FF1B8D",
  happycall: "#4FC3F7",
  engineer:  "#66BB6A",
  principal: "#FFA726",
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
  // V14 Phase 4-C — id → phone (11자리 숫자만 / 하이픈 자동 제거)
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 2026-05-20 Phase 5 Step 0.D-A2 — showQuickLogin state 제거 (빠른 로그인 section 완전 제거)
  // 한 user × 여러 role (예: E022 = admin + engineer) → 역할 선택 모달
  const [roleSelect, setRoleSelect] = useState({ open: false, user: null });

  // V14 Phase 4-C — 폰번호 정규화: 숫자만 + 11자리 max
  const normalizePhone = (val) => String(val || "").replace(/\D/g, "").slice(0, 11);

  // RPC 응답 user → app user 정규화 (role / userId 호환)
  const buildAppUser = (rpcUser, dbRole) => {
    const appRole = DB_TO_APP_ROLE[dbRole] || dbRole;
    return {
      ...rpcUser,
      userId: rpcUser.code || rpcUser.user_id,    // 옛 컴포넌트 호환 (userId 박은 영역 박은 영역)
      role: appRole,                              // App.jsx switch 박은 영역
      dbRole,                                     // 디버깅용 (원본 DB role)
      name: rpcUser.name,
      phone: rpcUser.phone,
      engineerId: rpcUser.code && String(rpcUser.code).startsWith("E") ? rpcUser.code : undefined,
      // 2026-05-23 — partner role 측 사용자 측 측 principal 목록 측 (Migration 057 측)
      //   PrincipalApp 측 user.principals 측 catch 측 (예: 유솔홈케어 통합계정 = usol_h + usol_n)
      principals: Array.isArray(rpcUser.principals) ? rpcUser.principals : [],
    };
  };

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
      const res = await signInWithPhone(cleanPhone, pw);
      if (!res || !res.ok) {
        const msgMap = {
          user_not_found:    "등록되지 않은 폰번호예요",
          invalid_password:  "비밀번호가 틀렸어요",
          password_not_set:  "비밀번호 미설정 (관리자 문의)",
          phone_required:    "폰번호를 입력해주세요",
          password_required: "비밀번호를 입력해주세요",
        };
        setError(msgMap[res?.error] || res?.error || "로그인 실패");
        return;
      }
      const roles = Array.isArray(res.roles) ? res.roles : [];
      if (roles.length === 0) {
        setError("역할이 설정되지 않았습니다 (관리자 문의)");
        return;
      }
      if (roles.length === 1) {
        onLogin(buildAppUser(res, roles[0]), false);
        return;
      }
      // 여러 role (예: E022 = admin + engineer) → 선택 모달
      setRoleSelect({ open: true, user: res });
    } catch (e) {
      setError(e?.message || "로그인 실패 (네트워크)");
    } finally {
      setBusy(false);
    }
  };

  // 모달에서 역할 선택 → 해당 role 박은 영역 박은 영역
  const handleSelectRole = (dbRole) => {
    const user = roleSelect.user;
    setRoleSelect({ open: false, user: null });
    if (user) onLogin(buildAppUser(user, dbRole), false);
  };
  const handleCancelRoleSelect = () => {
    setRoleSelect({ open: false, user: null });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !busy) handleLogin();
  };

  return (
    <>
    <div
      data-theme-locked="dark"
      style={{
        minHeight: "100vh", background: DARK.pageBg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "30px 0", color: DARK.titleColor,
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

        {/* 2026-05-20 Phase 5 Step 0.D-A2 — "개발용 · 빠른 로그인" section 측 완전 제거 */}
        {/*   사장님 spec: production 측 = 완전 X / dev 측 = 전화+PIN 측 정상 로그인 spec */}
        {/*   옛 spec: import.meta.env.DEV 측 dev 표시 — 본 stage 측 코드 자체 측 제거 */}

        <div style={{
          textAlign: "center", padding: "30px 16px 0",
          fontSize: 11, color: DARK.footer, letterSpacing: 0.5,
        }}>
          v1.0 · Phase 1A
        </div>
      </div>
    </div>

    {/* 한 사용자 × 여러 role → 역할 선택 모달 */}
    {roleSelect.open && roleSelect.user && (
      <RoleSelectModal
        user={roleSelect.user}
        onSelect={handleSelectRole}
        onCancel={handleCancelRoleSelect}
      />
    )}
    </>
  );
}

// 한 사용자 박은 영역 박은 영역 role 박은 영역 박은 영역 모달 (E022 = admin + engineer 등)
function RoleSelectModal({ user, onSelect, onCancel }) {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1C1C1E",
          borderRadius: 16,
          padding: 24,
          maxWidth: 400, width: "100%",
          maxHeight: "80vh", overflowY: "auto",
          fontFamily: "-apple-system, 'Pretendard', sans-serif",
        }}
      >
        <div style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          로그인할 역할을 선택해주세요
        </div>
        <div style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
          {user.name}님은 {roles.length}개 역할을 가지고 있어요
        </div>

        {roles.map((dbRole, idx) => {
          const appRole = DB_TO_APP_ROLE[dbRole] || dbRole;
          return (
            <button
              key={dbRole}
              onClick={() => onSelect(dbRole)}
              style={{
                width: "100%",
                background: "#2A2A2A",
                border: "1px solid #3A3A3A",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: idx < roles.length - 1 ? 10 : 0,
                color: "#FFFFFF",
                fontSize: 15,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: ROLE_COLORS[appRole] || "#FF1B8D",
                color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 16, flexShrink: 0,
              }}>
                {String(user.name || "?").charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {user.name}
                  {user.code && (
                    <span style={{ fontSize: 12, color: "#aaa", marginLeft: 8, fontWeight: 400 }}>
                      ({user.code})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                  {ROLE_LABELS[appRole] || appRole}
                </div>
              </div>
            </button>
          );
        })}

        <button
          onClick={onCancel}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: "#888",
            fontSize: 13, marginTop: 16, padding: 8,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          취소
        </button>
      </div>
    </div>
  );
}

export default LoginScreen;
