// 2026-06-01 — 표 naverCount vs DB naver_settled 건수 mismatch 원인 분석.
//
// W19 (5/4~5/10) 표값 = 302건 / DB = 118건 → gap 184건.
// 가능 원인:
//   ① naver_settled_at 마킹 누락분 (= product_order_id 측음, 측측 X)
//   ② 주차 경계 (KST/UTC) 차이
//   ③ task 단위 vs task_items 단위
//   ④ 표 = naver 측측 측측측 측측 (DB 측측 정확도 별개)
//
// 실행: node scripts/diag-naver-count-mismatch.cjs
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PID = "22222222-2222-2222-2222-222222222006";

// 표 naverCount (9 주차)
const TABLE = [
  { week: "W14 (3/30~4/5)",  monday: "2026-03-30", sunday: "2026-04-05", naverCount:   0 },
  { week: "W15 (4/6~4/12)",  monday: "2026-04-06", sunday: "2026-04-12", naverCount:   3 },
  { week: "W16 (4/13~4/19)", monday: "2026-04-13", sunday: "2026-04-19", naverCount:  18 },
  { week: "W17 (4/20~4/26)", monday: "2026-04-20", sunday: "2026-04-26", naverCount:  72 },
  { week: "W18 (4/27~5/3)",  monday: "2026-04-27", sunday: "2026-05-03", naverCount: 100 },
  { week: "W19 (5/4~5/10)",  monday: "2026-05-04", sunday: "2026-05-10", naverCount: 302 },
  { week: "W20 (5/11~5/17)", monday: "2026-05-11", sunday: "2026-05-17", naverCount: 259 },
  { week: "W21 (5/18~5/24)", monday: "2026-05-18", sunday: "2026-05-24", naverCount: 284 },
  { week: "W22 (5/25~5/31)", monday: "2026-05-25", sunday: "2026-05-31", naverCount: 281 },
];

// KST 변환 — ymd ("YYYY-MM-DD") → UTC 시작 (KST 00:00) ISO.
function kstStartUtc(ymd) {
  // KST midnight = UTC -9시간 → 전날 15:00 UTC.
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, -9, 0, 0)).toISOString();
}
function nextDayUtc(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, -9, 0, 0)).toISOString();
}

async function fetchWeekItems(monday, sunday) {
  const startUtc = kstStartUtc(monday);
  const endUtc   = nextDayUtc(sunday); // sunday 23:59:59 KST 끝 = 다음 날 00:00 KST = nextDayUtc
  const PAGE = 1000, MAX = 10;
  const all = [];
  for (let p = 0; p < MAX; p++) {
    const off = p * PAGE;
    const { data, error } = await sb.from("task_items")
      .select("id, task_id, product_order_id, naver_settled_at, net_amount, subtotal, is_canceled, tasks!inner(principal_id, completed_at, status)")
      .eq("tasks.principal_id", PID)
      .not("naver_settled_at", "is", null)
      .gte("naver_settled_at", startUtc)
      .lt("naver_settled_at", endUtc)
      .range(off, off + PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

(async () => {
  console.log("=".repeat(90));
  console.log("표 naverCount  vs  DB naver_settled 건수 / 고유 task 수 / sum net*0.85");
  console.log("─".repeat(90));
  console.log(`  ${"주차".padEnd(20)} | ${"표값".padStart(5)} | ${"DB item".padStart(7)} | ${"고유task".padStart(8)} | ${"net*0.85".padStart(14)}`);
  console.log("─".repeat(90));

  for (const row of TABLE) {
    const items = await fetchWeekItems(row.monday, row.sunday);
    const active = items.filter(it => !it.is_canceled);
    const uniqueTasks = new Set(active.map(it => it.task_id));
    const sumNet085 = Math.round(active.reduce((s, it) => s + (Number(it.net_amount) || 0), 0) * 0.85);
    const gap = row.naverCount - active.length;
    const flag = Math.abs(gap) >= 50 ? " ⚠️" : "";
    console.log(`  ${row.week.padEnd(20)} | ${String(row.naverCount).padStart(5)} | ${String(active.length).padStart(7)} | ${String(uniqueTasks.size).padStart(8)} | ₩${sumNet085.toLocaleString().padStart(13)}${flag}`);
  }

  // W19 심층 분석
  console.log("\n" + "=".repeat(90));
  console.log("W19 (5/4~5/10) 심층 — 활성 task_items 정보");
  console.log("─".repeat(90));
  const w19 = (await fetchWeekItems("2026-05-04", "2026-05-10")).filter(it => !it.is_canceled);
  console.log(`  활성 items: ${w19.length}건`);
  console.log(`  고유 tasks: ${new Set(w19.map(it => it.task_id)).size}건`);
  console.log(`  net_amount POSITIVE: ${w19.filter(it => Number(it.net_amount) > 0).length}건`);
  console.log(`  net_amount NULL/0:   ${w19.filter(it => !Number(it.net_amount)).length}건`);
  console.log(`  product_order_id O:  ${w19.filter(it => it.product_order_id).length}건`);
  console.log(`  product_order_id X:  ${w19.filter(it => !it.product_order_id).length}건`);

  // task 측 task_items 측측 측측 (1 task 측 N items)
  const itemsByTask = new Map();
  for (const it of w19) {
    const k = it.task_id;
    itemsByTask.set(k, (itemsByTask.get(k) || 0) + 1);
  }
  const itemCountDist = {};
  for (const c of itemsByTask.values()) {
    itemCountDist[c] = (itemCountDist[c] || 0) + 1;
  }
  console.log("\n  task 당 item 개수 분포:");
  for (const k of Object.keys(itemCountDist).sort((a,b) => Number(a) - Number(b))) {
    console.log(`    ${k}개 item → ${itemCountDist[k]} tasks`);
  }

  // W19 missing 후보 — 마킹 누락 가능성: completed_at in 5/4~5/10 + product_order_id O + naver_settled_at NULL
  console.log("\n" + "=".repeat(90));
  console.log("W19 누락 후보 — completed_at 5/4~5/10 KST + product_order_id O + naver_settled_at NULL");
  console.log("─".repeat(90));
  const completedStart = kstStartUtc("2026-05-04");
  const completedEnd = nextDayUtc("2026-05-10");
  const PAGE = 1000;
  const candidates = [];
  for (let p = 0; p < 10; p++) {
    const { data } = await sb.from("task_items")
      .select("id, task_id, product_order_id, naver_settled_at, net_amount, is_canceled, tasks!inner(principal_id, completed_at, status, task_no)")
      .eq("tasks.principal_id", PID)
      .gte("tasks.completed_at", completedStart)
      .lt("tasks.completed_at", completedEnd)
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (!data || data.length === 0) break;
    candidates.push(...data);
    if (data.length < PAGE) break;
  }
  const active5w19 = candidates.filter(it => !it.is_canceled);
  const missing = active5w19.filter(it => it.product_order_id && !it.naver_settled_at);
  const settled = active5w19.filter(it => it.product_order_id && it.naver_settled_at);
  console.log(`  5/4~5/10 KST 완료된 활성 items: ${active5w19.length}건`);
  console.log(`  · poid O + naver_settled O: ${settled.length}건 (마킹됨)`);
  console.log(`  · poid O + naver_settled X: ${missing.length}건 (마킹 누락 후보) ⚠️`);
  console.log(`  · poid X: ${active5w19.filter(it => !it.product_order_id).length}건`);

  // W18 (= 5/4 deposit) 같이 확인
  console.log("\n" + "=".repeat(90));
  console.log("W18 (4/27~5/3) 동일 분석 — completed_at 4/27~5/3 KST");
  console.log("─".repeat(90));
  const w18Start = kstStartUtc("2026-04-27");
  const w18End = nextDayUtc("2026-05-03");
  const w18Cand = [];
  for (let p = 0; p < 10; p++) {
    const { data } = await sb.from("task_items")
      .select("id, task_id, product_order_id, naver_settled_at, net_amount, is_canceled, tasks!inner(principal_id, completed_at, status)")
      .eq("tasks.principal_id", PID)
      .gte("tasks.completed_at", w18Start)
      .lt("tasks.completed_at", w18End)
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (!data || data.length === 0) break;
    w18Cand.push(...data);
    if (data.length < PAGE) break;
  }
  const w18Active = w18Cand.filter(it => !it.is_canceled);
  const w18Missing = w18Active.filter(it => it.product_order_id && !it.naver_settled_at);
  const w18Settled = w18Active.filter(it => it.product_order_id && it.naver_settled_at);
  console.log(`  4/27~5/3 KST 완료된 활성 items: ${w18Active.length}건`);
  console.log(`  · poid O + naver_settled O: ${w18Settled.length}건`);
  console.log(`  · poid O + naver_settled X: ${w18Missing.length}건 ⚠️`);
})();
