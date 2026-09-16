const fs = require("fs"), path = require("path");
function loadEnv(f) { if (!fs.existsSync(f)) return; for (const l of fs.readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if(!m) continue; let v=m[2]; if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); if(!process.env[m[1]]) process.env[m[1]]=v; } }
loadEnv(path.join(__dirname,"..",".env")); loadEnv(path.join(__dirname,"..",".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken:false, persistSession:false } });

(async () => {
  // commission_policies refrigerant 측측 appliance_code
  const { data: pols } = await sb.from("commission_policies")
    .select("principal_code, appliance_code")
    .eq("service_code", "refrigerant")
    .order("principal_code");
  const codes = new Set();
  for (const p of pols || []) if (p.appliance_code) codes.add(p.appliance_code);
  console.log("=== commission_policies.appliance_code (refrigerant) ===");
  console.log([...codes].sort());

  // appliance_types 측측 측측
  const { data: ats } = await sb.from("appliance_types").select("code, name");
  console.log("\n=== appliance_types ===");
  for (const a of ats || []) console.log(`  ${a.code} → ${a.name}`);

  // 측측 측측 — calculate_commission 측측 호출
  console.log("\n=== calculate_commission test ===");
  for (const test of [
    ['usol_h', 'refrigerant', 'wall',   70000],
    ['usol_h', 'refrigerant', '벽걸이', 70000],
    ['allday', 'refrigerant', 'wall',   80000],
    ['allday', 'refrigerant', '벽걸이', 80000],
    ['KA',     'refrigerant', '1way',   90000],
  ]) {
    const { data, error } = await sb.rpc("calculate_commission", {
      p_principal_code: test[0],
      p_service_code:   test[1],
      p_appliance_code: test[2],
      p_quoted_amount:  test[3],
      p_extra_amount:   0,
      p_naver_fee:      0,
      p_qty_condition:  null,
    });
    console.log(`${test[0]}/${test[1]}/${test[2]}/${test[3]}:`, error ? `ERR ${error.message}` : data);
  }
  process.exit(0);
})();
