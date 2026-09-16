const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // role = 'partner' 또는 'principal' 사용자 전체 — 측 측 측 측 측 측
  const { data: users } = await sb.from("users").select("id, name, phone, role, partner_no, principal_id").in("role", ["partner","principal"]);
  console.log(`partner/principal users (${users?.length || 0}건):`);
  for (const u of (users || [])) {
    const endsWithNim = u.name?.endsWith("님");
    console.log(`  · "${u.name}" ${endsWithNim ? "← 측 '님' 측" : ""} | phone=${u.phone} | role=${u.role} | partner_no=${u.partner_no || "(NULL)"} | principal_id=${u.principal_id?.slice(-3) || "(NULL)"}`);
  }
  // user_roles 측 측 측 measurement P003 측 catch
  const { data: ur } = await sb.from("user_roles").select("user_id, role, principal_id").eq("role", "principal");
  console.log(`\nuser_roles role=principal (${ur?.length || 0}건):`);
  const userIds = [...new Set((ur || []).map(r => r.user_id))];
  if (userIds.length > 0) {
    const { data: detail } = await sb.from("users").select("id, name, phone, partner_no").in("id", userIds);
    for (const u of (detail || [])) {
      const roles = (ur || []).filter(r => r.user_id === u.id);
      console.log(`  · "${u.name}" | ${u.phone} | partner_no=${u.partner_no || "(NULL)"} | role_rows=${roles.length}`);
      for (const r of roles) console.log(`    └ principal_id=${r.principal_id?.slice(-3) || "(NULL)"}`);
    }
  }
})();
