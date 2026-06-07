// V14 알림 카드 (사장님 spec)
// 안 읽음 = 컬러 박스 + 좌측 4px 바 + 우측 상단 점
// 읽음    = 흰 카드 + 회색 좌측 바 + opacity 0.75
// 본문은 아이콘 박스 자리만큼 들여쓰기 (paddingLeft 46)
// 2026-06-08 — 종류별 아이콘 (lucide 20px) + 받은 시각 (KST "M/D HH:mm").

import { useEffect, useState } from "react";
import {
  Inbox, ClipboardCheck, Lock, CalendarClock, XCircle,
  RefreshCw, CheckCircle2, Bell, PlayCircle, ThumbsUp,
} from "lucide-react";
import { NOTI_CATEGORIES } from "./notiCategories.js";

// 사장님 spec — title → lucide 아이콘. send.js inferKindFromTitle 동일 패턴.
const ICON_FALLBACK = Bell;
function pickIconFromTitle(title) {
  if (!title) return ICON_FALLBACK;
  const s = String(title);
  if (s.includes("새 접수") || s.includes("신규 냉매"))          return Inbox;
  if (s.includes("작업 배정") || s.includes("냉매 작업 배정"))   return ClipboardCheck;
  if (s.includes("재배정"))                                       return RefreshCw;
  if (s.includes("수락 마감"))                                    return Lock;
  if (s.includes("일정 변경") || s.includes("일정 확정"))         return CalendarClock;
  if (s.includes("작업 시작"))                                    return PlayCircle;
  if (s.includes("기사 수락"))                                    return ThumbsUp;
  if (s.includes("작업 취소") || s.includes("취소되었습니다"))    return XCircle;
  if (s.includes("입금"))                                          return CheckCircle2;
  return ICON_FALLBACK;
}

// KST 변환 — "M/D HH:mm" (예: "6/7 14:30")
function formatKstShort(createdAt) {
  if (!createdAt) return "";
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (k) => parts.find(p => p.type === k)?.value || "";
  const M = get("month"), D = get("day"), H = get("hour"), m = get("minute");
  return `${M}/${D} ${H}:${m}`;
}

function detectDark() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dark";
}

function pickThemed(value, isDark) {
  if (value == null) return "transparent";
  if (typeof value === "string") return value;
  return isDark ? value.dark : value.light;
}

export function NotiCard({ noti, onClick }) {
  const [isDark, setIsDark] = useState(() => detectDark());

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(detectDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, []);

  const lookupKey = noti.type || noti.category;
  const cat = NOTI_CATEGORIES[lookupKey] || NOTI_CATEGORIES[(lookupKey || "").toUpperCase()];
  if (!cat) return null;

  const isUnread = !noti.read;

  // 안 읽음 = 컬러 박스 / 읽음 = 흰 카드 (라이트) 또는 #1C1C1E (다크)
  const cardBg = isUnread
    ? pickThemed(cat.cardBg, isDark)
    : (isDark ? "#1C1C1E" : "#FFFFFF");

  // 2026-06-08 — 좌측 색 띠 제거 (아이콘에 색 있어서 중복). barColor 사용 안 함.

  const cardBorder = isUnread
    ? pickThemed(cat.cardBorder, isDark)
    : (isDark ? "#2A2A2A" : "#EFE9E0");

  const iconBoxBg = pickThemed(cat.iconBoxBg, isDark);

  const titleColor = isUnread
    ? (isDark ? "#FAF8F5" : "#1A1A1A")
    : (isDark ? "#C8C8C8" : "#555");

  const bodyColor = isUnread
    ? (isDark ? "#FAF8F5" : "#1A1A1A")
    : (isDark ? "#C8C8C8" : "#555");

  const timeColor = noti.urgent
    ? (isDark ? "#FFD66B" : "#B07E00")
    : (isDark ? "#999" : "#6E6E6E");

  return (
    <div onClick={onClick} style={{
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 14,
      padding: "14px 14px",
      position: "relative",
      overflow: "hidden",
      margin: "0 16px 8px",
      cursor: "pointer",
      opacity: isUnread ? 1 : 0.75,
      fontFamily: "inherit",
    }}>
      {/* 2026-06-08 — 좌측 색 띠 제거 (아이콘 색과 중복). 색은 아이콘 + 배경만. */}

      {/* 안 읽음 점 (우측 상단) */}
      {isUnread && (
        <div style={{
          position: "absolute",
          right: 14, top: 16,
          width: 8, height: 8,
          borderRadius: "50%",
          background: cat.barColor,
        }}/>
      )}

      {/* 헤더: 아이콘 박스 + 제목 + 시간 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, paddingRight: isUnread ? 22 : 0 }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: iconBoxBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: cat.color,
        }}>
          {(() => {
            const Icon = pickIconFromTitle(noti.title);
            return <Icon size={20} aria-hidden="true"/>;
          })()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            color: titleColor,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {noti.title}
          </div>
          <div style={{
            fontSize: 12,
            color: timeColor,
            fontWeight: noti.urgent ? 700 : 600,
            marginTop: 1,
          }}>
            {formatKstShort(noti.createdAt) || noti.timeAgo || ""}
            {noti.urgent ? " · 응답 필요" : ""}
          </div>
        </div>
      </div>

      {/* 본문 (왼쪽 들여쓰기 = 아이콘 박스 자리만큼) */}
      {(noti.subtitle || noti.body) && (
        <div style={{
          fontSize: 13,
          color: bodyColor,
          paddingLeft: 46,
          fontWeight: 600,
          lineHeight: 1.5,
        }}>
          {noti.subtitle || noti.body}
        </div>
      )}
    </div>
  );
}

export default NotiCard;
