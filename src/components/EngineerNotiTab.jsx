// 알림 통합 — 기사 PWA 알림 탭
// NotiScreen 재사용 (운영자와 동일 컨셉)

import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { NotiScreen } from "./notifications/NotiScreen.jsx";

export function EngineerNotiTab({
  notifications = [],
  onClickNoti,
  onMarkAllRead,
  onTabChange,
}) {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ paddingBottom: 80 }}>
      <NotiScreen
        title="🔔 알림"
        notifications={notifications}
        onMarkAllRead={onMarkAllRead}
        onCardClick={onClickNoti}
      />
      <EngineerBottomNav active="noti" onChange={onTabChange} unreadCount={unreadCount}/>
    </div>
  );
}

export default EngineerNotiTab;
