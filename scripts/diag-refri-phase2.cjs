// 2026-06-03 — Phase 2 진단:
//   (2) refrigerant work_types 측 appliance 매핑
//   (3) 원청별 refrigerant commission_policies 측측
//   (4) refrigerant_addon 측측 측측 측측 측측 측측측 측측 측측
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
  // ── (2) service_types: refrigerant 확인 ──
  const { data: srvs } = await sb
    .from("service_types").select("id, code, name, category_id");
  const refrigerant = (srvs || []).find(s => s.code === "refrigerant");
  console.log("=== (2a) service_types refrigerant ===");
  console.log(refrigerant);

  // ── (2b) refrigerant work_types ──
  const { data: wts } = await sb
    .from("work_types")
    .select(`id, code, name, default_unit_price,
             service_type:service_types ( code ),
             appliance_type:appliance_types ( code, name )`);
  const refriWts = (wts || []).filter(w => w.service_type?.code === "refrigerant");
  console.log("\n=== (2b) refrigerant work_types ===");
  for (const w of refriWts) {
    console.log({
      id: w.id, code: w.code, name: w.name,
      default_unit_price: w.default_unit_price,
      appliance: w.appliance_type?.name + ` (${w.appliance_type?.code})`,
    });
  }

  // 측측 사용자 spec 측 5개 appliance 매핑:
  const targets = ["wall", "stand", "2in1", "4way", "1way"];
  console.log("\n=== (2c) 사용자 spec appliance 측측 측측 ===");
  for (const code of targets) {
    const found = refriWts.filter(w => w.appliance_type?.code === code);
    console.log(`${code}: ${found.length}건 — ${found.map(w => w.name).join(", ") || "❌ 없음"}`);
  }

  // ── (3) 원청별 refrigerant 정책 ──
  const { data: pols } = await sb
    .from("commission_policies")
    .select("principal_code, appliance_code, calc_method, policy_key, principal_fee, engineer_base, fee_rate")
    .eq("service_code", "refrigerant")
    .order("principal_code")
    .order("appliance_code");
  console.log("\n=== (3) 원청별 refrigerant 정책 ===");
  const byPrincipal = {};
  for (const p of (pols || [])) {
    if (!byPrincipal[p.principal_code]) byPrincipal[p.principal_code] = [];
    byPrincipal[p.principal_code].push(p);
  }
  const PRINCIPALS = ["allday", "KA", "KB", "yongin", "usol_h", "usol_n", "crikrin"];
  for (const code of PRINCIPALS) {
    const items = byPrincipal[code] || [];
    if (items.length === 0) {
      console.log(`${code}: ❌ 냉매 정책 없음`);
      continue;
    }
    const appls = items.map(p => p.appliance_code || "(null)").join(", ");
    const methods = [...new Set(items.map(p => p.calc_method))].join(",");
    console.log(`${code}: ${items.length}건  appliance=[${appls}]  method=${methods}`);
  }

  // ── (4) refrigerant_addon 측측 task 측측 측측 ──
  console.log("\n=== (4) category_data.refrigerant_addon 측측 measure 측측 ===");
  const { data: addons } = await sb
    .from("tasks")
    .select("id, task_no, customer_name, status, completed_at, category_data, principal_id")
    .not("category_data->refrigerant_addon", "is", null)
    .limit(5);
  console.log(`측측 task 측: ${(addons || []).length}건`);
  for (const t of (addons || [])) {
    console.log({
      task_no: t.task_no,
      customer: t.customer_name,
      status: t.status,
      refrigerant_addon: t.category_data?.refrigerant_addon,
    });
  }
  console.log("\n측측 jsonb path 측측 — 측측 측측 측측측 측측측 측측 측측 측측 measure.");
  process.exit(0);
})();
