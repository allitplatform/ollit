const fs = require("fs"), path = require("path");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
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
  // 측 payment_id 측 측 SELECT — task_id 측 측
  const paymentIds = [
    "57d5e877-0e1c-4a3f-b66d-00109851f190",  // YS-260515-010
    "7c2afe3f-ba5c-4668-8536-455d7032a50e",  // YS-260515-070
    "73b0b8a3-da29-4a93-ad10-e114849f8279",  // YS-260516-022
    "ccb84071-96f7-4990-b8d3-f5a394f28e61",  // YS-260516-116
    "af11a826-c7d5-44b9-bece-b8778501ac62",  // YS-260516-162
  ];
  const { data: pays, error } = await sb.from("payments").select("*").in("id", paymentIds);
  console.log("payments 측 (by id):", error?.message || `${pays?.length}건`);
  if (pays) {
    for (const p of pays) {
      console.log(`\n[${p.id}] task_id=${p.task_id}`);
      console.log(`  calc_method=${p.calc_method} | balanced=${p.is_balanced}`);
      console.log(`  principal=${p.principal_amount} | engineer=${p.engineer_amount} | owner=${p.owner_amount} | total=${p.total_amount}`);
      console.log(`  track=${p.track} | tenant=${p.tenant_id}`);
    }
  }
})();
