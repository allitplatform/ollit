// Phase 5 Step 0.B — 유솔N · 진행 탭 (DB 전환)
// 2026-05-19
// 2026-05-26 R2-3 — '전체' 탭 (라벨 측 catch) — ViewAll 패턴 측 catch:
//   · 검색바 ViewAll 스타일 (Search icon + 측 catch padding)
//   · 필터칩 측 catch 채움 (accent 측 catch — ViewAll 패턴)
//   · 카드 → TaskRowOperator (UsolNAssignList 측 catch 측 catch — 카드 1곳)
//   · 서버 fetch · 페이징 · status 필터 로직 측 catch (사장님 spec)
import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { fetchUsolNTasks } from "../../lib/usolNTasksDb.js";
import { TaskRowOperator } from "./UsolNAssignList.jsx";
// Phase 5 Step 0.C-9 — realtime subscription
import { useRealtimeTasks, useRealtimeTable } from "../../hooks/useRealtimeSubscription.js";

// 2026-05-27 — 항상 전체 fetch (사장님 spec): 칩 7개 모두 클라이언트 필터 + 카운트.
//   정렬 일관 (취소 맨 아래 / received_at desc), 페이징 미사용.
const ALL_LIMIT = 1000;
const ALL_STATUSES = ["미배정", "배정", "약속대기", "확정", "진행중", "완료", "취소", "visit_only"];

// 2026-05-27 — 칩 7개 (사장님 spec):
//   전체 (필터 해제) / 미배정 / 배정 / 확정 / 진행중 / 완료 / 취소
//   ※ '약속대기' / 'visit_only' 는 별도 칩 없음 — '전체' 에서만 노출.
const STATUS_FILTERS = [
  { id: "all",         label: "전체",   match: null },
  { id: "unassigned",  label: "미배정", match: "미배정" },
  { id: "assigned",    label: "배정",   match: "배정" },
  { id: "confirmed",   label: "확정",   match: "확정" },
  { id: "in_progress", label: "진행중", match: "진행중" },
  { id: "completed",   label: "완료",   match: "완료" },
  { id: "canceled",    label: "취소",   match: "취소" },
];

export function UsolNInProgress({ onTaskClick }) {
  const [filterId, setFilterId] = useState("all");
  const [searchInput, setSearchInput] = useState(""); // 입력값 (debounce 전)
  const [searchTerm,  setSearchTerm]  = useState(""); // 실제 fetch에 사용 (debounce 후)

  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // Phase 5 Step 0.C-9 — realtime subscription
  useRealtimeTasks(() => setReloadTick(v => v + 1));
  useRealtimeTable("task_items", () => setReloadTick(v => v + 1));

  // 검색 입력 debounce — 300ms 후 실제 fetch 트리거
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // 2026-05-27 — 항상 전체 fetch (statusIn 8개 모두) → 칩 카운트·필터·정렬 모두 클라이언트.
  //   사장님 spec: 필터 걸려도 정렬 규칙(취소 맨 아래 / received_at desc) 일관.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFetchError("");
    fetchUsolNTasks({
      statusIn:   ALL_STATUSES,
      searchTerm: searchTerm,
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
  }, [searchTerm, reloadTick]);

  // 칩별 카운트 — fetched 전체 기준
  const counts = useMemo(() => {
    const c = { all: allTasks.length };
    for (const f of STATUS_FILTERS) {
      if (f.match) c[f.id] = allTasks.filter(t => t.status === f.match).length;
    }
    return c;
  }, [allTasks]);

  // 필터 적용 + 정렬 (취소 맨 아래 / received_at desc) — 모든 칩에 일관 적용
  const displayedTasks = useMemo(() => {
    const filter = STATUS_FILTERS.find(f => f.id === filterId) || STATUS_FILTERS[0];
    const base = filter.match
      ? allTasks.filter(t => t.status === filter.match)
      : allTasks;
    return [...base].sort((a, b) => {
      const rankA = a.status === "취소" ? 1 : 0;
      const rankB = b.status === "취소" ? 1 : 0;
      if (rankA !== rankB) return rankA - rankB;
      const ra = a.received_at || "";
      const rb = b.received_at || "";
      return String(rb).localeCompare(String(ra));
    });
  }, [allTasks, filterId]);

  const currentFilter = STATUS_FILTERS.find(f => f.id === filterId) || STATUS_FILTERS[0];

  return (
    <div>
      {/* 검색 (ViewAll 패턴 — Search icon + 측 catch padding) */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "var(--text-tertiary, var(--text-secondary))", pointerEvents: "none",
        }}/>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="고객명 / 작업번호 / 주소 / 전화 검색"
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

      {/* 필터 chip — 7개 + 칩 옆 카운트 (2026-05-27 사장님 spec) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map(filter => {
          const active = filterId === filter.id;
          const cnt = counts[filter.id] || 0;
          return (
            <button
              key={filter.id}
              onClick={() => setFilterId(filter.id)}
              style={{
                padding: "6px 12px",
                background: active ? "var(--accent)" : "var(--bg-secondary)",
                color: active ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 100,
                fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {filter.label} {cnt.toLocaleString()}
            </button>
          );
        })}
      </div>

      <div style={sectionTitleStyle}>
        {currentFilter.label}{" "}
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>{displayedTasks.length.toLocaleString()}</span>건
      </div>

      {loading ? (
        <Empty>불러오는 중...</Empty>
      ) : fetchError ? (
        <Empty>⚠️ {fetchError}</Empty>
      ) : displayedTasks.length === 0 ? (
        <Empty>해당 상태의 작업이 없습니다</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {displayedTasks.map(task => (
            <TaskRowOperator key={task.id} task={task} onClick={() => onTaskClick?.(task)}/>
          ))}
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

const sectionTitleStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  marginBottom: 8, paddingLeft: 4,
};

export default UsolNInProgress;
