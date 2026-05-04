// V14 — 확인 모달 (재사용 가능)
// 휴무 해제 / 작업 취소 등 위험 액션 확인용

import { useIsDark } from "../hooks/useIsDark.js";

export function ConfirmModal({
  title,
  message,
  confirmLabel = "확인",
  cancelLabel  = "취소",
  confirmColor = "#FF1B8D",
  onConfirm,
  onCancel,
}) {
  const isDark = useIsDark();
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 24,
        fontFamily: "'Pretendard', -apple-system, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isDark ? "#1C1C1E" : "#fff",
          borderRadius: 18,
          padding: "24px 22px 18px",
          width: "100%",
          maxWidth: 320,
          boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{
          fontSize: 17, fontWeight: 700,
          color: isDark ? "#FAF8F5" : "#1A1A1A",
          marginBottom: 10,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: isDark ? "#C8C8C8" : "#555",
          lineHeight: 1.5,
          marginBottom: 20,
          whiteSpace: "pre-line",
        }}>
          {message}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              background: isDark ? "transparent" : "#fff",
              border: `1.5px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
              color: isDark ? "#C8C8C8" : "#555",
              padding: 13,
              borderRadius: 11,
              fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: confirmColor,
              color: "#fff",
              border: "none",
              padding: 13,
              borderRadius: 11,
              fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
