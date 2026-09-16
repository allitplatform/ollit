const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 측 catch usol_n + usol_h 측 1way + 중랑구 측 measurement
  const USOL_H = "22222222-2222-2222-2222-222222222005";
  const USOL_N = "22222222-2222-2222-2222-222222222006";
  const { data: all } = await sb.from("tasks").select("id, task_no, customer_name, district, address, scheduled_at, scheduled_date, scheduled_time, requested_date, requested_time, channel, category_data").in("principal_id", [USOL_H, USOL_N]);
  console.log(`usol_h+n 측: ${all?.length || 0}건\n`);
  
  // 중랑구 측
  const jrg = (all || []).filter(r => String(r.district || "").includes("중랑") || String(r.address || "").includes("중랑"));
  console.log(`중랑구: ${jrg.length}건`);
  
  // 측 측 — date 측 catch 측 measurement parseable X 측 X 측 X
  const weird = (all || []).filter(r => {
    const fields = [r.scheduled_date, r.requested_date].filter(Boolean);
    for (const f of fields) {
      const m = String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const mm = parseInt(m[2]), dd = parseInt(m[3]);
        if (mm > 12 || dd > 31 || mm < 1 || dd < 1) return true;
      }
    }
    if (r.scheduled_at) {
      const d = new Date(r.scheduled_at);
      if (isNaN(d.getTime())) return true;
    }
    return false;
  });
  console.log(`측 catch 측 측 catch: ${weird.length}건`);
  for (const w of weird.slice(0, 10)) {
    console.log(`  · ${w.task_no} | "${w.customer_name}" | district=${w.district}`);
    console.log(`    scheduled_at: ${w.scheduled_at}`);
    console.log(`    scheduled_date: ${w.scheduled_date}`);
    console.log(`    requested_date: ${w.requested_date}`);
  }

  // 측 ㄱ측 customer (김 측 catch)
  console.log(`\n측 ㄱ 측 catch customer_name:`);
  const kims = (all || []).filter(r => String(r.customer_name || "").includes("김"));
  for (const k of kims.slice(0, 30)) console.log(`  · ${k.task_no} | "${k.customer_name}" | district=${k.district}`);
})();
