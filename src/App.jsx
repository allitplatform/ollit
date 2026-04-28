import { useState } from "react";
import { 
  ArrowRight, User, Lock, Sun, Moon, RotateCcw,
  Wrench, Headphones, BarChart3, Building2, CheckCircle2, AlertCircle,
  Eye, EyeOff, LogOut, Plus, Calendar, Phone, MapPin, Snowflake,
  ChevronRight, Send, TrendingUp, Users, DollarSign, AlertTriangle, Sparkles
} from "lucide-react";

const USERS = [
  { 
    userId: "kim.donghyo", name: "김동효", role: "engineer", roleLabel: "기사님",
    icon: "🔧", color: "#10B981",
    password: "engineer1!", rank: "대리", taskCount: 187,
  },
  { 
    userId: "kim.jihye", name: "김지혜", role: "happycall", roleLabel: "해피콜 담당자",
    icon: "📞", color: "#7F77DD",
    password: "happycall1!",
  },
  { 
    userId: "lee.ceo", name: "이대표", role: "admin", roleLabel: "대표님",
    icon: "📊", color: "#E91860",
    password: "admin1234!",
  },
  { 
    userId: "kim.coolguy", name: "김쿨가이", role: "principal", roleLabel: "쿨가이 대표님",
    icon: "🏪", color: "#FFB800",
    password: "cool1234!", company: "쿨가이",
  },
];

const SAMPLE_KAKAO = `성함: 조승빈
주소: 신림동 629-6 / 202호
연락처: 01094294445
가전 종류 및 갯수: 벽걸이에어컨 냉매충전
희망 날짜 및 시간대 (오전/오후):
4/23 오후`;

const THEMES = {
  dark: {
    name: "🌑 다크",
    bg: "#1A1512", bgElevated: "#221C18", bgInset: "#13100E",
    border: "rgba(255, 220, 200, 0.06)",
    text: "#FAF8F5", textSecondary: "#C4B5A6", textMuted: "#8A7B6F",
    accent: "#FF1B8D", accentBg: "rgba(255, 27, 141, 0.10)",
    success: "#10B981", successBg: "rgba(16, 185, 129, 0.10)",
    warning: "#FFB800", warningBg: "rgba(255, 184, 0, 0.10)",
    danger: "#EF4444", dangerBg: "rgba(239, 68, 68, 0.10)",
    info: "#3B82F6", infoBg: "rgba(59, 130, 246, 0.10)",
  },
  light: {
    name: "☀️ 라이트",
    bg: "#FAFAFA", bgElevated: "#FFFFFF", bgInset: "#F4F4F5",
    border: "rgba(0, 0, 0, 0.05)",
    text: "#0A0A0A", textSecondary: "#404040", textMuted: "#737373",
    accent: "#E91860", accentBg: "rgba(233, 24, 96, 0.06)",
    success: "#16A34A", successBg: "rgba(22, 163, 74, 0.08)",
    warning: "#D97706", warningBg: "rgba(217, 119, 6, 0.08)",
    danger: "#DC2626", dangerBg: "rgba(220, 38, 38, 0.06)",
    info: "#2563EB", infoBg: "rgba(37, 99, 235, 0.06)",
  },
};

function parseKakao(text) {
  const result = { name: "", phone: "", address: "", workType: "", dateText: "", timeText: "" };
  if (!text || !text.trim()) return result;
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("성함") || line.includes("이름")) {
      const m = line.split(/[:：]/);
      if (m.length > 1) result.name = m.slice(1).join(":").trim();
    }
    else if (line.includes("연락처") || line.includes("전화")) {
      const m = line.match(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/);
      if (m) {
        const nums = m[0].replace(/\D/g, "");
        if (nums.length === 11) result.phone = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
      }
    }
    else if (line.includes("주소")) {
      const m = line.split(/[:：]/);
      if (m.length > 1) result.address = m.slice(1).join(":").trim();
    }
    else if (line.includes("가전") || line.includes("작업")) {
      const m = line.split(/[:：]/);
      if (m.length > 1) result.workType = m.slice(1).join(":").trim();
    }
    else if (line.includes("희망") || line.includes("날짜")) {
      const next = lines[i+1] || "";
      const dateMatch = next.match(/(\d{1,2})[\/.\-](\d{1,2})/);
      if (dateMatch) result.dateText = dateMatch[0];
      const timeMatch = next.match(/오전|오후/);
      if (timeMatch) result.timeText = timeMatch[0];
    }
  }
  return result;
}

export default function App() {
  const [mode, setMode] = useState("dark");
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const t = THEMES[mode];

  const handleLogin = () => {
    setErrorMsg("");
    if (!userId.trim()) { setErrorMsg("아이디를 입력하세요"); return; }
    if (!password) { setErrorMsg("비밀번호를 입력하세요"); return; }
    const found = USERS.find(u => u.userId === userId.trim());
    if (!found) { setErrorMsg("존재하지 않는 아이디예요"); return; }
    if (found.password !== password) { setErrorMsg("비밀번호가 틀려요"); return; }
    setUser(found);
    setScreen("role-screen");
  };

  const handleLogout = () => {
    setUser(null);
    setUserId("");
    setPassword("");
    setScreen("login");
  };

  const reset = () => {
    handleLogout();
    setMode("dark");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@01ff0283e4f6c01667e0c819cfe9d2e933020d3a/css/SpoqaHanSansNeo.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .fade-in { animation: slideUp 0.4s ease-out; }
        .pulse { animation: pulse 2s infinite; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .clickable { cursor: pointer; transition: all 0.15s; }
        .clickable:active { opacity: 0.7; transform: scale(0.98); }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(10,10,10,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginBottom: 6, textAlign: "center", fontFamily: "system-ui", fontWeight: 600 }}>
          🚀 올잇 풀 시뮬 v1 · 진짜처럼 사용해보기
        </div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textAlign: "center", fontFamily: "system-ui", lineHeight: 1.5 }}>
          🎬 5개 시뮬 계정으로 4개 역할 다 체험!
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
          <RotateCcw size={10}/><span>처음 상태로 (로그아웃)</span>
        </button>
      </div>

      <div style={{ maxWidth: 420, margin: "0 auto", background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Spoqa Han Sans Neo', sans-serif" }}>
        {screen === "login" && (
          <LoginScreen 
            t={t}
            userId={userId} setUserId={setUserId}
            password={password} setPassword={setPassword}
            showPassword={showPassword} setShowPassword={setShowPassword}
            errorMsg={errorMsg}
            onLogin={handleLogin}
          />
        )}
        {screen === "role-screen" && user && (
          <RoleScreen t={t} user={user} onLogout={handleLogout}/>
        )}
      </div>
    </div>
  );
}

function LoginScreen({ t, userId, setUserId, password, setPassword, showPassword, setShowPassword, errorMsg, onLogin }) {
  const [showAccounts, setShowAccounts] = useState(true);
  
  return (
    <div className="fade-in" style={{ padding: "40px 24px", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
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
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6 }}>올잇</div>
        <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>
          에어컨 현장작업 운영관리 플랫폼
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ position: "relative" }}>
          <User size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
          <input
            type="text"
            placeholder="아이디"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onLogin()}
            style={{
              width: "100%", padding: "14px 14px 14px 44px",
              background: t.bgElevated, color: t.text,
              border: `1.5px solid ${userId ? t.accent : t.border}`,
              borderRadius: 12, fontSize: 14, fontWeight: 600,
              boxSizing: "border-box", outline: "none", fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ position: "relative" }}>
          <Lock size={16} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onLogin()}
            style={{
              width: "100%", padding: "14px 44px 14px 44px",
              background: t.bgElevated, color: t.text,
              border: `1.5px solid ${password ? t.accent : t.border}`,
              borderRadius: 12, fontSize: 14, fontWeight: 600,
              boxSizing: "border-box", outline: "none", fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer", color: t.textMuted, padding: 4,
            }}
          >
            {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          background: t.dangerBg, border: `1px solid ${t.danger}40`,
          borderRadius: 10, padding: "10px 12px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={14} style={{ color: t.danger, flexShrink: 0 }}/>
          <span style={{ fontSize: 12, color: t.danger, fontWeight: 600 }}>{errorMsg}</span>
        </div>
      )}

      <button
        onClick={onLogin}
        style={{
          width: "100%", padding: "16px",
          background: t.accent, color: "white",
          border: "none", borderRadius: 12,
          fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          marginBottom: 24,
        }}
      >
        <span>로그인</span>
        <ArrowRight size={16}/>
      </button>

      <div style={{
        background: t.bgElevated, borderRadius: 12, padding: "14px 16px",
      }}>
        <button onClick={() => setShowAccounts(!showAccounts)} style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "transparent", border: "none", cursor: "pointer",
          fontFamily: "inherit", color: t.text,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>🧪 시뮬 계정 (탭하면 자동 입력)</span>
          <ChevronRight size={14} style={{ transform: showAccounts ? "rotate(90deg)" : "none", transition: "transform 0.2s", color: t.textMuted }}/>
        </button>
        
        {showAccounts && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {USERS.map(u => (
              <button key={u.userId} onClick={() => {
                setUserId(u.userId);
                setPassword(u.password);
              }} className="clickable" style={{
                width: "100%", padding: "10px 12px",
                background: t.bgInset, border: `1px solid ${t.border}`,
                borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 10,
                textAlign: "left",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: u.color + "20", color: u.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>
                  {u.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>
                    {u.name} <span style={{ fontWeight: 500, color: t.textMuted }}>· {u.roleLabel}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 9, color: t.textMuted, marginTop: 2 }}>
                    {u.userId} / {u.password}
                  </div>
                </div>
                <ArrowRight size={12} style={{ color: t.textMuted, flexShrink: 0 }}/>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoleScreen({ t, user, onLogout }) {
  return (
    <div className="fade-in">
      <RoleHeader t={t} user={user} onLogout={onLogout}/>
      {user.role === "engineer" && <EngineerScreen t={t} user={user}/>}
      {user.role === "happycall" && <HappycallScreen t={t} user={user}/>}
      {user.role === "admin" && <AdminScreen t={t} user={user}/>}
      {user.role === "principal" && <PrincipalScreen t={t} user={user}/>}
    </div>
  );
}

function RoleHeader({ t, user, onLogout }) {
  return (
    <div style={{ 
      padding: "16px 20px",
      background: t.bgElevated,
      borderBottom: `1px solid ${t.border}`,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: user.color + "20", color: user.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>
        {user.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{user.name} {user.roleLabel}</div>
        <div className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>
          @{user.userId}
        </div>
      </div>
      <button onClick={onLogout} className="clickable" style={{
        padding: "6px 12px",
        background: t.bgInset, color: t.textMuted,
        border: `1px solid ${t.border}`,
        borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 4,
        fontSize: 11, fontWeight: 600,
      }}>
        <LogOut size={12}/><span>로그아웃</span>
      </button>
    </div>
  );
}

function EngineerScreen({ t, user }) {
  const tasks = [
    { id: "A260427-002", customer: "이상훈", time: "11:30", workType: "스탠드 세척", region: "서초", amount: 132000, status: "예정" },
    { id: "A260427-003", customer: "김미경", time: "14:00", workType: "냉매충전", region: "송파", amount: 100000, status: "예정" },
    { id: "A260427-001", customer: "박지영", time: "09:00", workType: "벽걸이 세척", region: "강남", amount: 80000, status: "완료" },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: 22, fontSize: 22, fontWeight: 800 }}>
        안녕하세요, {user.name}님
      </div>

      <div style={{ background: t.accentBg, border: `1px solid ${t.accent}30`, borderRadius: 14, padding: "16px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          🎖️ 직급 · {user.rank}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="mono" style={{ fontSize: 24, fontWeight: 800 }}>{user.taskCount}건</span>
          <span style={{ fontSize: 11, color: t.textMuted }}>다음: 과장 (300건)</span>
        </div>
      </div>

      <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 800, color: t.textSecondary }}>
        📅 오늘 일정 ({tasks.length}건)
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {tasks.map(task => (
          <div key={task.id} style={{
            background: t.bgElevated, borderRadius: 12, padding: "12px 14px",
            border: `1px solid ${t.border}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: t.accent }}>{task.time}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{task.customer}</span>
                <span style={{ fontSize: 10, color: t.textMuted }}>· {task.region}</span>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "3px 7px",
                background: task.status === "완료" ? t.successBg : t.warningBg,
                color: task.status === "완료" ? t.success : t.warning,
                borderRadius: 100,
              }}>
                {task.status}
              </span>
            </div>
            <div style={{ fontSize: 11, color: t.textSecondary }}>
              {task.workType} · ₩{task.amount.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
          💰 오늘 정산
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: t.textSecondary }}>완료 1건</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: t.success }}>+₩40,000</span>
        </div>
      </div>

      <DemoNotice t={t} text="기사님 풀 화면은 1_기사용_완성_v20.jsx 참조"/>
    </div>
  );
}

function HappycallScreen({ t, user }) {
  const newTasks = [
    { id: "A260428-002", customer: "박은서", phone: "010-5678-9012", region: "강남", urgent: false },
    { id: "A260428-003", customer: "최영희", phone: "010-7890-1234", region: "서초", urgent: true },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
          📞 해피콜 대기 ({newTasks.length}건)
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          새 접수 처리 + 기사 배정
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {newTasks.map(task => (
          <div key={task.id} style={{
            background: task.urgent ? t.dangerBg : t.bgElevated, 
            border: task.urgent ? `1px solid ${t.danger}40` : `1px solid ${t.border}`,
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>{task.id}</div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{task.customer}</div>
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
                  📞 {task.phone} · 📍 {task.region}
                </div>
              </div>
              {task.urgent && (
                <span className="pulse" style={{
                  fontSize: 9, fontWeight: 800, padding: "3px 8px",
                  background: t.danger, color: "white",
                  borderRadius: 100,
                }}>
                  🚨 긴급
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="clickable" style={{
                flex: 1, padding: "8px",
                background: t.success, color: "white",
                border: "none", borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>
                📞 전화
              </button>
              <button className="clickable" style={{
                flex: 1, padding: "8px",
                background: t.accent, color: "white",
                border: "none", borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>
                기사 배정
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="clickable" style={{
        width: "100%", padding: "14px",
        background: t.accent, color: "white",
        border: "none", borderRadius: 12,
        fontSize: 13, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <Plus size={16}/><span>새 접수 등록</span>
      </button>

      <div style={{ marginTop: 16, padding: "12px 14px", background: t.warningBg, border: `1px solid ${t.warning}30`, borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: t.warning, fontWeight: 700, marginBottom: 4 }}>
          🔒 권한 안내
        </div>
        <div style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.6 }}>
          해피콜 담당자는 <strong>정산 정보를 볼 수 없어요</strong>.<br/>
          매출/수익은 대표님 권한입니다.
        </div>
      </div>

      <DemoNotice t={t} text="해피콜 풀 화면은 2_해피콜담당자용_완성_v7.jsx 참조"/>
    </div>
  );
}

function AdminScreen({ t, user }) {
  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
          📊 오늘 운영 현황
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          2026-04-27 (일) · 실시간 모니터링
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <Metric t={t} icon={DollarSign} label="오늘 매출" value="₩312K" color={t.success}/>
        <Metric t={t} icon={TrendingUp} label="회사 마진" value="₩85K" color={t.accent}/>
        <Metric t={t} icon={Users} label="작업 / 완료" value="5 / 1" color={t.info}/>
        <Metric t={t} icon={Wrench} label="가동 기사" value="8명" color={t.warning}/>
      </div>

      <div style={{ background: t.dangerBg, border: `1px solid ${t.danger}40`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
        <div className="pulse" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <AlertTriangle size={14} style={{ color: t.danger }}/>
          <span style={{ fontSize: 12, fontWeight: 800, color: t.danger }}>🚨 긴급 알림 1건</span>
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary }}>
          A260428-003 최영희 - 4시간째 미배정
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
          💵 정산 흐름 (오늘)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FlowRow t={t} icon="🟢" label="현장 수금 (기사 직수령)" value="₩200K" color={t.success}/>
          <FlowRow t={t} icon="🔴" label="회사 정산 (다음주 입금)" value="₩112K" color={t.danger}/>
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
          🎖️ 기사 직급별 분포 (20명)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { rank: "🌱 수습 (1~50건)", count: 4, color: t.textMuted },
            { rank: "🔧 주임 (51~150건)", count: 8, color: t.info },
            { rank: "💼 대리 (151~300건)", count: 5, color: t.warning },
            { rank: "🎖️ 과장 (301~600건)", count: 2, color: t.success },
            { rank: "👑 부장 (600+건)", count: 1, color: t.accent },
          ].map(r => (
            <div key={r.rank} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: t.textSecondary }}>{r.rank}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.count}명</span>
            </div>
          ))}
        </div>
      </div>

      <DemoNotice t={t} text="대표님 풀 화면은 3_대표용_완성_v3.jsx 참조"/>
    </div>
  );
}

function Metric({ t, icon: Icon, label, value, color }) {
  return (
    <div style={{ background: t.bgElevated, borderRadius: 12, padding: "14px" }}>
      <Icon size={16} style={{ color, marginBottom: 8 }}/>
      <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function FlowRow({ t, icon, label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: t.textSecondary }}>{icon} {label}</span>
      <span className="mono" style={{ fontSize: 13, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

function PrincipalScreen({ t, user }) {
  const [tab, setTab] = useState("new");
  
  const myTasks = [
    { id: "A260427-001", customer: "박지영", workType: "벽걸이 세척", status: "완료", amount: 80000, fee: 15000 },
    { id: "A260428-001", customer: "조승빈", workType: "벽걸이 냉매충전", status: "약속대기", amount: 80000, fee: 28000 },
    { id: "A260428-002", customer: "박은서", workType: "벽걸이+1way 4대", status: "미배정", amount: 290000, fee: 60000 },
  ];

  return (
    <div>
      <div style={{ padding: "20px 20px 12px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
          🏪 {user.company} 대표님
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          자기 회사만 보임 · 오늘 수수료: <span className="mono" style={{ color: user.color, fontWeight: 800 }}>₩15,000</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "0 20px", marginBottom: 16 }}>
        {[
          { id: "new", label: "📝 신규 접수" },
          { id: "list", label: "📋 내 작업" },
          { id: "fee", label: "💰 수수료" },
        ].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className="clickable" style={{
            flex: 1, padding: "10px 6px",
            background: tab === tb.id ? user.color : t.bgInset,
            color: tab === tb.id ? "white" : t.text,
            border: `1px solid ${tab === tb.id ? user.color : t.border}`,
            borderRadius: 8, fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "new" && <KakaoParseTab t={t} user={user}/>}
      {tab === "list" && <MyTaskListTab t={t} user={user} tasks={myTasks}/>}
      {tab === "fee" && <FeeTab t={t} user={user} tasks={myTasks}/>}
    </div>
  );
}

function KakaoParseTab({ t, user }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleParse = () => {
    setParsed(parseKakao(text));
  };

  const submit = () => {
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setText("");
      setParsed(null);
    }, 3000);
  };

  if (submitted) {
    return (
      <div className="fade-in" style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: t.successBg, border: `2px solid ${t.success}`,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20,
        }}>
          <CheckCircle2 size={36} style={{ color: t.success }}/>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>접수 완료!</div>
        <div style={{ fontSize: 13, color: t.textSecondary }}>
          올잇 운영팀에 전달되었어요<br/>
          곧 해피콜 → 기사 배정 진행
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: "0 20px 20px" }}>
      {!parsed && (
        <>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
              💬 카톡 텍스트
            </span>
            <button onClick={() => setText(SAMPLE_KAKAO)} style={{
              fontSize: 11, fontWeight: 600, color: user.color,
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit",
            }}>
              예시 데이터 ↗
            </button>
          </div>
          <textarea
            placeholder="고객 카톡 메시지를 그대로 붙여넣으세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              width: "100%", minHeight: 200,
              padding: "14px 16px",
              background: t.bgElevated, color: t.text,
              border: `1.5px solid ${text ? user.color : t.border}`,
              borderRadius: 12, fontSize: 13, lineHeight: 1.6,
              boxSizing: "border-box", outline: "none",
              resize: "vertical", fontFamily: "inherit",
              marginBottom: 12,
            }}
          />
          <button
            onClick={handleParse}
            disabled={!text.trim()}
            className="clickable"
            style={{
              width: "100%", padding: "16px",
              background: text.trim() ? user.color : t.bgInset,
              color: text.trim() ? "white" : t.textMuted,
              border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: text.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Sparkles size={16}/>
            <span>자동 파싱하기</span>
          </button>
        </>
      )}

      {parsed && (
        <div className="fade-in">
          <div style={{
            background: t.successBg, border: `1px solid ${t.success}40`,
            borderRadius: 12, padding: "12px 14px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <CheckCircle2 size={18} style={{ color: t.success }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: t.success }}>자동 파싱 완료!</div>
            </div>
            <button onClick={() => setParsed(null)} style={{
              fontSize: 11, fontWeight: 600, color: user.color,
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit",
            }}>
              ↩ 다시
            </button>
          </div>

          <div style={{ background: t.bgElevated, borderRadius: 12, padding: "16px", marginBottom: 12 }}>
            <ParsedField t={t} icon={User} label="고객명" value={parsed.name}/>
            <ParsedField t={t} icon={Phone} label="연락처" value={parsed.phone} mono/>
            <ParsedField t={t} icon={MapPin} label="주소" value={parsed.address}/>
            <ParsedField t={t} icon={Snowflake} label="작업" value={parsed.workType}/>
            <ParsedField t={t} icon={Calendar} label="희망일" value={`${parsed.dateText} ${parsed.timeText}`} last/>
          </div>

          <button
            onClick={submit}
            className="clickable"
            style={{
              width: "100%", padding: "16px",
              background: user.color, color: "white",
              border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Send size={16}/>
            <span>접수 등록하기</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ParsedField({ t, icon: Icon, label, value, mono, last }) {
  return (
    <div style={{ 
      display: "flex", alignItems: "center", gap: 10, 
      padding: "10px 0",
      borderBottom: last ? "none" : `1px solid ${t.border}`,
    }}>
      <Icon size={14} style={{ color: t.textMuted, flexShrink: 0 }}/>
      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, width: 60 }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{value || "-"}</span>
    </div>
  );
}

function MyTaskListTab({ t, user, tasks }) {
  return (
    <div className="fade-in" style={{ padding: "0 20px 20px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map(task => (
          <div key={task.id} style={{
            background: t.bgElevated, border: `1px solid ${t.border}`,
            borderRadius: 12, padding: "12px 14px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: t.textMuted, marginBottom: 2 }}>{task.id}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{task.customer}</div>
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{task.workType}</div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "3px 7px",
                background: task.status === "완료" ? t.successBg : task.status === "미배정" ? t.dangerBg : t.warningBg,
                color: task.status === "완료" ? t.success : task.status === "미배정" ? t.danger : t.warning,
                borderRadius: 100,
              }}>
                {task.status}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 11, color: t.textMuted }}>결제 ₩{task.amount.toLocaleString()}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: user.color }}>
                +₩{task.fee.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeeTab({ t, user, tasks }) {
  const completed = tasks.filter(x => x.status === "완료");
  const inProgress = tasks.filter(x => x.status !== "완료");
  const completedFee = completed.reduce((s, x) => s + x.fee, 0);
  const expectedFee = inProgress.reduce((s, x) => s + x.fee, 0);

  return (
    <div className="fade-in" style={{ padding: "0 20px 20px" }}>
      <div style={{ 
        background: user.color + "15", 
        border: `1.5px solid ${user.color}40`, 
        borderRadius: 16, padding: "20px", marginBottom: 12 
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: user.color, letterSpacing: 1, textTransform: "uppercase" }}>
            🏪 오늘 받을 수수료
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", background: t.success, color: "white", borderRadius: 100 }}>
            매일 정산
          </span>
        </div>
        <div className="mono" style={{ fontSize: 32, fontWeight: 800, color: user.color, marginBottom: 8 }}>
          ₩{completedFee.toLocaleString()}
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary }}>
          완료 {completed.length}건 · 다음 영업일에 입금
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          ⏳ 진행 중 (예상 수수료)
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: t.textSecondary }}>{inProgress.length}건</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: t.warning }}>
            ₩{expectedFee.toLocaleString()}
          </span>
        </div>
      </div>

      <div style={{ background: t.infoBg, border: `1px solid ${t.info}30`, borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.info, marginBottom: 6 }}>
          💡 수수료 정책
        </div>
        <div style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.7 }}>
          {user.company}은 <strong style={{ color: t.text }}>차감후 50% 비율</strong>로 정산됩니다.<br/>
          매일 영업일 다음날 입금 처리됩니다.
        </div>
      </div>
    </div>
  );
}

function DemoNotice({ t, text }) {
  return (
    <div style={{
      marginTop: 20, padding: "12px 14px",
      background: t.bgInset, border: `1px solid ${t.border}`,
      borderRadius: 10,
      fontSize: 10, color: t.textMuted, lineHeight: 1.6,
      textAlign: "center",
    }}>
      💡 이 화면은 핵심 기능 데모예요<br/>
      <strong style={{ color: t.textSecondary }}>{text}</strong>
    </div>
  );
}
