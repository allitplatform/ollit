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
  Sun, Moon, BookOpen,
} from "lucide-react";
import { OllitMark } from "../components/OllitMark.jsx";

// KST 날짜·시간 포맷터 — 한 번만 만들어 재사용 (Intl 객체 매 tick 생성 방지).
const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
const TIME_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const YMD_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric", month: "2-digit", day: "2-digit",
});
// KST 요일 — Date 의 timezone 변환. en-CA 의 weekday 값 (Mon/Tue) 대신 자체 매핑.
function kstNow() {
  const now = new Date();
  const ymd = YMD_FMT.format(now);                  // "YYYY-MM-DD"
  const time = TIME_FMT.format(now);                // "HH:MM:SS"
  // KST 요일 — toLocaleDateString weekday short
  const kstDateStr = now.toLocaleDateString("en-US", { timeZone: "Asia/Seoul" });
  const kstDate = new Date(kstDateStr);
  const dow = isNaN(kstDate.getTime()) ? "" : KO_DOW[kstDate.getDay()];
  return { ymd, time, dow };
}

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
      // 2026-06-24 — 옛 "냉매 자동배정 대기" 메뉴 제거 (사장님 spec — 해당 기능 미사용 확정).
      //   자리 대신 홈페이지 접수함 진입. screen='inquiries' 자동 라우팅.
      { id: "inquiries",      label: "홈페이지 접수함" },
      // 2026-07-10 — 지역별 접수 현황 (tasks + 미처리 inquiries 합산, 읽기 전용).
      { id: "regionStats",    label: "지역별 접수 현황" },
      // 2026-06-16 — 냉매 미처리 (세척 완료 시 입력된 냉매충전, [냉매 작업 만들기] 대상).
      //   N 배지 표시 — pcCtx.refrigerantAddonCount 사용.
      { id: "refrigerantAddonList", label: "냉매 미처리" },
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
      // 2026-06-14 — 유솔N 정산 현황판 (Mig 130). 작업월별 4단계 + 마진.
      { id: "usolnSettleBoard",      label: "유솔N 정산 현황판" },
      // 2026-06-29 — 정산 현황판 (분배 계산). Mig 155 v6 — 현금/유솔 받을 회사몫/분배 천장.
      { id: "distributionBoard",     label: "정산 현황판 (분배 계산)" },
    ],
  },
  // 2026-06-13 — 가계부 별도 그룹 (정산에서 분리). screen id 'bookkeeping' 그대로.
  {
    id: "bookkeeping",
    label: "가계부",
    icon: BookOpen,
    items: [
      { id: "bookkeeping", label: "가계부" },
      { id: "cashflow",    label: "통장" },
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
      // 2026-07-21 v2 — 사장님 spec: 공지사항/사용자/회사 계좌도 설정 화면 안으로.
      //   사이드바는 "설정" 단일 항목 (대시보드/유솔N 그룹과 같은 패턴).
      //   각 화면 진입은 설정 화면의 "관리" 카드에서. notificationSettings 는 settings 와 동일 화면.
      { id: "settings",              label: "설정" },
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
  // 2026-06-16 — 냉매 미처리는 "작업" 그룹으로 이동 (사이드바 항목 신설).
  map.refrigerantAddonList  = "tasks";
  // 2026-06-13 v2 — 옛 기준정보 그룹 해체. 외부 진입(설정 카드 등)에서도 새 그룹으로 동기화.
  //   principalList / ratesManagement / commissionPolicy → "principal"
  //   regionList → "engineers"
  map.principalList     = "principal";
  map.principalAccount  = "principal";
  map.ratesManagement   = "principal";
  map.commissionPolicy  = "principal";
  map.regionList        = "engineers";
  // 2026-07-21 — 옛 알림 설정 진입 경로 (외부 링크/뒤로가기 잔존분) → 설정 그룹 활성.
  map.notificationSettings = "settingsGroup";
  // 2026-07-21 v2 — 공지/사용자/회사계좌는 설정 화면 "관리" 카드에서 진입 → 설정 그룹 활성 유지.
  map.announcements     = "settingsGroup";
  map.userList          = "settingsGroup";
  map.userEdit          = "settingsGroup";
  map.companyAccount    = "settingsGroup";
  return map;
})();

export function AdminPcSidebar({ t, pcCtx, width = 260 }) {
  const {
    screen, setScreen, onLogout,
    user,
    mode, setMode,
    unreadCount = 0,
    sidebarSummary = { todayReceived: 0, unassigned: 0, todayCompleted: 0 },
    refrigerantAddonCount = 0,
  } = pcCtx || {};

  const currentGroup = SCREEN_TO_GROUP[screen] || "dashboard";
  const [openGroup, setOpenGroup] = useState(currentGroup);

  // screen 외부 변경 시 (예: 메인 카드 클릭, 알림 클릭) 활성 그룹 자동 동기화.
  useEffect(() => {
    const g = SCREEN_TO_GROUP[screen];
    if (g) setOpenGroup(g);
  }, [screen]);

  // 2026-06-13 — KST 실시간 시계 (1초 갱신). 언마운트 시 cleanup.
  const [clock, setClock] = useState(kstNow);
  useEffect(() => {
    const id = setInterval(() => setClock(kstNow()), 1000);
    return () => clearInterval(id);
  }, []);

  // 2026-06-13 — 테마 토글. 기존 setMode("dark"↔"light") 그대로 연결.
  const isDark = mode === "dark";
  function handleToggleTheme() {
    if (typeof setMode === "function") setMode(isDark ? "light" : "dark");
  }

  const userName = (user && (user.name || user.userName)) || "운영자";

  function handleGroupClick(groupId) {
    setOpenGroup(prev => prev === groupId ? null : groupId);
  }
  function handleItemClick(itemId) {
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
      {/* 2026-06-13 — 상단 영역 3줄 (사장님 spec):
          1) 로고 / 테마토글 ☀️🌙 / 🔔 알림
          2) 사용자 실명 크게
          3) KST 날짜(요일) + 시간 (1초 갱신) */}
      <div style={{
        padding: "16px 14px 14px",
        borderBottom: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {/* 1줄 — 로고 좌 / 우측 (테마 토글 + 알림) */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <OllitMark size={24}/>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={handleToggleTheme}
              aria-label={isDark ? "라이트 모드로" : "다크 모드로"}
              title={isDark ? "라이트 모드로" : "다크 모드로"}
              style={{
                background: "transparent", border: "none",
                cursor: "pointer", padding: 6, display: "flex",
                color: "var(--text-secondary)", fontFamily: "inherit",
              }}>
              {isDark ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <button onClick={() => handleItemClick("notifications")} aria-label="알림"
              style={{
                position: "relative",
                background: "transparent", border: "none",
                cursor: "pointer", padding: 6, display: "flex",
                color: "var(--text-secondary)",
              }}>
              <Bell size={16}/>
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
        </div>

        {/* 2줄 — 사용자 실명 */}
        <div style={{
          fontSize: 17, fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.3px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{userName}</div>

        {/* 3줄 — KST 날짜·요일·시간 (1초 갱신) */}
        <div style={{
          display: "flex", alignItems: "baseline", gap: 6,
          fontSize: 11, color: "var(--text-secondary)",
          fontVariantNumeric: "tabular-nums",
        }}>
          <span className="mono" style={{ fontWeight: 700 }}>
            {clock.ymd}{clock.dow ? ` (${clock.dow})` : ""}
          </span>
          <span className="mono" style={{
            fontWeight: 800, color: "var(--text-primary)",
            fontSize: 12,
          }}>{clock.time}</span>
        </div>
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
                    // 2026-06-16 — 항목별 N 배지 (현재: 냉매 미처리만).
                    const badge = item.id === "refrigerantAddonList" && refrigerantAddonCount > 0
                      ? refrigerantAddonCount
                      : null;
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
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {badge != null && (
                          <span style={{
                            minWidth: 18, height: 18, padding: "0 6px",
                            background: "var(--accent)", color: "#fff",
                            borderRadius: 9, fontSize: 10, fontWeight: 800,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontVariantNumeric: "tabular-nums",
                          }}>{badge > 99 ? "99+" : badge}</span>
                        )}
                      </button>
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
