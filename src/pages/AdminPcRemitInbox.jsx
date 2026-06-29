// 2026-06-13 — PC 운영자 "입금 내역 (기사 송금)" 화면.
//
// 사장님 spec:
//   · 모바일 입금 내역(SettlementHistoryContent, 조회 전용) + 모바일 정산 탭(확인 액션)을
//     PC 한 화면으로 통합. 화면 왕복 X.
//   · 상단: 합계 3카드(합계/미입금/입금완료) + 기간·상태 필터 + 검색.
//   · 본문: 날짜별 표 → 기사 묶음(접기/펼침) → 행(작업번호·고객·지역·상태·송금액).
//   · 액션 (그룹 헤더 우측, 일괄):
//       reported  → [확인]     (confirmEngineerRemit)
//       confirmed → [확인 취소] (cancelConfirmRemit)
//       pending/overdue → 액션 X (기사 보고 대기 — 운영자가 기사 대신 보고 안 함).
//   · 확인 다이얼로그 필수.
//   · DB·계산·paymentsDb.js 변경 0줄. SettlementHistoryContent.jsx 변경 0줄.
//
// 상태 흐름 (paymentsDb.js):
//   pending ──reportEngineerRemit──> reported ──confirmEngineerRemit──> confirmed
//      ▲              │                  ▲                                 │
//      └──cancelEngineerRemit──┘         └──cancelConfirmRemit─────────────┘
//
// 0원 자동 confirmed: utils/remitFilter.js isAutoConfirmedRemit (2026-06-13 적용).
//
// 헬퍼 (pickRowStatus 등) 본문은 SettlementHistoryContent.jsx 와 동일 — 사장님 spec
// (SettlementHistoryContent 0줄 변경) 지키기 위한 의도된 복제. 추후 utils 단일화 별도 단계.

import { useMemo, useState } from "react";
import { Wallet, Clock, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Search, X, RotateCcw } from "lucide-react";
import { isRemittanceTarget, calcRemitAmount, isAutoConfirmedRemit } from "../utils/remitFilter.js";
import { toKstYmd } from "../utils/dateLabel.js";
// 2026-06-29 — Mig 156: confirm 시점에 통장 자동 IN. 새 RPC 어댑터 사용.
import {
  confirmEngineerRemitWithCashflow,
  cancelConfirmEngineerRemitWithCashflow,
} from "../lib/paymentsDb.js";

// ──────────────────────────────────────────────
// 헬퍼 (SettlementHistoryContent.jsx 와 동일 본문)
// ──────────────────────────────────────────────
function unpaidDeadline(task) {
  const completedKst = toKstYmd(task.completedAt || task.completed_at);
  if (!completedKst) return null;
  return new Date(`${completedKst}T23:00:00+09:00`);
}

function pickRowStatus(task) {
  if (task.engineerRemitConfirmedAt || task.engineer_remit_confirmed_at) return "confirmed";
  if (task.engineerRemittedAt       || task.engineer_remitted_at)       return "reported";
  if (isAutoConfirmedRemit(task)) return "confirmed";
  const dl = unpaidDeadline(task);
  if (dl && new Date() > dl) return "overdue";
  return "pending";
}

function computeSubGroupStatus(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return "pending";
  const isConfirmedLike = (t) =>
    t.engineerRemitConfirmedAt || t.engineer_remit_confirmed_at || isAutoConfirmedRemit(t);
  const isReportedLike = (t) =>
    t.engineerRemittedAt || t.engineer_remitted_at || isAutoConfirmedRemit(t);
  if (tasks.every(isConfirmedLike)) return "confirmed";
  if (tasks.every(isReportedLike))  return "reported";
  if (tasks.some(t => pickRowStatus(t) === "overdue")) return "overdue";
  return "pending";
}

function kstYmFromDate(d) {
  const ymd = toKstYmd(d);
  return ymd ? ymd.slice(0, 7) : "";
}
function nowKstYm() { return kstYmFromDate(new Date()); }
function prevKstYm() {
  const now = new Date();
  return kstYmFromDate(new Date(now.getFullYear(), now.getMonth() - 1, 15));
}

const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
function dateLabel(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dow = isNaN(dt.getTime()) ? "" : KO_DOW[dt.getDay()];
  return `${ymd}${dow ? ` (${dow})` : ""}`;
}

const fmtKRW = (n) => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;

// ──────────────────────────────────────────────
// 상태 배지 (PC — 모바일과 동일 의미, 살짝 큰 사이즈)
// ──────────────────────────────────────────────
function StatusBadge({ status, t }) {
  const MAP = {
    pending:   { Icon: AlertTriangle, fg: t.textMuted, bg: t.bgInset,    bd: t.borderStrong,  label: "미입금" },
    overdue:   { Icon: AlertTriangle, fg: t.danger,    bg: t.dangerBg,   bd: t.dangerBorder,  label: "연체" },
    reported:  { Icon: Clock,         fg: t.info,      bg: t.infoBg,     bd: `${t.info}33`,   label: "확인 대기" },
    confirmed: { Icon: CheckCircle2,  fg: t.success,   bg: t.successBg,  bd: t.successBorder, label: "입금 완료" },
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
// 합계 카드 (3개)
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
          <span className="mono" style={{ fontSize: 12, color: t.textSecondary, fontWeight: 700 }}>
            {count}건
          </span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 본체
// ──────────────────────────────────────────────
export default function AdminPcRemitInbox({ t, apiTasks = [], user, onTaskClick, onRefreshTasks }) {
  const [monthFilter, setMonthFilter] = useState("this");      // this | last | all
  const [statusFilter, setStatusFilter] = useState("all");     // all | unpaid | reported | confirmed
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDates, setExpandedDates] = useState(() => new Set());
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  // base — 송금 대상 (track A + 완료, visit_only 제외)
  const base = useMemo(() => {
    return (apiTasks || []).filter(task => {
      if (!isRemittanceTarget(task)) return false;
      return !!(task.completedAt || task.completed_at);
    });
  }, [apiTasks]);

  // 월 필터
  const monthFiltered = useMemo(() => {
    if (monthFilter === "all") return base;
    const target = monthFilter === "this" ? nowKstYm() : prevKstYm();
    return base.filter(task => {
      const ym = (toKstYmd(task.completedAt || task.completed_at) || "").slice(0, 7);
      return ym === target;
    });
  }, [base, monthFilter]);

  // 상태 필터 (unpaid = pending + overdue)
  const statusFiltered = useMemo(() => {
    if (statusFilter === "all") return monthFiltered;
    if (statusFilter === "unpaid") {
      return monthFiltered.filter(task => {
        const s = pickRowStatus(task);
        return s === "pending" || s === "overdue";
      });
    }
    return monthFiltered.filter(task => pickRowStatus(task) === statusFilter);
  }, [monthFiltered, statusFilter]);

  // 검색 (기사명 / 고객명 / 작업번호)
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return statusFiltered;
    return statusFiltered.filter(task => {
      const fields = [
        task.engineer, task.assignedEngineer,
        task.customer, task.taskNo, task.taskCode,
      ].filter(Boolean).join(" ").toLowerCase();
      return fields.includes(q);
    });
  }, [statusFiltered, searchQuery]);

  // 날짜별 그룹 (내림차순 / 날짜 안에서 기사별)
  const dateGroups = useMemo(() => {
    const dateMap = new Map();
    for (const task of filtered) {
      const ymd = toKstYmd(task.completedAt || task.completed_at);
      if (!ymd) continue;
      if (!dateMap.has(ymd)) dateMap.set(ymd, new Map());
      const engMap = dateMap.get(ymd);
      const engKey = task.engineer || task.assignedEngineer || "—";
      if (!engMap.has(engKey)) engMap.set(engKey, []);
      engMap.get(engKey).push(task);
    }
    return Array.from(dateMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ymd, engMap]) => [
        ymd,
        Array.from(engMap.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      ]);
  }, [filtered]);

  // 3카드 합계
  const summary = useMemo(() => {
    let count = 0, totalRemit = 0;
    let unpaidCount = 0, unpaidAmount = 0;
    let confirmedCount = 0, confirmedAmount = 0;
    for (const task of filtered) {
      count++;
      const amt = calcRemitAmount(task);
      totalRemit += amt;
      const s = pickRowStatus(task);
      if (s === "pending" || s === "overdue") {
        unpaidCount++; unpaidAmount += amt;
      } else if (s === "confirmed") {
        confirmedCount++; confirmedAmount += amt;
      }
    }
    return { count, totalRemit, unpaidCount, unpaidAmount, confirmedCount, confirmedAmount };
  }, [filtered]);

  // 오늘 날짜 기본 펼침
  const todayYmd = toKstYmd(new Date());
  function isDateOpen(ymd) {
    if (expandedDates.has(`-${ymd}`)) return false;
    return expandedDates.has(ymd) || ymd === todayYmd;
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
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>입금 내역 (기사 송금)</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            회사 송금 통장 내역 · 상태별 일괄 확인/확인 취소
          </div>
        </div>
      </div>

      {/* 합계 3카드 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <SummaryCard t={t} label={`합계${hasSearch ? " (검색)" : ""}`}
          count={summary.count} amount={summary.totalRemit}
          color={t.accent} Icon={Wallet}/>
        <SummaryCard t={t} label="미입금"
          count={summary.unpaidCount} amount={summary.unpaidAmount}
          color={t.danger} Icon={AlertTriangle}/>
        <SummaryCard t={t} label="입금완료"
          count={summary.confirmedCount} amount={summary.confirmedAmount}
          color={t.success} Icon={CheckCircle2}/>
      </div>

      {/* 필터 + 검색 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "12px 14px", marginBottom: 14,
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
      }}>
        {/* 기간 */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { k: "this", lbl: "이번달" },
            { k: "last", lbl: "지난달" },
            { k: "all",  lbl: "전체" },
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
        {/* 상태 */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { k: "all",       lbl: "전체" },
            { k: "unpaid",    lbl: "미입금" },
            { k: "reported",  lbl: "확인 대기" },
            { k: "confirmed", lbl: "입금 완료" },
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
        {/* 검색 */}
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
            placeholder="기사명 / 고객명 / 작업번호"
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

      {/* 날짜별 표 */}
      {dateGroups.length === 0 ? (
        <div style={{ padding: "80px 20px", textAlign: "center" }}>
          <Wallet size={56} style={{ color: t.textMuted, opacity: 0.4, margin: "0 auto 18px" }}/>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 8 }}>
            {hasSearch ? "검색 결과가 없습니다" : "해당 조건의 입금 내역이 없습니다"}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            {hasSearch ? "검색어를 다시 확인해 보세요" : "월 또는 상태 필터를 변경해 보세요"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {dateGroups.map(([ymd, engineerGroups]) => (
            <DateSection key={ymd} t={t}
              ymd={ymd}
              engineerGroups={engineerGroups}
              open={isDateOpen(ymd)}
              onToggle={() => toggleDate(ymd)}
              isGroupOpen={(k) => expandedGroups.has(k) || hasSearch}
              onToggleGroup={toggleGroup}
              onTaskClick={onTaskClick}
              user={user}
              onRefreshTasks={onRefreshTasks}
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
function DateSection({ t, ymd, engineerGroups, open, onToggle, isGroupOpen, onToggleGroup, onTaskClick, user, onRefreshTasks }) {
  const allTasks = engineerGroups.flatMap(([, tasks]) => tasks);
  let sectionRemit = 0, sectionUnpaid = 0, sectionUnpaidCount = 0;
  for (const task of allTasks) {
    const amt = calcRemitAmount(task);
    const s = pickRowStatus(task);
    if (s === "pending" || s === "overdue") { sectionUnpaid += amt; sectionUnpaidCount++; }
    else                                     { sectionRemit  += amt; }
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
            <span className="mono" style={{ fontWeight: 700, color: t.text }}>{allTasks.length}</span>건
            <span style={{ color: t.textDim, margin: "0 6px" }}>·</span>
            <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(sectionRemit)}</span>
          </div>
          {sectionUnpaidCount > 0 && (
            <div style={{ fontSize: 11, color: t.danger, fontWeight: 600, marginTop: 2 }}>
              미입금 <span className="mono">{sectionUnpaidCount}</span>건 · <span className="mono">{fmtKRW(sectionUnpaid)}</span>
            </div>
          )}
        </div>
        {open ? <ChevronUp size={16} style={{ color: t.textMuted }}/> : <ChevronDown size={16} style={{ color: t.textMuted }}/>}
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          {engineerGroups.map(([engineer, tasks]) => {
            const key = `${ymd}|${engineer}`;
            return (
              <EngineerGroup key={engineer} t={t}
                engineer={engineer}
                tasks={tasks}
                open={isGroupOpen(key)}
                onToggle={() => onToggleGroup(key)}
                onTaskClick={onTaskClick}
                user={user}
                onRefreshTasks={onRefreshTasks}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 기사 묶음 — 헤더에 액션 버튼 (reported→[확인], confirmed→[확인 취소])
// ──────────────────────────────────────────────
function EngineerGroup({ t, engineer, tasks, open, onToggle, onTaskClick, user, onRefreshTasks }) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  let subRemit = 0, subUnpaid = 0, subUnpaidCount = 0;
  for (const task of tasks) {
    const amt = calcRemitAmount(task);
    const s = pickRowStatus(task);
    if (s === "pending" || s === "overdue") { subUnpaid += amt; subUnpaidCount++; }
    else                                     { subRemit  += amt; }
  }
  const subStatus = computeSubGroupStatus(tasks);

  // 액션 대상 task id (0원 자동 confirmed 행도 호출 대상에 포함하면 DB 무의미 UPDATE 발생.
  //   confirmedAt/remittedAt 컬럼이 이미 채워진 행은 자연스럽게 무영향이지만,
  //   0원 자동 confirmed 행은 DB 컬럼 NULL 상태라 UPDATE 가 의미를 가짐 — 이 경우엔 적용 OK.
  //   → 단순화: 그룹 안 전 task_id 호출. 모바일 SettlementEngineerCard 와 동일.)
  const taskIds = tasks.map(x => x.id).filter(Boolean);

  async function handleConfirm(e) {
    e.stopPropagation();
    if (confirming) return;
    const adminUserId = user?.user_id || user?.id;
    if (!adminUserId) { alert("관리자 사용자 ID를 찾을 수 없습니다."); return; }
    const ok = window.confirm(
      `${engineer} 기사 입금 확인 처리합니다.\n\n` +
      `완료 ${tasks.length}건 · 송금액 ${fmtKRW(subRemit + subUnpaid)}\n` +
      `상태가 "입금 완료"로 바뀝니다.`
    );
    if (!ok) return;
    setConfirming(true);
    try {
      const res = await confirmEngineerRemitWithCashflow(taskIds, adminUserId);
      if (!res || res.ok === false) {
        alert(`입금 확인 실패: ${(res && res.error) || "알 수 없는 오류"}`);
      } else if (typeof onRefreshTasks === "function") {
        onRefreshTasks();
      }
    } catch (err) {
      console.error("[AdminPcRemitInbox] confirm 예외:", err);
      alert(`입금 확인 예외: ${err?.message || err}`);
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancelConfirm(e) {
    e.stopPropagation();
    if (cancelling) return;
    // 2026-06-29 — Mig 156 RPC 가 p_actor 요구. confirm 흐름과 동일.
    const adminUserId = user?.user_id || user?.id;
    if (!adminUserId) { alert("관리자 사용자 ID를 찾을 수 없습니다."); return; }
    const ok = window.confirm(
      `${engineer} 기사 입금 확인을 취소합니다.\n\n` +
      `완료 ${tasks.length}건 · 송금액 ${fmtKRW(subRemit + subUnpaid)}\n` +
      `상태가 "확인 대기"로 돌아갑니다.`
    );
    if (!ok) return;
    setCancelling(true);
    try {
      const res = await cancelConfirmEngineerRemitWithCashflow(taskIds, adminUserId);
      if (!res || res.ok === false) {
        alert(`확인 취소 실패: ${(res && res.error) || "알 수 없는 오류"}`);
      } else if (typeof onRefreshTasks === "function") {
        onRefreshTasks();
      }
    } catch (err) {
      console.error("[AdminPcRemitInbox] cancelConfirm 예외:", err);
      alert(`확인 취소 예외: ${err?.message || err}`);
    } finally {
      setCancelling(false);
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
          <StatusBadge status={subStatus} t={t}/>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{engineer}</span>
          <span style={{ fontSize: 12, color: t.textSecondary, whiteSpace: "nowrap" }}>
            <span className="mono" style={{ fontWeight: 700, color: t.text }}>{tasks.length}</span>건
          </span>
          <div style={{ flex: 1 }}/>
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: t.accent, whiteSpace: "nowrap" }}>
              {fmtKRW(subRemit)}
            </div>
            {subUnpaidCount > 0 && (
              <div style={{ fontSize: 11, color: t.danger, fontWeight: 600, whiteSpace: "nowrap" }}>
                미입금 {fmtKRW(subUnpaid)}
              </div>
            )}
          </div>
          {open ? <ChevronUp size={15} style={{ color: t.textMuted }}/> : <ChevronDown size={15} style={{ color: t.textMuted }}/>}
        </button>
        {/* 액션 — reported 면 [확인], confirmed 면 [확인 취소]. pending/overdue 는 액션 X. */}
        {subStatus === "reported" && (
          <button onClick={handleConfirm} disabled={confirming} style={{
            padding: "7px 14px",
            background: confirming ? t.bgInset : t.success,
            color: confirming ? t.textMuted : "#fff",
            border: "none", borderRadius: 8,
            fontSize: 12, fontWeight: 800,
            cursor: confirming ? "wait" : "pointer",
            fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 5,
            opacity: confirming ? 0.6 : 1, whiteSpace: "nowrap",
          }}>
            <CheckCircle2 size={13}/>
            {confirming ? "확인 중..." : "확인"}
          </button>
        )}
        {subStatus === "confirmed" && (
          <button onClick={handleCancelConfirm} disabled={cancelling}
            aria-label="확인 취소" title="확인 취소"
            style={{
              padding: "7px 12px",
              background: "transparent",
              color: t.textMuted,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              fontSize: 12, fontWeight: 700,
              cursor: cancelling ? "wait" : "pointer",
              fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 5,
              opacity: cancelling ? 0.6 : 1, whiteSpace: "nowrap",
            }}>
            <RotateCcw size={13}/>
            {cancelling ? "취소 중..." : "확인 취소"}
          </button>
        )}
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          {tasks.map(task => (
            <TaskRow key={task.id || task.taskId} t={t} task={task}
              onClick={() => onTaskClick && onTaskClick(task)}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 행 — 상태배지 · 고객 · 지역 · 작업번호 · 송금액
// ──────────────────────────────────────────────
function TaskRow({ t, task, onClick }) {
  const itemSummary = `${task.appliance || "—"}×${task.qty || 1}`;
  const amount = calcRemitAmount(task);
  const customer = task.customer || "—";
  const district = task.district || "";
  const taskNo = task.taskNo || task.taskCode || "";
  const status = pickRowStatus(task);
  const isUnpaid = status === "pending" || status === "overdue";
  const isOverdue = status === "overdue";
  const amountColor = isUnpaid ? t.danger : t.accent;

  return (
    <div onClick={onClick} className="clickable" style={{
      padding: "8px 12px",
      background: t.bgElevated,
      borderRadius: 7,
      border: isOverdue ? `1px solid ${t.dangerBorder}` : "1px solid transparent",
      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
    }}>
      <StatusBadge status={status} t={t}/>
      <span style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{customer}</span>
      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap" }}>({itemSummary})</span>
      {district && (
        <span style={{ fontSize: 11, color: t.textSecondary, whiteSpace: "nowrap" }}>· {district}</span>
      )}
      {taskNo && (
        <span className="mono" style={{ fontSize: 11, color: t.textDim, whiteSpace: "nowrap" }}>· {taskNo}</span>
      )}
      <div style={{ flex: 1 }}/>
      <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: amountColor, whiteSpace: "nowrap" }}>
        {fmtKRW(amount)}
      </span>
    </div>
  );
}
