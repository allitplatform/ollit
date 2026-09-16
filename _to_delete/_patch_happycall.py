# -*- coding: utf-8 -*-
# 해피콜 모드 v1 — 운영자 앱 재사용, 돈·관리 숨김
import io, sys

ROOT = "/sessions/rcw-01u4et6pwfchupgdzvaelxyk/mnt/ollit/"

def patch(path, pairs):
    p = ROOT + path
    s = io.open(p, encoding="utf-8").read()
    before = len(s)
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            print("FAIL %s count=%d\n---%s" % (path, n, old[:120])); sys.exit(1)
        s = s.replace(old, new)
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("OK %s (%d -> %d)" % (path, before, len(s)))

# ── App.jsx — happycall → AdminApp (옛 목업 폐기) ──
patch("src/App.jsx", [(
'''      case "happycall":
        return <HappycallApp user={currentUser} onLogout={handleLogout} />;''',
'''      case "happycall":
        // 2026-07-27 — 해피콜 직원 채용 (사장님 확정): 운영자 앱 재사용 + 돈·관리 숨김.
        //   옛 목업 HappycallApp (4월 시연용) 라우팅 폐기 — 파일은 보존.
        return <AdminApp user={currentUser} onLogout={handleLogout} happycallMode />;''')])

# ── AdminApp.jsx ──
A = "src/pages/AdminApp.jsx"

a1 = ('''export default function AdminApp({ user, onLogout, onSwitchRole }) {''',
'''export default function AdminApp({ user, onLogout, onSwitchRole, happycallMode = false }) {''')

# 차단 화면 가드 — pcCtx 정의 직전에 삽입 (screen/setScreen/isPc 사용 가능 위치)
a2 = ('''  const pcCtx = {
    user,''',
'''  // 2026-07-27 — 해피콜 모드: 돈·관리 화면 차단.
  //   경계 (사장님 확정): 견적·총금액 = 보임 / 회사몫·기사몫·정산·통장·손익·설정 = 숨김.
  //   진입로(사이드바·버튼)를 숨기고, 직접 라우팅도 여기서 방어.
  const HAPPYCALL_BLOCKED = new Set([
    "marketing", "usol_n", "settlementHistory", "principalPayout", "revenueReport",
    "revenueDetail", "usolnSettleBoard", "bookkeeping", "cashflow", "mobileBank",
    "mobileProfit", "settlement", "principalAccount", "ratesFees", "settings",
    "notificationSettings", "principalList", "rawOrdersArchive", "announcements",
    "statsHub", "engineerTaskList",
  ]);
  useEffect(() => {
    if (!happycallMode) return;
    if (screen && HAPPYCALL_BLOCKED.has(screen)) { setScreen(null); return; }
    // PC 메인 대시보드는 매출·회사몫 투성이 — 해피콜은 타임라인을 홈으로.
    if (isPc && screen === null) setScreen("pcTimeline");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [happycallMode, screen, isPc]);

  const pcCtx = {
    user,
    happycallMode,   // 2026-07-27 — 사이드바 메뉴 필터용''')

# 모바일 DashboardScreen — 돈·관리 진입로 gating
a3 = ('''      onClickMobileBank={() => setScreen("mobileBank")}
      onClickMobileProfit={() => setScreen("mobileProfit")}
      onClickDocIssue={() => setScreen("docIssue")}
      onClickAnnouncements={() => setScreen("announcements")}
      onClickStats={() => setScreen("statsHub")}
      refrigerantAddonCount={refrigerantAddonCount}
      onClickRevenueDetail={() => setScreen("revenueDetail")}
      onClickSettlement={() => setScreen("settlement")}
      onClickManage={() => setScreen("engineerList")}
      onClickManagePrincipals={() => setScreen("principalList")}
      onClickSettlementHistory={() => setScreen("settlementHistory")}
      onClickSettings={() => setScreen("settings")}
      onClickUsolN={() => setScreen("usol_n")}''',
'''      onClickMobileBank={happycallMode ? undefined : () => setScreen("mobileBank")}
      onClickMobileProfit={happycallMode ? undefined : () => setScreen("mobileProfit")}
      onClickDocIssue={() => setScreen("docIssue")}
      onClickAnnouncements={happycallMode ? undefined : () => setScreen("announcements")}
      onClickStats={happycallMode ? undefined : () => setScreen("statsHub")}
      refrigerantAddonCount={refrigerantAddonCount}
      onClickRevenueDetail={happycallMode ? undefined : () => setScreen("revenueDetail")}
      onClickSettlement={happycallMode ? undefined : () => setScreen("settlement")}
      onClickManage={() => setScreen("engineerList")}
      onClickManagePrincipals={happycallMode ? undefined : () => setScreen("principalList")}
      onClickSettlementHistory={happycallMode ? undefined : () => setScreen("settlementHistory")}
      onClickSettings={happycallMode ? undefined : () => setScreen("settings")}
      onClickUsolN={happycallMode ? undefined : () => setScreen("usol_n")}''')

# DashboardScreen 에 happycallMode 전달 + 시그니처 + 매출 블록 숨김
a4 = ('''        {activeTab === "overview"   && <OverviewTab t={t} user={user}''',
'''        {activeTab === "overview"   && <OverviewTab t={t} user={user}''')
# (OverviewTab 은 handler 부재로 자동 숨김 — 변경 불필요. 위 anchor 는 미사용으로 제거)

a5 = ('''function DashboardScreen({ t, mode, setMode, onLogout, user, onSwitchRole, dynamicStats,''',
'''function DashboardScreen({ happycallMode = false, t, mode, setMode, onLogout, user, onSwitchRole, dynamicStats,''')

a6 = ('''        <RevenueOverviewBlock t={t} apiTasks={apiTasks} user={user} onDetailClick={onClickRevenueDetail} serverSummary={dashSummary} serverRanges={dashRanges}/>''',
'''        {/* 2026-07-27 — 해피콜: 매출 블록 숨김 (회사몫·마진 노출) */}
        {!happycallMode && (
        <RevenueOverviewBlock t={t} apiTasks={apiTasks} user={user} onDetailClick={onClickRevenueDetail} serverSummary={dashSummary} serverRanges={dashRanges}/>
        )}''')

# DashboardScreen 호출부에 happycallMode 전달 — onClickMobileBank 줄 위쪽 아무 prop. 가장 확실한 anchor:
a7 = ('''      onClickRefriAddon={() => setScreen("refrigerantAddonList")}
      onClickEngineerCalendar={() => setScreen("engineerCalendar")}
      onClickMobileBank=''',
'''      onClickRefriAddon={() => setScreen("refrigerantAddonList")}
      onClickEngineerCalendar={() => setScreen("engineerCalendar")}
      happycallMode={happycallMode}
      onClickMobileBank=''')

patch(A, [a1, a2, a3, a5, a6, a7])

# ── AdminPcSidebar.jsx — 그룹 필터 ──
S = "src/pages/AdminPcSidebar.jsx"
s1 = ('''  const currentGroup = SCREEN_TO_GROUP[screen] || "dashboard";''',
'''  // 2026-07-27 — 해피콜 모드: 작업·기사 그룹만 (돈·관리·마케팅 메뉴 숨김).
  //   PC 메인 대시보드(매출 노출)도 숨김 — 해피콜 홈은 타임라인 (AdminApp 가드가 라우팅).
  const happycall = !!(pcCtx && pcCtx.happycallMode);
  const visibleGroups = happycall
    ? GROUPS.filter(g => g.id === "tasks" || g.id === "engineers")
    : GROUPS;

  const currentGroup = SCREEN_TO_GROUP[screen] || "dashboard";''')
s2 = ('''        {GROUPS.map(group => {''',
'''        {visibleGroups.map(group => {''')
patch(S, [s1, s2])
