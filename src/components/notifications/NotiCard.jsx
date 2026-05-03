// src/components/notifications/NotiCard.jsx
// 알림 카드 (기사 + 운영자 공통)

import { useEffect, useState } from "react";
import { NotiIcon } from "./NotiIcon.jsx";
import { NOTI_CATEGORIES } from "./notiCategories.js";

function detectDark() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dark";
}

export function NotiCard({ noti, onClick }) {
  const [isDark, setIsDark] = useState(() => detectDark());

  // 라이트/다크 토글 시 즉시 반영
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(detectDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, []);

  const cat = NOTI_CATEGORIES[noti.category.toUpperCase()] ||
              Object.values(NOTI_CATEGORIES).find(c => c.key === noti.category);

  if (!cat) return null;

  const isUnread = !noti.read;

  // 카테고리 색 (라이트/다크)
  const color = isDark ? cat.color : (cat.colorLight || cat.color);
  const cardBg = isDark ? cat.bgDark : cat.bgLight;
  const iconBg = isDark ? cat.iconBgDark : cat.iconBgLight;

  return (
    <div onClick={onClick} style={{
      padding: "14px 16px",
      display: "flex", gap: 10,
      position: "relative",
      alignItems: "flex-start",
      background: cardBg,
      borderBottom: `0.5px solid ${isDark ? "#2A2420" : "rgba(0,0,0,0.06)"}`,
      cursor: "pointer",
      opacity: noti.read && cat.key === "complete" ? 0.6 : 1,
    }}>
      {/* 좌측 핑크 점 (안 읽음) */}
      {isUnread && (
        <div style={{
          position: "absolute",
          left: 6, top: 22,
          width: 6, height: 6,
          borderRadius: "50%",
          background: "#FF1B8D",
        }}/>
      )}

      {/* 아이콘 박스 */}
      <div style={{
        width: 36, height: 36,
        borderRadius: 8,
        background: iconBg,
        display: "flex",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <NotiIcon category={cat.key} color={color}/>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: color,
          }}>
            {noti.categoryLabel || cat.label}
          </span>
          <span style={{
            fontSize: 10,
            color: isDark ? "#888780" : "#6E6E6E",
            flexShrink: 0,
            marginLeft: "auto",
          }}>
            {noti.timeAgo}
          </span>
        </div>

        <div style={{
          fontSize: 14, fontWeight: 700,
          marginTop: 2,
          color: isDark ? "#FAF8F5" : "#1A1512",
        }}>
          {noti.title}
        </div>

        {noti.subtitle && (
          <div style={{
            fontSize: 11,
            marginTop: 2,
            color: isDark ? "#888780" : "#6E6E6E",
          }}>
            {noti.subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
