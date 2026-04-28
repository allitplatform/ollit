import { useState } from "react";
import { 
  Phone, MessageCircle, Snowflake, Wrench, Settings, Zap, ChevronRight, ChevronLeft,
  Sun, Moon, Plus, ArrowLeft, ArrowRight, User, MapPin, Calendar,
  Clock, FileText, RotateCcw, CheckCircle2, AlertCircle, AlertTriangle, Search, Star,
  PhoneCall, UserPlus, Edit3, Bell, X
} from "lucide-react";

const NOW = "14:23";

// ============================================
// 데이터
// ============================================
const HAPPYCALL_USER = "김지혜";

// 기사 데이터 (캘린더 일정 포함)
// schedule: { date: 'YYYY-MM-DD', items: [{start, end, customer, workType, location}] }
const ENGINEERS = [
  { 
    id: "E001", name: "김동효", region: "강남 전담", 
    rating: 4.8, distanceKm: 1.2, travelMin: 32, phone: "010-1111-1111",
    schedule: {
      "2026-04-27": [
        { start: 9, end: 10.5, customer: "박지영", workType: "세척", location: "강남 역삼" },
        { start: 11.5, end: 13.5, customer: "이상훈", workType: "세척+점검", location: "서초 반포" },
        { start: 14, end: 16.5, customer: "김미경", workType: "냉매충전", location: "송파 잠실" },
      ],
      "2026-04-28": [
        { start: 9, end: 10.5, customer: "정수민", workType: "점검", location: "강남 역삼" },
        { start: 11, end: 13, customer: "한재영", workType: "세척", location: "강남 도곡" },
      ],
      "2026-04-29": [],
    }
  },
  { 
    id: "E002", name: "이재현", region: "강남/서초", 
    rating: 4.7, distanceKm: 3.5, travelMin: 45, phone: "010-2222-2222",
    schedule: {
      "2026-04-27": [
        { start: 10, end: 12, customer: "최영주", workType: "세척", location: "서초 양재" },
        { start: 13, end: 15, customer: "한영수", workType: "설치", location: "강남 압구정" },
      ],
      "2026-04-28": [
        { start: 9, end: 11, customer: "이지윤", workType: "세척", location: "강남 신사" },
        { start: 12, end: 14, customer: "박민호", workType: "점검", location: "서초 반포" },
        { start: 15, end: 17, customer: "정도훈", workType: "냉매충전", location: "강남 청담" },
        { start: 18, end: 20, customer: "최서진", workType: "설치", location: "강남 압구정" },
      ],
      "2026-04-29": [
        { start: 10, end: 12, customer: "유민지", workType: "세척", location: "서초 잠원" },
      ],
    }
  },
  { 
    id: "E003", name: "박상민", region: "송파/잠실", 
    rating: 4.9, distanceKm: 8.2, travelMin: 65, phone: "010-3333-3333",
    schedule: {
      "2026-04-27": [
        { start: 9, end: 11, customer: "김주현", workType: "설치", location: "송파 잠실" },
        { start: 12, end: 14, customer: "이상우", workType: "세척", location: "송파 문정" },
      ],
      "2026-04-28": [
        { start: 9, end: 12, customer: "박서영", workType: "이전설치", location: "송파 잠실" },
        { start: 12, end: 14, customer: "정민재", workType: "세척", location: "송파 가락" },
        { start: 15, end: 18, customer: "한지수", workType: "냉매충전", location: "송파 문정" },
        { start: 19, end: 21, customer: "최도윤", workType: "수리", location: "강남 삼성" },
      ],
      "2026-04-29": [
        { start: 14, end: 17, customer: "정현우", workType: "설치", location: "송파 잠실" },
      ],
    }
  },
  { 
    id: "E004", name: "최민수", region: "종로/중구", 
    rating: 4.6, distanceKm: 12.5, travelMin: 75, phone: "010-4444-4444",
    schedule: {
      "2026-04-27": [
        { start: 9, end: 11, customer: "이주현", workType: "세척", location: "종로 평창" },
      ],
      "2026-04-28": [
        { start: 9, end: 11, customer: "조민수", workType: "세척", location: "종로 평창" },
        { start: 11, end: 13, customer: "송지원", workType: "점검", location: "중구 명동" },
        { start: 13, end: 15, customer: "박준호", workType: "설치", location: "종로 청운" },
        { start: 15, end: 17, customer: "이서연", workType: "세척", location: "중구 회현" },
        { start: 17, end: 19, customer: "한도현", workType: "냉매충전", location: "종로 통의" },
        { start: 19, end: 21, customer: "정유진", workType: "수리", location: "중구 충무" },
      ],
      "2026-04-29": [
        { start: 9, end: 21, customer: "여러건", workType: "꽉참", location: "종로/중구" },
      ],
    }
  },
  { 
    id: "E005", name: "김도현", region: "강남/송파", 
    rating: 4.8, distanceKm: 2.8, travelMin: 38, phone: "010-5555-5555",
    schedule: {
      "2026-04-27": [
        { start: 13, end: 15, customer: "유서아", workType: "세척", location: "강남 대치" },
      ],
      "2026-04-28": [
        { start: 14, end: 16, customer: "조한별", workType: "세척", location: "송파 잠실" },
      ],
      "2026-04-29": [],
    }
  },
];

// 시간 → 막대 위치 (%) 변환 헬퍼
const timeToPercent = (hour) => (hour / 24) * 100;

// 기사의 빈 자리 찾기
function findFreeSlots(engineer, date, durationHours) {
  const items = engineer.schedule[date] || [];
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const slots = [];
  
  let cursor = 0; // 0시부터
  for (const item of sorted) {
    if (item.start - cursor >= durationHours) {
      slots.push({ start: cursor, end: cursor + durationHours });
    }
    cursor = Math.max(cursor, item.end);
  }
  if (24 - cursor >= durationHours) {
    slots.push({ start: cursor, end: cursor + durationHours });
  }
  return slots;
}

// 추천 시간대 (09~22) 안의 빈자리 (희망일)
function findRecommendedSlot(engineer, requestedDate, durationHours) {
  const slots = findFreeSlots(engineer, requestedDate, durationHours);
  return slots.find(s => s.start >= 9 && s.end <= 22);
}

// 가능 시간대 (다른 날의 추천 시간대만)
function findAlternativeSlots(engineer, requestedDate, durationHours) {
  const result = [];
  // 다른 날 (희망일 제외)
  const otherDates = Object.keys(engineer.schedule).filter(d => d !== requestedDate);
  for (const d of otherDates.sort()) { // 가까운 날짜 우선
    const slots = findFreeSlots(engineer, d, durationHours);
    const valid = slots.find(s => s.start >= 9 && s.end <= 22);
    if (valid) {
      result.push({ ...valid, date: d, type: "다른 날" });
      break; // 가장 가까운 다른 날만
    }
  }
  return result;
}

// 등급 판정
function getEngineerGrade(engineer, requestedDate, durationHours) {
  const recommended = findRecommendedSlot(engineer, requestedDate, durationHours);
  if (recommended) return { grade: "추천", slot: recommended, alternatives: [] };
  
  const alts = findAlternativeSlots(engineer, requestedDate, durationHours);
  if (alts.length > 0) return { grade: "가능", slot: null, alternatives: alts };
  
  return { grade: "불가", slot: null, alternatives: [] };
}

const INITIAL_TASKS = [
  { id: "A260427-005", customer: "박은서", phone: "010-1234-5678",
    address: "강남구 도곡동", fullAddress: "도곡로 123, 도곡래미안 304-1502",
    workType: "세척", appliance: "벽걸이", qty: 1, icon: Snowflake,
    requestedDate: "2026-04-28", requestedTime: "오후",
    receivedAt: "14:13", receivedAgo: "10분 전",
    happycallStatus: "uncontacted", isUrgent: false,
    assignedEngineer: null, happycallMemo: "", client: "올데이케어",
  },
  { id: "A260427-006", customer: "김민호", phone: "010-2345-6789",
    address: "송파구 잠실동", fullAddress: "올림픽로 240, 트리지움",
    workType: "점검", appliance: "스탠드", qty: 1, icon: Wrench,
    requestedDate: "2026-04-29", requestedTime: "오전",
    receivedAt: "13:53", receivedAgo: "30분 전",
    happycallStatus: "uncontacted", isUrgent: false,
    assignedEngineer: null, happycallMemo: "", client: "쿨가이",
  },
  { id: "A260427-007", customer: "이지은", phone: "010-3456-7890",
    address: "서초구 반포동", fullAddress: "신반포로 270",
    workType: "설치", appliance: "벽걸이", qty: 2, icon: Settings,
    requestedDate: "2026-04-27", requestedTime: "저녁",
    receivedAt: "13:23", receivedAgo: "1시간 전",
    happycallStatus: "uncontacted", isUrgent: true,
    assignedEngineer: null, happycallMemo: "", client: "용인컴퍼니",
  },
  { id: "A260427-008", customer: "정도현", phone: "010-4567-8901",
    address: "강남구 청담동", fullAddress: "도산대로 450",
    workType: "설치", appliance: "벽걸이", qty: 1, icon: Settings,
    requestedDate: "2026-04-28", requestedTime: "오후",
    receivedAt: "12:30", receivedAgo: "2시간 전",
    happycallStatus: "contacted", isUrgent: false,
    assignedEngineer: null,
    happycallMemo: "기존 에어컨 떼고 새 벽걸이 설치 부탁드려요. 주차 가능", 
    client: "올데이케어",
  },
  { id: "A260427-009", customer: "박지영", phone: "010-5678-9012",
    address: "강남구 역삼동", fullAddress: "테헤란로 152",
    workType: "세척", appliance: "벽걸이", qty: 1, icon: Snowflake,
    requestedDate: "2026-04-28", requestedTime: "오전",
    receivedAt: "11:45", receivedAgo: "3시간 전",
    happycallStatus: "contacted", isUrgent: false,
    assignedEngineer: null,
    happycallMemo: "현관 비밀번호 1234, 강아지 있어요", client: "쿨가이",
  },
  { id: "A260427-002", customer: "이상훈", phone: "010-3456-7890",
    address: "서초구 반포동", fullAddress: "신반포로 270, 반포자이",
    workType: "세척+점검", appliance: "스탠드", qty: 2, icon: Wrench,
    requestedDate: "2026-04-27", requestedTime: "낮 시간",
    receivedAt: "어제", receivedAgo: "어제",
    happycallStatus: "assigned", isUrgent: false,
    assignedEngineer: "김동효", happycallMemo: "",
    client: "쿨가이",
  },
];

const CLIENTS = [
  { id: "olday", name: "올데이케어", color: "#FF1B8D" },
  { id: "coolguy", name: "쿨가이", color: "#06B6D4" },
  { id: "yongin", name: "용인컴퍼니", color: "#A855F7" },
];

// 수량이 필요 없는 작업 (점검류, 진단류)
const WORK_TYPES = [
  { id: "세척", needsQty: true },
  { id: "점검", needsQty: false },
  { id: "가스점검", needsQty: false },
  { id: "냉매충전", needsQty: true },
  { id: "설치", needsQty: true },
  { id: "이전설치", needsQty: true },
  { id: "수리", needsQty: false },
  { id: "분해세척", needsQty: true },
];
const APPLIANCES = ["벽걸이", "스탠드", "천장형", "1way", "4way", "시스템 멀티", "이동식"];

// 긴급 사유 빠른 선택
const URGENT_REASONS = [
  "당일 작업 요청",
  "고객 강력 요청",
  "VIP 고객",
  "냉방 안되어 시급",
  "기존 일정 충돌",
];

const THEMES = {
  dark: {
    name: "🌑 다크", icon: Moon,
    bg: "#1A1512", bgElevated: "#221C18", bgInset: "#13100E",
    border: "rgba(255, 220, 200, 0.06)", borderStrong: "rgba(255, 220, 200, 0.10)",
    text: "#FAF8F5", textSecondary: "#C4B5A6", textMuted: "#8A7B6F", textDim: "#5C5048",
    accent: "#FF1B8D", accentBg: "rgba(255, 27, 141, 0.10)",
    warning: "#FBBF24", warningBg: "rgba(251, 191, 36, 0.10)", warningBorder: "rgba(251, 191, 36, 0.3)",
    success: "#34D399", successBg: "rgba(52, 211, 153, 0.10)", successBorder: "rgba(52, 211, 153, 0.3)",
    danger: "#F87171", dangerBg: "rgba(248, 113, 113, 0.10)", dangerBorder: "rgba(248, 113, 113, 0.3)",
    isLight: false,
  },
  light: {
    name: "☀️ 라이트", icon: Sun,
    bg: "#FAFAFA", bgElevated: "#FFFFFF", bgInset: "#F4F4F5",
    border: "rgba(0, 0, 0, 0.05)", borderStrong: "rgba(0, 0, 0, 0.09)",
    text: "#0A0A0A", textSecondary: "#404040", textMuted: "#737373", textDim: "#A3A3A3",
    accent: "#E91860", accentBg: "rgba(233, 24, 96, 0.06)",
    warning: "#D97706", warningBg: "rgba(217, 119, 6, 0.08)", warningBorder: "rgba(217, 119, 6, 0.22)",
    success: "#16A34A", successBg: "rgba(22, 163, 74, 0.08)", successBorder: "rgba(22, 163, 74, 0.25)",
    danger: "#DC2626", dangerBg: "rgba(220, 38, 38, 0.08)", dangerBorder: "rgba(220, 38, 38, 0.25)",
    isLight: true,
  },
};

function formatRequestedDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (date.toDateString() === new Date("2026-04-27").toDateString()) return "오늘";
  if (date.toDateString() === new Date("2026-04-28").toDateString()) return "내일";
  if (date.toDateString() === new Date("2026-04-29").toDateString()) return "모레";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
}

// ============================================
// 스타일 헬퍼
// ============================================
const labelStyle = (t) => ({ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 });
const inputStyle = (t) => ({ width: "100%", padding: "12px 14px", background: t.bgInset, border: `1px solid ${t.borderStrong}`, borderRadius: 9, fontSize: 13, color: t.text, fontFamily: "inherit", outline: "none", boxSizing: "border-box", colorScheme: t.isLight ? "light" : "dark" });
const chipBtn = (t, active) => ({ padding: "10px 14px", background: active ? t.accent : t.bgInset, color: active ? "white" : t.text, border: `1px solid ${active ? t.accent : t.border}`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
const btnSecondary = (t) => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", background: t.bgElevated, border: `1px solid ${t.borderStrong}`, borderRadius: 10, fontSize: 12, fontWeight: 700, color: t.text, cursor: "pointer", fontFamily: "inherit" });
const btnPrimary = (t) => ({ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px 14px", background: t.accent, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, color: "#FAF8F5", cursor: "pointer", fontFamily: "inherit" });

// ============================================
// 메인 화면 (해피콜)
// ============================================
function HappycallMainScreen({ t, tasks, onNewReception, onTaskAction }) {
  const [activeTab, setActiveTab] = useState("uncontacted");
  
  const filteredTasks = tasks.filter(x => {
    if (activeTab === "uncontacted") return x.happycallStatus === "uncontacted";
    if (activeTab === "contacted") return x.happycallStatus === "contacted";
    if (activeTab === "assigned") return x.happycallStatus === "assigned";
    return true;
  });

  const counts = {
    uncontacted: tasks.filter(x => x.happycallStatus === "uncontacted").length,
    contacted: tasks.filter(x => x.happycallStatus === "contacted").length,
    assigned: tasks.filter(x => x.happycallStatus === "assigned").length,
    urgent: tasks.filter(x => x.isUrgent && x.happycallStatus !== "assigned").length,
  };

  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 80, color: t.text }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@01ff0283e4f6c01667e0c819cfe9d2e933020d3a/css/SpoqaHanSansNeo.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.6); } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .pulse-dot { animation: pulse 1.8s ease-in-out infinite; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .clickable { cursor: pointer; transition: transform 0.15s, opacity 0.15s; }
        .clickable:active { transform: scale(0.98); opacity: 0.8; }
        input, textarea, select { font-family: inherit; }
      `}</style>

      {/* 헤더 */}
      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 500, textTransform: "uppercase" }}>
            MON · 27 APR · {NOW}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.accent, padding: "3px 8px", background: t.accentBg, borderRadius: 5 }}>
              해피콜
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
              해피콜 담당자
            </span>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.success }}/>
            <span style={{ fontSize: 10, color: t.success, fontWeight: 600 }}>온라인</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            안녕하세요, <span style={{ color: t.accent }}>{HAPPYCALL_USER}</span>님
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>
            오늘 처리 <span className="mono" style={{ color: t.text, fontWeight: 700 }}>12</span>건 · 미처리 <span className="mono" style={{ color: t.accent, fontWeight: 700 }}>{counts.uncontacted}</span>건
          </div>
        </div>

        {/* + 새 접수 등록 (큰 버튼) */}
        <button onClick={onNewReception} style={{
          width: "100%", padding: "16px",
          background: t.accent,
          color: "white", border: "none", borderRadius: 14,
          fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          marginBottom: 16,
          boxShadow: `0 4px 20px ${t.accent}40`,
        }}>
          <Plus size={18}/>
          <span>새 접수 등록</span>
        </button>

        {/* 알림 3개 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
          <ActionAlert t={t} icon={<Bell size={11}/>} label="새 접수" count={counts.uncontacted} sublabel="미컨택" urgent={counts.uncontacted > 0} delay={70}/>
          <ActionAlert t={t} icon={<PhoneCall size={11}/>} label="통화 후" count={counts.contacted} sublabel="배정 필요" urgent={false} delay={140}/>
          <ActionAlert t={t} icon={<AlertCircle size={11}/>} label="긴급" count={counts.urgent} sublabel="당일 작업" urgent={counts.urgent > 0} danger delay={210}/>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 20 }}>
        <div style={{ padding: "0 20px 14px", display: "flex", gap: 6 }}>
          <TabButton t={t} label="미처리" count={counts.uncontacted} active={activeTab === "uncontacted"} onClick={() => setActiveTab("uncontacted")} />
          <TabButton t={t} label="통화 후" count={counts.contacted} active={activeTab === "contacted"} onClick={() => setActiveTab("contacted")} />
          <TabButton t={t} label="배정 완료" count={counts.assigned} active={activeTab === "assigned"} onClick={() => setActiveTab("assigned")} />
        </div>

        {filteredTasks.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
            해당 항목이 없어요
          </div>
        ) : (
          filteredTasks.map((task, idx) => (
            <HappycallTaskCard key={task.id} task={task} t={t} index={idx} onAction={(action) => onTaskAction(task, action)} />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================
// 액션 알림
// ============================================
function ActionAlert({ t, icon, label, count, sublabel, urgent, danger, delay }) {
  const color = danger ? t.danger : t.accent;
  const colorBg = danger ? t.dangerBg : t.accentBg;
  
  return (
    <div className="card-fade" style={{ background: t.bgElevated, borderRadius: 12, padding: "12px 14px", position: "relative", animationDelay: `${delay}ms` }}>
      {urgent && count > 0 && (
        <span className="pulse-dot" style={{ position: "absolute", top: 10, right: 10, width: 6, height: 6, background: color, borderRadius: "50%" }}/>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
        <span style={{ color: t.textMuted, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span className="mono" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: count > 0 ? (danger ? t.danger : t.text) : t.textDim }}>
          {count}
        </span>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>건</span>
      </div>
      <div style={{ fontSize: 9, color: t.textDim, fontWeight: 500, marginTop: 4 }}>{sublabel}</div>
    </div>
  );
}

// ============================================
// 탭 버튼
// ============================================
function TabButton({ t, label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 8px",
      background: active ? t.bgElevated : "transparent",
      border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
      borderRadius: 10, fontSize: 12, fontWeight: 700,
      color: active ? t.text : t.textMuted,
      cursor: "pointer", fontFamily: "inherit",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    }}>
      <span>{label}</span>
      <span className="mono" style={{ 
        fontSize: 11, fontWeight: 800,
        color: active && count > 0 ? t.accent : t.textMuted,
      }}>
        {count}
      </span>
    </button>
  );
}

// ============================================
// 작업 카드 (해피콜용)
// ============================================
function HappycallTaskCard({ task, t, index, onAction }) {
  const Icon = task.icon;
  const isUncontacted = task.happycallStatus === "uncontacted";
  const isContacted = task.happycallStatus === "contacted";
  const isAssigned = task.happycallStatus === "assigned";

  return (
    <div className="card-fade" style={{
      padding: "16px 20px",
      borderTop: `1px solid ${t.border}`,
      animationDelay: `${(index + 4) * 50}ms`,
      position: "relative",
      background: task.isUrgent ? t.dangerBg : "transparent",
      opacity: isAssigned ? 0.7 : 1,
    }}>
      {task.isUrgent && (
        <div style={{ position: "absolute", top: 18, bottom: 18, left: 0, width: 1.5, background: t.danger, borderRadius: "0 2px 2px 0" }}/>
      )}

      {/* 상단: 작업번호 + 원청 + 시간 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", background: t.accentBg, color: t.accent, borderRadius: 4 }}>
          {task.client}
        </span>
        <span className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
          {task.id}
        </span>
        <div style={{ flex: 1 }}/>
        <span className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
          {task.receivedAgo}
        </span>
        {task.isUrgent && (
          <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", background: t.danger, color: "white", borderRadius: 5, display: "flex", alignItems: "center", gap: 3 }}>
            <AlertTriangle size={9}/>
            <span>긴급</span>
          </span>
        )}
      </div>

      {/* 긴급 사유 (있을 때만) */}
      {task.isUrgent && task.urgentReason && (
        <div style={{ 
          marginBottom: 10, padding: "6px 10px",
          background: t.dangerBg, 
          border: `1px solid ${t.dangerBorder}`,
          borderRadius: 7, fontSize: 11, color: t.danger, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <AlertTriangle size={11}/>
          <span>{task.urgentReason}</span>
        </div>
      )}

      {/* 고객 정보 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{task.customer}</span>
          <span className="mono" style={{ fontSize: 12, color: t.textSecondary, fontWeight: 500 }}>{task.phone}</span>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>{task.address}</div>
      </div>

      {/* 작업 + 일정 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontSize: 12, color: t.textSecondary, fontWeight: 600, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icon size={11} style={{ color: t.textMuted }}/>
          <span>{task.workSummary || `${task.workType} · ${task.appliance} ×${task.qty}`}</span>
        </div>
        <span style={{ color: t.textDim }}>·</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Calendar size={10} style={{ color: t.textMuted }}/>
          <span>{formatRequestedDate(task.requestedDate)} {task.requestedTime}</span>
        </div>
      </div>

      {/* 메모 (있을 때만) */}
      {task.happycallMemo && (
        <div style={{ padding: "8px 12px", background: t.bgInset, borderRadius: 8, fontSize: 11, color: t.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
          📝 {task.happycallMemo}
        </div>
      )}

      {/* 배정된 기사 (배정 완료 시) */}
      {isAssigned && (
        <div style={{ padding: "8px 12px", background: t.successBg, border: `1px solid ${t.successBorder}`, borderRadius: 8, fontSize: 12, color: t.success, marginBottom: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={12}/>
          <span>{task.assignedEngineer} 기사님 배정 완료</span>
        </div>
      )}

      {/* 액션 버튼 */}
      {!isAssigned && (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onAction("call")} style={{ ...btnSecondary(t), flex: "0 0 auto", width: 44, padding: "10px 0" }}>
            <Phone size={14}/>
          </button>
          {isUncontacted ? (
            <button onClick={() => onAction("contact")} style={{ ...btnSecondary(t), flex: 1 }}>
              <MessageCircle size={13}/>
              <span>통화 + 메모</span>
            </button>
          ) : (
            <button onClick={() => onAction("memo")} style={{ ...btnSecondary(t), flex: "0 0 auto", paddingLeft: 14, paddingRight: 14 }}>
              <Edit3 size={13}/>
            </button>
          )}
          <button onClick={() => onAction("assign")} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            padding: "10px 14px", background: t.accent, border: "none", borderRadius: 10,
            fontSize: 12, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "inherit",
          }}>
            <UserPlus size={13}/>
            <span>기사 배정</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// 커스텀 DatePicker (캘린더)
// ============================================
function CustomDatePicker({ t, value, onChange }) {
  const [viewYear, setViewYear] = useState(value ? new Date(value).getFullYear() : 2026);
  const [viewMonth, setViewMonth] = useState(value ? new Date(value).getMonth() : 3);
  
  const today = new Date("2026-04-27");
  const selectedDate = value ? new Date(value) : null;
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  
  const days = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  
  const handleDayClick = (day) => {
    if (!day) return;
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  };
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };
  const isToday = (day) => day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (day) => selectedDate && day === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear();
  const isPast = (day) => {
    if (!day) return false;
    const d = new Date(viewYear, viewMonth, day);
    const tc = new Date(today); tc.setHours(0, 0, 0, 0);
    return d < tc;
  };

  return (
    <div style={{ background: t.bgInset, border: `1px solid ${t.borderStrong}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={prevMonth} style={{ width: 32, height: 32, padding: 0, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={14} style={{ color: t.text }}/>
        </button>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{viewYear}년 {monthNames[viewMonth]}</div>
        <button onClick={nextMonth} style={{ width: 32, height: 32, padding: 0, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronRight size={14} style={{ color: t.text }}/>
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
        {dayNames.map((day, i) => (
          <div key={day} style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? "#F87171" : t.textMuted, textAlign: "center", padding: "6px 0" }}>{day}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {days.map((day, idx) => {
          const past = isPast(day);
          const today_ = isToday(day);
          const selected = isSelected(day);
          const dayOfWeek = idx % 7;
          return (
            <button key={idx} onClick={() => !past && handleDayClick(day)} disabled={!day || past} style={{
              aspectRatio: "1", border: "none", borderRadius: 8,
              fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
              fontWeight: selected ? 800 : today_ ? 700 : 500,
              cursor: !day || past ? "default" : "pointer",
              background: selected ? t.accent : today_ ? t.accentBg : "transparent",
              color: !day ? "transparent" : past ? t.textDim : selected ? "white" : today_ ? t.accent : dayOfWeek === 0 ? "#F87171" : t.text,
              position: "relative",
              opacity: past ? 0.4 : 1,
            }}>
              {day || ""}
              {today_ && !selected && <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: t.accent }}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// 새 접수 등록 화면
// ============================================
function NewReceptionScreen({ t, onCancel, onSubmit }) {
  const [client, setClient] = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  // 작업 항목 배열 (각 항목: { workType, appliance, qty })
  const [workItems, setWorkItems] = useState([
    { workType: "", appliance: "", qty: 1 }
  ]);
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [memo, setMemo] = useState("");
  // 긴급 토글 + 사유
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgentReason, setUrgentReason] = useState("");
  
  // 작업 항목 조작
  const updateItem = (idx, key, value) => {
    setWorkItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };
  const addItem = () => {
    setWorkItems(prev => [...prev, { workType: "", appliance: "", qty: 1 }]);
  };
  const removeItem = (idx) => {
    if (workItems.length === 1) return; // 최소 1개 유지
    setWorkItems(prev => prev.filter((_, i) => i !== idx));
  };

  // 모든 항목이 작업유형은 있어야 함, 수량 필요한 작업은 기종도 필수
  const allItemsValid = workItems.every(item => {
    if (!item.workType) return false;
    const wt = WORK_TYPES.find(x => x.id === item.workType);
    if (wt?.needsQty && !item.appliance) return false;
    return true;
  });
  
  const canSubmit = client && customer && phone && address && allItemsValid && requestedDate && (!isUrgent || urgentReason);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const newId = `A${new Date().toISOString().slice(2,10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 999) + 100)}`;
    // 작업 항목 요약 텍스트 생성
    const workSummary = workItems.map(item => {
      const wt = WORK_TYPES.find(x => x.id === item.workType);
      if (!wt?.needsQty) return item.workType;
      return `${item.workType} ${item.appliance} ${item.qty}대`;
    }).join(" + ");
    
    const totalQty = workItems.reduce((sum, item) => {
      const wt = WORK_TYPES.find(x => x.id === item.workType);
      return sum + (wt?.needsQty ? item.qty : 0);
    }, 0);
    
    onSubmit({
      id: newId, customer, phone, address, fullAddress: address,
      workType: workItems.map(i => i.workType).join("+"),
      appliance: workItems.filter(i => i.appliance).map(i => i.appliance).join("/"),
      qty: totalQty || 1,
      workItems, // 전체 항목 배열 저장
      workSummary,
      icon: Snowflake,
      requestedDate, requestedTime, receivedAt: NOW, receivedAgo: "방금",
      happycallStatus: "uncontacted", 
      isUrgent, urgentReason: isUrgent ? urgentReason : "",
      assignedEngineer: null, happycallMemo: memo, client,
    });
  };

  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 130, color: t.text }}>
      <style>{`
        .mono { font-family: 'JetBrains Mono', monospace; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: t.bg, borderBottom: `1px solid ${t.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="clickable" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
          <ArrowLeft size={18}/><span style={{ fontSize: 14, fontWeight: 600 }}>취소</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800 }}>새 접수 등록</span>
        <div style={{ width: 60 }}/>
      </div>

      <div style={{ padding: "20px" }}>
        {/* 원청 선택 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>🏪 원청 선택</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {CLIENTS.map(c => (
              <button key={c.id} onClick={() => setClient(c.name)} style={{
                padding: "12px 8px",
                background: client === c.name ? t.accent : t.bgInset,
                color: client === c.name ? "white" : t.text,
                border: `1.5px solid ${client === c.name ? t.accent : t.border}`,
                borderRadius: 9, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* 고객 정보 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>👤 고객 정보</label>
          <input type="text" placeholder="이름" value={customer} onChange={(e) => setCustomer(e.target.value)} style={{ ...inputStyle(t), marginBottom: 8 }}/>
          <input type="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...inputStyle(t), fontFamily: "'JetBrains Mono', monospace" }}/>
        </div>

        {/* 주소 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>📍 주소</label>
          <input type="text" placeholder="강남구 도곡동 (도로명 + 상세)" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle(t)}/>
        </div>

        {/* 작업 정보 (줄별 입력) */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ ...labelStyle(t), marginBottom: 0 }}>🔧 작업 정보</label>
            {workItems.length > 1 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: t.accent, padding: "2px 8px", background: t.accentBg, borderRadius: 6 }}>
                {workItems.length}개 항목
              </span>
            )}
          </div>
          
          {workItems.map((item, idx) => {
            const wt = WORK_TYPES.find(x => x.id === item.workType);
            const needsQty = wt?.needsQty;
            
            return (
              <div key={idx} style={{ 
                background: t.bgInset, 
                border: `1px solid ${t.borderStrong}`,
                borderRadius: 12, 
                padding: 14, 
                marginBottom: 8,
              }}>
                {/* 항목 헤더 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
                    항목 {idx + 1}
                  </div>
                  {workItems.length > 1 && (
                    <button onClick={() => removeItem(idx)} style={{
                      width: 28, height: 28, padding: 0,
                      background: t.dangerBg, 
                      border: `1px solid ${t.dangerBorder}`,
                      borderRadius: 7, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <X size={13} style={{ color: t.danger }}/>
                    </button>
                  )}
                </div>
                
                {/* 작업유형 */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
                    작업
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {WORK_TYPES.map(type => {
                      const active = item.workType === type.id;
                      return (
                        <button key={type.id} onClick={() => updateItem(idx, "workType", type.id)} style={{
                          padding: "7px 11px",
                          background: active ? t.accent : t.bgElevated,
                          color: active ? "white" : t.text,
                          border: `1px solid ${active ? t.accent : t.border}`,
                          borderRadius: 8, fontSize: 11, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit",
                        }}>
                          {type.id}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* 기종 + 수량 (필요한 작업만) */}
                {needsQty ? (
                  <div>
                    <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
                      기종 + 수량
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {APPLIANCES.map(a => {
                        const active = item.appliance === a;
                        return (
                          <button key={a} onClick={() => updateItem(idx, "appliance", a)} style={{
                            padding: "7px 11px",
                            background: active ? t.accent : t.bgElevated,
                            color: active ? "white" : t.text,
                            border: `1px solid ${active ? t.accent : t.border}`,
                            borderRadius: 8, fontSize: 11, fontWeight: 700,
                            cursor: "pointer", fontFamily: "inherit",
                          }}>
                            {a}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>수량</span>
                      <button onClick={() => updateItem(idx, "qty", Math.max(1, item.qty - 1))} style={{ width: 32, height: 32, padding: 0, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 16 }}>−</button>
                      <span className="mono" style={{ fontSize: 16, fontWeight: 700, minWidth: 22, textAlign: "center" }}>{item.qty}</span>
                      <button onClick={() => updateItem(idx, "qty", item.qty + 1)} style={{ width: 32, height: 32, padding: 0, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 16 }}>+</button>
                      <span className="mono" style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>대</span>
                    </div>
                  </div>
                ) : item.workType ? (
                  <div style={{ 
                    fontSize: 11, color: t.textMuted, 
                    padding: "8px 12px", background: t.bgElevated,
                    border: `1px dashed ${t.border}`, borderRadius: 7, 
                    textAlign: "center",
                  }}>
                    ℹ️ 수량 입력 불필요
                  </div>
                ) : null}
              </div>
            );
          })}
          
          {/* + 항목 추가 */}
          <button onClick={addItem} style={{
            width: "100%", padding: "13px",
            background: "transparent",
            border: `1px dashed ${t.accent}`,
            borderRadius: 10, fontSize: 12, fontWeight: 700,
            color: t.accent, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Plus size={14}/>
            <span>작업 항목 추가</span>
          </button>
          
          {/* 작업 요약 미리보기 */}
          {allItemsValid && workItems.some(i => i.workType) && (
            <div style={{ 
              marginTop: 10, padding: "10px 12px",
              background: t.successBg, 
              border: `1px solid ${t.successBorder}`,
              borderRadius: 9,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.success, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
                📋 작업 요약
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: t.text }}>
                {workItems.map((item, idx) => {
                  const wt = WORK_TYPES.find(x => x.id === item.workType);
                  const needsQty = wt?.needsQty;
                  return (
                    <div key={idx}>
                      • {item.workType}
                      {needsQty && item.appliance && ` · ${item.appliance} ${item.qty}대`}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* 긴급 토글 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>🚨 긴급 처리</label>
          <button 
            onClick={() => setIsUrgent(!isUrgent)}
            style={{
              width: "100%", padding: "12px 14px",
              background: isUrgent ? t.dangerBg : t.bgInset,
              border: `1px solid ${isUrgent ? t.dangerBorder : t.borderStrong}`,
              borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={16} style={{ color: isUrgent ? t.danger : t.textMuted }}/>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isUrgent ? t.danger : t.text }}>
                  긴급 작업으로 표시
                </div>
                <div style={{ fontSize: 11, color: isUrgent ? t.danger : t.textMuted, opacity: 0.8, marginTop: 2 }}>
                  {isUrgent ? "우선 배정 처리됩니다" : "필요 시 활성화"}
                </div>
              </div>
            </div>
            {/* 토글 스위치 */}
            <div style={{
              width: 38, height: 22,
              background: isUrgent ? t.danger : t.borderStrong,
              borderRadius: 11, position: "relative", flexShrink: 0,
              transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute", top: 2, 
                left: isUrgent ? "auto" : 2, right: isUrgent ? 2 : "auto",
                width: 18, height: 18, background: "white",
                borderRadius: "50%", transition: "all 0.2s",
              }}/>
            </div>
          </button>
          
          {/* 긴급 사유 (활성 시만) */}
          {isUrgent && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>
                긴급 사유 <span style={{ color: t.danger }}>*</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                {URGENT_REASONS.map(reason => (
                  <button key={reason} onClick={() => setUrgentReason(reason)} style={{
                    padding: "7px 11px",
                    background: urgentReason === reason ? t.danger : t.bgInset,
                    color: urgentReason === reason ? "white" : t.text,
                    border: `1px solid ${urgentReason === reason ? t.danger : t.border}`,
                    borderRadius: 8, fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    {reason}
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="직접 입력 또는 추가 메모..."
                value={URGENT_REASONS.includes(urgentReason) ? "" : urgentReason}
                onChange={(e) => setUrgentReason(e.target.value)}
                style={inputStyle(t)}
              />
            </div>
          )}
        </div>

        {/* 희망 일정 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>📅 고객 희망 일정</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[
              { label: "오늘", date: "2026-04-27" },
              { label: "내일", date: "2026-04-28" },
              { label: "모레", date: "2026-04-29" },
            ].map(opt => (
              <button key={opt.date} onClick={() => setRequestedDate(opt.date)} style={{ ...chipBtn(t, requestedDate === opt.date), flex: 1 }}>
                {opt.label}
              </button>
            ))}
          </div>
          <CustomDatePicker t={t} value={requestedDate} onChange={setRequestedDate}/>
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 6, marginTop: 12 }}>시간대 (대략)</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["오전", "낮 시간", "오후", "저녁"].map(time => (
              <button key={time} onClick={() => setRequestedTime(time)} style={{ ...chipBtn(t, requestedTime === time), flex: 1 }}>
                {time}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: t.textDim, fontWeight: 500, marginTop: 8, lineHeight: 1.5 }}>
            ℹ️ 정확한 시간은 기사님이 고객과 통화 후 협의하여 입력해요
          </div>
        </div>

        {/* 메모 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>📝 메모 (선택)</label>
          <textarea placeholder="고객 요청사항, 특이사항..." value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} style={{ ...inputStyle(t), minHeight: 80, resize: "vertical" }}/>
        </div>
      </div>

      {/* 하단 액션 */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 420, margin: "0 auto", background: t.bg, borderTop: `1px solid ${t.border}`, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ ...btnSecondary(t), flex: "0 0 100px" }}>
            <span>취소</span>
          </button>
          <button onClick={canSubmit ? handleSubmit : undefined} disabled={!canSubmit} style={{ ...btnPrimary(t), opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? "pointer" : "not-allowed" }}>
            <CheckCircle2 size={15}/>
            <span>{canSubmit ? "접수 등록" : "필수 정보 입력"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 기사 배정 화면
// ============================================
function AssignEngineerScreen({ t, task, onCancel, onAssign }) {
  const [selectedEngineerId, setSelectedEngineerId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 작업 시간 계산: 작업 대수 × 1시간 + 이동시간
  const totalQty = task.workItems 
    ? task.workItems.reduce((sum, item) => {
        const wt = WORK_TYPES.find(x => x.id === item.workType);
        return sum + (wt?.needsQty ? item.qty : 0);
      }, 0) 
    : (task.qty || 1);
  
  // 희망일
  const requestedDate = task.requestedDate || "2026-04-28";
  
  // 각 기사별 등급 + 가능 시간 계산
  const engineersWithGrade = ENGINEERS.map(e => {
    const durationHours = totalQty + (e.travelMin / 60);
    return { ...e, ...getEngineerGrade(e, requestedDate, durationHours), durationHours, totalQty };
  }).filter(e => 
    e.name.includes(searchQuery) || e.region.includes(searchQuery)
  );
  
  // 작업 지역 추출 (예: "강남구 도곡동" → "강남")
  const taskRegion = (task.address || "").match(/(강남|서초|송파|종로|중구|마포|용산|성동|광진|동대문|서대문|영등포|동작|관악|구로|금천|양천|강서|은평|노원|도봉|강북|성북|중랑|강동)/)?.[0] || "";
  
  // 기사가 작업 지역 담당하는지 확인 (예: 기사 region "강남/송파" + taskRegion "강남" → true)
  const isAreaSpecialist = (engineer) => {
    if (!taskRegion) return false;
    return engineer.region.includes(taskRegion);
  };
  
  // 정렬: 추천 → 가능 → 불가
  const gradeOrder = { "추천": 0, "가능": 1, "불가": 2 };
  const sorted = [...engineersWithGrade].sort((a, b) => {
    // 1순위: 등급
    const ga = gradeOrder[a.grade];
    const gb = gradeOrder[b.grade];
    if (ga !== gb) return ga - gb;
    
    // 2순위: 이동시간 (이전 스케줄에서 이 작업까지 이동시간 짧은 사람)
    if (a.travelMin !== b.travelMin) return a.travelMin - b.travelMin;
    
    // 3순위: 지역 담당자 우선
    const aSpec = isAreaSpecialist(a);
    const bSpec = isAreaSpecialist(b);
    if (aSpec !== bSpec) return aSpec ? -1 : 1;
    
    // 4순위: 거리
    return a.distanceKm - b.distanceKm;
  });
  
  // 지역 담당 정보를 기사 객체에 추가
  const recommended = sorted.filter(e => e.grade === "추천").map(e => ({ ...e, isAreaSpecialist: isAreaSpecialist(e) }));
  const possible = sorted.filter(e => e.grade === "가능").map(e => ({ ...e, isAreaSpecialist: isAreaSpecialist(e) }));
  const unavailable = sorted.filter(e => e.grade === "불가").map(e => ({ ...e, isAreaSpecialist: isAreaSpecialist(e) }));

  const handleAssign = () => {
    if (!selectedEngineerId) return;
    const engineer = ENGINEERS.find(e => e.id === selectedEngineerId);
    onAssign(engineer.name);
  };

  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 130, color: t.text }}>
      <style>{`
        .mono { font-family: 'JetBrains Mono', monospace; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }
        .slide-down { animation: slideDown 0.3s ease-out; overflow: hidden; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: t.bg, borderBottom: `1px solid ${t.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="clickable" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
          <ArrowLeft size={18}/><span style={{ fontSize: 14, fontWeight: 600 }}>취소</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800 }}>기사 배정</span>
        <div style={{ width: 60 }}/>
      </div>

      <div style={{ padding: "20px" }}>
        {/* 작업 정보 + 필요 시간 */}
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", background: t.accentBg, color: t.accent, borderRadius: 4 }}>
                {task.client}
              </span>
              <span className="mono" style={{ fontSize: 10, color: t.textMuted }}>{task.id}</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", background: t.accentBg, color: t.accent, borderRadius: 5 }}>
              희망 {formatRequestedDate(requestedDate)}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{task.customer}님 · {task.address}</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
            {task.workSummary || `${task.workType} · ${task.appliance} ×${task.qty}`}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: t.bgInset, borderRadius: 8, fontSize: 11 }}>
            <Clock size={12} style={{ color: t.accent }}/>
            <span style={{ color: t.textMuted }}>필요 시간:</span>
            <span className="mono" style={{ color: t.text, fontWeight: 700 }}>약 {totalQty}시간 + 이동</span>
          </div>
        </div>

        {/* 검색 */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
          <input type="text" placeholder="기사 이름 / 지역 검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...inputStyle(t), paddingLeft: 36 }}/>
        </div>

        {/* 시간 라벨 (24시간) */}
        <TimelineHeader t={t}/>

        {/* 추천 기사 */}
        {recommended.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.success, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <Star size={11}/><span>추천</span>
              <span style={{ color: t.textMuted, fontWeight: 500 }}>· 희망일 09~22시 가능</span>
            </div>
            {recommended.map(e => (
              <EngineerTimelineCard 
                key={e.id} engineer={e} t={t} 
                selected={selectedEngineerId === e.id}
                expanded={expandedId === e.id}
                onSelect={() => setSelectedEngineerId(e.id)}
                onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                requestedDate={requestedDate}
              />
            ))}
          </div>
        )}

        {/* 가능 기사 */}
        {possible.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={11}/><span>가능</span>
              <span style={{ color: t.textMuted, fontWeight: 500 }}>· 다른 날 가능 (고객 변경 협의)</span>
            </div>
            {possible.map(e => (
              <EngineerTimelineCard 
                key={e.id} engineer={e} t={t} 
                selected={selectedEngineerId === e.id}
                expanded={expandedId === e.id}
                onSelect={() => setSelectedEngineerId(e.id)}
                onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                requestedDate={requestedDate}
              />
            ))}
          </div>
        )}

        {/* 불가 기사 */}
        {unavailable.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <X size={11}/><span>불가</span>
              <span style={{ color: t.textDim, fontWeight: 500 }}>· 빈자리 없음</span>
            </div>
            {unavailable.map(e => (
              <EngineerTimelineCard 
                key={e.id} engineer={e} t={t} 
                selected={selectedEngineerId === e.id}
                expanded={expandedId === e.id}
                onSelect={null}
                onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                requestedDate={requestedDate}
                disabled
              />
            ))}
          </div>
        )}

        {/* 자동 처리 안내 */}
        {selectedEngineerId && (
          <div style={{ 
            marginTop: 16,
            background: t.successBg, 
            border: `1px solid ${t.successBorder}`,
            borderRadius: 12, padding: "14px 16px",
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <CheckCircle2 size={18} style={{ color: t.success, marginTop: 1, flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.success, marginBottom: 8 }}>
                배정 시 자동 처리되는 항목
              </div>
              <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.8 }}>
                <div style={{ marginBottom: 4 }}>📋 작업DB에 <strong style={{ color: t.text }}>{ENGINEERS.find(e => e.id === selectedEngineerId).name}</strong> 기사 배정 기록</div>
                <div style={{ marginBottom: 4 }}>📅 Google Calendar에 일정 자동 등록</div>
                <div style={{ marginBottom: 4 }}>💬 기사님에게 <strong style={{ color: t.text }}>텔레그램 알림</strong> 발송</div>
                <div>🔄 작업 상태 "약속대기"로 변경</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 하단 액션 */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 420, margin: "0 auto", background: t.bg, borderTop: `1px solid ${t.border}`, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ ...btnSecondary(t), flex: "0 0 100px" }}>
            <span>취소</span>
          </button>
          <button onClick={selectedEngineerId ? handleAssign : undefined} disabled={!selectedEngineerId} style={{ ...btnPrimary(t), opacity: selectedEngineerId ? 1 : 0.4, cursor: selectedEngineerId ? "pointer" : "not-allowed" }}>
            <UserPlus size={15}/>
            <span>{selectedEngineerId ? `${ENGINEERS.find(e => e.id === selectedEngineerId).name} 배정` : "기사 선택"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 시간 라벨 헤더 (24시간)
// ============================================
function TimelineHeader({ t }) {
  return (
    <div style={{ marginBottom: 6, padding: "0 4px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8 }}>
        <div></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 기사 타임라인 카드
// ============================================
function EngineerTimelineCard({ engineer, t, selected, expanded, onSelect, onToggle, requestedDate, disabled }) {
  const items = engineer.schedule[requestedDate] || [];
  const grade = engineer.grade;
  const slot = engineer.slot;
  const alts = engineer.alternatives;
  
  const gradeColor = grade === "추천" ? t.success : grade === "가능" ? t.warning : t.textMuted;
  const gradeBg = grade === "추천" ? t.successBg : grade === "가능" ? t.warningBg : t.bgInset;
  
  return (
    <div style={{
      background: selected ? t.accentBg : disabled ? t.bgInset : t.bgElevated,
      border: `${selected ? 2 : 1}px solid ${selected ? t.accent : t.border}`,
      borderRadius: 12,
      marginBottom: 6,
      opacity: disabled ? 0.6 : 1,
      transition: "all 0.2s",
    }}>
      <div style={{ padding: "12px 14px" }}>
        {/* 막대 영역 */}
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8, alignItems: "center", marginBottom: 8 }}>
          {/* 왼쪽: 기사 정보 */}
          <div onClick={!disabled ? onSelect : undefined} className={!disabled ? "clickable" : ""} style={{ cursor: disabled ? "default" : "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: selected ? t.accent : t.accentBg,
                color: selected ? "white" : t.accent,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, flexShrink: 0,
              }}>
                {engineer.name.slice(0, 1)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{engineer.name}</div>
            </div>
            <div style={{ fontSize: 9, color: t.textMuted, paddingLeft: 27 }} className="mono">
              {engineer.distanceKm}km
            </div>
          </div>
          
          {/* 오른쪽: 24시간 막대 */}
          <div onClick={onToggle} className="clickable" style={{
            position: "relative", height: 26,
            background: t.bgInset, borderRadius: 6, overflow: "hidden",
          }}>
            {/* 새벽 음영 (00~09) */}
            <div style={{ 
              position: "absolute", left: 0, width: "37.5%", top: 0, bottom: 0,
              background: t.isLight 
                ? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)"
                : "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 8px)",
            }}/>
            {/* 야간 음영 (22~24) */}
            <div style={{ 
              position: "absolute", left: "91.66%", width: "8.34%", top: 0, bottom: 0,
              background: t.isLight 
                ? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)"
                : "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 8px)",
            }}/>
            
            {/* 그리드 라인 (06, 12, 18시) */}
            <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: 1, background: t.isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)", zIndex: 1 }}/>
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: t.isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)", zIndex: 1 }}/>
            <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, width: 1, background: t.isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)", zIndex: 1 }}/>
            
            {/* 기존 작업들 */}
            {items.map((item, idx) => (
              <div key={idx} style={{
                position: "absolute",
                left: `${timeToPercent(item.start)}%`,
                width: `${timeToPercent(item.end) - timeToPercent(item.start)}%`,
                top: 0, bottom: 0,
                background: t.textMuted,
                borderRight: `1px solid ${t.bg}`,
                opacity: 0.7,
                zIndex: 2,
              }}/>
            ))}
            
            {/* 추천 자리 (희망일, 09~22시) - 텍스트 없이 색만 */}
            {grade === "추천" && slot && (
              <div style={{
                position: "absolute",
                left: `${timeToPercent(slot.start)}%`,
                width: `${timeToPercent(slot.end) - timeToPercent(slot.start)}%`,
                top: 2, bottom: 2,
                background: t.success,
                borderRadius: 4,
                zIndex: 2,
              }}/>
            )}
          </div>
        </div>
        
        {/* 등급 + 가능 시간 + 액션 라인 */}
        <div style={{ paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
              <span style={{ 
                fontSize: 11, padding: "3px 8px", 
                background: gradeColor, color: "white",
                borderRadius: 5, fontWeight: 700, flexShrink: 0,
                display: "flex", alignItems: "center", gap: 3,
              }}>
                {grade === "추천" && <Star size={10} fill="white"/>}
                <span>{grade}</span>
              </span>
              <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {engineer.region}
                {engineer.isAreaSpecialist && (
                  <span style={{ marginLeft: 5, padding: "1px 6px", background: t.accentBg, color: t.accent, borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                    지역담당
                  </span>
                )}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {grade === "추천" && slot && (
                <span className="mono" style={{ 
                  fontSize: 11, color: t.success, fontWeight: 700,
                }}>
                  {String(Math.floor(slot.start)).padStart(2,'0')}:{String(Math.round((slot.start%1)*60)).padStart(2,'0')}~{String(Math.floor(slot.end)).padStart(2,'0')}:{String(Math.round((slot.end%1)*60)).padStart(2,'0')}
                </span>
              )}
              {grade === "가능" && alts.length > 0 && (
                <span style={{ fontSize: 11, color: t.warning, fontWeight: 600 }}>
                  {formatRequestedDate(alts[0].date)} 가능
                </span>
              )}
              {grade === "불가" && (
                <span style={{ fontSize: 11, color: t.textMuted }}>빈자리 없음</span>
              )}
              <ChevronRight size={12} style={{ 
                color: t.textMuted, 
                transform: expanded ? "rotate(90deg)" : "none",
                transition: "transform 0.2s",
              }}/>
            </div>
          </div>
        </div>
      </div>
      
      {/* 펼쳐진 상세 정보 */}
      {expanded && (
        <div className="slide-down" style={{ 
          padding: "0 14px 14px",
          borderTop: `1px solid ${t.border}`,
        }}>
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
              {formatRequestedDate(requestedDate)} 일정
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {items.length === 0 ? (
                <div style={{ fontSize: 11, color: t.textMuted, padding: "10px 12px", background: t.bgInset, borderRadius: 7, textAlign: "center" }}>
                  이 날 다른 일정 없음
                </div>
              ) : items.map((item, idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, padding: "8px 10px", background: t.bgInset, borderRadius: 7 }}>
                  <div className="mono" style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600, minWidth: 75 }}>
                    {String(Math.floor(item.start)).padStart(2,'0')}:{String(Math.round((item.start%1)*60)).padStart(2,'0')}~{String(Math.floor(item.end)).padStart(2,'0')}:{String(Math.round((item.end%1)*60)).padStart(2,'0')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{item.customer} · {item.workType}</div>
                    <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1 }}>{item.location}</div>
                  </div>
                </div>
              ))}
              
              {/* 가능한 자리 */}
              {grade === "추천" && slot && (
                <div style={{ 
                  display: "flex", gap: 10, padding: "10px 12px", 
                  background: t.successBg, 
                  border: `1px dashed ${t.success}`, 
                  borderRadius: 7, marginTop: 4,
                }}>
                  <div className="mono" style={{ fontSize: 11, color: t.success, fontWeight: 700, minWidth: 75 }}>
                    {String(Math.floor(slot.start)).padStart(2,'0')}:00~{String(Math.floor(slot.end)).padStart(2,'0')}:{String(Math.round((slot.end%1)*60)).padStart(2,'0')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.success }}>⭐ 이 자리에 배정 가능</div>
                    <div style={{ fontSize: 10, color: t.success, opacity: 0.8, marginTop: 1 }}>
                      이동 {engineer.travelMin}분 + 작업 {engineer.totalQty}시간
                    </div>
                  </div>
                </div>
              )}
              
              {/* 가능 자리들 */}
              {grade === "가능" && alts.map((alt, idx) => (
                <div key={`alt-detail-${idx}`} style={{ 
                  display: "flex", gap: 10, padding: "10px 12px", 
                  background: t.warningBg, 
                  border: `1px dashed ${t.warning}`, 
                  borderRadius: 7, marginTop: 4,
                }}>
                  <div className="mono" style={{ fontSize: 11, color: t.warning, fontWeight: 700, minWidth: 75 }}>
                    {String(Math.floor(alt.start)).padStart(2,'0')}:00
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: t.warning }}>
                      📅 {formatRequestedDate(alt.date)} 가능
                    </div>
                    <div style={{ fontSize: 10, color: t.warning, opacity: 0.8, marginTop: 1 }}>
                      희망일 변경 협의 필요
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 선택 버튼 */}
            {!disabled && (
              <button onClick={onSelect} style={{
                width: "100%", marginTop: 10, padding: "10px",
                background: selected ? t.accent : t.bgElevated,
                color: selected ? "white" : t.text,
                border: `1px solid ${selected ? t.accent : t.borderStrong}`,
                borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
                {selected ? <CheckCircle2 size={13}/> : <UserPlus size={13}/>}
                <span>{selected ? "선택됨" : `${engineer.name} 선택`}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 메모 입력 모달 (간단)
// ============================================
function MemoEditScreen({ t, task, onCancel, onSave }) {
  const [memo, setMemo] = useState(task.happycallMemo || "");
  const [statusToSet, setStatusToSet] = useState("contacted");

  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 130, color: t.text }}>
      <style>{`.clickable { cursor: pointer; transition: opacity 0.15s; } .clickable:active { opacity: 0.7; }`}</style>
      
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: t.bg, borderBottom: `1px solid ${t.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="clickable" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
          <ArrowLeft size={18}/><span style={{ fontSize: 14, fontWeight: 600 }}>취소</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800 }}>통화 메모</span>
        <div style={{ width: 60 }}/>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{task.customer}님</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            {task.workType} · {task.appliance} ×{task.qty}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>📝 통화 메모</label>
          <textarea placeholder="고객 요청사항, 일정 협의 결과, 특이사항..." value={memo} onChange={(e) => setMemo(e.target.value)} rows={5} style={{ ...inputStyle(t), minHeight: 120, resize: "vertical" }}/>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 420, margin: "0 auto", background: t.bg, borderTop: `1px solid ${t.border}`, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ ...btnSecondary(t), flex: "0 0 100px" }}><span>취소</span></button>
          <button onClick={() => onSave(memo)} style={btnPrimary(t)}>
            <CheckCircle2 size={15}/>
            <span>통화 후 저장</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 메인 앱
// ============================================
export default function HappycallApp({ user, onLogout }) {
  const [mode, setMode] = useState("dark");
  const [screen, setScreen] = useState("main");
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const t = THEMES[mode];
  const selectedTask = tasks.find(x => x.id === selectedTaskId);

  const handleNewReception = () => setScreen("newReception");
  
  const handleSubmitReception = (newTask) => {
    setTasks([newTask, ...tasks]);
    setScreen("main");
  };

  const handleTaskAction = (task, action) => {
    setSelectedTaskId(task.id);
    if (action === "call") {
      alert(`${task.customer}님(${task.phone})에게 전화 연결...`);
    } else if (action === "contact" || action === "memo") {
      setScreen("memo");
    } else if (action === "assign") {
      setScreen("assign");
    }
  };

  const handleSaveMemo = (memo) => {
    setTasks(tasks.map(x => x.id === selectedTaskId ? { ...x, happycallMemo: memo, happycallStatus: "contacted" } : x));
    setScreen("main");
  };

  const handleAssign = (engineerName) => {
    setTasks(tasks.map(x => x.id === selectedTaskId ? { ...x, assignedEngineer: engineerName, happycallStatus: "assigned" } : x));
    setScreen("main");
  };

  const reset = () => { setTasks(INITIAL_TASKS); setScreen("main"); setSelectedTaskId(null); };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(10,10,10,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginBottom: 6, textAlign: "center", fontFamily: "system-ui", fontWeight: 600 }}>📞 해피콜 담당자 화면</div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textAlign: "center", fontFamily: "system-ui", lineHeight: 1.5 }}>
          고객 응대 + 기사 배정 (정산 권한 X)
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {Object.entries(THEMES).map(([key, theme]) => {
            const Icon = theme.icon;
            return (
              <button key={key} onClick={() => setMode(key)} style={{ flex: 1, padding: "10px 8px", background: mode === key ? (key === "dark" ? "#221C18" : "#FFFFFF") : "rgba(255,255,255,0.05)", color: mode === key ? (key === "dark" ? "#FAF8F5" : "#0A0A0A") : "#888", border: mode === key ? `1.5px solid ${theme.accent}` : "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "system-ui", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon size={14}/><span>{theme.name}</span>
              </button>
            );
          })}
        </div>
        <button onClick={onLogout} style={{ width: "100%", padding: "8px 8px", background: "rgba(255,255,255,0.03)", color: "#aaa", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <RotateCcw size={11}/><span>로그아웃 (다른 계정으로 로그인)</span>
        </button>
      </div>
      
      <div style={{ maxWidth: 420, margin: "0 auto", position: "relative" }}>
        {screen === "main" && <HappycallMainScreen t={t} tasks={tasks} onNewReception={handleNewReception} onTaskAction={handleTaskAction} />}
        {screen === "newReception" && <NewReceptionScreen t={t} onCancel={() => setScreen("main")} onSubmit={handleSubmitReception} />}
        {screen === "memo" && selectedTask && <MemoEditScreen t={t} task={selectedTask} onCancel={() => setScreen("main")} onSave={handleSaveMemo} />}
        {screen === "assign" && selectedTask && <AssignEngineerScreen t={t} task={selectedTask} onCancel={() => setScreen("main")} onAssign={handleAssign} />}
      </div>
    </div>
  );
}
