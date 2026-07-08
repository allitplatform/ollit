// 2026-06-03 — 대시보드 "매출 현황" 블록.
//   사장님 시안: [오늘 / 이번 달] 토글 + 매출 + 전월비 + 구성 막대 + 종류별.
//   드리프트 0 — computeDashboardStats 측측 측측 dataset 사용 (isTrackARemittance + KST).
//   유솔N 세척/추가선택 측측 (= 트랙 B). 측측 측측 측측.
import { useState, useMemo } from "react";
import { todayYmd } from "../../utils/dateLabel.js";
import {
  computeRevenueByYmRange,
  getPrevMonthSameDay,
  getMonthStart,
  getPrevMonthStart,
} from "../../utils/revenueStats.js";

function fmtKRW(n) { return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`; }
function fmtPct(n, digits = 1) { return `${n.toFixed(digits)}%`; }

export function RevenueOverviewBlock({ t, apiTasks = [], user, onDetailClick }) {
  const [period, setPeriod] = useState("today"); // 'today' | 'month'

  const { current, previous, periodLabel } = useMemo(() => {
    const today = todayYmd();
    let curStart, curEnd, prevStart, prevEnd, label;
    if (period === "today") {
      curStart = today;
      curEnd   = today;
      prevStart = getPrevMonthSameDay(today);
      prevEnd   = prevStart;
      label = "오늘";
    } else {
      // 이번 달 = 1일 ~ 오늘 (완료된 측측만 의미 있음).
      curStart = getMonthStart(today);
      curEnd   = today;
      // 지난 달 = 1일 ~ 동일일 (같은 기간 비교).
      prevStart = getPrevMonthStart(today);
      prevEnd   = getPrevMonthSameDay(today);
      label = "이번 달";
    }
    return {
      current:  computeRevenueByYmRange(apiTasks, curStart, curEnd, user),
      previous: computeRevenueByYmRange(apiTasks, prevStart, prevEnd, user),
      periodLabel: label,
    };
  }, [apiTasks, user, period]);

  // 전월비 (= 같은 기간).
  const diffPct = previous.total > 0
    ? ((current.total - previous.total) / previous.total) * 100
    : null;

  const total = current.total || 0;
  const denom = total > 0 ? total : 1; // pct 측측 측측 0 측측 측측.

  const engineerPct  = (current.engineer  / denom) * 100;
  const principalPct = (current.principal / denom) * 100;
  const ownerPct     = (current.owner     / denom) * 100;

  const cleaningPct    = (current.byService.cleaning    / denom) * 100;
  const refrigerantPct = (current.byService.refrigerant / denom) * 100;
  // 2026-06-28 — install/leak 버킷 분리 (Mig 122/124/125 활성화 반영).
  const installPct     = ((current.byService.install || 0) / denom) * 100;
  const leakPct        = ((current.byService.leak    || 0) / denom) * 100;
  const otherPct       = (current.byService.other       / denom) * 100;

  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      padding: "14px 14px 12px",
      marginBottom: 14,
    }}>
      {/* 헤더 + 토글 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>
          📊 매출 현황
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "today", label: "오늘" },
            { id: "month", label: "이번 달" },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              style={{
                padding: "4px 10px",
                background: period === opt.id ? t.accent : "transparent",
                border: `1px solid ${period === opt.id ? t.accent : t.border}`,
                borderRadius: 999,
                color: period === opt.id ? "#fff" : t.textSecondary,
                fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* 매출 + 전월비 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: t.accent, letterSpacing: "-0.5px" }}>
          {fmtKRW(total)}
        </span>
        {diffPct !== null && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: diffPct >= 0 ? "#10B981" : "#EF4444",
          }}>
            {diffPct >= 0 ? "▲" : "▼"} {Math.abs(diffPct).toFixed(1)}% 전월비
          </span>
        )}
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginLeft: "auto" }}>
          {periodLabel} · {current.count}건
        </span>
      </div>

      {/* 매출 구성 가로막대 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>
          매출 구성
        </div>
        <div style={{
          display: "flex", height: 16, borderRadius: 4, overflow: "hidden",
          background: t.bgInset, marginBottom: 8,
        }}>
          {engineerPct > 0 && (
            <div style={{ width: `${engineerPct}%`, background: "#3B82F6" }}
                 title={`프로 정산 ${fmtKRW(current.engineer)}`}/>
          )}
          {principalPct > 0 && (
            <div style={{ width: `${principalPct}%`, background: "#F59E0B" }}
                 title={`원청 수수료 ${fmtKRW(current.principal)}`}/>
          )}
          {ownerPct > 0 && (
            <div style={{ width: `${ownerPct}%`, background: t.accent }}
                 title={`회사 마진 ${fmtKRW(current.owner)}`}/>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 10 }}>
          <Legend color="#3B82F6"   label="프로 정산"   amount={current.engineer}  t={t}/>
          <Legend color="#F59E0B"   label="원청 수수료" amount={current.principal} t={t}/>
          <Legend color={t.accent}  label="회사 마진"   amount={current.owner}     t={t}/>
        </div>
      </div>

      {/* 종류별 */}
      <div>
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>
          종류별
        </div>
        <ServiceBar t={t} label="세척" icon="❄" amount={current.byService.cleaning}    pct={cleaningPct}    color="#0EA5E9"/>
        <ServiceBar t={t} label="냉매" icon="⚡" amount={current.byService.refrigerant} pct={refrigerantPct} color="#FFB800"/>
        {/* 2026-06-28 — install/leak 행 추가. 0 이면 숨김 (other 패턴 일관). */}
        {(current.byService.install || 0) > 0 && (
          <ServiceBar t={t} label="설치" icon="🔧" amount={current.byService.install} pct={installPct} color="#8B5CF6"/>
        )}
        {(current.byService.leak || 0) > 0 && (
          <ServiceBar t={t} label="누설/누수" icon="💧" amount={current.byService.leak} pct={leakPct} color="#DC2626"/>
        )}
        {current.byService.other > 0 && (
          <ServiceBar t={t} label="기타" icon="•" amount={current.byService.other} pct={otherPct} color={t.textMuted}/>
        )}
      </div>

      {/* 2026-06-03 — 측측 측측 (= 매출 자세히 screen). onDetailClick 측측 측측 측측 측측 측측 X. */}
      {typeof onDetailClick === "function" && (
        <button
          type="button"
          onClick={onDetailClick}
          style={{
            width: "100%", marginTop: 12,
            padding: "9px 12px",
            background: "transparent",
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            color: t.textSecondary,
            fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}
        >
          원청별 · 기사별 자세히 →
        </button>
      )}
    </div>
  );
}

function Legend({ color, label, amount, t }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 8, height: 8, background: color, borderRadius: 2, flexShrink: 0 }}/>
      <span style={{ color: t.textSecondary, fontWeight: 600 }}>{label}</span>
      <span className="mono" style={{ color: t.text, fontWeight: 700 }}>{fmtKRW(amount)}</span>
    </span>
  );
}

function ServiceBar({ label, icon, amount, pct, color, t }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginBottom: 3, fontSize: 11,
      }}>
        <span style={{ color: t.text, fontWeight: 700 }}>
          <span style={{ marginRight: 4 }}>{icon}</span>{label}
        </span>
        <span className="mono" style={{ color: t.textSecondary, fontWeight: 700 }}>
          ₩{(Number(amount) || 0).toLocaleString("ko-KR")}{" "}
          <span style={{ color: t.textMuted, fontWeight: 600 }}>({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div style={{ height: 6, background: t.bgInset, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color }}/>
      </div>
    </div>
  );
}

export default RevenueOverviewBlock;
