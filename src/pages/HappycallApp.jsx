import { useState, useEffect } from "react";
import { updateTaskStatus, getTasks, updateTask as apiUpdateTask } from "../api.js";
import { v14NormalizeTask, v14FindTaskList } from "../utils/v14Task.js";
import { 
  Phone, MessageCircle, Snowflake, Wrench, Settings, Zap, ChevronRight, ChevronLeft,
  Sun, Moon, Plus, ArrowLeft, ArrowRight, User, MapPin, Calendar,
  Clock, FileText, RotateCcw, CheckCircle2, AlertCircle, AlertTriangle, Search, Star,
  PhoneCall, UserPlus, Edit3, Bell, X
} from "lucide-react";
import { useTasks } from "../shared/TasksContext.jsx";

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
    offDays: [],
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
    offDays: [],
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
    offDays: [
      { date: "2026-04-29", type: "종일", reason: "개인 사정" },
    ],
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
    offDays: [],
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
    offDays: [
      { date: "2026-04-28", type: "종일", reason: "병원" },
    ],
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
  // 휴무 체크 (종일 휴무는 무조건 불가)
  const offToday = (engineer.offDays || []).find(o => o.date === requestedDate && o.type === "종일");
  if (offToday) {
    return { 
      grade: "불가", 
      slot: null, 
      alternatives: [], 
      offReason: offToday.reason || "휴무" 
    };
  }
  
  const recommended = findRecommendedSlot(engineer, requestedDate, durationHours);
  if (recommended) return { grade: "추천", slot: recommended, alternatives: [], offReason: null };
  
  const alts = findAlternativeSlots(engineer, requestedDate, durationHours);
  if (alts.length > 0) return { grade: "가능", slot: null, alternatives: alts, offReason: null };
  
  return { grade: "불가", slot: null, alternatives: [], offReason: null };
}
// 시트 → INITIAL_TASKS 형식 변환 (해피콜용)
function convertSheetTaskHC(s) {
  const statusMap = { "미배정": "약속대기", "배정완료": "확정", "확정": "확정", "진행중": "진행중", "완료": "완료" };
  const happycallStatusMap = { "미배정": "uncontacted", "확정": "assigned", "진행중": "assigned", "완료": "completed" };
  
  const toDate = v => {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  
  return {
    id: s.taskId,
    customer: s.customer || "고객",
    phone: s.phone || "",
    address: s.address || "",
    fullAddress: s.address || "",
    region: s.region || "",
    workType: s.summary || "작업",
    appliance: "기종",
icon: Wrench,
    qty: s.totalQty || 1,
    status: statusMap[s.status] || "약속대기",
    happycallStatus: happycallStatusMap[s.status] || "uncontacted",
    assignedEngineer: s.assignedEngineer || null,
    happycallMemo: "",
    client: s.principal || "",
    channel: s.channel || "—",
    receivedAt: toDate(s.receivedAt) || "",
    requestedDate: toDate(s.requestedDate) || "",
    requestedTime: s.requestedTime || "",
    scheduledDate: toDate(s.scheduledAt),
    requestNote: s.requestNote || "",
  };
}
const CLIENTS = [
  { id: "olday",      name: "올데이케어",   color: "#FF1B8D", prefix: "A" },
  { id: "coolguy",    name: "쿨가이",      color: "#FF1B8D", prefix: "A" },
  { id: "yongin",     name: "용인컴퍼니",   color: "#FF1B8D", prefix: "A" },
  { id: "creakclean", name: "크리크린",     color: "#FF1B8D", prefix: "CC" },
  { id: "yusol",      name: "유솔홈케어",   color: "#10B981", prefix: "YS" },
  { id: "mango",      name: "망고클린",     color: "#FACC15", prefix: "MG" },
];

// ── 가격 시세 mock ──
// 실제 운영 시 수수료정책 시트에서 가져옴. 지금은 시뮬용 평균 추정.
// key 형식: "작업유형_기종" 또는 "작업유형" (수량 무관)
const BASE_PRICES = {
  // 세척
  "세척_벽걸이":       70000,
  "세척_스탠드":      130000,
  "세척_천장형":      200000,
  "세척_1way":        180000,
  "세척_4way":        250000,
  "세척_시스템 멀티":  220000,
  "세척_이동식":       60000,
  // 분해세척
  "분해세척_벽걸이":   90000,
  "분해세척_스탠드":  160000,
  "분해세척_천장형":  240000,
  // 점검류
  "점검":                  0,
  "가스점검":          30000,
  "수리":              50000,
  // 냉매충전
  "냉매충전_벽걸이":   80000,
  "냉매충전_스탠드":   90000,
  "냉매충전_천장형":  120000,
  // 설치
  "설치_벽걸이":      150000,
  "설치_스탠드":      250000,
  "설치_천장형":      400000,
  // 이전설치
  "이전설치_벽걸이":  200000,
  "이전설치_스탠드":  330000,
};

// 원청별 가격 비율 (mock)
const CLIENT_RATIO = {
  "올데이케어":   1.00,
  "쿨가이":       0.93,
  "용인컴퍼니":   1.07,
  "크리크린":     1.07,
  "유솔홈케어":   1.29,  // 네이버 마진 반영
  "망고클린":     1.00,
};

// 시세 계산: 원청 + 작업유형 + 기종 → 예상 단가
function getPriceHint(client, workType, appliance) {
  if (!client || !workType) return null;
  const ratio = CLIENT_RATIO[client] ?? 1.0;
  // 수량 필요한 작업: workType_appliance, 아니면 workType만
  const wt = WORK_TYPES.find(x => x.id === workType);
  const key = wt?.needsQty && appliance ? `${workType}_${appliance}` : workType;
  const base = BASE_PRICES[key];
  if (base == null) return null;
  return Math.round((base * ratio) / 1000) * 1000;  // 천원 단위
}

// 작업 항목 배열 → 합산 시세
function calculateTotalHint(client, workItems) {
  if (!client || !workItems) return null;
  let total = 0;
  let hasAny = false;
  for (const item of workItems) {
    if (!item.workType) continue;
    const wt = WORK_TYPES.find(x => x.id === item.workType);
    const unit = getPriceHint(client, item.workType, item.appliance);
    if (unit == null) continue;
    const qty = wt?.needsQty ? (item.qty || 1) : 1;
    total += unit * qty;
    hasAny = true;
  }
  return hasAny ? total : null;
}

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
    warning: "#FF1B8D", warningBg: "rgba(251, 191, 36, 0.10)", warningBorder: "rgba(251, 191, 36, 0.3)",
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
    warning: "#FF1B8D", warningBg: "rgba(217, 119, 6, 0.08)", warningBorder: "rgba(217, 119, 6, 0.22)",
    success: "#16A34A", successBg: "rgba(22, 163, 74, 0.08)", successBorder: "rgba(22, 163, 74, 0.25)",
    danger: "#FF3D5A", dangerBg: "rgba(220, 38, 38, 0.08)", dangerBorder: "rgba(220, 38, 38, 0.25)",
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
function HappycallMainScreen({ t, tasks, onNewReception, onTaskAction, user }) {
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
    <div style={{ fontFamily: "'Pretendard', -apple-system, sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 80, color: t.text }}>
      <style>{`
        
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.6); } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .pulse-dot { animation: pulse 1.8s ease-in-out infinite; }
        .mono { font-family: inherit; }
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
              관리자
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
              관리자
            </span>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.success }}/>
            <span style={{ fontSize: 10, color: t.success, fontWeight: 600 }}>온라인</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            안녕하세요, <span style={{ color: t.accent }}>{user?.name || HAPPYCALL_USER}</span>님
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
function getIconForTask(workType) {
  if (!workType) return Wrench;
  if (workType.includes("세척") || workType.includes("분해세척")) return Snowflake;
  if (workType.includes("냉매") || workType.includes("가스")) return Zap;
  if (workType.includes("설치") || workType.includes("이전설치")) return Settings;
  if (workType.includes("점검") || workType.includes("수리")) return Wrench;
  return Wrench;
}

function HappycallTaskCard({ task, t, index, onAction }) {
  const Icon = getIconForTask(task.workType);
  const isUncontacted = task.happycallStatus === "uncontacted";
  const isContacted = task.happycallStatus === "contacted";
  const isAssigned = task.happycallStatus === "assigned";
  const hasSchedule = !!task.requestedDate;

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

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{task.customer}</span>
          <span className="mono" style={{ fontSize: 12, color: t.textSecondary, fontWeight: 500 }}>{task.phone}</span>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>{task.address}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontSize: 12, color: t.textSecondary, fontWeight: 600, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icon size={11} style={{ color: t.textMuted }}/>
          <span>{task.workSummary || `${task.workType} · ${task.appliance} ×${task.qty}`}</span>
        </div>
        <span style={{ color: t.textDim }}>·</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Calendar size={10} style={{ color: hasSchedule ? t.textMuted : t.textDim }}/>
          {hasSchedule ? (
            <span>{formatRequestedDate(task.requestedDate)} {task.requestedTime || ""}</span>
          ) : (
            <span style={{ 
              color: t.textDim, fontWeight: 600,
              padding: "2px 6px", 
              background: t.bgInset,
              border: `1px dashed ${t.border}`,
              borderRadius: 4,
              fontSize: 10,
            }}>
              일정 미정
            </span>
          )}
        </div>
      </div>

      {task.happycallMemo && (
        <div style={{ padding: "8px 12px", background: t.bgInset, borderRadius: 8, fontSize: 11, color: t.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>
          📝 {task.happycallMemo}
        </div>
      )}

      {isContacted && task.recommendedEngineer && (
        <div style={{ 
          padding: "8px 12px", 
          background: t.accentBg, 
          border: `1px solid ${t.accent}`, 
          borderRadius: 8, 
          fontSize: 11, color: t.accent, 
          marginBottom: 12, 
          fontWeight: 700, 
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <Star size={11}/>
          <span>추천 프로: {task.recommendedEngineer}</span>
        </div>
      )}

      {isAssigned && (
        <div style={{ padding: "8px 12px", background: t.successBg, border: `1px solid ${t.successBorder}`, borderRadius: 8, fontSize: 12, color: t.success, marginBottom: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={12}/>
          <span>{task.assignedEngineer} 프로님 배정 완료</span>
        </div>
      )}

      {!isAssigned && (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onAction("call")} style={{ ...btnSecondary(t), flex: "0 0 auto", width: 44, padding: "10px 0" }}>
            <Phone size={14}/>
          </button>
          {isUncontacted ? (
            <button onClick={() => onAction("startCall")} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "10px 14px", background: t.accent, border: "none", borderRadius: 10,
              fontSize: 13, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "inherit",
            }}>
              <PhoneCall size={14}/>
              <span>통화 시작</span>
            </button>
          ) : (
            <>
              <button onClick={() => onAction("edit")} style={{ ...btnSecondary(t), flex: 1 }}>
                <Edit3 size={13}/>
                <span>수정</span>
              </button>
              <button onClick={() => onAction("assign")} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                padding: "10px 14px", background: t.accent, border: "none", borderRadius: 10,
                fontSize: 12, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "inherit",
              }}>
                <UserPlus size={13}/>
                <span>프로 배정</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// 커스텀 DatePicker (캘린더)
// ============================================
function CustomDatePicker({ t, value, onChange }) {
  const [viewYear, setViewYear] = useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.getFullYear();
    }
    return 2026;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.getMonth();
    }
    return 3;
  });
  
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
              fontSize: 13, fontFamily: "inherit",
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
  const [workItems, setWorkItems] = useState([
    { workType: "", appliance: "", qty: 1 }
  ]);
  const [memo, setMemo] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgentReason, setUrgentReason] = useState("");
  const [estimateTotal, setEstimateTotal] = useState("");
  
  const updateItem = (idx, key, value) => {
    setWorkItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };
  const addItem = () => {
    setWorkItems(prev => [...prev, { workType: "", appliance: "", qty: 1 }]);
  };
  const removeItem = (idx) => {
    if (workItems.length === 1) return;
    setWorkItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalHint = calculateTotalHint(client, workItems);

  const allItemsValid = workItems.every(item => {
    if (!item.workType) return false;
    const wt = WORK_TYPES.find(x => x.id === item.workType);
    if (wt?.needsQty && !item.appliance) return false;
    return true;
  });
  
  // 희망일 제거 → 4가지 필수: 원청/고객/주소/작업
  const canSubmit = client && customer && phone && address && allItemsValid && (!isUrgent || urgentReason);

  const handleEstimateChange = (e) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    setEstimateTotal(raw);
  };
  const formattedEstimate = estimateTotal ? Number(estimateTotal).toLocaleString() : "";

  const fillFromHint = () => {
    if (totalHint != null) setEstimateTotal(String(totalHint));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const clientObj = CLIENTS.find(c => c.name === client);
    const prefix = clientObj?.prefix || "A";
    const dateStr = new Date().toISOString().slice(2,10).replace(/-/g, "");
    const newId = `${prefix}${prefix === "A" ? "" : "-"}${dateStr}-${String(Math.floor(Math.random() * 999) + 100)}`;
    
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
      workItems,
      workSummary,
      requestedDate: null,    // 통화 단계에서 입력
      requestedTime: null,
      receivedAt: NOW, receivedAgo: "방금",
      happycallStatus: "uncontacted", 
      isUrgent, urgentReason: isUrgent ? urgentReason : "",
      assignedEngineer: null, recommendedEngineer: null, happycallMemo: memo, client,
      estimateTotal: estimateTotal ? Number(estimateTotal) : null,
    });
  };

  return (
    <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 130, color: t.text }}>
      <style>{`
        .mono { font-family: inherit; }
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
        {/* 빠른 접수 안내 */}
        <div style={{ 
          marginBottom: 16, padding: "10px 12px",
          background: t.accentBg, 
          border: `1px dashed ${t.accent}`,
          borderRadius: 9,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
            ⚡ 빠른 접수
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5 }}>
            기본 정보만 입력하세요. <strong>희망 일정은 통화 시작</strong> 단계에서 협의/입력합니다.
          </div>
        </div>

        {/* 원청 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>🏪 원청 선택</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {CLIENTS.map(c => (
              <button key={c.id} onClick={() => setClient(c.name)} style={{
                padding: "12px 8px",
                background: client === c.name ? t.accent : t.bgInset,
                color: client === c.name ? "white" : t.text,
                border: `1.5px solid ${client === c.name ? t.accent : t.border}`,
                borderRadius: 9, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }}/>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 고객 정보 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>👤 고객 정보</label>
          <input type="text" placeholder="이름" value={customer} onChange={(e) => setCustomer(e.target.value)} style={{ ...inputStyle(t), marginBottom: 8 }}/>
          <input type="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...inputStyle(t), fontFamily: "inherit" }}/>
        </div>

        {/* 주소 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>📍 주소</label>
          <input type="text" placeholder="강남구 도곡동 (도로명 + 상세)" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle(t)}/>
        </div>

        {/* 작업 정보 */}
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
            const itemHint = client && item.workType ? getPriceHint(client, item.workType, item.appliance) : null;
            
            return (
              <div key={idx} style={{ 
                background: t.bgInset, 
                border: `1px solid ${t.borderStrong}`,
                borderRadius: 12, 
                padding: 14, 
                marginBottom: 8,
              }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>수량</span>
                      <button onClick={() => updateItem(idx, "qty", Math.max(1, item.qty - 1))} style={{ width: 32, height: 32, padding: 0, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 16 }}>−</button>
                      <span className="mono" style={{ fontSize: 16, fontWeight: 700, minWidth: 22, textAlign: "center" }}>{item.qty}</span>
                      <button onClick={() => updateItem(idx, "qty", item.qty + 1)} style={{ width: 32, height: 32, padding: 0, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 16 }}>+</button>
                      <span className="mono" style={{ fontSize: 12, color: t.textMuted, fontWeight: 500 }}>대</span>
                    </div>
                    {itemHint != null && (
                      <div style={{ 
                        fontSize: 11, color: t.textMuted, 
                        padding: "6px 10px", background: t.bgElevated,
                        border: `1px dashed ${t.border}`, borderRadius: 6,
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        💡 <span>{client} 시세:</span>
                        <span className="mono" style={{ color: t.text, fontWeight: 700 }}>
                          {itemHint.toLocaleString()}원
                        </span>
                        {item.qty > 1 && (
                          <span className="mono" style={{ color: t.textMuted }}>
                            × {item.qty}대 = {(itemHint * item.qty).toLocaleString()}원
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : item.workType ? (
                  <div>
                    <div style={{ 
                      fontSize: 11, color: t.textMuted, 
                      padding: "8px 12px", background: t.bgElevated,
                      border: `1px dashed ${t.border}`, borderRadius: 7, 
                      textAlign: "center", marginBottom: itemHint != null ? 6 : 0,
                    }}>
                      ℹ️ 수량 입력 불필요
                    </div>
                    {itemHint != null && (
                      <div style={{ 
                        fontSize: 11, color: t.textMuted, 
                        padding: "6px 10px", background: t.bgElevated,
                        border: `1px dashed ${t.border}`, borderRadius: 6,
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        💡 <span>{client} 시세:</span>
                        <span className="mono" style={{ color: t.text, fontWeight: 700 }}>
                          {itemHint.toLocaleString()}원
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          
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
        </div>

        {/* 💰 예상 금액 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>💰 예상 금액</label>
          
          {totalHint != null && (
            <div style={{ 
              padding: "10px 12px", marginBottom: 8,
              background: t.accentBg, 
              border: `1px dashed ${t.accent}`,
              borderRadius: 9,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.accent, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>
                  💡 {client} 참고 시세 합계
                </div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
                  {totalHint.toLocaleString()}원
                </div>
              </div>
              <button onClick={fillFromHint} style={{
                padding: "8px 12px",
                background: t.accent, color: "white",
                border: "none", borderRadius: 7,
                fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                채우기
              </button>
            </div>
          )}
          
          <div style={{ position: "relative" }}>
            <input 
              type="text"
              inputMode="numeric"
              placeholder="0" 
              value={formattedEstimate}
              onChange={handleEstimateChange}
              style={{ 
                ...inputStyle(t), 
                fontFamily: "inherit", 
                fontSize: 16, fontWeight: 700,
                textAlign: "right", paddingRight: 36,
              }}
            />
            <span style={{ 
              position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
              fontSize: 13, color: t.textMuted, fontWeight: 600,
              pointerEvents: "none",
            }}>
              원
            </span>
          </div>
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

        {/* 메모 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle(t)}>📝 메모 (선택)</label>
          <textarea placeholder="고객 요청사항, 특이사항..." value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} style={{ ...inputStyle(t), minHeight: 80, resize: "vertical" }}/>
        </div>
      </div>

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
function HappycallEditScreen({ t, task, onCancel, onSave }) {
  const [requestedDate, setRequestedDate] = useState(task.requestedDate || "");
  const [requestedTime, setRequestedTime] = useState(task.requestedTime || "");
  const [memo, setMemo] = useState(task.happycallMemo || "");
  const [selectedEngineerId, setSelectedEngineerId] = useState(() => {
    if (task.recommendedEngineer) {
      const eng = ENGINEERS.find(e => e.name === task.recommendedEngineer);
      return eng?.id || null;
    }
    return null;
  });
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 작업 시간 계산
  const totalQty = task.workItems 
    ? task.workItems.reduce((sum, item) => {
        const wt = WORK_TYPES.find(x => x.id === item.workType);
        return sum + (wt?.needsQty ? item.qty : 0);
      }, 0) 
    : (task.qty || 1);

  // 등급 계산 (requestedDate 변경 시 자동 재계산)
  const engineersWithGrade = ENGINEERS.map(e => {
    const durationHours = totalQty + (e.travelMin / 60);
    return { ...e, ...getEngineerGrade(e, requestedDate || "2026-04-28", durationHours), durationHours, totalQty };
  }).filter(e => 
    e.name.includes(searchQuery) || e.region.includes(searchQuery)
  );

  // 작업 지역
  const taskRegion = (task.address || "").match(/(강남|서초|송파|종로|중구|마포|용산|성동|광진|동대문|서대문|영등포|동작|관악|구로|금천|양천|강서|은평|노원|도봉|강북|성북|중랑|강동)/)?.[0] || "";
  const isAreaSpecialist = (engineer) => {
    if (!taskRegion) return false;
    return engineer.region.includes(taskRegion);
  };

  const gradeOrder = { "추천": 0, "가능": 1, "불가": 2 };
  const sorted = [...engineersWithGrade].sort((a, b) => {
    const ga = gradeOrder[a.grade];
    const gb = gradeOrder[b.grade];
    if (ga !== gb) return ga - gb;
    if (a.travelMin !== b.travelMin) return a.travelMin - b.travelMin;
    const aSpec = isAreaSpecialist(a);
    const bSpec = isAreaSpecialist(b);
    if (aSpec !== bSpec) return aSpec ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });

  const recommended = sorted.filter(e => e.grade === "추천").map(e => ({ ...e, isAreaSpecialist: isAreaSpecialist(e) }));
  const possible = sorted.filter(e => e.grade === "가능").map(e => ({ ...e, isAreaSpecialist: isAreaSpecialist(e) }));
  const unavailable = sorted.filter(e => e.grade === "불가").map(e => ({ ...e, isAreaSpecialist: isAreaSpecialist(e) }));

  const canSave = !!requestedDate;

  const handleSave = () => {
    if (!canSave) return;
    const engineer = selectedEngineerId ? ENGINEERS.find(e => e.id === selectedEngineerId) : null;
    onSave({
      requestedDate,
      requestedTime: requestedTime || "",
      memo,
      recommendedEngineerName: engineer?.name || null,
    });
  };

  const Icon = task.icon;

  return (
    <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 130, color: t.text }}>
      <style>{`
        .mono { font-family: inherit; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }
        .slide-down { animation: slideDown 0.3s ease-out; overflow: hidden; }
      `}</style>

      {/* 헤더 */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: t.bg, borderBottom: `1px solid ${t.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="clickable" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
          <ArrowLeft size={18}/><span style={{ fontSize: 14, fontWeight: 600 }}>취소</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800 }}>📞 통화 화면</span>
        <div style={{ width: 60 }}/>
      </div>

      <div style={{ padding: "20px" }}>
        {/* 작업 카드 + 전화 걸기 */}
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", background: t.accentBg, color: t.accent, borderRadius: 4 }}>
              {task.client}
            </span>
            <span className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
              {task.id}
            </span>
            {task.isUrgent && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", background: t.danger, color: "white", borderRadius: 5, display: "flex", alignItems: "center", gap: 3 }}>
                <AlertTriangle size={9}/>
                <span>긴급</span>
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{task.customer}</span>
            <span className="mono" style={{ fontSize: 12, color: t.textSecondary, fontWeight: 500 }}>{task.phone}</span>
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>{task.address}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.textSecondary, fontWeight: 600, marginBottom: 12 }}>
            {Icon && <Icon size={11} style={{ color: t.textMuted }}/>}
            <span>{task.workSummary || `${task.workType} · ${task.appliance} ×${task.qty}`}</span>
          </div>
          {/* 전화 걸기 큰 버튼 */}
          <a href={`tel:${task.phone}`} style={{ 
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px", background: t.success, color: "white",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800,
            textDecoration: "none", cursor: "pointer",
          }}>
            <Phone size={16}/>
            <span>전화 걸기</span>
          </a>
        </div>

        {/* 일정 협의 */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle(t)}>📅 고객 희망 일정 <span style={{ color: t.danger }}>*</span></label>
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
        </div>

        {/* 요청사항 메모 */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle(t)}>📝 요청사항 메모</label>
          <textarea 
            placeholder="고객 요청사항, 일정 협의 결과, 특이사항..." 
            value={memo} 
            onChange={(e) => setMemo(e.target.value)} 
            rows={3} 
            style={{ ...inputStyle(t), minHeight: 80, resize: "vertical" }}
          />
        </div>

        {/* 추천 기사 */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle(t)}>
            ⭐ 추천 프로 <span style={{ fontSize: 10, color: t.textDim, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(휴무 자동 제외 · 선택사항)</span>
          </label>
          
          {!requestedDate ? (
            <div style={{ 
              padding: "20px", 
              background: t.bgInset, 
              border: `1px dashed ${t.border}`, 
              borderRadius: 10, 
              textAlign: "center", 
              fontSize: 12, 
              color: t.textMuted, 
              lineHeight: 1.6,
            }}>
              ℹ️ 희망 일정을 먼저 입력하면<br/>가능한 프로가 표시됩니다
            </div>
          ) : (
            <>
              {/* 검색 */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: t.textMuted }}/>
                <input type="text" placeholder="프로 이름 / 지역 검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...inputStyle(t), paddingLeft: 36 }}/>
              </div>

              <TimelineHeader t={t}/>

              {recommended.length > 0 && (
                <div style={{ marginBottom: 12 }}>
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

              {possible.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.warning, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                    <Clock size={11}/><span>가능</span>
                    <span style={{ color: t.textMuted, fontWeight: 500 }}>· 다른 날 가능</span>
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

              {unavailable.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                    <X size={11}/><span>불가</span>
                  </div>
                  {unavailable.map(e => (
                    <EngineerTimelineCard 
                      key={e.id} engineer={e} t={t} 
                      selected={false}
                      expanded={expandedId === e.id}
                      onSelect={null}
                      onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                      requestedDate={requestedDate}
                      disabled
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 임시 저장 안내 */}
        <div style={{ 
          padding: "12px 14px", 
          background: t.accentBg, 
          border: `1px dashed ${t.accent}`, 
          borderRadius: 10, 
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, marginBottom: 4 }}>
            💡 임시 저장 안내
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.6 }}>
            저장하면 <strong>"통화 후"</strong> 탭으로 이동해요. 검토 후 <strong>"프로 배정"</strong>을 누르면 그때 프로님에게 알림이 발송됩니다.
          </div>
        </div>
      </div>

      {/* 하단 sticky */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 420, margin: "0 auto", background: t.bg, borderTop: `1px solid ${t.border}`, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ ...btnSecondary(t), flex: "0 0 100px" }}>
            <span>취소</span>
          </button>
          <button onClick={canSave ? handleSave : undefined} disabled={!canSave} style={{ ...btnPrimary(t), opacity: canSave ? 1 : 0.4, cursor: canSave ? "pointer" : "not-allowed" }}>
            <CheckCircle2 size={15}/>
            <span>{canSave ? "💾 임시 저장" : "일정 입력 필요"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignEngineerScreen({ t, task, onCancel, onAssign }) {
  const [selectedEngineerId, setSelectedEngineerId] = useState(() => {
    if (task.recommendedEngineer) {
      const eng = ENGINEERS.find(e => e.name === task.recommendedEngineer);
      return eng?.id || null;
    }
    return null;
  });
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
    <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 130, color: t.text }}>
      <style>{`
        .mono { font-family: inherit; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }
        .slide-down { animation: slideDown 0.3s ease-out; overflow: hidden; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: t.bg, borderBottom: `1px solid ${t.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="clickable" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
          <ArrowLeft size={18}/><span style={{ fontSize: 14, fontWeight: 600 }}>취소</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800 }}>프로 배정</span>
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
          <input type="text" placeholder="프로 이름 / 지역 검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...inputStyle(t), paddingLeft: 36 }}/>
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
                <div style={{ marginBottom: 4 }}>📋 작업DB에 <strong style={{ color: t.text }}>{ENGINEERS.find(e => e.id === selectedEngineerId).name}</strong> 프로 배정 기록</div>
                <div style={{ marginBottom: 4 }}>📅 Google Calendar에 일정 자동 등록</div>
                <div style={{ marginBottom: 4 }}>💬 프로님에게 <strong style={{ color: t.text }}>알림</strong> 발송 (인앱 + 푸시)</div>
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
            <span>{selectedEngineerId ? `${ENGINEERS.find(e => e.id === selectedEngineerId).name} 배정` : "프로 선택"}</span>
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
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: t.textMuted, fontFamily: "inherit" }}>
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
  const offReason = engineer.offReason;
  const isOff = !!offReason;
  
  const gradeColor = grade === "추천" ? t.success : grade === "가능" ? t.warning : t.textMuted;
  
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
          
          {/* 오른쪽: 24시간 막대 (휴무면 휴무 표시) */}
          <div onClick={onToggle} className="clickable" style={{
            position: "relative", height: 26,
            background: t.bgInset, borderRadius: 6, overflow: "hidden",
          }}>
            {isOff ? (
              /* 휴무 모드 - 막대 전체를 휴무 표시로 */
              <div style={{
                position: "absolute", inset: 0,
                background: t.warningBg,
                border: `1px dashed ${t.warningBorder}`,
                borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 5,
                fontSize: 10, fontWeight: 700, color: t.warning,
              }}>
                <span style={{ fontSize: 11 }}>🛌</span>
                <span>종일 휴무 · {offReason}</span>
              </div>
            ) : (
              <>
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
                    left: `${(item.start / 24) * 100}%`,
                    width: `${((item.end - item.start) / 24) * 100}%`,
                    top: 0, bottom: 0,
                    background: t.textMuted,
                    borderRight: `1px solid ${t.bg}`,
                    opacity: 0.7,
                    zIndex: 2,
                  }}/>
                ))}
                
                {/* 추천 자리 (희망일, 09~22시) */}
                {grade === "추천" && slot && (
                  <div style={{
                    position: "absolute",
                    left: `${(slot.start / 24) * 100}%`,
                    width: `${((slot.end - slot.start) / 24) * 100}%`,
                    top: 2, bottom: 2,
                    background: t.success,
                    borderRadius: 4,
                    zIndex: 2,
                  }}/>
                )}
              </>
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
              {isOff && (
                <span style={{ fontSize: 11, color: t.warning, fontWeight: 700 }}>
                  🛌 휴무
                </span>
              )}
              {!isOff && grade === "추천" && slot && (
                <span className="mono" style={{ 
                  fontSize: 11, color: t.success, fontWeight: 700,
                }}>
                  {String(Math.floor(slot.start)).padStart(2,'0')}:{String(Math.round((slot.start%1)*60)).padStart(2,'0')}~{String(Math.floor(slot.end)).padStart(2,'0')}:{String(Math.round((slot.end%1)*60)).padStart(2,'0')}
                </span>
              )}
              {!isOff && grade === "가능" && alts.length > 0 && (
                <span style={{ fontSize: 11, color: t.warning, fontWeight: 600 }}>
                  {formatRequestedDate(alts[0].date)} 가능
                </span>
              )}
              {!isOff && grade === "불가" && (
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
            
            {/* 휴무 안내 (휴무면 일정 자체가 의미 없음) */}
            {isOff ? (
              <div style={{ 
                padding: "12px 14px",
                background: t.warningBg, 
                border: `1px dashed ${t.warning}`, 
                borderRadius: 7,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>🛌</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.warning }}>
                    이 날 종일 휴무
                  </div>
                  <div style={{ fontSize: 10, color: t.warning, opacity: 0.8, marginTop: 2 }}>
                    사유: {offReason}
                  </div>
                </div>
              </div>
            ) : (
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
            )}
            
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
    <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 130, color: t.text }}>
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
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  
  // 공유 task state (shared/TasksContext.jsx) — 옛 mock
  const { tasks: allTasks, updateTask: localUpdateTask, addTask, resetTasks } = useTasks();

  // V14 — 진짜 시트 catch (apiTasks)
  const [apiTasks, setApiTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  async function fetchTasks() {
    setTasksLoading(true);
    try {
      console.log('[V14 HappycallApp] fetchTasks 시작');
      const res = await getTasks('happycall', user?.id || 'happycall', null);
      console.log('[V14 HappycallApp] raw 응답:', res);
      if (!res || res.ok === false) {
        return;
      }
      const { list } = v14FindTaskList(res);
      if (!Array.isArray(list)) {
        setApiTasks([]);
        return;
      }
      const normalized = list.map(v14NormalizeTask).filter(Boolean);
      console.log('[V14 HappycallApp] normalized:', normalized.length, '건');
      setApiTasks(normalized);
    } catch (e) {
      console.error('[V14 HappycallApp] fetchTasks 에러:', e);
    } finally {
      setTasksLoading(false);
    }
  }

  // V14 — mount 시 한 번 + user 변경 시 재호출
  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // V14 — updateTask = apiUpdateTask 호출 + Optimistic Update
  const updateTask = async (taskId, updates) => {
    if (!taskId) return;
    console.log('[V14 HappycallApp] updateTask', { taskId, updates });

    // Optimistic Update
    setApiTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    ));
    // 옛 호환 (TasksContext 박힌 거)
    localUpdateTask(taskId, updates);

    try {
      const res = await apiUpdateTask(taskId, updates);
      console.log('[V14 HappycallApp] updateTask 응답:', res);
      if (!res || res.ok === false) {
        console.error('[V14 HappycallApp] updateTask 실패:', res);
        fetchTasks();
      }
    } catch (e) {
      console.error('[V14 HappycallApp] updateTask 에러:', e);
      fetchTasks();
    }
  };

  // V14 — 해피콜 = 모든 작업 catch (apiTasks 우선 / allTasks fallback)
  const tasks = apiTasks.length > 0 ? apiTasks : allTasks;

  const t = THEMES[mode];
  const selectedTask = tasks.find(x => x.id === selectedTaskId);

  const handleNewReception = () => setScreen("newReception");
  
  const handleSubmitReception = (newTask) => {
    addTask(newTask);
    setScreen("main");
  };

  const handleTaskAction = (task, action) => {
    setSelectedTaskId(task.id);
    if (action === "call") {
      alert(`${task.customer}님(${task.phone})에게 전화 연결...`);
    } else if (action === "startCall" || action === "edit") {
      setScreen("edit");
    } else if (action === "memo") {
      setScreen("memo");
    } else if (action === "assign") {
      setScreen("assign");
    }
  };

  // 임시 저장 (edit 화면 → contacted)
  const handleSaveEdit = (data) => {
    updateTask(selectedTaskId, {
      requestedDate: data.requestedDate,
      requestedTime: data.requestedTime,
      happycallMemo: data.memo,
      recommendedEngineer: data.recommendedEngineerName,
      happycallStatus: "contacted",
    });
    setScreen("main");
  };

  const handleSaveMemo = (memo) => {
    updateTask(selectedTaskId, {
      happycallMemo: memo,
      happycallStatus: "contacted",
    });
    setScreen("main");
  };

  // 기사 배정 (engineerId 매핑 함께 저장)
  const handleAssign = (engineerName) => {
    const engineer = ENGINEERS.find(e => e.name === engineerName);
    updateTask(selectedTaskId, {
      assignedEngineer: engineerName,
      assignedEngineerId: engineer?.id || null,  // E001~E005
      happycallStatus: "assigned",
    });
    setScreen("main");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(10,10,10,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginBottom: 6, textAlign: "center", fontFamily: "system-ui", fontWeight: 600 }}>📞 관리자 화면</div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textAlign: "center", fontFamily: "system-ui", lineHeight: 1.5 }}>
          고객 응대 + 프로 배정 (정산 권한 X)
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
        {screen === "main" && <HappycallMainScreen t={t} tasks={tasks} onNewReception={handleNewReception} onTaskAction={handleTaskAction} user={user} />}
        {screen === "newReception" && <NewReceptionScreen t={t} onCancel={() => setScreen("main")} onSubmit={handleSubmitReception} />}
        {screen === "edit" && selectedTask && <HappycallEditScreen t={t} task={selectedTask} onCancel={() => setScreen("main")} onSave={handleSaveEdit} />}
        {screen === "memo" && selectedTask && <MemoEditScreen t={t} task={selectedTask} onCancel={() => setScreen("main")} onSave={handleSaveMemo} />}
        {screen === "assign" && selectedTask && <AssignEngineerScreen t={t} task={selectedTask} onCancel={() => setScreen("main")} onAssign={handleAssign} />}
      </div>
    </div>
  );
}
