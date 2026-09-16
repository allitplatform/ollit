const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  console.log("user_roles 측 role distinct 분포:");
  const { data: ur } = await sb.from("user_roles").select("role");
  const dist = {};
  for (const r of (ur || [])) dist[r.role] = (dist[r.role] || 0) + 1;
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(`  · ${k}: ${v}건`);

  console.log("\n사장님/회사 admin role 측 catch 측 사용자:");
  const { data: admins } = await sb.from("user_roles").select("user_id, role").in("role", ["admin","owner","operator"]);
  const uids = [...new Set((admins || []).map(a => a.user_id))];
  for (const uid of uids) {
    const { data: u } = await sb.from("users").select("name, code, phone").eq("id", uid).maybeSingle();
    const roles = (admins || []).filter(a => a.user_id === uid).map(a => a.role);
    console.log(`  · "${u?.name || '(X)'}" code=${u?.code} | phone=${u?.phone} | roles=${roles.join(",")}`);
  }
})();
