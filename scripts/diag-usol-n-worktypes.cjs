// 2026-06-03 — usol_n task_items 측 work_types.name 측측 측측.
//   getWorkTypeColors(name) 측측측 측측 측측 측측측 (❄세척 / ⚡냉매 / 🔧기타).
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

// EngineerApp 측측 getWorkTypeColors 측측 측측.
function classify(name) {
  if (!name) return "🔧 기타 (name=NULL)";
  const t = String(name).toLowerCase();
  if (t.includes("세척")) return "❄ 세척";
  if (t.includes("냉매") || t.includes("충전")) return "⚡ 냉매";
  return "🔧 기타";
}

(async () => {
  const { data: usolP } = await sb.from("principals").select("id").eq("code", "usol_n").maybeSingle();
  // task_items × work_types × tasks(완료) join
  const { data } = await sb
    .from("task_items")
    .select(`order_type, work_types ( name ), tasks!inner ( principal_id, status )`)
    .eq("tasks.principal_id", usolP.id)
    .eq("tasks.status", "완료")
    .limit(3000);

  const byOrderType = {};
  const seenNames = new Set();
  for (const it of (data || [])) {
    const ot = it.order_type || "(null)";
    const name = it.work_types?.name || "(null)";
    seenNames.add(name);
    const cls = classify(name);
    if (!byOrderType[ot]) byOrderType[ot] = {};
    if (!byOrderType[ot][cls]) byOrderType[ot][cls] = { count: 0, names: new Set() };
    byOrderType[ot][cls].count += 1;
    byOrderType[ot][cls].names.add(name);
  }
  console.log("=== usol_n 완료 task_items: order_type × 측측 ===");
  for (const ot of Object.keys(byOrderType)) {
    console.log(`\n[${ot}]`);
    for (const cls of Object.keys(byOrderType[ot])) {
      const o = byOrderType[ot][cls];
      console.log(`  ${cls}: ${o.count}건  names=[${[...o.names].join(", ")}]`);
    }
  }
  process.exit(0);
})();
