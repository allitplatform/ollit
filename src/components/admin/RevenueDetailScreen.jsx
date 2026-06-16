// 2026-06-03 — 매출 자세히 화면.
//   사장님 시안: 월 선택 + 4요약 + 원청별 + 기사별.
//   2026-06-16 — 작업별 탭 추가 (사장님 spec): 원청별 / 기사별 / 작업별 3뷰.
//     · 작업별: 고객명 / 원청 / 기사 / 종류 / 매출 / 회사 마진. PC=표 / 모바일=카드.
//     · 작업별 기본 = "오늘" (이번달 토글 별도). 종류 필터(전체/세척/냉매/기타).
//     · 데이터 = getTasksByYmRange (computeRevenueByYmRange 와 동일 필터 → 합계 정합).
//   데이터 = RevenueOverviewBlock 와 동일 dataset (isTrackARemittance + KST).
//   usol_n (트랙 B) 제외 — 정합 일관.
import { useState, useMemo } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { todayYmd } from "../../utils/dateLabel.js";
import { useIsPc } from "../../utils/useIsPc.js";
import {
  computeRevenueByYmRange,
  computeRevenueByPrincipal,
  computeRevenueByEngineer,
  getMonthRange,
  getTasksByYmRange,
  pickServiceCode,
} from "../../utils/revenueStats.js";

function fmtKRW(n) { return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`; }

// 2026-06-16 — service code → 종류 라벨/색.
const SERVICE_KIND = {
  cleaning:    { key: "cleaning",    label: "세척", color: "#0EA5E9" },
  refrigerant: { key: "refrigerant", label: "냉매", color: "#FFB800" },
  other:       { key: "other",       label: "기타", color: "#9CA3AF" },
};
function kindOfTask(task) {
  const code = pickServiceCode(task);
  if (code === "cleaning")    return SERVICE_KIND.cleaning;
  if (code === "refrigerant") return SERVICE_KIND.refrigerant;
  return SERVICE_KIND.other;
}

export function RevenueDetailScreen({ t, apiTasks = [], user, onBack, onTaskClick }) {
  const isPc = useIsPc();
  // 2026-06-16 — 탭 상태 (원청별 / 기사별 / 작업별).
  const [tab, setTab] = useState("principal"); // 'principal' | 'engineer' | 'task'
  // 측측 측측 — default = 측측 KST 측측측.
  const today = todayYmd();
  const [y0, m0] = today.split("-").map(Number);
  const [year, setYear]   = useState(y0);
  const [month, setMonth] = useState(m0);

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else             { setMonth(month - 1); }
  }
  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else              { setMonth(month + 1); }
  }

  const { start: startYmd, end: endYmd } = useMemo(
    () => getMonthRange(year, month),
    [year, month]
  );

  const summary = useMemo(
    () => computeRevenueByYmRange(apiTasks, startYmd, endYmd, user),
    [apiTasks, startYmd, endYmd, user]
  );
  const byPrincipal = useMemo(
    () => computeRevenueByPrincipal(apiTasks, startYmd, endYmd, user),
    [apiTasks, startYmd, endYmd, user]
  );
  const byEngineer = useMemo(
    () => computeRevenueByEngineer(apiTasks, startYmd, endYmd, user),
    [apiTasks, startYmd, endYmd, user]
  );

  // 2026-06-16 — 작업별 탭 상태 (period: 오늘 / 이번달 / 종류 필터: 전체/세척/냉매/기타).
  //   기본 '오늘' — 사장님 spec.
  const [taskPeriod, setTaskPeriod] = useState("today"); // 'today' | 'month'
  const [taskKind,   setTaskKind]   = useState("all");   // 'all' | 'cleaning' | 'refrigerant' | 'other'

  // 작업별 탭의 기간 — 오늘 = todayYmd~todayYmd, 이번달 = 선택된 월 범위.
  const { taskStartYmd, taskEndYmd } = useMemo(() => {
    if (taskPeriod === "today") {
      return { taskStartYmd: today, taskEndYmd: today };
    }
    return { taskStartYmd: startYmd, taskEndYmd: endYmd };
  }, [taskPeriod, today, startYmd, endYmd]);

  // 작업별 리스트 (필터 + 정렬). 합계 검산용.
  const { taskList, taskTotalRevenue, taskTotalOwner } = useMemo(() => {
    const raw = getTasksByYmRange(apiTasks, taskStartYmd, taskEndYmd, user);
    const filtered = taskKind === "all"
      ? raw
      : raw.filter(tk => kindOfTask(tk).key === taskKind);
    const sorted = filtered.slice().sort((a, b) => {
      const aT = Number(a.totalAmount || a.총금액 || a.estimateTotal || 0);
      const bT = Number(b.totalAmount || b.총금액 || b.estimateTotal || 0);
      return bT - aT;
    });
    const sumTotal = sorted.reduce((s, x) => s + Number(x.totalAmount || x.총금액 || x.estimateTotal || 0), 0);
    const sumOwner = sorted.reduce((s, x) => s + Number(x.owner_amount || 0), 0);
    return { taskList: sorted, taskTotalRevenue: sumTotal, taskTotalOwner: sumOwner };
  }, [apiTasks, taskStartYmd, taskEndYmd, user, taskKind]);

  return (
    <div style={{
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
          📊 매출 자세히
        </div>
      </div>

      {/* 월 측측 */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          padding: "10px 14px",
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          marginBottom: 14,
        }}>
          <button onClick={prevMonth} style={navBtnStyle(t)} aria-label="이전 달">
            <ChevronLeft size={18}/>
          </button>
          <div style={{
            fontSize: 15, fontWeight: 800, color: t.text,
            minWidth: 110, textAlign: "center",
          }}>
            {year}년 {month}월
          </div>
          <button onClick={nextMonth} style={navBtnStyle(t)} aria-label="다음 달">
            <ChevronRight size={18}/>
          </button>
        </div>
      </div>

      {/* 4 요약 */}
      <div style={{ padding: "0 16px 4px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <SummaryBox t={t} icon="💰" label="매출"        value={summary.total}     accent/>
          <SummaryBox t={t} icon="📈" label="회사 마진"    value={summary.owner}     accent/>
          <SummaryBox t={t} icon="👷" label="프로 정산"    value={summary.engineer}/>
          <SummaryBox t={t} icon="🤝" label="원청 수수료"  value={summary.principal}/>
        </div>
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 14 }}>
          이 달 측측 측측 측측 {summary.count}건 · 트랙 A 측측 (유솔N 측측/추가선택 제외)
        </div>

        {/* 2026-06-16 — 탭 바 (원청별 / 기사별 / 작업별) */}
        <TabBar t={t} tab={tab} setTab={setTab}/>

        {/* 원청별 표 */}
        {tab === "principal" && (
          <>
            <SectionHeader t={t} title="원청별" sub={`${byPrincipal.length}개 · 매출 내림차순`}/>
            <Table t={t}
              columns={[
                { key: "name",  label: "원청", align: "left"  },
                { key: "count", label: "건수", align: "right" },
                { key: "total", label: "매출", align: "right", format: fmtKRW, accent: true },
                { key: "owner", label: "마진", align: "right", format: fmtKRW },
              ]}
              rows={byPrincipal}
              emptyText="이 달 매출 데이터 없음"
            />
          </>
        )}

        {/* 기사별 표 */}
        {tab === "engineer" && (
          <>
            <SectionHeader t={t} title="기사별" sub={`${byEngineer.length}명 · 정산 내림차순`}/>
            <Table t={t}
              columns={[
                { key: "name",     label: "기사", align: "left"  },
                { key: "count",    label: "건수", align: "right" },
                { key: "engineer", label: "정산", align: "right", format: fmtKRW, accent: true },
              ]}
              rows={byEngineer}
              emptyText="이 달 정산 데이터 없음"
            />
          </>
        )}

        {/* 작업별 — PC=표, 모바일=카드. 기본 '오늘', 종류 필터(전체/세척/냉매/기타). */}
        {tab === "task" && (
          <TaskView
            t={t}
            isPc={isPc}
            tasks={taskList}
            sumTotal={taskTotalRevenue}
            sumOwner={taskTotalOwner}
            period={taskPeriod}
            setPeriod={setTaskPeriod}
            kind={taskKind}
            setKind={setTaskKind}
            onTaskClick={onTaskClick}
          />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 탭 바 (원청별 / 기사별 / 작업별)
// ──────────────────────────────────────────────────────────────────
function TabBar({ t, tab, setTab }) {
  const tabs = [
    { id: "principal", label: "원청별" },
    { id: "engineer",  label: "기사별" },
    { id: "task",      label: "작업별" },
  ];
  return (
    <div style={{
      display: "flex", gap: 4,
      marginBottom: 10,
      borderBottom: `1px solid ${t.border}`,
      paddingBottom: 0,
    }}>
      {tabs.map(opt => {
        const active = tab === opt.id;
        return (
          <button key={opt.id} type="button"
            onClick={() => setTab(opt.id)}
            style={{
              padding: "8px 14px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${active ? t.accent : "transparent"}`,
              color: active ? t.accent : t.textSecondary,
              fontSize: 13, fontWeight: active ? 800 : 600,
              cursor: "pointer", fontFamily: "inherit",
              marginBottom: -1,
            }}>{opt.label}</button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 작업별 뷰 — PC=표 / 모바일=카드. 기간·종류 필터 + 하단 합계.
// ──────────────────────────────────────────────────────────────────
function TaskView({ t, isPc, tasks, sumTotal, sumOwner, period, setPeriod, kind, setKind, onTaskClick }) {
  return (
    <>
      {/* 기간 토글 (오늘 / 이번 달) + 종류 필터 (전체 / 세척 / 냉매 / 기타) */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8,
        marginTop: 4, marginBottom: 10,
        alignItems: "center",
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "today", label: "오늘" },
            { id: "month", label: "이번 달" },
          ].map(opt => {
            const active = period === opt.id;
            return (
              <button key={opt.id} type="button"
                onClick={() => setPeriod(opt.id)}
                style={{
                  padding: "5px 12px",
                  background: active ? t.accent : "transparent",
                  border: `1px solid ${active ? t.accent : t.border}`,
                  borderRadius: 999,
                  color: active ? "#fff" : t.textSecondary,
                  fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>·</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { id: "all",         label: "전체" },
            { id: "cleaning",    label: "세척" },
            { id: "refrigerant", label: "냉매" },
            { id: "other",       label: "기타" },
          ].map(opt => {
            const active = kind === opt.id;
            return (
              <button key={opt.id} type="button"
                onClick={() => setKind(opt.id)}
                style={{
                  padding: "5px 10px",
                  background: active ? (t.bgInset || "rgba(255,255,255,0.06)") : "transparent",
                  border: `1px solid ${active ? t.text : t.border}`,
                  borderRadius: 999,
                  color: active ? t.text : t.textSecondary,
                  fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
        <span style={{
          marginLeft: "auto",
          fontSize: 11, color: t.textMuted, fontWeight: 700,
        }}>
          {tasks.length}건
        </span>
      </div>

      {tasks.length === 0 ? (
        <div style={{
          padding: "30px 14px", textAlign: "center",
          color: t.textMuted, fontSize: 12,
          background: t.bgElevated, border: `1px solid ${t.border}`,
          borderRadius: 10, marginBottom: 14,
        }}>해당 기간 / 종류의 작업이 없음</div>
      ) : isPc ? (
        <TaskTable t={t} tasks={tasks} onTaskClick={onTaskClick}/>
      ) : (
        <TaskCardList t={t} tasks={tasks} onTaskClick={onTaskClick}/>
      )}

      {/* 하단 합계 — 매출현황 총매출 검산용. */}
      {tasks.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr auto auto",
          gap: 16, alignItems: "baseline",
          padding: "12px 14px",
          background: t.bgElevated, border: `1px solid ${t.border}`,
          borderRadius: 10, marginBottom: 14,
          fontVariantNumeric: "tabular-nums",
        }}>
          <span style={{ fontSize: 12, color: t.text, fontWeight: 800 }}>
            합계 ({tasks.length}건)
          </span>
          <span className="mono" style={{
            fontSize: 13, fontWeight: 800, color: t.text,
            letterSpacing: "-0.3px",
          }}>{fmtKRW(sumTotal)}</span>
          <span className="mono" style={{
            fontSize: 13, fontWeight: 800, color: t.accent,
            letterSpacing: "-0.3px", minWidth: 100, textAlign: "right",
          }}>{fmtKRW(sumOwner)}</span>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// 작업별 PC 표 — 고객명 / 원청 / 기사 / 종류(뱃지) / 매출 / 회사 마진(핑크)
// ──────────────────────────────────────────────────────────────────
function TaskTable({ t, tasks, onTaskClick }) {
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, overflow: "hidden", marginBottom: 14,
      fontVariantNumeric: "tabular-nums",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto minmax(0, 1.2fr) minmax(0, 1.2fr)",
        gap: 10,
        padding: "9px 14px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgInset || "rgba(255,255,255,0.02)",
      }}>
        <Th t={t} align="left">고객명</Th>
        <Th t={t} align="left">원청</Th>
        <Th t={t} align="left">기사</Th>
        <Th t={t} align="center">종류</Th>
        <Th t={t} align="right">매출</Th>
        <Th t={t} align="right">회사 마진</Th>
      </div>
      {/* 행 */}
      {tasks.map((task, idx) => {
        const kind = kindOfTask(task);
        const total = Number(task.totalAmount || task.총금액 || task.estimateTotal || 0);
        const owner = Number(task.owner_amount || 0);
        return (
          <button
            key={task.id || idx}
            type="button"
            onClick={() => onTaskClick && onTaskClick(task)}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto minmax(0, 1.2fr) minmax(0, 1.2fr)",
              gap: 10, width: "100%",
              padding: "10px 14px",
              borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
              background: "transparent", border: "none",
              cursor: onTaskClick ? "pointer" : "default",
              fontFamily: "inherit",
              alignItems: "center",
              textAlign: "left",
            }}>
            <Td t={t} align="left" strong>{task.customer || task.customerName || "—"}</Td>
            <Td t={t} align="left">{task.principal || task.principalName || "—"}</Td>
            <Td t={t} align="left">{task.assignedEngineer || task.engineer || "—"}</Td>
            <Td t={t} align="center"><KindBadge kind={kind}/></Td>
            <Td t={t} align="right" mono>{fmtKRW(total)}</Td>
            <Td t={t} align="right" mono accent>{fmtKRW(owner)}</Td>
          </button>
        );
      })}
    </div>
  );
}

function Th({ t, align, children }) {
  return (
    <div style={{
      fontSize: 10, color: t.textMuted, fontWeight: 700,
      letterSpacing: 0.3,
      textAlign: align,
    }}>{children}</div>
  );
}

function Td({ t, align, children, strong, mono, accent }) {
  return (
    <div className={mono ? "mono" : ""} style={{
      fontSize: 12,
      fontWeight: strong ? 800 : 600,
      color: accent ? t.accent : t.text,
      textAlign: align,
      letterSpacing: mono ? "-0.3px" : 0,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      fontVariantNumeric: mono ? "tabular-nums" : "normal",
    }}>{children}</div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 작업별 모바일 카드 — 동일 정보, 카드 형태.
// ──────────────────────────────────────────────────────────────────
function TaskCardList({ t, tasks, onTaskClick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
      {tasks.map((task, idx) => {
        const kind = kindOfTask(task);
        const total = Number(task.totalAmount || task.총금액 || task.estimateTotal || 0);
        const owner = Number(task.owner_amount || 0);
        return (
          <button
            key={task.id || idx}
            type="button"
            onClick={() => onTaskClick && onTaskClick(task)}
            style={{
              background: t.bgElevated,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: "12px 14px",
              cursor: onTaskClick ? "pointer" : "default",
              fontFamily: "inherit",
              textAlign: "left",
              display: "flex", flexDirection: "column", gap: 8,
              fontVariantNumeric: "tabular-nums",
            }}>
            {/* 1줄 — 고객명 + 종류 뱃지 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                flex: 1, minWidth: 0,
                fontSize: 14, fontWeight: 800, color: t.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{task.customer || task.customerName || "—"}</span>
              <KindBadge kind={kind}/>
            </div>
            {/* 2줄 — 원청 · 기사 */}
            <div style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>
              {task.principal || task.principalName || "—"} · {task.assignedEngineer || task.engineer || "—"}
            </div>
            {/* 3줄 — 매출 + 회사 마진 (핑크) */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              paddingTop: 4, borderTop: `1px dashed ${t.border}`,
            }}>
              <div>
                <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginRight: 6 }}>매출</span>
                <span className="mono" style={{
                  fontSize: 13, fontWeight: 800, color: t.text,
                  letterSpacing: "-0.3px",
                }}>{fmtKRW(total)}</span>
              </div>
              <div>
                <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginRight: 6 }}>회사 마진</span>
                <span className="mono" style={{
                  fontSize: 14, fontWeight: 800, color: t.accent,
                  letterSpacing: "-0.3px",
                }}>{fmtKRW(owner)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function KindBadge({ kind }) {
  return (
    <span style={{
      background: `${kind.color}22`,
      color: kind.color,
      fontSize: 10, fontWeight: 800,
      padding: "3px 8px", borderRadius: 999,
      whiteSpace: "nowrap",
    }}>{kind.label}</span>
  );
}

function navBtnStyle(t) {
  return {
    background: "transparent",
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    color: t.text,
    display: "flex", alignItems: "center",
    fontFamily: "inherit",
  };
}

function SummaryBox({ t, icon, label, value, accent }) {
  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>
          {label}
        </span>
      </div>
      <div className="mono" style={{
        fontSize: 17, fontWeight: 800,
        color: accent ? t.accent : t.text,
        letterSpacing: "-0.3px",
      }}>
        {fmtKRW(value)}
      </div>
    </div>
  );
}

function SectionHeader({ t, title, sub }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 8,
      marginTop: 10, marginBottom: 6,
    }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{title}</span>
      {sub && <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{sub}</span>}
    </div>
  );
}

function Table({ t, columns, rows, emptyText }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{
        padding: "18px 14px", textAlign: "center",
        color: t.textMuted, fontSize: 12,
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 10, marginBottom: 14,
      }}>{emptyText}</div>
    );
  }
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, overflow: "hidden", marginBottom: 14,
    }}>
      {/* 측측 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: columns.map(() => "1fr").join(" "),
        gap: 8,
        padding: "8px 12px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgInset || "rgba(255,255,255,0.02)",
      }}>
        {columns.map(c => (
          <div key={c.key} style={{
            fontSize: 10, color: t.textMuted, fontWeight: 700,
            textAlign: c.align || "left",
          }}>{c.label}</div>
        ))}
      </div>
      {/* 측측 */}
      {rows.map((row, idx) => (
        <div key={(row.code || row.id || row.name || idx) + "_" + idx} style={{
          display: "grid",
          gridTemplateColumns: columns.map(() => "1fr").join(" "),
          gap: 8,
          padding: "9px 12px",
          borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
        }}>
          {columns.map(c => {
            const v = row[c.key];
            const text = c.format ? c.format(v) : (v ?? "");
            return (
              <div key={c.key} className={c.format === fmtKRW ? "mono" : ""} style={{
                fontSize: 12, fontWeight: 700,
                color: c.accent ? t.accent : t.text,
                textAlign: c.align || "left",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{text}</div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default RevenueDetailScreen;
