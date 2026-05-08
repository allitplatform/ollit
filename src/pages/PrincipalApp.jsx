import { useState, useEffect } from "react";
import { createTask, getTasks } from "../api.js";
import {
  Sun, Moon, RotateCcw, ClipboardPaste, Plus, Send, ArrowLeft,
  ClipboardList, Wallet, Building2, ChevronRight, AlertCircle,
  CheckCircle2, Clock, User, Phone, MapPin, Calendar, Snowflake,
  Hash, Edit3, Camera, FileText, Sparkles, Search, Filter, DollarSign
} from "lucide-react";
import { useTasks } from "../shared/TasksContext.jsx";
import { filterTasksForPrincipal } from "../shared/tasks.js";
import { v14NormalizeTask, v14FindTaskList } from "../utils/v14Task.js";

const NOW = "10:00";

// V14 Phase 4-F-1 — 헤더 양식 통일 (AdminApp 패턴 / 페이지 진입 시점 동적 날짜)
const TODAY = (() => {
  const d = new Date();
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const date = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return `${day} · ${date} ${month}`;
})();

// V14 Phase 5-A 보완 — 한국어 조사 자동 처리 (받침 유무로 분기)
// 한글 음절(0xAC00~0xD7A3): (코드 - 0xAC00) % 28 !== 0 → 받침 있음
function josa(word, withFinal, withoutFinal) {
  if (!word) return withoutFinal;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xAC00 || last > 0xD7A3) return withoutFinal;
  const hasFinal = (last - 0xAC00) % 28 !== 0;
  return hasFinal ? withFinal : withoutFinal;
}

const PRINCIPAL = {
  id: "cool_guy", 
  name: "쿨가이", 
  prefix: "A-",
  user: "쿨가이 대표",
  email: "cool@allit.co.kr",
  color: "#FFB800",
  bg: "rgba(255, 184, 0, 0.10)",
};

const SAMPLES = [
  {
    label: "정형",
    text: `성함: 조승빈
주소: 신림동 629-6 / 202호
연락처: 01094294445
가전 종류 및 갯수: 벽걸이에어컨 냉매충전
희망 날짜 및 시간대 (오전/오후):
4/23 오후`,
  },
  {
    label: "막무가내",
    text: `외도민: 논현동 97-2 103호
현관 비번 860903
아니 스탠드1 벽걸이1
+82 10-9053-9590
가격은 17
현장결제
비고: 다음주중 날잡아주세요!`,
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
    danger: "#FF3D5A", dangerBg: "rgba(239, 68, 68, 0.10)",
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
    warning: "#FF1B8D", warningBg: "rgba(217, 119, 6, 0.08)",
    danger: "#FF3D5A", dangerBg: "rgba(220, 38, 38, 0.06)",
    info: "#2563EB", infoBg: "rgba(37, 99, 235, 0.06)",
    isLight: true,
  },
};

// ──────────────────────────────────────────────────────────
// 카톡 파서 (parseKakao) - v2: 막무가내 메시지 + 폴백 지원
// ──────────────────────────────────────────────────────────

const PHONE_PATTERNS = [
  /\+?82[-\s]?(?:0)?(10)[-\s]?(\d{3,4})[-\s]?(\d{4})/,   // +82 10-...
  /(01[016789])[-\s]?(\d{3,4})[-\s]?(\d{4})/,             // 010-... / 010 ...
  /(01[016789])(\d{7,8})/,                                 // 01094294445
];

function isPhoneInLine(line) {
  return PHONE_PATTERNS.some((re) => re.test(line));
}

function fmtPhone(nums) {
  const digits = nums.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  return digits;
}

function extractPhone(text) {
  let m = text.match(PHONE_PATTERNS[0]);
  if (m) return fmtPhone("0" + m[1] + m[2] + m[3]);
  m = text.match(PHONE_PATTERNS[1]);
  if (m) return fmtPhone(m[1] + m[2] + m[3]);
  m = text.match(PHONE_PATTERNS[2]);
  if (m) return fmtPhone(m[1] + m[2]);
  return "";
}

function looksLikeAddress(s) {
  if (!s) return false;
  return /[가-힣]+(시|구|동|로|길)(\s|$|[^가-힣])/.test(s)
      || /\d+호/.test(s)
      || /아파트|빌라|타워|단지|번지/.test(s);
}

// 가격 단위 정책:
//   "17만"/"17만원" → 170,000   (만 명시)
//   "170000원"/"170,000원" → 170,000   (원 명시, 그대로)
//   단위 없음 + 숫자 < 1000 → 만원으로 해석 (17 → 170,000)
//   단위 없음 + 숫자 ≥ 1000 → 원 그대로 (50000 → 50,000)
function parsePrice(text) {
  if (!text) return null;
  const s = String(text).replace(/\s/g, "");
  if (!/\d/.test(s)) return null;

  const hasMan = /만/.test(s);
  const hasWon = /원/.test(s);

  const m = s.match(/[\d,]+/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/,/g, ""), 10);
  if (isNaN(n)) return null;

  if (hasMan) return n * 10000;
  if (hasWon) return n;
  return n < 1000 ? n * 10000 : n;
}

function parseKakao(text) {
  const result = {
    name: "", phone: "", address: "", workType: "", quantity: 1,
    dateText: "", timeText: "", estimateTotal: null, memo: "", raw: text,
  };
  if (!text || !text.trim()) return result;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const consumed = new Set();

  // ── 1. Phone (전체 텍스트에서 검색) ──
  result.phone = extractPhone(text);

  // ── 2. 라벨 있는 줄 처리 ──
  // 라벨 길이는 30자까지 허용 ("희망 날짜 및 시간대 (오전/오후):" 같은 긴 라벨 대응)
  const labelRe = /^(.{1,30}?)\s*[:：]\s*(.*)$/;
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const m = lines[i].match(labelRe);
    if (!m) continue;
    const label = m[1].trim();
    const value = m[2].trim();

    // 희망/날짜/시간 - 빈 값이면 다음 줄 참조
    if (/희망|날짜|시간/.test(label)) {
      const target = value || lines[i + 1] || "";
      const dm = target.match(/\d{1,2}[\/.\-]\d{1,2}|\d{4}-\d{1,2}-\d{1,2}/);
      if (dm) result.dateText = dm[0];
      const tm = target.match(/오전|오후|아침|점심|저녁|낮/);
      if (tm) result.timeText = tm[0];
      consumed.add(i);
      if (!value && lines[i + 1]) consumed.add(i + 1);
      continue;
    }

    if (!value) continue;

    if (/성함|이름|고객명/.test(label) && !result.name) {
      result.name = value;
      consumed.add(i);
    } else if (/연락처|전화|번호|핸드폰/.test(label)) {
      consumed.add(i); // 폰은 step 1에서 추출됨
    } else if (/주소|위치/.test(label) && !result.address) {
      result.address = value;
      consumed.add(i);
    } else if (/가전|작업|종류|기종/.test(label) && !result.workType) {
      result.workType = value;
      const qm = value.match(/(\d+)\s*[대개]/);
      if (qm) result.quantity = parseInt(qm[1], 10);
      consumed.add(i);
    } else if (/비고|메모|요청|특이/.test(label)) {
      result.memo = result.memo ? result.memo + " / " + value : value;
      consumed.add(i);
    } else if (/가격|금액|견적|비용/.test(label)) {
      const p = parsePrice(value);
      if (p !== null) result.estimateTotal = p;
      consumed.add(i);
    } else if (label.length <= 6 && !result.name) {
      // 짧은 라벨 + 주소/폰 = 닉네임 패턴 (예: "외도민: 논현동 97-2 103호")
      if (isPhoneInLine(value)) {
        result.name = label;
        consumed.add(i);
      } else if (looksLikeAddress(value)) {
        result.name = label;
        if (!result.address) result.address = value;
        consumed.add(i);
      }
    }
  }

  // ── 3. 폰만 있는 줄 정리 (메모로 새지 않게) ──
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const stripped = lines[i].replace(/[\s+\-()]/g, "");
    if (/^\d{8,13}$/.test(stripped) && isPhoneInLine(lines[i])) {
      consumed.add(i);
    }
  }

  // ── 4. 작업종류 폴백 (라벨 없을 때 키워드 스캔) ──
  if (!result.workType) {
    const APPLIANCES = ["벽걸이", "스탠드", "시스템", "멀티", "천장", "캐리어", "창문형", "창문"];
    const OPS = ["세척", "설치", "철거", "이전", "냉매충전", "냉매", "점검", "수리", "충전"];
    const found = [];
    const ops = new Set();
    let totalQty = 0;

    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i];
      let hit = false;

      for (const k of APPLIANCES) {
        const re = new RegExp(`${k}\\s*(\\d+)?\\s*[대개]?`, "g");
        let m;
        while ((m = re.exec(line)) !== null) {
          const qty = parseInt(m[1] || "1", 10);
          found.push({ pos: m.index, name: qty > 1 ? `${k} ${qty}대` : k });
          totalQty += qty;
          hit = true;
        }
      }
      for (const k of OPS) {
        if (line.includes(k)) { ops.add(k); hit = true; }
      }
      if (hit) consumed.add(i);
    }

    found.sort((a, b) => a.pos - b.pos);
    const parts = [];
    if (found.length) parts.push(found.map((a) => a.name).join("+"));
    if (ops.size) parts.push([...ops].join("+"));
    if (parts.length) {
      result.workType = parts.join(" ");
      if (totalQty > 0) result.quantity = totalQty;
    }
  }

  // ── 5. 주소 폴백 ──
  if (!result.address) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      if (lines[i].length > 80) continue;
      if (looksLikeAddress(lines[i])) {
        result.address = lines[i];
        consumed.add(i);
        break;
      }
    }
  }

  // ── 6. 날짜/시간 폴백 (전체 스캔) ──
  if (!result.dateText) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const dm = lines[i].match(/\d{1,2}[\/.\-]\d{1,2}/);
      if (dm) { result.dateText = dm[0]; break; }
    }
  }
  if (!result.timeText) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const tm = lines[i].match(/오전|오후|아침|점심|저녁|낮/);
      if (tm) { result.timeText = tm[0]; break; }
    }
  }

  // ── 7. 가격 폴백 (라벨 없는 "가격은 17", "17만원" 등) ──
  if (result.estimateTotal === null) {
    for (let i = 0; i < lines.length; i++) {
      if (consumed.has(i)) continue;
      const line = lines[i];
      const looksLikePrice =
        /가격|금액|견적|비용/.test(line) ||
        /\d\s*만원?(\s|$)/.test(line) ||
        /\d+\s*원(\s|$)/.test(line);
      if (!looksLikePrice) continue;
      const p = parsePrice(line);
      if (p !== null) {
        result.estimateTotal = p;
        consumed.add(i);
        break;
      }
    }
  }

  // ── 8. 메모 (남은 줄들 합침) ──
  const remaining = [];
  for (let i = 0; i < lines.length; i++) {
    if (!consumed.has(i)) remaining.push(lines[i]);
  }
  if (remaining.length) {
    const rest = remaining.join(" / ");
    result.memo = result.memo ? result.memo + " / " + rest : rest;
  }

  // ── 9. 메모/원본에서 상대날짜 힌트 추출 ──
  if (!result.dateText) {
    const src = result.memo || text;
    const rel = src.match(/오늘|내일|모레|이번주|다음주중?|이번달|주말|평일/);
    if (rel) result.dateText = rel[0];
  }

  // ── 10. 이름 폴백: 폰 뒷4자리 ──
  if (!result.name && result.phone) {
    const last4 = result.phone.replace(/\D/g, "").slice(-4);
    if (last4) result.name = `고객(${last4})`;
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
  
  // 공유 task 데이터 (옛 mock fallback)
  const { tasks: allTasks, addTask } = useTasks();

  // V14 — 진짜 시트 catch (apiTasks)
  const [apiTasks, setApiTasks] = useState([]);

  async function fetchTasks() {
    try {
      console.log('[V14 PrincipalApp] fetchTasks 시작 / clientName:', user?.clientName);
      const res = await getTasks('principal', user?.id || 'principal', null);
      if (!res || res.ok === false) return;
      const { list } = v14FindTaskList(res);
      if (!Array.isArray(list)) {
        setApiTasks([]);
        return;
      }
      const normalized = list.map(v14NormalizeTask).filter(Boolean);
      console.log('[V14 PrincipalApp] normalized:', normalized.length, '건');
      setApiTasks(normalized);
    } catch (e) {
      console.error('[V14 PrincipalApp] fetchTasks 에러:', e);
    }
  }

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.clientName]);

  // V14 — 본인 원청 작업만 필터 (clientName 매칭 / apiTasks 우선)
  // 시트 C열 원청 = "쿨가이 (KB)" 박힌 catch / user.clientName = "쿨가이" 박힘
  // → indexOf 매칭 박기 (fuzzy / V14 catch)
  const sourceList = apiTasks.length > 0 ? apiTasks : allTasks;
  const tasks = user?.clientName
    ? sourceList.filter(t => {
        const principal = t.principal || t.client || t.원청 || "";
        return principal === user.clientName
          || principal.indexOf(user.clientName) !== -1
          || user.clientName.indexOf(principal) !== -1;
      })
    : filterTasksForPrincipal(sourceList, user?.clientName);

  const reset = () => {
    setTab("list");
    setSubmitted(false);
    setSubmittedTask(null);
    setSelectedTask(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A" }}>
      <style>{`
        
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: slideUp 0.4s ease-out; }
        .mono { font-family: inherit; }
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

      <div style={{ maxWidth: 420, margin: "0 auto", background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Pretendard', sans-serif", paddingBottom: 80 }}>
        
        <Header t={t} user={user}/>

        {selectedTask ? (
          <TaskDetail t={t} task={selectedTask} onBack={() => setSelectedTask(null)}/>
        ) : submittedTask ? (
          <SubmittedScreen t={t} task={submittedTask} onContinue={() => { setSubmittedTask(null); setTab("list"); }}/>
        ) : (
          <>
            {tab === "list" && <ListTab t={t} onSelect={setSelectedTask} tasks={tasks}/>}
            {tab === "new" && <NewTab t={t} onSubmit={(task) => setSubmittedTask(task)} addTask={addTask}/>}
            {tab === "settle" && <SettleTab t={t} tasks={tasks}/>}
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

function Header({ t, user }) {
  return (
    <div style={{ padding: "20px 20px 0" }}>
      <div style={{ marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>
          {TODAY} · {NOW}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          안녕하세요, <span style={{ color: t.accent }}>{user?.name || PRINCIPAL.name}</span>님
        </div>
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

function NewTab({ t, onSubmit, addTask }) {
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
  const [estimateTotal, setEstimateTotal] = useState("");
  
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
    setEstimateTotal(result.estimateTotal != null ? String(result.estimateTotal) : "");
    setMemo(result.memo || "");
    setShowFields(true);
  };
  
  const useSample = (idx) => {
    setText(SAMPLES[idx].text);
  };
  
  const [submitting, setSubmitting] = useState(false);
  
  const submit = () => {
    if (submitting) return;
    setSubmitting(true);
    
    try {
      // 시뮬: addTask로 직접 추가 (백엔드 연결 시 fetch로 교체)
      const dateStr = new Date().toISOString().slice(2,10).replace(/-/g, "");
      const taskId = `A${dateStr}-${String(Math.floor(Math.random() * 999) + 100)}`;
      
      const newTask = {
        id: taskId,
        client: "쿨가이",
        customer: name, phone, address, fullAddress: address,
        workType, appliance: "", qty: quantity,
        requestedDate: dateText || null,
        requestedTime: timeText || null,
        receivedAt: new Date().toLocaleString("ko-KR"),
        receivedAgo: "방금",
        channel: "카톡",
        happycallStatus: "uncontacted",
        happycallMemo: "",
        requestNote: memo,
        assignedEngineer: null, assignedEngineerId: null,
        recommendedEngineer: null,
        scheduledDate: null, scheduledTime: null,
        status: "약속대기",
        startedAt: null, completedAt: null,
        estimateTotal: null,
        productPrice: parseInt(estimateTotal) || 0, travelFee: 0, extraFee: 0, extraReason: "",
        commissionRate: 50, commission: 0, engineerNet: 0,
        workMemo: "", beforePhoto: false, afterPhoto: false,
        scheduleHistory: [],
        isUrgent: false,
      };
      
      addTask(newTask);
      onSubmit(newTask);
    } catch (err) {
      alert("등록 오류: " + err.message);
    } finally {
      setSubmitting(false);
    }
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
              <div style={{ display: "flex", gap: 12 }}>
                {SAMPLES.map((s, i) => (
                  <button key={i} onClick={() => useSample(i)} style={{
                    fontSize: 11, fontWeight: 600, color: t.accent,
                    background: "transparent", border: "none", cursor: "pointer",
                    fontFamily: "inherit",
                  }}>
                    {s.label} ↗
                  </button>
                ))}
              </div>
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
              <Field t={t} label="희망 날짜" icon={Calendar} value={dateText} onChange={setDateText} placeholder="(선택) 4/30"/>
            </div>
          </div>

          <Field t={t} label="희망 시간대" icon={Clock} value={timeText} onChange={setTimeText} placeholder="(선택) 오전 / 오후"/>
          <Field t={t} label="예상 금액 (선택)" icon={DollarSign} value={estimateTotal} onChange={(v) => setEstimateTotal(v.replace(/[^0-9]/g, ""))} placeholder="200000" mono/>
          <Field t={t} label="메모 (선택)" icon={FileText} value={memo} onChange={setMemo} placeholder="추가 요청사항" multiline/>

          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            style={{
              width: "100%", padding: "16px", marginTop: 8,
              background: (canSubmit && !submitting) ? t.accent : t.bgInset,
              color: (canSubmit && !submitting) ? "white" : t.textMuted,
              border: "none", borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: (canSubmit && !submitting) ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Send size={16}/>
            <span>{submitting ? '저장 중...' : '접수 등록하기'}</span>
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
              fontFamily: mono ? "inherit" : "inherit",
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
              fontFamily: mono ? "inherit" : "inherit",
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
        곧 관리자 확인 후 프로 배정될 예정이에요
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
          2. 관리자 확인 → 일정 확정<br/>
          3. 프로 배정 → 작업 진행<br/>
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

function ListTab({ t, onSelect, tasks }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  
  let filtered = filter === "all" ? tasks : tasks.filter(x => x.status === filter);
  if (search) {
    filtered = filtered.filter(x => 
      x.customer.includes(search) || x.address.includes(search) || x.id.includes(search)
    );
  }
  
  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(x => ["미배정", "약속대기", "확정", "진행중"].includes(x.status)).length,
    completed: tasks.filter(x => x.status === "완료").length,
  };

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📋 내 작업 리스트</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          {PRINCIPAL.name}{josa(PRINCIPAL.name, "이", "가")} 등록한 모든 작업
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
    "미접수": { color: t.danger, bg: t.dangerBg },
  };
  const ss = statusStyle[task.status] || { color: t.textMuted, bg: t.bgInset };
  
  // 금액 계산
  const customerAmount = (task.productPrice || task.estimateTotal || 0) + (task.extraFee || 0);
  const principalFee = Math.round((task.productPrice || task.estimateTotal || 0) * 0.5);
  
  // 일정 표시
  const scheduledDisplay = task.scheduledDate && task.scheduledTime 
    ? `${task.scheduledDate} ${task.scheduledTime}` 
    : task.requestedDate 
      ? `희망: ${task.requestedDate} ${task.requestedTime || ""}`
      : null;

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
          {task.workType}{task.appliance ? ` · ${task.appliance}` : ""} ({task.qty || 1}대)
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
          📋 작업 정보
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DetailRow t={t} icon={Phone} label="연락처" value={task.phone} mono/>
          <DetailRow t={t} icon={MapPin} label="주소" value={task.address}/>
          <DetailRow t={t} icon={Hash} label="수량" value={`${task.qty || 1}대`}/>
          {scheduledDisplay && <DetailRow t={t} icon={Calendar} label="일정" value={scheduledDisplay}/>}
          {task.assignedEngineer && <DetailRow t={t} icon={User} label="배정 프로" value={`${task.assignedEngineer} 프로님`}/>}
          {task.startedAt && <DetailRow t={t} icon={Clock} label="작업 시작" value={task.startedAt} color={t.warning}/>}
          {task.completedAt && <DetailRow t={t} icon={CheckCircle2} label="완료 시각" value={task.completedAt} color={t.success}/>}
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
          💰 금액 정보
        </div>

        <div style={{ marginBottom: 8, padding: "14px 16px", background: t.bgInset, borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>상품 금액</span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              ₩{(task.productPrice || task.estimateTotal || 0).toLocaleString()}
            </span>
          </div>
          {task.extraFee > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${t.border}` }}>
              <div>
                <div style={{ fontSize: 12, color: t.warning, fontWeight: 700 }}>+ 현장 추가금</div>
                {task.extraReason && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{task.extraReason}</div>}
              </div>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: t.warning }}>
                +₩{task.extraFee.toLocaleString()}
              </span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 13, color: t.text, fontWeight: 700 }}>고객 결제 합계</span>
            <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: t.text }}>
              ₩{customerAmount.toLocaleString()}
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
              🏪 원청 ({PRINCIPAL.name}) 수수료
            </span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: PRINCIPAL.color }}>
              ₩{principalFee.toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: 10, color: t.textMuted }}>
            상품 금액의 50% 수수료 정책
          </div>
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: t.textMuted, lineHeight: 1.5 }}>
            <span>📌</span>
            <span>{task.status === "완료" ? "정산 가능 (매월 정산)" : "작업 완료 후 정산 처리"}</span>
          </div>
        </div>
      </div>

      {task.afterPhoto && (
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
            📷 완료 사진
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

      {task.happycallMemo && (
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
            📝 관리자 메모
          </div>
          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
            {task.happycallMemo}
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

function SettleTab({ t, tasks }) {
  const [period, setPeriod] = useState("today");
  const [view, setView] = useState("completed");

  const today = "2026-04-27";
  const safeTasks = tasks || [];

  // 헬퍼 - 작업당 수수료/금액 계산
  const getFee = (x) => Math.round((x.productPrice || x.estimateTotal || 0) * 0.5);
  const getAmount = (x) => (x.productPrice || x.estimateTotal || 0) + (x.extraFee || 0);
  
  // 헬퍼 - 날짜 매칭 (completedAt은 시간만 들어있을 수 있어서 scheduledDate로 보조 매칭)
  const matchToday = (x) => {
    if (x.scheduledDate === today) return true;
    if (x.completedAt && x.completedAt.startsWith(today)) return true;
    return false;
  };

  const completed = safeTasks.filter(x => x.status === "완료");
  const inProgress = safeTasks.filter(x => ["확정", "진행중", "약속대기"].includes(x.status));

  const todayCompleted = completed.filter(matchToday);
  const todayInProgress = inProgress.filter(matchToday);

  const periodCompleted = period === "today" ? todayCompleted : completed;
  const periodInProgress = period === "today" ? todayInProgress : inProgress;

  const completedFee = periodCompleted.reduce((sum, x) => sum + getFee(x), 0);
  const expectedFee = periodInProgress.reduce((sum, x) => sum + getFee(x), 0);
  const completedTotal = periodCompleted.reduce((sum, x) => sum + getAmount(x), 0);
  const expectedTotal = periodInProgress.reduce((sum, x) => sum + getAmount(x), 0);

  const showTasks = view === "completed" ? periodCompleted : periodInProgress;

  const periodLabel = period === "today" ? "오늘" : period === "week" ? "이번주" : "이번달";

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>💰 내 수수료</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          {PRINCIPAL.name}님이 받는 수수료 · 매일 정산
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
                  {task.workType} · {task.scheduledTime || task.requestedTime || "일정 미정"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: PRINCIPAL.color }}>
                  ₩{getFee(task).toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: t.textMuted, marginTop: 2 }}>
                  결제 ₩{getAmount(task).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, padding: "12px 14px", background: t.infoBg || t.bgInset, border: `1px solid ${(t.info || t.textMuted)}30`, borderRadius: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.info || t.textSecondary, marginBottom: 6 }}>
          💡 수수료 정책
        </div>
        <div style={{ fontSize: 10, color: t.textSecondary, lineHeight: 1.7 }}>
          {PRINCIPAL.name}님은 <strong style={{ color: t.text }}>차감형 50% 비율</strong>로 정산됩니다.<br/>
          매일 영업일 다음에 입금 처리됩니다.
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
