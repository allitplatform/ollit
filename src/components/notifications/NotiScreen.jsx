// V14 — 알림 화면 (사장님 spec)
// 헤더 24/700 / 카테고리 탭 (전체/배정/일정/메시지/정산) / 날짜 그룹 (오늘/어제/이전)

import { useState, useMemo } from "react";
import { Bell } from "lucide-react";
import { NotiCard } from "./NotiCard.jsx";
import { getNotiGroup } from "./notiCategories.js";

const TAB_DEFS = [
  { id: "all",        label: "전체"   },
  { id: "assignment", label: "배정"   },
  { id: "schedule",   label: "일정"   },
  { id: "message",    label: "메시지" },
  { id: "payment",    label: "정산"   },
];

export function NotiScreen({ notifications, onMarkAllRead, onCardClick, title = "🔔 알림" }) {
  const [tab, setTab] = useState("all");

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  // 카테고리별 카운트
  const counts = useMemo(() => {
    const c = { all: notifications.length, assignment: 0, schedule: 0, message: 0, payment: 0 };
    for (const n of notifications) {
      const g = getNotiGroup(n.type || n.category);
      if (c[g] != null) c[g]++;
    }
    return c;
  }, [notifications]);

  const filtered = useMemo(() => {
    if (tab === "all") return notifications;
    return notifications.filter(n => getNotiGroup(n.type || n.category) === tab);
  }, [notifications, tab]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        padding: "18px 20px 14px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px" }}>{title}</div>
          <div style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            fontWeight: 600,
            marginTop: 4,
          }}>
            안 읽음 {unreadCount}건 · 7일 보관
          </div>
        </div>
        <button onClick={onMarkAllRead} style={{
          padding: "9px 13px",
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 11,
          fontSize: 12, fontWeight: 700,
          color: "var(--text-secondary)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}>
          모두 읽음
        </button>
      </div>

      {/* 카테고리 탭 (수평 스크롤 알약) */}
      <div style={{
        padding: "12px 16px",
        display: "flex", gap: 6,
        overflowX: "auto",
        borderBottom: "1px solid var(--border)",
      }}>
        {TAB_DEFS.map(t => (
          <CategoryTab
            key={t.id}
            label={t.label}
            count={counts[t.id]}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
          />
        ))}
      </div>

      {/* 알림 리스트 */}
      <div style={{ paddingTop: 12 }}>
        {grouped.map(group => (
          <div key={group.label}>
            <div style={{
              padding: "8px 20px 6px",
              fontSize: 12, fontWeight: 700,
              color: "var(--text-secondary)",
              letterSpacing: 0.3,
            }}>
              {group.label}
            </div>
            {group.items.map(noti => (
              <NotiCard key={noti.id} noti={noti} onClick={() => onCardClick && onCardClick(noti)}/>
            ))}
          </div>
        ))}
      </div>

      {/* Step 5-7-B — 알림 0건 fallback UI (Bell 아이콘 + 친절 메시지) */}
      {filtered.length === 0 && (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <Bell size={48} style={{ color: "var(--text-secondary)", opacity: 0.5, margin: "0 auto 16px" }}/>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
            알림이 없어요
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            새 알림이 도착하면 여기에 표시됩니다
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryTab({ label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px",
      background: active ? "#FF1B8D" : "transparent",
      border: active ? "1px solid #FF1B8D" : "1px solid var(--border)",
      borderRadius: 18,
      color: active ? "#fff" : "var(--text-secondary)",
      fontSize: 13, fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
      whiteSpace: "nowrap",
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
    }}>
      <span>{label}</span>
      {count > 0 && (
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          opacity: active ? 0.85 : 0.7,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function groupByDay(notifications) {
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const groups = {
    today:     { label: "오늘",  items: [] },
    yesterday: { label: "어제",  items: [] },
    earlier:   { label: "이전",  items: [] },
  };

  for (const noti of notifications) {
    const day = new Date(noti.createdAt).toDateString();
    if (day === today)          groups.today.items.push(noti);
    else if (day === yesterday) groups.yesterday.items.push(noti);
    else                        groups.earlier.items.push(noti);
  }

  return Object.values(groups).filter(g => g.items.length > 0);
}
