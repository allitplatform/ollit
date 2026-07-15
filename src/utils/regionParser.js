// 2026-07-10 v4 — 자유텍스트 주소 → 지역 파서 (재작성, 사장님 spec).
//   목적: AdminApp "지역별 접수 현황" 뷰용 집계 키.
//
// v3 실패 사례 (온전 토큰 매칭) — v4 정정:
//   ✗ "서울시강동구고덕로333 126동1702호" (공백 없음) → 매칭 실패
//   ✗ "천안시 서북구" → 시도 결손 후 "천안" 매칭까지만 (서북구 세분 미인식)
//   ✗ "가좌로…경남아파트" → 마스킹은 OK, 도로명 미매칭 시 미상
//
// v4 규칙 (사장님 4개 spec):
//   [부분매칭 허용] 공백 없어도 includes 검사.
//   [longest-match] 사전 이름 길이 내림차순 → "서북구" (사전 있으면) 먼저.
//   [시도-시군구 일치] 시도 명시되면 그 시도 안에서만 시군구 검사 → 부산 오탐 방지.
//   [명시 시 최우선] "천안시" 같은 명시 시(市)/군 검출되면 즉시 그 시도 확정.
//   [건물명 마스킹] "경남아파트" 등 접미어 앞 지역어 무시.
//   [도로명 stem] 은평로 → 은평구, 가좌로 → 서대문구 등 소수 대표만.
//   [세분 구 사전] 서북구/동남구(천안), 분당구(성남), 처인구(용인) 등 → 상위 시 매핑.

import { detectFromDong } from "./regionDongMap.js";

// ─────────────────────────────────────────────────────────────
// 시도 keyword — longest form 포함 (서울특별시 > 서울시 > 서울).
//   longest-match 우선 순회를 위해 length desc sort.
// ─────────────────────────────────────────────────────────────
const SIDO_KEYWORD_MAP = {
  "서울": ["서울특별시", "서울시", "서울"],
  "부산": ["부산광역시", "부산시", "부산"],
  "대구": ["대구광역시", "대구시", "대구"],
  "인천": ["인천광역시", "인천시", "인천"],
  "광주": ["광주광역시", "광주시", "광주"], // "광주" 는 경기 광주시와 중복 — 시군구 검사에서 상위 매칭 우선
  "대전": ["대전광역시", "대전시", "대전"],
  "울산": ["울산광역시", "울산시", "울산"],
  "세종": ["세종특별자치시", "세종시", "세종"],
  "경기": ["경기도", "경기"],
  "강원": ["강원특별자치도", "강원도", "강원"],
  "충북": ["충청북도", "충북"],
  "충남": ["충청남도", "충남"],
  "전북": ["전북특별자치도", "전라북도", "전북"],
  "전남": ["전라남도", "전남"],
  "경북": ["경상북도", "경북"],
  "경남": ["경상남도", "경남"],
  "제주": ["제주특별자치도", "제주도", "제주"],
};

// keyword → canonical label (첫 매칭용).
const _SIDO_KW_TO_LABEL = (() => {
  const m = new Map();
  for (const [label, kws] of Object.entries(SIDO_KEYWORD_MAP)) {
    for (const kw of kws) m.set(kw, label);
  }
  return m;
})();
// 길이 내림차순 sort — longest 먼저.
const _SIDO_KEYWORDS_SORTED = [..._SIDO_KW_TO_LABEL.keys()].sort((a, b) => b.length - a.length);

// ─────────────────────────────────────────────────────────────
// 시도별 시군구 (기존, 대소 확장 유지).
// ─────────────────────────────────────────────────────────────
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
    "수원시","성남시","고양시","용인시","부천시","안산시","안양시","남양주시","화성시","평택시",
    "의정부시","시흥시","파주시","김포시","광명시","광주시","군포시","하남시","오산시","이천시",
    "안성시","구리시","의왕시","양주시","포천시","여주시","양평군","가평군","연천군",
    "과천시","동두천시",
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
  "강원": [
    "춘천시","원주시","강릉시","동해시","태백시","속초시","삼척시",
    "홍천군","횡성군","영월군","평창군","정선군","철원군","화천군","양구군","인제군","양양군",
    "고성군",
  ],
  "충북": [
    "청주시","충주시","제천시","보은군","옥천군","영동군","증평군","진천군","괴산군","음성군","단양군",
  ],
  "충남": [
    "천안시","공주시","보령시","아산시","서산시","논산시","계룡시","당진시",
    "금산군","부여군","서천군","청양군","홍성군","예산군","태안군",
  ],
  "전북": [
    "전주시","군산시","익산시","정읍시","남원시","김제시",
    "완주군","진안군","무주군","장수군","임실군","순창군","고창군","부안군",
  ],
  "전남": [
    "목포시","여수시","순천시","나주시","광양시",
    "담양군","곡성군","구례군","고흥군","보성군","화순군","장흥군","강진군","해남군","영암군",
    "무안군","함평군","영광군","장성군","완도군","진도군","신안군",
  ],
  "경북": [
    "포항시","경주시","김천시","안동시","구미시","영주시","영천시","상주시","문경시","경산시",
    "군위군","의성군","청송군","영양군","영덕군","청도군","고령군","성주군","칠곡군","예천군",
    "봉화군","울진군","울릉군",
  ],
  "경남": [
    "창원시","진주시","통영시","사천시","김해시","밀양시","거제시","양산시",
    "의령군","함안군","창녕군","남해군","하동군","산청군","함양군","거창군","합천군",
  ],
  "제주": ["제주시","서귀포시"],
};

// 각 시도별 시군구 이름 length desc 정렬 캐시.
const _SIGUNGU_SORTED_BY_SIDO = (() => {
  const m = {};
  for (const [sido, list] of Object.entries(SIGUNGU_BY_SIDO)) {
    m[sido] = [...list].sort((a, b) => b.length - a.length);
  }
  return m;
})();

// 전 시도 시군구 통합 리스트 (name, sido). length desc.
const _ALL_SIGUNGU_SORTED = (() => {
  const arr = [];
  const seen = new Set();
  for (const sido of Object.keys(SIGUNGU_BY_SIDO)) {
    for (const name of SIGUNGU_BY_SIDO[sido]) {
      const key = name;
      // 중복 이름 (서울 "중구" vs 부산 "중구") 은 첫 등록 시도 우선 (서울 우선).
      if (seen.has(key)) continue;
      seen.add(key);
      arr.push({ name, sido });
    }
  }
  arr.sort((a, b) => b.name.length - a.name.length);
  return arr;
})();

// ─────────────────────────────────────────────────────────────
// 세분 구 사전 — 특정 시의 하위 구 → 상위 { sido, sigungu, district }.
//   longest-match 최우선. "서북구" 가 이 사전에 있으면 "북구" (부산/대구 등) 보다 우선.
// ─────────────────────────────────────────────────────────────
const DISTRICT_TO_REGION = {
  // 천안 (충남)
  "서북구": { sido: "충남", sigungu: "천안시" },
  "동남구": { sido: "충남", sigungu: "천안시" },
  // 청주 (충북)
  "상당구": { sido: "충북", sigungu: "청주시" },
  "서원구": { sido: "충북", sigungu: "청주시" },
  "흥덕구": { sido: "충북", sigungu: "청주시" },
  "청원구": { sido: "충북", sigungu: "청주시" },
  // 수원 (경기)
  "장안구": { sido: "경기", sigungu: "수원시" },
  "팔달구": { sido: "경기", sigungu: "수원시" },
  "권선구": { sido: "경기", sigungu: "수원시" },
  "영통구": { sido: "경기", sigungu: "수원시" },
  // 성남 (경기)
  "수정구": { sido: "경기", sigungu: "성남시" },
  "중원구": { sido: "경기", sigungu: "성남시" },
  "분당구": { sido: "경기", sigungu: "성남시" },
  // 고양 (경기)
  "덕양구":   { sido: "경기", sigungu: "고양시" },
  "일산동구": { sido: "경기", sigungu: "고양시" },
  "일산서구": { sido: "경기", sigungu: "고양시" },
  // 용인 (경기)
  "처인구": { sido: "경기", sigungu: "용인시" },
  "기흥구": { sido: "경기", sigungu: "용인시" },
  "수지구": { sido: "경기", sigungu: "용인시" },
  // 부천 (경기, 옛 3구)
  "원미구": { sido: "경기", sigungu: "부천시" },
  "소사구": { sido: "경기", sigungu: "부천시" },
  "오정구": { sido: "경기", sigungu: "부천시" },
  // 안산 (경기)
  "상록구": { sido: "경기", sigungu: "안산시" },
  "단원구": { sido: "경기", sigungu: "안산시" },
  // 안양 (경기)
  "만안구": { sido: "경기", sigungu: "안양시" },
  "동안구": { sido: "경기", sigungu: "안양시" },
  // 창원 (경남)
  "의창구":     { sido: "경남", sigungu: "창원시" },
  "성산구":     { sido: "경남", sigungu: "창원시" },
  "진해구":     { sido: "경남", sigungu: "창원시" },
  "마산합포구": { sido: "경남", sigungu: "창원시" },
  "마산회원구": { sido: "경남", sigungu: "창원시" },
};
const _DISTRICT_KEYS_SORTED = Object.keys(DISTRICT_TO_REGION).sort((a, b) => b.length - a.length);

// ─────────────────────────────────────────────────────────────
// 도로명 stem — 소수 대표.
// ─────────────────────────────────────────────────────────────
const ROADNAME_TO_GU = {
  "은평로":     { sido: "서울", sigungu: "은평구" },
  "가좌로":     { sido: "서울", sigungu: "서대문구" },
  "종로":       { sido: "서울", sigungu: "종로구" },
  "테헤란로":   { sido: "서울", sigungu: "강남구" },
  "강남대로":   { sido: "서울", sigungu: "강남구" },
  "잠실로":     { sido: "서울", sigungu: "송파구" },
  "잠실대로":   { sido: "서울", sigungu: "송파구" },
  "반포대로":   { sido: "서울", sigungu: "서초구" },
  "서초대로":   { sido: "서울", sigungu: "서초구" },
  "이태원로":   { sido: "서울", sigungu: "용산구" },
  "한남대로":   { sido: "서울", sigungu: "용산구" },
  "이촌로":     { sido: "서울", sigungu: "용산구" },
  "청계천로":   { sido: "서울", sigungu: "중구" },
  "을지로":     { sido: "서울", sigungu: "중구" },
  "명동길":     { sido: "서울", sigungu: "중구" },
  "왕십리로":   { sido: "서울", sigungu: "성동구" },
  "성수이로":   { sido: "서울", sigungu: "성동구" },
  "월드컵로":   { sido: "서울", sigungu: "마포구" },
  "합정로":     { sido: "서울", sigungu: "마포구" },
  "고덕로":     { sido: "서울", sigungu: "강동구" },
  // 2026-07-15 — 사장님 발견: "삼양로 69길" 접수가 지역 "삼양로"로 저장 → 매칭 실패
  "삼양로":     { sido: "서울", sigungu: "강북구" },
  "도봉로":     { sido: "서울", sigungu: "도봉구" },
  "미아로":     { sido: "서울", sigungu: "강북구" },
  "천호대로":   { sido: "서울", sigungu: "강동구" },
};
const _ROADNAME_KEYS_SORTED = Object.keys(ROADNAME_TO_GU).sort((a, b) => b.length - a.length);

// ─────────────────────────────────────────────────────────────
// 서울 구 short (접미 "구" 없는 형태). 접미 "구" 붙어야만 매칭.
// ─────────────────────────────────────────────────────────────
const _SEOUL_GU_WITH_SUFFIX = SIGUNGU_BY_SIDO["서울"].slice().sort((a, b) => b.length - a.length);

// ─────────────────────────────────────────────────────────────
// 건물명 마스킹 접미어.
//   ⚠️ "경남아파트" → 공백 치환 → "경남" 매칭 방지.
// ─────────────────────────────────────────────────────────────
const BUILDING_SUFFIX_RE = /[가-힣A-Za-z0-9]{1,10}(?:아파트|빌라|맨션|타워|오피스텔|상가|빌딩|하이츠|캐슬|파크|프라자|플라자|리버파크|스카이|하우스)/g;

function _preprocess(addr) {
  const s = String(addr || "").trim();
  if (!s) return "";
  return s.replace(BUILDING_SUFFIX_RE, m => " ".repeat(m.length));
}

// ─────────────────────────────────────────────────────────────
// 검출 함수들 (모두 includes + longest-match).
// ─────────────────────────────────────────────────────────────

// 시도 keyword.
function _detectSido(s) {
  for (const kw of _SIDO_KEYWORDS_SORTED) {
    if (s.includes(kw)) return _SIDO_KW_TO_LABEL.get(kw);
  }
  return "";
}

// 세분 구 (longest-match).
function _detectDistrict(s) {
  for (const name of _DISTRICT_KEYS_SORTED) {
    if (s.includes(name)) return { name, ...DISTRICT_TO_REGION[name] };
  }
  return null;
}

// 특정 시도 안 시군구 (longest-match).
function _detectSigunguIn(s, sido) {
  const list = _SIGUNGU_SORTED_BY_SIDO[sido];
  if (!list) return "";
  for (const name of list) {
    if (s.includes(name)) return name;
  }
  return "";
}

// 전 시도 시군구 스캔 (longest-match, 중복 이름은 첫 등록 시도 우선).
function _detectSigunguGlobal(s) {
  for (const { name, sido } of _ALL_SIGUNGU_SORTED) {
    if (s.includes(name)) return { sido, sigungu: name };
  }
  return null;
}

// 서울 구 short (접미 "구" 필수).
function _detectSeoulGuShort(s) {
  for (const gu of _SEOUL_GU_WITH_SUFFIX) {
    if (s.includes(gu)) return gu;
  }
  return "";
}

// 도로명 stem (longest-match).
function _detectRoadname(s) {
  for (const road of _ROADNAME_KEYS_SORTED) {
    if (s.includes(road)) return { name: road, ...ROADNAME_TO_GU[road] };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 통합 파이프라인.
//   시도 명시 → 그 시도 안 세분 구 / 시군구 / 도로명.
//   시도 결손 → 세분 구 → 전 시도 시군구 → 서울 구 short → 도로명 → 동 사전.
// ─────────────────────────────────────────────────────────────
function _extractRegion(rawAddr) {
  const s = _preprocess(rawAddr);
  if (!s) return null;

  const sido = _detectSido(s);

  if (sido) {
    // [1] 세분 구 우선 (같은 시도만 인정).
    const disHit = _detectDistrict(s);
    if (disHit && disHit.sido === sido) {
      return { sido, sigungu: disHit.sigungu, district: disHit.name };
    }
    // [2] 그 시도 안 시군구.
    const sg = _detectSigunguIn(s, sido);
    if (sg) return { sido, sigungu: sg };
    // [3] 도로명 stem (같은 시도만).
    const road = _detectRoadname(s);
    if (road && road.sido === sido) {
      return { sido, sigungu: road.sigungu };
    }
    return { sido, sigungu: "" };
  }

  // 시도 결손.
  // [4] 세분 구 (그 자체가 시도 결정 → 명시 시(市) 최우선 취급).
  const disHit = _detectDistrict(s);
  if (disHit) {
    return { sido: disHit.sido, sigungu: disHit.sigungu, district: disHit.name };
  }
  // [5] 전 시도 시군구 스캔 (명시 시(市)/군 매칭 시 그 시도 확정).
  const sgGlobal = _detectSigunguGlobal(s);
  if (sgGlobal) return sgGlobal;
  // [6] 서울 구 short.
  const seoulGu = _detectSeoulGuShort(s);
  if (seoulGu) return { sido: "서울", sigungu: seoulGu };
  // [7] 도로명 stem.
  const road = _detectRoadname(s);
  if (road) return { sido: road.sido, sigungu: road.sigungu };
  // [8] 동 사전.
  const dong = detectFromDong(s);
  if (dong && dong.sido && dong.sigungu) {
    return { sido: dong.sido, sigungu: dong.sigungu };
  }
  return null;
}

// 최종 export — { sido, sigungu, district?, key, label }.
export function parseRegion(addr) {
  const hit = _extractRegion(addr);
  if (!hit) return { sido: "", sigungu: "", key: "미상", label: "미상" };
  const { sido, sigungu, district } = hit;
  if (sigungu) {
    const label = district ? `${sido} ${sigungu} ${district}` : `${sido} ${sigungu}`;
    return { sido, sigungu, district: district || "", key: label, label };
  }
  return { sido, sigungu: "", district: "", key: sido, label: sido };
}

// 시도만 집계 key.
export function regionSidoOnly(addr) {
  const hit = _extractRegion(addr);
  if (!hit || !hit.sido) return "미상";
  return hit.sido;
}
