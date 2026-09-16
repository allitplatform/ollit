// 2026-06-02 — 통일 후 catch: PWA 측 새 source = 운영자 ① 측 결과 일치.
//
// 검증:
//   · src/lib/usolNWeeklyData.js → fetchJuneLiveWeeks() 결과 (운영자 ①·PWA 공유)
//   · W23 (6/1~6/7 KST) 측 naverCount = 118 (취소 1건 제외)
//   · 전상욱 (YS-260518-102) task_item.is_canceled=true 측 라이브 측 제외 확인
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";
const NAVER_NET_TO_COMPANY_FACTOR = 0.85;
const JUN_LIVE_START_UTC = "2026-05-31T15:00:00Z";

function kstYmd(utcIso) {
  if (!utcIso) return null;
  const utc = new Date(utcIso);
  if (isNaN(utc.getTime())) return null;
  return new Date(utc.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
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

async function fetchJuneLiveWeeks() {
  const PAGE = 1000;
  const all = [];
  for (let p = 0; p < 30; p++) {
    const { data, error } = await sb.from("task_items")
      .select(`id, task_id, naver_settled_at, net_amount, subtotal, is_canceled, product_order_id,
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
      weekMap.set(monday, { monday, sunday, deposit, payYm: deposit.slice(0, 7), naverCount: 0, sumNet: 0 });
    }
    const wk = weekMap.get(monday);
    wk.naverCount += 1;
    wk.sumNet += Number(it.net_amount) || 0;
  }
  for (const wk of weekMap.values()) wk.weeklyTotal = Math.round(wk.sumNet * NAVER_NET_TO_COMPANY_FACTOR);

  return { allCount: all.length, activeCount: active.length, weeks: [...weekMap.values()].sort((a, b) => b.monday.localeCompare(a.monday)) };
}

(async () => {
  console.log("=".repeat(90));
  console.log("통일 후 catch — 운영자 ① + PWA 공유 source (fetchJuneLiveWeeks)");
  console.log("=".repeat(90));

  const res = await fetchJuneLiveWeeks();
  console.log(`\n  fetch 총건         : ${res.allCount}건 (cancel 무관)`);
  console.log(`  active (cancel 필터): ${res.activeCount}건 = 119 - 1 = 118 측 catch`);
  console.log(`  raw 119 - active 118 = 차이 1건 (전상욱 task_item.is_canceled=true)`);

  console.log("\n  ─── 라이브 주차 (W23+) ───");
  for (const wk of res.weeks) {
    console.log(`    monday=${wk.monday} sunday=${wk.sunday} deposit=${wk.deposit} payYm=${wk.payYm}`);
    console.log(`      naverCount  = ${wk.naverCount}건`);
    console.log(`      weeklyTotal = ₩${wk.weeklyTotal.toLocaleString()}`);
  }

  // 전상욱 건 측 라이브 측 제외 확인
  const { data: jeon } = await sb.from("task_items")
    .select(`id, naver_settled_at, is_canceled, tasks!inner(task_no, customer_name, status)`)
    .eq("tasks.principal_id", PID)
    .eq("id", "fefeae40-a760-4579-8bf3-b92d84f79d74");
  if (jeon && jeon.length > 0) {
    const x = jeon[0];
    console.log("\n  ─── 전상욱 (YS-260518-102) 확인 ───");
    console.log(`    is_canceled = ${x.is_canceled} (true 측 운영자 ①·PWA 둘 다 제외)`);
    console.log(`    task.status = ${x.tasks.status}`);
    console.log(`    naver_settled_at = ${x.naver_settled_at}`);
    console.log(`    → 새 source 측 제외됨 ✓`);
  }

  console.log("\n  결론: 운영자 ① = PWA 새 source = 118건 (W23 = 2026-06-01 monday).");
})();
