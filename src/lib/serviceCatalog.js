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
