// 진단 — 유솔앱 새 접수 금액 2배 (task 973c7d87) — read-only
const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TASK_ID = "973c7d87-f56f-43db-a0b2-1bf56da3e1a0";

(async () => {
  // tasks
  const { data: task } = await sb.from("tasks")
    .select("id, task_no, product_price, extra_fee, travel_fee, total_amount, category_data, status")
    .eq("id", TASK_ID).maybeSingle();
  console.log("\n[tasks]");
  console.log("  task_no       :", task.task_no);
  console.log("  status        :", task.status);
  console.log("  product_price :", task.product_price);
  console.log("  extra_fee     :", task.extra_fee);
  console.log("  travel_fee    :", task.travel_fee);
  console.log("  total_amount  :", task.total_amount, "← GENERATED = product+extra+travel");
  console.log("  category_data :", JSON.stringify(task.category_data, null, 2));

  // task_items
  const { data: items } = await sb.from("task_items")
    .select("id, qty, unit_price, subtotal, customer_paid_amount, order_type, work_types(name, service_types(code))")
    .eq("task_id", TASK_ID);
  console.log("\n[task_items]");
  for (const it of (items || [])) {
    console.log(`  ─ qty=${it.qty} × unit_price=${it.unit_price} = subtotal=${it.subtotal}`);
    console.log(`     customer_paid=${it.customer_paid_amount} | order_type=${it.order_type} | work_type=${it.work_types?.name} (service=${it.work_types?.service_types?.code})`);
  }
  const sumSub = (items || []).reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  console.log(`  → Σsubtotal = ${sumSub.toLocaleString()}`);

  // payments
  const { data: payment } = await sb.from("payments").select("*").eq("task_id", TASK_ID).maybeSingle();
  console.log("\n[payments]");
  if (payment) {
    console.log("  total_amount    :", payment.total_amount);
    console.log("  principal_amount:", payment.principal_amount);
    console.log("  engineer_amount :", payment.engineer_amount);
    console.log("  owner_amount    :", payment.owner_amount);
  } else {
    console.log("  X");
  }
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
