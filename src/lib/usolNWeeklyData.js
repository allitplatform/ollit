// 2026-06-02 — 유솔N 주차별 정산 공유 모듈 (운영자 ① + 유솔 원청 PWA 통일 source).
//
// 사장님 spec:
//   · 운영자 ① (UsolNToCompanySection) + 유솔 원청 PWA (PrincipalSettleTab) 의
//     주차별 정산 금액·건수·표시 형식을 한 곳에서 관리해 항상 일치.
//   · 5월 (~ 6/1 입금 W22)              = WEEKLY_DATA_FIXED 시트 고정값
//   · 6/8 입금주 (W23) 이후              = fetchJuneLiveWeeks 라이브 (cancel 필터 + 동적 월 분류)
//   · cancel 필터: !is_canceled  AND  tasks.status != "취소"
//   · 작업월 동적 분류: completed_at KST 우선, NULL 측은 task_no(YYMMDD) fallback.
//   · 카드 메인 시각 = deposit(입금일) ≤ 오늘 KST 측 입금 완료, 그 외 입금 예정.
//   · 월 칸: 0인 달 숨김, 양수 달만 동적 칸 (4월분 / 5월분 / 6월분 / ...).
//
// 사용처:
//   · src/components/usol_n/UsolNToCompanySection.jsx (운영자 ①)
//   · src/components/principal/PrincipalSettleTab.jsx (유솔 원청 PWA)
import { supabase } from "./supabase.js";

// ── 상수 ────────────────────────────────────────────────────
export const USOL_N_PID = "22222222-2222-2222-2222-222222222006";
export const NAVER_NET_TO_COMPANY_FACTOR = 0.85;
// JUN 라이브 시작 — deposit >= 6/8 = naver_settled_at KST monday >= 6/1.
//   UTC = KST 6/1 00:00 = 2026-05-31T15:00:00Z.
export const JUN_LIVE_START_UTC = "2026-05-31T15:00:00Z";

// 2026-06-09 — 실제 remit 상태(principal_weekly_remittances) 기반 라벨 적용 시작 deposit YMD.
//   < 6/8: 옛 동작 그대로 (deposit ≤ 오늘 → "M/D 입금 완료"). 과거 주 시각 라벨 유지.
//   ≥ 6/8: remit_status 기반 4-state 라벨 (confirmed=완료 / reported=보고대기 /
//          기록없음+미래=예정 / 기록없음+지남=미확인).
export const LIVE_REMIT_CUTOFF_YMD = "2026-06-08";

// deposit ≥ cutoff → 실제 remit 상태 기반 표시 대상 주차.
export function isLiveRemitWeek(depositYmd) {
  if (!depositYmd) return false;
  return depositYmd >= LIVE_REMIT_CUTOFF_YMD;
}

// 색상 토큰 (운영자 ① + PWA 공유)
export const C_PINK_DEPOSIT = "#D4537E";   // 입금 예정 / 핵심
export const C_GREEN_DONE   = "#1D9E75";   // 입금 완료
export const C_GRAY_MUTED   = "#9CA3AF";
export const C_GRAY_BAR     = "#3A3A3A";

// ── 주차별 시트값 (W14 ~ W22) ──────────────────────────────
//   monday/sunday  = 정산 기간 (naver_settled_at KST 월~일).
//   deposit       = sunday + 1일 (유솔이 회사에 입금하는 날).
//   payYm         = deposit 의 월 (= 회사 입금월).
//   naverCount    = 그 정산주 정산된 task_items 건수 (시트 고정값).
//   weeklyTotal   = 주간 실입금 합계.
//   apr/may       = weeklyTotal 측 네이버 작업월(completed_at) 분포 부분 합 (시트값).
//   monthlyAmounts: Map<"YYYY-MM", number> = 동적 월 분류 spec (0 인 달 자동 제외).
const _WEEKLY_DATA_RAW = [
  { weekKey: "2026-W14", monday: "2026-03-30", sunday: "2026-04-05", deposit: "2026-04-06", payYm: "2026-04", naverCount:   0, weeklyTotal:    408_000, apr:    408_000, may:          0 },
  { weekKey: "2026-W15", monday: "2026-04-06", sunday: "2026-04-12", deposit: "2026-04-13", payYm: "2026-04", naverCount:   3, weeklyTotal:    283_606, apr:    283_605, may:          0 },
  { weekKey: "2026-W16", monday: "2026-04-13", sunday: "2026-04-19", deposit: "2026-04-20", payYm: "2026-04", naverCount:  18, weeklyTotal:  1_136_493, apr:  1_136_492, may:          0 },
  { weekKey: "2026-W17", monday: "2026-04-20", sunday: "2026-04-26", deposit: "2026-04-27", payYm: "2026-04", naverCount:  72, weeklyTotal:  4_879_840, apr:  4_879_839, may:          0 },
  { weekKey: "2026-W18", monday: "2026-04-27", sunday: "2026-05-03", deposit: "2026-05-04", payYm: "2026-05", naverCount: 100, weeklyTotal:  6_514_822, apr:  6_338_919, may:    328_903 },
  { weekKey: "2026-W19", monday: "2026-05-04", sunday: "2026-05-10", deposit: "2026-05-11", payYm: "2026-05", naverCount: 302, weeklyTotal: 19_504_515, apr: 11_531_286, may:  8_186_673 },
  { weekKey: "2026-W20", monday: "2026-05-11", sunday: "2026-05-17", deposit: "2026-05-18", payYm: "2026-05", naverCount: 259, weeklyTotal: 16_958_937, apr:  7_014_562, may:  9_651_152 },
  { weekKey: "2026-W21", monday: "2026-05-18", sunday: "2026-05-24", deposit: "2026-05-25", payYm: "2026-05", naverCount: 284, weeklyTotal: 18_790_320, apr:  3_194_453, may: 15_146_252 },
  { weekKey: "2026-W22", monday: "2026-05-25", sunday: "2026-05-31", deposit: "2026-06-01", payYm: "2026-06", naverCount: 281, weeklyTotal: 19_267_868, apr:    261_154, may: 19_006_713 },
];

// 각 entry 측 monthlyAmounts Map 채움 (apr / may 양수만).
export const WEEKLY_DATA_FIXED = _WEEKLY_DATA_RAW.map(w => {
  const monthlyAmounts = new Map();
  if ((w.apr || 0) > 0) monthlyAmounts.set("2026-04", w.apr);
  if ((w.may || 0) > 0) monthlyAmounts.set("2026-05", w.may);
  return { ...w, monthlyAmounts };
});

// ── KST 헬퍼 ──────────────────────────────────────────────
export function kstYmd(utcIso) {
  if (!utcIso) return null;
  const utc = new Date(utcIso);
  if (isNaN(utc.getTime())) return null;
  return new Date(utc.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
export function kstYm(utcIso) {
  const ymd = kstYmd(utcIso);
  return ymd ? ymd.slice(0, 7) : null;
}
export function mondayOfYmd(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const off = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + off);
  return dt.toISOString().slice(0, 10);
}
export function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
export function isoWeekKeyFromYmd(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// 오늘 KST YMD
export function getKstToday() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// deposit (YMD) ≤ today (KST) → 입금 완료(과거).
export function isDepositPast(depositYmd, todayYmd) {
  if (!depositYmd) return false;
  return depositYmd <= (todayYmd || getKstToday());
}

// ── 작업월 동적 분류 ──────────────────────────────────────
// task_no "YS-260518-102" → "2026-05" (YYMMDD → 20YY-MM).
export function ymFromTaskNo(taskNo) {
  if (!taskNo) return null;
  const m = String(taskNo).match(/-(\d{6})-/);
  if (!m) return null;
  return `20${m[1].slice(0, 2)}-${m[1].slice(2, 4)}`;
}

// item 작업월: completed_at KST 우선, NULL 측은 task_no fallback.
export function workYmOfItem(item) {
  if (!item) return null;
  const ym = kstYm(item.completed_at);
  if (ym) return ym;
  return ymFromTaskNo(item.task_no);
}

// items 동적 월 분류 → Map<"YYYY-MM", number> (양수 net 만 합산 × factor).
export function aggregateMonthlyAmounts(items, factor = NAVER_NET_TO_COMPANY_FACTOR) {
  const map = new Map();
  for (const it of items || []) {
    const ym = workYmOfItem(it);
    if (!ym) continue;
    const net = Number(it.net_amount) || 0;
    if (net <= 0) continue;
    const amount = Math.round(net * factor);
    map.set(ym, (map.get(ym) || 0) + amount);
  }
  return map;
}

// week → 동적 월 entries (양수만, 오래된 → 최신).
//   week.monthlyAmounts (Map) 우선. 없으면 apr/may/jun 호환 fallback.
export function getMonthlyEntriesOf(week) {
  let map;
  if (week?.monthlyAmounts instanceof Map) {
    map = week.monthlyAmounts;
  } else if (week?.monthlyAmounts && typeof week.monthlyAmounts === "object") {
    map = new Map(Object.entries(week.monthlyAmounts));
  } else {
    map = new Map();
    if ((week?.apr || 0) > 0) map.set("2026-04", week.apr);
    if ((week?.may || 0) > 0) map.set("2026-05", week.may);
    if ((week?.jun || 0) > 0) map.set("2026-06", week.jun);
  }
  const entries = [...map.entries()].filter(([, amt]) => amt > 0);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([ym, amount]) => ({ ym, amount }));
}

// ym → "5월분" (단일 연도 가정 — 다년도 측 catch 측 필요시 spec 측 확장).
export function ymLabel(ym) {
  if (!ym) return "";
  const [, m] = ym.split("-");
  return `${Number(m)}월분`;
}

// ── 날짜 표시 헬퍼 ────────────────────────────────────────
const _DOW = ["일", "월", "화", "수", "목", "금", "토"];
export function dowKor(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return _DOW[new Date(y, m - 1, d).getDay()];
}
export function mdLabel(ymd) {
  if (!ymd) return "";
  const [, mm, dd] = ymd.split("-");
  return `${Number(mm)}/${Number(dd)}`;
}

// 카드 메인 시각 라벨.
// 2026-06-09 — 컷오프 기반 분기 (LIVE_REMIT_CUTOFF_YMD = 2026-06-08).
//   · deposit < 컷오프 (W22 이전): 옛 동작 그대로 — deposit ≤ 오늘 → "M/D 입금 완료" / 미래 → "M/D(요일) 입금 예정".
//     과거 주 (4월·5월) 의 "M/D 입금 완료" 라벨 유지.
//   · deposit ≥ 컷오프 (W23+): remitStatus.kind 기반 4-state.
//       - "done"     (confirmed_at 있음)        → "M/D 입금 완료"  ✅ (유일한 완료)
//       - "reported" (remitted_at 있고 confirm 없음) → "M/D 입금 보고 (확인 대기)"
//       - "expected" + 미래                     → "M/D(요일) 입금 예정"
//       - "expected" + 지남                     → "M/D 입금일 지남 (미확인)"  ← 옛 가짜 완료 자리
//   · remitStatus 미전달(컷오프 이상이지만 부모가 안 넘김) → expected 로 폴백.
export function depositStatusLabel(depositYmd, todayYmd, remitStatus = null) {
  if (!depositYmd) return "";
  const md = mdLabel(depositYmd);
  // 옛 흐름 — 컷오프 이전 주차 (시각 그대로 유지).
  if (!isLiveRemitWeek(depositYmd)) {
    return isDepositPast(depositYmd, todayYmd)
      ? `${md} 입금 완료`
      : `${md}(${dowKor(depositYmd)}) 입금 예정`;
  }
  // 신규 흐름 — 컷오프 이상 주차.
  const kind = remitStatus?.kind || "expected";
  if (kind === "done")     return `${md} 입금 완료`;
  if (kind === "reported") return `${md} 입금 보고 (확인 대기)`;
  // expected: 미래 vs 지남.
  return isDepositPast(depositYmd, todayYmd)
    ? `${md} 입금일 지남 (미확인)`
    : `${md}(${dowKor(depositYmd)}) 입금 예정`;
}

// 시각적 "완료" (초록 + 체크 + 1px border) 판정.
// 2026-06-09 — 컷오프 기반 분기.
//   · deposit < 컷오프: 옛 isDepositPast 그대로 (deposit ≤ 오늘 → 완료).
//   · deposit ≥ 컷오프: remitStatus.kind === "done" 만 완료. reported / expected 둘 다 미완료.
//     (입금일 지남 + 미확인 = 가짜 완료 사라짐 — 사장님 spec.)
export function isDepositDone(depositYmd, todayYmd, remitStatus = null) {
  if (!depositYmd) return false;
  if (!isLiveRemitWeek(depositYmd)) {
    return isDepositPast(depositYmd, todayYmd);
  }
  return remitStatus?.kind === "done";
}

// ── 6/8+ 라이브 fetch ────────────────────────────────────
// 우리 naver_settled task_items WHERE monday >= 2026-06-01 (= deposit >= 6/8).
//   W22 (deposit 6/1) 까지는 WEEKLY_DATA_FIXED. 6/8 입금주(W23) 부터 라이브.
//   2026-06-15 사장님 spec: weeklyTotal = Σ(subtotal − 분배된 principal_amount)
//     = 회사 실수령 (저장된 정책별 principal 사용, 고정 ×0.85 금지).
//   weeklySubtotal = Σ subtotal (= 유솔 정산금, 부제 표기용).
//   monthlyAmounts = 작업월 동적 분류 (= 회사 실수령 기준).
//   cancel 필터: !is_canceled AND tasks.status != "취소".
export async function fetchJuneLiveWeeks() {
  const PAGE = 1000;
  const MAX_PAGES = 30;
  const all = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const offset = p * PAGE;
    const { data, error } = await supabase
      .from("task_items")
      .select(
        `id, task_id, naver_settled_at, net_amount, subtotal, is_canceled, product_order_id, order_type,
         qty, unit_price, description,
         work_types ( id, name ),
         appliance_types ( id, name ),
         tasks!inner ( id, task_no, customer_name, phone, address, district,
                       principal_id, status, received_at, scheduled_at, completed_at )`
      )
      .eq("tasks.principal_id", USOL_N_PID)
      .not("naver_settled_at", "is", null)
      .gte("naver_settled_at", JUN_LIVE_START_UTC)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error("[usolNWeeklyData.fetchJuneLiveWeeks] page", p, error);
      return [];
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  // cancel 필터.
  const active = all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");

  // 2026-06-15 — 저장된 principal_excl_extra fetch (chunked).
  //   ⚠️ raw principal 이 아니라 principal_excl_extra 사용:
  //     subtotal 엔 extra 가 없음 / principal_amount 에는 유솔 extra 몫(15%) 포함
  //     → 둘을 그대로 빼면 회사 실수령이 과소 계상 (유솔 extra 몫만큼 빠짐).
  //   회사 실수령 = item.subtotal − round(principal_excl_extra × item.sub / Σtask items sub)
  //     where principal_excl_extra = principal_amount − FLOOR(extra_fee × 0.15)
  //   ⚠️ 정책별 (본작업/추가선택/냉매점검) principal 비율 다름 — 저장값 그대로 사용.
  const uniqueTaskIds = [...new Set(active.map(it => it.task_id).filter(Boolean))];
  const principalExclByTask = new Map();   // task_id → principal_excl_extra
  const subSumByTask        = new Map();   // task_id → Σ active item subtotal
  for (const it of active) {
    if (!it.task_id) continue;
    const v = Number(it.subtotal) || 0;
    subSumByTask.set(it.task_id, (subSumByTask.get(it.task_id) || 0) + v);
  }
  if (uniqueTaskIds.length > 0) {
    const CHUNK = 300;
    for (let i = 0; i < uniqueTaskIds.length; i += CHUNK) {
      const ids = uniqueTaskIds.slice(i, i + CHUNK);
      const { data: payRows, error: payErr } = await supabase
        .from("payments")
        .select("task_id, principal_amount, extra_fee")
        .eq("track", "B")
        .in("task_id", ids);
      if (payErr) {
        console.error("[usolNWeeklyData.fetchJuneLiveWeeks payments] chunk", i, payErr);
        continue;
      }
      for (const p of (payRows || [])) {
        const prin  = Number(p.principal_amount) || 0;
        const extra = Number(p.extra_fee)        || 0;
        const usolExtraShare = Math.floor(extra * 0.15);
        principalExclByTask.set(p.task_id, prin - usolExtraShare);
      }
    }
  }

  // item-level 회사 실수령 분배 (principal_excl_extra × subtotal 비율)
  function itemCompanyReceive(it) {
    const sub = Number(it.subtotal) || 0;
    const taskSub = subSumByTask.get(it.task_id) || 0;
    const taskPrinExcl = principalExclByTask.get(it.task_id) || 0;
    if (taskSub <= 0) return sub;
    const distPrin = Math.round(taskPrinExcl * (sub / taskSub));
    return sub - distPrin;
  }

  // KST 월요일 키로 그룹.
  const weekMap = new Map();
  for (const it of active) {
    const settledYmd = kstYmd(it.naver_settled_at);
    if (!settledYmd) continue;
    const monday = mondayOfYmd(settledYmd);
    if (!monday || monday < "2026-06-01") continue;  // W22 이전은 fixed
    if (!weekMap.has(monday)) {
      const sunday = addDaysYmd(monday, 6);
      const deposit = addDaysYmd(sunday, 1);
      weekMap.set(monday, {
        weekKey: isoWeekKeyFromYmd(monday),
        monday, sunday, deposit, payYm: deposit.slice(0, 7),
        naverCount: 0,
        sumNet:        0,
        sumSubtotal:   0,    // = 유솔 정산금 합
        sumCompanyRcv: 0,    // = 회사 실수령 합 (subtotal − 분배 principal)
        monthlyAmounts: new Map(),
        items: [],
      });
    }
    const wk = weekMap.get(monday);
    const net = Number(it.net_amount) || 0;
    const sub = Number(it.subtotal)   || 0;
    const comp = itemCompanyReceive(it);
    const t = it.tasks || {};
    const flatItem = {
      ...it,
      customer_name: t.customer_name || "",
      task_no:       t.task_no || "",
      phone:         t.phone || "",
      address:       t.address || "",
      district:      t.district || "",
      principal_id:  t.principal_id,
      task_status:   t.status,
      received_at:   t.received_at,
      scheduled_at:  t.scheduled_at,
      completed_at:  t.completed_at,
      _company_receive: comp,  // item-level 회사 실수령 (drill-in 행 표기용)
    };
    wk.items.push(flatItem);
    wk.naverCount += 1;
    wk.sumNet         += net;
    wk.sumSubtotal    += sub;
    wk.sumCompanyRcv  += comp;

    // 동적 월 분류 (completed_at KST 우선, NULL → task_no fallback).
    //   2026-06-15 — 회사 실수령 기준 (sub − 분배 principal). 옛 net × 0.85 폐기.
    if (comp > 0) {
      const ym = workYmOfItem(flatItem);
      if (ym) {
        wk.monthlyAmounts.set(ym, (wk.monthlyAmounts.get(ym) || 0) + comp);
      }
    }
  }
  for (const wk of weekMap.values()) {
    // weeklyTotal 의미 변경: 옛 net × 0.85 → 회사 실수령 합 (subtotal − 분배 principal).
    wk.weeklyTotal    = wk.sumCompanyRcv;
    wk.weeklySubtotal = wk.sumSubtotal;
  }
  return [...weekMap.values()].sort((a, b) => b.monday.localeCompare(a.monday));
}

// ── 드릴인 — 측 주차 (KST monday~sunday) task_items fetch ─────
// 사장님 spec: 운영자 ① / PWA 측 주차 클릭 시 그 주 naver_settled task_items 측 DB 조회.
//   · 시트 주차 (W14~W22) 측에도 동일 spec — fetchJuneLiveWeeks 측 측 측 측 시트 주차 측 catch X 측,
//     본 함수 측 W14+ 모든 주차 측 catch.
//   · cancel 필터 (!is_canceled AND status != "취소") 적용.
//   · naver_settled_at 측 KST monday 00:00 ~ next monday 00:00 측 [start, end) 측.
//   · 5월 초 측 측 measure 측 측 측 — DB 측 측 측 측 측 측 시트값 < DB 측 측 measure 측 (별개 spec).
export async function fetchWeekItemsByMonday(mondayYmd) {
  if (!mondayYmd) return { ok: false, items: [], error: "monday 누락" };
  const nextMondayYmd = addDaysYmd(mondayYmd, 7);
  // KST 00:00 = UTC 측 전날 15:00.
  //   Date.UTC(y, m-1, d, -9) = UTC (y, m-1, d-1, 15:00:00).
  const [sy, sm, sd] = mondayYmd.split("-").map(Number);
  const [ey, em, ed] = nextMondayYmd.split("-").map(Number);
  const startUtc = new Date(Date.UTC(sy, sm - 1, sd, -9, 0, 0)).toISOString();
  const endUtc   = new Date(Date.UTC(ey, em - 1, ed, -9, 0, 0)).toISOString();

  const PAGE = 1000;
  const MAX_PAGES = 10;
  const all = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await supabase
      .from("task_items")
      .select(
        `id, task_id, naver_settled_at, net_amount, subtotal, is_canceled, product_order_id, order_type,
         qty, unit_price, description,
         work_types ( id, name ),
         appliance_types ( id, name ),
         tasks!inner ( id, task_no, customer_name, phone, address, district,
                       principal_id, status, received_at, scheduled_at, completed_at )`
      )
      .eq("tasks.principal_id", USOL_N_PID)
      .not("naver_settled_at", "is", null)
      .gte("naver_settled_at", startUtc)
      .lt("naver_settled_at", endUtc)
      .order("naver_settled_at", { ascending: true })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) {
      console.error("[usolNWeeklyData.fetchWeekItemsByMonday] page", p, error);
      return { ok: false, items: [], error: error.message };
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  // cancel 필터.
  const active = all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");

  // 2026-06-15 — principal_excl_extra 분배 (raw principal 대신).
  //   ⚠️ subtotal 엔 extra 없음 / principal 엔 유솔 extra 몫 포함 → 그냥 빼면 과소 계상.
  //   principal_excl_extra = principal_amount − FLOOR(extra_fee × 0.15)
  //   item_company_receive = subtotal − round(principal_excl_extra × item.sub / Σtask items sub)
  const uniqueTaskIds = [...new Set(active.map(it => it.task_id).filter(Boolean))];
  const principalExclByTask = new Map();
  const subSumByTask        = new Map();
  for (const it of active) {
    if (!it.task_id) continue;
    const v = Number(it.subtotal) || 0;
    subSumByTask.set(it.task_id, (subSumByTask.get(it.task_id) || 0) + v);
  }
  if (uniqueTaskIds.length > 0) {
    const CHUNK = 300;
    for (let i = 0; i < uniqueTaskIds.length; i += CHUNK) {
      const ids = uniqueTaskIds.slice(i, i + CHUNK);
      const { data: payRows, error: payErr } = await supabase
        .from("payments")
        .select("task_id, principal_amount, extra_fee")
        .eq("track", "B")
        .in("task_id", ids);
      if (payErr) {
        console.error("[usolNWeeklyData.fetchWeekItemsByMonday payments]", i, payErr);
        continue;
      }
      for (const p of (payRows || [])) {
        const prin  = Number(p.principal_amount) || 0;
        const extra = Number(p.extra_fee)        || 0;
        const usolExtraShare = Math.floor(extra * 0.15);
        principalExclByTask.set(p.task_id, prin - usolExtraShare);
      }
    }
  }

  // 평탄화 — PWA SettleItemRow 호환 + _company_receive 부착.
  const flat = active.map(it => {
    const t = it.tasks || {};
    const sub = Number(it.subtotal) || 0;
    const taskSub     = subSumByTask.get(it.task_id) || 0;
    const taskPrinExcl = principalExclByTask.get(it.task_id) || 0;
    const distPrin    = taskSub > 0 ? Math.round(taskPrinExcl * (sub / taskSub)) : 0;
    const compRcv     = sub - distPrin;
    return {
      ...it,
      customer_name: t.customer_name || "",
      task_no:       t.task_no || "",
      phone:         t.phone || "",
      address:       t.address || "",
      district:      t.district || "",
      principal_id:  t.principal_id,
      task_status:   t.status,
      received_at:   t.received_at,
      scheduled_at:  t.scheduled_at,
      completed_at:  t.completed_at,
      _company_receive: compRcv,
    };
  });
  return { ok: true, items: flat };
}
