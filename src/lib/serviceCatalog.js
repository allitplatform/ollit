// 2026-10-06 Mig 219 — 작업 종류 공통 목록 (종목별 묶음).
//   작업 종류를 고르는 모든 화면이 이 한 곳을 쓴다 (모바일 접수 / PC 접수 / 작업 상세 종목 선택).
//   · 출처: DB service_types(selectable·sort_order·scope·is_common) + categories(종목 이름).
//   · 값(name)은 저장·매칭 키다 — service_types.name 과 정확히 같은 글자 (저장 트리거가 이름으로 찾음).
//   · DB 를 못 읽거나 219 이전이면 아래 기본 목록으로 동작한다 (화면이 비지 않게).
//   · scope 'usol_n' 항목(YS-N 전용)은 유솔N 작업일 때만 노출.
import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

// 기본 목록 — DB 를 읽기 전 / 읽지 못했을 때.
const FALLBACK = [
  { key: "aircon", label: "에어컨", items: [
    { name: "세척", scope: "all" }, { name: "냉매충전", scope: "all" }, { name: "누설", scope: "all" },
    { name: "누수", scope: "all" }, { name: "설치", scope: "all" },
    { name: "추가선택(YS-N)", scope: "usol_n" }, { name: "냉매점검(YS-N)", scope: "usol_n" },
  ] },
  { key: "hood", label: "주방후드", items: [
    { name: "주방후드(업소용)", scope: "all" }, { name: "주방후드(가정용)", scope: "all" }, { name: "후드설치", scope: "all" },
  ] },
  { key: "common", label: "공통", items: [ { name: "출장비", scope: "all" } ] },
];

let _catalog = FALLBACK;
let _promise = null;
const _listeners = new Set();

async function _load() {
  try {
    const [{ data: sts, error: e1 }, { data: cats, error: e2 }] = await Promise.all([
      supabase.from("service_types").select("code, name, category_id, selectable, sort_order, scope, is_common"),
      supabase.from("categories").select("id, code, name"),
    ]);
    if (e1 || e2 || !Array.isArray(sts)) return _catalog;          // 219 이전(칸 없음) 포함 → 기본 목록 유지
    _buildCategoryIndex(sts, cats || []);
    const rows = sts.filter(s => s.selectable === true);
    if (rows.length === 0) return _catalog;
    const catById = new Map((cats || []).map(c => [c.id, c]));
    const groups = new Map();   // key → { key, label, order, items }
    for (const s of rows) {
      const cat = catById.get(s.category_id);
      const key = s.is_common ? "common" : (cat?.code || "etc");
      const label = s.is_common ? "공통" : (cat?.name || "기타");
      if (!groups.has(key)) groups.set(key, { key, label, items: [] });
      groups.get(key).items.push({ name: s.name, scope: s.scope || "all", order: Number(s.sort_order) || 999 });
    }
    const ORDER = { aircon: 0, hood: 1 };                           // 그 외 종목은 그 뒤, 공통은 맨 끝
    const list = [...groups.values()].sort((a, b) => {
      const ao = a.key === "common" ? 99 : (ORDER[a.key] ?? 50);
      const bo = b.key === "common" ? 99 : (ORDER[b.key] ?? 50);
      return ao - bo || a.label.localeCompare(b.label, "ko");
    });
    for (const g of list) g.items.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ko"));
    _catalog = list;
    for (const fn of _listeners) { try { fn(_catalog); } catch (_e) { /* 무시 */ } }
  } catch (_e) { /* 기본 목록 유지 */ }
  return _catalog;
}

export function loadServiceCatalog(force = false) {
  if (force) _promise = null;
  if (!_promise) _promise = _load();
  return _promise;
}

// YS-N 전용 2종 — 운영 DB 의 service_types 에는 이 이름의 행이 없다 (mig 219 결과로 확인).
//   유솔N 주문은 네이버 주문 일괄 등록 경로가 task_items 를 직접 넣는다.
//   접수 화면의 기존 동작(유솔N 일 때 칩 노출)은 유지하려고 여기서 덧붙인다.
const USOL_N_ONLY = [
  { name: "추가선택(YS-N)", scope: "usol_n" },
  { name: "냉매점검(YS-N)", scope: "usol_n" },
];

function _filter(catalog, principalCode) {
  const isUsolN = principalCode === "usol_n";
  const out = catalog
    .map(g => ({ ...g, items: g.items.filter(it => it.scope !== "usol_n" || isUsolN) }))
    .filter(g => g.items.length > 0);
  if (isUsolN && !out.some(g => g.items.some(it => it.scope === "usol_n"))) {
    const i = out.findIndex(g => g.key === "aircon");
    if (i >= 0) out[i] = { ...out[i], items: [...out[i].items, ...USOL_N_ONLY] };
    else out.unshift({ key: "aircon", label: "에어컨", items: [...USOL_N_ONLY] });
  }
  return out;
}

// 화면용 훅 — [{ key, label, items:[{name}] }]. principalCode 가 'usol_n' 일 때만 YS-N 전용 포함.
export function useServiceCatalog(principalCode) {
  const [cat, setCat] = useState(_catalog);
  useEffect(() => {
    _listeners.add(setCat);
    loadServiceCatalog().then(setCat);
    return () => { _listeners.delete(setCat); };
  }, []);
  return _filter(cat, principalCode);
}

// 동기 버전 (모듈 캐시) — 훅을 쓸 수 없는 곳.
export function getServiceCatalog(principalCode) {
  return _filter(_catalog, principalCode);
}

// 이름만 한 줄로 (묶음 순서 유지).
export function flattenServiceNames(groups) {
  return (groups || []).flatMap(g => g.items.map(it => it.name));
}

// 묶음 안에서의 짧은 표시 이름 — "주방후드(업소용)" → "업소용" (묶음 머리글이 종목을 말해 주므로).
export function shortServiceLabel(name, groupLabel) {
  const s = String(name || "");
  const m = s.match(/^(.+)\((.+)\)$/);
  if (m && groupLabel && m[1] === groupLabel) return m[2];
  return s;
}


// ============================================================================
// 2026-10-06 — 종목(카테고리) 기준표: 색 · 아이콘 · 짧은 이름.
//   화면의 색·아이콘은 "작업 종류(세척·냉매)" 가 아니라 "종목" 으로 정한다.
//   달력 점·범례, 작업 카드의 칩/색 띠, 작업 상세 상단 칩이 전부 이 표 한 곳을 쓴다.
//   · 에어컨 안의 세척/냉매 구분은 색이 아니라 카드의 작업 이름으로 본다.
//   · 표에 없는 종목 code 가 DB 에 생기면 "그 밖" 색으로 나오되 이름은 DB 의 종목 이름을 쓴다.
//   · codes: DB categories.code 로 올 수 있는 값들. 아직 DB 에 없는 종목(로봇청소기 등)은 미리 등록만 해 둔다.
// ============================================================================
export const CATEGORY_META = [
  { key: "aircon", codes: ["aircon"],                               label: "에어컨",     short: "에어컨", icon: "❄", color: "#0EA5E9" },
  { key: "hood",   codes: ["hood"],                                 label: "주방후드",   short: "후드",   icon: "🔥", color: "#F97316" },
  { key: "robot",  codes: ["robot", "robot_vacuum", "robotvac"],    label: "로봇청소기", short: "로봇",   icon: "🤖", color: "#8B5CF6" },
  { key: "leak",   codes: ["leak", "water_leak", "leakage"],        label: "누수",       short: "누수",   icon: "💧", color: "#14B8A6" },
  { key: "movein", codes: ["movein", "move_in", "move_in_cleaning"], label: "입주청소",  short: "입주",   icon: "🧹", color: "#22C55E" },
];
export const CATEGORY_OTHER = { key: "etc", codes: [], label: "그 밖", short: "그 밖", icon: "🔧", color: "#9CA3AF" };
// 2026-10-07 — 종목 미정: 작업 항목도 작업 이름도 없는 접수(문의 전환 직후 등).
//   저장된 종목 값이 "에어컨" 이어도 그것은 기본값일 뿐이라 에어컨으로 가정하지 않는다. 회색 🔧 "미정".
export const CATEGORY_UNKNOWN = { key: "unknown", codes: [], label: "종목 미정", short: "미정", icon: "🔧", color: "#9CA3AF" };

// 서비스 단위 예외 — 종목보다 먼저 본다. (2026-10-06 사장님 결정: 냉매는 ⚡ 노랑 유지)
//   판정 순서: 서비스 예외 → 종목 → 그 밖.
//   서비스 code 또는 이름이 아래 값과 "정확히" 같을 때만 해당한다 (글자 포함 검사 없음).
//   이름은 저장된 꼴("서비스_기종")에서 "_" 앞부분을 떼어 비교한다 — 아래 _serviceName 과 같은 규칙.
export const SERVICE_EXCEPTIONS = [
  {
    key: "refrigerant", label: "냉매", short: "냉매", icon: "⚡", color: "#FFB800", textOnColor: "#1A1A1A",
    codes: ["refrigerant", "refrigerant_check"],
    names: ["냉매충전", "냉매점검", "냉매점검(YS-N)", "냉매점검(서울 경기북부만 가능)"],
  },
  // 2026-10-07 사장님 결정 — 에어컨 안에서 설치 · 누수도 세척(❄)과 구분한다. (후드설치는 주방후드 🔥 그대로)
  {
    key: "install", label: "설치", short: "설치", icon: "🛠", color: "#6366F1",
    codes: ["install"],
    names: ["설치", "신규설치", "이전설치", "이전", "철거", "실외기중고교체", "기계중고교체"],
  },
  {
    key: "leak", label: "누수", short: "누수", icon: "💧", color: "#14B8A6",
    codes: ["leak", "water_leak"],
    names: ["누설", "누수"],
  },
];
function _exceptionOfItem(item) {
  if (!item) return null;
  if (typeof item === "string") {
    const n = _serviceName(item);
    return SERVICE_EXCEPTIONS.find(x => x.names.includes(n)) || null;
  }
  const code = String(item.serviceCode || item.service_code || "").trim();
  if (code) {
    const hit = SERVICE_EXCEPTIONS.find(x => x.codes.includes(code));
    if (hit) return hit;
  }
  return _exceptionOfItem(String(item.workType || item.work_type || item.name || ""));
}

// 종목 code → 표의 한 줄 (없으면 "그 밖")
export function categoryMetaByCode(code, name) {
  const c = String(code || "").trim();
  if (!c) return CATEGORY_OTHER;
  const hit = CATEGORY_META.find(m => m.codes.includes(c));
  if (hit) return hit;
  // 표에 없는 새 종목: 색·아이콘은 "그 밖", 이름은 DB 의 종목 이름
  const label = name || _catName.get(c) || CATEGORY_OTHER.label;
  return { ...CATEGORY_OTHER, key: c, label, short: label };
}

// 색인 — 서비스 이름 / 서비스 code / 종목 id → 종목 code.  공통 서비스(출장비 등)는 종목 판단에서 뺀다.
//   DB 를 읽기 전에는 아래 기본값(에어컨·주방후드)으로 동작한다.
let _byName = new Map([
  ["세척", "aircon"], ["냉매충전", "aircon"], ["누설", "aircon"], ["누수", "aircon"], ["설치", "aircon"],
  ["피톤치드", "aircon"], ["실외기 청소", "aircon"], ["송풍팬분해", "aircon"],
  ["추가선택(YS-N)", "aircon"], ["냉매점검(YS-N)", "aircon"],
  ["주방후드(업소용)", "hood"], ["주방후드(가정용)", "hood"], ["후드설치", "hood"],
]);
let _byCode = new Map([
  ["cleaning", "aircon"], ["refrigerant", "aircon"], ["leak", "aircon"], ["water_leak", "aircon"], ["install", "aircon"],
  ["phytoncide", "aircon"], ["outdoor_unit", "aircon"], ["fan_disassembly", "aircon"],
  ["hood_commercial", "hood"], ["hood_home", "hood"], ["hood_install", "hood"],
]);
let _commonNames = new Set(["출장비"]);
let _commonCodes = new Set(["visit_fee"]);
let _catById = new Map();     // categories.id → code
const _catName = new Map([["aircon", "에어컨"], ["hood", "주방후드"]]);

function _buildCategoryIndex(sts, cats) {
  const byId = new Map(cats.map(c => [c.id, c]));
  const byName = new Map(), byCode = new Map(), commonN = new Set(), commonC = new Set();
  for (const st of sts) {
    const cat = byId.get(st.category_id);
    if (st.is_common) { if (st.name) commonN.add(st.name); if (st.code) commonC.add(st.code); continue; }
    if (!cat) continue;
    if (st.name) byName.set(st.name, cat.code);
    if (st.code) byCode.set(st.code, cat.code);
  }
  if (byName.size === 0 && byCode.size === 0) return;      // 못 읽었으면 기본값 유지
  // YS-N 전용 이름은 DB 에 행이 없다 → 기본값에서 이어받는다
  for (const [k, v] of _byName) if (!byName.has(k) && !commonN.has(k)) byName.set(k, v);
  _byName = byName; _byCode = byCode; _commonNames = commonN; _commonCodes = commonC;
  _catById = new Map(cats.map(c => [c.id, c.code]));
  for (const c of cats) if (c.code && c.name) _catName.set(c.code, c.name);
}

// 저장된 작업 이름은 "서비스_기종" 꼴일 수 있다 (예: "세척_1way", "주방후드(업소용)_(공통)").
//   구분자 "_" 앞부분이 서비스 이름이다. (글자 포함 검사는 하지 않는다 — 색인에 있는 이름과 정확히 같을 때만 인정)
function _serviceName(workType) {
  const s = String(workType || "").trim();
  if (!s) return "";
  if (_byName.has(s) || _commonNames.has(s)) return s;
  const i = s.indexOf("_");
  return i > 0 ? s.slice(0, i) : s;
}

// 항목 하나(문자열 또는 workItem) → 종목 code. 공통 서비스면 "common", 모르면 "".
function _categoryCodeOfItem(item) {
  if (!item) return "";
  if (typeof item === "string") {
    const n = _serviceName(item);
    if (_commonNames.has(n)) return "common";
    return _byName.get(n) || "";
  }
  const code = String(item.serviceCode || item.service_code || "").trim();
  if (code) {
    if (_commonCodes.has(code)) return "common";
    if (_byCode.has(code)) return _byCode.get(code);
  }
  return _categoryCodeOfItem(String(item.workType || item.work_type || item.name || ""));
}

// 작업(task) · workItem · 작업 이름 문자열 → 종목 표의 한 줄 { key, label, short, icon, color }.
//   · 항목이 여러 개면 "공통(출장비 등)" 을 뺀 첫 항목의 종목.
//   · 항목으로 못 정하면 작업의 종목(category) 값, 그래도 없으면 "그 밖".
export function getCategoryMeta(input) {
  if (!input) return CATEGORY_UNKNOWN;
  if (typeof input === "string") {
    if (!input.trim()) return CATEGORY_UNKNOWN;          // 이름이 비어 있으면 "미정" (에어컨으로 가정하지 않는다)
    const ex = _exceptionOfItem(input);
    if (ex) return ex;
    const c = _categoryCodeOfItem(input);
    return c && c !== "common" ? categoryMetaByCode(c) : CATEGORY_OTHER;
  }
  // 공통(출장비 등)을 뺀 "첫 항목" 이 정한다: 그 항목이 서비스 예외면 예외, 아니면 그 항목의 종목.
  const items = Array.isArray(input.workItems) ? input.workItems.filter(w => w && !(w.isCanceled || w.is_canceled)) : [];
  for (const it of items) {
    const c = _categoryCodeOfItem(it);
    if (c === "common") continue;
    const ex = _exceptionOfItem(it);
    if (ex) return ex;
    if (c) return categoryMetaByCode(c);
  }
  const selfItem = { serviceCode: input.serviceCode || input.service_code, workType: input.workType || input.work_type };
  const self = _categoryCodeOfItem(selfItem);
  if (self !== "common") {
    const ex = _exceptionOfItem(selfItem);
    if (ex) return ex;
    if (self) return categoryMetaByCode(self);
  }
  const direct = String(input.categoryCode || input.category_code || "").trim() || _catById.get(input.categoryId || input.category_id) || "";
  // 2026-10-07 — 항목도 작업 이름도 전혀 없는 접수: 저장된 종목이 에어컨이면 그것은 기본값일 뿐이다 → "미정".
  //   (에어컨이 아닌 종목 값은 누군가 정한 것이므로 그대로 따른다)
  const nothing = items.length === 0 && !String(selfItem.workType || "").trim() && !String(selfItem.serviceCode || "").trim();
  if (nothing && (!direct || direct === "aircon")) return CATEGORY_UNKNOWN;
  // 항목이 공통(출장비)뿐인 작업은 작업 자체의 종목 값을 따른다 (DB 를 읽은 뒤에만 알 수 있다)
  return direct ? categoryMetaByCode(direct) : CATEGORY_OTHER;
}

// 작업의 항목(서비스)으로 종목 id(categories.id) 를 정한다 — 저장할 때 쓴다 (2026-10-07).
//   "공통(출장비 등)" 을 뺀 첫 항목의 종목. 못 정하면(목록을 아직 못 읽었거나 모르는 이름) null → 부르는 쪽이 기본값을 쓴다.
//   사고: 접수 폼이 종목을 안 넣어 주방후드 작업이 전부 에어컨으로 저장 → 협력사 기사 전원 "이 종목 불가".
export function categoryIdOfTask(task) {
  if (!task) return null;
  // 접수 어댑터는 항목을 categoryData(jsonb) 안에 넣어 보낸다 → 두 곳 다 본다
  const cd = task.categoryData || {};
  const items = Array.isArray(task.workItems) ? task.workItems : (Array.isArray(cd.workItems) ? cd.workItems : []);
  const candidates = [...items, { serviceCode: task.serviceCode, workType: task.workType || cd.workType }];
  for (const it of candidates) {
    const c = _categoryCodeOfItem(it);
    if (!c || c === "common") continue;
    for (const [id, code] of _catById) if (code === c) return id;
    return null;
  }
  return null;
}

// 색 띠·칩 배경용 옅은 색 (#RRGGBB → rgba)
export function categoryTint(color, alpha = 0.14) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(color || ""));
  if (!m) return "transparent";
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// 목록에 실제로 있는 종목만 (달력 범례용) — 표의 순서대로, "그 밖" 은 맨 뒤.
export function categoriesInTasks(tasks) {
  const seen = new Map();
  for (const t of (tasks || [])) { const m = getCategoryMeta(t); if (!seen.has(m.key)) seen.set(m.key, m); }
  // 순서: 종목 표 순서, 서비스 예외(냉매)는 에어컨 바로 뒤, 표에 없는 새 종목은 그 뒤, "그 밖" 은 맨 끝
  const order = (m) => {
    const xi = SERVICE_EXCEPTIONS.findIndex(x => x.key === m.key);
    if (xi >= 0) return 0.5 + xi * 0.1;                  // 냉매 · 설치 · 누수 순으로 에어컨 바로 뒤
    const i = CATEGORY_META.findIndex(x => x.key === m.key);
    return i < 0 ? (m.key === "etc" || m.key === "unknown" ? 999 : 500) : i;
  };
  return [...seen.values()].sort((a, b) => order(a) - order(b));
}


// ============================================================================
// 2026-10-06 — 서비스별 기본 소요 시간(시간). PC 타임라인의 막대 길이에만 쓴다 (정산·일정 계산과 무관).
//   표에 없는 서비스는 1시간. 한 작업에 항목이 여러 개면 그중 가장 긴 값.
//   이름·code 는 정확히 같을 때만 해당한다 ("서비스_기종" 꼴은 "_" 앞부분으로 비교).
// ============================================================================
export const SERVICE_DURATION_HOURS = {
  names: { "주방후드(업소용)": 2, "주방후드(가정용)": 1.5, "후드설치": 2 },
  codes: { hood_commercial: 2, hood_home: 1.5, hood_install: 2 },
  fallback: 1,
};
function _durationOfItem(item) {
  if (!item) return 0;
  if (typeof item === "string") return SERVICE_DURATION_HOURS.names[_serviceName(item)] || 0;
  const code = String(item.serviceCode || item.service_code || "").trim();
  if (code && SERVICE_DURATION_HOURS.codes[code]) return SERVICE_DURATION_HOURS.codes[code];
  return _durationOfItem(String(item.workType || item.work_type || item.name || ""));
}
export function getTaskDurationHours(task) {
  if (!task) return SERVICE_DURATION_HOURS.fallback;
  const items = Array.isArray(task.workItems) ? task.workItems.filter(w => w && !(w.isCanceled || w.is_canceled)) : [];
  let max = 0;
  for (const it of items) max = Math.max(max, _durationOfItem(it));
  max = Math.max(max, _durationOfItem(String(task.workType || task.work_type || "")));
  return max > 0 ? max : SERVICE_DURATION_HOURS.fallback;
}
