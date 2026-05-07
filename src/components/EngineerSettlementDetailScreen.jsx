// V14 정산 상세 — 합계 Hero + 작업별 카드 (수수료 흐름)
// 정산 메인의 "오늘 번 돈" 카드 클릭으로 진입
// 회사 송금 표 X (메인에만)

import { ArrowLeft } from "lucide-react";
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { calcTaskEarning } from "../utils/feePolicy.js";

function getEarning(t) {
  return t.engineerEarning || t.engineerNet || 0;
}

function getRevenue(t) {
  return (t.estimateTotal || 0) + (t.addonFee || 0) + (t.extraFee || 0);
}

function getCommission(t) {
  return Math.max(0, getRevenue(t) - getEarning(t));
}

export function EngineerSettlementDetailScreen({
  todayTasks = [],
  onBack,
  onTaskClick,
}) {
  const completed = todayTasks.filter(t => t.status === "완료");
  const upcoming  = todayTasks.filter(t => t.status !== "완료");

  const todayEarning   = completed.reduce((s, t) => s + getEarning(t), 0);
  const todayRevenue   = completed.reduce((s, t) => s + getRevenue(t), 0);
  const todayFee       = todayRevenue - todayEarning;
  const totalCount     = todayTasks.length;
  const completedCount = completed.length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      paddingBottom: 24,
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: "var(--text-primary)",
          display: "flex", alignItems: "center",
        }}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 700 }}>
          오늘 정산 상세
        </div>
        <div style={{ width: 28 }}/>
      </div>

      {/* V14 — 합계 Hero 카드 (검정 / 메인 핑크와 차별화) */}
      <div style={{ padding: 16 }}>
        <div style={{
          background: "#1A1A1A",
          borderRadius: 20,
          padding: "22px 22px 18px",
          color: "#fff",
        }}>
          {/* 라벨 — 옅은 핑크 (메인과 통일) */}
          <div style={{
            fontSize: 13, color: "#FFD9E8", fontWeight: 600,
            marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>💰</span> 오늘 번 돈
          </div>
          {/* Hero ₩ 56px 핑크 (검정 위에서 도드라짐) */}
          <div style={{
            fontSize: 56, fontWeight: 700, color: "#FF4DA6",
            fontFamily: "inherit",
            letterSpacing: "-2px", lineHeight: 1,
            marginBottom: 6,
          }}>
            ₩{todayEarning.toLocaleString("ko-KR")}
          </div>
          {/* 부속 설명 — 회색 (블랙 톤) */}
          <div style={{
            fontSize: 13, color: "#888", marginBottom: 16, fontWeight: 600,
          }}>
            {completedCount}건 완료 · 본인 수익 합계
          </div>

          {/* V14 v6 — 사장님 spec: 완료 N건 + 오늘 수수료 (= 회사 송금 합) */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
          }}>
            <SubStat label="완료" amount={`${completed.length}건`}/>
            <SubStat label="오늘 수수료" amount={todayFee}/>
          </div>
        </div>
      </div>

      {/* 작업별 정산 섹션 */}
      <div style={{ padding: "0 16px 8px" }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: "var(--text-secondary)",
          padding: "8px 4px 12px",
        }}>
          📊 작업별 정산
        </div>

        {completed.length === 0 ? (
          <div style={{
            padding: 28, textAlign: "center",
            color: "var(--text-tertiary)", fontSize: 14,
            background: "var(--bg-secondary)",
            borderRadius: 14,
          }}>
            오늘 완료된 작업이 없습니다.
          </div>
        ) : (
          completed.map(work => (
            <WorkSettlementCard
              key={work.id}
              work={work}
              onClick={() => onTaskClick && onTaskClick(work)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SubStat({ label, amount }) {
  const display = typeof amount === "number" ? `₩${amount.toLocaleString("ko-KR")}` : amount;
  return (
    <div style={{
      background: "rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: "11px 13px",
    }}>
      <div style={{
        fontSize: 11, color: "#888",
        fontWeight: 600, marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 700,
        fontFamily: "inherit",
        color: "#FAF8F5", letterSpacing: "-0.3px", lineHeight: 1.1,
      }}>
        {display}
      </div>
    </div>
  );
}

function WorkSettlementCard({ work, onClick }) {
  const colors      = getWorkTypeColors(work.workType);
  const isCompleted = work.status === "완료";
  // V14 — 완료/예정 모두 정확한 정책으로 계산 (calcTaskEarning)
  const calc        = calcTaskEarning(work);
  const revenue     = isCompleted ? getRevenue(work) : (calc.total || work.estimateTotal || 0);
  const earning     = isCompleted ? getEarning(work) : calc.engineer;
  const fee         = Math.max(0, revenue - earning);
  const estRevenue  = revenue;
  const estFee      = fee;
  const estEarning  = earning;
  const showRevenue = revenue;
  const ratePct     = estRevenue > 0 ? Math.round((estFee / estRevenue) * 100) : 0;

  const time    = work.completedAt || work.scheduledTime || work.time || "";
  const endTime = work.endTime || "";

  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        position: "relative",
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "14px 16px 14px 20px",
        marginBottom: 10,
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden",
        opacity: isCompleted ? 1 : 0.55,
      }}
    >
      {/* 좌측 4px 작업 종류 색 바 */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 4,
        background: colors.main,
      }}/>

      {/* 헤더: 작업 종류 + 완료/예정 + 시간 */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 8, gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: colors.main,
            whiteSpace: "nowrap",
          }}>
            {colors.icon} {colors.name}
          </span>
          {isCompleted ? (
            <span style={{
              background: "var(--completed-pill-bg)",
              color: "var(--completed-pill-text)",
              fontSize: 11, padding: "2px 8px",
              borderRadius: 999, fontWeight: 700,
              flexShrink: 0,
            }}>
              ✓ 완료
            </span>
          ) : (
            <span style={{
              background: "var(--pending-pill-bg)",
              color: "var(--pending-pill-text)",
              fontSize: 11, padding: "2px 8px",
              borderRadius: 999, fontWeight: 700,
              flexShrink: 0,
            }}>
              예정
            </span>
          )}
        </div>
        {time && (
          <span style={{
            fontSize: 11, color: "#888", fontWeight: 600,
            fontFamily: "inherit",
            flexShrink: 0,
          }}>
            {time}{endTime ? ` ~ ${endTime}` : ""}
          </span>
        )}
      </div>

      {/* 고객명 · 작업 항목 */}
      <div style={{
        fontSize: 16, fontWeight: 700,
        color: "var(--text-primary)",
        marginBottom: 12,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          minWidth: 0, flex: "0 1 auto",
        }}>
          {work.customer || "—"}
          {work.appliance ? ` · ${work.appliance}` : ""}
          {work.qty ? ` ×${work.qty}` : ""}
        </span>
        {(work.client === '유솔홈케어 N' || work.principalId === 'usol_n') && (work.workType || '').includes('세척') && (
          <span style={{
            background: '#03C75A', color: 'white',
            fontSize: 9, padding: '2px 5px',
            borderRadius: 4, fontWeight: 800,
            marginLeft: 6,
          }}>N</span>
        )}
      </div>

      {/* V14 v7 — 미니멀 라인 (사장님 spec: 핑크 박스 X / 라인만) */}
      <div>
        {/* 내 수익 (큰 / 22px / 800 / 핑크 숫자만) */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}>
          <span style={{
            fontSize: 13, color: "#FF1B8D", fontWeight: 700,
          }}>
            💰 내 수익
          </span>
          <span style={{
            fontSize: 22, fontWeight: 800,
            color: "#FF1B8D",
            letterSpacing: "-0.5px",
            fontFamily: "inherit",
          }}>
            ₩{(estEarning || 0).toLocaleString("ko-KR")}
          </span>
        </div>
        {/* 구분선 (옅은 회색) */}
        <div style={{
          height: 1,
          background: "var(--border-subtle, #F0EBE3)",
          marginBottom: 6,
        }}/>
        {/* 수수료 (작게 / 12px / 회색) */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{
            fontSize: 11, color: "var(--text-tertiary, #999)",
            fontWeight: 600,
          }}>
            수수료
          </span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: "var(--text-tertiary, #999)",
            fontFamily: "inherit",
          }}>
            ₩{(estFee || 0).toLocaleString("ko-KR")}
          </span>
        </div>
      </div>
    </div>
  );
}

function FlowItem({ label, value, grey, highlight }) {
  return (
    <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
      <div style={{
        fontSize: 10,
        color: highlight ? "#FF1B8D" : "#888",
        marginBottom: 3,
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: highlight ? 15 : 13,
        fontWeight: highlight ? 700 : 600,
        color: grey ? "#888" : (highlight ? "#FF1B8D" : "var(--text-primary)"),
        fontFamily: "inherit",
        letterSpacing: "-0.3px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </div>
    </div>
  );
}

function FlowArrow({ children }) {
  return (
    <span style={{
      color: "var(--flow-arrow)",
      fontSize: 14, flexShrink: 0,
      lineHeight: 1,
    }}>
      {children}
    </span>
  );
}

export default EngineerSettlementDetailScreen;
