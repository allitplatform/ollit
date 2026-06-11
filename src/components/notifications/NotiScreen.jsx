// V14 — 알림 화면 (사장님 spec)
// 헤더 24/700 / 카테고리 탭 (전체/배정/일정/메시지/정산) / 날짜 그룹 (오늘/어제/이전)

import { useState, useMemo } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { NotiCard } from "./NotiCard.jsx";
import { getNotiGroup, NOTI_CATEGORIES } from "./notiCategories.js";
// 2026-06-11 — PC 분기 (1024+).
import { useIsPc } from "../../utils/useIsPc.js";

const TAB_DEFS = [
  { id: "all",        label: "전체"   },
  { id: "assignment", label: "배정"   },
  { id: "schedule",   label: "일정"   },
  { id: "message",    label: "메시지" },
  { id: "payment",    label: "정산"   },
];

export function NotiScreen({ notifications, onMarkAllRead, onCardClick, onMarkRead, title = "🔔 알림" }) {
  const isPc = useIsPc();
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

  // 2026-06-11 — PC 분기 (모바일 옛 흐름 그대로).
  if (isPc) {
    return (
      <ViewPcNoti
        title={title}
        notifications={notifications}
        unreadCount={unreadCount}
        counts={counts}
        tab={tab}
        setTab={setTab}
        filtered={filtered}
        onMarkAllRead={onMarkAllRead}
        onCardClick={onCardClick}
        onMarkRead={onMarkRead}
      />
    );
  }

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

// ============================================================
// 2026-06-11 — PC 알림 화면 (2단 그리드 — 사장님 spec).
//   상단: 필터 칩 + 우측 "안 읽음 N · 모두 읽음".
//   좌(1.1fr): 알림 리스트 카드. 선택 시 핑크 배경 + 좌측 바.
//   우(1fr): 선택 알림 상세 + "작업 상세 보기" 버튼.
//   클릭 → 우측 교체 + 읽음 처리 (화면 전환 X).
//   "작업 상세 보기" → onCardClick(goTaskDetail) → PcShell aside.
// ============================================================
function ViewPcNoti({
  title, notifications,
  unreadCount, counts, tab, setTab, filtered,
  onMarkAllRead, onCardClick, onMarkRead,
}) {
  const [selectedId, setSelectedId] = useState(null);

  // selected — id 매칭. 필터링되어 사라진 경우 null fallback.
  const selectedNoti = useMemo(
    () => filtered.find(n => n.id === selectedId) || null,
    [filtered, selectedId]
  );

  // 일자 라벨 (그룹 헤더용).
  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* 상단 — 헤더 + 필터 칩 + 안 읽음 + 모두 읽음 */}
      <div style={{
        padding: "18px 24px 14px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px" }}>{title}</div>
          <span style={{ flex: 1 }}/>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700 }}>
            안 읽음 {unreadCount}건 · 7일 보관
          </div>
          <button onClick={onMarkAllRead} style={{
            padding: "8px 14px",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            fontSize: 12, fontWeight: 700,
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}>모두 읽음</button>
        </div>
        {/* 필터 칩 */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {TAB_DEFS.map(td => (
            <PcCategoryTab
              key={td.id}
              label={td.label}
              count={counts[td.id]}
              active={tab === td.id}
              onClick={() => { setTab(td.id); setSelectedId(null); }}
            />
          ))}
        </div>
      </div>

      {/* 2단 그리드 — 좌 리스트 + 우 상세 */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
        gap: 0,
        minHeight: 0,
      }}>
        {/* 좌 — 리스트 (세로 스크롤) */}
        <div style={{
          overflowY: "auto",
          borderRight: "1px solid var(--border)",
          padding: "12px 0",
        }}>
          {filtered.length === 0 ? (
            <PcNotiEmpty/>
          ) : (
            grouped.map(group => (
              <div key={group.label}>
                <div style={{
                  padding: "8px 24px 6px",
                  fontSize: 12, fontWeight: 700,
                  color: "var(--text-secondary)",
                  letterSpacing: 0.3,
                }}>{group.label}</div>
                {group.items.map(noti => (
                  <PcNotiListItem
                    key={noti.id}
                    noti={noti}
                    isSelected={selectedId === noti.id}
                    onClick={() => {
                      setSelectedId(noti.id);
                      if (!noti.read) onMarkRead?.(noti);
                    }}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {/* 우 — 선택 알림 상세 */}
        <div style={{
          overflowY: "auto",
          padding: "20px 24px",
        }}>
          {selectedNoti ? (
            <PcNotiDetail
              noti={selectedNoti}
              onOpenTask={() => onCardClick?.(selectedNoti)}
            />
          ) : (
            <PcNotiPlaceholder/>
          )}
        </div>
      </div>
    </div>
  );
}

function PcCategoryTab({ label, count, active, onClick }) {
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
        <span style={{ fontSize: 11, fontWeight: 700, opacity: active ? 0.85 : 0.7 }}>{count}</span>
      )}
    </button>
  );
}

function PcNotiListItem({ noti, isSelected, onClick }) {
  const lookupKey = noti.type || noti.category;
  const cat = NOTI_CATEGORIES[lookupKey] || NOTI_CATEGORIES[(lookupKey || "").toUpperCase()] || null;
  const tagColor = cat?.color || "#9CA3AF";
  const tagBg = `${tagColor}1F`; // 12% alpha (hex 1F).
  const tagLabel = cat?.label || "알림";
  const isUnread = !noti.read;

  // 시각.
  const time = formatPcTime(noti.createdAt);

  return (
    <div
      onClick={onClick}
      style={{
        margin: "0 12px 4px",
        padding: "12px 14px 12px 11px",
        background: isSelected ? "rgba(255, 27, 141, 0.10)" : "transparent",
        borderLeft: `3px solid ${isSelected ? "#FF1B8D" : "transparent"}`,
        borderRadius: 10,
        cursor: "pointer",
        opacity: isUnread ? 1 : 0.55,
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      {/* 1줄: 태그 + 제목 + 안 읽음 점 + 시간 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 800,
          padding: "2px 8px",
          borderRadius: 5,
          background: tagBg,
          color: tagColor,
          letterSpacing: 0.2,
          flexShrink: 0,
        }}>{tagLabel}</span>
        <span style={{
          flex: 1,
          fontSize: 14, fontWeight: 700,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{stripLeadingEmoji(noti.title || "")}</span>
        {isUnread && (
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#FF1B8D", flexShrink: 0,
          }} aria-label="안 읽음"/>
        )}
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: "var(--text-secondary)",
          flexShrink: 0,
        }}>{time}</span>
      </div>
      {/* 2줄: 본문 */}
      {(noti.subtitle || noti.body) && (
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: "var(--text-secondary)",
          paddingLeft: 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>{noti.subtitle || noti.body}</div>
      )}
    </div>
  );
}

function PcNotiDetail({ noti, onOpenTask }) {
  const lookupKey = noti.type || noti.category;
  const cat = NOTI_CATEGORIES[lookupKey] || NOTI_CATEGORIES[(lookupKey || "").toUpperCase()] || null;
  const tagColor = cat?.color || "#9CA3AF";
  const tagBg = `${tagColor}1F`;
  const tagLabel = cat?.label || "알림";
  const time = formatPcDateTime(noti.createdAt);
  const cleanTitle = stripLeadingEmoji(noti.title || "");
  const hasRelated = !!noti.relatedId;

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      {/* 태그 + 시간 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 12, fontWeight: 800,
          padding: "3px 10px",
          borderRadius: 6,
          background: tagBg,
          color: tagColor,
          letterSpacing: 0.2,
        }}>{tagLabel}</span>
        <span style={{ flex: 1 }}/>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{time}</span>
      </div>
      {/* 제목 */}
      <div style={{
        fontSize: 18, fontWeight: 800,
        color: "var(--text-primary)",
        lineHeight: 1.3,
      }}>{cleanTitle || "—"}</div>
      {/* 본문 */}
      {(noti.subtitle || noti.body) && (
        <div style={{
          fontSize: 14, fontWeight: 500,
          color: "var(--text-primary)",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}>{noti.subtitle || noti.body}</div>
      )}
      {/* 메타 — 작업번호 (relatedId) */}
      {noti.relatedId && (
        <div style={{
          marginTop: 4,
          padding: "10px 14px",
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>작업 ID</span>
          <span className="mono" style={{
            fontSize: 12, fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}>{noti.relatedId}</span>
        </div>
      )}
      {/* "작업 상세 보기" 버튼 */}
      {hasRelated && (
        <button
          type="button"
          onClick={onOpenTask}
          style={{
            marginTop: 6,
            padding: "12px 18px",
            background: "#FF1B8D",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14, fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          작업 상세 보기 <ChevronRight size={16}/>
        </button>
      )}
    </div>
  );
}

function PcNotiPlaceholder() {
  return (
    <div style={{
      padding: "80px 20px",
      textAlign: "center",
      color: "var(--text-secondary)",
    }}>
      <Bell size={42} style={{ opacity: 0.5, margin: "0 auto 14px" }}/>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
        알림을 선택하세요
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        좌측 리스트에서 알림을 클릭하면 상세가 표시됩니다
      </div>
    </div>
  );
}

function PcNotiEmpty() {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <Bell size={42} style={{ color: "var(--text-secondary)", opacity: 0.5, margin: "0 auto 14px" }}/>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
        알림이 없어요
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        새 알림이 도착하면 여기에 표시됩니다
      </div>
    </div>
  );
}

// 이모지 제거 (NotiCard 측 동일 로직).
function stripLeadingEmoji(title) {
  if (!title) return "";
  return String(title)
    .replace(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}️‍]+\s*)+/u, "")
    .trim();
}

// 시각 — 오늘은 HH:MM / 그 외는 M/D HH:MM.
function formatPcTime(createdAt) {
  if (!createdAt) return "";
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (k) => parts.find(p => p.type === k)?.value || "";
  const todayD = new Date();
  const isSameDay = d.toDateString() === todayD.toDateString();
  return isSameDay
    ? `${get("hour")}:${get("minute")}`
    : `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

// 상세용 — YYYY-MM-DD HH:MM (KST).
function formatPcDateTime(createdAt) {
  if (!createdAt) return "";
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (k) => parts.find(p => p.type === k)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
