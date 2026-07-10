// 2026-07-10 — 자유텍스트 주소 → 지역 (시도 / 시군구) 관대 파싱.
//   목적: AdminApp "지역별 접수 현황" 뷰용 집계 키 생성.
//   전략:
//     1. 시도 keyword startsWith / includes 매칭 (17개 광역시·도)
//     2. 시도별 시군구 사전 매칭 (서울 25구 / 인천 10구 / 경기 주요 시)
//     3. 시도 미명시 시 시군구 → 상위 시도 역추론 + 서울 구 short.
//     4. 시도·시군구 다 못 잡으면 → 동 사전 (regionDongMap) 최종 시도.
//     5. 그래도 못 잡으면 "미상".
//   ⚠️ 완벽 파싱 목표 X — 부실 텍스트 관대 처리.

import { detectFromDong } from "./regionDongMap.js";

const SIDO_KEYWORDS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// 시도 short → 표시 라벨.
const SIDO_LABEL = {
  "서울": "서울", "부산": "부산", "대구": "대구", "인천": "인천",
  "광주": "광주", "대전": "대전", "울산": "울산", "세종": "세종",
  "경기": "경기", "강원": "강원", "충북": "충북", "충남": "충남",
  "전북": "전북", "전남": "전남", "경북": "경북", "경남": "경남",
  "제주": "제주",
};

// 시도별 시군구 (관대 매칭용).
const SIGUNGU_BY_SIDO = {
  "서울": [
    "강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구",
    "노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구",
    "성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구",
  ],
  "인천": [
    "중구","동구","미추홀구","연수구","남동구","부평구","계양구","서구","강화군","옹진군",
  ],
  "경기": [
    "수원","성남","고양","용인","부천","안산","안양","남양주","화성","평택",
    "의정부","시흥","파주","김포","광명","광주","군포","하남","오산","이천",
    "안성","구리","의왕","양주","포천","여주","양평","가평","연천",
    // 2026-07-10 — 누락 시·군 보강.
    "과천","동두천",
  ],
  "부산": [
    "중구","서구","동구","영도구","부산진구","동래구","남구","북구","해운대구",
    "사하구","금정구","강서구","연제구","수영구","사상구","기장군",
  ],
  "대구": [
    "중구","동구","서구","남구","북구","수성구","달서구","달성군","군위군",
  ],
  "광주": ["동구","서구","남구","북구","광산구"],
  "대전": ["동구","중구","서구","유성구","대덕구"],
  "울산": ["중구","남구","동구","북구","울주군"],
  "세종": ["세종"],
  // 2026-07-10 — 강원/충북/충남/전북/전남/경북/경남 전 시군 확장.
  "강원": [
    "춘천","원주","강릉","동해","태백","속초","삼척",
    "홍천","횡성","영월","평창","정선","철원","화천","양구","인제","양양",
    // ⚠️ "고성" 은 강원 + 경남 중복 — SIGUNGU_TO_SIDO 역추론에서 첫 매칭 우선.
    "고성",
  ],
  "충북": [
    "청주","충주","제천","보은","옥천","영동","증평","진천","괴산","음성","단양",
  ],
  "충남": [
    "천안","공주","보령","아산","서산","논산","계룡","당진",
    "금산","부여","서천","청양","홍성","예산","태안",
  ],
  "전북": [
    "전주","군산","익산","정읍","남원","김제",
    "완주","진안","무주","장수","임실","순창","고창","부안",
  ],
  "전남": [
    "목포","여수","순천","나주","광양",
    "담양","곡성","구례","고흥","보성","화순","장흥","강진","해남","영암",
    "무안","함평","영광","장성","완도","진도","신안",
  ],
  "경북": [
    "포항","경주","김천","안동","구미","영주","영천","상주","문경","경산",
    "군위","의성","청송","영양","영덕","청도","고령","성주","칠곡","예천",
    "봉화","울진","울릉",
  ],
  "경남": [
    "창원","진주","통영","사천","김해","밀양","거제","양산",
    "의령","함안","창녕","남해","하동","산청","함양","거창","합천",
    // "고성" 은 위 강원에 우선 등록 (중복 배제).
  ],
  "제주": ["제주시","서귀포시"],
};

// 2026-07-10 — 축약/역추론용 사전 (한 번만 빌드).
//   서울 25구의 접미 "구" 를 제거한 short form ("마포", "강남", ...).
//   시도 미명시 + 서울 구 short 만 있는 경우 서울로 판정.
const _SEOUL_GU_SHORT = SIGUNGU_BY_SIDO["서울"].map(g => g.replace(/구$/, ""));
// 시군구 → 상위 시도 역맵. 중복 이름 (예: 서울/부산/인천 "중구") 은 첫 매칭 시도로 배정.
//   ⚠️ 이 매핑은 "시도 keyword 못 잡을 때만" fallback 으로 사용 (부정확 감수).
const _SIGUNGU_TO_SIDO = (() => {
  const m = new Map();
  for (const sido of Object.keys(SIGUNGU_BY_SIDO)) {
    for (const name of SIGUNGU_BY_SIDO[sido]) {
      if (!m.has(name)) m.set(name, sido);
    }
  }
  return m;
})();

// 시도 판정 — 주소 문자열 첫 매칭. 못 잡으면 역추론 (시군구 → 상위 시도).
function _detectSido(addr) {
  const s = String(addr || "").trim();
  if (!s) return "";
  for (const k of SIDO_KEYWORDS) {
    // 사전 정규화 없이 includes — 부실 텍스트 관대. 서울특별시/부산광역시 등 접미 포함해도 매칭.
    if (s.includes(k)) return SIDO_LABEL[k] || k;
  }
  // 2026-07-10 — 시도 명시 없음 → 역추론:
  //   1) 서울 구 short ("마포", "강남" 등) 만 있어도 서울로.
  //   2) 시군구 사전에 있는 이름 (예: "수원", "성남") 이면 상위 시도로.
  for (const short of _SEOUL_GU_SHORT) {
    if (!short) continue;
    if (s.includes(short + "구")) return "서울";
    if (s.includes(short))        return "서울";
  }
  for (const [name, sido] of _SIGUNGU_TO_SIDO.entries()) {
    if (s.includes(name)) return sido;
  }
  return "";
}

// 시군구 판정 — sido 후보에 대해 시군구 목록 검색. 못 잡으면 "".
//   ⚠️ 서울 25구 는 정확히 "○○구" 로 매칭. 경기 시는 "○○시" 옵션도 매칭.
function _detectSigungu(addr, sido) {
  const s = String(addr || "").trim();
  if (!s || !sido) return "";
  const list = SIGUNGU_BY_SIDO[sido];
  if (!list) return "";
  for (const name of list) {
    if (s.includes(name)) return name;
    // 경기 "수원시" 대비 "수원" 도 매칭
    if (!name.endsWith("구") && !name.endsWith("시") && !name.endsWith("군")) continue;
    // 이미 endsWith 검사 없이 includes 매칭 됐으므로 fallthrough 없음.
  }
  return "";
}

// 최종 export — 자유텍스트 주소 → { sido, sigungu, key, label }.
//   key   = 집계용 canonical (예: "서울 강남구", 못 잡으면 "미상")
//   label = 화면 표시용 (동일 규칙)
//   2026-07-10 — 시도·시군구 다 못 잡으면 동 사전 (regionDongMap) 최종 시도.
export function parseRegion(addr) {
  const sido = _detectSido(addr);
  if (sido) {
    const sigungu = _detectSigungu(addr, sido);
    if (sigungu) {
      return { sido, sigungu, key: `${sido} ${sigungu}`, label: `${sido} ${sigungu}` };
    }
    return { sido, sigungu: "", key: sido, label: sido };
  }
  // 시도 결손 → 동 사전 fallback (성산동 → 마포구 등).
  const dongHit = detectFromDong(addr);
  if (dongHit && dongHit.sido && dongHit.sigungu) {
    return {
      sido:    dongHit.sido,
      sigungu: dongHit.sigungu,
      key:     `${dongHit.sido} ${dongHit.sigungu}`,
      label:   `${dongHit.sido} ${dongHit.sigungu}`,
    };
  }
  return { sido: "", sigungu: "", key: "미상", label: "미상" };
}

// 시도만 집계 key.
export function regionSidoOnly(addr) {
  const sido = _detectSido(addr);
  return sido || "미상";
}
