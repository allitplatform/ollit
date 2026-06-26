// 2026-06-26 — 공지 본문 모달 (공용).
//   재사용 처:
//     · AnnouncementListTab — 카드 클릭 → 본문 전체 모달
//     · EngineerApp 콜드 스타트 — is_popup 공지 자동 팝업 (1회 표시 후 localStorage)
//   기능:
//     · 제목 / 본문 / 작성일 (toKstYmd) / 핀 📌 표시
//     · Esc / 배경 클릭 / X 버튼 닫기
//     · 본문 내 줄바꿈 보존 (whitespace pre-wrap)
//   읽음 추적 X — 카드 클릭은 그냥 표시, 팝업은 호출처가 localStorage 처리.

import { useEffect } from "react";
import { X } from "lucide-react";
import { toKstYmd } from "../utils/dateLabel.js";

const ACCENT = "#FF1B8D";

export function AnnouncementModal({ announcement, onClose }) {
  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!announcement) return null;

  const dateLabel = toKstYmd(announcement.published_at || announcement.created_at) || "—";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1100, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
        aria-labelledby="announcement-modal-title"
        style={{
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          border: `1px solid ${announcement.is_pinned ? ACCENT : "var(--border)"}`,
          borderRadius: 14,
          width: "min(560px, 100%)",
          maxHeight: "min(85vh, 700px)",
          display: "flex", flexDirection: "column",
          fontFamily: "'Pretendard', sans-serif",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, color: "var(--text-secondary)",
              fontWeight: 600, marginBottom: 4,
            }}>
              {announcement.is_pinned ? "📌 핀 고정 · " : ""}📢 공지사항
            </div>
            <div
              id="announcement-modal-title"
              style={{
                fontSize: 17, fontWeight: 800, color: "var(--text-primary)",
                letterSpacing: "-0.3px", lineHeight: 1.35,
                wordBreak: "break-word",
              }}
            >{announcement.title}</div>
            <div style={{
              fontSize: 11, color: "var(--text-secondary)",
              fontWeight: 600, marginTop: 6,
            }}>{dateLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: "transparent", border: "none", padding: 6,
              cursor: "pointer", color: "var(--text-primary)",
              display: "flex", alignItems: "center",
              flexShrink: 0,
            }}
          ><X size={20}/></button>
        </div>

        {/* 본문 */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "18px 20px",
        }}>
          {announcement.body ? (
            <div style={{
              fontSize: 14, lineHeight: 1.65, color: "var(--text-primary)",
              fontWeight: 500, whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>{announcement.body}</div>
          ) : (
            <div style={{
              fontSize: 13, color: "var(--text-secondary)",
              fontWeight: 500, fontStyle: "italic",
              textAlign: "center", padding: "20px 0",
            }}>본문 없음</div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%", padding: "12px 0",
              background: ACCENT,
              border: "none", borderRadius: 10,
              color: "#fff",
              fontSize: 14, fontWeight: 800,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >확인</button>
        </div>
      </div>
    </div>
  );
}

export default AnnouncementModal;
