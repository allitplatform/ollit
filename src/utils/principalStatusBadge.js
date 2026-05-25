// 원청 PWA — task.status 측 catch 측 catch 측 catch (PrincipalListTab / TaskDetail 측 catch)
// 2026-05-24
export function getStatusBadge(status) {
  switch (status) {
    case "완료":       return { color: "#1D9E75", bg: "rgba(29,158,117,0.12)" };
    // 2026-05-25 — '확정' 색 변경: #6366F1(indigo, 배정 파랑과 겹침) → #EA580C(orange-600).
    //   진행중 #F59E0B(amber, 노랑톤)와도 채도 분리. 배정(파랑)·완료(초록)·취소(빨강)와 명확 구분.
    case "확정":       return { color: "#EA580C", bg: "rgba(234,88,12,0.12)" };
    case "진행중":     return { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" };
    case "배정":       return { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" };
    case "미배정":     return { color: "#9CA3AF", bg: "rgba(156,163,175,0.14)" };
    case "취소":       return { color: "#EF4444", bg: "rgba(239,68,68,0.10)" };
    case "visit_only": return { color: "#A855F7", bg: "rgba(168,85,247,0.12)" };
    default:           return { color: "#9CA3AF", bg: "rgba(156,163,175,0.14)" };
  }
}

export function getStatusLabel(status) {
  if (status === "visit_only") return "출장비만";
  return status || "—";
}
