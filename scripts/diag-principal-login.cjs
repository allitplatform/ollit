// 유솔 로그인 진단 — 수정 X
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

(async () => {
  // [1] P003 측
  const { data: p003 } = await sb.from("users").select("*").eq("tenant_id", TENANT_ID).eq("code", "P003").maybeSingle();
  console.log(`[1] P003 측:`);
  if (!p003) console.log(`  X`);
  else {
    console.log(`  id: ${p003.id}`);
    console.log(`  name: ${p003.name}`);
    console.log(`  code: ${p003.code}`);
    console.log(`  phone: ${p003.phone}`);
    console.log(`  email: ${p003.email}`);
    console.log(`  is_active: ${p003.is_active}`);
    console.log(`  password_hash: ${p003.password_hash ? "측 측 (" + String(p003.password_hash).slice(0, 10) + "...)" : "NULL"}`);
    console.log(`  must_change_password: ${p003.must_change_password}`);
    console.log(`  must_change_pin: ${p003.must_change_pin}`);
    console.log(`  last_login_at: ${p003.last_login_at}`);
  }

  // [2] user_roles 측 P003 측
  if (p003) {
    const { data: roles } = await sb.from("user_roles").select("*").eq("user_id", p003.id);
    console.log(`\n[2] user_roles 측 P003 (${roles?.length || 0}건):`);
    for (const r of (roles || [])) {
      console.log(`  · role=${r.role} | principal_id=${r.principal_id || "(X)"} | is_primary=${r.is_primary} | granted_at=${r.granted_at}`);
    }
  }

  // [3] usol_n principal
  const { data: princUsolN } = await sb.from("principals").select("*").eq("code", "usol_n").maybeSingle();
  console.log(`\n[3] principals usol_n:`);
  console.log(`  id: ${princUsolN?.id}`);
  console.log(`  code: ${princUsolN?.code}`);
  console.log(`  name: ${princUsolN?.name}`);
  console.log(`  prefix: ${princUsolN?.prefix}`);

  // [4] user_roles 측 role 측 측
  const { data: allRoles } = await sb.from("user_roles").select("role");
  const dist = {};
  for (const r of (allRoles || [])) dist[r.role] = (dist[r.role] || 0) + 1;
  console.log(`\n[4] user_roles role 측 분포:`);
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(`  · ${k}: ${v}건`);
})();
