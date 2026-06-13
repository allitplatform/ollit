// 2026-06-13 — PC 운영자 "원청 지급 (회사→원청)" 화면.
//
// 사장님 spec:
//   · 회사가 원청한테 일별 정산금 지급한 내역. 모바일 입금 내역의 "원청 지급" 토글을 PC로.
//   · 대상 원청 = usol_n 제외 + 일별 total > 0 (자동 가드, 화이트리스트 X).
//       KA / KB / yongin / usol_h / crikrin 후보. allday·visit_only·정책상 0원은 자동 빠짐.
//   · 데이터 = fetchPartnerDailySettle({ principalCodes, monthsBack: 2 }) 재사용 — DB·계산 0건.
//   · 상태 2종 (단순):
//       대기      → row 없음
//       지급완료 → principal_daily_remittances row 있음
//   · 액션 (날짜 × 원청 단위, 다이얼로그 필수):
//       대기      → [✓ 지급완료 표시] (markPartnerDailyRemit)
//       지급완료 → [↺ 지급 취소]     (undoPartnerDailyRemit)
//   · 3카드: 이번달 합계 / 미지급(앰버) / 지급완료(초록). 3카드는 항상 이번달 기준.
//   · 필터: 기간(이번달/지난달/전체) + 상태(전체/미지급/지급완료) + 검색(원청/작업번호/고객).
//
// 백로그 (2026-06-13): 모바일 입금 내역의 PrincipalPaymentHistory 토글은
//   KA·crikrin 하드코딩 — KB·yongin 누락. 추후 별도 단계에서 B 기준 통일 검토.

import { useEffect, useMemo, useState } from "react";
import {
  Wallet, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Search, X, RotateCcw,
} from "lucide-react";
import {
  fetchPartnerDailySettle,
  markPartnerDailyRemit,
  undoPartnerDailyRemit,
  describeDailyRemitError,
} from "../lib/partnerDailySettleDb.js";

// 대상 원청 — usol_n 제외 (월정산 트랙 B). allday/usol_h 등은 fetch 후 total>0 자동 가드.
const PRINCIPAL_CODES = ["KA", "KB", "yongin", "usol_h", "crikrin"];

// 원청 코드 → 한글명 (CLAUDE.md). 매핑 없는 건 코드 그대로.
const PRINCIPAL_KO = {
  KA: "KA",
  KB: "KB",
  yongin: "용인컴퍼니",
  usol_h: "유솔홈케어 H",
  crikrin: "크리크린",
};

// ──────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────
const fmtKRW = (n) => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;

function kstYmdToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
function nowKstYm() { return kstYmdToday().slice(0, 7); }
function prevKstYm() {
  const t = kstYmdToday();
  const [y, m] = t.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
function dateLabel(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dow = isNaN(dt.getTime()) ? "" : KO_DOW[dt.getDay()];
  return `${ymd}${dow ? ` (${dow})` : ""}`;
}

function principalName(code) { return PRINCIPAL_KO[code] || code || "—"; }

// 상태 — 단순 2종 (row 있음 / 없음)
function pickGroupStatus(group, remitMap) {
  const k = `${group.principal_id}|${group.ymd}`;
  return remitMap.has(k) ? "paid" : "pending";
}

// ──────────────────────────────────────────────
// 상태 배지
// ──────────────────────────────────────────────
function StatusBadge({ status, t }) {
  const MAP = {
    pending: { Icon: Clock,        fg: t.warning, bg: t.warningBg, bd: t.warningBorder, label: "대기" },
    paid:    { Icon: CheckCircle2, fg: t.success, bg: t.successBg, bd: t.successBorder, label: "지급 완료" },
  };
  const cfg = MAP[status] || MAP.pending;
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 9,
      background: cfg.bg, color: cfg.fg,
      border: `1px solid ${cfg.bd}`,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <Icon size={11} aria-hidden="true"/>
      {cfg.label}
    </span>
  );
}

// ──────────────────────────────────────────────
// 합계 카드
// ──────────────────────────────────────────────
function SummaryCard({ t, label, count, amount, color, Icon }) {
  return (
    <div style={{
      flex: 1,
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: color + "22",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={20} style={{ color }}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 800, color }}>{fmtKRW(amount)}</span>
          <span className="mono" style={{ fontSize: 12, color: t.textSecondary, fontWeight: 700 }}>{count}건</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 본체
// ──────────────────────────────────────────────
export default function AdminPcPrincipalPayout({ t, user }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [days, setDays] = useState([]);            // [{ ymd, principal_id, principal_code, count, total, tasks: [...] }]
  const [remits, setRemits] = useState([]);        // [{ principal_id, settle_date, remitted_amount, ... }]
  const [reloadTick, setReloadTick] = useState(0);

  const [monthFilter, setMonthFilter] = useState("this");     // this | last | all
  const [statusFilter, setStatusFilter] = useState("all");    // all | pending | paid
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDates, setExpandedDates] = useState(() => new Set());
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const actor = user?.user_id || user?.userId || user?.id;

  // 데이터 fetch (monthsBack=2)
  useEffect(() => {
    let alive = true;
    setLoading(true); setErr("");
    (async () => {
      const res = await fetchPartnerDailySettle({ principalCodes: PRINCIPAL_CODES, monthsBack: 2 });
      if (!alive) return;
      if (!res?.ok) {
        setErr(res?.error || "조회 실패"); setLoading(false); return;
      }
      // 자동 가드 — total > 0 만 (allday·visit_only 정책상 0원 자동 제외)
      setDays((res.days || []).filter(d => (d.total || 0) > 0));
      setRemits(res.remits || []);
      setLoading(false);
    })().catch(e => { if (alive) { setErr(e?.message || "에러"); setLoading(false); } });
    return () => { alive = false; };
  }, [reloadTick]);

  const remitMap = useMemo(() => {
    const m = new Map();
    for (const r of remits) m.set(`${r.principal_id}|${r.settle_date}`, r);
    return m;
  }, [remits]);

  // 월 필터 (3카드는 항상 이번달 기준이라 별도 dataset)
  const thisYm = nowKstYm();
  const lastYm = prevKstYm();
  const thisMonthDays = useMemo(() => days.filter(d => d.ymd.slice(0, 7) === thisYm), [days, thisYm]);

  // 본문 필터 적용
  const monthFiltered = useMemo(() => {
    if (monthFilter === "all") return days;
    const target = monthFilter === "this" ? thisYm : lastYm;
    return days.filter(d => d.ymd.slice(0, 7) === target);
  }, [days, monthFilter, thisYm, lastYm]);

  const statusFiltered = useMemo(() => {
    if (statusFilter === "all") return monthFiltered;
    return monthFiltered.filter(d => pickGroupStatus(d, remitMap) === statusFilter);
  }, [monthFiltered, statusFilter, remitMap]);

  // 검색 — 원청명/작업번호/고객명. group 단위 매칭 (안에 한 task라도 매칭하면 그룹 노출)
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return statusFiltered;
    return statusFiltered.filter(g => {
      if (principalName(g.principal_code).toLowerCase().includes(q)) return true;
      if ((g.principal_code || "").toLowerCase().includes(q)) return true;
      return (g.tasks || []).some(tt => {
        const fields = [tt.task_no, tt.customer].filter(Boolean).join(" ").toLowerCase();
        return fields.includes(q);
      });
    });
  }, [statusFiltered, searchQuery]);

  // 날짜별 묶음 (desc)
  const dateGroups = useMemo(() => {
    const m = new Map();
    for (const g of filtered) {
      if (!m.has(g.ymd)) m.set(g.ymd, []);
      m.get(g.ymd).push(g);
    }
    return [...m.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ymd, gs]) => [ymd, gs.sort((a, b) => (a.principal_code || "").localeCompare(b.principal_code || ""))]);
  }, [filtered]);

  // 3카드 — 항상 이번달 기준
  const summary = useMemo(() => {
    let totalAmt = 0, totalCount = 0;
    let paidAmt = 0, paidCount = 0;
    let pendingAmt = 0, pendingCount = 0;
    for (const g of thisMonthDays) {
      const remit = remitMap.get(`${g.principal_id}|${g.ymd}`);
      const amt = remit ? (Number(remit.remitted_amount) || g.total) : g.total;
      totalAmt += amt; totalCount++;
      if (remit) { paidAmt += amt; paidCount++; }
      else       { pendingAmt += g.total; pendingCount++; }
    }
    return { totalAmt, totalCount, paidAmt, paidCount, pendingAmt, pendingCount };
  }, [thisMonthDays, remitMap]);

  // 토글 — 오늘 자동 펼침
  const today = kstYmdToday();
  function isDateOpen(ymd) {
    if (expandedDates.has(`-${ymd}`)) return false;
    return expandedDates.has(ymd) || ymd === today;
  }
  function toggleDate(ymd) {
    setExpandedDates(prev => {
      const next = new Set(prev);
      const open = isDateOpen(ymd);
      next.delete(ymd); next.delete(`-${ymd}`);
      next.add(open ? `-${ymd}` : ymd);
      return next;
    });
  }
  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1400, margin: "0 auto" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Wallet size={22} style={{ color: t.accent }}/>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>원청 지급 (회사→원청)</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            일별 원청 정산금 지급 내역 · 날짜×원청 단위 지급완료 표시/취소
          </div>
        </div>
      </div>

      {/* 3카드 — 이번달 기준 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <SummaryCard t={t} label="이번달 합계"
          count={summary.totalCount} amount={summary.totalAmt}
          color={t.accent} Icon={Wallet}/>
        <SummaryCard t={t} label="이번달 미지급"
          count={summary.pendingCount} amount={summary.pendingAmt}
          color={t.warning} Icon={AlertTriangle}/>
        <SummaryCard t={t} label="이번달 지급완료"
          count={summary.paidCount} amount={summary.paidAmt}
          color={t.success} Icon={CheckCircle2}/>
      </div>

      {/* 필터 + 검색 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "12px 14px", marginBottom: 14,
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { k: "this", lbl: "이번달" },
            { k: "last", lbl: "지난달" },
            { k: "all",  lbl: "전체 (2개월)" },
          ].map(opt => {
            const active = monthFilter === opt.k;
            return (
              <button key={opt.k} onClick={() => setMonthFilter(opt.k)} style={{
                padding: "7px 14px",
                background: active ? t.accentBg : "transparent",
                border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
                borderRadius: 8, fontSize: 12, fontWeight: 700,
                color: active ? t.accent : t.textMuted,
                cursor: "pointer", fontFamily: "inherit",
              }}>{opt.lbl}</button>
            );
          })}
        </div>
        <div style={{ width: 1, height: 22, background: t.border }}/>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { k: "all",     lbl: "전체" },
            { k: "pending", lbl: "미지급" },
            { k: "paid",    lbl: "지급 완료" },
          ].map(opt => {
            const active = statusFilter === opt.k;
            return (
              <button key={opt.k} onClick={() => setStatusFilter(opt.k)} style={{
                padding: "7px 14px",
                background: active ? t.bgInset : "transparent",
                border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
                borderRadius: 8, fontSize: 12, fontWeight: 700,
                color: active ? t.text : t.textMuted,
                cursor: "pointer", fontFamily: "inherit",
              }}>{opt.lbl}</button>
            );
          })}
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 10px", minWidth: 260,
          background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 8,
        }}>
          <Search size={14} style={{ color: t.textMuted, flexShrink: 0 }}/>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="원청 / 작업번호 / 고객명"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: t.text, fontSize: 12, fontFamily: "inherit", minWidth: 0,
            }}
          />
          {hasSearch && (
            <button onClick={() => setSearchQuery("")} aria-label="검색어 지우기" style={{
              background: "transparent", border: "none", padding: 2,
              color: t.textMuted, cursor: "pointer", display: "flex",
            }}>
              <X size={14}/>
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      {loading ? (
        <div style={{ padding: "80px 20px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : err ? (
        <div style={{ padding: "80px 20px", textAlign: "center", color: t.danger, fontSize: 13 }}>
          ⚠️ {err}
        </div>
      ) : dateGroups.length === 0 ? (
        <div style={{ padding: "80px 20px", textAlign: "center" }}>
          <Wallet size={56} style={{ color: t.textMuted, opacity: 0.4, margin: "0 auto 18px" }}/>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 8 }}>
            {hasSearch ? "검색 결과가 없습니다" : "해당 조건의 지급 내역이 없습니다"}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {hasSearch ? "검색어를 다시 확인해 보세요" : "월 또는 상태 필터를 변경해 보세요"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {dateGroups.map(([ymd, groups]) => (
            <DateSection key={ymd} t={t}
              ymd={ymd}
              groups={groups}
              remitMap={remitMap}
              open={isDateOpen(ymd)}
              onToggle={() => toggleDate(ymd)}
              isGroupOpen={(k) => expandedGroups.has(k) || hasSearch}
              onToggleGroup={toggleGroup}
              actor={actor}
              onRefresh={() => setReloadTick(n => n + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 날짜 섹션
// ──────────────────────────────────────────────
function DateSection({ t, ymd, groups, remitMap, open, onToggle, isGroupOpen, onToggleGroup, actor, onRefresh }) {
  let sectionPaid = 0, sectionPending = 0, pendingCount = 0;
  for (const g of groups) {
    const remit = remitMap.get(`${g.principal_id}|${g.ymd}`);
    if (remit) sectionPaid += Number(remit.remitted_amount) || g.total;
    else       { sectionPending += g.total; pendingCount++; }
  }

  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden" }}>
      <button onClick={onToggle} style={{
        width: "100%", padding: "12px 16px",
        background: "transparent", border: "none", cursor: "pointer",
        color: t.text, fontFamily: "inherit", textAlign: "left",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{dateLabel(ymd)}</div>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: t.textSecondary, textAlign: "right" }}>
          <div>
            <span className="mono" style={{ fontWeight: 700, color: t.text }}>{groups.length}</span>건
            <span style={{ color: t.textDim, margin: "0 6px" }}>·</span>
            <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(sectionPaid + sectionPending)}</span>
          </div>
          {pendingCount > 0 && (
            <div style={{ fontSize: 11, color: t.warning, fontWeight: 600, marginTop: 2 }}>
              미지급 <span className="mono">{pendingCount}</span>건 · <span className="mono">{fmtKRW(sectionPending)}</span>
            </div>
          )}
        </div>
        {open ? <ChevronUp size={16} style={{ color: t.textMuted }}/> : <ChevronDown size={16} style={{ color: t.textMuted }}/>}
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          {groups.map(g => {
            const key = `${g.ymd}|${g.principal_id}`;
            return (
              <PrincipalGroup key={key} t={t}
                group={g}
                remit={remitMap.get(`${g.principal_id}|${g.ymd}`) || null}
                open={isGroupOpen(key)}
                onToggle={() => onToggleGroup(key)}
                actor={actor}
                onRefresh={onRefresh}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 원청 묶음 — 헤더에 액션 버튼 (대기→[지급완료 표시] / 지급완료→[지급 취소])
// ──────────────────────────────────────────────
function PrincipalGroup({ t, group, remit, open, onToggle, actor, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const status = remit ? "paid" : "pending";
  const displayAmt = remit ? (Number(remit.remitted_amount) || group.total) : group.total;
  const name = principalName(group.principal_code);

  async function handleMark(e) {
    e.stopPropagation();
    if (busy) return;
    if (!actor) { setActionErr("관리자 사용자 ID를 찾을 수 없습니다."); return; }
    const ok = window.confirm(
      `${name} ${group.ymd} 지급완료 표시합니다.\n\n` +
      `완료 ${group.completedCount || group.count}건 · 지급액 ${fmtKRW(group.total)}\n` +
      `상태가 "지급 완료"로 바뀝니다.`
    );
    if (!ok) return;
    setBusy(true); setActionErr("");
    try {
      const res = await markPartnerDailyRemit({
        principalId: group.principal_id,
        settleDate:  group.ymd,
        amount:      group.total,
        actor,
      });
      if (!res?.ok) {
        setActionErr(describeDailyRemitError(res?.error) || "처리 실패");
      } else if (typeof onRefresh === "function") {
        onRefresh();
      }
    } catch (err) {
      console.error("[AdminPcPrincipalPayout] mark 예외:", err);
      setActionErr(err?.message || "예외 발생");
    } finally {
      setBusy(false);
    }
  }

  async function handleUndo(e) {
    e.stopPropagation();
    if (busy) return;
    if (!actor) { setActionErr("관리자 사용자 ID를 찾을 수 없습니다."); return; }
    const ok = window.confirm(
      `${name} ${group.ymd} 지급완료 표시를 취소합니다.\n\n` +
      `지급액 ${fmtKRW(displayAmt)}\n` +
      `상태가 "대기"로 돌아갑니다.`
    );
    if (!ok) return;
    setBusy(true); setActionErr("");
    try {
      const res = await undoPartnerDailyRemit({
        principalId: group.principal_id,
        settleDate:  group.ymd,
        actor,
      });
      if (!res?.ok) {
        setActionErr(describeDailyRemitError(res?.error) || "취소 실패");
      } else if (typeof onRefresh === "function") {
        onRefresh();
      }
    } catch (err) {
      console.error("[AdminPcPrincipalPayout] undo 예외:", err);
      setActionErr(err?.message || "예외 발생");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 9, overflow: "hidden" }}>
      <div style={{
        padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <button onClick={onToggle} style={{
          background: "transparent", border: "none", cursor: "pointer",
          padding: 0, display: "flex", alignItems: "center", gap: 10,
          color: t.text, fontFamily: "inherit", flex: 1, minWidth: 0, textAlign: "left",
        }}>
          <StatusBadge status={status} t={t}/>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>🏢 {name}</span>
          <span style={{ fontSize: 12, color: t.textSecondary, whiteSpace: "nowrap" }}>
            완료 <span className="mono" style={{ fontWeight: 700, color: t.text }}>{group.completedCount || group.count}</span>건
          </span>
          <div style={{ flex: 1 }}/>
          <div className="mono" style={{
            fontSize: 13, fontWeight: 800,
            color: status === "paid" ? t.success : t.warning,
            whiteSpace: "nowrap",
          }}>{fmtKRW(displayAmt)}</div>
          {open ? <ChevronUp size={15} style={{ color: t.textMuted }}/> : <ChevronDown size={15} style={{ color: t.textMuted }}/>}
        </button>
        {status === "pending" && (
          <button onClick={handleMark} disabled={busy} style={{
            padding: "7px 14px",
            background: busy ? t.bgInset : t.success,
            color: busy ? t.textMuted : "#fff",
            border: "none", borderRadius: 8,
            fontSize: 12, fontWeight: 800,
            cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 5,
            opacity: busy ? 0.6 : 1, whiteSpace: "nowrap",
          }}>
            <CheckCircle2 size={13}/>
            {busy ? "처리 중..." : "✓ 지급완료 표시"}
          </button>
        )}
        {status === "paid" && (
          <button onClick={handleUndo} disabled={busy}
            aria-label="지급 취소" title="지급 취소"
            style={{
              padding: "7px 12px",
              background: "transparent",
              color: t.textMuted,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              fontSize: 12, fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
              fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 5,
              opacity: busy ? 0.6 : 1, whiteSpace: "nowrap",
            }}>
            <RotateCcw size={13}/>
            {busy ? "취소 중..." : "지급 취소"}
          </button>
        )}
      </div>
      {actionErr && (
        <div style={{
          padding: "6px 14px 8px",
          fontSize: 11, color: t.danger, fontWeight: 600,
        }}>⚠️ {actionErr}</div>
      )}
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          {(group.tasks || []).map(tt => (
            <TaskRow key={tt.task_id} t={t} task={tt}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 행 — 작업번호 · 고객 · 요약 · principal_amount
//   취소건은 흐리게 + 0원 표시. visit_only 도 동일 톤 (principal 0).
// ──────────────────────────────────────────────
function TaskRow({ t, task }) {
  const isCanceled = task.isCanceled || task.status === "취소";
  const amount = isCanceled ? 0 : (Number(task.principal_amount) || 0);
  const customer = task.customer || "—";
  const summary  = task.summary || "";
  const taskNo   = task.task_no || "";

  return (
    <div style={{
      padding: "8px 12px",
      background: t.bgElevated,
      borderRadius: 7,
      display: "flex", alignItems: "center", gap: 10,
      opacity: isCanceled ? 0.5 : 1,
    }}>
      {isCanceled && (
        <span style={{
          padding: "1px 6px", borderRadius: 6,
          background: t.bgInset, color: t.textMuted,
          border: `1px solid ${t.border}`,
          fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
        }}>취소</span>
      )}
      <span style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{customer}</span>
      {summary && (
        <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap" }}>({summary})</span>
      )}
      {taskNo && (
        <span className="mono" style={{ fontSize: 11, color: t.textDim, whiteSpace: "nowrap" }}>· {taskNo}</span>
      )}
      <div style={{ flex: 1 }}/>
      <span className="mono" style={{
        fontSize: 13, fontWeight: 800,
        color: isCanceled ? t.textMuted : t.accent,
        whiteSpace: "nowrap",
      }}>{fmtKRW(amount)}</span>
    </div>
  );
}
