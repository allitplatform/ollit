// 2026-06-02 — usol_h 냉매 작업 측 payments 비율 측측.
const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  // 1. usol_h principal id
  const { data: usolH } = await sb.from("principals").select("id, code, name").eq("code", "usol_h").maybeSingle();
  console.log("usol_h principal:", usolH);

  // 2. usol_h refrigerant 작업 측측
  const { data: refriItems } = await sb
    .from("task_items")
    .select(`
      id, task_id, qty, unit_price, subtotal,
      work_types!inner ( id, name, service_types!inner ( code ) ),
      tasks!inner ( id, task_no, customer_name, principal_id, status,
                    product_price, extra_fee, travel_fee, assigned_engineer_id, completed_at )
    `)
    .eq("tasks.principal_id", usolH.id)
    .eq("work_types.service_types.code", "refrigerant")
    .limit(30);
  console.log("");
  console.log(`=== usol_h + refrigerant task_items: ${(refriItems || []).length}건 ===`);
  if (!refriItems || refriItems.length === 0) {
    console.log("(usol_h refrigerant 작업 없음)");
    process.exit(0);
  }

  // 3. unique task_ids → payments JOIN
  const taskIds = [...new Set(refriItems.map(it => it.task_id))];
  const { data: pays } = await sb
    .from("payments")
    .select("task_id, engineer_amount, owner_amount, principal_amount, calc_method, status, computed_at")
    .in("task_id", taskIds);
  const payMap = new Map((pays || []).map(p => [p.task_id, p]));

  // 4. users.refrigerant_rate
  const engIds = [...new Set(refriItems.map(it => it.tasks?.assigned_engineer_id).filter(Boolean))];
  const { data: usersRows } = await sb
    .from("users")
    .select("id, code, name, refrigerant_rate")
    .in("id", engIds);
  const userMap = new Map((usersRows || []).map(u => [u.id, u]));

  for (const it of refriItems) {
    const t = it.tasks;
    const p = payMap.get(t.id);
    const eng = userMap.get(t.assigned_engineer_id);
    if (!p) continue;
    const eng_amt = Number(p.engineer_amount) || 0;
    const own_amt = Number(p.owner_amount) || 0;
    const prn_amt = Number(p.principal_amount) || 0;
    const sum = eng_amt + own_amt + prn_amt;
    const engPct = sum > 0 ? (eng_amt / sum * 100).toFixed(1) : "n/a";
    const ownPct = sum > 0 ? (own_amt / sum * 100).toFixed(1) : "n/a";
    const prnPct = sum > 0 ? (prn_amt / sum * 100).toFixed(1) : "n/a";
    console.log({
      task_no: t.task_no,
      status: t.status,
      qty: it.qty,
      subtotal: it.subtotal,
      product_price: t.product_price,
      eng_amt, own_amt, prn_amt,
      sum,
      engPct: engPct + "%",
      ownPct: ownPct + "%",
      prnPct: prnPct + "%",
      eng_code: eng?.code,
      eng_name: eng?.name,
      refrigerant_rate: eng?.refrigerant_rate,
      calc_method: p.calc_method,
    });
  }
  process.exit(0);
})();
