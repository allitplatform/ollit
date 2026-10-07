// 2026-10-07 Mig 259 — 이전설치: 철거(출발) 주소 / 설치(도착) 주소 + 철거비 / 설치비.
//   · 기존 주소(tasks.address) = 철거 주소, 새 칸 tasks.dest_address = 설치 주소, dest_detail = 설치 주소 메모.
//   · 견적은 새 금액 칸을 만들지 않고 작업 항목 두 줄(철거 / 이전설치)의 단가로 나눈다. 견적 = 두 줄 합.
//   · 설치 기사 몫(80%)은 작업 전체 금액으로 계산하므로 항목을 둘로 나눠도 결과가 같다.
import { extractRegion } from "./partnerPasteParser.js";

export const RELOC_INSTALL = "이전설치";
export const RELOC_REMOVE = "철거";

const _txt = (it) => [it && it.appliance, it && it.description, it && it.name].map(v => String(v || "")).join("|");
const _isInstallSvc = (it) => String((it && (it.workType || it.work_type)) || "").replace(/_.*$/, "") === "설치";
const _alive = (it) => it && !(it.isCanceled || it.is_canceled);

// 접수 화면: 고른 항목에 "설치 · 이전설치" 가 있는가
export function isRelocationItems(items) {
  return (Array.isArray(items) ? items : []).some(it => _alive(it) && _isInstallSvc(it) && _txt(it).includes(RELOC_INSTALL));
}
// 저장된 작업: 설치 주소가 있거나, 항목에 이전설치가 있으면 이전설치 작업
export function isRelocationTask(task) {
  if (!task) return false;
  if (String(task.destAddress || task.dest_address || "").trim()) return true;
  return isRelocationItems(task.workItems);
}

// 이전설치 항목 1줄 → "철거"(철거비) + "이전설치"(설치비) 두 줄. 다른 항목은 그대로.
//   금액을 둘 다 0 으로 두면 나누지 않는다 (견적 미정 등).
export function splitRelocationItems(items, removeFee, installFee) {
  const rem = Math.max(0, Math.round(Number(removeFee) || 0));
  const ins = Math.max(0, Math.round(Number(installFee) || 0));
  const list = Array.isArray(items) ? items : [];
  if (rem + ins <= 0) return list;
  const out = [];
  let done = false;
  for (const it of list) {
    if (!done && _alive(it) && _isInstallSvc(it) && _txt(it).includes(RELOC_INSTALL)) {
      const qty = Math.max(1, Number(it.qty) || 1);
      out.push({ ...it, appliance: RELOC_REMOVE, description: RELOC_REMOVE, qty: 1, quote: rem });
      out.push({ ...it, appliance: RELOC_INSTALL, description: RELOC_INSTALL, qty, quote: Math.round(ins / qty) });
      done = true;
    } else {
      out.push(it);
    }
  }
  return out;
}

// 저장된 작업의 철거비 / 설치비 (항목 단가에서 읽는다). 못 찾으면 null.
export function relocationFees(task) {
  const items = (Array.isArray(task && task.workItems) ? task.workItems : []).filter(_alive);
  const price = (it) => {
    const sub = Number(it.subtotal);
    if (Number.isFinite(sub) && sub > 0) return sub;
    return (Number(it.unitPrice ?? it.unit_price ?? it.quote) || 0) * (Number(it.qty) || 1);
  };
  const rem = items.find(it => _isInstallSvc(it) && _txt(it).includes(RELOC_REMOVE));
  const ins = items.find(it => _isInstallSvc(it) && _txt(it).includes(RELOC_INSTALL));
  if (!rem || !ins) return null;
  return { removeFee: price(rem), installFee: price(ins) };
}

// 카드 한 줄: "철거 강남구 → 설치 송파구"
export function relocationLine(task) {
  if (!isRelocationTask(task)) return "";
  const from = extractRegion(task.address || "") || task.region || "";
  const dest = String(task.destAddress || task.dest_address || "").trim();
  const to = dest ? (extractRegion(dest) || dest.split(/\s+/).slice(0, 2).join(" ")) : "";
  if (!from && !to) return "";
  return `철거 ${from || "?"} → 설치 ${to || "미정"}`;
}

// 좌표 없이 주소 검색으로 여는 지도 링크 (웹). 2단계에서 좌표·길안내로 바꾼다.
export function mapSearchLinks(address) {
  const q = encodeURIComponent(String(address || "").trim());
  return {
    kakao: `https://map.kakao.com/?q=${q}`,
    tmap:  `https://tmap.life/?q=${q}`,
    naver: `https://map.naver.com/v5/search/${q}`,
  };
}
