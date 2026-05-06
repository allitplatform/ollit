// V14 v6 — 날짜 라벨 헬퍼 (사장님 spec)
// 모든 작업 카드 / 화면에 일관된 날짜 표시
// 예: "5월 6일 (수) · 오늘" / "5월 7일 (목) · 내일" / "5월 8일 (금) · 모레"

const DAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

function ymdToDate(ymd) {
  if (!ymd) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 두 ymd 사이의 일 수 차이 (positive = 미래, negative = 과거)
function dayDiff(ymd) {
  const today = ymdToDate(todayYmd());
  const target = ymdToDate(ymd);
  if (!today || !target) return null;
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// 상대 라벨 (오늘 / 어제 / 내일 / 모레 / 그저께)
export function relativeLabel(ymd) {
  const diff = dayDiff(ymd);
  if (diff === null) return "";
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === 2) return "모레";
  if (diff === -1) return "어제";
  if (diff === -2) return "그저께";
  return "";
}

// "5월 7일 (목)" 형식
export function fullDateLabel(ymd) {
  const date = ymdToDate(ymd);
  if (!date) return "";
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}월 ${d}일 (${DAYS_KR[date.getDay()]})`;
}

// "5월 7일 (목) · 내일" 풀 라벨 (작업 카드 / 헤더)
export function workDateLabel(ymd) {
  const full = fullDateLabel(ymd);
  const rel  = relativeLabel(ymd);
  if (!full) return "";
  return rel ? `${full} · ${rel}` : full;
}

// 색 토큰 (오늘 핑크 / 미래 회색 / 과거 옅은 회색)
export function workDateColor(ymd) {
  const diff = dayDiff(ymd);
  if (diff === null) return "var(--text-secondary)";
  if (diff === 0) return "#FF1B8D";
  if (diff > 0)   return "var(--text-secondary, #555)";
  return "var(--text-tertiary, #999)";
}
