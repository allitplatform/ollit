import { useState, useEffect } from "react";
import { 
  ArrowRight, User, Lock, Phone, RefreshCw, Sun, Moon,
  Wrench, Headphones, BarChart3, Building2, CheckCircle2, AlertCircle, RotateCcw,
  Eye, EyeOff, KeyRound, ArrowLeft
} from "lucide-react";

const THEMES = {
  dark: {
    name: "🌑 다크",
    bg: "#1A1512", bgElevated: "#221C18", bgInset: "#13100E",
    border: "rgba(255, 220, 200, 0.06)", borderStrong: "rgba(255, 220, 200, 0.10)",
    text: "#FAF8F5", textSecondary: "#C4B5A6", textMuted: "#8A7B6F", textDim: "#5C5048",
    accent: "#FF1B8D", accentBg: "rgba(255, 27, 141, 0.10)",
    success: "#10B981", successBg: "rgba(16, 185, 129, 0.10)", successBorder: "rgba(16, 185, 129, 0.20)",
    danger: "#EF4444", dangerBg: "rgba(239, 68, 68, 0.10)",
    warning: "#FFB800", warningBg: "rgba(255, 184, 0, 0.10)",
    isLight: false,
  },
  light: {
    name: "☀️ 라이트",
    bg: "#FAFAFA", bgElevated: "#FFFFFF", bgInset: "#F4F4F5",
    border: "rgba(0, 0, 0, 0.05)", borderStrong: "rgba(0, 0, 0, 0.09)",
    text: "#0A0A0A", textSecondary: "#404040", textMuted: "#737373", textDim: "#A3A3A3",
    accent: "#E91860", accentBg: "rgba(233, 24, 96, 0.06)",
    success: "#16A34A", successBg: "rgba(22, 163, 74, 0.08)", successBorder: "rgba(22, 163, 74, 0.20)",
    danger: "#DC2626", dangerBg: "rgba(220, 38, 38, 0.06)",
    warning: "#D97706", warningBg: "rgba(217, 119, 6, 0.08)",
    isLight: true,
  },
};

const REGISTERED_USERS = [
  { 
    userId: "kim.donghyo", name: "김동효", role: "engineer", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981",
    phone: "010-1111-1111", password: "engineer1!", isFirstLogin: false,
  },
  { 
    userId: "lee.jaehyun", name: "이재현", role: "engineer", roleLabel: "기사님", roleIcon: "🔧", roleColor: "#10B981",
    phone: "010-2222-2222", password: "temp1234", isFirstLogin: true,
  },
  { 
    userId: "kim.jihye", name: "김지혜", role: "happycall", roleLabel: "해피콜 담당자", roleIcon: "📞", roleColor: "#7F77DD",
    phone: "010-3333-3333", password: "happycall1!", isFirstLogin: false,
  },
  { 
    userId: "lee.ceo", name: "이대표", role: "admin", roleLabel: "대표님", roleIcon: "📊", roleColor: "#E91860",
    phone: "010-4444-4444", password: "admin1234!", isFirstLogin: false,
  },
  { 
    userId: "kim.coolguy", name: "김쿨가이", role: "principal", roleLabel: "원청 대표님 (쿨가이)", roleIcon: "🏪", roleColor: "#FFB800",
    phone: "010-5555-5555", password: "cool1234!", isFirstLogin: false,
  },
];

const ROLE_DESTINATIONS = {
  engineer: { title: "기사님 메인", icon: Wrench, screens: ["오늘 일정", "정산", "알림", "내 정보"] },
  happycall: { title: "해피콜 담당자 메인", icon: Headphones, screens: ["새 접수", "통화/메모", "기사 배정"] },
  admin: { title: "대표님 대시보드", icon: BarChart3, screens: ["개요", "작업", "기사", "활동"] },
  principal: { title: "원청 대표님 메인", icon: Building2, screens: ["내 작업", "신규 접수", "정산", "내 정보"] },
};

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("dark");
  const [step, setStep] = useState("login");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const t = THEMES[mode];

  const doLogin = () => {
    setErrorMsg("");
    if (!userId || !password) {
      setErrorMsg("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    const user = REGISTERED_USERS.find(u => u.userId === userId);
    if (!user) {
      setErrorMsg("등록되지 않은 아이디예요.");
      return;
    }
    if (user.password !== password) {
      setErrorMsg("비밀번호가 일치하지 않아요.");
      return;
    }
    setFoundUser(user);
    if (user.isFirstLogin) {
      setStep("changePassword");
    } else {
      setStep("success");
    }
  };

  const reset = () => {
    setStep("login");
    setUserId("");
    setPassword("");
    setShowPassword(false);
    setErrorMsg("");
    setFoundUser(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@01ff0283e4f6c01667e0c819cfe9d2e933020d3a/css/SpoqaHanSansNeo.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .fade-in { animation: slideUp 0.5s ease-out; }
        .pulse { animation: pulse 1.5s ease-in-out infinite; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .clickable { cursor: pointer; transition: all 0.2s; }
        .clickable:active { opacity: 0.7; transform: scale(0.98); }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(10,10,10,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginBottom: 6, textAlign: "center", fontFamily: "system-ui", fontWeight: 600 }}>
          🔐 올잇 로그인 v4 · 4개 역할 + 호칭 통일
        </div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textAlign: "center", fontFamily: "system-ui", lineHeight: 1.5 }}>
          🎬 시뮬 계정:<br/>
          kim.donghyo / engineer1! (김동효 기사님)<br/>
          lee.jaehyun / temp1234 (첫 로그인 - 비번 변경)<br/>
          kim.jihye / happycall1! (해피콜 담당자) · lee.ceo / admin1234! (대표님)<br/>
          kim.coolguy / cool1234! (김쿨가이 원청 대표님)
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {Object.entries(THEMES).map(([key, theme]) => {
            const Icon = key === "dark" ? Moon : Sun;
            return (
              <button key={key} onClick={() => setMode(key)} style={{
                flex: 1, padding: "8px",
                background: mode === key ? (key === "dark" ? "#221C18" : "#FFFFFF") : "rgba(255,255,255,0.05)",
                color: mode === key ? (key === "dark" ? "#FAF8F5" : "#0A0A0A") : "#888",
                border: mode === key ? `1.5px solid ${theme.accent}` : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "system-ui",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
                <Icon size={12}/><span>{theme.name}</span>
              </button>
            );
          })}
        </div>
        <button onClick={reset} style={{ width: "100%", padding: "6px 8px", background: "rgba(255,255,255,0.03)", color: "#aaa", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <RotateCcw size={10}/><span>처음 상태로 되돌리기</span>
        </button>
      </div>

      <div style={{ maxWidth: 420, margin: "0 auto", background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Spoqa Han Sans Neo', sans-serif", padding: "60px 24px" }}>
        
        {step === "login" && (
          <LoginForm 
            t={t} userId={userId} setUserId={setUserId}
            password={password} setPassword={setPassword}
            showPassword={showPassword} setShowPassword={setShowPassword}
            rememberMe={rememberMe} setRememberMe={setRememberMe}
            errorMsg={errorMsg} onLogin={doLogin}
            onForgotPassword={() => { setStep("forgotPassword"); setErrorMsg(""); }}
          />
        )}

        {step === "forgotPassword" && (
          <ForgotPasswordScreen t={t} onBack={() => { setStep("login"); setErrorMsg(""); }}/>
        )}

        {step === "changePassword" && foundUser && (
          <ChangePasswordScreen t={t} user={foundUser} onComplete={() => setStep("success")}/>
        )}

        {step === "success" && foundUser && (
          <SuccessScreen t={t} user={foundUser} onReset={reset} onComplete={() => onLogin(foundUser)}/>
        )}
      </div>
    </div>
  );
}

function LoginForm({ t, userId, setUserId, password, setPassword, showPassword, setShowPassword, rememberMe, setRememberMe, errorMsg, onLogin, onForgotPassword }) {
  return (
    <div className="fade-in">
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: t.accent, color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="0" y="6" width="13" height="20" rx="3" fill="white"/>
              <rect x="19" y="6" width="13" height="20" rx="3" fill="white"/>
              <rect x="13" y="14" width="6" height="4" fill="white"/>
            </svg>
          </div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6 }}>
          올잇
        </div>
        <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>
          에어컨 현장작업 운영관리 플랫폼
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          아이디
        </div>
        <div style={{ position: "relative" }}>
          <User size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
          <input
            type="text"
            placeholder="아이디 입력"
            value={userId}
            onChange={(e) => setUserId(e.target.value.trim())}
            autoCapitalize="off"
            autoComplete="username"
            className="mono"
            style={{
              width: "100%",
              padding: "14px 16px 14px 44px",
              background: t.bgElevated,
              color: t.text,
              border: `1.5px solid ${userId ? t.accent : t.border}`,
              borderRadius: 12,
              fontSize: 14, fontWeight: 600,
              boxSizing: "border-box",
              outline: "none",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          비밀번호
        </div>
        <div style={{ position: "relative" }}>
          <Lock size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => { if (e.key === "Enter") onLogin(); }}
            style={{
              width: "100%",
              padding: "14px 44px 14px 44px",
              background: t.bgElevated,
              color: t.text,
              border: `1.5px solid ${password ? t.accent : t.border}`,
              borderRadius: 12,
              fontSize: 14, fontWeight: 600,
              boxSizing: "border-box",
              outline: "none",
              fontFamily: showPassword ? "'JetBrains Mono', monospace" : "inherit",
            }}
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            type="button"
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer",
              color: t.textMuted, padding: 4,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "10px 12px", background: t.dangerBg, borderRadius: 8 }}>
          <AlertCircle size={12} style={{ color: t.danger, flexShrink: 0 }}/>
          <span style={{ fontSize: 11, color: t.danger, fontWeight: 600 }}>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{
              width: 16, height: 16,
              accentColor: t.accent,
              cursor: "pointer",
            }}
          />
          <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 500 }}>
            30일 자동 로그인
          </span>
        </label>
        <button
          onClick={onForgotPassword}
          className="clickable"
          style={{
            background: "transparent", border: "none",
            color: t.accent, fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            padding: "4px 0",
          }}
        >
          비밀번호 찾기
        </button>
      </div>

      <button
        onClick={onLogin}
        disabled={!userId || !password}
        style={{
          width: "100%",
          padding: "16px",
          background: (userId && password) ? t.accent : t.bgInset,
          color: (userId && password) ? "white" : t.textMuted,
          border: "none",
          borderRadius: 12,
          fontSize: 14, fontWeight: 700,
          cursor: (userId && password) ? "pointer" : "not-allowed",
          fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        <span>로그인</span>
        {(userId && password) && <ArrowRight size={16}/>}
      </button>

      <div style={{ marginTop: 30, padding: "14px 16px", background: t.bgElevated, borderRadius: 12 }}>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.7 }}>
          💡 <strong style={{ color: t.text }}>로그인 안내</strong><br/>
          · 아이디는 운영팀에서 발급해드려요<br/>
          · 임시 비밀번호로 첫 로그인 시 변경 필요<br/>
          · 비밀번호 분실 시 등록된 휴대폰으로 SMS 인증
        </div>
      </div>
    </div>
  );
}

function ForgotPasswordScreen({ t, onBack }) {
  const [findUserId, setFindUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("info");
  const [resendTimer, setResendTimer] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const formatPhone = (val) => {
    const nums = val.replace(/\D/g, "").slice(0, 11);
    if (nums.length < 4) return nums;
    if (nums.length < 8) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
  };

  const sendCode = () => {
    setErrorMsg("");
    const user = REGISTERED_USERS.find(u => u.userId === findUserId);
    if (!user) {
      setErrorMsg("등록되지 않은 아이디예요.");
      return;
    }
    if (user.phone !== phone) {
      setErrorMsg("아이디에 등록된 전화번호가 아니에요.");
      return;
    }
    setStep("code");
    setResendTimer(60);
  };

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const verifyCode = () => {
    setErrorMsg("");
    if (code !== "1234" && code !== "0000") {
      setErrorMsg("인증번호가 올바르지 않아요. (테스트: 1234)");
      return;
    }
    setStep("done");
  };

  return (
    <div className="fade-in">
      <button onClick={onBack} className="clickable" style={{
        background: "transparent", border: "none", color: t.textMuted,
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        padding: "6px 0", marginBottom: 30,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <ArrowLeft size={14}/><span>로그인으로 돌아가기</span>
      </button>

      {step === "info" && (
        <>
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
              비밀번호 찾기
            </div>
            <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500, lineHeight: 1.6 }}>
              아이디와 등록된 전화번호로<br/>
              본인 확인을 진행해요
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
              아이디
            </div>
            <div style={{ position: "relative" }}>
              <User size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
              <input
                type="text"
                placeholder="아이디"
                value={findUserId}
                onChange={(e) => setFindUserId(e.target.value.trim())}
                autoCapitalize="off"
                className="mono"
                style={{
                  width: "100%",
                  padding: "14px 16px 14px 44px",
                  background: t.bgElevated,
                  color: t.text,
                  border: `1.5px solid ${findUserId ? t.accent : t.border}`,
                  borderRadius: 12,
                  fontSize: 14, fontWeight: 600,
                  boxSizing: "border-box", outline: "none",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
              등록된 전화번호
            </div>
            <div style={{ position: "relative" }}>
              <Phone size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="mono"
                style={{
                  width: "100%",
                  padding: "14px 16px 14px 44px",
                  background: t.bgElevated,
                  color: t.text,
                  border: `1.5px solid ${phone.length >= 13 ? t.accent : t.border}`,
                  borderRadius: 12,
                  fontSize: 14, fontWeight: 600,
                  boxSizing: "border-box", outline: "none",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          </div>

          {errorMsg && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, padding: "10px 12px", background: t.dangerBg, borderRadius: 8 }}>
              <AlertCircle size={12} style={{ color: t.danger, flexShrink: 0 }}/>
              <span style={{ fontSize: 11, color: t.danger, fontWeight: 600 }}>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={sendCode}
            disabled={!findUserId || phone.length < 13}
            style={{
              width: "100%", padding: "16px",
              background: (findUserId && phone.length >= 13) ? t.accent : t.bgInset,
              color: (findUserId && phone.length >= 13) ? "white" : t.textMuted,
              border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: (findUserId && phone.length >= 13) ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <span>인증번호 받기</span>
            {(findUserId && phone.length >= 13) && <ArrowRight size={16}/>}
          </button>
        </>
      )}

      {step === "code" && (
        <>
          <div style={{ marginBottom: 30 }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
              인증번호 입력
            </div>
            <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500, lineHeight: 1.6 }}>
              <span className="mono" style={{ fontWeight: 700 }}>{phone}</span>으로<br/>
              인증번호 4자리를 보냈어요
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ position: "relative" }}>
              <KeyRound size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="0000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="mono"
                autoFocus
                style={{
                  width: "100%",
                  padding: "20px 16px 20px 44px",
                  background: t.bgElevated,
                  color: t.text,
                  border: `1.5px solid ${code.length === 4 ? t.accent : t.border}`,
                  borderRadius: 12,
                  fontSize: 24, fontWeight: 800,
                  letterSpacing: 8, textAlign: "center",
                  boxSizing: "border-box", outline: "none",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          </div>

          {errorMsg && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, padding: "10px 12px", background: t.dangerBg, borderRadius: 8 }}>
              <AlertCircle size={12} style={{ color: t.danger, flexShrink: 0 }}/>
              <span style={{ fontSize: 11, color: t.danger, fontWeight: 600 }}>{errorMsg}</span>
            </div>
          )}

          <div style={{ marginBottom: 24, textAlign: "center" }}>
            {resendTimer > 0 ? (
              <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
                <span className="mono">{resendTimer}초</span> 후에 재전송 가능
              </span>
            ) : (
              <button onClick={() => { setResendTimer(60); setErrorMsg(""); }} className="clickable" style={{
                background: "transparent", border: "none",
                color: t.accent, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                <RefreshCw size={12}/><span>인증번호 재전송</span>
              </button>
            )}
          </div>

          <button
            onClick={verifyCode}
            disabled={code.length !== 4}
            style={{
              width: "100%", padding: "16px",
              background: code.length === 4 ? t.accent : t.bgInset,
              color: code.length === 4 ? "white" : t.textMuted,
              border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: code.length === 4 ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <span>확인</span>
            {code.length === 4 && <ArrowRight size={16}/>}
          </button>
        </>
      )}

      {step === "done" && (
        <div style={{ textAlign: "center", paddingTop: 30 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: t.successBg, border: `2px solid ${t.success}`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 24,
          }}>
            <CheckCircle2 size={36} style={{ color: t.success }}/>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>
            본인 확인 완료
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500, lineHeight: 1.6, marginBottom: 24 }}>
            새 비밀번호를 설정해주세요.<br/>
            <span style={{ fontSize: 11, color: t.textMuted }}>(시뮬: 비번 변경 화면 생략)</span>
          </div>
          <button onClick={onBack} style={{
            padding: "12px 24px",
            background: t.accent, color: "white",
            border: "none", borderRadius: 10,
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            로그인으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}

function ChangePasswordScreen({ t, user, onComplete }) {
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const checkStrength = (pw) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) || /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = checkStrength(newPw);
  const strengthLabel = ["", "약함", "보통", "양호", "강함"][strength];
  const strengthColor = ["", t.danger, t.warning, t.warning, t.success][strength];

  const submit = () => {
    setErrorMsg("");
    if (newPw.length < 8) {
      setErrorMsg("비밀번호는 8자 이상이어야 해요.");
      return;
    }
    if (strength < 2) {
      setErrorMsg("비밀번호가 너무 약해요. 영문/숫자/특수문자 조합 사용해주세요.");
      return;
    }
    if (newPw !== confirmPw) {
      setErrorMsg("비밀번호가 일치하지 않아요.");
      return;
    }
    onComplete();
  };

  return (
    <div className="fade-in">
      <div style={{
        background: t.warningBg, border: `1px solid ${t.warning}40`,
        borderRadius: 12, padding: "14px 16px", marginBottom: 30,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <AlertCircle size={16} style={{ color: t.warning, flexShrink: 0, marginTop: 1 }}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.warning, marginBottom: 4 }}>
            첫 로그인 - 비밀번호 변경 필요
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5 }}>
            안전한 사용을 위해 임시 비밀번호를 변경해주세요.
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
          {user.name}님,<br/>새 비밀번호를 설정해주세요
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          새 비밀번호
        </div>
        <div style={{ position: "relative" }}>
          <Lock size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
          <input
            type={showPw ? "text" : "password"}
            placeholder="8자 이상, 영문/숫자/특수문자"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "14px 44px 14px 44px",
              background: t.bgElevated,
              color: t.text,
              border: `1.5px solid ${newPw ? t.accent : t.border}`,
              borderRadius: 12,
              fontSize: 14, fontWeight: 600,
              boxSizing: "border-box", outline: "none",
              fontFamily: showPw ? "'JetBrains Mono', monospace" : "inherit",
            }}
          />
          <button
            onClick={() => setShowPw(!showPw)}
            type="button"
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer",
              color: t.textMuted, padding: 4,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
        {newPw && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>비밀번호 강도</span>
              <span className="mono" style={{ fontSize: 10, color: strengthColor, fontWeight: 700 }}>{strengthLabel}</span>
            </div>
            <div style={{ height: 4, background: t.bgInset, borderRadius: 2, overflow: "hidden", display: "flex", gap: 2 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{
                  flex: 1, height: "100%",
                  background: i <= strength ? strengthColor : "transparent",
                  borderRadius: 2,
                }}/>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          새 비밀번호 확인
        </div>
        <div style={{ position: "relative" }}>
          <Lock size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
          <input
            type={showPw ? "text" : "password"}
            placeholder="다시 입력"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 16px 14px 44px",
              background: t.bgElevated,
              color: t.text,
              border: `1.5px solid ${confirmPw ? (newPw === confirmPw ? t.success : t.danger) : t.border}`,
              borderRadius: 12,
              fontSize: 14, fontWeight: 600,
              boxSizing: "border-box", outline: "none",
              fontFamily: showPw ? "'JetBrains Mono', monospace" : "inherit",
            }}
          />
        </div>
      </div>

      {errorMsg && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, padding: "10px 12px", background: t.dangerBg, borderRadius: 8 }}>
          <AlertCircle size={12} style={{ color: t.danger, flexShrink: 0 }}/>
          <span style={{ fontSize: 11, color: t.danger, fontWeight: 600 }}>{errorMsg}</span>
        </div>
      )}

      <button
        onClick={submit}
        disabled={!newPw || !confirmPw}
        style={{
          width: "100%", padding: "16px",
          background: (newPw && confirmPw) ? t.accent : t.bgInset,
          color: (newPw && confirmPw) ? "white" : t.textMuted,
          border: "none", borderRadius: 12,
          fontSize: 14, fontWeight: 700,
          cursor: (newPw && confirmPw) ? "pointer" : "not-allowed",
          fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        <span>비밀번호 변경 완료</span>
        {(newPw && confirmPw) && <ArrowRight size={16}/>}
      </button>

      <div style={{ marginTop: 24, padding: "12px 14px", background: t.bgElevated, borderRadius: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
          🔒 안전한 비밀번호 가이드
        </div>
        <div style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.6 }}>
          · 8자 이상 (12자 이상 권장)<br/>
          · 영문 대소문자 + 숫자 + 특수문자<br/>
          · 다른 사이트와 다른 비밀번호 사용
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({ t, user, onReset, onComplete }) {
  const dest = ROLE_DESTINATIONS[user.role];
  const Icon = dest.icon;
  const [seconds, setSeconds] = useState(2);

  useEffect(() => {
    if (seconds > 0) {
      const timer = setTimeout(() => setSeconds(seconds - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // 시간 끝나면 자동으로 역할별 화면으로 이동
      if (onComplete) {
        const timer = setTimeout(onComplete, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [seconds, onComplete]);

  return (
    <div className="fade-in" style={{ textAlign: "center" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: t.successBg,
        border: `2px solid ${t.success}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24,
      }}>
        <CheckCircle2 size={36} style={{ color: t.success }}/>
      </div>

      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
        안녕하세요,<br/>
        <span style={{ color: t.accent }}>{user.name}</span>님!
      </div>

      <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500, marginBottom: 30 }}>
        역할을 확인했어요
      </div>

      <div style={{
        background: t.bgElevated,
        border: `1.5px solid ${user.roleColor}30`,
        borderRadius: 16, padding: "20px 24px",
        marginBottom: 30,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: user.roleColor + "20",
            color: user.roleColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            {user.roleIcon}
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{user.roleLabel}</div>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{dest.title}</div>
          </div>
        </div>
        
        <div style={{ paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            접근 가능 화면
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
            {dest.screens.map((s, i) => (
              <span key={i} style={{
                fontSize: 10, fontWeight: 600,
                padding: "4px 10px",
                background: t.bgInset,
                color: t.textSecondary,
                borderRadius: 100,
              }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        background: t.accentBg,
        border: `1px solid ${t.accent}40`,
        borderRadius: 12, padding: "14px 18px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        marginBottom: 16,
      }}>
        <Icon size={18} style={{ color: t.accent, flexShrink: 0 }}/>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>
          {seconds > 0 ? (
            <span><span className="mono">{seconds}초</span> 후 {dest.title}으로 이동...</span>
          ) : (
            <span className="pulse">로그인 완료 ✨</span>
          )}
        </span>
      </div>

      <button onClick={onReset} className="clickable" style={{
        background: "transparent",
        border: `1px solid ${t.border}`,
        color: t.textMuted,
        fontSize: 11, fontWeight: 600,
        padding: "8px 14px", borderRadius: 8,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        다른 사용자로 다시 시도
      </button>

      <div style={{ marginTop: 30, padding: "14px 16px", background: t.bgElevated, borderRadius: 12 }}>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.7, textAlign: "left" }}>
          🔒 <strong style={{ color: t.text }}>보안 안내</strong><br/>
          · {user.name}님은 <strong style={{ color: t.text }}>{user.roleLabel} 화면만</strong> 보입니다<br/>
          · 다른 역할의 데이터는 접근 불가<br/>
          · 30일 자동 로그인 유지
        </div>
      </div>
    </div>
  );
}
