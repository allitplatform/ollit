// ============================================================
// 2026-07-15 — 받은 돈 전용 컴팩트 키패드 (사장님 spec).
//   배경: 기사님들이 기본 숫자 키보드에서 0 하나 빠뜨리는/더하는 실수가 잦음.
//   · 입력창(필드)은 그대로 — 탭하면 하단 시트 키패드
//   · 큰 숫자 + 한글 금액 확인("십이만원") + [견적 그대로] 원터치 (견적만 — 사장님 확정)
//   · body zoom(글자 크기) 영향 안 받게 시트에 역보정 (AllEngineersModal 패턴)
// 2026-10-07 — 사장님 실사용 피드백 (아이폰 · 다크 모드)
//   ① 미리 들어간 금액을 지우기 불편 → 열 때 "선택된 상태" 로 두고 첫 숫자를 누르면 통째로 바뀜,
//      ⌫ 길게(0.5초) = 전체 지우기, [전체 지우기] 버튼, [−1만] [+1만] [+5만] 조정 칩
//   ② 숫자가 잘 안 보임 → 금액을 독립된 큰 한 줄(52px)로, 한글 읽기 24px, 견적과 비교 한 줄,
//      숫자 키 32px · 대비 강화 · 눌림 효과 · 짧은 진동
// ============================================================
import { useRef, useState } from "react";
import { useIsDark } from "../hooks/useIsDark.js";

// 숫자 → 한글 금액 ("120000" → "십이만원"). 확인용 — 형식 오류 시 빈 문자열.
export function koreanMoney(n) {
  let num = Math.floor(Number(n) || 0);
  if (num <= 0) return "";
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const small  = ["", "십", "백", "천"];
  const big    = ["", "만", "억"];
  let out = "", g = 0;
  while (num > 0 && g < big.length) {
    const part = num % 10000;
    if (part) {
      let ps = "", p = part, i = 0;
      while (p > 0) {
        const d = p % 10;
        if (d) ps = (d === 1 && i > 0 ? "" : digits[d]) + small[i] + ps;
        p = Math.floor(p / 10); i++;
      }
      out = ps + big[g] + out;
    }
    num = Math.floor(num / 10000); g++;
  }
  return out + "원";
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];
const MAX_DIGITS = 9;                 // 9자리(억대) 상한 — 오입력 방지
const ADJUSTS = [[-10000, "−1만"], [10000, "+1만"], [50000, "+5만"]];

function buzz() {
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8); } catch (_e) { /* 지원 안 되면 무시 */ }
}

export function MoneyPadInput({
  value,
  onChange,                 // (문자열 숫자) — 기존 input onChange(e.target.value) 와 동일 계약
  quoteAmount = 0,          // [견적 그대로] 버튼 금액 (0이면 버튼 숨김)
  placeholder = "금액 입력",
  accentColor = "#FF1B8D",
  label = "받은 돈",
  style = {},               // 필드 추가 스타일 (기존 input 스타일 이식용)
}) {
  const isDark = useIsDark();
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState("");
  // fresh = 미리 들어간 금액이 "선택된 상태". 첫 숫자를 누르면 통째로 바뀐다 (전체 선택 후 입력과 같음).
  const [fresh, setFresh] = useState(false);
  const [pressed, setPressed] = useState(null);     // 눌림 효과용 — 지금 누르고 있는 키
  const holdTimer = useRef(null);
  const holdFired = useRef(false);

  const numValue = Number(value) || 0;
  const quote = Number(quoteAmount) || 0;

  const openPad = () => {
    setDraft(numValue > 0 ? String(numValue) : "");
    setFresh(numValue > 0);
    setOpen(true);
  };
  const clearAll = () => { setDraft(""); setFresh(false); };
  const press = (k) => {
    buzz();
    if (k === "back") {
      // ⌫ 를 먼저 누르면 기존처럼 한 자리씩
      setFresh(false);
      setDraft(d => d.slice(0, -1));
      return;
    }
    const base = fresh ? "" : draft;
    setFresh(false);
    const nd = (base + k).replace(/^0+(?=\d)/, "").replace(/^0+$/, "");
    setDraft(nd.length > MAX_DIGITS ? base : nd);
  };
  const adjust = (delta) => {
    buzz();
    const next = Math.max(0, (Number(draft) || 0) + delta);
    setFresh(false);
    setDraft(next > 0 && String(next).length <= MAX_DIGITS ? String(next) : (next > 0 ? draft : ""));
  };
  const confirm = () => {
    if (typeof onChange === "function") onChange(draft === "" ? "" : String(Number(draft)));
    setOpen(false);
  };

  // ⌫ 길게 누르면 전체 지우기 (0.5초)
  const backDown = () => {
    holdFired.current = false;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => { holdFired.current = true; buzz(); clearAll(); }, 500);
  };
  const backUp = () => { clearTimeout(holdTimer.current); };

  const draftNum = Number(draft) || 0;
  const amountText = `₩${draftNum.toLocaleString("ko-KR")}`;
  // 긴 금액은 한 줄에 들어가게 조금 줄인다 (iPhone SE 폭 기준)
  const amountSize = amountText.length <= 9 ? 52 : amountText.length <= 11 ? 44 : 36;
  const diff = draftNum - quote;

  // 고대비 색 (다크: 흰 글자 / 라이트: 검은 글자)
  const ink     = isDark ? "#FFFFFF" : "#000000";
  const keyBg   = isDark ? "#3A3A3C" : "#F2F2F7";
  const keyDown = isDark ? "#636366" : "#D1D1D6";
  const keyBd   = isDark ? "#48484A" : "#D9D9DE";
  const chip = {
    padding: "9px 12px", borderRadius: 9, fontSize: 14, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    background: keyBg, border: `1px solid ${keyBd}`, color: ink,
  };

  return (
    <>
      {/* 필드 — 탭하면 키패드 */}
      <div
        onClick={openPad}
        role="button"
        style={{
          width: "100%", padding: 10,
          background: "var(--card-bg, var(--bg-secondary))",
          border: `1px solid ${accentColor}`,
          borderRadius: 8,
          color: numValue > 0 ? "var(--text-primary)" : "var(--text-tertiary, var(--text-secondary))",
          fontSize: 15, boxSizing: "border-box",
          fontFamily: "inherit", fontWeight: 700,
          cursor: "pointer", userSelect: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          ...style,
        }}
      >
        <span>{numValue > 0 ? `₩${numValue.toLocaleString("ko-KR")}` : placeholder}</span>
        <span style={{ fontSize: 10, color: accentColor, fontWeight: 800, flexShrink: 0 }}>⌨ 입력</span>
      </div>

      {/* 하단 시트 키패드 */}
      {open && (
        <div
          onClick={confirm}
          style={{
            position: "fixed", inset: 0, zIndex: 1300,
            // 뒤의 기존 금액 칸은 흐리게 — 시트의 표시줄만 보면 되게
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            // 글자 크기 zoom 역보정 — 팝업 좌표 밀림 방지 (AllEngineersModal 동일)
            zoom: "calc(1 / var(--font-scale, 1))",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420, boxSizing: "border-box",
              maxHeight: "100dvh", overflowY: "auto",
              background: "var(--bg-primary, #fff)",
              borderRadius: "16px 16px 0 0",
              border: "1px solid var(--border)",
              borderBottom: "none",
              padding: "12px 14px calc(12px + env(safe-area-inset-bottom))",
              boxShadow: "0 -6px 24px rgba(0,0,0,0.18)",
              userSelect: "none", WebkitUserSelect: "none",
            }}
          >
            {/* 라벨(작게) + 취소 */}
            <div style={{ display: "flex", alignItems: "center", padding: "0 2px" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-secondary)" }}>
                💰 {label}
              </span>
              <button
                onClick={() => setOpen(false)}
                style={{
                  marginLeft: "auto", background: "transparent", border: "none",
                  color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
                  fontFamily: "inherit", padding: 6, flexShrink: 0,
                }}
              >✕ 취소</button>
            </div>

            {/* 금액 — 독립된 큰 한 줄. 선택된 상태(첫 숫자를 누르면 통째로 바뀜)는 옅은 강조 */}
            <div style={{ textAlign: "center", padding: "2px 0 0", lineHeight: 1.15 }}>
              <span style={{
                display: "inline-block", padding: "2px 10px", borderRadius: 10,
                fontSize: amountSize, fontWeight: 900, letterSpacing: "-1px", color: ink,
                fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                background: fresh ? (isDark ? "rgba(10,132,255,0.45)" : "rgba(10,132,255,0.22)") : "transparent",
              }}>
                {amountText}
              </span>
            </div>

            {/* 한글 읽기 + 견적과 비교 */}
            <div style={{
              display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "center",
              columnGap: 10, rowGap: 2, minHeight: 32, padding: "2px 0 8px",
            }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: accentColor, wordBreak: "keep-all", textAlign: "center" }}>
                {koreanMoney(draftNum) || "영원"}
              </span>
              {quote > 0 && (
                <span style={{
                  fontSize: 14, fontWeight: 800,
                  color: diff === 0 ? (isDark ? "#34C759" : "#1E8E3E") : diff < 0 ? (isDark ? "#FF6B6B" : "#D92D20") : (isDark ? "#5AB0FF" : "#0B63CE"),
                }}>
                  {diff === 0 ? "견적과 같음"
                    : diff < 0 ? `견적보다 ${Math.abs(diff).toLocaleString("ko-KR")}원 적음`
                    : `견적보다 ${diff.toLocaleString("ko-KR")}원 많음`}
                </span>
              )}
            </div>

            {/* 견적 그대로 + 조정 칩 + 전체 지우기 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {quote > 0 && (
                <button
                  onClick={() => { buzz(); setDraft(String(quote)); setFresh(true); }}
                  style={{
                    ...chip,
                    background: isDark ? "rgba(52,199,89,0.22)" : "rgba(52,199,89,0.12)",
                    border: "1px solid rgba(52,199,89,0.6)",
                    color: isDark ? "#7EE2A0" : "#1E7A34",
                  }}
                >
                  견적 그대로 ₩{quote.toLocaleString("ko-KR")}
                </button>
              )}
              {ADJUSTS.map(([delta, text]) => (
                <button key={text} onClick={() => adjust(delta)} style={chip}>{text}</button>
              ))}
              <button onClick={() => { buzz(); clearAll(); }} style={{ ...chip, marginLeft: "auto", color: isDark ? "#FF8A8A" : "#D92D20" }}>
                전체 지우기
              </button>
            </div>

            {/* 키패드 — 3열 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {KEYS.map(k => {
                const isBack = k === "back";
                return (
                  <button
                    key={k}
                    onClick={() => {
                      if (isBack && holdFired.current) { holdFired.current = false; return; }   // 길게 눌러 이미 전체 지움
                      press(k);
                    }}
                    onPointerDown={() => { setPressed(k); if (isBack) backDown(); }}
                    onPointerUp={() => { setPressed(null); if (isBack) backUp(); }}
                    onPointerLeave={() => { setPressed(null); if (isBack) backUp(); }}
                    onPointerCancel={() => { setPressed(null); if (isBack) backUp(); }}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label={isBack ? "한 자리 지우기 (길게 누르면 전체 지우기)" : k}
                    style={{
                      height: "clamp(50px, 9.5vh, 60px)", padding: 0,     // 낮은 화면(iPhone SE 1세대)에서도 시트가 한 화면에 들어가게
                      background: pressed === k ? keyDown : keyBg,
                      border: `1px solid ${keyBd}`,
                      borderRadius: 11,
                      fontSize: isBack ? 28 : (k === "000" ? 26 : 32),
                      fontWeight: 700, lineHeight: 1,
                      color: ink,
                      cursor: "pointer", fontFamily: "inherit",
                      touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
                      transition: "background 0.06s",
                    }}
                  >
                    {isBack ? "⌫" : k}
                  </button>
                );
              })}
            </div>

            <button
              onClick={confirm}
              style={{
                width: "100%", marginTop: 8, padding: 15,
                background: accentColor, border: "none", borderRadius: 12,
                color: "#fff", fontSize: 17, fontWeight: 800,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              ✓ {draftNum > 0 ? `₩${draftNum.toLocaleString("ko-KR")} 입력` : "0원으로 입력"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default MoneyPadInput;
