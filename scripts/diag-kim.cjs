const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 김태원
  const { data } = await sb.from("tasks").select("id, task_no, customer_name, scheduled_at, scheduled_date, scheduled_time, requested_date, requested_time, received_at, external_received_at, category_data, channel, principal_id").ilike("customer_name", "%김태원%");
  console.log(`측 catch: ${data?.length || 0}`);
  for (const r of (data || [])) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`task_no: ${r.task_no} | customer: ${r.customer_name} | channel: ${r.channel}`);
    console.log(`scheduled_at:   ${r.scheduled_at}`);
    console.log(`scheduled_date: ${r.scheduled_date}`);
    console.log(`scheduled_time: ${r.scheduled_time}`);
    console.log(`requested_date: ${r.requested_date}`);
    console.log(`requested_time: ${r.requested_time}`);
    console.log(`received_at:    ${r.received_at}`);
    console.log(`external_received_at: ${r.external_received_at}`);
    console.log(`category_data:  ${JSON.stringify(r.category_data)}`);
  }

  // 측 측 — scheduled_date 측 catch 측 X 측 X 측 catch
  console.log(`\n\n${"=".repeat(70)}\n측 측 scheduled_date 측 catch 측 X 측 X (15/94 형식)`);
  const { data: all } = await sb.from("tasks").select("task_no, customer_name, scheduled_date, requested_date").not("scheduled_date", "is", null).limit(2000);
  const weird = (all || []).filter(r => {
    const d = String(r.scheduled_date || "");
    return d && !d.match(/^\d{4}-\d{2}-\d{2}/);
  });
  console.log(`이상 scheduled_date: ${weird.length}건`);
  for (const w of weird.slice(0, 5)) console.log(`  · ${w.task_no} | ${w.customer_name} | scheduled_date: "${w.scheduled_date}"`);

  const weird2 = (all || []).filter(r => {
    const d = String(r.requested_date || "");
    return d && !d.match(/^\d{4}-\d{2}-\d{2}/);
  });
  console.log(`이상 requested_date: ${weird2.length}건`);
  for (const w of weird2.slice(0, 5)) console.log(`  · ${w.task_no} | ${w.customer_name} | requested_date: "${w.requested_date}"`);
})();
