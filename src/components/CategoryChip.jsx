// 2026-10-06 — 종목 칩 (아이콘 + 짧은 이름). 색·아이콘은 src/lib/serviceCatalog.js 의 종목 기준표 한 곳에서 온다.
//   상태(확정·완료·취소 등)는 기존 배지가 맡고, 종목은 이 칩 또는 카드 왼쪽 색 띠로만 보여 준다.
import { getCategoryMeta, categoryTint } from "../lib/serviceCatalog.js";

export default function CategoryChip({ task, size = "md", style }) {
  const m = getCategoryMeta(task);
  const sz = size === "sm" ? { fs: 10, pad: "2px 7px" } : { fs: 12, pad: "3px 9px" };
  return (
    <span title={m.label} style={{
      display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0,
      fontSize: sz.fs, fontWeight: 800, padding: sz.pad, borderRadius: 999,
      color: m.color, background: categoryTint(m.color, 0.14), border: `1px solid ${categoryTint(m.color, 0.5)}`,
      ...style,
    }}>
      <span aria-hidden="true">{m.icon}</span>{m.short}
    </span>
  );
}

// 카드 왼쪽 색 띠 — 카드 style 에 펼쳐 넣는다: style={{ ...card, ...categoryBar(task) }}
export function categoryBar(task, width = 4) {
  return { borderLeft: `${width}px solid ${getCategoryMeta(task).color}` };
}
