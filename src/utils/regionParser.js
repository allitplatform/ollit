// 2026-07-10 — 자유텍스트 주소 → 지역 (시도 / 시군구) 관대 파싱.
//   목적: AdminApp "지역별 접수 현황" 뷰용 집계 키 생성.
//
// v3 (2026-07-10) — 오탐 정정:
//   1) 부분매칭 → 온전한 토큰 매칭 (한글 word boundary).
//      "천안시 서북구" 안 "북구" 로 부산 배정 사고 방지.
//   2) 명시 시(市) 최우선. "천안시" 매칭 시 시군구·역추론 skip → 충남 배정.
//   3) 건물명 마스킹 ("경남아파트" 안 "경남" 무시).
//   4) 도로명 stem 매핑 (은평로 → 은평구 등 소수 대표만).
//   5) 시도 명시 없는 애매 역추론은 다른 단서 전무 시에만.
//
// 판정 파이프라인 (parseRegion):
//   [전처리] 건물명 마스킹.
//   [1]     시군구 온전 토큰 매칭 (전 시도) — 명시 시/군/구 최우선.
//   [2]     시도 keyword 온전 토큰 매칭 (접미 특별시/광역시/도 허용).
//           → 시도 + 시군구(같은 시도 안) 조합.
//   [3]     서울 구 short ("마포" 등) 온전 토큰.
//   [4]     도로명 stem 매핑 (은평로 등).
//   [5]     동 사전 (regionDongMap) 온전 토큰.
//   [6]     미상.

import { detectFromDong } from "./regionDongMap.js";

const SIDO_KEYWORDS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const SIDO_LABEL = {
  "서울": "서울", "부산": "부산", "대구": "대구", "인천": "인천",
  "광주": "광주", "대전": "대전", "울산": "울산", "세종": "세종",
  "경기": "경기", "강원": "강원", "충북": "충북", "충남": "충남",
  "전북": "전북", "전남": "전남", "경북": "경북", "경남": "경남",
  "제주": "제주",
};

// 시도 keyword 뒤에 붙을 수 있는 접미 (특별시/광역시/도/시 등).
//   토큰 매칭 시 이 접미 허용.
const _SIDO_SUFFIX = {
  "서울": "(?:특별시|시)?",
  "부산": "(?:광역시|시)?",
  "대구": "(?:광역시|시)?",
  "인천": "(?:광역시|시)?",
  "광주": "(?:광역시|시)?",
  "대전": "(?:광역시|시)?",
  "울산": "(?:광역시|시)?",
  "세종": "(?:특별자치시|시)?",
  "경기": "(?:도)?",
  "강원": "(?:특별자치도|도)?",
  "충북": "(?:도)?",
  "충남": "(?:도)?",
  "전북": "(?:특별자치도|도)?",
  "전남": "(?:도)?",
  "경북": "(?:도)?",
  "경남": "(?:도)?",
  "제주": "(?:특별자치도|도)?",
};

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
  "강원": [
    "춘천","원주","강릉","동해","태백","속초","삼척",
    "홍천","횡성","영월","평창","정선","철원","화천","양구","인제","양양","고성",
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
  ],
  "제주": ["제주시","서귀포시"],
};

const _SEOUL_GU_SHORT = SIGUNGU_BY_SIDO["서울"].map(g => g.replace(/구$/, ""));

// 도로명 stem 매핑 (대표 소수만). 명확한 것만.
//   ⚠️ 동명 겹침 대비 실질적으로 안전한 것만 (동/구별칭 겸용 흔한 것).
const ROADNAME_TO_GU = {
  "은평로":     { sido: "서울", sigungu: "은평구" },
  "가좌로":     { sido: "서울", sigungu: "서대문구" },
  "종로":       { sido: "서울", sigungu: "종로구" },
  "테헤란로":   { sido: "서울", sigungu: "강남구" },
  "강남대로":   { sido: "서울", sigungu: "강남구" },
  "신사동길":   { sido: "서울", sigungu: "강남구" },
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
  "성수이로":   { sido: "서울", sigungu: "성동구" },
  "왕십리로":   { sido: "서울", sigungu: "성동구" },
  "홍대입구":   { sido: "서울", sigungu: "마포구" },
  "월드컵로":   { sido: "서울", sigungu: "마포구" },
  "합정로":     { sido: "서울", sigungu: "마포구" },
  "여의도동":   { sido: "서울", sigungu: "영등포구" },
};

// 건물명 마스킹 접미어 (건물명 앞 지역어 무시용).
const BUILDING_SUFFIX_RE = /[가-힣A-Za-z0-9]{1,10}(?:아파트|빌라|맨션|타워|오피스텔|상가|빌딩|하이츠|캐슬|파크|프라자|플라자|리버파크|스카이|하우스)/g;

// 정규식 이스케이프 (한글은 무해).
function _reEscape(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 한글 word boundary 흉내 — 앞뒤 한글 없어야 온전한 토큰.
//   전문자 (?<![가-힣])name(?![가-힣]) 를 문자열 검색으로 대체.
function _matchToken(s, name, suffix = "") {
  const re = new RegExp("(?<![가-힣])" + _reEscape(name) + suffix + "(?![가-힣])");
  return re.test(s);
}

// 전처리: 건물명 마스킹 + 정규화.
//   "경남아파트" → "         " 로 대체하여 "경남" 오탐 방지.
function _preprocess(addr) {
  const s = String(addr || "").trim();
  if (!s) return "";
  return s.replace(BUILDING_SUFFIX_RE, m => " ".repeat(m.length));
}

// 시도 판정 — 온전 토큰 매칭. 접미 특별시/광역시/도/시 허용.
function _detectSido(s) {
  if (!s) return "";
  for (const k of SIDO_KEYWORDS) {
    const suf = _SIDO_SUFFIX[k] || "";
    if (_matchToken(s, k, suf)) return SIDO_LABEL[k] || k;
  }
  return "";
}

// 시군구 판정 — sido 안 목록에서 온전 토큰 매칭. 접미 없는 이름은 시/군 옵션 허용.
function _detectSigungu(s, sido) {
  if (!s || !sido) return "";
  const list = SIGUNGU_BY_SIDO[sido];
  if (!list) return "";
  for (const name of list) {
    const suffix = /[시군구]$/.test(name) ? "" : "(?:시|군)?";
    if (_matchToken(s, name, suffix)) return /[시군구]$/.test(name) ? name : (name + "시");
  }
  return "";
}

// 전 시도 시군구 사전 스캔 — 명시 시(市) 최우선.
//   반환: { sido, sigungu } | null
function _detectSigunguGlobal(s) {
  if (!s) return null;
  for (const sido of Object.keys(SIGUNGU_BY_SIDO)) {
    for (const name of SIGUNGU_BY_SIDO[sido]) {
      const suffix = /[시군구]$/.test(name) ? "" : "(?:시|군)?";
      if (_matchToken(s, name, suffix)) {
        return { sido, sigungu: /[시군구]$/.test(name) ? name : (name + "시") };
      }
    }
  }
  return null;
}

// 도로명 stem 매칭 (온전 토큰).
function _detectRoadname(s) {
  if (!s) return null;
  for (const road of Object.keys(ROADNAME_TO_GU)) {
    if (_matchToken(s, road)) return ROADNAME_TO_GU[road];
  }
  return null;
}

// 서울 구 short (접미 "구" 없는 형태) 온전 토큰.
function _detectSeoulGuShort(s) {
  if (!s) return "";
  for (const short of _SEOUL_GU_SHORT) {
    if (!short) continue;
    // 접미 "구" 는 optional. 서울 구 short 는 반드시 "구" 붙여야 온전 (예: "마포구").
    // 접미 "구" 없이 "마포" 만 있으면 다른 지명일 수 있음 (예: 마포대교) — 이 fallback 은 신중.
    if (_matchToken(s, short + "구")) return short + "구";
  }
  return "";
}

// 최종 export — 자유텍스트 주소 → { sido, sigungu, key, label }.
export function parseRegion(addr) {
  const raw = _preprocess(addr);
  if (!raw) return { sido: "", sigungu: "", key: "미상", label: "미상" };

  // [1] 시도 명시 → 그 시도 안 시군구 매칭 시도. 시도 매칭됐지만 시군구 못 잡으면 시도만.
  const sido = _detectSido(raw);
  if (sido) {
    const sigungu = _detectSigungu(raw, sido);
    if (sigungu) {
      return { sido, sigungu, key: `${sido} ${sigungu}`, label: `${sido} ${sigungu}` };
    }
    // 시도만 잡힌 상태에서 도로명 stem 시도 (서울 은평로 등).
    const road = _detectRoadname(raw);
    if (road && road.sido === sido) {
      return { sido, sigungu: road.sigungu, key: `${sido} ${road.sigungu}`, label: `${sido} ${road.sigungu}` };
    }
    return { sido, sigungu: "", key: sido, label: sido };
  }

  // [2] 시도 결손 — 명시 시(市)/군 최우선 (전 시도 온전 토큰 스캔).
  const globalHit = _detectSigunguGlobal(raw);
  if (globalHit) {
    return {
      sido:    globalHit.sido,
      sigungu: globalHit.sigungu,
      key:     `${globalHit.sido} ${globalHit.sigungu}`,
      label:   `${globalHit.sido} ${globalHit.sigungu}`,
    };
  }

  // [3] 서울 구 short (접미 "구" 필수).
  const seoulGu = _detectSeoulGuShort(raw);
  if (seoulGu) {
    return { sido: "서울", sigungu: seoulGu, key: `서울 ${seoulGu}`, label: `서울 ${seoulGu}` };
  }

  // [4] 도로명 stem.
  const road = _detectRoadname(raw);
  if (road) {
    return { sido: road.sido, sigungu: road.sigungu, key: `${road.sido} ${road.sigungu}`, label: `${road.sido} ${road.sigungu}` };
  }

  // [5] 동 사전 fallback.
  const dongHit = detectFromDong(raw);
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
  const raw = _preprocess(addr);
  const sido = _detectSido(raw);
  if (sido) return sido;
  const globalHit = _detectSigunguGlobal(raw);
  if (globalHit) return globalHit.sido;
  return "미상";
}
