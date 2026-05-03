// V14 — 정산 상세 (NEW)
// 오늘 번 돈 카드 클릭 → 진입
// 작업별 수수료 흐름 + 회사 송금 표 (하단)

import { ArrowLeft } from "lucide-react";
import { ServiceTypeIcon } from "./ServiceTypeIcon.jsx";

function getEarning(t) {
  return t.engineerEarning || t.engineerNet || 0;
}

function getRevenue(t) {
  return (t.estimateTotal || 0) + (t.addonFee || 0) + (t.extraFee || 0);
}

function getCommission(t) {
  // 수수료 = 매출 - 기사수익 (음수면 0)
  return Math.max(0, getRevenue(t) - getEarning(t));
}

function formatTodayLabel(date = new Date()) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

export function EngineerSettlementDetailScreen({
  todayTasks = [],
  onBack,
  onTaskClick,
}) {
  const completed = todayTasks.filter(t => t.status === "완료");
  const upcoming  = todayTasks.filter(t => t.status !== "완료");

  const todayEarning  = completed.reduce((s, t) => s + getEarning(t), 0);
  const todayRevenue  = completed.reduce((s, t) => s + getRevenue(t), 0);
  const toCompany     = Math.max(0, todayRevenue - todayEarning);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      paddingBottom: 24,
      fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg-primary)",
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: "var(--text-primary)",
          display: "flex", alignItems: "center",
        }}>
          <ArrowLeft size={20}/>
        </button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>오늘 번 돈</div>
          <div style={{
            fontSize: 12, color: "var(--text-secondary)",
            fontWeight: 500, marginTop: 2,
          }}>
            {formatTodayLabel()}
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* 큰 핑크 카드 */}
        <div style={{
          background: "#FF1B8D",
          borderRadius: 14,
          padding: 22,
          marginBottom: 18,
          color: "#fff",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.9)",
            fontWeight: 600, marginBottom: 6,
          }}>
            오늘 번 돈
          </div>
          <div style={{
            fontSize: 36, fontWeight: 900,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "-1px", lineHeight: 1,
          }}>
            ₩{todayEarning.toLocaleString("ko-KR")}
          </div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.9)",
            fontWeight: 500, marginTop: 10,
          }}>
            {completed.length}건 완료
          </div>
        </div>

        {/* 작업 리스트 */}
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: 10, paddingLeft: 4,
        }}>
          📋 작업 리스트
        </div>

        {completed.length === 0 && upcoming.length === 0 && (
          <div style={{
            padding: 24, textAlign: "center",
            color: "var(--text-tertiary)", fontSize: 13,
            background: "var(--bg-secondary)",
            borderRadius: 10,
            marginBottom: 14,
          }}>
            오늘 작업이 없습니다.
          </div>
        )}

        {/* 완료 작업 */}
        {completed.map(task => (
          <CompletedTaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick && onTaskClick(task)}
          />
        ))}

        {/* 예정 작업 */}
        {upcoming.map(task => (
          <UpcomingTaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick && onTaskClick(task)}
          />
        ))}

        {/* 회사 송금 표 (하단) */}
        {completed.length > 0 && (
          <div style={{
            marginTop: 18,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 12, padding: 16,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 800, marginBottom: 12,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>📤</span>
              <span>회사 송금</span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: "var(--text-secondary)",
              }}>
                (22시 마감)
              </span>
            </div>
            <SettlementRow label="완료 작업 총매출" value={`₩${todayRevenue.toLocaleString("ko-KR")}`}/>
            <SettlementRow label="내 수익" value={`−₩${todayEarning.toLocaleString("ko-KR")}`}/>
            <div style={{
              borderTop: "1px solid var(--border)",
              marginTop: 10, paddingTop: 10,
              display: "flex", justifyContent: "space-between",
              alignItems: "baseline",
            }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>회사 송금</span>
              <span style={{
                fontSize: 18, fontWeight: 900,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#FF8A3D",
                letterSpacing: "-0.3px",
              }}>
                ₩{toCompany.toLocaleString("ko-KR")}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompletedTaskCard({ task, onClick }) {
  const earning    = getEarning(task);
  const revenue    = getRevenue(task);
  const commission = getCommission(task);
  const baseAmount = task.estimateTotal || 0;
  const extraFee   = (task.addonFee || 0) + (task.extraFee || 0);

  // 수수료율 표시 (역산)
  const rate = revenue > 0 ? Math.round((commission / revenue) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {/* 1행: 고객명 + 완료 배지 */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 6,
      }}>
        <div style={{
          fontSize: 17, fontWeight: 800,
          color: "#FF1B8D",
        }}>
          {task.customer}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800,
          color: "#03C75A",
          padding: "3px 8px",
          background: "rgba(3,199,90,0.10)",
          borderRadius: 6,
        }}>
          ✓ 완료
        </span>
      </div>

      {/* 2행: 작업종류 + 시간 */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 14,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--text-secondary)", fontWeight: 600,
        }}>
          <ServiceTypeIcon workType={task.workType} size={13} showLabel={true}/>
          <span>{task.appliance || ""}{task.qty ? ` ×${task.qty}` : ""}</span>
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-secondary)",
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
        }}>
          {task.completedAt || task.scheduledTime || task.time || ""}
        </div>
      </div>

      {/* 정산 표 */}
      <div style={{
        background: "var(--bg-primary)",
        borderRadius: 8,
        padding: 12,
      }}>
        <DetailRow label="금액" value={`${baseAmount.toLocaleString("ko-KR")}원`}/>
        <DetailRow label="현장추가금" value={`${extraFee.toLocaleString("ko-KR")}원`}/>
        <Divider/>
        <DetailRow label="총 작업비" value={`${revenue.toLocaleString("ko-KR")}원`} bold/>
        <DetailRow
          label={`수수료${rate ? ` (${rate}%)` : ""}`}
          value={`-${commission.toLocaleString("ko-KR")}원`}
          color="#FF3B5C"
        />
        <Divider/>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "baseline", paddingTop: 4,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>💰 내 수익</span>
          <span style={{
            fontSize: 17, fontWeight: 900,
            color: "#FF1B8D",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "-0.3px",
          }}>
            +{earning.toLocaleString("ko-KR")}원
          </span>
        </div>
      </div>
    </div>
  );
}

function UpcomingTaskCard({ task, onClick }) {
  const expected = task.engineerEarning || task.estimateEngineerEarning || 0;

  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        opacity: 0.6,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 6,
      }}>
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: "var(--text-primary)",
        }}>
          {task.customer}
          <span style={{
            fontSize: 12, color: "var(--text-secondary)",
            fontWeight: 500, marginLeft: 6,
          }}>
            (예정)
          </span>
        </div>
        {expected > 0 && (
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: "var(--text-secondary)",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            예상 {expected.toLocaleString("ko-KR")}원
          </div>
        )}
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 13, color: "var(--text-secondary)", fontWeight: 500,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
        }}>
          {task.scheduledTime || task.time || "—"}
        </span>
        <span>·</span>
        <ServiceTypeIcon workType={task.workType} size={12} showLabel={true}/>
        <span>{task.appliance || ""}{task.qty ? ` ×${task.qty}` : ""}</span>
      </div>
    </div>
  );
}

function DetailRow({ label, value, color, bold }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "baseline", padding: "3px 0",
    }}>
      <span style={{
        fontSize: 13, color: "var(--text-secondary)",
        fontWeight: bold ? 700 : 500,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        color: color || "var(--text-primary)",
        fontWeight: bold ? 800 : 600,
      }}>
        {value}
      </span>
    </div>
  );
}

function SettlementRow({ label, value }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "baseline", padding: "4px 0",
    }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
        {label}
      </span>
      <span style={{
        fontSize: 14, fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        color: "var(--text-primary)",
      }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div style={{
      height: 1, background: "var(--border)", margin: "6px 0",
    }}/>
  );
}

export default EngineerSettlementDetailScreen;
