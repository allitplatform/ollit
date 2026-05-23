// 유솔 포털 정산 탭 — 네이버 주차 정산 (시안 확정안)
// 2026-05-23
//
// 사장님 spec:
//   · 단위: 항목(task_item), 자기 naver_settled_at 주차에 배치
//   · 금액: subtotal
//   · 주차: ISO 주 (월~일), 라벨 = "M월 N주차" (그 달 첫 주부터 카운트)
//   · 단계: 대기 / 네이버 결제완료 / 회사 입금완료
//   · 냉매 제외 필터 없음 — 추가선택 냉매점검도 일반 항목으로 포함
//   · 전체 현황 섹션 (최상단): 접수→작업 전→완료→정산 대기→정산완료
//   · 입금예정일 = 주차 종료(일) 다음 월요일
//   · 무채 베이스, 포인트 색 4종 (마젠타·초록·파랑·앰버)
import { useState, useMemo, useEffect } from "react";
import { Search, ChevronLeft, Check } from "lucide-react";
import {
  fetchPrincipalSettleItems,
  getSettleStageKey,
  getNaverSettleWeek,
  getItemLabel,
  SETTLE_STAGES,
} from "../../lib/principalSettleDb.js";

// 색 토큰 — 시안 확정
const C_MAGENTA = "#FF4D9E";
const C_GREEN   = "#5DCAA5";
const C_BLUE    = "#6AAAEC";
const C_AMBER   = "#E6A33A";
const C_GRAY    = "#9CA3AF";
const C_DOT     = "#4A4A4A";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "M월 N주차" — 그 달의 첫 주(1일 포함 주)부터 카운트, sunday의 달 기준
function getKoreanWeekLabel(monday, sunday) {
  const year  = sunday.getFullYear();
  const month = sunday.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayDow = firstDay.getDay() || 7;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - (firstDayDow - 1));
  const diff = Math.round((monday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${month + 1}월 ${diff + 1}주차`;
}

// 오늘이 속한 주의 monday (KST 로컬)
function getThisWeekMondayKey() {
  const now = new Date();
  const dow = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow - 1));
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

// 주차 종료 다음 월요일 = 입금예정일
function getNextMonday(sunday) {
  const d = new Date(sunday);
  d.setDate(sunday.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatMD(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatMDWithDow(d) {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

// 주차 상태 — 회사 입금 후 / 전
// 후: 항목 중 하나라도 company_received_at 있음 → MAX(company_received_at)을 입금일로 표시
// 전: naver_settled_at NOT NULL 항목들이 모두 입금 전
function getWeekDepositStatus(items, sunday) {
  let maxCompany = null;
  for (const it of items) {
    if (it.company_received_at) {
      if (!maxCompany || it.company_received_at > maxCompany) maxCompany = it.company_received_at;
    }
  }
  if (maxCompany) {
    const d = new Date(maxCompany);
    return { kind: "done", text: `입금완료 ${formatMD(d)}` };
  }
  const expected = getNextMonday(sunday);
  return { kind: "expected", text: `${formatMDWithDow(expected)} 입금 예정` };
}

export function PrincipalSettleTab({ principalCodes }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 뷰 전환 — list (주차 카드) ↔ detail (드릴인)
  const [selectedWeekKey, setSelectedWeekKey] = useState(null);

  // 드릴인 state
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

  // 전체 현황 수치 — 단위: task_item, 취소 task 제외
  const summary = useMemo(() => {
    const live = items.filter(it => it.task_status !== "취소");
    const before = live.filter(it => ["배정", "확정"].includes(it.task_status));
    const done = live.filter(it => it.task_status === "완료");
    const settled = live.filter(it => it.naver_settled_at);
    const pendingSettle = done.filter(it => !it.naver_settled_at);
    const pendingAmount = pendingSettle.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
    return {
      received:       live.length,
      beforeWork:     before.length,
      doneWork:       done.length,
      settled:        settled.length,
      pendingCount:   pendingSettle.length,
      pendingAmount,
    };
  }, [items]);

  // 주차별 묶음
  const weeks = useMemo(() => {
    const map = new Map();
    const pending = [];
    for (const it of items) {
      const wk = getNaverSettleWeek(it);
      if (!wk) {
        pending.push(it);
        continue;
      }
      if (!map.has(wk.key)) map.set(wk.key, { ...wk, items: [] });
      map.get(wk.key).items.push(it);
    }
    const list = [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
    if (pending.length > 0) {
      list.push({
        key: "pending",
        year: null, week: null, monday: null, sunday: null,
        items: pending,
      });
    }
    return list;
  }, [items]);

  const thisWeekMondayKey = getThisWeekMondayKey();

  if (loading) {
    return <div style={{ padding: "40px 20px", textAlign: "center", color: C_GRAY, fontSize: 12 }}>불러오는 중...</div>;
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

  // 리스트 뷰
  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      <SummarySection summary={summary}/>

      <div style={{ fontSize: 11, color: C_GRAY, margin: "18px 0 10px", fontWeight: 600 }}>
        주차별 정산
      </div>

      {weeks.length === 0 ? (
        <EmptyBox>정산 항목이 없습니다</EmptyBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {weeks.map(wk => (
            <WeekCard
              key={wk.key}
              week={wk}
              isThisWeek={wk.monday && wk.monday.toISOString().slice(0, 10) === thisWeekMondayKey}
              onClick={() => setSelectedWeekKey(wk.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 전체 현황 섹션 — 세로 단계 + 정산 대기 강조 박스
function SummarySection({ summary }) {
  const steps = [
    { key: "received",   label: "접수",            value: summary.received,   green: false },
    { key: "beforeWork", label: "일정 확정·작업 전", value: summary.beforeWork, green: false },
    { key: "doneWork",   label: "작업완료",         value: summary.doneWork,   green: false },
  ];
  return (
    <div style={{
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 12,
      padding: "14px 16px 16px",
    }}>
      <div style={{ fontSize: 11, color: C_GRAY, fontWeight: 600, marginBottom: 10 }}>
        전체 현황
      </div>

      {steps.map((s, idx) => (
        <StepRow key={s.key} {...s} hasLineBelow={true}/>
      ))}

      {/* 정산 대기 강조 박스 — 작업완료와 정산완료 사이 */}
      <div style={{ position: "relative", marginLeft: 4 }}>
        {/* 연결선 (위) */}
        <div style={{
          position: "absolute", left: 5, top: -8, width: 2, height: 18,
          background: C_DOT,
        }}/>
        <div style={{
          marginLeft: 16, marginBottom: 6, marginTop: 10,
          background: "rgba(230,163,58,0.08)",
          borderLeft: `3px solid ${C_AMBER}`,
          borderRadius: 8,
          padding: "10px 12px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C_AMBER, marginBottom: 2 }}>
            정산 대기 {summary.pendingCount}건
          </div>
          <div style={{ fontSize: 11, color: C_GRAY }}>
            작업 끝났는데 네이버 정산 전 · <span style={{ color: C_MAGENTA, fontWeight: 700 }}>
              ₩{summary.pendingAmount.toLocaleString()}
            </span>
          </div>
        </div>
        {/* 연결선 (아래) */}
        <div style={{
          position: "absolute", left: 5, bottom: -8, width: 2, height: 18,
          background: C_DOT,
        }}/>
      </div>

      <StepRow label="정산완료" value={summary.settled} green={true} hasLineBelow={false}/>
    </div>
  );
}

function StepRow({ label, value, green, hasLineBelow }) {
  return (
    <div style={{ position: "relative", marginLeft: 4, paddingLeft: 16, paddingBottom: hasLineBelow ? 14 : 0, minHeight: 22 }}>
      {/* 점 */}
      <div style={{
        position: "absolute", left: 0, top: 6,
        width: 12, height: 12, borderRadius: "50%",
        background: green ? C_GREEN : C_DOT,
        border: green ? `2px solid ${C_GREEN}` : `2px solid ${C_DOT}`,
        boxShadow: green ? `0 0 0 3px rgba(93,202,165,0.18)` : "none",
      }}/>
      {/* 연결선 (아래) */}
      {hasLineBelow && (
        <div style={{
          position: "absolute", left: 5, top: 18, width: 2, height: "calc(100% - 18px)",
          background: C_DOT,
        }}/>
      )}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--text-primary, #FAF8F5)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary, #FAF8F5)", fontFamily: "inherit", lineHeight: 1 }}>
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function WeekCard({ week, isThisWeek, onClick }) {
  const isPending = week.key === "pending";
  const sumSubtotal = week.items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);

  // 정산 대기 묶음 (naver_settled_at NULL) — 별도 UI
  if (isPending) {
    return (
      <div onClick={onClick} style={{
        background: "var(--bg-elevated, #1F1F1F)",
        border: "1px dashed var(--border, #2A2A2A)",
        borderRadius: 10, padding: "12px 14px", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #FAF8F5)" }}>정산 대기</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C_AMBER }}>대기</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: C_GRAY }}>{week.items.length}건</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: C_MAGENTA, fontFamily: "inherit" }}>
            ₩{sumSubtotal.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  const weekLabel = getKoreanWeekLabel(week.monday, week.sunday);
  const dateRange = `${formatMD(week.monday)} ~ ${formatMD(week.sunday)}`;
  const deposit = getWeekDepositStatus(week.items, week.sunday);

  return (
    <div onClick={onClick} style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: `1px solid ${isThisWeek ? C_BLUE : "var(--border, #2A2A2A)"}`,
      borderRadius: 10,
      padding: "12px 14px",
      cursor: "pointer",
      boxShadow: isThisWeek ? `0 0 0 1px ${C_BLUE}55` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #FAF8F5)" }}>{weekLabel}</span>
          <span style={{ fontSize: 11, color: C_GRAY }}>{dateRange}</span>
        </div>
        {deposit.kind === "done" ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: C_GREEN, display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
            <Check size={12} strokeWidth={3}/>{deposit.text}
          </span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: C_BLUE, whiteSpace: "nowrap" }}>
            {deposit.text}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: C_GRAY }}>네이버 정산 {week.items.length}건</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: C_MAGENTA, fontFamily: "inherit", lineHeight: 1 }}>
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

  const dateOptions = useMemo(() => {
    const set = new Set();
    for (const it of week.items) {
      if (it.naver_settled_at) set.add(it.naver_settled_at.slice(0, 10));
    }
    return [...set].sort();
  }, [week.items]);

  const sumSubtotal = filtered.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const isPending = week.key === "pending";

  const headerLabel = isPending
    ? "정산 대기"
    : `${getKoreanWeekLabel(week.monday, week.sunday)}  네이버 정산 ${formatMD(week.monday)}~${formatMD(week.sunday)}`;

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={onBack} style={{
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8, padding: "6px 8px",
          color: "var(--text-primary, #FAF8F5)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 2,
          fontFamily: "inherit", fontSize: 11, fontWeight: 600,
        }}>
          <ChevronLeft size={14}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #FAF8F5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {headerLabel}
          </div>
          <div style={{ fontSize: 10, color: C_GRAY, marginTop: 2 }}>
            {filtered.length}건 · <span style={{ color: C_MAGENTA, fontWeight: 700 }}>₩{sumSubtotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 검색 */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: C_GRAY, pointerEvents: "none",
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

      {!isPending && dateOptions.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <FilterChip active={dateFilter === ""} onClick={() => setDateFilter("")}>전체 날짜</FilterChip>
          {dateOptions.map(d => {
            const md = d.slice(5).replace("-", "/");
            return <FilterChip key={d} active={dateFilter === d} onClick={() => setDateFilter(d)}>{md}</FilterChip>;
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <FilterChip active={stageFilter === "all"} onClick={() => setStageFilter("all")}>전체</FilterChip>
        {SETTLE_STAGES.map(s => (
          <FilterChip key={s.key} active={stageFilter === s.key} onClick={() => setStageFilter(s.key)}>
            {s.dot} {s.label}
          </FilterChip>
        ))}
      </div>

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
      <div style={{ flexShrink: 0, fontSize: 14 }}>{stage.dot}</div>
      <span style={{
        flexShrink: 0,
        fontSize: 12, fontWeight: 500,
        color: "var(--text-primary, #FAF8F5)",
        maxWidth: 80,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{item.customer_name || "—"}</span>
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
      <span style={{
        flexShrink: 0,
        fontSize: 12, fontWeight: 700,
        color: C_MAGENTA,
        fontFamily: "inherit",
      }}>₩{subtotal.toLocaleString()}</span>
    </div>
  );
}

function FilterChip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 10px",
      background: active ? C_MAGENTA : "var(--bg-secondary, #1A1A1A)",
      color: active ? "#fff" : "var(--text-secondary, #B5B0A8)",
      border: `1px solid ${active ? C_MAGENTA : "var(--border, #2A2A2A)"}`,
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
      color: C_GRAY, fontSize: 12,
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 8,
    }}>{children}</div>
  );
}

export default PrincipalSettleTab;
