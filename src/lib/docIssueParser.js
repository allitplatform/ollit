// 2026-06-19 — 서류 발행 (거래명세서/영수증) 카톡 텍스트 best-effort 파서.
// 2026-07-04 — 연락처(phone) 필드 추가. 개인 수신자 자동 채움용.
// 2026-07-24 — v2 (사장님 실전 예시 3건 기반 대수술):
//   · "60만원"/"15만"/"7.5만원" 만원 단위 금액 인식.
//   · "730,000" 단독 금액 줄 → 합계/공급가로 (이전: 통째로 버려짐).
//   · 주소 인식 확대 — "한울마을 504동 505호 입니다" (동·호 패턴),
//     "은평구" (구/군 단독 토큰) — 시·도 접두 없어도 잡음.
//   · "영수증 부탁드립니다"/"명세서" → docTypeHint (receipt/invoice) + 품목 제외.
//   · "1웨이 4대" → label "1웨이" + qty 4 (라벨 끝 N대/N개 분리).
//
// 기존 partnerPasteParser.parsePartnerPaste 는 KA/crikrin 원청 1:N 카톡 분리에
// 특화 (principalCode 강제). 본 모듈은 즉석 발행용 — 한 건 텍스트에서 주소·
// 연락처·품목·금액·부가세표기만 최대한 끄집어 form 에 미리 채움 (best-effort).
//
// 응답:
//   {
//     address:      string | "",
//     phone:        string | "",       // 개인 수신자 휴대폰 (010-1234-5678 형식). 없으면 "".
//     items:        [{ label: string, qty: number, price?: number }],
//     supplyPrice:  number | null,     // "공급가" 추정 (부가세 별도 표기 시)
//     totalAmount:  number | null,     // "합계" 추정 (부가세 포함 / 단일 금액)
//     vatMode:      "exclusive" | "inclusive" | null,
//                    // exclusive = 부가세 별도 (입력값 = 공급가)
//                    // inclusive = 부가세 포함 (입력값 = 합계)
//                    // null      = 단서 없음 (UI 기본값 inclusive 권장)
//     docTypeHint:  "receipt" | "invoice" | null,   // 2026-07-24 — 영수증/명세서 언급
//     rawLines:     string[],          // 디버그/표시용 — 비어있지 않은 줄들
//   }
//
// best-effort 라 추출 실패는 빈 값/0 으로 반환. 사용자 수정 전제.

import { KO_PHONE_REGEX, formatPhone } from "../utils/receptionForm.js";

// ──────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────
const RX_DIGIT_GROUP = /(\d{1,3}(?:,\d{3})+|\d{4,})/g;
const RX_VAT_EX = /(부가세\s*별도|\bVAT\s*별도|공급가)/i;
const RX_VAT_IN = /(부가세\s*포함|\bVAT\s*포함|합계|총액|총\s*금액)/i;
// 2026-07-24 — 만원 단위: "60만원" "15만" "7.5만원"
const RX_MAN = /(\d+(?:\.\d+)?)\s*만\s*원?/;
// 한국 주소 시작 부분: 시/도 또는 시/군/구.
const KO_REGION_RX = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{2,}/;
// 2026-07-24 — 동·호 패턴 주소 ("한울마을 504동 505호", "래미안 101동 202호")
const RX_DONG_HO = /([가-힣A-Za-z0-9\s]{0,24}\d{1,4}\s*동\s*\d{1,5}\s*호)/;
// 2026-07-24 — 구/군 단독 토큰 ("은평구") — 줄 안 어디든
const RX_GU_TOKEN = /(^|\s)([가-힣]{1,6}[구군])(\s|$)/;
// 2026-07-24 — 문서 종류 힌트 줄 (품목 제외 대상)
const RX_DOC_RECEIPT = /영수증/;
const RX_DOC_INVOICE = /(거래\s*)?명세서/;

function toNumber(rawDigits) {
  if (rawDigits == null) return null;
  const n = Number(String(rawDigits).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// 2026-07-24 v2 — 만원 단위 포함, 가장 큰 값.
function pickFirstAmount(line) {
  const s = String(line);
  let best = null;
  const man = s.match(RX_MAN);
  if (man) {
    const v = Math.round(parseFloat(man[1]) * 10000);
    if (Number.isFinite(v) && v > 0) best = v;
  }
  const m = s.match(RX_DIGIT_GROUP);
  if (m) {
    for (const g of m) {
      const v = toNumber(g);
      if (v == null) continue;
      if (best == null || v > best) best = v;
    }
  }
  return best;
}

// 2026-07-24 — 줄 전체가 "금액만" 인지 (라벨 없는 단독 금액 줄 → 합계 후보)
//   예: "730,000" / "₩730,000" / "60만원" / "600000원" / "15만원 입니다"
function isAmountOnlyLine(line) {
  const s = String(line).trim();
  if (!s) return false;
  return /^[₩￦]?\s*\d{1,3}(?:,\d{3})+\s*원?\s*(?:입니다|이요|예요|요)?\.?$/.test(s)
      || /^[₩￦]?\s*\d{4,}\s*원?\s*(?:입니다|이요|예요|요)?\.?$/.test(s)
      || /^\d+(?:\.\d+)?\s*만\s*원?\s*(?:입니다|이요|예요|요)?\.?$/.test(s);
}

// 2026-07-24 — 주소 후보 추출. 없으면 null.
function extractAddress(line) {
  const s = String(line).trim();
  // 1) 시·도 접두 (기존)
  const r = s.match(KO_REGION_RX);
  if (r) return r[0].replace(/\s*(입니다|이요|예요|요)\.?\s*$/, "").trim();
  // 2) ○○동 ○○호 패턴 ("한울마을 504동 505호 입니다")
  const dh = s.match(RX_DONG_HO);
  if (dh) return dh[1].replace(/\s+/g, " ").trim();
  return null;
}

// "에어컨 청소 / 벽걸이 2 / 350,000" 같은 한 줄에서 라벨·수량·가격 분리.
//   slash / pipe / 탭 / 다중 공백 모두 split 후 토큰 분류:
//     숫자 그룹 + (콤마/원/won/만원) → price
//     숫자 + (대|개|벌|x|×) → qty
//     그 외 → label 누적
function parseItemLine(rawLine) {
  const line = String(rawLine).trim();
  if (!line) return null;

  // 부가세표기 단서 줄은 항목 X.
  if (RX_VAT_EX.test(line) || RX_VAT_IN.test(line)) return null;

  // 주소 의심 줄은 항목 X.
  if (KO_REGION_RX.test(line) || RX_DONG_HO.test(line)) return null;

  // 2026-07-24 — 영수증/명세서 요청 문구 줄은 항목 X (docTypeHint 로 처리).
  if (RX_DOC_RECEIPT.test(line) || RX_DOC_INVOICE.test(line)) return null;

  // 2026-07-24 — 단독 금액 줄은 항목 X (합계 후보 — 3b 에서 처리).
  if (isAmountOnlyLine(line)) return null;

  const tokens = line.split(/\s*[\/|·•∙]\s*|\t+|\s{2,}/).map(t => t.trim()).filter(Boolean);
  const labels = [];
  let qty = 1;
  let price = null;

  for (const tok of tokens) {
    // 가격 패턴: "350,000" / "350000원" / "₩350,000" / "35만원"
    if (/^[₩￦]?\s*\d{1,3}(?:,\d{3})+(?:\s*원)?$/.test(tok)
        || /^\d{4,}\s*(?:원|won|KRW)?$/i.test(tok)
        || /^\d+(?:\.\d+)?\s*만\s*원?$/.test(tok)) {
      const v = pickFirstAmount(tok);
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

  let label = labels.join(" ").trim();
  // 라벨 없고 가격만 있는 줄은 합계 후보로 따로 다룸 → 항목 아님.
  if (!label) return null;

  // 2026-07-24 — 라벨 끝 "N대/N개" → qty 분리 ("1웨이 4대" → "1웨이" ×4).
  //   단위(대/개/벌) 필수 — "3키로"(kg) 같은 건 라벨 그대로 유지.
  if (qty === 1) {
    const tail = label.match(/^(.*?)\s+(\d{1,3})\s*(대|개|벌)\s*$/);
    if (tail && Number(tail[2]) >= 1 && Number(tail[2]) <= 999 && tail[1].trim().length >= 2) {
      label = tail[1].trim();
      qty = Number(tail[2]);
    }
  }

  return { label, qty, price: price ?? undefined };
}

// ──────────────────────────────────────────────
// 메인 — best-effort 파싱
// ──────────────────────────────────────────────
export function parseDocIssuePaste(rawText) {
  const out = {
    address:     "",
    phone:       "",
    items:       [],
    supplyPrice: null,
    totalAmount: null,
    vatMode:     null,
    docTypeHint: null,
    rawLines:    [],
  };

  const text = String(rawText || "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return out;

  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  out.rawLines = lines.slice();

  // 0) 2026-07-24 — 문서 종류 힌트 (영수증 우선 — 실사용 대부분).
  for (const line of lines) {
    if (RX_DOC_RECEIPT.test(line)) { out.docTypeHint = "receipt"; break; }
    if (RX_DOC_INVOICE.test(line)) { out.docTypeHint = "invoice"; break; }
  }

  // 1) 주소 — 시·도 접두 / 동·호 패턴 → (fallback) 구·군 단독 토큰.
  for (const line of lines) {
    const addr = extractAddress(line);
    if (addr) { out.address = addr; break; }
  }
  if (!out.address) {
    for (const line of lines) {
      const g = String(line).match(RX_GU_TOKEN);
      if (g) { out.address = g[2]; break; }
    }
  }

  // 1b) 연락처 — 첫 휴대폰 매치. KO_PHONE_REGEX 재사용 (receptionForm 과 공용).
  const phoneMatch = text.match(KO_PHONE_REGEX);
  if (phoneMatch) {
    let p = phoneMatch[0].replace(/^\+?82\s?-?\s?/, "").replace(/\D/g, "");
    if (p.startsWith("10") || p.startsWith("11") || p.startsWith("16") ||
        p.startsWith("17") || p.startsWith("18") || p.startsWith("19")) {
      p = "0" + p;
    }
    out.phone = formatPhone(p);
  }

  // 2) 부가세표기.
  for (const line of lines) {
    if (RX_VAT_EX.test(line)) { out.vatMode = "exclusive"; break; }
    if (RX_VAT_IN.test(line)) { out.vatMode = "inclusive"; break; }
  }

  // 3) 금액(합계/공급가) — 키워드 줄 우선.
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

  // 3b) 2026-07-24 — 단독 금액 줄 ("730,000" / "60만원") fallback.
  //     키워드 금액이 없을 때: 마지막 단독 금액 줄 = 총 금액 (품목 나열 뒤 합계 관례).
  //     부가세 별도 표기면 공급가로, 아니면 합계로.
  if (out.totalAmount == null && out.supplyPrice == null) {
    let standalone = null;
    for (const line of lines) {
      if (isAmountOnlyLine(line)) {
        const v = pickFirstAmount(line);
        if (v != null && v > 0) standalone = v;
      }
    }
    if (standalone != null) {
      if (out.vatMode === "exclusive") out.supplyPrice = standalone;
      else {
        out.totalAmount = standalone;
        if (out.vatMode == null) out.vatMode = "inclusive";
      }
    }
  }

  // 4) 품목 — slash/구분자 분리 줄에서 라벨·수량·가격 추출.
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
