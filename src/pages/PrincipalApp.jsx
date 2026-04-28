import { useState } from "react";
import { 
  Sun, Moon, RotateCcw, ClipboardPaste, Plus, Send, ArrowLeft,
  ClipboardList, Wallet, Building2, ChevronRight, AlertCircle,
  CheckCircle2, Clock, User, Phone, MapPin, Calendar, Snowflake,
  Hash, Edit3, Camera, FileText, Sparkles, Search, Filter
} from "lucide-react";

const NOW = "10:00";
const PRINCIPAL = { 
  id: "cool_guy", 
  name: "쿨가이", 
  prefix: "A-",
  user: "김쿨가이 대표",
  email: "cool@allit.co.kr",
  color: "#FFB800",
  bg: "rgba(255, 184, 0, 0.10)",
};

const SAMPLE_KAKAO = `성함: 조승빈
주소: 신림동 629-6 / 202호
연락처: 01094294445
가전 종류 및 갯수: 벽걸이에어컨 냉매충전
희망 날짜 및 시간대 (오전/오후):
4/23 오후`;

const MY_TASKS = [
  { 
    id: "A260427-001", customer: "박지영", region: "강남", phone: "010-1234-5678",
    workType: "벽걸이 세척", quantity: 1, address: "강남구 역삼동 ABC아파트 101호",
    status: "완료", engineer: "김동효", scheduled: "2026-04-27 09:00",
    completed: "2026-04-27 10:30", amount: 80000, hasPhoto: true,
    principalFee: 15000,
  },
  { 
    id: "A260427-002", customer: "이상훈", region: "서초", phone: "010-2345-6789",
    workType: "스탠드 세척 + 점검", quantity: 1, address: "서초구 서초동 가나빌라 2층",
    status: "확정", engineer: "김동효", scheduled: "2026-04-27 11:30",
    completed: null, amount: 132000, hasPhoto: false,
    principalFee: 31000,
  },
  { 
    id: "A260427-003", customer: "김미경", region: "송파", phone: "010-3456-7890",
    workType: "냉매충전", quantity: 1, address: "송파구 잠실동 다라타워 305호",
    status: "확정", engineer: "이재현", scheduled: "2026-04-27 14:00",
    completed: null, amount: 100000, hasPhoto: false,
    principalFee: 35000,
  },
  { 
    id: "A260428-001", customer: "조승빈", region: "관악", phone: "010-9429-4445",
    workType: "벽걸이 냉매충전", quantity: 1, address: "신림동 629-6 / 202호",
    status: "약속대기", engineer: "최민수", scheduled: null,
    completed: null, amount: 80000, hasPhoto: false,
    principalFee: 28000,
  },
  { 
    id: "A260428-002", customer: "박은서", region: "강남", phone: "010-5678-9012",
    workType: "벽걸이 + 1way 3대 세척", quantity: 4, address: "강남구 역삼동 마바아파트 1502호",
    status: "미배정", engineer: null, scheduled: null,
    completed: null, amount: 290000, hasPhoto: false,
    principalFee: 60000,
  },
];

const THEMES = {
  dark: {
    name: "🌑 다크",
    bg: "#1A1512", bgElevated: "#221C18", bgInset: "#13100E",
    border: "rgba(255, 220, 200, 0.06)", borderStrong: "rgba(255, 220, 200, 0.10)",
    text: "#FAF8F5", textSecondary: "#C4B5A6", textMuted: "#8A7B6F", textDim: "#5C5048",
    accent: "#FF1B8D", accentBg: "rgba(255, 27, 141, 0.10)",
    success: "#10B981", successBg: "rgba(16, 185, 129, 0.10)",
    warning: "#FFB800", warningBg: "rgba(255, 184, 0, 0.10)",
    danger: "#EF4444", dangerBg: "rgba(239, 68, 68, 0.10)",
    info: "#3B82F6", infoBg: "rgba(59, 130, 246, 0.10)",
    isLight: false,
  },
  light: {
    name: "☀️ 라이트",
    bg: "#FAFAFA", bgElevated: "#FFFFFF", bgInset: "#F4F4F5",
    border: "rgba(0, 0, 0, 0.05)", borderStrong: "rgba(0, 0, 0, 0.09)",
    text: "#0A0A0A", textSecondary: "#404040", textMuted: "#737373", textDim: "#A3A3A3",
    accent: "#E91860", accentBg: "rgba(233, 24, 96, 0.06)",
    success: "#16A34A", successBg: "rgba(22, 163, 74, 0.08)",
    warning: "#D97706", warningBg: "rgba(217, 119, 6, 0.08)",
    danger: "#DC2626", dangerBg: "rgba(220, 38, 38, 0.06)",
    info: "#2563EB", infoBg: "rgba(37, 99, 235, 0.06)",
    isLight: true,
  },
};

function parseKakao(text) {
  const result = { name: "", phone: "", address: "", workType: "", quantity: 1, dateText: "", timeText: "", raw: text };
  if (!text || !text.trim()) return result;
  
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    
    if (line.includes("성함") || line.includes("이름") || line.includes("고객명")) {
      const m = line.split(/[:：]/);
      if (m.length > 1) result.name = m.slice(1).join(":").trim();
    }
    else if (line.includes("연락처") || line.includes("전화") || line.includes("번호")) {
      const m = line.match(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/);
      if (m) {
        const nums = m[0].replace(/\D/g, "");
        if (nums.length === 11) result.phone = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
        else if (nums.length === 10) result.phone = `${nums.slice(0,3)}-${nums.slice(3,6)}-${nums.slice(6)}`;
      }
    }
    else if (line.includes("주소") || line.includes("주소지") || line.includes("위치")) {
      const m = line.split(/[:：]/);
      if (m.length > 1) result.address = m.slice(1).join(":").trim();
    }
    else if (line.includes("가전") || line.includes("작업") || line.includes("종류") || line.includes("기종")) {
      const m = line.split(/[:：]/);
      if (m.length > 1) {
        const txt = m.slice(1).join(":").trim();
        result.workType = txt;
        const numMatch = txt.match(/(\d+)\s*[대개]/);
        if (numMatch) result.quantity = parseInt(numMatch[1]);
      }
    }
    else if (line.includes("희망") || line.includes("날짜") || line.includes("시간대")) {
      const next = lines[i+1];
      const target = next || "";
      const dateMatch = target.match(/(\d{1,2})[\/.\-](\d{1,2})|(\d{4}\-\d{1,2}\-\d{1,2})/);
      if (dateMatch) result.dateText = dateMatch[0];
      const timeMatch = target.match(/오전|오후|오후 \d+|아침|점심|저녁/);
      if (timeMatch) result.timeText = timeMatch[0];
    }
  }
  
  return result;
}

export default function PrincipalApp({ user, onLogout }) {
  const [mode, setMode] = useState("dark");
  const [tab, setTab] = useState("list");
  const [submitted, setSubmitted] = useState(false);
  const [submittedTask, setSubmittedTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const t = THEMES[mode];

  const reset = () => {
    setTab("list");
    setSubmitted(false);
    setSubmittedTask(null);
    setSelectedTask(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@01ff0283e4f6c01667e0c819cfe9d2e933020d3a/css/SpoqaHanSansNeo.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: slideUp 0.4s ease-out; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .clickable { cursor: pointer; transition: all 0.15s; }
        .clickable:active { opacity: 0.7; transform: scale(0.98); }
        .tab-btn:hover { opacity: 0.8; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(10,10,10,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginBottom: 6, textAlign: "center", fontFamily: "system-ui", fontWeight: 600 }}>
          🏪 원청 대표님 화면
        </div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textAlign: "center", fontFamily: "system-ui", lineHeight: 1.5 }}>
          카톡 자동 파싱 (자기 회사 작업만)
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
        <button onClick={onLogout} style={{ width: "100%", padding: "6px 8px", background: "rgba(255,255,255,0.03)", color: "#aaa", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <RotateCcw size={10}/><span>로그아웃 (다른 계정으로 로그인)</span>
        </button>
      </div>

      <div style={{ maxWidth: 420, margin: "0 auto", background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Spoqa Han Sans Neo', sans-serif", paddingBottom: 80 }}>
        
        <Header t={t}/>

        {selectedTask ? (
          <TaskDetail t={t} task={selectedTask} onBack={() => setSelectedTask(null)}/>
        ) : submittedTask ? (
          <SubmittedScreen t={t} task={submittedTask} onContinue={() => { setSubmittedTask(null); setTab("list"); }}/>
        ) : (
          <>
            {tab === "list" && <ListTab t={t} onSelect={setSelectedTask}/>}
            {tab === "new" && <NewTab t={t} onSubmit={(task) => setSubmittedTask(task)}/>}
            {tab === "settle" && <SettleTab t={t}/>}
            {tab === "info" && <InfoTab t={t}/>}
          </>
        )}

        {!selectedTask && !submittedTask && (
          <BottomNav t={t} tab={tab} onChange={setTab}/>
        )}
      </div>
    </div>
  );
}

function Header({ t }) {
  return (
    <div style={{ padding: "20px 20px 0" }}>
      <div style={{ 
        background: PRINCIPAL.bg,
        border: `1px solid ${PRINCIPAL.color}30`,
        borderRadius: 14, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: PRINCIPAL.color, color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Building2 size={20}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{PRINCIPAL.name}</div>
          <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>
            {PRINCIPAL.user}님 · 자기 작업만 보입니다
          </div>
        </div>
        <span style={{ 
          fontSize: 10, fontWeight: 800, padding: "4px 8px",
          background: PRINCIPAL.color + "20", color: PRINCIPAL.color,
          borderRadius: 100,
        }}>
          원청
        </span>
      </div>
    </div>
  );
}

function BottomNav({ t, tab, onChange }) {
  const tabs = [
    { id: "list", icon: ClipboardList, label: "내 작업" },
    { id: "new", icon: Plus, label: "신규 접수" },
    { id: "settle", icon: Wallet, label: "정산" },
    { id: "info", icon: User, label: "내 정보" },
  ];
  return (
    <div style={{ 
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 420,
      background: t.bgElevated, borderTop: `1px solid ${t.border}`,
      display: "flex", padding: "8px 8px 12px",
      zIndex: 100,
    }}>
      {tabs.map(b => {
        const Icon = b.icon;
        const active = tab === b.id;
        const isPlus = b.id === "new";
        return (
          <button key={b.id} onClick={() => onChange(b.id)} className="tab-btn" style={{
            flex: 1, background: "transparent", border: "none",
            padding: "8px 6px", cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            color: active ? t.accent : t.textMuted,
          }}>
            <div style={{
              width: isPlus ? 36 : 24, height: isPlus ? 36 : 24,
              borderRadius: isPlus ? 12 : 0,
              background: isPlus ? (active ? t.accent : t.accentBg) : "transparent",
              color: isPlus ? (active ? "white" : t.accent) : (active ? t.accent : t.textMuted),
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={isPlus ? 18 : 18}/>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function NewTab({ t, onSubmit }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [showFields, setShowFields] = useState(false);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [workType, setWorkType] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dateText, setDateText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [memo, setMemo] = useState("");
  
  const formatPhone = (val) => {
    const nums = val.replace(/\D/g, "").slice(0, 11);
    if (nums.length < 4) return nums;
    if (nums.length < 8) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
  };
  
  const handleParse = () => {
    const result = parseKakao(text);
    setParsed(result);
    setName(result.name);
    setPhone(result.phone);
    setAddress(result.address);
    setWorkType(result.workType);
    setQuantity(result.quantity);
    setDateText(result.dateText);
    setTimeText(result.timeText);
    setShowFields(true);
  };
  
  const useSample = () => {
    setText(SAMPLE_KAKAO);
  };
  
  const submit = () => {
    const newTask = {
      id: `${PRINCIPAL.prefix}260428-${String(Math.floor(Math.random() * 900) + 100)}`,
      customer: name, phone, address, workType, quantity,
      region: address.split(/[구동]/)[0]?.trim() || "기타",
      status: "미배정", engineer: null,
      scheduled: dateText && timeText ? `${dateText} ${timeText}` : null,
      memo,
    };
    onSubmit(newTask);
  };
  
  const canSubmit = name && phone && address && workType;

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📝 신규 접수</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          카톡 메시지 붙여넣기 → 자동 입력 ✨
        </div>
      </div>

      {!showFields && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
                💬 카톡 텍스트
              </div>
              <button onClick={useSample} style={{
                fontSize: 11, fontWeight: 600, color: t.accent,
                background: "transparent", border: "none", cursor: "pointer",
                fontFamily: "inherit",
              }}>
                예시 데이터 ↗
              </button>
            </div>
            <textarea
              placeholder={`고객 카톡 메시지를 그대로 붙여넣으세요\n\n예: 성함: 홍길동\n주소: 강남구 역삼동\n연락처: 010-1234-5678\n작업: 벽걸이 세척\n희망: 4/30 오후`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: "100%", minHeight: 220,
                padding: "14px 16px",
                background: t.bgElevated, color: t.text,
                border: `1.5px solid ${text ? t.accent : t.border}`,
                borderRadius: 12, fontSize: 13,
                lineHeight: 1.6, boxSizing: "border-box", outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          <button
            onClick={handleParse}
            disabled={!text.trim()}
            style={{
              width: "100%", padding: "16px",
              background: text.trim() ? t.accent : t.bgInset,
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

          <div style={{ marginTop: 16, padding: "12px 14px", background: t.bgElevated, borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
              💡 자동 파싱하는 항목
            </div>
            <div style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.7 }}>
              · 성함 / 이름<br/>
              · 연락처 (전화번호 자동 인식)<br/>
              · 주소<br/>
              · 작업 종류 + 수량<br/>
              · 희망 날짜 / 시간대
            </div>
          </div>

          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button onClick={() => setShowFields(true)} style={{
              fontSize: 12, fontWeight: 600, color: t.textMuted,
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit", padding: "6px 0",
            }}>
              직접 입력하기 →
            </button>
          </div>
        </>
      )}

      {showFields && (
        <div className="fade-in">
          <div style={{
            background: t.successBg, border: `1px solid ${t.success}40`,
            borderRadius: 12, padding: "12px 14px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <CheckCircle2 size={18} style={{ color: t.success, flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: t.success }}>
                자동 파싱 완료!
              </div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                필요 시 수정 후 등록하세요
              </div>
            </div>
            <button onClick={() => setShowFields(false)} style={{
              fontSize: 11, fontWeight: 600, color: t.accent,
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit",
            }}>
              ↩ 다시
            </button>
          </div>

          <Field t={t} label="고객명" icon={User} value={name} onChange={setName} placeholder="이름 입력"/>
          <Field t={t} label="연락처" icon={Phone} value={phone} onChange={(v) => setPhone(formatPhone(v))} placeholder="010-0000-0000" mono/>
          <Field t={t} label="주소" icon={MapPin} value={address} onChange={setAddress} placeholder="시/구/동/번지" multiline/>
          <Field t={t} label="작업 종류" icon={Snowflake} value={workType} onChange={setWorkType} placeholder="예: 벽걸이 세척, 냉매충전"/>
          
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <Field t={t} label="수량" icon={Hash} value={quantity} onChange={(v) => setQuantity(parseInt(v) || 1)} placeholder="1" mono/>
            </div>
            <div style={{ flex: 2 }}>
              <Field t={t} label="희망 날짜" icon={Calendar} value={dateText} onChange={setDateText} placeholder="4/30"/>
            </div>
          </div>

          <Field t={t} label="희망 시간대" icon={Clock} value={timeText} onChange={setTimeText} placeholder="오전 / 오후"/>
          <Field t={t} label="메모 (선택)" icon={FileText} value={memo} onChange={setMemo} placeholder="추가 요청사항" multiline/>

          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              width: "100%", padding: "16px", marginTop: 8,
              background: canSubmit ? t.accent : t.bgInset,
              color: canSubmit ? "white" : t.textMuted,
              border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: "inherit",
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

function Field({ t, label, icon: Icon, value, onChange, placeholder, mono, multiline }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ position: "relative" }}>
        <Icon size={14} style={{ position: "absolute", left: 14, top: multiline ? 14 : "50%", transform: multiline ? "none" : "translateY(-50%)", color: t.textMuted }}/>
        {multiline ? (
          <textarea
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "100%", minHeight: 64,
              padding: "12px 14px 12px 38px",
              background: t.bgElevated, color: t.text,
              border: `1.5px solid ${value ? t.accent : t.border}`,
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              boxSizing: "border-box", outline: "none",
              resize: "vertical",
              fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
            }}
          />
        ) : (
          <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px 12px 38px",
              background: t.bgElevated, color: t.text,
              border: `1.5px solid ${value ? t.accent : t.border}`,
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              boxSizing: "border-box", outline: "none",
              fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
            }}
          />
        )}
      </div>
    </div>
  );
}

function SubmittedScreen({ t, task, onContinue }) {
  return (
    <div className="fade-in" style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: t.successBg, border: `2px solid ${t.success}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24,
      }}>
        <CheckCircle2 size={36} style={{ color: t.success }}/>
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
        접수 완료!
      </div>
      <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500, marginBottom: 30, lineHeight: 1.6 }}>
        올잇 운영팀에 접수되었어요<br/>
        곧 해피콜 후 기사 배정될 예정이에요
      </div>

      <div style={{
        background: t.bgElevated,
        borderRadius: 14, padding: "20px",
        marginBottom: 20, textAlign: "left",
      }}>
        <div className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 12 }}>
          {task.id}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Row t={t} label="고객" value={task.customer}/>
          <Row t={t} label="연락처" value={task.phone} mono/>
          <Row t={t} label="주소" value={task.address}/>
          <Row t={t} label="작업" value={`${task.workType} (${task.quantity}대)`}/>
          {task.scheduled && <Row t={t} label="희망일" value={task.scheduled}/>}
        </div>
      </div>

      <div style={{
        background: t.accentBg, border: `1px solid ${t.accent}40`,
        borderRadius: 12, padding: "12px 14px", marginBottom: 24,
        textAlign: "left",
      }}>
        <div style={{ fontSize: 11, color: t.accent, fontWeight: 700, marginBottom: 4 }}>
          📲 다음 단계
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.6 }}>
          1. 올잇 운영팀에 접수됨<br/>
          2. 해피콜 → 일정 확정<br/>
          3. 기사 배정 → 작업 진행<br/>
          4. 완료 사진 + 정산 내역 자동 업데이트
        </div>
      </div>

      <button onClick={onContinue} style={{
        width: "100%", padding: "16px",
        background: t.accent, color: "white",
        border: "none", borderRadius: 12,
        fontSize: 14, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        내 작업 리스트 보기
      </button>
    </div>
  );
}

function Row({ t, label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 12, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ListTab({ t, onSelect }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  
  let filtered = filter === "all" ? MY_TASKS : MY_TASKS.filter(x => x.status === filter);
  if (search) {
    filtered = filtered.filter(x => 
      x.customer.includes(search) || x.address.includes(search) || x.id.includes(search)
    );
  }
  
  const stats = {
    total: MY_TASKS.length,
    inProgress: MY_TASKS.filter(x => ["미배정", "약속대기", "확정", "진행중"].includes(x.status)).length,
    completed: MY_TASKS.filter(x => x.status === "완료").length,
  };

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📋 내 작업 리스트</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          {PRINCIPAL.name}이(가) 등록한 모든 작업
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <Stat t={t} label="전체" value={stats.total} color={t.text}/>
        <Stat t={t} label="진행중" value={stats.inProgress} color={t.warning}/>
        <Stat t={t} label="완료" value={stats.completed} color={t.success}/>
      </div>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
        <input
          type="text"
          placeholder="고객명 / 주소 / 작업번호"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px 10px 38px",
            background: t.bgElevated, color: t.text,
            border: `1px solid ${t.border}`,
            borderRadius: 10, fontSize: 12,
            boxSizing: "border-box", outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "미배정", "약속대기", "확정", "완료"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 12px",
            background: filter === f ? t.accent : t.bgInset,
            color: filter === f ? "white" : t.text,
            border: `1px solid ${filter === f ? t.accent : t.border}`,
            borderRadius: 8, fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {f === "all" ? "전체" : f}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
            검색 결과가 없어요
          </div>
        ) : filtered.map(task => (
          <TaskCard key={task.id} t={t} task={task} onClick={() => onSelect(task)}/>
        ))}
      </div>
    </div>
  );
}

function Stat({ t, label, value, color }) {
  return (
    <div style={{ padding: "10px 12px", background: t.bgElevated, borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function TaskCard({ t, task, onClick }) {
  const statusStyle = {
    "완료": { color: t.success, bg: t.successBg },
    "진행중": { color: t.warning, bg: t.warningBg },
    "확정": { color: t.text, bg: t.bgInset },
    "약속대기": { color: t.accent, bg: t.accentBg },
    "미배정": { color: t.danger, bg: t.dangerBg },
  };
  const ss = statusStyle[task.status] || { color: t.textMuted, bg: t.bgInset };

  return (
    <div onClick={onClick} className="clickable" style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 4 }}>
            {task.id}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>
            {task.customer} <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>· {task.region}</span>
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 4 }}>
            {task.workType} ({task.quantity}대)
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "4px 9px",
          background: ss.bg, color: ss.color,
          borderRadius: 5, flexShrink: 0,
        }}>
          {task.status}
        </span>
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 11, color: t.textMuted }}>
          {task.engineer ? <span>👤 {task.engineer}</span> : <span>배정 대기</span>}
          {task.scheduled && <span> · {task.scheduled.split(" ")[0]}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {task.principalFee > 0 && (
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: PRINCIPAL.color }}>
              +₩{(task.principalFee / 1000).toFixed(0)}K
            </span>
          )}
          <ChevronRight size={14} style={{ color: t.textMuted }}/>
        </div>
      </div>
    </div>
  );
}

function TaskDetail({ t, task, onBack }) {
  const statusStyle = {
    "완료": { color: t.success, bg: t.successBg },
    "진행중": { color: t.warning, bg: t.warningBg },
    "확정": { color: t.text, bg: t.bgInset },
    "약속대기": { color: t.accent, bg: t.accentBg },
    "미배정": { color: t.danger, bg: t.dangerBg },
  };
  const ss = statusStyle[task.status];

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <button onClick={onBack} className="clickable" style={{
        background: "transparent", border: "none", color: t.textMuted,
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        padding: "6px 0", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <ArrowLeft size={14}/><span>리스트로 돌아가기</span>
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span className="mono" style={{ fontSize: 12, color: t.textMuted, fontWeight: 700 }}>
            {task.id}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "4px 10px",
            background: ss.bg, color: ss.color,
            borderRadius: 100,
          }}>
            {task.status}
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          {task.customer}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
          {task.workType} ({task.quantity}대)
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
          📋 작업 정보
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DetailRow t={t} icon={Phone} label="연락처" value={task.phone} mono/>
          <DetailRow t={t} icon={MapPin} label="주소" value={task.address}/>
          <DetailRow t={t} icon={Hash} label="수량" value={`${task.quantity}대`}/>
          {task.scheduled && <DetailRow t={t} icon={Calendar} label="예정일시" value={task.scheduled}/>}
          {task.engineer && <DetailRow t={t} icon={User} label="배정 기사" value={task.engineer}/>}
          {task.completed && <DetailRow t={t} icon={CheckCircle2} label="완료일시" value={task.completed} color={t.success}/>}
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
          💰 금액 정보
        </div>
        
        <div style={{ marginBottom: 12, padding: "14px 16px", background: t.bgInset, borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>고객 결제 금액</span>
            <span className="mono" style={{ fontSize: 18, fontWeight: 800 }}>
              ₩{task.amount.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ 
          padding: "14px 16px", 
          background: PRINCIPAL.bg,
          border: `1.5px solid ${PRINCIPAL.color}40`,
          borderRadius: 10,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: PRINCIPAL.color }}>
              🏪 내({PRINCIPAL.name}) 수수료
            </span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: PRINCIPAL.color }}>
              ₩{(task.principalFee || 0).toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: 10, color: t.textMuted }}>
            차감후 50% 수수료 정책
          </div>
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: t.textMuted, lineHeight: 1.5 }}>
            <span>🔐</span>
            <span>{task.status === "완료" ? "정산 가능 (매일 정산)" : "작업 완료 시 정산 처리"}</span>
          </div>
        </div>
      </div>

      {task.hasPhoto && (
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
            📸 완료 사진
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[1, 2].map(i => (
              <div key={i} style={{
                aspectRatio: "1", background: t.bgInset, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: t.textMuted,
              }}>
                <Camera size={24}/>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 8, textAlign: "center" }}>
            (실제 환경에서 사진 표시)
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ t, icon: Icon, label, value, mono, color }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <Icon size={14} style={{ color: t.textMuted, marginTop: 2, flexShrink: 0 }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>
          {label}
        </div>
        <div className={mono ? "mono" : ""} style={{ fontSize: 13, fontWeight: 700, color: color || t.text }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function SettleTab({ t }) {
  const [period, setPeriod] = useState("today");
  const [view, setView] = useState("completed");
  
  const today = "2026-04-27";
  
  const completed = MY_TASKS.filter(x => x.status === "완료");
  const inProgress = MY_TASKS.filter(x => ["확정", "진행중", "약속대기"].includes(x.status));
  
  const todayCompleted = completed.filter(x => x.completed?.startsWith(today));
  const todayInProgress = inProgress.filter(x => x.scheduled?.startsWith(today));
  
  const periodCompleted = period === "today" ? todayCompleted : completed;
  const periodInProgress = period === "today" ? todayInProgress : inProgress;
  
  const completedFee = periodCompleted.reduce((sum, x) => sum + (x.principalFee || 0), 0);
  const expectedFee = periodInProgress.reduce((sum, x) => sum + (x.principalFee || 0), 0);
  const completedTotal = periodCompleted.reduce((sum, x) => sum + x.amount, 0);
  const expectedTotal = periodInProgress.reduce((sum, x) => sum + x.amount, 0);
  
  const showTasks = view === "completed" ? periodCompleted : periodInProgress;
  
  const periodLabel = period === "today" ? "오늘" : period === "week" ? "이번주" : "이번달";

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>💰 내 수수료</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          {PRINCIPAL.name}이(가) 받는 수수료 · 매일 정산
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { id: "today", label: "오늘", desc: "4/27" },
          { id: "week", label: "이번주", desc: "4/21~27" },
          { id: "month", label: "이번달", desc: "4월" },
        ].map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            flex: 1, padding: "10px 6px",
            background: period === p.id ? t.accent : t.bgInset,
            color: period === p.id ? "white" : t.text,
            border: `1px solid ${period === p.id ? t.accent : t.border}`,
            borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{p.label}</div>
            <div style={{ fontSize: 9, opacity: 0.7 }}>{p.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ 
        background: PRINCIPAL.bg, 
        border: `1.5px solid ${PRINCIPAL.color}40`, 
        borderRadius: 16, padding: "20px", marginBottom: 12 
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: PRINCIPAL.color, letterSpacing: 1, textTransform: "uppercase" }}>
            🏪 {periodLabel} 받을 수수료
          </div>
          {period === "today" && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", background: t.success, color: "white", borderRadius: 100 }}>
              매일 정산
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
          <span className="mono" style={{ fontSize: 32, fontWeight: 800, color: PRINCIPAL.color }}>
            ₩{completedFee.toLocaleString()}
          </span>
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary }}>
          완료 {periodCompleted.length}건 · 고객 결제 ₩{completedTotal.toLocaleString()}
        </div>
        {period === "today" && completedFee > 0 && (
          <div style={{ marginTop: 12, padding: "8px 10px", background: t.successBg, borderRadius: 8, fontSize: 11, color: t.success, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={12}/>
            <span>다음 영업일에 입금 예정</span>
          </div>
        )}
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
          ⏳ 진행 중 (예상 수수료)
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>예상 수수료</span>
          <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: t.warning }}>
            ₩{expectedFee.toLocaleString()}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: t.textMuted }}>예상 결제</span>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
            ₩{expectedTotal.toLocaleString()} ({periodInProgress.length}건)
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setView("completed")} style={{
          flex: 1, padding: "8px",
          background: view === "completed" ? t.accent : t.bgInset,
          color: view === "completed" ? "white" : t.text,
          border: `1px solid ${view === "completed" ? t.accent : t.border}`,
          borderRadius: 8, fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          완료 ({periodCompleted.length})
        </button>
        <button onClick={() => setView("progress")} style={{
          flex: 1, padding: "8px",
          background: view === "progress" ? t.accent : t.bgInset,
          color: view === "progress" ? "white" : t.text,
          border: `1px solid ${view === "progress" ? t.accent : t.border}`,
          borderRadius: 8, fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          진행 중 ({periodInProgress.length})
        </button>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
          📋 작업별 수수료
        </div>
        {showTasks.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
            {view === "completed" ? `${periodLabel} 완료 작업이 없어요` : `${periodLabel} 진행 중 작업이 없어요`}
          </div>
        ) : showTasks.map((task, idx) => (
          <div key={task.id} style={{ 
            padding: "12px 0",
            borderBottom: idx < showTasks.length - 1 ? `1px solid ${t.border}` : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{task.customer}</div>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                  {task.workType} · {task.completed?.split(" ")[1]?.slice(0,5) || task.scheduled?.split(" ")[1]?.slice(0,5) || "예정 미정"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: PRINCIPAL.color }}>
                  ₩{(task.principalFee || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: t.textMuted, marginTop: 2 }}>
                  결제 ₩{task.amount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, padding: "12px 14px", background: t.infoBg, border: `1px solid ${t.info}30`, borderRadius: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.info, marginBottom: 6 }}>
          💡 수수료 정책
        </div>
        <div style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.7 }}>
          {PRINCIPAL.name}은(는) <strong style={{ color: t.text }}>차감후 50% 비율</strong>로 정산됩니다.<br/>
          매일 영업일 다음날 입금 처리됩니다.
        </div>
      </div>
    </div>
  );
}

function InfoTab({ t }) {
  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>👤 내 정보</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          쿨가이 대표님
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "20px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: PRINCIPAL.color, color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Building2 size={28}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{PRINCIPAL.name}</div>
            <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
              {PRINCIPAL.user}님
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
          <Row t={t} label="작업번호 형식" value={`${PRINCIPAL.prefix}YYMMDD-NNN`} mono/>
          <Row t={t} label="이메일" value={PRINCIPAL.email} mono/>
          <Row t={t} label="권한" value="대표 (자기 회사만)"/>
        </div>
      </div>

      <div style={{ background: t.infoBg, border: `1px solid ${t.info}30`, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.info, marginBottom: 8 }}>
          🔒 보안 안내
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.7 }}>
          · {PRINCIPAL.name} 작업만 보입니다<br/>
          · 다른 원청 데이터 접근 X<br/>
          · 운영팀(올잇)이 모니터링 중<br/>
          · 30일 자동 로그인 유지
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
          📞 문의
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.7 }}>
          시스템 관련: 올잇 운영팀<br/>
          긴급 작업: 카카오톡 운영팀<br/>
          이메일: support@allit.co.kr
        </div>
      </div>
    </div>
  );
}
