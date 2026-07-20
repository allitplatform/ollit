// 2026-06-12 — AdminApp PC 개요 · 작업 검색 (맨 아래 풀폭).
//   사장님 spec — 검색창 + 결과 테이블. 유솔N 포함 전체 작업.
//   검색 필드: 고객명 / 주소 / 기사 / 작업번호 / 상품주문번호(product_order_id).
//   ⚠️ 검색·정산 로직 안 건드림 — apiTasks 그대로 받아 클라이언트 필터.
//   ⚠️ aside 작업상세 mount 는 Chunk 2 (다음 commit) 에서. 이번엔 onTaskClick prop 호출만.
//   ⚠️ 색 토큰 (var(--accent) 다크 #FF1B8D / 라이트 #E91860).

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
// 2026-07-20 — 5종 통일 (SERVICE_KIND_META). 옛 자체 KindBadge/getWorkKind 이분법 폐기.
import { getServiceKindMeta } from "../utils/workTypeKind.js";
// 2026-06-12 — 상태 색 공통 매핑 사용 (사장님 spec — 확정 파랑 / 완료 초록 구분).
import { getTaskStatusColor } from "../utils/taskStatusColor.js";

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

        {/* 2026-06-12 — 네이버 검색창 스타일: 핑크 2px 테두리 + 입력 큼 + 우측 핑크 검색 박스. */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="고객명 · 주소 · 기사 · 작업번호 · 상품주문번호 (유솔N 네이버 주문)"
            style={{
              flex: 1,
              boxSizing: "border-box",
              padding: "16px 18px",
              background: "var(--bg-primary)",
              border: "2px solid var(--accent)",
              borderRight: "none",
              borderRadius: "12px 0 0 12px",
              color: "var(--text-primary)",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <div style={{
            padding: "0 22px",
            background: "var(--accent)",
            border: "2px solid var(--accent)",
            borderRadius: "0 12px 12px 0",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 60,
          }}>
            <Search size={22} strokeWidth={2.5}/>
          </div>
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
          "minmax(110px, 0.9fr) minmax(80px, 0.7fr) minmax(200px, 2.4fr) minmax(70px, 0.7fr) minmax(80px, 0.8fr) auto auto",
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
  // 2026-07-20 — 5종 통일 (SERVICE_KIND_META 사용). workItems[i] main (본작업 우선) → getServiceKindMeta.
  const kindTask = _pickMainWorkTarget(task);
  const kindMeta = getServiceKindMeta(kindTask);

  const statusStyle = getTaskStatusColor(status);

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
        <KindBadge meta={kindMeta}/>
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

// 2026-07-20 — 5종 통일. 옛 이분법 (냉매 vs 세척) 삭제.
//   본작업(orderType='본작업') 우선, 없으면 items[0], 그것도 없으면 task 자체.
//   getServiceKindMeta 가 5종 (cleaning/refrigerant/install/leak/other) 색·라벨·아이콘 반환.
function _pickMainWorkTarget(task) {
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  if (items.length === 0) return task;
  return items.find(it => (it.orderType || it.order_type) === "본작업") || items[0];
}

function KindBadge({ meta }) {
  if (!meta) return <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>—</span>;
  return (
    <span style={{
      padding: "3px 8px",
      fontSize: 10, fontWeight: 800,
      color: meta.color,
      background: `${meta.color}22`,
      borderRadius: 999,
      whiteSpace: "nowrap",
    }}>{meta.icon} {meta.label}</span>
  );
}

export default AdminPcTaskSearchPanel;
