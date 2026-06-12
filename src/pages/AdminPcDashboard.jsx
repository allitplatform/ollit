// 2026-06-12 — AdminApp PC 대시보드 (1024px+).
//   1단계: placeholder. 현재는 mount 안 됨 — AdminApp main screen 진입 시 기존 DashboardScreen 그대로 사용.
//   다음 단계: 본 컴포넌트로 교체 + 패널 grid 구성:
//     · 오늘 모니터 (LiveWorkContent 압축)
//     · 미배정 + 빠른 배정
//     · 기사 현황 (오늘 배정/진행/완료/오프)
//     · 정산 대기 요약
//     · 유솔N + 알림
//     · 매출 박스

export function AdminPcDashboard({ t }) {
  return (
    <div style={{
      padding: "24px 32px",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      <div style={{
        fontSize: 22, fontWeight: 800,
        color: "var(--text-primary)",
        letterSpacing: "-0.4px",
        marginBottom: 8,
      }}>대시보드</div>
      <div style={{
        padding: "60px 40px",
        textAlign: "center",
        background: "var(--bg-elevated)",
        border: "1px dashed var(--border)",
        borderRadius: 16,
        color: "var(--text-secondary)",
        fontSize: 13, fontWeight: 600,
      }}>
        🚧 다음 단계 — 패널 grid: 오늘 모니터 / 미배정 / 기사 현황 / 정산 대기 / 유솔N+알림 / 매출
      </div>
    </div>
  );
}

export default AdminPcDashboard;
