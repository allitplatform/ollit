// 2026-06-12 — AdminApp PC 개요 · 작업 검색 (맨 아래 풀폭).
//   사장님 spec — 검색창 + 결과 테이블. 유솔N 포함 전체 작업.
//   검색 필드: 고객명 / 주소 / 기사 / 작업번호 / 상품주문번호(product_order_id).
//   ⚠️ 검색·정산 로직 안 건드림 — apiTasks 그대로 받아 클라이언트 필터.
//   ⚠️ aside 작업상세 mount 는 Chunk 2 (다음 commit) 에서. 이번엔 onTaskClick prop 호출만.
//   ⚠️ 색 토큰 (var(--accent) 다크 #FF1B8D / 라이트 #E91860).

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { isRefrigerant } from "../utils/workTypeKind.js";

// 세척 / 냉매 / 기타 종류별 색.
const COLOR_CLEANING    = "#0EA5E9";
const COLOR_REFRIGERANT = "#FFB800";

// 상태별 색 (옛 패턴 차용 — 옛 EngineerCalendarTab 등).
const STATUS_COLOR = {
  "미배정":   { color: "var(--accent)",       bg: "var(--accent-bg)" },
  "배정":     { color: "#3B82F6",             bg: "rgba(59,130,246,0.10)" },
  "약속대기":  { color: "#3B82F6",             bg: "rgba(59,130,246,0.10)" },
  "확정":     { color: "#10B981",             bg: "rgba(16,185,129,0.10)" },
  "진행중":   { color: "#F59E0B",             bg: "rgba(245,158,11,0.10)" },
  "완료":     { color: "#10B981",             bg: "rgba(16,185,129,0.10)" },
  "취소":     { color: "#EF4444",             bg: "rgba(239,68,68,0.10)" },
  "visit_only": { color: "#9CA3AF",           bg: "rgba(156,163,175,0.10)" },
};

// 결과 상한 — 너무 많이 표시하면 dashboard 느려짐.
const RESULT_LIMIT = 100;

export function AdminPcTaskSearchPanel({ apiTasks = [], onTaskClick }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // debounce 300ms (옛 AllTasksScreen 동일 패턴)
  useEffect(() => {
    const id = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(id);
  }, [input]);

  // 검색 결과 — 클라이언트 필터.
  //   haystack = 고객/주소/기사/작업번호/상품주문번호.
  //   상품주문번호는 task.workItems[i].productOrderId 에 있음 (v14Task.js line 102).
  const results = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    const matched = [];
    for (const t of apiTasks) {
      if (!t) continue;
      const productOrderIds = Array.isArray(t.workItems)
        ? t.workItems.map(it => it?.productOrderId || it?.product_order_id || "").filter(Boolean).join(" ")
        : "";
      const haystack = [
        t.customer, t.customerName, t.고객명,
        t.address, t.지역, t.region, t.district,
        t.engineer, t.assignedEngineer, t.engineerName,
        t.taskCode, t.task_no, t.id, t.작업번호,
        productOrderIds,
        t.product_order_id, t.productOrderId,
      ].filter(Boolean).join(" ").toLowerCase();
      if (haystack.includes(q)) matched.push(t);
      if (matched.length >= RESULT_LIMIT + 1) break;  // limit + 1 (truncated 표시용)
    }
    return matched;
  }, [apiTasks, query]);

  const truncated = results.length > RESULT_LIMIT;
  const visible   = truncated ? results.slice(0, RESULT_LIMIT) : results;

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      {/* 헤더 + 검색창 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{
          fontSize: 14, fontWeight: 800, color: "var(--text-primary)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          🔍 작업 검색
          <span style={{
            fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
            marginLeft: "auto",
          }}>
            {query
              ? (truncated ? `${RESULT_LIMIT}+ 건 — 검색어 더 좁히기` : `${results.length}건`)
              : "고객 · 주소 · 기사 · 작업번호 · 상품주문번호"}
          </span>
        </div>

        <div style={{ position: "relative" }}>
          <Search size={16} style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-secondary)",
            pointerEvents: "none",
          }}/>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="고객명 · 주소 · 기사 · 작업번호 · 상품주문번호 (유솔N 네이버 주문)"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px 12px 40px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text-primary)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>
      </div>

      {/* 결과 */}
      {!query ? (
        <SearchHint/>
      ) : visible.length === 0 ? (
        <SearchEmpty query={query}/>
      ) : (
        <ResultTable tasks={visible} onTaskClick={onTaskClick} truncated={truncated} totalCount={results.length}/>
      )}
    </div>
  );
}

function SearchHint() {
  return (
    <div style={{
      padding: "30px 20px",
      textAlign: "center",
      color: "var(--text-secondary)",
      fontSize: 12, fontWeight: 600,
    }}>검색어를 입력하세요 — 유솔N 포함 전체 작업</div>
  );
}

function SearchEmpty({ query }) {
  return (
    <div style={{
      padding: "30px 20px",
      textAlign: "center",
      color: "var(--text-secondary)",
      fontSize: 12, fontWeight: 600,
    }}>
      <div style={{ marginBottom: 4 }}>"{query}" 검색 결과 없음</div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))" }}>
        고객명 · 주소 · 기사 · 작업번호 · 상품주문번호로 검색
      </div>
    </div>
  );
}

function ResultTable({ tasks, onTaskClick, truncated, totalCount }) {
  return (
    <div style={{
      maxHeight: 520,
      overflowY: "auto",
      borderTop: "1px solid var(--border)",
      paddingTop: 10,
    }}>
      {/* 테이블 */}
      <div style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(110px, 0.9fr) minmax(110px, 1.1fr) minmax(140px, 1.5fr) minmax(80px, 0.9fr) minmax(90px, 0.9fr) auto auto",
        rowGap: 2,
        fontVariantNumeric: "tabular-nums",
      }}>
        <HeaderCell>작업번호</HeaderCell>
        <HeaderCell>고객</HeaderCell>
        <HeaderCell>주소</HeaderCell>
        <HeaderCell>기사</HeaderCell>
        <HeaderCell>원청</HeaderCell>
        <HeaderCell>종류</HeaderCell>
        <HeaderCell>상태</HeaderCell>

        {tasks.map(t => (
          <ResultRow key={t.id || t.taskCode || t.task_no} task={t} onClick={() => onTaskClick?.(t)}/>
        ))}
      </div>

      {truncated && (
        <div style={{
          padding: "10px 0 0",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: 11, fontWeight: 600,
        }}>전체 {totalCount}+건 중 {tasks.length}건 표시 — 검색어 더 좁히세요</div>
      )}
    </div>
  );
}

function HeaderCell({ children }) {
  return (
    <div style={{
      padding: "8px 10px",
      fontSize: 11, fontWeight: 700,
      color: "var(--text-secondary)",
      letterSpacing: 0.3,
      textTransform: "uppercase",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      background: "var(--bg-elevated)",
      zIndex: 1,
    }}>{children}</div>
  );
}

function ResultRow({ task, onClick }) {
  const taskNo   = task.taskCode || task.task_no || task.id || "—";
  const customer = task.customer || task.customerName || task.고객명 || "—";
  const address  = task.address || task.지역 || task.region || task.district || "—";
  const engineer = task.engineer || task.assignedEngineer || task.engineerName || "—";
  const principal = task.principalLabel || task.principal || task.principalCode || "—";
  const status   = task.status || task.상태 || "—";
  const kind     = getWorkKind(task);

  const statusStyle = STATUS_COLOR[status] || { color: "var(--text-secondary)", bg: "transparent" };

  return (
    <>
      {/* 한 행 = 7 cells, grid 안에서 contents 자동 분배 */}
      <Cell onClick={onClick}>
        <span className="mono" style={{
          fontSize: 11, fontWeight: 700, color: "var(--text-primary)",
          letterSpacing: "-0.3px",
        }}>{taskNo}</span>
      </Cell>
      <Cell onClick={onClick}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "var(--text-primary)",
        }}>{customer}</span>
      </Cell>
      <Cell onClick={onClick}>
        <span style={{
          fontSize: 11, color: "var(--text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "block",
        }}>{address}</span>
      </Cell>
      <Cell onClick={onClick}>
        <span style={{
          fontSize: 11, color: "var(--text-secondary)",
        }}>{engineer}</span>
      </Cell>
      <Cell onClick={onClick}>
        <span style={{
          fontSize: 11, color: "var(--text-secondary)",
        }}>{principal}</span>
      </Cell>
      <Cell onClick={onClick}>
        <KindBadge kind={kind}/>
      </Cell>
      <Cell onClick={onClick}>
        <span style={{
          padding: "3px 8px",
          fontSize: 10, fontWeight: 800,
          color: statusStyle.color,
          background: statusStyle.bg,
          borderRadius: 999,
          whiteSpace: "nowrap",
        }}>{status}</span>
      </Cell>
    </>
  );
}

function Cell({ children, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: "10px",
      borderBottom: "1px solid var(--border)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      minWidth: 0,
      transition: "background 0.1s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-bg)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >{children}</div>
  );
}

// 작업종류 결정 — workItems[i] 중 본작업 (orderType="본작업") 또는 첫 번째.
//   isRefrigerant 로 냉매 감지. 그 외 = 세척 (단순화).
function getWorkKind(task) {
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  if (items.length === 0) {
    // workItems 없으면 task 자체 workType 사용.
    if (isRefrigerant(task)) return "refrigerant";
    if (task.workType || task.appliance) return "cleaning";
    return "other";
  }
  const main = items.find(it => (it.orderType || it.order_type) === "본작업") || items[0];
  if (isRefrigerant(main) || isRefrigerant(task)) return "refrigerant";
  return "cleaning";
}

function KindBadge({ kind }) {
  if (kind === "refrigerant") {
    return (
      <span style={{
        padding: "3px 8px",
        fontSize: 10, fontWeight: 800,
        color: COLOR_REFRIGERANT,
        background: `${COLOR_REFRIGERANT}22`,
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}>⚡ 냉매</span>
    );
  }
  if (kind === "cleaning") {
    return (
      <span style={{
        padding: "3px 8px",
        fontSize: 10, fontWeight: 800,
        color: COLOR_CLEANING,
        background: `${COLOR_CLEANING}22`,
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}>❄ 세척</span>
    );
  }
  return (
    <span style={{
      fontSize: 10, color: "var(--text-secondary)", fontWeight: 600,
    }}>—</span>
  );
}

export default AdminPcTaskSearchPanel;
