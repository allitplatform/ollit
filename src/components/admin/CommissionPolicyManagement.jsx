// Phase 2 — 수수료정책 관리 통합 컴포넌트
// 내부 탭 2개 (정책 목록 / 계산기) + 권한 체크 (admin / owner / operator)
// 진입: SettingsScreen "수수료정책 관리" 메뉴 → AdminApp screen === "commissionPolicy"
// 디자인 — 원청관리(PrincipalListScreen) 스타일 통일 (CSS 변수 박은 영역)

import { useState } from "react";
import { CommissionPolicyScreen } from "./CommissionPolicyScreen.jsx";
import { CommissionCalculator } from "./CommissionCalculator.jsx";

const ALLOWED_ROLES = new Set(["admin", "owner", "operator"]);

export function CommissionPolicyManagement({ user, onBack }) {
  const [activeTab, setActiveTab] = useState("list");

  // 권한 체크 — admin / owner / operator 박은 영역 박을 영역
  const role = user?.dbRole || user?.role || "";
  if (!ALLOWED_ROLES.has(role)) {
    return <PermissionDeniedView onBack={onBack} role={role} />;
  }

  return (
    <div style={containerStyle}>
      {/* 헤더 — sticky */}
      <div style={headerStyle}>
        {onBack && (
          <button type="button" onClick={onBack} style={backBtnStyle}>←</button>
        )}
        <div style={titleStyle}>수수료정책 관리</div>
        <div style={{ width: 40 }}/>
      </div>

      {/* 탭 */}
      <div style={tabBarStyle}>
        <TabButton active={activeTab === "list"} onClick={() => setActiveTab("list")}>
          📋 정책 목록
        </TabButton>
        <TabButton active={activeTab === "calc"} onClick={() => setActiveTab("calc")}>
          🧮 계산기
        </TabButton>
      </div>

      {/* 콘텐츠 */}
      <div>
        {activeTab === "list" && <CommissionPolicyScreen />}
        {activeTab === "calc" && <CommissionCalculator />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        color: active ? "#FF1B8D" : "var(--text-secondary)",
        borderBottom: active ? "2px solid #FF1B8D" : "2px solid transparent",
        padding: "12px 20px",
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
        marginBottom: -1,
      }}
    >{children}</button>
  );
}

function PermissionDeniedView({ onBack, role }) {
  return (
    <div style={{
      ...containerStyle,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
        권한 없음
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
        admin / owner / operator 만 박은 영역
      </div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 24 }}>
        현재 role: {role || "(없음)"}
      </div>
      {onBack && (
        <button type="button" onClick={onBack} style={pinkBtnStyle}>← 뒤로</button>
      )}
    </div>
  );
}

// ============= 스타일 =============
const containerStyle = {
  background: "var(--bg-primary)",
  minHeight: "100vh",
  color: "var(--text-primary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  paddingBottom: 80,
};
const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0,
  background: "var(--bg-primary)",
  zIndex: 10,
};
const backBtnStyle = {
  background: "none", border: "none",
  color: "var(--text-primary)", fontSize: 18,
  cursor: "pointer", padding: 4,
};
const titleStyle = { fontSize: 15, fontWeight: 500 };
const tabBarStyle = {
  display: "flex",
  padding: "8px 16px 0",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-primary)",
  position: "sticky",
  top: 49,
  zIndex: 9,
};
const pinkBtnStyle = {
  background: "#FF1B8D", border: "none", color: "#FFF",
  borderRadius: 10, padding: "12px 24px",
  fontSize: 14, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
};
