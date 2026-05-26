// 유솔 포털 정산 탭 — 네이버 주차 정산 + 입금 워크플로 (Phase 1+2)
// 2026-05-23
//
// 사장님 spec:
//   · 단위: 항목(task_item), naver_settled_at 기준 ISO 주(월~일) 묶음
//   · 금액: subtotal
//   · 주차 카드 상태 3단계:
//       입금 예정     (row 없음)                       — 파랑
//       입금 확인 중  (remitted_at NOT NULL, !confirm) — 앰버
//       입금완료     (confirmed_at NOT NULL)           — 초록
//   · 드릴인에 "입금했습니다" / "보고 취소" 버튼
//   · 이번 주(오늘 포함) 카드 테두리 — 핑크 #FF4D9E
//   · 전체 현황 — 배경·테두리 제거 (단계 시각만 표시)
import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, ChevronLeft, Check } from "lucide-react";
import {
  fetchPrincipalSettleItems,
  getSettleStageKey,
  getNaverSettleWeek,
  getItemLabel,
  SETTLE_STAGES,
} from "../../lib/principalSettleDb.js";
import {
  fetchPrincipalWeeklyRemittances,
  markPrincipalRemitted,
  undoPrincipalRemit,
} from "../../lib/principalRemitDb.js";
import { supabase } from "../../lib/supabase.js";
// 2026-05-26 — 기사 입금 내역 화면 (usol_n 측 cleaning + extra_fee 15%)
import { UsolRemitHistoryScreen } from "./UsolRemitHistoryScreen.jsx";

// 색 토큰 — 시안 확정
const C_MAGENTA = "#FF4D9E";
const C_GREEN   = "#5DCAA5";
const C_BLUE    = "#6AAAEC";
const C_AMBER   = "#E6A33A";
const C_GRAY    = "#9CA3AF";
const C_DOT     = "#4A4A4A";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 회사 입금액 = ROUND(net_amount × 0.85). net_amount NULL → 0.
//   (사장님 정의 — 네이버 정산금액 × 0.85)
function companyAmountOf(item) {
  const n = item?.net_amount;
  if (n == null) return 0;
  return Math.round(Number(n) * 0.85);
}

// "M월 N주차" — 그 달의 첫 주(1일 포함 주)부터 카운트, sunday의 달 기준
function getKoreanWeekLabel(monday, sunday) {
  const year  = sunday.getFullYear();
  const month = sunday.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayDow = firstDay.getDay() || 7;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - (firstDayDow - 1));
  const diff = Math.round((monday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${month + 1}월 ${diff + 1}주차`;
}

function getThisWeekMondayKey() {
  const now = new Date();
  const dow = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow - 1));
  mon.setHours(0, 0, 0, 0);
  return toIsoDate(mon);
}

function getNextMonday(sunday) {
  const d = new Date(sunday);
  d.setDate(sunday.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDate(d) {
  // 로컬 KST 기준 YYYY-MM-DD (UTC slice 측 측 catch)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMD(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatMDWithDow(d) {
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

// 주차 입금 상태 — 신규 워크플로 (principal_weekly_remittances)
// 항목 측 principal_id별 remitMap에 row가 있는지 확인
function getWeekRemitStatus(items, remitMap) {
  // 항목 측 principal_id 측 — 같은 주차에 여러 principal 측 측 측 catch
  const principalIds = [...new Set(items.map(it => it.principal_id).filter(Boolean))];
  if (principalIds.length === 0) return { kind: "expected", remits: [] };

  const remits = principalIds.map(pid => remitMap.get(pid));
  const anyExist = remits.some(r => r);
  if (!anyExist) return { kind: "expected", remits: [] };

  const allConfirmed = remits.every(r => r && r.confirmed_at);
  if (allConfirmed) return { kind: "done", remits };

  const allReported = remits.every(r => r && r.remitted_at);
  if (allReported) return { kind: "reported", remits };

  // 일부만 보고된 (혼합) 경우 — "확인 중"으로 표시
  return { kind: "reported", remits: remits.filter(Boolean) };
}

export function PrincipalSettleTab({ principalCodes, onSelect }) {
  const [items, setItems] = useState([]);
  const [remits, setRemits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // 뷰 전환
  const [selectedWeekKey, setSelectedWeekKey] = useState(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  // 2026-05-26 — 기사 입금 내역 화면 진입 state (usol_n principal 만 노출)
  const [showUsolHistory, setShowUsolHistory] = useState(false);

  const refresh = useCallback(() => setReloadTick(v => v + 1), []);

  useEffect(() => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) return;
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      fetchPrincipalSettleItems({ principalCodes, monthsBack: 3 }),
      fetchPrincipalWeeklyRemittances({ principalCodes, monthsBack: 3 }),
    ]).then(([itemsRes, remitRes]) => {
      if (!alive) return;
      if (!itemsRes.ok) setError(itemsRes.error || "정산 항목 조회 실패");
      setItems(itemsRes.items || []);
      setRemits(remitRes.remits || []);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [principalCodes, reloadTick]);

  // 전체 현황 수치
  const summary = useMemo(() => {
    const live = items.filter(it => it.task_status !== "취소");
    const before = live.filter(it => ["배정", "확정"].includes(it.task_status));
    const done = live.filter(it => it.task_status === "완료");
    const settled = live.filter(it => it.naver_settled_at);
    const pendingSettle = done.filter(it => !it.naver_settled_at);
    // 2026-05-26 — 회사→유솔 실 입금액(=ROUND(net_amount × 0.85))으로 통일.
    //   기존 Σsubtotal 은 네이버 수수료/마진 차감 전 그로스라 주차별 카드와 불일치 → 시정.
    const pendingAmount = pendingSettle.reduce((s, it) => s + companyAmountOf(it), 0);
    return {
      received: live.length, beforeWork: before.length, doneWork: done.length,
      settled: settled.length, pendingCount: pendingSettle.length, pendingAmount,
    };
  }, [items]);

  // 주차 묶음 (사장님 결정 — 정산 대기 정의 통일)
  //   pending 묶음 = 전체 현황 summary.pendingCount와 같은 집합
  //     = task.status='완료' AND naver_settled_at NULL
  //   미완료(배정/확정/진행중/미배정) + 취소 task_item은 정산 탭에 안 나타남.
  const weeks = useMemo(() => {
    const map = new Map();
    const pending = [];
    for (const it of items) {
      const wk = getNaverSettleWeek(it);
      if (!wk) {
        if (it.task_status === "완료") pending.push(it);
        continue;
      }
      if (!map.has(wk.key)) map.set(wk.key, { ...wk, items: [] });
      map.get(wk.key).items.push(it);
    }
    const list = [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
    if (pending.length > 0) {
      list.push({ key: "pending", year: null, week: null, monday: null, sunday: null, items: pending });
    }
    return list;
  }, [items]);

  // 입금 보고 lookup — (principal_id, week_start) → remit row
  const remitMap = useMemo(() => {
    const m = new Map(); // key = `${principal_id}|${week_start}`
    for (const r of remits) {
      m.set(`${r.principal_id}|${r.week_start}`, r);
    }
    return m;
  }, [remits]);

  function getRemitMapForWeek(weekMondayIso) {
    const sub = new Map();
    for (const r of remits) {
      if (r.week_start === weekMondayIso) sub.set(r.principal_id, r);
    }
    return sub;
  }

  // 보고 액션
  async function handleReport(week) {
    const weekStart = toIsoDate(week.monday);
    const weekEnd   = toIsoDate(week.sunday);
    // principal_id 측 그룹 — 측 principal 측 measurement 측 RPC 호출 (Promise.all)
    const byPrincipal = new Map();
    for (const it of week.items) {
      const pid = it.principal_id;
      if (!pid) continue;
      if (!byPrincipal.has(pid)) byPrincipal.set(pid, { sum: 0, code: null });
      const slot = byPrincipal.get(pid);
      // 회사 입금액 = ROUND(net_amount × 0.85). net_amount NULL → 0.
      slot.sum += companyAmountOf(it);
    }
    // principal_id → code 매핑 (principalCodes 측 catch 측 측 X → tasks JOIN 측 측 X)
    // 측 측 — items 측 측 principal_id 그대로 RPC 측 측 (markPrincipalRemitted 측 code 측 받음 → 측 측 측 측)
    // 측 측 measurement code 측 측 — fetchPrincipalSettleItems 측 측 principal_id 측 측. code 측 측 X.
    // → markPrincipalRemitted 측 principalId 측 측 측 측 X → principalRemitDb 측 principalCode 측 → principal_id 매핑
    // 측 — items 측 principal_id 측 catch 측 measurement, principalCodes prop 측 측 catch
    // 측 measurement (principal_id → code): principalCodes 측 측 1:1 측 X → fetch 측 측 catch
    const reverseMap = await resolvePidToCodeMap(principalCodes);

    const tasks = [];
    for (const [pid, slot] of byPrincipal) {
      const code = reverseMap.get(pid);
      if (!code) continue;
      tasks.push(markPrincipalRemitted({
        principalCode: code,
        weekStart, weekEnd,
        amount: slot.sum,
      }));
    }
    const results = await Promise.all(tasks);
    const failed = results.find(r => !r.ok);
    if (failed) {
      alert("보고 실패: " + (failed.error || "알 수 없는 오류"));
      return;
    }
    refresh();
  }

  async function handleUndo(remitIds) {
    const results = await Promise.all(remitIds.map(id => undoPrincipalRemit({ remitId: id })));
    const failed = results.find(r => !r.ok);
    if (failed) {
      alert("보고 취소 실패: " + (failed.error || "알 수 없는 오류"));
      return;
    }
    refresh();
  }

  const thisWeekMondayKey = getThisWeekMondayKey();

  if (loading) return <div style={{ padding: "40px 20px", textAlign: "center", color: C_GRAY, fontSize: 12 }}>불러오는 중...</div>;
  if (error)   return <div style={{ padding: "40px 20px", textAlign: "center", color: "#EF4444", fontSize: 12 }}>⚠️ {error}</div>;

  // 드릴인 뷰
  if (selectedWeekKey) {
    const wk = weeks.find(w => w.key === selectedWeekKey);
    if (!wk) { setSelectedWeekKey(null); return null; }
    const weekRemits = wk.monday ? getRemitMapForWeek(toIsoDate(wk.monday)) : new Map();
    return (
      <WeekDetailView
        week={wk}
        weekRemits={weekRemits}
        onBack={() => { setSelectedWeekKey(null); setSearch(""); setStageFilter("all"); setDateFilter(""); }}
        onReport={() => handleReport(wk)}
        onUndo={(ids) => handleUndo(ids)}
        onSelect={onSelect}
        search={search} setSearch={setSearch}
        stageFilter={stageFilter} setStageFilter={setStageFilter}
        dateFilter={dateFilter} setDateFilter={setDateFilter}
      />
    );
  }

  // 2026-05-26 — 기사 입금 내역 화면 (usol_n 측만 노출). 사장님 spec: settle 탭 측 카드 클릭 진입.
  if (showUsolHistory) {
    return <UsolRemitHistoryScreen onBack={() => setShowUsolHistory(false)}/>;
  }

  // usol_n principal 측 노출 — principalCodes 측 usol_n 포함 시만 진입 카드 표시
  const hasUsolN = Array.isArray(principalCodes) && principalCodes.includes("usol_n");

  // pending 묶음 존재 시 SummarySection 의 정산 대기 줄을 클릭 가능하게.
  //   클릭 → setSelectedWeekKey('pending') → WeekDetailView 측 catch 측 catch 426건 상세 진입.
  const hasPendingBucket = weeks.some(w => w.key === "pending");

  // 리스트 뷰
  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      <SummarySection
        summary={summary}
        onPendingClick={hasPendingBucket ? () => setSelectedWeekKey("pending") : null}
      />

      {/* 2026-05-26 — 기사 입금 내역 진입 카드 (usol_n 측만) */}
      {hasUsolN && (
        <div
          onClick={() => setShowUsolHistory(true)}
          className="clickable"
          style={{
            marginTop: 14,
            background: "var(--bg-elevated, #1F1F1F)",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 12,
            padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 800,
              color: "var(--text-primary, #FAF8F5)",
              marginBottom: 3,
            }}>
              📥 기사 입금 내역
            </div>
            <div style={{ fontSize: 11, color: C_GRAY, fontWeight: 600 }}>
              세척 현장추가금 15% · 이번 달 기사별 보고 현황
            </div>
          </div>
          <span style={{ color: C_GRAY, fontSize: 18, fontWeight: 700 }}>›</span>
        </div>
      )}

      <div style={{ fontSize: 11, color: C_GRAY, margin: "18px 0 10px", fontWeight: 600 }}>
        주차별 정산
      </div>

      {/* 2026-05-26 — pending(정산 대기) 묶음은 위쪽 SummarySection 으로 통합.
            데이터(weeks)에서는 보존(드릴인 진입 측 catch 측 catch), 리스트 표시에서만 제외. */}
      {(() => {
        const visibleWeeks = weeks.filter(wk => wk.key !== "pending");
        if (visibleWeeks.length === 0) {
          return <EmptyBox>정산 항목이 없습니다</EmptyBox>;
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleWeeks.map(wk => (
              <WeekCard
                key={wk.key}
                week={wk}
                remitMap={wk.monday ? getRemitMapForWeek(toIsoDate(wk.monday)) : new Map()}
                isThisWeek={wk.monday && toIsoDate(wk.monday) === thisWeekMondayKey}
                onClick={() => setSelectedWeekKey(wk.key)}
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// principal_id → code 매핑 (1:1)
async function resolvePidToCodeMap(codes) {
  const { data } = await supabase.from("principals").select("id, code").in("code", codes);
  const m = new Map();
  for (const p of (data || [])) m.set(p.id, p.code);
  return m;
}

// 전체 현황 섹션 — 배경·테두리 없음 (시안 확정)
function SummarySection({ summary, onPendingClick }) {
  const steps = [
    { key: "received",   label: "접수",            value: summary.received },
    { key: "beforeWork", label: "일정 확정·작업 전", value: summary.beforeWork },
    { key: "doneWork",   label: "작업완료",         value: summary.doneWork },
  ];
  const clickable = typeof onPendingClick === "function" && summary.pendingCount > 0;
  return (
    <div style={{ padding: "4px 4px 0" }}>
      <div style={{ fontSize: 14, color: "var(--text-primary, #FAF8F5)", fontWeight: 800, marginBottom: 14 }}>
        전체 현황
      </div>

      {steps.map(s => <StepRow key={s.key} {...s} green={false} hasLineBelow={true}/>)}

      <div style={{ position: "relative", marginLeft: 4 }}>
        <div style={{ position: "absolute", left: 5, top: -8, width: 2, height: 18, background: C_DOT }}/>
        <div
          onClick={clickable ? onPendingClick : undefined}
          className={clickable ? "clickable" : ""}
          style={{
            marginLeft: 16, marginBottom: 6, marginTop: 10,
            background: "rgba(230,163,58,0.08)",
            borderLeft: `3px solid ${C_AMBER}`,
            borderRadius: 8, padding: "12px 14px",
            cursor: clickable ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C_AMBER, marginBottom: 4 }}>
              정산 대기 {summary.pendingCount}건
            </div>
            <div style={{ fontSize: 12, color: C_GRAY }}>
              작업 끝났는데 네이버 정산 전 · <span style={{ color: C_MAGENTA, fontWeight: 800, fontSize: 13 }}>
                ₩{summary.pendingAmount.toLocaleString()}
              </span>
            </div>
          </div>
          {clickable && (
            <span style={{ color: C_GRAY, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>›</span>
          )}
        </div>
        <div style={{ position: "absolute", left: 5, bottom: -8, width: 2, height: 18, background: C_DOT }}/>
      </div>

      <StepRow label="정산완료" value={summary.settled} green={true} hasLineBelow={false}/>
    </div>
  );
}

function StepRow({ label, value, green, hasLineBelow }) {
  return (
    <div style={{ position: "relative", marginLeft: 4, paddingLeft: 18, paddingBottom: hasLineBelow ? 18 : 0, minHeight: 26 }}>
      <div style={{
        position: "absolute", left: 0, top: 8,
        width: 12, height: 12, borderRadius: "50%",
        background: green ? C_GREEN : C_DOT,
        border: green ? `2px solid ${C_GREEN}` : `2px solid ${C_DOT}`,
        boxShadow: green ? `0 0 0 3px rgba(93,202,165,0.18)` : "none",
      }}/>
      {hasLineBelow && (
        <div style={{
          position: "absolute", left: 5, top: 20, width: 2, height: "calc(100% - 20px)",
          background: C_DOT,
        }}/>
      )}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, color: "var(--text-primary, #FAF8F5)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary, #FAF8F5)", fontFamily: "inherit", lineHeight: 1 }}>
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function WeekCard({ week, remitMap, isThisWeek, onClick }) {
  const isPending = week.key === "pending";
  // 회사 입금액 = Σ ROUND(net_amount × 0.85)
  const sumSubtotal = week.items.reduce((s, it) => s + companyAmountOf(it), 0);

  if (isPending) {
    return (
      <div onClick={onClick} style={{
        background: "var(--bg-elevated, #1F1F1F)",
        border: "1px dashed var(--border, #2A2A2A)",
        borderRadius: 10, padding: "12px 14px", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #FAF8F5)" }}>정산 대기</span>
          <span style={{ fontSize: 11, color: C_GRAY }}>{week.items.length}건</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C_AMBER }}>대기</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: C_MAGENTA, fontFamily: "inherit" }}>
            ₩{sumSubtotal.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  const weekLabel = getKoreanWeekLabel(week.monday, week.sunday);
  const dateRange = `${formatMD(week.monday)} ~ ${formatMD(week.sunday)}`;
  const status    = getWeekRemitStatus(week.items, remitMap);

  let statusElem;
  if (status.kind === "done") {
    const lastConfirm = status.remits.map(r => r.confirmed_at).filter(Boolean).sort().pop();
    const d = new Date(lastConfirm);
    statusElem = (
      <span style={{ fontSize: 11, fontWeight: 700, color: C_GREEN, display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
        <Check size={12} strokeWidth={3}/>입금완료 {formatMD(d)}
      </span>
    );
  } else if (status.kind === "reported") {
    statusElem = (
      <span style={{ fontSize: 11, fontWeight: 700, color: C_AMBER, whiteSpace: "nowrap" }}>
        입금 확인 중
      </span>
    );
  } else {
    const expected = getNextMonday(week.sunday);
    statusElem = (
      <span style={{ fontSize: 11, fontWeight: 700, color: C_BLUE, whiteSpace: "nowrap" }}>
        {formatMDWithDow(expected)} 입금 예정
      </span>
    );
  }

  return (
    <div onClick={onClick} style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: `1px solid ${isThisWeek ? C_MAGENTA : "var(--border, #2A2A2A)"}`,
      borderRadius: 10,
      padding: "12px 14px",
      cursor: "pointer",
      boxShadow: isThisWeek ? `0 0 0 1px ${C_MAGENTA}55` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #FAF8F5)" }}>{weekLabel}</span>
          <span style={{ fontSize: 11, color: C_GRAY }}>{dateRange}</span>
        </div>
        <span style={{ fontSize: 11, color: C_GRAY, whiteSpace: "nowrap" }}>네이버 정산 {week.items.length}건</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        {statusElem}
        <span style={{ fontSize: 17, fontWeight: 800, color: C_MAGENTA, fontFamily: "inherit", lineHeight: 1 }}>
          ₩{sumSubtotal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function WeekDetailView({ week, weekRemits, onBack, onReport, onUndo, onSelect, search, setSearch, stageFilter, setStageFilter, dateFilter, setDateFilter }) {
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    let list = week.items;
    if (stageFilter !== "all") list = list.filter(it => getSettleStageKey(it) === stageFilter);
    if (dateFilter) list = list.filter(it => (it.naver_settled_at || "").slice(0, 10) === dateFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(it => {
        const cust = String(it.customer_name || "").toLowerCase();
        const addr = String(it.address || "").toLowerCase();
        const tno  = String(it.task_no || "").toLowerCase();
        const poid = String(it.product_order_id || "").toLowerCase();
        return cust.includes(q) || addr.includes(q) || tno.includes(q) || poid.includes(q);
      });
    }
    return list;
  }, [week.items, stageFilter, dateFilter, search]);

  const dateOptions = useMemo(() => {
    const set = new Set();
    for (const it of week.items) if (it.naver_settled_at) set.add(it.naver_settled_at.slice(0, 10));
    return [...set].sort();
  }, [week.items]);

  const sumSubtotal = filtered.reduce((s, it) => s + companyAmountOf(it), 0);
  const isPending = week.key === "pending";
  const headerLabel = isPending
    ? "정산 대기"
    : `${getKoreanWeekLabel(week.monday, week.sunday)}  네이버 정산 ${formatMD(week.monday)}~${formatMD(week.sunday)}`;

  // 보고 버튼 상태 — 해당 주차에 remit row가 모두 있는지(=보고됨), confirmed 측 측
  const status = !isPending ? getWeekRemitStatus(week.items, weekRemits) : { kind: "expected", remits: [] };
  const canReport = !isPending && status.kind === "expected";
  const canUndo   = !isPending && status.kind === "reported";
  const isDone    = status.kind === "done";

  async function doReport() {
    if (!confirm(`이번 주차(₩${sumSubtotal.toLocaleString()})에 입금했습니까?`)) return;
    setSubmitting(true);
    await onReport();
    setSubmitting(false);
  }
  async function doUndo() {
    if (!confirm("보고를 취소하시겠습니까?")) return;
    const ids = status.remits.map(r => r.id).filter(Boolean);
    if (ids.length === 0) return;
    setSubmitting(true);
    await onUndo(ids);
    setSubmitting(false);
  }

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={onBack} style={{
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8, padding: "6px 8px",
          color: "var(--text-primary, #FAF8F5)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 2,
          fontFamily: "inherit", fontSize: 11, fontWeight: 600,
        }}>
          <ChevronLeft size={14}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #FAF8F5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {headerLabel}
          </div>
          <div style={{ fontSize: 10, color: C_GRAY, marginTop: 2 }}>
            {filtered.length}건 · <span style={{ color: C_MAGENTA, fontWeight: 700 }}>₩{sumSubtotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 입금 워크플로 버튼 */}
      {!isPending && (
        <RemitAction status={status} canReport={canReport} canUndo={canUndo} isDone={isDone}
          submitting={submitting} onReport={doReport} onUndo={doUndo}/>
      )}

      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: C_GRAY, pointerEvents: "none",
        }}/>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="고객명 / 주소 / 작업번호 / 상품주문번호"
          style={{
            width: "100%", padding: "9px 12px 9px 32px",
            background: "var(--bg-secondary, #1A1A1A)",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 10,
            color: "var(--text-primary, #FAF8F5)",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", outline: "none",
          }}
        />
      </div>

      {!isPending && dateOptions.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <FilterChip active={dateFilter === ""} onClick={() => setDateFilter("")}>전체 날짜</FilterChip>
          {dateOptions.map(d => {
            const md = d.slice(5).replace("-", "/");
            return <FilterChip key={d} active={dateFilter === d} onClick={() => setDateFilter(d)}>{md}</FilterChip>;
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <FilterChip active={stageFilter === "all"} onClick={() => setStageFilter("all")}>전체</FilterChip>
        {SETTLE_STAGES.map(s => (
          <FilterChip key={s.key} active={stageFilter === s.key} onClick={() => setStageFilter(s.key)}>
            {s.dot} {s.label}
          </FilterChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyBox>해당 항목이 없습니다</EmptyBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(it => (
            <SettleItemRow
              key={it.id}
              item={it}
              onClick={onSelect ? () => onSelect({ id: it.task_id, customer: it.customer_name, status: it.task_status }) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RemitAction({ status, canReport, canUndo, isDone, submitting, onReport, onUndo }) {
  if (isDone) {
    const lastConfirm = status.remits.map(r => r.confirmed_at).filter(Boolean).sort().pop();
    const d = lastConfirm ? new Date(lastConfirm) : null;
    return (
      <div style={{
        marginBottom: 12, padding: "10px 12px",
        background: "rgba(93,202,165,0.10)",
        border: `1px solid ${C_GREEN}55`,
        borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C_GREEN, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Check size={14} strokeWidth={3}/>회사 입금 확인 완료
          {d && <span style={{ color: C_GRAY, fontWeight: 500, marginLeft: 4 }}>{formatMD(d)}</span>}
        </span>
      </div>
    );
  }
  if (canUndo) {
    const lastReport = status.remits.map(r => r.remitted_at).filter(Boolean).sort().pop();
    const d = lastReport ? new Date(lastReport) : null;
    return (
      <div style={{
        marginBottom: 12, padding: "10px 12px",
        background: "rgba(230,163,58,0.08)",
        border: `1px solid ${C_AMBER}55`,
        borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C_AMBER }}>입금 보고 완료 · 회사 확인 대기</div>
          {d && <div style={{ fontSize: 10, color: C_GRAY, marginTop: 2 }}>보고 시각 {formatMD(d)}</div>}
        </div>
        <button onClick={onUndo} disabled={submitting} style={{
          background: "transparent", border: `1px solid ${C_AMBER}`, color: C_AMBER,
          padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
          cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
          opacity: submitting ? 0.5 : 1, whiteSpace: "nowrap",
        }}>보고 취소</button>
      </div>
    );
  }
  if (canReport) {
    return (
      <button onClick={onReport} disabled={submitting} style={{
        width: "100%", marginBottom: 12, padding: 12,
        background: C_MAGENTA, border: "none", borderRadius: 10,
        color: "#fff", fontSize: 13, fontWeight: 700,
        cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
        opacity: submitting ? 0.5 : 1,
      }}>{submitting ? "보고 중..." : "💸 입금했습니다"}</button>
    );
  }
  return null;
}

function SettleItemRow({ item, onClick }) {
  const stageKey = getSettleStageKey(item);
  const stage = SETTLE_STAGES.find(s => s.key === stageKey) || SETTLE_STAGES[0];
  const label = getItemLabel(item);
  const qty = item.qty || 1;
  const companyAmt = companyAmountOf(item);
  const naverDate = item.naver_settled_at ? item.naver_settled_at.slice(5, 10).replace("-", "/") : "";
  const orderId = item.product_order_id || "";

  return (
    <div
      onClick={onClick || undefined}
      style={{
        background: "var(--bg-elevated, #1F1F1F)",
        border: "1px solid var(--border, #2A2A2A)",
        borderLeft: `3px solid ${stage.color}`,
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex", flexDirection: "column", gap: 4,
        minHeight: 38,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {/* 1줄 — 단계 + 고객명 + 정보 + 금액 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flexShrink: 0, fontSize: 14 }}>{stage.dot}</div>
        <span style={{
          flexShrink: 0,
          fontSize: 12, fontWeight: 500,
          color: "var(--text-primary, #FAF8F5)",
          maxWidth: 80,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{item.customer_name || "—"}</span>
        <span style={{
          flex: 1, minWidth: 0,
          fontSize: 11, fontWeight: 400, color: "#888",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          ({label}{qty > 1 ? `×${qty}` : ""})
          {item.district ? ` · ${item.district}` : ""}
          {naverDate && (<>{" · "}<span style={{ color: "#F2B84B", fontWeight: 600 }}>{naverDate}</span></>)}
        </span>
        <span style={{
          flexShrink: 0,
          fontSize: 12, fontWeight: 700,
          color: C_MAGENTA, fontFamily: "inherit",
        }}>₩{companyAmt.toLocaleString()}</span>
      </div>
      {/* 2줄 — 상품주문번호 (mono, 작게) */}
      {orderId && (
        <div className="mono" style={{
          fontSize: 10, color: "#666", paddingLeft: 22,
          letterSpacing: 0.2,
        }}>
          {orderId}
        </div>
      )}
    </div>
  );
}

function FilterChip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 10px",
      background: active ? C_MAGENTA : "var(--bg-secondary, #1A1A1A)",
      color: active ? "#fff" : "var(--text-secondary, #B5B0A8)",
      border: `1px solid ${active ? C_MAGENTA : "var(--border, #2A2A2A)"}`,
      borderRadius: 100,
      fontSize: 11, fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function EmptyBox({ children }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center",
      color: C_GRAY, fontSize: 12,
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 8,
    }}>{children}</div>
  );
}

export default PrincipalSettleTab;
