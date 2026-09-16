const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const usolHId = "22222222-2222-2222-2222-222222222005";
  const usolNId = "22222222-2222-2222-2222-222222222006";
  const { data: relevant } = await sb.from("user_roles").select("user_id, role, principal_id").in("principal_id", [usolHId, usolNId]);
  console.log(`user_roles rows (${relevant?.length || 0}):`);
  console.log(JSON.stringify(relevant, null, 2));

  const ids = [...new Set((relevant || []).map(r => r.user_id))];
  console.log(`\nunique user_ids: ${ids.length} — ${JSON.stringify(ids)}`);

  if (ids.length > 0) {
    const { data: us, error } = await sb.from("users").select("id, name, phone, role, partner_no").in("id", ids);
    console.log(`\nusers fetch (${us?.length || 0}건) ${error ? `err=${error.message}` : ""}:`);
    for (const u of (us || [])) {
      console.log(`  · "${u.name}" | partner_no=${u.partner_no} | role=${u.role} | phone=${u.phone}`);
    }
  }

  // partner_no = P003 측 측 catch — 측 측 측 측 측 측 X (측 측 측 측)
  const { data: byP } = await sb.from("users").select("id, name, partner_no, phone, role").not("partner_no", "is", null).limit(20);
  console.log(`\npartner_no NOT NULL users (top 20):`);
  for (const u of (byP || [])) console.log(`  · ${u.partner_no} | "${u.name}" | role=${u.role}`);
})();
