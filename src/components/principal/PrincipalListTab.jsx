// 유솔 포털 — 내 작업 탭 (뷰 A 첫 화면 / 뷰 B 전체 목록)
// 2026-05-23 — 사장님 spec
//   · 뷰 A (기본): 한 줄 통계 + "오늘 작업" 카드 리스트 + "전체 보기" 버튼
//   · 뷰 B: 검색 + 필터 칩 + 전체 작업 리스트 (← 뒤로)
//   · fetch 분리: 뷰 A = 오늘+카운트만 / 뷰 B = 전체 (의도적 진입 시)
//   · KST 기준 오늘 비교 (utils/dateLabel.toKstYmd / todayYmd 사용)
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { filterTasksForPrincipal } from "../../shared/tasks.js";
import { loadTasksForRole as getTasks } from "../../data/tasksDb.js";
import { v14NormalizeTask, v14FindTaskList } from "../../utils/v14Task.js";
import { useRealtimeTasks } from "../../hooks/useRealtimeSubscription.js";
import {
  fetchPrincipalTodayTasks,
  fetchPrincipalStatusCounts,
} from "../../lib/principalDashboardDb.js";

const N_BADGE_COLOR     = "#2E9E54";
const CLEAN_COLOR       = "#378ADD";
const REFRIGERANT_COLOR = "#EF9F27";
const DATE_TIME_COLOR   = "#F2B84B";
const MAGENTA           = "#FF4D9E";
const MAIN_APPLIANCE_KEYWORDS = ["벽걸이", "스탠드", "1way", "2way", "4way", "투인원", "원형", "시스템멀티"];

function getMainItem(task) {
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  let main = items.find(it => (it.orderType || it.order_type) === "본작업");
  if (main) return main;
  main = items.find(it => {
    const a = String(it.appliance || "").trim();
    return MAIN_APPLIANCE_KEYWORDS.some(kw => a.includes(kw));
  });
  return main || null;
}
function getServiceKind(task) { return getMainItem(task) ? "main" : "addon"; }

function getStatusBadge(status) {
  switch (status) {
    case "완료":      return { color: "#1D9E75", bg: "rgba(29,158,117,0.12)" };
    case "확정":      return { color: "#03C75A", bg: "rgba(3,199,90,0.12)" };
    case "진행중":    return { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" };
    case "배정":      return { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" };
    case "미배정":    return { color: "#9CA3AF", bg: "rgba(156,163,175,0.14)" };
    case "취소":      return { color: "#EF4444", bg: "rgba(239,68,68,0.10)" };
    case "visit_only": return { color: "#A855F7", bg: "rgba(168,85,247,0.12)" };
    default:          return { color: "#9CA3AF", bg: "rgba(156,163,175,0.14)" };
  }
}
function getStatusLabel(status) {
  if (status === "visit_only") return "출장비만";
  return status || "—";
}

function formatTime(task) {
  if (task.scheduledTime) return String(task.scheduledTime).slice(0, 5);
  if (task.scheduledAt) {
    const d = new Date(task.scheduledAt);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
  }
  return "—";
}
function formatDate(task) {
  const ymd = task.scheduledDate || task.requestedDate || "";
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${parseInt(m[2])}/${parseInt(m[3])}`;
}

function ChannelBadge({ task }) {
  if (task.principalCode !== "usol_n") return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 16, height: 16, borderRadius: 4,
      background: N_BADGE_COLOR, color: "#fff",
      fontSize: 9, fontWeight: 800, lineHeight: 1, flexShrink: 0,
    }}>N</span>
  );
}
function ServiceIcon({ kind, size = 14 }) {
  if (kind === "addon") return <span style={{ fontSize: size, color: REFRIGERANT_COLOR }}>⚡</span>;
  return <span style={{ fontSize: size, color: CLEAN_COLOR }}>❄️</span>;
}

export function PrincipalListTab({ t, user, principalCodes, onSelect }) {
  const [view, setView] = useState("today");   // 'today' | 'all'
  const [autoFocusSearchOnAll, setAutoFocusSearchOnAll] = useState(false);
  const goToAll = useCallback((focusSearch = false) => {
    setAutoFocusSearchOnAll(focusSearch);
    setView("all");
  }, []);

  // 뷰 A — 오늘 작업 + 카운트
  const [todayTasks, setTodayTasks]   = useState([]);
  const [counts, setCounts]           = useState({ total: 0, inProgress: 0, completed: 0 });
  const [loadingA, setLoadingA]       = useState(true);

  // 뷰 B — 전체 작업
  const [allTasks, setAllTasks]       = useState([]);
  const [loadingB, setLoadingB]       = useState(false);
  const [allLoaded, setAllLoaded]     = useState(false);

  // 뷰 A fetch
  const refetchA = useCallback(async () => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
      setLoadingA(false);
      return;
    }
    setLoadingA(true);
    const [todayRes, countsRes] = await Promise.all([
      fetchPrincipalTodayTasks({ principalCodes }),
      fetchPrincipalStatusCounts({ principalCodes }),
    ]);
    setTodayTasks(todayRes.tasks || []);
    if (countsRes.ok) setCounts(countsRes.counts);
    setLoadingA(false);
  }, [principalCodes]);

  // 뷰 B fetch — 전체
  const refetchB = useCallback(async () => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) return;
    setLoadingB(true);
    try {
      const res = await getTasks("principal", user?.id || "principal", null);
      if (res && res.ok !== false) {
        const { list } = v14FindTaskList(res);
        if (Array.isArray(list)) {
          const normalized = list.map(v14NormalizeTask).filter(Boolean);
          const filtered = filterTasksForPrincipal(normalized, principalCodes);
          setAllTasks(filtered);
          setAllLoaded(true);
        }
      }
    } catch (e) {
      console.error("[PrincipalListTab.refetchB]", e);
    } finally {
      setLoadingB(false);
    }
  }, [principalCodes, user?.id]);

  useEffect(() => {
    refetchA();
  }, [refetchA]);

  useEffect(() => {
    if (view === "all" && !allLoaded) refetchB();
  }, [view, allLoaded, refetchB]);

  // Realtime — 현재 뷰에 맞게 refetch
  useRealtimeTasks(() => {
    if (view === "today") refetchA();
    else { setAllLoaded(false); refetchB(); }
  });

  if (view === "all") {
    return (
      <ViewAll
        tasks={allTasks}
        loading={loadingB}
        autoFocusSearch={autoFocusSearchOnAll}
        onBack={() => { setAutoFocusSearchOnAll(false); setView("today"); }}
        onSelect={onSelect}
      />
    );
  }
  return (
    <ViewToday
      todayTasks={todayTasks}
      counts={counts}
      loading={loadingA}
      onSeeAll={() => goToAll(false)}
      onSearchClick={() => goToAll(true)}
      onSelect={onSelect}
    />
  );
}

// ════════════════════════════════════════════════════════════
// 뷰 A — 첫 화면
// ════════════════════════════════════════════════════════════
function ViewToday({ todayTasks, counts, loading, onSeeAll, onSearchClick, onSelect }) {
  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* 한 줄 통계 */}
      <div style={{
        fontSize: 12, color: "#B5B0A8", fontWeight: 600,
        marginBottom: 12, letterSpacing: 0.2,
      }}>
        전체 <Stat n={counts.total}/> · 진행중 <Stat n={counts.inProgress}/> · 완료 <Stat n={counts.completed}/>
      </div>

      {/* 검색창 (탭 → 뷰 B + autoFocus). 직접 입력 X. */}
      <div onClick={onSearchClick} style={{
        position: "relative", marginBottom: 10, cursor: "pointer",
      }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "#9CA3AF", pointerEvents: "none",
        }}/>
        <input
          type="text"
          readOnly
          tabIndex={-1}
          placeholder="고객명 · 주소 · 작업번호 검색"
          onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); onSearchClick(); }}
          onFocus={(e) => e.currentTarget.blur()}
          style={{
            width: "100%", padding: "10px 12px 10px 32px",
            background: "#161619",
            border: "1px solid #29292F",
            borderRadius: 10,
            color: "var(--text-primary, #FAF8F5)",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", outline: "none",
            cursor: "pointer",
          }}
        />
      </div>

      {/* 전체 작업 보기 버튼 — 검색창 바로 아래 */}
      <button onClick={onSeeAll} style={seeAllButtonStyle}>
        전체 작업 {counts.total.toLocaleString()}건 보기 →
      </button>

      {/* 오늘 작업 섹션 */}
      <div style={{ marginTop: 22, marginBottom: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #FAF8F5)" }}>오늘 작업</span>
        {!loading && (
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>{todayTasks.length}건</span>
        )}
      </div>

      {loading ? (
        <div style={loadingBoxStyle}>불러오는 중...</div>
      ) : todayTasks.length === 0 ? (
        <EmptyToday onSeeAll={onSeeAll}/>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {todayTasks.map(task => (
            <TodayCard key={task.id} task={task} onClick={() => onSelect?.(task)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ n }) {
  return (
    <span style={{ color: "var(--text-primary, #FAF8F5)", fontWeight: 800 }}>
      {(n || 0).toLocaleString()}
    </span>
  );
}

function TodayCard({ task, onClick }) {
  const kind = getServiceKind(task);
  const status = getStatusBadge(task.status);
  const time = formatTime(task);
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  const mainItem = getMainItem(task);
  const displayItem = mainItem || items[0] || {};
  const appliance = displayItem.appliance || task.appliance || "";
  const qty = displayItem.qty || task.qty || 1;
  const otherCount = Math.max(0, items.length - 1);

  return (
    <div onClick={onClick} style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 12,
      padding: "14px 14px 12px",
      cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* 1줄 — 고객명 (큰) + 채널 + 상태 배지 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <ServiceIcon kind={kind} size={16}/>
          <span style={{
            fontSize: 15, fontWeight: 700,
            color: "var(--text-primary, #FAF8F5)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{task.customer || "—"}</span>
          <ChannelBadge task={task}/>
        </div>
        <span style={{
          flexShrink: 0,
          fontSize: 11, fontWeight: 700,
          color: status.color, background: status.bg,
          padding: "3px 9px", borderRadius: 8,
          whiteSpace: "nowrap",
        }}>{getStatusLabel(task.status)}</span>
      </div>

      {/* 2줄 — 기종·지역 */}
      <div style={{ fontSize: 12, color: "#B5B0A8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {appliance || "—"}{qty > 1 ? ` ×${qty}` : ""}{otherCount > 0 ? ` +${otherCount}` : ""}
        {task.region ? ` · ${task.region}` : ""}
      </div>

      {/* 3줄 — 기사·시간 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: "#888" }}>
          {task.assignedEngineer
            ? <span style={{ color: "#ddd" }}>{task.assignedEngineer}</span>
            : <span style={{ color: "#666" }}>기사 미배정</span>}
        </span>
        {time !== "—" && (
          <span style={{ color: DATE_TIME_COLOR, fontWeight: 700 }}>{time}</span>
        )}
      </div>
    </div>
  );
}

function EmptyToday({ onSeeAll }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center",
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>📭</div>
      <div style={{ fontSize: 13, color: "var(--text-primary, #FAF8F5)", fontWeight: 600, marginBottom: 4 }}>
        오늘 예정된 작업이 없어요
      </div>
      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 14 }}>
        전체 작업 목록에서 확인해 보세요
      </div>
      <button onClick={onSeeAll} style={{
        background: "transparent", border: `1px solid ${MAGENTA}`,
        color: MAGENTA, padding: "7px 14px", borderRadius: 100,
        fontSize: 11, fontWeight: 700, fontFamily: "inherit",
        cursor: "pointer",
      }}>전체 보기 →</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 뷰 B — 전체 목록 (옛 PrincipalListTab 동작)
// ════════════════════════════════════════════════════════════
function ViewAll({ tasks, loading, autoFocusSearch, onBack, onSelect }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    if (autoFocusSearch && searchRef.current) {
      // 모바일 키보드 대응 — 마운트 직후 1tick 뒤
      const id = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [autoFocusSearch]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter === "미배정") list = list.filter(x => x.status === "미배정");
    else if (filter === "확정") list = list.filter(x => ["배정", "확정"].includes(x.status));
    else if (filter === "완료") list = list.filter(x => x.status === "완료" || x.status === "visit_only");
    else if (filter === "취소") list = list.filter(x => x.status === "취소");

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(x => {
        const cust = String(x.customer || "").toLowerCase();
        const addr = String(x.address || "").toLowerCase();
        const tno  = String(x.taskNo || x.taskCode || "").toLowerCase();
        return cust.includes(q) || addr.includes(q) || tno.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const ra = a.received_at || a.receivedAt || a.created_at || a.createdAt || "";
      const rb = b.received_at || b.receivedAt || b.created_at || b.createdAt || "";
      return String(rb).localeCompare(String(ra));
    });
  }, [tasks, filter, search]);

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* 헤더 — 뒤로 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8, padding: "6px 8px",
          color: "var(--text-primary, #FAF8F5)",
          cursor: "pointer", display: "flex", alignItems: "center",
          fontFamily: "inherit",
        }}><ArrowLeft size={14}/></button>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #FAF8F5)" }}>전체 작업</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF" }}>
          {loading ? "..." : `${filtered.length} / ${tasks.length}건`}
        </span>
      </div>

      {/* 검색 */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "#9CA3AF", pointerEvents: "none",
        }}/>
        <input
          ref={searchRef}
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="고객명 / 주소 / 작업번호"
          style={{
            width: "100%", padding: "10px 12px 10px 32px",
            background: "var(--bg-secondary, #1A1A1A)",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 10,
            color: "var(--text-primary, #FAF8F5)",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", outline: "none",
          }}
        />
      </div>

      {/* 필터 chip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "all",    label: "전체" },
          { id: "미배정", label: "미배정" },
          { id: "확정",   label: "확정" },
          { id: "완료",   label: "완료" },
          { id: "취소",   label: "취소" },
        ].map(opt => {
          const active = filter === opt.id;
          return (
            <button key={opt.id} onClick={() => setFilter(opt.id)} style={{
              padding: "6px 12px",
              background: active ? MAGENTA : "var(--bg-secondary, #1A1A1A)",
              color: active ? "#fff" : "var(--text-secondary, #B5B0A8)",
              border: `1px solid ${active ? MAGENTA : "var(--border, #2A2A2A)"}`,
              borderRadius: 100, fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>{opt.label}</button>
          );
        })}
      </div>

      {loading && tasks.length === 0 ? (
        <div style={loadingBoxStyle}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          color: "#9CA3AF", fontSize: 12,
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8,
        }}>작업이 없습니다</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((task, idx) => (
            <TaskRow key={task.id || task.taskNo || idx} task={task} onClick={() => onSelect?.(task)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onClick }) {
  const kind = getServiceKind(task);
  const status = getStatusBadge(task.status);
  const time = formatTime(task);
  const date = formatDate(task);
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  const mainItem = getMainItem(task);
  const displayItem = mainItem || items[0] || {};
  const appliance = displayItem.appliance || task.appliance || "";
  const qty = displayItem.qty || task.qty || 1;
  const otherCount = Math.max(0, items.length - 1);
  const applianceText = `(${appliance || "—"}${qty > 1 ? `×${qty}` : ""}${otherCount > 0 ? ` +${otherCount}` : ""})`;
  const timeStr = [date, time !== "—" ? time : ""].filter(Boolean).join(" ");

  return (
    <div onClick={onClick} style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 8,
      padding: "8px 10px",
      display: "flex", alignItems: "center", gap: 8,
      minHeight: 38,
      cursor: "pointer",
    }}>
      <div style={{ flexShrink: 0, width: 14, textAlign: "center" }}>
        <ServiceIcon kind={kind}/>
      </div>
      <span style={{
        flexShrink: 0, fontSize: 12, fontWeight: 500,
        color: "var(--text-primary, #FAF8F5)",
        maxWidth: 90,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{task.customer || "—"}</span>
      <ChannelBadge task={task}/>
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 11, fontWeight: 400, color: "#888",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {applianceText}
        {task.region ? ` · ${task.region}` : ""}
        {timeStr && (<>{" · "}<span style={{ color: DATE_TIME_COLOR, fontWeight: 600 }}>{timeStr}</span></>)}
      </span>
      {task.assignedEngineer && (
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 500,
          color: "#ddd", background: "#2a2a2a",
          padding: "2px 8px", borderRadius: 4,
          whiteSpace: "nowrap",
        }}>{task.assignedEngineer}</span>
      )}
      <span style={{
        flexShrink: 0, fontSize: 10, fontWeight: 700,
        color: status.color, background: status.bg,
        padding: "2px 7px", borderRadius: 8,
        whiteSpace: "nowrap",
      }}>{getStatusLabel(task.status)}</span>
    </div>
  );
}

const seeAllButtonStyle = {
  width: "100%", marginTop: 18, padding: "12px 14px",
  background: "var(--bg-secondary, #1A1A1A)",
  border: "1px solid var(--border, #2A2A2A)",
  borderRadius: 10,
  color: "var(--text-primary, #FAF8F5)",
  fontSize: 12, fontWeight: 700,
  fontFamily: "inherit", cursor: "pointer",
};

const loadingBoxStyle = {
  padding: "40px 20px", textAlign: "center",
  color: "#9CA3AF", fontSize: 12,
};

export default PrincipalListTab;
