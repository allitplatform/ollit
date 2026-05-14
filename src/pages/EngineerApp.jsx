import React, { useState, useEffect } from "react";
import {
  loadTasksForRole as getTasks,
  updateTaskAdapter as apiUpdateTask,
  requestCancelAdapter as apiRequestCancel,
  acceptOfferAdapter as apiAcceptOffer,
  startTaskAdapter as apiStartTask,
  completeTaskAdapter as apiCompleteTask,
  changePriceAdapter as apiChangePrice,
} from "../data/tasksDb.js";
import { uploadPhoto } from "../lib/photosDb.js";
// Phase 3-5 — 휴무는 DB 측 (offDaysDb.js) 어댑터 사용. 시그니처 동일.
import { getOffDays, addOffDay, deleteOffDay } from "../lib/offDaysDb.js";
import { v14NormalizeTask, v14FindTaskList, filterTasksForEngineerV14 } from "../utils/v14Task.js";
import { ENABLE_MOCK } from "../config/env.js";
import { loadEngineers, saveEngineerWithSync, createEmptyEngineer } from "../data/engineers.js";
import { REGISTERED_USERS } from "../shared/users.js";
import { useRealtime } from "../hooks/useRealtime.js";
import { useRealtimeTasks } from "../hooks/useRealtimeSubscription.js";
import {
  listNotifications as listStoredNotifications,
  markAsRead as markStoredAsRead,
  markAllAsRead as markAllStoredAsRead,
  clearAll as clearAllStored,
} from "../utils/notificationStore.js";

// IndexedDB 측 알림 → NotiScreen props 형식 어댑트
function adaptStoredNoti(stored) {
  const title = stored.title || "";
  let type = "team_message";
  if (/배정|새 작업/.test(title)) type = "new_assignment";
  else if (/수락 대기/.test(title)) type = "acceptance_pending";
  else if (/일정/.test(title)) type = "schedule_changed";
  else if (/취소/.test(title)) type = "work_canceled";
  else if (/입금 요청|송금/.test(title)) type = "payment_request";
  else if (/입금 확인|입금 완료/.test(title)) type = "payment_confirmed";
  return {
    id: stored.id,
    type,
    read: !!stored.read,
    urgent: false,
    createdAt: new Date(stored.timestamp || Date.now()),
    title,
    subtitle: stored.body || "",
    relatedId: stored.taskId || null,
    targetScreen: stored.url || null,
    _stored: true,
  };
}

// V14 헬퍼 — File → base64 (사진 업로드 catch)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
import { 
  Phone, Navigation, CheckCircle2, MapPin, Wrench, Snowflake, Settings, Zap, 
  Sun, Moon, Bell, Camera, Wallet, ArrowRight, ArrowLeft, MessageCircle,
  FileText, ChevronRight, Plus, Image as ImageIcon, Calendar,
  MoreVertical, Play, User, AlertTriangle, Headphones, RotateCcw, Lock,
  Edit3, X, History, ChevronLeft,
  TrendingUp, TrendingDown, CreditCard, BellRing, Award, AlertCircle,
  Star, Briefcase, BarChart3, LogOut, ChevronUp, Check, Volume2, Trash2
} from "lucide-react";
import { useTasks } from "../shared/TasksContext.jsx";
import { filterTasksForEngineer } from "../shared/tasks.js";
import { OllitLoader } from "../components/OllitLoader.jsx";
import { EngineerSettlementScreen as EngineerSettlementV11 } from "../components/EngineerSettlementScreen.jsx";
import { EngineerNewAssignmentListScreen } from "../components/EngineerNewAssignmentListScreen.jsx";
import { EngineerAcceptanceListScreen } from "../components/EngineerAcceptanceListScreen.jsx";
import { EngineerTaskDetailScreen } from "../components/EngineerTaskDetailScreen.jsx";
import { ServiceTypeIcon } from "../components/ServiceTypeIcon.jsx";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { useIsDark } from "../hooks/useIsDark.js";
import { WorkItemRow } from "../components/WorkItemRow.jsx";
import { applyTheme as applyThemeVars, loadTheme as loadThemeSaved } from "../styles/themes.js";
import { workDateLabel, workDateColor, relativeLabel, fullDateLabel, formatTimeOnly, formatDateOnly } from "../utils/dateLabel.js";
// V13-FINAL2 — 4탭 + 공유 컴포넌트
import { EngineerBottomNav } from "../components/EngineerBottomNav.jsx";
import { EngineerSettleTab } from "../components/EngineerSettleTab.jsx";
import { EngineerSettlementDetailScreen } from "../components/EngineerSettlementDetailScreen.jsx";
import { EngineerCalendarTab } from "../components/EngineerCalendarTab.jsx";
import { EngineerNotiTab } from "../components/EngineerNotiTab.jsx";
import { EngineerMeTab } from "../components/EngineerMeTab.jsx";
import { UsolNCalendarScreen } from "../components/UsolNCalendarScreen.jsx";
import { PaymentHistoryScreen } from "../components/PaymentHistoryScreen.jsx";
import { UsolNSettlementScreen } from "../components/UsolNSettlementScreen.jsx";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
// V13-FINAL2-fix1 신규 화면
import { EngineerOffDayAddModal } from "../components/EngineerOffDayAddModal.jsx";
import { EngineerAccountEditScreen } from "../components/EngineerAccountEditScreen.jsx";
import { EngineerNotiSettingsScreen } from "../components/EngineerNotiSettingsScreen.jsx";
import { EngineerRegionsScreen } from "../components/EngineerRegionsScreen.jsx";
import { EngineerRegionChangeRequestScreen } from "../components/EngineerRegionChangeRequestScreen.jsx";
import { EngineerNewAssignCallScreen } from "../components/EngineerNewAssignCallScreen.jsx";
import { EngineerNewAssignDetailScreen } from "../components/EngineerNewAssignDetailScreen.jsx";

const NOW = "10:00";

// V13-FINAL — 흰 SVG 아이콘 상수 (전역)
export const ICON_PHONE_WHITE = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="#fff" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

export const ICON_BOLT_WHITE = (
  <svg width="14" height="14" viewBox="0 0 24 24"
       fill="#fff" stroke="#fff" strokeWidth="1" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

// V13-FINAL2-fix1 — catch #9 진행중 카드 강화 (전화/길찾기 SVG)
const PhoneSvgColored = ({ color = "currentColor" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const NavSvgColored = ({ color = "currentColor" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
  </svg>
);

// catch #9 — 길찾기 (카카오맵 우선 → 웹 fallback)
function openMapForTask(task) {
  const address = encodeURIComponent(task.fullAddress || task.address || "");
  if (!address) return;
  const webUrl = `https://map.kakao.com/?q=${address}`;
  window.open(webUrl, "_blank");
}

function makeTel(phone) {
  if (phone) window.location.href = `tel:${phone}`;
}

// 시트 데이터 → INITIAL_TASKS 형식 변환
// 2026-05-11 — 약속대기 매핑 제거 / status 값 그대로 catch
function convertSheetTask(s) {
  // 시트 status → 화면 status 매핑 (status 변환 X / 그대로 catch)
  const statusMap = {
    "배정완료": "확정",
    "확정": "확정",
    "진행중": "진행중",
    "완료": "완료",
  };
  
  // ISO datetime → "YYYY-MM-DD"
  const toDate = v => {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  
  // ISO datetime → "HH:MM"
  const toTime = v => {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  
  const scheduledDate = toDate(s.scheduledAt);
  const scheduledTime = toTime(s.scheduledAt);
  const requestedDate = toDate(s.requestedDate);
  
  return {
    id: s.taskId,
    time: scheduledTime,
    endTime: scheduledTime ? `${String((parseInt(scheduledTime.split(':')[0])+1)%24).padStart(2,'0')}:${scheduledTime.split(':')[1]}` : null,
    duration: scheduledTime ? "1h" : null,
    address: s.address || "",
    fullAddress: s.address || "",
    customer: s.customer || "고객",
    phone: s.phone || "",
    workType: s.summary || "작업",
    appliance: "기종",
    qty: s.totalQty || 1,
    status: statusMap[s.status] || s.status || "미배정",
    icon: Wrench,
    distance: "—",
    travelTime: "—",
    productPrice: s.estimateTotal || 0,
    travelFee: s.travelFee || 0,
    extraFee: s.extraFee || 0,
    extraReason: s.extraReason || "",
    commissionRate: 40,
    commission: Math.floor((s.estimateTotal || 0) * 0.4),
    engineerNet: Math.floor((s.estimateTotal || 0) * 0.6),
    requestNote: s.requestNote || "",
    happycallMemo: "",
    channel: s.channel || "—",
    receivedAt: toDate(s.receivedAt) || "",
    requestedDate: requestedDate || "",
    requestedTime: s.requestedTime || "",
    scheduledDate: scheduledDate,
    scheduledTime: scheduledTime,
    workMemo: s.workMemo || "",
    beforePhoto: false,
    afterPhoto: false,
    startedAt: toTime(s.startedAt),
    completedAt: toTime(s.completedAt),
    scheduleHistory: [],
  };
}
// Step 5-7-E — ACTION_ALERTS 운영/시뮬 분기 (운영 = 빈 배열 / 시뮬 = 옛 카드 3개)
const _ACTION_ALERTS_MOCK = [
  { id: "new", type: "count", label: "새 배정", count: 1, sublabel: "신규 · 미수락", icon: Bell, urgent: true },
  { id: "report", type: "count", label: "미보고", count: 1, sublabel: "사진 미제출", icon: Camera, urgent: true },
  { id: "settlement", type: "money", label: "오늘 정산", amount: 280000, sublabel: "순수익 (수수료 제외)", icon: Wallet, urgent: false },
];
const ACTION_ALERTS = ENABLE_MOCK ? _ACTION_ALERTS_MOCK : [];

// Step 5-7-B — 정산 데이터 0건 처리 (운영 시작 = 깨끗한 상태)
// 시트 양방향 sync 데이터로 교체 / 사용자가 새 작업 박을 때까지 빈 상태
// SettlementScreen에 fallback UI 박혀 0건 일 때 친절한 안내 표시
const SETTLEMENT_DATA = {
  today: {
    netIncome: 0,
    completedCount: 0,
    avgPerJob: 0,
    fieldCollection: { received: 0, sentToCompany: 0, myIncome: 0, count: 0 },
    companySettlement: { gross: 0, commission: 0, myIncome: 0, count: 0, status: "pending" },
  },
  thisMonth: {
    netIncome: 0,
    completedCount: 0,
    avgPerJob: 0,
    fieldCollection: { received: 0, sentToCompany: 0, myIncome: 0, count: 0 },
    companySettlement: { gross: 0, commission: 0, myIncome: 0, count: 0, status: "pending" },
  },
  pending: { amount: 0, count: 0 },
  paid:    { amount: 0, count: 0 },
  history: [],
  recentJobs: [],
};

// Step 5-7-B — 알림 데이터 0건 (운영 시작 = 깨끗한 상태)
// 시트 양방향 sync 또는 푸시 알림 박힐 때까지 빈 배열 / unreadCount=0 / Bell 배지 X
const NOTIFICATIONS = [];

// 직급 시스템
const ENGINEER_RANKS = [
  { id: "intern", name: "수습 프로", icon: "🌱", min: 0, max: 50, color: "#888780" },
  { id: "junior", name: "주임 프로", icon: "🔧", min: 51, max: 150, color: "#378ADD" },
  { id: "senior", name: "대리 프로", icon: "💼", min: 151, max: 300, color: "#00875A" },
  { id: "manager", name: "과장 프로", icon: "🎖️", min: 301, max: 600, color: "#E91860" },
  { id: "director", name: "부장 프로", icon: "👑", min: 601, max: 9999, color: "#BA7517" },
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
    warning: "#FF1B8D", warningBg: "rgba(251, 191, 36, 0.08)", warningBorder: "rgba(251, 191, 36, 0.3)",
    success: "#34D399", successBg: "rgba(52, 211, 153, 0.10)", successBorder: "rgba(52, 211, 153, 0.3)",
    isLight: false,
  },
  light: {
    name: "☀️ 라이트", icon: Sun,
    bg: "#FAFAFA", bgElevated: "#FFFFFF", bgInset: "#F4F4F5",
    border: "rgba(0, 0, 0, 0.05)", borderStrong: "rgba(0, 0, 0, 0.09)",
    text: "#0A0A0A", textSecondary: "#404040", textMuted: "#737373", textDim: "#A3A3A3",
    accent: "#E91860", accentBg: "rgba(233, 24, 96, 0.06)",
    warning: "#FF1B8D", warningBg: "rgba(217, 119, 6, 0.06)", warningBorder: "rgba(217, 119, 6, 0.22)",
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
                fontFamily: "inherit",
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
                fontFamily: "inherit",
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
                cursor: "pointer", fontFamily: "inherit",
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
                fontFamily: "inherit",
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

function findNextTask(tasks) {
  const inProgress = tasks.find(x => x.status === "진행중");
  if (inProgress) return inProgress;
  
  const confirmed = tasks.filter(x => x.status === "확정");
  if (confirmed.length > 0) {
    const sorted = [...confirmed].sort((a, b) => {
      const ta = (a.time || a.scheduledTime || "99:99");
      const tb = (b.time || b.scheduledTime || "99:99");
      return ta.localeCompare(tb);
    });
    return sorted[0];
  }
  
  const waiting = tasks.find(x => x.status === "미배정");
  if (waiting) return waiting;
  
  return null;
}

// V13-1 — 진행 시간 포맷 (시작 시각 → "1시간 5분 진행")
function formatProgress(startedAt) {
  if (!startedAt) return "";
  // startedAt 형식: "09:05" (시각 문자열)
  const [hStr, mStr] = String(startedAt).split(":");
  const startMin = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);
  const [hNow, mNow] = NOW.split(":");
  const nowMin = (parseInt(hNow, 10) || 0) * 60 + (parseInt(mNow, 10) || 0);
  const diff = Math.max(0, nowMin - startMin);
  if (diff < 60) return `${diff}분`;
  return `${Math.floor(diff / 60)}시간 ${diff % 60}분`;
}

// V14 — 진행률 (시작/종료 → 0~100%)
function calcProgressPct(startedAt, endTime) {
  if (!startedAt || !endTime) return 0;
  const toMin = (s) => {
    const [h, m] = String(s).split(":");
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
  };
  const startMin = toMin(startedAt);
  const endMin   = toMin(endTime);
  const nowMin   = toMin(NOW);
  if (endMin <= startMin) return 0;
  const pct = ((nowMin - startMin) / (endMin - startMin)) * 100;
  return Math.max(0, Math.min(100, pct));
}

// V14 v8 — 시간 헬퍼 (사장님 spec '시작까지 N분' / '완료까지 N분')
function getMinutesUntilTime(timeStr, now) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const target = new Date(now);
  target.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return Math.round((target - now) / 60000);
}

function formatMinutesLabel(min) {
  if (min == null) return "";
  if (min <= 0) return "지금";
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? `${h}시간` : `${h}시간 ${r}분`;
}

// V14 v8 — 진행 카드 (사장님 spec '가장 가까운 작업')
// 모드: 진행 중 (now >= start && now < end) / 다음 작업 (시작 전)
// 30분 이내 시작 → 핑크 강조 / 진행 중 → 펄스 + 완료 보고 버튼
function NextWorkCard({ work, now, onClick, onCompleteReport }) {
  if (!work) return null;
  const startTime = work.scheduledTime || work.time || null;
  const endTime   = work.endTime || null;
  const startMin  = getMinutesUntilTime(startTime, now);
  const endMin    = getMinutesUntilTime(endTime, now);
  const isInProgress = work.status === "진행중"
    || (startMin !== null && startMin <= 0 && endMin !== null && endMin > 0);
  const isImminent = !isInProgress
    && startMin !== null && startMin > 0 && startMin <= 30;

  const accent = "#FF1B8D";
  const cardBg = (isInProgress || isImminent)
    ? "rgba(255,27,141,0.06)"
    : "var(--card-bg)";
  const cardBorder = (isInProgress || isImminent)
    ? "rgba(255,27,141,0.30)"
    : "var(--border)";

  const headerIcon  = isInProgress ? "⚡" : "📍";
  const headerLabel = isInProgress ? "진행 중" : "다음 작업";
  const subLabel = (() => {
    if (isInProgress) {
      if (endMin == null)    return "시간 미정";
      if (endMin <= 0)       return "마감 시간 지남";
      return `완료까지 ${formatMinutesLabel(endMin)}`;
    }
    if (startMin == null) return "시간 미정";
    if (startMin <= 0)    return "지금 시작 시간";
    return `시작까지 ${formatMinutesLabel(startMin)}`;
  })();

  return (
    <div
      onClick={() => onClick && onClick(work.id)}
      className={isInProgress ? "clickable pulse-subtle" : "clickable"}
      style={{
        position: "relative",
        margin: "0 16px 14px",
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 18,
        padding: "16px 16px 16px 22px",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      {/* 좌측 4px 핑크 바 */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 4,
        background: accent,
      }}/>

      {/* 헤더: 아이콘 + 라벨 / 분 카운트다운 */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 10,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: accent,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <span>{headerIcon}</span>
          <span>{headerLabel}</span>
        </span>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: (isInProgress || isImminent) ? accent : "var(--text-secondary)",
        }}>
          {subLabel}
        </span>
      </div>

      {/* 시간 (큰 22px) + 종료 시간 */}
      {startTime && (
        <div style={{
          display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6,
        }}>
          <span style={{
            fontSize: 22, fontWeight: 800,
            color: "var(--text-primary)",
            fontFamily: "inherit",
            letterSpacing: "-0.5px",
          }}>
            {startTime}
          </span>
          {endTime && (
            <span style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>
              ~ {endTime}
            </span>
          )}
        </div>
      )}

      {/* 고객명 */}
      <div style={{
        fontSize: 17, fontWeight: 700,
        color: "var(--text-primary)",
        marginBottom: 4,
      }}>
        {work.customer || "—"}
      </div>

      {/* 작업 종류 + N 마크 (유솔N 세척만) + 기종 + 수량 */}
      <div style={{
        fontSize: 13, color: "var(--text-secondary)",
        fontWeight: 600, marginBottom: 6,
        display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
      }}>
        <ServiceTypeIcon workType={work.workType} size={13} showLabel={true}/>
        {(work.client === '유솔홈케어 N' || work.principalId === 'usol_n') && (work.workType || '').includes('세척') && (
          <span style={{
            background: '#03C75A', color: 'white',
            fontSize: 9, padding: '2px 5px',
            borderRadius: 4, fontWeight: 800,
          }}>N</span>
        )}
        <span style={{ color: "var(--text-tertiary)" }}>·</span>
        <span>{work.appliance || "—"}{work.qty ? ` ×${work.qty}` : ""}</span>
      </div>

      {/* 주소 (1줄 ellipsis) */}
      <div style={{
        fontSize: 13, color: "var(--text-secondary)",
        fontWeight: 600,
        marginBottom: isInProgress ? 12 : 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        📍 {work.fullAddress || work.address || "—"}
      </div>

      {/* 진행 중 모드: 완료 보고 버튼 (큰 핑크) */}
      {isInProgress && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onCompleteReport) onCompleteReport(work.id);
            else if (onClick)     onClick(work.id);
          }}
          style={{
            width: "100%",
            padding: 14,
            background: accent,
            border: "none",
            borderRadius: 12,
            color: "#fff",
            fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            marginTop: 4,
          }}
        >
          ✓ 완료 보고
        </button>
      )}
    </div>
  );
}

// V13-1 — 일정 상태 알약 (다음 일정 카드용)
function StatusPill({ status }) {
  const map = {
    "진행중":   { label: "진행중",  bg: "rgba(255,27,141,0.15)", color: "#FF1B8D" },
    "확정":     { label: "다음",    bg: "rgba(255,255,255,0.10)", color: "var(--text-primary)" },
    "미배정": { label: "약속미정", bg: "rgba(255,179,0,0.20)",  color: "#FFB300" },
    "완료":     { label: "완료",    bg: "rgba(0,135,90,0.20)",   color: "#00875A" },
  };
  const cfg = map[status] || map["확정"];
  return (
    <div style={{
      background: cfg.bg, color: cfg.color,
      padding: "3px 8px", borderRadius: 12,
      fontSize: 9, fontWeight: 700,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </div>
  );
}

// V13-1 — 오늘 화면 재설계 (영역 5)
// 1. 인사 + 한 줄 요약
// 2. 진행중 박스 (조건부)
// 3. 수락 대기 박스 (조건부)
// 4. 새 배정 박스 (조건부)
// 5. 다음 일정 (시간순)
function MainScreen({
  t, tasks, user,
  onTaskClick,
  onClickAcceptanceList,
  onClickNewAssignmentList,
  onClickUsolN,
  onClickTomorrow,
  onClickCalendar,
  onCompleteReport,
  pendingAcceptances = [],
  newAssignmentsOverride,
  usolNTotal = 0,
  usolNPayDate = "",
}) {
  const isDark = useIsDark();
  // V14 v6 — 실시간 (Asia/Seoul) 1분마다 자동 업데이트
  function buildNowLabel() {
    const d = new Date();
    const dayShort = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
    const month    = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric" });
    const day      = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", day:   "numeric" });
    const time     = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
    return `${dayShort} · ${month} ${day} · ${time}`;
  }
  const [nowLabel, setNowLabel] = useState(() => buildNowLabel());
  // V14 v8 — Date 객체 (NextWorkCard 분 카운트다운에 사용 / 1분마다 업데이트)
  const [nowDate, setNowDate] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowLabel(buildNowLabel());
      setNowDate(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const activeTask = tasks.find(x => x.status === "진행중") || null;

  // V14 v6 — 오늘 모두 완료 catch (사장님 spec 'allDone 카드')
  const todayStrLocal = new Date().toISOString().slice(0, 10);
  const todayTasksLocal = tasks.filter(t => t.scheduledDate === todayStrLocal);
  const allDoneToday = !activeTask
    && todayTasksLocal.length > 0
    && todayTasksLocal.every(t => t.status === "완료");
  const todayEarningLocal = todayTasksLocal
    .filter(t => t.status === "완료")
    .reduce((s, t) => s + (t.engineerNet || 0), 0);

  // V14 — 새 배정 = 배정됐는데 일정 미정 (extraAssignments 합산은 EngineerApp에서 처리)
  // 2026-05-10 명세 (이행 기간): "배정" + 옛 "확정"+일정X 둘 다 catch
  const newAssignments = newAssignmentsOverride || tasks.filter(x =>
    x.status === "배정" ||
    (x.status === "확정" && (!x.scheduledDate || !x.scheduledTime))
  );

  // V14 v8 — 오늘 남은 일정 (사장님 spec '미래 일정 X / 캘린더 탭에서')
  // 진행중 + 확정 (오늘만 / 시간 박혀있는 작업만) 시간순
  // 2026-05-10 명세 — "확정" + scheduledTime 있는 작업만 일정 확정 카드로 분류
  // (배정만 박힌 작업은 newAssignments / 일정 미박은 확정도 newAssignments)
  const todayRemaining = todayTasksLocal
    .filter(x => x.status !== "완료" && !!x.scheduledTime && (x.status === "확정" || x.status === "진행중"))
    .sort((a, b) => (a.scheduledTime || a.time || "99:99").localeCompare(b.scheduledTime || b.time || "99:99"));

  // V14 v8 — 진행 카드 = 가장 가까운 미완료 (진행중 우선, 다음 확정)
  const nextWork = activeTask || todayRemaining.find(x => x.status === "확정") || null;

  // 다음 일정 리스트 = 진행 카드에 들어간 작업은 제외 (중복 제거)
  const upcomingTasks = todayRemaining.filter(x => !nextWork || x.id !== nextWork.id);

  // 오늘 0건 (진행중도 확정도 약속대기도 X)
  const noTaskToday = !activeTask
    && todayTasksLocal.length === 0
    && newAssignments.length === 0;

  // 한 줄 요약 — V14: 작업 종류별 (도구 준비 가이드)
  // Phase 4-G 보완 — 헤더 "오늘 N건" 정확화 (todayTasksLocal 기준 / 미래 일정 미포함)
  const counts = {
    inProgress: tasks.filter(x => x.status === "진행중").length,
    confirmed:  tasks.filter(x => x.status === "확정").length,
    waiting:    newAssignments.length,
  };
  const total = todayTasksLocal.length;
  const workTypeCounts = {
    세척:     todayTasksLocal.filter(x => x.workType === "세척"     && x.status !== "완료").length,
    냉매충전: todayTasksLocal.filter(x => x.workType === "냉매충전" && x.status !== "완료").length,
  };

  return (
    <div style={{
      fontFamily: "'Pretendard', -apple-system, sans-serif",
      background: "var(--bg-primary)",
      minHeight: "100vh", paddingBottom: 100,
      color: "var(--text-primary)",
    }}>
      <style>{`
        
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseSubtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .pulse-subtle { animation: pulseSubtle 2s ease-in-out infinite; }
        .mono { font-family: inherit; }
        .clickable { cursor: pointer; transition: transform 0.15s, opacity 0.15s; }
        .clickable:active { transform: scale(0.98); opacity: 0.8; }
        input, textarea { font-family: inherit; }
      `}</style>

      {/* 1. 인사 + 한 줄 요약 */}
      <div style={{ padding: "16px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 6,
        }}>
          <span className="mono" style={{
            fontSize: 11, color: "var(--text-secondary)",
            letterSpacing: 1.5, fontWeight: 600,
          }}>
            {/* V14 v6 — 실시간 (Asia/Seoul, 1분마다 자동 업데이트) */}
            {nowLabel}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-primary)" }}>
            <span className="pulse-subtle" style={{
              display: "inline-block", width: 6, height: 6,
              borderRadius: "50%", background: "#FF1B8D",
              marginRight: 4, verticalAlign: "middle",
            }}/>
            실시간
          </span>
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}>
          안녕하세요, {user?.name || "프로"}님
        </div>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          marginTop: 4,
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
        }}>
          <span>오늘 {total}건</span>
          {workTypeCounts.세척 > 0 && (
            <>
              <span style={{ color: "var(--text-tertiary)" }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <ServiceTypeIcon workType="세척" size={12} showLabel={false}/>
                <span style={{ color: "var(--cleaning-text)", fontWeight: 600 }}>세척 {workTypeCounts.세척}</span>
              </span>
            </>
          )}
          {workTypeCounts.냉매충전 > 0 && (
            <>
              <span style={{ color: "var(--text-tertiary)" }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <ServiceTypeIcon workType="냉매충전" size={12} showLabel={false}/>
                <span style={{ color: "var(--refrig-text)", fontWeight: 600 }}>냉매충전 {workTypeCounts.냉매충전}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* V14 v6 — 오늘 수고하셨습니다 카드 (검정 + 핑크 / 사장님 spec) */}
      {allDoneToday && (
        <div style={{
          margin: "0 16px 14px",
          background: "#1A1A1A",
          borderRadius: 18,
          padding: "22px 20px",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}>
          {/* 날짜 라인 (핑크) */}
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: "#FF1B8D",
            marginBottom: 10,
            letterSpacing: 0.3,
          }}>
            {workDateLabel(todayStrLocal)}
          </div>
          {/* 헤드라인 */}
          <div style={{
            fontSize: 22, fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.4px",
            marginBottom: 6,
          }}>
            🎉 오늘 수고하셨습니다
          </div>
          {/* 통계 */}
          <div style={{
            fontSize: 13, color: "#C8C8C8",
            fontWeight: 600, marginBottom: 18,
          }}>
            {todayTasksLocal.length}건 완료 ·{" "}
            <span style={{ color: "#FF1B8D", fontWeight: 700 }}>
              오늘 번 돈 ₩{todayEarningLocal.toLocaleString("ko-KR")}
            </span>
          </div>
          {/* 내일 일정 보기 (핑크 풀) — V14 v7: 캘린더 일별 뷰 라우팅 */}
          <button
            onClick={onClickTomorrow}
            style={{
              width: "100%",
              padding: 14,
              background: "#FF1B8D",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            📅 내일 일정 보기 →
          </button>
        </div>
      )}

      {/* V14 v8 — 진행 카드 (사장님 spec '가장 가까운 작업') */}
      {/* 진행중 우선 → 다음 확정 / 알림 카드 위 / 30분 이내 임박 → 핑크 강조 */}
      {/* Phase 4-G — nextWork 없고 noTaskToday면 격려 박스 (메인 휑함 해결) */}
      {nextWork ? (
        <NextWorkCard
          work={nextWork}
          now={nowDate}
          onClick={onTaskClick}
          onCompleteReport={onCompleteReport}
        />
      ) : noTaskToday ? (
        <EncourageCard
          icon="🌅"
          title="오늘도 화이팅!"
          subtitle1="좋은 하루 보내세요"
          subtitle2="내일 이후 일정은 캘린더에서 확인하세요"
          onCalendarClick={onClickCalendar || onClickTomorrow}
        />
      ) : null}

      {/* 3. 수락 대기 배너 (V14 정제 — 흰 카드 + 좌측 4px 핑크 바 + 노랑 박스) */}
      {pendingAcceptances.length > 0 && (() => {
        const workTypes = [...new Set(pendingAcceptances.map(p => p.workType).filter(Boolean))];
        const workTypeLabel = workTypes.length === 1 ? workTypes[0] : "";
        const title = workTypeLabel ? `${workTypeLabel} 수락 대기` : "수락 대기";
        return (
          <AlertBanner
            onClick={onClickAcceptanceList}
            iconBg="var(--banner-yellow-bg)"
            icon="⚡"
            title={title}
            subText={`${pendingAcceptances.length}건 · 응답 필요`}
            subColor="var(--banner-yellow-text)"
          />
        );
      })()}

      {/* 4. 새 배정 배너 (V14 정제 — 흰 카드 + 좌측 4px 핑크 바 + 핑크 박스) */}
      {newAssignments.length > 0 && (
        <AlertBanner
          onClick={onClickNewAssignmentList}
          iconBg="var(--banner-pink-bg)"
          icon="🔔"
          title="새 배정"
          subText={`${newAssignments.length}건 · 확인 필요`}
          subColor="var(--banner-pink-text)"
        />
      )}

      {/* V14 v6 — 유솔N 누적 카드 (사장님 spec) */}
      {usolNTotal > 0 && (
        <div onClick={onClickUsolN} className="clickable" style={{
          margin: "0 16px 12px",
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          padding: "14px 14px 14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: 4, background: "#03C75A",
          }}/>
          <div style={{
            width: 40, height: 40,
            background: "#03C75A", color: "#fff",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 800, flexShrink: 0,
          }}>
            N
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, color: "var(--text-secondary)",
              fontWeight: 700, marginBottom: 2,
            }}>
              유솔N 받을 돈
            </div>
            <div style={{
              fontSize: 17, color: "var(--text-primary)",
              fontWeight: 700,
            }}>
              ₩{usolNTotal.toLocaleString("ko-KR")} 누적
            </div>
            <div style={{
              fontSize: 11, color: "var(--text-tertiary)",
              marginTop: 2, fontWeight: 600,
            }}>
              {usolNPayDate || "다음 달 15일"} 입금 예정
            </div>
          </div>
          <span style={{ color: "var(--text-tertiary)", fontSize: 18 }}>›</span>
        </div>
      )}

      {/* V14 v8 — 오늘 남은 일정 (사장님 spec '미래 일정 X / 캘린더 탭에서') */}
      {/* allDone = 수고 카드 / 0건 = 캘린더 안내 카드 / 그 외 = 오늘 남은 일정 리스트 */}
      {!allDoneToday && !noTaskToday && (
      <div data-next-schedule="true" style={{ padding: "0 16px" }}>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          marginBottom: 10, paddingLeft: 4, fontWeight: 700,
        }}>
          📅 오늘 남은 일정 ({upcomingTasks.length}건)
        </div>

        {upcomingTasks.length === 0 ? (
          <div style={{
            padding: 22, textAlign: "center",
            color: "var(--text-tertiary)", fontSize: 13,
            background: "var(--bg-secondary)",
            borderRadius: 10,
          }}>
            진행 카드 외 남은 일정 없음
          </div>
        ) : (
          upcomingTasks.map(task => (
            <div
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              className="clickable"
              style={{
                display: "flex", alignItems: "center",
                padding: 14,
                background: "var(--bg-secondary)",
                borderRadius: 10,
                marginBottom: 8,
                cursor: "pointer",
              }}
            >
              <div style={{ width: 64 }}>
                <div className="mono" style={{
                  fontSize: 17, color: "var(--text-primary)",
                  fontWeight: 800,
                }}>
                  {task.time || task.scheduledTime || "—"}
                </div>
                {task.duration && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {task.duration}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, padding: "0 10px", minWidth: 0 }}>
                <div style={{
                  fontSize: 16, color: "var(--text-primary)", fontWeight: 700,
                  display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
                }}>
                  <span>{task.customer}</span>
                  <span style={{
                    fontSize: 12, color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}>
                    {task.address}
                  </span>
                </div>
                <div style={{
                  fontSize: 13, marginTop: 4,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <ServiceTypeIcon workType={task.workType} size={13} showLabel={true}/>
                  {(task.client === '유솔홈케어 N' || task.principalId === 'usol_n') && (task.workType || '').includes('세척') && (
                    <span style={{
                      background: '#03C75A', color: 'white',
                      fontSize: 9, padding: '2px 5px',
                      borderRadius: 4, fontWeight: 800,
                    }}>N</span>
                  )}
                  <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>
                    {task.appliance ? task.appliance : ""}{task.qty ? ` ×${task.qty}` : ""}
                  </span>
                </div>
              </div>
              <span style={{ fontSize: 18, color: "var(--text-secondary)" }}>›</span>
            </div>
          ))
        )}

        {/* 미래 일정은 캘린더 탭 안내 */}
        <button
          onClick={onClickTomorrow}
          className="clickable"
          style={{
            width: "100%",
            padding: 12,
            marginTop: 6,
            background: "transparent",
            border: "1px dashed var(--border)",
            borderRadius: 10,
            color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}
        >
          📅 내일 이후 일정 → 캘린더 탭
        </button>
      </div>
      )}

      {/* V14 Phase 4-G 보완 — 옛 "오늘 일정 없습니다" 박스는 격려 박스 (라인 1044 분기)로 통합됨 */}
    </div>
  );
}

// V14 Phase 4-G 보완 — 격려 박스 (nextWork 없고 noTaskToday일 때 / "오늘 일정 없습니다" 박스 통합)
// 디자인: 진행카드 톤 (var(--card-bg) / borderRadius 18) + 캘린더 버튼 통합
function EncourageCard({ icon, title, subtitle1, subtitle2, onCalendarClick }) {
  return (
    <div style={{
      margin: "0 16px 14px",
      padding: "24px 18px",
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 18,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
        {title}
      </div>
      {subtitle1 && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>
          {subtitle1}
        </div>
      )}
      {subtitle2 && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: onCalendarClick ? 16 : 0 }}>
          {subtitle2}
        </div>
      )}
      {onCalendarClick && (
        <button
          onClick={onCalendarClick}
          style={{
            padding: "12px 24px",
            background: "#FF1B8D",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          📅 캘린더 보기
        </button>
      )}
    </div>
  );
}

// V14 — 알림 배너 (수락 대기 / 새 배정)
// 흰 카드 + 좌측 4px 핫핑크 바 + 컬러 박스 + 텍스트 + 화살표
function AlertBanner({ onClick, iconBg, icon, title, subText, subColor }) {
  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        position: "relative",
        margin: "0 16px 8px",
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "16px 16px 16px 20px",
        cursor: "pointer",
        overflow: "hidden",
        display: "flex", alignItems: "center", gap: 14,
      }}
    >
      {/* 좌측 4px 핫핑크 바 */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 4,
        background: "#FF1B8D",
      }}/>

      {/* 컬러 박스 */}
      <div style={{
        width: 40, height: 40,
        borderRadius: 11,
        background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        fontSize: 20,
      }}>
        {icon}
      </div>

      {/* 텍스트 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 17, fontWeight: 600,
          color: "var(--text-primary)",
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: subColor || "var(--text-secondary)",
          marginTop: 2,
        }}>
          {subText}
        </div>
      </div>

      {/* 화살표 */}
      <span style={{
        fontSize: 18, color: "var(--text-secondary)",
        flexShrink: 0,
      }}>
        ›
      </span>
    </div>
  );
}

function ActionAlert({ t, alert, delay, onClick }) {
  const Icon = alert.icon;
  const isMoney = alert.type === "money";
  const hasItems = isMoney ? alert.amount > 0 : alert.count > 0;
  const isUrgent = alert.urgent && hasItems;
  const isClickable = !!onClick;
  return (
    <div 
      className={isClickable ? "card-fade clickable" : "card-fade"}
      onClick={onClick || undefined}
      style={{ background: t.bgElevated, borderRadius: 12, padding: "14px", position: "relative", animationDelay: `${delay}ms`, cursor: isClickable ? "pointer" : "default" }}
    >
      {isUrgent && <span className="pulse-dot" style={{ position: "absolute", top: 10, right: 10, width: 6, height: 6, background: t.accent, borderRadius: "50%" }}/>}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
        <Icon size={11} style={{ color: t.textMuted }}/>
        <span style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>{alert.label}</span>
      </div>
      {isMoney ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>₩</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: t.text }}>{alert.amount.toLocaleString()}</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
          <span className="mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: hasItems ? t.text : t.textDim }}>{alert.count}</span>
          <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>건</span>
        </div>
      )}
      <div style={{ fontSize: 9, color: t.textDim, fontWeight: 600, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{alert.sublabel}</div>
    </div>
  );
}

function getIconForTask(workType) {
  if (!workType) return Wrench;
  if (workType.includes("세척") || workType.includes("분해세척")) return Snowflake;
  if (workType.includes("냉매") || workType.includes("가스")) return Zap;
  if (workType.includes("설치") || workType.includes("이전설치")) return Settings;
  if (workType.includes("점검") || workType.includes("수리")) return Wrench;
  return Wrench;
}

function CompactTaskCard({ task, t, index, onClick }) {
  const Icon = getIconForTask(task.workType);
  const isInProgress = task.status === "진행중";
  const isConfirmed = task.status === "확정";
  const isWaiting = task.status === "미배정";
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
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2, fontWeight: 700 }}>{task.requestedTime || "—"} 희망</div>
            </>
          ) : (
            <>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{task.time || "—"}</div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2, fontWeight: 700 }}>{task.duration || ""}</div>
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
            <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 700 }}>{task.workType} · {task.appliance} ×{task.qty}</span>
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
  const Icon = getIconForTask(task.workType);
  const isInProgress = task.status === "진행중";
  const isConfirmed = task.status === "확정";
  const isWaiting = task.status === "미배정";
  const isCompleted = task.status === "완료";
  const showPhotoSection = isCompleted;
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
    // 2026-05-10 명세 — N열(scheduledAt) ISO 명시 (GAS 합성 의존 X)
    onUpdate(task.id, {
      status: "확정",
      scheduledDate: scheduleDate,
      scheduledTime: scheduleTime,
      scheduledAt: `${scheduleDate}T${scheduleTime}:00`,
      time: scheduleTime,
      endTime: addHours(scheduleTime, 1),
      duration: "1h",
    });
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
    <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: editingSchedule ? 30 : 130, color: t.text }}>
      <style>{`
        
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        .mono { font-family: inherit; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .section { animation: slideIn 0.3s ease-out backwards; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: t.bg, borderBottom: `1px solid ${t.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="clickable" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8 }}>
          <ArrowLeft size={18}/>
          <span style={{ fontSize: 14, fontWeight: 700 }}>뒤로</span>
        </div>
        <span className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>{task.id}</span>
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
              <span style={{ fontSize: 18, color: t.textSecondary, fontWeight: 700 }}>{task.requestedTime}</span>
            </div>
            <div style={{ fontSize: 12, color: t.accent, fontWeight: 700 }}>⚠️ 고객님과 통화 후 정확한 시간을 협의해주세요</div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>{task.time}</span>
              <span style={{ fontSize: 16, color: t.textMuted, fontWeight: 700 }}>~ {task.endTime}</span>
            </div>
            {isInProgress && task.startedAt && <div style={{ fontSize: 12, color: t.warning, fontWeight: 700, marginTop: 4 }}>🟡 {formatTimeOnly(task.startedAt)} 시작 · 작업 중</div>}
            {isCompleted && <div style={{ fontSize: 12, color: t.success, fontWeight: 700, marginTop: 4 }}>✅ {formatTimeOnly(task.completedAt)} 완료</div>}
            {!isInProgress && !isCompleted && <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 600 }}>소요 시간 약 {task.duration}</div>}
            
            {hasScheduleChange && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: t.warningBg, border: `1px solid ${t.warningBorder}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <History size={11} style={{ color: t.warning }}/>
                <span style={{ fontSize: 11, color: t.warning, fontWeight: 700 }}>{task.scheduleHistory.length}회 일정 변경됨</span>
              </div>
            )}

            {/* 진행중/완료에 일정 변경 안내 */}
            {(isInProgress || isCompleted) && (
              <div style={{ marginTop: 10, fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
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
            <DragTimePicker t={t} value={newTime} onChange={setNewTime} label="새 시간 선택"/>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(t)}>📝 변경 사유 (선택)</label>
            <input type="text" placeholder="예: 고객 일정 변경 요청, 다른 작업 충돌 등" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} style={inputStyle(t)}/>
          </div>

          {canConfirmChange && (
            <div style={{ background: t.bgElevated, border: `1px solid ${t.accent}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>✓ 변경 미리보기</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: t.textMuted, textDecoration: "line-through" }}>{formatHistoryTime(task.scheduledDate, task.scheduledTime)}</span>
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
          <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 600, lineHeight: 1.5 }}>{task.fullAddress}</div>
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
            <div className="mono" style={{ fontSize: 13, color: t.textSecondary, fontWeight: 600, marginTop: 2 }}>{task.phone}</div>
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
            <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>📝 관리자 메모</div>
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
            <DragTimePicker t={t} value={scheduleTime} onChange={setScheduleTime} label="약속 시간 선택"/>
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
                <span className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, textDecoration: "line-through" }}>{formatHistoryTime(entry.from.date, entry.from.time)}</span>
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
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>운영팀에 바로 연락 가능</div>
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
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>작업이 어려운 상황인가요?</span>
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
    <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 130, color: t.text }}>
      <style>{`
        .mono { font-family: inherit; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .section { animation: slideIn 0.3s ease-out backwards; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: t.bg, borderBottom: `1px solid ${t.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="clickable" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
          <ArrowLeft size={18}/><span style={{ fontSize: 14, fontWeight: 700 }}>취소</span>
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
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>※ 두 사진 모두 업로드 (위 박스 탭하면 시뮬됨)</div>
      </Section>

      <Section t={t} title="현장 추가금" icon={<Plus size={13}/>} delay={100}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle(t)}>💰 추가 금액 (선택)</label>
          <div style={{ position: "relative" }}>
            <input type="text" inputMode="numeric" placeholder="0" value={extraFee ? formatCurrency(extraFee) : ""} onChange={(e) => setExtraFee(e.target.value)} style={{ ...inputStyle(t), paddingLeft: 32, fontFamily: "inherit" }}/>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: t.textMuted, fontWeight: 700 }}>₩</span>
            {extraFee && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: t.textMuted, fontWeight: 700 }}>원</span>}
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
      <span style={{ color: t.textMuted, fontWeight: 600 }}>{label}</span>
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
      {uploaded && <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.7 }}>업로드됨</span>}
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

  // Step 5-7-B — 0건 fallback UI (운영 시작 = 깨끗한 상태)
  // 시트 양방향 sync 데이터 박힐 때까지 친절한 안내 표시
  if (!data || data.completedCount === 0) {
    return (
      <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
        <div style={{ padding: "28px 20px 0" }}>
          <div style={{ marginBottom: 20 }}>
            <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" }}>
              정산
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16 }}>
            내 수익
          </div>
          {/* 기간 토글 — 0건이어도 토글 자체는 보존 */}
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
              }}>{opt.label}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <Wallet size={48} style={{ color: t.textMuted, opacity: 0.5, margin: "0 auto 16px" }}/>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 10 }}>
            아직 정산 데이터가 없어요
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
            작업 완료 후 정산 데이터가 자동으로 추가됩니다
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
      <style>{`
        
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .mono { font-family: inherit; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      {/* 헤더 */}
      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" }}>
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
            <span style={{ fontSize: 14, color: t.textMuted, fontWeight: 700 }}>₩</span>
            <span className="mono" style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: t.accent }}>
              {data.netIncome.toLocaleString()}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
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
              <span style={{ fontSize: 11, color: t.success, fontWeight: 700 }}>₩</span>
              <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: t.success }}>
                {data.fieldCollection.received.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>
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
              <span style={{ fontSize: 11, color: t.accent, fontWeight: 700 }}>₩</span>
              <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: t.accent }}>
                {data.companySettlement.gross.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>
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
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>
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
          <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, marginBottom: 3 }}>
            {isField ? "고객 수금" : "상품 금액"}
          </div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
            ₩{job.grossAmount.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, marginBottom: 3 }}>
            {isField ? "회사 송금" : "수수료"}
          </div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.danger }}>
            −₩{job.commission.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, marginBottom: 3 }}>
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
        {unit === "₩" && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>₩</span>}
        <span className="mono" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: dim ? t.textMuted : t.text }}>
          {value.toLocaleString()}
        </span>
        {unit === "건" && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>건</span>}
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
    <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
      <style>{`
        .mono { font-family: inherit; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" }}>
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
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
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
              fontSize: 10, fontWeight: 700, padding: "5px 8px",
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
    <div style={{ fontFamily: "'Pretendard', sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
      <style>{`
        .mono { font-family: inherit; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .clickable { cursor: pointer; transition: opacity 0.15s; }
        .clickable:active { opacity: 0.7; }
      `}</style>

      {/* 헤더 + 프로필 카드 */}
      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ marginBottom: 20 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" }}>
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
          
          <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 700, marginBottom: 16 }}>
            {PROFILE_DATA.region} · 가입 {PROFILE_DATA.joinDate} ({PROFILE_DATA.yearsAtCompany}년차)
          </div>
          
          {/* 다음 등급 진행률 */}
          {nextRank && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 6 }}>
                <span style={{ color: t.textMuted, fontWeight: 700 }}>
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
              <div style={{ fontSize: 9, color: t.textDim, marginTop: 4, textAlign: "right", fontFamily: "inherit" }}>
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
                <div className="mono" style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>
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
        <ProfileMenuItem t={t} icon={<Bell size={16}/>} label="알림 설정" sublabel="시스템 / 푸시 알림"/>
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
        <div className="mono" style={{ fontSize: 10, color: t.textDim, fontWeight: 600 }}>
          올잇(Ollit) v0.20 · 호칭: 프로님
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
        {unit && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>{unit}</span>}
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
    { id: "calendar", label: "캘린더", icon: Calendar },
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)" }}>
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


// =====================================
// 캘린더 화면 (월별 뷰)
// =====================================

// 시간 포맷 헬퍼 — utils/dateLabel.js의 formatTimeOnly 사용 (이전 inline 정의 제거)

function CalendarScreen({ t, engineerName, tasks }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [offDays, setOffDays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 휴무 데이터 로드
  const loadOffDays = async () => {
    if (!engineerName) return;
    setLoading(true);
    try {
      const result = await getOffDays(engineerName);
      if (result.ok) {
        setOffDays(result.offDays || []);
      }
    } catch (err) {
      console.error('휴무 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadOffDays();
  }, [engineerName]);
  
  // 달력 데이터 생성
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  // 각 날짜의 데이터 (작업 + 휴무)
  const dateMap = {};
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dateMap[dateStr] = { tasks: [], offDays: [] };
  }
  
  // 작업 매핑
  (tasks || []).forEach(task => {
    let dateStr = task.requestedDate || task.scheduledAt || '';
    if (dateStr instanceof Date) {
      dateStr = `${dateStr.getFullYear()}-${String(dateStr.getMonth() + 1).padStart(2, '0')}-${String(dateStr.getDate()).padStart(2, '0')}`;
    }
    if (dateStr && dateMap[dateStr]) {
      dateMap[dateStr].tasks.push(task);
    }
  });
  
  // 다음날 계산 헬퍼
  const nextDateStr = (dateStr) => {
    const dt = new Date(dateStr);
    dt.setDate(dt.getDate() + 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  
  // 날짜 정규화 (timezone-safe)
  const normalizeDate = (dateInput) => {
    if (!dateInput) return '';
    const str = String(dateInput);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str.slice(0, 10);
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  
  // 시간 → 숫자 (parseHour과 동일)
  const _parseH = (timeStr) => {
    const tm = formatTimeOnly(timeStr);
    if (!tm) return null;
    const [h, m] = tm.split(":").map(Number);
    if (isNaN(h)) return null;
    return h + (m || 0) / 60;
  };
  
  // 휴무 매핑 (다음날로 넘어가는 휴무 자동 분할)
  offDays.forEach(off => {
    if (dateMap[normalizeDate(off.date)]) {
      dateMap[normalizeDate(off.date)].offDays.push(off);
    }
    
    // 다음 날로 넘어가는 시간 휴무/개인일정은 다음 날에도 마커 추가
    if (off.type !== '휴무종일' && off.startTime !== '종일' && off.endTime !== '종일') {
      const sH = _parseH(off.startTime);
      const eH = _parseH(off.endTime);
      if (sH !== null && eH !== null && eH < sH) {
        const nd = nextDateStr(normalizeDate(off.date));
        if (dateMap[nd]) {
          dateMap[nd].offDays.push({ ...off, _continuedFromYesterday: true });
        }
      }
    }
  });
  
  // 달력 그리드 생성
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  
  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };
  
  const onDateClick = (day) => {
    if (!day) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
  };
  
  const today = new Date();
  const isToday = (day) => {
    return year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
  };
  
  if (selectedDate) {
    const data = dateMap[selectedDate] || { tasks: [], offDays: [] };
    return (
      <DayDetailScreen 
        t={t}
        date={selectedDate}
        tasks={data.tasks}
        offDays={data.offDays}
        engineerName={engineerName}
        onBack={() => setSelectedDate(null)}
        onDataChange={loadOffDays}
      />
    );
  }
  
  return (
    <div style={{ fontFamily: "'Pretendard', -apple-system, sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
      <div style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" }}>CALENDAR</span>
          <button onClick={() => setShowModal(true)} style={{
            background: t.accent, color: "white", border: "none", borderRadius: 8,
            padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
          }}>
            <Plus size={12}/> 휴무 추가
          </button>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>나의 캘린더</div>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}>
          <button onClick={prevMonth} style={{ background: "transparent", border: "none", padding: 8, cursor: "pointer", color: t.text }}>
            <ChevronLeft size={18}/>
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {year}년 {month + 1}월
          </div>
          <button onClick={nextMonth} style={{ background: "transparent", border: "none", padding: 8, cursor: "pointer", color: t.text }}>
            <ChevronRight size={18}/>
          </button>
        </div>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "0 16px", marginBottom: 4 }}>
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={i} style={{ 
            textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 700,
            color: i === 0 ? "#FF6B6B" : i === 6 ? "#5DA1F5" : t.textMuted 
          }}>{d}</div>
        ))}
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "0 16px", gap: 2 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} style={{ aspectRatio: "1/1.1" }}/>;
          
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const data = dateMap[dateStr] || { tasks: [], offDays: [] };
          const hasTasks = data.tasks.length > 0;
          const hasOffDay = data.offDays.length > 0;
          const offType = hasOffDay ? data.offDays[0].type : null;
          const dow = (startWeekday + day - 1) % 7;
          
          return (
            <button
              key={idx}
              onClick={() => onDateClick(day)}
              style={{
                aspectRatio: "1/1.1",
                background: isToday(day) ? t.accent : t.bgElevated,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                padding: "6px 4px 4px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                fontFamily: "inherit",
                color: isToday(day) ? "white" : (dow === 0 ? "#FF6B6B" : dow === 6 ? "#5DA1F5" : t.text),
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{day}</div>
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                {hasTasks && data.tasks.slice(0, 3).map((_, i) => (
                  <span key={`t${i}`} style={{ 
                    width: 5, height: 5, borderRadius: "50%", 
                    background: isToday(day) ? "white" : t.accent 
                  }}/>
                ))}
                {hasOffDay && (
                  <span style={{ 
                    fontSize: 9, 
                    color: isToday(day) ? "white" : (offType === "개인일정" ? "#5DA1F5" : "#FF6B6B"),
                    fontWeight: 700,
                  }}>
                    {offType === "개인일정" ? "📅" : "✕"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      <div style={{ padding: "16px", marginTop: 8, fontSize: 11, color: t.textMuted, lineHeight: 1.8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.accent }}/>
          <span>회사 작업</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ color: "#FF6B6B", fontWeight: 700 }}>✕</span>
          <span>휴무</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#5DA1F5" }}>📅</span>
          <span>개인 일정</span>
        </div>
      </div>
      
      {loading && (
        <OllitLoader size={28} label="데이터 로딩 중..."/>
      )}
      
      {showModal && (
        <AddOffDayModal
          t={t}
          engineerName={engineerName}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            loadOffDays();
          }}
        />
      )}
    </div>
  );
}

// =====================================
// 일별 상세 화면 (타임라인 v2 - 다음날 분할 처리)
// =====================================
function DayDetailScreen({ t, date, tasks, offDays: initialOffDays, engineerName, onBack, onDataChange }) {
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [offDays, setOffDays] = useState(initialOffDays || []);
  
  const reloadOffDays = async () => {
    if (!engineerName) return;
    try {
      const result = await getOffDays(engineerName);
      if (result.ok) {
        // 이 날짜의 휴무 + 어제 시작해서 이 날로 넘어온 휴무
        const all = result.offDays || [];
        const todayList = all.filter(off => normalizeDate(off.date) === date);
        
        // 어제 휴무 중 다음날로 넘어가는 것
        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        
        const _parseH = (s) => {
          const tm = formatTimeOnly(s);
          if (!tm) return null;
          const [h, m] = tm.split(":").map(Number);
          return isNaN(h) ? null : h + (m || 0) / 60;
        };
        
        const carryOver = all
          .filter(off => normalizeDate(off.date) === yStr && off.type !== '휴무종일' && off.startTime !== '종일')
          .filter(off => {
            const s = _parseH(off.startTime);
            const e = _parseH(off.endTime);
            return s !== null && e !== null && e < s;
          })
          .map(off => ({ ...off, _continuedFromYesterday: true }));
        
        setOffDays([...todayList, ...carryOver]);
      }
    } catch (err) {
      console.error('휴무 로드 실패:', err);
    }
  };
  
  useEffect(() => {
    setOffDays(initialOffDays || []);
  }, [initialOffDays]);
  
  const dateObj = new Date(date);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][dateObj.getDay()];
  
  const handleDelete = async (offId) => {
    if (!confirm("정말 삭제할까요?")) return;
    setDeleting(offId);
    try {
      const result = await deleteOffDay(offId);
      if (result.ok) {
        await reloadOffDays();
        if (onDataChange) onDataChange();
      } else {
        alert("삭제 실패: " + (result.error || ""));
      }
    } catch (err) {
      alert("오류: " + err.message);
    } finally {
      setDeleting(null);
    }
  };
  
  // 날짜 정규화 (timezone-safe)
  const normalizeDate = (dateInput) => {
    if (!dateInput) return '';
    const str = String(dateInput);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str.slice(0, 10);
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  
  const parseHour = (timeStr) => {
    const tm = formatTimeOnly(timeStr);
    if (!tm) return null;
    const [h, m] = tm.split(":").map(Number);
    if (isNaN(h)) return null;
    return h + (m || 0) / 60;
  };
  
  const blocks = [];
  
  // 작업 블록
  tasks.forEach(task => {
    const startStr = task.startTime || task.scheduledAt || '';
    let start = parseHour(startStr);
    if (start === null && task.requestedTime) {
      const rt = String(task.requestedTime);
      if (rt.includes('오전')) start = 10;
      else if (rt.includes('오후')) start = 14;
      else if (rt.includes('저녁')) start = 18;
      else start = 10;
    }
    if (start === null) start = 10;
    
    const duration = 1.5;
    const end = Math.min(start + duration, 24);
    
    blocks.push({
      type: 'task',
      start, end,
      title: task.customer || '고객',
      subtitle: task.summary || task.workType || '',
      detail: task.address || '',
      taskId: task.taskId,
    });
  });
  
  // 휴무 블록 (다음날 분할 처리)
  offDays.forEach(off => {
    if (off.type === '휴무종일') {
      blocks.push({
        type: 'offFull',
        start: 0, end: 24,
        title: '종일 휴무',
        subtitle: off.memo || '',
        offId: off.offId,
      });
      return;
    }
    
    const start = parseHour(off.startTime);
    const end = parseHour(off.endTime);
    if (start === null || end === null) return;
    
    const isPersonal = off.type === '개인일정';
    const blockType = isPersonal ? 'personal' : 'offTime';
    const baseTitle = isPersonal ? '📅 개인 일정' : '🛌 휴무';
    
    if (off._continuedFromYesterday) {
      // 어제부터 이어진 새벽 부분
      blocks.push({
        type: blockType,
        start: 0, end: end,
        title: '🌙 ' + (isPersonal ? '개인 일정 (어제부터)' : '휴무 (어제부터)'),
        subtitle: off.memo || `~${off.endTime}`,
        offId: off.offId,
      });
    } else if (end < start) {
      // 다음날로 넘어가는 휴무 - 오늘 부분만 (start ~ 24:00)
      blocks.push({
        type: blockType,
        start: start, end: 24,
        title: baseTitle + ' (다음날까지)',
        subtitle: off.memo ? `${off.memo} · ~다음날 ${off.endTime}` : `~다음날 ${off.endTime}`,
        offId: off.offId,
      });
    } else if (end > start) {
      // 같은 날 안에서 끝남 (일반)
      blocks.push({
        type: blockType,
        start: start, end: end,
        title: baseTitle,
        subtitle: off.memo || '',
        offId: off.offId,
      });
    }
  });
  
  blocks.sort((a, b) => a.start - b.start);
  
  const fullOff = blocks.find(b => b.type === 'offFull');
  
  // 빈 시간 계산
  const emptySlots = [];
  if (!fullOff) {
    let cursor = 0;
    blocks.forEach(b => {
      if (b.start > cursor) {
        emptySlots.push({ start: cursor, end: b.start });
      }
      cursor = Math.max(cursor, b.end);
    });
    if (cursor < 24) {
      emptySlots.push({ start: cursor, end: 24 });
    }
  }
  
  const HOUR_HEIGHT = 36;
  const totalHours = 24;
  const totalHeight = totalHours * HOUR_HEIGHT;
  
  const COLORS = {
    task:     { bg: t.accent, fg: '#FFFFFF', border: t.accent },
    offFull:  { bg: 'rgba(255,107,107,0.85)', fg: '#FFFFFF', border: '#FF6B6B' },
    offTime:  { bg: 'rgba(255,107,107,0.85)', fg: '#FFFFFF', border: '#FF6B6B' },
    personal: { bg: 'rgba(93,161,245,0.85)', fg: '#FFFFFF', border: '#5DA1F5' },
  };
  
  const hourLabels = [];
  for (let h = 0; h <= 24; h++) {
    hourLabels.push(h);
  }
  
  return (
    <div style={{ fontFamily: "'Pretendard', -apple-system, sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 100, color: t.text }}>
      <div style={{ padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text }}>
            <ChevronLeft size={22}/>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{date}</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
              {dateObj.getMonth() + 1}월 {dateObj.getDate()}일 ({dow})
            </div>
          </div>
          <button onClick={() => setShowModal(true)} style={{
            background: t.accent, color: "white", border: "none", borderRadius: 8,
            padding: "8px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
          }}>
            <Plus size={12}/> 추가
          </button>
        </div>
        
        {tasks.length === 0 && offDays.length === 0 && (
          <div style={{ 
            padding: "40px 20px", textAlign: "center", fontSize: 12, 
            color: t.textMuted, background: t.bgElevated, borderRadius: 12,
            marginBottom: 16,
          }}>
            이 날에 일정이 없어요.<br/>
            [+ 추가] 버튼으로 휴무나 개인일정을 등록하세요.
          </div>
        )}
        
        <div style={{ 
          display: 'flex', position: 'relative',
          background: t.bgElevated, borderRadius: 12, padding: '12px 8px',
        }}>
          <div style={{ 
            width: 36, position: 'relative', 
            height: totalHeight, flexShrink: 0,
          }}>
            {hourLabels.map(h => (
              <div key={h} style={{
                position: 'absolute',
                top: h * HOUR_HEIGHT - 6,
                right: 4,
                fontSize: 9, color: t.textMuted,
                fontFamily: 'inherit', fontWeight: 700,
              }}>
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>
          
          <div style={{ 
            flex: 1, position: 'relative', 
            height: totalHeight,
            borderLeft: `1px solid ${t.border}`,
            paddingLeft: 6,
          }}>
            {hourLabels.map(h => (
              <div key={h} style={{
                position: 'absolute',
                top: h * HOUR_HEIGHT,
                left: 0, right: 0,
                borderTop: `1px solid ${t.border}`,
                opacity: h % 6 === 0 ? 0.6 : 0.2,
              }}/>
            ))}
            
            {emptySlots.map((slot, idx) => {
              const top = slot.start * HOUR_HEIGHT;
              const height = (slot.end - slot.start) * HOUR_HEIGHT;
              if (height < 18) return null;
              const hours = Math.round((slot.end - slot.start) * 10) / 10;
              return (
                <div key={`empty-${idx}`} style={{
                  position: 'absolute',
                  top, left: 4, right: 4,
                  height,
                  border: `1px dashed ${t.border}`,
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: t.textMuted,
                  background: 'transparent',
                }}>
                  ⏸ {hours}h
                </div>
              );
            })}
            
            {blocks.map((b, idx) => {
              const top = b.start * HOUR_HEIGHT;
              const height = (b.end - b.start) * HOUR_HEIGHT;
              const colors = COLORS[b.type];
              const isClickable = b.offId;
              
              return (
                <div key={idx} 
                  onClick={isClickable ? () => handleDelete(b.offId) : undefined}
                  style={{
                    position: 'absolute',
                    top: top + 1, left: 4, right: 4,
                    height: height - 2,
                    background: colors.bg,
                    color: colors.fg,
                    borderRadius: 6,
                    padding: '6px 10px',
                    overflow: 'hidden',
                    cursor: isClickable ? 'pointer' : 'default',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ 
                    fontSize: 11, fontWeight: 700, 
                    marginBottom: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {b.title}
                  </div>
                  {height > 28 && b.subtitle && (
                    <div style={{ 
                      fontSize: 9, opacity: 0.9,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {b.subtitle}
                    </div>
                  )}
                  {height > 50 && b.detail && (
                    <div style={{ 
                      fontSize: 9, opacity: 0.8,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {b.detail}
                    </div>
                  )}
                  {height > 22 && (
                    <div style={{
                      position: 'absolute', bottom: 4, right: 8,
                      fontSize: 9, opacity: 0.7,
                      fontFamily: 'inherit',
                    }}>
                      {String(Math.floor(b.start)).padStart(2,'0')}:{String(Math.round((b.start % 1) * 60)).padStart(2,'0')}
                      {' ~ '}
                      {String(Math.floor(b.end)).padStart(2,'0')}:{String(Math.round((b.end % 1) * 60)).padStart(2,'0')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <div style={{ 
          marginTop: 12, padding: '8px 12px',
          fontSize: 10, color: t.textMuted, lineHeight: 1.6,
        }}>
          💡 휴무/개인일정 막대 탭하면 삭제할 수 있어요
        </div>
      </div>
      
      {showModal && (
        <AddOffDayModal
          t={t}
          engineerName={engineerName}
          defaultDate={date}
          onClose={() => setShowModal(false)}
          onSaved={async () => {
            setShowModal(false);
            await reloadOffDays();
            if (onDataChange) onDataChange();
          }}
        />
      )}
    </div>
  );
}

function TimeWheelSheet({ t, isOpen, initialValue, label, onClose, onSelect }) {
  const initial = initialValue ? initialValue.split(':') : ['09', '00'];
  const initH = parseInt(initial[0]) || 9;
  const initM = (parseInt(initial[1]) || 0) >= 30 ? 30 : 0;
  
  const [selectedHour, setSelectedHour] = React.useState(initH);
  const [selectedMin, setSelectedMin] = React.useState(initM);
  const hourRef = React.useRef(null);
  const minRef = React.useRef(null);
  
  const ITEM_HEIGHT = 40;
  const VISIBLE = 5;
  const PADDING = ITEM_HEIGHT * 2;
  const SHEET_HEIGHT = ITEM_HEIGHT * VISIBLE;
  
  // 초기 스크롤 위치 설정
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (hourRef.current) hourRef.current.scrollTop = initH * ITEM_HEIGHT;
        if (minRef.current) minRef.current.scrollTop = (initM === 30 ? 1 : 0) * ITEM_HEIGHT;
      }, 50);
    }
  }, [isOpen, initH, initM]);
  
  // 스크롤 → 가운데 항목 추적
  const handleHourScroll = e => {
    const idx = Math.round(e.target.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(23, idx));
    if (clamped !== selectedHour) setSelectedHour(clamped);
  };
  
  const handleMinScroll = e => {
    const idx = Math.round(e.target.scrollTop / ITEM_HEIGHT);
    const m = idx === 0 ? 0 : 30;
    if (m !== selectedMin) setSelectedMin(m);
  };
  
  // 항목 탭 → 그 위치로 스크롤
  const goToHour = h => {
    if (hourRef.current) hourRef.current.scrollTo({ top: h * ITEM_HEIGHT, behavior: 'smooth' });
  };
  const goToMin = m => {
    if (minRef.current) minRef.current.scrollTo({ top: (m === 30 ? 1 : 0) * ITEM_HEIGHT, behavior: 'smooth' });
  };
  
  if (!isOpen) return null;
  
  const wheelStyle = {
    height: SHEET_HEIGHT,
    overflowY: 'scroll',
    scrollSnapType: 'y mandatory',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
    background: t.bgInset,
    borderRadius: 10,
    position: 'relative',
  };
  
  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 1100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <style>{`.ollit-wheel::-webkit-scrollbar{display:none}`}</style>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bgElevated, width: '100%', maxWidth: 420,
        borderRadius: '20px 20px 0 0', padding: '14px 20px 24px',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}>
        {/* 핸들 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 36, height: 4, background: t.borderStrong, borderRadius: 2 }}/>
        </div>
        
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{label || '시간 선택'}</span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: t.textMuted,
            fontSize: 18, cursor: 'pointer', padding: 4, fontFamily: 'inherit',
          }}>✕</button>
        </div>
        
        {/* 휠 영역 */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          {/* 가운데 highlight (포인터 이벤트 없음) */}
          <div style={{
            position: 'absolute',
            top: PADDING, left: 0, right: 0,
            height: ITEM_HEIGHT,
            background: 'rgba(255, 27, 141, 0.12)',
            border: `1px solid ${t.accent}`,
            borderRadius: 8,
            pointerEvents: 'none',
            zIndex: 2,
          }}/>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* 시 휠 */}
            <div ref={hourRef} className="ollit-wheel" onScroll={handleHourScroll} style={wheelStyle}>
              <div style={{ height: PADDING }}/>
              {Array.from({ length: 24 }, (_, h) => (
                <div 
                  key={h}
                  onClick={() => goToHour(h)}
                  style={{
                    height: ITEM_HEIGHT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: h === selectedHour ? 22 : 16,
                    fontWeight: h === selectedHour ? 700 : 400,
                    color: h === selectedHour ? t.accent : t.textMuted,
                    fontFamily: 'inherit',
                    scrollSnapAlign: 'center',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                >
                  {String(h).padStart(2, '0')}
                </div>
              ))}
              <div style={{ height: PADDING }}/>
            </div>
            
            {/* 분 휠 */}
            <div ref={minRef} className="ollit-wheel" onScroll={handleMinScroll} style={wheelStyle}>
              <div style={{ height: PADDING }}/>
              {[0, 30].map(m => (
                <div 
                  key={m}
                  onClick={() => goToMin(m)}
                  style={{
                    height: ITEM_HEIGHT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: m === selectedMin ? 22 : 16,
                    fontWeight: m === selectedMin ? 700 : 400,
                    color: m === selectedMin ? t.accent : t.textMuted,
                    fontFamily: 'inherit',
                    scrollSnapAlign: 'center',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                >
                  {String(m).padStart(2, '0')}
                </div>
              ))}
              <div style={{ height: PADDING }}/>
            </div>
          </div>
        </div>
        
        {/* 확인 버튼 */}
        <button 
          onClick={() => onSelect(`${String(selectedHour).padStart(2,'0')}:${String(selectedMin).padStart(2,'0')}`)}
          style={{
            width: '100%', padding: '14px',
            background: t.accent, color: 'white',
            border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          확인 · {String(selectedHour).padStart(2,'0')}:{String(selectedMin).padStart(2,'0')}
        </button>
      </div>
    </div>
  );
}

// =====================================
// 시간 표시 버튼 v7 (탭하면 휠 시트 열림)
// =====================================
function DragTimePicker({ value, onChange, t, label }) {
  const [showSheet, setShowSheet] = React.useState(false);
  
  return (
    <>
      <button 
        onClick={() => setShowSheet(true)}
        style={{
          background: 'transparent',
          color: value ? t.accent : t.textDim,
          border: 'none',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'inherit',
          letterSpacing: 1,
          cursor: 'pointer',
          padding: '4px 8px',
          outline: 'none',
        }}
      >
        {value || '--:--'}
      </button>
      <TimeWheelSheet
        t={t}
        isOpen={showSheet}
        initialValue={value}
        label={label || '시간 선택'}
        onClose={() => setShowSheet(false)}
        onSelect={(v) => {
          onChange(v);
          setShowSheet(false);
        }}
      />
    </>
  );
}

// =====================================
// 휴무 추가 모달 v4 (커스텀 휠 picker)
// =====================================
function AddOffDayModal({ t, engineerName, defaultDate, onClose, onSaved }) {
  const [type, setType] = useState("휴무종일");
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    if (saving) return;
    
    if (type !== "휴무종일" && (!startTime || !endTime)) {
      alert("시간을 입력하세요.");
      return;
    }
    
    setSaving(true);
    try {
      const result = await addOffDay({
        engineer: engineerName,
        type,
        date,
        startTime: type === "휴무종일" ? "종일" : startTime,
        endTime: type === "휴무종일" ? "종일" : endTime,
        memo,
      });
      
      if (result.ok) {
        onSaved();
      } else {
        alert("등록 실패: " + (result.error || ""));
      }
    } catch (err) {
      alert("오류: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.bg, width: "100%", maxWidth: 420,
        borderRadius: "20px 20px 0 0", padding: "24px 20px 32px",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          휴무 / 개인일정 추가
        </div>
        
        {/* 1. 종류 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8 }}>
            종류
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {[
              { id: "휴무종일", label: "종일 휴무", emoji: "🛌" },
              { id: "휴무시간", label: "시간 휴무", emoji: "⏸" },
              { id: "개인일정", label: "개인 일정", emoji: "📅" },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setType(opt.id)}
                style={{
                  padding: "10px 4px",
                  background: type === opt.id ? t.accent : t.bgElevated,
                  color: type === opt.id ? "white" : t.text,
                  border: "none", borderRadius: 8,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}
              >
                <span style={{ fontSize: 16 }}>{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* 2. 날짜 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8 }}>
            날짜
          </div>
          <CustomDatePicker t={t} value={date} onChange={setDate} />
        </div>
        
        {/* 3. 시간 (종일 아닐 때) */}
        {type !== "휴무종일" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8 }}>
              시간
            </div>
            
            {/* 시작 카드 */}
            <div style={{ 
              background: t.bgElevated, borderRadius: 10, 
              padding: '14px 16px', marginBottom: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>시작</span>
              <DragTimePicker t={t} value={startTime} onChange={setStartTime} label="시작 시간 선택" />
            </div>
            
            {/* 종료 카드 */}
            <div style={{ 
              background: t.bgElevated, borderRadius: 10, 
              padding: '14px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>종료</span>
              <DragTimePicker t={t} value={endTime} onChange={setEndTime} label="종료 시간 선택" />
            </div>
          </div>
        )}
        
        {/* 4. 메모 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8 }}>
            메모 (선택)
          </div>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="치과 예약, 가족 행사 등"
            rows={2}
            style={{
              width: "100%", padding: "12px 14px",
              background: t.bgElevated, color: t.text,
              border: `1px solid ${t.border}`, borderRadius: 10,
              fontSize: 13, fontFamily: "inherit", resize: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        
        {/* 5. 버튼 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button onClick={onClose} style={{
            padding: "14px", background: t.bgElevated, color: t.text,
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            취소
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "14px", background: saving ? t.bgInset : t.accent,
            color: "white", border: "none", borderRadius: 10,
            fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// V14 — 시뮬 가짜 데이터 helpers (백엔드 연동 시 제거)
function generateFakeKoreanName() {
  const lastNames  = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
  const firstNames = ["민준", "서연", "하준", "지우", "도윤", "서아", "시우", "하은", "예준", "수아"];
  const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
  const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
  return ln + fn;
}

function generateFakePhone() {
  const mid  = String(1000 + Math.floor(Math.random() * 9000));
  const last = String(1000 + Math.floor(Math.random() * 9000));
  return `010-${mid}-${last}`;
}

function generateFakeAddress(region) {
  const streets   = ["테헤란로", "삼성로", "도산대로", "강남대로", "봉은사로"];
  const buildings = ["래미안 아파트", "트라움하우스", "푸르지오", "자이", "롯데캐슬"];
  const street    = streets[Math.floor(Math.random() * streets.length)];
  const building  = buildings[Math.floor(Math.random() * buildings.length)];
  const num       = Math.floor(100 + Math.random() * 900);
  const dong      = Math.floor(100 + Math.random() * 900);
  const ho        = Math.floor(100 + Math.random() * 900);
  const base      = region || "강남구";
  return `${base} ${street} ${num}, ${building} ${dong}동 ${ho}호`;
}

function convertTimeHintToDate(hint) {
  // workSchedule "당일 (오후)" / "내일 오전" 등 → "YYYY-MM-DD"
  if (!hint) return null;
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  if (/내일/.test(hint)) return fmt(tomorrow);
  return fmt(today);
}

function extractTimeHint(hint) {
  if (!hint) return "";
  if (/오전/.test(hint)) return "오전";
  if (/오후/.test(hint)) return "오후";
  return "";
}

export default function EngineerApp({ user, onLogout }) {
  // V13-1-fix — localStorage 모드 로드 + CSS 변수 적용
  const [mode, setMode] = useState(() => loadThemeSaved());
  // V14 — navigation stack: 알림 → 작업 → 뒤로 = 알림 복귀
  const [screenStack, setScreenStack] = useState(["main"]);
  const screen = screenStack[screenStack.length - 1];
  const setScreen = (s) => setScreenStack(prev => (prev[prev.length - 1] === s ? prev : [...prev, s]));
  const goBack    = () => setScreenStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const resetTo   = (s) => setScreenStack([s]);
  // V14 v7 — 캘린더 초기 날짜/뷰 (allDone 카드 '내일 일정 보기' 클릭 시 박음)
  const [calendarInitial, setCalendarInitial] = useState(null);
  const handleTabChange = (tabId) => {
    if (tabId === "today")        resetTo("main");
    else if (tabId === "settle")  resetTo("settlement");
    else if (tabId === "cal")     { setCalendarInitial(null); resetTo("calendar"); }
    else if (tabId === "noti")    resetTo("notifications");
    else if (tabId === "me")      resetTo("profile");
  };
  // V14 v7 — 내일 일정 보기 = 캘린더 일별 뷰 + 내일 날짜
  const handleTomorrowClick = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ymd = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    setCalendarInitial({ date: ymd, view: "today" });
    resetTo("calendar");
  };
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // V14 Step 4.2 — apiTasks 선언 위로 이동 (TDZ fix)
  // 옛 박힌 위치 (line 4044~) → 여기로 이동
  // 옛 catch X: line 4001 useEffect deps array에서 apiTasks 박힘 = const 박지 X 박힌 catch (TDZ ReferenceError)
  const [apiTasks, setApiTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");

  // 2026-05-11 5단계 — pendingAcceptances 재설계 (명세: P열 추천기사 + status 미배정 + Q열 빈 값)
  // 옛: status="약속대기" / Q열="본인" → 본인 배정 catch
  // 새 (흐름 B 냉매 자동 추천):
  //   - status = "미배정" (또는 빈 값)
  //   - Q열 (assignedEngineer) = 빈 값 (아직 배정 X)
  //   - P열 (recommendedEngineer) 에 본인 이름 박혀있음 (콤마/공백 구분 다수 catch)
  const [pendingAcceptances, setPendingAcceptances] = useState([]);

  useEffect(() => {
    if (!apiTasks || apiTasks.length === 0) {
      setPendingAcceptances([]);
      return;
    }
    const myName = user?.name;
    if (!myName) {
      setPendingAcceptances([]);
      return;
    }
    const pending = apiTasks
      .filter(t => {
        const status = String(t.status || t.상태 || "").trim();
        // 미배정 또는 빈 값만 catch (배정/확정/진행중/완료/취소 명시 제외)
        if (status && status !== "미배정") return false;
        // Q열 (배정기사) 빈 값이어야 함 — 이미 배정 박혀있으면 catch X
        const assigned = String(t.assignedEngineer || t.engineer || t.배정기사 || "").trim();
        if (assigned) return false;
        // Phase 4 후속 — pushCandidates (DB jsonb) 측 본인 catch (Realtime 측 알림)
        const pushCands = Array.isArray(t.pushCandidates) ? t.pushCandidates : [];
        if (pushCands.length > 0) {
          const myCode = user?.engineerId || user?.id || "";
          if (pushCands.includes(myName) || (myCode && pushCands.includes(myCode))) return true;
        }
        // 옛 호환 — P열 (recommendedEngineer) 박혀있으면 catch (시트 시절 흐름)
        const recommendedRaw = String(t.recommendedEngineer || t.추천기사 || t.P || "").trim();
        if (!recommendedRaw) return false;
        // 콤마/한글콤마/공백 구분 + 본인 이름 catch
        const recommendedNames = recommendedRaw.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
        return recommendedNames.includes(myName);
      })
      .map(t => ({
        id: t.id,
        type: "acceptance",
        workType: t.workType,
        region: t.region,
        customer: t.customer,
        phone: t.phone,
        fullAddress: t.address,
        appliance: t.appliance,
        qty: t.qty || 1,
        workSchedule: t.requestedDate || t.scheduledDate || "협의",
        engineerRate: Number(t.estimateTotal || 0),
        requestedAgo: "",
      }));
    // 2026-05-11 진단 — 7단계 pendingAcceptances 추적 (apiTasks 상세 박음)
    console.log('[7단계 진단] pendingAcceptances 박힌 영역:', {
      count: pending.length,
      items: pending.map(p => ({ id: p.id, customer: p.customer })),
      myName: user?.name,
      apiTasksCount: apiTasks?.length || 0,
      apiTasksAll: (apiTasks || []).map(t => ({
        id: t.id,
        status: t.status || t.상태,
        assigned: t.assignedEngineer || t.배정기사,
        recommended: t.recommendedEngineer || t.추천기사,
      })),
    });
    setPendingAcceptances(pending);
  }, [apiTasks, user?.name]);

  // V13-1-fix — mode 변경 시 CSS 변수 적용 (라이트/다크 토글 작동)
  useEffect(() => {
    applyThemeVars(mode);
  }, [mode]);

  // 공유 task state (shared/TasksContext.jsx) — 옛 mock (extraAssignments / pendingAcceptances 박힘)
  const { tasks: allTasks, updateTask: localUpdateTask, resetTasks } = useTasks();

  // V14 Step 4.2 — apiTasks state 옛 위치 박지 X (위로 이동 = TDZ fix)

  async function fetchTasks() {
    setTasksLoading(true);
    setTasksError("");
    try {
      console.log('[V14 EngineerApp] fetchTasks 시작');
      const res = await getTasks('engineer', user?.engineerId || user?.id || 'engineer', null);
      console.log('[V14 EngineerApp] raw 응답:', res);
      if (!res || res.ok === false) {
        setTasksError((res && res.error) || '불러오기 실패');
        return;
      }
      const { list } = v14FindTaskList(res);
      if (!Array.isArray(list)) {
        setApiTasks([]);
        return;
      }
      const normalized = list.map(v14NormalizeTask).filter(Boolean);
      console.log('[V14 EngineerApp] normalized:', normalized.length, '건');
      setApiTasks(normalized);
    } catch (e) {
      console.error('[V14 EngineerApp] fetchTasks 에러:', e);
      setTasksError(e.message || '불러오기 실패');
    } finally {
      setTasksLoading(false);
    }
  }
  // Phase 4 후속 — Supabase Realtime 구독 (옛 60초 폴링 폐기)
  useRealtimeTasks(() => fetchTasks());

  // V14 — mount 시 한 번 + user 변경 시 재호출
  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.engineerId, user?.name]);

  // V14 — updateTask = apiUpdateTask 호출 + Optimistic Update
  const updateTask = async (taskId, updates) => {
    if (!taskId) return;
    console.log('[V14 EngineerApp] updateTask', { taskId, updates });

    // Optimistic Update (즉시 UI catch)
    setApiTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    ));
    // 옛 호환 (TasksContext 데이터)
    localUpdateTask(taskId, updates);

    try {
      // V14 — 시트 update 박기 (background / 5초 lag)
      const res = await apiUpdateTask(taskId, updates);
      console.log('[V14 EngineerApp] updateTask 응답:', res);
      if (!res || res.ok === false) {
        console.error('[V14 EngineerApp] updateTask 실패:', res);
        fetchTasks();  // 실패 박힘 — refetch (시트 catch)
      }
    } catch (e) {
      console.error('[V14 EngineerApp] updateTask 에러:', e);
      fetchTasks();
    }
  };

  // V14 — 본인 작업만 필터 (이름 매칭 우선 + ID 매칭)
  // 시트 Q 배정기사 = 이름 박힘 (예: "류근학")
  // user 객체 = name (예: "류근학") + engineerId (예: "E016")
  const tasks = filterTasksForEngineerV14(
    apiTasks.length > 0 ? apiTasks : allTasks,  // V14 우선 / 옛 mock fallback
    user?.name,
    user?.engineerId || user?.id
  );

  const t = THEMES[mode];
  const selectedTask = tasks.find(x => x.id === selectedTaskId);

  const reset = () => { resetTasks(); resetTo("main"); setSelectedTaskId(null); };

  // V14 큰 흐름 — 모달 state (취소 요청 / 금액 변경 / 완료 + 사진)
  const [cancelRequestTask, setCancelRequestTask] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [priceChangeTask, setPriceChangeTask] = useState(null);
  const [addAmount, setAddAmount] = useState(0);
  const [addReason, setAddReason] = useState("");
  const [completingTask, setCompletingTask] = useState(null);
  const [completePhotos, setCompletePhotos] = useState([]);
  const [completePhotoPreviews, setCompletePhotoPreviews] = useState([]);
  const [completing, setCompleting] = useState(false);

  // V14 — 작업 시작 (낙관 + API)
  async function handleStartTask(taskId) {
    if (!taskId) return;
    console.log('[V14 EngineerApp] startTask', { taskId });
    // Optimistic
    setApiTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: '작업중', state: 'active' } : t
    ));
    try {
      const res = await apiStartTask(taskId);
      if (!res || res.ok === false) {
        console.error('[V14] startTask 실패:', res);
        fetchTasks();
        return;
      }
    } catch (e) {
      console.error('[V14] startTask 에러:', e);
      fetchTasks();
    }
  }

  // V14 — 취소 요청 박기
  async function submitCancelRequest() {
    if (!cancelRequestTask?.id || !cancelReason.trim()) return;
    try {
      const res = await apiRequestCancel(cancelRequestTask.id, cancelReason);
      if (!res || res.ok === false) {
        alert(`취소 요청 catch X: ${(res && res.error) || '실패'}`);
        return;
      }
      // Optimistic
      setApiTasks(prev => prev.map(t =>
        t.id === cancelRequestTask.id ? { ...t, status: '취소요청', state: 'waiting' } : t
      ));
      setCancelRequestTask(null);
      setCancelReason("");
      fetchTasks();
    } catch (e) {
      alert(`취소 요청 에러: ${e.message}`);
    }
  }

  // V14 — 금액 변경 박기
  async function submitPriceChange() {
    if (!priceChangeTask?.id || !addAmount) return;
    const baseTotal = Number(priceChangeTask.estimateTotal || 0);
    const newTotal = baseTotal + Number(addAmount);
    try {
      const res = await apiChangePrice(priceChangeTask.id, baseTotal, Number(addAmount), addReason);
      if (!res || res.ok === false) {
        alert(`금액 변경 catch X: ${(res && res.error) || '실패'}`);
        return;
      }
      setApiTasks(prev => prev.map(t =>
        t.id === priceChangeTask.id
          ? { ...t, addonFee: Number(addAmount), totalAmount: newTotal, addonReason: addReason }
          : t
      ));
      setPriceChangeTask(null);
      setAddAmount(0);
      setAddReason("");
      fetchTasks();
    } catch (e) {
      alert(`금액 변경 에러: ${e.message}`);
    }
  }

  // V14 — 사진 선택 (multiple files / preview)
  async function handlePhotoSelect(e) {
    const files = Array.from(e.target.files || []).slice(0, 3);
    if (files.length === 0) return;
    setCompletePhotos(files);
    const previews = await Promise.all(
      files.map(f => new Promise(r => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result);
        reader.readAsDataURL(f);
      }))
    );
    setCompletePhotoPreviews(previews);
  }

  // Phase 4-5 — 작업 완료 + 사진 업로드 (Supabase Storage)
  // 흐름: 사진 병렬 업로드 → completeTaskAdapter(status='완료' + completedAt)
  async function submitComplete() {
    if (!completingTask?.id || completePhotos.length === 0) return;
    setCompleting(true);
    try {
      const taskId = completingTask.id;
      const uploadedBy = user?.id || null;

      // [1] 사진 병렬 업로드 (1~3장)
      const uploadResults = await Promise.all(
        completePhotos.map(file => uploadPhoto(taskId, file, '완료', uploadedBy))
      );
      const failures = uploadResults.filter(r => !r.ok);
      if (failures.length > 0) {
        alert(`사진 업로드 실패 (${failures.length}장): ${failures[0].error || '알 수 없는 오류'}`);
        setCompleting(false);
        return;
      }

      // [2] status='완료' 박음
      const res = await apiCompleteTask(taskId);
      if (!res || res.ok === false) {
        alert(`완료 처리 실패: ${(res && res.error) || '알 수 없는 오류'}`);
        setCompleting(false);
        return;
      }

      // Optimistic
      setApiTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: '완료', state: 'done' } : t
      ));
      setCompletingTask(null);
      setCompletePhotos([]);
      setCompletePhotoPreviews([]);
      setCompleting(false);
      fetchTasks();
    } catch (e) {
      console.error('[submitComplete] 에러:', e);
      alert(`완료 처리 에러: ${e.message}`);
      setCompleting(false);
    }
  }

  // V14 — 수락한 acceptance를 새 배정 리스트에 추가 (newAssignments 계산 전에 선언)
  const [extraAssignments, setExtraAssignments] = useState([]);

  // V13-1 — 새 배정 리스트 (오늘 화면 새 배정 박스 클릭)
  // V14 — 수락한 acceptance(extraAssignments)도 합산
  // 2026-05-10 명세 (이행 기간 호환):
  //   - 새 데이터: status="배정" (운영자가 박은 후 / 일정 미정)
  //   - 옛 데이터: status="확정" + 일정 미정 (옛 GAS 흐름 호환)
  const newAssignments = [
    ...tasks.filter(x =>
      x.status === "배정" ||
      (x.status === "확정" && (!x.scheduledDate || !x.scheduledTime))
    ),
    ...extraAssignments,
  ];

  // 2026-05-11 7단계 — 수락 / 거절 핸들러 (GAS acceptOffer API 연동)
  // 수락 흐름:
  //   1) 옵티미스틱 — pendingAcceptances 즉시 제거
  //   2) apiAcceptOffer 호출 (시트 측 P열 측 catch → Q열 박음 → status="배정")
  //   3) 성공 → apiTasks 측 status="배정" / Q열=본인 옵티미스틱 / 토스트
  //   4) 실패 (선착순 X) → 토스트 + fetchTasks 호출 (새 상태 박음)
  async function handleAcceptCall(callId) {
    const accepted = pendingAcceptances.find(c => c.id === callId);
    if (!accepted) return;
    const myName = user?.name;
    if (!myName) {
      showToast("⚠️ 사용자 이름이 없어 수락이 박지 X");
      return;
    }
    // 옵티미스틱 — 카드 즉시 제거 + 즉시 피드백 토스트 (사용자 대기 시간 X)
    setPendingAcceptances(prev => prev.filter(c => c.id !== callId));
    showToast("✅ 수락 완료");
    resetTo("main");

    try {
      const res = await apiAcceptOffer(callId, myName);
      console.log('[V14 7단계 acceptOffer] 응답:', res);
      if (res && res.ok === true) {
        // 옵티미스틱 — apiTasks 측 status="배정" + Q열=본인 박음 (5분 보호)
        const optimisticUntil = Date.now() + 300000;
        setApiTasks(prev => prev.map(t =>
          t.id === callId
            ? {
                ...t,
                _optimisticUntil: optimisticUntil,
                assignedEngineer: myName,
                engineer: myName,
                배정기사: myName,
                status: '배정',
                상태: '배정',
                state: 'scheduled',
              }
            : t
        ));
        // 성공 토스트 박지 X (이미 옵티미스틱 측 박혔음)
      } else {
        // 선착순 측 진 케이스 또는 GAS 측 에러
        const errMsg = (res && res.error) || "수락 실패";
        showToast(`⚠️ ${errMsg}`);
        // 새 상태 fetchTasks 호출 (시트 측 진실 박음)
        if (typeof fetchTasks === 'function') fetchTasks();
      }
    } catch (e) {
      console.error('[V14 7단계 acceptOffer] 에러:', e);
      showToast(`⚠️ 네트워크 오류 — 다시 시도해주세요`);
      if (typeof fetchTasks === 'function') fetchTasks();
    }
  }
  function handleRejectCall(callId) {
    setPendingAcceptances(prev => prev.filter(c => c.id !== callId));
    resetTo("main");
  }

  // V13-FINAL2 — 4탭 mock 데이터
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks.filter(x =>
    x.scheduledDate === todayStr
  );

  // V14 v6 — 사장님 시뮬 5/1~5/5 완료 13건 합계 (ENABLE_MOCK 분기 / Step 5-7-E)
  const _MONTH_STATS_MOCK = {
    month: 5,
    weekEarning: 364000, weekCount: 6,
    monthEarning: 808000, monthCount: 13,
    earning: 808000, count: 13,
    avgPerDay: 1.5, totalHours: 18,
  };
  const _MONTH_STATS_EMPTY = {
    month: new Date().getMonth() + 1,
    weekEarning: 0, weekCount: 0,
    monthEarning: 0, monthCount: 0,
    earning: 0, count: 0,
    avgPerDay: 0, totalHours: 0,
  };
  const monthStats = ENABLE_MOCK ? _MONTH_STATS_MOCK : _MONTH_STATS_EMPTY;

  // Step 5-7-E — 유솔N 받을 돈 분기
  const _USOL_N_MOCK = {
    month: new Date().getMonth() + 1,
    payDate: `${new Date().getMonth() + 2}/15`,
    amount: 280000,
  };
  const _USOL_N_EMPTY = {
    month: new Date().getMonth() + 1,
    payDate: "",
    amount: 0,
  };
  const usolN = ENABLE_MOCK ? _USOL_N_MOCK : _USOL_N_EMPTY;

  const engineerProfile = {
    name: user?.name || "프로",
    phone: user?.phone || "",
    companyName: "올데이케어",
    bankName: "카카오뱅크",
    accountNumber: "3333-12-3456789",
    accountHolder: user?.name || "프로",
    regions: ["강남구", "서초구", "송파구"],
  };

  // V14 v7 — 알림 7가지 (운영팀 메시지 = 단순 안내 / 입금 요청+확인 분리)
  // Step 5-7-E — ENABLE_MOCK 분기 (운영 = 빈 배열 / 시뮬 = 옛 7개)
  // 2026-05-10 — IndexedDB 측 알림으로 마이그레이션 (push 받으면 자동 추가)
  const _MOCK_NOTIFICATIONS = ENABLE_MOCK ? [
    { id: "N001", type: "new_assignment",     read: false, urgent: false, createdAt: new Date(Date.now() - 60 * 60 * 1000),       timeAgo: "1시간 전",   title: "새 배정 도착",         subtitle: "김상호 고객님 · 모레 세척 투인원 1대 · 마포구 상수동",         relatedId: "O260508-003", targetScreen: "newAssignmentList" },
    { id: "N002", type: "acceptance_pending", read: false, urgent: true,  createdAt: new Date(Date.now() - 30 * 60 * 1000),       timeAgo: "30분 전",    title: "수락 대기 · 선착순",     subtitle: "한미선 고객님 · 모레 14:00 세척 4way 3대 · 용산구 이태원동", relatedId: "K-260508-002", targetScreen: "acceptanceList" },
    { id: "N003", type: "team_message",       read: false, urgent: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),   timeAgo: "2시간 전",   title: "운영팀 메시지",         subtitle: "이번 주 정산 마감 5월 15일까지입니다",                       relatedId: null,           targetScreen: null },
    { id: "N004", type: "schedule_changed",   read: false, urgent: false, createdAt: new Date(Date.now() - 45 * 60 * 1000),       timeAgo: "45분 전",    title: "일정 변경됨",           subtitle: "강지훈 고객님 모레 11:00 → 10:00로 변경됐어요",              relatedId: "A260508-001", targetScreen: "detail" },
    { id: "N005", type: "work_canceled",      read: true,  urgent: false, createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),   timeAgo: "오늘 오전",  title: "작업 취소",            subtitle: "5/10 예정 작업이 고객 사정으로 취소됐어요",                  relatedId: null,           targetScreen: "calendar" },
    { id: "N006", type: "payment_request",    read: false, urgent: false, createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),  timeAgo: "어제 22:05", title: "입금 요청하였습니다",   subtitle: "5/6 마감분 50,000원 회사 송금 요청",                          relatedId: null,           targetScreen: "paymentHistory" },
    { id: "N007", type: "payment_confirmed",  read: false, urgent: false, createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000),  timeAgo: "오늘 09:30", title: "입금 확인되었습니다",   subtitle: "5/6 마감분 50,000원 처리 완료",                              relatedId: null,           targetScreen: "paymentHistory" },
  ] : [];
  const [notifications, setNotifications] = useState(_MOCK_NOTIFICATIONS);

  // IndexedDB 측 알림 로드 (마운트 + push 받을 때마다)
  useEffect(() => {
    let cancelled = false;
    async function reload() {
      const stored = await listStoredNotifications();
      if (cancelled) return;
      const adapted = stored.map(adaptStoredNoti);
      // ENABLE_MOCK 모드면 mock + IndexedDB 합쳐서 / 운영 모드면 IndexedDB만
      setNotifications(ENABLE_MOCK ? [...adapted, ..._MOCK_NOTIFICATIONS] : adapted);
    }
    reload();
    const handler = () => reload();
    window.addEventListener("notification:added", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("notification:added", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await markAllStoredAsRead();
  }
  async function markAsRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (typeof id === "number") await markStoredAsRead(id);
  }

  function handleNotiClick(noti) {
    markAsRead(noti.id);

    // V14 v7 — 사장님 spec: 알림 type별 라우팅
    // team_message = 라우팅 X (단순 안내)
    if (noti.type === "team_message") return;

    if (noti.type === "new_assignment")     return setScreen("newAssignmentList");
    if (noti.type === "acceptance_pending") return setScreen("acceptanceList");
    if (noti.type === "work_canceled")      return setScreen("calendar");
    if (noti.type === "payment_request")    return setScreen("paymentHistory");
    if (noti.type === "payment_confirmed")  return setScreen("paymentHistory");
    if (noti.type === "payment_received")   return setScreen("paymentHistory"); // 옛 alias

    // schedule_changed — relatedId로 작업 상세
    if (noti.relatedId) {
      const t = tasks.find(x => x.id === noti.relatedId);
      if (t) {
        setSelectedTaskId(t.id);
        setScreen("detail");
        return;
      }
    }

    // fallback (relatedId 매칭 X 또는 type 미정)
    if (noti.targetScreen) setScreen(noti.targetScreen);
  }

  // 유솔N 달력 mock — Step 5-7-E ENABLE_MOCK 분기
  const usolNMonthData = ENABLE_MOCK
    ? { totalAmount: 280000, count: 4, byDate: {} }
    : { totalAmount: 0,      count: 0, byDate: {} };
  const loadUsolNDayTasks = () => [];

  // V14 v6 — 회사 송금 (동적 / 사장님 spec '미입금 = 완료 즉시 추가')
  // 오늘 = todayTasks의 완료 작업 자동 합산 (실시간)
  // 어제 이후 = 입금 완료
  function dateOffsetIso(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  // 오늘 미입금 — todayTasks 완료 작업 (유솔N 제외) 자동
  const todayCompletedNonUsolN = todayTasks.filter(
    t => t.status === "완료" && t.client !== "유솔홈케어 N"
  );
  const todayPendingWorks = todayCompletedNonUsolN.map(t => ({
    id: t.id,
    customerName: t.customer || "—",
    workType: t.workType || "세척",
    workItem: t.appliance || "—",
    quantity: t.qty || 1,
    feeAmount: Math.max(0, (t.estimateTotal || 0) - (t.engineerNet || 0)),
  }));
  const todayPendingTotal = todayPendingWorks.reduce((s, w) => s + (w.feeAmount || 0), 0);

  const paymentsMock = [
    // 오늘 — 미입금 (실시간 자동 / todayTasks 완료 시 즉시 추가)
    ...(todayPendingWorks.length > 0 ? [{
      date: dateOffsetIso(0), status: "pending", deadline: "22:00",
      works: todayPendingWorks,
      totalAmount: todayPendingTotal,
    }] : []),
    // 어제 — 입금 완료 (사장님 spec: 어제 이후 모두 입금완료)
    {
      date: dateOffsetIso(-1), status: "completed", depositTime: "22:10",
      works: [
        { id: "Y260504-001", customerName: "임수아", workType: "세척", workItem: "벽걸이", quantity: 1, feeAmount: 20000 },
        { id: "CK260504-002", customerName: "장수빈", workType: "세척", workItem: "4way", quantity: 1, feeAmount: 60000 },
      ],
      totalAmount: 80000,
    },
    // 그제 — 입금 완료
    {
      date: dateOffsetIso(-2), status: "completed", depositTime: "22:08",
      works: [
        { id: "O260503-001", customerName: "윤서연", workType: "세척", workItem: "4way", quantity: 1, feeAmount: 60000 },
        { id: "CK260503-002", customerName: "최동석", workType: "세척", workItem: "벽걸이", quantity: 1, feeAmount: 20000 },
      ],
      totalAmount: 80000,
    },
    // -3일 — 입금 완료
    {
      date: dateOffsetIso(-3), status: "completed", depositTime: "22:08",
      works: [
        { id: "K-260502-001", customerName: "정민호", workType: "세척", workItem: "스탠드", quantity: 1, feeAmount: 50000 },
      ],
      totalAmount: 50000,
    },
    // -4일 — 입금 완료
    {
      date: dateOffsetIso(-4), status: "completed", depositTime: "22:30",
      works: [
        { id: "O260501-001", customerName: "박지영", workType: "세척", workItem: "벽걸이", quantity: 1, feeAmount: 20000 },
        { id: "YS260501-002", customerName: "이상훈", workType: "세척", workItem: "스탠드", quantity: 2, feeAmount: 100000 },
        { id: "A260501-003", customerName: "김재현", workType: "세척", workItem: "4way", quantity: 1, feeAmount: 60000 },
      ],
      totalAmount: 180000,
    },
  ];

  // Step 5-7-B — 유솔N 정산 mock 모두 제거 (운영 시작 = 깨끗한 상태)
  // 시트 양방향 sync 데이터로 교체 / 사용자가 새 작업 박을 때까지 빈 배열
  const usolNGroupsMock = [];

  // 휴무 mock
  const offDays = [];

  // V13-FINAL2-fix1 — 휴무 / 계좌 / 활동 지역 / 통화 화면 상태
  const [offDayModalOpen, setOffDayModalOpen] = useState(false);
  // V14 — 5월 시뮬 휴무 (5/3 일요일, 5/5 어린이날)
  // V14 v6 — 휴무 (localStorage 저장)
  const [savedOffDays, setSavedOffDays] = useState(() => {
    try {
      const v = localStorage.getItem("ollit_off_days");
      if (v) {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    // Step 5-7-E — ENABLE_MOCK 분기 (운영 = 빈 배열 / 시뮬 = 가족 모임 mock)
    return ENABLE_MOCK ? [
      { type: "hourly", date: new Date().toISOString().slice(0, 10), startTime: "19:00", endTime: "21:00", reason: "가족 모임" },
    ] : [];
  });
  useEffect(() => {
    try { localStorage.setItem("ollit_off_days", JSON.stringify(savedOffDays)); } catch (e) {}
  }, [savedOffDays]);
  const [savedAccount, setSavedAccount] = useState(null);
  const [savedRegions, setSavedRegions] = useState(null);
  const [callTaskId, setCallTaskId] = useState(null);
  // V14 — 수락 대기 → 새 배정 상세 라우팅용 임시 task
  const [acceptedCall, setAcceptedCall] = useState(null);
  // V14 — 토스트 메시지
  const [toast, setToast] = useState(null);
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const [pendingOffDate, setPendingOffDate] = useState(null);
  function handleAddOff(date) {
    setPendingOffDate(date || null);
    setOffDayModalOpen(true);
  }

  // V14 — 휴무 해제 (✕ → ConfirmModal → filter)
  const [removeOffConfirm, setRemoveOffConfirm] = useState(null);
  function getOffLabel(off) {
    function fmt(ymd) {
      if (!ymd) return "—";
      const parts = ymd.split("-");
      if (parts.length !== 3) return ymd;
      return `${Number(parts[1])}월 ${Number(parts[2])}일`;
    }
    if (off.type === "hourly") return `${fmt(off.date)} ${off.startTime || "—"}~${off.endTime || "—"} 시간 휴무`;
    if (off.type === "single") return `${fmt(off.date)} 하루 휴무`;
    if (off.type === "range")  return `${fmt(off.startDate)} ~ ${fmt(off.endDate)} 기간 휴무`;
    if (off.type === "repeat") {
      const days = (off.weekdays || []).slice().sort((a, b) => a - b)
        .map(d => ["일","월","화","수","목","금","토"][d]).join(", ");
      return `매주 ${days}요일 반복 휴무\n(앞으로 모든 ${days}요일이 해제됩니다)`;
    }
    return "휴무";
  }
  function handleRemoveOffClick(off) {
    if (!off) return;
    // id가 없는 옛 데이터를 위한 임시 키
    const key = off.id || `${off.type}|${off.date || off.startDate || ""}|${off.startTime || ""}|${(off.weekdays || []).join(",")}`;
    setRemoveOffConfirm({ key, off, label: getOffLabel(off) });
  }
  function handleConfirmRemoveOff() {
    if (!removeOffConfirm) return;
    const { off, key } = removeOffConfirm;
    setSavedOffDays(prev => prev.filter(o => {
      const oKey = o.id || `${o.type}|${o.date || o.startDate || ""}|${o.startTime || ""}|${(o.weekdays || []).join(",")}`;
      return oKey !== key;
    }));
    setRemoveOffConfirm(null);
    showToast("휴무가 해제되었습니다.");
  }

  function handleSaveOffDay(payload) {
    if (typeof console !== "undefined") console.log("🟢 휴무 추가 시도:", payload);
    setSavedOffDays(prev => {
      const next = [...prev, { ...payload, id: payload?.id || `off_${Date.now()}` }];
      if (typeof console !== "undefined") console.log("🟢 offDays 업데이트:", next);
      return next;
    });
    setOffDayModalOpen(false);
    showToast(payload?.type === "hourly" ? "시간 휴무가 추가됐습니다." : "휴무가 추가됐습니다.");
  }
  function handleCallOps() { window.location.href = "tel:01012345678"; }
  function handleChatOps() { alert("운영팀 채팅"); }
  // Step 5-8 F-5 + hotfix — 시트 양방향 sync (시트 H/I 컬럼 + saveEngineerWithSync)
  // 옛 동작 보존: setSavedAccount + resetTo (UI 즉시) / 시트 sync는 best-effort
  // engineerId 매핑 (multi-source / robust):
  //   1) user.engineerId (GAS 응답 / REGISTERED_USERS 직접 로그인)
  //   2) REGISTERED_USERS (시범 7계정 — userId / phone / name 매칭)
  //   3) loadEngineers (시트 기사 — name / phone 매칭)
  //   4) user.id (loginV14 시트 사용자 행 ID — fallback)
  async function handleSaveAccount(payload) {
    setSavedAccount(payload);
    resetTo("profile");

    // Step 5-8 hotfix — 디버그 로그 (사장님 캡처용 / 콘솔 검증)
    if (typeof console !== "undefined") {
      console.log('[Step 5-8 디버그] user 전체:', user);
      console.log('[Step 5-8 디버그] user.id:', user?.id);
      console.log('[Step 5-8 디버그] user.userId:', user?.userId);
      console.log('[Step 5-8 디버그] user.engineerId:', user?.engineerId);
      console.log('[Step 5-8 디버그] user.name:', user?.name);
      console.log('[Step 5-8 디버그] user.phone:', user?.phone);
    }

    // 옵션 🅑 — multi-source engineerId 매핑
    const fromRegistered = REGISTERED_USERS.find(u =>
      u.userId === user?.userId ||
      u.userId === user?.id ||
      (user?.phone && u.phone === user.phone) ||
      (user?.name  && u.name  === user.name)
    );
    const list = loadEngineers();
    const fromSheetEng = list.find(e =>
      e.id === user?.engineerId ||
      e.id === fromRegistered?.engineerId ||
      (user?.name  && e.name  === user.name) ||
      (user?.phone && e.phone === user.phone)
    );

    const engineerId =
      user?.engineerId ||
      fromRegistered?.engineerId ||
      fromSheetEng?.id ||
      user?.id ||
      "";

    if (typeof console !== "undefined") {
      console.log('[Step 5-8 디버그] 매핑 결과 fromRegistered:', fromRegistered);
      console.log('[Step 5-8 디버그] 매핑 결과 fromSheetEng:', fromSheetEng);
      console.log('[Step 5-8 디버그] 최종 engineerId:', engineerId);
    }

    if (!engineerId) {
      showToast("✓ 로컬 저장됨 (시트 sync 보류)");
      return;
    }

    const found = list.find(e => e.id === engineerId) || fromSheetEng || null;
    const merged = {
      ...(found || createEmptyEngineer()),
      id:    engineerId,
      name:  found?.name  || fromRegistered?.name  || user?.name  || "",
      phone: found?.phone || fromRegistered?.phone || user?.phone || "",
      bankName:      payload.bankName      || "",
      accountNumber: payload.accountNumber || "",
      accountHolder: payload.accountHolder || "",
    };
    const res = await saveEngineerWithSync(merged);
    if (res.ok)             showToast("✓ 계좌가 갱신되었습니다");
    else if (res.localOk)   showToast("✓ 로컬 저장됨 (시트 sync 보류)");
    else                    showToast(`⚠️ ${res.error || "저장 실패"}`);
  }
  function handleSaveRegions(regions) {
    setSavedRegions(regions);
    resetTo("profile");
  }
  // V14 — datePreset → ISO 날짜 변환
  function presetToISO(preset, customDate) {
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (preset === "today")    return fmt(new Date());
    if (preset === "tomorrow") { const d = new Date(); d.setDate(d.getDate()+1); return fmt(d); }
    return customDate || null;
  }

  function handleSaveCall(payload) {
    const id = callTaskId || (acceptedCall && acceptedCall.id);
    if (!id) {
      resetTo("main");
      return;
    }
    const scheduledDate = payload?.scheduledDate || presetToISO(payload?.datePreset, payload?.customDate);
    const scheduledTime = payload?.scheduledTime || payload?.startTime;

    // 2026-05-10 명세 — 일정 박혔으면 R="확정" + N열(scheduledAt) ISO 명시
    // 일정 미박음 → R="배정" 그대로 (운영자가 박은 상태 유지) / "약속대기"로 되돌리지 X
    const hasSchedule = !!(scheduledDate && scheduledTime);
    const scheduledAtIso = hasSchedule ? `${scheduledDate}T${scheduledTime}:00` : "";

    // 진짜 task면 updateTask로 확정 처리
    if (tasks.find(x => x.id === id)) {
      updateTask(id, {
        scheduledDate,
        scheduledTime,
        scheduledAt: scheduledAtIso,
        endTime: payload?.endTime,
        callMemo: payload?.memo,
        happycallMemo: payload?.memo,
        status: hasSchedule ? "확정" : "배정",
      });
    }
    // extraAssignments에 있으면 제거 (mock에서 확정 작업 별도 추가는 다음 catch)
    setExtraAssignments(prev => prev.filter(a => a.id !== id));
    setCallTaskId(null);
    setAcceptedCall(null);
    showToast("일정이 확정됐습니다.");
    resetTo("main");
  }
  function handleLocationSettings() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => alert("위치 권한 허용됨"),
        () => alert("위치 권한 거부됨 — 시스템 설정에서 허용해주세요"),
      );
    } else {
      alert("위치 권한 사용 불가");
    }
  }

  // engineerProfile에 저장된 값 반영
  const engineerProfileMerged = {
    ...engineerProfile,
    ...(savedAccount ? {
      bankName: savedAccount.bankName,
      bankCode: savedAccount.bankCode,
      accountNumber: savedAccount.accountNumber,
      accountHolder: savedAccount.accountHolder,
    } : {}),
    ...(savedRegions ? { regions: savedRegions } : {}),
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingTop: "env(safe-area-inset-top, 12px)" }}>
      {/* Step 5-6 UX — 상단 sticky 박스 (다크/라이트/로그아웃) 제거 / "내 정보" 탭에 그대로 */}
      {/* Step 5-6 UX hotfix — paddingTop env(safe-area-inset-top, 12px) — 휴대폰 status bar 영역 보호 */}

      <div style={{ maxWidth: 420, margin: "0 auto", position: "relative" }}>
        {/* V14 토스트 */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 96, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)", color: "#fff",
            padding: "12px 18px", borderRadius: 999,
            fontSize: 14, fontWeight: 600,
            zIndex: 9999, fontFamily: "inherit",
            maxWidth: "90%", textAlign: "center",
            pointerEvents: "none",
          }}>
            {toast}
          </div>
        )}

        {/* 메인 탭 (today) */}
        {screen === "main" && (
          <>
            <MainScreen
              t={t}
              tasks={tasks}
              user={user}
              onTaskClick={(id) => { setSelectedTaskId(id); setScreen("detail"); }}
              onClickAcceptanceList={() => setScreen("acceptanceList")}
              onClickNewAssignmentList={() => setScreen("newAssignmentList")}
              onClickUsolN={() => setScreen("usolNSettlement")}
              onClickTomorrow={handleTomorrowClick}
              onClickCalendar={() => { setCalendarInitial(null); resetTo("calendar"); }}
              onCompleteReport={(id) => { setSelectedTaskId(id); setScreen("detail"); }}
              pendingAcceptances={pendingAcceptances}
              newAssignmentsOverride={newAssignments}
              usolNTotal={usolNGroupsMock
                .filter(g => g.date && g.date.slice(0, 7) === new Date().toISOString().slice(0, 7))
                .reduce((s, g) => s + (g.totalAmount || 0), 0)}
              usolNPayDate="6월 15일"
            />
            <EngineerBottomNav
              active="today"
              onChange={handleTabChange}
              unreadCount={unreadCount}
            />
          </>
        )}

        {/* 정산 탭 */}
        {screen === "settlement" && (
          <EngineerSettleTab
            engineer={engineerProfile}
            todayTasks={todayTasks}
            monthStats={monthStats}
            usolN={usolN}
            onClickToday={() => setScreen("settlementDetail")}
            onClickUsolN={() => setScreen("usolNSettlement")}
            onClickPaymentHistory={() => setScreen("paymentHistory")}
            onConfirmPaymentSent={() => alert("입금 완료 보고")}
            onTabChange={handleTabChange}
            unreadCount={unreadCount}
          />
        )}

        {/* 정산 상세 (V14 NEW) */}
        {screen === "settlementDetail" && (
          <EngineerSettlementDetailScreen
            todayTasks={todayTasks}
            onBack={goBack}
            onTaskClick={(task) => { setSelectedTaskId(task.id); setScreen("detail"); }}
          />
        )}

        {/* 캘린더 탭 */}
        {screen === "calendar" && (
          <EngineerCalendarTab
            engineer={engineerProfileMerged}
            tasks={tasks}
            offDays={savedOffDays}
            onAddOff={handleAddOff}
            onRemoveOff={handleRemoveOffClick}
            onClickTask={(id) => { setSelectedTaskId(id); setScreen("detail"); }}
            onTabChange={handleTabChange}
            unreadCount={unreadCount}
            initialDate={calendarInitial?.date}
            initialView={calendarInitial?.view}
          />
        )}

        {/* 알림 탭 */}
        {screen === "notifications" && (
          <EngineerNotiTab
            notifications={notifications}
            onClickNoti={handleNotiClick}
            onMarkAllRead={markAllRead}
            onTabChange={handleTabChange}
          />
        )}

        {/* 내 정보 탭 */}
        {screen === "profile" && (
          <EngineerMeTab
            engineer={engineerProfileMerged}
            theme={mode}
            onChangeTheme={(value) => setMode(value)}
            onContactOps={handleCallOps}
            onChangeAccount={() => setScreen("accountEdit")}
            onRegions={() => setScreen("regionChange")}
            onLogout={onLogout}
            onTabChange={handleTabChange}
            unreadCount={unreadCount}
          />
        )}

        {/* V13-FINAL2-fix1 — 신규 sub-screens */}
        {screen === "accountEdit" && (
          <EngineerAccountEditScreen
            engineer={engineerProfileMerged}
            onBack={goBack}
            onSave={handleSaveAccount}
          />
        )}
        {screen === "notiSettings" && (
          <EngineerNotiSettingsScreen
            onBack={goBack}
          />
        )}
        {screen === "regionChange" && (
          <EngineerRegionChangeRequestScreen
            engineer={engineerProfileMerged}
            onBack={goBack}
            onSave={({ memo }) => {
              alert(`운영팀에 변경 요청 전송\n사유: ${memo}`);
              resetTo("profile");
            }}
          />
        )}
        {screen === "newAssignCall" && (
          <EngineerNewAssignDetailScreen
            task={acceptedCall || tasks.find(x => x.id === callTaskId) || extraAssignments.find(x => x.id === callTaskId)}
            onBack={() => {
              setAcceptedCall(null);
              setCallTaskId(null);
              goBack();
            }}
            onSave={handleSaveCall}
            onUnableSchedule={() => {
              const id = callTaskId || (acceptedCall && acceptedCall.id);
              if (id && tasks.find(x => x.id === id)) {
                updateTask(id, { status: "미배정", unableSchedule: true });
              }
              if (id) setExtraAssignments(prev => prev.filter(a => a.id !== id));
              setCallTaskId(null);
              setAcceptedCall(null);
              showToast("일정 불가 — 운영팀에 알림 보냈습니다.");
              resetTo("main");
            }}
            onCustomerCancel={() => {
              const ok = window.confirm("정말 취소하시겠습니까?");
              if (!ok) return;
              const id = callTaskId || (acceptedCall && acceptedCall.id);
              if (id && tasks.find(x => x.id === id)) {
                updateTask(id, { status: "취소", cancelReason: "고객 취소" });
              }
              if (id) setExtraAssignments(prev => prev.filter(a => a.id !== id));
              setCallTaskId(null);
              setAcceptedCall(null);
              showToast("고객 취소 처리됐습니다.");
              resetTo("main");
            }}
            onAskOps={() => alert("운영팀에 문의")}
          />
        )}

        {/* 휴무 등록 모달 (캘린더 탭 위에 띄움) */}
        {offDayModalOpen && (
          <EngineerOffDayAddModal
            defaultDate={pendingOffDate}
            onClose={() => { setOffDayModalOpen(false); setPendingOffDate(null); }}
            onSave={handleSaveOffDay}
          />
        )}

        {/* 휴무 해제 확인 모달 */}
        {removeOffConfirm && (
          <ConfirmModal
            title="휴무 해제"
            message={`${removeOffConfirm.label}\n해제하시겠어요?`}
            confirmLabel="해제"
            cancelLabel="취소"
            confirmColor="#FF3B5C"
            onConfirm={handleConfirmRemoveOff}
            onCancel={() => setRemoveOffConfirm(null)}
          />
        )}

        {/* sub-screens (탭 위) */}
        {screen === "newAssignmentList" && (
          <EngineerNewAssignmentListScreen
            tasks={newAssignments}
            onBack={goBack}
            onTaskClick={(id) => { setCallTaskId(id); setScreen("newAssignCall"); }}
          />
        )}
        {screen === "acceptanceList" && (
          <EngineerAcceptanceListScreen
            pendingAcceptances={pendingAcceptances}
            onBack={goBack}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
          />
        )}
        {screen === "detail" && selectedTask && (
          <EngineerTaskDetailScreen
            task={selectedTask}
            onBack={() => { goBack(); setSelectedTaskId(null); }}
            onUpdate={updateTask}
          />
        )}
        {screen === "usolN" && (
          <UsolNCalendarScreen
            engineer={engineerProfile}
            monthData={usolNMonthData}
            loadDayTasks={loadUsolNDayTasks}
            onBack={goBack}
          />
        )}
        {screen === "paymentHistory" && (
          <PaymentHistoryScreen
            payments={paymentsMock}
            onBack={goBack}
            onTaskClick={(taskId) => {
              const t = tasks.find(x => x.id === taskId);
              if (t) { setSelectedTaskId(t.id); setScreen("detail"); }
            }}
          />
        )}
        {screen === "usolNSettlement" && (
          <UsolNSettlementScreen
            groups={usolNGroupsMock}
            currentYm="2026-05"
            prevYm="2026-04"
            thisMonthDepositDate="6월 15일"
            prevMonthDepositDate="5월 15일"
            onBack={goBack}
            onTaskClick={(taskId) => {
              const t = tasks.find(x => x.id === taskId);
              if (t) { setSelectedTaskId(t.id); setScreen("detail"); }
            }}
          />
        )}
      </div>

      {/* V14 큰 흐름 — 취소 요청 모달 */}
      {cancelRequestTask && (
        <V14Modal onClose={() => { setCancelRequestTask(null); setCancelReason(""); }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>취소 요청</h3>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            {cancelRequestTask.customer} · {cancelRequestTask.workType} · {cancelRequestTask.address}
          </div>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="사유 박기... (예: 고객 부재 / 위치 X / 등)"
            style={{
              width: "100%", minHeight: 100, padding: 10,
              borderRadius: 8, border: "1px solid #ddd",
              fontSize: 13, fontFamily: "inherit", resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => { setCancelRequestTask(null); setCancelReason(""); }}
              style={{ flex: 1, padding: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >취소</button>
            <button
              disabled={!cancelReason.trim()}
              onClick={submitCancelRequest}
              style={{ flex: 1, padding: 12, background: cancelReason.trim() ? "#FF3B5C" : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: cancelReason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}
            >요청 박기</button>
          </div>
        </V14Modal>
      )}

      {/* V14 큰 흐름 — 금액 변경 모달 (현장 추가) */}
      {priceChangeTask && (
        <V14Modal onClose={() => { setPriceChangeTask(null); setAddAmount(0); setAddReason(""); }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>금액 변경 (현장 추가)</h3>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            {priceChangeTask.customer} · 견적 ₩{Number(priceChangeTask.estimateTotal || 0).toLocaleString()}
          </div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>추가 금액 (원)</label>
          <input
            type="number"
            value={addAmount || ""}
            onChange={(e) => setAddAmount(parseInt(e.target.value) || 0)}
            placeholder="추가 금액"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }}
          />
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>사유</label>
          <textarea
            value={addReason}
            onChange={(e) => setAddReason(e.target.value)}
            placeholder="예: 가스 추가 / 부품 교체 / 작업 시간 추가"
            style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
          />
          {addAmount > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#FF1B8D", fontWeight: 700 }}>
              새 총금액: ₩{(Number(priceChangeTask.estimateTotal || 0) + Number(addAmount)).toLocaleString()}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => { setPriceChangeTask(null); setAddAmount(0); setAddReason(""); }}
              style={{ flex: 1, padding: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >취소</button>
            <button
              disabled={!addAmount || addAmount <= 0}
              onClick={submitPriceChange}
              style={{ flex: 1, padding: 12, background: (addAmount > 0) ? "#FF1B8D" : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: (addAmount > 0) ? "pointer" : "not-allowed", fontFamily: "inherit" }}
            >변경 박기</button>
          </div>
        </V14Modal>
      )}

      {/* V14 큰 흐름 — 완료 + 사진 업로드 모달 (필수 1~3장) */}
      {completingTask && (
        <V14Modal onClose={completing ? undefined : () => { setCompletingTask(null); setCompletePhotos([]); setCompletePhotoPreviews([]); }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>작업 완료 + 사진 업로드</h3>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
            {completingTask.customer} · {completingTask.workType}
          </div>
          <label style={{ display: "block", padding: 14, border: "2px dashed #FF1B8D", borderRadius: 10, textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              disabled={completing}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 24, marginBottom: 6 }}>📸</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF1B8D" }}>
              사진 첨부 (1~3장 필수)
            </div>
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
              현재 {completePhotos.length}장
            </div>
          </label>
          {completePhotoPreviews.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {completePhotoPreviews.map((src, i) => (
                <img key={i} src={src} alt="preview" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6 }}/>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              disabled={completing}
              onClick={() => { setCompletingTask(null); setCompletePhotos([]); setCompletePhotoPreviews([]); }}
              style={{ flex: 1, padding: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: completing ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: completing ? 0.5 : 1 }}
            >취소</button>
            <button
              disabled={completePhotos.length === 0 || completing}
              onClick={submitComplete}
              style={{ flex: 2, padding: 12, background: (completePhotos.length > 0 && !completing) ? "#00875A" : "#ccc", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: (completePhotos.length > 0 && !completing) ? "pointer" : "not-allowed", fontFamily: "inherit" }}
            >
              {completing ? "처리 중..." : `완료하기 (사진 ${completePhotos.length}장)`}
            </button>
          </div>
        </V14Modal>
      )}
    </div>
  );
}

// V14 — 모달 wrapper (재사용)
function V14Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-primary, #fff)", color: "var(--text-primary, #1A1A1A)",
          borderRadius: 14, padding: 18,
          width: "100%", maxWidth: 380,
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          fontFamily: "'Pretendard', -apple-system, sans-serif",
        }}
      >
        {children}
      </div>
    </div>
  );
}
