// V13-FINAL2 — 기사 PWA 하단 네비 (5탭)
// 오늘 / 정산 / 캘린더 / 알림 (배지) / 내 정보

const TABS = [
  { id: "today",   label: "오늘",     icon: "🏠" },
  { id: "settle",  label: "정산",     icon: "💰" },
  { id: "cal",     label: "캘린더",   icon: "📅" },
  { id: "noti",    label: "알림",     icon: "🔔" },
  { id: "me",      label: "내 정보",  icon: "👤" },
];

export function EngineerBottomNav({ active, onChange, unreadCount = 0 }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      maxWidth: 420, margin: "0 auto",
      background: "var(--bg-primary)",
      borderTop: "1px solid var(--border)",
      display: "flex", justifyContent: "space-around",
      padding: "8px 4px 16px",
      zIndex: 100,
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange && onChange(tab.id)}
            style={{
              flex: 1, padding: "6px 4px",
              background: "transparent", border: "none",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 2,
              color: isActive ? "#FF1B8D" : "var(--text-secondary)",
              position: "relative",
            }}
          >
            <div style={{ position: "relative", fontSize: 18 }}>
              {tab.icon}
              {tab.id === "noti" && unreadCount > 0 && (
                <div style={{
                  position: "absolute", top: -4, right: -8,
                  minWidth: 14, height: 14, borderRadius: 7,
                  background: "#FF1B8D",
                  fontSize: 8, fontWeight: 700, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px",
                }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </div>
              )}
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default EngineerBottomNav;
