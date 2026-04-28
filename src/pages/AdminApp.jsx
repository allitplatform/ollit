import { useState } from "react";
import { 
  Phone, MessageCircle, Snowflake, Wrench, Settings, Zap, ChevronRight,
  Sun, Moon, Plus, ArrowLeft, ArrowRight, User, MapPin, Calendar,
  Clock, FileText, RotateCcw, CheckCircle2, AlertCircle, Star,
  Users, BarChart3, TrendingUp, Activity, Wallet, Bell, Camera,
  Briefcase, Hash, AlertTriangle, MoreVertical, Award, XCircle
} from "lucide-react";

const NOW = "10:00";

// ============================================
// 데이터
// ============================================
const ADMIN_USER = "이대표";

const TODAY_STATS = {
  total: 24,
  completed: 8,
  inProgress: 3,
  scheduled: 9,
  pending: 4,
  newReceived: 5,
  urgent: 2, // 긴급 작업
  revenue: 2850000,
  myMargin: 1140000,
  engineerNet: 1710000,
  unpaid: 450000,
  fieldCollection: 1850000,    // 현장수금 합계
  companySettlement: 1000000,  // 회사정산 합계
  cancelRate: 2.1,
};

// 직급 시스템 (기사용과 동일)
const ENGINEER_RANKS = [
  { id: "intern", name: "수습", icon: "🌱", min: 0, max: 50, color: "#888780" },
  { id: "junior", name: "주임", icon: "🔧", min: 51, max: 150, color: "#378ADD" },
  { id: "senior", name: "대리", icon: "💼", min: 151, max: 300, color: "#1D9E75" },
  { id: "manager", name: "과장", icon: "🎖️", min: 301, max: 600, color: "#E91860" },
  { id: "director", name: "부장", icon: "👑", min: 601, max: 9999, color: "#BA7517" },
];

const ENGINEER_STATS = [
  { id: "E001", name: "김동효", region: "강남 전담", today: 4, week: 18, month: 36, totalJobs: 487, rank: "manager", revenue: 480000, status: "active", utilization: 85, attendance: 22 },
  { id: "E002", name: "이재현", region: "강남/서초", today: 3, week: 15, month: 32, totalJobs: 312, rank: "manager", revenue: 360000, status: "active", utilization: 78, attendance: 21 },
  { id: "E003", name: "박상민", region: "송파/잠실", today: 2, week: 12, month: 28, totalJobs: 245, rank: "senior", revenue: 240000, status: "active", utilization: 65, attendance: 19 },
  { id: "E004", name: "최민수", region: "종로/중구", today: 5, week: 20, month: 40, totalJobs: 156, rank: "junior", revenue: 600000, status: "active", utilization: 92, attendance: 24 },
  { id: "E005", name: "김도현", region: "강남/송파", today: 1, week: 10, month: 22, totalJobs: 89, rank: "junior", revenue: 120000, status: "active", utilization: 45, attendance: 15 },
];

const RECENT_ACTIVITIES = [
  { time: "10:00", type: "complete", text: "박지영님 (세척) 작업 완료", engineer: "김동효", color: "success" },
  { time: "09:45", type: "assign", text: "정도현님 (설치) 김동효 기사 배정", engineer: "김지혜", color: "accent" },
  { time: "09:30", type: "urgent", text: "🚨 긴급: 이지은님 (당일 작업) 접수", engineer: "쿨가이", color: "danger" },
  { time: "09:30", type: "new", text: "새 접수: 박은서 (세척, 강남구)", engineer: "쿨가이", color: "warning" },
  { time: "09:15", type: "schedule", text: "이상훈님 일정 14:00 → 11:30 변경", engineer: "이재현", color: "warning" },
  { time: "09:00", type: "start", text: "박지영님 작업 시작 (강남구 역삼동)", engineer: "김동효", color: "warning" },
  { time: "08:30", type: "complete", text: "최영주님 (점검) 작업 완료", engineer: "최민수", color: "success" },
];

const ALL_TASKS = [
  { id: "A260427-001", customer: "박지영", workType: "세척", status: "완료", engineer: "김동효", time: "09:00", region: "강남", paymentType: "field", urgent: false },
  { id: "A260427-002", customer: "이상훈", workType: "세척+점검", status: "확정", engineer: "김동효", time: "11:30", region: "서초", paymentType: "field", urgent: false },
  { id: "A260427-003", customer: "김미경", workType: "냉매충전", status: "확정", engineer: "김동효", time: "14:00", region: "송파", paymentType: "company", urgent: false },
  { id: "A260427-004", customer: "정도현", workType: "설치", status: "약속대기", engineer: "김동효", time: null, region: "강남", paymentType: "company", urgent: false },
  { id: "A260427-005", customer: "박은서", workType: "세척", status: "미배정", engineer: null, time: null, region: "강남", paymentType: "field", urgent: false },
  { id: "A260427-006", customer: "김민호", workType: "점검", status: "미배정", engineer: null, time: null, region: "송파", paymentType: "field", urgent: false },
  { id: "A260427-007", customer: "이지은", workType: "설치", status: "미배정", engineer: null, time: null, region: "서초", paymentType: "company", urgent: true },
  { id: "A260427-008", customer: "정민수", workType: "세척", status: "진행중", engineer: "최민수", time: "10:00", region: "종로", paymentType: "field", urgent: false },
];

// 지역별 작업량
const REGION_STATS = [
  { region: "강남", count: 8, color: "#E91860" },
  { region: "서초", count: 5, color: "#7F77DD" },
  { region: "송파", count: 6, color: "#1D9E75" },
  { region: "종로", count: 3, color: "#BA7517" },
  { region: "기타", count: 2, color: "#888780" },
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
    info: "#60A5FA", infoBg: "rgba(96, 165, 250, 0.10)",
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
    info: "#2563EB", infoBg: "rgba(37, 99, 235, 0.08)",
    isLight: true,
  },
};

// ============================================
// 메인 대시보드
// ============================================
function AdminDashboard({ t }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={{ fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif", background: t.bg, minHeight: "100vh", paddingBottom: 80, color: t.text }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@01ff0283e4f6c01667e0c819cfe9d2e933020d3a/css/SpoqaHanSansNeo.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .card-fade { animation: slideUp 0.4s ease-out backwards; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .clickable { cursor: pointer; transition: transform 0.15s, opacity 0.15s; }
        .clickable:active { transform: scale(0.98); opacity: 0.8; }
      `}</style>

      {/* 헤더 */}
      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span className="mono" style={{ fontSize: 11, color: t.textMuted, letterSpacing: 2, fontWeight: 500, textTransform: "uppercase" }}>
            MON · 27 APR · {NOW}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.accent, padding: "3px 8px", background: t.accentBg, borderRadius: 5 }}>
            대표
          </span>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            {ADMIN_USER}님의 대시보드
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>
            오늘 <span className="mono" style={{ color: t.text, fontWeight: 700 }}>{TODAY_STATS.total}</span>건 · 
            완료 <span className="mono" style={{ color: t.success, fontWeight: 700 }}>{TODAY_STATS.completed}</span> · 
            진행 <span className="mono" style={{ color: t.warning, fontWeight: 700 }}>{TODAY_STATS.inProgress}</span> · 
            미배정 <span className="mono" style={{ color: t.accent, fontWeight: 700 }}>{TODAY_STATS.pending}</span>
          </div>
        </div>

        {/* 핵심 메트릭 4개 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <BigMetric t={t} icon={<Wallet size={14}/>} label="오늘 매출" value={TODAY_STATS.revenue} unit="₩" color={t.text} delay={0}/>
          <BigMetric t={t} icon={<TrendingUp size={14}/>} label="회사 마진" value={TODAY_STATS.myMargin} unit="₩" color={t.accent} delay={70}/>
          <BigMetric t={t} icon={<Users size={14}/>} label="기사 정산" value={TODAY_STATS.engineerNet} unit="₩" color={t.success} delay={140}/>
          <BigMetric t={t} icon={<AlertCircle size={14}/>} label="미수금" value={TODAY_STATS.unpaid} unit="₩" color={t.danger} delay={210}/>
        </div>

        {/* 알림 박스 */}
        <div style={{ marginBottom: 24, background: t.warningBg, border: `1px solid ${t.warningBorder}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={16} style={{ color: t.warning, flexShrink: 0 }}/>
          <div style={{ flex: 1, fontSize: 12, color: t.text, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700 }}>{TODAY_STATS.pending}건 미배정</span> · 
            새 접수 <span style={{ fontWeight: 700, color: t.accent }}>{TODAY_STATS.newReceived}건</span> 처리 필요
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 20 }}>
        <div style={{ padding: "0 20px 14px", display: "flex", gap: 6, overflowX: "auto" }}>
          <TabButton t={t} label="개요" active={activeTab === "overview"} onClick={() => setActiveTab("overview")}/>
          <TabButton t={t} label="작업" active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")}/>
          <TabButton t={t} label="기사" active={activeTab === "engineers"} onClick={() => setActiveTab("engineers")}/>
          <TabButton t={t} label="활동" active={activeTab === "activity"} onClick={() => setActiveTab("activity")}/>
        </div>

        {activeTab === "overview" && <OverviewTab t={t}/>}
        {activeTab === "tasks" && <TasksTab t={t}/>}
        {activeTab === "engineers" && <EngineersTab t={t}/>}
        {activeTab === "activity" && <ActivityTab t={t}/>}
      </div>
    </div>
  );
}

// ============================================
// 큰 메트릭 카드
// ============================================
function BigMetric({ t, icon, label, value, unit, color, delay }) {
  return (
    <div className="card-fade" style={{ background: t.bgElevated, borderRadius: 12, padding: "14px 16px", animationDelay: `${delay}ms` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ color: t.textMuted, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        {unit === "₩" && <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>₩</span>}
        <span className="mono" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color }}>
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ============================================
// 탭 버튼
// ============================================
function TabButton({ t, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 12px",
      background: active ? t.bgElevated : "transparent",
      border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
      borderRadius: 10, fontSize: 12, fontWeight: 700,
      color: active ? t.text : t.textMuted,
      cursor: "pointer", fontFamily: "inherit",
      whiteSpace: "nowrap",
    }}>
      {label}
    </button>
  );
}

// ============================================
// 개요 탭
// ============================================
function OverviewTab({ t }) {
  return (
    <div style={{ padding: "0 20px" }}>
      {/* 긴급 작업 알림 (있을 때만) */}
      {TODAY_STATS.urgent > 0 && (
        <div style={{ 
          background: t.dangerBg, 
          border: `1px solid ${t.danger}40`,
          borderRadius: 12, padding: "14px 16px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ 
            width: 36, height: 36, borderRadius: 10,
            background: t.danger, color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <AlertTriangle size={16}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.danger, marginBottom: 2 }}>
              긴급 작업 {TODAY_STATS.urgent}건 처리 필요
            </div>
            <div style={{ fontSize: 11, color: t.textMuted }}>
              당일 작업 등 우선 배정이 필요해요
            </div>
          </div>
          <ChevronRight size={16} style={{ color: t.danger }}/>
        </div>
      )}

      {/* 오늘 작업 현황 */}
      <Section t={t} title="오늘 작업 현황" icon={<Briefcase size={13}/>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <StatusBox t={t} label="완료" count={TODAY_STATS.completed} color={t.success}/>
          <StatusBox t={t} label="진행중" count={TODAY_STATS.inProgress} color={t.warning}/>
          <StatusBox t={t} label="확정" count={TODAY_STATS.scheduled} color={t.text}/>
          <StatusBox t={t} label="대기" count={TODAY_STATS.pending} color={t.accent}/>
        </div>
      </Section>

      {/* 진행률 */}
      <Section t={t} title="오늘 진행률" icon={<Activity size={13}/>}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>{TODAY_STATS.completed}/{TODAY_STATS.total}건 완료</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: t.success }}>
            {Math.round(TODAY_STATS.completed / TODAY_STATS.total * 100)}%
          </span>
        </div>
        <div style={{ height: 8, background: t.bgInset, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${TODAY_STATS.completed / TODAY_STATS.total * 100}%`, height: "100%", background: t.success }}/>
        </div>
      </Section>

      {/* 정산 타입 분포 (현장수금 vs 회사정산) */}
      <Section t={t} title="정산 흐름" icon={<Wallet size={13}/>}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, padding: "12px 14px", background: t.successBg, border: `1px solid ${t.successBorder}`, borderRadius: 10 }}>
            <div style={{ fontSize: 9, color: t.success, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
              현장 수금
            </div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: t.success }}>
              ₩{(TODAY_STATS.fieldCollection / 10000).toFixed(0)}만
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 4 }}>
              기사 → 회사 송금
            </div>
          </div>
          <div style={{ flex: 1, padding: "12px 14px", background: t.accentBg, border: `1px solid ${t.accent}30`, borderRadius: 10 }}>
            <div style={{ fontSize: 9, color: t.accent, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
              회사 정산
            </div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: t.accent }}>
              ₩{(TODAY_STATS.companySettlement / 10000).toFixed(0)}만
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, marginTop: 4 }}>
              회사 → 기사 정산
            </div>
          </div>
        </div>
        {/* 막대 비교 */}
        <div style={{ height: 6, background: t.bgInset, borderRadius: 3, overflow: "hidden", display: "flex" }}>
          <div style={{ 
            width: `${TODAY_STATS.fieldCollection / (TODAY_STATS.fieldCollection + TODAY_STATS.companySettlement) * 100}%`, 
            height: "100%", background: t.success 
          }}/>
          <div style={{ 
            width: `${TODAY_STATS.companySettlement / (TODAY_STATS.fieldCollection + TODAY_STATS.companySettlement) * 100}%`, 
            height: "100%", background: t.accent 
          }}/>
        </div>
      </Section>

      {/* 지역별 작업 분포 */}
      <Section t={t} title="지역별 작업 분포" icon={<MapPin size={13}/>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {REGION_STATS.map(r => (
            <div key={r.region} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 50, fontSize: 12, fontWeight: 700 }}>{r.region}</div>
              <div style={{ flex: 1, height: 18, background: t.bgInset, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                <div style={{ 
                  width: `${r.count / Math.max(...REGION_STATS.map(x => x.count)) * 100}%`,
                  height: "100%", background: r.color, 
                  display: "flex", alignItems: "center", justifyContent: "flex-end",
                  paddingRight: 8, transition: "width 0.5s",
                }}>
                  <span className="mono" style={{ fontSize: 10, color: "white", fontWeight: 700 }}>{r.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 취소율 */}
      <Section t={t} title="취소율" icon={<XCircle size={13}/>}>
        <div style={{ padding: "12px 14px", background: t.bgInset, borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="mono" style={{ fontSize: 24, fontWeight: 800, color: t.success }}>{TODAY_STATS.cancelRate}</span>
            <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>%</span>
            <span style={{ fontSize: 10, color: t.success, fontWeight: 600, marginLeft: 6 }}>
              ↓ 지난주보다 0.4%p 개선
            </span>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ============================================
// 작업 탭
// ============================================
function TasksTab({ t }) {
  const [filter, setFilter] = useState("all");
  
  let filtered = filter === "all" ? ALL_TASKS : 
                 filter === "urgent" ? ALL_TASKS.filter(x => x.urgent) :
                 ALL_TASKS.filter(x => x.status === filter);
  
  // 긴급 작업 먼저
  filtered = [...filtered].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
  
  const getStatusStyle = (status) => {
    switch(status) {
      case "완료": return { color: t.success, bg: t.successBg };
      case "진행중": return { color: t.warning, bg: t.warningBg };
      case "확정": return { color: t.text, bg: t.bgInset };
      case "약속대기": return { color: t.accent, bg: t.accentBg };
      case "미배정": return { color: t.danger, bg: t.dangerBg };
      default: return { color: t.textMuted, bg: t.bgInset };
    }
  };

  const urgentCount = ALL_TASKS.filter(x => x.urgent).length;

  return (
    <div style={{ padding: "0 20px" }}>
      {/* 필터 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "all", label: "전체" },
          { id: "urgent", label: `🚨 긴급 ${urgentCount}`, danger: true },
          { id: "미배정", label: "미배정" },
          { id: "약속대기", label: "약속대기" },
          { id: "확정", label: "확정" },
          { id: "진행중", label: "진행중" },
          { id: "완료", label: "완료" },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "6px 12px",
            background: filter === f.id ? (f.danger ? t.danger : t.accent) : t.bgInset,
            color: filter === f.id ? "white" : (f.danger ? t.danger : t.text),
            border: `1px solid ${filter === f.id ? (f.danger ? t.danger : t.accent) : t.border}`,
            borderRadius: 8, fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* 작업 리스트 */}
      <div style={{ background: t.bgElevated, borderRadius: 12, overflow: "hidden" }}>
        {filtered.map((task, idx) => {
          const ss = getStatusStyle(task.status);
          return (
            <div key={task.id} className="clickable" style={{
              padding: "12px 14px",
              borderBottom: idx < filtered.length - 1 ? `1px solid ${t.border}` : "none",
              display: "flex", alignItems: "center", gap: 10,
              background: task.urgent ? t.dangerBg + "30" : "transparent",
              borderLeft: task.urgent ? `3px solid ${t.danger}` : "none",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                  {task.urgent && (
                    <span style={{ 
                      fontSize: 9, fontWeight: 800, padding: "2px 5px",
                      background: t.danger, color: "white",
                      borderRadius: 4, letterSpacing: 0.3,
                    }}>
                      🚨 긴급
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{task.customer}</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>· {task.region}</span>
                  <span style={{
                    fontSize: 9, padding: "1px 5px",
                    background: task.paymentType === "field" ? t.successBg : t.accentBg,
                    color: task.paymentType === "field" ? t.success : t.accent,
                    borderRadius: 3, fontWeight: 700,
                  }}>
                    {task.paymentType === "field" ? "현장" : "회사"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.textMuted }}>
                  <span>{task.workType}</span>
                  {task.time && <><span>·</span><span className="mono">{task.time}</span></>}
                  {task.engineer && <><span>·</span><span style={{ color: t.text }}>{task.engineer}</span></>}
                </div>
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700,
                padding: "4px 9px", borderRadius: 5,
                background: ss.bg, color: ss.color, flexShrink: 0,
              }}>
                {task.status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// 기사 탭
// ============================================
function EngineersTab({ t }) {
  // 직급별 카운트
  const rankCounts = ENGINEER_RANKS.map(r => ({
    ...r,
    count: ENGINEER_STATS.filter(e => e.rank === r.id).length,
  }));
  
  return (
    <div style={{ padding: "0 20px" }}>
      {/* 직급별 분포 */}
      <Section t={t} title="직급별 분포" icon={<Award size={13}/>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
          {rankCounts.map(r => (
            <div key={r.id} style={{ 
              padding: "12px 6px", textAlign: "center",
              background: r.count > 0 ? t.bgInset : "transparent",
              border: r.count > 0 ? "none" : `1px dashed ${t.border}`,
              borderRadius: 10,
              opacity: r.count === 0 ? 0.4 : 1,
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{r.icon}</div>
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>{r.name}</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: r.count > 0 ? r.color : t.textDim }}>
                {r.count}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 기사 목록 */}
      <Section t={t} title={`기사 ${ENGINEER_STATS.length}명`} icon={<Users size={13}/>}>
        {ENGINEER_STATS.map((eng, idx) => {
          const rank = ENGINEER_RANKS.find(r => r.id === eng.rank);
          const attendanceRate = Math.round(eng.attendance / 26 * 100);
          
          return (
            <div key={eng.id} className="clickable" style={{
              padding: "14px 16px",
              background: t.bgElevated,
              borderRadius: 12, marginBottom: 6,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: t.accentBg, color: t.accent,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800,
                  }}>
                    {eng.name.slice(0, 1)}
                  </div>
                  {/* 직급 아이콘 */}
                  <div style={{
                    position: "absolute", bottom: -4, right: -4,
                    width: 18, height: 18, borderRadius: 5,
                    background: t.bgElevated,
                    border: `1.5px solid ${rank.color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9,
                  }}>
                    {rank.icon}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{eng.name}</span>
                    <span style={{ 
                      fontSize: 9, fontWeight: 800, padding: "2px 6px",
                      background: rank.color + "20", color: rank.color,
                      borderRadius: 4,
                    }}>
                      {rank.name}
                    </span>
                    <span style={{ fontSize: 11, color: t.textMuted }}>· {eng.region}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: t.textMuted }}>
                    <span>오늘 <span className="mono" style={{ color: t.text, fontWeight: 600 }}>{eng.today}</span>건</span>
                    <span>·</span>
                    <span>월 <span className="mono" style={{ color: t.text, fontWeight: 600 }}>{eng.month}</span>건</span>
                    <span>·</span>
                    <span>누적 <span className="mono" style={{ color: t.text, fontWeight: 600 }}>{eng.totalJobs}</span></span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: t.success }}>
                    ₩{(eng.revenue / 1000).toFixed(0)}K
                  </div>
                  <div style={{ fontSize: 9, color: t.textMuted }}>오늘 매출</div>
                </div>
              </div>
              
              {/* 가동률 + 출석률 (한 줄에 둘 다) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: t.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>가동률</span>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: eng.utilization > 80 ? t.warning : eng.utilization > 60 ? t.success : t.textMuted }}>
                      {eng.utilization}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: t.bgInset, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      width: `${eng.utilization}%`, height: "100%",
                      background: eng.utilization > 80 ? t.warning : eng.utilization > 60 ? t.success : t.textMuted,
                    }}/>
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: t.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>출석</span>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: attendanceRate > 80 ? t.success : attendanceRate > 60 ? t.warning : t.danger }}>
                      {eng.attendance}/26일
                    </span>
                  </div>
                  <div style={{ height: 4, background: t.bgInset, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      width: `${attendanceRate}%`, height: "100%",
                      background: attendanceRate > 80 ? t.success : attendanceRate > 60 ? t.warning : t.danger,
                    }}/>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

// ============================================
// 활동 탭
// ============================================
function ActivityTab({ t }) {
  const getColor = (c) => {
    if (c === "success") return t.success;
    if (c === "warning") return t.warning;
    if (c === "accent") return t.accent;
    if (c === "danger") return t.danger;
    return t.textMuted;
  };

  return (
    <div style={{ padding: "0 20px" }}>
      <Section t={t} title="실시간 활동 로그" icon={<Activity size={13}/>}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 18, top: 8, bottom: 8, width: 1, background: t.border }}/>
          {RECENT_ACTIVITIES.map((act, idx) => {
            const c = getColor(act.color);
            const isUrgent = act.type === "urgent";
            return (
              <div key={idx} style={{ display: "flex", gap: 14, marginBottom: 14, position: "relative" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: isUrgent ? c : t.bg, 
                  border: `2px solid ${c}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, zIndex: 1,
                }}>
                  {isUrgent ? (
                    <AlertTriangle size={14} style={{ color: "white" }}/>
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }}/>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span className="mono" style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{act.time}</span>
                    <span style={{ fontSize: 10, color: c, fontWeight: 700, padding: "1px 6px", background: t.bgInset, borderRadius: 4 }}>
                      {act.engineer}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: 13, color: isUrgent ? c : t.text, 
                    lineHeight: 1.5, fontWeight: isUrgent ? 700 : 400,
                  }}>
                    {act.text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ============================================
// 헬퍼
// ============================================
function Section({ t, title, icon, children }) {
  return (
    <div className="card-fade" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ color: t.textMuted, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function StatusBox({ t, label, count, color }) {
  return (
    <div style={{ background: t.bgInset, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div className="mono" style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>
        {count}
      </div>
      <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

// ============================================
// 메인 앱
// ============================================
export default function AdminApp({ user, onLogout }) {
  const [mode, setMode] = useState("dark");
  const t = THEMES[mode];

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "rgba(10,10,10,0.96)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginBottom: 6, textAlign: "center", fontFamily: "system-ui", fontWeight: 600 }}>
          📊 대표님 대시보드
        </div>
        <div style={{ fontSize: 10, color: "#666", marginBottom: 8, textAlign: "center", fontFamily: "system-ui", lineHeight: 1.5 }}>
          운영 총괄 (모든 권한)
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {Object.entries(THEMES).map(([key, theme]) => {
            const Icon = theme.icon;
            return (
              <button key={key} onClick={() => setMode(key)} style={{
                flex: 1, padding: "10px 8px",
                background: mode === key ? (key === "dark" ? "#221C18" : "#FFFFFF") : "rgba(255,255,255,0.05)",
                color: mode === key ? (key === "dark" ? "#FAF8F5" : "#0A0A0A") : "#888",
                border: mode === key ? `1.5px solid ${theme.accent}` : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "system-ui",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
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
        <AdminDashboard t={t}/>
      </div>
    </div>
  );
}
