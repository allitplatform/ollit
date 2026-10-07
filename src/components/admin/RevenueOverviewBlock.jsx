// 2026-06-03 — 대시보드 "매출 현황" 블록.
//   사장님 시안: [오늘 / 이번 달] 토글 + 매출 + 전월비 + 구성 막대 + 종류별.
//   드리프트 0 — computeDashboardStats 측측 측측 dataset 사용 (isTrackARemittance + KST).
//   유솔N 세척/추가선택 측측 (= 트랙 B). 측측 측측 측측.
import { useState, useMemo } from "react";
import { todayYmd } from "../../utils/dateLabel.js";
import {
  computeRevenueByYmRange,
  withSubFee,
  getPrevMonthSameDay,
  getMonthStart,
  getPrevMonthStart,
  revenueView,
  fromServerSummary,
} from "../../utils/revenueStats.js";

function fmtKRW(n) { return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`; }
function fmtPct(n, digits = 1) { return `${n.toFixed(digits)}%`; }


export function RevenueOverviewBlock({ t, apiTasks = [], user, onDetailClick, serverSummary = null, serverRanges = null }) {
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
    // 2026-07-14 — Stage 2/3: 서버 집계 우선 → 즉시 렌더. 없으면 클라 계산 fallback.
    //   오늘: serverSummary(Mig 175) / 이번달·전월비: serverRanges(Mig 176).
    const _sv = (o) => (o && o.revenue) ? fromServerSummary(o) : null;
    const curFromServer = (period === "today")
      ? _sv(serverSummary)
      : _sv(serverRanges?.month);
    const prevFromServer = (period === "today")
      ? _sv(serverRanges?.prevSameDay)
      : _sv(serverRanges?.prevMonthToDate);
    return {
      // 서버 요약(직영·원청, track A)에는 협력사 수수료가 없다 → 같은 작업 목록에서 얹는다 (Mig 229).
      current:  curFromServer  ? withSubFee(curFromServer,  apiTasks, curStart,  curEnd,  user) : computeRevenueByYmRange(apiTasks, curStart, curEnd, user),
      previous: prevFromServer ? withSubFee(prevFromServer, apiTasks, prevStart, prevEnd, user) : computeRevenueByYmRange(apiTasks, prevStart, prevEnd, user),
      periodLabel: label,
    };
  }, [apiTasks, user, period, serverSummary, serverRanges]);

  // 2026-10-07 — 화면 값은 revenueView 한 곳에서 만든다 (종목 기준표 순서 · 협력사 공급가 포함).
  const view = revenueView(current);
  const prevView = revenueView(previous);
  const diffPct = prevView.total > 0
    ? ((view.total - prevView.total) / prevView.total) * 100
    : null;

  const total = view.total || 0;
  const denom = total > 0 ? total : 1;
  const engineerPct  = (view.engineer  / denom) * 100;
  const subKeepPct   = (view.subKeep   / denom) * 100;
  const principalPct = (view.principal / denom) * 100;
  const ownerPct     = (view.owner     / denom) * 100;

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

      {/* 2026-10-07 — 맨 위 = 총 거래액(협력사 받은 공급가 포함, 부가세 제외), 그 아래 회사 마진을 가장 크게 */}
      <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 2 }}>총 거래액</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 17, fontWeight: 800, color: t.text, letterSpacing: "-0.5px" }}>
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
          {periodLabel} · {view.count}건
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 700 }}>회사 마진</span>
        <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: t.accent, letterSpacing: "-0.5px" }}>
          {fmtKRW(view.owner)}
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
                 title={`프로 정산 ${fmtKRW(view.engineer)}`}/>
          )}
          {subKeepPct > 0 && (
            <div style={{ width: `${subKeepPct}%`, background: "#A78BFA" }}
                 title={`협력사 정산 ${fmtKRW(view.subKeep)}`}/>
          )}
          {principalPct > 0 && (
            <div style={{ width: `${principalPct}%`, background: "#F59E0B" }}
                 title={`원청 수수료 ${fmtKRW(view.principal)}`}/>
          )}
          {ownerPct > 0 && (
            <div style={{ width: `${ownerPct}%`, background: t.accent }}
                 title={`회사 마진 ${fmtKRW(view.owner)}`}/>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 10 }}>
          <Legend color="#3B82F6"   label="프로 정산"   amount={view.engineer}  t={t}/>
          {view.subKeep > 0 && <Legend color="#A78BFA" label="협력사 정산" amount={view.subKeep} t={t}/>}
          <Legend color="#F59E0B"   label="원청 수수료" amount={view.principal} t={t}/>
          <Legend color={t.accent}  label="회사 마진"   amount={view.owner}     t={t}/>
        </div>
        {view.subKeep > 0 && (
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 6 }}>ⓘ 협력사 정산은 협력사가 갖는 금액입니다 (회사 돈 아님)</div>
        )}
        {view.vat > 0 && (
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>ⓘ 부가세 {fmtKRW(view.vat)} 은 따로 받은 금액이라 거래액 · 마진 · 정산에 넣지 않았습니다</div>
        )}
      </div>

      {/* 종류별 */}
      <div>
        <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 6 }}>
          종류별
        </div>
        {/* 2026-10-07 — 종목 기준표(serviceCatalog) 순서로 그린다. 0원 종목은 숨김. 새 종목이 생기면 자동으로 붙는다. */}
        {view.services.map(sv => (
          <ServiceBar key={sv.key} t={t} label={sv.label} icon={sv.icon} amount={sv.total} pct={(sv.total / denom) * 100} color={sv.color}/>
        ))}
        {view.services.length === 0 && (
          <div style={{ fontSize: 11, color: t.textMuted, padding: "4px 0" }}>완료된 작업이 없습니다</div>
        )}
        {/* 2026-10-06 Mig 229 — 협력사 수수료 (회사 수입에 포함된 금액). 받은 금액은 참고(거래액). */}
        {(current.subFee || 0) !== 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary }}>협력사 수수료 · {current.subCount}건</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
              {fmtKRW(current.subFee)}
              <span style={{ fontSize: 10, fontWeight: 600, color: t.textMuted }}> (거래액 {fmtKRW(current.subGross)})</span>
            </span>
          </div>
        )}
        {/* 2026-10-07 Mig 244 — 원청 몫 (회사 수입에 포함되지 않는 금액). 위 협력사 수수료는 이 금액을 뺀 회사 몫이다. */}
        {(current.subShare || 0) !== 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary }}>원청 몫 <span style={{ fontWeight: 600, color: t.textMuted }}>(회사 수입 아님)</span></span>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary }}>{fmtKRW(current.subShare)}</span>
          </div>
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
