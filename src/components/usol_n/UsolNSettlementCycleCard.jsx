// Phase 5 Step 0.C-1 — 유솔N 정산 사이클 카드 (AdminTaskDetailScreen 측 조건 분기)
// 2026-05-26 D-3 — 시안(admin_task_detail_cycle_card_v2) 재배치.
// 2026-06-28 — 표시 버그 fix: 회사 입금·기사 정산도 task_items 실제 컬럼 읽기.
//   · ① 네이버 결제: item.naver_settled_at + net_amount (초록 #03C75A)
//   · ② 회사 입금:  item.company_received_at 있으면 정산 완료 + 날짜 (주황 #F59E0B)
//   · ③ 기사 정산:  item.engineer_settled_at  있으면 정산 완료 + 날짜 (초록 #1D9E75)
//   · NULL 인 단계만 "정산 전" 회색 fallback
//   · 색 컨벤션: usolNTasksDb.js line 332-333 dot/color 와 일관
//
// 영향 범위 = 유솔N 작업만. 다른 6원청 영향 0 (AdminTaskDetailScreen 측 조건 분기).
import { useState, useEffect } from "react";
import { fetchTaskItemsByTaskId, getItemChipLabel } from "../../lib/usolNTasksDb.js";
import { useRealtimeTable } from "../../hooks/useRealtimeSubscription.js";

export function UsolNSettlementCycleCard({ taskId, paymentMethod = null }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // Phase 5 Step 0.C-9 — task_id 측 task_items 변경 시 자동 refetch
  useRealtimeTable("task_items", () => setReloadTick(v => v + 1), taskId ? `task_id=eq.${taskId}` : null);

  useEffect(() => {
    if (!taskId) return;
    let alive = true;
    setLoading(true);
    setError("");
    fetchTaskItemsByTaskId(taskId)
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || "정산 사이클 조회 실패");
          setItems([]);
        } else {
          setItems(res.items);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [taskId, reloadTick]);

  if (loading) {
    return (
      <div style={cardStyle}>
        <SectionLabel/>
        <div style={emptyTextStyle}>불러오는 중...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={cardStyle}>
        <SectionLabel/>
        <div style={emptyTextStyle}>⚠️ {error}</div>
      </div>
    );
  }
  if (items.length === 0) {
    return null; // 항목 X → 카드 자체 표시 X
  }
  // 2026-05-27 — 네이버 발주 신호 가드 (Mig 077 payment_method 우선 + fallback).
  //   사이클(네이버 결제→회사 입금→기사 정산)은 네이버 결제 작업 전용.
  //   1순위: paymentMethod — 'naver_pay'면 표시, 'cash'/'card'/'transfer'면 숨김
  //   2순위: paymentMethod NULL 또는 미전달 시 — items 중 하나라도 product_order_id 있으면 표시
  //          (bulkInsertUsolNOrders가 product_order_id 채움 / 수동 입력은 NULL)
  if (paymentMethod) {
    if (paymentMethod !== "naver_pay") return null;
  } else {
    const hasNaverItem = items.some(i => i.product_order_id);
    if (!hasNaverItem) return null;
  }

  return (
    <div style={outerStyle}>
    <div style={cardStyle}>
      <SectionLabel/>
      {items.map(item => (
        <ItemBlock key={item.id} item={item}/>
      ))}
      <NoticeFooter/>
    </div>
    </div>
  );
}

function SectionLabel() {
  return (
    <div style={{
      fontSize: 12, color: "#03C75A", fontWeight: 800,
      marginBottom: 12, letterSpacing: 0.3,
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <span style={{
        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
        background: "#03C75A",
      }}/>
      유솔N 정산 사이클
    </div>
  );
}

function NoticeFooter() {
  return null;  // 2026-06-28 — 안내문 제거 (실제 데이터 표시 시작).
}

function formatMd(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCMonth() + 1}-${String(k.getUTCDate()).padStart(2, "0")}`;
}

function ItemBlock({ item }) {
  const label = getItemChipLabel(item);
  const qty   = item.qty || 1;

  // 2026-06-28 — 3 단계 모두 task_items 실제 컬럼 읽기 (이전 회사/기사 정산은 false 고정 버그).
  //   색: usolNTasksDb.js dot/color 컨벤션 — 네이버 #03C75A, 회사 #F59E0B, 기사 #1D9E75.
  const naverDone     = !!item.naver_settled_at;
  const naverAmt      = item.net_amount != null ? Number(item.net_amount) : null;
  const naverDate     = naverDone ? formatMd(item.naver_settled_at) : "";

  const companyDone   = !!item.company_received_at;
  const companyDate   = companyDone ? formatMd(item.company_received_at) : "";

  const engineerDone  = !!item.engineer_settled_at;
  const engineerDate  = engineerDone ? formatMd(item.engineer_settled_at) : "";

  return (
    <div style={{
      padding: 12,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      marginBottom: 8,
    }}>
      {/* 헤더: 품목명 ×수량 + 금액 */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          {label} ×{qty}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", fontFamily: "inherit" }}>
          ₩{(item.subtotal || 0).toLocaleString()}
        </span>
      </div>

      {/* 상품주문번호 */}
      {item.product_order_id && (
        <div style={{
          fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))",
          marginTop: 4, fontFamily: "inherit",
        }}>
          상품주문번호 {item.product_order_id}
        </div>
      )}

      {/* 사이클 3칸 (flex:1) — 2026-06-28: 회사 입금·기사 정산도 실제 컬럼 표시 */}
      <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
        <StageCell
          label="네이버 결제"
          done={naverDone}
          amount={naverAmt}
          date={naverDate}
          doneColor="#03C75A"
        />
        <StageCell
          label="회사 입금"
          done={companyDone}
          date={companyDate}
          doneColor="#F59E0B"
        />
        <StageCell
          label="기사 정산"
          done={engineerDone}
          date={engineerDate}
          doneColor="#1D9E75"
        />
      </div>
    </div>
  );
}

// 측 cell — 측 catch 측 catch 측 catch 측 catch (네이버) / 측 catch 측 catch (회사·기사 측 catch)
function StageCell({ label, done, amount, date, doneColor }) {
  if (done) {
    return (
      <div style={{
        flex: 1,
        padding: "8px 6px",
        background: `${doneColor || "#03C75A"}1A`,
        border: `1px solid ${doneColor || "#03C75A"}`,
        borderRadius: 8,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 9, color: doneColor || "#03C75A", fontWeight: 800, marginBottom: 3 }}>
          {label}
        </div>
        {amount != null && (
          <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 800, fontFamily: "inherit" }}>
            ₩{amount.toLocaleString()}
          </div>
        )}
        {date && (
          <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 1, fontFamily: "inherit" }}>
            {date}
          </div>
        )}
      </div>
    );
  }
  // 정산 전 — 회색
  return (
    <div style={{
      flex: 1,
      padding: "8px 6px",
      background: "var(--bg-primary)",
      border: "1px dashed var(--border)",
      borderRadius: 8,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))", fontWeight: 600 }}>
        정산 전
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 1 }}>
        —
      </div>
    </div>
  );
}

// 측 측 측 측 측 D-1 패턴 측 catch
const outerStyle = {
  padding: "0 20px",
};
const cardStyle = {
  padding: 16,
  background: "rgba(3,199,90,0.04)",
  border: "1px solid rgba(3,199,90,0.3)",
  borderRadius: 14,
  marginBottom: 12,
};

const emptyTextStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  textAlign: "center", padding: 10,
};

export default UsolNSettlementCycleCard;
