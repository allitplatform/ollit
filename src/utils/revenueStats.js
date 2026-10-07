// 2026-06-03 — 매출 통계 helper (대시보드 "매출 현황" 블록 측측).
//   드리프트 측측 측측 dataset 측측 — computeDashboardStats 측측 측측 측측:
//     · isTrackARemittance(t) — 트랙 A + 완료/visit_only (= 유솔N 세척/추가선택 측측 측측)
//     · toKstYmd(completed) 측측 KST 측측 측측
//     · total = task.totalAmount (GENERATED = product_price + extra_fee + travel_fee)
//     · margin = owner_amount / engineer = engineer_amount / principal = principal_amount
//   compute_payment v16 측측 engineer + principal + owner = totalAmount 측측 보장.
//
// 종류별 (cleaning/refrigerant):
//   task.workItems 측 본작업(orderType='본작업') 측측 측측 serviceCode 측측 task-level 측측.
//   단일 service task 측측 (= 측측 측측측 측측) — 측측 측측 측측.

import { toKstYmd } from "./dateLabel.js";
import { isTrackARemittance } from "./remitFilter.js";
import { canSeeField } from "../data/permissions.js";
import { getCategoryMetaOfRow, CATEGORY_META, SERVICE_EXCEPTIONS } from "../lib/serviceCatalog.js";

const EMPTY = {
  total: 0, engineer: 0, principal: 0, owner: 0,
  // 2026-06-28 — install/leak 버킷 분리 (Mig 122/124/125 활성화 반영).
  //   합계 무결성: cleaning + refrigerant + install + leak + other = total.
  byService: { cleaning: 0, refrigerant: 0, install: 0, leak: 0, other: 0 },
  byServiceDetail: {
    cleaning:    { total: 0, count: 0, owner: 0 },
    refrigerant: { total: 0, count: 0, owner: 0 },
    install:     { total: 0, count: 0, owner: 0 },
    leak:        { total: 0, count: 0, owner: 0 },
    other:       { total: 0, count: 0, owner: 0 },
  },
  count: 0,
  // 2026-10-06 Mig 229 — 협력사 작업(track S). 수수료만 회사 수입, 받은 금액은 참고(거래액).
  //   owner       = 회사 수입 합계 (직영·원청 + 협력사 수수료)
  //   ownerDirect = 협력사 수수료를 뺀 기존 회사 수입 (기존 숫자와 대조용)
  //   subFee      = 협력사 수수료 가운데 회사 몫 (= 수수료 − 원청 몫)   subShare = 원청 몫 (회사 수입 아님)
  ownerDirect: 0, subFee: 0, subShare: 0, subGross: 0, subCount: 0,
};

// 협력사 작업 집계 — 완료 + track S + 완료일(KST)이 기간 안.
function _sumSubFee(apiTasks, startYmd, endYmd) {
  let subFee = 0, subShare = 0, subGross = 0, subCount = 0;
  for (const t of (apiTasks || [])) {
    if (!t || t.status !== "완료") continue;
    const track = t.track || t.payment?.track;
    if (track !== "S") continue;
    const completed = t.completedAt || t.completed_at;
    if (!completed) continue;
    const ymd = toKstYmd(completed);
    if (!ymd || ymd < startYmd || ymd > endYmd) continue;
    // 2026-10-07 Mig 244 — 수수료 가운데 원청 몫은 회사 수입이 아니다. 회사 몫 = 수수료 − 원청 몫.
    const share = Math.max(0, Number(t.sub_principal_share || 0));
    subFee   += Number(t.owner_amount || 0) - share;
    subShare += share;
    subGross += Number(t.receivedTotal ?? t.received_total ?? 0) || 0;
    subCount += 1;
  }
  return { subFee, subShare, subGross, subCount };
}

// 2026-10-07 — 매출 현황 화면용 덧붙임 값 (대시보드 모바일 · PC 매출 패널).
//   · cats      : 기존 4칸(세척·냉매·설치·누수)에 들지 않는 종목별 합계. 종목 기준표(serviceCatalog)의 색·아이콘을 쓴다.
//                 직영 작업은 총액, 협력사 작업(track S)은 받은 공급가. 회사 몫 = 수수료 − 원청 몫.
//   · directExtra : cats 가운데 직영분 합계 (기존 "기타" 칸에 이미 들어 있는 금액 → 화면에서 기타에서 뺀다)
//   · subSupply : 협력사 작업의 받은 공급가 합계 (매출 합계에 더한다)
//   · subKeep   : 그 가운데 협력사가 갖는 금액 (= 공급가 − 수수료). "협력사 정산" 줄.
const _FIXED_CODES = new Set(["cleaning", "refrigerant", "install", "leak"]);
const _FIXED_META_KEYS = new Set(["aircon", "etc", "unknown", "refrigerant", "install", "leak"]);
function _extras(apiTasks, startYmd, endYmd) {
  const cats = {};
  let subKeep = 0, subSupply = 0, directExtra = 0, vat = 0, vatCount = 0;
  const add = (meta, amt, owner) => {
    const c = cats[meta.key] || (cats[meta.key] = { key: meta.key, label: meta.label, icon: meta.icon, color: meta.color, total: 0, count: 0, owner: 0 });
    c.total += amt; c.count += 1; c.owner += owner;
  };
  for (const t of (apiTasks || [])) {
    if (!t) continue;
    const completed = t.completedAt || t.completed_at;
    if (!completed) continue;
    const ymd = toKstYmd(completed);
    if (!ymd || ymd < startYmd || ymd > endYmd) continue;
    const share = Math.max(0, Number(t.sub_principal_share || 0));
    const track = t.track || t.payment?.track || "A";
    if (track === "S") {
      if (t.status !== "완료") continue;
      const supply = Number(t.supplyAmount ?? t.supply_amount ?? 0) || Number(t.receivedTotal ?? t.received_total ?? 0) || 0;
      const fee = Number(t.owner_amount || 0);
      add(getCategoryMetaOfRow(t), supply, fee - share);
      subKeep += Math.max(0, supply - fee);
      subSupply += supply;
      continue;
    }
    if (!isTrackARemittance(t)) continue;
    if (_FIXED_CODES.has(pickServiceCode(t))) continue;
    const meta = getCategoryMetaOfRow(t);
    if (_FIXED_META_KEYS.has(meta.key)) continue;
    const amt = Number(t.totalAmount || t.총금액 || t.estimateTotal || 0);
    // 2026-10-07 Mig 258 — 직영 주방후드를 부가세 포함으로 받았으면 부가세는 매출·회사 몫·기사 몫 어디에도 넣지 않는다.
    const v = (t.vatIncluded === true || t.vat_included === true) ? Math.max(0, amt - Math.round(amt / 1.1)) : 0;
    add(meta, amt - v, Number(t.owner_amount || 0) - share);
    directExtra += amt;        // "기타" 칸에 들어 있던 금액(부가세 포함)을 그대로 뺀다
    vat += v;
    if (v > 0) vatCount += 1;
  }
  return { cats, subKeep, subSupply, directExtra, vat, vatCount };
}

// 집계 결과 → 매출 현황 화면에 그릴 값. 종목 줄은 기준표 순서, 0원은 뺀다.
//   total = 직영·원청 총액 + 협력사 받은 공급가  /  parts 합계 = total
export function revenueView(rev) {
  const r = rev || {};
  const x = r.ext || { cats: {}, subKeep: 0, subSupply: 0, directExtra: 0, vat: 0 };
  const bs = r.byService || {};
  const bd = r.byServiceDetail || {};
  const vat = Number(x.vat) || 0;
  const total = (Number(r.total) || 0) - vat + x.subSupply;      // 총 거래액 (부가세 제외)
  const ex = (k) => SERVICE_EXCEPTIONS.find(e => e.key === k) || {};
  const aircon = CATEGORY_META.find(c => c.key === "aircon") || {};
  const fixed = [
    { key: "cleaning",    label: "세척", icon: aircon.icon || "❄", color: aircon.color || "#0EA5E9" },
    { key: "refrigerant", label: "냉매", icon: ex("refrigerant").icon || "⚡", color: ex("refrigerant").color || "#FFB800" },
    { key: "install",     label: "설치", icon: ex("install").icon || "🛠", color: ex("install").color || "#6366F1" },
    { key: "leak",        label: "냉매 누설·물 누수", icon: ex("leak").icon || "💧", color: ex("leak").color || "#14B8A6" },
  ].map(f => ({ ...f, total: Number(bs[f.key]) || 0, count: Number(bd[f.key]?.count) || 0, owner: Number(bd[f.key]?.owner) || 0 }));
  const order = CATEGORY_META.map(c => c.key);
  const extra = Object.values(x.cats).sort((a, b) => {
    const ia = order.indexOf(a.key), ib = order.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const otherTotal = Math.max(0, (Number(bs.other) || 0) - x.directExtra);
  const other = { key: "other", label: "기타", icon: "•", color: "#9CA3AF", total: otherTotal,
                  count: Math.max(0, (Number(bd.other?.count) || 0) - extra.reduce((s, c) => s + c.count, 0) + extra.filter(c => false).length),
                  owner: Number(bd.other?.owner) || 0 };
  return {
    total,
    vat,
    vatCount: Number(x.vatCount) || 0,
    count: (Number(r.count) || 0) + (Number(r.subCount) || 0),
    engineer: Number(r.engineer) || 0,
    subKeep: x.subKeep,
    principal: (Number(r.principal) || 0) + (Number(r.subShare) || 0),
    owner: Number(r.owner) || 0,
    services: [...fixed, ...extra, other].filter(s => s.total > 0),
  };
}

// 직영 작업(track A)에 붙은 원청 몫 합계 — 완료 계열 + 완료일(KST)이 기간 안. 지금은 직영 주방후드만 해당.
function _sumDirectShare(apiTasks, startYmd, endYmd) {
  let s = 0;
  for (const t of (apiTasks || [])) {
    if (!isTrackARemittance(t)) continue;
    const completed = t.completedAt || t.completed_at;
    if (!completed) continue;
    const ymd = toKstYmd(completed);
    if (!ymd || ymd < startYmd || ymd > endYmd) continue;
    s += Math.max(0, Number(t.sub_principal_share || 0));
  }
  return s;
}

// 기존 집계 결과(서버 요약 또는 클라이언트 계산의 직영·원청분)에 협력사 수수료를 얹는다.
//   기존 칸(total / engineer / principal / byService / count)은 건드리지 않는다.
//   owner 만 "기존 + 협력사 수수료" 로 바뀌고, 기존 값은 ownerDirect 에 남긴다.
export function withSubFee(rev, apiTasks, startYmd, endYmd, user) {
  if (!rev) return rev;
  if (!canSeeField(user, "task.total_amount") || !startYmd || !endYmd) {
    return { ...rev, ownerDirect: Number(rev.owner) || 0, subFee: 0, subShare: 0, subGross: 0, subCount: 0 };
  }
  const sub = _sumSubFee(apiTasks, startYmd, endYmd);
  // 2026-10-07 Mig 256 — 서버 요약의 회사 몫은 owner_amount 합계라 직영 주방후드의 원청 몫이 들어 있다 → 뺀다.
  const dShare = _sumDirectShare(apiTasks, startYmd, endYmd);
  const ownerDirect = (Number(rev.owner) || 0) - dShare;
  return { ...rev, principal: (Number(rev.principal) || 0) + dShare, ownerDirect, owner: ownerDirect + sub.subFee, ...sub,
           ext: _extras(apiTasks, startYmd, endYmd) };
}

// 2026-07-14 — Stage 2c: 서버 집계(get_admin_dashboard_summary) 응답 → computeRevenueByYmRange 반환 형태 매핑.
//   RevenueOverviewBlock(모바일) + AdminPcRevenuePanel(PC) 공용. '오늘' 뷰 전용 (RPC가 당일만 제공).
export function fromServerSummary(s) {
  const r  = (s && s.revenue) || {};
  const bs = (s && s.by_service) || {};
  const det = (k) => ({
    total: Number(bs[k]?.amount || 0),
    count: Number(bs[k]?.count  || 0),
    owner: Number(bs[k]?.owner  || 0),
  });
  const d = {
    cleaning:    det("cleaning"),
    refrigerant: det("refrigerant"),
    install:     det("install"),
    leak:        det("leak"),
    other:       det("other"),
  };
  return {
    total:     Number(r.total           || 0),
    engineer:  Number(r.engineer_settle || 0),
    principal: Number(r.principal_fee   || 0),
    owner:     Number(r.company_margin  || 0),
    byService: {
      cleaning:    d.cleaning.total,
      refrigerant: d.refrigerant.total,
      install:     d.install.total,
      leak:        d.leak.total,
      other:       d.other.total,
    },
    byServiceDetail: d,
    count: d.cleaning.count + d.refrigerant.count + d.install.count + d.leak.count + d.other.count,
  };
}

// task 의 대표 service code (= 본작업 또는 첫 item 기준).
// 2026-06-16 — export 공개: RevenueDetailScreen 작업별 탭의 종류 뱃지(세척/냉매/기타) 분류용.
export function pickServiceCode(task) {
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  if (items.length === 0) return null;
  const main = items.find(it => (it.orderType || it.order_type) === "본작업") || items[0];
  return main?.serviceCode || main?.service_code || null;
}

// 핵심 helper — 측측 측측측 측측 (startYmd ~ endYmd, KST). startYmd <= endYmd 측측.
//   apiTasks 측측 측측 측측 — computeDashboardStats 측측 측측 일치.
export function computeRevenueByYmRange(apiTasks, startYmd, endYmd, user) {
  if (!canSeeField(user, "task.total_amount")) return { ...EMPTY };
  if (!startYmd || !endYmd) return { ...EMPTY };

  const list = (apiTasks || []).filter(t => {
    if (!isTrackARemittance(t)) return false;
    const completed = t.completedAt || t.completed_at || t.completedDate || t.완료시간 || t.completedTime;
    if (!completed) return false;
    const ymd = toKstYmd(completed);
    if (!ymd) return false;
    return ymd >= startYmd && ymd <= endYmd;
  });

  let total = 0, engineer = 0, principal = 0, owner = 0;
  let cleaning = 0, refrigerant = 0, install = 0, leak = 0, other = 0;
  // 2026-06-12 — 종류별 세부 (count / owner) 누적 — PC 매출 패널용.
  // 2026-06-28 — install/leak 카운트/owner 추가.
  let cleaningCount = 0, refrigerantCount = 0, installCount = 0, leakCount = 0, otherCount = 0;
  let cleaningOwner = 0, refrigerantOwner = 0, installOwner = 0, leakOwner = 0, otherOwner = 0;
  for (const t of list) {
    const amt   = Number(t.totalAmount || t.총금액 || t.estimateTotal || 0);
    // 2026-10-07 Mig 256 — 직영 주방후드: 수수료(owner_amount) 가운데 원청 몫은 회사 수입이 아니다.
    //   회사 몫 = 수수료 − 원청 몫, 원청 몫은 "원청" 칸으로 옮긴다 (협력사 작업 · 가계부와 같은 기준).
    const dShare = Math.max(0, Number(t.sub_principal_share || 0));
    const ownAmt = Number(t.owner_amount || 0) - dShare;
    total     += amt;
    engineer  += Number(t.engineer_amount || 0);
    principal += Number(t.principal_amount || 0) + dShare;
    owner     += ownAmt;

    const code = pickServiceCode(t);
    if (code === "cleaning") {
      cleaning      += amt;
      cleaningCount += 1;
      cleaningOwner += ownAmt;
    } else if (code === "refrigerant") {
      refrigerant      += amt;
      refrigerantCount += 1;
      refrigerantOwner += ownAmt;
    } else if (code === "install") {
      install      += amt;
      installCount += 1;
      installOwner += ownAmt;
    } else if (code === "leak") {
      leak      += amt;
      leakCount += 1;
      leakOwner += ownAmt;
    } else {
      other      += amt;
      otherCount += 1;
      otherOwner += ownAmt;
    }
  }

  // 2026-10-06 Mig 229 — 협력사 수수료를 회사 수입에 포함 (완료일 기준). 기존 칸은 그대로.
  const _sub = _sumSubFee(apiTasks, startYmd, endYmd);
  return {
    total, engineer, principal, owner: owner + _sub.subFee,
    ownerDirect: owner, ..._sub,
    ext: _extras(apiTasks, startYmd, endYmd),
    byService: { cleaning, refrigerant, install, leak, other },
    byServiceDetail: {
      cleaning:    { total: cleaning,    count: cleaningCount,    owner: cleaningOwner },
      refrigerant: { total: refrigerant, count: refrigerantCount, owner: refrigerantOwner },
      install:     { total: install,     count: installCount,     owner: installOwner },
      leak:        { total: leak,        count: leakCount,        owner: leakOwner },
      other:       { total: other,       count: otherCount,       owner: otherOwner },
    },
    count: list.length,
  };
}

// "YYYY-MM-DD" → 같은 day 측측 측측측 동일일 (= 측측 측측 측측 측측 last day 측측 clamp).
//   예: 3/31 → 2월 28일 (또는 29일, 윤년).
export function getPrevMonthSameDay(todayYmdStr) {
  const [y, m, d] = todayYmdStr.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  // JS Date(year, month, 0) = previous month's last day. month는 1-based로 들어와 그대로 사용 측측 = 측측 측측 last day.
  const prevLastDay = new Date(prevY, prevM, 0).getDate();
  const useD = Math.min(d, prevLastDay);
  return `${prevY}-${String(prevM).padStart(2, "0")}-${String(useD).padStart(2, "0")}`;
}

// "YYYY-MM-DD" → 그 달 1일 (KST).
export function getMonthStart(ymdStr) {
  return ymdStr.slice(0, 7) + "-01";
}

// "YYYY-MM-DD" → 지난달 1일 (KST).
export function getPrevMonthStart(todayYmdStr) {
  const [y, m] = todayYmdStr.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return `${prevY}-${String(prevM).padStart(2, "0")}-01`;
}

// (year, month) → 그 달 측측 측측 (YYYY-MM-DD).
export function getMonthRange(year, month) {
  const mm = String(month).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const lastDay = new Date(year, month, 0).getDate(); // JS month 1-based → last day of prev = current month last day
  const end = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

// 공용 dataset filter (computeRevenueByYmRange 와 동일 기준 — 트랙 A + 완료 + KST 범위).
function _filterTrackADoneInRange(apiTasks, startYmd, endYmd) {
  return (apiTasks || []).filter(t => {
    if (!isTrackARemittance(t)) return false;
    const completed = t.completedAt || t.completed_at || t.completedDate || t.완료시간 || t.completedTime;
    if (!completed) return false;
    const ymd = toKstYmd(completed);
    if (!ymd) return false;
    return ymd >= startYmd && ymd <= endYmd;
  });
}

// 2026-06-16 — RevenueDetailScreen 작업별 탭용 — 같은 필터 결과의 task 리스트 자체를 반환.
//   기존 컴포넌트(원청별/기사별)와 100% 동일 dataset → 합계 검산 정합 보장.
//   permission 가드는 호출처에서 (작업별 탭이 task.total_amount 권한 없으면 비노출).
export function getTasksByYmRange(apiTasks, startYmd, endYmd, user) {
  if (!canSeeField(user, "task.total_amount")) return [];
  if (!startYmd || !endYmd) return [];
  return _filterTrackADoneInRange(apiTasks, startYmd, endYmd);
}

// 2026-10-07 — 매출 상세 "작업별" 에 같이 넣는 협력사 작업 줄 (완료 + track S + 완료일이 기간 안).
//   화면의 칸에 맞춰 값을 옮겨 담는다: 총액 = 받은 공급가 / 기사 칸 = 협력사 정산(공급가 − 수수료) / 회사 칸 = 수수료.
//   원청 몫은 sub_principal_share 그대로 → 화면이 "수수료 − 원청 몫" 으로 회사 몫을 낸다 (대시보드와 같은 기준).
export function getSubTasksByYmRange(apiTasks, startYmd, endYmd, user) {
  if (!canSeeField(user, "task.total_amount")) return [];
  if (!startYmd || !endYmd) return [];
  const out = [];
  for (const t of (apiTasks || [])) {
    if (!t || t.status !== "완료") continue;
    const track = t.track || t.payment?.track;
    if (track !== "S") continue;
    const completed = t.completedAt || t.completed_at;
    if (!completed) continue;
    const ymd = toKstYmd(completed);
    if (!ymd || ymd < startYmd || ymd > endYmd) continue;
    const supply = Number(t.supplyAmount ?? t.supply_amount ?? 0) || Number(t.receivedTotal ?? t.received_total ?? 0) || 0;
    const fee = Number(t.owner_amount || 0);
    out.push({ ...t, _subRow: true, totalAmount: supply, engineer_amount: Math.max(0, supply - fee), owner_amount: fee, principal_amount: 0 });
  }
  return out;
}

// 2026-06-26 — 특정 기사 + 기간 작업 리스트.
//   매출 상세(RevenueDetailScreen) 기사별 → 기사 클릭 → 작업 리스트 모달(PC) / 화면 전환(모바일) 용도.
//   getTasksByYmRange 결과를 engineerId 로 추가 필터 → 같은 _filterTrackADoneInRange 통과.
//   → 기사별 행(computeRevenueByEngineer)의 owner/engineer/total 합과 이 리스트 합이 100% 일치 보장.
//   engineerId 가 null/undefined 면 (미배정 그룹 클릭) — assignedEngineerId 가 없는 task 반환.
export function getTasksByEngineerInRange(apiTasks, startYmd, endYmd, engineerId, user) {
  const list = getTasksByYmRange(apiTasks, startYmd, endYmd, user);
  return list.filter(t => {
    const id = t.assignedEngineerId || t.assigned_engineer_id || t.engineerId || null;
    if (!engineerId) return !id; // 미배정 그룹
    return id === engineerId;
  });
}

// 원청별 측측 — 측측 dataset 측측 principal_code 측측 측측 측측.
//   측측 측측: principal_code 측측 측측 매출 측측측 정렬.
//   측측 측측: code / name / count / total / owner.
export function computeRevenueByPrincipal(apiTasks, startYmd, endYmd, user) {
  if (!canSeeField(user, "task.total_amount")) return [];
  const list = _filterTrackADoneInRange(apiTasks, startYmd, endYmd);
  const map = new Map();
  for (const t of list) {
    const code = String(t.principalCode || t.principal_code || "").trim();
    const name = String(t.principal || t.client || t.principalName || "").trim();
    const key = code || `(${name || "측측"})`;
    if (!map.has(key)) {
      map.set(key, { code, name: name || code || "(측측)", count: 0, total: 0, owner: 0 });
    }
    const row = map.get(key);
    row.count += 1;
    row.total += Number(t.totalAmount || t.총금액 || t.estimateTotal || 0);
    row.owner += Number(t.owner_amount || 0);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

// 기사별 그룹 — 동일 dataset (isTrackARemittance + completed_at in range) 기준 assigned_engineer 묶음.
//   기본 정렬: engineer (engineer_amount) 내림차순.
//   반환 필드: id / name / count / engineer / total / owner.
//
// 2026-06-13 — total / owner 추가. 같은 task 의 totalAmount / owner_amount 합산 (새 계산 X).
//   PC 매출 리포트 기사별 표(매출/회사 마진/비중) 용도. 기존 호출처는 name/count/engineer 만
//   참조하므로 무영향. 정렬 기준도 그대로 (호출 측에서 필요 시 owner 기준 재정렬).
export function computeRevenueByEngineer(apiTasks, startYmd, endYmd, user) {
  if (!canSeeField(user, "task.total_amount")) return [];
  const list = _filterTrackADoneInRange(apiTasks, startYmd, endYmd);
  const map = new Map();
  for (const t of list) {
    const id   = t.assignedEngineerId || t.assigned_engineer_id || t.engineerId || null;
    const name = String(t.assignedEngineer || t.engineer || "").trim();
    const key = id || name || "(미배정)";
    if (!map.has(key)) {
      map.set(key, { id, name: name || "(미배정)", count: 0, engineer: 0, total: 0, owner: 0 });
    }
    const row = map.get(key);
    row.count    += 1;
    row.engineer += Number(t.engineer_amount || 0);
    row.total    += Number(t.totalAmount || t.총금액 || t.estimateTotal || 0);
    row.owner    += Number(t.owner_amount || 0);
  }
  return [...map.values()].sort((a, b) => b.engineer - a.engineer);
}
