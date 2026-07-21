// 2026-06-12 — AdminApp PC 대시보드 (1024px+).
//   사장님 spec — PC 전용 펼침형, 빈 공간 채움.
//   레이아웃:
//     1. 매출 도넛 (좌상) + 우상 3카드 (미배정 / 냉매 대기 / 재배정)
//     2. 메트릭 5개 한줄
//     3. 유솔N 현황 (좌하, 작은 도넛 + 카운트) + 기사별 오늘 일정 (우하, 막대)
//     4. (다음 단계) 작업 검색 풀폭
//   ⚠️ 배정/정산/접수 로직 안 건드림. dynamicStats / apiTasks / apiEngineers 그대로 재사용.
//   ⚠️ 색 토큰만 (var(--accent) 다크 #FF1B8D / 라이트 #E91860).
//   ⚠️ 모바일(<1024) 옛 DashboardScreen 그대로.

import { useMemo, useState, useEffect } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";
// 2026-06-12 — 반응형 (1280px 2단↔1단 자동 전환).
import { useMinWidth } from "../utils/useIsPc.js";
import { computeRevenueByYmRange } from "../utils/revenueStats.js";
// 2026-06-12 — 유솔N 정산대기 = 원청 화면 (PrincipalSettleTab) 과 동일 source/필터.
//   task_items 단위, task_status="완료" + principal_id=USOL_N_PID + naver_settled_at NULL + subtotal>0 + is_canceled!=true.
import { fetchPrincipalSettleItems } from "../lib/principalSettleDb.js";
import { USOL_N_PID } from "../lib/usolNWeeklyData.js";
// 2026-06-12 — 유솔N 패널 = PC 전용 새 디자인 (순이익 주인공).
//   계산 helper 만 UsolNToEngineerSection 에서 export 가져옴, UI 새로.
// 2026-07-21 — 유솔N 큰 패널 제거 (사장님 spec: "이제 큰 부분 아님" + 자체 계산이라 정산판과 어긋날 수 있었음).
//   컴팩트 카드로 대체 — 데이터 = usoln_settle_board_summary RPC (정산판·가계부와 동일 소스, 항상 일치).
import { getUsolnSettleBoardSummary } from "../lib/usolnSettleBoardDb.js";
// 2026-06-12 — 작업 검색 (맨 아래 풀폭). 클라이언트 필터 (apiTasks).
import { AdminPcTaskSearchPanel } from "./AdminPcTaskSearchPanel.jsx";
import { AdminPcRevenuePanel } from "./AdminPcRevenuePanel.jsx";

function fmtKRW(n) {
  return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
}

export function AdminPcDashboard({
  t,
  apiTasks = [],
  apiEngineers = [],
  user,
  dynamicStats,
  refrigerantAddonCount = 0,
  dashSummary = null,
  dashRanges = null,
  onClickRevenueDetail,
  onClickNewReception,
  onClickAssignedList,
  onClickInProgress,
  onClickLiveWork,
  onClickReassign,
  onClickRefriAddon,
  onClickUsolN,
  // 2026-06-24 — 홈페이지 접수함 (옛 "냉매 자동배정 대기" 카드 자리 대체)
  onClickInquiries,
  inquiriesNewCount = 0,
  onTaskAssign,
  onOpenTaskDetail,
}) {
  // 2026-06-12 — 반응형 — 1280px 이상이면 2단 (매출 좌 / 알림+유솔N 우), 미만이면 1단 세로 stack.
  const isWide = useMinWidth(1280);

  const stats = dynamicStats || {};
  const unassignedCount = (stats.newReceptionTasks || []).length;

  // 2026-06-24 — 우상 3카드: 미배정 / 홈페이지 접수함 / 재배정 요청.
  //   옛 "냉매 자동배정 대기" 카드는 접수함 카드로 대체 (사장님 spec — 해당 기능 미사용 확정).
  //   재배정 요청: t.reassignRequest?.requestedAt && status !== "취소" (옛 DashboardScreen 로직 동일).
  const reassignCount = useMemo(() =>
    (apiTasks || []).filter(x =>
      x?.reassignRequest?.requestedAt && x.status !== "취소"
    ).length,
    [apiTasks]
  );

  // 메트릭 5개 — 새접수 / 배정 / 확정 / 진행 / 완료. 클릭 → 옛 setScreen.
  //   색 절제: 새 접수만 핑크 강조 (0 초과 시), 나머지 무채색.
  const metrics = [
    { id: "new",        label: "새 접수", count: stats.new        || 0, onClick: () => onClickNewReception?.(),                  highlight: true },
    // 2026-06-16 — "배정" 클릭 시 "assigned" 인자 명시 전달. 인자 X → undefined → AssignedTasksScreen 의 isAssigned 가
    //   false 로 떨어져 TASK_FILTERS.confirmed 분기로 가던 사고. 모바일(StatBox) 은 이미 "assigned" 넘김.
    { id: "assigned",   label: "배정",   count: stats.assigned   || 0, onClick: () => onClickAssignedList?.("assigned") },
    { id: "confirmed",  label: "확정",   count: stats.confirmed  || 0, onClick: () => onClickAssignedList?.("confirmed") },
    { id: "inProgress", label: "진행",   count: stats.inProgress || 0, onClick: () => onClickInProgress?.() },
    { id: "completed",  label: "완료",   count: stats.completed  || 0, onClick: () => onClickLiveWork?.("completed-today") },
  ];

  return (
    <div style={{
      padding: "24px 28px 36px",
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      {/* 상단 — 매출 + 우 컬럼 (3카드 + 유솔N stack). 1280px+ 2단 / 미만 1단.
            alignItems:stretch — 좌우 칸 높이 같이 (매출 패널이 우 컬럼 길이만큼 늘어남). */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isWide ? "minmax(0, 1.4fr) minmax(0, 1fr)" : "minmax(0, 1fr)",
        gap: 20,
        alignItems: "stretch",
      }}>
        <AdminPcRevenuePanel
          t={t}
          apiTasks={apiTasks}
          user={user}
          onDetailClick={onClickRevenueDetail}
          onClickEngineerList={onClickRevenueDetail}
          serverSummary={dashSummary}
          serverRanges={dashRanges}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CompactCard
            icon="📥"
            label="미배정 작업"
            count={unassignedCount}
            actionLabel="전체 →"
            onClick={() => onClickNewReception?.()}
          />
          {/* 2026-06-24 — 홈페이지 접수함 (옛 "냉매 자동배정 대기" 카드 자리).
                신규 N>0 시 빨강 강조 (미배정 카드와 같은 패턴), 0 시 기본 흰 카드. */}
          <CompactCard
            icon="📨"
            label="홈페이지 접수함"
            count={inquiriesNewCount}
            actionLabel={inquiriesNewCount > 0 ? "신규 →" : "열기 →"}
            onClick={onClickInquiries}
            color={inquiriesNewCount > 0 ? "#DC2626" : undefined}
          />
          <CompactCard
            icon="🔄"
            label="재배정 요청"
            count={reassignCount}
            actionLabel="처리 →"
            onClick={onClickReassign}
            color="#FF8A3D"
          />
          {/* 2026-06-16 — 냉매 미처리 (기사 PWA 세척 완료 시 입력분, [냉매 작업 만들기] 대상).
                color 생략 → 기본 var(--accent) 핑크 강조. N>0 일 때 값 색·hover 테두리가 핑크로. */}
          <CompactCard
            icon="🛠️"
            label="냉매 미처리"
            count={refrigerantAddonCount}
            actionLabel="만들기 →"
            onClick={onClickRefriAddon}
          />
          {/* 2026-07-21 — 유솔N 컴팩트 카드 (정산판 RPC 동일 소스). 상세는 유솔N 화면에서. */}
          <UsolNCompactCard user={user} onClick={onClickUsolN}/>
        </div>
      </div>

      {/* 2026-07-09 — 원청별 오늘 현황 표 (접수/완료/회사 몫).
            사장님 spec:
              · 접수 = created_at KST 오늘 + 취소 제외 (트랙 무관)
              · 완료 = completed_at KST 오늘 + status='완료' (트랙 무관)
              · 회사 몫 = 완료 건 owner_amount 합 (트랙 A 만; usol_n = "월정산").
              · 데이터 없는 원청 행 생략.
              · "이익" 아님 — 운영비 전 gross → 라벨 "회사 몫". */}
      <AdminPcTodayByPrincipal apiTasks={apiTasks}/>

      {/* 메트릭 5개 한줄 */}
      <MetricsRow metrics={metrics}/>

      {/* 2026-06-12 — 기사별 일정 제거 (사장님 spec: 개요에서 제외).
            옛 EngineersPanel + EngineerBar 함수 dead code 보존 (복원 시 mount 재추가). */}

      {/* 작업 검색 풀폭 — 유솔N 포함 전체 작업. 행 클릭 → onOpenTaskDetail (Chunk 2 우 aside 예정). */}
      <AdminPcTaskSearchPanel
        apiTasks={apiTasks}
        onTaskClick={onOpenTaskDetail}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 2026-07-21 — 유솔N 컴팩트 카드.
//   전월(=이번 지급 사이클) 작업분 기준: 회사 마진 / 안 받음(대기+독촉) / 기사 미지급.
//   데이터 = usoln_settle_board_summary (정산판·가계부와 동일 RPC — 대시보드 자체 계산 제거).
function UsolNCompactCard({ user, onClick }) {
  const actor = user?.user_id || user?.userId || user?.id;
  // KST 전월 "YYYY-MM"
  const ym = useMemo(() => {
    const nowYm = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit",
    }).format(new Date());                       // "YYYY-MM"
    const [y, m] = nowYm.split("-").map(Number);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return `${py}-${String(pm).padStart(2, "0")}`;
  }, []);
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!actor) { setLoading(false); return; }
    let alive = true;
    getUsolnSettleBoardSummary(actor).then(res => {
      if (!alive) return;
      if (res?.ok) {
        setRow((res.months || []).find(x => x.wm === ym) || null);
      }
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [actor, ym]);

  const margin    = Number(row?.margin) || 0;
  const notRecv   = (Number(row?.c1_margin) || 0) + (Number(row?.c2_margin) || 0);
  const engOwed   = Number(row?.b_eng_owed) || 0;
  const monthNum  = Number(ym.split("-")[1]);

  return (
    <button onClick={onClick} style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "14px 16px",
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "left",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15 }}>🟢</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
          유솔N 정산 · {monthNum}월 작업분
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)" }}>열기 →</span>
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800,
        color: margin < 0 ? "#ff4444" : "var(--text-primary)",
        fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px",
      }}>
        {loading ? "···" : fmtKRW(margin)}
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginLeft: 6 }}>회사 마진</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
        {loading ? "불러오는 중..." : (
          <>안 받음 {fmtKRW(notRecv)} · 기사 미지급 {fmtKRW(engOwed)}</>
        )}
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// CompactCard — 우상 3개. 아이콘 + 라벨 + 큰 숫자 + 액션 (배경 색 옵션).
// ──────────────────────────────────────────────────────────────────
function CompactCard({ icon, label, count, actionLabel, onClick, color }) {
  const isAccent = !color;  // 색 prop 없으면 var(--accent) (메인 핑크)
  const accentColor = color || "var(--accent)";
  const iconBg = isAccent ? "var(--accent-bg)" : `${color}22`;
  const valueColor = count > 0 ? accentColor : "var(--text-primary)";

  return (
    <button onClick={onClick} style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "18px 22px",
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "left",
      display: "grid",
      gridTemplateColumns: "auto 1fr auto",
      gap: 16,
      alignItems: "center",
      transition: "border-color 0.1s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentColor; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <span style={{
        width: 38, height: 38, borderRadius: 9,
        background: iconBg,
        fontSize: 18,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>{icon}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: "var(--text-secondary)",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}>{label}</span>
        <span className="mono" style={{
          fontSize: 22, fontWeight: 800,
          color: valueColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.5px",
          lineHeight: 1.1,
          display: "flex",
          alignItems: "baseline",
          gap: 4,
        }}>
          {count}
          <span style={{
            fontSize: 11, color: "var(--text-secondary)",
            fontWeight: 600,
          }}>건</span>
        </span>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 800,
        color: accentColor,
        whiteSpace: "nowrap",
      }}>{actionLabel}</span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// 메트릭 5개 한줄.
// ──────────────────────────────────────────────────────────────────
function MetricsRow({ metrics }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
      gap: 16,
    }}>
      {metrics.map(m => (
        <button key={m.id} onClick={m.onClick} style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "20px 22px",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          transition: "border-color 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--text-secondary)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}>{m.label}</span>
          <span className="mono" style={{
            fontSize: 30, fontWeight: 800,
            color: (m.highlight && m.count > 0) ? "var(--accent)" : "var(--text-primary)",
            letterSpacing: "-1px",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}>{m.count}</span>
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 유솔N 현황 패널 — 작은 도넛 (오늘 매출 구성) + 미배정/정산대기/회사마진.
//   유솔N task 필터 = (principalCode || principal_code) === "usol_n".
//   매출은 computeRevenueByYmRange 재사용 (입력만 유솔N 작업으로 좁힘).
// ──────────────────────────────────────────────────────────────────
function UsolNPanel({ apiTasks, user, onClick }) {
  const today = todayYmd();

  const usolNTasks = useMemo(() =>
    (apiTasks || []).filter(x => (x.principalCode || x.principal_code) === "usol_n"),
    [apiTasks]
  );

  const revenue = useMemo(() =>
    computeRevenueByYmRange(usolNTasks, today, today, user),
    [usolNTasks, user, today]
  );

  const unassignedCount = useMemo(() =>
    usolNTasks.filter(x => x.status === "미배정").length,
    [usolNTasks]
  );
  // 정산대기 — 원청 PrincipalSettleTab 와 동일 source/필터 재사용.
  //   apiTasks 의 status="완료" 단순 카운트 X (= 1136 측 부풀림).
  //   task_items 단위, principal_id=USOL_N_PID + task_status="완료" + naver_settled_at NULL
  //   + subtotal>0 + is_canceled!=true. PrincipalSettleTab line 195-204 spec 동일.
  const [pendingSettleCount, setPendingSettleCount] = useState(null); // null = loading
  useEffect(() => {
    let alive = true;
    fetchPrincipalSettleItems({ principalCodes: ["usol_n"], monthsBack: 3 })
      .then(res => {
        if (!alive) return;
        const items = res?.items || [];
        const live = items.filter(it => it.task_status !== "취소" && it.is_canceled !== true);
        const done = live.filter(it => it.task_status === "완료");
        const pending = done.filter(it =>
          it.principal_id === USOL_N_PID
          && !it.naver_settled_at
          && Number(it.subtotal) > 0
        );
        setPendingSettleCount(pending.length);
      })
      .catch(err => {
        console.error("[UsolNPanel.pendingSettle] fetch failed:", err);
        if (alive) setPendingSettleCount(0);
      });
    return () => { alive = false; };
  }, []);

  const total = revenue.total || 0;
  const denom = total > 0 ? total : 1;
  const engPct = (revenue.engineer / denom) * 100;
  const prnPct = (revenue.principal / denom) * 100;
  const stop2 = engPct + prnPct;
  const hasData = total > 0;

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
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{
          fontSize: 14, fontWeight: 800,
          color: "var(--text-primary)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 24, height: 24, borderRadius: 6,
            background: "#03C75A", color: "#fff",
            fontSize: 12, fontWeight: 900, letterSpacing: "-0.5px",
          }}>N</span>
          유솔N 현황
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
          }}>전체 →</button>
        )}
      </div>

      {/* 본문 — 작은 도넛 + 카운트 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 20,
        alignItems: "center",
      }}>
        <div style={{
          position: "relative",
          width: 130, height: 130,
          borderRadius: "50%",
          background: hasData
            ? `conic-gradient(
                #3B82F6 0% ${engPct}%,
                #F59E0B ${engPct}% ${stop2}%,
                var(--accent) ${stop2}% 100%
              )`
            : "var(--bg-inset, var(--bg-primary))",
          flexShrink: 0,
        }}>
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 86, height: 86,
            borderRadius: "50%",
            background: "var(--bg-elevated)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 1,
            padding: 6,
            boxSizing: "border-box",
            textAlign: "center",
          }}>
            {hasData ? (
              <>
                <span style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 700 }}>오늘 매출</span>
                <span className="mono" style={{
                  fontSize: 11, fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.3px",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.1,
                  wordBreak: "keep-all",
                }}>{fmtKRW(total)}</span>
                <span style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 600 }}>
                  {revenue.count}건
                </span>
              </>
            ) : (
              <span style={{
                fontSize: 10, color: "var(--text-secondary)",
                fontWeight: 700, letterSpacing: 0.3,
              }}>오늘 매출 없음</span>
            )}
          </div>
        </div>

        <div style={{
          display: "flex", flexDirection: "column", gap: 10,
          fontVariantNumeric: "tabular-nums",
        }}>
          <UsolNStat label="미배정"   value={unassignedCount}    warn={unassignedCount > 0}/>
          <UsolNStat label="정산 대기" value={pendingSettleCount === null ? "···" : pendingSettleCount}/>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <UsolNStat label="회사 마진" value={fmtKRW(revenue.owner || 0)} big/>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsolNStat({ label, value, warn, big }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
    }}>
      <span style={{
        fontSize: big ? 12 : 11,
        fontWeight: big ? 800 : 600,
        color: "var(--text-secondary)",
      }}>{label}</span>
      <span className="mono" style={{
        fontSize: big ? 17 : 14,
        fontWeight: big ? 800 : 700,
        color: big ? "var(--accent)" : (warn ? "var(--orange)" : "var(--text-primary)"),
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.3px",
      }}>{value}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 기사별 오늘 일정 — 막대 그래프. 많은 순.
//   오늘 배정된 작업 (scheduled today + assignedEngineerId) groupBy 기사.
// ──────────────────────────────────────────────────────────────────
function EngineersPanel({ apiTasks, apiEngineers }) {
  const today = todayYmd();

  // 오늘 기사별 작업 수.
  const countByEngineer = useMemo(() => {
    const map = new Map();
    for (const task of apiTasks || []) {
      const scheduled = task.scheduledAt || task.scheduled_at;
      if (!scheduled || toKstYmd(scheduled) !== today) continue;
      const engineerId = task.assignedEngineerId || task.assigned_engineer_id;
      if (!engineerId) continue;
      map.set(engineerId, (map.get(engineerId) || 0) + 1);
    }
    return map;
  }, [apiTasks, today]);

  // 기사 list + count, count > 0 만, 많은 순.
  const list = useMemo(() => {
    const arr = (apiEngineers || [])
      .map(eng => ({
        id: eng.id,
        name: eng.name || eng.label || "—",
        count: countByEngineer.get(eng.id) || 0,
      }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);
    return arr;
  }, [apiEngineers, countByEngineer]);

  const maxCount = list.length > 0 ? Math.max(...list.map(e => e.count)) : 1;
  const totalToday = list.reduce((s, e) => s + e.count, 0);

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{
          fontSize: 14, fontWeight: 800,
          color: "var(--text-primary)",
        }}>👷 기사별 오늘 일정</div>
        <span style={{
          fontSize: 11, color: "var(--text-secondary)", fontWeight: 700,
        }}>{list.length}명 · {totalToday}건</span>
      </div>

      {/* 본문 */}
      {list.length === 0 ? (
        <div style={{
          padding: "30px 20px", textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: 12, fontWeight: 600,
        }}>오늘 배정된 작업 없음</div>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          maxHeight: 320, overflowY: "auto",
          paddingRight: 4,
        }}>
          {list.slice(0, 16).map(eng => (
            <EngineerBar key={eng.id} name={eng.name} count={eng.count} maxCount={maxCount}/>
          ))}
          {list.length > 16 && (
            <div style={{
              fontSize: 10, color: "var(--text-secondary)",
              fontWeight: 600, textAlign: "center",
              padding: "4px 0",
            }}>+{list.length - 16}명 더</div>
          )}
        </div>
      )}
    </div>
  );
}

function EngineerBar({ name, count, maxCount }) {
  const pct = (count / maxCount) * 100;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 80px) 1fr auto",
      alignItems: "center",
      gap: 10,
    }}>
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: "var(--text-primary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{name}</span>
      <div style={{
        height: 18,
        background: "var(--bg-primary)",
        borderRadius: 4,
        overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--accent)",
          transition: "width 0.3s",
        }}/>
      </div>
      <span className="mono" style={{
        fontSize: 12, fontWeight: 800,
        color: "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
      }}>{count}건</span>
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// 2026-07-09 — 원청별 오늘 현황 (접수 / 완료 / 회사 몫).
//   ⚠️ owner_amount 는 gross → 라벨 "회사 몫" (운영비 전. "이익" 아님).
//   ⚠️ 접수/완료 는 독립 집계 (오늘 접수한 게 오늘 완료 아님).
//   · 접수: created_at KST 오늘 + status !== "취소" (트랙 무관 count)
//   · 완료: completed_at KST 오늘 + status === "완료" (트랙 무관 count)
//   · 회사 몫: 완료 건 owner_amount 합 (usol_n 은 트랙 B → "월정산" 표시)
//   · 접수/완료 둘 다 0인 원청 행 생략.
// ──────────────────────────────────────────────────────────────────
const PRINCIPAL_ORDER = [
  { code: "allday",  name: "올데이케어" },
  { code: "KA",      name: "KA" },
  { code: "KB",      name: "KB" },
  { code: "yongin",  name: "용인컴퍼니" },
  { code: "usol_h",  name: "유솔홈케어 H" },
  { code: "crikrin", name: "크리크린" },
  { code: "usol_n",  name: "유솔홈케어 N" },
];
const USOLN_CODE = "usol_n";

function AdminPcTodayByPrincipal({ apiTasks = [] }) {
  const today = todayYmd();

  const { rows, totals } = useMemo(() => {
    const received = new Map();
    const done     = new Map();
    const owner    = new Map();

    for (const t of (apiTasks || [])) {
      if (!t) continue;
      const code = String(t.principalCode || t.principal_code || "").trim();
      if (!code) continue;

      // 오늘 접수 (취소 제외)
      const created = t.createdAt || t.created_at;
      if (created && t.status !== "취소" && toKstYmd(created) === today) {
        received.set(code, (received.get(code) || 0) + 1);
      }
      // 오늘 완료 (status='완료' 만)
      const completed = t.completedAt || t.completed_at;
      if (completed && t.status === "완료" && toKstYmd(completed) === today) {
        done.set(code, (done.get(code) || 0) + 1);
        // 회사 몫 — usol_n 은 트랙 B (월정산) 이므로 즉시 미확정
        if (code !== USOLN_CODE) {
          owner.set(code, (owner.get(code) || 0) + Number(t.owner_amount || 0));
        }
      }
    }

    const rowsAll = PRINCIPAL_ORDER.map(p => ({
      code:     p.code,
      name:     p.name,
      received: received.get(p.code) || 0,
      done:     done.get(p.code)     || 0,
      owner:    owner.get(p.code)    || 0,
      isTrackB: p.code === USOLN_CODE,
    })).filter(r => r.received > 0 || r.done > 0);

    const totalsRow = {
      received: rowsAll.reduce((s, r) => s + r.received, 0),
      done:     rowsAll.reduce((s, r) => s + r.done,     0),
      owner:    rowsAll.reduce((s, r) => s + (r.isTrackB ? 0 : r.owner), 0),
    };

    return { rows: rowsAll, totals: totalsRow };
  }, [apiTasks, today]);

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{
            fontSize: 15, fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.3px",
          }}>📊 원청별 오늘 현황</div>
          <div style={{
            fontSize: 11, color: "var(--text-secondary)", fontWeight: 600,
          }}>{today}</div>
        </div>
        <div style={{
          fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600,
        }}>
          회사 몫 = 매출 − 기사정산 − 원청수수료 (gross)
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{
          padding: "24px 12px", textAlign: "center",
          color: "var(--text-secondary)", fontSize: 12, fontWeight: 600,
          background: "var(--bg-secondary)",
          borderRadius: 8,
        }}>오늘 접수·완료 없음</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse",
            fontSize: 13, fontFamily: "inherit",
          }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <Th align="left"  width="26%">원청</Th>
                <Th align="right" width="18%">오늘 접수</Th>
                <Th align="right" width="18%">오늘 완료</Th>
                <Th align="right" width="38%">회사 몫</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.code} style={{ borderBottom: "1px solid var(--border)" }}>
                  <Td align="left">
                    <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{r.name}</span>
                    <span style={{
                      marginLeft: 6,
                      fontSize: 10, fontWeight: 600,
                      color: "var(--text-tertiary)",
                    }}>{r.code}</span>
                  </Td>
                  <Td align="right"><NumCell n={r.received} unit="건" muted={r.received === 0}/></Td>
                  <Td align="right"><NumCell n={r.done}     unit="건" muted={r.done === 0}/></Td>
                  <Td align="right">
                    {r.isTrackB ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: "var(--text-tertiary)",
                        padding: "2px 8px",
                        background: "var(--bg-secondary)",
                        borderRadius: 6,
                      }}>월정산</span>
                    ) : (
                      <NumCell n={r.owner} unit="원" muted={r.owner === 0}/>
                    )}
                  </Td>
                </tr>
              ))}
              {/* 합계 (usol_n owner 는 제외됨) */}
              <tr style={{
                background: "var(--bg-secondary)",
                fontWeight: 800,
              }}>
                <Td align="left">
                  <span style={{ color: "var(--text-primary)" }}>합계</span>
                  <span style={{
                    marginLeft: 6, fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600,
                  }}>(회사 몫은 트랙 A만)</span>
                </Td>
                <Td align="right"><NumCell n={totals.received} unit="건"/></Td>
                <Td align="right"><NumCell n={totals.done}     unit="건"/></Td>
                <Td align="right"><NumCell n={totals.owner}    unit="원"/></Td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, align = "left", width }) {
  return (
    <th style={{
      padding: "8px 10px",
      textAlign: align,
      fontSize: 10, fontWeight: 700,
      color: "var(--text-secondary)",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      width,
    }}>{children}</th>
  );
}
function Td({ children, align = "left" }) {
  return (
    <td style={{
      padding: "10px 10px",
      textAlign: align,
      color: "var(--text-primary)",
    }}>{children}</td>
  );
}
function NumCell({ n, unit, muted = false }) {
  const val = Number(n) || 0;
  return (
    <span className="mono" style={{
      fontSize: 13, fontWeight: 800,
      color: muted ? "var(--text-tertiary)" : "var(--text-primary)",
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "-0.2px",
    }}>
      {val.toLocaleString("ko-KR")}
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: "var(--text-secondary)",
        marginLeft: 2,
      }}>{unit}</span>
    </span>
  );
}

export default AdminPcDashboard;
