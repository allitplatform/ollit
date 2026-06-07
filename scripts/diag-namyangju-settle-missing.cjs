// SELECT only — YS-260605-001 측측 측측 측측 진단
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

function toKstYmd(d) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(d));
}

(async () => {
  // 1) 남양주 측측측
  console.log("\n=== [1] YS-260605-001 측측측 ===");
  const { data: t } = await sb.from("tasks").select(`
    id, task_no, customer_name, status, assigned_engineer_id, principal_id,
    principals:principal_id(code),
    scheduled_at, started_at, completed_at, received_at, updated_at, created_at,
    product_price, extra_fee, total_amount,
    task_items(id, qty, unit_price, subtotal, received_amount, order_type, is_canceled,
               work_types(name, service_types(code))),
    payments(engineer_amount, principal_amount, owner_amount, calc_method, track, status, is_balanced)
  `).eq("task_no", "YS-260605-001").maybeSingle();
  if (!t) { console.log("측측 측측"); return; }

  const { data: u } = await sb.from("users").select("name, code").eq("id", t.assigned_engineer_id).maybeSingle();
  console.log(`  id: ${t.id}`);
  console.log(`  status: ${t.status}`);
  console.log(`  assigned_engineer: ${u?.name} (${u?.code}) id=${t.assigned_engineer_id}`);
  console.log(`  principal: ${t.principals?.code}`);
  console.log(`  scheduled_at: ${t.scheduled_at}  → KST ${toKstYmd(t.scheduled_at)}`);
  console.log(`  started_at:   ${t.started_at}    → KST ${toKstYmd(t.started_at)}`);
  console.log(`  completed_at: ${t.completed_at}  → KST ${toKstYmd(t.completed_at)}`);
  console.log(`  received_at:  ${t.received_at}   → KST ${toKstYmd(t.received_at)}`);
  console.log(`  updated_at:   ${t.updated_at}    → KST ${toKstYmd(t.updated_at)}`);
  console.log(`  product=${fmt(t.product_price)} extra=${fmt(t.extra_fee)} total=${fmt(t.total_amount)}`);
  for (const it of (t.task_items||[])) {
    console.log(`    [${it.work_types?.service_types?.code}] unit=${fmt(it.unit_price)} sub=${fmt(it.subtotal)} recv=${fmt(it.received_amount)} order_type=${it.order_type} is_canceled=${it.is_canceled}`);
  }
  const p = Array.isArray(t.payments) ? t.payments[0] : t.payments;
  console.log(`  payment: eng=${fmt(p?.engineer_amount)} principal=${fmt(p?.principal_amount)} owner=${fmt(p?.owner_amount)} calc=${p?.calc_method} track=${p?.track} status=${p?.status} is_balanced=${p?.is_balanced}`);

  // 2) 김현동 6/5 + 6/6 측측 완료 측측
  console.log("\n=== [2] 김현동 측측 완료 측측 (completed_at KST 6/5, 6/6) ===");
  const kimId = "77777777-7777-7777-7777-7777777e0011";
  const { data: kim6 } = await sb.from("tasks").select("task_no, status, completed_at, principal_id, principals:principal_id(code), total_amount, payments(engineer_amount)")
    .eq("assigned_engineer_id", kimId)
    .gte("completed_at", "2026-06-04T15:00:00Z")  // KST 6/5 측측
    .lt("completed_at",  "2026-06-06T15:00:00Z"); // KST 6/7 측측
  console.log(`  measure: ${(kim6||[]).length}건`);
  for (const tk of (kim6||[])) {
    const pp = Array.isArray(tk.payments) ? tk.payments[0] : tk.payments;
    console.log(`    ${tk.task_no}  ${tk.status}  principal=${tk.principals?.code}  completed=${tk.completed_at} → KST ${toKstYmd(tk.completed_at)}  total=${fmt(tk.total_amount)}  eng=${fmt(pp?.engineer_amount)}`);
  }

  // 3) 측측 측측 (scheduled_at KST 측측)
  console.log("\n=== [3] 김현동 scheduled_at KST 6/5, 6/6 측측 ===");
  const { data: kim6s } = await sb.from("tasks").select("task_no, status, scheduled_at, completed_at, principal_id, principals:principal_id(code)")
    .eq("assigned_engineer_id", kimId)
    .gte("scheduled_at", "2026-06-04T15:00:00Z")
    .lt("scheduled_at",  "2026-06-06T15:00:00Z");
  for (const tk of (kim6s||[])) {
    console.log(`    ${tk.task_no}  ${tk.status}  principal=${tk.principals?.code}  sched=${tk.scheduled_at} → KST ${toKstYmd(tk.scheduled_at)}  done=${tk.completed_at} → KST ${toKstYmd(tk.completed_at)}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
