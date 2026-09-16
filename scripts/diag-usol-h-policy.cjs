// 2026-06-02 — usol_h refrigerant 정책 측 principal_fee 측측 (086 적용 여부).
const fs = require("fs"), path = require("path");
function loadEnv(f) {
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
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
  const { data, error } = await sb
    .from("commission_policies")
    .select("principal_code, service_code, appliance_code, calc_method, policy_key, principal_fee, engineer_base, fee_rate")
    .eq("service_code", "refrigerant")
    .order("principal_code")
    .order("appliance_code");
  if (error) { console.error(error); process.exit(1); }
  console.log("=== refrigerant 정책 전체 ===");
  for (const r of data || []) {
    console.log({
      principal: r.principal_code,
      appliance: r.appliance_code,
      calc: r.calc_method,
      principal_fee: r.principal_fee,
      engineer_base: r.engineer_base,
      fee_rate: r.fee_rate,
    });
  }
  process.exit(0);
})();
