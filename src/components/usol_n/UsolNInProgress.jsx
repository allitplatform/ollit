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

const PAGE_SIZE = 50;
// 2026-05-26 — '전체' 측 catch (사장님 spec): usol_n 측 catch ~944건 측 catch 한 번에 fetch + 클라이언트 정렬.
//   취소 측 catch 측 측, received_at desc, 완료 측 catch.
const ALL_LIMIT = 1000;

// 필터 ↔ DB status 매핑 (Q-i B안 — DB CHECK는 한글 6개)
// 2026-05-26 — '전체' statuses: '취소' + 'visit_only' 포함 (사장님 spec — 한 번에).
//   개별 필터(배정/진행중/완료)는 측 측 측 측 측 측 (페이지 측 측 측).
const STATUS_FILTERS = [
  { id: "all",         label: "전체",   statuses: ["미배정", "배정", "약속대기", "확정", "진행중", "완료", "취소", "visit_only"] },
  { id: "assigned",    label: "배정",   statuses: ["배정", "약속대기", "확정"] },
  { id: "in_progress", label: "진행중", statuses: ["진행중"] },
  { id: "completed",   label: "완료",   statuses: ["완료"] },
];

export function UsolNInProgress({ onTaskClick }) {
  const [filterId, setFilterId] = useState("all");
  const [page, setPage]         = useState(0);
  const [searchInput, setSearchInput] = useState(""); // 입력값 (debounce 전)
  const [searchTerm,  setSearchTerm]  = useState(""); // 실제 fetch에 사용 (debounce 후)

  const [tasks, setTasks]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const currentFilter = STATUS_FILTERS.find(f => f.id === filterId) || STATUS_FILTERS[0];

  // Phase 5 Step 0.C-9 — realtime subscription
  useRealtimeTasks(() => setReloadTick(v => v + 1));
  useRealtimeTable("task_items", () => setReloadTick(v => v + 1));

  // 검색 입력 debounce — 300ms 후 실제 fetch 트리거 + page reset
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // 2026-05-26 — '전체' 측 catch 한 번에 측 catch (limit 1000, offset 0). 측 catch 필터는 페이징 그대로.
  const isAllFilter = filterId === "all";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFetchError("");
    fetchUsolNTasks({
      statusIn:   currentFilter.statuses,
      searchTerm: searchTerm,
      limit:      isAllFilter ? ALL_LIMIT : PAGE_SIZE,
      offset:     isAllFilter ? 0 : page * PAGE_SIZE,
    })
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setFetchError(res.error || "불러오기 실패");
          setTasks([]);
          setTotal(0);
        } else {
          setTasks(res.tasks);
          setTotal(res.total);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filterId, page, searchTerm, reloadTick, isAllFilter]);

  function handleFilterChange(id) {
    setFilterId(id);
    setPage(0); // 필터 변경 시 첫 페이지로
  }

  // 2026-05-26 — '전체' 측 catch 클라이언트 정렬: 취소 측 catch 측 측, received_at desc.
  //   사장님 spec — 측 측 측 측 측 측 측 X / 한 번에 한 리스트.
  const sortedTasks = useMemo(() => {
    if (!isAllFilter) return tasks;
    return [...tasks].sort((a, b) => {
      const rankA = a.status === "취소" ? 1 : 0;
      const rankB = b.status === "취소" ? 1 : 0;
      if (rankA !== rankB) return rankA - rankB;
      const ra = a.received_at || "";
      const rb = b.received_at || "";
      return String(rb).localeCompare(String(ra));
    });
  }, [tasks, isAllFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

      {/* 필터 chip — ViewAll 패턴 (측 catch 채움) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map(filter => {
          const active = filterId === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => handleFilterChange(filter.id)}
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
              {filter.label}
            </button>
          );
        })}
      </div>

      <div style={sectionTitleStyle}>
        {currentFilter.label}{" "}
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>{total.toLocaleString()}</span>건
        {/* 2026-05-26 — '전체' 측 catch 페이지 측 X (한 번에 fetch) */}
        {!isAllFilter && totalPages > 1 && (
          <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 6 }}>
            · {page + 1} / {totalPages}p
          </span>
        )}
      </div>

      {loading ? (
        <Empty>불러오는 중...</Empty>
      ) : fetchError ? (
        <Empty>⚠️ {fetchError}</Empty>
      ) : sortedTasks.length === 0 ? (
        <Empty>해당 상태의 작업이 없습니다</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sortedTasks.map(task => (
            <TaskRowOperator key={task.id} task={task} onClick={() => onTaskClick?.(task)}/>
          ))}
        </div>
      )}

      {/* 2026-05-26 — '전체' 측 catch Pagination 측 X (한 번에 fetch) */}
      {!isAllFilter && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage}/>
      )}
    </div>
  );
}

// 2026-05-26 R2-3 — 옛 TaskRow / StatusBadge 측 catch (UsolNAssignList.TaskRowOperator 측 catch 통일).

function Pagination({ page, totalPages, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14 }}>
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        style={pageBtnStyle(page === 0)}
      >← 이전</button>
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        style={pageBtnStyle(page >= totalPages - 1)}
      >다음 →</button>
    </div>
  );
}

function pageBtnStyle(disabled) {
  return {
    padding: "6px 12px",
    background: disabled ? "transparent" : "var(--bg-secondary)",
    border: "1px solid var(--border)", borderRadius: 6,
    color: disabled ? "var(--text-tertiary, var(--text-secondary))" : "var(--text-primary)",
    fontSize: 11, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", opacity: disabled ? 0.5 : 1,
  };
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
