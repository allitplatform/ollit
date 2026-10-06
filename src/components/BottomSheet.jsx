// 2026-10-06 — 아래에서 올라오는 시트 공용 틀.
//   구조: 위 제목 고정 / 가운데 내용만 스크롤 / 아래 버튼 줄 고정(하단 safe-area 포함).
//   휴대폰 키보드가 올라오면 "보이는 화면 높이"(visualViewport)에 맞춰 시트를 줄여
//   아래 버튼이 키보드 뒤로 숨지 않게 한다.
//   입력칸 글자 크기는 16px 이상으로 쓴다 (iOS 는 16px 미만 입력칸을 누르면 화면을 자동 확대한다).
import { useEffect, useState } from "react";

// 앱은 글자 크기 설정을 body { zoom: var(--font-scale) } 로 적용한다 (index.css).
//   zoom 이 걸린 화면에서는 px·vh 로 준 크기가 그 배율만큼 커진다 → visualViewport 값(실제 화면 px)을
//   그대로 높이로 쓰면 시트가 화면보다 길어져 아래 버튼이 화면 밖으로 나간다 (2026-10-06 실화면 원인).
//   그래서 화면 px 를 배율로 나눠서 쓴다.
function fontScale() {
  if (typeof window === "undefined") return 1;
  const v = parseFloat(getComputedStyle(document.body).zoom || "1");
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function readBox() {
  if (typeof window === "undefined") return { height: 0, top: 0, full: 0 };
  const k = fontScale();
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  const t = vv ? vv.offsetTop : 0;
  return { height: h / k, top: t / k, full: window.innerHeight / k };
}

function useVisibleViewport() {
  const [box, setBox] = useState(readBox);
  useEffect(() => {
    const vv = window.visualViewport;
    const on = () => setBox(readBox());
    on();
    if (vv) { vv.addEventListener("resize", on); vv.addEventListener("scroll", on); }
    window.addEventListener("resize", on);
    return () => {
      if (vv) { vv.removeEventListener("resize", on); vv.removeEventListener("scroll", on); }
      window.removeEventListener("resize", on);
    };
  }, []);
  return box;
}

// 시트가 열려 있는 동안 뒤 화면 스크롤 잠금.
//   iOS 는 body overflow:hidden 만으로는 뒤 화면이 같이 움직인다 → body 를 position:fixed 로 고정하고
//   닫을 때 원래 스크롤 위치로 되돌린다. 여러 시트가 겹쳐 열려도 마지막 시트가 닫힐 때 한 번만 푼다.
let _locks = 0;
let _saved = null;
function useBodyScrollLock() {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    if (_locks === 0) {
      const y = window.scrollY || html.scrollTop || 0;
      _saved = {
        y,
        position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right,
        width: body.style.width, overflow: body.style.overflow, htmlOverflow: html.style.overflow,
      };
      const k = fontScale();
      body.style.position = "fixed";
      body.style.top = `${-y / k}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      html.style.overflow = "hidden";
    }
    _locks += 1;
    return () => {
      _locks -= 1;
      if (_locks === 0 && _saved) {
        const s = _saved; _saved = null;
        body.style.position = s.position; body.style.top = s.top; body.style.left = s.left; body.style.right = s.right;
        body.style.width = s.width; body.style.overflow = s.overflow; html.style.overflow = s.htmlOverflow;
        window.scrollTo(0, s.y);
      }
    };
  }, []);
}

export default function BottomSheet({ title, subtitle, header, footer, children, onClose, maxWidth = 560 }) {
  const box = useVisibleViewport();
  useBodyScrollLock();
  // 키보드가 올라와 있으면(보이는 높이가 많이 줄면) 시트가 보이는 영역을 전부 쓰게 한다
  const keyboardUp = box.full > 0 && box.height < box.full - 120;
  const sheetMax = Math.max(200, Math.floor(box.height * (keyboardUp ? 1 : 0.9)));
  return (
    <div onClick={onClose} style={{
      position: "fixed", left: 0, top: box.top, width: "100%", height: box.height || "100%",
      background: "rgba(0,0,0,0.5)", zIndex: 1000, overflow: "hidden",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      touchAction: "none",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-secondary)", color: "var(--text-primary)",
        width: "100%", maxWidth, maxHeight: sheetMax,
        borderRadius: keyboardUp ? 0 : "18px 18px 0 0", boxSizing: "border-box",
        display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "auto",
      }}>
        {(title || subtitle || header) && (
          <div style={{ flexShrink: 0, padding: "16px 16px 10px", borderBottom: "1px solid var(--border)" }}>
            {title && <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
            {header}
          </div>
        )}
        <div style={{
          flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "12px 16px",
          WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
        }}>
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
