// 출장비 (visit_fee) 표시 컴포넌트 — 운영자 PWA / 유솔 PWA 공용.
// 2026-06-09 작성.
//
// 호환:
//   · VisitIcon — 단독 아이콘 (🚗). pure visit_only task 의 메인 service icon 자리.
//   · VisitBadge — 🚗 + "출장비만" 배지. 혼합 task (세척+출장비 등) 측 인라인 표시.
//
// 색 / 라벨 — utils/visitFeeDetect.js 상수와 정합.

import { VISIT_ICON_EMOJI, VISIT_LABEL, VISIT_COLOR } from "../../utils/visitFeeDetect.js";

// 단독 아이콘 (🚗) — getServiceKind 결과 'visit' 시 ServiceIcon 자리.
export function VisitIcon({ size = 14, color = VISIT_COLOR }) {
  return (
    <span style={{
      fontSize: size,
      color,
      lineHeight: 1,
      display: "inline-block",
    }}>
      {VISIT_ICON_EMOJI}
    </span>
  );
}

// 배지 — 🚗 + "출장비만". 혼합 task 측 메인 icon 옆 인라인 표시용.
export function VisitBadge({ size = 10 }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      padding: "1px 5px",
      borderRadius: 4,
      background: "rgba(255,27,141,0.10)",
      border: `1px solid ${VISIT_COLOR}55`,
      color: VISIT_COLOR,
      fontSize: size,
      fontWeight: 700,
      fontFamily: "inherit",
      lineHeight: 1.2,
      flexShrink: 0,
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: size + 1, lineHeight: 1 }}>{VISIT_ICON_EMOJI}</span>
      <span>{VISIT_LABEL}</span>
    </span>
  );
}
