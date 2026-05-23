// 유솔 포털 정산 탭 — 네이버 주차 정산 (단일 화면)
// 2026-05-23
//
// 사장님 spec:
//   · 단위: 항목(task_item), 자기 naver_settled_at 주차에 배치
//   · 금액: subtotal
//   · 주차: ISO 주 (월~일)
//   · 단계: 대기 / 네이버 결제완료 / 회사 입금완료
//   · 냉매 제외 필터 없음 — 추가선택 냉매점검도 일반 항목으로 포함
//   · 뷰 2개: list (주차 카드 리스트) ↔ detail (주차 드릴인)
//
// 디자인:
//   · 주차 카드 = "W21 · 5/19~25 · 상태 · N건 · ₩합계"
//   · 드릴인 = 검색 + 단계 칩 + 항목 행 (PrincipalListTab 스타일 차용)
import { useState, useMemo, useEffect } from "react";
import { Search, ChevronLeft } from "lucide-react";
import {
  fetchPrincipalSettleItems,
  getSettleStageKey,
  getNaverSettleWeek,
  getItemLabel,
  SETTLE_STAGES,
} from "../../lib/principalSettleDb.js";

const N_BADGE_COLOR = "#2E9E54";

// 상태 → 배지 색 (주차 카드)
function getWeekStatusBadge(weekState) {
  // weekState: 'company' (전부 회사 입금완료) / 'naver' (네이버까지) / 'mixed' / 'wait' (전부 대기)
  switch (weekState) {
    case "company": return { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "회사 입금완료" };
    case "naver":   return { color: "#FACC15", bg: "rgba(250,204,21,0.15)", label: "네이버 결제완료" };
    case "mixed":   return { color: "#A855F7", bg: "rgba(168,85,247,0.12)", label: "진행중" };
    default:        return { color: "#9CA3AF", bg: "rgba(156,163,175,0.14)", label: "대기" };
  }
}

function computeWeekState(items) {
  if (items.length === 0) return "wait";
  const stages = new Set(items.map(getSettleStageKey));
  if (stages.size === 1) {
    const only = [...stages][0];
    if (only === "company") return "company";
    if (only === "naver")   return "naver";
    return "wait";
  }
  return "mixed";
}

export function PrincipalSettleTab({ principalCodes }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 뷰 전환 — list (주차 카드 리스트) ↔ detail (주차 드릴인)
  const [selectedWeekKey, setSelectedWeekKey] = useState(null);

  // 드릴인 화면 state
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  // fetch
  useEffect(() => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) return;
    let alive = true;
    setLoading(true);
    setError("");
    fetchPrincipalSettleItems({ principalCodes, monthsBack: 3 })
      .then(res => {
        if (!alive) return;
        if (!res.ok) { setError(res.error || "정산 항목 조회 실패"); setItems([]); }
        else setItems(res.items);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [principalCodes]);

  // 주차별 묶음 — naver_settled_at NOT NULL 항목만 (NULL은 "대기" 묶음)
  const weeks = useMemo(() => {
    const map = new Map();
    const pending = [];
    for (const it of items) {
      const wk = getNaverSettleWeek(it);
      if (!wk) {
        pending.push(it);
        continue;
      }
      if (!map.has(wk.key)) {
        map.set(wk.key, { ...wk, items: [] });
      }
      map.get(wk.key).items.push(it);
    }
    // 최신 주 위
    const list = [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
    if (pending.length > 0) {
      list.push({
        key: "pending",
        year: null, week: null, monday: null, sunday: null,
        monthDay: "정산 대기",
        items: pending,
      });
    }
    return list;
  }, [items]);

  if (loading) {
    return <div style={{ padding: "40px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>불러오는 중...</div>;
  }
  if (error) {
    return <div style={{ padding: "40px 20px", textAlign: "center", color: "#EF4444", fontSize: 12 }}>⚠️ {error}</div>;
  }

  // 드릴인 뷰
  if (selectedWeekKey) {
    const wk = weeks.find(w => w.key === selectedWeekKey);
    if (!wk) {
      setSelectedWeekKey(null);
      return null;
    }
    return (
      <WeekDetailView
        week={wk}
        onBack={() => { setSelectedWeekKey(null); setSearch(""); setStageFilter("all"); setDateFilter(""); }}
        search={search} setSearch={setSearch}
        stageFilter={stageFilter} setStageFilter={setStageFilter}
        dateFilter={dateFilter} setDateFilter={setDateFilter}
      />
    );
  }

  // 리스트 뷰 — 주차 카드
  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10, fontWeight: 600 }}>
        네이버 주차 정산 · 최근 3개월
      </div>

      {weeks.length === 0 ? (
        <EmptyBox>정산 항목이 없습니다</EmptyBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {weeks.map(wk => (
            <WeekCard key={wk.key} week={wk} onClick={() => setSelectedWeekKey(wk.key)}/>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: "#9CA3AF", textAlign: "center" }}>
        {weeks.length}개 주차 / 항목 {items.length}건
      </div>
    </div>
  );
}

function WeekCard({ week, onClick }) {
  const sumSubtotal = week.items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const weekState = computeWeekState(week.items);
  const badge = getWeekStatusBadge(weekState);
  const isPending = week.key === "pending";

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-elevated, #1F1F1F)",
        border: "1px solid var(--border, #2A2A2A)",
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isPending && (
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: "var(--accent-gradient, #FF1B8D)",
              background: "rgba(255,27,141,0.10)",
              padding: "2px 8px", borderRadius: 6,
              letterSpacing: 0.5,
            }}>W{week.week}</span>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #FAF8F5)" }}>
            {isPending ? "정산 대기" : week.monthDay}
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: badge.color, background: badge.bg,
          padding: "2px 7px", borderRadius: 8,
          whiteSpace: "nowrap",
        }}>{badge.label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>{week.items.length}건</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary, #FAF8F5)", fontFamily: "inherit" }}>
          ₩{sumSubtotal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function WeekDetailView({ week, onBack, search, setSearch, stageFilter, setStageFilter, dateFilter, setDateFilter }) {
  const filtered = useMemo(() => {
    let list = week.items;
    if (stageFilter !== "all") {
      list = list.filter(it => getSettleStageKey(it) === stageFilter);
    }
    if (dateFilter) {
      list = list.filter(it => (it.naver_settled_at || "").slice(0, 10) === dateFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(it => {
        const cust = String(it.customer_name || "").toLowerCase();
        const addr = String(it.address || "").toLowerCase();
        const tno  = String(it.task_no || "").toLowerCase();
        const poid = String(it.product_order_id || "").toLowerCase();
        return cust.includes(q) || addr.includes(q) || tno.includes(q) || poid.includes(q);
      });
    }
    return list;
  }, [week.items, stageFilter, dateFilter, search]);

  // 날짜 옵션 (그 주 안 날짜만 노출)
  const dateOptions = useMemo(() => {
    const set = new Set();
    for (const it of week.items) {
      if (it.naver_settled_at) set.add(it.naver_settled_at.slice(0, 10));
    }
    return [...set].sort();
  }, [week.items]);

  const sumSubtotal = filtered.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const isPending = week.key === "pending";

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={onBack} style={{
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8, padding: "6px 8px",
          color: "var(--text-primary, #FAF8F5)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
          fontFamily: "inherit", fontSize: 11, fontWeight: 600,
        }}>
          <ChevronLeft size={14}/>주차 목록
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #FAF8F5)" }}>
            {isPending ? "정산 대기" : `W${week.week} · ${week.monthDay}`}
          </div>
          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
            {filtered.length}건 · ₩{sumSubtotal.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 검색 */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "#9CA3AF", pointerEvents: "none",
        }}/>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="고객명 / 주소 / 작업번호 / 상품주문번호"
          style={{
            width: "100%", padding: "9px 12px 9px 32px",
            background: "var(--bg-secondary, #1A1A1A)",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 10,
            color: "var(--text-primary, #FAF8F5)",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", outline: "none",
          }}
        />
      </div>

      {/* 날짜 필터 (그 주 안 날짜) */}
      {!isPending && dateOptions.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <FilterChip active={dateFilter === ""} onClick={() => setDateFilter("")}>전체 날짜</FilterChip>
          {dateOptions.map(d => {
            const md = d.slice(5).replace("-", "/");
            return (
              <FilterChip key={d} active={dateFilter === d} onClick={() => setDateFilter(d)}>{md}</FilterChip>
            );
          })}
        </div>
      )}

      {/* 단계 칩 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <FilterChip active={stageFilter === "all"} onClick={() => setStageFilter("all")}>전체</FilterChip>
        {SETTLE_STAGES.map(s => (
          <FilterChip key={s.key} active={stageFilter === s.key} onClick={() => setStageFilter(s.key)}>
            {s.dot} {s.label}
          </FilterChip>
        ))}
      </div>

      {/* 항목 리스트 */}
      {filtered.length === 0 ? (
        <EmptyBox>해당 항목이 없습니다</EmptyBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(it => <SettleItemRow key={it.id} item={it}/>)}
        </div>
      )}
    </div>
  );
}

function SettleItemRow({ item }) {
  const stageKey = getSettleStageKey(item);
  const stage = SETTLE_STAGES.find(s => s.key === stageKey) || SETTLE_STAGES[0];
  const label = getItemLabel(item);
  const qty = item.qty || 1;
  const subtotal = Number(item.subtotal) || 0;
  const naverDate = item.naver_settled_at ? item.naver_settled_at.slice(5, 10).replace("-", "/") : "";

  return (
    <div style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border, #2A2A2A)",
      borderLeft: `3px solid ${stage.color}`,
      borderRadius: 8,
      padding: "8px 10px",
      display: "flex", alignItems: "center", gap: 8,
      minHeight: 38,
    }}>
      {/* 단계 dot */}
      <div style={{ flexShrink: 0, fontSize: 14 }}>{stage.dot}</div>

      {/* 고객명 */}
      <span style={{
        flexShrink: 0,
        fontSize: 12, fontWeight: 500,
        color: "var(--text-primary, #FAF8F5)",
        maxWidth: 80,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{item.customer_name || "—"}</span>

      {/* 정보 */}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 11, fontWeight: 400,
        color: "#888",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        ({label}{qty > 1 ? `×${qty}` : ""})
        {item.district ? ` · ${item.district}` : ""}
        {naverDate && (
          <>
            {" · "}
            <span style={{ color: "#F2B84B", fontWeight: 600 }}>{naverDate}</span>
          </>
        )}
      </span>

      {/* 금액 */}
      <span style={{
        flexShrink: 0,
        fontSize: 12, fontWeight: 700,
        color: "var(--text-primary, #FAF8F5)",
        fontFamily: "inherit",
      }}>₩{subtotal.toLocaleString()}</span>
    </div>
  );
}

function FilterChip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 10px",
      background: active ? "var(--accent-gradient, #FF1B8D)" : "var(--bg-secondary, #1A1A1A)",
      color: active ? "#fff" : "var(--text-secondary, #B5B0A8)",
      border: `1px solid ${active ? "var(--accent-gradient, #FF1B8D)" : "var(--border, #2A2A2A)"}`,
      borderRadius: 100,
      fontSize: 11, fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit",
      whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function EmptyBox({ children }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center",
      color: "#9CA3AF", fontSize: 12,
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 8,
    }}>{children}</div>
  );
}

export default PrincipalSettleTab;
