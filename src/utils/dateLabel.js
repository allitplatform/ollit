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

// 2026-05-10 — 시간 표시 헬퍼 (시트의 1899-12-30 같은 Excel epoch 처리)
// 우선순위: ISO("YYYY-MM-DDTHH:MM..") → 1899 prefix → "HH:MM" 직접 → Date 파싱 (1899 제외)
export function formatTimeOnly(value) {
  if (!value && value !== 0) return "";
  const str = String(value).trim();
  if (!str) return "";
  // ISO 형식 ("2026-05-10T14:30:00" / "1899-12-30T12:57:08.000Z")
  if (str.includes("T")) {
    const timePart = str.split("T")[1] || "";
    const m = timePart.match(/^(\d{2}:\d{2})/);
    if (m) return m[1];
  }
  // 1899 prefix (Excel 시간만 셀)
  if (str.startsWith("1899")) {
    const m = str.match(/(\d{2}:\d{2})/);
    if (m) return m[1];
  }
  // "종일" 같은 텍스트
  if (str === "종일") return "";
  // HH:MM 또는 HH:MM:SS 직접
  if (/^\d{2}:\d{2}/.test(str)) return str.slice(0, 5);
  // Date 파싱 fallback (1899년은 무시)
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1899) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return "";
}

// 날짜 표시 헬퍼 (1899 epoch 케이스에서는 빈 값 반환)
// 입력: "2026-05-10" / ISO / Date / 빈 값
// 출력: 한국어 날짜 ("2026. 5. 10.") 또는 ""
export function formatDateOnly(value) {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  // 1899 prefix (Excel 시간만 셀) → 날짜 부분 표시 X
  if (str.startsWith("1899")) return "";
  // ISO 형식 → 날짜 부분 추출
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const datePart = str.slice(0, 10);
    if (datePart.startsWith("1899")) return "";
    const d = new Date(datePart);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1899) {
      return d.toLocaleDateString("ko-KR");
    }
    return datePart;
  }
  // Date 파싱
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1899) {
    return d.toLocaleDateString("ko-KR");
  }
  return "";
}

// "5/15 (목) 14:30" — KST 변환, 한국식 짧은 포맷 (카드 상태 박스 등 좁은 공간)
export function formatScheduleShort(value) {
  if (!value) return "";
  const str = String(value).trim();
  if (!str || str.startsWith("1899")) return "";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mm = kst.getUTCMonth() + 1;
  const dd = kst.getUTCDate();
  const day = ['일','월','화','수','목','금','토'][kst.getUTCDay()];
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${mm}/${dd} (${day}) ${hh}:${mi}`;
}

// "16:00" — KST 변환, 시간만 (HH:MM) — 카드/리스트 좁은 공간
// 빈값/잘못된 입력 → "" (호출처가 fallback 박을 수 있게)
export function formatTimeKST(value) {
  if (!value) return "";
  const str = String(value).trim();
  if (!str || str.startsWith("1899")) return "";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}
