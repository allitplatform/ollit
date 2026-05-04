// V11-3 — 정산 (5원청) 매일 마감 화면
// 흐름: 고객 → 기사 (현장) → 기사 → 회사 (당일 22시까지)
// 유솔 N은 별도 흐름 — isDailyClosePrincipal로 자동 제외 (V11-1 dailyClose.js)
import { useState, useMemo } from "react";
import { getDailyCloseStatus, getUnpaidByEngineer } from "../data/dailyClose.js";
import { loadEngineers } from "../data/engineers.js";
import { loadTasks, updateTask } from "../data/tasks.js";
import { EngineerBadge } from "./EngineerBadge.jsx";
import { sendManualAlerts } from "../utils/dailyAlertScheduler.js";
import { calculateMarginByPeriod } from "../utils/marginCalculator.js";

const FILTER_TABS = [
  { id: "unpaid", label: "미입금", urgent: true },
  { id: "today",  label: "오늘 전체" },
  { id: "paid",   label: "입금 완료" },
];

function formatDateInput(date) {
  return date.toISOString().split("T")[0];
}

// 작업의 회사 받을 돈 (시드 호환 — V11-1 dailyClose의 헬퍼와 동일 규칙)
function pickEngineerToCompanyAmount(t) {
  if (typeof t.companyReceiveFromEngineer === "number") return t.companyReceiveFromEngineer;
  const total = (t.estimateTotal || 0) + (t.addonFee || 0);
  return Math.max(0, total - (t.engineerEarning || 0));
}

export function SettlementScreen({ onBack, onClickPrincipalSettlement }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterId, setFilterId]         = useState("unpaid");
  // 입금 처리 후 재계산 트리거
  const [tick, setTick]                 = useState(0);
  const refresh = () => setTick(v => v + 1);

  const dailyStatus = useMemo(
    () => getDailyCloseStatus(selectedDate),
    [selectedDate, tick]
  );

  const unpaidEngineers = useMemo(
    () => getUnpaidByEngineer(),
    [tick]
  );

  const engineers = useMemo(() => {
    try { return loadEngineers(); } catch { return []; }
  }, []);

  // V11-6 — 오늘 작업별 마진 분석 (5원청 + 유솔 N 통합)
  const todayMarginAnalysis = useMemo(() => {
    const all = loadTasks();
    return calculateMarginByPeriod(all, "today");
  }, [tick]);

  // 필터 결과
  const filteredItems = useMemo(() => {
    if (filterId === "unpaid") {
      return unpaidEngineers.map(item => ({
        ...item,
        engineer: engineers.find(e => e.id === item.engineerId) || null,
      }));
    }

    if (filterId === "today") {
      const map = {};
      dailyStatus.tasks.forEach(t => {
        const key = t.engineerId || t.engineer || "unknown";
        if (!map[key]) {
          map[key] = {
            engineerId:   t.engineerId || null,
            engineerName: t.engineer || "—",
            engineer:     engineers.find(e => e.id === t.engineerId) || null,
            tasks: [],
            totalAmount: 0,
            paidAmount:  0,
          };
        }
        const amt = pickEngineerToCompanyAmount(t);
        map[key].tasks.push(t);
        map[key].totalAmount += amt;
        if (t.engineerPaidAt) map[key].paidAmount += amt;
      });
      return Object.values(map).map(it => ({
        ...it,
        isPaid: it.totalAmount > 0 && it.totalAmount === it.paidAmount,
      }));
    }

    // paid
    const paidTasks = dailyStatus.tasks.filter(t => t.engineerPaidAt);
    const map = {};
    paidTasks.forEach(t => {
      const key = t.engineerId || t.engineer || "unknown";
      if (!map[key]) {
        map[key] = {
          engineerId:   t.engineerId || null,
          engineerName: t.engineer || "—",
          engineer:     engineers.find(e => e.id === t.engineerId) || null,
          tasks: [],
          paidAmount: 0,
          totalAmount: 0,
          isPaid: true,
        };
      }
      const amt = pickEngineerToCompanyAmount(t);
      map[key].tasks.push(t);
      map[key].paidAmount += amt;
      map[key].totalAmount += amt;
    });
    return Object.values(map);
  }, [filterId, unpaidEngineers, dailyStatus, engineers]);

  const counts = {
    unpaid: unpaidEngineers.length,
    today:  new Set(dailyStatus.tasks.map(t => t.engineerId || t.engineer).filter(Boolean)).size,
    paid:   new Set(dailyStatus.tasks.filter(t => t.engineerPaidAt).map(t => t.engineerId || t.engineer).filter(Boolean)).size,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "-apple-system, 'Pretendard', sans-serif",
    }}>
      {/* 헤더 — 줄바꿈 X / 한 줄 자르기 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-primary)",
        overflow: "hidden",
      }}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" }}>
            💰 정산 (5원청)
          </div>
          <div style={{
            fontSize: 10, color: "var(--text-secondary)", marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            매일 22시까지 기사 → 회사 · 유솔 N 별도
          </div>
        </div>
        <input
          type="date"
          value={formatDateInput(selectedDate)}
          onChange={(e) => {
            const v = e.target.value;
            if (v) setSelectedDate(new Date(v));
          }}
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            color: "var(--text-primary)",
            fontSize: 11,
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        />
      </div>

      <div style={{ padding: 16, paddingBottom: 80 }}>
        <TopStats
          expected={dailyStatus.expected}
          received={dailyStatus.received}
          unpaid={dailyStatus.unpaid}
          unpaidEngineerCount={unpaidEngineers.length}
        />

        {unpaidEngineers.length > 0 && (
          <UnpaidAlert
            count={unpaidEngineers.length}
            totalAmount={unpaidEngineers.reduce((s, e) => s + (e.totalAmount || 0), 0)}
          />
        )}

        {/* V11-6 — 오늘 회사 마진 (작업별) */}
        <TodayMarginSection analysis={todayMarginAnalysis}/>

        {/* 회사 → 원청 진입 */}
        <button
          onClick={onClickPrincipalSettlement}
          style={{
            width: "100%", padding: "10px 12px", marginBottom: 14,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--text-primary)",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <span>🏢 회사 → 원청 정산</span>
          <span style={{ color: "var(--text-secondary)" }}>›</span>
        </button>

        <FilterTabs active={filterId} onChange={setFilterId} counts={counts}/>

        {filteredItems.length === 0 ? (
          <Empty filterId={filterId}/>
        ) : (
          filteredItems.map(item => (
            <EngineerSettlementCard
              key={item.engineerId || item.engineerName}
              item={item}
              isUnpaidView={filterId === "unpaid"}
              onMarkPaid={() => {
                const tasks = item.tasks || [];
                const ok = window.confirm(`${item.engineer?.name || item.engineerName}님의 ${tasks.length}건을 입금 처리할까요?`);
                if (!ok) return;
                const now = new Date().toISOString();
                tasks.forEach(t => updateTask(t.id, { engineerPaidAt: now }));
                refresh();
              }}
              onCall={() => {
                const phone = item.engineer?.phone;
                if (phone) window.location.href = `tel:${phone}`;
              }}
              onNotify={() => {
                // V11-4 — 22시 자동 알림 시스템 연결 예정
                window.alert(`${item.engineer?.name || item.engineerName}님께 미입금 알림을 발송했습니다.`);
              }}
            />
          ))
        )}

        {filterId === "unpaid" && unpaidEngineers.length > 0 && (
          <BulkAction count={unpaidEngineers.length}/>
        )}
      </div>
    </div>
  );
}

function TopStats({ expected, received, unpaid, unpaidEngineerCount }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 8, marginBottom: 14,
    }}>
      <StatBox icon="📥" label="오늘 받을 돈" value={expected} color="#FF1B8D"/>
      <StatBox
        icon={unpaid > 0 ? "🚨" : "✓"}
        label={unpaid > 0 ? `미입금 (${unpaidEngineerCount}명)` : "입금 완료"}
        value={unpaid > 0 ? unpaid : received}
        color={unpaid > 0 ? "#FF3D5A" : "#00875A"}
        urgent={unpaid > 0}
      />
    </div>
  );
}

function StatBox({ icon, label, value, color, urgent }) {
  return (
    <div style={{
      padding: 16,
      background: color,
      border: "none",
      borderRadius: 14,
      color: "#fff",
      animation: urgent ? "ollit-pulse 2s infinite" : "none",
      transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, color: "#fff", fontWeight: 700, opacity: 0.95 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, color: "#fff", fontWeight: 700, fontFamily: "monospace" }}>
        ₩{(value || 0).toLocaleString()}
      </div>
    </div>
  );
}

function TodayMarginSection({ analysis }) {
  if (!analysis || analysis.byTask.length === 0) return null;

  return (
    <div style={{
      padding: 14,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 12, marginBottom: 14,
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 10,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#FF1B8D" }}>
            💼 오늘 회사 마진
          </div>
          <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 2 }}>
            {analysis.byTask.length}건 작업 · 작업별 수수료 분석
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#FF1B8D", fontFamily: "monospace" }}>
            ₩{analysis.totalMargin.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6, marginBottom: 10,
      }}>
        <SummaryBox label="총 매출"   value={analysis.totalRevenue}         color="var(--text-primary)"/>
        <SummaryBox label="기사 수익" value={analysis.totalEngineerEarning} color="#FF1B8D"/>
        <SummaryBox label="회사 마진" value={analysis.totalMargin}          color="#FF1B8D" highlight/>
      </div>

      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6 }}>
        작업별 수수료 (상위 3건)
      </div>

      {analysis.byTask.slice(0, 3).map(item => (
        <TaskMarginRow key={item.task.id} item={item}/>
      ))}

      {analysis.byTask.length > 3 && (
        <div style={{
          textAlign: "center", padding: 8, marginTop: 4,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text-secondary)", fontSize: 10,
        }}>
          작업 {analysis.byTask.length}건 · 마진 큰 순
        </div>
      )}
    </div>
  );
}

function SummaryBox({ label, value, color, highlight }) {
  return (
    <div style={{
      padding: 8,
      background: highlight ? "#FF1B8D" : "var(--bg-secondary)",
      border: highlight ? "none" : "1px solid var(--border)",
      borderRadius: 8, textAlign: "center",
    }}>
      <div style={{
        fontSize: 9,
        color: highlight ? "#fff" : "var(--text-tertiary, var(--text-secondary))",
        opacity: highlight ? 0.95 : 1,
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, fontWeight: highlight ? 700 : 600,
        color: highlight ? "#fff" : color,
        fontFamily: "monospace",
      }}>
        ₩{(value || 0).toLocaleString()}
      </div>
    </div>
  );
}

function TaskMarginRow({ item }) {
  const { task, revenue, engineerEarning, margin, principalName, principalColor } = item;
  const items = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems.map(a => `${a.type} ×${a.count || 1}`).join(", ")
    : (task.appliance ? `${task.appliance} ×${task.qty || 1}` : "");

  return (
    <div style={{
      padding: 10,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 8, marginBottom: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{
            display: "inline-block", width: 6, height: 6,
            borderRadius: "50%", background: principalColor,
          }}/>
          <span style={{ fontSize: 10, color: principalColor, fontWeight: 600 }}>
            {principalName}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600 }}>
            {task.customer || "—"}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#FF1B8D", fontWeight: 700, fontFamily: "monospace" }}>
          +₩{margin.toLocaleString()}
        </span>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "auto 1fr",
        gap: 4, fontSize: 9,
        color: "var(--text-tertiary, var(--text-secondary))",
      }}>
        <span>매출</span>
        <span style={{ fontFamily: "monospace", textAlign: "right" }}>
          ₩{revenue.toLocaleString()}
        </span>

        <span>− 기사</span>
        <span style={{ fontFamily: "monospace", textAlign: "right", color: "#FF1B8D" }}>
          ₩{engineerEarning.toLocaleString()}
        </span>

        <span style={{ color: "#FF1B8D", fontWeight: 700 }}>= 마진</span>
        <span style={{
          fontFamily: "monospace", textAlign: "right",
          color: "#FF1B8D", fontWeight: 700,
        }}>
          ₩{margin.toLocaleString()}
        </span>
      </div>

      {(items || task.engineer) && (
        <div style={{
          marginTop: 4, paddingTop: 4,
          borderTop: "1px dashed var(--border)",
          fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))",
        }}>
          {items}{items && task.engineer ? " · " : ""}{task.engineer || (task.engineerId ? "" : "미배정")}
        </div>
      )}
    </div>
  );
}

function UnpaidAlert({ count, totalAmount }) {
  return (
    <div style={{
      padding: 16,
      background: "#FF3D5A",
      borderRadius: 14, marginBottom: 14,
      color: "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🚨</span>
        <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>
          오늘 미입금 {count}명 / 총 ₩{totalAmount.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 10, color: "#fff", opacity: 0.9, lineHeight: 1.6 }}>
        매일 22시까지 자동 알림 발송 · 통화 또는 직접 입금 처리 가능
      </div>
    </div>
  );
}

function FilterTabs({ active, onChange, counts }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {FILTER_TABS.map(tab => {
        const isActive = active === tab.id;
        const count    = counts[tab.id] || 0;
        const isUrgent = tab.urgent && count > 0;
        const tabColor = isUrgent ? "#FF3D5A" : "#FF1B8D";
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              padding: "6px 14px",
              background: "var(--bg-secondary)",
              border: isActive
                ? `2px solid ${tabColor}`
                : "1px solid var(--border)",
              color: isActive
                ? tabColor
                : "var(--text-secondary)",
              fontSize: 12, borderRadius: 24,
              fontWeight: isActive ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {tab.label}{count > 0 ? ` (${count})` : ""}
          </button>
        );
      })}
    </div>
  );
}

function EngineerSettlementCard({ item, isUnpaidView, onMarkPaid, onCall, onNotify }) {
  const { engineer, engineerName, totalAmount = 0, paidAmount = 0, unpaidDays, unpaidDates, tasks, isPaid } = item;
  const remaining = totalAmount - paidAmount;
  const displayName = engineer?.name || engineerName || "—";

  return (
    <div style={{
      padding: 12,
      background: "var(--bg-secondary)",
      borderLeft: isUnpaidView ? "4px solid #FF3D5A" : "1px solid var(--border)",
      borderTop: "1px solid var(--border)",
      borderRight: "1px solid var(--border)",
      borderBottom: "1px solid var(--border)",
      borderRadius: 10, marginBottom: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          {engineer ? (
            <EngineerBadge engineer={engineer} size="sm"/>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600 }}>{displayName}</span>
          )}
          {isUnpaidView && unpaidDays > 1 && (
            <span style={{
              fontSize: 9, color: "#FF3D5A",
              background: "var(--bg-secondary)",
              border: "1px solid #FF3D5A",
              padding: "1px 6px", borderRadius: 4, fontWeight: 700,
            }}>미입금 {unpaidDays}일</span>
          )}
          {isPaid && !isUnpaidView && (
            <span style={{
              fontSize: 9, color: "#00875A",
              background: "var(--bg-secondary)",
              border: "1px solid #00875A",
              padding: "1px 6px", borderRadius: 4, fontWeight: 700,
            }}>✓ 입금 완료</span>
          )}
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, fontFamily: "monospace",
          color: isUnpaidView ? "#FF3D5A" : (isPaid ? "#00875A" : "var(--text-primary)"),
        }}>
          ₩{(isUnpaidView ? remaining : totalAmount).toLocaleString()}
        </span>
      </div>

      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: isUnpaidView ? 8 : 0 }}>
        {tasks?.length || 0}건
        {unpaidDates && unpaidDates.length > 0 && (
          <> · {unpaidDates.slice(0, 3).join(" + ")}{unpaidDates.length > 3 && ` 외 ${unpaidDates.length - 3}일`}</>
        )}
      </div>

      {isUnpaidView && (
        <div style={{ display: "flex", gap: 6 }}>
          <ActionButton icon="📞" label="통화" onClick={onCall}/>
          <ActionButton icon="📨" label="알림" onClick={onNotify}/>
          <ActionButton icon="✓"  label="입금" primary onClick={onMarkPaid}/>
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon, label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "8px 6px",
        background: primary ? "#FF1B8D" : "var(--bg-inset, var(--bg-secondary))",
        border: primary ? "none" : "1px solid var(--border)",
        borderRadius: 6,
        color: primary ? "#fff" : "var(--text-primary)",
        fontSize: 10, fontWeight: primary ? 700 : 500,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function BulkAction({ count }) {
  function handleSendNow() {
    if (!window.confirm(`미입금 ${count}명에게 지금 알림을 발송할까요?`)) return;
    const result = sendManualAlerts();
    const sent = result?.sent || 0;
    if (sent > 0) {
      window.alert(`${sent}명에게 알림을 발송했습니다.`);
    } else {
      window.alert("발송할 알림이 없습니다 (오늘 이미 발송했거나 미입금 없음).");
    }
  }

  return (
    <button
      onClick={handleSendNow}
      style={{
        width: "100%", marginTop: 16, padding: 14,
        background: "#FF3D5A", border: "none", borderRadius: 10,
        color: "#fff", fontSize: 13, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      🚨 미입금 {count}명 일괄 알림 발송
    </button>
  );
}

function Empty({ filterId }) {
  const messages = {
    unpaid: "오늘 미입금 기사가 없습니다 ✨",
    today:  "오늘 작업한 기사가 없습니다",
    paid:   "입금 완료된 기사가 없습니다",
  };
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 12,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{messages[filterId]}</div>
  );
}

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 20,
  cursor: "pointer", padding: 4, fontFamily: "inherit",
};

export default SettlementScreen;
