const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // user_roles 전체 측 catch (role 측 측)
  const { data: ur } = await sb.from("user_roles").select("user_id, role, principal_id");
  const roleDist = {};
  for (const r of (ur || [])) roleDist[r.role] = (roleDist[r.role] || 0) + 1;
  console.log(`user_roles role 분포:`);
  for (const [k, v] of Object.entries(roleDist).sort((a, b) => b[1] - a[1])) console.log(`  · ${k}: ${v}건`);

  // principal 측 측 측 측 (partner / vendor / client measurement)
  const usolHId = "22222222-2222-2222-2222-222222222005";
  const usolNId = "22222222-2222-2222-2222-222222222006";
  const { data: relevant } = await sb.from("user_roles").select("user_id, role, principal_id").in("principal_id", [usolHId, usolNId]);
  console.log(`\nuser_roles 측 usol_h/n principal_id measurement ${relevant?.length || 0}건:`);
  const ids = [...new Set((relevant || []).map(r => r.user_id))];
  for (const id of ids) {
    const { data: u } = await sb.from("users").select("id, name, phone, role, partner_no").eq("id", id).maybeSingle();
    const rs = (relevant || []).filter(r => r.user_id === id);
    if (u) {
      const endsWithNim = u.name?.endsWith("님");
      console.log(`  · "${u.name}" ${endsWithNim ? "← 측 '님' 측" : ""}`);
      console.log(`    user.role: "${u.role}"  partner_no: ${u.partner_no || "(NULL)"}  phone: ${u.phone}`);
      for (const r of rs) console.log(`    └ role=${r.role}  principal_id=...${r.principal_id?.slice(-3)}`);
    }
  }
})();
