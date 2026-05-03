// V11-1 — 유솔 N 상품 자동 분류 + 옵션 파싱
// 기본 작업(basic) vs 추가선택(extra) 구분이 수수료 로직의 핵심.

// 기본 작업 키워드 — 보통 긴 상품명 ("에어컨청소 서울 인천 ...")
const BASIC_KEYWORDS = [
  "에어컨청소",
  "에어컨 청소",
];

// 추가선택 키워드 — 보통 짧은 상품명
const EXTRA_KEYWORDS = [
  "실외기",
  "곰팡이 살균",
  "가스 충전",
  "냉매 충전",
  "추가",
];

export function classifyOrderType(productName) {
  if (!productName) return "basic";

  // 1. 추가선택 키워드 우선 체크
  if (EXTRA_KEYWORDS.some(kw => productName.includes(kw))) {
    return "extra";
  }

  // 2. 기본 키워드 체크
  if (BASIC_KEYWORDS.some(kw => productName.includes(kw))) {
    return "basic";
  }

  // 3. 짧은 상품명(20자 미만) → 추가선택으로 추정
  if (productName.length < 20) {
    return "extra";
  }

  return "basic";
}

// 옵션정보에서 기종 추출
// "서비스 종류: 가정집 에어컨청소 / 구분: 1way" → [{ type: '1way', count: 1 }]
export function parseAppliances(optionInfo, qty = 1) {
  if (!optionInfo) return [];
  const m = optionInfo.match(/구분:\s*([^\/\n]+)/);
  if (!m) return [];
  const type = m[1].trim();
  return [{ type, count: Math.max(1, parseInt(qty) || 1) }];
}

// 한국 전화번호 정규화 (CSV가 다양한 포맷으로 옴)
export function normalizePhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/[^\d]/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
}

// 다양한 형태의 날짜 문자열 → ISO
// "2026-04-30 14:32:11" / "2026.04.30" / "2026/04/30 14:32"
export function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString();
  const s = String(raw).trim().replace(/\./g, "-").replace(/\//g, "-");
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
