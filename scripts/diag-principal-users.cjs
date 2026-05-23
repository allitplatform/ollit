// 원청 로그인 측 측 — users 측 role='principal' / usol_n 측
const fs = require("fs"), path = require("path");
function loadEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!process.env[m[1]]) process.env[m[1]] = v; } }
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

(async () => {
  // users 측 columns 측
  const { data: sample } = await sb.from("users").select("*").limit(1);
  console.log(`users 측 columns: ${sample?.[0] ? Object.keys(sample[0]).join(", ") : "(X)"}\n`);

  // 측 측 측 측 (role / code / principal_code / principal_id 측 다양 측 측 측)
  const probes = [
    { col: "role", value: "principal" },
    { col: "role", value: "partner" },
    { col: "user_role", value: "principal" },
    { col: "user_role", value: "partner" },
  ];
  for (const p of probes) {
    const { data, error } = await sb.from("users").select("id, name, code").eq("tenant_id", TENANT_ID).eq(p.col, p.value).limit(10);
    if (error) { if (error.message.includes("does not exist")) continue; console.log(`  ${p.col}=${p.value}: err=${error.message}`); }
    else console.log(`  ${p.col}='${p.value}': ${data?.length || 0}건`);
  }

  // user_roles 별도 테이블 측
  const { data: ur, error: urErr } = await sb.from("user_roles").select("*").limit(5);
  console.log(`\nuser_roles 측: ${urErr ? "측 X — " + urErr.message : `${ur?.length || 0}건 / columns=${ur?.[0] ? Object.keys(ur[0]).join(", ") : "(X)"}`}`);
  if (ur?.length > 0) {
    const { data: principalRoles } = await sb.from("user_roles").select("user_id, role, principal_code").eq("role", "principal");
    console.log(`  role='principal' 측: ${principalRoles?.length || 0}건`);
    if (principalRoles?.length > 0) {
      const userIds = principalRoles.map(r => r.user_id);
      const { data: users } = await sb.from("users").select("id, name, code").in("id", userIds);
      for (const u of (users || [])) {
        const role = principalRoles.find(r => r.user_id === u.id);
        console.log(`    · ${u.name} | code=${u.code} | principal_code=${role?.principal_code || "(X)"}`);
      }
    }
  }

  // code prefix 측 측 — 원청 측 code 측 측 측 측 (예: P-, PR- 등)
  const { data: allUsers } = await sb.from("users").select("id, name, code").eq("tenant_id", TENANT_ID);
  const prefixes = {};
  for (const u of (allUsers || [])) {
    const pfx = String(u.code || "").split(/[-0-9]/)[0] || "(빈)";
    prefixes[pfx] = (prefixes[pfx] || 0) + 1;
  }
  console.log(`\nusers code prefix 분포:`);
  for (const [k, v] of Object.entries(prefixes).sort((a, b) => b[1] - a[1])) console.log(`  · ${k}: ${v}건`);

  // 측 — name 측 "유솔" 측 측 측 measurement 측 측
  const { data: usolUsers } = await sb.from("users").select("id, name, code").eq("tenant_id", TENANT_ID).ilike("name", "%유솔%");
  console.log(`\nname measurement '유솔' user: ${usolUsers?.length || 0}건`);
  for (const u of (usolUsers || [])) console.log(`  · ${u.name} | code=${u.code}`);
})();
