// 2026-10-06 — 담당 지역 권역 묶음 (표시 요약 + 수정 화면의 한 번에 선택).
//   저장은 지금처럼 개별 시·군·구 이름 그대로 한다. 배정 추천 계산도 개별 지역 기준 — 여기는 "보여 주기" 와 "고르기" 만.
//   묶음표는 화이트코어 등록 때 쓴 표(db/ops/register_whitecore_staff_261006.sql)와 같다.

export const SEOUL = [
  "강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구",
  "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구",
  "용산구", "은평구", "종로구", "중구", "중랑구",
];
export const GYEONGGI = [
  "수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시",
  "의정부시", "시흥시", "파주시", "김포시", "광명시", "광주시", "군포시", "하남시", "오산시", "이천시",
  "안성시", "구리시", "의왕시", "양주시", "포천시", "여주시", "양평군", "가평군", "연천군", "과천시",
  "동두천시",
];
export const GYEONGGI_SOUTH = ["수원시", "화성시", "용인시", "안양시", "군포시", "의왕시", "과천시", "안산시", "평택시", "오산시", "안성시"];
export const GYEONGGI_EAST  = ["성남시", "용인시", "하남시", "남양주시", "구리시", "이천시", "광주시", "여주시", "양평군", "가평군"];
export const GYEONGGI_NORTH = ["고양시", "파주시", "의정부시", "양주시", "동두천시", "포천시", "연천군", "남양주시", "구리시", "가평군"];
// 인천: 등록 때 쓴 6개 구 (중구·동구는 서울 구 이름과 겹치고, 강화군·옹진군은 제외했었다)
export const INCHEON = ["계양구", "부평구", "서구", "남동구", "연수구", "미추홀구"];

// 수정 화면의 권역 버튼
export const ZONE_GROUPS = [
  { key: "seoul",  label: "서울 전체", zones: SEOUL },
  { key: "gsouth", label: "경기남부",  zones: GYEONGGI_SOUTH },
  { key: "geast",  label: "경기동부",  zones: GYEONGGI_EAST },
  { key: "gnorth", label: "경기북부",  zones: GYEONGGI_NORTH },
  { key: "incheon", label: "인천",     zones: INCHEON },
];

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// 요약 조각 — ["서울 전체", "경기 31곳"] / ["인천 6곳"] / ["경기남부 11곳"]
export function zoneSummaryParts(zones) {
  const list = [...new Set((zones || []).map(z => String(z || "").trim()).filter(Boolean))];
  if (list.length === 0) return [];
  const seoul = list.filter(z => SEOUL.includes(z));
  const gg = list.filter(z => GYEONGGI.includes(z));
  const ic = list.filter(z => !SEOUL.includes(z) && INCHEON.includes(z));
  const etc = list.filter(z => !SEOUL.includes(z) && !GYEONGGI.includes(z) && !INCHEON.includes(z));
  const parts = [];
  if (seoul.length > 0) parts.push(seoul.length === SEOUL.length ? "서울 전체" : `서울 ${seoul.length}곳`);
  if (gg.length > 0) {
    const named = sameSet(gg, GYEONGGI_SOUTH) ? "경기남부" : sameSet(gg, GYEONGGI_EAST) ? "경기동부" : sameSet(gg, GYEONGGI_NORTH) ? "경기북부" : "경기";
    parts.push(`${named} ${gg.length}곳`);
  }
  if (ic.length > 0) parts.push(`인천 ${ic.length}곳`);
  if (etc.length > 0) parts.push(etc.length <= 2 ? etc.join("·") : `그 외 ${etc.length}곳`);
  return parts;
}

// 한 줄 글자. 지역이 3곳 이하면 이름을 그대로 보여 준다.
export function zoneSummaryText(zones) {
  const list = [...new Set((zones || []).filter(Boolean))];
  if (list.length === 0) return "";
  if (list.length <= 3) return list.join("·");
  return zoneSummaryParts(list).join(" · ");
}
