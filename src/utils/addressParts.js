// 2026-10-07 — 주소 표시 규칙: "구·동은 크게, 전체 주소는 아래 작게".
//   주소 글자에서 구·동(또는 시·구·읍면동)을 뽑는다. 기사 앱 · 운영자 화면이 같이 쓴다.
//   · 동(읍 · 면 · 리 · 가)이 있으면  [시] 구 동        예: "강남구 역삼동" / "성남시 분당구 정자동" / "하남시 덕풍동"
//   · 도로명 주소라 동이 없으면      [시] 구 도로명     예: "강남구 테헤란로123길"
//   · 뽑지 못하면 head 는 빈 글자 → 화면은 전체 주소를 그대로 한 줄로 보여 준다.
//   반환: { head: 크게 보여 줄 글자, rest: head 뒤에 남는 글자(목록 한 줄에서 흐리게), full: 전체 주소 }

const WIDE = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(특별시|광역시|특별자치시|특별자치도|도)?$/;
const WIDE_LONG = /^(충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|강원특별자치도|전북특별자치도|제주특별자치도)$/;
const isCity = (t) => /^[가-힣]{1,5}(시|군)$/.test(t);
const isGu   = (t) => /^[가-힣]{1,5}구$/.test(t);
// 동 · 읍 · 면 · 리 · 가 — 한글로 시작 (아파트 "101동" 은 제외), 숫자가 섞일 수 있음 (역삼1동 · 종로3가)
const isDong = (t) => /^[가-힣][가-힣0-9]{0,7}(동|읍|면|리|가)$/.test(t);
// 도로 이름 — 한글로 시작, 로 · 길로 끝남 (테헤란로 / 테헤란로123길 / 덕풍서로45번길)
const isRoad = (t) => /^[가-힣][가-힣0-9]{0,12}(로|길)$/.test(t);

export function splitAddress(address) {
  const full = String(address || "").trim().replace(/\s+/g, " ");
  if (!full) return { head: "", rest: "", full: "" };
  const tok = full.split(" ");
  let i = 0;
  if (tok[i] && (WIDE.test(tok[i]) || WIDE_LONG.test(tok[i]))) i += 1;

  const head = [];
  if (tok[i] && isCity(tok[i])) { head.push(tok[i]); i += 1; }
  if (tok[i] && isGu(tok[i]))   { head.push(tok[i]); i += 1; }
  if (head.length === 0) return { head: "", rest: full, full };

  if (tok[i] && isDong(tok[i])) {
    head.push(tok[i]); i += 1;
  } else if (tok[i] && isRoad(tok[i])) {
    // "테헤란로 123길" 처럼 띄어 쓴 경우 뒤 조각까지
    let road = tok[i]; i += 1;
    if (tok[i] && /^[0-9]+(번)?길$/.test(tok[i])) { road += tok[i]; i += 1; }
    head.push(road);
  } else if (tok[i]) {
    // "덕풍서로45" 처럼 도로 이름에 건물 번호가 붙어 있는 경우: 도로 이름만 head 로, 번호는 뒤로
    const m = /^([가-힣][가-힣0-9]*?(?:로|길))([0-9][0-9-]*)$/.exec(tok[i]);
    if (m) {
      head.push(m[1]);
      return { head: head.join(" "), rest: [m[2], ...tok.slice(i + 1)].join(" "), full };
    }
  }
  return { head: head.join(" "), rest: tok.slice(i).join(" "), full };
}

// 목록용 짧은 글자: head 가 있으면 head, 없으면 전체 주소
export function addressHead(address) {
  const p = splitAddress(address);
  return p.head || p.full;
}
