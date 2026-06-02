// 2026-06-01 Phase 5 R-A1 / R-A2 / R-A3 — 운영자 유솔 N 정산 화면 통합.
// Phase A 원칙: UI 재배치 + 1·2차 분류 표시만. 돈 로직 0건 변경.
//
// 화면 구조 (위→아래):
//   ⓪ 정산 대기 한 줄  — 전체 funnel 대체 (Σ 회사 받을 돈, 작업완료 AND naver_settled_at NULL)
//   ① 유솔 → 회사 · 주차별 받을 돈 — UsolNToCompanySection (R-A2)
//   ② 회사 → 기사 · 월정산 1·2차 — UsolNToEngineerSection (R-A3)
//
// 정산 대기 합계 reconcile:
//   유솔앱 PrincipalSettleTab.summary.pendingAmount 와 동일 수식·동일 데이터 소스.
//   = Σ Math.round(net_amount × 0.85), net_amount NULL → 0.
//   = fetchPrincipalSettleItems({ principalCodes: ["usol_n"], monthsBack: 3 })
//     필터: task_status === "완료" AND naver_settled_at NULL.
//   사장님 spec: "운영자·유솔 숫자가 어긋나면 신뢰 깨짐" → 같은 함수·같은 필터 사용 필수.
//
// 옛 UsolNTracking / UsolNEngineerSettlement 파일은 D10 — 참고용 보존 (라우팅 X).
import { useState, useEffect, useMemo } from "react";
import { fetchPrincipalSettleItems } from "../../lib/principalSettleDb.js";
import { UsolNToCompanySection } from "./UsolNToCompanySection.jsx";
import { UsolNToEngineerSection } from "./UsolNToEngineerSection.jsx";
// 2026-06-02 — 정산 대기 측 측 별도 화면 — 유솔 PWA 측 동일 (WeekSettleDetail 공유).
import { WeekSettleDetail } from "../principal/WeekSettleDetail.jsx";

const C_MAGENTA = "#FF1B8D";
const C_AMBER   = "#E6A33A";
const C_GRAY    = "#9CA3AF";
const C_GREEN   = "#1D9E75";

// 2026-06-02 — pending 측 측 측 측 task_item 측 subtotal (사장님 spec).
//   기존 net × 0.85 → net NULL 측 0 측 catch (진기선 등). subtotal 측 = 정산예정금액 = TaskDetail 측 동일 source.
function subtotalOf(item) {
  return Number(item?.subtotal) || 0;
}

export function UsolNSettleScreen({ adminId = null }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPendingList, setShowPendingList] = useState(false);
  // 2026-06-02 — 정산 대기 별도 화면 측 검색·필터 state (유솔 PWA 측 동일).
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingStageFilter, setPendingStageFilter] = useState("all");
  const [pendingDateFilter, setPendingDateFilter] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPrincipalSettleItems({ principalCodes: ["usol_n"], monthsBack: 3 })
      .then(res => {
        if (!alive) return;
        if (!res.ok) setError(res.error || "정산 항목 조회 실패");
        setItems(res.items || []);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // 정산 대기 집합 = task_status "완료" AND naver_settled_at NULL.
  //   2026-06-02 — cancel-strict + subtotal > 0 추가 (사장님 spec, PrincipalSettleTab 측 일치).
  //     · is_canceled=true 또는 subtotal=0 (부분취소) 제외.
  //     · 신동욱 벽걸이×2 (subtotal=0) 측 측 측 측 측.
  const pending = useMemo(() => {
    const live = items.filter(it => it.task_status !== "취소" && it.is_canceled !== true);
    const done = live.filter(it => it.task_status === "완료");
    return done.filter(it => !it.naver_settled_at && Number(it.subtotal) > 0);
  }, [items]);

  const pendingAmount = useMemo(
    () => pending.reduce((s, it) => s + subtotalOf(it), 0),
    [pending]
  );

  // 2026-06-02 — 정산 대기 별도 리스트 화면 (사장님 spec — 유솔 PWA 측 동일).
  //   WeekSettleDetail 측 measure 측 — actionMode 측 X / remitStatus 측 X (RemitAction 측 measure 측 X).
  //   검색창 + 필터칩(전체/대기/네이버결제완료/회사입금완료) + task_item 단위 리스트.
  if (showPendingList) {
    const pendingWeek = {
      key: "pending",
      items: pending,
      displayNaverCount: pending.length,
      displayWeeklyTotal: pendingAmount,
    };
    return (
      <WeekSettleDetail
        week={pendingWeek}
        actionMode={null}
        remitStatus={null}
        onBack={() => {
          setShowPendingList(false);
          setPendingSearch("");
          setPendingStageFilter("all");
          setPendingDateFilter("");
        }}
        search={pendingSearch} setSearch={setPendingSearch}
        stageFilter={pendingStageFilter} setStageFilter={setPendingStageFilter}
        dateFilter={pendingDateFilter} setDateFilter={setPendingDateFilter}
      />
    );
  }

  return (
    <div>
      <PendingRow
        count={pending.length}
        amount={pendingAmount}
        loading={loading}
        onOpen={() => setShowPendingList(true)}
      />

      {error && (
        <div style={errorBoxStyle}>⚠️ {error}</div>
      )}

      {/* ① 유솔 → 회사 · 주차별 받을 돈 (R-A2 — PrincipalSettleTab WeekCard 디자인 미러링) */}
      <SectionHeader
        title="① 유솔 → 회사"
        sub="주차별 받을 돈 (실 입금 = net_amount × 0.85)"
      />
      <UsolNToCompanySection/>

      {/* ② 회사 → 기사 · 월정산 (R-A3 — 1·2차 스택바 + 기사별 보기 + 일괄 지급) */}
      <SectionHeader
        title="② 회사 → 기사"
        sub="월정산 — 1차 매월 15일 · 2차 매월 말일"
      />
      <UsolNToEngineerSection adminId={adminId}/>
    </div>
  );
}

function PendingRow({ count, amount, loading, onOpen }) {
  if (loading) {
    return (
      <div style={pendingRowLoadingStyle}>
        정산 데이터 불러오는 중...
      </div>
    );
  }
  if (count === 0) {
    return (
      <div style={pendingRowEmptyStyle}>
        ✓ 정산 대기 없음 — 작업 완료 항목 모두 네이버 정산 완료
      </div>
    );
  }
  return (
    <button
      onClick={onOpen}
      style={{
        width: "100%",
        padding: "12px 14px",
        background: "rgba(230,163,58,0.10)",
        border: `1px solid ${C_AMBER}`,
        borderLeft: `4px solid ${C_AMBER}`,
        borderRadius: 10,
        marginBottom: 12,
        cursor: "pointer",
        textAlign: "left", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C_AMBER, fontWeight: 800, marginBottom: 3 }}>
          ⚠️ 정산 대기 {count}건 ·{" "}
          <span style={{ color: C_MAGENTA, fontFamily: "inherit" }}>
            ₩{amount.toLocaleString()}
          </span>
        </div>
        <div style={{ fontSize: 10, color: C_GRAY }}>
          작업 완료 · 네이버 정산 전 (유솔앱과 동일 기준)
        </div>
      </div>
      <span style={{ color: C_GRAY, fontSize: 16, fontWeight: 700 }}>›</span>
    </button>
  );
}

// 2026-06-02 — PendingDetailList 측 제거. 정산 대기 측 별도 화면 = WeekSettleDetail 공유 (사장님 spec).

function SectionHeader({ title, sub }) {
  return (
    <div style={{
      margin: "22px 0 12px",
      paddingTop: 16,
      borderTop: "1px solid var(--border)",
    }}>
      <div style={{
        fontSize: 14, fontWeight: 800,
        color: "var(--text-primary)",
        marginBottom: 3,
      }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: C_GRAY }}>
          {sub}
        </div>
      )}
    </div>
  );
}

const pendingRowLoadingStyle = {
  padding: 12,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10, marginBottom: 12,
  fontSize: 11, color: C_GRAY,
  textAlign: "center",
};

const pendingRowEmptyStyle = {
  padding: 12,
  background: "rgba(29,158,117,0.06)",
  border: `1px solid ${C_GREEN}`,
  borderRadius: 10, marginBottom: 12,
  fontSize: 11, color: C_GREEN, fontWeight: 600,
  textAlign: "center",
};

const errorBoxStyle = {
  padding: 10, marginTop: 4, marginBottom: 12,
  background: "rgba(255,68,68,0.08)",
  border: "1px solid rgba(255,68,68,0.3)",
  borderRadius: 8,
  color: "#ff4444", fontSize: 11, fontWeight: 600,
};

export default UsolNSettleScreen;
