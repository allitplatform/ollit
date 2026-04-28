import { useState } from "react";
import { 
  Phone, Navigation, CheckCircle2, MapPin, Wrench, Snowflake, Settings, Zap, 
  Sun, Moon, Bell, Camera, Wallet, ArrowRight, ArrowLeft, MessageCircle,
  FileText, ChevronRight, Plus, Image as ImageIcon, Calendar,
  MoreVertical, Play, User, AlertTriangle, Headphones, RotateCcw, Lock,
  Edit3, X, History, ChevronLeft,
  TrendingUp, TrendingDown, CreditCard, BellRing, Award, AlertCircle,
  Star, Briefcase, BarChart3, LogOut, ChevronUp, Check, Volume2, Trash2
} from "lucide-react";

const NOW = "10:00";

const INITIAL_TASKS = [
  { id: "A260427-001", time: "09:00", endTime: "10:30", duration: "1.5h",
    address: "강남구 역삼동", fullAddress: "테헤란로 152, 강남파이낸스센터 25층",
    customer: "박지영", phone: "010-2345-6789",
    workType: "세척", appliance: "벽걸이", qty: 1, status: "진행중", icon: Snowflake,
    distance: "12.4km", travelTime: "32분",
    productPrice: 80000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 32000, engineerNet: 48000,
    requestNote: "현관 비밀번호 1234, 강아지 있어요",
    happycallMemo: "고객님 친절하셨음. 시간 약속 잘 지키세요.",
    channel: "카카오톡", receivedAt: "2026.04.25",
    requestedDate: "2026-04-27", requestedTime: "오전",
    scheduledDate: "2026-04-27", scheduledTime: "09:00",
    workMemo: "", beforePhoto: false, afterPhoto: false,
    startedAt: "09:05", completedAt: null, scheduleHistory: [],
  },
  { id: "A260427-002", time: "11:30", endTime: "13:30", duration: "2h",
    address: "서초구 반포동", fullAddress: "신반포로 270, 반포자이 103-1502",
    customer: "이상훈", phone: "010-3456-7890",
    workType: "세척+점검", appliance: "스탠드", qty: 2, status: "확정", icon: Wrench,
    distance: "4.2km", travelTime: "15분",
    productPrice: 200000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 80000, engineerNet: 120000,
    requestNote: "퇴근 후 18시 이후 가능합니다. 주차는 지하 B2 손님용 자리 가능",
    happycallMemo: "고객이 시간 변경 가능성 있다고 함. 미리 전화 권장.",
    channel: "전화", receivedAt: "2026.04.24",
    requestedDate: "2026-04-27", requestedTime: "낮 시간",
    scheduledDate: "2026-04-27", scheduledTime: "11:30",
    workMemo: "", beforePhoto: false, afterPhoto: false,
    startedAt: null, completedAt: null, scheduleHistory: [],
  },
  { id: "A260427-003", time: "14:00", endTime: "16:30", duration: "2.5h",
    address: "송파구 잠실동", fullAddress: "올림픽로 240, 트리지움 305-2201",
    customer: "김미경", phone: "010-4567-8901",
    workType: "냉매충전", appliance: "시스템 4WAY", qty: 1, status: "확정", icon: Zap,
    distance: "8.7km", travelTime: "28분",
    productPrice: 120000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 50, commission: 60000, engineerNet: 60000,
    requestNote: "에어컨에서 차가운 바람이 잘 안 나옵니다.",
    happycallMemo: "냉매 부족 가능성 높음. R32 가스 확인.",
    channel: "직접", receivedAt: "2026.04.23",
    requestedDate: "2026-04-27", requestedTime: "오후",
    scheduledDate: "2026-04-27", scheduledTime: "14:00",
    workMemo: "", beforePhoto: false, afterPhoto: false,
    startedAt: null, completedAt: null, scheduleHistory: [],
  },
  { id: "A260427-004", time: null, endTime: null, duration: null,
    address: "강남구 청담동", fullAddress: "도산대로 450, 청담힐스테이트 동405호",
    customer: "정도현", phone: "010-5678-9012",
    workType: "설치", appliance: "벽걸이", qty: 1, status: "약속대기", icon: Settings,
    distance: "6.1km", travelTime: "22분",
    productPrice: 80000, travelFee: 0, extraFee: 0, extraReason: "",
    commissionRate: 40, commission: 32000, engineerNet: 48000,
    requestNote: "기존 에어컨 떼고 새 벽걸이 설치 부탁드려요",
    happycallMemo: "", channel: "지인소개", receivedAt: "2026.04.27",
    requestedDate: "2026-04-28", requestedTime: "오후",
    scheduledDate: null, scheduledTime: null,
    workMemo: "", beforePhoto: false, afterPhoto: false,
    startedAt: null, completedAt: null, scheduleHistory: [],
  },
];

const ACTION_ALERTS = [
  { id: "new", type: "count", label: "새 배정", count: 1, sublabel: "신규 · 미수락", icon: Bell, urgent: true },
  { id: "report", type: "count", label: "미보고", count: 1, sublabel: "사진 미제출", icon: Camera, urgent: true },
  { id: "settlement", type: "money", label: "오늘 정산", amount: 280000, sublabel: "순수익 (수수료 제외)", icon: Wallet, urgent: false },
];

// 정산 데이터
const SETTLEMENT_DATA = {
  today: {
    netIncome: 132000,         // 오늘 내 수익 (수수료 제외)
    completedCount: 3,         // 오늘 완료 작업수
    avgPerJob: 44000,
    fieldCollection: {         // 현장 수금
      received: 220000,        // 고객에게 받은 총액
      sentToCompany: 88000,    // 회사에 송금할 금액
      myIncome: 132000,        // 내 수익
      count: 2,
    },
    companySettlement: {       // 회사 정산 (회사가 줄 돈)
      gross: 100000,           // 상품 금액
      commission: 50000,       // 수수료
      myIncome: 50000,         // 받을 금액
      count: 1,
      status: "pending",       // 다음주 입금 예정
    },
  },
  thisMonth: {
    netIncome: 2910000,
    completedCount: 36,
    avgPerJob: 80833,
    fieldCollection: {
      received: 4200000,
      sentToCompany: 1680000,
      myIncome: 2520000,
      count: 28,
    },
    companySettlement: {
      gross: 780000,
      commission: 390000,
      myIncome: 390000,
      count: 8,
      status: "mixed",         // 일부 입금됨
    },
  },
  pending: {
    amount: 480000,
    count: 6,
  },
  paid: {
    amount: 2430000,
    count: 30,
  },
  history: [
    { id: "S260420", date: "2026.04.20", amount: 480000, count: 6, status: "지급완료", paidDate: "2026.04.21" },
    { id: "S260413", date: "2026.04.13", amount: 720000, count: 9, status: "지급완료", paidDate: "2026.04.14" },
    { id: "S260406", date: "2026.04.06", amount: 560000, count: 7, status: "지급완료", paidDate: "2026.04.07" },
    { id: "S260330", date: "2026.03.30", amount: 670000, count: 8, status: "지급완료", paidDate: "2026.03.31" },
  ],
  recentJobs: [
    { id: "A260427-001", date: "04.27", time: "09:00", customer: "박지영", workType: "세척", 
      paymentType: "field", grossAmount: 80000, commission: 32000, myIncome: 48000, status: "완료" },
    { id: "A260427-002", date: "04.27", time: "11:30", customer: "이상훈", workType: "세척+점검",
      paymentType: "field", grossAmount: 140000, commission: 56000, myIncome: 84000, status: "완료" },
    { id: "A260427-003", date: "04.27", time: "14:00", customer: "김미경", workType: "냉매충전",
      paymentType: "company", grossAmount: 100000, commission: 50000, myIncome: 50000, status: "완료" },
    { id: "A260426-008", date: "04.26", time: "10:00", customer: "최영주", workType: "점검",
      paymentType: "field", grossAmount: 60000, commission: 24000, myIncome: 36000, status: "완료" },
    { id: "A260426-005", date: "04.26", time: "14:00", customer: "김도훈", workType: "냉매충전",
      paymentType: "company", grossAmount: 120000, commission: 60000, myIncome: 60000, status: "완료" },
    { id: "A260425-003", date: "04.25", time: "11:00", customer: "이서연", workType: "세척",
      paymentType: "field", grossAmount: 80000, commission: 32000, myIncome: 48000, status: "완료" },
    { id: "A260425-001", date: "04.25", time: "09:00", customer: "박민수", workType: "설치",
      paymentType: "company", grossAmount: 200000, commission: 80000, myIncome: 96000, status: "완료" },
  ],
};

// 알림 데이터
const NOTIFICATIONS = [
  { id: "N001", type: "assign", title: "새 배정", message: "정도현님 (강남구 청담동) 작업 배정되었습니다", time: "10분 전", unread: true, taskId: "A260427-004" },
  { id: "N002", type: "schedule_change", title: "일정 변경", message: "이상훈님 작업 14:00 → 11:30으로 변경되었습니다", time: "1시간 전", unread: true, taskId: "A260427-002" },
  { id: "N003", type: "ops", title: "운영팀", message: "5월부터 수수료 정책이 일부 변경됩니다. 자세한 내용은 공지를 확인하세요.", time: "어제", unread: false },
  { id: "N004", type: "settlement", title: "정산 완료", message: "4/14 정산 720,000원이 입금 완료되었습니다", time: "2일 전", unread: false },
  { id: "N005", type: "review", title: "고객 후기", message: "박지영님이 ⭐5.0 평가를 남겼습니다 - \"친절하고 깔끔하게 작업해주셨어요\"", time: "3일 전", unread: false },
  { id: "N006", type: "ops", title: "공지사항", message: "5월 1일은 근로자의 날 휴무입니다. 작업 일정 참고하세요.", time: "5일 전", unread: false },
];

// 직급 시스템
const ENGINEER_RANKS = [
  { id: "intern", name: "수습 기사", icon: "🌱", min: 0, max: 50, color: "#888780" },
  { id: "junior", name: "주임 기사", icon: "🔧", min: 51, max: 150, color: "#378ADD" },
  { id: "senior", name: "대리 기사", icon: "💼", min: 151, max: 300, color: "#1D9E75" },
  { id: "manager", name: "과장 기사", icon: "🎖️", min: 301, max: 600, color: "#E91860" },
  { id: "director", name: "부장 기사", icon: "👑", min: 601, max: 9999, color: "#BA7517" },
];

// 프로필 데이터
const PROFILE_DATA = {
  name: "김동효",
  phone: "010-1111-1111",
  email: "kim.donghyo@ollit.kr",
  region: "강남 전담",
  joinDate: "2024.05.15",
  yearsAtCompany: 1, // 우리 회사 경력 (년)
  totalJobs: 487,
  thisMonthJobs: 36,
  thisMonthAttendance: 22, // 이번달 출석일
  totalDays: 26, // 이번달 영업일
  currentRank: "manager", // 과장 기사
  rankProgress: 73, // 다음 등급(부장)까지 73%
  jobsToNextRank: 113, // 부장까지 113건 남음
  badges: [
    { id: "B1", icon: "🏆", label: "이달의 작업왕", count: 3, desc: "월 1위 달성" },
    { id: "B2", icon: "📅", label: "이번달 출석", value: "22/26일", desc: "85% 출석률" },
    { id: "B3", icon: "⚡", label: "올해 누적", count: 156, desc: "올해 작업수" },
  ],
};

const THEMES = {
  dark: {
    name: "🌑 다크", icon: Moon,
    bg: "#1A1512", bgElevated: "#221C18", bgInset: "#13100E",
    border: "rgba(255, 220, 200, 0.06)", borderStrong: "rgba(255, 220, 200, 0.10)",
    text: "#FAF8F5", textSecondary: "#C4B5A6", textMuted: "#8A7B6F", textDim: "#5C5048",
    accent: "#FF1B8D", accentBg: "rgba(255, 27, 141, 0.10)",
    warning: "#FBBF24", warningBg: "rgba(251, 191, 36, 0.08)", warningBorder: "rgba(251, 191, 36, 0.3)",
    success: "#34D399", successBg: "rgba(52, 211, 153, 0.10)", successBorder: "rgba(52, 211, 153, 0.3)",
    isLight: false,
  },
  light: {
    name: "☀️ 라이트", icon: Sun,
    bg: "#FAFAFA", bgElevated: "#FFFFFF", bgInset: "#F4F4F5",
    border: "rgba(0, 0, 0, 0.05)", borderStrong: "rgba(0, 0, 0, 0.09)",
    text: "#0A0A0A", textSecondary: "#404040", textMuted: "#737373", textDim: "#A3A3A3",
    accent: "#E91860", accentBg: "rgba(233, 24, 96, 0.06)",
    warning: "#D97706", warningBg: "rgba(217, 119, 6, 0.06)", warningBorder: "rgba(217, 119, 6, 0.22)",
    success: "#16A34A", successBg: "rgba(22, 163, 74, 0.08)", successBorder: "rgba(22, 163, 74, 0.25)",
    isLight: true,
  },
};

function formatRequestedDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (date.toDateString() === new Date("2026-04-27").toDateString()) return "오늘";
  if (date.toDateString() === new Date("2026-04-28").toDateString()) return "내일";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
}

function formatHistoryTime(d, t) { return d && t ? `${formatRequestedDate(d)} ${t}` : "—"; }

function addHours(time, hours) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${String((h + hours) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ============================================
// 스타일 헬퍼
// ============================================
const labelStyle = (t) => ({ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 });
const inputStyle = (t) => ({ width: "100%", padding: "12px 14px", background: t.bgInset, border: `1px solid ${t.borderStrong}`, borderRadius: 9, fontSize: 13, color: t.text, fontFamily: "inherit", outline: "none", boxSizing: "border-box", colorScheme: t.isLight ? "light" : "dark" });
const chipBtn = (t, active) => ({ flex: 1, padding: "10px 8px", background: active ? t.accent : t.bgInset, color: active ? "white" : t.text, border: `1px solid ${active ? t.accent : t.border}`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
const btnSecondary = (t) => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 14px", background: t.bgElevated, border: `1px solid ${t.borderStrong}`, borderRadius: 10, fontSize: 13, fontWeight: 700, color: t.text, cursor: "pointer", fontFamily: "inherit" });
const btnPrimary = (t) => ({ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px 14px", background: t.accent, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, color: "#FAF8F5", cursor: "pointer", fontFamily: "inherit" });

// ============================================
// 메인 화면
// ============================================
// ============================================
// 커스텀 DatePicker (캘린더 스타일)
// ============================================
function CustomDatePicker({ t, value, onChange }) {
  const [viewYear, setViewYear] = useState(value ? new Date(value).getFullYear() : 2026);
  const [viewMonth, setViewMonth] = useState(value ? new Date(value).getMonth() : 3); // 4월 = 3
  
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
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
  };
  
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };
  
  const isToday = (day) => 
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (day) =>
    selectedDate && day === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear();
  const isPast = (day) => {
    if (!day) return false;
    const d = new Date(viewYear, viewMonth, day);
    const todayCopy = new Date(today);
    todayCopy.setHours(0, 0, 0, 0);
    return d < todayCopy;
  };

  return (
    <div style={{ background: t.bgInset, border: `1px solid ${t.borderStrong}`, borderRadius: 12, padding: 14 }}>
      {/* 월 네비게이션 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={prevMonth} style={{ width: 32, height: 32, padding: 0, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={14} style={{ color: t.text }}/>
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
          {viewYear}년 {monthNames[viewMonth]}
        </div>
        <button onClick={nextMonth} style={{ width: 32, height: 32, padding: 0, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronRight size={14} style={{ color: t.text }}/>
        </button>
      </div>
      
      {/* 요일 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
        {dayNames.map((day, i) => (
          <div key={day} style={{ 
            fontSize: 10, fontWeight: 700, color: i === 0 ? t.danger : i === 6 ? t.info || t.accent : t.textMuted,
            textAlign: "center", padding: "6px 0",
          }}>
            {day}
          </div>
        ))}
      </div>
      
      {/* 날짜 그리드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {days.map((day, idx) => {
          const dayOfWeek = idx % 7;
          const past = isPast(day);
          const today_ = isToday(day);
          const selected = isSelected(day);
          
          return (
            <button
              key={idx}
              onClick={() => !past && handleDayClick(day)}
              disabled={!day || past}
              style={{
                aspectRatio: "1",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: selected ? 800 : today_ ? 700 : 500,
                cursor: !day || past ? "default" : "pointer",
                background: selected ? t.accent : today_ ? t.accentBg : "transparent",
                color: !day ? "transparent" 
                       : past ? t.textDim 
                       : selected ? "white"
                       : today_ ? t.accent
                       : dayOfWeek === 0 ? t.danger
                       : t.text,
                position: "relative",
                fontFamily: "'JetBrains Mono', monospace",
                opacity: past ? 0.4 : 1,
                transition: "all 0.15s",
              }}
            >
              {day || ""}
              {today_ && !selected && (
                <div style={{ 
                  position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
                  width: 3, height: 3, borderRadius: "50%", background: t.accent,
                }}/>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// 커스텀 TimePicker (시계 스타일)
// ============================================
function CustomTimePicker({ t, value, onChange }) {
  // value: "14:00" 형식
  const [period, setPeriod] = useState(value && parseInt(value.split(":")[0]) >= 12 ? "오후" : "오전");
  const selectedHour = value ? parseInt(value.split(":")[0]) : null;
  const selectedMinute = value ? parseInt(value.split(":")[1]) : null;
  
  const morningHours = [9, 10, 11, 12];
  const afternoonHours = [13, 14, 15, 16, 17, 18, 19];
  const minutes = [0, 30];
  
  const hours = period === "오전" ? morningHours : afternoonHours;
  
  const formatHour = (h) => h > 12 ? `${h - 12}시` : `${h}시`;
  
  const handleSelect = (h, m) => {
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  return (
    <div style={{ background: t.bgInset, border: `1px solid ${t.borderStrong}`, borderRadius: 12, padding: 14 }}>
      {/* 오전/오후 토글 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["오전", "오후"].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            flex: 1, padding: "10px 0",
            background: period === p ? t.accent : t.bgElevated,
            color: period === p ? "white" : t.textMuted,
            border: `1px solid ${period === p ? t.accent : t.border}`,
            borderRadius: 9, fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {p}
          </button>
        ))}
      </div>
      
      {/* 시간 선택 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>시</div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${hours.length}, 1fr)`, gap: 5 }}>
          {hours.map(h => {
            const active = selectedHour === h;
            return (
              <button key={h} onClick={() => handleSelect(h, selectedMinute || 0)} style={{
                padding: "10px 0",
                background: active ? t.accent : t.bgElevated,
                color: active ? "white" : t.text,
                border: `1px solid ${active ? t.accent : t.border}`,
                borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
              }}>
                {formatHour(h)}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* 분 선택 */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>분</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {minutes.map(m => {
            const active = selectedMinute === m;
            return (
              <button key={m} onClick={() => selectedHour && handleSelect(selectedHour, m)} disabled={!selectedHour} style={{
                padding: "10px 0",
                background: active ? t.accent : t.bgElevated,
                color: active ? "white" : selectedHour ? t.text : t.textDim,
                border: `1px solid ${active ? t.accent : t.border}`,
                borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: selectedHour ? "pointer" : "not-allowed",
                fontFamily: "'JetBrains Mono', monospace",
                opacity: selectedHour ? 1 : 0.5,
              }}>
                {String(m).padStart(2, '0')}분
              </button>
            );
          })}
        </div>
      </div>
      
      {/* 선택된 시간 미리보기 */}
      {value && (
        <div style={{ marginTop: 14, padding: "10px 12px", background: t.accentBg, border: `1px solid ${t.accent}`, borderRadius: 9, textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>
            {value}
          </div>
        </div>
      )}
    </div>
  );
}

function MainScreen({ t, tasks, onTaskClick }) {
  const c = {
    완료: tasks.filter(x => x.status === "완료").length,
    진행중: tasks.filter(x => x.status === "진행중").length,
    확정: tasks.filter(x => x.status === "확정").length,
    약속대기: tasks.filter(x => x.status === "약속대기").length,
  };

  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@01ff0283e4f6c01667e0c819cfe9d2e933020d3a/css/SpoqaHanSansNeo.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.6); } }
        @keyframes pulseSubtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .pulse-dot { animation: pulse 1.8s ease-in-out infinite; }
        .pulse-subtle { animation: pulseSubtle 2s ease-in-out infinite; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .clickable { cursor: pointer; transition: transform 0.15s, opacity 0.15s; }
        .clickable:active { transform: scale(0.98); opacity: 0.8; }
        input, textarea { font-family: inherit; }
      `}</style>

      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 500, textTransform: "uppercase" }}>MON · 27 APR · {NOW}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="pulse-subtle" style={{ width: 6, height: 6, background: t.accent, borderRadius: "50%" }}/>
            <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 500 }}>실시간</span>
          </div>
        </div>

        <div style={{ marginBottom: 22, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>안녕하세요, 김동효님</div>

        <div style={{ background: t.bgElevated, borderRadius: 18, padding: "22px 24px", marginBottom: 12, position: "relative" }}>
          <div style={{ position: "absolute", top: 22, bottom: 22, left: 0, width: 2, background: t.accent }}/>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>다음 출발</span>
            <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>여유 충분</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
            <span className="mono" style={{ fontSize: 54, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>10:58</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>58분 여유</span>
              <span className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>현재 {NOW}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
            <ArrowRight size={13} style={{ color: t.textDim }}/>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: t.textSecondary }}>11:30</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>이상훈님</span>
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>서초구 반포동</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>12.4km</div>
              <div style={{ fontSize: 10, color: t.textMuted }}>~32분</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 28 }}>
          {ACTION_ALERTS.map((alert, idx) => <ActionAlert key={alert.id} t={t} alert={alert} delay={(idx + 1) * 70} />)}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 22 }}>
        <div style={{ padding: "0 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" }}>/ 오늘의 일정</span>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>
            완료 <span style={{ color: t.success, fontWeight: 700 }}>{c.완료}</span> · 진행 <span style={{ color: t.warning, fontWeight: 700 }}>{c.진행중}</span> · 확정 <span style={{ color: t.text, fontWeight: 700 }}>{c.확정}</span> · 미정 <span style={{ color: t.accent, fontWeight: 700 }}>{c.약속대기}</span>
          </span>
        </div>
        {tasks.map((task, idx) => <CompactTaskCard key={task.id} task={task} t={t} index={idx} onClick={() => onTaskClick(task.id)} />)}
      </div>
    </div>
  );
}

function ActionAlert({ t, alert, delay }) {
  const Icon = alert.icon;
  const isMoney = alert.type === "money";
  const hasItems = isMoney ? alert.amount > 0 : alert.count > 0;
  const isUrgent = alert.urgent && hasItems;
  return (
    <div className="card-fade clickable" style={{ background: t.bgElevated, borderRadius: 12, padding: "14px", position: "relative", animationDelay: `${delay}ms` }}>
      {isUrgent && <span className="pulse-dot" style={{ position: "absolute", top: 10, right: 10, width: 6, height: 6, background: t.accent, borderRadius: "50%" }}/>}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
        <Icon size={11} style={{ color: t.textMuted }}/>
        <span style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>{alert.label}</span>
      </div>
      {isMoney ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>₩</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: t.text }}>{alert.amount.toLocaleString()}</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <span className="mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: hasItems ? t.text : t.textDim }}>{alert.count}</span>
          <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>건</span>
        </div>
      )}
      <div style={{ fontSize: 9, color: t.textDim, fontWeight: 500, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{alert.sublabel}</div>
    </div>
  );
}

function CompactTaskCard({ task, t, index, onClick }) {
  const Icon = task.icon;
  const isInProgress = task.status === "진행중";
  const isConfirmed = task.status === "확정";
  const isWaiting = task.status === "약속대기";
  const isCompleted = task.status === "완료";
  const showAccentBar = isConfirmed || isInProgress || isCompleted;
  const hasScheduleChange = task.scheduleHistory && task.scheduleHistory.length > 0;

  let statusColor = t.textMuted, statusBg = "transparent", statusText = "대기";
  if (isInProgress) { statusColor = t.warning; statusBg = t.warningBg; statusText = "진행중"; }
  else if (isConfirmed) { statusColor = t.text; statusBg = t.bgInset; statusText = "확정"; }
  else if (isWaiting) { statusColor = t.accent; statusBg = t.accentBg; statusText = "약속미정"; }
  else if (isCompleted) { statusColor = t.success; statusBg = t.successBg; statusText = "완료"; }

  return (
    <div className="card-fade clickable" onClick={onClick} style={{ padding: "16px 20px", borderTop: `1px solid ${t.border}`, animationDelay: `${(index + 4) * 50}ms`, position: "relative", background: isInProgress ? t.warningBg : isCompleted ? t.successBg : "transparent", opacity: isCompleted ? 0.7 : 1 }}>
      {showAccentBar && <div style={{ position: "absolute", top: 18, bottom: 18, left: 0, width: 1.5, background: isInProgress ? t.warning : isCompleted ? t.success : t.accent, borderRadius: "0 2px 2px 0" }}/>}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ minWidth: 56 }}>
          {isWaiting ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>{formatRequestedDate(task.requestedDate)}</div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2, fontWeight: 600 }}>{task.requestedTime} 희망</div>
            </>
          ) : (
            <>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{task.time}</div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2, fontWeight: 600 }}>{task.duration}</div>
            </>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, textDecoration: isCompleted ? "line-through" : "none", textDecorationColor: t.textMuted }}>{task.customer}</span>
            <span style={{ fontSize: 11, color: t.textMuted }}>{task.address}</span>
            {hasScheduleChange && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", background: t.warningBg, color: t.warning, borderRadius: 4 }}>일정변경</span>}
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <Icon size={11} style={{ color: t.textMuted }}/>
            <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>{task.workType} · {task.appliance} ×{task.qty}</span>
            {task.extraFee > 0 && <span style={{ fontSize: 10, color: t.success, fontWeight: 700, marginLeft: 4 }}>+₩{task.extraFee.toLocaleString()}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 5, background: statusBg, color: statusColor, whiteSpace: "nowrap", letterSpacing: 0.3 }}>{statusText}</div>
          <ChevronRight size={14} style={{ color: t.textDim }}/>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 작업 상세 화면 (일정 변경 추가)
// ============================================
function TaskDetailScreen({ t, task, onBack, onUpdate, onCompleteReport }) {
  const Icon = task.icon;
  const isInProgress = task.status === "진행중";
  const isConfirmed = task.status === "확정";
  const isWaiting = task.status === "약속대기";
  const isCompleted = task.status === "완료";
  const showPhotoSection = isInProgress || isCompleted;
  const isLocked = isCompleted;
  const canChangeSchedule = isConfirmed; // 확정 상태만 변경 가능

  // 약속 잡기
  const [scheduleDate, setScheduleDate] = useState(task.requestedDate || "");
  const [scheduleTime, setScheduleTime] = useState("");
  const canConfirmSchedule = scheduleDate && scheduleTime;

  // ⭐ 일정 변경
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [newDate, setNewDate] = useState(task.scheduledDate || "");
  const [newTime, setNewTime] = useState(task.scheduledTime || "");
  const [changeReason, setChangeReason] = useState("");
  const canConfirmChange = newDate && newTime && (newDate !== task.scheduledDate || newTime !== task.scheduledTime);

  let statusColor = t.textMuted, statusBg = "transparent", statusText = "대기";
  if (isInProgress) { statusColor = t.warning; statusBg = t.warningBg; statusText = "진행중"; }
  else if (isConfirmed) { statusColor = t.accent; statusBg = t.accentBg; statusText = "확정"; }
  else if (isWaiting) { statusColor = t.accent; statusBg = t.accentBg; statusText = "약속미정"; }
  else if (isCompleted) { statusColor = t.success; statusBg = t.successBg; statusText = "✓ 완료"; }

  const finalNet = task.engineerNet + task.extraFee;
  const hasScheduleChange = task.scheduleHistory && task.scheduleHistory.length > 0;

  const handleConfirmSchedule = () => {
    onUpdate(task.id, { status: "확정", scheduledDate: scheduleDate, scheduledTime: scheduleTime, time: scheduleTime, endTime: addHours(scheduleTime, 1), duration: "1h" });
  };

  const handleStart = () => onUpdate(task.id, { status: "진행중", startedAt: NOW });

  const handleSubmitScheduleChange = () => {
    if (!canConfirmChange) return;
    const historyEntry = {
      from: { date: task.scheduledDate, time: task.scheduledTime },
      to: { date: newDate, time: newTime },
      reason: changeReason, changedAt: NOW,
    };
    onUpdate(task.id, {
      scheduledDate: newDate, scheduledTime: newTime, time: newTime,
      endTime: addHours(newTime, parseFloat(task.duration) || 1),
      scheduleHistory: [...(task.scheduleHistory || []), historyEntry],
    });
    setEditingSchedule(false);
    setChangeReason("");
  };

  const handleCancelEdit = () => {
    setEditingSchedule(false);
    setNewDate(task.scheduledDate || "");
    setNewTime(task.scheduledTime || "");
    setChangeReason("");
  };

  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: editingSchedule ? 30 : 130, color: t.text }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@01ff0283e4f6c01667e0c819cfe9d2e933020d3a/css/SpoqaHanSansNeo.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        .mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .section { animation: slideIn 0.3s ease-out backwards; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: t.bg, borderBottom: `1px solid ${t.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="clickable" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8 }}>
          <ArrowLeft size={18}/>
          <span style={{ fontSize: 14, fontWeight: 600 }}>뒤로</span>
        </div>
        <span className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{task.id}</span>
        <div style={{ padding: 8 }}><MoreVertical size={18} style={{ color: t.textMuted }}/></div>
      </div>

      {/* 1. 시간 + 상태 + 변경 버튼 */}
      <div className="section" style={{ padding: "24px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, background: statusBg, color: statusColor, letterSpacing: 0.5 }}>
            <span style={{ width: 5, height: 5, background: statusColor, borderRadius: "50%" }}/>
            {statusText}
          </div>
          {/* ⭐ 일정 변경 버튼 (확정 상태) */}
          {canChangeSchedule && !editingSchedule && (
            <button onClick={() => setEditingSchedule(true)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: t.bgInset, border: `1px solid ${t.borderStrong}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: t.textSecondary, cursor: "pointer", fontFamily: "inherit" }}>
              <Edit3 size={11}/>
              <span>일정 변경</span>
            </button>
          )}
        </div>
        
        {isWaiting ? (
          <>
            <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>고객 희망 시간</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>{formatRequestedDate(task.requestedDate)}</span>
              <span style={{ fontSize: 18, color: t.textSecondary, fontWeight: 600 }}>{task.requestedTime}</span>
            </div>
            <div style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>⚠️ 고객님과 통화 후 정확한 시간을 협의해주세요</div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>{task.time}</span>
              <span style={{ fontSize: 16, color: t.textMuted, fontWeight: 600 }}>~ {task.endTime}</span>
            </div>
            {isInProgress && task.startedAt && <div style={{ fontSize: 12, color: t.warning, fontWeight: 700, marginTop: 4 }}>🟡 {task.startedAt} 시작 · 작업 중</div>}
            {isCompleted && <div style={{ fontSize: 12, color: t.success, fontWeight: 700, marginTop: 4 }}>✅ {task.completedAt} 완료</div>}
            {!isInProgress && !isCompleted && <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>소요 시간 약 {task.duration}</div>}
            
            {hasScheduleChange && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: t.warningBg, border: `1px solid ${t.warningBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <History size={11} style={{ color: t.warning }}/>
                <span style={{ fontSize: 11, color: t.warning, fontWeight: 700 }}>{task.scheduleHistory.length}회 일정 변경됨</span>
              </div>
            )}

            {/* 진행중/완료에 일정 변경 안내 */}
            {(isInProgress || isCompleted) && (
              <div style={{ marginTop: 10, fontSize: 11, color: t.textMuted, fontWeight: 500 }}>
                {isInProgress ? "ℹ️ 작업 중에는 일정 변경 불가 (운영팀 연락)" : "🔒 완료된 작업은 변경 불가"}
              </div>
            )}
          </>
        )}
      </div>

      {/* ⭐ 일정 변경 섹션 */}
      {editingSchedule && (
        <Section t={t} title="일정 변경" icon={<Edit3 size={13}/>} delay={0} highlight>
          <div style={{ background: t.bgInset, borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>현재 약속</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{formatHistoryTime(task.scheduledDate, task.scheduledTime)}</div>
            </div>
            <button onClick={handleCancelEdit} style={{ padding: 8, background: t.bgElevated, border: `1px solid ${t.borderStrong}`, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} style={{ color: t.textMuted }}/>
            </button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(t)}>📅 새 날짜</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[{ label: "오늘", date: "2026-04-27" }, { label: "내일", date: "2026-04-28" }, { label: "모레", date: "2026-04-29" }].map(opt => (
                <button key={opt.date} onClick={() => setNewDate(opt.date)} style={chipBtn(t, newDate === opt.date)}>{opt.label}</button>
              ))}
            </div>
            <CustomDatePicker t={t} value={newDate} onChange={setNewDate}/>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(t)}>⏰ 새 시간</label>
            <CustomTimePicker t={t} value={newTime} onChange={setNewTime}/>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(t)}>📝 변경 사유 (선택)</label>
            <input type="text" placeholder="예: 고객 일정 변경 요청, 다른 작업 충돌 등" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} style={inputStyle(t)}/>
          </div>

          {canConfirmChange && (
            <div style={{ background: t.bgElevated, border: `1px solid ${t.accent}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>✓ 변경 미리보기</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, textDecoration: "line-through" }}>{formatHistoryTime(task.scheduledDate, task.scheduledTime)}</span>
                <ArrowRight size={12} style={{ color: t.accent }}/>
                <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>{formatHistoryTime(newDate, newTime)}</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCancelEdit} style={{ ...btnSecondary(t), flex: "0 0 100px" }}><span>취소</span></button>
            <button onClick={canConfirmChange ? handleSubmitScheduleChange : undefined} disabled={!canConfirmChange} style={{ ...btnPrimary(t), opacity: canConfirmChange ? 1 : 0.4, cursor: canConfirmChange ? "pointer" : "not-allowed" }}>
              <CheckCircle2 size={15}/>
              <span>{canConfirmChange ? "일정 변경 확정" : "변경할 시간 선택"}</span>
            </button>
          </div>
        </Section>
      )}

      {/* 2. 위치 */}
      <Section t={t} title="위치" icon={<MapPin size={13}/>} delay={50}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{task.address}</div>
          <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500, lineHeight: 1.5 }}>{task.fullAddress}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 14px", background: t.bgInset, borderRadius: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>거리</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{task.distance}</div>
          </div>
          <div style={{ width: 1, height: 28, background: t.border }}/>
          <div>
            <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>이동시간</div>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>~{task.travelTime}</div>
          </div>
        </div>
        <button style={btnSecondary(t)}><Navigation size={14}/><span>길찾기 (네이버 / 카카오 맵)</span></button>
      </Section>

      {/* 3. 고객 */}
      <Section t={t} title="고객" icon={<User size={13}/>} delay={100}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: t.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: t.accent }}>{task.customer.slice(0, 1)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{task.customer}님</div>
            <div className="mono" style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500, marginTop: 2 }}>{task.phone}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button style={btnSecondary(t)}><Phone size={14}/><span>전화</span></button>
          <button style={btnSecondary(t)}><MessageCircle size={14}/><span>카톡</span></button>
        </div>
      </Section>

      {/* 4. 작업 정보 */}
      <Section t={t} title="작업 정보" icon={<Wrench size={13}/>} delay={150}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <InfoBox t={t} label="작업 유형" value={task.workType} icon={<Icon size={13} style={{ color: t.accent }}/>}/>
          <InfoBox t={t} label="기종" value={`${task.appliance} ×${task.qty}`}/>
        </div>
        {task.requestNote && (
          <div style={{ padding: "12px 14px", background: t.bgInset, borderRadius: 10, marginBottom: 8, borderLeft: `2px solid ${t.accent}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>💬 고객 요청사항</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: t.text }}>{task.requestNote}</div>
          </div>
        )}
        {task.happycallMemo && (
          <div style={{ padding: "12px 14px", background: t.bgInset, borderRadius: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>📝 해피콜 메모</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: t.textSecondary }}>{task.happycallMemo}</div>
          </div>
        )}
      </Section>

      {/* 5. 약속 잡기 (약속대기) */}
      {isWaiting && (
        <Section t={t} title="약속 잡기" icon={<Calendar size={13}/>} delay={200} highlight>
          <div style={{ background: t.accentBg, border: `1px solid ${t.accent}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <Phone size={14} style={{ color: t.accent, marginTop: 1, flexShrink: 0 }}/>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.accent, marginBottom: 3 }}>먼저 고객님과 통화하세요</div>
              <div style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5 }}>고객 희망: <span style={{ color: t.text, fontWeight: 700 }}>{formatRequestedDate(task.requestedDate)} {task.requestedTime}</span></div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(t)}>📅 약속 날짜</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[{ label: "오늘", date: "2026-04-27" }, { label: "내일", date: "2026-04-28" }, { label: "모레", date: "2026-04-29" }].map(opt => (
                <button key={opt.date} onClick={() => setScheduleDate(opt.date)} style={chipBtn(t, scheduleDate === opt.date)}>{opt.label}</button>
              ))}
            </div>
            <CustomDatePicker t={t} value={scheduleDate} onChange={setScheduleDate}/>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(t)}>⏰ 약속 시간</label>
            <CustomTimePicker t={t} value={scheduleTime} onChange={setScheduleTime}/>
          </div>

          {canConfirmSchedule && (
            <div style={{ background: t.bgInset, border: `1px solid ${t.borderStrong}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>✓ 약속 미리보기</div>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{scheduleDate}</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: t.accent }}>{scheduleTime}</span>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* 6. 금액 */}
      <Section t={t} title="금액" icon={<Wallet size={13}/>} delay={250}>
        <div style={{ marginBottom: 14 }}>
          <Row t={t} label="상품 금액" value={`₩${task.productPrice.toLocaleString()}`} mono/>
          <Row t={t} label="출장비" value={task.travelFee > 0 ? `₩${task.travelFee.toLocaleString()}` : "포함"} mono dim={task.travelFee === 0}/>
          <Row t={t} label={task.extraFee > 0 ? `현장 추가금 ${task.extraReason ? `(${task.extraReason})` : ""}` : "현장 추가금"} value={task.extraFee > 0 ? `+₩${task.extraFee.toLocaleString()}` : "—"} mono dim={task.extraFee === 0} success={task.extraFee > 0}/>
          <div style={{ height: 1, background: t.border, margin: "10px 0" }}/>
          <Row t={t} label={`수수료 (${task.commissionRate}%)`} value={`-₩${task.commission.toLocaleString()}`} mono dim/>
          <div style={{ height: 2, background: t.borderStrong, margin: "10px 0" }}/>
          <div style={{ background: t.accentBg, border: `1px solid ${t.accent}`, borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>내 정산액</div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>수수료 제외 순수익</div>
            </div>
            <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: t.accent, letterSpacing: "-0.02em" }}>₩{finalNet.toLocaleString()}</span>
          </div>
        </div>
      </Section>

      {/* 7. 사진 (진행중/완료) */}
      {showPhotoSection && (
        <Section t={t} title={isCompleted ? "작업 사진 (제출됨)" : "사진 & 보고"} icon={<Camera size={13}/>} delay={300}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <PhotoUploadBox t={t} label="작업 전" uploaded={task.beforePhoto} locked={isLocked}/>
            <PhotoUploadBox t={t} label="작업 후" uploaded={task.afterPhoto} locked={isLocked}/>
          </div>
          {task.workMemo ? (
            <div style={{ padding: "12px 14px", background: t.bgInset, borderRadius: 10, fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>📝 작업 메모</div>
              {task.workMemo}
            </div>
          ) : (
            <div style={{ padding: "10px 14px", background: t.bgInset, borderRadius: 10, fontSize: 12, color: t.textMuted, minHeight: 56, display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={13} style={{ color: t.textDim }}/>
              <span>작업 메모를 남겨주세요...</span>
            </div>
          )}
        </Section>
      )}

      {/* ⭐ 8. 일정 변경 이력 */}
      {hasScheduleChange && (
        <Section t={t} title="일정 변경 이력" icon={<History size={13}/>} delay={325}>
          {task.scheduleHistory.map((entry, idx) => (
            <div key={idx} style={{ padding: "10px 12px", background: t.bgInset, borderRadius: 10, marginBottom: 6, borderLeft: `2px solid ${t.warning}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: entry.reason ? 6 : 0, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, textDecoration: "line-through" }}>{formatHistoryTime(entry.from.date, entry.from.time)}</span>
                <ArrowRight size={11} style={{ color: t.warning }}/>
                <span className="mono" style={{ fontSize: 12, color: t.warning, fontWeight: 700 }}>{formatHistoryTime(entry.to.date, entry.to.time)}</span>
              </div>
              {entry.reason && <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}><span style={{ fontWeight: 700 }}>사유:</span> {entry.reason}</div>}
            </div>
          ))}
        </Section>
      )}

      {/* 운영팀 연락 */}
      {!isCompleted && (
        <div className="section" style={{ padding: "20px", borderTop: `1px solid ${t.border}` }}>
          <div style={{ background: t.bgElevated, border: `1px solid ${t.borderStrong}`, borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: t.warningBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Headphones size={20} style={{ color: t.warning }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>문제가 있나요?</div>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 500 }}>운영팀에 바로 연락 가능</div>
            </div>
            <button className="clickable" style={{ padding: "10px 14px", background: t.warning, color: "#1A1512", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <Phone size={13}/><span>연락</span>
            </button>
          </div>
        </div>
      )}

      {/* 부가 정보 */}
      <Section t={t} title="부가 정보" icon={<FileText size={13}/>} delay={400} subtle>
        <Row t={t} label="접수 채널" value={task.channel} small/>
        <Row t={t} label="접수일" value={task.receivedAt} mono small/>
        <Row t={t} label="작업번호" value={task.id} mono small/>
      </Section>

      {/* 하단 액션 (변경 모드 아닐 때만) */}
      {!editingSchedule && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 420, margin: "0 auto", background: t.bg, borderTop: `1px solid ${t.border}`, padding: "10px 16px 12px", zIndex: 50 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            {isWaiting && (
              <>
                <button style={{ ...btnSecondary(t), flex: "0 0 auto", width: 50, padding: "12px 0" }}><Phone size={16}/></button>
                <button onClick={canConfirmSchedule ? handleConfirmSchedule : undefined} style={{ ...btnPrimary(t), opacity: canConfirmSchedule ? 1 : 0.4, cursor: canConfirmSchedule ? "pointer" : "not-allowed" }} disabled={!canConfirmSchedule}>
                  <CheckCircle2 size={15}/>
                  <span>{canConfirmSchedule ? "약속 확정" : "날짜·시간 선택"}</span>
                </button>
              </>
            )}
            {isConfirmed && (
              <>
                <button style={{ ...btnSecondary(t), flex: "0 0 auto", width: 50, padding: "12px 0" }}><Phone size={16}/></button>
                <button onClick={handleStart} style={btnPrimary(t)}><Play size={15}/><span>작업 시작</span></button>
              </>
            )}
            {isInProgress && (
              <>
                <button style={{ ...btnSecondary(t), flex: "0 0 auto", width: 50, padding: "12px 0" }}><Phone size={16}/></button>
                <button onClick={onCompleteReport} style={btnPrimary(t)}><CheckCircle2 size={15}/><span>완료 보고</span></button>
              </>
            )}
            {isCompleted && (
              <button style={{ ...btnSecondary(t), flex: 1, background: t.successBg, color: t.success, border: `1px solid ${t.successBorder}` }}>
                <Lock size={14}/><span>완료된 작업 (수정 불가)</span>
              </button>
            )}
          </div>
          {!isCompleted && (
            <div className="clickable" style={{ textAlign: "center", padding: "6px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <AlertTriangle size={11} style={{ color: t.textMuted }}/>
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>작업이 어려운 상황인가요?</span>
              <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, textDecoration: "underline" }}>작업 불가 처리</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// 완료 보고 화면
// ============================================
function CompletionReportScreen({ t, task, onCancel, onComplete }) {
  const [extraFee, setExtraFee] = useState("");
  const [extraReason, setExtraReason] = useState("");
  const [workMemo, setWorkMemo] = useState("");
  const [beforePhoto, setBeforePhoto] = useState(false);
  const [afterPhoto, setAfterPhoto] = useState(false);

  const extraFeeNum = parseInt(extraFee.replace(/[^0-9]/g, "")) || 0;
  const newCommission = Math.floor(task.productPrice * task.commissionRate / 100);
  const newEngineerNet = task.productPrice - newCommission + extraFeeNum;
  const canComplete = beforePhoto && afterPhoto;

  const handleSubmit = () => {
    if (!canComplete) return;
    onComplete({
      status: "완료", completedAt: NOW, beforePhoto: true, afterPhoto: true,
      workMemo, extraFee: extraFeeNum, extraReason,
    });
  };

  const formatCurrency = (val) => {
    const num = parseInt(val.replace(/[^0-9]/g, "")) || 0;
    return num > 0 ? num.toLocaleString() : "";
  };

  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 130, color: t.text }}>
      <style>{`
        .mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .section { animation: slideIn 0.3s ease-out backwards; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: t.bg, borderBottom: `1px solid ${t.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="clickable" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
          <ArrowLeft size={18}/><span style={{ fontSize: 14, fontWeight: 600 }}>취소</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800 }}>완료 보고</span>
        <div style={{ width: 60 }}/>
      </div>

      <div className="section" style={{ padding: "20px" }}>
        <div style={{ background: t.bgElevated, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: t.accentBg, display: "flex", alignItems: "center", justifyContent: "center", color: t.accent, fontSize: 16, fontWeight: 800 }}>{task.customer.slice(0, 1)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{task.customer}님 · {task.workType}</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }} className="mono">{task.time} ~ {task.endTime} · {task.address}</div>
          </div>
        </div>
      </div>

      <Section t={t} title="작업 사진 (필수)" icon={<Camera size={13}/>} delay={50}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <PhotoUploadBox t={t} label="작업 전" uploaded={beforePhoto} onClick={() => setBeforePhoto(!beforePhoto)}/>
          <PhotoUploadBox t={t} label="작업 후" uploaded={afterPhoto} onClick={() => setAfterPhoto(!afterPhoto)}/>
        </div>
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>※ 두 사진 모두 업로드 (위 박스 탭하면 시뮬됨)</div>
      </Section>

      <Section t={t} title="현장 추가금" icon={<Plus size={13}/>} delay={100}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle(t)}>💰 추가 금액 (선택)</label>
          <div style={{ position: "relative" }}>
            <input type="text" inputMode="numeric" placeholder="0" value={extraFee ? formatCurrency(extraFee) : ""} onChange={(e) => setExtraFee(e.target.value)} style={{ ...inputStyle(t), paddingLeft: 32, fontFamily: "'JetBrains Mono', monospace" }}/>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: t.textMuted, fontWeight: 600 }}>₩</span>
            {extraFee && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: t.textMuted, fontWeight: 600 }}>원</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[10000, 20000, 30000, 50000].map(amount => (
              <button key={amount} onClick={() => setExtraFee(amount.toString())} style={chipBtn(t, parseInt(extraFee) === amount)}>+{(amount/10000)}만</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle(t)}>📝 추가 사유 (선택)</label>
          <input type="text" placeholder="예: 필터 추가 교체, 가스 보충 등" value={extraReason} onChange={(e) => setExtraReason(e.target.value)} style={inputStyle(t)}/>
        </div>
        <div style={{ background: t.bgInset, border: `1px solid ${t.borderStrong}`, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>✓ 변경된 정산 미리보기</div>
          <Row t={t} label="상품 금액" value={`₩${task.productPrice.toLocaleString()}`} mono small/>
          {extraFeeNum > 0 && <Row t={t} label="현장 추가금" value={`+₩${extraFeeNum.toLocaleString()}`} mono small success/>}
          <Row t={t} label={`수수료 (${task.commissionRate}%)`} value={`-₩${newCommission.toLocaleString()}`} mono dim small/>
          <div style={{ height: 1, background: t.borderStrong, margin: "8px 0" }}/>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
            <div>
              <div style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>내 정산액</div>
              {extraFeeNum > 0 && <div style={{ fontSize: 10, color: t.success, fontWeight: 700, marginTop: 2 }}>+₩{extraFeeNum.toLocaleString()} 추가</div>}
            </div>
            <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: t.accent, letterSpacing: "-0.02em" }}>₩{newEngineerNet.toLocaleString()}</span>
          </div>
        </div>
      </Section>

      <Section t={t} title="작업 메모" icon={<FileText size={13}/>} delay={150}>
        <textarea placeholder="작업 내용, 특이사항 등을 자유롭게 입력하세요..." value={workMemo} onChange={(e) => setWorkMemo(e.target.value)} rows={4} style={{ ...inputStyle(t), minHeight: 90, resize: "vertical", lineHeight: 1.6 }}/>
      </Section>

      <div style={{ padding: "0 20px 100px" }}>
        <div style={{ background: t.bgInset, borderRadius: 10, padding: "12px 14px", fontSize: 11, color: t.textMuted, lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <AlertTriangle size={12} style={{ color: t.warning, marginTop: 2, flexShrink: 0 }}/>
          <span>완료 처리 후에는 사진/금액 수정이 어렵습니다. 운영팀에 연락해야 변경 가능해요.</span>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 420, margin: "0 auto", background: t.bg, borderTop: `1px solid ${t.border}`, padding: "12px 16px", zIndex: 50 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ ...btnSecondary(t), flex: "0 0 100px" }}><span>취소</span></button>
          <button onClick={canComplete ? handleSubmit : undefined} disabled={!canComplete} style={{ ...btnPrimary(t), opacity: canComplete ? 1 : 0.4, cursor: canComplete ? "pointer" : "not-allowed" }}>
            <CheckCircle2 size={15}/>
            <span>{canComplete ? "완료 처리" : "사진을 업로드하세요"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 헬퍼 컴포넌트
// ============================================
function Section({ t, title, icon, children, delay = 0, subtle = false, highlight = false }) {
  return (
    <div className="section" style={{ padding: "20px", borderTop: `1px solid ${t.border}`, animationDelay: `${delay}ms`, opacity: subtle ? 0.85 : 1, background: highlight ? t.accentBg : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <span style={{ color: highlight ? t.accent : t.textMuted, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: highlight ? t.accent : t.textMuted, letterSpacing: 1.5, textTransform: "uppercase" }}>{title}{highlight && " ⭐"}</span>
      </div>
      {children}
    </div>
  );
}

function InfoBox({ t, label, value, icon }) {
  return (
    <div style={{ padding: "10px 12px", background: t.bgInset, borderRadius: 10, border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{icon}<span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{value}</span></div>
    </div>
  );
}

function Row({ t, label, value, mono, bold, dim, small, success }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: small ? "5px 0" : "7px 0", fontSize: small ? 12 : 13 }}>
      <span style={{ color: t.textMuted, fontWeight: 500 }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{ color: dim ? t.textMuted : success ? t.success : t.text, fontWeight: bold ? 700 : 600, fontSize: bold ? 15 : (small ? 12 : 13) }}>{value}</span>
    </div>
  );
}

function PhotoUploadBox({ t, label, uploaded, onClick, locked }) {
  return (
    <div className={!locked ? "clickable" : ""} onClick={!locked ? onClick : undefined} style={{ aspectRatio: "1", background: uploaded ? t.successBg : t.bgInset, border: `1px ${uploaded ? "solid" : "dashed"} ${uploaded ? t.successBorder : t.borderStrong}`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: uploaded ? t.success : t.textMuted, cursor: locked ? "default" : "pointer", position: "relative" }}>
      {uploaded && <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: t.success, color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={14}/></div>}
      {locked && <Lock size={12} style={{ position: "absolute", top: 8, right: 8, color: t.textMuted }}/>}
      <ImageIcon size={20}/>
      <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
      {uploaded && <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.7 }}>업로드됨</span>}
    </div>
  );
}

// ============================================
// 메인 앱
// ============================================
// ============================================
// 💰 정산 화면
// ============================================
function SettlementScreen({ t }) {
  const [period, setPeriod] = useState("today"); // 'today' or 'month'
  const data = period === "today" ? SETTLEMENT_DATA.today : SETTLEMENT_DATA.thisMonth;
  
  // 기간별 작업 필터
  const filteredJobs = period === "today" 
    ? SETTLEMENT_DATA.recentJobs.filter(j => j.date === "04.27")
    : SETTLEMENT_DATA.recentJobs;
  
  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@01ff0283e4f6c01667e0c819cfe9d2e933020d3a/css/SpoqaHanSansNeo.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      {/* 헤더 */}
      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 500, textTransform: "uppercase" }}>
            정산 · MON 27 APR
          </span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16 }}>
          내 수익
        </div>
        
        {/* 기간 토글 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: t.bgInset, borderRadius: 10, padding: 4 }}>
          {[
            { id: "today", label: "오늘" },
            { id: "month", label: "이번 달" },
          ].map(opt => (
            <button key={opt.id} onClick={() => setPeriod(opt.id)} style={{
              flex: 1, padding: "10px 14px",
              background: period === opt.id ? t.bgElevated : "transparent",
              color: period === opt.id ? t.text : t.textMuted,
              border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 핵심 메트릭: 내 수익 (히어로) */}
      <div style={{ padding: "0 20px" }}>
        <div className="card-fade" style={{ background: t.bgElevated, borderRadius: 18, padding: "22px 24px", marginBottom: 12, position: "relative" }}>
          <div style={{ position: "absolute", top: 22, bottom: 22, left: 0, width: 2, background: t.accent }}/>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
            {period === "today" ? "오늘" : "이번 달"} 내 수익 (수수료 제외)
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: t.textMuted, fontWeight: 600 }}>₩</span>
            <span className="mono" style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: t.accent }}>
              {data.netIncome.toLocaleString()}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.textMuted, fontWeight: 500 }}>
            <span>완료 <span className="mono" style={{ color: t.text, fontWeight: 700 }}>{data.completedCount}</span>건</span>
            <span>·</span>
            <span>작업당 평균 <span className="mono" style={{ color: t.text, fontWeight: 700 }}>₩{data.avgPerJob.toLocaleString()}</span></span>
          </div>
        </div>

        {/* 현장수금 vs 회사정산 (핵심!) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {/* 현장 수금 */}
          <div className="card-fade" style={{ 
            background: t.successBg, 
            border: `1px solid ${t.successBorder}`, 
            borderRadius: 12, padding: "14px 16px",
            animationDelay: "70ms",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
              <Wallet size={11} style={{ color: t.success }}/>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.success, letterSpacing: 0.5, textTransform: "uppercase" }}>현장 수금</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: t.success, fontWeight: 600 }}>₩</span>
              <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: t.success }}>
                {data.fieldCollection.received.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 6 }}>
              {data.fieldCollection.count}건 받음
            </div>
            <div style={{ paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: t.textMuted }}>회사 송금</span>
                <span className="mono" style={{ color: t.danger, fontWeight: 700 }}>−₩{data.fieldCollection.sentToCompany.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ color: t.success, fontWeight: 700 }}>내 수익</span>
                <span className="mono" style={{ color: t.success, fontWeight: 700 }}>₩{data.fieldCollection.myIncome.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* 회사 정산 */}
          <div className="card-fade" style={{ 
            background: t.accentBg, 
            border: `1px solid ${t.accent}30`, 
            borderRadius: 12, padding: "14px 16px",
            animationDelay: "140ms",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
              <CreditCard size={11} style={{ color: t.accent }}/>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.accent, letterSpacing: 0.5, textTransform: "uppercase" }}>회사 정산</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: t.accent, fontWeight: 600 }}>₩</span>
              <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>
                {data.companySettlement.gross.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 6 }}>
              {data.companySettlement.count}건 발생
            </div>
            <div style={{ paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: t.textMuted }}>수수료</span>
                <span className="mono" style={{ color: t.danger, fontWeight: 700 }}>−₩{data.companySettlement.commission.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ color: t.accent, fontWeight: 700 }}>받을 금액</span>
                <span className="mono" style={{ color: t.accent, fontWeight: 700 }}>₩{data.companySettlement.myIncome.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 미정산 안내 (회사가 줘야 할 돈이 있을 때만) */}
        {data.companySettlement.myIncome > 0 && (
          <div className="card-fade" style={{ 
            background: t.warningBg, 
            border: `1px solid ${t.warningBorder}`, 
            borderRadius: 10, padding: "10px 14px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 8,
            animationDelay: "210ms",
          }}>
            <AlertCircle size={14} style={{ color: t.warning, flexShrink: 0 }}/>
            <div style={{ flex: 1, fontSize: 11, color: t.text, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700 }}>회사 정산 미수령</span>
              <span style={{ color: t.textMuted, marginLeft: 4 }}>
                · ₩{data.companySettlement.myIncome.toLocaleString()} ({period === "today" ? "다음주 입금 예정" : "주간 정산일에 입금"})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 작업별 상세 */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 22 }}>
        <div style={{ padding: "0 20px 14px" }}>
          <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
            {period === "today" ? "오늘 작업 상세" : "최근 작업"}
          </span>
        </div>
        {filteredJobs.map((job, idx) => (
          <JobSettlementCard key={job.id} job={job} t={t} index={idx} />
        ))}
      </div>

      {/* 주간 정산 이력 (이번 달 일 때만) */}
      {period === "month" && (
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 22, marginTop: 8 }}>
          <div style={{ padding: "0 20px 14px" }}>
            <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
              주간 정산 이력 (회사 정산만)
            </span>
          </div>
          {SETTLEMENT_DATA.history.map((s, idx) => (
            <div key={s.id} className="card-fade" style={{
              padding: "14px 20px",
              borderTop: `1px solid ${t.border}`,
              display: "flex", alignItems: "center", gap: 14,
              animationDelay: `${idx * 50}ms`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.date} 주</div>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                  {s.count}건 · 입금 {s.paidDate}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                  ₩{s.amount.toLocaleString()}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: t.success, fontWeight: 700, padding: "2px 6px", background: t.successBg, borderRadius: 4, marginTop: 4 }}>
                  <Check size={9}/><span>{s.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 작업별 정산 카드
function JobSettlementCard({ job, t, index }) {
  const isField = job.paymentType === "field";
  const labelColor = isField ? t.success : t.accent;
  const labelBg = isField ? t.successBg : t.accentBg;
  const labelText = isField ? "현장수금" : "회사정산";
  
  return (
    <div className="card-fade" style={{
      padding: "14px 20px",
      borderTop: `1px solid ${t.border}`,
      animationDelay: `${index * 50}ms`,
    }}>
      {/* 상단: 시간 + 고객 + 라벨 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
            {job.date} {job.time}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{job.customer}</span>
          <span style={{ fontSize: 11, color: t.textMuted }}>· {job.workType}</span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "3px 8px",
          background: labelBg, color: labelColor,
          borderRadius: 4, letterSpacing: 0.3,
        }}>
          {labelText}
        </span>
      </div>
      
      {/* 하단: 3단 정산 표시 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
        <div>
          <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 600, marginBottom: 3 }}>
            {isField ? "고객 수금" : "상품 금액"}
          </div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
            ₩{job.grossAmount.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 600, marginBottom: 3 }}>
            {isField ? "회사 송금" : "수수료"}
          </div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.danger }}>
            −₩{job.commission.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 600, marginBottom: 3 }}>
            {isField ? "내 수익" : "받을 금액"}
          </div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: labelColor }}>
            ₩{job.myIncome.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallMetric({ t, label, value, unit, dim, delay }) {
  return (
    <div className="card-fade" style={{ background: t.bgElevated, borderRadius: 12, padding: "14px 16px", animationDelay: `${delay}ms` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        {unit === "₩" && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>₩</span>}
        <span className="mono" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: dim ? t.textMuted : t.text }}>
          {value.toLocaleString()}
        </span>
        {unit === "건" && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>건</span>}
      </div>
    </div>
  );
}

// ============================================
// 🔔 알림 센터
// ============================================
function NotificationsScreen({ t }) {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [filter, setFilter] = useState("all"); // all / unread
  
  const filtered = filter === "unread" ? notifications.filter(n => n.unread) : notifications;
  const unreadCount = notifications.filter(n => n.unread).length;
  
  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };
  
  const markRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, unread: false } : n));
  };
  
  const remove = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
      <style>{`
        .mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 500, textTransform: "uppercase" }}>
            알림 · MON 27 APR
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
            알림 센터
            {unreadCount > 0 && (
              <span style={{ fontSize: 14, color: t.accent, marginLeft: 8 }}>
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="clickable" style={{
              fontSize: 12, color: t.accent, fontWeight: 700,
              background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
            }}>
              모두 읽음
            </button>
          )}
        </div>

        {/* 필터 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[
            { id: "all", label: `전체 ${notifications.length}` },
            { id: "unread", label: `안 읽음 ${unreadCount}` },
          ].map(opt => (
            <button key={opt.id} onClick={() => setFilter(opt.id)} style={{
              padding: "8px 14px",
              background: filter === opt.id ? t.accent : t.bgInset,
              color: filter === opt.id ? "white" : t.text,
              border: `1px solid ${filter === opt.id ? t.accent : t.border}`,
              borderRadius: 9, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: t.textMuted }}>
          <Bell size={32} style={{ color: t.textDim, margin: "0 auto 12px" }}/>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {filter === "unread" ? "안 읽은 알림이 없어요" : "알림이 없어요"}
          </div>
          <div style={{ fontSize: 11, color: t.textDim }}>새 알림이 오면 여기에 표시됩니다</div>
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${t.border}` }}>
          {filtered.map((notif, idx) => (
            <NotificationItem 
              key={notif.id} 
              notif={notif} 
              t={t} 
              index={idx}
              onMarkRead={() => markRead(notif.id)}
              onRemove={() => remove(notif.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notif, t, index, onMarkRead, onRemove }) {
  const getColor = () => {
    switch(notif.type) {
      case "assign": return { c: t.accent, bg: t.accentBg, icon: Bell };
      case "schedule_change": return { c: t.warning, bg: t.warningBg, icon: Calendar };
      case "ops": return { c: t.text, bg: t.bgInset, icon: Headphones };
      case "settlement": return { c: t.success, bg: t.successBg, icon: Wallet };
      case "review": return { c: t.warning, bg: t.warningBg, icon: Star };
      default: return { c: t.textMuted, bg: t.bgInset, icon: Bell };
    }
  };
  const { c, bg, icon: Icon } = getColor();

  return (
    <div className="card-fade" onClick={notif.unread ? onMarkRead : undefined} style={{
      padding: "16px 20px",
      borderBottom: `1px solid ${t.border}`,
      background: notif.unread ? t.accentBg : "transparent",
      animationDelay: `${index * 40}ms`,
      cursor: notif.unread ? "pointer" : "default",
      position: "relative",
    }}>
      {notif.unread && (
        <div style={{ position: "absolute", top: 22, left: 8, width: 6, height: 6, borderRadius: "50%", background: t.accent }}/>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingLeft: notif.unread ? 8 : 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: bg, color: c,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={16}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: notif.unread ? t.text : t.textSecondary }}>
                {notif.title}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", background: bg, color: c, borderRadius: 4 }}>
                {notif.type === "assign" ? "배정" : 
                 notif.type === "schedule_change" ? "일정변경" :
                 notif.type === "ops" ? "운영팀" :
                 notif.type === "settlement" ? "정산" :
                 notif.type === "review" ? "후기" : "알림"}
              </span>
            </div>
            <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0 }}>{notif.time}</span>
          </div>
          <div style={{ fontSize: 12, color: notif.unread ? t.text : t.textMuted, lineHeight: 1.5, marginBottom: 8 }}>
            {notif.message}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {notif.taskId && (
              <button className="clickable" style={{
                fontSize: 10, fontWeight: 700, padding: "5px 10px",
                background: t.bgElevated, color: t.text,
                border: `1px solid ${t.border}`, borderRadius: 6,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 3,
              }}>
                작업 보기 <ChevronRight size={10}/>
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="clickable" style={{
              fontSize: 10, fontWeight: 600, padding: "5px 8px",
              background: "transparent", color: t.textMuted,
              border: `1px solid ${t.border}`, borderRadius: 6,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 3,
              marginLeft: "auto",
            }}>
              <Trash2 size={10}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 👤 프로필 화면
// ============================================
function ProfileScreen({ t, mode, setMode }) {
  const currentRank = ENGINEER_RANKS.find(r => r.id === PROFILE_DATA.currentRank);
  const nextRank = ENGINEER_RANKS[ENGINEER_RANKS.findIndex(r => r.id === PROFILE_DATA.currentRank) + 1];
  
  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
      <style>{`
        .mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      {/* 헤더 + 프로필 카드 */}
      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 500, textTransform: "uppercase" }}>
            내 정보
          </span>
        </div>

        {/* 프로필 카드 */}
        <div className="card-fade" style={{ 
          background: t.bgElevated, borderRadius: 18, 
          padding: "24px", marginBottom: 16,
          textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: t.accent, color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 800,
            margin: "0 auto 14px",
            position: "relative",
          }}>
            {PROFILE_DATA.name.slice(0, 1)}
            {/* 직급 배지 */}
            <div style={{
              position: "absolute", bottom: -6, right: -6,
              width: 32, height: 32, borderRadius: 10,
              background: t.bgElevated,
              border: `2px solid ${currentRank.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>
              {currentRank.icon}
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
            {PROFILE_DATA.name}
          </div>
          
          {/* 직급 표시 */}
          <div style={{ 
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", marginBottom: 14,
            background: currentRank.color + "15",
            border: `1px solid ${currentRank.color}40`,
            borderRadius: 100,
          }}>
            <span style={{ fontSize: 14 }}>{currentRank.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: currentRank.color }}>
              {currentRank.name}
            </span>
          </div>
          
          <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, marginBottom: 16 }}>
            {PROFILE_DATA.region} · 가입 {PROFILE_DATA.joinDate} ({PROFILE_DATA.yearsAtCompany}년차)
          </div>
          
          {/* 다음 등급 진행률 */}
          {nextRank && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 6 }}>
                <span style={{ color: t.textMuted, fontWeight: 600 }}>
                  {nextRank.icon} {nextRank.name}까지
                </span>
                <span className="mono" style={{ color: t.accent, fontWeight: 700 }}>
                  {PROFILE_DATA.jobsToNextRank}건 남음
                </span>
              </div>
              <div style={{ height: 6, background: t.bgInset, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ 
                  width: `${PROFILE_DATA.rankProgress}%`, height: "100%", 
                  background: t.accent, transition: "width 0.5s",
                }}/>
              </div>
              <div style={{ fontSize: 9, color: t.textDim, marginTop: 4, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                {PROFILE_DATA.rankProgress}%
              </div>
            </div>
          )}
        </div>

        {/* 통계 3개 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
          <ProfileStat t={t} label="총 작업" value={PROFILE_DATA.totalJobs} unit="건" delay={0}/>
          <ProfileStat t={t} label="이번달 작업" value={PROFILE_DATA.thisMonthJobs} unit="건" highlight delay={70}/>
          <ProfileStat t={t} label="이번달 출근" value={`${PROFILE_DATA.thisMonthAttendance}/${PROFILE_DATA.totalDays}`} unit="일" delay={140}/>
        </div>
      </div>

      {/* 직급 로드맵 */}
      <div style={{ padding: "0 20px 24px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
          📈 직급 로드맵
        </div>
        <div style={{ background: t.bgElevated, borderRadius: 12, padding: "12px" }}>
          {ENGINEER_RANKS.map((rank, idx) => {
            const isCurrent = rank.id === PROFILE_DATA.currentRank;
            const isPast = ENGINEER_RANKS.findIndex(r => r.id === PROFILE_DATA.currentRank) > idx;
            const isFuture = !isCurrent && !isPast;
            
            return (
              <div key={rank.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 4px",
                borderBottom: idx < ENGINEER_RANKS.length - 1 ? `1px solid ${t.border}` : "none",
                opacity: isFuture ? 0.4 : 1,
              }}>
                <div style={{ 
                  fontSize: 18,
                  filter: isFuture ? "grayscale(1)" : "none",
                }}>
                  {rank.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: 13, fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent ? rank.color : t.text,
                  }}>
                    {rank.name}
                    {isCurrent && (
                      <span style={{ 
                        marginLeft: 6, fontSize: 9, fontWeight: 800,
                        padding: "2px 6px", background: rank.color, color: "white",
                        borderRadius: 4,
                      }}>
                        현재
                      </span>
                    )}
                    {isPast && (
                      <Check size={10} style={{ color: t.success, marginLeft: 6 }}/>
                    )}
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>
                  {rank.max === 9999 ? `${rank.min}+` : `${rank.min}~${rank.max}`}건
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 뱃지 */}
      <div style={{ padding: "0 20px 24px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
          🏅 내 뱃지
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {PROFILE_DATA.badges.map((b, idx) => (
            <div key={b.id} className="card-fade" style={{
              background: t.bgElevated, borderRadius: 12, padding: "14px 8px",
              textAlign: "center", animationDelay: `${idx * 70}ms`,
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{b.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>{b.label}</div>
              {b.value ? (
                <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: t.accent }}>{b.value}</div>
              ) : (
                <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: t.accent }}>×{b.count}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 메뉴 */}
      <div style={{ borderTop: `1px solid ${t.border}` }}>
        <ProfileMenuItem t={t} icon={<User size={16}/>} label="내 정보 수정" sublabel={PROFILE_DATA.phone}/>
        <ProfileMenuItem t={t} icon={<MapPin size={16}/>} label="작업 지역" sublabel={PROFILE_DATA.region}/>
        <ProfileMenuItem t={t} icon={<BarChart3 size={16}/>} label="작업 통계" sublabel="월별 / 유형별 분석"/>
      </div>

      <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 8 }}>
        <ProfileMenuItem t={t} icon={<Bell size={16}/>} label="알림 설정" sublabel="텔레그램 알림"/>
        <ProfileMenuItem t={t} icon={<Volume2 size={16}/>} label="소리 / 진동"/>
        {/* 다크/라이트 토글 */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: t.bgInset,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: t.textMuted, flexShrink: 0,
          }}>
            {mode === "dark" ? <Moon size={16}/> : <Sun size={16}/>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>화면 모드</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
              {mode === "dark" ? "다크" : "라이트"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, background: t.bgInset, padding: 3, borderRadius: 8 }}>
            <button onClick={() => setMode("dark")} style={{
              padding: "6px 10px",
              background: mode === "dark" ? t.bgElevated : "transparent",
              color: mode === "dark" ? t.text : t.textMuted,
              border: "none", borderRadius: 5,
              fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <Moon size={11}/>
            </button>
            <button onClick={() => setMode("light")} style={{
              padding: "6px 10px",
              background: mode === "light" ? t.bgElevated : "transparent",
              color: mode === "light" ? t.text : t.textMuted,
              border: "none", borderRadius: 5,
              fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <Sun size={11}/>
            </button>
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 8 }}>
        <ProfileMenuItem t={t} icon={<Headphones size={16}/>} label="운영팀 문의" sublabel="문제가 있을 때"/>
        <ProfileMenuItem t={t} icon={<FileText size={16}/>} label="이용약관 / 정책"/>
        <ProfileMenuItem t={t} icon={<LogOut size={16}/>} label="로그아웃" danger/>
      </div>

      {/* 버전 */}
      <div style={{ padding: "30px 20px", textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 10, color: t.textDim, fontWeight: 500 }}>
          올잇(Ollit) v0.20 · 호칭: 기사님
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ t, label, value, unit, highlight, delay }) {
  return (
    <div className="card-fade" style={{ 
      background: highlight ? t.accentBg : t.bgElevated, 
      border: highlight ? `1px solid ${t.accent}` : "none",
      borderRadius: 12, padding: "14px 8px", textAlign: "center",
      animationDelay: `${delay}ms`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: highlight ? t.accent : t.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
        <span className="mono" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: highlight ? t.accent : t.text }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
}

function ProfileMenuItem({ t, icon, label, sublabel, danger }) {
  return (
    <div className="clickable" style={{
      padding: "16px 20px",
      borderBottom: `1px solid ${t.border}`,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: danger ? t.dangerBg : t.bgInset,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: danger ? t.danger : t.textMuted, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: danger ? t.danger : t.text }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{sublabel}</div>}
      </div>
      <ChevronRight size={14} style={{ color: t.textDim }}/>
    </div>
  );
}

// ============================================
// 📱 하단 탭바
// ============================================
function BottomTabBar({ t, activeTab, onTabChange, unreadCount }) {
  const tabs = [
    { id: "main", label: "일정", icon: Calendar },
    { id: "settlement", label: "정산", icon: Wallet },
    { id: "notifications", label: "알림", icon: Bell, badge: unreadCount },
    { id: "profile", label: "내 정보", icon: User },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 420, margin: "0 auto",
      background: t.bg,
      borderTop: `1px solid ${t.border}`,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      zIndex: 100,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => onTabChange(tab.id)} style={{
              padding: "10px 0 12px",
              background: "transparent",
              border: "none", cursor: "pointer", fontFamily: "inherit",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              position: "relative",
            }}>
              {/* 활성 표시 (상단 라인) */}
              {active && (
                <div style={{ 
                  position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                  width: 30, height: 2, background: t.accent, borderRadius: "0 0 2px 2px",
                }}/>
              )}
              {/* 아이콘 + 뱃지 */}
              <div style={{ position: "relative" }}>
                <Icon size={20} style={{ color: active ? t.accent : t.textMuted, strokeWidth: active ? 2.5 : 2 }}/>
                {tab.badge > 0 && (
                  <div style={{
                    position: "absolute", top: -4, right: -7,
                    minWidth: 16, height: 16, padding: "0 4px",
                    background: t.danger, color: "white",
                    borderRadius: 8, border: `2px solid ${t.bg}`,
                    fontSize: 9, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </div>
                )}
              </div>
              <span style={{ 
                fontSize: 10, fontWeight: 700,
                color: active ? t.accent : t.textMuted,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


export default function EngineerApp({ user, onLogout }) {
  const [mode, setMode] = useState("dark");
  const [screen, setScreen] = useState("main");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const t = THEMES[mode];
  const selectedTask = tasks.find(x => x.id === selectedTaskId);
  
  const updateTask = (id, updates) => setTasks(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));
  const reset = () => { setTasks(INITIAL_TASKS); setScreen("main"); setSelectedTaskId(null); };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(10,10,10,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginBottom: 6, textAlign: "center", fontFamily: "system-ui", fontWeight: 600 }}>🔧 기사님 화면</div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textAlign: "center", fontFamily: "system-ui", lineHeight: 1.5 }}>
          에어컨 현장작업 운영관리 플랫폼
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
        {screen === "main" && <MainScreen t={t} tasks={tasks} onTaskClick={(id) => { setSelectedTaskId(id); setScreen("detail"); }} />}
        {screen === "settlement" && <SettlementScreen t={t} />}
        {screen === "notifications" && <NotificationsScreen t={t} />}
        {screen === "profile" && <ProfileScreen t={t} mode={mode} setMode={setMode} />}
        {screen === "detail" && selectedTask && <TaskDetailScreen t={t} task={selectedTask} onBack={() => setScreen("main")} onUpdate={updateTask} onCompleteReport={() => setScreen("completionReport")} />}
        {screen === "completionReport" && selectedTask && <CompletionReportScreen t={t} task={selectedTask} onCancel={() => setScreen("detail")} onComplete={(data) => { updateTask(selectedTaskId, data); setScreen("detail"); }} />}
        
        {/* 하단 탭바 (메인 탭 화면에서만 표시) */}
        {["main", "settlement", "notifications", "profile"].includes(screen) && (
          <BottomTabBar 
            t={t} 
            activeTab={screen} 
            onTabChange={setScreen}
            unreadCount={NOTIFICATIONS.filter(n => n.unread).length}
          />
        )}
      </div>
    </div>
  );
}
