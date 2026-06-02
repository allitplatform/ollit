// 2026-06-02 — 유솔N 주차별 정산 공유 모듈 (운영자 ① + 유솔 원청 PWA 통일 source).
//
// 사장님 spec (Phase 5 / 6/8 입금주 118 vs 119 진단 OK 후):
//   · 운영자 ① (UsolNToCompanySection)  과  유솔 원청 PWA (PrincipalSettleTab) 의
//     주차별 정산 금액·건수 source 를 한 곳에서 관리해 항상 일치시킨다.
//   · 5월 (~ 6/1 입금 W22)              = WEEKLY_DATA_FIXED 시트 고정값
//   · 6/8 입금주 (W23) 이후              = fetchJuneLiveWeeks 라이브 (cancel 필터 포함)
//   · 라이브 측 cancel 필터: !is_canceled  AND  tasks.status != "취소"
//   · 6/8 입금주 1건 차이 (전상욱 YS-260518-102, task_item.is_canceled=true, net=0) → 제외 후 118건.
//
// 사용처:
//   · src/components/usol_n/UsolNToCompanySection.jsx (운영자 ①)
//   · src/components/principal/PrincipalSettleTab.jsx (유솔 원청 PWA)
//
// 영향 범위:
//   · 다른 6 원청 영향 0 (USOL_N_PID 한정 fetch / 표시).
//   · 유솔 PWA 표시 구조 (주차 나열 / 입금 예정·완료 / [입금했습니다] 버튼) 그대로.
//     숫자 source 만 통일.
import { supabase } from "./supabase.js";

// ── 상수 ────────────────────────────────────────────────────
export const USOL_N_PID = "22222222-2222-2222-2222-222222222006";
export const NAVER_NET_TO_COMPANY_FACTOR = 0.85;
// JUN 라이브 시작 — deposit >= 6/8 = naver_settled_at KST monday >= 6/1.
//   UTC = KST 6/1 00:00 = 2026-05-31T15:00:00Z.
export const JUN_LIVE_START_UTC = "2026-05-31T15:00:00Z";

// ── 주차별 시트값 (W14 ~ W22) ──────────────────────────────
// 정산주 = naver_settled_at 기준 월~일 KST.
//   monday/sunday  = 정산 기간.
//   deposit       = sunday + 1일 = 다음 월요일 (유솔이 회사에 입금하는 날).
//   payYm         = deposit 의 월 (회사 입금월).
//   naverCount    = 그 정산주에 정산된 task_items 건수 (시트 고정값).
//   weeklyTotal   = 주간 실입금 합계 (현금·현장 포함, apr+may 보다 클 수 있음).
//   apr/may       = weeklyTotal 측 네이버 작업월(completed_at) 분포만 분류한 부분 합.
export const WEEKLY_DATA_FIXED = [
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

// ── KST 헬퍼 (string ymd) ────────────────────────────────
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

// ── ISO 8601 주차 키 ("2026-W14") ────────────────────────
//   ymd ("YYYY-MM-DD") → "YYYY-Www" 측 ISO week. PWA computeIsoWeek 측 형식 일치.
export function isoWeekKeyFromYmd(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);          // 그 주의 목요일
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── 6/8+ 라이브 (deposit >= 6/8) ─────────────────────────
// 우리 naver_settled task_items WHERE monday >= 2026-06-01 (= deposit >= 6/8).
//   W22 (deposit 6/1) 까지는 WEEKLY_DATA_FIXED. 6/8 입금주(W23) 부터 라이브.
//   sum(net) × 0.85 = weeklyTotal. 작업월(completed_at KST) 분포 = apr/may/jun split.
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
         tasks!inner ( id, task_no, customer_name, address, district,
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
  // 정산건 = task_item 비취소 + task 비취소
  const active = all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");

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
        sumNet: 0,
        apr: 0, may: 0, jun: 0,
        items: [],
      });
    }
    const wk = weekMap.get(monday);
    const net = Number(it.net_amount) || 0;
    // 평탄화 — tasks nested → item 직접 필드로 복사 (PWA SettleItemRow 측 호환).
    const t = it.tasks || {};
    wk.items.push({
      ...it,
      customer_name: t.customer_name || "",
      task_no:       t.task_no || "",
      address:       t.address || "",
      district:      t.district || "",
      principal_id:  t.principal_id,
      task_status:   t.status,
      received_at:   t.received_at,
      scheduled_at:  t.scheduled_at,
      completed_at:  t.completed_at,
    });
    wk.naverCount += 1;
    wk.sumNet += net;
    const x085 = Math.round(net * NAVER_NET_TO_COMPANY_FACTOR);
    const cm = kstYm(it.tasks?.completed_at);
    if (cm === "2026-04") wk.apr += x085;
    else if (cm === "2026-05") wk.may += x085;
    else if (cm === "2026-06") wk.jun += x085;
  }
  for (const wk of weekMap.values()) {
    wk.weeklyTotal = Math.round(wk.sumNet * NAVER_NET_TO_COMPANY_FACTOR);
  }
  return [...weekMap.values()].sort((a, b) => b.monday.localeCompare(a.monday));
}
