// 2026-07-29 — 접수 시간대 미니 히스토그램 (공용).
//   출처: AdminPcDashboard.jsx (2026-07-21) 안에 있던 같은 이름 컴포넌트를 파일로 분리.
//   분리 이유 — 사장님 요청: 모바일 접수 통계 허브에서도 같은 차트를 쓰고,
//                PC 는 날짜를 바꿔가며 보게 됐다 (오늘 고정 해제).
//   버킷 13개: [~8시, 9, 10, ..., 19, 20시+].
//   색·토큰은 CSS 변수 (styles/themes.js 가 document root 에 주입 — PC/모바일 공통).
//
//   props:
//     hourly       : number[13]
//     total        : number         (헤더 우측 "N건")
//     title        : string         (기본 "접수 시간대")
//     note         : string         (제목 옆 작은 회색 글 / 기본 "(취소 포함)")
//     highlightNow : boolean        (true 면 현재 시각 버킷 핑크 강조 — 오늘 볼 때만 켠다)
//     compact      : boolean        (모바일 — 높이/글자 축소)

import React from "react";

export const HOUR_BUCKET_LABELS =
  ["~8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20+"];

// KST 시각 → 버킷 인덱스. 집계 쪽에서도 같은 규칙을 쓰라고 함께 export.
export function hourBucketIndexKst(dateLike) {
  const h = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul", hour: "2-digit", hour12: false,
  }).format(new Date(dateLike)));
  if (!Number.isFinite(h)) return -1;
  return h <= 8 ? 0 : h >= 20 ? 12 : h - 8;
}

export function HourlyReceivedChart({
  hourly = [],
  total = 0,
  title = "접수 시간대",
  note = "(취소 포함)",
  highlightNow = true,
  compact = false,
}) {
  const arr = Array.isArray(hourly) && hourly.length === 13
    ? hourly
    : new Array(13).fill(0);
  const max = Math.max(1, ...arr);
  const nowIdx = highlightNow ? hourBucketIndexKst(new Date()) : -1;
  const barH = compact ? 56 : 70;

  return (
    <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div style={{
        fontSize: 10.5, fontWeight: 800, color: "var(--text-secondary)",
        marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 8,
      }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          🕐 {title}
          {note ? <span style={{ fontWeight: 600, color: "var(--text-tertiary)" }}> {note}</span> : null}
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{total}건</span>
      </div>

      {/* 막대 위 건수 숫자 (0 은 자리만 차지, 표시 안 함) */}
      <div style={{ display: "flex", alignItems: "stretch", gap: compact ? 2 : 4, height: barH }}>
        {arr.map((c, i) => (
          <div key={i} title={`${HOUR_BUCKET_LABELS[i]}시 · ${c}건`} style={{
            flex: 1, minWidth: 0,
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
          }}>
            <div style={{
              textAlign: "center", fontSize: compact ? 8.5 : 9.5, fontWeight: 800,
              lineHeight: "11px", marginBottom: 2,
              fontVariantNumeric: "tabular-nums",
              color: i === nowIdx ? "var(--accent)" : "var(--text-secondary)",
              visibility: c > 0 ? "visible" : "hidden",
            }}>{c}</div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
              <div style={{
                width: "100%",
                height: `${c > 0 ? Math.max(12, Math.round((c / max) * 100)) : 5}%`,
                borderRadius: "4px 4px 2px 2px",
                background: c > 0
                  ? (i === nowIdx ? "var(--accent)" : "var(--accent-bg)")
                  : "var(--bg-secondary)",
                border: c > 0
                  ? `1px solid ${i === nowIdx ? "var(--accent)" : "rgba(255,27,141,0.35)"}`
                  : "1px solid var(--border)",
              }}/>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: compact ? 2 : 4, marginTop: 4 }}>
        {HOUR_BUCKET_LABELS.map((lb, i) => (
          <span key={lb} style={{
            flex: 1, textAlign: "center",
            fontSize: compact ? 8 : 8.5, fontWeight: i === nowIdx ? 800 : 600,
            color: i === nowIdx ? "var(--accent)" : "var(--text-tertiary)",
            whiteSpace: "nowrap",
          }}>{lb}</span>
        ))}
      </div>
    </div>
  );
}

export default HourlyReceivedChart;
