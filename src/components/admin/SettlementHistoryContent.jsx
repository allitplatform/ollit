// ============================================
// SettlementHistoryContent — 운영자 "입금 내역" 화면
// 2026-05-22 — 회사 송금 통장 내역 (조회 전용)
//
// 구조: 날짜 그룹 > 기사 묶음(접기/펼치기) > 세부 작업 행 (3단)
//
// 기준 dataset:
//   · 트랙 🅐 (isTrackARemittance) 작업 중 engineerRemittedAt 또는 engineerRemitConfirmedAt 이 존재
//   · 날짜 기준: engineerRemitConfirmedAt 우선 → 없으면 engineerRemittedAt (둘 다 KST yyyy-mm-dd)
//
// 행당 금액: 송금액 = totalAmount - engineer_amount
//   · totalAmount = product_price + extra_fee + travel_fee (DB GENERATED)
//   · engineer_amount = compute_payment v14 가 계산한 기사 몫
//   · 회사가 보유/원청에 송금하는 합계 = principal_amount + owner_amount = totalAmount - engineer_amount
//
// 기사 묶음 통합 상태 (메인 탭 computeGroupStatus 패턴, 3상태):
//   · confirmed = 모든 작업 운영자 확인 완료
//   · reported  = 모든 작업 기사 입금 보고 완료 (확인 대기)
//   · pending   = 그 외 (미입금 포함)
//
// 검색: 기사명 + 고객명 + 작업번호 부분 일치 (소문자 비교)
//
// 조회 전용. 확인/취소 버튼 없음 — 메인 정산 탭에서만 처리.
// ============================================

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Wallet, Clock, CheckCircle2, AlertTriangle, Search, X } from "lucide-react";
import { isTrackARemittance } from "../../utils/remitFilter.js";
import { toKstYmd } from "../../utils/dateLabel.js";

// ──────────────────────────────────────────────
// 헬퍼: 행 날짜(confirmed 우선, 없으면 reported)
// ──────────────────────────────────────────────
function pickRowDate(task) {
  return task.engineerRemitConfirmedAt
      || task.engineer_remit_confirmed_at
      || task.engineerRemittedAt
      || task.engineer_remitted_at
      || null;
}

// 상태 (단일 task 기준).
function pickRowStatus(task) {
  if (task.engineerRemitConfirmedAt || task.engineer_remit_confirmed_at) return "confirmed";
  if (task.engineerRemittedAt       || task.engineer_remitted_at)       return "reported";
  return "pending";
}

// 묶음 통합 상태 (메인 탭 computeGroupStatus 와 동일 패턴, 3상태).
function computeSubGroupStatus(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return "pending";
  if (tasks.every(t => t.engineerRemitConfirmedAt || t.engineer_remit_confirmed_at)) return "confirmed";
  if (tasks.every(t => t.engineerRemittedAt       || t.engineer_remitted_at))       return "reported";
  return "pending";
}

// 송금액 = totalAmount - engineer_amount (회사 보유 + 원청 송금분)
function calcRemitAmount(task) {
  const total = Number(task.totalAmount || task.total_amount || 0);
  const eng   = Number(task.engineer_amount || 0);
  return Math.max(0, total - eng);
}

// ──────────────────────────────────────────────
// 월 필터 헬퍼
// ──────────────────────────────────────────────
function kstYmFromDate(d) {
  const ymd = toKstYmd(d);
  return ymd ? ymd.slice(0, 7) : "";
}

function nowKstYm() {
  return kstYmFromDate(new Date());
}

function prevKstYm() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  return kstYmFromDate(d);
}

// 한글 요일
const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
function dateLabel(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dow = isNaN(dt.getTime()) ? "" : KO_DOW[dt.getDay()];
  return `${ymd}${dow ? ` (${dow})` : ""}`;
}

// ──────────────────────────────────────────────
// 상태 배지 — 테마 토큰 (라이트/다크 대응)
// ──────────────────────────────────────────────
function StatusBadge({ status, t }) {
  const MAP = {
    pending:   { Icon: AlertTriangle, fg: t.textMuted, bg: t.bgInset,   bd: t.borderStrong,  label: "미입금" },
    reported:  { Icon: Clock,         fg: t.info,      bg: t.infoBg,    bd: `${t.info}33`,   label: "확인 대기" },
    confirmed: { Icon: CheckCircle2,  fg: t.success,   bg: t.successBg, bd: t.successBorder, label: "입금 완료" },
  };
  const cfg = MAP[status] || MAP.pending;
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", borderRadius: 8,
      background: cfg.bg, color: cfg.fg,
      border: `1px solid ${cfg.bd}`,
      fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      <Icon size={10} aria-hidden="true"/>
      {cfg.label}
    </span>
  );
}

// ──────────────────────────────────────────────
// 본체
// ──────────────────────────────────────────────
export default function SettlementHistoryContent({ t, apiTasks = [], onBack, onTaskClick }) {
  const [monthFilter, setMonthFilter] = useState("this"); // this | last | all
  const [statusFilter, setStatusFilter] = useState("all"); // all | reported | confirmed
  const [searchQuery, setSearchQuery] = useState("");
  const fmtKRW = (n) => `₩${(n || 0).toLocaleString("ko-KR")}`;

  // base: 트랙 🅐 + (보고 OR 확인) 이력 있는 task
  const base = useMemo(() => {
    return (apiTasks || []).filter(task => {
      if (!isTrackARemittance(task)) return false;
      return !!pickRowDate(task);
    });
  }, [apiTasks]);

  // 월 필터 적용
  const monthFiltered = useMemo(() => {
    if (monthFilter === "all") return base;
    const target = monthFilter === "this" ? nowKstYm() : prevKstYm();
    return base.filter(task => {
      const ym = (toKstYmd(pickRowDate(task)) || "").slice(0, 7);
      return ym === target;
    });
  }, [base, monthFilter]);

  // 상태 필터 적용
  const statusFiltered = useMemo(() => {
    if (statusFilter === "all") return monthFiltered;
    return monthFiltered.filter(task => pickRowStatus(task) === statusFilter);
  }, [monthFiltered, statusFilter]);

  // 검색 필터 — 기사명 + 고객명 + 작업번호 부분 일치
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return statusFiltered;
    return statusFiltered.filter(task => {
      const fields = [
        task.engineer,
        task.assignedEngineer,
        task.customer,
        task.taskNo,
        task.taskCode,
      ].filter(Boolean).join(" ").toLowerCase();
      return fields.includes(q);
    });
  }, [statusFiltered, searchQuery]);

  // 날짜별 그룹 (내림차순) — 각 날짜 안에서 기사별 sub-group
  const dateGroups = useMemo(() => {
    const dateMap = new Map();
    for (const task of filtered) {
      const ymd = toKstYmd(pickRowDate(task));
      if (!ymd) continue;
      if (!dateMap.has(ymd)) dateMap.set(ymd, new Map());
      const engMap = dateMap.get(ymd);
      const engKey = task.engineer || task.assignedEngineer || "—";
      if (!engMap.has(engKey)) engMap.set(engKey, []);
      engMap.get(engKey).push(task);
    }
    // [[ymd, [[engineer, tasks[]], ...]], ...]
    return Array.from(dateMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ymd, engMap]) => [
        ymd,
        Array.from(engMap.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      ]);
  }, [filtered]);

  // 합계 (필터된 범위)
  const summary = useMemo(() => {
    let count = 0;
    let totalRemit = 0;
    for (const task of filtered) {
      count++;
      totalRemit += calcRemitAmount(task);
    }
    return { count, totalRemit };
  }, [filtered]);

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: t.text, display: "flex" }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>📜 입금 내역</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            회사 송금 통장 내역 · 조회 전용
          </div>
        </div>
      </div>

      {/* 검색 바 */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 10px",
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 8,
        }}>
          <Search size={14} style={{ color: t.textMuted, flexShrink: 0 }}/>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="기사명 / 고객명 / 작업번호 검색"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: t.text, fontSize: 12, fontFamily: "inherit",
              minWidth: 0,
            }}
          />
          {hasSearch && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "transparent", border: "none", padding: 2,
                color: t.textMuted, cursor: "pointer", display: "flex",
              }}
              aria-label="검색어 지우기"
            >
              <X size={14}/>
            </button>
          )}
        </div>
      </div>

      {/* 필터 바 */}
      <div style={{ padding: "10px 16px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { k: "this", lbl: "이번달" },
          { k: "last", lbl: "지난달" },
          { k: "all",  lbl: "전체" },
        ].map(opt => {
          const active = monthFilter === opt.k;
          return (
            <button key={opt.k} onClick={() => setMonthFilter(opt.k)} style={{
              padding: "6px 12px",
              background: active ? t.accentBg : "transparent",
              border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
              borderRadius: 8, fontSize: 11, fontWeight: 700,
              color: active ? t.accent : t.textMuted,
              cursor: "pointer", fontFamily: "inherit",
            }}>{opt.lbl}</button>
          );
        })}
        <div style={{ width: 1, background: t.border, margin: "0 4px" }}/>
        {[
          { k: "all",       lbl: "전체" },
          { k: "reported",  lbl: "확인 대기" },
          { k: "confirmed", lbl: "입금 완료" },
        ].map(opt => {
          const active = statusFilter === opt.k;
          return (
            <button key={opt.k} onClick={() => setStatusFilter(opt.k)} style={{
              padding: "6px 12px",
              background: active ? t.bgElevated : "transparent",
              border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
              borderRadius: 8, fontSize: 11, fontWeight: 700,
              color: active ? t.text : t.textMuted,
              cursor: "pointer", fontFamily: "inherit",
            }}>{opt.lbl}</button>
          );
        })}
      </div>

      {/* 합계 카드 */}
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{
          background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
          padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <Wallet size={18} style={{ color: t.accent }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4, marginBottom: 2 }}>
              합계{hasSearch ? " (검색)" : ""}
            </div>
            <div style={{ fontSize: 11, color: t.textSecondary }}>
              <span className="mono" style={{ fontWeight: 700, color: t.text }}>{summary.count}</span>건
              <span style={{ color: t.textDim, margin: "0 6px" }}>·</span>
              송금액 <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(summary.totalRemit)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 날짜별 그룹 */}
      <div style={{ padding: "0 16px 24px" }}>
        {dateGroups.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Wallet size={48} style={{ color: t.textMuted, opacity: 0.5, margin: "0 auto 16px" }}/>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8 }}>
              {hasSearch ? "검색 결과가 없습니다" : "해당 조건의 입금 내역이 없습니다"}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.6 }}>
              {hasSearch ? "검색어를 다시 확인해 보세요" : "월 또는 상태 필터를 변경해 보세요"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {dateGroups.map(([ymd, engineerGroups]) => (
              <DateSection
                key={ymd}
                t={t}
                ymd={ymd}
                engineerGroups={engineerGroups}
                fmtKRW={fmtKRW}
                onTaskClick={onTaskClick}
                defaultSubOpen={hasSearch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 날짜 섹션 — 기본 펼침, 안에 기사 묶음들
// ──────────────────────────────────────────────
function DateSection({ t, ymd, engineerGroups, fmtKRW, onTaskClick, defaultSubOpen }) {
  const [open, setOpen] = useState(true);
  const allTasks = engineerGroups.flatMap(([, tasks]) => tasks);
  const sectionTotal = allTasks.reduce((s, task) => s + calcRemitAmount(task), 0);

  return (
    <div style={{ background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", padding: "10px 12px",
          background: "transparent", border: "none", cursor: "pointer",
          color: t.text, fontFamily: "inherit", textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.text }}>
            {dateLabel(ymd)}
          </div>
          <div style={{ flex: 1 }}/>
          <div style={{ fontSize: 11, color: t.textSecondary }}>
            <span className="mono" style={{ fontWeight: 700, color: t.text }}>{allTasks.length}</span>건
            <span style={{ color: t.textDim, margin: "0 5px" }}>·</span>
            <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(sectionTotal)}</span>
          </div>
          {open ? <ChevronUp size={14} style={{ color: t.textMuted }}/> : <ChevronDown size={14} style={{ color: t.textMuted }}/>}
        </div>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
          {engineerGroups.map(([engineer, tasks]) => (
            <EngineerSubGroup
              key={engineer}
              t={t}
              engineer={engineer}
              tasks={tasks}
              fmtKRW={fmtKRW}
              onTaskClick={onTaskClick}
              defaultOpen={defaultSubOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 기사 묶음 — 헤더(상태배지+기사명+건수+소계+토글) / 펼치면 세부 행
// 기본 접힘. 검색 모드일 때 자동 펼침(defaultOpen=true).
// ──────────────────────────────────────────────
function EngineerSubGroup({ t, engineer, tasks, fmtKRW, onTaskClick, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const subTotal = tasks.reduce((s, task) => s + calcRemitAmount(task), 0);
  const subStatus = computeSubGroupStatus(tasks);

  return (
    <div style={{ background: t.bgInset, border: `1px solid ${t.border}`, borderRadius: 8, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", padding: "8px 10px",
          background: "transparent", border: "none", cursor: "pointer",
          color: t.text, fontFamily: "inherit", textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge status={subStatus} t={t}/>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{engineer}</span>
          <span style={{ fontSize: 11, color: t.textSecondary, whiteSpace: "nowrap" }}>
            <span className="mono" style={{ fontWeight: 700, color: t.text }}>{tasks.length}</span>건
          </span>
          <div style={{ flex: 1 }}/>
          <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: t.accent, whiteSpace: "nowrap" }}>
            {fmtKRW(subTotal)}
          </span>
          {open ? <ChevronUp size={14} style={{ color: t.textMuted }}/> : <ChevronDown size={14} style={{ color: t.textMuted }}/>}
        </div>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id || task.taskId}
              t={t}
              task={task}
              fmtKRW={fmtKRW}
              onClick={() => onTaskClick && onTaskClick(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 세부 작업 행: [고객명 (품목×수량)] [송금액]
// (상태배지/기사명은 묶음 헤더에 있음)
// ──────────────────────────────────────────────
function TaskRow({ t, task, fmtKRW, onClick }) {
  const itemSummary = `${task.appliance || "—"}×${task.qty || 1}`;
  const amount = calcRemitAmount(task);
  const customer = task.customer || "—";
  const taskNo = task.taskNo || task.taskCode || "";

  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        padding: "7px 10px", background: t.bgElevated, borderRadius: 6,
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{customer}</span>
      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap" }}>
        ({itemSummary})
      </span>
      {taskNo && (
        <span className="mono" style={{ fontSize: 10, color: t.textDim, whiteSpace: "nowrap" }}>
          · {taskNo}
        </span>
      )}
      <div style={{ flex: 1 }}/>
      <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: t.accent, whiteSpace: "nowrap" }}>
        {fmtKRW(amount)}
      </span>
    </div>
  );
}
