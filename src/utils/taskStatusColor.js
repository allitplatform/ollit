// 2026-06-12 — 작업 상태 → 색 공통 매핑 (사장님 spec).
//   확정(파랑) / 완료(초록) 명확 구분. 모든 화면 status badge / 칩 / 마커 일관 적용.
//   ⚠️ 키 = 한국어 DB status (task.status). visit_only 같은 영문 키 포함.
//   ⚠️ 색만 — 데이터/로직 0줄 변경.
//
// 매핑 (사장님 6단계 + 보조):
//   · 미배정 (= 새 접수) — 핑크   #FF6FA8
//   · 배정 / 약속대기              — 청록   #3DC6D0
//   · 확정                         — 파랑   #5A95F0
//   · 진행중                       — 주황   #E8A23D
//   · 완료 / 정산완료 / visit_only — 초록   #3DB88A
//   · 취소 / 취소요청               — 회색   #A0A0AA
//
// 배경 alpha = 0.16 (다크/라이트 모두 자연 표시).

export const TASK_STATUS_COLORS = {
  "미배정":      { color: "#FF6FA8", bg: "rgba(255, 111, 168, 0.16)" },
  "배정":        { color: "#3DC6D0", bg: "rgba(61, 198, 208, 0.16)" },
  "약속대기":     { color: "#3DC6D0", bg: "rgba(61, 198, 208, 0.16)" },
  "확정":        { color: "#5A95F0", bg: "rgba(90, 149, 240, 0.16)" },
  "진행중":      { color: "#E8A23D", bg: "rgba(232, 162, 61, 0.16)" },
  "완료":        { color: "#3DB88A", bg: "rgba(61, 184, 138, 0.16)" },
  "정산완료":     { color: "#3DB88A", bg: "rgba(61, 184, 138, 0.16)" },
  "visit_only":  { color: "#3DB88A", bg: "rgba(61, 184, 138, 0.16)" },
  "취소":        { color: "#A0A0AA", bg: "rgba(160, 160, 170, 0.16)" },
  "취소요청":     { color: "#A0A0AA", bg: "rgba(160, 160, 170, 0.16)" },
};

const FALLBACK = { color: "#A0A0AA", bg: "rgba(160, 160, 170, 0.16)" };

export function getTaskStatusColor(status) {
  return TASK_STATUS_COLORS[status] || FALLBACK;
}

// 상태 라벨 — visit_only → "출장비만" 변환, 나머지 그대로 (한국어 DB status).
export function getTaskStatusLabel(status) {
  if (status === "visit_only") return "출장비만";
  return status || "—";
}
