// 2026-06-12 — AdminApp PC 개요 · 유솔N 월정산 패널 (회사 순이익 주인공).
//   사장님 spec — 큰 순이익 (초록 34px) + 3 행 (총 배분 / 15일 지급 / 미지급 핑크 강조).
//   ⚠️ 정산 계산 로직 0줄 변경. UsolNToEngineerSection 의 helper export 그대로 재사용.
//   ⚠️ 색 토큰만 (var(--accent) 다크 #FF1B8D / 라이트 #E91860). 순이익 초록은 #10B981 도메인색.
//   ⚠️ 모바일(<1024) 옛 화면 그대로 — 이 패널은 PC 개요 전용.

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { fetchUsolNCompletedTaskItems } from "../lib/usolNTasksDb.js";
import {
  splitByBucket,
  inKstMonth,
  getCurrentMonthKey,
} from "../components/usol_n/UsolNToEngineerSection.jsx";

function fmtKRW(n) {
  return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
}

export function AdminPcUsolNMonthlyPanel({ onClick }) {
  // selectedMonth = 이번 달, gateYm = prev month (지급 대상 작업월).
  //   옛 컴포넌트와 동일: selectedMonth 2026-06 → gateYm 2026-05.
  const selectedMonth = getCurrentMonthKey();
  const [selY, selM] = selectedMonth.split("-").map(Number);
  const gateY = selM === 1 ? selY - 1 : selY;
  const gateM = selM === 1 ? 12 : selM - 1;
  const gateYm = `${gateY}-${String(gateM).padStart(2, "0")}`;

  const [items, setItems] = useState([]);
  const [paymentByTaskId, setPaymentByTaskId] = useState(new Map());
  const [loading, setLoading] = useState(true);

  // ── 1) task_items fetch (옛 컴포넌트 line 282 동일) ────────────
  useEffect(() => {
    let alive = true;
    fetchUsolNCompletedTaskItems({ monthsBack: 6 })
      .then(res => {
        if (!alive) return;
        if (res?.ok) setItems(res.items || []);
        else console.error("[AdminPcUsolNMonthlyPanel.items]", res?.error);
      })
      .catch(err => console.error("[AdminPcUsolNMonthlyPanel.items] fail:", err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // ── 2) payments fetch (chunk 300 — 옛 컴포넌트 line 303~ 동일) ──
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
          .select("task_id, engineer_amount, principal_amount, owner_amount, track")
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

  // ── 3) engByItem (payments.engineer_amount task-level → item.subtotal 비율 분배) ──
  //   옛 컴포넌트 line 337~ 동일.
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
      const eng = Number(payment.engineer_amount) || 0;
      const sumSub = taskItems.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
      if (sumSub > 0) {
        for (const it of taskItems) {
          const r = (Number(it.subtotal) || 0) / sumSub;
          result.set(it.id, Math.round(eng * r));
        }
      } else {
        const per = Math.round(eng / taskItems.length);
        for (const it of taskItems) result.set(it.id, per);
      }
    }
    return result;
  }, [items, paymentByTaskId]);

  // ── 4) splitByBucket (옛 helper 그대로) ────────────────────────
  const split = useMemo(() =>
    splitByBucket(items, gateY, gateM, engByItem),
    [items, gateY, gateM, engByItem]
  );

  // ── 5) paymentsAgg — 회사 순이익 / 배분 산출 (옛 컴포넌트 line 401~ 동일) ──
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
    let engSum = 0, prinSum = 0, ownerSum = 0;
    for (const tid of tids) {
      const p = paymentByTaskId.get(tid);
      if (!p) continue;
      engSum   += Number(p.engineer_amount)  || 0;
      prinSum  += Number(p.principal_amount) || 0;
      ownerSum += Number(p.owner_amount)     || 0;
    }
    return { engSum, prinSum, ownerSum };
  }, [split, paymentByTaskId]);

  // 4 표시값
  const profit       = paymentsAgg.ownerSum;
  const companyShare = paymentsAgg.engSum + paymentsAgg.prinSum + paymentsAgg.ownerSum;
  const firstTotal   = split.firstTotal;
  const pendingTotal = split.pendingTotal;

  // 기사 수 (작업월 + active 기사 unique)
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
      {/* 헤더 — 라벨 + 기사별 보기 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10,
      }}>
        <div style={{
          fontSize: 14, fontWeight: 800,
          color: "var(--text-primary)",
          display: "flex", alignItems: "center", gap: 8,
          minWidth: 0,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 24, height: 24, borderRadius: 6,
            background: "#03C75A", color: "#fff",
            fontSize: 12, fontWeight: 900, letterSpacing: "-0.5px",
            flexShrink: 0,
          }}>N</span>
          <span style={{
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>유솔N 월정산 · {gateYm} 작업분</span>
        </div>
        {typeof onClick === "function" && (
          <button onClick={onClick} style={{
            padding: "5px 12px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 999,
            color: "var(--text-secondary)",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            flexShrink: 0,
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
          {/* 회사 순이익 — 주인공 (초록 34px) */}
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center",
            padding: "12px 0 8px",
            gap: 4,
          }}>
            <span style={{
              fontSize: 11, color: "var(--text-secondary)",
              fontWeight: 700, letterSpacing: 0.3,
            }}>회사 순이익</span>
            <span className="mono" style={{
              fontSize: 34, fontWeight: 800,
              color: "#10B981",
              letterSpacing: "-1px",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>{fmtKRW(profit)}</span>
          </div>

          {/* 구분선 + 3 가로 행 */}
          <div style={{
            display: "flex", flexDirection: "column",
            gap: 10,
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
            fontVariantNumeric: "tabular-nums",
          }}>
            <SettleRow
              label={`${gateM}월 총 배분`}
              amount={companyShare}
              muted
            />
            <SettleRow
              label="15일 지급 (1차)"
              amount={firstTotal}
              color="#3B82F6"
            />
            <SettleRow
              label="미지급"
              amount={pendingTotal}
              accent
            />
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// SettleRow — 색박스(옵션) + 라벨 좌 + 금액 우정렬.
//   accent=true 면 핑크 강조 + 좌측 3px 핑크 바 + 큰 폰트.
//   color 주면 색박스 표시 (15일 지급 파랑 등). muted 면 라벨 회색.
// ──────────────────────────────────────────────────────────────────
function SettleRow({ label, amount, color, muted, accent }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto auto minmax(0, 1fr)",
      alignItems: "center",
      gap: 10,
      paddingLeft: accent ? 10 : 0,
      borderLeft: accent ? "3px solid var(--accent)" : "none",
    }}>
      <span style={{
        width: 10, height: 10,
        background: color || "transparent",
        borderRadius: 3, flexShrink: 0,
      }}/>
      <span style={{
        fontSize: 12,
        fontWeight: accent ? 800 : 600,
        color: muted ? "var(--text-secondary)" : "var(--text-primary)",
        whiteSpace: "nowrap",
      }}>{label}</span>
      <span className="mono" style={{
        fontSize: accent ? 16 : 14,
        fontWeight: accent ? 800 : 700,
        color: accent ? "var(--accent)" : "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.3px",
        textAlign: "right",
      }}>{fmtKRW(amount)}</span>
    </div>
  );
}

export default AdminPcUsolNMonthlyPanel;
