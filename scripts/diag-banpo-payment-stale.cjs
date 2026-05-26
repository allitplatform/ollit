// 진단 — 반포 task 973c7d87 payments stale (product_price=190K 정정 후 payments=380K 기준 그대로)
// 2026-05-26 (read-only)
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TASK_ID = "973c7d87-f56f-43db-a0b2-1bf56da3e1a0";

(async () => {
  // task + payments
  const { data: task } = await sb.from("tasks").select("*").eq("id", TASK_ID).maybeSingle();
  console.log("[tasks] task_no:", task.task_no, "| status:", task.status);
  console.log("  product_price:", task.product_price, "| extra_fee:", task.extra_fee, "| travel_fee:", task.travel_fee, "| total_amount:", task.total_amount);
  console.log("  principal_id:", task.principal_id);

  const { data: payment } = await sb.from("payments").select("*").eq("task_id", TASK_ID).maybeSingle();
  console.log("\n[payments]");
  if (payment) {
    console.log(JSON.stringify(payment, null, 2));
  } else {
    console.log("  X");
  }

  // task_items
  const { data: items } = await sb.from("task_items")
    .select("id, qty, unit_price, subtotal, customer_paid_amount, order_type, work_types(name, service_types(code))")
    .eq("task_id", TASK_ID);
  console.log("\n[task_items]");
  for (const it of (items || [])) {
    console.log(`  qty=${it.qty} × unit_price=${it.unit_price} = subtotal=${it.subtotal} | work=${it.work_types?.name} svc=${it.work_types?.service_types?.code} order=${it.order_type}`);
  }
  const sumSub = (items || []).reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  console.log(`  Σsubtotal = ${sumSub.toLocaleString()}`);

  // principal info
  const { data: p } = await sb.from("principals").select("code, name").eq("id", task.principal_id).maybeSingle();
  console.log("\n[principal]", p?.code, p?.name);

})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
