// 2026-06-12 — AdminApp PC 개요 · 유솔N 월정산 패널.
// 2026-06-16 — 재설계 (사장님 spec):
//   · 헤더: "유솔N 정산" + 월 선택 ◀ YYYY년 MM월 ▶ + 기사별 N명 →
//   · 회사 마진(큰 숫자 주표시) + 총 정산액의 N%
//   · 구성 바(가로 3분할) + 3분할 범례 (기사 정산 / 유솔N 수수료 / 회사 마진)
//   · 지급 진행: 1차 지급(15일) / 미지급 잔액 박스 2개
// ⚠️ 정산 계산 로직 0줄 변경. UsolNToEngineerSection 의 helper export 그대로 재사용.
// ⚠️ 색 토큰: 기사 #378ADD / 유솔N #FFB800 / 회사 마진 #1D9E75 (음수 시 #ff4444).
// ⚠️ 모바일(<1024) 옛 화면 그대로 — 이 패널은 PC 개요 전용.

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { fetchUsolNCompletedTaskItems } from "../lib/usolNTasksDb.js";
import {
  splitByBucket,
  inKstMonth,
  getCurrentMonthKey,
} from "../components/usol_n/UsolNToEngineerSection.jsx";
// 2026-06-16 — Mig 135/136 payouts 이력 회차별 집계.
import { getUsolnPayoutsSummary } from "../lib/usolnPayoutsDb.js";

function fmtKRW(n) {
  // 음수도 그대로 표시 (− 부호 포함)
  const v = Number(n) || 0;
  if (v < 0) return `−₩${Math.abs(v).toLocaleString("ko-KR")}`;
  return `₩${v.toLocaleString("ko-KR")}`;
}

// "YYYY-MM" → 한 달 전 "YYYY-MM"
function prevMonthKey(ym) {
  const [y, m] = ym.split("-").map(Number);
  const ny = m === 1 ? y - 1 : y;
  const nm = m === 1 ? 12 : m - 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
function nextMonthKey(ym) {
  const [y, m] = ym.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function AdminPcUsolNMonthlyPanel({ onClick, user }) {
  // 2026-06-16 — gateYm 상태화 (월 선택 가능). 기본 = 현재 월의 전월(=15일 지급 대상).
  const currentMonth = getCurrentMonthKey();
  const defaultGateYm = prevMonthKey(currentMonth);
  const [gateYm, setGateYm] = useState(defaultGateYm);
  const [gateY, gateM] = gateYm.split("-").map(Number);

  const [items, setItems] = useState([]);
  const [paymentByTaskId, setPaymentByTaskId] = useState(new Map());
  const [loading, setLoading] = useState(true);

  // 2026-06-16 — monthsBack 을 12 로 (월 선택 범위 확보). 옛: 6.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchUsolNCompletedTaskItems({ monthsBack: 12 })
      .then(res => {
        if (!alive) return;
        if (res?.ok) setItems(res.items || []);
        else console.error("[AdminPcUsolNMonthlyPanel.items]", res?.error);
      })
      .catch(err => console.error("[AdminPcUsolNMonthlyPanel.items] fail:", err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // payments chunk fetch (옛과 동일).
  useEffect(() => {
    if (!items.length) { setPaymentByTaskId(new Map()); return; }
    const taskIds = [...new Set(items.map(it => it.tasks?.id).filter(Boolean))];
    if (!taskIds.length) { setPaymentByTaskId(new Map()); return; }
    let alive = true;
    (async () => {
      const CHUNK = 300;
      const all = [];
      for (let i = 0; i < taskIds.length; i += CHUNK) {
        const chunk = taskIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("payments")
          .select("task_id, engineer_amount, principal_amount, owner_amount, extra_fee, product_price, track")
          .in("task_id", chunk);
        if (!alive) return;
        if (error) {
          console.error("[AdminPcUsolNMonthlyPanel.payments] chunk", i, error);
          continue;
        }
        all.push(...(data || []));
      }
      if (!alive) return;
      const m = new Map();
      for (const p of all) m.set(p.task_id, p);
      setPaymentByTaskId(m);
    })();
    return () => { alive = false; };
  }, [items]);

  // engByItem — _excl_extra 적용.
  const engByItem = useMemo(() => {
    if (!items.length || paymentByTaskId.size === 0) return new Map();
    const itemsByTaskId = new Map();
    for (const it of items) {
      if (it.is_canceled) continue;
      const tid = it.tasks?.id;
      if (!tid) continue;
      if (!itemsByTaskId.has(tid)) itemsByTaskId.set(tid, []);
      itemsByTaskId.get(tid).push(it);
    }
    const result = new Map();
    for (const [tid, taskItems] of itemsByTaskId.entries()) {
      const payment = paymentByTaskId.get(tid);
      if (!payment) continue;
      const eng   = Number(payment.engineer_amount) || 0;
      const extra = Number(payment.extra_fee)       || 0;
      const usolExtra     = Math.floor(extra * 0.15);
      const engineerExtra = extra - usolExtra;
      const engExcl       = eng - engineerExtra;
      const sumSub = taskItems.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
      if (sumSub > 0) {
        for (const it of taskItems) {
          const r = (Number(it.subtotal) || 0) / sumSub;
          result.set(it.id, Math.round(engExcl * r));
        }
      } else {
        const per = Math.round(engExcl / taskItems.length);
        for (const it of taskItems) result.set(it.id, per);
      }
    }
    return result;
  }, [items, paymentByTaskId]);

  // splitByBucket — gateY/gateM 동적.
  const split = useMemo(() =>
    splitByBucket(items, gateY, gateM, engByItem),
    [items, gateY, gateM, engByItem]
  );

  // paymentsAgg — _excl_extra + 마진 unclamped.
  const paymentsAgg = useMemo(() => {
    const allItems = [
      ...split.firstItems, ...split.secondItems,
      ...split.doneItems_1, ...split.doneItems_2,
    ];
    const tids = new Set();
    for (const it of allItems) {
      const tid = it.tasks?.id || it.task_id;
      if (tid) tids.add(tid);
    }
    let engSum = 0, prinSum = 0, ownerSum = 0, prodSum = 0;
    for (const tid of tids) {
      const p = paymentByTaskId.get(tid);
      if (!p) continue;
      const eng   = Number(p.engineer_amount)  || 0;
      const prin  = Number(p.principal_amount) || 0;
      const extra = Number(p.extra_fee)        || 0;
      const usolExtra     = Math.floor(extra * 0.15);
      const engineerExtra = extra - usolExtra;
      engSum   += eng - engineerExtra;
      prinSum  += prin - usolExtra;
      ownerSum += Number(p.owner_amount) || 0;
      prodSum  += Number(p.product_price) || 0;
    }
    const marginUnclamped = prodSum - engSum - prinSum;
    return { engSum, prinSum, ownerSum, prodSum, marginUnclamped };
  }, [split, paymentByTaskId]);

  // 표시값.
  const profit    = paymentsAgg.marginUnclamped;
  const denom     = paymentsAgg.prodSum > 0 ? paymentsAgg.prodSum : 0;
  const engPct    = denom > 0 ? (paymentsAgg.engSum         / denom * 100) : 0;
  const prinPct   = denom > 0 ? (paymentsAgg.prinSum        / denom * 100) : 0;
  const ownPct    = denom > 0 ? (paymentsAgg.marginUnclamped / denom * 100) : 0;
  const firstTotal   = split.firstTotal;
  const pendingTotal = split.pendingTotal;

  // 2026-06-16 — payouts 회차별 집계 (Mig 135 RPC).
  //   RPC 미적용 시 graceful: payouts=null → 옛 흐름 (지급/미지급 2박스) 로 폴백.
  const [payouts, setPayouts] = useState(null);
  useEffect(() => {
    const actor = user?.user_id || user?.userId || user?.id;
    if (!actor || !gateYm) { setPayouts(null); return; }
    let alive = true;
    getUsolnPayoutsSummary(gateYm, actor).then(res => {
      if (!alive) return;
      if (res?.ok) setPayouts(res);
      else setPayouts(null);
    }).catch(() => { if (alive) setPayouts(null); });
    return () => { alive = false; };
  }, [user, gateYm]);

  // 회차별 / 미지급 산출.
  //   1차/2차/추가 = payouts.rounds[round].amount (환불 포함 net)
  //   미지급 = max(0, engSum - total_paid) — engSum 은 _excl_extra 기준 task 총액.
  const payoutRounds = useMemo(() => {
    if (!payouts?.rounds) return null;
    return {
      first:  Number(payouts.rounds["1차"]?.amount) || 0,
      second: Number(payouts.rounds["2차"]?.amount) || 0,
      extra:  Number(payouts.rounds["추가"]?.amount) || 0,
      totalPaid: Number(payouts.total_paid) || 0,
    };
  }, [payouts]);
  const pendingFromPayouts = useMemo(() => {
    if (!payoutRounds) return null;
    return Math.max(0, paymentsAgg.engSum - payoutRounds.totalPaid);
  }, [payoutRounds, paymentsAgg.engSum]);

  // 기사 수 (gate month + 활성).
  const engineerCount = useMemo(() => {
    const set = new Set();
    for (const it of items) {
      if (it.is_canceled) continue;
      if (!inKstMonth(it.tasks?.completed_at, gateY, gateM)) continue;
      const eid = it.tasks?.assigned_engineer_id;
      if (eid) set.add(eid);
    }
    return set.size;
  }, [items, gateY, gateM]);

  // 월 선택 prev/next 허용 범위 — fetch 한 12개월 내.
  const canPrev = (() => {
    const prev = prevMonthKey(gateYm);
    const [py, pm] = prev.split("-").map(Number);
    return items.some(it => inKstMonth(it.tasks?.completed_at, py, pm));
  })();
  const canNext = gateYm !== currentMonth && nextMonthKey(gateYm) <= currentMonth;

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      {/* 헤더 — 유솔N 정산 + 월 선택 + 기사별 N명 → */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 24, height: 24, borderRadius: 6,
          background: "#03C75A", color: "#fff",
          fontSize: 12, fontWeight: 900, letterSpacing: "-0.5px",
          flexShrink: 0,
        }}>N</span>
        <span style={{
          fontSize: 14, fontWeight: 800, color: "var(--text-primary)",
        }}>유솔N 정산</span>

        {/* 월 선택 — ◀ YYYY년 MM월 ▶ */}
        <MonthPicker
          ym={gateYm}
          onPrev={canPrev ? () => setGateYm(prevMonthKey(gateYm)) : null}
          onNext={canNext ? () => setGateYm(nextMonthKey(gateYm)) : null}
        />

        <div style={{ flex: 1 }}/>

        {/* 기사별 N명 → */}
        {typeof onClick === "function" && (
          <button onClick={onClick} style={{
            padding: "5px 12px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 999,
            color: "var(--text-secondary)",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}>기사별 ({engineerCount}명) →</button>
        )}
      </div>

      {loading ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: 12, fontWeight: 600,
        }}>불러오는 중...</div>
      ) : (
        <>
          {/* 회사 마진 — 주표시 (큰 숫자 + 총 정산액의 N%) */}
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center",
            padding: "12px 0 8px",
            gap: 4,
          }}>
            <span style={{
              fontSize: 11, color: "var(--text-secondary)",
              fontWeight: 700, letterSpacing: 0.3,
            }}>회사 마진</span>
            <span className="mono" style={{
              fontSize: 34, fontWeight: 800,
              color: profit < 0 ? "#ff4444" : "#10B981",
              letterSpacing: "-1px",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>{fmtKRW(profit)}</span>
            <span style={{
              fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}>
              총 정산액 {fmtKRW(paymentsAgg.prodSum)} 의 {ownPct.toFixed(1)}%
            </span>
          </div>

          {/* 구성 바 (가로 3분할) + 3분할 범례 */}
          <div style={{
            display: "flex", flexDirection: "column",
            gap: 10,
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
          }}>
            <CompositionBar
              engPct={engPct}
              prinPct={prinPct}
              ownPct={ownPct}
              ownNegative={profit < 0}
            />
            <div style={{
              display: "flex", flexDirection: "column",
              gap: 8, fontVariantNumeric: "tabular-nums",
            }}>
              <LegendRow
                color="#378ADD"
                label="기사 정산"
                pct={engPct}
                amount={paymentsAgg.engSum}
              />
              <LegendRow
                color="#FFB800"
                label="유솔N 수수료"
                pct={prinPct}
                amount={paymentsAgg.prinSum}
              />
              <LegendRow
                color={profit < 0 ? "#ff4444" : "#1D9E75"}
                label="회사 마진"
                pct={ownPct}
                amount={paymentsAgg.marginUnclamped}
                accent
              />
            </div>
          </div>

          {/* 지급 진행 — Mig 135 payouts 이력 사용 시 회차별 4박스, 미적용 시 옛 2박스 폴백. */}
          {payoutRounds ? (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
              borderTop: "1px solid var(--border)",
              paddingTop: 14,
            }}>
              <PaymentBox label="1차 · 15일"  amount={payoutRounds.first}  tone="muted"/>
              <PaymentBox label="2차 · 말일"  amount={payoutRounds.second} tone="muted"/>
              <PaymentBox label="추가"        amount={payoutRounds.extra}  tone="muted"/>
              <PaymentBox label="미지급"      amount={pendingFromPayouts ?? pendingTotal} tone="accent"/>
            </div>
          ) : (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
              borderTop: "1px solid var(--border)",
              paddingTop: 14,
            }}>
              <PaymentBox label="1차 지급 · 15일" amount={firstTotal}   tone="muted"/>
              <PaymentBox label="미지급 잔액"     amount={pendingTotal} tone="accent"/>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// MonthPicker — ◀ YYYY년 MM월 ▶
// ──────────────────────────────────────────────────────────
function MonthPicker({ ym, onPrev, onNext }) {
  const [y, m] = String(ym).split("-").map(Number);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 5px",
      background: "var(--bg-inset, rgba(255,255,255,0.04))",
      border: "1px solid var(--border)",
      borderRadius: 999,
    }}>
      <button onClick={onPrev} disabled={!onPrev} aria-label="이전 달" style={pickerBtnStyle(!!onPrev)}>
        <ChevronLeft size={13}/>
      </button>
      <span style={{
        fontSize: 12, fontWeight: 800, color: "var(--text-primary)",
        padding: "0 8px", letterSpacing: "-0.2px",
        whiteSpace: "nowrap",
      }}>{y}년 {m}월</span>
      <button onClick={onNext} disabled={!onNext} aria-label="다음 달" style={pickerBtnStyle(!!onNext)}>
        <ChevronRight size={13}/>
      </button>
    </div>
  );
}
function pickerBtnStyle(enabled) {
  return {
    background: "transparent", border: "none",
    padding: 4, borderRadius: 999,
    cursor: enabled ? "pointer" : "not-allowed",
    color: enabled ? "var(--text-primary)" : "var(--text-secondary)",
    opacity: enabled ? 1 : 0.4,
    display: "inline-flex", alignItems: "center", fontFamily: "inherit",
  };
}

// ──────────────────────────────────────────────────────────
// CompositionBar — 가로 3분할 비례 fill. 회사 마진 음수면 표기에서 제외.
// ──────────────────────────────────────────────────────────
function CompositionBar({ engPct, prinPct, ownPct, ownNegative }) {
  // 음수(환불) 케이스: 회사 마진 0으로 클램프, 나머지 비례 표시.
  const eng  = Math.max(0, engPct);
  const prin = Math.max(0, prinPct);
  const own  = ownNegative ? 0 : Math.max(0, ownPct);
  const sum  = eng + prin + own || 1;
  const e = (eng  / sum) * 100;
  const p = (prin / sum) * 100;
  const o = (own  / sum) * 100;
  return (
    <div style={{
      display: "flex", height: 10, borderRadius: 5,
      overflow: "hidden",
      background: "var(--bg-inset, rgba(255,255,255,0.06))",
    }}>
      <div style={{ width: `${e}%`, background: "#378ADD" }}/>
      <div style={{ width: `${p}%`, background: "#FFB800" }}/>
      <div style={{ width: `${o}%`, background: "#1D9E75" }}/>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// LegendRow — 색칩 + 라벨 + %  / 금액 우정렬.
//   accent=true → 회사 마진 강조 (큰 폰트 + 좌측 3px 강조 바).
// ──────────────────────────────────────────────────────────
function LegendRow({ color, label, pct, amount, accent }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto auto minmax(0, 1fr) auto",
      alignItems: "center",
      gap: 10,
      paddingLeft: accent ? 8 : 0,
      borderLeft: accent ? `3px solid ${color}` : "none",
    }}>
      <span style={{
        width: 10, height: 10,
        background: color, borderRadius: 3, flexShrink: 0,
      }}/>
      <span style={{
        fontSize: 12,
        fontWeight: accent ? 800 : 600,
        color: accent ? "var(--text-primary)" : "var(--text-secondary)",
        whiteSpace: "nowrap",
      }}>{label}</span>
      <span className="mono" style={{
        fontSize: 11,
        color: "var(--text-secondary)",
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        textAlign: "right",
        whiteSpace: "nowrap",
      }}>{(Number(pct) || 0).toFixed(1)}%</span>
      <span className="mono" style={{
        fontSize: accent ? 16 : 14,
        fontWeight: accent ? 800 : 700,
        color: accent ? color : "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.3px",
        textAlign: "right",
        whiteSpace: "nowrap",
      }}>{fmtKRW(amount)}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// PaymentBox — 지급 진행 한 박스.
//   tone='muted' = 회색 보더, 'accent' = 핑크 보더 + 큰 폰트.
// ──────────────────────────────────────────────────────────
function PaymentBox({ label, amount, tone }) {
  const isAccent = tone === "accent";
  return (
    <div style={{
      background: isAccent ? "var(--accent-bg, rgba(255,27,141,0.06))" : "transparent",
      border: `1px solid ${isAccent ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 10,
      padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 4,
      fontVariantNumeric: "tabular-nums",
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: isAccent ? "var(--accent)" : "var(--text-secondary)",
        letterSpacing: 0.3,
      }}>{label}</span>
      <span className="mono" style={{
        fontSize: isAccent ? 18 : 16,
        fontWeight: 800,
        color: isAccent ? "var(--accent)" : "var(--text-primary)",
        letterSpacing: "-0.3px",
        fontVariantNumeric: "tabular-nums",
      }}>{fmtKRW(amount)}</span>
    </div>
  );
}

export default AdminPcUsolNMonthlyPanel;
