// 2026-10-06 — 아래에서 올라오는 시트 공용 틀.
//   구조: 위 제목 고정 / 가운데 내용만 스크롤 / 아래 버튼 줄 고정(하단 safe-area 포함).
//   휴대폰 키보드가 올라오면 "보이는 화면 높이"(visualViewport)에 맞춰 시트를 줄여
//   아래 버튼이 키보드 뒤로 숨지 않게 한다.
//   입력칸 글자 크기는 16px 이상으로 쓴다 (iOS 는 16px 미만 입력칸을 누르면 화면을 자동 확대한다).
import { useEffect, useState } from "react";

function useVisibleViewport() {
  const read = () => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return vv
      ? { height: vv.height, top: vv.offsetTop }
      : { height: typeof window !== "undefined" ? window.innerHeight : 0, top: 0 };
  };
  const [box, setBox] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    const on = () => setBox(read());
    if (vv) { vv.addEventListener("resize", on); vv.addEventListener("scroll", on); }
    window.addEventListener("resize", on);
    return () => {
      if (vv) { vv.removeEventListener("resize", on); vv.removeEventListener("scroll", on); }
      window.removeEventListener("resize", on);
    };
  }, []);
  return box;
}

export default function BottomSheet({ title, subtitle, header, footer, children, onClose, maxWidth = 560 }) {
  const box = useVisibleViewport();
  // 키보드가 올라와 있으면(보이는 높이가 많이 줄면) 시트가 보이는 영역을 거의 다 쓰게 한다
  const keyboardUp = typeof window !== "undefined" && box.height < window.innerHeight - 120;
  return (
    <div onClick={onClose} style={{
      position: "fixed", left: 0, top: box.top, width: "100%", height: box.height || "100%",
      background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-secondary)", color: "var(--text-primary)",
        width: "100%", maxWidth, maxHeight: keyboardUp ? "100%" : "88%",
        borderRadius: keyboardUp ? 0 : "18px 18px 0 0", boxSizing: "border-box",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {(title || subtitle || header) && (
          <div style={{ flexShrink: 0, padding: "16px 16px 10px", borderBottom: "1px solid var(--border)" }}>
            {title && <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
            {header}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "12px 16px", WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
        {footer && (
          <div style={{
            flexShrink: 0, padding: `10px 16px calc(${keyboardUp ? "0px" : "env(safe-area-inset-bottom, 0px)"} + 12px)`,
            borderTop: "1px solid var(--border)", background: "var(--bg-secondary)",
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// 시트 아래 버튼 줄 — [닫기/취소] [주 버튼]
export function SheetButtons({ onCancel, cancelLabel = "취소", onOk, okLabel = "저장", busy = false, danger = false, extra = null }) {
  const base = {
    flex: 1, minHeight: 46, borderRadius: 10, fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
  };
  return (
    <>
      {extra}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={busy} onClick={onCancel} style={{ ...base, background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {cancelLabel}
        </button>
        {onOk && (
          <button type="button" disabled={busy} onClick={onOk} style={{ ...base, border: "none", color: "#fff", background: danger ? "#E5484D" : "var(--accent, #FF1B8D)" }}>
            {busy ? "처리 중…" : okLabel}
          </button>
        )}
      </div>
    </>
  );
}
