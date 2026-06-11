// 2026-06-11 — 공통 검색바 (다른 화면 헤더에서 재사용).
//   다크/라이트 양쪽 — 색은 t (테마 토큰) 전달 받음.
//   풀폭 + 큰 입력 영역 (사장님 spec 🅐 PC 헤더 1줄차).
//
// props:
//   t           — 테마 토큰 ({ bgElevated, border, text, textMuted, accent })
//   value       — 입력값 (controlled)
//   onChange    — (next: string) => void
//   placeholder — 미입력 시 안내
//   size        — "lg" (default — PC 헤더용 크게) / "sm" (인라인용 작게)
//   onClear     — 우측 X 버튼 표시 (옵션). 클릭 시 빈 문자열로.

import { Search, X } from "lucide-react";

export function SearchBar({
  t,
  value,
  onChange,
  placeholder = "검색",
  size = "lg",
  onClear,
}) {
  const isLg = size !== "sm";
  const padding   = isLg ? "12px 16px"   : "8px 12px";
  const fontSize  = isLg ? 15            : 13;
  const iconSize  = isLg ? 18            : 14;
  const radius    = isLg ? 10            : 8;
  const gap       = isLg ? 10            : 7;
  const showClear = typeof onClear === "function" && value && value.length > 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap,
      padding,
      width: "100%",
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: radius,
      boxSizing: "border-box",
    }}>
      <Search size={iconSize} color={t.textMuted}/>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          color: t.text,
          fontSize,
          fontFamily: "inherit",
          fontWeight: 500,
        }}
      />
      {showClear && (
        <button
          type="button"
          onClick={() => onClear()}
          aria-label="검색 비우기"
          style={{
            background: "transparent",
            border: "none",
            padding: 2,
            cursor: "pointer",
            color: t.textMuted,
            display: "flex",
            alignItems: "center",
          }}
        ><X size={iconSize - 2}/></button>
      )}
    </div>
  );
}

export default SearchBar;
