// 2026-10-07 Mig 259 — 이전설치: 철거(출발) 주소 / 설치(도착) 주소 + 철거비 / 설치비.
//   · 기존 주소(tasks.address) = 철거 주소, 새 칸 tasks.dest_address = 설치 주소, dest_detail = 설치 주소 메모.
//   · 견적은 새 금액 칸을 만들지 않고 작업 항목 두 줄(철거 / 이전설치)의 단가로 나눈다. 견적 = 두 줄 합.
//   · 설치 기사 몫(비율은 DB 의 날짜별 비율 표 — mig 261)은 작업 전체 금액으로 계산하므로 항목을 둘로 나눠도 결과가 같다.
import { extractRegion } from "./partnerPasteParser.js";
import { splitAddress } from "./addressParts.js";

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
  // 2026-10-07 — 구·동까지 (주소 표시 규칙). 뽑지 못하면 예전처럼 구 이름.
  const fromAddr = task.fullAddress || task.address || "";
  const from = splitAddress(fromAddr).head || extractRegion(fromAddr) || task.region || "";
  const dest = String(task.destAddress || task.dest_address || "").trim();
  const to = dest ? (splitAddress(dest).head || extractRegion(dest) || dest.split(/\s+/).slice(0, 2).join(" ")) : "";
  if (!from && !to) return "";
  return `① ${from || "?"} → ② ${to || "미정"}`;
}

// 지도 앱을 바로 여는 주소 (주소 검색). 기사 앱의 기존 티맵 · 카카오맵 버튼과 같은 스킴.
export function mapAppLinks(address) {
  const q = encodeURIComponent(String(address || "").trim());
  return {
    kakao: `kakaomap://search?q=${q}`,
    tmap:  `tmap://search?name=${q}`,
    naver: `nmap://search?query=${q}&appname=app.ollit`,
  };
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

// 2026-10-07 — 항목 요약 (모든 항목): "철거 ×1 · 이전설치 ×1". 항목이 2개 이상일 때만 글자를 돌려준다.
export function allItemsSummary(task) {
  const items = (Array.isArray(task && task.workItems) ? task.workItems : []).filter(_alive);
  if (items.length < 2) return "";
  return items.map(it => {
    const ap = it.appliance && it.appliance !== "(공통)" ? it.appliance : "";
    const nm = ap || it.description || String(it.workType || "").replace(/_\(공통\)$/, "");
    return `${nm}${Number(it.qty) > 0 ? ` ×${it.qty}` : ""}`;
  }).join(" · ");
}

// 2026-10-07 — 길찾기 할 주소 고르기. 이전설치가 아니면 그 작업의 주소를 바로 돌려준다.
//   이전설치면 화면 아래에 "철거(출발)로 / 설치(도착)로" 고르는 창을 띄운다. 닫으면 null.
//   작업이 진행 중이면 설치(도착)를 위에 둔다 (철거를 마치고 이동하는 때가 많으므로).
export function chooseRouteAddress(task) {
  const from = String((task && (task.fullAddress || task.address)) || "").trim();
  const dest = String((task && (task.destAddress || task.dest_address)) || "").trim();
  if (!dest || typeof document === "undefined") return Promise.resolve(from);
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;";
    const box = document.createElement("div");
    box.style.cssText = "width:100%;max-width:480px;background:var(--bg-elevated,#1f1f1f);color:var(--text-primary,#fff);border-radius:18px 18px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px));font-family:inherit;box-sizing:border-box;";
    const title = document.createElement("div");
    title.textContent = "어디로 길찾기 할까요?";
    title.style.cssText = "font-size:15px;font-weight:800;margin-bottom:10px;";
    box.appendChild(title);
    const done = (v) => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); resolve(v); };
    const mk = (label, addr, color) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.cssText = `display:block;width:100%;text-align:left;padding:13px 14px;margin-bottom:8px;border-radius:12px;border:1px solid var(--border,#333);border-left:4px solid ${color};background:transparent;color:inherit;font-family:inherit;cursor:pointer;`;
      const l = document.createElement("div"); l.textContent = label; l.style.cssText = `font-size:12.5px;font-weight:800;color:${color};`;
      const a = document.createElement("div"); a.textContent = addr || "주소 없음"; a.style.cssText = "font-size:15px;font-weight:700;margin-top:3px;word-break:keep-all;";
      b.appendChild(l); b.appendChild(a);
      b.onclick = () => done(addr || null);
      return b;
    };
    const st = String((task && task.status) || "");
    const destFirst = st === "진행중" || st === "작업중";
    const bFrom = mk("① 철거 (출발)로", from, "#F97316");
    const bDest = mk("② 설치 (도착)로", dest, "#6366F1");
    if (destFirst) { box.appendChild(bDest); box.appendChild(bFrom); } else { box.appendChild(bFrom); box.appendChild(bDest); }
    const c = document.createElement("button");
    c.type = "button"; c.textContent = "닫기";
    c.style.cssText = "display:block;width:100%;padding:11px;border-radius:12px;border:none;background:transparent;color:var(--text-secondary,#aaa);font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;";
    c.onclick = () => done(null);
    box.appendChild(c);
    box.onclick = (e) => e.stopPropagation();
    wrap.onclick = () => done(null);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
  });
}

// 2026-10-07 — 이전설치 작업의 항목 순서: 철거 → 이전설치 (다른 항목 · 다른 작업은 원래 순서 그대로).
export function sortRelocationOrder(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.some(it => _isInstallSvc(it) && _txt(it).includes(RELOC_INSTALL))) return list;
  const rank = (it) => (_isInstallSvc(it) && _txt(it).includes(RELOC_INSTALL) ? 1 : 0);
  return list.map((it, i) => [it, i]).sort((a, b) => (rank(a[0]) - rank(b[0])) || (a[1] - b[1])).map(x => x[0]);
}
