import { useState, useEffect } from "react";
import {
  loadTasksForRole as getTasks,
  createTaskAdapter as createTask,
  getTaskByIdDb,
  updateTaskAdapter,
} from "../data/tasksDb.js";
import { listPhotosByTask } from "../lib/photosDb.js";
import {
  Sun, Moon, RotateCcw, ClipboardPaste, Plus, Send, ArrowLeft,
  ClipboardList, Wallet, Building2, ChevronRight, AlertCircle,
  CheckCircle2, Clock, User, Phone, MapPin, Calendar, Snowflake,
  Hash, Edit3, Camera, FileText, Sparkles, Search, Filter, DollarSign
} from "lucide-react";
import { useTasks } from "../shared/TasksContext.jsx";
import { filterTasksForPrincipal } from "../shared/tasks.js";
import { v14NormalizeTask, v14FindTaskList } from "../utils/v14Task.js";
import { useRealtimeTasks } from "../hooks/useRealtimeSubscription.js";
import { formatTimeOnly } from "../utils/dateLabel.js";
// 2026-05-23 — 유솔홈케어 통합 포털 1라운드: "작업 현황" 탭 측 컴포넌트
import { PrincipalListTab } from "../components/principal/PrincipalListTab.jsx";
import { PrincipalSettleTab } from "../components/principal/PrincipalSettleTab.jsx";
import { UsolNOrders } from "../components/usol_n/UsolNOrders.jsx";
import { UsolNCsvMatch } from "../components/usol_n/UsolNCsvMatch.jsx";
import { fetchTaskItemsForDetail, getNaverSettleWeek } from "../lib/principalSettleDb.js";
import { fetchPrincipalWeeklyRemittances } from "../lib/principalRemitDb.js";
import { getStatusBadge as getPrincipalStatusBadge, getStatusLabel as getPrincipalStatusLabel } from "../utils/principalStatusBadge.js";

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

// 2026-05-23 — PRINCIPAL mock 제거. 색은 마젠타(정산 탭 일관), 라벨은 로그인 user 기반.
const PRINCIPAL_COLOR = "#FF4D9E";
const PRINCIPAL_BG    = "rgba(255,77,158,0.10)";

// user.principals → 표시용 원청 라벨 (공통 접두사 추출).
//   ["유솔홈케어 H", "유솔홈케어 N"]  → "유솔홈케어"
//   ["올데이케어"]                   → "올데이케어"
//   []                              → ""
function getPrincipalLabel(user) {
  if (!user || !Array.isArray(user.principals) || user.principals.length === 0) return "";
  const names = user.principals.map(p => p?.name).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  let prefix = names[0];
  for (const n of names) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) break;
  }
  prefix = (prefix || "").trim().replace(/[\s\-_·]+$/g, "");
  return prefix || names[0];
}

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

  // NewTab 신규 접수용 mock fallback (사장님 spec — addTask만 필요)
  const { addTask } = useTasks();

  // 2026-05-23 — user.principals (Migration 057) 측 측 → 옛 clientName fuzzy 폐기
  //   유솔홈케어 통합계정 측 user.principals = [{code:'usol_h',...}, {code:'usol_n',...}]
  // 2026-05-23 후속 — fetchTasks 측 catch PrincipalListTab 측 측 catch (뷰 A=가벼운 fetch, 뷰 B=전체)
  const principalCodes = Array.isArray(user?.principals)
    ? user.principals.map(p => p?.code).filter(Boolean)
    : [];

  const reset = () => {
    setTab("list");
    setSubmitted(false);
    setSubmittedTask(null);
    setSelectedTask(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", paddingTop: "env(safe-area-inset-top, 12px)" }}>
      {/* Step 5-6 UX hotfix — paddingTop env(safe-area-inset-top, 12px) — 휴대폰 status bar 영역 보호 */}
      <style>{`
        
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: slideUp 0.4s ease-out; }
        .mono { font-family: inherit; }
        .clickable { cursor: pointer; transition: all 0.15s; }
        .clickable:active { opacity: 0.7; transform: scale(0.98); }
        .tab-btn:hover { opacity: 0.8; }
      `}</style>

      {/* Step 5-6 UX — 상단 sticky 박스 (다크/라이트/로그아웃) 제거 */}

      <div style={{ maxWidth: 420, margin: "0 auto", background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'Pretendard', sans-serif", paddingBottom: 80 }}>
        
        <Header t={t} user={user}/>

        {selectedTask ? (
          <TaskDetail t={t} task={selectedTask} onBack={() => setSelectedTask(null)}/>
        ) : submittedTask ? (
          <SubmittedScreen t={t} task={submittedTask} onContinue={() => { setSubmittedTask(null); setTab("list"); }}/>
        ) : (
          <>
            {tab === "list"   && <PrincipalListTab t={t} user={user} principalCodes={principalCodes} onSelect={setSelectedTask}/>}
            {tab === "upload" && <UploadTab t={t} user={user} onTaskClick={setSelectedTask} onSubmit={(task) => setSubmittedTask(task)}/>}
            {tab === "settle" && <PrincipalSettleTab principalCodes={principalCodes} onSelect={setSelectedTask}/>}
            {tab === "info"   && <InfoTab t={t} user={user}/>}
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
          안녕하세요, <span style={{ color: t.accent }}>{user?.name || getPrincipalLabel(user) || "원청"}</span>님
        </div>
      </div>
    </div>
  );
}

function BottomNav({ t, tab, onChange }) {
  const tabs = [
    { id: "list",   icon: ClipboardList, label: "내 작업" },
    { id: "upload", icon: Plus,          label: "업로드" },
    { id: "settle", icon: Wallet,        label: "정산" },
    { id: "info",   icon: User,          label: "내 정보" },
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
        const isPlus = b.id === "upload";
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

// 업로드 탭 — 토글 2개 (접수 / 정산) + "새 접수 등록" 진입.
//   접수 → <UsolNOrders hideList/> + 새 접수 버튼
//   정산 → <UsolNCsvMatch/>
function UploadTab({ t, user, onTaskClick, onSubmit }) {
  const [sub, setSub] = useState("receive");   // 'receive' | 'settle'
  const [showNewForm, setShowNewForm] = useState(false);

  if (showNewForm) {
    return (
      <NewTab
        t={t} user={user}
        onBack={() => setShowNewForm(false)}
        onSubmit={(task) => { setShowNewForm(false); onSubmit?.(task); }}
      />
    );
  }

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>📤 업로드</div>

      {/* 토글 — 접수 / 정산 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <UploadToggleBtn active={sub === "receive"} onClick={() => setSub("receive")} t={t}>접수 CSV</UploadToggleBtn>
        <UploadToggleBtn active={sub === "settle"}  onClick={() => setSub("settle")} t={t}>정산 CSV</UploadToggleBtn>
      </div>

      {sub === "receive" && (
        <>
          <UsolNOrders hideList onTaskClick={onTaskClick}/>
          <div style={{
            marginTop: 18, paddingTop: 14,
            borderTop: `1px solid ${t.border}`,
          }}>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 8 }}>
              직접 입력 (유솔홈케어 H)
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              style={{
                width: "100%", padding: "14px 16px",
                background: "transparent",
                border: `1px solid #FF4D9E`,
                borderRadius: 10,
                color: "#FF4D9E",
                fontSize: 13, fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Plus size={14}/><span>새 접수 등록</span>
            </button>
          </div>
        </>
      )}

      {sub === "settle" && <UsolNCsvMatch/>}
    </div>
  );
}

function UploadToggleBtn({ active, onClick, t, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 12px",
      background: active ? "#FF4D9E" : t.bgInset,
      color: active ? "#fff" : t.text,
      border: `1px solid ${active ? "#FF4D9E" : t.border}`,
      borderRadius: 10,
      fontSize: 12, fontWeight: 700,
      fontFamily: "inherit",
      cursor: "pointer",
    }}>{children}</button>
  );
}

// 새 접수 — 직접 입력 폼만. usol_h 측 catch DB INSERT (createTaskAdapter).
//   parseKakao 측 catch 측 X (사장님 spec).
function NewTab({ t, user, onSubmit, onBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [workType, setWorkType] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dateText, setDateText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [memo, setMemo] = useState("");
  const [estimateTotal, setEstimateTotal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formatPhone = (val) => {
    const nums = val.replace(/\D/g, "").slice(0, 11);
    if (nums.length < 4) return nums;
    if (nums.length < 8) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
  };

  // 사장님 spec — 새 접수는 usol_h 고정 (= 측 직접 입력)
  //   통합계정 P003은 user.principals에 usol_h + usol_n 둘 다 있음 — usol_h 우선.
  const principalCodesArr = Array.isArray(user?.principals)
    ? user.principals.map(p => p?.code).filter(Boolean)
    : [];
  const newReceptionPrincipalCode =
    principalCodesArr.includes("usol_h") ? "usol_h" : (principalCodesArr[0] || null);

  const submit = async () => {
    if (submitting) return;
    if (!newReceptionPrincipalCode) {
      alert("원청 코드 매핑 실패 — 로그아웃 후 재시도");
      return;
    }
    setSubmitting(true);
    try {
      const taskData = {
        principalCode: newReceptionPrincipalCode,
        channel: "직접 입력",
        customer: name,
        phone,
        address,
        workType,
        qty: quantity,
        scheduledDate: dateText || null,
        scheduledTime: timeText || null,
        estimateTotal: parseInt(estimateTotal) || 0,
        memo,
        status: "미배정",
      };
      const res = await createTask(taskData);
      if (!res.ok) {
        alert("등록 실패: " + (res.error || "알 수 없는 오류"));
        return;
      }
      onSubmit({
        id: res.taskId,
        taskNo: res.task_no,
        customer: name, phone, address,
        workType, qty: quantity,
      });
    } catch (err) {
      alert("등록 오류: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = name && phone && address && workType;

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: t.bgInset,
            border: `1px solid ${t.border}`,
            borderRadius: 8, padding: "6px 8px",
            color: t.text, cursor: "pointer",
            display: "flex", alignItems: "center",
            fontFamily: "inherit",
          }}><ArrowLeft size={14}/></button>
        )}
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>📝 새 접수 등록</div>
          <div style={{ fontSize: 11, color: t.textMuted }}>
            유솔홈케어 H · 직접 입력
          </div>
        </div>
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
          background: (canSubmit && !submitting) ? "#FF4D9E" : t.bgInset,
          color: (canSubmit && !submitting) ? "white" : t.textMuted,
          border: "none", borderRadius: 12,
          fontSize: 14, fontWeight: 700,
          cursor: (canSubmit && !submitting) ? "pointer" : "not-allowed",
          fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        <Send size={16}/>
        <span>{submitting ? "저장 중..." : "접수 등록하기"}</span>
      </button>
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
    inProgress: tasks.filter(x => ["미배정", "확정", "진행중"].includes(x.status)).length,
    completed: tasks.filter(x => x.status === "완료").length,
  };

  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📋 내 작업 리스트</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          원청이 등록한 모든 작업
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
        {["all", "미배정", "확정", "완료"].map(f => (
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
          {task.principal_amount > 0 && (
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: PRINCIPAL_COLOR }}>
              +₩{(task.principal_amount / 1000).toFixed(0)}K
            </span>
          )}
          <ChevronRight size={14} style={{ color: t.textMuted }}/>
        </div>
      </div>
    </div>
  );
}

function TaskDetail({ t, task: initialTask, onBack }) {
  // 정산 탭에서 진입 시 부분 task — mount 시 full task refetch.
  //   목록 탭은 normalized task라 영향 X (덮어쓰면 동일 내용).
  const [task, setTask] = useState(initialTask);
  useEffect(() => { setTask(initialTask); }, [initialTask]);
  useEffect(() => {
    if (!initialTask?.id) return;
    let alive = true;
    getTaskByIdDb(initialTask.id).then(row => {
      if (!alive || !row) return;
      const normalized = v14NormalizeTask(row);
      if (normalized) setTask(normalized);
    });
    return () => { alive = false; };
  }, [initialTask?.id]);

  // 2026-05-24 — 상태 배지 측 PrincipalListTab 측 catch utility 측 catch 통일
  const ss = getPrincipalStatusBadge(task.status);
  const statusLabel = getPrincipalStatusLabel(task.status);

  // 완료 작업 사진 — 완료/visit_only 측만 fetch
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    if (!task?.id) return;
    if (task.status !== "완료" && task.status !== "visit_only") {
      setPhotos([]);
      return;
    }
    let alive = true;
    listPhotosByTask(task.id).then(res => {
      if (alive && res.ok) setPhotos(res.photos);
    });
    return () => { alive = false; };
  }, [task?.id, task?.status]);

  // 공유 작업 메모 (work_memo)
  const [memo, setMemo] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [memoSavedTick, setMemoSavedTick] = useState(0);
  useEffect(() => { setMemo(task?.workMemo || ""); }, [task?.workMemo]);
  const memoDirty = (memo || "") !== (task?.workMemo || "");

  async function saveMemo() {
    if (!task?.id || memoSaving) return;
    setMemoSaving(true);
    try {
      const res = await updateTaskAdapter(task.id, { workMemo: memo });
      if (res && res.ok === false) throw new Error(res.error || "저장 실패");
      setTask(prev => ({ ...prev, workMemo: memo }));
      setMemoSavedTick(v => v + 1);
    } catch (e) {
      alert("메모 저장 실패: " + (e.message || ""));
    } finally {
      setMemoSaving(false);
    }
  }

  // 상품주문별 정산 — task_items + remit 별도 fetch (mount 시)
  const [settleItems, setSettleItems] = useState([]);
  const [settleRemits, setSettleRemits] = useState([]);
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState("");

  useEffect(() => {
    if (!task?.id) return;
    let alive = true;
    setSettleLoading(true);
    setSettleError("");
    const principalCodes = task.principalCode ? [task.principalCode] : [];
    Promise.all([
      fetchTaskItemsForDetail(task.id),
      principalCodes.length > 0
        ? fetchPrincipalWeeklyRemittances({ principalCodes, monthsBack: 3 })
        : Promise.resolve({ ok: true, remits: [] }),
    ]).then(([itemsRes, remitRes]) => {
      if (!alive) return;
      if (!itemsRes.ok) setSettleError(itemsRes.error || "항목 조회 실패");
      setSettleItems(itemsRes.items || []);
      setSettleRemits(remitRes.remits || []);
    }).finally(() => { if (alive) setSettleLoading(false); });
    return () => { alive = false; };
  }, [task?.id, task?.principalCode]);

  // remitMap — `${principal_id}|${week_start}` → row
  const remitMap = (() => {
    const m = new Map();
    for (const r of settleRemits) m.set(`${r.principal_id}|${r.week_start}`, r);
    return m;
  })();
  
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

      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 21, fontWeight: 800, color: t.text }}>
          {task.customer || "—"}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: ss.color, background: ss.bg,
          padding: "2px 7px", borderRadius: 8,
          whiteSpace: "nowrap",
        }}>
          {statusLabel}
        </span>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 12 }}>
          작업 정보
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <LabelRow t={t} label="연락처" value={task.phone || "—"} mono/>
          <LabelRow t={t} label="주소"   value={task.address || "—"} wrap/>
          <LabelRow t={t} label="수량"   value={`${task.qty || 1}대`}/>
          {scheduledDisplay && <LabelRow t={t} label="일정" value={scheduledDisplay} highlight/>}
          {task.assignedEngineer && <LabelRow t={t} label="배정 프로" value={`${task.assignedEngineer} 프로님`}/>}
        </div>
      </div>

      {/* 📊 정산 — 작업 전체 합계 + 상품주문별 진행바 */}
      <SettleDetailBox
        t={t}
        items={settleItems}
        remitMap={remitMap}
        principalId={task.principalId}
        loading={settleLoading}
        error={settleError}
      />

      {photos.length > 0 && (
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 12 }}>
            완료 사진 ({photos.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {photos.map(p => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                <img src={p.url} alt={p.step || ""} style={{
                  width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8,
                  background: t.bgInset, display: "block",
                }}/>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 작업 메모 — work_memo 공유 (운영자·원청·기사 모두 보고 수정) */}
      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted }}>작업 메모</span>
          {memoSavedTick > 0 && !memoDirty && !memoSaving && (
            <span style={{ fontSize: 10, color: "#5DCAA5", fontWeight: 700 }}>✓ 저장됨</span>
          )}
        </div>
        <textarea
          value={memo}
          onChange={e => setMemo(e.target.value)}
          placeholder="메모 입력 — 운영자·원청·기사 공유"
          rows={3}
          style={{
            width: "100%", padding: "10px 12px",
            background: t.bgInset,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            color: t.text,
            fontSize: 13, fontWeight: 500,
            fontFamily: "inherit", outline: "none",
            resize: "vertical",
            lineHeight: 1.5,
            boxSizing: "border-box",
          }}
        />
        {memoDirty && (
          <button onClick={saveMemo} disabled={memoSaving} style={{
            marginTop: 8, padding: "8px 14px",
            background: "#FF4D9E", color: "#fff",
            border: "none", borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            fontFamily: "inherit",
            cursor: memoSaving ? "not-allowed" : "pointer",
            opacity: memoSaving ? 0.5 : 1,
          }}>{memoSaving ? "저장 중..." : "메모 저장"}</button>
        )}
      </div>

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

// 📊 상품주문별 정산 박스 (TaskDetail "💰 금액 정보" 직후)
//   단계 판정 (1차 진단대로):
//     ① 정산대기     — naver_settled_at NULL
//     ② 네이버정산완료 — naver_settled_at 있음 + (③ 조건 X)
//     ③ 회사입금완료   — naver_settled_at 있음 + 측 주차 remit row confirmed_at 있음
//   금액 (net_amount = 운영팀이 입력한 네이버 정산금액):
//     유솔 수수료      = ROUND(net_amount × 0.15)
//     올데이케어 수수료 = net_amount − 유솔 수수료
//   net_amount NULL → 금액 3종 "—", 단계는 ① 정산대기.
function getItemStageKey(item, remitMap, principalId) {
  if (!item.naver_settled_at) return "wait";
  const wk = getNaverSettleWeek(item);
  if (!wk || !principalId) return "naver";
  const monday = wk.monday;
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  const remit = remitMap.get(`${principalId}|${weekStart}`);
  if (remit?.confirmed_at) return "company";
  return "naver";
}

const SETTLE_DETAIL_STAGES = [
  { key: "wait",    label: "정산대기",       color: "#9CA3AF" },
  { key: "naver",   label: "네이버정산완료", color: "#FACC15" },
  { key: "company", label: "회사입금완료",   color: "#5DCAA5" },
];

function StageProgress({ stage }) {
  const currentIdx = SETTLE_DETAIL_STAGES.findIndex(s => s.key === stage);
  const N = SETTLE_DETAIL_STAGES.length;
  // 측 단계 측 catch flex:1 → dot center 측 catch 측 측 측 (100/(2N))% offset.
  const sideOffset = `${100 / (2 * N)}%`;
  const lineSpan   = 100 - (100 / N); // 첫 dot 측 마지막 dot 사이 측 측 폭
  const safeIdx    = currentIdx < 0 ? 0 : currentIdx;
  const progressPct = N <= 1 ? 0 : (safeIdx / (N - 1)) * lineSpan;
  const currentColor = currentIdx >= 0 ? SETTLE_DETAIL_STAGES[currentIdx].color : "#9CA3AF";

  return (
    <div style={{ position: "relative", marginTop: 8, marginBottom: 10 }}>
      {/* 배경 라인 */}
      <div style={{
        position: "absolute", top: 6,
        left: sideOffset, right: sideOffset,
        height: 2, background: "#3A3A3A",
        zIndex: 0,
      }}/>
      {/* 진행 라인 */}
      <div style={{
        position: "absolute", top: 6,
        left: sideOffset,
        width: `${progressPct}%`, height: 2,
        background: currentColor,
        zIndex: 1,
        transition: "width 0.3s",
      }}/>

      {/* 단계 dot + 라벨 */}
      <div style={{ position: "relative", display: "flex", gap: 4, zIndex: 2 }}>
        {SETTLE_DETAIL_STAGES.map((s, idx) => {
          const isPast    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const filled    = isPast || isCurrent;
          const dotSize   = isCurrent ? 12 : 8;
          return (
            <div key={s.key} style={{
              flex: 1,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              {/* dot wrapper — 측 dot 측 center y 정렬 (라인 위치 6 + 1 = 7) */}
              <div style={{
                width: 14, height: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: dotSize, height: dotSize, borderRadius: "50%",
                  background: filled ? s.color : "#1F1F1F",
                  border: `2px solid ${filled ? s.color : "#3A3A3A"}`,
                  boxSizing: "border-box",
                  transition: "all 0.2s",
                }}/>
              </div>
              <div style={{
                fontSize: 9, fontWeight: isCurrent ? 700 : 500,
                color: filled ? s.color : "#666",
                whiteSpace: "nowrap",
              }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettleDetailBox({ t, items, remitMap, principalId, loading, error }) {
  if (loading) {
    return (
      <div style={settleBoxStyle(t)}>
        <SettleBoxHeader t={t}/>
        <div style={{ padding: "20px 0", textAlign: "center", color: t.textMuted, fontSize: 12 }}>불러오는 중...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={settleBoxStyle(t)}>
        <SettleBoxHeader t={t}/>
        <div style={{ padding: "20px 0", textAlign: "center", color: "#EF4444", fontSize: 11 }}>⚠️ {error}</div>
      </div>
    );
  }
  if (!items || items.length === 0) return null;

  // 합계 — 고객 결제(subtotal) / 네이버 정산금액(net_amount, NULL 제외)
  let sumCustomer = 0;
  let sumNaver = 0, sumUsol = 0, sumAllday = 0;
  for (const it of items) {
    sumCustomer += Number(it.subtotal) || 0;
    const n = it.net_amount;
    if (n != null) {
      const usol = Math.round(n * 0.15);
      sumNaver  += n;
      sumUsol   += usol;
      sumAllday += n - usol;
    }
  }

  return (
    <div style={settleBoxStyle(t)}>
      <SettleBoxHeader t={t}/>

      {/* (a) 작업 전체 금액 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SumLine label="고객 결제 합계" value={sumCustomer} t={t} size="sm"/>
        <Divider t={t}/>
        <SumLine label="네이버 정산금액" value={sumNaver} t={t} size="lg"/>
        <SumLine label="└ 유솔 수수료 (15%)"      value={sumUsol}   color="#FF4D9E" indent t={t}/>
        <SumLine label="└ 올데이케어 수수료 (85%)" value={sumAllday} color="#5DCAA5" indent t={t}/>
      </div>

      {/* (b) 구분선 */}
      <div style={{ height: 1, background: t.border, margin: "16px 0" }}/>

      {/* (c) 상품주문별 진행 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map(item => (
          <ItemProgress
            key={item.id}
            t={t}
            item={item}
            stage={getItemStageKey(item, remitMap, principalId)}
          />
        ))}
      </div>
    </div>
  );
}

function settleBoxStyle(t) {
  return {
    background: t.bgElevated,
    borderRadius: 14,
    padding: "16px",
    marginBottom: 12,
  };
}

function SettleBoxHeader({ t }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 12 }}>
      정산
    </div>
  );
}

function SumLine({ label, value, color, size, indent, t }) {
  // size: "sm" | "md" | "lg"
  const isLg = size === "lg";
  const isSm = size === "sm";
  const valueSize  = isLg ? 17 : (isSm ? 13 : 13);
  const labelColor = color || (isLg ? t.text : t.textMuted);
  const valueColor = color || (isLg ? t.text : (isSm ? t.text : t.text));
  const valueWeight = isLg ? 800 : 700;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      paddingLeft: indent ? 12 : 0,
    }}>
      <span style={{ fontSize: 12, color: labelColor, fontWeight: indent ? 700 : 600 }}>{label}</span>
      <span className="mono" style={{ fontSize: valueSize, fontWeight: valueWeight, color: valueColor }}>
        ₩{(value || 0).toLocaleString()}
      </span>
    </div>
  );
}

function Divider({ t }) {
  return <div style={{ height: 1, background: t.border, marginTop: 2, marginBottom: 2 }}/>;
}

function ItemProgress({ t, item, stage }) {
  const orderId   = item.product_order_id || "";
  const workType  = item.work_types?.name || "";
  const appliance = item.appliance_types?.name || "";
  const qty       = item.qty || 1;
  // workType이 appliance 문자열을 이미 포함하면 appliance 생략 (예: "세척_벽걸이" + "벽걸이")
  const labelParts = [];
  if (workType) labelParts.push(workType);
  if (appliance && !(workType && workType.includes(appliance))) labelParts.push(appliance);
  labelParts.push(`${qty}대`);
  const itemLabel = labelParts.length > 1 ? labelParts.join(" · ") : (item.description || "—");

  return (
    <div>
      {/* 상품 이름 — workType · appliance · qty */}
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>
        {itemLabel}
      </div>
      {/* 상품주문번호 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, flexShrink: 0 }}>
          상품주문번호
        </span>
        <span className="mono" style={{
          fontSize: 12, fontWeight: 600, color: t.textSecondary || t.text,
          wordBreak: "break-all", letterSpacing: 0.2,
        }}>
          {orderId || "—"}
        </span>
      </div>
      {/* 진행바 */}
      <StageProgress stage={stage}/>
    </div>
  );
}

// 작업 정보 박스의 라벨 row — 아이콘 X, 라벨(고정폭 78px, 회색 12px) + 값(13~14px)
//   highlight=true → 일정 등 강조 row (노란색 14px 800)
function LabelRow({ t, label, value, mono, wrap, color, highlight }) {
  const valueColor  = color || (highlight ? "#FACC15" : t.text);
  const valueSize   = highlight ? 14 : 13;
  const valueWeight = highlight ? 800 : 600;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{
        flexShrink: 0, width: 78,
        fontSize: 12, color: t.textMuted, fontWeight: 500,
        lineHeight: 1.5,
      }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{
        flex: 1, minWidth: 0,
        fontSize: valueSize, fontWeight: valueWeight, color: valueColor,
        lineHeight: 1.5,
        wordBreak: wrap ? "break-word" : "normal",
        whiteSpace: wrap ? "normal" : "nowrap",
        overflow: wrap ? "visible" : "hidden",
        textOverflow: wrap ? "clip" : "ellipsis",
      }}>{value}</span>
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
  const inProgress = safeTasks.filter(x => ["확정", "진행중"].includes(x.status));

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
          원청이 받는 수수료 · 매일 정산
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
        background: PRINCIPAL_BG,
        border: `1.5px solid ${PRINCIPAL_COLOR}40`,
        borderRadius: 16, padding: "20px", marginBottom: 12
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: PRINCIPAL_COLOR, letterSpacing: 1, textTransform: "uppercase" }}>
            🏪 {periodLabel} 받을 수수료
          </div>
          {period === "today" && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", background: t.success, color: "white", borderRadius: 100 }}>
              매일 정산
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
          <span className="mono" style={{ fontSize: 32, fontWeight: 800, color: PRINCIPAL_COLOR }}>
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
                <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: PRINCIPAL_COLOR }}>
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

    </div>
  );
}

function InfoTab({ t, user }) {
  const principalLabel = getPrincipalLabel(user) || "원청";
  const userName       = user?.name || `${principalLabel} 대표`;
  const userPhone      = user?.phone || "";
  const userCode       = user?.code || "";
  return (
    <div className="fade-in" style={{ padding: "20px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>👤 내 정보</div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          {userName}님
        </div>
      </div>

      <div style={{ background: t.bgElevated, borderRadius: 14, padding: "20px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: PRINCIPAL_COLOR, color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Building2 size={28}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{principalLabel}</div>
            <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
              {userName}님
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
          {userCode && <Row t={t} label="계정 코드" value={userCode} mono/>}
          {userPhone && <Row t={t} label="연락처" value={userPhone} mono/>}
        </div>
      </div>

      <div style={{ background: t.infoBg, border: `1px solid ${t.info}30`, borderRadius: 14, padding: "16px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.info, marginBottom: 8 }}>
          🔒 보안 안내
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.7 }}>
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
