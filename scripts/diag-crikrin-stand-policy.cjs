// crikrin/refrigerant/stand 정책 + appliance_types stand 존재 확인
const fs = require("fs"), path = require("path");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env"));
loadEnv(path.join(__dirname, "..", ".env.local"));

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  // 1) appliance_types stand
  const { data: at } = await sb.from("appliance_types").select("id, code, name").eq("code", "stand").single();
  console.log("appliance_types stand:", at);

  // 2) crikrin refrigerant stand 정책
  const { data: pol } = await sb.from("commission_policies")
    .select("principal_code, service_code, appliance_code, calc_method, fee_rate, principal_fee, policy_key, qty_condition")
    .eq("principal_code", "crikrin")
    .eq("service_code", "refrigerant")
    .eq("appliance_code", "stand");
  console.log("crikrin/refrigerant/stand 정책:", pol);

  // 3) 수동 시뮬 — 비율_견적금액 fee_rate=0.2, total=0+110000=110000, rate=60
  if (pol && pol.length) {
    const total = 0 + 110000;
    const rate = 60;
    const newEng = Math.floor(total * rate / 100);
    const newPrin = Math.floor(total * Number(pol[0].fee_rate));
    const newOwner = Math.max(0, total - newEng - newPrin);
    console.log(`\n수동 시뮬 (v19 적용, total=${total}, rate=${rate}):`);
    console.log(`  engineer=${newEng.toLocaleString()} principal=${newPrin.toLocaleString()} owner=${newOwner.toLocaleString()}`);
  }
})().catch(e => console.log("FATAL:", e.message));
