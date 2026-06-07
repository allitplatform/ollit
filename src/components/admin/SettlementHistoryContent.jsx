// ============================================
// SettlementHistoryContent — 운영자 "입금 내역" 화면
// 2026-05-22 — 회사 송금 통장 내역 (조회 전용)
// 2026-06-07 — 미입금/연체 표시 추가 (사장님 spec): outstanding 가시성 갭 보완.
//
// 구조: 날짜 그룹 > 기사 묶음(접기/펼치기) > 세부 작업 행 (3단)
//
// 기준 dataset:
//   · 트랙 🅐 (isTrackARemittance) 완료 작업 전부 (remit date 없어도 포함).
//   · 날짜 기준:
//       (a) 정산건 (remit/confirm 있음): engineerRemitConfirmedAt → engineerRemittedAt
//       (b) 미정산: completedAt KST (toKstYmd)
//
// 행당 금액: 송금액 = totalAmount - engineer_amount
//   · totalAmount = product_price + extra_fee + travel_fee (DB GENERATED)
//   · engineer_amount = compute_payment v14 가 계산한 기사 몫
//   · 회사가 보유/원청에 송금하는 합계 = principal_amount + owner_amount = totalAmount - engineer_amount
//
// 상태 — 4종 (사장님 spec 2026-06-07):
//   · confirmed (입금 완료) = engineer_remit_confirmed_at 있음 — 초록
//   · reported (확인 대기)  = engineer_remitted_at 있고 confirmed 없음 — 파랑
//   · overdue (연체)        = 둘 다 NULL & 현재 > 완료일 23:00 KST — 빨강
//   · pending (미입금)      = 둘 다 NULL & 마감 전 — 회색
//
// 합계 분리 (사장님 spec):
//   · 송금액 (상단)       = confirmed + reported 만 합산
//   · 미입금 N건 ₩Z (별도) = pending + overdue 만 합산
//
// 검색: 기사명 + 고객명 + 작업번호 부분 일치 (소문자 비교)
//
// 조회 전용. 확인/취소 버튼 없음 — 메인 정산 탭에서만 처리.
// ============================================

import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Wallet, Clock, CheckCircle2, AlertTriangle, Search, X } from "lucide-react";
import { isRemittanceTarget } from "../../utils/remitFilter.js";
import { toKstYmd } from "../../utils/dateLabel.js";
// 2026-06-07 — 원청 지급 측측 측측 데이터 fetch (KA/crikrin, Mig 100 principal_daily_remittances)
import { supabase } from "../../lib/supabase.js";

// ──────────────────────────────────────────────
// 헬퍼: 행 날짜
//   (a) 정산건 = confirmed > reported
//   (b) 미정산 = completedAt (KST 그룹/정렬 기준)
// ──────────────────────────────────────────────
function pickRowDate(task) {
  return task.engineerRemitConfirmedAt
      || task.engineer_remit_confirmed_at
      || task.engineerRemittedAt
      || task.engineer_remitted_at
      || task.completedAt
      || task.completed_at
      || null;
}

// 미정산 마감 시각 (완료일 23:00 KST). NULL → null.
function unpaidDeadline(task) {
  const completedKst = toKstYmd(task.completedAt || task.completed_at);
  if (!completedKst) return null;
  return new Date(`${completedKst}T23:00:00+09:00`);
}

// 상태 (단일 task 기준) — 4종.
//   confirmed (입금 완료) / reported (확인 대기) / overdue (연체) / pending (미입금)
function pickRowStatus(task) {
  if (task.engineerRemitConfirmedAt || task.engineer_remit_confirmed_at) return "confirmed";
  if (task.engineerRemittedAt       || task.engineer_remitted_at)       return "reported";
  const dl = unpaidDeadline(task);
  if (dl && new Date() > dl) return "overdue";
  return "pending";
}

// 묶음 통합 상태 — 4종.
//   모두 confirmed → confirmed / 모두 reported → reported /
//   1건 이상 overdue → overdue / 그 외 → pending
function computeSubGroupStatus(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return "pending";
  if (tasks.every(t => t.engineerRemitConfirmedAt || t.engineer_remit_confirmed_at)) return "confirmed";
  if (tasks.every(t => t.engineerRemittedAt       || t.engineer_remitted_at))       return "reported";
  if (tasks.some(t  => pickRowStatus(t) === "overdue")) return "overdue";
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
  // 2026-06-07 — 4종으로 확장 (overdue 추가). 라이트/다크 테마 토큰 그대로.
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
  // 2026-06-07 — 상단 측측 측측: [기사 송금] (현행) / [원청 지급] (KA/crikrin 측측).
  const [topTab, setTopTab] = useState("engineer");  // 'engineer' | 'principal'
  const [monthFilter, setMonthFilter] = useState("this"); // this | last | all
  const [statusFilter, setStatusFilter] = useState("all"); // all | reported | confirmed
  const [searchQuery, setSearchQuery] = useState("");
  const fmtKRW = (n) => `₩${(n || 0).toLocaleString("ko-KR")}`;

  // base: 송금/측측 측측 (출장비 측측) 완료건 전부.
  //   2026-06-07 사장님 spec — 그룹/필터 키는 '측측일자(completedAt KST)' 측측.
  //   측측 측측 측측 측측 (예: 측측 일괄 처리) → 측 작업의 측측일자측 측측 표시.
  const base = useMemo(() => {
    return (apiTasks || []).filter(task => {
      if (!isRemittanceTarget(task)) return false;
      return !!(task.completedAt || task.completed_at);
    });
  }, [apiTasks]);

  // 월 필터 적용 — 측측일자 측측 (작업일자).
  const monthFiltered = useMemo(() => {
    if (monthFilter === "all") return base;
    const target = monthFilter === "this" ? nowKstYm() : prevKstYm();
    return base.filter(task => {
      const ym = (toKstYmd(task.completedAt || task.completed_at) || "").slice(0, 7);
      return ym === target;
    });
  }, [base, monthFilter]);

  // 상태 필터 적용 — "unpaid" 칩은 pending + overdue 둘 다 포함 (2026-06-07).
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

  // 날짜별 그룹 (내림차순) — 각 날짜 안에서 기사별 sub-group.
  //   2026-06-07 사장님 spec — 그룹 키 측 측측일자(completedAt KST) 측측.
  //   측측 측측 측측 측측 (예: 측측 일괄 처리) → 측측측 측 작업 측측 측측 측측 측측.
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
    // [[ymd, [[engineer, tasks[]], ...]], ...]
    return Array.from(dateMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ymd, engMap]) => [
        ymd,
        Array.from(engMap.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      ]);
  }, [filtered]);

  // 합계 분리 (2026-06-07 사장님 spec):
  //   · totalRemit  = confirmed + reported (실제 입금)
  //   · unpaidAmount = pending + overdue (미입금 — 받은 돈 X)
  const summary = useMemo(() => {
    let count = 0;
    let totalRemit = 0;
    let unpaidCount = 0;
    let unpaidAmount = 0;
    for (const task of filtered) {
      count++;
      const amt = calcRemitAmount(task);
      const s = pickRowStatus(task);
      if (s === "pending" || s === "overdue") {
        unpaidCount++;
        unpaidAmount += amt;
      } else {
        totalRemit += amt;
      }
    }
    return { count, totalRemit, unpaidCount, unpaidAmount };
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

      {/* 2026-06-07 — 상단 측측 측측: [기사 송금] / [원청 지급] */}
      <div style={{ padding: "12px 16px 0", display: "flex", gap: 6 }}>
        {[
          { k: "engineer",  lbl: "👷 기사 송금" },
          { k: "principal", lbl: "🏢 원청 지급" },
        ].map(opt => {
          const active = topTab === opt.k;
          return (
            <button key={opt.k} onClick={() => setTopTab(opt.k)} style={{
              flex: 1, padding: "9px 8px",
              background: active ? t.bgElevated : "transparent",
              border: active ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
              borderRadius: 9, fontSize: 12, fontWeight: 700,
              color: active ? t.text : t.textMuted,
              cursor: "pointer", fontFamily: "inherit",
            }}>{opt.lbl}</button>
          );
        })}
      </div>

      {/* 원청 지급 측 측측 측측측 */}
      {topTab === "principal" && (
        <PrincipalPaymentHistory t={t} fmtKRW={fmtKRW}/>
      )}

      {topTab === "engineer" && (
      <>
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
          { k: "unpaid",    lbl: "미입금" },
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
            {/* 2026-06-07 — 미입금 별도 라인 (송금액 합계에 섞지 X) */}
            {summary.unpaidCount > 0 && (
              <div style={{ fontSize: 11, color: t.danger, marginTop: 2, fontWeight: 600 }}>
                미입금 <span className="mono" style={{ fontWeight: 800 }}>{summary.unpaidCount}</span>건
                <span style={{ color: t.textDim, margin: "0 5px" }}>·</span>
                <span className="mono" style={{ fontWeight: 800 }}>{fmtKRW(summary.unpaidAmount)}</span>
              </div>
            )}
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
      </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 날짜 섹션 — 측측값: 오늘(KST)측 측측, 측측 측측측 측측 (사장님 spec 2026-06-07).
// ──────────────────────────────────────────────
function DateSection({ t, ymd, engineerGroups, fmtKRW, onTaskClick, defaultSubOpen }) {
  const [open, setOpen] = useState(() => ymd === toKstYmd(new Date()));
  const allTasks = engineerGroups.flatMap(([, tasks]) => tasks);
  // 2026-06-07 — 송금액 = confirmed/reported만. 미입금은 별도.
  let sectionRemit = 0, sectionUnpaid = 0, sectionUnpaidCount = 0;
  for (const task of allTasks) {
    const amt = calcRemitAmount(task);
    const s = pickRowStatus(task);
    if (s === "pending" || s === "overdue") { sectionUnpaid += amt; sectionUnpaidCount++; }
    else                                     { sectionRemit  += amt; }
  }

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
          <div style={{ fontSize: 11, color: t.textSecondary, textAlign: "right" }}>
            <div>
              <span className="mono" style={{ fontWeight: 700, color: t.text }}>{allTasks.length}</span>건
              <span style={{ color: t.textDim, margin: "0 5px" }}>·</span>
              <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(sectionRemit)}</span>
            </div>
            {sectionUnpaidCount > 0 && (
              <div style={{ fontSize: 10, color: t.danger, fontWeight: 600, marginTop: 1 }}>
                미입금 <span className="mono">{sectionUnpaidCount}</span>건 · <span className="mono">{fmtKRW(sectionUnpaid)}</span>
              </div>
            )}
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
  // 2026-06-07 — 송금액 합계 = confirmed/reported만. 미입금 별도.
  let subRemit = 0, subUnpaid = 0, subUnpaidCount = 0;
  for (const task of tasks) {
    const amt = calcRemitAmount(task);
    const s = pickRowStatus(task);
    if (s === "pending" || s === "overdue") { subUnpaid += amt; subUnpaidCount++; }
    else                                     { subRemit  += amt; }
  }
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
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 11, fontWeight: 800, color: t.accent, whiteSpace: "nowrap" }}>
              {fmtKRW(subRemit)}
            </div>
            {subUnpaidCount > 0 && (
              <div style={{ fontSize: 10, color: t.danger, fontWeight: 600, whiteSpace: "nowrap" }}>
                미입금 {fmtKRW(subUnpaid)}
              </div>
            )}
          </div>
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
  // 2026-06-07 — 행별 상태 + 미입금 측측 측측 (연체 측측 측측 측측 측측 색).
  const status = pickRowStatus(task);
  const isUnpaid = status === "pending" || status === "overdue";
  const isOverdue = status === "overdue";
  const amountColor = isUnpaid ? t.danger : t.accent;

  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        padding: "7px 10px",
        background: t.bgElevated,
        borderRadius: 6,
        border: isOverdue ? `1px solid ${t.dangerBorder}` : "1px solid transparent",
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
      }}
    >
      <StatusBadge status={status} t={t}/>
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
      <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: amountColor, whiteSpace: "nowrap" }}>
        {fmtKRW(amount)}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────
// 2026-06-07 — 원청 지급 측측측 (KA / crikrin 측)
//   · Track A 완료 (출장비 측측) + completed_at 측측측 KST + principal_code IN ('KA','crikrin')
//   · (날짜, 측측) 측측 principal_amount 합 = 그날 그 측측 정산금
//   · principal_daily_remittances: (principal_id, settle_date) 측 측측 → 지급완료 + remitted_amount
//   · 측측 측측: 정산금 > 0 측만 측측. remit row 측 → 지급완료, 측 → 측측.
//   · 1000행 캡 측측: DB 측측 `.in("principal_code", [...]).gte/lt completed_at` 측측 측측.
// ──────────────────────────────────────────────
const TARGET_PRINCIPAL_CODES = ["KA", "crikrin"];

function PrincipalPaymentHistory({ t, fmtKRW }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tasks, setTasks] = useState([]);
  const [remits, setRemits] = useState([]);
  const [principals, setPrincipals] = useState([]);

  // 측측측 KST 측측 (1측 ~ 측 측측)
  const monthRange = useMemo(() => {
    const today = new Date();
    const ym = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit",
    }).format(today);
    const [y, m] = ym.split("-").map(Number);
    const startKst = `${ym}-01`;
    // 다측 측 1측 측측 측측측 측측 = 측측측 측측측
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const startUtc = new Date(`${startKst}T00:00:00+09:00`).toISOString();
    const endUtc   = new Date(`${nextY}-${String(nextM).padStart(2,"0")}-01T00:00:00+09:00`).toISOString();
    return { ym, startKst, startUtc, endUtc };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr("");
    (async () => {
      // 1) principals (KA/crikrin) id 측측
      const { data: pData, error: pErr } = await supabase
        .from("principals").select("id, code, name").in("code", TARGET_PRINCIPAL_CODES);
      if (pErr || !pData || pData.length === 0) {
        if (alive) { setErr(pErr?.message || "원청 정보 조회 실패"); setLoading(false); }
        return;
      }
      const pids = pData.map(p => p.id);

      // 2) Track A 완료 측측 (출장비 측측) measure 측측 + principal_id IN + completed_at 측측측
      //    1000행 캡 측측 페이지측측측측. 한 측측 측측 수십 ~ 수백건 측측 → MAX_PAGES=10 측측.
      const PAGE = 1000;
      let rows = [];
      for (let page = 0; page < 10; page++) {
        const off = page * PAGE;
        const { data, error } = await supabase
          .from("tasks")
          .select(`id, task_no, customer_name, status, completed_at, principal_id, principals:principal_id(code, name),
                   payments(principal_amount, track)`)
          .in("principal_id", pids)
          .gte("completed_at", monthRange.startUtc)
          .lt("completed_at",  monthRange.endUtc)
          .neq("status", "취소")
          .order("completed_at", { ascending: false })
          .range(off, off + PAGE - 1);
        if (error) {
          if (alive) { setErr(error.message); setLoading(false); }
          return;
        }
        if (!data || data.length === 0) break;
        rows = rows.concat(data);
        if (data.length < PAGE) break;
      }
      // Track A + visit_only 측측 (isRemittanceTarget 동측 측측)
      const filtered = rows.filter(r => {
        if (r.status === "visit_only") return false;
        const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
        const track = p?.track || "A";
        return track === "A";
      });

      // 3) principal_daily_remittances 측측 (측측측, principal_id IN)
      const { data: remitData } = await supabase
        .from("principal_daily_remittances")
        .select("principal_id, settle_date, remitted_amount, remitted_at, remitted_by, note")
        .in("principal_id", pids)
        .gte("settle_date", monthRange.startKst);

      if (!alive) return;
      setPrincipals(pData);
      setTasks(filtered);
      setRemits(remitData || []);
      setLoading(false);
    })().catch(e => { if (alive) { setErr(e?.message || "에러"); setLoading(false); } });
    return () => { alive = false; };
  }, [monthRange.startUtc, monthRange.endUtc, monthRange.startKst]);

  // (날짜, 측측) 측측 정산금 합
  const dailyMap = useMemo(() => {
    // Map<ymd, Map<principal_id, { count, total }>>
    const m = new Map();
    for (const r of tasks) {
      const ymd = toKstYmd(r.completed_at);
      if (!ymd) continue;
      if (!m.has(ymd)) m.set(ymd, new Map());
      const pm = m.get(ymd);
      if (!pm.has(r.principal_id)) pm.set(r.principal_id, { count: 0, total: 0 });
      const cell = pm.get(r.principal_id);
      cell.count += 1;
      const p = Array.isArray(r.payments) ? r.payments[0] : r.payments;
      cell.total += Number(p?.principal_amount) || 0;
    }
    return m;
  }, [tasks]);

  const remitMap = useMemo(() => {
    const m = new Map();
    for (const r of remits) m.set(`${r.principal_id}|${r.settle_date}`, r);
    return m;
  }, [remits]);

  // 측측측 (지급완료 측측 측 + 측측 측측 측측)
  const summary = useMemo(() => {
    let paidTotal = 0, paidCount = 0;
    let pendingTotal = 0, pendingCount = 0;
    for (const [ymd, pm] of dailyMap.entries()) {
      for (const [pid, cell] of pm.entries()) {
        if (cell.total <= 0) continue;
        const remit = remitMap.get(`${pid}|${ymd}`);
        if (remit) {
          paidTotal += Number(remit.remitted_amount) || cell.total;
          paidCount += 1;
        } else {
          pendingTotal += cell.total;
          pendingCount += 1;
        }
      }
    }
    return { paidTotal, paidCount, pendingTotal, pendingCount };
  }, [dailyMap, remitMap]);

  // 측측 측측 측측측 측측 (date desc)
  const dateRows = useMemo(() => {
    const entries = [...dailyMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    return entries.map(([ymd, pm]) => {
      const rowsForDate = [];
      for (const p of principals) {
        const cell = pm.get(p.id);
        if (!cell || cell.total <= 0) continue;
        const remit = remitMap.get(`${p.id}|${ymd}`);
        rowsForDate.push({
          principalId: p.id, code: p.code, name: p.name,
          count: cell.count, total: cell.total,
          remitDone: !!remit,
          remittedAmount: remit ? Number(remit.remitted_amount) : null,
        });
      }
      return { ymd, rows: rowsForDate };
    }).filter(g => g.rows.length > 0);
  }, [dailyMap, remitMap, principals]);

  return (
    <div>
      {/* 측측 카드 */}
      <div style={{ padding: "0 16px 12px", paddingTop: 12 }}>
        <div style={{
          background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
          padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <Wallet size={18} style={{ color: t.accent }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4, marginBottom: 2 }}>
              이번 달 합계
            </div>
            <div style={{ fontSize: 11, color: t.textSecondary }}>
              지급 완료 <span className="mono" style={{ fontWeight: 700, color: t.text }}>{summary.paidCount}</span>건
              <span style={{ color: t.textDim, margin: "0 6px" }}>·</span>
              <span className="mono" style={{ fontWeight: 800, color: t.success }}>{fmtKRW(summary.paidTotal)}</span>
            </div>
            {summary.pendingCount > 0 && (
              <div style={{ fontSize: 11, color: t.warning, marginTop: 2, fontWeight: 600 }}>
                미지급 <span className="mono" style={{ fontWeight: 800 }}>{summary.pendingCount}</span>건
                <span style={{ color: t.textDim, margin: "0 5px" }}>·</span>
                <span className="mono" style={{ fontWeight: 800 }}>{fmtKRW(summary.pendingTotal)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 측측 측측 */}
      <div style={{ padding: "0 16px 24px" }}>
        {loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>
            불러오는 중...
          </div>
        ) : err ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: t.danger, fontSize: 12 }}>
            ⚠️ {err}
          </div>
        ) : dateRows.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Wallet size={48} style={{ color: t.textMuted, opacity: 0.5, margin: "0 auto 16px" }}/>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8 }}>
              이번 달 지급 내역이 없습니다
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dateRows.map(g => (
              <PrincipalDateGroup key={g.ymd} t={t} ymd={g.ymd} rows={g.rows} fmtKRW={fmtKRW}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PrincipalDateGroup({ t, ymd, rows, fmtKRW }) {
  // 2026-06-07 — 측측값: 오늘(KST)측 측측, 측측 측측측 측측 (사장님 spec).
  const [open, setOpen] = useState(() => ymd === toKstYmd(new Date()));
  const sectionPaid    = rows.filter(r => r.remitDone).reduce((s, r) => s + (r.remittedAmount ?? r.total), 0);
  const sectionPending = rows.filter(r => !r.remitDone).reduce((s, r) => s + r.total, 0);
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
          <div style={{ fontSize: 12, fontWeight: 800, color: t.text }}>{dateLabel(ymd)}</div>
          <div style={{ flex: 1 }}/>
          <div style={{ textAlign: "right", fontSize: 11 }}>
            <div>
              <span className="mono" style={{ fontWeight: 700, color: t.text }}>{rows.length}</span>건
              <span style={{ color: t.textDim, margin: "0 5px" }}>·</span>
              <span className="mono" style={{ fontWeight: 800, color: t.accent }}>{fmtKRW(sectionPaid)}</span>
            </div>
            {sectionPending > 0 && (
              <div style={{ fontSize: 10, color: t.warning, fontWeight: 600, marginTop: 1 }}>
                미지급 <span className="mono">{fmtKRW(sectionPending)}</span>
              </div>
            )}
          </div>
          {open ? <ChevronUp size={14} style={{ color: t.textMuted }}/> : <ChevronDown size={14} style={{ color: t.textMuted }}/>}
        </div>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map(r => (
            <PrincipalRow key={r.principalId} t={t} row={r} fmtKRW={fmtKRW}/>
          ))}
        </div>
      )}
    </div>
  );
}

function PrincipalRow({ t, row, fmtKRW }) {
  const amount = row.remitDone ? (row.remittedAmount ?? row.total) : row.total;
  const amountColor = row.remitDone ? t.accent : t.warning;
  return (
    <div style={{
      padding: "7px 10px",
      background: t.bgInset,
      borderRadius: 8,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {/* 측측 측측 (입금 측측 / 측측) */}
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "2px 7px", borderRadius: 8,
        background: row.remitDone ? t.successBg : t.warningBg,
        color: row.remitDone ? t.success : t.warning,
        border: `1px solid ${row.remitDone ? t.successBorder : t.warningBorder}`,
        fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
      }}>
        {row.remitDone ? <CheckCircle2 size={10}/> : <Clock size={10}/>}
        {row.remitDone ? "지급 완료" : "대기"}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{row.name}</span>
      <span style={{ fontSize: 11, color: t.textSecondary }}>
        완료 <span className="mono" style={{ fontWeight: 700, color: t.text }}>{row.count}</span>건
      </span>
      <div style={{ flex: 1 }}/>
      <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: amountColor, whiteSpace: "nowrap" }}>
        {fmtKRW(amount)}
      </span>
    </div>
  );
}
