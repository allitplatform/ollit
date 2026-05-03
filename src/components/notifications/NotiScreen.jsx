// src/components/notifications/NotiScreen.jsx
// 알림 화면 (기사 + 운영자 공통)

import { useState, useMemo } from "react";
import { NotiCard } from "./NotiCard.jsx";

export function NotiScreen({ notifications, onMarkAllRead, onCardClick, title = "🔔 알림" }) {
  const [filter, setFilter] = useState("all"); // all / unread / urgent

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  // 필터링
  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter(n => !n.read);
    if (filter === "urgent") return notifications.filter(n => n.category === "urgent");
    return notifications;
  }, [notifications, filter]);

  // 날짜별 그룹
  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
    }}>
      {/* 헤더 */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <div style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            marginTop: 2,
          }}>
            안 읽음 {unreadCount}건
          </div>
        </div>
        <button onClick={onMarkAllRead} style={{
          padding: "6px 10px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 11, fontWeight: 600,
          color: "var(--text-primary)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}>
          모두 읽음
        </button>
      </div>

      {/* 필터 */}
      <div style={{
        padding: "12px 16px",
        display: "flex", gap: 6,
        borderBottom: "1px solid var(--border)",
      }}>
        <FilterPill label="전체" active={filter === "all"} onClick={() => setFilter("all")}/>
        <FilterPill label="안 읽음" active={filter === "unread"} onClick={() => setFilter("unread")}/>
        <FilterPill label="긴급" active={filter === "urgent"} onClick={() => setFilter("urgent")}/>
      </div>

      {/* 알림 리스트 */}
      {grouped.map(group => (
        <div key={group.label}>
          <div style={{
            padding: "14px 16px 6px",
            fontSize: 11, fontWeight: 600,
            color: "var(--text-secondary)",
          }}>
            {group.label}
          </div>
          {group.items.map(noti => (
            <NotiCard key={noti.id} noti={noti} onClick={() => onCardClick && onCardClick(noti)}/>
          ))}
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{
          padding: 40, textAlign: "center",
          fontSize: 12, color: "var(--text-secondary)",
        }}>
          알림이 없습니다.
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px",
      background: active ? "#FF1B8D" : "transparent",
      border: active ? "1px solid #FF1B8D" : "1px solid var(--border)",
      borderRadius: 16,
      color: active ? "#fff" : "var(--text-secondary)",
      fontSize: 11, fontWeight: 600,
      cursor: "pointer",
      fontFamily: "inherit",
    }}>
      {label}
    </button>
  );
}

function groupByDay(notifications) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const groups = {
    today: { label: "오늘", items: [] },
    yesterday: { label: "어제", items: [] },
    earlier: { label: "이전", items: [] },
  };

  for (const noti of notifications) {
    const day = new Date(noti.createdAt).toDateString();
    if (day === today) groups.today.items.push(noti);
    else if (day === yesterday) groups.yesterday.items.push(noti);
    else groups.earlier.items.push(noti);
  }

  return Object.values(groups).filter(g => g.items.length > 0);
}
