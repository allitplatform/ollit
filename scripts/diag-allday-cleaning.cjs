// allday 세척 정책 측측 + recompute dry-run (principal_id 측측측 측측측 측측 측측 측측)
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

(async () => {
  // allday 세척 정책
  console.log("=== allday 세척 commission_policies ===");
  const { data: pol } = await sb.from("commission_policies")
    .select("appliance_code, policy_key, calc_method, principal_fee, engineer_base, fee_rate")
    .eq("principal_code","allday").eq("service_code","cleaning").order("appliance_code");
  for (const p of (pol||[])) {
    console.log(`  ${p.appliance_code} key=${p.policy_key} calc=${p.calc_method} principal_fee=${fmt(p.principal_fee)} eng_base=${fmt(p.engineer_base)} fee_rate=${p.fee_rate ?? "—"}`);
  }

  // allday 측측 정책
  console.log("\n=== allday 측측 commission_policies ===");
  const { data: pol2 } = await sb.from("commission_policies")
    .select("appliance_code, policy_key, calc_method, principal_fee, engineer_base, fee_rate")
    .eq("principal_code","allday").eq("service_code","refrigerant").order("appliance_code");
  for (const p of (pol2||[])) {
    console.log(`  ${p.appliance_code} key=${p.policy_key} calc=${p.calc_method} principal_fee=${fmt(p.principal_fee)} eng_base=${fmt(p.engineer_base)} fee_rate=${p.fee_rate ?? "—"}`);
  }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
