// 원청 (KA / crikrin) 붙여넣기 메시지 파서.
//
// 사용:
//   import { parsePartnerPaste, APPLIANCE_CODE_TO_LABEL } from "src/utils/partnerPasteParser";
//   const records = parsePartnerPaste(text, "KA" | "crikrin");
//
// 출력 (배열):
//   {
//     customerName: "",              // KA = "" 기본 / crikrin = 추출값
//     phone:        "010-1234-5678", // null = 못 찾음
//     address:      "서울 강남구 ...", // 빈 문자열 가능
//     items: [{ appliance, qty, price? }],  // appliance = 코드 (wall/stand/1way/2in1/4way) 또는 null = 불명
//     desiredText:  "4/23 오후",     // null 가능
//     memo:         "현장결제",      // null 가능
//     workType:     "냉매충전",
//   }
//
// KA: 빈 줄로 건 분리 → 여러 record 가능.
// crikrin: 라벨형 or 휴리스틱 → 단일 record (빈 줄 있어도 분리 X).
//
// ⚠️ 절대 자동 제출 X. 폼 prefill 후 사람이 검토·수정·제출.

// ─── 전화 정규식 — 휴대폰 + 일반전화(지역번호) ─────────────────
//   2026-06-06 — '029216483' 같은 일반전화 인식 추가.
//   인식 spec: 0 시작 + 디지트(구분자 무시) 9~11자리:
//     · 010~019 (휴대폰) — 10 or 11
//     · 02 (서울)        — 9 or 10
//     · 0XX (3자리 지역)  — 10 or 11 (031~064 / 070 인터넷 / 050X 등)
//     · +82 변환 시 leading 0 복원.
//   ⚠️ 주소 번지·가격·'2층'·'70.000' 같은 짧은 숫자 또는 0으로 시작 안 하는 숫자는 매칭 X.
//   ⚠️ (?<!\d) lookbehind — '20240228' 같은 디지트 임베드 false-positive 차단.
const PHONE_CANDIDATE_RE      = /\+?82[-.\s]?(?:0)?10(?:[-.\s]?\d){7,9}|(?<!\d)0\d(?:[-.\s]?\d){7,9}/g;
const PHONE_CANDIDATE_TEST_RE = /\+?82[-.\s]?(?:0)?10(?:[-.\s]?\d){7,9}|(?<!\d)0\d(?:[-.\s]?\d){7,9}/;
const PHONE_STRIP_RE          = /\+?82[-.\s]?(?:0)?10(?:[-.\s]?\d){7,9}|(?<!\d)0\d(?:[-.\s]?\d){7,9}/g;

function fmtPhone(digits) {
  const d = String(digits || "").replace(/\D/g, "");
  // 휴대폰 (010~019) — 10 or 11
  if (/^01[016789]/.test(d) && (d.length === 10 || d.length === 11)) {
    const mid = d.length === 11 ? 4 : 3;
    return `${d.slice(0,3)}-${d.slice(3, 3+mid)}-${d.slice(3+mid)}`;
  }
  // 서울 02 — 9 or 10
  if (d.startsWith("02") && (d.length === 9 || d.length === 10)) {
    const mid = d.length === 10 ? 4 : 3;
    return `02-${d.slice(2, 2+mid)}-${d.slice(2+mid)}`;
  }
  // 0XX 3자리 지역 (031~064 / 070 / 050X 등) — 10 or 11
  if (/^0\d{2}/.test(d) && (d.length === 10 || d.length === 11)) {
    const mid = d.length === 11 ? 4 : 3;
    return `${d.slice(0,3)}-${d.slice(3, 3+mid)}-${d.slice(3+mid)}`;
  }
  return d;
}

export function extractPhone(text) {
  if (!text) return null;
  const s = String(text);
  for (const m of s.matchAll(PHONE_CANDIDATE_RE)) {
    let raw = m[0];
    // +82 → 0 (leading 0 복원)
    raw = raw.replace(/^\+?82[-.\s]?/, "0");
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 11) continue;
    if (digits[0] !== '0') continue;
    return fmtPhone(digits);
  }
  return null;
}

function hasPhone(line) {
  return PHONE_CANDIDATE_TEST_RE.test(String(line || ""));
}

// ─── 기종 매핑 ────────────────────────────────────────────────
//   코드 (wall/stand/1way/2in1/4way) — 폼 표시 라벨은 APPLIANCE_CODE_TO_LABEL 로 변환.
//   우선순위: 더 구체 패턴 먼저 (4way/투인원 → 벽걸이/스탠드 보다 위).
const APPLIANCE_PATTERNS = [
  { re: /4\s*way|4웨이|포웨이|사way/i,                code: "4way" },
  { re: /원\s*웨이|1\s*way|1\s*웨이|천\s*장\s*형/i,    code: "1way" },
  { re: /투\s*인\s*원|2\s*in\s*1|투인일/i,             code: "2in1" },
  { re: /스\s*탠\s*드/,                                code: "stand" },
  { re: /벽\s*걸\s*이/,                                code: "wall" },
];

// 2026-06-06 — 브랜드명 → 기종 추정 (fallback 전용).
//   명시적 기종 키워드 (위 APPLIANCE_PATTERNS) 가 없을 때만 적용.
//   위니아 = 대부분 벽걸이 (사장님 운영 spec). 다른 브랜드 (삼성/LG/캐리어 등) 는
//   기종이 다양해 추정 X — 빈 라벨 유지 → 폼 측 사람이 직접 선택.
const BRAND_FALLBACK_PATTERNS = [
  { re: /위\s*니\s*아/, code: "wall" },
];

// 2026-06-06 — KA 약어 패턴 (벽/스/천/투). 단어 경계 (앞: 시작 or .·, 뒤: 끝 or .·).
//   ⚠️ 오탐 방지: detectAppliance 에서 가.충/충전 키워드 또는 가격 토큰 있을 때만 시도.
//   '천' 은 '천장' 까지 허용 (천장형 명시 패턴과 별도, '천장 가.충' 같이 짧게 쓴 경우).
const SHORTHAND_PATTERNS = [
  { re: /(?:^|[\s.,])벽(?=[\s.,]|$)/,    code: "wall"  },
  { re: /(?:^|[\s.,])스(?=[\s.,]|$)/,    code: "stand" },
  { re: /(?:^|[\s.,])천(?=[\s.,]|장|$)/, code: "1way"  },
  { re: /(?:^|[\s.,])투(?=[\s.,]|$)/,    code: "2in1"  },
];

// 전체 stripping용 (명시 + 약어). 명시는 case-insensitive, 약어는 한글이라 일반.
const APPLIANCE_STRIP_RES = APPLIANCE_PATTERNS.map(ap => new RegExp(ap.re.source, "gi"));
const SHORTHAND_STRIP_RES = SHORTHAND_PATTERNS.map(ap => new RegExp(ap.re.source, "g"));

// 2026-06-06 — 가충 마커 확장 패턴.
//   가스충전 / 가충 / 가.충 / 가 충 / 가.충. / .가.충 / 스 떼면 가스 / 충전 등 변형 전부.
//   기종에 붙은 '스탠드가.충' / '벽걸이가.충70.000' 도 분리.
const REFRIG_MARKER_TEST_RE  = /가\s*[.\s]*스?[.\s]*충(?:\s*전)?/;
const REFRIG_MARKER_STRIP_RE = /가\s*[.\s]*스?[.\s]*충(?:\s*전)?/g;

function hasRefrigerantKeyword(line) {
  return REFRIG_MARKER_TEST_RE.test(String(line || ""));
}
function stripRefrigMarker(s) {
  return String(s || "").replace(REFRIG_MARKER_STRIP_RE, " ");
}
function hasPriceToken(line) {
  const s = String(line || "").replace(/가\s*\.?\s*충/g, " ");
  return /\d{1,3}(?:[.,]\d{3})+|\d+\s*만(?:원)?|\d{4,}\s*원|\b\d{5,}\b/.test(s);
}

// 코드 → 폼 appliancePool 라벨. PARTNER_PWA_CONFIG.appliancePool 키와 일치.
export const APPLIANCE_CODE_TO_LABEL = {
  wall:   "벽걸이",
  stand:  "스탠드",
  "1way": "1way",
  "2in1": "투인원",
  "4way": "4way",
};

function detectAppliance(line) {
  // 1) 명시적 기종 키워드 우선.
  for (const ap of APPLIANCE_PATTERNS) {
    if (ap.re.test(line)) return ap.code;
  }
  // 2) 브랜드 추정 fallback — 명시적 기종 없을 때만.
  for (const ap of BRAND_FALLBACK_PATTERNS) {
    if (ap.re.test(line)) return ap.code;
  }
  // 3) KA 약어 — 가.충/충전 키워드 또는 가격 토큰 있을 때만 (오탐 방지).
  if (hasRefrigerantKeyword(line) || hasPriceToken(line)) {
    for (const ap of SHORTHAND_PATTERNS) {
      if (ap.re.test(line)) return ap.code;
    }
  }
  return null;
}

// ─── 수량 ──────────────────────────────────────────────────
function extractQty(line) {
  const m = String(line || "").match(/(\d+)\s*대/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return 1;
}

// ─── 가격 (KA 기종 줄) ─────────────────────────────────────
function extractPrice(line) {
  if (!line) return null;
  let s = stripRefrigMarker(line).trim();
  if (!/\d/.test(s)) return null;

  // (1) 천단위 separator: 70.000 / 80,000 / 1,500,000.
  //     (?!\d) — '70.0000' 같은 비정상 (3+ 뒷자릿수) 거부 → null.
  const sep = s.match(/(\d{1,3}(?:[.,]\d{3})+)(?!\d)/);
  if (sep) {
    const n = parseInt(sep[1].replace(/[.,]/g, ""), 10);
    if (n > 0) return n;
  }
  // (2) 만 표기
  const manM = s.match(/(\d+)\s*만(?:원)?/);
  if (manM) {
    const n = parseInt(manM[1], 10) * 10000;
    if (n > 0) return n;
  }
  // (3) 원 명시
  const wonM = s.match(/(\d{4,})\s*원/);
  if (wonM) {
    const n = parseInt(wonM[1], 10);
    if (n > 0) return n;
  }
  // (4) plain 5자리 이상 숫자 (단위 없음)
  const plainM = s.match(/\b(\d{5,})\b/);
  if (plainM) {
    const n = parseInt(plainM[1], 10);
    if (n > 0) return n;
  }
  return null;
}

// 가격 stripping (leftover 추출용)
function stripPriceTokens(s) {
  let t = String(s || "");
  t = t.replace(/\d{1,3}(?:[.,]\d{3})+/g, " ");
  t = t.replace(/\d+\s*만(?:원)?/g, " ");
  t = t.replace(/\d{4,}\s*원/g, " ");
  return t;
}

// ─── KA 아이템 줄 leftover (기종+가격+가.충+qty 제외 나머지 텍스트) ─────
//   예: "원웨이 물떨어짐 150.000" → "물떨어짐"
function extractItemLeftover(line) {
  let s = stripRefrigMarker(line);
  for (const re of APPLIANCE_STRIP_RES) s = s.replace(re, " ");
  // 약어도 strip — item 줄이라 안전 (가.충/가격 검증된 줄에서만 호출).
  for (const re of SHORTHAND_STRIP_RES) s = s.replace(re, " ");
  s = stripPriceTokens(s);
  s = s.replace(/\d+\s*대/g, " ");
  s = s.replace(/씩/g, " ");
  s = s.replace(/[.,]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// ─── 주소 / 희망일 / 이름 휴리스틱 ─────────────────────────
// 2026-06-06 (v2 보강) — 주소에서 짧은 지역명 추출 (고객 자동명 + DB region 컬럼).
//   1단계: 광역시·도 접두 strip (서울특별시/경기도/인천 등 — 광역 단위 단어 제거).
//   2단계: 구 > 시(광역/특별 제외) > 군 순서. lazy `\S+?` 토큰 단위 (공백 없는 주소도 처리).
//   길이 캡 6자.
//
//   예:
//     '서울특별시 마포구 합정동'      → '마포구'   (광역시 strip → 구)
//     '서울특별시마포구합정동'         → '마포구'   (붙어쓰기, 광역시 strip → lazy 구)
//     '경기도 남양주시 ...'           → '남양주시'
//     '경기도남양주시...'             → '남양주시'  (붙어쓰기)
//     '경기도 가평군'                 → '가평군'
//     '인천 부평구 ...'               → '부평구'    (단독 약어 strip)
//     '인천부평구 ...'                → '부평구'    (붙어쓰기 strip)
//     '광주광역시 광산구'             → '광산구'
//     '경기도 광주시'                 → '광주시'    (도 strip / 광주 단독 strip X — 다음 글자 '시')
//     '관악구서림3길19'               → '관악구'    (구 직접)
//     '부천시원미로17번지17'          → '부천시'    (시 lazy)
//     '서울특별시 강남동'             → ''           (구·시·군 전부 fail)

// 광역시·특별자치시·도 접두 패턴.
//   단독 약어 (서울/부산/...) 측 다음 글자 측 '시'/'도' 아닐 때만 strip — '광주시'·'경상남도' 충돌 방지.
const PROVINCE_PREFIXES = [
  /^(서울|부산|대구|인천|광주|대전|울산)(특별시|광역시)\s*/,
  /^세종(특별자치시|시)\s*/,
  /^(경기|강원|충청북|충청남|전라북|전라남|경상북|경상남)도\s*/,
  /^(강원|전북|제주)특별자치도\s*/,
  /^제주도\s*/,
  /^(서울|부산|대구|인천|광주|대전|울산|세종)(?![시도])\s*/,
];

function stripProvincePrefix(a) {
  let s = String(a || "").trim();
  for (const re of PROVINCE_PREFIXES) {
    if (re.test(s)) { s = s.replace(re, "").trim(); break; }   // 한 접두만 strip
  }
  return s;
}

// 2026-06-06 v3 — 전국 시/군/구 사전 (광역시·도 제외).
//   stem ('시'/'군'/'구' 접미 제거) 도 함께 매칭 → '남양주' / '남양주시' 양쪽 대응.
//   사장님 spec: "시/군/구 접미 유무 모두 매칭".
const KOREAN_CITIES_DISTRICTS = [
  // 서울 25 자치구
  "강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구",
  "노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구",
  "성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구",
  // 부산 15구 + 1군
  "금정구","남구","동구","동래구","부산진구","북구","사상구","사하구",
  "서구","수영구","연제구","영도구","해운대구","기장군",
  // 대구 7구 + 2군
  "달서구","수성구","달성군","군위군",
  // 인천 8구 + 2군
  "계양구","남동구","미추홀구","부평구","연수구","강화군","옹진군",
  // 광주 5구
  "광산구",
  // 대전 5구
  "대덕구","유성구",
  // 울산 4구 + 1군
  "울주군",
  // 경기 28시 + 3군
  "수원시","고양시","용인시","성남시","화성시","부천시","남양주시","안산시","안양시","평택시",
  "시흥시","파주시","의정부시","김포시","광주시","광명시","군포시","오산시","하남시","양주시",
  "이천시","구리시","안성시","포천시","의왕시","여주시","동두천시","과천시",
  "양평군","가평군","연천군",
  // 강원 7시 + 11군
  "춘천시","원주시","강릉시","동해시","태백시","속초시","삼척시",
  "홍천군","횡성군","영월군","평창군","정선군","철원군","화천군","양구군","인제군","고성군","양양군",
  // 충북 3시 + 8군
  "청주시","충주시","제천시",
  "보은군","옥천군","영동군","증평군","진천군","괴산군","음성군","단양군",
  // 충남 8시 + 7군
  "천안시","공주시","보령시","아산시","서산시","논산시","계룡시","당진시",
  "금산군","부여군","서천군","청양군","홍성군","예산군","태안군",
  // 전북 6시 + 8군
  "전주시","군산시","익산시","정읍시","남원시","김제시",
  "완주군","진안군","무주군","장수군","임실군","순창군","고창군","부안군",
  // 전남 5시 + 17군
  "목포시","여수시","순천시","나주시","광양시",
  "담양군","곡성군","구례군","고흥군","보성군","화순군","장흥군","강진군","해남군","영암군",
  "무안군","함평군","영광군","장성군","완도군","진도군","신안군",
  // 경북 10시 + 11군
  "포항시","경주시","김천시","안동시","구미시","영주시","영천시","상주시","문경시","경산시",
  "의성군","청송군","영양군","영덕군","청도군","고령군","성주군","칠곡군","예천군","봉화군","울진군","울릉군",
  // 경남 8시 + 10군
  "창원시","진주시","통영시","사천시","김해시","밀양시","거제시","양산시",
  "의령군","함안군","창녕군","남해군","하동군","산청군","함양군","거창군","합천군",
  // 제주 2시
  "제주시","서귀포시",
];

// 서울/경기 주요 동 시드 — 점진 확장.
const KOREAN_DONGS_SEED = [
  "목동","합정","신림","역삼","삼성","청담","압구정","신사","잠실","방배",
  "여의도","이태원","한남","성수","건대","홍대","신촌","이대",
];

// 사전 — stem 포함, 길이 desc (가장 긴 일치 우선).
//   ⚠️ stem 단글자 제외 — '서구'→'서' 같은 1글자 stem 측 '서울시' 등 측 false-positive 측.
const REGION_LOOKUP = (() => {
  const set = new Set();
  for (const name of KOREAN_CITIES_DISTRICTS) {
    set.add(name);
    if (/[시군구]$/.test(name)) {
      const stem = name.slice(0, -1);
      if (stem.length >= 2) set.add(stem);   // 단글자 stem 제외
    }
  }
  for (const d of KOREAN_DONGS_SEED) set.add(d);
  return [...set].sort((a, b) => b.length - a.length);
})();

function lookupRegionByDict(a) {
  for (const name of REGION_LOOKUP) {
    if (a.startsWith(name)) return name;
  }
  return null;
}

export function extractRegion(address) {
  if (!address) return "";
  const a = stripProvincePrefix(address);
  if (!a) return "";
  const cap = (w) => w.length > 6 ? w.slice(-6) : w;

  // v3 — 0) 사전 기반 가장 긴 일치 (최우선).
  //   "남양주퇴계원..." → "남양주" (사전 stem) / "목동현대..." → "목동" (동 시드).
  //   "마포구합정동" → "마포구" (구 full, 더 긴 매칭 우선).
  const dictHit = lookupRegionByDict(a);
  if (dictHit) return cap(dictHit);

  // 1) v2 lazy 매칭 fallback — 구 우선.
  let m = a.match(/\S+?구/);
  if (m) return cap(m[0]);

  // 2) 시 (광역/특별자치 잔여 대비)
  for (const m2 of a.matchAll(/\S+?시/g)) {
    const w = m2[0];
    if (/(특별시|광역시|특별자치시)$/.test(w)) continue;
    return cap(w);
  }

  // 3) 군
  m = a.match(/\S+?군/);
  if (m) return cap(m[0]);

  return "";
}

function looksLikeAddress(line) {
  if (!line) return false;
  return /[가-힣]+(시|구|동|로|길)(\s|$|[^가-힣])/.test(line)
      || /\d+\s*번지/.test(line)
      || /\d+\s*[층호]/.test(line)
      || /\d+동\s*\d+호/.test(line)
      || /아파트|빌라|타워|단지|상가|오피스텔/.test(line);
}

function looksLikeDesired(line) {
  if (!line) return false;
  return /\d+\s*[\/\.월]\s*\d+/.test(line)        // 4/23, 4.23, 4월 23
      || /\d+\s*일/.test(line)                    // 23일
      || /(금일|오늘|내일|모레|글피)/.test(line)
      || /(월|화|수|목|금|토|일)요일/.test(line)
      || /(오전|오후|아침|점심|저녁|밤)/.test(line)
      || /\d+\s*시(\s*\d+\s*분)?/.test(line);
}

function looksLikeName(line) {
  if (!line) return false;
  if (/\d/.test(line)) return false;
  if (detectAppliance(line)) return false;
  if (line.length > 8) return false;
  return /^[가-힣]{2,5}$/.test(line);
}

// 희망일 토큰 stripping (memo leftover 추출용)
function stripDesiredTokens(s) {
  let t = String(s || "");
  t = t.replace(/\d+\s*[\/\.월]\s*\d+/g, " ");
  t = t.replace(/\d+\s*일/g, " ");
  t = t.replace(/(금일|오늘|내일|모레|글피)/g, " ");
  t = t.replace(/(월|화|수|목|금|토|일)요일/g, " ");
  t = t.replace(/(오전|오후|아침|점심|저녁|밤)/g, " ");
  t = t.replace(/\d+\s*시(\s*\d+\s*분)?/g, " ");
  return t;
}

// ═══════════════════════════════════════════════════════════
// KA — 빈 줄로 건 분리, 건마다 주소+기종줄(1+)+폰+메모
// ═══════════════════════════════════════════════════════════
function parseKaSection(section) {
  const lines = section.split(/\n/).map(l => l.trim()).filter(Boolean);

  const items = [];
  const itemLeftovers = [];   // 아이템 줄에서 떼어낸 부가 텍스트 (예: "물떨어짐")
  const roles = [];
  let phone = null;
  let phoneIdx = -1;
  let firstItemIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (phone === null && hasPhone(line)) {
      phone = extractPhone(line);
      phoneIdx = i;
      roles.push('phone');
      continue;
    }
    const ap = detectAppliance(line);
    const price = extractPrice(line);
    if (ap && price !== null) {
      items.push({ appliance: ap, qty: extractQty(line), price });
      const lo = extractItemLeftover(line);
      if (lo) itemLeftovers.push(lo);
      if (firstItemIdx === -1) firstItemIdx = i;
      roles.push('item');
      continue;
    }
    if (ap && price === null) {
      items.push({ appliance: ap, qty: extractQty(line), price: null, _needsPriceFromNext: true });
      const lo = extractItemLeftover(line);
      if (lo) itemLeftovers.push(lo);
      if (firstItemIdx === -1) firstItemIdx = i;
      roles.push('item');
      continue;
    }
    // 2026-06-06 안전망 — 기종 못 찾음 + 가격 + 가.충/충전 키워드 → item 처리 (appliance:null, 사람 수동 선택).
    //   주소로 새는 사고 방지 (예: "익숙치 않은 기종 약어 가.충 70.000").
    if (!ap && price !== null && hasRefrigerantKeyword(line)) {
      items.push({ appliance: null, qty: extractQty(line), price });
      const lo = extractItemLeftover(line);
      if (lo) itemLeftovers.push(lo);
      if (firstItemIdx === -1) firstItemIdx = i;
      roles.push('item');
      continue;
    }
    roles.push('other');
  }

  // 2번째 패스 — _needsPriceFromNext 아이템의 다음 'other' 줄(=가격만) 흡수
  for (let i = 0; i < items.length; i++) {
    if (!items[i]._needsPriceFromNext) continue;
    let itemRoleIdx = -1, count = 0;
    for (let j = 0; j < roles.length; j++) {
      if (roles[j] === 'item') {
        if (count === i) { itemRoleIdx = j; break; }
        count += 1;
      }
    }
    if (itemRoleIdx === -1) continue;
    for (let j = itemRoleIdx + 1; j < lines.length; j++) {
      if (roles[j] !== 'other') break;
      const p = extractPrice(lines[j]);
      if (p !== null) {
        items[i].price = p;
        roles[j] = 'price_used';
        break;
      }
    }
    delete items[i]._needsPriceFromNext;
  }

  // 주소
  const upTo = firstItemIdx === -1 ? lines.length : firstItemIdx;
  const addressLines = [];
  for (let i = 0; i < upTo; i++) {
    if (roles[i] === 'other') addressLines.push(lines[i]);
  }

  // tail = phone 줄 뒤 'other' 줄들 + 아이템 leftover
  const afterIdx = phoneIdx !== -1
    ? phoneIdx + 1
    : (firstItemIdx === -1 ? lines.length : (() => {
        let last = firstItemIdx;
        for (let i = 0; i < roles.length; i++) if (roles[i] === 'item' || roles[i] === 'price_used') last = i;
        return last + 1;
      })());
  const tailLines = [];
  for (let i = afterIdx; i < lines.length; i++) {
    if (roles[i] === 'other') tailLines.push(lines[i]);
  }

  const desiredText = tailLines.find(looksLikeDesired) || null;
  const memoBits = tailLines.filter(l => l !== desiredText).concat(itemLeftovers);
  const memo = memoBits.length > 0 ? memoBits.join(' ').trim() || null : null;

  return {
    customerName: "",
    phone,
    address:      addressLines.join(' ').trim(),
    items,
    desiredText,
    memo,
    workType:     "냉매충전",
  };
}

function parseKa(text) {
  const sections = text.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
  return sections.map(parseKaSection);
}

// ═══════════════════════════════════════════════════════════
// crikrin
// ═══════════════════════════════════════════════════════════

// 2026-06-06 — 라벨 SEP: 콜론(:/：) 옵션 + 공백 1+ 모두 매칭 ('이름 최규선' OK).
//   서비스종류/서비스 (크리크린 사장님 오타 패턴) 도 appliance 라벨로 인식 — 단 값은
//   참고 (크리크린 측 workType 측 냉매충전 고정. 라벨 줄을 memo 로 새는 사고 차단).
const _SEP = "\\s*[:：]?\\s+";
const CRIKRIN_LABELS = {
  customer:  new RegExp(`^(?:성함|이름|고객명?)${_SEP}(.+)$`),
  address:   new RegExp(`^(?:주소|위치)${_SEP}(.+)$`),
  phone:     new RegExp(`^(?:연락처|전화(?:번호)?|번호|폰)${_SEP}(.+)$`),
  appliance: new RegExp(`^(?:가전\\s*종류[^:：\\s]*|가전|품목|작업\\s*종류|서비스\\s*종류|서비스)${_SEP}(.+)$`),
  desired:   new RegExp(`^(?:희망\\s*날짜[^:：\\s]*|희망\\s*일정|희망일?|일정)${_SEP}(.*)$`),
  memo:      new RegExp(`^(?:비고|메모|특이사항|요청사항?)${_SEP}(.+)$`),
};

// 2026-06-06 — 한 줄에 여러 가전: "스탠드에어컨 1대 벽걸이에어컨 1대" → 2 items.
//   각 매칭: <기종 키워드> [에어컨/에어콘] [N대]. 'N대' 측 측 측 qty=1.
const _ITEM_SCAN_RE = /(4\s*way|4웨이|포웨이|원\s*웨이|1\s*way|1\s*웨이|천\s*장\s*형|투\s*인\s*원|2\s*in\s*1|스\s*탠\s*드|벽\s*걸\s*이|위\s*니\s*아)\s*에?어?컨?\s*(?:(\d+)\s*대)?/gi;
function extractItemsFromLine(line) {
  if (!line) return [];
  const items = [];
  const re = new RegExp(_ITEM_SCAN_RE.source, "gi");
  let m;
  while ((m = re.exec(line)) !== null) {
    const kw = m[1];
    const qty = m[2] ? Math.max(1, parseInt(m[2], 10)) : 1;
    let code = null;
    if (/4\s*way|4웨이|포웨이/i.test(kw))             code = "4way";
    else if (/원\s*웨이|1\s*way|1\s*웨이|천\s*장\s*형/i.test(kw)) code = "1way";
    else if (/투\s*인\s*원|2\s*in\s*1/i.test(kw))      code = "2in1";
    else if (/스\s*탠\s*드/.test(kw))                  code = "stand";
    else if (/벽\s*걸\s*이/.test(kw))                  code = "wall";
    else if (/위\s*니\s*아/.test(kw))                  code = "wall";   // 브랜드 fallback (사전 매핑)
    if (code) items.push({ appliance: code, qty });
  }
  return items;
}

function isCrikrinLabeled(text) {
  let hits = 0;
  const lines = text.split(/\n/);
  for (const line of lines) {
    if (CRIKRIN_LABELS.customer.test(line)) hits += 1;
    if (CRIKRIN_LABELS.phone.test(line))    hits += 1;
    if (CRIKRIN_LABELS.address.test(line))  hits += 1;
    if (hits >= 2) return true;
  }
  return false;
}

// "김수진 / 냉매충전" → "김수진" (slash 뒤가 workType 키워드면 떼어냄)
function cleanCustomerName(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  const parts = s.split(/\s*\/\s*/);
  if (parts.length >= 2 && /^(냉매충전|세척|에어컨|점검|수리)/.test(parts[1])) {
    return parts[0].trim();
  }
  return s;
}

function parseCrikrinLabeled(text) {
  const lines = text.split(/\n/).map(l => l.trim());
  let customer = "", address = "", phoneRaw = "", desiredRaw = "";
  let memoBits = [];
  let multiItems = [];     // 한 줄에 여러 가전 가능 (스탠드+벽걸이 등)
  let inDesired = false;
  let desiredMulti = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) { inDesired = false; continue; }
    let m;
    m = line.match(CRIKRIN_LABELS.customer);  if (m) { customer = m[1].trim();  inDesired = false; continue; }
    m = line.match(CRIKRIN_LABELS.address);   if (m) { address  = m[1].trim();  inDesired = false; continue; }
    m = line.match(CRIKRIN_LABELS.phone);     if (m) { phoneRaw = m[1].trim();  inDesired = false; continue; }
    m = line.match(CRIKRIN_LABELS.appliance); if (m) {
      // 라벨이 가전/서비스/품목 등 — 값에서 multi-item 스캔.
      //   ⚠️ 크리크린 측 workType 측 냉매충전 고정 (사장님 spec). 서비스 라벨 값 무시.
      const raw = m[1].trim();
      const items = extractItemsFromLine(raw);
      if (items.length > 0) multiItems.push(...items);
      else {
        const ap = detectAppliance(raw);
        if (ap) multiItems.push({ appliance: ap, qty: extractQty(raw) });
        // appliance 가 매칭 안 됨 (예: '에어컨 청소') — 측 items 측 X. 라벨 줄 measure 측 memo 측 X.
      }
      inDesired = false; continue;
    }
    m = line.match(CRIKRIN_LABELS.desired);   if (m) {
      desiredRaw = m[1].trim();
      inDesired  = !desiredRaw;
      continue;
    }
    m = line.match(CRIKRIN_LABELS.memo);      if (m) { memoBits.push(m[1].trim()); inDesired = false; continue; }
    // 라벨 없는 줄
    if (inDesired) {
      desiredMulti = (desiredMulti ? desiredMulti + " " : "") + line;
      continue;
    }
    // 라벨 측 측, multi-item 스캔 ("스탠드에어컨 1대 벽걸이에어컨 1대" 같이 가전 측 측 줄).
    const items = extractItemsFromLine(line);
    if (items.length > 0) {
      multiItems.push(...items);
      continue;
    }
    // 정체불명 줄 → memo
    memoBits.push(line);
  }

  const desiredText = (desiredRaw || desiredMulti || "").trim() || null;
  const phone = extractPhone(phoneRaw) || (phoneRaw ? phoneRaw : null);
  const memo = memoBits.length > 0 ? memoBits.join(' ').trim() || null : null;

  return {
    customerName: cleanCustomerName(customer),
    phone,
    address,
    items: multiItems,
    desiredText,
    memo,
    workType: "냉매충전",   // crikrin 측 고정 (서비스 라벨 값 무시)
  };
}

// 다른 필드 (phone/appliance/qty/workType 키워드) 제거 후 남은 텍스트 — desired-shared 라인 추출용
function stripNonDesiredTokens(line) {
  let s = String(line);
  s = s.replace(PHONE_STRIP_RE, " ");
  for (const re of APPLIANCE_STRIP_RES) s = s.replace(re, " ");
  s = s.replace(/\d+\s*대/g, " ");
  s = s.replace(/냉매\s*충전|냉매충전/g, " ");
  s = stripRefrigMarker(s);
  s = s.replace(/[.,]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// 휴리스틱 — 라인별 multi-field 허용 (phone+appliance+desired 한 줄 가능)
function parseCrikrinHeuristic(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const fieldsPerLine = lines.map(() => new Set());

  let phone = null, appliance = null, qty = 1, address = "", customerName = "", desiredText = null;
  let desiredLineIdx = -1;

  // (1) phone — 첫 매칭
  for (let i = 0; i < lines.length; i++) {
    if (!phone && hasPhone(lines[i])) {
      phone = extractPhone(lines[i]);
      fieldsPerLine[i].add('phone');
    }
  }
  // (2) appliance — 첫 매칭 (phone 줄 공유 허용)
  for (let i = 0; i < lines.length; i++) {
    if (!appliance) {
      const ap = detectAppliance(lines[i]);
      if (ap) {
        appliance = ap;
        qty = extractQty(lines[i]);
        fieldsPerLine[i].add('appliance');
      }
    }
  }
  // (3) desired — 첫 매칭 (공유 허용). 라인 idx 기록 후 sharing 여부 따라 토큰만/전체 사용.
  for (let i = 0; i < lines.length; i++) {
    if (desiredLineIdx === -1 && looksLikeDesired(lines[i])) {
      desiredLineIdx = i;
      fieldsPerLine[i].add('desired');
    }
  }
  // (4) address — 다른 필드 없는 줄 + 연속 흡수
  let addressIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (fieldsPerLine[i].size === 0 && looksLikeAddress(lines[i])) {
      addressIdx = i;
      break;
    }
  }
  if (addressIdx !== -1) {
    const addrBits = [lines[addressIdx]];
    fieldsPerLine[addressIdx].add('address');
    for (let i = addressIdx + 1; i < lines.length; i++) {
      if (fieldsPerLine[i].size > 0) break;
      if (looksLikeAddress(lines[i])) {
        addrBits.push(lines[i]);
        fieldsPerLine[i].add('address');
      } else {
        break;
      }
    }
    address = addrBits.join(' ').trim();
  }
  // (5) name — 다른 필드 없는 줄
  for (let i = 0; i < lines.length; i++) {
    if (fieldsPerLine[i].size === 0 && looksLikeName(lines[i])) {
      customerName = lines[i];
      fieldsPerLine[i].add('name');
      break;
    }
  }

  // (5b) desiredText 결정 — desired 라인이 다른 필드와 공유면 토큰만 추출, 단독이면 라인 전체.
  if (desiredLineIdx !== -1) {
    const f = fieldsPerLine[desiredLineIdx];
    if (f.size > 1) {
      const stripped = stripNonDesiredTokens(lines[desiredLineIdx]);
      desiredText = stripped || lines[desiredLineIdx];
    } else {
      desiredText = lines[desiredLineIdx];
    }
  }

  // (6) memo — 미사용 줄 전체 + phone 줄 leftover (괄호 등)
  const memoBits = [];
  for (let i = 0; i < lines.length; i++) {
    const f = fieldsPerLine[i];
    if (f.size === 0) {
      memoBits.push(lines[i]);
      continue;
    }
    if (f.has('phone')) {
      let l = lines[i].replace(PHONE_STRIP_RE, " ");
      if (f.has('appliance')) {
        for (const re of APPLIANCE_STRIP_RES) l = l.replace(re, " ");
        l = l.replace(/\d+\s*대/g, " ");
      }
      if (f.has('desired')) {
        l = stripDesiredTokens(l);
      }
      // 알려진 workType 키워드 제거
      l = l.replace(/냉매\s*충전|냉매충전/g, " ");
      l = l.replace(/\s+/g, " ").trim();
      l = l.replace(/^[\s.,!?~()]+|[\s.,!?~()]+$/g, "").trim();
      if (l && l.length > 1) memoBits.push(l);
    }
  }
  const memo = memoBits.length > 0 ? memoBits.join(' ').trim() || null : null;

  return {
    customerName,
    phone,
    address,
    items: appliance ? [{ appliance, qty }] : [],
    desiredText,
    memo,
    workType: "냉매충전",
  };
}

function parseCrikrin(text) {
  if (isCrikrinLabeled(text)) return [parseCrikrinLabeled(text)];
  return [parseCrikrinHeuristic(text)];
}

// ═══════════════════════════════════════════════════════════
export function parsePartnerPaste(text, principalCode) {
  if (!text || !String(text).trim()) return [];
  const code = String(principalCode || "").toLowerCase();
  if (code === "ka")      return parseKa(text);
  if (code === "crikrin") return parseCrikrin(text);
  return [];
}
