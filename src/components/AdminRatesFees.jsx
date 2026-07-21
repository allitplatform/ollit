// 2026-07-21 — "단가 · 수수료" 통합 화면 (사장님 승인 시안).
//   옛 메뉴 2개 (원청 단가 ratesManagement / 원청 수수료 정책 commissionPolicy) → 한 화면 3탭.
//   · 탭1 단가표: RatesManagementScreen 재사용 (embedded — 저장 방식·로직 무변경. 쿨가이·에어컨프로 단가 기준).
//   · 탭2 정책 목록: CommissionPolicyScreen 재사용 (Supabase 정책 조회 — 정산 엔진이 실제 쓰는 데이터).
//   · 탭3 계산기: CommissionCalculator 재사용.
//   ⚠️ 수수료·정산 계산에 닿는 로직은 없음 — 기존 컴포넌트 배치만 바꾼 컨테이너.
//   권한: admin / owner / operator (옛 CommissionPolicyManagement 기준 그대로).
import { useState } from "react";
import { RatesManagementScreen } from "./RatesManagementScreen.jsx";
import { CommissionPolicyScreen } from "./admin/CommissionPolicyScreen.jsx";
import { CommissionCalculator } from "./admin/CommissionCalculator.jsx";

const ALLOWED_ROLES = new Set(["admin", "owner", "operator"]);

const TABS = [
  { id: "rates", label: "📏 단가표" },
  { id: "list",  label: "📋 정책 목록" },
  { id: "calc",  label: "🧮 계산기" },
];

export function AdminRatesFees({ user, onBack, initialTab = "rates" }) {
  const [activeTab, setActiveTab] = useState(
    TABS.some(t => t.id === initialTab) ? initialTab : "rates"
  );

  const role = user?.dbRole || user?.role || "";
  if (!ALLOWED_ROLES.has(role)) {
    return (
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif" }}>
        <div style={headerStyle}>
          <button onClick={onBack} style={backBtnStyle}>←</button>
          <div style={titleStyle}>단가 · 수수료</div>
          <div style={{ width: 40 }}/>
        </div>
        <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
          접근 권한이 없습니다 (현재 역할: {role || "—"})
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif" }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>단가 · 수수료</div>
        <div style={{ width: 40 }}/>
      </div>

      {/* 탭 바 */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 49, background: "var(--bg-primary)", zIndex: 9,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "12px 16px",
            background: "transparent", border: "none",
            borderBottom: activeTab === t.id ? "2px solid var(--accent, #FF1B8D)" : "2px solid transparent",
            color: activeTab === t.id ? "var(--accent, #FF1B8D)" : "var(--text-secondary)",
            fontSize: 12.5, fontWeight: activeTab === t.id ? 800 : 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>{t.label}</button>
        ))}
      </div>

      {/* 탭별 안내 한 줄 */}
      {activeTab === "rates" && (
        <div style={{
          margin: "14px 16px 0", padding: "10px 13px", borderRadius: 9,
          background: "var(--accent-bg, rgba(255,27,141,0.08))",
          border: "1px solid rgba(255,27,141,0.25)",
          fontSize: 11, lineHeight: 1.6,
        }}>
          📏 <b>쿨가이 · 에어컨프로</b> 단가 기준 — 위 = 프로(기사) 단가, 아래 = 쿨가이 고객 표시가.
        </div>
      )}
      {activeTab === "list" && (
        <div style={{
          margin: "14px 16px 0", padding: "10px 13px", borderRadius: 9,
          background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.30)",
          fontSize: 11, lineHeight: 1.6,
        }}>
          📋 정산 엔진이 실제 사용하는 DB 정책 (조회 전용 — 수정은 신중히).
        </div>
      )}

      <div>
        {activeTab === "rates" && <RatesManagementScreen embedded/>}
        {activeTab === "list"  && <CommissionPolicyScreen/>}
        {activeTab === "calc"  && <CommissionCalculator/>}
      </div>
    </div>
  );
}

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 700 };

export default AdminRatesFees;
