// ============================================
// SettlementHistoryContent — 운영자 "입금 내역" 화면
// 2026-05-22 — 회사 송금 통장 내역 (조회 전용)
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
// 조회 전용. 확인/취소 버튼 없음 — 메인 정산 탭에서만 처리.
// ============================================

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Wallet, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
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

// 상태 (단일 task 기준 — 메인 탭 computeGroupStatus 4상태와 동일 규칙).
function pickRowStatus(task) {
  if (task.engineerRemitConfirmedAt || task.engineer_remit_confirmed_at) return "confirmed";
  if (task.engineerRemittedAt       || task.engineer_remitted_at)       return "reported";
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
  // d: Date → "yyyy-mm" (KST)
  const ymd = toKstYmd(d);
  return ymd ? ymd.slice(0, 7) : "";
}

function nowKstYm() {
  return kstYmFromDate(new Date());
}

function prevKstYm() {
  const now = new Date();
  // KST 기준 이전 월 — KST 자정으로 안전하게 한 달 빼기
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
// 상태 배지 — 메인 탭 RemitStatusBadge 와 동일 톤 (단순화 — 3상태만)
// ──────────────────────────────────────────────
function StatusBadge({ status, t }) {
  const MAP = {
    pending:   { Icon: AlertTriangle, bg: "rgba(180,178,169,0.18)", color: "#B4B2A9", label: "미입금" },
    reported:  { Icon: Clock,         bg: "rgba(24,95,165,0.20)",   color: "#B5D4F4", label: "확인 대기" },
    confirmed: { Icon: CheckCircle2,  bg: "rgba(15,110,86,0.25)",   color: "#9FE1CB", label: "입금 완료" },
  };
  const cfg = MAP[status] || MAP.pending;
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", borderRadius: 8,
      background: cfg.bg, color: cfg.color,
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
  const filtered = useMemo(() => {
    if (statusFilter === "all") return monthFiltered;
    return monthFiltered.filter(task => pickRowStatus(task) === statusFilter);
  }, [monthFiltered, statusFilter]);

  // 날짜별 그룹 (내림차순)
  const dateGroups = useMemo(() => {
    const map = new Map();
    for (const task of filtered) {
      const ymd = toKstYmd(pickRowDate(task));
      if (!ymd) continue;
      if (!map.has(ymd)) map.set(ymd, []);
      map.get(ymd).push(task);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));
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

      {/* 필터 바 */}
      <div style={{ padding: "12px 16px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
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
              합계
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
              해당 조건의 입금 내역이 없습니다
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.6 }}>
              월 또는 상태 필터를 변경해 보세요
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {dateGroups.map(([ymd, tasks]) => (
              <DateSection
                key={ymd}
                t={t}
                ymd={ymd}
                tasks={tasks}
                fmtKRW={fmtKRW}
                onTaskClick={onTaskClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 날짜 섹션 (접힘/펼침 — 기본 펼침)
// ──────────────────────────────────────────────
function DateSection({ t, ymd, tasks, fmtKRW, onTaskClick }) {
  const [open, setOpen] = useState(true);
  const sectionTotal = tasks.reduce((s, task) => s + calcRemitAmount(task), 0);

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
            <span className="mono" style={{ fontWeight: 700, color: t.text }}>{tasks.length}</span>건
            <span style={{ color: t.textDim, margin: "0 5px" }}>·</span>
            <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(sectionTotal)}</span>
          </div>
          {open ? <ChevronUp size={14} style={{ color: t.textMuted }}/> : <ChevronDown size={14} style={{ color: t.textMuted }}/>}
        </div>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {tasks.map((task) => (
            <RowItem
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
// 행: [상태배지] [기사명] [고객(품목×수량)] [송금액]
// ──────────────────────────────────────────────
function RowItem({ t, task, fmtKRW, onClick }) {
  const status = pickRowStatus(task);
  const itemSummary = `${task.appliance || "—"}×${task.qty || 1}`;
  const amount = calcRemitAmount(task);
  const engineer = task.engineer || task.assignedEngineer || "—";
  const customer = task.customer || "—";

  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        padding: "8px 10px", background: t.bgInset, borderRadius: 8,
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
      }}
    >
      <StatusBadge status={status} t={t}/>
      <span style={{ fontSize: 12, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>{engineer}</span>
      <span style={{ fontSize: 11, color: t.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {customer} <span style={{ color: t.textMuted }}>({itemSummary})</span>
      </span>
      <div style={{ flex: 1 }}/>
      <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: t.accent, whiteSpace: "nowrap" }}>
        {fmtKRW(amount)}
      </span>
    </div>
  );
}
