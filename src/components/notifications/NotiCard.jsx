// V14 알림 카드 (사장님 spec)
// 2026-06-08 — 중립 회색 박스 + 색은 아이콘만 + 우측 시간/날짜 2단 + 안 읽음 점·투명도.
// 안 읽음 = opacity 1 + 시간 옆 점
// 읽음    = opacity 0.6
// 본문은 아이콘 박스 자리만큼 들여쓰기 (paddingLeft 46)

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

// 2026-06-08 — 제목 앞 이모지 제거. Unicode 이모지 + 변형 셀렉터 + 좌우 공백.
function stripLeadingEmoji(title) {
  if (!title) return "";
  return String(title)
    .replace(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}️‍]+\s*)+/u, "")
    .trim();
}

// KST 시간(HH:mm) + 날짜(M/D) 분리 — 우측 2단 표시.
function formatKstParts(createdAt) {
  if (!createdAt) return { time: "", date: "" };
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (isNaN(d.getTime())) return { time: "", date: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (k) => parts.find(p => p.type === k)?.value || "";
  return {
    time: `${get("hour")}:${get("minute")}`,
    date: `${get("month")}/${get("day")}`,
  };
}

function detectDark() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dark";
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

  // 2026-06-08 — 중립 회색 박스 (cat.cardBg 색조 제거). 라이트=#FAFAFA, 다크=#1C1C1E.
  const cardBg     = isDark ? "#1C1C1E" : "#FAFAFA";
  const cardBorder = isDark ? "#2A2A2A" : "#EFE9E0";
  const iconBoxBg  = isDark ? "#252528" : "#F0EDE7";   // 중립 회색 박스
  const iconColor  = cat.color || (isDark ? "#9CA3AF" : "#6B7280");

  const titleColor = isDark ? "#FAF8F5" : "#1A1A1A";
  const bodyColor  = isDark ? "#FAF8F5" : "#1A1A1A";
  const timeColor  = noti.urgent
    ? (isDark ? "#FFD66B" : "#B07E00")
    : (isDark ? "#999" : "#6E6E6E");

  const cleanTitle = stripLeadingEmoji(noti.title);
  const { time, date } = formatKstParts(noti.createdAt);

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
      opacity: isUnread ? 1 : 0.6,
      fontFamily: "inherit",
    }}>
      {/* 헤더: 아이콘 박스 + 제목 (왼쪽) + 시간/날짜 2단 (오른쪽) */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: iconBoxBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: iconColor,
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
            {cleanTitle}
          </div>
          {noti.urgent && (
            <div style={{ fontSize: 11, color: timeColor, fontWeight: 700, marginTop: 1 }}>
              응답 필요
            </div>
          )}
        </div>
        {/* 우측 시각 2단 — 시간(위) / 날짜(아래). 안 읽음 점은 시간 옆. */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "flex-end",
          flexShrink: 0, gap: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {isUnread && (
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: cat.barColor || "#FF1B8D",
                flexShrink: 0,
              }} aria-label="안 읽음"/>
            )}
            <span style={{ fontSize: 12, color: timeColor, fontWeight: 700 }}>
              {time}
            </span>
          </div>
          {date && (
            <span style={{ fontSize: 10, color: timeColor, fontWeight: 500 }}>
              {date}
            </span>
          )}
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
