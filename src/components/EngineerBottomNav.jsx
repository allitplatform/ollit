// V13-FINAL2 — 기사 PWA 하단 네비
// 2026-06-26 v2 — 6탭 — "공지" 탭 제거 → "메시지" 탭 신설 (작업별 운영자 메시지).
//   공지는 내정보 메뉴 안으로 이동. 메시지가 더 자주 + 즉시성 높음 → 빈도순 배치.
//   공지 팝업(앱 진입 자동 모달)은 탭과 무관하게 그대로 작동.

const TABS = [
  { id: "today",    label: "오늘",     icon: "🏠" },
  { id: "settle",   label: "정산",     icon: "💰" },
  { id: "cal",      label: "캘린더",   icon: "📅" },
  { id: "noti",     label: "알림",     icon: "🔔" },
  { id: "message",  label: "메시지",   icon: "💬" },
  { id: "me",       label: "내 정보",  icon: "👤" },
];

// messageCount = 메시지 탭 뱃지 (안 읽은 task_messages 개수).
export function EngineerBottomNav({ active, onChange, unreadCount = 0, messageCount = 0 }) {
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
              {tab.id === "message" && messageCount > 0 && (
                <div style={{
                  position: "absolute", top: -4, right: -8,
                  minWidth: 14, height: 14, borderRadius: 7,
                  background: "#FF1B8D",
                  fontSize: 8, fontWeight: 700, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px",
                }}>
                  {messageCount > 99 ? "99+" : messageCount}
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
