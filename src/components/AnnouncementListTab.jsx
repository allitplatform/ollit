// 2026-06-26 — 기사 PWA 공지사항 탭 (📢).
//   진입: EngineerApp screen === "announcements" (BottomNav "공지" 탭).
//   동작:
//     · listAnnouncements() — RLS 가 발행+미삭제만 통과 (anon SELECT OK).
//     · 카드 표시 (제목 · 본문 · 작성일 · 핀 📌). 읽음 추적 X (단순 목록).
//     · 최근 7일 N개 가벼운 카운트 (선택 — Bottom Nav 뱃지 용).

import { useState, useEffect } from "react";
import { listAnnouncements } from "../lib/announcementsDb.js";
import { toKstYmd } from "../utils/dateLabel.js";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";

const ACCENT = "#FF1B8D";

// 최근 7일 공지 카운트 — Bottom Nav 뱃지 용. localStorage / 서버 추적 없음.
//   호출처: EngineerApp 가 별도 hook 으로 잡아도 OK. 컴포넌트 내장 export.
export function countRecentAnnouncements(items, days = 7) {
  if (!Array.isArray(items)) return 0;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter(it => {
    const t = it.published_at ? new Date(it.published_at).getTime() : 0;
    return t >= cutoff;
  }).length;
}

export function AnnouncementListTab({ onTabChange, unreadCount = 0 }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    listAnnouncements().then(res => {
      if (!alive) return;
      if (!res.ok) {
        setError(res.error || "불러오기 실패");
        setItems([]);
      } else {
        setItems(res.items);
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const recentN = countRecentAnnouncements(items, 7);

  return (
    <div style={containerStyle}>
      <Header recentN={recentN}/>
      <div style={bodyStyle}>
        {loading ? (
          <Empty>불러오는 중...</Empty>
        ) : error ? (
          <Empty>⚠️ {error}</Empty>
        ) : items.length === 0 ? (
          <Empty>등록된 공지가 없습니다</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(item => (
              <AnnouncementCard key={item.id} item={item}/>
            ))}
          </div>
        )}
      </div>
      <EngineerBottomNav
        active="announce"
        onChange={onTabChange}
        unreadCount={unreadCount}
        announceCount={recentN}
      />
    </div>
  );
}

function AnnouncementCard({ item }) {
  const dateLabel = toKstYmd(item.published_at || item.created_at) || "—";
  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: `1px solid ${item.is_pinned ? ACCENT : "var(--border)"}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 6,
      }}>
        {item.is_pinned && (
          <span style={{ fontSize: 13 }}>📌</span>
        )}
        <span style={{
          flex: 1, minWidth: 0,
          fontSize: 14, fontWeight: 800, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{item.title}</span>
      </div>
      {item.body && (
        <div style={{
          fontSize: 12, color: "var(--text-secondary)", fontWeight: 500,
          whiteSpace: "pre-wrap", marginBottom: 6,
          lineHeight: 1.55,
        }}>{item.body}</div>
      )}
      <div style={{
        fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))",
        fontWeight: 600,
      }}>{dateLabel}</div>
    </div>
  );
}

function Header({ recentN }) {
  return (
    <div style={{
      padding: "14px 16px",
      background: ACCENT,
      color: "#fff",
      flexShrink: 0,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.85)",
          marginBottom: 3, fontWeight: 500,
        }}>전체 공지</div>
        <div style={{
          fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px",
        }}>📢 공지사항</div>
      </div>
      {recentN > 0 && (
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>최근 7일</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{recentN}건</div>
        </div>
      )}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 12,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

const containerStyle = {
  minHeight: "100vh",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  display: "flex", flexDirection: "column",
  paddingBottom: 80, // BottomNav 높이 여유
  overflowX: "hidden",
};

const bodyStyle = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: 16,
  background: "var(--bg-secondary)",
};

export default AnnouncementListTab;
