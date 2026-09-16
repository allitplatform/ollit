// 2026-06-02 — 5월 작업 + naver_settled + 활성 usol_n task_items 의 net vs subtotal 비교.
//   백필 후 net 부풀려졌는지 확인 (DB 변경 X — 진단만).
//
// 실행: node scripts/diag-may-net-vs-subtotal.cjs

const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = "11111111-1111-1111-1111-111111111111";
const PID = "22222222-2222-2222-2222-222222222006";
const MAY_S = "2026-04-30T15:00:00Z";  // KST 2026-05-01 00:00
const MAY_E = "2026-05-31T15:00:00Z";  // KST 2026-06-01 00:00

(async () => {
  // 1) 5월 KST 완료 usol_n tasks
  const { data: tasks } = await sb.from("tasks")
    .select("id, task_no")
    .eq("tenant_id", TENANT).eq("principal_id", PID).eq("status", "완료")
    .gte("completed_at", MAY_S).lt("completed_at", MAY_E);
  const tById = new Map(tasks.map(t => [t.id, t]));
  const taskIds = tasks.map(t => t.id);

  // 2) 그 task 측 task_items — naver_settled NOT NULL + 활성
  const items = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data } = await sb.from("task_items")
      .select("id, task_id, net_amount, subtotal, is_canceled, naver_settled_at, order_type, qty")
      .in("task_id", taskIds.slice(i, i + 200))
      .not("naver_settled_at", "is", null);
    if (data) items.push(...data);
  }
  const active = items.filter(it => !it.is_canceled);
  console.log(`5월 작업 (completed_at KST 5월) + naver_settled + 활성: ${active.length}건\n`);

  // 3) sum 비교
  let sumNet = 0, sumSub = 0;
  for (const it of active) {
    sumNet += Number(it.net_amount) || 0;
    sumSub += Number(it.subtotal) || 0;
  }
  console.log("=".repeat(80));
  console.log("1) sum 비교");
  console.log("─".repeat(80));
  console.log(`  sum(net_amount):  ₩${sumNet.toLocaleString()}`);
  console.log(`  sum(subtotal):    ₩${sumSub.toLocaleString()}`);
  console.log(`  net / subtotal:   ${sumSub > 0 ? (sumNet / sumSub).toFixed(4) : "n/a"} (0.95 미만 정상, 1 이상 의심)`);
  console.log(`  net × 0.85:       ₩${Math.round(sumNet * 0.85).toLocaleString()} (회사 실입금 모집단)`);

  // 4) net > subtotal 행
  const overRows = active.filter(it => {
    const n = Number(it.net_amount) || 0;
    const s = Number(it.subtotal) || 0;
    return n > s && s > 0;
  });
  console.log("\n" + "=".repeat(80));
  console.log(`2) net > subtotal 행 개수: ${overRows.length}건`);
  console.log("─".repeat(80));
  if (overRows.length > 0) {
    console.log(`  샘플 (앞 5):`);
    for (const it of overRows.slice(0, 5)) {
      const t = tById.get(it.task_id);
      const n = Number(it.net_amount), s = Number(it.subtotal);
      const ratio = (n / s).toFixed(3);
      console.log(`    ${t?.task_no || "—"} | net=${n.toLocaleString()} | sub=${s.toLocaleString()} | ratio=${ratio} | type=${it.order_type} | qty=${it.qty}`);
    }
  }

  // 5) net/subtotal 비율 분포
  console.log("\n" + "=".repeat(80));
  console.log("3) net / subtotal 비율 분포");
  console.log("─".repeat(80));
  const buckets = {
    "[0.00, 0.50)":  0,
    "[0.50, 0.80)":  0,
    "[0.80, 0.90)":  0,
    "[0.90, 0.95)":  0,
    "[0.95, 0.99)":  0,
    "[0.99, 1.00)":  0,
    "[1.00, 1.00]":  0,   // 정확히 1.0 (gross 오염 잔존 의심)
    "(1.00, 1.10)":  0,
    "[1.10, 1.50)":  0,
    "[1.50, +∞)":    0,
    "subtotal=0":    0,
    "net=NULL/0":    0,
  };
  for (const it of active) {
    const n = Number(it.net_amount);
    const s = Number(it.subtotal);
    if (!isFinite(n) || n === 0 || it.net_amount == null) { buckets["net=NULL/0"] += 1; continue; }
    if (!isFinite(s) || s === 0) { buckets["subtotal=0"] += 1; continue; }
    const r = n / s;
    if (r < 0.50)       buckets["[0.00, 0.50)"]  += 1;
    else if (r < 0.80)  buckets["[0.50, 0.80)"]  += 1;
    else if (r < 0.90)  buckets["[0.80, 0.90)"]  += 1;
    else if (r < 0.95)  buckets["[0.90, 0.95)"]  += 1;
    else if (r < 0.99)  buckets["[0.95, 0.99)"]  += 1;
    else if (r < 1.00)  buckets["[0.99, 1.00)"]  += 1;
    else if (r === 1.00) buckets["[1.00, 1.00]"] += 1;
    else if (r < 1.10)  buckets["(1.00, 1.10)"]  += 1;
    else if (r < 1.50)  buckets["[1.10, 1.50)"]  += 1;
    else                buckets["[1.50, +∞)"]    += 1;
  }
  for (const [k, v] of Object.entries(buckets)) {
    const bar = "█".repeat(Math.min(60, Math.round(v / 10)));
    console.log(`  ${k.padEnd(18)} : ${String(v).padStart(5)}건  ${bar}`);
  }
})();
