// 2026-07-26 — 접수 통계 허브 (모바일 개요 탭 📊 진입).
//   탭 2개: [원청별] 신규 (이 파일) / [지역별] 기존 RegionStatsScreen 재사용 (embedded).
//   원청별 산식 = AdminPcDashboard AdminPcTodayByPrincipal 과 동일, 기간만 확장:
//     · 접수     = created_at KST in range + status !== "취소" (트랙 무관 count)
//     · 완료     = completed_at KST in range + status === "완료" (트랙 무관 count)
//     · 회사 몫  = 완료 건 owner_amount 합 (gross, 운영비 전 — "이익" 아님)
//       ⚠️ usol_n 은 트랙 B (월정산) → 금액 미확정, "월정산" 표시 + 합계 제외.
//   ⚠️ 접수/완료 는 독립 집계 (이번주 접수한 게 이번주 완료 아님).
//   ⚠️ 읽기 전용. 정산 트리거 무손.

import React, { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import { RegionStatsScreen } from "./RegionStatsScreen.jsx";

// 표시 순서·색 — receptionForm.js PRINCIPALS 색과 동기 (수동 복사).
const PRINCIPAL_ORDER = [
  { code: "allday",  name: "올데이케어",      color: "#FF1B8D" },
  { code: "KA",      name: "에어컨프로 (KA)", color: "#06B6D4" },
  { code: "KB",      name: "쿨가이 (KB)",     color: "#0891B2" },
  { code: "yongin",  name: "용인컴퍼니",      color: "#FFB800" },
  { code: "usol_h",  name: "유솔홈케어 H",    color: "#10B981" },
  { code: "usol_n",  name: "유솔홈케어 N",    color: "#03C75A" },
  { code: "crikrin", name: "크리크린",        color: "#7F77DD" },
];
const USOLN_CODE = "usol_n";

const PERIOD_OPTS = [
  { id: "today", label: "오늘" },
  { id: "week",  label: "이번주" },
  { id: "month", label: "이번달" },
  { id: "all",   label: "전체" },
];

function _startOfWeekMonYmd() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function _startOfMonthYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function _range(period) {
  const today = todayYmd();
  if (period === "today") return { start: today,               end: today };
  if (period === "week")  return { start: _startOfWeekMonYmd(), end: today };
  if (period === "month") return { start: _startOfMonthYmd(),   end: today };
  return { start: "0000-01-01", end: "9999-12-31" };
}
const _won = (n) => (Number(n) || 0).toLocaleString("ko-KR");

// ─── 원청별 탭 ───────────────────────────────────────────
function PrincipalStatsTab({ t, apiTasks = [] }) {
  const [period, setPeriod] = useState("week");
  const { start, end } = useMemo(() => _range(period), [period]);

  const { rows, totals } = useMemo(() => {
    const received = new Map();
    const canceled = new Map();   // 2026-07-27 — 사장님 spec: 취소도 보이게
    const done     = new Map();
    const owner    = new Map();
    for (const tk of (apiTasks || [])) {
      if (!tk) continue;
      const code = String(tk.principalCode || tk.principal_code || "").trim();
      if (!code) continue;

      const created = tk.createdAt || tk.created_at;
      if (created) {
        const k = toKstYmd(created);
        if (k && k >= start && k <= end) {
          if (tk.status === "취소") canceled.set(code, (canceled.get(code) || 0) + 1);
          else received.set(code, (received.get(code) || 0) + 1);
        }
      }
      const completed = tk.completedAt || tk.completed_at;
      if (completed && tk.status === "완료") {
        const k = toKstYmd(completed);
        if (k && k >= start && k <= end) {
          done.set(code, (done.get(code) || 0) + 1);
          if (code !== USOLN_CODE) {
            owner.set(code, (owner.get(code) || 0) + Number(tk.owner_amount ?? tk.ownerAmount ?? 0));
          }
        }
      }
    }
    const all = PRINCIPAL_ORDER.map(p => ({
      ...p,
      received: received.get(p.code) || 0,
      canceled: canceled.get(p.code) || 0,
      done:     done.get(p.code)     || 0,
      owner:    owner.get(p.code)    || 0,
      isTrackB: p.code === USOLN_CODE,
    })).filter(r => r.received > 0 || r.done > 0 || r.canceled > 0);
    // 접수 많은 순 (동수면 완료 순)
    all.sort((a, b) => b.received - a.received || b.done - a.done);
    return {
      rows: all,
      totals: {
        received: all.reduce((s, r) => s + r.received, 0),
        canceled: all.reduce((s, r) => s + r.canceled, 0),
        done:     all.reduce((s, r) => s + r.done,     0),
        owner:    all.reduce((s, r) => s + (r.isTrackB ? 0 : r.owner), 0),
      },
    };
  }, [apiTasks, start, end]);

  const maxReceived = Math.max(1, ...rows.map(r => r.received));

  const chip = (opt) => {
    const on = period === opt.id;
    return (
      <button key={opt.id} type="button" onClick={() => setPeriod(opt.id)} style={{
        flex: 1, padding: "8px 0", textAlign: "center",
        background: on ? t.accent : "transparent",
        border: `1px solid ${on ? t.accent : t.border}`,
        borderRadius: 10,
        color: on ? "#fff" : t.textSecondary,
        fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      }}>{opt.label}</button>
    );
  };

  const totCell = (v, label, color) => (
    <div style={{
      flex: 1, textAlign: "center", minWidth: 0,
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, padding: "10px 4px",
    }}>
      <div style={{
        fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums",
        color: color || t.text, letterSpacing: "-0.5px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{v}</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: t.textSecondary, marginTop: 2, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );

  return (
    <div style={{ padding: "12px 16px" }}>
      {/* 기간 칩 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {PERIOD_OPTS.map(chip)}
      </div>

      {/* 합계 3칸 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {totCell(totals.received, "접수")}
        {totCell(totals.canceled, "취소", "#FF3B5C")}
        {totCell(totals.done, "완료", "#0EA5E9")}
        {totCell(`₩${_won(totals.owner)}`, "회사 몫 (유솔N 제외)", t.accent)}
      </div>

      {/* 원청별 리스트 */}
      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 14, padding: "12px 14px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, paddingBottom: 8,
          fontSize: 9.5, fontWeight: 700, color: t.textMuted,
        }}>
          <span style={{ width: 7, flexShrink: 0 }}/>
          <span style={{ flex: 1 }}>원청</span>
          <span style={{ width: 34, textAlign: "right" }}>접수</span>
          <span style={{ width: 30, textAlign: "right" }}>취소</span>
          <span style={{ width: 34, textAlign: "right" }}>완료</span>
          <span style={{ width: 82, textAlign: "right" }}>회사 몫</span>
        </div>

        {rows.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: t.textMuted }}>
            이 기간에 접수·완료가 없습니다
          </div>
        )}

        {rows.map((r, i) => (
          <div key={r.code} style={{
            padding: "9px 0",
            borderTop: i === 0 ? "none" : `1px solid ${t.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.color, flexShrink: 0 }}/>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: t.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{r.name}</span>
              <span style={{ width: 34, textAlign: "right", fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: t.text }}>{r.received}</span>
              <span style={{ width: 30, textAlign: "right", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: r.canceled > 0 ? "#FF3B5C" : t.textMuted }}>{r.canceled}</span>
              <span style={{ width: 34, textAlign: "right", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: t.textSecondary }}>{r.done}</span>
              <span style={{
                width: 82, textAlign: "right", fontVariantNumeric: "tabular-nums",
                fontSize: r.isTrackB ? 10.5 : 12, fontWeight: r.isTrackB ? 700 : 800,
                color: r.isTrackB ? "#03C75A" : t.text,
              }}>{r.isTrackB ? "월정산" : _won(r.owner)}</span>
            </div>
            <div style={{
              height: 4, borderRadius: 3, marginTop: 6, overflow: "hidden",
              background: t.bgInset || "rgba(255,255,255,0.06)",
            }}>
              <div style={{
                height: "100%", borderRadius: 3, background: r.color,
                width: `${Math.round((r.received / maxReceived) * 100)}%`,
                opacity: r.isTrackB ? 0.5 : 1,
              }}/>
            </div>
          </div>
        ))}

        {rows.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            paddingTop: 10, marginTop: 2, borderTop: `1px solid ${t.border}`,
          }}>
            <span style={{ width: 7, flexShrink: 0 }}/>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: t.text }}>합계</span>
            <span style={{ width: 34, textAlign: "right", fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: t.text }}>{totals.received}</span>
            <span style={{ width: 30, textAlign: "right", fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: totals.canceled > 0 ? "#FF3B5C" : t.textMuted }}>{totals.canceled}</span>
            <span style={{ width: 34, textAlign: "right", fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: t.textSecondary }}>{totals.done}</span>
            <span style={{ width: 82, textAlign: "right", fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: t.accent }}>{_won(totals.owner)}</span>
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: t.textMuted, marginTop: 10, lineHeight: 1.7 }}>
        회사 몫 = 운영비 빼기 전 금액 (이익 아님). 유솔N 은 월정산이라 금액 미확정.<br/>
        접수와 완료는 따로 셈 (이번 기간 접수 ≠ 이번 기간 완료).<br/>
        접수 = 유효 접수 (취소 제외) · 취소 = 이 기간 접수됐다가 취소된 건. 전체 유입 = 접수+취소.
      </div>
    </div>
  );
}

// ─── 허브 (헤더 + 탭 전환) ───────────────────────────────
export function StatsHubScreen({ t, apiTasks = [], user, onBack }) {
  const [tab, setTab] = useState("principal");

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
          📊 접수 통계
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
        {[
          { id: "principal", label: "원청별" },
          { id: "region",    label: "지역별" },
        ].map(x => {
          const on = tab === x.id;
          return (
            <button key={x.id} type="button" onClick={() => setTab(x.id)} style={{
              flex: 1, padding: "12px 0", textAlign: "center",
              background: "transparent", border: "none",
              boxShadow: on ? `inset 0 -2px 0 ${t.accent}` : "none",
              color: on ? t.accent : t.textSecondary,
              fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}>{x.label}</button>
          );
        })}
      </div>

      {tab === "principal"
        ? <PrincipalStatsTab t={t} apiTasks={apiTasks}/>
        : <RegionStatsScreen t={t} apiTasks={apiTasks} user={user} embedded/>}
    </div>
  );
}
