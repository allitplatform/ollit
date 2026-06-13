// 2026-06-12 — AdminApp PC 사이드바 (7그룹).
//   · 그룹 클릭 → 그 그룹 세부메뉴 펼침. 다른 그룹 누르면 옛 그룹 접힘 (활성 그룹 1개만 열림).
//   · 세부 클릭 → pcCtx.setScreen(item.id) 호출 (기존 setScreen 재사용 — screen 분기 그대로 동작).
//   · screen 외부 변경 시 (예: 메인 카드 클릭 → liveWork) 사이드바 그룹 자동 동기화.
//   · 하단 요약: 오늘 접수 / 미배정 / 오늘 완료. 미배정 > 0 이면 주황 강조.
//   · 상단: OllitMark 로고 + "운영자" 라벨 + 알림 종 (badge).
//   · 색 토큰: var(--accent) / var(--accent-bg) / var(--bg-elevated) / var(--border) 등 — 라이트/다크 자동.

import { useState, useEffect } from "react";
import {
  LayoutDashboard, ListChecks, Wallet, Users, Settings,
  Building2, Network, ChevronDown, ChevronRight, Bell, LogOut, Plus,
} from "lucide-react";
import { OllitMark } from "../components/OllitMark.jsx";

// 그룹 정의 — 7그룹. 각 그룹 안 items.id 가 AdminApp.jsx 의 setScreen() 값과 일치해야 함.
const GROUPS = [
  {
    id: "dashboard",
    label: "대시보드",
    icon: LayoutDashboard,
    items: [
      { id: "main", label: "메인" },
    ],
  },
  {
    id: "tasks",
    label: "작업",
    icon: ListChecks,
    items: [
      // 2026-06-12 — 사장님 spec: 5개로 정리. 상태별 목록은 타임라인/처리흐름이 대체.
      //   사이드바에서 빠진 화면 (liveWork/newReception/assignedList/inProgressList) 자체는 keep —
      //   메인 카드 / 알림 / 옛 흐름 등에서 접근 가능.
      { id: "pcTimeline",     label: "타임라인 (시간축)" },
      { id: "pcTimelineFlow", label: "처리 흐름" },
      { id: "allTasks",       label: "전체 작업" },
      { id: "reassignList",   label: "재배정 요청" },
      { id: "pcRefriPending", label: "냉매 자동배정 대기" },  // → newReception screen + filter="pushing"
    ],
  },
  {
    id: "usolN",
    label: "유솔N",
    icon: Network,
    items: [
      { id: "usol_n", label: "유솔N 화면" },
    ],
  },
  {
    id: "settlement",
    label: "정산",
    icon: Wallet,
    // 2026-06-13 — 사장님 spec: 정산 그룹 4개로 정리.
    //   빠진 화면 (settlement/principal_settlement/refrigerantAddonList) 자체는 keep —
    //   대시보드 카드 / 알림 등에서 접근 가능. SCREEN_TO_GROUP 매핑은 아래에서 "settlement" 그룹으로.
    items: [
      { id: "settlementHistory",     label: "입금 내역 (기사 송금)" },
      { id: "principalPayout",       label: "원청 지급 (회사→원청)" },
      { id: "revenueReport",         label: "매출 리포트" },
      { id: "revenueDetail",         label: "매출 상세" },
    ],
  },
  {
    id: "engineers",
    label: "기사",
    icon: Users,
    // 2026-06-13 사장님 spec — 지역(regionList) 기준정보에서 이동.
    items: [
      { id: "engineerList",          label: "기사 목록" },
      { id: "engineerCalendar",      label: "기사 달력 (주간)" },
      // 2026-06-12 — 월간 달력 (한 기사 × 한 달).
      { id: "engineerCalendarMonth", label: "기사 달력 (월간)" },
      { id: "regionList",            label: "지역" },
    ],
  },
  // 2026-06-13 사장님 spec — 신규 "원청" 카테고리. 기준정보 그룹 해체 후 원청 관련 모두 이쪽.
  //   원청 계좌(principalAccount) 는 placeholder — AdminApp.jsx 분기에서 안내 화면.
  {
    id: "principal",
    label: "원청",
    icon: Building2,
    items: [
      { id: "principalList",      label: "원청 목록" },
      { id: "principalAccount",   label: "원청 계좌" },
      { id: "ratesManagement",    label: "원청 단가" },
      { id: "commissionPolicy",   label: "원청 수수료 정책" },
    ],
  },
  {
    id: "settingsGroup",
    label: "설정",
    icon: Settings,
    items: [
      { id: "userList",              label: "사용자" },
      { id: "companyAccount",        label: "회사 계좌" },
      { id: "notificationSettings",  label: "알림 설정" },
      { id: "settings",              label: "일반" },
    ],
  },
];

// screen → 속한 그룹 id 매핑 (사이드바 활성 그룹 자동 결정용).
const SCREEN_TO_GROUP = (() => {
  const map = {};
  for (const g of GROUPS) {
    for (const it of g.items) map[it.id] = g.id;
  }
  // 2026-06-12 — 사이드바에서 빠진 옛 작업 screen (메인 카드/알림 등으로 진입 시) → 작업 그룹 활성.
  map.liveWork       = "tasks";
  map.newReception   = "tasks";
  map.assignedList   = "tasks";
  map.inProgressList = "tasks";
  // 2026-06-13 — 사이드바에서 빠진 옛 정산 screen → 정산 그룹 활성.
  map.settlement            = "settlement";
  map.principal_settlement  = "settlement";
  map.refrigerantAddonList  = "settlement";
  // 2026-06-13 v2 — 옛 기준정보 그룹 해체. 외부 진입(설정 카드 등)에서도 새 그룹으로 동기화.
  //   principalList / ratesManagement / commissionPolicy → "principal"
  //   regionList → "engineers"
  map.principalList     = "principal";
  map.principalAccount  = "principal";
  map.ratesManagement   = "principal";
  map.commissionPolicy  = "principal";
  map.regionList        = "engineers";
  return map;
})();

export function AdminPcSidebar({ t, pcCtx, width = 260 }) {
  const {
    screen, setScreen, onLogout,
    unreadCount = 0,
    sidebarSummary = { todayReceived: 0, unassigned: 0, todayCompleted: 0 },
  } = pcCtx || {};

  const currentGroup = SCREEN_TO_GROUP[screen] || "dashboard";
  const [openGroup, setOpenGroup] = useState(currentGroup);

  // screen 외부 변경 시 (예: 메인 카드 클릭, 알림 클릭) 활성 그룹 자동 동기화.
  useEffect(() => {
    const g = SCREEN_TO_GROUP[screen];
    if (g) setOpenGroup(g);
  }, [screen]);

  function handleGroupClick(groupId) {
    setOpenGroup(prev => prev === groupId ? null : groupId);
  }
  function handleItemClick(itemId) {
    // 2026-06-12 — 특별 항목 (실제 screen 아닌, pcCtx handler 호출).
    if (itemId === "pcRefriPending") {
      if (typeof pcCtx?.onClickRefriPending === "function") pcCtx.onClickRefriPending();
      return;
    }
    if (typeof setScreen === "function") setScreen(itemId);
  }

  return (
    <aside style={{
      width,
      flexShrink: 0,
      background: "var(--bg-elevated)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      position: "sticky",
      top: 0,
      height: "100vh",
      overflowY: "auto",
    }}>
      {/* 상단 — 로고 + "운영자" 라벨 + 알림 */}
      <div style={{
        padding: "18px 16px 14px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <OllitMark size={26}/>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--text-secondary)", letterSpacing: 1.5,
            textTransform: "uppercase",
          }}>운영자</span>
        </div>
        <button onClick={() => handleItemClick("notifications")} aria-label="알림"
          style={{
            position: "relative",
            background: "transparent", border: "none",
            cursor: "pointer", padding: 6,
            color: "var(--text-secondary)",
          }}>
          <Bell size={18}/>
          {unreadCount > 0 && (
            <span style={{
              position: "absolute", top: 0, right: 0,
              minWidth: 14, height: 14, padding: "0 4px",
              background: "var(--accent)", color: "#fff",
              borderRadius: 7, fontSize: 9, fontWeight: 700,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </button>
      </div>

      {/* 2026-06-12 — 새 작업 만들기 풀폭 핑크 버튼 (사장님 spec — 맨 위, 항상 보임). */}
      {typeof pcCtx?.onClickAddReception === "function" && (
        <button onClick={pcCtx.onClickAddReception}
          style={{
            margin: "12px 12px 4px",
            padding: "12px 14px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13, fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            letterSpacing: "-0.2px",
          }}>
          <Plus size={16} strokeWidth={2.8}/>
          <span>새 작업 만들기</span>
        </button>
      )}

      {/* 메뉴 — 5그룹 */}
      <nav style={{
        flex: 1,
        padding: "10px 8px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}>
        {GROUPS.map(group => {
          const Icon = group.icon;
          const isOpen = openGroup === group.id;
          const containsActive = group.items.some(it => it.id === screen);

          return (
            <div key={group.id}>
              <button onClick={() => handleGroupClick(group.id)}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  background: containsActive ? "var(--accent-bg)" : "transparent",
                  border: "none",
                  color: containsActive ? "var(--accent)" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: containsActive ? 800 : 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  borderRadius: 8,
                  textAlign: "left",
                }}>
                <Icon size={18}/>
                <span style={{ flex: 1 }}>{group.label}</span>
                {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              </button>
              {isOpen && (
                <div style={{
                  paddingLeft: 14, paddingTop: 2,
                  display: "flex", flexDirection: "column", gap: 2,
                }}>
                  {group.items.map(item => {
                    const active = screen === item.id;
                    return (
                      <button key={item.id} onClick={() => handleItemClick(item.id)}
                        style={{
                          padding: "7px 12px 7px 24px",
                          background: active ? "var(--accent-bg)" : "transparent",
                          border: "none",
                          borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}`,
                          borderRadius: 6,
                          color: active ? "var(--accent)" : "var(--text-primary)",
                          fontSize: 12,
                          fontWeight: active ? 800 : 500,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                        }}>{item.label}</button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 하단 요약 — 오늘 접수 / 미배정 / 오늘 완료 */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <SidebarStat label="오늘 접수"  value={sidebarSummary.todayReceived  || 0}/>
        <SidebarStat label="미배정"    value={sidebarSummary.unassigned     || 0} warn={(sidebarSummary.unassigned || 0) > 0}/>
        <SidebarStat label="오늘 완료"  value={sidebarSummary.todayCompleted || 0}/>
      </div>

      {/* 로그아웃 */}
      {typeof onLogout === "function" && (
        <button onClick={onLogout}
          style={{
            padding: "12px 16px",
            background: "transparent",
            border: "none",
            borderTop: "1px solid var(--border)",
            color: "var(--text-secondary)",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            textAlign: "left",
            display: "flex", alignItems: "center", gap: 10,
          }}>
          <LogOut size={16}/>
          <span>로그아웃</span>
        </button>
      )}
    </aside>
  );
}

function SidebarStat({ label, value, warn }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
      <span style={{
        fontSize: 14, fontWeight: 800,
        color: warn ? "var(--orange)" : "var(--text-primary)",
      }}>{value}</span>
    </div>
  );
}

export default AdminPcSidebar;
