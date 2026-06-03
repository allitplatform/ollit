// 2026-06-03 — 매출 자세히 화면 (2차).
//   사장님 시안: 월 선택 + 4요약 + 원청별 표 + 기사별 표.
//   데이터 = RevenueOverviewBlock 측측 측측 dataset (isTrackARemittance + KST).
//   usol_n (트랙 B) 측측 — 측측 측측 일관.
import { useState, useMemo } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { todayYmd } from "../../utils/dateLabel.js";
import {
  computeRevenueByYmRange,
  computeRevenueByPrincipal,
  computeRevenueByEngineer,
  getMonthRange,
} from "../../utils/revenueStats.js";

function fmtKRW(n) { return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`; }

export function RevenueDetailScreen({ t, apiTasks = [], user, onBack }) {
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

        {/* 원청별 표 */}
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

        {/* 기사별 표 */}
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
      </div>
    </div>
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
