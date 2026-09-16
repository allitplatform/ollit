// 조동욱 (E022) refrigerant_rate 확인 + usol_h refri 정책 확인
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const { data: u } = await sb.from("users")
    .select("id, name, code, refrigerant_rate")
    .eq("id", "77777777-7777-7777-7777-777777770022").maybeSingle();
  console.log("─── 기사 조동욱 ───");
  console.log(`  code: ${u.code}  name: ${u.name}  refrigerant_rate: ${u.refrigerant_rate}`);

  console.log("\n─── usol_h refrigerant 정책 (commission_policies) ───");
  const { data: pols } = await sb.from("commission_policies")
    .select("policy_key, principal_code, service_code, appliance_code, calc_method, principal_fee, engineer_base, fee_rate")
    .eq("principal_code", "usol_h")
    .eq("service_code", "refrigerant");
  for (const p of pols) console.log(" ", JSON.stringify(p));
})().catch(e => { console.error("FATAL", e); process.exit(1); });
