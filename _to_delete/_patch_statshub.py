import io, sys

ROOT = "/sessions/rcw-01u4et6pwfchupgdzvaelxyk/mnt/ollit/"

def patch(path, pairs):
    p = ROOT + path
    s = io.open(p, encoding="utf-8").read()
    before = len(s)
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            print("FAIL %s anchor count=%d\n---\n%s\n---" % (path, n, old[:200]))
            sys.exit(1)
        s = s.replace(old, new)
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("OK %s (%d -> %d)" % (path, before, len(s)))


# ══════════ RegionStatsScreen.jsx — embedded 모드 ══════════
R = "src/components/admin/RegionStatsScreen.jsx"

r1_old = "export function RegionStatsScreen({ t, apiTasks = [], user, onBack }) {"
r1_new = "export function RegionStatsScreen({ t, apiTasks = [], user, onBack, embedded = false }) {"

r2_old = """    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.text,
      paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
      fontFamily: "'Pretendard', sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text,
          display: "flex", alignItems: "center",
        }} aria-label="뒤로">
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
          📍 지역별 접수 현황
        </div>
      </div>"""
r2_new = """    <div style={{
      minHeight: embedded ? "auto" : "100vh",
      background: t.bg,
      color: t.text,
      paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
      fontFamily: "'Pretendard', sans-serif",
    }}>
      {/* 헤더 — 2026-07-26 embedded (StatsHubScreen 지역별 탭) 시 허브 헤더가 대신함 */}
      {!embedded && (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text,
          display: "flex", alignItems: "center",
        }} aria-label="뒤로">
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
          📍 지역별 접수 현황
        </div>
      </div>
      )}"""

patch(R, [(r1_old, r1_new), (r2_old, r2_new)])


# ══════════ AdminApp.jsx — import + 라우트 + 개요 진입 ══════════
A = "src/pages/AdminApp.jsx"

a1_old = 'import { RegionStatsScreen } from "../components/admin/RegionStatsScreen.jsx";'
a1_new = '''import { RegionStatsScreen } from "../components/admin/RegionStatsScreen.jsx";
// 2026-07-26 — 접수 통계 허브 (원청별 + 지역별 탭, 모바일 개요 진입)
import { StatsHubScreen } from "../components/admin/StatsHubScreen.jsx";'''

a2_old = """  // 2026-07-10 — 지역별 접수 현황 (읽기 전용, tasks + 미처리 inquiries 합산).
  if (screen === "regionStats") {
    return <Shell t={t} toasts={toasts} pcCtx={pcCtx}>
      <RegionStatsScreen t={t} apiTasks={apiTasks} user={user} onBack={goBack}/>
    </Shell>;
  }"""
a2_new = """  // 2026-07-10 — 지역별 접수 현황 (읽기 전용, tasks + 미처리 inquiries 합산).
  if (screen === "regionStats") {
    return <Shell t={t} toasts={toasts} pcCtx={pcCtx}>
      <RegionStatsScreen t={t} apiTasks={apiTasks} user={user} onBack={goBack}/>
    </Shell>;
  }
  // 2026-07-26 — 접수 통계 허브 (원청별 신규 + 지역별 재사용). 개요 탭 📊 진입.
  if (screen === "statsHub") {
    return <Shell t={t} toasts={toasts} pcCtx={pcCtx}>
      <StatsHubScreen t={t} apiTasks={apiTasks} user={user} onBack={goBack}/>
    </Shell>;
  }"""

a3_old = '''      onClickDocIssue={() => setScreen("docIssue")}
      onClickAnnouncements={() => setScreen("announcements")}'''
a3_new = '''      onClickDocIssue={() => setScreen("docIssue")}
      onClickAnnouncements={() => setScreen("announcements")}
      onClickStats={() => setScreen("statsHub")}'''

a4_old = "onClickDocIssue, onClickAnnouncements, onClickSettlement, onClickUrgentAssign,"
a4_new = "onClickDocIssue, onClickAnnouncements, onClickStats, onClickSettlement, onClickUrgentAssign,"

a5_old = "onClickDocIssue={onClickDocIssue} onClickAnnouncements={onClickAnnouncements} onClickInquiries={onClickInquiries}"
a5_new = "onClickDocIssue={onClickDocIssue} onClickAnnouncements={onClickAnnouncements} onClickStats={onClickStats} onClickInquiries={onClickInquiries}"

a6_old = "function OverviewTab({ t, user, totalNew, apiTasks = [], onClickNewReception, onClickLiveWork, onClickAddReception, onClickUsolN, onClickAllTasks, onSearchAllTasks, onClickMobileBank, onClickMobileProfit, onClickDocIssue, onClickAnnouncements, onClickInquiries,"
a6_new = "function OverviewTab({ t, user, totalNew, apiTasks = [], onClickNewReception, onClickLiveWork, onClickAddReception, onClickUsolN, onClickAllTasks, onSearchAllTasks, onClickMobileBank, onClickMobileProfit, onClickDocIssue, onClickAnnouncements, onClickStats, onClickInquiries,"

a7_old = '''            onClickEngMessages && {
              key: "msg", icon: "💬", iconBg: "rgba(124,58,237,0.10)",
              label: "기사 메시지함", sub: "기사 메시지 · 요청",
              badge: engMsgUnread > 0 ? { text: String(engMsgUnread), bg: "#F87171" } : null,
              onClick: onClickEngMessages,
            },'''
a7_new = '''            onClickEngMessages && {
              key: "msg", icon: "💬", iconBg: "rgba(124,58,237,0.10)",
              label: "기사 메시지함", sub: "기사 메시지 · 요청",
              badge: engMsgUnread > 0 ? { text: String(engMsgUnread), bg: "#F87171" } : null,
              onClick: onClickEngMessages,
            },
            // 2026-07-26 — 접수 통계 (원청별 · 지역별). 사장님 A안 확정.
            onClickStats && {
              key: "stats", icon: "📊", iconBg: "rgba(14,165,233,0.10)",
              label: "접수 통계", sub: "원청별 · 지역별 접수량",
              badge: null,
              onClick: onClickStats,
            },'''

patch(A, [(a1_old, a1_new), (a2_old, a2_new), (a3_old, a3_new),
          (a4_old, a4_new), (a5_old, a5_new), (a6_old, a6_new), (a7_old, a7_new)])
