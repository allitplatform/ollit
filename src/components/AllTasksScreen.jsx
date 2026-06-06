// 2026-05-27 — 운영자 PWA "전체 작업" 화면 (6원청, usol_n 제외)
// 패턴: UsolNInProgress.jsx 그대로 + 원청 칩 추가 + 기사명 검색.
// 카드: UsolNAssignList.TaskRowOperator 재사용 (principalBadge prop으로 원청 표시).
// 정렬: 취소 맨 아래 / received_at desc — UsolN 과 일관.

import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import {
  fetchAllPrincipalTasks,
  fetchAllPrincipalCounts,
  PRINCIPAL_CHIP_ORDER,
} from "../lib/allPrincipalTasksDb.js";
import { TaskRowOperator } from "./usol_n/UsolNAssignList.jsx";
import { useRealtimeTasks, useRealtimeTable } from "../hooks/useRealtimeSubscription.js";
// 2026-06-06 — 카운트 박스 공용 컴포넌트 (운영자 + 원청 동일).
import { CountBoxes } from "./CountBoxes.jsx";

// 한 번에 fetch — UsolN '전체' 탭과 동일 정책. 6원청 합쳐도 ~수천 건 한도 내.
const ALL_LIMIT = 2000;
const ALL_STATUSES = ["미배정", "배정", "약속대기", "확정", "진행중", "완료", "취소", "visit_only"];

// 상태 칩 7개 (UsolN '전체' 탭 spec 그대로)
const STATUS_FILTERS = [
  { id: "all",         label: "전체",   match: null },
  { id: "unassigned",  label: "미배정", match: "미배정" },
  { id: "assigned",    label: "배정",   match: "배정" },
  { id: "confirmed",   label: "확정",   match: "확정" },
  { id: "in_progress", label: "진행중", match: "진행중" },
  { id: "completed",   label: "완료",   match: "완료" },
  { id: "canceled",    label: "취소",   match: "취소" },
];

// 원청 칩 = "전체" + PRINCIPAL_CHIP_ORDER 6개
const PRINCIPAL_FILTERS = [
  { code: null, label: "전체" },
  ...PRINCIPAL_CHIP_ORDER,
];

export function AllTasksScreen({ onTaskClick, onBack }) {
  const [statusId, setStatusId] = useState("all");
  const [principalCode, setPrincipalCode] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm,  setSearchTerm]  = useState("");
  // 2026-06-06 — 상단 카운트 박스 quickFilter ('todayCreated'|'todayCompleted'|'confirmed'|null).
  //   활성 시 statusId 칩 무시. 같은 박스 재탭 시 해제.
  const [quickFilter, setQuickFilter] = useState(null);
  const [counts, setCounts] = useState({ todayCreated: 0, todayCompleted: 0, confirmed: 0 });

  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  // 2026-05-27 — '전체' 칩일 때만 완료/취소 접기. 각 섹션 독립 토글, 기본 닫힘.
  const [completedOpen, setCompletedOpen] = useState(false);
  const [canceledOpen,  setCanceledOpen]  = useState(false);

  useRealtimeTasks(() => setReloadTick(v => v + 1));
  useRealtimeTable("task_items", () => setReloadTick(v => v + 1));

  // 검색어 debounce 300ms
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // 한 번에 6원청 전체 fetch — 검색은 클라이언트 필터로 일원화.
  //   배경: 서버 OR 매칭은 customer/task_no/address/phone 4필드만 지원 → 기사 이름 검색 X.
  //         → 검색어는 서버에 보내지 X, 전체를 받아 클라이언트에서 5필드 매칭.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFetchError("");
    fetchAllPrincipalTasks({
      // quickFilter 활성 시 statusIn 측 X (RPC 측 우선) — 측 측 측 X 측 측 측.
      statusIn:   quickFilter ? null : ALL_STATUSES,
      quickFilter,
      searchTerm: "",
      limit:      ALL_LIMIT,
      offset:     0,
    })
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setFetchError(res.error || "불러오기 실패");
          setAllTasks([]);
        } else {
          setAllTasks(res.tasks);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadTick, quickFilter]);

  // 2026-06-06 — 상단 카운트 박스 (DB count:exact 3개) — reloadTick 시도 동기 갱신.
  useEffect(() => {
    let alive = true;
    fetchAllPrincipalCounts().then(res => {
      if (alive && res.ok) setCounts(res.counts);
    });
    return () => { alive = false; };
  }, [reloadTick]);

  // 클라이언트 검색 필터 — 5개 필드 includes (대소문자 무시):
  //   customer_name / task_no / address / phone / assignedEngineer
  // 빈 검색어면 allTasks 그대로.
  const searchFiltered = useMemo(() => {
    const kw = searchTerm.trim().toLowerCase();
    if (!kw) return allTasks;
    return allTasks.filter(t => {
      const fields = [
        t.customer_name,
        t.task_no,
        t.address,
        t.phone,
        t.assignedEngineer,
      ];
      return fields.some(f => f && String(f).toLowerCase().includes(kw));
    });
  }, [allTasks, searchTerm]);

  // 칩 카운트 (원청 필터 적용 후 기준 — 상태칩 카운트가 "현재 원청 필터 안에서" 의미)
  const principalScoped = useMemo(() => {
    if (!principalCode) return searchFiltered;
    return searchFiltered.filter(t => t.principalCode === principalCode);
  }, [searchFiltered, principalCode]);

  const statusCounts = useMemo(() => {
    const c = { all: principalScoped.length };
    for (const f of STATUS_FILTERS) {
      if (f.match) c[f.id] = principalScoped.filter(t => t.status === f.match).length;
    }
    return c;
  }, [principalScoped]);

  // 원청 칩 카운트 — 검색·상태와 무관하게 "전체 원청 분포" 보여주면 한쪽만 fix.
  // 사장님 spec: 각 칩 옆 건수. 자연스럽게는 "현재 상태 필터 적용 후" 카운트.
  const statusScoped = useMemo(() => {
    const f = STATUS_FILTERS.find(x => x.id === statusId) || STATUS_FILTERS[0];
    if (!f.match) return searchFiltered;
    return searchFiltered.filter(t => t.status === f.match);
  }, [searchFiltered, statusId]);

  const principalCounts = useMemo(() => {
    const c = { _all: statusScoped.length };
    for (const p of PRINCIPAL_CHIP_ORDER) {
      c[p.code] = statusScoped.filter(t => t.principalCode === p.code).length;
    }
    return c;
  }, [statusScoped]);

  // 최종 표시 (두 필터 + 정렬)
  //   · '전체' 칩: 진행(0) → 완료(1) → 취소(2) 순서 + 각 구간 안 received_at desc.
  //     렌더는 buckets 로 3구간 분리 (완료/취소 접기). displayedTasks 는 카운트/empty 체크용.
  //   · 다른 칩: 그 status 만 필터, received_at desc 평면.
  const displayedTasks = useMemo(() => {
    const f = STATUS_FILTERS.find(x => x.id === statusId) || STATUS_FILTERS[0];
    let base = searchFiltered;
    if (principalCode) base = base.filter(t => t.principalCode === principalCode);
    if (f.match)       base = base.filter(t => t.status === f.match);
    const rankFn = (s) => s === "취소" ? 2 : s === "완료" ? 1 : 0;
    return [...base].sort((a, b) => {
      if (statusId === "all") {
        const rankA = rankFn(a.status);
        const rankB = rankFn(b.status);
        if (rankA !== rankB) return rankA - rankB;
      }
      const ra = a.received_at || "";
      const rb = b.received_at || "";
      return String(rb).localeCompare(String(ra));
    });
  }, [searchFiltered, statusId, principalCode]);

  // '전체' 칩일 때만 3구간 분리. 다른 칩은 null (평면 displayedTasks 사용).
  const buckets = useMemo(() => {
    if (statusId !== "all") return null;
    return {
      ongoing:   displayedTasks.filter(t => t.status !== "완료" && t.status !== "취소"),
      completed: displayedTasks.filter(t => t.status === "완료"),
      canceled:  displayedTasks.filter(t => t.status === "취소"),
    };
  }, [displayedTasks, statusId]);

  const currentStatus = STATUS_FILTERS.find(f => f.id === statusId) || STATUS_FILTERS[0];
  const currentPrincipal = PRINCIPAL_FILTERS.find(p => p.code === principalCode);

  // 원청 라벨 lookup (TaskRowOperator principalBadge 에 표시)
  const principalLabelByCode = useMemo(() => {
    const m = new Map();
    for (const p of PRINCIPAL_CHIP_ORDER) m.set(p.code, p.label);
    return m;
  }, []);

  return (
    <div style={containerStyle}>
      <Header onBack={onBack} count={displayedTasks.length}/>

      <div style={bodyStyle}>
        {/* 2026-06-06 — 상단 카운트 박스 3개 (오늘 접수 / 완료 / 대기).
            클릭 → quickFilter 적용 / 같은 박스 재클릭 또는 '필터 해제' → 해제. */}
        <CountBoxes
          counts={counts}
          selected={quickFilter}
          onSelect={(key) => setQuickFilter(prev => prev === key ? null : key)}
        />

        {quickFilter && (
          <button onClick={() => setQuickFilter(null)} style={{
            marginBottom: 10, padding: "6px 12px",
            background: "transparent",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 8,
            color: "var(--text-secondary)",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>✕ 필터 해제</button>
        )}

        {/* 검색 */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-tertiary, var(--text-secondary))", pointerEvents: "none",
          }}/>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="고객명 / 작업번호 / 주소 / 전화 / 기사 이름 검색"
            style={{
              width: "100%", padding: "10px 12px 10px 32px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text-primary)",
              fontSize: 12, fontWeight: 600,
              fontFamily: "inherit",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        {/* 원청 칩 (전체 + 6개) */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {PRINCIPAL_FILTERS.map(p => {
            const active = principalCode === p.code;
            const cnt = p.code ? (principalCounts[p.code] || 0) : (principalCounts._all || 0);
            return (
              <button
                key={p.code || "_all"}
                onClick={() => setPrincipalCode(p.code)}
                style={chipStyle(active)}
              >
                {p.label} {cnt.toLocaleString()}
              </button>
            );
          })}
        </div>

        {/* 상태 칩 (전체 + 6개) */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map(filter => {
            const active = statusId === filter.id;
            const cnt = statusCounts[filter.id] || 0;
            return (
              <button
                key={filter.id}
                onClick={() => setStatusId(filter.id)}
                style={chipStyle(active)}
              >
                {filter.label} {cnt.toLocaleString()}
              </button>
            );
          })}
        </div>

        <div style={sectionTitleStyle}>
          {currentPrincipal?.label || "전체"} · {currentStatus.label}{" "}
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{displayedTasks.length.toLocaleString()}</span>건
        </div>

        {loading ? (
          <Empty>불러오는 중...</Empty>
        ) : fetchError ? (
          <Empty>⚠️ {fetchError}</Empty>
        ) : displayedTasks.length === 0 ? (
          <Empty>해당 조건의 작업이 없습니다</Empty>
        ) : buckets ? (
          // '전체' 칩 — 진행(펼침) + 완료(접기) + 취소(접기)
          <>
            {buckets.ongoing.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {buckets.ongoing.map(task => (
                  <TaskRowOperator
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick?.(task)}
                    principalBadge={principalLabelByCode.get(task.principalCode) || task.principalCode || ""}
                  />
                ))}
              </div>
            )}
            {buckets.completed.length > 0 && (
              <CollapseSection
                title={`완료 ${buckets.completed.length.toLocaleString()}건`}
                open={completedOpen}
                onToggle={() => setCompletedOpen(v => !v)}
              >
                {buckets.completed.map(task => (
                  <TaskRowOperator
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick?.(task)}
                    principalBadge={principalLabelByCode.get(task.principalCode) || task.principalCode || ""}
                  />
                ))}
              </CollapseSection>
            )}
            {buckets.canceled.length > 0 && (
              <CollapseSection
                title={`취소 ${buckets.canceled.length.toLocaleString()}건`}
                open={canceledOpen}
                onToggle={() => setCanceledOpen(v => !v)}
              >
                {buckets.canceled.map(task => (
                  <TaskRowOperator
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick?.(task)}
                    principalBadge={principalLabelByCode.get(task.principalCode) || task.principalCode || ""}
                  />
                ))}
              </CollapseSection>
            )}
          </>
        ) : (
          // 직접 선택 칩 — 평면 리스트
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {displayedTasks.map(task => (
              <TaskRowOperator
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task)}
                principalBadge={principalLabelByCode.get(task.principalCode) || task.principalCode || ""}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ onBack, count }) {
  return (
    <div style={{
      padding: "14px 16px",
      background: "var(--accent)",
      color: "#fff",
      flexShrink: 0,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "none",
            color: "#fff",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 10px",
            borderRadius: 6,
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >←</button>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.85)",
          marginBottom: 3, fontWeight: 500,
        }}>
          6원청 전체 · 검색·필터
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px",
        }}>
          전체 작업
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>표시</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{count.toLocaleString()}건</div>
      </div>
    </div>
  );
}

function chipStyle(active) {
  return {
    padding: "6px 12px",
    background: active ? "var(--accent)" : "var(--bg-secondary)",
    color: active ? "#fff" : "var(--text-secondary)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 100,
    fontSize: 11, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  };
}

// 완료/취소 접기 섹션 — '전체' 칩에서만 사용. 헤더 클릭 시 토글.
//   클릭 영역 넉넉히 (50대 사용자 spec — padding 12px ≈ 44px 높이).
function CollapseSection({ title, open, onToggle, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          display: "flex", alignItems: "center", gap: 8,
          cursor: "pointer",
          fontFamily: "inherit",
          color: "var(--text-secondary)",
          fontSize: 12, fontWeight: 700,
          textAlign: "left",
        }}
      >
        {open
          ? <ChevronDown  size={16} style={{ flexShrink: 0 }}/>
          : <ChevronRight size={16} style={{ flexShrink: 0 }}/>}
        <span style={{ flex: 1 }}>{title}</span>
      </button>
      {open && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 12,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

const containerStyle = {
  minHeight: "100vh",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  display: "flex", flexDirection: "column",
  overflowX: "hidden",
};

const bodyStyle = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: 16, paddingBottom: 40,
  background: "var(--bg-secondary)",
};

const sectionTitleStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  marginBottom: 8, paddingLeft: 4,
};

export default AllTasksScreen;
