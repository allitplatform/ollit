// V11-8 — 유솔 N 워크스페이스 (5탭 + 그라데이션 헤더)
// 큰 그라데이션 헤더 (#03C75A → #02A847) + 탭별 우측 핵심 정보
// 본문: 라이트 = 베이지 / 다크 = bg-secondary (CSS 변수)
import { useState, useEffect, useMemo } from "react";
import { canAccessMenu } from "../data/permissions.js";
import { getCurrentUser } from "../data/users.js";
import { loadTasks, getLongPendingTasks } from "../data/tasks.js";
import { loadUsolNSeedToStorage } from "../data/seedTasks.js";
import { USOL_N_TABS } from "../data/menuStructure.js";

import { UsolNOrders } from "./usol_n/UsolNOrders.jsx";
import { UsolNInProgress } from "./usol_n/UsolNInProgress.jsx";
import { UsolNCsvMatch } from "./usol_n/UsolNCsvMatch.jsx";
import { UsolNTracking } from "./usol_n/UsolNTracking.jsx";
import { UsolNEngineerSettlement } from "./usol_n/UsolNEngineerSettlement.jsx";

const COMPANY_RATE = 0.85;

export function UsolNScreen({ user, initialTab, onBack }) {
  const currentUser = getCurrentUser(user);
  const visibleTabs = useMemo(
    () => USOL_N_TABS.filter(t => canAccessMenu(currentUser, t.perm)),
    [currentUser]
  );
  const [activeTab, setActiveTab] = useState(
    visibleTabs.some(t => t.id === initialTab) ? initialTab : (visibleTabs[0]?.id || "orders")
  );
  // 시드 추가 후 헤더 카운트 갱신을 위한 tick
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const existing = loadTasks();
    const hasUsolNSeed = existing.some(t => (t.id || "").startsWith("usol_n_seed_"));
    if (!hasUsolNSeed) {
      loadUsolNSeedToStorage();
      setTick(v => v + 1);
    }
  }, []);

  // 탭별 헤더 정보
  const headerInfo = useMemo(() => calculateHeaderInfo(activeTab), [activeTab, tick]);

  if (!visibleTabs.length) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
        <div>접근 권한이 없습니다</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <GradientHeader info={headerInfo} onBack={onBack}/>

      {/* 5탭 (흰색 / flex:1 / 가로 스크롤 X) */}
      <div style={tabsContainerStyle}>
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...tabButtonStyle,
              ...(activeTab === tab.id ? activeTabStyle : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 본문 */}
      <div style={tabContentStyle}>
        {activeTab === "orders"              && <UsolNOrders/>}
        {activeTab === "in_progress"         && <UsolNInProgress/>}
        {activeTab === "csv_match"           && <UsolNCsvMatch/>}
        {activeTab === "tracking"            && <UsolNTracking/>}
        {activeTab === "engineer_settlement" && <UsolNEngineerSettlement/>}
      </div>
    </div>
  );
}

function GradientHeader({ info, onBack }) {
  return (
    <div style={{
      padding: "14px 16px",
      background: "#03C75A",
      color: "#fff",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "rgba(255,255,255,0.18)",
              border: "none",
              color: "#fff",
              fontSize: 16,
              cursor: "pointer",
              padding: "4px 10px",
              borderRadius: 6,
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >←</button>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.85)",
            marginBottom: 3, fontWeight: 500,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {info.subtitle}
          </div>
          <div style={{
            fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px",
          }}>
            🟢 유솔 N
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
          <div style={{
            fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 500,
          }}>
            {info.rightLabel}
          </div>
          <div style={{
            fontSize: 14, fontWeight: 700, fontFamily: "monospace",
          }}>
            {info.rightValue}
          </div>
          {info.rightSub && (
            <div style={{
              fontSize: 9, color: "rgba(255,255,255,0.75)",
            }}>
              {info.rightSub}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 탭별 헤더 정보 계산
function calculateHeaderInfo(activeTab) {
  let tasks = [];
  try { tasks = loadTasks().filter(t => t.principalId === "usol_n"); } catch {}

  if (activeTab === "orders") {
    const newReceived = tasks.filter(t => t.status === "received").length;
    return {
      subtitle:   "네이버 결제 · 매주 월요일",
      rightLabel: "접수 대기",
      rightValue: `${newReceived}건`,
      rightSub:   "네이버 발주",
    };
  }

  if (activeTab === "in_progress") {
    const inProgress = tasks.filter(t =>
      ["assigned", "confirmed", "in_progress"].includes(t.status)
    ).length;
    return {
      subtitle:   "진행중 작업 · 배정/확정/진행",
      rightLabel: "진행",
      rightValue: `${inProgress}건`,
      rightSub:   null,
    };
  }

  if (activeTab === "csv_match") {
    return {
      subtitle:   "CSV 매칭 · 매일",
      rightLabel: "정산 CSV",
      rightValue: "업로드",
      rightSub:   "자동 분류",
    };
  }

  if (activeTab === "tracking") {
    const monthTotal = calculateMonthTotal(tasks);
    return {
      subtitle:   "정산 추적 · 주간",
      rightLabel: `${new Date().getMonth() + 1}월 누적`,
      rightValue: `₩${monthTotal.toLocaleString()}`,
      rightSub:   "받을 예정 포함",
    };
  }

  if (activeTab === "engineer_settlement") {
    const next15th = getNext15thLabel();
    const pending  = calculatePendingForEngineers(tasks);
    return {
      subtitle:   "기사 정산 · 매월 15일",
      rightLabel: `${next15th} 입금`,
      rightValue: `₩${pending.toLocaleString()}`,
      rightSub:   "예정",
    };
  }

  return {
    subtitle: "네이버 결제 · 매주 월요일",
    rightLabel: "", rightValue: "", rightSub: null,
  };
}

function calculateMonthTotal(tasks) {
  const now = new Date();
  const ms  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return tasks
    .filter(t => typeof t.completedAt === "string" && t.completedAt.startsWith(ms))
    .reduce((s, t) => s + Math.floor((t.netAmount || 0) * COMPANY_RATE), 0);
}

function calculatePendingForEngineers(tasks) {
  return tasks
    .filter(t => t.naverSettledAt && !t.engineerSettledAt)
    .reduce((s, t) => {
      const earning = t.engineerEarning || Math.floor((t.netAmount || 0) * COMPANY_RATE);
      return s + earning;
    }, 0);
}

function getNext15thLabel() {
  const now = new Date();
  const month = now.getDate() > 15 ? now.getMonth() + 2 : now.getMonth() + 1;
  return `${month}/15`;
}

// ── 스타일 ───────────────────────────────────
const containerStyle = {
  minHeight: "100vh",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  display: "flex", flexDirection: "column",
  overflowX: "hidden",
};

const tabsContainerStyle = {
  display: "flex",
  width: "100%",
  flexWrap: "nowrap",
  background: "var(--usol-n-card-bg)",
  borderBottom: "1px solid var(--usol-n-border)",
  overflowX: "hidden",
  overflowY: "hidden",
  position: "sticky", top: 0, zIndex: 9,
  flexShrink: 0,
};

const tabButtonStyle = {
  flex: 1,
  flexShrink: 1,
  minWidth: 0,
  padding: "12px 4px",
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  color: "var(--text-secondary)",
  fontSize: 11, fontWeight: 500,
  cursor: "pointer",
  marginBottom: -1,
  whiteSpace: "nowrap",
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontFamily: "inherit",
};

const activeTabStyle = {
  color: "#03C75A",
  borderBottomColor: "#03C75A",
  fontWeight: 700,
};

const tabContentStyle = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: 16, paddingBottom: 40,
  background: "var(--usol-n-content-bg)",
};

const emptyStyle = {
  padding: 60, textAlign: "center",
  color: "var(--text-secondary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  fontSize: 13,
};

export default UsolNScreen;
