// usol_h 측측 정책 측측 + YS-260605-001 측측측
//   백업 → UPDATE → compute_payment → verify
const fs = require("fs"), path = require("path");
function L(f){ if(!fs.existsSync(f))return; for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(!m)continue;let v=m[2];if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!process.env[m[1]])process.env[m[1]]=v;} }
L(path.join(__dirname, "..", ".env"));
L(path.join(__dirname, "..", ".env.local"));
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const fmt = (n) => n == null ? "—" : Math.round(Number(n)).toLocaleString();

const TARGET_TASK_NO = "YS-260605-001";

(async () => {
  // === 측측 1: 측측 task_id + 백업 ===
  console.log("\n=== 측측 1: 백업 ===");
  const { data: target } = await sb.from("tasks").select("id, task_no").eq("task_no", TARGET_TASK_NO).maybeSingle();
  if (!target) { console.error("측측 task 측측 측측"); process.exit(1); }
  console.log(`측측: ${target.task_no} id=${target.id}`);

  const { data: policies } = await sb.from("commission_policies").select("*")
    .eq("tenant_id", "11111111-1111-1111-1111-111111111111")
    .eq("principal_code", "usol_h").eq("service_code", "refrigerant");
  const { data: payment } = await sb.from("payments").select("*").eq("task_id", target.id);

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupPath = path.join(dataDir, `usolh-refri-fix-backup-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ policies, payment }, null, 2), "utf8");
  console.log(`✓ 백업: ${backupPath}`);
  console.log(`  commission_policies: ${policies.length}건`);
  console.log(`  payments: ${payment.length}건`);

  // === 측측 2: 정책 UPDATE ===
  console.log("\n=== 측측 2: commission_policies UPDATE ===");
  const { data: updated, error: uErr } = await sb.from("commission_policies")
    .update({ calc_method: "직영_50_50" })
    .eq("tenant_id", "11111111-1111-1111-1111-111111111111")
    .eq("principal_code", "usol_h").eq("service_code", "refrigerant")
    .select("appliance_code, calc_method");
  if (uErr) { console.error("UPDATE 측측:", uErr); process.exit(1); }
  console.log(`✓ UPDATE ${updated.length}건`);
  for (const p of updated) console.log(`  ${p.appliance_code} → calc_method=${p.calc_method}`);

  // === 측측 3: compute_payment 측측측 ===
  console.log(`\n=== 측측 3: compute_payment(${target.task_no}) ===`);
  const { data: cpRes, error: cpErr } = await sb.rpc("compute_payment", { p_task_id: target.id });
  if (cpErr) { console.error("compute_payment 측측:", cpErr); process.exit(1); }
  console.log(`✓ compute_payment 측측: ${JSON.stringify(cpRes)?.slice(0, 200)}`);

  // === 측측 4: verify ===
  console.log("\n=== 측측 4: verify ===");
  const { data: newPay } = await sb.from("payments").select("engineer_amount, principal_amount, owner_amount, calc_method, is_balanced").eq("task_id", target.id).maybeSingle();
  console.log(`  engineer=${fmt(newPay?.engineer_amount)}  principal=${fmt(newPay?.principal_amount)}  owner=${fmt(newPay?.owner_amount)}  calc=${newPay?.calc_method}  is_balanced=${newPay?.is_balanced}`);
  const expected = { engineer: 82000, principal: 0, owner: 68000 };
  const ok = newPay?.engineer_amount === expected.engineer
          && newPay?.principal_amount === expected.principal
          && newPay?.owner_amount === expected.owner
          && newPay?.is_balanced === true;
  console.log(ok ? "\n✓ 측측측 통과 — 기사 82,000 / 회사 68,000 / 원청 0 / is_balanced=true" : "\n⚠️ 측측측 측측 — 측측 측측 측측");
  if (!ok) process.exit(2);

  // === 측측 5: 측측 측측 측측 측측 측측 ===
  console.log("\n=== 측측 5: 측측 정책 측측 (회귀 측측) ===");
  const { data: otherPol } = await sb.from("commission_policies")
    .select("principal_code, calc_method, principal_fee")
    .eq("service_code", "refrigerant")
    .neq("principal_code", "usol_h");
  const byP = {};
  for (const r of (otherPol||[])) {
    if (!byP[r.principal_code]) byP[r.principal_code] = new Set();
    byP[r.principal_code].add(r.calc_method);
  }
  for (const [k, v] of Object.entries(byP)) {
    console.log(`  ${k}: ${[...v].join(", ")}`);
  }
  // usol_h 세척 측측 측측
  const { data: usolhCleanPol } = await sb.from("commission_policies")
    .select("calc_method").eq("principal_code", "usol_h").eq("service_code", "cleaning");
  const cleanMethods = [...new Set((usolhCleanPol||[]).map(r => r.calc_method))];
  console.log(`  usol_h cleaning: ${cleanMethods.join(", ")} (측측 측측)`);
})().catch(e => { console.error("FATAL", e); process.exit(1); });
