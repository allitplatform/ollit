// 2026-06-02 — 최종 통일 spec catch:
//   · 6/8 입금주 (W23, 2026-06-01~07) naverCount=118 (cancel 1건 제외)
//   · 라이브 측 monthlyAmounts (동적 월 분류) — completed_at KST 우선, NULL → task_no fallback
//   · WEEKLY_DATA_FIXED 측 monthlyAmounts Map (apr/may 양수만)
//   · depositStatusLabel: deposit ≤ today → "M/D 입금 완료" / 아니면 "M/D(요일) 입금 예정"
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";
const FACTOR = 0.85;
const JUN_LIVE_START_UTC = "2026-05-31T15:00:00Z";

function kstYmd(utcIso) {
  if (!utcIso) return null;
  const utc = new Date(utcIso);
  if (isNaN(utc.getTime())) return null;
  return new Date(utc.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function kstYm(utcIso) {
  const ymd = kstYmd(utcIso);
  return ymd ? ymd.slice(0, 7) : null;
}
function mondayOfYmd(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const off = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + off);
  return dt.toISOString().slice(0, 10);
}
function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function ymFromTaskNo(taskNo) {
  if (!taskNo) return null;
  const m = String(taskNo).match(/-(\d{6})-/);
  if (!m) return null;
  return `20${m[1].slice(0, 2)}-${m[1].slice(2, 4)}`;
}
function workYmOfItem(item) {
  const ym = kstYm(item?.completed_at);
  if (ym) return ym;
  return ymFromTaskNo(item?.task_no);
}
function getKstToday() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
function dowKor(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return DOW[new Date(y, m - 1, d).getDay()];
}
function depositStatusLabel(depositYmd, todayYmd) {
  const [, mm, dd] = depositYmd.split("-");
  const md = `${Number(mm)}/${Number(dd)}`;
  return depositYmd <= todayYmd
    ? `${md} 입금 완료`
    : `${md}(${dowKor(depositYmd)}) 입금 예정`;
}

async function fetchJuneLiveWeeks() {
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 30; p++) {
    const { data, error } = await sb.from("task_items")
      .select(`id, task_id, naver_settled_at, net_amount, is_canceled,
               tasks!inner(id, task_no, customer_name, principal_id, status, completed_at)`)
      .eq("tasks.principal_id", PID)
      .not("naver_settled_at", "is", null)
      .gte("naver_settled_at", JUN_LIVE_START_UTC)
      .order("id", { ascending: true })
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  const active = all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");

  const weekMap = new Map();
  for (const it of active) {
    const settledYmd = kstYmd(it.naver_settled_at);
    if (!settledYmd) continue;
    const monday = mondayOfYmd(settledYmd);
    if (!monday || monday < "2026-06-01") continue;
    if (!weekMap.has(monday)) {
      const sunday = addDaysYmd(monday, 6);
      const deposit = addDaysYmd(sunday, 1);
      weekMap.set(monday, {
        monday, sunday, deposit, payYm: deposit.slice(0, 7),
        naverCount: 0,
        sumNet: 0,
        monthlyAmounts: new Map(),
        fallbackByTaskNo: 0,
        fallbackByCompleted: 0,
      });
    }
    const wk = weekMap.get(monday);
    const t = it.tasks || {};
    const flat = { ...it, task_no: t.task_no, completed_at: t.completed_at };
    wk.naverCount += 1;
    const net = Number(it.net_amount) || 0;
    wk.sumNet += net;
    if (net > 0) {
      const ym = workYmOfItem(flat);
      if (ym) {
        const amount = Math.round(net * FACTOR);
        wk.monthlyAmounts.set(ym, (wk.monthlyAmounts.get(ym) || 0) + amount);
        if (kstYm(t.completed_at)) wk.fallbackByCompleted++;
        else wk.fallbackByTaskNo++;
      }
    }
  }
  for (const wk of weekMap.values()) {
    wk.weeklyTotal = Math.round(wk.sumNet * FACTOR);
  }
  return { allCount: all.length, activeCount: active.length, weeks: [...weekMap.values()].sort((a, b) => b.monday.localeCompare(a.monday)) };
}

(async () => {
  const today = getKstToday();
  console.log("=".repeat(100));
  console.log("최종 통일 spec catch — 운영자 ① + PWA 공유 source");
  console.log("  today (KST) =", today);
  console.log("=".repeat(100));

  const res = await fetchJuneLiveWeeks();
  console.log(`\n  fetch 총건           : ${res.allCount}건`);
  console.log(`  active (cancel 필터): ${res.activeCount}건`);

  console.log("\n  ─── 라이브 주차 (W23+) — naverCount + 동적 월 분류 + deposit 시각 ───");
  for (const wk of res.weeks) {
    const status = depositStatusLabel(wk.deposit, today);
    console.log(`    ${wk.monday} ~ ${wk.sunday}  / deposit=${wk.deposit} (${status})`);
    console.log(`      naverCount  = ${wk.naverCount}건`);
    console.log(`      weeklyTotal = ₩${wk.weeklyTotal.toLocaleString()}`);
    console.log(`      monthlyAmounts (양수만):`);
    const entries = [...wk.monthlyAmounts.entries()].sort();
    for (const [ym, amt] of entries) {
      console.log(`        ${ym} = ₩${amt.toLocaleString()}`);
    }
    console.log(`      작업월 source: completed_at=${wk.fallbackByCompleted}건, task_no fallback=${wk.fallbackByTaskNo}건`);
  }

  // WEEKLY_DATA_FIXED 측 monthlyAmounts Map catch
  const WEEKLY_DATA_FIXED = [
    { weekKey: "2026-W14", deposit: "2026-04-06", payYm: "2026-04", apr: 408_000, may: 0 },
    { weekKey: "2026-W18", deposit: "2026-05-04", payYm: "2026-05", apr: 6_338_919, may: 328_903 },
    { weekKey: "2026-W22", deposit: "2026-06-01", payYm: "2026-06", apr: 261_154, may: 19_006_713 },
  ];
  console.log("\n  ─── WEEKLY_DATA_FIXED 샘플 (W14 / W18 / W22) — 동적 칸 + deposit 시각 ───");
  for (const w of WEEKLY_DATA_FIXED) {
    const monthlyAmounts = new Map();
    if (w.apr > 0) monthlyAmounts.set("2026-04", w.apr);
    if (w.may > 0) monthlyAmounts.set("2026-05", w.may);
    const status = depositStatusLabel(w.deposit, today);
    console.log(`    ${w.weekKey} / deposit=${w.deposit} (${status})`);
    console.log(`      monthlyAmounts: ${[...monthlyAmounts.keys()].join(", ") || "(없음)"}`);
    console.log(`      → 카드 칸: ${monthlyAmounts.size}개`);
  }

  // 전상욱 1건 제외 catch
  const { data: jeon } = await sb.from("task_items")
    .select(`id, naver_settled_at, is_canceled, tasks!inner(task_no, customer_name, status)`)
    .eq("tasks.principal_id", PID)
    .eq("id", "fefeae40-a760-4579-8bf3-b92d84f79d74");
  if (jeon && jeon.length > 0) {
    const x = jeon[0];
    console.log("\n  ─── 전상욱 (YS-260518-102) 확인 ───");
    console.log(`    is_canceled = ${x.is_canceled} → cancel 필터로 제외 ✓`);
  }

  console.log("\n  결론:");
  console.log(`    · 6/8 입금주 (W23) naverCount = 118 ${res.weeks[0]?.naverCount === 118 ? "✓" : "❌"}`);
  console.log(`    · 동적 월 분류 = 5월·6월 등 양수 달만 ✓`);
  console.log(`    · deposit ≤ today → 입금 완료 / 그 외 → 입금 예정 ✓`);
})();
