// 2026-06-19 — 서류 발행 (거래명세서/영수증) 카톡 텍스트 best-effort 파서.
//
// 기존 partnerPasteParser.parsePartnerPaste 는 KA/crikrin 원청 1:N 카톡 분리에
// 특화 (principalCode 강제). 본 모듈은 즉석 발행용 — 한 건 텍스트에서 주소·
// 품목·금액·부가세표기만 최대한 끄집어 form 에 미리 채움 (best-effort).
//
// 응답:
//   {
//     address:      string | "",
//     items:        [{ label: string, qty: number, price?: number }],
//     supplyPrice:  number | null,     // "공급가" 추정 (부가세 별도 표기 시)
//     totalAmount:  number | null,     // "합계" 추정 (부가세 포함 / 단일 금액)
//     vatMode:      "exclusive" | "inclusive" | null,
//                    // exclusive = 부가세 별도 (입력값 = 공급가)
//                    // inclusive = 부가세 포함 (입력값 = 합계)
//                    // null      = 단서 없음 (UI 기본값 inclusive 권장)
//     rawLines:     string[],          // 디버그/표시용 — 비어있지 않은 줄들
//   }
//
// best-effort 라 추출 실패는 빈 값/0 으로 반환. 사용자 수정 전제.

// ──────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────
const RX_DIGIT_GROUP = /(\d{1,3}(?:,\d{3})+|\d{4,})/g;
const RX_VAT_EX = /(부가세\s*별도|\bVAT\s*별도|공급가)/i;
const RX_VAT_IN = /(부가세\s*포함|\bVAT\s*포함|합계|총액|총\s*금액)/i;
// 한국 주소 시작 부분: 시/도 또는 시/군/구.
//   광역시도 다음 칸 또는 도+시까지 추출. 도로명/지번 끝까지 한 줄에 있다고 가정.
const KO_REGION_RX = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{2,}/;

function toNumber(rawDigits) {
  if (rawDigits == null) return null;
  const n = Number(String(rawDigits).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pickFirstAmount(line) {
  const m = String(line).match(RX_DIGIT_GROUP);
  if (!m) return null;
  // 가장 큰 숫자(보통 가격) 선호. 동률이면 처음 등장한 것.
  let best = null;
  for (const g of m) {
    const v = toNumber(g);
    if (v == null) continue;
    if (best == null || v > best) best = v;
  }
  return best;
}

// "에어컨 청소 / 벽걸이 2 / 350,000" 같은 한 줄에서 라벨·수량·가격 분리.
//   slash / pipe / 탭 / 다중 공백 모두 split 후 토큰 분류:
//     숫자 그룹 + (콤마/원/won) → price
//     숫자 + (대|개|벌|x|×) → qty
//     그 외 → label 누적
function parseItemLine(rawLine) {
  const line = String(rawLine).trim();
  if (!line) return null;

  // 부가세표기 단서 줄은 항목 X.
  if (RX_VAT_EX.test(line) || RX_VAT_IN.test(line)) return null;

  // 주소 의심 줄은 항목 X (이미 address 추출 단계에서 잡힘).
  if (KO_REGION_RX.test(line)) return null;

  const tokens = line.split(/\s*[\/|·•∙]\s*|\t+|\s{2,}/).map(t => t.trim()).filter(Boolean);
  const labels = [];
  let qty = 1;
  let price = null;

  for (const tok of tokens) {
    // 가격 패턴: "350,000" / "350000원" / "₩350,000"
    if (/^[₩￦]?\s*\d{1,3}(?:,\d{3})+(?:\s*원)?$/.test(tok)
        || /^\d{4,}\s*(?:원|won|KRW)?$/i.test(tok)) {
      const v = toNumber(tok);
      if (v != null && (price == null || v > price)) price = v;
      continue;
    }
    // 수량 패턴: "2", "2대", "2개", "x2", "×2", "수량: 2"
    const qm = tok.match(/^(?:수량[\s:]*)?[×x]?\s*(\d{1,3})\s*(?:대|개|벌|EA|ea)?$/);
    if (qm && Number(qm[1]) >= 1 && Number(qm[1]) <= 999) {
      qty = Number(qm[1]);
      continue;
    }
    labels.push(tok);
  }

  const label = labels.join(" ").trim();
  // 라벨 없고 가격만 있는 줄은 합계 후보로 따로 다룸 → 항목 아님.
  if (!label) return null;

  return { label, qty, price: price ?? undefined };
}

// ──────────────────────────────────────────────
// 메인 — best-effort 파싱
// ──────────────────────────────────────────────
export function parseDocIssuePaste(rawText) {
  const out = {
    address:     "",
    items:       [],
    supplyPrice: null,
    totalAmount: null,
    vatMode:     null,
    rawLines:    [],
  };

  const text = String(rawText || "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return out;

  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  out.rawLines = lines.slice();

  // 1) 주소 — 첫 매칭 줄.
  for (const line of lines) {
    const m = line.match(KO_REGION_RX);
    if (m) { out.address = m[0].trim(); break; }
  }

  // 2) 부가세표기.
  for (const line of lines) {
    if (RX_VAT_EX.test(line)) { out.vatMode = "exclusive"; break; }
    if (RX_VAT_IN.test(line)) { out.vatMode = "inclusive"; break; }
  }

  // 3) 금액(합계/공급가) — 부가세 단서 줄 또는 "합계/총액/공급가/금액" 키워드 줄.
  for (const line of lines) {
    if (/^\s*(합계|총액|총\s*금액)\b/.test(line)
        || (RX_VAT_IN.test(line) && pickFirstAmount(line))) {
      out.totalAmount = pickFirstAmount(line);
      if (out.vatMode == null) out.vatMode = "inclusive";
      break;
    }
  }
  for (const line of lines) {
    if (/^\s*(공급가|공급\s*가액)\b/.test(line)
        || (RX_VAT_EX.test(line) && pickFirstAmount(line))) {
      out.supplyPrice = pickFirstAmount(line);
      if (out.vatMode == null) out.vatMode = "exclusive";
      break;
    }
  }

  // 4) 품목 — slash/구분자 분리 줄에서 라벨·수량·가격 추출.
  //    주소·부가세표기·합계 줄은 parseItemLine 내부에서 제외됨.
  for (const line of lines) {
    if (/^\s*(합계|총액|총\s*금액|공급가|공급\s*가액|부가세)\b/.test(line)) continue;
    const item = parseItemLine(line);
    if (item) out.items.push(item);
  }

  // 5) 합계 fallback — items 가격 합으로 추정 (사용자 수정 가능).
  if (out.totalAmount == null && out.supplyPrice == null && out.items.length > 0) {
    const sum = out.items.reduce(
      (acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 1),
      0
    );
    if (sum > 0) {
      out.totalAmount = sum;
      if (out.vatMode == null) out.vatMode = "inclusive";
    }
  }

  return out;
}

// ──────────────────────────────────────────────
// 금액 계산 (UI 에서도 동일 산식 사용)
// ──────────────────────────────────────────────
//   vatMode = "exclusive" 이면 입력값 = 공급가 → vat = round(공급가 × 0.1)
//                                                 total = 공급가 + vat
//   vatMode = "inclusive" 이면 입력값 = 합계   → 공급가 = round(합계 / 1.1)
//                                                 vat   = 합계 − 공급가
//   사장님 spec: 반올림은 일반 ROUND (소수점 첫째자리 반올림 = Math.round).
export function computeVatBreakdown(amount, vatMode) {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  if (!n) return { supply: 0, vat: 0, total: 0 };

  if (vatMode === "exclusive") {
    const supply = n;
    const vat    = Math.round(supply * 0.1);
    return { supply, vat, total: supply + vat };
  }
  // inclusive (기본값)
  const total  = n;
  const supply = Math.round(total / 1.1);
  const vat    = total - supply;
  return { supply, vat, total };
}
