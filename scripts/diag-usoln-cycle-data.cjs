// 진단 — 유솔N 정산 사이클 카드 측 catch 측 catch 측 catch (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";

(async () => {
  // usol_n 측 catch 측 catch 측 catch task_items 측 측 (status='완료' 측 catch — 사이클 측 측 측 측 catch)
  const { data: items } = await sb.from("task_items")
    .select("id, qty, unit_price, subtotal, product_order_id, order_type, net_amount, naver_settled_at, company_received_at, engineer_settled_at, cash_settled_at, naver_received_at, cash_received_at, tasks!inner(task_no, status, principal_id)")
    .eq("tasks.principal_id", USOL_N_PID)
    .order("naver_settled_at", { ascending: false, nullsFirst: false })
    .limit(50);

  console.log(`[fetch] ${(items || []).length}건\n`);

  // 컬럼별 측 catch 측 catch 측 catch
  const cols = ["product_order_id", "order_type", "net_amount", "naver_settled_at", "company_received_at", "engineer_settled_at", "cash_settled_at", "naver_received_at", "cash_received_at"];
  const fillCount = {};
  for (const c of cols) fillCount[c] = 0;
  for (const it of (items || [])) {
    for (const c of cols) if (it[c] != null) fillCount[c]++;
  }
  console.log("[컬럼별 측 catch 측 catch 측 catch 측 측 catch]");
  for (const c of cols) {
    const pct = items.length > 0 ? Math.round(fillCount[c] / items.length * 100) : 0;
    console.log(`  ${c.padEnd(22)}: ${fillCount[c]}/${items.length} (${pct}%)`);
  }

  // 측 측 측 catch 측 catch 측 catch (측 측 측 측 측 측 + 측 catch 측 catch)
  console.log("\n[측 측 측 catch 측 catch 측 catch 측 측 측 — 측 catch 5건]");
  const fullCycle = (items || []).filter(it =>
    it.naver_settled_at && it.company_received_at && it.engineer_settled_at
  ).slice(0, 5);
  for (const it of fullCycle) {
    console.log(`  task ${it.tasks.task_no} | order=${it.product_order_id || "—"} | sub=${it.subtotal} | net=${it.net_amount}`);
    console.log(`    네이버 ${it.naver_settled_at} / 회사 ${it.company_received_at} / 기사 ${it.engineer_settled_at}`);
  }

  // 측 catch 측 catch 측 catch 측 catch (측 catch 측 catch 측 catch 측 catch — usol_h 측 catch 측 measurement?)
  console.log("\n[참고 — task.payments 측 catch — usol_h 측 catch 측 catch payments engineer_amount/owner_amount 측 catch 측 catch X 측 catch 측 X]");
  const { data: paymentSample } = await sb.from("payments")
    .select("task_id, engineer_amount, principal_amount, owner_amount, track")
    .limit(3);
  for (const p of (paymentSample || [])) {
    console.log(`  task ${p.task_id.slice(0,8)} | eng=${p.engineer_amount} prin=${p.principal_amount} owner=${p.owner_amount} track=${p.track}`);
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
