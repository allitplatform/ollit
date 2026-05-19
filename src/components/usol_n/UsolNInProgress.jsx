// Phase 5 Step 0.B — 유솔N · 진행 탭 (DB 전환)
// 2026-05-19
// 변경:
//   - loadTasks() (localStorage) → fetchUsolNTasks() (Supabase)
//   - 1 task = 1 줄 + task_items 측 작업 종류 칩 + 정산 사이클 색상 상태
//   - 페이지네이션 50건/page
//   - status 필터 칩 (DB의 한글 status 측 매핑)
import { useState, useMemo, useEffect } from "react";
import { fetchUsolNTasks, getTaskSettlementColor, getItemSettlementColor, getItemChipLabel } from "../../lib/usolNTasksDb.js";
import { formatYmdHm } from "../../utils/dateLabel.js";

const PAGE_SIZE = 50;

// 필터 ↔ DB status 매핑 (Q-i B안 — DB CHECK는 한글 6개)
const STATUS_FILTERS = [
  { id: "all",         label: "전체",   statuses: ["약속대기", "확정", "진행중", "완료"] },
  { id: "assigned",    label: "배정",   statuses: ["약속대기", "확정"] },
  { id: "in_progress", label: "진행중", statuses: ["진행중"] },
  { id: "completed",   label: "완료",   statuses: ["완료"] },
];

export function UsolNInProgress() {
  const [filterId, setFilterId] = useState("all");
  const [page, setPage]         = useState(0);
  const [searchInput, setSearchInput] = useState(""); // 입력값 (debounce 전)
  const [searchTerm,  setSearchTerm]  = useState(""); // 실제 fetch에 사용 (debounce 후)

  const [tasks, setTasks]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState("");

  const currentFilter = STATUS_FILTERS.find(f => f.id === filterId) || STATUS_FILTERS[0];

  // 검색 입력 debounce — 300ms 후 실제 fetch 트리거 + page reset
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFetchError("");
    fetchUsolNTasks({
      statusIn:   currentFilter.statuses,
      searchTerm: searchTerm,
      limit:      PAGE_SIZE,
      offset:     page * PAGE_SIZE,
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
  }, [filterId, page, searchTerm]);

  function handleFilterChange(id) {
    setFilterId(id);
    setPage(0); // 필터 변경 시 첫 페이지로
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {/* 검색 (사장님 spec — 고객명/작업번호/주소/전화) */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="🔍 고객명 / 작업번호 / 주소 / 전화 검색"
          style={{
            width: "100%", padding: "8px 12px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-primary)",
            fontSize: 12,
            fontFamily: "inherit",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </div>

      {/* 필터 칩 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map(filter => (
          <button
            key={filter.id}
            onClick={() => handleFilterChange(filter.id)}
            style={{
              padding: "5px 10px",
              background: filterId === filter.id ? "rgba(168,85,247,0.15)" : "transparent",
              border: filterId === filter.id ? "1px solid #A855F7" : "1px solid var(--border)",
              color: filterId === filter.id ? "#A855F7" : "var(--text-secondary)",
              fontSize: 10, borderRadius: 12,
              fontWeight: filterId === filter.id ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div style={sectionTitleStyle}>
        {currentFilter.label}{" "}
        <span style={{ color: "#A855F7", fontWeight: 700 }}>{total.toLocaleString()}</span>건
        {totalPages > 1 && (
          <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 6 }}>
            · {page + 1} / {totalPages}p
          </span>
        )}
      </div>

      {loading ? (
        <Empty>불러오는 중...</Empty>
      ) : fetchError ? (
        <Empty>⚠️ {fetchError}</Empty>
      ) : tasks.length === 0 ? (
        <Empty>해당 상태의 작업이 없습니다</Empty>
      ) : (
        tasks.map(task => <TaskRow key={task.id} task={task}/>)
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage}/>
      )}
    </div>
  );
}

// 1 task = 1 줄 (UsolNOrders와 동일 패턴 — 일관성 spec)
function TaskRow({ task }) {
  const taskColor = getTaskSettlementColor(task);
  const items     = task.task_items || [];
  const isCurrentlyWorking = task.status === "진행중";

  return (
    <div style={{
      padding: 12,
      background: isCurrentlyWorking
        ? "rgba(255,27,141,0.10)"
        : "var(--usol-n-card-bg)",
      border: isCurrentlyWorking
        ? "2px solid #FF1B8D"
        : "1px solid var(--usol-n-border)",
      borderLeft: isCurrentlyWorking
        ? "2px solid #FF1B8D"
        : `3px solid ${taskColor.color === "#1D9E75" ? "#1D9E75" :
                       taskColor.color === "#F59E0B" ? "#F59E0B" :
                       taskColor.color === "#FACC15" ? "#FACC15" : "var(--usol-n-border)"}`,
      borderRadius: 10, marginBottom: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12 }}>{taskColor.dot}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{task.customer_name || "—"}</span>
          <StatusBadge status={task.status}/>
        </div>
        <span style={{
          fontSize: 11, fontFamily: "inherit",
          color: isCurrentlyWorking ? "#A855F7" : "var(--text-primary)",
        }}>
          ₩{(task.total_amount || 0).toLocaleString()}
        </span>
      </div>

      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
        {task.task_no || "—"}
        {task.address && (
          <> · {String(task.address).split("(")[0].trim()}</>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
          {items.map(item => {
            const c = getItemSettlementColor(item);
            return (
              <span key={item.id} style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 9,
                color: "var(--text-primary)",
                background: "var(--bg-secondary)",
                border: `1px solid ${c.color}`,
                padding: "2px 6px", borderRadius: 4, fontWeight: 600,
              }}>
                <span style={{ fontSize: 9 }}>{c.dot}</span>
                <span>{getItemChipLabel(item)} ×{item.qty || 1}</span>
              </span>
            );
          })}
        </div>
      )}

      {(task.scheduled_at || task.started_at || task.completed_at) && (
        <div style={{
          fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))",
          marginTop: 4, paddingTop: 4,
          borderTop: "1px dashed var(--border)",
        }}>
          {task.completed_at ? `완료: ${formatYmdHm(task.completed_at)}` :
           task.started_at   ? `시작: ${formatYmdHm(task.started_at)}`   :
           task.scheduled_at ? `예정: ${formatYmdHm(task.scheduled_at)}` : ""}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    "약속대기": { label: "약속대기", color: "#06B6D4" },
    "확정":     { label: "확정",     color: "#06B6D4" },
    "진행중":   { label: "진행중",   color: "#A855F7" },
    "완료":     { label: "완료",     color: "#1D9E75" },
  };
  const it = map[status] || { label: status || "—", color: "var(--text-secondary)" };
  return (
    <span style={{
      fontSize: 9, color: it.color, background: `${it.color}26`,
      padding: "1px 5px", borderRadius: 3,
    }}>{it.label}</span>
  );
}

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
