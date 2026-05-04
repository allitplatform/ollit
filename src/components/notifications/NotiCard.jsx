// V14 — 알림 카드 (기사 + 운영자 공통)
// 카드 배경 = 카테고리 색 12% / 좌측 핑크 점 = 안 읽음 / 50대 글자 크기

import { useEffect, useState } from "react";
import { NotiIcon } from "./NotiIcon.jsx";
import { NOTI_CATEGORIES } from "./notiCategories.js";

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

  const cat = NOTI_CATEGORIES[noti.category.toUpperCase()] ||
              Object.values(NOTI_CATEGORIES).find(c => c.key === noti.category);

  if (!cat) return null;

  const isUnread = !noti.read;

  // 카테고리 색 (라이트/다크)
  const color  = isDark ? cat.color : (cat.colorLight || cat.color);
  const cardBg = isDark ? cat.bgDark : cat.bgLight;
  const iconBg = isDark ? cat.iconBgDark : cat.iconBgLight;

  return (
    <div onClick={onClick} style={{
      padding: "16px 16px 16px 22px",
      display: "flex", gap: 12,
      position: "relative",
      alignItems: "flex-start",
      background: cardBg,
      borderBottom: `0.5px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
      cursor: "pointer",
      opacity: noti.read ? 0.7 : 1,
    }}>
      {/* 좌측 핑크 점 (안 읽음) */}
      {isUnread && (
        <div style={{
          position: "absolute",
          left: 8, top: 22,
          width: 6, height: 6,
          borderRadius: "50%",
          background: "#FF1B8D",
        }}/>
      )}

      {/* 아이콘 박스 */}
      <div style={{
        width: 40, height: 40,
        borderRadius: 10,
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
            fontSize: 13, fontWeight: 800,
            color: color,
          }}>
            {noti.categoryLabel || cat.label}
          </span>
          <span style={{
            fontSize: 12,
            color: isDark ? "#999" : "#6E6E6E",
            fontWeight: 600,
            flexShrink: 0,
            marginLeft: "auto",
          }}>
            {noti.timeAgo}
          </span>
        </div>

        <div style={{
          fontSize: 16, fontWeight: 700,
          marginTop: 4,
          color: isDark ? "#FAF8F5" : "#1A1512",
          lineHeight: 1.4,
        }}>
          {noti.title}
        </div>

        {noti.subtitle && (
          <div style={{
            fontSize: 13, fontWeight: 600,
            marginTop: 4,
            color: isDark ? "#999" : "#6E6E6E",
            lineHeight: 1.5,
          }}>
            {noti.subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
