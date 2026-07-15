// ============================================================
// 2026-07-15 — 받은 돈 전용 컴팩트 키패드 (사장님 spec).
//   배경: 기사님들이 기본 숫자 키보드에서 0 하나 빠뜨리는/더하는 실수가 잦음.
//   · 입력창(필드)은 그대로 — 탭하면 하단 시트 키패드
//   · 큰 숫자 + 한글 금액 확인("십이만원") + [견적 그대로] 원터치 (견적만 — 사장님 확정)
//   · body zoom(글자 크기) 영향 안 받게 시트에 역보정 (AllEngineersModal 패턴)
// ============================================================
import { useState } from "react";

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

export function MoneyPadInput({
  value,
  onChange,                 // (문자열 숫자) — 기존 input onChange(e.target.value) 와 동일 계약
  quoteAmount = 0,          // [견적 그대로] 버튼 금액 (0이면 버튼 숨김)
  placeholder = "금액 입력",
  accentColor = "#FF1B8D",
  label = "받은 돈",
  style = {},               // 필드 추가 스타일 (기존 input 스타일 이식용)
}) {
  const [open, setOpen]   = useState(false);
  const [draft, setDraft] = useState("");

  const numValue = Number(value) || 0;

  const openPad = () => {
    setDraft(numValue > 0 ? String(numValue) : "");
    setOpen(true);
  };
  const press = (k) => {
    setDraft(d => {
      if (k === "back") return d.slice(0, -1);
      const nd = (d + k).replace(/^0+(?=\d)/, "");
      return nd.length > 9 ? d : nd;   // 9자리(억대) 상한 — 오입력 방지
    });
  };
  const confirm = () => {
    if (typeof onChange === "function") onChange(draft === "" ? "" : String(Number(draft)));
    setOpen(false);
  };

  const draftNum = Number(draft) || 0;

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
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            // 글자 크기 zoom 역보정 — 팝업 좌표 밀림 방지 (AllEngineersModal 동일)
            zoom: "calc(1 / var(--font-scale, 1))",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420,
              background: "var(--bg-primary, #fff)",
              borderRadius: "16px 16px 0 0",
              border: "1px solid var(--border)",
              borderBottom: "none",
              padding: "12px 14px calc(12px + env(safe-area-inset-bottom))",
              boxShadow: "0 -6px 24px rgba(0,0,0,0.18)",
            }}
          >
            {/* 헤더: 라벨 + 금액 + 한글 확인 */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "0 2px", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", flexShrink: 0 }}>
                💰 {label}
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.4px", color: "var(--text-primary)" }}>
                {draftNum > 0 ? `₩${draftNum.toLocaleString("ko-KR")}` : "₩0"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: accentColor, minHeight: 16 }}>
                {koreanMoney(draftNum)}
              </span>
              <button
                onClick={() => setOpen(false)}
                style={{
                  marginLeft: "auto", background: "transparent", border: "none",
                  color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                  fontFamily: "inherit", padding: 4, flexShrink: 0,
                }}
              >✕ 취소</button>
            </div>

            {/* 견적 그대로 (견적만 — 사장님 확정) */}
            {Number(quoteAmount) > 0 && (
              <button
                onClick={() => setDraft(String(Number(quoteAmount)))}
                style={{
                  padding: "7px 12px", marginBottom: 8,
                  background: "rgba(52,199,89,0.10)",
                  border: "1px solid rgba(52,199,89,0.5)",
                  borderRadius: 8,
                  color: "#2E7D32", fontSize: 11.5, fontWeight: 800,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                견적 그대로 ₩{Number(quoteAmount).toLocaleString("ko-KR")}
              </button>
            )}

            {/* 키패드 — 3열 컴팩트 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
              {KEYS.map(k => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  style={{
                    padding: "11px 0",
                    background: "var(--bg-secondary, #F5F5F7)",
                    border: "1px solid var(--border)",
                    borderRadius: 9,
                    fontSize: k === "back" ? 14 : (k === "000" ? 13 : 17),
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {k === "back" ? "⌫" : k}
                </button>
              ))}
            </div>

            <button
              onClick={confirm}
              style={{
                width: "100%", marginTop: 8, padding: 13,
                background: accentColor, border: "none", borderRadius: 11,
                color: "#fff", fontSize: 14, fontWeight: 800,
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
