// 2026-06-26 — 기사별 → 기사 클릭 시 그 기사의 작업 리스트.
//   진입: RevenueDetailScreen 기사별 탭 행 클릭.
//   표시: PC = 가운데 모달 (EngineerTaskModal) / 모바일 = 화면 전환 (EngineerTaskListScreen).
//   데이터: getTasksByEngineerInRange — 기존 기사별 합계(computeRevenueByEngineer)와 동일 dataset.
//     → 합계 100% 일치 보장. console.warn 으로 정합 검산.
//
// 컬럼 (사장님 spec):
//   작업명(task_no + customer_name) · 날짜(completed_at KST) · 총판매가 · 기사 정산 · 회사 마진
//
// 운영자 화면 전용 — 판매가·마진 노출 OK (기사 본인 PWA 와 무관).

import { useEffect, useMemo } from "react";
import { X, ArrowLeft } from "lucide-react";
import { toKstYmd } from "../../utils/dateLabel.js";
import { getTasksByEngineerInRange } from "../../utils/revenueStats.js";

const COLOR_ENGINEER = "#3B82F6";

function fmtKRW(n) { return `₩${(Number(n) || 0).toLocaleString("ko-KR")}`; }
function fmtCount(n) { return `${Number(n) || 0}건`; }

// ──────────────────────────────────────────────────────────────────
// 코어 리스트 — PC 모달 / 모바일 화면 둘 다 이 안에 들어감.
//   props.expected: { count, total, engineer, owner } — 기사별 행 값. 합계 정합 검산용.
// ──────────────────────────────────────────────────────────────────
function EngineerTaskCore({ t, apiTasks, user, engineerId, startYmd, endYmd, expected }) {
  const tasks = useMemo(() => {
    const list = getTasksByEngineerInRange(apiTasks, startYmd, endYmd, engineerId, user);
    return list.slice().sort((a, b) => {
      const aT = a.completedAt || a.completed_at || "";
      const bT = b.completedAt || b.completed_at || "";
      return String(bT).localeCompare(String(aT));
    });
  }, [apiTasks, user, engineerId, startYmd, endYmd]);

  const sums = useMemo(() => {
    let total = 0, engineer = 0, owner = 0;
    for (const x of tasks) {
      total    += Number(x.totalAmount || x.총금액 || x.estimateTotal || 0);
      engineer += Number(x.engineer_amount || 0);
      owner    += Number(x.owner_amount || 0);
    }
    return { count: tasks.length, total, engineer, owner };
  }, [tasks]);

  // 합계 정합 검산 (dev 콘솔 경고 — 운영 영향 없음).
  useEffect(() => {
    if (!expected) return;
    if (tasks.length === 0) return;
    if (typeof window === "undefined" || typeof console === "undefined") return;
    const mismatch =
      sums.count    !== Number(expected.count    || 0) ||
      sums.total    !== Number(expected.total    || 0) ||
      sums.engineer !== Number(expected.engineer || 0) ||
      sums.owner    !== Number(expected.owner    || 0);
    if (mismatch) {
      console.warn(
        "[EngineerTaskList] 합계 불일치 — 작업 합:", sums,
        " vs 기사별 행:", expected,
      );
    }
  }, [sums, expected, tasks.length]);

  if (tasks.length === 0) {
    return (
      <div style={{
        padding: "30px 14px", textAlign: "center",
        color: t.textMuted, fontSize: 12,
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 10,
      }}>해당 기간에 이 기사의 작업이 없음</div>
    );
  }

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, overflow: "hidden",
      fontVariantNumeric: "tabular-nums",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 1.1fr)",
        gap: 8,
        padding: "9px 12px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgInset || "rgba(255,255,255,0.02)",
      }}>
        <Th t={t} align="left">작업명</Th>
        <Th t={t} align="left">날짜</Th>
        <Th t={t} align="right">총판매가</Th>
        <Th t={t} align="right">기사 정산</Th>
        <Th t={t} align="right">회사 마진</Th>
      </div>
      {/* 행 */}
      {tasks.map((task, idx) => {
        const total = Number(task.totalAmount || task.총금액 || task.estimateTotal || 0);
        const engineer = Number(task.engineer_amount || 0);
        const owner = Number(task.owner_amount || 0);
        const taskNo = task.task_no || task.taskNo || "";
        const customer = task.customer || task.customerName || task.customer_name || "—";
        const ymdKst = toKstYmd(task.completedAt || task.completed_at) || "—";
        return (
          <div key={task.id || idx} style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 1.1fr)",
            gap: 8, alignItems: "center",
            padding: "10px 12px",
            borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: t.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              <span style={{ color: t.textSecondary, fontWeight: 600, marginRight: 6 }}>
                {taskNo}
              </span>
              {customer}
            </div>
            <div style={{
              fontSize: 11, color: t.textSecondary, fontWeight: 600,
            }}>{ymdKst}</div>
            <div className="mono" style={{
              fontSize: 12, textAlign: "right", color: t.text, fontWeight: 800,
              letterSpacing: "-0.3px",
            }}>{fmtKRW(total)}</div>
            <div className="mono" style={{
              fontSize: 12, textAlign: "right", color: COLOR_ENGINEER, fontWeight: 800,
              letterSpacing: "-0.3px",
            }}>{fmtKRW(engineer)}</div>
            <div className="mono" style={{
              fontSize: 12, textAlign: "right", color: t.accent, fontWeight: 800,
              letterSpacing: "-0.3px",
            }}>{fmtKRW(owner)}</div>
          </div>
        );
      })}
      {/* 합계 행 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 0.9fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 1.1fr)",
        gap: 8, alignItems: "center",
        padding: "12px 12px",
        borderTop: `1.5px solid ${t.accent}`,
        background: t.bgInset || "rgba(255,255,255,0.04)",
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>
          합계
        </div>
        <div style={{
          fontSize: 11, color: t.textMuted, fontWeight: 700,
        }}>{fmtCount(sums.count)}</div>
        <div className="mono" style={{
          fontSize: 13, textAlign: "right", color: t.text, fontWeight: 800,
          letterSpacing: "-0.3px",
        }}>{fmtKRW(sums.total)}</div>
        <div className="mono" style={{
          fontSize: 13, textAlign: "right", color: COLOR_ENGINEER, fontWeight: 800,
          letterSpacing: "-0.3px",
        }}>{fmtKRW(sums.engineer)}</div>
        <div className="mono" style={{
          fontSize: 13, textAlign: "right", color: t.accent, fontWeight: 800,
          letterSpacing: "-0.3px",
        }}>{fmtKRW(sums.owner)}</div>
      </div>
    </div>
  );
}

function Th({ t, align, children }) {
  return (
    <div style={{
      fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3,
      textAlign: align,
    }}>{children}</div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PC 모달 — fixed overlay + Esc + 배경 클릭 닫기 + X 버튼.
// ──────────────────────────────────────────────────────────────────
export function EngineerTaskModal({ t, apiTasks, user, engineer, startYmd, endYmd, periodLabel, onClose }) {
  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!engineer) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: t.bg, color: t.text,
          border: `1px solid ${t.border}`, borderRadius: 14,
          width: "min(960px, 100%)",
          maxHeight: "min(85vh, 800px)",
          display: "flex", flexDirection: "column",
          fontFamily: "'Pretendard', sans-serif",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "16px 20px",
          borderBottom: `1px solid ${t.border}`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
              {engineer.name || "(미배정)"}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 2 }}>
              {periodLabel} · 트랙 A
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: "transparent", border: "none", padding: 6,
              cursor: "pointer", color: t.text,
              display: "flex", alignItems: "center",
            }}
          ><X size={20}/></button>
        </div>
        {/* 본문 */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "16px 20px",
        }}>
          <EngineerTaskCore
            t={t}
            apiTasks={apiTasks}
            user={user}
            engineerId={engineer.id || null}
            startYmd={startYmd}
            endYmd={endYmd}
            expected={{
              count:    engineer.count,
              total:    engineer.total,
              engineer: engineer.engineer,
              owner:    engineer.owner,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 모바일 화면 — Header(← 뒤로 + 기사명) + EngineerTaskCore.
// ──────────────────────────────────────────────────────────────────
export function EngineerTaskListScreen({ t, apiTasks, user, engineer, startYmd, endYmd, periodLabel, onBack }) {
  if (!engineer) {
    // 안전망 — params 없이 진입한 케이스 (직접 url 등). 뒤로 보내기.
    return (
      <div style={{ padding: 30, textAlign: "center", color: t.textMuted, fontSize: 13 }}>
        <button onClick={onBack} style={{
          background: "transparent", border: `1px solid ${t.border}`,
          color: t.text, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
        }}>← 매출 상세로</button>
      </div>
    );
  }
  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.text,
      paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
      fontFamily: "'Pretendard', sans-serif",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text,
          display: "flex", alignItems: "center",
        }} aria-label="뒤로">
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 800, color: t.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{engineer.name || "(미배정)"}</div>
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 2 }}>
            {periodLabel} · 트랙 A
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <EngineerTaskCore
          t={t}
          apiTasks={apiTasks}
          user={user}
          engineerId={engineer.id || null}
          startYmd={startYmd}
          endYmd={endYmd}
          expected={{
            count:    engineer.count,
            total:    engineer.total,
            engineer: engineer.engineer,
            owner:    engineer.owner,
          }}
        />
      </div>
    </div>
  );
}
