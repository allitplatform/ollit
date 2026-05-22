const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  // YS-260515-010 task_id catch
  const { data: t } = await sb.from("tasks").select("id, task_no, status").eq("task_no", "YS-260515-010").maybeSingle();
  console.log("task:", t);
  const { data: items } = await sb.from("task_items").select("id, unit_price, qty, order_type, work_type_id, appliance_type_id").eq("task_id", t.id);
  console.log("items count:", items?.length);
  console.log("items:", items);
  // payments lookup
  const { data: pays } = await sb.from("payments").select("id, principal_amount, engineer_amount").eq("task_id", t.id);
  console.log("payments:", pays);
})();
