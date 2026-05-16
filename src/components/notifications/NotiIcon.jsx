// src/components/notifications/NotiIcon.jsx
// 카테고리별 SVG 아이콘 (기사 + 운영자 공통)

export function NotiIcon({ category, color }) {
  if (category === "new_assign") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    );
  }
  if (category === "schedule_confirm") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    );
  }
  if (category === "schedule_change") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    );
  }
  // 2026-05-16 — 신규 분기 (옛 schedule_confirm/complete 분기는 옛 데이터 호환 위해 유지)
  if (category === "work_started") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    );
  }
  if (category === "work_completed") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    );
  }
  if (category === "urgent") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    );
  }
  if (category === "settlement" || category === "complete") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    );
  }
  if (category === "ops_memo") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="2" x2="12" y2="22"/>
        <path d="M5 8h14M5 8c0 4 7 6 7 14c0-8 7-10 7-14"/>
      </svg>
    );
  }
  return null;
}
