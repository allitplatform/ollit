// V14 알림 카드 (사장님 spec)
// 안 읽음 = 컬러 박스 + 좌측 4px 바 + 우측 상단 점
// 읽음    = 흰 카드 + 회색 좌측 바 + opacity 0.75
// 본문은 아이콘 박스 자리만큼 들여쓰기 (paddingLeft 46)

import { useEffect, useState } from "react";
import { NOTI_CATEGORIES } from "./notiCategories.js";

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

  const barColor = isUnread
    ? cat.barColor
    : (isDark ? "#555" : "#B0A99E");

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
      padding: "14px 14px 14px 18px",
      position: "relative",
      overflow: "hidden",
      margin: "0 16px 8px",
      cursor: "pointer",
      opacity: isUnread ? 1 : 0.75,
      fontFamily: "inherit",
    }}>
      {/* 좌측 4px 바 */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 4,
        background: barColor,
      }}/>

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
        }}>
          <span style={{ fontSize: 16 }}>{cat.icon}</span>
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
            {noti.timeAgo || ""}
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
