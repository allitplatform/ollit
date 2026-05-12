// Phase 2 — 수수료정책 관리 통합 컴포넌트
// 내부 탭 2개 (정책 목록 / 계산기) + 권한 체크 (admin / owner / operator)
// 진입: SettingsScreen "수수료정책 관리" 메뉴 → AdminApp screen === "commissionPolicy"

import { useState } from "react";
import { CommissionPolicyScreen } from "./CommissionPolicyScreen.jsx";
import { CommissionCalculator } from "./CommissionCalculator.jsx";

const ALLOWED_ROLES = new Set(["admin", "owner", "operator"]);

export function CommissionPolicyManagement({ user, onBack }) {
  const [activeTab, setActiveTab] = useState("list");

  // 권한 체크 — admin / owner / operator 박은 영역 박을 영역
  // user.role 박은 영역 박은 영역 박은 영역 (LoginScreen 박은 영역 박은 영역) — DB role 박은 영역 박은 영역 박을 영역 박을 영역
  // 옛 시범 빠른 로그인 박은 영역 박은 영역 dbRole 박지 X 박혀있어 박힘 박을 영역 → user.role 박은 영역 박을 영역
  const role = user?.dbRole || user?.role || "";
  if (!ALLOWED_ROLES.has(role)) {
    return <PermissionDeniedView onBack={onBack} role={role} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#FFF",
                  fontFamily: "-apple-system, 'Pretendard', sans-serif" }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: 16, borderBottom: "1px solid #2A2A2A",
      }}>
        {onBack && (
          <button onClick={onBack} style={btnGhost}>← 뒤로</button>
        )}
        <div style={{ fontSize: 20, fontWeight: 700 }}>수수료정책 관리</div>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 0, padding: "12px 16px 0",
                    borderBottom: "1px solid #2A2A2A" }}>
        <TabButton active={activeTab === "list"} onClick={() => setActiveTab("list")}>
          📋 정책 목록
        </TabButton>
        <TabButton active={activeTab === "calc"} onClick={() => setActiveTab("calc")}>
          🧮 계산기
        </TabButton>
      </div>

      {/* 콘텐츠 (옛 컴포넌트 박은 영역 박은 영역 박은 영역 박은 영역 — onBack 박지 X / 박힌 영역 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역) */}
      <div>
        {activeTab === "list" && <CommissionPolicyScreen />}
        {activeTab === "calc" && <CommissionCalculator />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent",
      border: "none",
      color: active ? "#FF1B8D" : "#888",
      borderBottom: active ? "2px solid #FF1B8D" : "2px solid transparent",
      padding: "10px 20px",
      fontSize: 14, fontWeight: active ? 700 : 500,
      cursor: "pointer",
      fontFamily: "inherit",
      marginBottom: -1,
    }}>{children}</button>
  );
}

function PermissionDeniedView({ onBack, role }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#0A0A0A", color: "#FFF",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "-apple-system, 'Pretendard', sans-serif",
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>권한 없음</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>
        admin / owner / operator 만 박은 영역
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 24 }}>
        현재 role: {role || "(없음)"}
      </div>
      {onBack && (
        <button onClick={onBack} style={{
          background: "#FF1B8D", border: "none", color: "#FFF",
          borderRadius: 10, padding: "12px 24px",
          fontSize: 14, fontWeight: 700, cursor: "pointer",
          fontFamily: "inherit",
        }}>← 뒤로</button>
      )}
    </div>
  );
}

const btnGhost = {
  background: "transparent",
  border: "1px solid #2A2A2A",
  color: "#FFF",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};
